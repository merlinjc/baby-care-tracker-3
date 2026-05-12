/**
 * daily-checkin-date 纯函数单元测试（v7.2 T-S2-F11-BE-01）
 *
 * 该 lib 物理位置在 `client/src/lib/daily-checkin-date.ts`，但因为是纯函数无 React/DOM 依赖，
 * 借 server vitest 套件直接 import 跑测试，**不引入 client vitest 基建**（设计文档约定）。
 *
 * 覆盖范围：
 * - todayLocalYmd / isPast / isFuture / isToday
 * - isWithinCheckinWindow（边界：今/昨/7 天前/8 天前/未来）
 * - getMonthGrid（跨月、跨年、闰月、月头是周日 / 周一边界）
 * - getPreviousMonth / getNextMonth / getMonthRange
 * - daysFromToday / isValidYmd
 */
import { describe, it, expect } from 'vitest';
import {
  YMD_PATTERN,
  isValidYmd,
  todayLocalYmd,
  isPast,
  isFuture,
  isToday,
  isWithinCheckinWindow,
  daysFromToday,
  getMonthGrid,
  getPreviousMonth,
  getNextMonth,
  getMonthRange,
} from '../../../client/src/lib/daily-checkin-date';

// 固定基准时刻：2026-05-15 (周五) 10:30 本地时间
const NOW = new Date(2026, 4, 15, 10, 30, 0);

describe('YMD_PATTERN / isValidYmd', () => {
  it('正则匹配规范 ymd', () => {
    expect(YMD_PATTERN.test('2026-05-15')).toBe(true);
    expect(YMD_PATTERN.test('2026-5-15')).toBe(false);
    expect(YMD_PATTERN.test('20260515')).toBe(false);
  });

  it('isValidYmd 拒绝无效日期', () => {
    expect(isValidYmd('2026-05-15')).toBe(true);
    expect(isValidYmd('2024-02-29')).toBe(true); // 闰年
    expect(isValidYmd('2026-02-29')).toBe(false); // 非闰年
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('2026-05-32')).toBe(false);
    expect(isValidYmd('not-a-date')).toBe(false);
    expect(isValidYmd('')).toBe(false);
  });
});

