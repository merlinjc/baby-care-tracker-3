/**
 * daily-checkin.schema 单元测试（v7.2 T-S2-F11-BE-02）
 *
 * 仅校验 zod schema 的接受 / 拒绝边界，业务逻辑（窗口、跨家庭）由
 * tests/integration/daily-checkin-service.test.ts 覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  createCheckinSchema,
  updateCheckinSchema,
  listCheckinQuerySchema,
  checkinDateParamSchema,
} from '../../src/schemas/daily-checkin.schema';

describe('createCheckinSchema', () => {
  it('接受最小入参', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-05-15',
      photoKey: 'checkins/family1/baby1/2026-05-15-abc.jpg',
    });
    expect(r.success).toBe(true);
  });

  it('接受全字段', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-05-15',
      photoKey: 'checkins/family1/baby1/2026-05-15-abc.jpg',
      photoWidth: 1080,
      photoHeight: 1440,
      caption: '今天宝宝学会翻身啦',
    });
    expect(r.success).toBe(true);
  });

  it('拒绝非法 ymd（格式）', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026/05/15',
      photoKey: 'checkins/f/b/2026-05-15-x.jpg',
    });
    expect(r.success).toBe(false);
  });

  it('拒绝非法 ymd（日期不存在 2026-02-30）', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-02-30',
      photoKey: 'checkins/f/b/2026-02-30-x.jpg',
    });
    expect(r.success).toBe(false);
  });

  it('拒绝缺少 checkins/ 前缀的 photoKey', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-05-15',
      photoKey: 'avatars/u1/abc.jpg',
    });
    expect(r.success).toBe(false);
  });

  it('拒绝包含 .. 的 photoKey（路径穿越）', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-05-15',
      photoKey: 'checkins/../etc/passwd.jpg',
    });
    expect(r.success).toBe(false);
  });

  it('拒绝 caption 超过 200 字', () => {
    const r = createCheckinSchema.safeParse({
      checkinDate: '2026-05-15',
      photoKey: 'checkins/f/b/x.jpg',
      caption: 'a'.repeat(201),
    });
    expect(r.success).toBe(false);
  });
});

describe('updateCheckinSchema', () => {
  it('单字段更新（caption）', () => {
    const r = updateCheckinSchema.safeParse({ caption: '修改' });
    expect(r.success).toBe(true);
  });

  it('单字段更新（aiSummary 设为 null 表示清空）', () => {
    const r = updateCheckinSchema.safeParse({ aiSummary: null });
    expect(r.success).toBe(true);
  });

  it('空对象拒绝（至少一个字段）', () => {
    const r = updateCheckinSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('aiSummary 4001 字拒绝', () => {
    const r = updateCheckinSchema.safeParse({ aiSummary: 'a'.repeat(4001) });
    expect(r.success).toBe(false);
  });
});

describe('listCheckinQuerySchema', () => {
  it('空参数 OK', () => {
    expect(listCheckinQuerySchema.safeParse({}).success).toBe(true);
  });

  it('完整区间 OK', () => {
    const r = listCheckinQuerySchema.safeParse({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
    expect(r.success).toBe(true);
  });

  it('startDate > endDate 拒绝', () => {
    const r = listCheckinQuerySchema.safeParse({
      startDate: '2026-05-31',
      endDate: '2026-05-01',
    });
    expect(r.success).toBe(false);
  });
});

describe('checkinDateParamSchema', () => {
  it('合法 baby id + ymd', () => {
    const r = checkinDateParamSchema.safeParse({ id: 'baby1', date: '2026-05-15' });
    expect(r.success).toBe(true);
  });

  it('非法 ymd 拒绝', () => {
    const r = checkinDateParamSchema.safeParse({ id: 'baby1', date: 'not-a-date' });
    expect(r.success).toBe(false);
  });
});
