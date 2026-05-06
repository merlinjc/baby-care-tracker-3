/**
 * E2E 测试专用种子脚本
 *
 * 与默认 prisma/seed.ts 解耦，专为 specs/web-feature-parity/e2e-scenarios.md
 * 中 35 个场景准备账号池、双家庭隔离、海量记录（cursor 续传压测）。
 *
 * 用法：
 *   pnpm --filter server exec tsx prisma/seed-e2e.ts                # 默认数据集
 *   pnpm --filter server exec tsx prisma/seed-e2e.ts --reset        # 先清库再种
 *   pnpm --filter server exec tsx prisma/seed-e2e.ts --bulk=5000    # S14 压测
 *   pnpm --filter server exec tsx prisma/seed-e2e.ts --reset --bulk=5000 --json
 *
 * 输出（--json）：将关键 ID 与凭据以 JSON 形式打印到 stdout，供 Playwright/Vitest 解析。
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
const flagReset = args.includes('--reset');
const flagJson = args.includes('--json');
const bulkArg = args.find((a) => a.startsWith('--bulk='));
const BULK = bulkArg ? Math.max(0, Number(bulkArg.split('=')[1]) || 0) : 0;

// ---------- 账号池（与 e2e-scenarios.md §0.1 对齐） ----------
const PASSWORD = 'Test1234!';
const ACCOUNTS = {
  U1: { email: 'u1.mom@e2e.local', nickname: 'momA' },        // FamilyA admin
  U2: { email: 'u2.dad@e2e.local', nickname: 'dadA' },        // FamilyA editor
  U3: { email: 'u3.grandma@e2e.local', nickname: 'grandma' }, // FamilyA viewer
  U4: { email: 'u4.grandmaM@e2e.local', nickname: 'grandmaM' }, // 后加入 editor
  U5: { email: 'u5.guest@e2e.local', nickname: 'guest' },     // 未加入家庭
  U6: { email: 'u6.momB@e2e.local', nickname: 'momB' },       // FamilyB admin
} as const;

type AccountKey = keyof typeof ACCOUNTS;

// ---------- 工具函数 ----------
const log = (msg: string) => {
  if (!flagJson) console.log(msg);
};

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genInviteCode(prefix = 'E2E'): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除 I/O/0/1
  let code = prefix;
  while (code.length < 6) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return code.slice(0, 6);
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// ---------- 主流程 ----------
async function main() {
  log('🌱 [E2E Seed] start');

  if (flagReset) {
    log('⚠️  [E2E Seed] --reset: clearing all e2e data');
    // 仅清理 e2e 邮箱用户及其依赖（保留默认 seed 的 test@baby.care）
    const e2eEmails = Object.values(ACCOUNTS).map((a) => a.email);
    const e2eUsers = await prisma.user.findMany({
      where: { email: { in: e2eEmails } },
      select: { id: true, familyId: true },
    });
    const userIds = e2eUsers.map((u) => u.id);
    const familyIds = Array.from(
      new Set(e2eUsers.map((u) => u.familyId).filter((v): v is string => !!v)),
    );

    // Cascade: family -> familyMember -> baby -> records -> sub records
    await prisma.record.deleteMany({ where: { familyId: { in: familyIds } } });
    await prisma.vaccineRecord.deleteMany({ where: { familyId: { in: familyIds } } });
    await prisma.milestoneRecord.deleteMany({ where: { familyId: { in: familyIds } } });
    await prisma.baby.deleteMany({ where: { familyId: { in: familyIds } } });
    await prisma.familyMember.deleteMany({ where: { familyId: { in: familyIds } } });
    await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.aIQuota.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.operationLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.rateLimit.deleteMany({
      where: { key: { contains: 'e2e' } }, // 仅清 e2e key
    });
    log(`✅ cleared ${userIds.length} users / ${familyIds.length} families`);
  }

  // ---------- 1. 创建用户 ----------
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: Record<AccountKey, { id: string; email: string; nickname: string }> = {} as never;

  for (const [key, info] of Object.entries(ACCOUNTS) as [AccountKey, typeof ACCOUNTS.U1][]) {
    const u = await prisma.user.upsert({
      where: { email: info.email },
      update: { nickname: info.nickname, passwordHash },
      create: { email: info.email, nickname: info.nickname, passwordHash },
    });
    users[key] = { id: u.id, email: u.email!, nickname: u.nickname };
    log(`✅ user ${key}: ${u.nickname} <${u.email}>`);
  }

  // ---------- 2. 创建家庭 A（U1 admin / U2 editor / U3 viewer） ----------
  const familyA = await prisma.family.create({
    data: {
      name: 'FamilyA-E2E',
      creatorId: users.U1.id,
      inviteCode: genInviteCode('E2EA'),
      inviteCodeExpiry: new Date(Date.now() + 7 * 24 * 3600_000),
    },
  });
  await prisma.familyMember.createMany({
    data: [
      { familyId: familyA.id, userId: users.U1.id, role: 'admin', relation: '妈妈', displayName: 'momA' },
      { familyId: familyA.id, userId: users.U2.id, role: 'editor', relation: '爸爸', displayName: 'dadA' },
      { familyId: familyA.id, userId: users.U3.id, role: 'viewer', relation: '奶奶', displayName: 'grandma' },
    ],
  });
  await prisma.user.updateMany({
    where: { id: { in: [users.U1.id, users.U2.id, users.U3.id] } },
    data: { familyId: familyA.id },
  });
  log(`✅ family A created: ${familyA.name} / invite=${familyA.inviteCode}`);

  // ---------- 3. 创建家庭 B（U6 admin） ----------
  const familyB = await prisma.family.create({
    data: {
      name: 'FamilyB-E2E',
      creatorId: users.U6.id,
      inviteCode: genInviteCode('E2EB'),
      inviteCodeExpiry: new Date(Date.now() + 7 * 24 * 3600_000),
    },
  });
  await prisma.familyMember.create({
    data: { familyId: familyB.id, userId: users.U6.id, role: 'admin', relation: '妈妈', displayName: 'momB' },
  });
  await prisma.user.update({ where: { id: users.U6.id }, data: { familyId: familyB.id } });
  log(`✅ family B created: ${familyB.name} / invite=${familyB.inviteCode}`);

  // U4 / U5 故意不分配家庭（U4 后续场景中加入，U5 始终无家庭）

  // ---------- 4. 宝宝 ----------
  const babyA1 = await prisma.baby.create({
    data: {
      familyId: familyA.id,
      name: '小橘',
      gender: 'female',
      birthDate: new Date('2025-10-01'),
    },
  });
  const babyA2 = await prisma.baby.create({
    data: {
      familyId: familyA.id,
      name: '小桃',
      gender: 'male',
      birthDate: new Date('2024-04-12'),
    },
  });
  const babyB1 = await prisma.baby.create({
    data: {
      familyId: familyB.id,
      name: '小雪',
      gender: 'female',
      birthDate: new Date('2025-01-20'),
    },
  });
  log(`✅ babies: ${babyA1.name} / ${babyA2.name} / ${babyB1.name}`);

  // ---------- 5. 基础记录（小橘今日 + 昨日） ----------
  const today = todayLocal();
  const yest = new Date(today.getTime() - 86400_000);

  // ▸ 喂养 3 条
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'feeding',
      startTime: new Date(today.getTime() + 7 * 3600_000),
      createdBy: users.U1.id,
      feedingData: { create: { feedingType: 'breast', duration: 600, breastSide: 'left' } },
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'feeding',
      startTime: new Date(today.getTime() + 11 * 3600_000),
      createdBy: users.U2.id,
      feedingData: { create: { feedingType: 'formula', amount: 120 } },
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'feeding',
      startTime: new Date(today.getTime() + 15 * 3600_000),
      createdBy: users.U2.id,
      feedingData: { create: { feedingType: 'solid', amount: 50 } },
    },
  });

  // ▸ 跨午夜睡眠（S19 用）：昨日 23:50 → 今日 07:00
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'sleep',
      startTime: new Date(yest.getTime() + 23 * 3600_000 + 50 * 60_000),
      endTime: new Date(today.getTime() + 7 * 3600_000),
      createdBy: users.U1.id,
      sleepData: { create: { sleepType: 'night', duration: 7 * 3600 + 10 * 60, location: '婴儿床' } },
    },
  });

  // ▸ 排便 + 体温 + 生长（含异常颜色 & 高温）
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'diaper',
      startTime: new Date(today.getTime() + 9 * 3600_000),
      createdBy: users.U2.id,
      diaperData: { create: { diaperType: 'both', consistency: 'soft', color: 'green' } },
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'temperature',
      startTime: new Date(today.getTime() + 10 * 3600_000),
      createdBy: users.U1.id,
      temperatureData: { create: { temperature: 38.5, method: 'ear' } },
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'growth',
      startTime: new Date(today.getTime() + 10.5 * 3600_000),
      createdBy: users.U1.id,
      growthData: { create: { height: 65, weight: 7.2, headCircumference: 42 } },
    },
  });
  // ▸ 1 个月前的生长（S22 月增长曲线用）
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  await prisma.record.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id, recordType: 'growth',
      startTime: monthAgo,
      createdBy: users.U1.id,
      growthData: { create: { height: 62, weight: 6.5, headCircumference: 41 } },
    },
  });

  log('✅ basic records (8) created for babyA1');

  // ▸ 疫苗 / 里程碑
  await prisma.vaccineRecord.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id,
      name: '乙肝疫苗', dose: '第1剂',
      vaccinatedDate: new Date('2025-10-05'),
      createdBy: users.U1.id,
    },
  });
  await prisma.milestoneRecord.create({
    data: {
      babyId: babyA1.id, familyId: familyA.id,
      name: '第一次抬头', category: '大运动',
      achievedDate: new Date('2025-12-01'),
      createdBy: users.U1.id,
    },
  });

  // 跨家庭隔离样本：FamilyB 中 babyB1 也建一份**完整的**记录 / 疫苗 / 里程碑
  // 关键：让"FamilyA 的用户查 babyB1 数据"的测试在"对方有数据"前提下断言看不到
  await prisma.record.create({
    data: {
      babyId: babyB1.id, familyId: familyB.id, recordType: 'feeding',
      startTime: new Date(today.getTime() + 8 * 3600_000),
      createdBy: users.U6.id,
      feedingData: { create: { feedingType: 'formula', amount: 100 } },
      note: 'B 家庭独享 - 配方奶',
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyB1.id, familyId: familyB.id, recordType: 'sleep',
      startTime: new Date(today.getTime() + 13 * 3600_000),
      endTime: new Date(today.getTime() + 14 * 3600_000),
      createdBy: users.U6.id,
      sleepData: { create: { sleepType: 'nap', duration: 3600 } },
      note: 'B 家庭独享 - 午睡',
    },
  });
  await prisma.record.create({
    data: {
      babyId: babyB1.id, familyId: familyB.id, recordType: 'temperature',
      startTime: new Date(today.getTime() + 9 * 3600_000),
      createdBy: users.U6.id,
      temperatureData: { create: { temperature: 36.8, method: 'ear' } },
      note: 'B 家庭独享 - 体温',
    },
  });
  await prisma.vaccineRecord.create({
    data: {
      babyId: babyB1.id, familyId: familyB.id,
      name: 'B家庭专属疫苗', dose: '第1剂',
      vaccinatedDate: new Date('2025-03-01'),
      createdBy: users.U6.id,
    },
  });
  await prisma.milestoneRecord.create({
    data: {
      babyId: babyB1.id, familyId: familyB.id,
      name: 'B家庭专属里程碑', category: '语言',
      achievedDate: new Date('2025-08-15'),
      createdBy: users.U6.id,
    },
  });

  // ---------- 6. 海量记录（S14 cursor 续传） ----------
  if (BULK > 0) {
    log(`📦 bulk insert ${BULK} records into babyA2 (cursor stress test)`);
    const start = Date.now();
    const baseTs = today.getTime() - 365 * 86400_000; // 一年前起点
    const types = ['feeding', 'sleep', 'diaper', 'temperature', 'growth'] as const;
    const batch = 500;
    for (let i = 0; i < BULK; i += batch) {
      const items = [];
      for (let j = 0; j < batch && i + j < BULK; j++) {
        items.push({
          babyId: babyA2.id,
          familyId: familyA.id,
          recordType: rand(types),
          startTime: new Date(baseTs + (i + j) * 60_000),
          createdBy: rand([users.U1.id, users.U2.id]),
          note: `bulk-${i + j}`,
        });
      }
      await prisma.record.createMany({ data: items });
      if ((i / batch) % 4 === 0) {
        log(`   ... ${Math.min(i + batch, BULK)}/${BULK}`);
      }
    }
    log(`✅ bulk done in ${Date.now() - start}ms`);
  }

  // ---------- 7. 输出摘要（供测试脚本消费） ----------
  const summary = {
    password: PASSWORD,
    accounts: Object.fromEntries(
      (Object.entries(users) as [AccountKey, (typeof users)[AccountKey]][]).map(([k, v]) => [
        k,
        { id: v.id, email: v.email, nickname: v.nickname },
      ]),
    ),
    families: {
      A: { id: familyA.id, inviteCode: familyA.inviteCode, name: familyA.name },
      B: { id: familyB.id, inviteCode: familyB.inviteCode, name: familyB.name },
    },
    babies: {
      A1: { id: babyA1.id, name: babyA1.name, familyId: familyA.id },
      A2: { id: babyA2.id, name: babyA2.name, familyId: familyA.id, bulkRecords: BULK },
      B1: { id: babyB1.id, name: babyB1.name, familyId: familyB.id },
    },
  };

  if (flagJson) {
    process.stdout.write(JSON.stringify(summary, null, 2));
  } else {
    console.log('\n🎉 [E2E Seed] complete');
    console.log('───────────────────────────────────────');
    console.log('共同密码:', PASSWORD);
    console.log('账号:');
    for (const [k, v] of Object.entries(summary.accounts)) {
      console.log(`  ${k}: ${v.email}  (${v.nickname})`);
    }
    console.log('家庭 A:', summary.families.A);
    console.log('家庭 B:', summary.families.B);
    console.log('宝宝:', summary.babies);
  }
}

main()
  .catch((e) => {
    console.error('❌ [E2E Seed] error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
