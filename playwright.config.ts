import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 *
 * 前置：
 *   1. 已运行 `pnpm dev`（前后端同时启动，client :5173 / server :3000）
 *
 * globalSetup 会在所有测试启动前运行一次：
 *   - reset e2e 种子数据
 *   - 预热所有测试账号的 access token（避免 spec 内反复 login 触发 authRateLimit）
 *   - 输出到 e2e/.auth/seed-state.json
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // globalSetup 可能因 authRateLimit 等待 60s+，给足时间
  globalTimeout: 600_000,
  // 单测试超时调到 120s，因为 fixture 在 token 过期 + 触发 authRateLimit 时需等 60s 再 retry
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // 共享 DB，串行执行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_WEB_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
