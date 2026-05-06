/**
 * family.service.createFamily 集成测试
 * 对应场景报告 A1 - A5
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import { createUser } from '../helpers/factories';

describe('FamilyService.createFamily', () => {
  it('A1: 全新用户创建家庭，自动 admin，邀请码 6 位 7 天有效期', async () => {
    const user = await createUser();

    const result = await familyService.createFamily(user.id, {
      name: 'My Family',
      nickname: 'Daddy',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('My Family');
    expect(result.creatorId).toBe(user.id);
    expect(result.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // 校验有效期约为 7 天后（允许 1 分钟误差）
    const expiry = new Date(result.inviteCodeExpiry).getTime();
    const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - expected)).toBeLessThan(60_000);

    // 创建者应在 members 中且 role=admin
    expect(result.members).toHaveLength(1);
    expect(result.members[0].userId).toBe(user.id);
    expect(result.members[0].role).toBe('admin');
    expect(result.members[0].displayName).toBe('Daddy'); // ★ nickname 持久化

    // user.familyId 已更新
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.familyId).toBe(result.id);
  });

  it('A2: 已属于家庭的用户再次创建 → ALREADY_IN_FAMILY (409)', async () => {
    const user = await createUser();
    await familyService.createFamily(user.id, { name: 'F1', nickname: 'A' });

    await expect(
      familyService.createFamily(user.id, { name: 'F2', nickname: 'B' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_IN_FAMILY',
    });
  });

  it('A3: 用户表 familyId 残留但 FamilyMember 不存在（脏数据）→ 自愈后允许创建', async () => {
    const user = await createUser();
    // 制造脏数据：user.familyId 指向不存在的家庭
    await prisma.user.update({
      where: { id: user.id },
      data: { familyId: 'fake-family-id' },
    });

    // 触发自愈
    const result = await familyService.createFamily(user.id, {
      name: 'Recovered Family',
      nickname: 'Mama',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Recovered Family');

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed?.familyId).toBe(result.id);
  });

  it('A4: nickname 入参必须持久化到 FamilyMember.displayName', async () => {
    const user = await createUser();
    const result = await familyService.createFamily(user.id, {
      name: 'F',
      nickname: '宝宝爸爸',
    });

    const member = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: result.id, userId: user.id } },
    });
    expect(member?.displayName).toBe('宝宝爸爸');
  });

  it('A5: 邀请码全局唯一（连续创建 10 个家庭，码各不相同）', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const u = await createUser();
      const f = await familyService.createFamily(u.id, {
        name: `F${i}`,
        nickname: `N${i}`,
      });
      expect(codes.has(f.inviteCode)).toBe(false);
      codes.add(f.inviteCode);
    }
    expect(codes.size).toBe(10);
  });

  it('A6: relation 字段会被持久化（无 nickname 测试已在 A4 覆盖）', async () => {
    const user = await createUser();
    const result = await familyService.createFamily(user.id, {
      name: 'F',
      nickname: 'X',
      relation: 'mom',
    });
    const member = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: result.id, userId: user.id } },
    });
    expect(member?.relation).toBe('mom');
  });
});
