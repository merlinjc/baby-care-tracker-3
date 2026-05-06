/**
 * Playwright globalSetup：在所有测试启动前运行一次
 * - reset 种子数据
 * - 预热所有测试账号的 access token（避免 spec 内反复 login 触发 authRateLimit）
 *
 * 输出：把 SeedSummary + 各账号 token 写入 .auth/seed-state.json，spec 通过 fixture 读取
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

interface UserInfo {
  id: string;
  email: string;
  nickname: string;
}

interface SeedSummary {
  password: string;
  accounts: Record<'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6', UserInfo>;
  families: Record<string, unknown>;
  babies: Record<string, unknown>;
}

interface PreloginUserState {
  user: UserInfo & Record<string, unknown>;
  token: string;
}

const STATE_DIR = path.resolve(__dirname, '..', '.auth');
const STATE_FILE = path.join(STATE_DIR, 'seed-state.json');

async function postLogin(email: string, password: string, maxRetries = 3): Promise<PreloginUserState> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const json = (await res.json()) as { data: { user: UserInfo; accessToken: string } };
      return { user: json.data.user, token: json.data.accessToken };
    }
    if (res.status === 429 && attempt < maxRetries) {
      // 限流：等 60s 窗口过期再试
      console.log(
        `[globalSetup] login ${email} got 429, waiting 65s before retry ${attempt + 1}/${maxRetries}`,
      );
      await new Promise((r) => setTimeout(r, 65_000));
      continue;
    }
    throw new Error(`login ${email} failed: ${res.status}`);
  }
  throw new Error(`login ${email} exceeded max retries`);
}

async function waitForServer(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await fetch('http://localhost:3000/api/health');
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('backend not reachable at http://localhost:3000');
}

export default async function globalSetup() {
  console.log('[Playwright globalSetup] waiting for backend...');
  await waitForServer();

  console.log('[Playwright globalSetup] running seed-e2e --reset...');
  const cwd = path.resolve(__dirname, '..', 'server');
  const out = execSync('pnpm exec tsx prisma/seed-e2e.ts --reset --json', {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const seed = JSON.parse(out) as SeedSummary;

  console.log('[Playwright globalSetup] preloading tokens...');
  // 串行登录，避免一次性触发 5 个并发被限流
  const sessions: Record<string, PreloginUserState> = {};
  for (const key of ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'] as const) {
    sessions[key] = await postLogin(seed.accounts[key].email, seed.password);
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ seed, sessions }, null, 2),
    'utf-8',
  );

  console.log(`[Playwright globalSetup] done. State written to ${STATE_FILE}`);
}
