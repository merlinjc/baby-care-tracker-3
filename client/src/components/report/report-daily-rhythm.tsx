/**
 * ReportDailyRhythm - 成长报告的每日节律图
 *
 * 用水平柱状图展示本期每天的喂养次数与睡眠小时；周报 7 列，月报最多 31 列。
 * 纯 SVG，不引入图表库；两指标共享 x 轴，feeding 是左 y 轴、sleep 是右 y 轴。
 */
import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import type { DailyBucket } from '@/hooks/use-report-data'

interface ReportDailyRhythmProps {
  daily: DailyBucket[]
}

const CHART_HEIGHT = 160
const BAR_GAP = 3

export function ReportDailyRhythm({ daily }: ReportDailyRhythmProps) {
  const { maxFeeding, maxSleep } = useMemo(() => {
    let mf = 1
    let ms = 1
    for (const d of daily) {
      if (d.feedingCount > mf) mf = d.feedingCount
      if (d.sleepHours > ms) ms = d.sleepHours
    }
    return { maxFeeding: mf, maxSleep: ms }
  }, [daily])

  // 默认仅展示日期 3 个标签（首 / 中 / 末）避免拥挤
  const labelIndices = useMemo(() => {
    const n = daily.length
    if (n <= 7) return daily.map((_, i) => i)
    return [0, Math.floor(n / 2), n - 1]
  }, [daily])

  const hasData = daily.some((d) => d.feedingCount > 0 || d.sleepHours > 0)

  if (!hasData) {
    return (
      <Card padding="lg" className="text-center">
        <p className="body-sm" style={{ color: 'var(--text-hint)' }}>
          本期还没有喂养或睡眠记录
        </p>
      </Card>
    )
  }

  return (
    <Card padding="md">
      {/* 图例 */}
      <div className="flex items-center gap-4 mb-3">
        <LegendDot color="var(--feeding)" label={`喂养（次/日，峰值 ${maxFeeding}）`} />
        <LegendDot color="var(--sleep)" label={`睡眠（小时/日，峰值 ${Math.round(maxSleep * 10) / 10}）`} />
      </div>

      {/* 柱图 */}
      <div className="relative" style={{ height: CHART_HEIGHT + 24 }}>
        <div
          className="absolute inset-x-0 top-0 flex items-end gap-[3px]"
          style={{ height: CHART_HEIGHT }}
        >
          {daily.map((d) => {
            const feedingH = (d.feedingCount / maxFeeding) * (CHART_HEIGHT - 8)
            const sleepH = (d.sleepHours / maxSleep) * (CHART_HEIGHT - 8)
            return (
              <div
                key={d.date}
                className="group flex-1 flex items-end gap-[2px] min-w-0"
                title={`${d.label}\n喂养 ${d.feedingCount} 次 · 睡眠 ${d.sleepHours}h · 排便 ${d.diaperCount} 次`}
                style={{ height: CHART_HEIGHT }}
              >
                <div
                  className="flex-1 rounded-t-sm transition-all group-hover:opacity-100"
                  style={{
                    height: Math.max(2, feedingH),
                    backgroundColor:
                      d.feedingCount > 0
                        ? 'var(--feeding)'
                        : 'color-mix(in srgb, var(--feeding) 20%, transparent)',
                    opacity: d.feedingCount > 0 ? 0.85 : 0.25,
                  }}
                />
                <div
                  className="flex-1 rounded-t-sm transition-all group-hover:opacity-100"
                  style={{
                    height: Math.max(2, sleepH),
                    backgroundColor:
                      d.sleepHours > 0
                        ? 'var(--sleep)'
                        : 'color-mix(in srgb, var(--sleep) 20%, transparent)',
                    opacity: d.sleepHours > 0 ? 0.85 : 0.25,
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* x 轴日期标签（稀疏） */}
        <div
          className="absolute inset-x-0 flex caption tabular-nums"
          style={{
            top: CHART_HEIGHT + 4,
            color: 'var(--text-hint)',
            gap: BAR_GAP,
          }}
        >
          {daily.map((d, i) => (
            <div key={d.date} className="flex-1 text-center truncate">
              {labelIndices.includes(i) ? d.label : ''}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 caption" style={{ color: 'var(--text-secondary)' }}>
      <span
        className="inline-block rounded-sm"
        style={{ width: 10, height: 10, backgroundColor: color }}
      />
      {label}
    </div>
  )
}
