/**
 * 测试数据工厂：快速构造 user / family / member 等。
 *
 * 设计原则：
 * - 每个工厂函数支持 partial overrides
 * - 不依赖 service 层（直接 prisma.create），避免循环依赖
 * - 时间相关字段统一用 `new Date()` 生成可预测值
 */
import { prisma } from '../../src/config/database';
import { generateInviteCode } from '../../src/utils/invite-code';

let userCounter = 0;

export interface UserSeed {
  id: string;
  email: string;
  nickname: string;
}

export async function createUser(overrides: Partial<UserSeed> = {}): Promise<UserSeed> {
  userCounter++;
  const email = overrides.email ?? `user${userCounter}@test.com`;
  const nickname = overrides.nickname ?? `User${userCounter}`;
  const user = await prisma.user.create({
    data: {
      email,
      nickname,
      passwordHash: '$2a$10$fake.hash.for.testing.only',
    },
  });
  return { id: user.id, email: user.email!, nickname: user.nickname };
}

export interface FamilySeed {
  id: string;
  name: string;
  inviteCode: string;
  creatorId: string;
}

export interface CreateFamilyOptions {
  name?: string;
  creator?: UserSeed; // admin
  inviteCode?: string;
  inviteCodeExpiry?: Date;
  /** 额外成员：[{ user, role, displayName? }] */
  extraMembers?: Array<{ user: UserSeed; role: 'admin' | 'editor' | 'viewer'; displayName?: string }>;
}

/**
 * 创建一个家庭，creator 自动成为 admin，user.familyId 同步更新。
 */
export async function createFamilyWithMembers(opts: CreateFamilyOptions = {}): Promise<{
  family: FamilySeed;
  admin: UserSeed;
  members: UserSeed[];
}> {
  const admin = opts.creator ?? (await createUser({ nickname: 'AdminUser' }));
  const inviteCode = opts.inviteCode ?? generateInviteCode();
  const expiry = opts.inviteCodeExpiry ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const family = await prisma.family.create({
    data: {
      name: opts.name ?? 'Test Family',
      creatorId: admin.id,
      inviteCode,
      inviteCodeExpiry: expiry,
    },
  });

  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: admin.id,
      role: 'admin',
      displayName: 'AdminDisplay',
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { familyId: family.id },
  });

  const members: UserSeed[] = [admin];

  if (opts.extraMembers) {
    for (const { user, role, displayName } of opts.extraMembers) {
      await prisma.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role,
          displayName: displayName ?? `${role}-${user.nickname}`,
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { familyId: family.id },
      });
      members.push(user);
    }
  }

  return {
    family: {
      id: family.id,
      name: family.name,
      inviteCode: family.inviteCode,
      creatorId: family.creatorId,
    },
    admin,
    members,
  };
}

/**
 * 在指定 family 下创建一个 baby。
 */
export async function createBaby(familyId: string, name = 'Baby1') {
  return prisma.baby.create({
    data: {
      familyId,
      name,
      gender: 'male',
      birthDate: new Date('2024-01-01'),
    },
  });
}

/**
 * 在指定 baby 下创建一条 feeding record。
 */
export async function createFeedingRecord(babyId: string, familyId: string, createdBy: string) {
  return prisma.record.create({
    data: {
      babyId,
      familyId,
      recordType: 'feeding',
      startTime: new Date(),
      createdBy,
      feedingData: {
        create: {
          feedingType: 'formula',
          amount: 120,
        },
      },
    },
  });
}