describe('todayLocalYmd', () => {
  it('返回本地时区的 ymd', () => {
    expect(todayLocalYmd(NOW)).toBe('2026-05-15');
  });

  it('零时区附近不漂移', () => {
    expect(todayLocalYmd(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(todayLocalYmd(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('isPast / isFuture / isToday', () => {
  it('isToday 仅在当日为 true', () => {
    expect(isToday('2026-05-15', NOW)).toBe(true);
    expect(isToday('2026-05-14', NOW)).toBe(false);
    expect(isToday('2026-05-16', NOW)).toBe(false);
  });

  it('isPast 严格小于今天', () => {
    expect(isPast('2026-05-14', NOW)).toBe(true);
    expect(isPast('2026-05-15', NOW)).toBe(false);
    expect(isPast('2026-05-16', NOW)).toBe(false);
  });

  it('isFuture 严格大于今天', () => {
    expect(isFuture('2026-05-16', NOW)).toBe(true);
    expect(isFuture('2026-05-15', NOW)).toBe(false);
    expect(isFuture('2026-05-14', NOW)).toBe(false);
  });

  it('对非法 ymd 返回 false（不抛异常）', () => {
    expect(isPast('not-a-date', NOW)).toBe(false);
    expect(isFuture('not-a-date', NOW)).toBe(false);
  });
});

describe('isWithinCheckinWindow（核心业务规则：[today-7d, today]）', () => {
  it('今天 OK', () => {
    expect(isWithinCheckinWindow('2026-05-15', NOW)).toBe(true);
  });

  it('昨天 OK', () => {
    expect(isWithinCheckinWindow('2026-05-14', NOW)).toBe(true);
  });

  it('7 天前 OK（边界含）', () => {
    expect(isWithinCheckinWindow('2026-05-08', NOW)).toBe(true);
  });

  it('8 天前 ✗', () => {
    expect(isWithinCheckinWindow('2026-05-07', NOW)).toBe(false);
  });

  it('未来日期 ✗', () => {
    expect(isWithinCheckinWindow('2026-05-16', NOW)).toBe(false);
    expect(isWithinCheckinWindow('2027-01-01', NOW)).toBe(false);
  });

  it('跨月跨年仍正确（基准 2026-01-03）', () => {
    const baseline = new Date(2026, 0, 3, 12, 0);
    expect(isWithinCheckinWindow('2025-12-27', baseline)).toBe(true); // 7 天前
    expect(isWithinCheckinWindow('2025-12-26', baseline)).toBe(false); // 8 天前
  });

  it('对非法 ymd 返回 false', () => {
    expect(isWithinCheckinWindow('not-a-date', NOW)).toBe(false);
  });
});

describe('daysFromToday', () => {
  it('today=0, 昨天=1, 明天=-1', () => {
    expect(daysFromToday('2026-05-15', NOW)).toBe(0);
    expect(daysFromToday('2026-05-14', NOW)).toBe(1);
    expect(daysFromToday('2026-05-16', NOW)).toBe(-1);
  });

  it('非法 ymd 返回 NaN', () => {
    expect(Number.isNaN(daysFromToday('not-a-date', NOW))).toBe(true);
  });
});

describe('getMonthGrid', () => {
  it('2026-05（周五开月） 网格首日是 2026-04-27（周一）', () => {
    const grid = getMonthGrid(2026, 5);
    expect(grid[0]?.ymd).toBe('2026-04-27');
    expect(grid[0]?.inCurrentMonth).toBe(false);
    // 5 月 1 日索引：上月补 4 天 → 索引 4
    expect(grid[4]?.ymd).toBe('2026-05-01');
    expect(grid[4]?.inCurrentMonth).toBe(true);
  });

  it('网格长度是 7 的倍数', () => {
    expect(getMonthGrid(2026, 5).length % 7).toBe(0);
    expect(getMonthGrid(2026, 2).length % 7).toBe(0);
    expect(getMonthGrid(2024, 2).length % 7).toBe(0);
  });

  it('当月天数与 inCurrentMonth=true 数量一致', () => {
    expect(getMonthGrid(2026, 5).filter((c) => c.inCurrentMonth).length).toBe(31);
    expect(getMonthGrid(2026, 2).filter((c) => c.inCurrentMonth).length).toBe(28);
    expect(getMonthGrid(2024, 2).filter((c) => c.inCurrentMonth).length).toBe(29); // 闰年
    expect(getMonthGrid(2026, 4).filter((c) => c.inCurrentMonth).length).toBe(30);
  });

  it('跨年：12 月网格末尾延伸到下年 1 月', () => {
    const grid = getMonthGrid(2025, 12);
    const last = grid[grid.length - 1];
    expect(last?.ymd.startsWith('2026-01') || last?.ymd === '2025-12-31').toBe(true);
  });

  it('月头恰逢周一（无上月补齐）', () => {
    // 2026-06-01 是周一
    const grid = getMonthGrid(2026, 6);
    expect(grid[0]?.ymd).toBe('2026-06-01');
    expect(grid[0]?.inCurrentMonth).toBe(true);
  });

  it('月头是周日（上月补齐 6 天）', () => {
    // 2026-03-01 是周日
    const grid = getMonthGrid(2026, 3);
    expect(grid[0]?.ymd).toBe('2026-02-23'); // 周一
    expect(grid[6]?.ymd).toBe('2026-03-01'); // 周日
  });

  it('非法月份抛 RangeError', () => {
    expect(() => getMonthGrid(2026, 0)).toThrow(RangeError);
    expect(() => getMonthGrid(2026, 13)).toThrow(RangeError);
  });
});

describe('getPreviousMonth / getNextMonth', () => {
  it('普通月份', () => {
    expect(getPreviousMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
    expect(getNextMonth(2026, 5)).toEqual({ year: 2026, month: 6 });
  });

  it('跨年', () => {
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(getNextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });
});

describe('getMonthRange', () => {
  it('5 月 [01, 31]', () => {
    expect(getMonthRange(2026, 5)).toEqual({ startDate: '2026-05-01', endDate: '2026-05-31' });
  });

  it('2 月闰年 / 平年', () => {
    expect(getMonthRange(2024, 2).endDate).toBe('2024-02-29');
    expect(getMonthRange(2026, 2).endDate).toBe('2026-02-28');
  });
});
