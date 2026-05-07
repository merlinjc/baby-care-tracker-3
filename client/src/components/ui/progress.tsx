/**
 * Progress - 进度条
 *
 * 基于 @radix-ui/react-progress（提供 role="progressbar" + aria-valuenow）。
 *
 * 3 种 variant：
 * - 'bar' (默认)：单色进度条，TodaySummary 4 格和 QuotaBar 使用
 * - 'range'：在 min-max 区间内显示一个"点"或"带状"的范围指示（替代旧 RangeBar / WHO 百分位）
 * - 'indeterminate'：不确定进度（slide 动画）
 *
 * 所有 variant 共享 size（sm/md）+ accentColor。
 */
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const progressTrackVariants = cva(
  'relative w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]',
  {
    variants: {
      size: {
        sm: 'h-1.5',
        md: 'h-2',
        lg: 'h-2.5',
      },
    },
    defaultVariants: { size: 'sm' },
  },
)

export interface ProgressProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
      'className' | 'value'
    >,
    VariantProps<typeof progressTrackVariants> {
  /** 当前值 0-max */
  value?: number | null
  /** 最大值，默认 100 */
  max?: number
  className?: string
  accentColor?: string
}

export const Progress = forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    { className, size, value, max = 100, accentColor = 'var(--primary)', ...props },
    ref,
  ) => {
    const clamped = Math.max(0, Math.min(max, value ?? 0))
    const percent = (clamped / max) * 100

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={clamped}
        max={max}
        className={cn(progressTrackVariants({ size }), className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className="h-full transition-[width] duration-500 ease-out rounded-full"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </ProgressPrimitive.Root>
    )
  },
)
Progress.displayName = 'Progress'

/**
 * RangeIndicator - 在一段区间上显示当前值所在的相对位置
 *
 * 用于 WHO 百分位 / 生长趋势等需要"点位化表达"的场景。
 *
 * 例：<RangeIndicator min={0} max={100} value={50} accentColor="var(--growth)" />
 */
export interface RangeIndicatorProps
  extends VariantProps<typeof progressTrackVariants> {
  min: number
  max: number
  value: number
  accentColor?: string
  /** 可选：指定一个正常区间 [normalMin, normalMax]，渲染为背景带颜色 */
  normalRange?: [number, number]
  className?: string
  label?: string
}

export function RangeIndicator({
  min,
  max,
  value,
  accentColor = 'var(--primary)',
  normalRange,
  size,
  className,
  label,
}: RangeIndicatorProps) {
  const total = max - min
  const clamped = Math.max(min, Math.min(max, value))
  const pct = ((clamped - min) / total) * 100

  const normalStart = normalRange ? ((normalRange[0] - min) / total) * 100 : 0
  const normalEnd = normalRange ? ((normalRange[1] - min) / total) * 100 : 0

  return (
    <div
      className={cn('relative', progressTrackVariants({ size }), className)}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
    >
      {normalRange && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${normalStart}%`,
            width: `${Math.max(0, normalEnd - normalStart)}%`,
            backgroundColor: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
          }}
        />
      )}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white"
        style={{
          left: `calc(${pct}% - 5px)`,
          borderColor: accentColor,
        }}
      />
    </div>
  )
}

export { progressTrackVariants }

/**
 * WeeklyRangeBar - 本周趋势用的"非均匀参考范围条"
 *
 * 与 <RangeIndicator> 的差异：
 * - 中央 60%（0.2~0.8）是绿色"正常区"背景（半透明）
 * - 低于 min 时映射到左侧 0~0.2（偏左越偏异常）
 * - 高于 max 时映射到右侧 0.8~1（偏右越偏异常）
 *
 * 由 InsightSection 本周趋势使用（v5.0.1 之前叫 <RangeBar>，已合并到此）。
 */
export interface WeeklyRangeBarProps {
  value: number
  min: number
  max: number
  /** 当前值状态对应的定位点颜色（normal=green / low,high=warning / very_*=danger） */
  dotColor: string
  /** 单位（仅用于 aria-label） */
  unit?: string
  className?: string
}

function computeNonUniformPosition(value: number, min: number, max: number): number {
  if (min === max) return 0.5
  if (value <= min) {
    // 低于 min：0~0.2 区间
    const lowerBound = min * 0.5
    if (value <= lowerBound) return 0
    return ((value - lowerBound) / (min - lowerBound)) * 0.2
  }
  if (value >= max) {
    // 高于 max：0.8~1 区间
    const upperBound = max * 1.5
    if (value >= upperBound) return 1
    return 0.8 + ((value - max) / (upperBound - max)) * 0.2
  }
  // 在 [min, max] 内：映射到 0.2 ~ 0.8
  return 0.2 + ((value - min) / (max - min)) * 0.6
}

export function WeeklyRangeBar({
  value,
  min,
  max,
  dotColor,
  unit,
  className,
}: WeeklyRangeBarProps) {
  const pos = computeNonUniformPosition(value, min, max)

  return (
    <div
      className={cn('relative h-2 w-full rounded-full', className)}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
      role="slider"
      aria-label={`当前值 ${value}，参考 ${min}-${max}${unit ?? ''}`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
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
      />
    </div>
  )
}
