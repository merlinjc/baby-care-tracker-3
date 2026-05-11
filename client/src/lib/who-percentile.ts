/**
 * who-percentile - WHO 百分位插值与异常判定（v7.2 T-S2-F10-01）
 *
 * 算法：
 * 1) 根据 ageInMonths 找到 WHO 数据表的"上下"两档（lo / hi）
 * 2) 分别对 P3/P15/P50/P85/P97 做线性插值，得到指定月龄的"参考百分位曲面"
 * 3) 把目标值与 5 档参考点做"分段线性百分位"投影
 *    - value ≤ p3   → 返回 ≤ 3
 *    - value ≥ p97  → 返回 ≥ 97
 *    - 落在两档之间：在两档对应百分位 (3, 15, 50, 85, 97) 上线性插值
 *
 * 不引入 LMS 官方 Z 分数算法（精度足够 + 零依赖）
 *
 * 与 who-standards.ts 的关系：
 * - getWHOData 仍可用于"取最接近月龄的整体五档值"
 * - 本 lib 提供 **value → 百分位** 反向能力（用于 hover tooltip / 异常判定）
 */
/**
 * Gender 类型本地定义（避免跨包 alias 解析）：
 * - 与 client/src/types#Gender 一致
 */
export type Gender = 'male' | 'female'

export type WhoMetric = 'weight' | 'height' | 'headCircumference'

interface PercentileData {
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

type WHODataSet = Record<number, PercentileData>

// 重用 who-standards 的内部数据（通过 getWHOReferenceLines 拉取）
import { getWHOReferenceLines } from './who-standards'

/**
 * 在两档采样点上线性插值得到 ageInMonths 对应的 5 档参考值。
 *
 * @returns 指定月龄的 PercentileData；若 ageInMonths 超出 0-60 范围，返回 null
 */
function interpolateReference(
  metric: WhoMetric,
  gender: Gender,
  ageInMonths: number,
): PercentileData | null {
  if (ageInMonths < 0 || ageInMonths > 60) return null
  const points = getWHOReferenceLines(metric, gender)
  if (points.length === 0) return null

  // 找到 lo / hi 两档
  let lo = points[0]
  let hi = points[points.length - 1]
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].month <= ageInMonths && points[i + 1].month >= ageInMonths) {
      lo = points[i]
      hi = points[i + 1]
      break
    }
  }
  if (lo.month === hi.month) {
    return {
      p3: lo.p3,
      p15: lo.p15,
      p50: lo.p50,
      p85: lo.p85,
      p97: lo.p97,
    }
  }
  const t = (ageInMonths - lo.month) / (hi.month - lo.month)
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    p3: lerp(lo.p3, hi.p3),
    p15: lerp(lo.p15, hi.p15),
    p50: lerp(lo.p50, hi.p50),
    p85: lerp(lo.p85, hi.p85),
    p97: lerp(lo.p97, hi.p97),
  }
}

const PERCENTILES = [3, 15, 50, 85, 97] as const

/**
 * 把 value 投影到 5 档参考点上估计百分位（线性插值）。
 *
 * - value ≤ p3 → 返回 3（边界饱和）
 * - value ≥ p97 → 返回 97（边界饱和）
 * - 中间：落在哪两档之间就在 (3, 15, 50, 85, 97) 上插值
 *
 * @returns 0-100 之间的整数百分位；若月龄超出 0-60 返回 null
 */
export function getPercentile(
  value: number,
  ageInMonths: number,
  gender: Gender,
  metric: WhoMetric,
): number | null {
  const ref = interpolateReference(metric, gender, ageInMonths)
  if (!ref) return null

  const refValues = [ref.p3, ref.p15, ref.p50, ref.p85, ref.p97]
  if (value <= refValues[0]) return 3
  if (value >= refValues[refValues.length - 1]) return 97

  for (let i = 0; i < refValues.length - 1; i++) {
    const lo = refValues[i]
    const hi = refValues[i + 1]
    if (value >= lo && value <= hi) {
      const t = (value - lo) / (hi - lo)
      const p = PERCENTILES[i] + (PERCENTILES[i + 1] - PERCENTILES[i]) * t
      return Math.round(p)
    }
  }
  // 兜底（不应到达）
  return 50
}

/** 把百分位映射为中文水平标签（用于 hover tooltip 与列表 Badge） */
export function getPercentileLabel(p: number | null): string {
  if (p === null) return ''
  if (p <= 3) return `≤P3 偏低`
  if (p < 15) return `P${p}（偏低）`
  if (p < 50) return `P${p}（中下水平）`
  if (p === 50) return `P50（标准水平）`
  if (p <= 85) return `P${p}（中上水平）`
  if (p < 97) return `P${p}（偏高）`
  return `≥P97 偏高`
}

/** 是否落在 WHO 标准异常区间（< P3 或 > P97 或月龄超范围） */
export function isOutOfRange(p: number | null): boolean {
  if (p === null) return true
  return p <= 3 || p >= 97
}

/** 给图表渲染的 5 条参考线点位（按月遍历） */
export function getReferenceLinePoints(
  gender: Gender,
  metric: WhoMetric,
  range: { from: number; to: number } = { from: 0, to: 60 },
): Record<'p3' | 'p15' | 'p50' | 'p85' | 'p97', { month: number; value: number }[]> {
  const result: Record<'p3' | 'p15' | 'p50' | 'p85' | 'p97', { month: number; value: number }[]> = {
    p3: [], p15: [], p50: [], p85: [], p97: [],
  }
  const from = Math.max(0, range.from)
  const to = Math.min(60, range.to)
  for (let m = from; m <= to; m++) {
    const ref = interpolateReference(metric, gender, m)
    if (!ref) continue
    result.p3.push({ month: m, value: round1(ref.p3) })
    result.p15.push({ month: m, value: round1(ref.p15) })
    result.p50.push({ month: m, value: round1(ref.p50) })
    result.p85.push({ month: m, value: round1(ref.p85) })
    result.p97.push({ month: m, value: round1(ref.p97) })
  }
  return result
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** 给定指定月龄的 5 档参考值（已插值），主要给 ReportGrowthSection 显示某次记录所处水平 */
export function getReferenceAtAge(
  ageInMonths: number,
  gender: Gender,
  metric: WhoMetric,
): PercentileData | null {
  return interpolateReference(metric, gender, ageInMonths)
}

// 让 ts 不抱怨：与 who-standards 同名类型重复声明（仅文件内使用）
export type { PercentileData, WHODataSet }
