/**
 * auth.service.updateProfile 集成测试（v7.2+ T-S1-INF-01）
 *
 * 覆盖三类用例：
 * 1. 传统字段：nickname / avatar 更新（保持向后兼容）
 * 2. preferences 深合并：单个 key、多个 key、已知 key、未知 key、覆盖语义
 * 3. 边界：旧用户 preferences=null、不传 preferences 不会清空、parse 失败兜底
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../../src/services/auth.service';
import { prisma } from '../../src/config/database';
import { createUser } from '../helpers/factories';

describe('AuthService.updateProfile - preferences 深合并 (T-S1-INF-01)', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createUser();
    userId = user.id;
  });

  it('UP-1: 旧用户 preferences=null，首次写入 onboardingCompleted=true 后返回对象', async () => {
    const result = await authService.updateProfile(userId, {
      preferences: { onboardingCompleted: true },
    });

    expect(result.preferences).toEqual({ onboardingCompleted: true });

    // 库里实际存储为 JSON 字符串
    const raw = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    expect(raw?.preferences).toBe('{"onboardingCompleted":true}');
  });

  it('UP-2: 已有 preferences 时，新 patch 与旧值按顶层 key 合并（不互相覆盖）', async () => {
    // 先写入 lang
    await authService.updateProfile(userId, {
      preferences: { lang: 'zh-CN' },
    });

    // 再写入 onboardingCompleted —— 不应丢失 lang
    const result = await authService.updateProfile(userId, {
      preferences: { onboardingCompleted: true },
    });

    expect(result.preferences).toEqual({
      lang: 'zh-CN',
      onboardingCompleted: true,
    });
  });

  it('UP-3: 同一 key 第二次写入会覆盖（顶层 key 级覆盖）', async () => {
    await authService.updateProfile(userId, {
      preferences: { lang: 'zh-CN' },
    });
    const result = await authService.updateProfile(userId, {
      preferences: { lang: 'en-US' },
    });
    expect(result.preferences).toEqual({ lang: 'en-US' });
  });

  it('UP-4: 一次写入多个 key，全部生效', async () => {
    const result = await authService.updateProfile(userId, {
      preferences: {
        onboardingCompleted: true,
        lang: 'zh-CN',
        fontScale: 'lg',
        themeMode: 'warm-night',
      },
    });
    expect(result.preferences).toMatchObject({
      onboardingCompleted: true,
      lang: 'zh-CN',
      fontScale: 'lg',
      themeMode: 'warm-night',
    });
  });

  it('UP-5: 不传 preferences 时不会清空已有偏好（向后兼容）', async () => {
    await authService.updateProfile(userId, {
      preferences: { onboardingCompleted: true },
    });

    // 仅更新昵称，不传 preferences
    const result = await authService.updateProfile(userId, { nickname: 'NewName' });

    expect(result.nickname).toBe('NewName');
    expect(result.preferences).toEqual({ onboardingCompleted: true });
  });

  it('UP-6: 未知 key 透传保留（前后端跨版本兼容）', async () => {
    const result = await authService.updateProfile(userId, {
      preferences: {
        onboardingCompleted: true,
        // 未在 UserPreferences 中定义的实验性键
        experimentalFlag: 'beta',
      } as unknown as Record<string, unknown>,
    });
    expect(result.preferences).toMatchObject({
      onboardingCompleted: true,
      experimentalFlag: 'beta',
    });
  });

  it('UP-7: 显式传 null 值保留为 null（用于"撤销"语义）', async () => {
    await authService.updateProfile(userId, {
      preferences: { lang: 'zh-CN' },
    });
    const result = await authService.updateProfile(userId, {
      preferences: { lang: null as unknown as string },
    });
    expect(result.preferences).toEqual({ lang: null });
  });

  it('UP-8: 写入后通过 getMe 也能读到 preferences（端到端一致）', async () => {
    await authService.updateProfile(userId, {
      preferences: { onboardingCompleted: true, lang: 'zh-CN' },
    });
    const me = await authService.getMe(userId);
    expect(me.preferences).toEqual({
      onboardingCompleted: true,
      lang: 'zh-CN',
    });
  });

  it('UP-9: 库中 preferences 是非法 JSON 时，sanitize 不抛错，按 null 处理', async () => {
    // 直接 raw 写入一段非法 JSON
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: '{not-valid-json' },
    });

    // getMe 应优雅降级返回 null，不抛错
    const me = await authService.getMe(userId);
    expect(me.preferences).toBeNull();

    // 再写一次 patch 应能从空 base 重新累积
    const result = await authService.updateProfile(userId, {
      preferences: { onboardingCompleted: true },
    });
    expect(result.preferences).toEqual({ onboardingCompleted: true });
  });

  it('UP-10: 传统 nickname / avatar 字段单独更新仍工作（向后兼容）', async () => {
    const result1 = await authService.updateProfile(userId, { nickname: 'Alice' });
    expect(result1.nickname).toBe('Alice');
    expect(result1.preferences).toBeNull();

    const result2 = await authService.updateProfile(userId, {
      avatar: 'https://example.com/a.png',
    });
    expect(result2.avatar).toBe('https://example.com/a.png');
    expect(result2.nickname).toBe('Alice'); // 上一次写入仍在
  });
});
