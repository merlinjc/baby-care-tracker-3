/**
 * InsightSection - 本周趋势 4 卡片洞察（FR-B）
 *
 * 单卡片 4 行布局：
 *   1. 图标 + 名称 + 状态标签（胶囊）
 *   2. 迷你范围条
 *   3. 日均值 · 参考 X-Y · 环比 ±N%
 *   4. 智能提示语
 */
import { Baby, Moon, Droplets, Thermometer } from 'lucide-react'
import type { WeeklyTrendData, WeeklyTrendDimension, WeeklyTrendStatus } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { RangeBar } from '@/components/range-bar'
import { cn } from '@/lib/utils'

interface InsightSectionProps {
  trend: WeeklyTrendData | null
  isLoading?: boolean
}

const STATUS_LABEL: Record<WeeklyTrendStatus, string> = {
  normal: '正常',
  low: '偏少',
  high: '偏多',
  very_low: '明显偏少',
  very_high: '明显偏多',
  attention: '需关注',
  medical_attention: '需就医',
  no_data: '无数据',
}

const STATUS_BG: Record<WeeklyTrendStatus, { bg: string; color: string }> = {
  normal: { bg: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' },
  low: { bg: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning)' },
  high: { bg: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning)' },
  very_low: { bg: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' },
  very_high: { bg: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' },
  attention: { bg: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning)' },
  medical_attention: { bg: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' },
  no_data: { bg: 'var(--bg-elevated)', color: 'var(--text-hint)' },
}

interface DimensionCardProps {
  title: string
  Icon: typeof Baby
  iconColor: string
  unit: string
  /** 显示用的当前值（可能是 hours 或 count） */
  data: WeeklyTrendDimension
}

function DimensionCard({ title, Icon, iconColor, unit, data }: DimensionCardProps) {
  const { bg, color } = STATUS_BG[data.status]
  const hasChange = data.changePercent !== null && data.changePercent !== 0
  const changeAbs = Math.abs(data.changePercent ?? 0)
  const changeArrow = (data.changePercent ?? 0) > 0 ? '↑' : '↓'
  const changeColor =
    changeAbs <= 10 ? 'var(--text-hint)' : (data.changePercent ?? 0) > 0 ? 'var(--success)' : 'var(--warning)'

  return (
    <div className="card-base space-y-2.5">
      {/* 第一行：图标 + 名称 + 状态标签 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
          <span className="body-md font-medium">{title}</span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: bg, color }}
        >
          {STATUS_LABEL[data.status]}
        </span>
      </div>

      {/* 第二行：范围条 */}
      {data.range ? (
        <RangeBar value={data.thisWeekAvg} range={data.range} status={data.status} />
      ) : (
        <div className="h-2" />
      )}

      {/* 第三行：日均 + 参考 + 环比 */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="number-display text-base font-semibold">
          日均 {data.thisWeekAvg}
          <span className="text-[var(--text-hint)] ml-0.5">{unit}</span>
        </span>
        {data.range && (
          <span className="text-[var(--text-hint)]">
            参考 {data.range.min}-{data.range.max}
          </span>
        )}
        {hasChange && (
          <span style={{ color: changeColor }}>
            {changeArrow}
            {changeAbs}%
          </span>
        )}
      </div>

      {/* 第四行：智能提示 */}
      {data.tip && (
        <p className="text-xs text-[var(--text-secondary)] leading-snug truncate" title={data.tip}>
          {data.tip}
        </p>
      )}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="card-base space-y-2.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  )
}

export function InsightSection({ trend, isLoading }: InsightSectionProps) {
  if (isLoading || !trend) {
    return (
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2')}>
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2')}>
      <DimensionCard title="喂养" Icon={Baby} iconColor="var(--feeding)" unit="次" data={trend.feeding} />
      <DimensionCard title="睡眠" Icon={Moon} iconColor="var(--sleep)" unit="h" data={trend.sleep} />
      <DimensionCard title="排便" Icon={Droplets} iconColor="var(--diaper)" unit="次" data={trend.diaper} />
      <DimensionCard
        title="体温"
        Icon={Thermometer}
        iconColor="var(--temperature)"
        unit="次异常"
        data={trend.temperature}
      />
    </div>
  )
}
