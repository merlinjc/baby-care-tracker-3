/**
 * CalendarMonthSwitcher - 月份切换 header（v7.2 T-S2-F11-FE-03）
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface CalendarMonthSwitcherProps {
  year: number
  month: number // 1-12
  onPrev: () => void
  onNext: () => void
  /** 不可向前 / 向后切换（如已是当前月）。视觉上 disabled，不允许越过出生月 / 当前月 */
  prevDisabled?: boolean
  nextDisabled?: boolean
  className?: string
}

export function CalendarMonthSwitcher({
  year,
  month,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  className,
}: CalendarMonthSwitcherProps) {
  const { t } = useTranslation('daily-checkin')
  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label={t('calendar.switch_prev')}
        className={cn(
          'p-2 rounded-md',
          'hover:bg-[var(--surface-hover)] transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <ChevronLeft className="h-5 w-5 text-[var(--label-secondary)]" />
      </button>
      <span className="text-[17px] font-semibold text-[var(--label)] tabular-nums min-w-[110px] text-center">
        {year} 年 {month} 月
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={t('calendar.switch_next')}
        className={cn(
          'p-2 rounded-md',
          'hover:bg-[var(--surface-hover)] transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <ChevronRight className="h-5 w-5 text-[var(--label-secondary)]" />
      </button>
    </div>
  )
}
