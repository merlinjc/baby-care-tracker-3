/**
 * RangeBar - 迷你范围条（FR-B3）
 *
 * 60% 中央绿色正常区 + 当前值定位点（圆点）。
 * 当前值低 / 高时定位点偏左 / 右，颜色随状态变化。
 */
import type { ReferenceRange, WeeklyTrendStatus } from '@/types'

interface RangeBarProps {
  value: number
  range: ReferenceRange
  status: WeeklyTrendStatus
}

const STATUS_COLOR: Record<WeeklyTrendStatus, string> = {
  normal: 'var(--success)',
  low: 'var(--warning)',
  high: 'var(--warning)',
  very_low: 'var(--danger)',
  very_high: 'var(--danger)',
  attention: 'var(--warning)',
  medical_attention: 'var(--danger)',
  no_data: 'var(--text-hint)',
}

/**
 * 计算定位点在范围条上的位置（0-1）
 * - 正常区占中间 60%（0.2 ~ 0.8）
 * - 低于 min 时映射到左侧 0~0.2 区间
 * - 高于 max 时映射到右侧 0.8~1 区间
 */
function computePosition(value: number, range: ReferenceRange): number {
  if (range.min === range.max) return 0.5
  if (value <= range.min) {
    // 低于 min：0~0.2 区间
    const lowerBound = range.min * 0.5
    if (value <= lowerBound) return 0
    return ((value - lowerBound) / (range.min - lowerBound)) * 0.2
  }
  if (value >= range.max) {
    // 高于 max：0.8~1 区间
    const upperBound = range.max * 1.5
    if (value >= upperBound) return 1
    return 0.8 + ((value - range.max) / (upperBound - range.max)) * 0.2
  }
  // 在 [min, max] 内：映射到 0.2 ~ 0.8
  return 0.2 + ((value - range.min) / (range.max - range.min)) * 0.6
}

export function RangeBar({ value, range, status }: RangeBarProps) {
  const pos = computePosition(value, range)
  const dotColor = STATUS_COLOR[status]

  return (
    <div className="relative h-2 w-full rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      {/* 中间正常区（绿色淡背景） */}
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: '20%',
          width: '60%',
          backgroundColor: 'color-mix(in srgb, var(--success) 25%, transparent)',
        }}
      />
      {/* 定位点 */}
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
        style={{
          left: `${pos * 100}%`,
          backgroundColor: dotColor,
          boxShadow: `0 0 0 2px var(--bg-card)`,
        }}
        aria-label={`当前值 ${value}，参考 ${range.min}-${range.max}${range.unit}`}
      />
    </div>
  )
}
