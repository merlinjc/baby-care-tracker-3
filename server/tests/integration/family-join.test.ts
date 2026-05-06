/**
 * family.service.joinByInviteCode 集成测试
 * 对应场景报告 B1 - B10
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers } from '../helpers/factories';

describe('FamilyService.joinByInviteCode', () => {
  it('B1: 全新用户使用有效邀请码 → role=editor, displayName 持久化', async () => {
    const { family } = await createFamilyWithMembers();
    const newcomer = await createUser({ nickname: 'Newcomer' });

    const result = await familyService.joinByInviteCode(newcomer.id, {
      inviteCode: family.inviteCode,
      nickname: 'GrandMa',
      relation: 'grandma_m',
    });

    expect(result.id).toBe(family.id);
    expect(result.members).toHaveLength(2);

    const myMember = result.members.find((m) => m.userId === newcomer.id);
    expect(myMember?.role).toBe('editor');
    expect(myMember?.displayName).toBe('GrandMa');
    expect(myMember?.relation).toBe('grandma_m');

    const refreshed = await prisma.user.findUnique({ where: { id: newcomer.id } });
    expect(refreshed?.familyId).toBe(family.id);
  });

  it('B2: 邀请码格式不合法 → INVALID_CODE', async () => {
    const user = await createUser();
    await expect(
      familyService.joinByInviteCode(user.id, {
        inviteCode: '****',
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('B3: 邀请码不存在 → INVALID_CODE', async () => {
    const user = await createUser();
    await expect(
      familyService.joinByInviteCode(user.id, {
        inviteCode: 'ZZZZZZ',
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('B4: 邀请码过期 → CODE_EXPIRED', async () => {
    const { family } = await createFamilyWithMembers({
      inviteCodeExpiry: new Date(Date.now() - 1000), // 已过期
    });
    const user = await createUser();
    await expect(
      familyService.joinByInviteCode(user.id, {
        inviteCode: family.inviteCode,
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('B5: 已是该家庭成员 → ALREADY_MEMBER', async () => {
    const member = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: member, role: 'editor' }],
    });

    // 制造场景：member 想再次加入同一家庭。此时 user.familyId 已被 set，
    // 应先优先抛 ALREADY_IN_FAMILY；ALREADY_MEMBER 走在另一条路径。
    // 这里我们手工把 user.familyId 清空，模拟"残留 membership 但 user 表脏"
    await prisma.user.update({ where: { id: member.id }, data: { familyId: null } });

    await expect(
      familyService.joinByInviteCode(member.id, {
        inviteCode: family.inviteCode,
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });

  it('B6: 已属于其他家庭、且为唯一管理员 → SOLE_ADMIN', async () => {
    const admin = await createUser();
    await familyService.createFamily(admin.id, { name: 'Owner', nickname: 'Daddy' });

    // 另起一个目标家庭
    const targetUser = await createUser();
    const { family: target } = await createFamilyWithMembers({ creator: targetUser });

    await expect(
      familyService.joinByInviteCode(admin.id, {
        inviteCode: target.inviteCode,
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'SOLE_ADMIN' });
  });

  it('B7: 已属于其他家庭、非 admin → ALREADY_IN_FAMILY', async () => {
    const editor = await createUser();
    await createFamilyWithMembers({
      extraMembers: [{ user: editor, role: 'editor' }],
    });

    // 第二个家庭
    const targetUser = await createUser();
    const { family: target } = await createFamilyWithMembers({ creator: targetUser });

    await expect(
      familyService.joinByInviteCode(editor.id, {
        inviteCode: target.inviteCode,
        nickname: 'X',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_IN_FAMILY' });
  });

  it('B8: schema 层会把小写邀请码 trim+toUpperCase（service 接收已归一化的码）', async () => {
    // 该测试通过 schema 验证；这里直接用 service 校验：service 收到大写码即可正常加入
    const { family } = await createFamilyWithMembers();
    const newcomer = await createUser();

    const result = await familyService.joinByInviteCode(newcomer.id, {
      inviteCode: family.inviteCode, // 已是大写
      nickname: 'X',
    });

    expect(result.members.find((m) => m.userId === newcomer.id)).toBeDefined();
  });

  it('B10: 邀请码刚好临界（< 当前时间为过期）', async () => {
    const { family } = await createFamilyWithMembers({
      inviteCodeExpiry: new Date(Date.now() + 5_000), // 5 秒后过期
    });
    const newcomer = await createUser();

    // 应可正常加入
    const result = await familyService.joinByInviteCode(newcomer.id, {
      inviteCode: family.inviteCode,
      nickname: 'X',
    });
    expect(result.id).toBe(family.id);
  });
});
