/**
 * permission utils 单元测试 - 主要验证 getFamilyIdForUser 的自愈逻辑
 */
import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/database';
import { getFamilyIdForUser } from '../../src/utils/permission';
import { createUser, createFamilyWithMembers } from '../helpers/factories';

describe('getFamilyIdForUser (self-healing)', () => {
  it('用户未加入家庭 → 返回 null', async () => {
    const u = await createUser();
    expect(await getFamilyIdForUser(u.id)).toBeNull();
  });

  it('user.familyId 与 FamilyMember 一致 → 返回 familyId', async () => {
    const { family, admin } = await createFamilyWithMembers();
    expect(await getFamilyIdForUser(admin.id)).toBe(family.id);
  });

  it('脏数据：user.familyId 残留但 FamilyMember 不存在 → 自愈，返回 null', async () => {
    const u = await createUser();
    // 制造脏数据
    await prisma.user.update({
      where: { id: u.id },
      data: { familyId: 'fake-family-id-123' },
    });

    const result = await getFamilyIdForUser(u.id);
    expect(result).toBeNull();

    // 已自愈：user.familyId 被清空
    const refreshed = await prisma.user.findUnique({ where: { id: u.id } });
    expect(refreshed?.familyId).toBeNull();
  });

  it('脏数据：user.familyId 指向真实家庭但用户被踢出 → 自愈，返回 null', async () => {
    const editor = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: editor, role: 'editor' }],
    });
    // 直接删除 membership 但不清 user.familyId（模拟脏数据）
    await prisma.familyMember.delete({
      where: { familyId_userId: { familyId: family.id, userId: editor.id } },
    });

    const result = await getFamilyIdForUser(editor.id);
    expect(result).toBeNull();

    const refreshed = await prisma.user.findUnique({ where: { id: editor.id } });
    expect(refreshed?.familyId).toBeNull();
  });
});
