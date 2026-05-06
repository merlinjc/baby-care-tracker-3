/**
 * E2E 测试专用 vitest 配置（独立于 vitest.config.ts）
 *
 * 与单元/集成测试的区别：
 * - 不使用 test.db（不调 globalSetup/setupFiles 重置数据库）
 * - 不注入 NODE_ENV=test 等环境变量（让 dev server 保持运行态）
 * - 通过外部 dev server（http://localhost:3000）打 HTTP API
 * - 测试启动前会调用 prisma/seed-e2e.ts --reset 重置 e2e 专用数据
 *
 * 使用：pnpm --filter server test:e2e
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
