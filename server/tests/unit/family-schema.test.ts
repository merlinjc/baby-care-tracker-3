/**
 * family.schema 单元测试 - 邀请码大小写归一化
 */
import { describe, it, expect } from 'vitest';
import { joinFamilySchema, createFamilySchema } from '../../src/schemas/family.schema';

describe('family.schema', () => {
  describe('joinFamilySchema.inviteCode', () => {
    it('小写邀请码会被转大写', () => {
      const result = joinFamilySchema.parse({
        inviteCode: 'abcdef',
        nickname: 'X',
      });
      expect(result.inviteCode).toBe('ABCDEF');
    });

    it('混合大小写也会归一化', () => {
      const result = joinFamilySchema.parse({
        inviteCode: 'AbCdEf',
        nickname: 'X',
      });
      expect(result.inviteCode).toBe('ABCDEF');
    });

    it('前后空格会被去除', () => {
      const result = joinFamilySchema.parse({
        inviteCode: '  abcdef  ',
        nickname: 'X',
      });
      expect(result.inviteCode).toBe('ABCDEF');
    });

    it('包含 I/O/0/1 → 校验失败', () => {
      expect(() =>
        joinFamilySchema.parse({ inviteCode: 'ABCDEI', nickname: 'X' }),
      ).toThrow();
      expect(() =>
        joinFamilySchema.parse({ inviteCode: 'ABCD01', nickname: 'X' }),
      ).toThrow();
    });

    it('长度不为 6 → 校验失败', () => {
      expect(() =>
        joinFamilySchema.parse({ inviteCode: 'ABCDE', nickname: 'X' }),
      ).toThrow();
    });

    it('nickname 为空 → 校验失败', () => {
      expect(() =>
        joinFamilySchema.parse({ inviteCode: 'ABCDEF', nickname: '' }),
      ).toThrow();
    });

    it('nickname 超过 20 字符 → 校验失败', () => {
      expect(() =>
        joinFamilySchema.parse({ inviteCode: 'ABCDEF', nickname: 'X'.repeat(21) }),
      ).toThrow();
    });
  });

  describe('createFamilySchema', () => {
    it('合法字段全通过', () => {
      const r = createFamilySchema.parse({
        name: 'My Family',
        nickname: 'Daddy',
        relation: 'dad',
      });
      expect(r.name).toBe('My Family');
    });

    it('家庭名称为空 → 失败', () => {
      expect(() =>
        createFamilySchema.parse({ name: '', nickname: 'X' }),
      ).toThrow();
    });

    it('家庭名称超 30 字符 → 失败', () => {
      expect(() =>
        createFamilySchema.parse({ name: 'A'.repeat(31), nickname: 'X' }),
      ).toThrow();
    });
  });
});
