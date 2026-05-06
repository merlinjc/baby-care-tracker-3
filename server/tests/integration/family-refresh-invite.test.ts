/**
 * family.service.refreshInviteCode 集成测试
 * 对应场景报告 E1 - E4
 */
import { describe, it, expect } from 'vitest';
import { familyService } from '../../src/services/family.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers } from '../helpers/factories';

describe('FamilyService.refreshInviteCode', () => {
  it('E1: admin 刷新 → 返回新邀请码与新有效期', async () => {
    const { family, admin } = await createFamilyWithMembers();
    const oldCode = family.inviteCode;

    const result = await familyService.refreshInviteCode(admin.id, family.id);

    expect(result.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(result.inviteCode).not.toBe(oldCode);

    const expiry = new Date(result.inviteCodeExpiry).getTime();
    const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - expected)).toBeLessThan(60_000);

    // DB 已更新
    const f = await prisma.family.findUnique({ where: { id: family.id } });
    expect(f?.inviteCode).toBe(result.inviteCode);
  });

  it('E2: 非 admin → 403 PERMISSION_DENIED', async () => {
    const editor = await createUser();
    const { family } = await createFamilyWithMembers({
      extraMembers: [{ user: editor, role: 'editor' }],
    });

    await expect(
      familyService.refreshInviteCode(editor.id, family.id),
    ).rejects.toMatchObject({ statusCode: 403, code: 'PERMISSION_DENIED' });
  });

  it('E3: 多次刷新生成的码各不相同', async () => {
    const { family, admin } = await createFamilyWithMembers();
    const codes = new Set<string>([family.inviteCode]);

    for (let i = 0; i < 5; i++) {
      const r = await familyService.refreshInviteCode(admin.id, family.id);
      expect(codes.has(r.inviteCode)).toBe(false);
      codes.add(r.inviteCode);
    }
    expect(codes.size).toBe(6);
  });

  it('E4: 家庭不存在 → 404 FAMILY_NOT_FOUND（不再 500）', async () => {
    const user = await createUser();
    await expect(
      familyService.refreshInviteCode(user.id, 'non-existent-id'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'FAMILY_NOT_FOUND' });
  });
});
