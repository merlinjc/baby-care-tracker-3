/**
 * ReportGrowthSection - 本期生长变化
 *
 * 比较"期初 vs 期末"最新 growth 记录；若仅一条记录则只展示当前值。
 * 差异 ≥ 0 用绿色（增长），< 0 用橙色（减少），无记录则温和空态。
 */
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { GrowthSnapshot } from '@/hooks/use-report-data'

interface ReportGrowthSectionProps {
  start: GrowthSnapshot | null
  end: GrowthSnapshot | null
}

interface GrowthRow {
  label: string
  unit: string
  startValue: number | null
  endValue: number | null
  color: string
}

function formatDelta(start: number | null, end: number | null, unit: string): {
  text: string
  color: string
} {
  if (start == null || end == null) return { text: '—', color: 'var(--text-hint)' }
  const delta = Math.round((end - start) * 100) / 100
  if (delta === 0) return { text: '持平', color: 'var(--text-hint)' }
  const sign = delta > 0 ? '+' : ''
  return {
    text: `${sign}${delta}${unit}`,
    color: delta > 0 ? 'var(--success)' : 'var(--warning)',
  }
}

export function ReportGrowthSection({ start, end }: ReportGrowthSectionProps) {
  if (!start && !end) {
    return (
      <Card padding="md" className="text-center">
        <TrendingUp
          className="h-5 w-5 mx-auto mb-2"
          style={{ color: 'var(--text-hint)' }}
        />
        <p className="body-sm" style={{ color: 'var(--text-hint)' }}>
          本期还没有身高 / 体重 / 头围记录
        </p>
        <Link
          to="/growth"
          className="inline-flex items-center gap-0.5 caption font-medium mt-2"
          style={{ color: 'var(--primary)' }}
        >
          去记录 <ChevronRight className="h-3 w-3" />
        </Link>
      </Card>
    )
  }

  const rows: GrowthRow[] = [
    {
      label: '体重',
      unit: 'kg',
      startValue: start?.weightKg ?? null,
      endValue: end?.weightKg ?? null,
      color: 'var(--feeding)',
    },
    {
      label: '身高',
      unit: 'cm',
      startValue: start?.heightCm ?? null,
      endValue: end?.heightCm ?? null,
      color: 'var(--sleep)',
    },
    {
      label: '头围',
      unit: 'cm',
      startValue: start?.headCircumferenceCm ?? null,
      endValue: end?.headCircumferenceCm ?? null,
      color: 'var(--growth)',
    },
  ].filter((r) => r.endValue != null)

  const sameRecord = !!start && !!end && start.measuredAt === end.measuredAt

  return (
    <Card variant="gradient-header" gradientColor="var(--gradient-growth)" accentWidth={2} padding="md" className="space-y-3">
      {rows.map((row) => {
        const delta = formatDelta(row.startValue, row.endValue, row.unit)
        return (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block rounded-full shrink-0"
                style={{ width: 8, height: 8, backgroundColor: row.color }}
              />
              <span className="body-md font-medium text-[var(--text-primary)]">
                {row.label}
              </span>
            </div>
            <div className="text-right">
              <div
                className="number-display font-semibold"
                style={{ color: row.color, fontSize: 'var(--text-lg)' }}
              >
                {row.endValue}
                <span
                  className="font-medium ml-0.5"
                  style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}
                >
                  {row.unit}
                </span>
              </div>
              {!sameRecord && row.startValue != null && (
                <div className="caption mt-0.5" style={{ color: 'var(--text-hint)' }}>
                  期初 {row.startValue}
                  {row.unit}
                </div>
              )}
            </div>
            <div
              className="caption number-display font-medium min-w-[56px] text-right"
              style={{ color: delta.color }}
            >
              {sameRecord ? '—' : delta.text}
            </div>
          </div>
        )
      })}
      <Link
        to="/growth"
        className="inline-flex items-center gap-0.5 caption font-medium"
        style={{ color: 'var(--primary)' }}
      >
        查看生长曲线 <ChevronRight className="h-3 w-3" />
      </Link>
    </Card>
  )
}
