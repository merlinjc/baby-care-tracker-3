/**
 * jaundice.schema 单元测试（v7.2 T-S1-F2-02）
 *
 * 路由层校验由 zod schema 承担，本文件验证 schema 的接受 / 拒绝边界，
 * service 业务逻辑由 tests/integration/jaundice-service.test.ts 覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  createJaundiceSchema,
  updateJaundiceSchema,
  listJaundiceQuerySchema,
} from '../../src/schemas/jaundice.schema';

describe('jaundice.schema · createJaundiceSchema', () => {
  it('接受最小入参（仅 recordDate）', () => {
    const r = createJaundiceSchema.safeParse({ recordDate: '2026-05-01T00:00:00Z' });
    expect(r.success).toBe(true);
  });

  it('接受全字段', () => {
    const r = createJaundiceSchema.safeParse({
      recordDate: '2026-05-01T00:00:00Z',
      dayAge: 5,
      kramerZone: 3,
      scleralIcterus: true,
      tcb: 12.3,
      tsb: 13,
      category: 'physiologic',
      symptoms: ['吃奶正常'],
      treatments: ['加强喂养'],
      note: 'x',
    });
    expect(r.success).toBe(true);
  });

  it('拒绝非法 kramerZone', () => {
    expect(
      createJaundiceSchema.safeParse({ recordDate: '2026-05-01T00:00:00Z', kramerZone: 6 })
        .success,
    ).toBe(false);
    expect(
      createJaundiceSchema.safeParse({ recordDate: '2026-05-01T00:00:00Z', kramerZone: 0 })
        .success,
    ).toBe(false);
  });

  it('拒绝非法 category', () => {
    expect(
      createJaundiceSchema.safeParse({
        recordDate: '2026-05-01T00:00:00Z',
        category: 'unknown',
      }).success,
    ).toBe(false);
  });

  it('拒绝 symptoms 超长（21 项）', () => {
    expect(
      createJaundiceSchema.safeParse({
        recordDate: '2026-05-01T00:00:00Z',
        symptoms: Array.from({ length: 21 }, (_, i) => `s${i}`),
      }).success,
    ).toBe(false);
  });

  it('拒绝 tcb 越界 (>50)', () => {
    expect(
      createJaundiceSchema.safeParse({ recordDate: '2026-05-01T00:00:00Z', tcb: 51 })
        .success,
    ).toBe(false);
  });

  it('拒绝非法 recordDate', () => {
    expect(createJaundiceSchema.safeParse({ recordDate: 'not-a-date' }).success).toBe(
      false,
    );
  });

  it('kramerZone 接受 null（皮肤未见黄染）', () => {
    expect(
      createJaundiceSchema.safeParse({
        recordDate: '2026-05-01T00:00:00Z',
        kramerZone: null,
      }).success,
    ).toBe(true);
  });
});

describe('jaundice.schema · updateJaundiceSchema', () => {
  it('接受单字段更新', () => {
    expect(updateJaundiceSchema.safeParse({ kramerZone: 2 }).success).toBe(true);
  });

  it('拒绝空 body', () => {
    expect(updateJaundiceSchema.safeParse({}).success).toBe(false);
  });

  it('接受把 note 显式设为 null（清空）', () => {
    expect(updateJaundiceSchema.safeParse({ note: null }).success).toBe(true);
  });
});

describe('jaundice.schema · listJaundiceQuerySchema', () => {
  it('limit 默认 100', () => {
    const r = listJaundiceQuerySchema.parse({});
    expect(r.limit).toBe(100);
  });

  it('limit coerce 字符串', () => {
    const r = listJaundiceQuerySchema.parse({ limit: '50' });
    expect(r.limit).toBe(50);
  });

  it('startDate > endDate → 拒绝', () => {
    expect(
      listJaundiceQuerySchema.safeParse({
        startDate: '2026-05-10T00:00:00Z',
        endDate: '2026-05-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('limit > 500 → 拒绝', () => {
    expect(listJaundiceQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
  });
});
