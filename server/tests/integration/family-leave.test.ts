/**
 * family.service.leaveFamily 集成测试
 * 对应场景报告 C1 - C9（幂等三态机）
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers } from '../helpers/factories';

describe('FamilyService.leaveFamily', () => {
  it('C1: 普通成员退出且家庭剩余 ≥2 人 → status=ok', async () => {
    const member1 = await createUser();
    const member2 = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [
        { user: member1, role: 'editor' },
        { user: member2, role: 'editor' },
      ],
    });

    const result = await familyService.leaveFamily(member1.id, family.id);
    expect(result.status).toBe('ok');

    // 家庭应还在
    const stillThere = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stillThere).not.toBeNull();

    // member1.familyId 已清空
    const u = await prisma.user.findUnique({ where: { id: member1.id } });
    expect(u?.familyId).toBeNull();
  });

  it('C2: 普通成员退出后只剩 1 个 admin → status=ok（家庭保留）', async () => {
    const member = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: member, role: 'editor' }],
    });

    const result = await familyService.leaveFamily(member.id, family.id);
    expect(result.status).toBe('ok');

    const stillThere = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stillThere).not.toBeNull();
  });

  it('C3: 唯一管理员且只剩自己一人 → status=dissolved', async () => {
    const { family, admin } = await createFamilyWithMembers();

    const result = await familyService.leaveFamily(admin.id, family.id);
    expect(result.status).toBe('dissolved');

    // 家庭已删除
    const gone = await prisma.family.findUnique({ where: { id: family.id } });
    expect(gone).toBeNull();

    // admin.familyId 已清空
    const u = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(u?.familyId).toBeNull();
  });

  it('C4: 唯一管理员、家庭 ≥2 人 → status=need_transfer，含 otherMembers', async () => {
    const editor = await createUser({ nickname: 'Mama' });
    const viewer = await createUser({ nickname: 'GrandMa' });
    const { family, admin } = await createFamilyWithMembers({
      extraMembers: [
        { user: editor, role: 'editor' },
        { user: viewer, role: 'viewer' },
      ],
    });

    const result = await familyService.leaveFamily(admin.id, family.id);
    expect(result.status).toBe('need_transfer');
    expect(result.otherMembers).toHaveLength(2);
    expect(result.otherMembers!.map((m) => m.id).sort()).toEqual(
      [editor.id, viewer.id].sort(),
    );

    // 家庭应仍存在（未真正离开）
    const stillThere = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stillThere).not.toBeNull();
  });

  it('C5: 用户已不在家庭 → status=not_member（幂等）', async () => {
    const orphan = await createUser();
    const { family } = await createFamilyWithMembers();

    const result = await familyService.leaveFamily(orphan.id, family.id);
    expect(result.status).toBe('not_member');
  });

  it('C6: 家庭已不存在 → status=family_not_found（幂等）', async () => {
    const user = await createUser();
    const result = await familyService.leaveFamily(user.id, 'non-existent-family-id');
    expect(result.status).toBe('family_not_found');
  });

  it('C7: 并发场景：member 即将 leave 时已被另一管理员踢出 → 仍幂等返回（不抛 P2025）', async () => {
    const target = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: target, role: 'editor' }],
    });

    // 模拟并发：先把 membership 删掉（相当于 admin 已经移除），但保留 user.familyId
    // 注意：deleteMany 先执行，user.familyId 仍指向 family
    await prisma.familyMember.delete({
      where: { familyId_userId: { familyId: family.id, userId: target.id } },
    });

    // 此时调 leaveFamily，应幂等返回 not_member 而不是 500
    const result = await familyService.leaveFamily(target.id, family.id);
    expect(result.status).toBe('not_member');
  });

  it('C8: dissolve 判断在事务内完成（最后一人退出立即解散）', async () => {
    const { family, admin } = await createFamilyWithMembers();
    // family.members.length === 1

    const result = await familyService.leaveFamily(admin.id, family.id);
    expect(result.status).toBe('dissolved');

    // 验证 family 与所有 members 都被同步删除
    const f = await prisma.family.findUnique({ where: { id: family.id } });
    expect(f).toBeNull();
    const ms = await prisma.familyMember.findMany({ where: { familyId: family.id } });
    expect(ms).toHaveLength(0);
  });

  it('C9: 解散时连带删除 babies/records（onDelete: Cascade）', async () => {
    const { family, admin } = await createFamilyWithMembers();
    const baby = await prisma.baby.create({
      data: {
        familyId: family.id,
        name: 'Baby1',
        gender: 'male',
        birthDate: new Date('2024-01-01'),
      },
    });
    await prisma.record.create({
      data: {
        babyId: baby.id,
        familyId: family.id,
        recordType: 'feeding',
        startTime: new Date(),
        createdBy: admin.id,
        feedingData: { create: { feedingType: 'formula', amount: 120 } },
      },
    });

    const result = await familyService.leaveFamily(admin.id, family.id);
    expect(result.status).toBe('dissolved');

    // baby 与 record 应都被级联删除
    const babies = await prisma.baby.findMany({ where: { familyId: family.id } });
    expect(babies).toHaveLength(0);
    const records = await prisma.record.findMany({ where: { babyId: baby.id } });
    expect(records).toHaveLength(0);
  });
});
