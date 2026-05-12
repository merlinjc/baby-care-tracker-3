/**
 * common.schema · avatarRefSchema 单元测试（v7.2 T-S1-INF-02 方案 B + F12-02/03）
 *
 * 覆盖：
 * - 接受 avatars/ / babies/ / checkins/ 开头的对象 key
 * - 接受 http(s) URL（历史数据兼容）
 * - 接受空串（清除头像）
 * - 拒绝长度超限、路径穿越、不合法前缀
 */
import { describe, it, expect } from 'vitest';
import { avatarRefSchema } from '../../src/schemas/common.schema';

describe('avatarRefSchema', () => {
  describe('合法形态', () => {
    it('avatars/ 前缀的 key 通过', () => {
      expect(avatarRefSchema.safeParse('avatars/u1/abc.jpg').success).toBe(true);
    });

    it('babies/ 前缀的 key 通过', () => {
      expect(avatarRefSchema.safeParse('babies/b1/x.png').success).toBe(true);
    });

    it('checkins/ 前缀的 key 通过', () => {
      expect(avatarRefSchema.safeParse('checkins/u1/2026-05-11.webp').success).toBe(
        true,
      );
    });

    it('http URL 通过（历史数据）', () => {
      expect(avatarRefSchema.safeParse('http://cdn.example.com/a.jpg').success).toBe(
        true,
      );
    });

    it('https URL 通过', () => {
      expect(
        avatarRefSchema.safeParse('https://cdn.example.com/path/a.jpg').success,
      ).toBe(true);
    });

    it('空字符串通过（清除头像）', () => {
      expect(avatarRefSchema.safeParse('').success).toBe(true);
    });
  });

  describe('非法形态', () => {
    it('拒绝其他前缀的"伪 key"', () => {
      expect(avatarRefSchema.safeParse('uploads/u1/x.jpg').success).toBe(false);
    });

    it('拒绝纯文件名', () => {
      expect(avatarRefSchema.safeParse('a.jpg').success).toBe(false);
    });

    it('拒绝路径穿越', () => {
      expect(avatarRefSchema.safeParse('avatars/../../etc/passwd').success).toBe(
        false,
      );
    });

    it('拒绝反斜杠', () => {
      expect(avatarRefSchema.safeParse('avatars\\u1\\a.jpg').success).toBe(false);
    });

    it('拒绝半成品 URL（http://）', () => {
      expect(avatarRefSchema.safeParse('http://').success).toBe(false);
    });

    it('拒绝长度超过 512', () => {
      const longKey = 'avatars/u1/' + 'a'.repeat(600);
      expect(avatarRefSchema.safeParse(longKey).success).toBe(false);
    });
  });
});
