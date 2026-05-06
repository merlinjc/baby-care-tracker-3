/**
 * Playwright 共享 fixture：从 globalSetup 输出读 seed + 预热的 token
 *
 * - globalSetup（playwright.config.ts → e2e/global-setup.ts）已 reset 数据 + 预热所有 token
 * - 这里只读 .auth/seed-state.json，spec 内零额外登录请求 → 完全规避 authRateLimit
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export interface SeedSummary {
  password: string;
  accounts: Record<
    'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6',
    { id: string; email: string; nickname: string }
  >;
  families: {
    A: { id: string; inviteCode: string; name: string };
    B: { id: string; inviteCode: string; name: string };
  };
  babies: {
    A1: { id: string; name: string; familyId: string };
    A2: { id: string; name: string; familyId: string; bulkRecords: number };
    B1: { id: string; name: string; familyId: string };
  };
}

interface PreloginUser {
  user: { id: string; email: string; nickname: string; [k: string]: unknown };
  token: string;
}

interface SeedState {
  seed: SeedSummary;
  sessions: Record<'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6', PreloginUser>;
}

// globalSetup 写到 <workspace>/.auth/seed-state.json
// fixture 在 e2e/fixtures/，所以路径要回退两级
const STATE_FILE = path.resolve(__dirname, '..', '..', '.auth', 'seed-state.json');

let cachedState: SeedState | null = null;

function readState(): SeedState {
  if (cachedState) return cachedState;
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `[fixtures/seed] missing ${STATE_FILE}. ` +
        `Did playwright globalSetup run? Try: pnpm test:e2e`,
    );
  }
  cachedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as SeedState;
  return cachedState;
}

/** UI 登录：填邮箱密码，等待跳转到主路由（非 /login）。慢但贴近真实场景 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('请输入邮箱').fill(email);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: /^登录$/ }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10_000 });
}

/**
 * API 登录：复用 globalSetup 预热的 token，写入 page localStorage。
 * 完全不打 /api/auth/login，零限流影响。
 *
 * 实现细节：
 * - addInitScript 仅对**未来加载的页面**生效。如果 context 已有 page 且
 *   已经 navigate 到某处，需要后续调用 page.goto() / reload() 才能让 token 注入生效。
 * - JWT 默认 15 分钟过期。如果跑测试时长超过 15min（限流等待 + 多 spec），
 *   预热 token 会失效。fixture 会用 /api/auth/me 验证 token，过期则自动重 login。
 */
async function ensureFreshToken(
  context: BrowserContext,
  email: string,
  password: string,
  cached: { token: string; user: { id: string; [k: string]: unknown } },
): Promise<{ token: string; user: { id: string; [k: string]: unknown } }> {
  const probe = await context.request.get('http://localhost:3000/api/auth/me', {
    headers: { authorization: `Bearer ${cached.token}` },
  });
  if (probe.ok()) return cached;

  // token 过期 → 重新 login（带退避，遇到限流就等 60s 重试）
  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email, password },
    });
    if (res.ok()) {
      const json = await res.json();
      return { token: json.data.accessToken, user: json.data.user };
    }
    if (res.status() === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 65_000));
      continue;
    }
    throw new Error(`re-login ${email} failed: ${res.status()}`);
  }
  throw new Error(`re-login ${email} exceeded retries`);
}

export async function loginViaAPI(
  context: BrowserContext,
  email: string,
  password: string,
): Promise<{ userId: string; token: string }> {
  const state = readState();
  const entry = Object.values(state.sessions).find((s) => s.user.email === email);
  if (!entry) {
    throw new Error(
      `[loginViaAPI] no preloaded session for ${email}. Check global-setup.ts ACCOUNTS list.`,
    );
  }

  // 验证 token 是否仍有效，过期则现场刷新
  const fresh = await ensureFreshToken(context, email, password, {
    token: entry.token,
    user: entry.user,
  });

  await context.addInitScript(
    ({ user, token }) => {
      const persisted = {
        state: { user, token, isAuthenticated: true },
        version: 0,
      };
      localStorage.setItem('baby_care_token', JSON.stringify(persisted));
    },
    { user: fresh.user, token: fresh.token },
  );

  // 如果 context 已有 pages，对每个 page 立即注入 storage（覆盖 addInitScript 仅对 future page 生效的限制）
  for (const page of context.pages()) {
    await page.evaluate(
      ({ user, token }) => {
        const persisted = {
          state: { user, token, isAuthenticated: true },
          version: 0,
        };
        localStorage.setItem('baby_care_token', JSON.stringify(persisted));
      },
      { user: fresh.user as Record<string, unknown>, token: fresh.token },
    ).catch(() => {
      /* about:blank 情况，可忽略 */
    });
  }

  return { userId: fresh.user.id, token: fresh.token };
}

export const test = base.extend<{ seed: SeedSummary }>({
  seed: async ({}, use) => {
    const state = readState();
    await use(state.seed);
  },
});

export { expect };
