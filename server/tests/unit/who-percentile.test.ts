/**
 * who-percentile 单元测试（v7.2 T-S2-F10-01）
 *
 * 路径同 daily-checkin-date.test.ts：直接 import client/src/lib 内的纯函数。
 *
 * 验证：
 * - getPercentile 在 5 档参考点上落在对应百分位
 * - 边界饱和（≤ P3 / ≥ P97）
 * - 中间值线性插值合理
 * - 月龄超 0-60 返回 null
 * - getPercentileLabel 中文映射正确
 * - isOutOfRange 边界
 */
import { describe, it, expect } from 'vitest';
import {
  getPercentile,
  getPercentileLabel,
  isOutOfRange,
  getReferenceLinePoints,
  getReferenceAtAge,
} from '../../../client/src/lib/who-percentile';

describe('getPercentile · 5 档参考点直接命中', () => {
  it('男 0 月，体重 3.3 kg → P50', () => {
    // 男 0 月：p3=2.5, p15=2.9, p50=3.3, p85=3.9, p97=4.4
    expect(getPercentile(3.3, 0, 'male', 'weight')).toBe(50);
  });

  it('男 0 月，体重 2.5 kg → 边界 P3（饱和到 3）', () => {
    expect(getPercentile(2.5, 0, 'male', 'weight')).toBe(3);
  });

  it('男 0 月，体重 4.4 kg → 边界 P97（饱和到 97）', () => {
    expect(getPercentile(4.4, 0, 'male', 'weight')).toBe(97);
  });

  it('男 0 月，体重 < 2.5 kg → ≤ 3', () => {
    expect(getPercentile(2.0, 0, 'male', 'weight')).toBe(3);
  });

  it('男 0 月，体重 > 4.4 kg → ≥ 97', () => {
    expect(getPercentile(5.5, 0, 'male', 'weight')).toBe(97);
  });
});

describe('getPercentile · 中间值线性插值', () => {
  it('男 0 月，体重 2.9 (=p15) → ~15', () => {
    // 处于 P15 档值
    expect(getPercentile(2.9, 0, 'male', 'weight')).toBe(15);
  });

  it('男 0 月，体重 3.9 (=p85) → ~85', () => {
    expect(getPercentile(3.9, 0, 'male', 'weight')).toBe(85);
  });

  it('男 12 月，体重 9.6 (p50=9.6) → 50', () => {
    expect(getPercentile(9.6, 12, 'male', 'weight')).toBe(50);
  });

  it('女 24 月，身高 80.2 (p50=80.2) → 50', () => {
    // WHO_HEIGHT_GIRL[24] p50=80.2
    expect(getPercentile(80.2, 24, 'female', 'height')).toBe(50);
  });

  it('男 36 月，体重 13.5 (p50=13.5) → 50', () => {
    // WHO_WEIGHT_BOY[36] p50=13.5
    expect(getPercentile(13.5, 36, 'male', 'weight')).toBe(50);
  });

  it('男 60 月，体重 16.7 (p50=16.7) → 50', () => {
    // WHO_WEIGHT_BOY[60] p50=16.7
    expect(getPercentile(16.7, 60, 'male', 'weight')).toBe(50);
  });
});

describe('getPercentile · 月龄插值（点之间）', () => {
  it('男 0.5 月体重 ~3.9 (0/1 月 p50 平均) → ~50', () => {
    // 0 月 p50=3.3; 1 月 p50=4.5; 0.5 月线性插值 = 3.9
    expect(getPercentile(3.9, 0.5, 'male', 'weight')).toBe(50);
  });
});

describe('getPercentile · 月龄超界', () => {
  it('-1 月 → null', () => {
    expect(getPercentile(3, -1, 'male', 'weight')).toBeNull();
  });
  it('61 月 → null', () => {
    expect(getPercentile(15, 61, 'male', 'weight')).toBeNull();
  });
});

describe('getPercentileLabel', () => {
  it('null → 空串', () => {
    expect(getPercentileLabel(null)).toBe('');
  });
  it('3 → ≤P3 偏低', () => {
    expect(getPercentileLabel(3)).toContain('偏低');
    expect(getPercentileLabel(3)).toContain('P3');
  });
  it('50 → P50（标准水平）', () => {
    expect(getPercentileLabel(50)).toContain('P50');
    expect(getPercentileLabel(50)).toContain('标准');
  });
  it('75 → P75（中上水平）', () => {
    expect(getPercentileLabel(75)).toContain('P75');
    expect(getPercentileLabel(75)).toContain('中上');
  });
  it('97 → ≥P97 偏高', () => {
    expect(getPercentileLabel(97)).toContain('偏高');
  });
});

describe('isOutOfRange', () => {
  it('null → true', () => {
    expect(isOutOfRange(null)).toBe(true);
  });
  it('3 → true（≤ 3）', () => {
    expect(isOutOfRange(3)).toBe(true);
  });
  it('97 → true（≥ 97）', () => {
    expect(isOutOfRange(97)).toBe(true);
  });
  it('50 → false', () => {
    expect(isOutOfRange(50)).toBe(false);
  });
});

describe('getReferenceLinePoints', () => {
  it('返回 5 条曲线，每条 0-60 月共 61 个点', () => {
    const lines = getReferenceLinePoints('male', 'weight');
    expect(lines.p3).toHaveLength(61);
    expect(lines.p50).toHaveLength(61);
    expect(lines.p97).toHaveLength(61);
  });

  it('支持自定义 range', () => {
    const lines = getReferenceLinePoints('female', 'height', { from: 6, to: 24 });
    expect(lines.p50[0].month).toBe(6);
    expect(lines.p50[lines.p50.length - 1].month).toBe(24);
  });

  it('p50 单调非降（生长曲线总体上升）', () => {
    const { p50 } = getReferenceLinePoints('male', 'weight');
    for (let i = 1; i < p50.length; i++) {
      expect(p50[i].value).toBeGreaterThanOrEqual(p50[i - 1].value);
    }
  });
});

describe('getReferenceAtAge', () => {
  it('在 0 月返回 5 档值', () => {
    const ref = getReferenceAtAge(0, 'male', 'weight');
    expect(ref?.p50).toBe(3.3);
    expect(ref?.p3).toBe(2.5);
  });

  it('月龄超界返回 null', () => {
    expect(getReferenceAtAge(70, 'male', 'weight')).toBeNull();
  });
});
