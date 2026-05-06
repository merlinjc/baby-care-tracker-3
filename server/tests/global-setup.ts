/**
 * Vitest globalSetup：在所有测试 fork 启动之前执行一次。
 * 负责：删除老 test.db、用 prisma db push 重置 schema。
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const TEST_DB_PATH = path.resolve(__dirname, '../prisma/test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

export async function setup() {
  // 1) 删除老 test.db 与 SQLite 旁文件
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // 2) 用独立的 DATABASE_URL 启动 prisma db push
  execSync('npx prisma db push --skip-generate --force-reset', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });
}

export async function teardown() {
  // 留下 test.db 便于排查
}
