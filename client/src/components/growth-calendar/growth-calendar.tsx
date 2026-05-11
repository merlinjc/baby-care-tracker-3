/**
 * GrowthCalendar - 成长日历月视图（v7.2 T-S2-F11-FE-03）
 *
 * 输入：babyId + (year, month) → 输出：7×N 网格 + cell 状态判断
 *
 * 状态判断规则：
 *   - 当前月外（首尾补齐的上下月日期）：out-of-month，显数字但淡化、不可点
 *   - inCurrentMonth + ymd > today：future
 *   - inCurrentMonth + ymd < birthDate：expired（视为超窗口）
 *   - inCurrentMonth + 已有 checkin：checked
 *   - inCurrentMonth + 在 7d 窗口：supplement
 *   - inCurrentMonth + 不在 7d 窗口：expired
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getMonthGrid,
  todayLocalYmd,
  isWithinCheckinWindow,
} from '@/lib/daily-checkin-date'
import { useDailyCheckins } from '@/hooks/use-daily-checkins'
import { CalendarCell, type CalendarCellState } from './calendar-cell'
import type { Baby, DailyCheckin } from '@/types'

export interface GrowthCalendarProps {
  baby: Baby
  year: number
  month: number // 1-12
  /** cell 点击 (ymd, state) → 让父组件决定打开详情抽屉 / 触发补打卡 */
  onCellClick?: (ymd: string, state: CalendarCellState, checkin?: DailyCheckin) => void
}

const WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function GrowthCalendar({ baby, year, month, onCellClick }: GrowthCalendarProps) {
  const { t } = useTranslation('daily-checkin')
  const { data, isLoading } = useDailyCheckins({ babyId: baby.id, year, month })
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const today = todayLocalYmd()
  const birthYmd = useMemo(() => {
    const d = new Date(baby.birthDate)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [baby.birthDate])

  /** ymd → checkin map */
  const checkinMap = useMemo(() => {
    const map = new Map<string, DailyCheckin>()
    for (const c of data?.items ?? []) {
      map.set(c.checkinDate, c)
    }
    return map
  }, [data])

  return (
    <div className="space-y-2">
      {/* 周标签 */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEK_KEYS.map((k) => (
          <div
            key={k}
            className="text-[12px] font-medium text-[var(--label-tertiary)] py-1"
          >
            {t(`calendar.weekday.${k}`)}
          </div>
        ))}
      </div>

      {/* 网格 */}
      <div
        className="grid grid-cols-7 gap-1.5"
        aria-busy={isLoading}
        aria-label={t('calendar.page_title', { name: baby.name })}
      >
        {grid.map((cell) => {
          const day = parseInt(cell.ymd.slice(8, 10), 10)
          const checkin = checkinMap.get(cell.ymd)
          let state: CalendarCellState
          let tooltip: string | undefined

          if (!cell.inCurrentMonth) {
            state = 'out-of-month'
          } else if (cell.ymd > today) {
            state = 'future'
            tooltip = t('calendar.cell_future_tip')
          } else if (cell.ymd < birthYmd) {
            state = 'expired'
          } else if (checkin) {
            state = 'checked'
          } else if (isWithinCheckinWindow(cell.ymd)) {
            state = 'supplement'
            tooltip = t('calendar.cell_supplement_tip')
          } else {
            state = 'expired'
            tooltip = t('calendar.cell_expired_tip')
          }

          return (
            <CalendarCell
              key={cell.ymd}
              ymd={cell.ymd}
              day={day}
              inCurrentMonth={cell.inCurrentMonth}
              state={state}
              checkin={checkin}
              tooltip={tooltip}
              onClick={() => onCellClick?.(cell.ymd, state, checkin)}
            />
          )
        })}
      </div>
    </div>
  )
}
