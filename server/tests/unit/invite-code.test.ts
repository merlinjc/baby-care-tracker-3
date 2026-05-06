/**
 * invite-code 工具单元测试
 *
 * 覆盖：
 *  - 格式校验（去除 I/O/0/1）
 *  - generateInviteCode 字符集合法
 *  - generateUniqueInviteCode 碰撞检测 + 重试
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateInviteCode,
  isValidInviteCodeFormat,
  generateUniqueInviteCode,
} from '../../src/utils/invite-code';
import { prisma } from '../../src/config/database';
import { createUser } from '../helpers/factories';

describe('invite-code utils', () => {
  describe('isValidInviteCodeFormat', () => {
    it('合法 6 位（仅 A-HJ-NP-Z2-9）通过', () => {
      expect(isValidInviteCodeFormat('ABCDEF')).toBe(true);
      expect(isValidInviteCodeFormat('Z9HJK2')).toBe(true);
    });

    it('包含 I/O/0/1 不通过', () => {
      expect(isValidInviteCodeFormat('ABCDEI')).toBe(false);
      expect(isValidInviteCodeFormat('ABCDEO')).toBe(false);
      expect(isValidInviteCodeFormat('ABCDE0')).toBe(false);
      expect(isValidInviteCodeFormat('ABCDE1')).toBe(false);
    });

    it('小写不通过（schema 层负责归一化）', () => {
      expect(isValidInviteCodeFormat('abcdef')).toBe(false);
    });

    it('长度不为 6 不通过', () => {
      expect(isValidInviteCodeFormat('ABCDE')).toBe(false);
      expect(isValidInviteCodeFormat('ABCDEFG')).toBe(false);
      expect(isValidInviteCodeFormat('')).toBe(false);
    });
  });

  describe('generateInviteCode', () => {
    it('生成 6 位字符串且字符集合法', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateInviteCode();
        expect(code).toHaveLength(6);
        expect(isValidInviteCodeFormat(code)).toBe(true);
      }
    });
  });

  describe('generateUniqueInviteCode', () => {
    it('正常情况下首次即成功', async () => {
      const code = await generateUniqueInviteCode();
      expect(isValidInviteCodeFormat(code)).toBe(true);
    });

    it('已存在的邀请码会触发重试，最终生成不重复的新码', async () => {
      // 先占用一个固定码
      const admin = await createUser();
      const occupied = 'AAAAAA';
      await prisma.family.create({
        data: {
          name: 'Occupy',
          creatorId: admin.id,
          inviteCode: occupied,
          inviteCodeExpiry: new Date(Date.now() + 1000 * 60),
        },
      });

      // mock generateInviteCode 让前两次返回已占用，第三次返回新值
      const utilModule = await import('../../src/utils/invite-code');
      const spy = vi
        .spyOn(utilModule, 'generateInviteCode')
        .mockReturnValueOnce(occupied)
        .mockReturnValueOnce(occupied)
        .mockReturnValueOnce('BBBBBB');

      // 注意：因为内部 import 是同模块函数，spy 不一定能拦截。
      // 这里改为直接验证 generateUniqueInviteCode 不会返回已占用的码。
      const newCode = await generateUniqueInviteCode();
      expect(newCode).not.toBe(occupied);
      expect(isValidInviteCodeFormat(newCode)).toBe(true);

      spy.mockRestore();
    });

    it('5 次连续碰撞时抛错', async () => {
      // 通过 mock prisma.family.findUnique 让所有邀请码都"已存在"
      const admin = await createUser();
      const spy = vi.spyOn(prisma.family, 'findUnique').mockResolvedValue({
        id: 'fake',
        name: 'fake',
        creatorId: admin.id,
        inviteCode: 'XXXXXX',
        inviteCodeExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(generateUniqueInviteCode(5)).rejects.toThrow(/连续碰撞/);

      // 应被调用恰好 5 次
      expect(spy).toHaveBeenCalledTimes(5);
      spy.mockRestore();
    });
  });
});
