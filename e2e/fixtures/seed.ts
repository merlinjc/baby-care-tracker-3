/**
 * Playwright 共享 fixture：seed 数据 + 登录辅助
 */
import { test as base, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
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

let cachedSeed: SeedSummary | null = null;

/** 调用种子脚本（支持复用结果，跨 spec 之间不重复 reset） */
export function ensureSeed(force = false): SeedSummary {
  if (cachedSeed && !force) return cachedSeed;
  const cwd = path.resolve(__dirname, '..', '..', 'server');
  const out = execSync('pnpm exec tsx prisma/seed-e2e.ts --reset --json', {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  cachedSeed = JSON.parse(out) as SeedSummary;
  return cachedSeed;
}

/** UI 登录：填邮箱密码，等待跳转到主路由（非 /login） */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('请输入邮箱').fill(email);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: /^登录$/ }).click();
  // 登录成功 → URL 不再包含 /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
  // 主布局已加载（底部导航出现）
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10_000 });
}

export const test = base.extend<{ seed: SeedSummary }>({
  seed: async ({}, use) => {
    const s = ensureSeed();
    await use(s);
  },
});

export { expect };
