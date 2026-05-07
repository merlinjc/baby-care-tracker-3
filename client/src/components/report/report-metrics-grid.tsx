/**
 * ReportMetricsGrid - 成长报告的关键指标概览
 *
 * 移动 2 列 / 桌面 4 列的大数字卡片，4 维度复用类型色：
 * - 喂养总次数 + 总奶量
 * - 睡眠总时长 + 次数
 * - 换尿布总次数 + 尿/便构成
 * - 体温记录次数 + 异常次数
 */
import { Baby, Moon, Droplets, Thermometer } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ReportMetrics } from '@/hooks/use-report-data'

interface ReportMetricsGridProps {
  metrics: ReportMetrics
  days: number
}

function formatHours(totalSec: number): { value: string; unit: string } {
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  if (h >= 100) return { value: String(h), unit: 'h' }
  if (h > 0 && m > 0) return { value: `${h}h${m}m`, unit: '' }
  if (h > 0) return { value: `${h}`, unit: 'h' }
  return { value: `${m}`, unit: 'm' }
}

interface Cell {
  key: string
  label: string
  Icon: typeof Baby
  color: string
  value: string
  unit?: string
  subText: string
}

export function ReportMetricsGrid({ metrics, days }: ReportMetricsGridProps) {
  const sleep = formatHours(metrics.sleep.totalDurationSec)
  const feedingAvg = days > 0 ? (metrics.feeding.count / days).toFixed(1) : '0'
  const diaperAvg = days > 0 ? (metrics.diaper.count / days).toFixed(1) : '0'

  const cells: Cell[] = [
    {
      key: 'feeding',
      label: '喂养',
      Icon: Baby,
      color: 'var(--feeding)',
      value: String(metrics.feeding.count),
      unit: '次',
      subText:
        metrics.feeding.totalAmount > 0
          ? `共 ${metrics.feeding.totalAmount}ml · 日均 ${feedingAvg} 次`
          : `日均 ${feedingAvg} 次`,
    },
    {
      key: 'sleep',
      label: '睡眠',
      Icon: Moon,
      color: 'var(--sleep)',
      value: sleep.value,
      unit: sleep.unit,
      subText: `共 ${metrics.sleep.count} 段`,
    },
    {
      key: 'diaper',
      label: '换尿布',
      Icon: Droplets,
      color: 'var(--diaper)',
      value: String(metrics.diaper.count),
      unit: '次',
      subText: `尿 ${metrics.diaper.peeCount} / 便 ${metrics.diaper.poopCount} · 日均 ${diaperAvg}`,
    },
    {
      key: 'temperature',
      label: '体温',
      Icon: Thermometer,
      color:
        metrics.temperature.abnormalCount > 0 ? 'var(--danger)' : 'var(--temperature)',
      value: String(metrics.temperature.count),
      unit: '次',
      subText:
        metrics.temperature.abnormalCount > 0
          ? `异常 ${metrics.temperature.abnormalCount} 次`
          : '全部正常',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cells.map((cell) => (
        <Card key={cell.key} padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="icon-circle"
              style={{
                width: 28,
                height: 28,
                backgroundColor: `color-mix(in srgb, ${cell.color} 14%, transparent)`,
                color: cell.color,
              }}
            >
              <cell.Icon className="h-3.5 w-3.5" />
            </div>
            <span className="caption" style={{ color: 'var(--text-secondary)' }}>
              {cell.label}
            </span>
          </div>
          <div
            className="display-number flex items-baseline gap-0.5"
            style={{ color: cell.color, fontSize: 'var(--text-2xl)' }}
          >
            {cell.value}
            {cell.unit && (
              <span
                className="font-medium"
                style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}
              >
                {cell.unit}
              </span>
            )}
          </div>
          <p className="caption mt-2 truncate" style={{ color: 'var(--text-hint)' }}>
            {cell.subText}
          </p>
        </Card>
      ))}
    </div>
  )
}
