/**
 * GrowthCalendarPage - 成长日历独立路由 /growth/calendar（v7.2 T-S2-F11-FE-03）
 *
 * URL 参数：
 *   - ?year=2026&month=5 - 指定显示月份；缺省取当前月
 *   - ?date=YYYY-MM-DD   - 指定后续 FE-04 自动打开该日详情抽屉（FE-03 阶段先解析，详情抽屉 FE-04 上线）
 *   - ?babyId=xxx        - 由 useActiveBaby 处理，与全站一致
 *
 * 状态：
 *   - 无 currentBaby：显示空态引导
 *   - cell 点击：FE-03 阶段 console.log + FE-04 替换为打开 detail drawer
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useBabyStore } from '@/stores/baby-store'
import { useAuthStore } from '@/stores/auth-store'
import { useFamilyStore } from '@/stores/family-store'
import { usePermission } from '@/hooks/use-permission'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { Card } from '@/components/ui/card'
import { GrowthCalendar } from '@/components/growth-calendar/growth-calendar'
import { CalendarMonthSwitcher } from '@/components/growth-calendar/calendar-month-switcher'
import { CalendarExportMenu } from '@/components/growth-calendar/calendar-export-menu'
import { DailyCheckinDetail } from '@/components/daily-checkin/daily-checkin-detail'
import { useDailyCheckins } from '@/hooks/use-daily-checkins'
import { relationToCareRole } from '@/lib/care-role'
import {
  todayLocalYmd,
  getNextMonth,
  getPreviousMonth,
  isValidYmd,
} from '@/lib/daily-checkin-date'
import type { CalendarCellState } from '@/components/growth-calendar/calendar-cell'
import type { CareRole, DailyCheckin } from '@/types'

/** 解析 ?year & ?month；非法时回退：优先用 ?date 所在月，否则当前月 */
function parseYearMonth(
  search: URLSearchParams,
): { year: number; month: number } {
  const today = new Date()
  const fallbackY = today.getFullYear()
  const fallbackM = today.getMonth() + 1
  const y = Number(search.get('year'))
  const m = Number(search.get('month'))
  if (Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12) {
    return { year: y, month: m }
  }
  // 退化用 ?date 所在月
  const dateParam = search.get('date')
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return { year: Number(dateParam.slice(0, 4)), month: Number(dateParam.slice(5, 7)) }
  }
  return { year: fallbackY, month: fallbackM }
}

export function GrowthCalendarPage() {
  const { t } = useTranslation('daily-checkin')
  const [search, setSearch] = useSearchParams()
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const user = useAuthStore((s) => s.user)
  const family = useFamilyStore((s) => s.family)
  const { canEdit, isAdmin } = usePermission()

  const [{ year, month }, setYearMonth] = useState(() => parseYearMonth(search))

  // URL → 状态同步（用户手输 url 直接刷新时）
  useEffect(() => {
    const next = parseYearMonth(search)
    if (next.year !== year || next.month !== month) {
      setYearMonth(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // 状态 → URL 同步（点击切月时）
  const updateYearMonth = useCallback(
    (y: number, m: number) => {
      setYearMonth({ year: y, month: m })
      setSearch(
        (prev) => {
          prev.set('year', String(y))
          prev.set('month', String(m))
          return prev
        },
        { replace: true },
      )
    },
    [setSearch],
  )

  const handlePrev = useCallback(() => {
    const { year: y, month: m } = getPreviousMonth(year, month)
    updateYearMonth(y, m)
  }, [year, month, updateYearMonth])

  const handleNext = useCallback(() => {
    const { year: y, month: m } = getNextMonth(year, month)
    updateYearMonth(y, m)
  }, [year, month, updateYearMonth])

  // 不允许翻到未来月（仅截至当前月）
  const today = useMemo(() => todayLocalYmd(), [])
  const todayY = Number(today.slice(0, 4))
  const todayM = Number(today.slice(5, 7))
  const nextDisabled = year > todayY || (year === todayY && month >= todayM)
  // 不允许翻到出生月之前
  const birthYmd = useMemo(() => {
    if (!currentBaby?.birthDate) return null
    const d = new Date(currentBaby.birthDate)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [currentBaby?.birthDate])
  const currentYm = `${year}-${String(month).padStart(2, '0')}`
  const prevDisabled = !!birthYmd && currentYm <= birthYmd

  // 月度统计 — 复用列表查询（已被 GrowthCalendar 内部触发）
  const { data } = useDailyCheckins({ babyId: currentBaby?.id, year, month })
  const monthCount = data?.items.length ?? 0

  // 详情抽屉日期来自 URL ?date=
  const openDate = search.get('date')
  const isOpen = !!openDate && isValidYmd(openDate)

  const careRole: CareRole = useMemo(() => {
    const me = family?.members?.find((m) => m.userId === user?.id)
    return relationToCareRole(me?.relation ?? null) ?? 'other'
  }, [family, user?.id])

  // FE-04：cell 点击 → 设置 ?date=YYYY-MM-DD 打开详情抽屉
  const handleCellClick = useCallback(
    (ymd: string, state: CalendarCellState, _c?: DailyCheckin) => {
      if (state === 'checked' || state === 'supplement') {
        setSearch(
          (prev) => {
            prev.set('date', ymd)
            return prev
          },
          { replace: false }, // 详情打开走 history.push，便于安卓物理返回键关闭
        )
      }
    },
    [setSearch],
  )

  const handleDetailClose = useCallback(() => {
    setSearch(
      (prev) => {
        prev.delete('date')
        return prev
      },
      { replace: false },
    )
  }, [setSearch])

  if (!currentBaby) {
    return (
      <div className="space-y-4">
        <LargeTitleHeader title="成长日历" backTo="/growth" />
        <Card variant="plain" padding="lg">
          <p className="text-center text-[var(--label-secondary)] text-[14px]">
            请先选择一个宝宝
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <LargeTitleHeader
        title={t('calendar.page_title', { name: currentBaby.name })}
        subtitle={t('calendar.subtitle', {
          year,
          month,
          count: monthCount,
        })}
        backTo="/growth"
        rightAction={
          monthCount > 0 ? (
            <CalendarExportMenu
              baby={currentBaby}
              year={year}
              month={month}
              checkins={data?.items ?? []}
            />
          ) : undefined
        }
      />

      <Card variant="plain" padding="md" className="space-y-3">
        <CalendarMonthSwitcher
          year={year}
          month={month}
          onPrev={handlePrev}
          onNext={handleNext}
          prevDisabled={prevDisabled}
          nextDisabled={nextDisabled}
        />
        <GrowthCalendar
          baby={currentBaby}
          year={year}
          month={month}
          onCellClick={handleCellClick}
        />
      </Card>

      {/* 单日详情抽屉（FE-04） */}
      {family && openDate && (
        <DailyCheckinDetail
          open={isOpen}
          onClose={handleDetailClose}
          babyId={currentBaby.id}
          familyId={family.id}
          date={openDate}
          currentUserId={user?.id}
          canEdit={canEdit}
          isAdmin={isAdmin}
          role={careRole}
        />
      )}
    </div>
  )
}
