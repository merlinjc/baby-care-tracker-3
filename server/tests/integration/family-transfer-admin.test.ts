/**
 * family.service.transferAdmin 集成测试
 * 对应场景报告 H1 - H6
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers } from '../helpers/factories';

describe('FamilyService.transferAdmin', () => {
  it('H1: admin 转让给 editor → 原 admin 降 editor，新 admin 升 admin', async () => {
    const target = await createUser();
    const { family, admin } = await createFamilyWithMembers({
      extraMembers: [{ user: target, role: 'editor' }],
    });

    const result = await familyService.transferAdmin(admin.id, family.id, target.id);
    expect(result.message).toBe('管理员已转让');
    expect(result.newAdminId).toBe(target.id);

    const oldAdmin = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: admin.id } },
    });
    const newAdmin = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: target.id } },
    });
    expect(oldAdmin?.role).toBe('editor');
    expect(newAdmin?.role).toBe('admin');

    // version 各 +1
    expect(oldAdmin?.version).toBe(1);
    expect(newAdmin?.version).toBe(1);
  });

  it('H2: 非 admin 调用 → 403', async () => {
    const editor = await createUser();
    const target = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [
        { user: editor, role: 'editor' },
        { user: target, role: 'viewer' },
      ],
    });

    await expect(
      familyService.transferAdmin(editor.id, family.id, target.id),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('H3: 目标非家庭成员 → NOT_MEMBER', async () => {
    const stranger = await createUser();
    const { family, admin } = await createFamilyWithMembers();
    await expect(
      familyService.transferAdmin(admin.id, family.id, stranger.id),
    ).rejects.toMatchObject({ code: 'NOT_MEMBER' });
  });

  it('H4: 转让给自己 → INVALID_PARAMS', async () => {
    const { family, admin } = await createFamilyWithMembers();
    await expect(
      familyService.transferAdmin(admin.id, family.id, admin.id),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('H5: 目标已经是 admin → INVALID_PARAMS（防止把自己降级造成无 admin）', async () => {
    const adminB = await createUser();
    const { family, admin } = await createFamilyWithMembers({
      extraMembers: [{ user: adminB, role: 'admin' }],
    });

    await expect(
      familyService.transferAdmin(admin.id, family.id, adminB.id),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });

    // 双方角色应不变
    const a = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: admin.id } },
    });
    const b = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: adminB.id } },
    });
    expect(a?.role).toBe('admin');
    expect(b?.role).toBe('admin');
  });

  it('H6: 转让后家庭中始终至少有 1 个 admin', async () => {
    const target = await createUser();
    const { family, admin } = await createFamilyWithMembers({
      extraMembers: [{ user: target, role: 'editor' }],
    });

    await familyService.transferAdmin(admin.id, family.id, target.id);

    const adminCount = await prisma.familyMember.count({
      where: { familyId: family.id, role: 'admin' },
    });
    expect(adminCount).toBe(1);
  });
});
