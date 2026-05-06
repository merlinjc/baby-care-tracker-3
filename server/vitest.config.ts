import { defineConfig } from 'vitest/config';
import path from 'node:path';

const TEST_DB_PATH = path.resolve(__dirname, './prisma/test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // 排除 E2E 测试（依赖外部 dev 服务 + seed），由 pnpm test:e2e 单独运行
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // 集成测试用真实 SQLite，串行执行避免共享 DB 写竞争
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // 关键：在 prisma client import 之前注入 DATABASE_URL
    env: {
      DATABASE_URL: TEST_DB_URL,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-do-not-use-in-prod',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});

