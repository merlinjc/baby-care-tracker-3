import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 *
 * 前置：
 *   1. 已运行 `pnpm dev`（前后端同时启动，client :5173 / server :3000）
 *   2. 已运行 `pnpm --filter server db:seed:e2e`
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
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
