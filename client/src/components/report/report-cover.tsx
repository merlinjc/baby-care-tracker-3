/**
 * ReportCover - 成长报告封面卡
 *
 * 编辑感设计：非对称留白 + 大号宝宝名 + 小号报告周期副标题；
 * 与发现页 FocusCard 差异化：不用色条，用渐变背景 + "一本册子"的视觉。
 */
import { BookOpen } from 'lucide-react'
import type { Baby } from '@/types'
import type { ReportPeriod, ReportPeriodRange } from '@/hooks/use-report-data'

interface ReportCoverProps {
  baby: Baby
  period: ReportPeriod
  range: ReportPeriodRange
}

function computeAgeText(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years > 0) return `${years} 岁 ${remMonths} 月龄`
  const days = Math.floor((now.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000))
  if (months > 0) return `${months} 月龄`
  return `${days} 天`
}

export function ReportCover({ baby, period, range }: ReportCoverProps) {
  const periodLabel = period === 'week' ? '本周报告' : '本月报告'
  return (
    <section
      className="relative overflow-hidden rounded-2xl p-6 md:p-8"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--bg-card)) 0%, color-mix(in srgb, var(--primary) 6%, var(--bg-card)) 60%, var(--bg-card) 100%)',
        border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
      }}
    >
      {/* 右上角大号装饰字 */}
      <div
        className="pointer-events-none absolute -right-4 -top-4 select-none font-bold"
        style={{
          fontSize: 120,
          lineHeight: 1,
          color: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          letterSpacing: '-0.04em',
        }}
        aria-hidden
      >
        {period === 'week' ? 'W' : 'M'}
      </div>

      <div className="relative">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--primary) 18%, transparent)',
            color: 'var(--primary-dark, var(--primary))',
          }}
        >
          <BookOpen className="h-3 w-3" />
          <span className="text-[11px] font-medium tracking-wide">{periodLabel}</span>
        </div>
        <h2 className="display-sm text-[var(--text-primary)] leading-tight">{baby.name}</h2>
        <p className="body-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {computeAgeText(baby.birthDate)} · {range.label}（共 {range.days} 天）
        </p>
      </div>
    </section>
  )
}
