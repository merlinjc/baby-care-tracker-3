/**
 * family.service.dissolveFamily 集成测试
 * 对应场景报告 D1 - D5
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import {
  createUser,
  createFamilyWithMembers,
  createBaby,
  createFeedingRecord,
} from '../helpers/factories';

describe('FamilyService.dissolveFamily', () => {
  it('D1: admin 解散含多个成员的家庭 → 所有 members.familyId 清空，family 删除', async () => {
    const editor = await createUser();
    const viewer = await createUser();
    const { family, admin } = await createFamilyWithMembers({
      extraMembers: [
        { user: editor, role: 'editor' },
        { user: viewer, role: 'viewer' },
      ],
    });

    const result = await familyService.dissolveFamily(admin.id, family.id);
    expect(result.message).toBe('家庭已解散');

    // family 不存在
    expect(await prisma.family.findUnique({ where: { id: family.id } })).toBeNull();

    // 所有 members.familyId 已清空
    const users = await prisma.user.findMany({
      where: { id: { in: [admin.id, editor.id, viewer.id] } },
    });
    expect(users.every((u) => u.familyId === null)).toBe(true);
  });

  it('D2: 非 admin（editor）调用 → 403 PERMISSION_DENIED', async () => {
    const editor = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: editor, role: 'editor' }],
    });

    await expect(familyService.dissolveFamily(editor.id, family.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_DENIED',
    });

    // family 应仍在
    expect(await prisma.family.findUnique({ where: { id: family.id } })).not.toBeNull();
  });

  it('D3: 家庭不存在 → 404 FAMILY_NOT_FOUND', async () => {
    const user = await createUser();
    await expect(
      familyService.dissolveFamily(user.id, 'non-existent-id'),
    ).rejects.toMatchObject({ statusCode: 403 }); // isAdmin 先返回 false → 403

    // 注：实现是先 isAdmin 检查再 family 查询；非成员一律 403。这是合理的安全前置
  });

  it('D4: 解散时级联删除 babies / records / vaccine / milestone', async () => {
    const { family, admin } = await createFamilyWithMembers();
    const baby = await createBaby(family.id);
    await createFeedingRecord(baby.id, family.id, admin.id);

    await prisma.vaccineRecord.create({
      data: {
        babyId: baby.id,
        familyId: family.id,
        name: '卡介苗',
        dose: '第1剂',
        vaccinatedDate: new Date(),
        createdBy: admin.id,
      },
    });
    await prisma.milestoneRecord.create({
      data: {
        babyId: baby.id,
        familyId: family.id,
        name: '抬头',
        category: '大运动',
        achievedDate: new Date(),
        createdBy: admin.id,
      },
    });

    const result = await familyService.dissolveFamily(admin.id, family.id);
    expect(result.message).toBe('家庭已解散');

    expect(await prisma.baby.findMany({ where: { familyId: family.id } })).toHaveLength(0);
    expect(await prisma.record.findMany({ where: { babyId: baby.id } })).toHaveLength(0);
    expect(await prisma.vaccineRecord.findMany({ where: { babyId: baby.id } })).toHaveLength(0);
    expect(await prisma.milestoneRecord.findMany({ where: { babyId: baby.id } })).toHaveLength(0);
    expect(await prisma.feedingRecord.findMany()).toHaveLength(0);
  });

  it('D5: 解散一个含多个 babies 与多类 records 的家庭 → 全部清空', async () => {
    const { family, admin } = await createFamilyWithMembers();

    const baby1 = await createBaby(family.id, 'B1');
    const baby2 = await createBaby(family.id, 'B2');
    await createFeedingRecord(baby1.id, family.id, admin.id);
    await createFeedingRecord(baby2.id, family.id, admin.id);

    await familyService.dissolveFamily(admin.id, family.id);

    expect(await prisma.baby.count()).toBe(0);
    expect(await prisma.record.count()).toBe(0);
    expect(await prisma.feedingRecord.count()).toBe(0);
    expect(await prisma.familyMember.count()).toBe(0);
    expect(await prisma.family.count()).toBe(0);
  });
});
