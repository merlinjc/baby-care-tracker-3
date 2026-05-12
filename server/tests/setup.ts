/**
 * 每个测试 fork 的 setup：
 * - vitest.config.ts 已通过 env 注入 DATABASE_URL；这里再强制兜底设置一次
 * - globalSetup 已完成 db push；本文件只负责 beforeEach 清理与 afterAll 断开连接
 */
import path from 'node:path';
import { beforeEach, afterAll } from 'vitest';

// 兜底：确保 prisma client 在被 import 之前能拿到正确的 DATABASE_URL
const TEST_DB_PATH = path.resolve(__dirname, '../prisma/test.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';

// 每个用例前清空业务表（保留 schema）
beforeEach(async () => {
  const { prisma } = await import('../src/config/database');
  // 顺序：先删子表，再删父表（避免 FK 约束）
  await prisma.$transaction([
    prisma.feedingRecord.deleteMany(),
    prisma.sleepRecord.deleteMany(),
    prisma.diaperRecord.deleteMany(),
    prisma.temperatureRecord.deleteMany(),
    prisma.growthRecord.deleteMany(),
    prisma.record.deleteMany(),
    prisma.vaccineRecord.deleteMany(),
    prisma.milestoneRecord.deleteMany(),
    prisma.jaundiceRecord.deleteMany(),
    prisma.dailyCheckin.deleteMany(),
    prisma.baby.deleteMany(),
    prisma.familyMember.deleteMany(),
    prisma.family.deleteMany(),
    prisma.aIQuota.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.operationLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  const { prisma } = await import('../src/config/database');
  await prisma.$disconnect();
});
