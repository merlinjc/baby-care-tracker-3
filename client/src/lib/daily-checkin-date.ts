/**
 * 每日打卡日期工具（v7.2 Sprint 2 T-S2-F11）
 *
 * 设计要点：
 * 1) 全部以 **本地时区** 的 `YYYY-MM-DD` 字符串为流转格式，避免 UTC ↔ 本地的时区漂移；
 * 2) 仅依赖 `Date` API，无第三方依赖（dayjs/luxon 暂不引入，体积优先）；
 * 3) 纯函数，便于在单元测试中显式注入 `now`；
 * 4) `isWithinCheckinWindow`：产品规则——只允许"今天 + 过去 7 天"内打卡 / 补打卡。
 *
 * 使用场景：
 * - PhotoUploader 创建前用 `isWithinCheckinWindow` 校验；
 * - GrowthCalendar 月视图用 `getMonthGrid` 生成 7×N 网格；
 * - DailyCheckinCard 用 `todayLocalYmd()` 判断是否已有今日打卡；
 * - server schema 校验 `checkinDate` 时也由前端先做一次（后端再做权威校验）。
 */

/** 把 Date 安全格式化为 `YYYY-MM-DD`（本地时区） */
function toYmd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** YYYY-MM-DD 严格正则（不校验日期合法性，只校验格式） */
export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 校验 ymd 是否为合法日期（含格式 + 实际值，例如 2026-02-30 会返回 false） */
export function isValidYmd(ymd: string): boolean {
  if (!YMD_PATTERN.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  )
}

/** 把 `YYYY-MM-DD` 转为本地 00:00 的 Date（不做时区换算） */
export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 当前本地日期的 ymd 字符串。允许注入 `now` 便于测试。 */
export function todayLocalYmd(now: Date = new Date()): string {
  return toYmd(now)
}

/** ymd 在 today 之前（严格 <） */
export function isPast(ymd: string, now: Date = new Date()): boolean {
  if (!isValidYmd(ymd)) return false
  return ymd < todayLocalYmd(now)
}

/** ymd 在 today 之后（严格 >） */
export function isFuture(ymd: string, now: Date = new Date()): boolean {
  if (!isValidYmd(ymd)) return false
  return ymd > todayLocalYmd(now)
}

/** ymd 等于 today */
export function isToday(ymd: string, now: Date = new Date()): boolean {
  return ymd === todayLocalYmd(now)
}

/**
 * 是否落在「补打卡窗口」内：[today - 7d, today]（含两端）。
 * 产品规则：超过 7 天前的日期不可补打卡；未来日期任何情况都不可打卡。
 *
 * @returns 在窗口内返回 true；ymd 非法 / 未来 / 超 7 天 均返回 false
 */
export function isWithinCheckinWindow(
  ymd: string,
  now: Date = new Date(),
): boolean {
  if (!isValidYmd(ymd)) return false
  const today = ymdToLocalDate(todayLocalYmd(now))
  const target = ymdToLocalDate(ymd)
  if (target.getTime() > today.getTime()) return false // 未来
  const diffMs = today.getTime() - target.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  return diffDays >= 0 && diffDays <= 7
}

/** 计算 ymd 距今天的天数（today=0，昨天=1，明天=-1）；非法返回 NaN */
export function daysFromToday(ymd: string, now: Date = new Date()): number {
  if (!isValidYmd(ymd)) return Number.NaN
  const today = ymdToLocalDate(todayLocalYmd(now))
  const target = ymdToLocalDate(ymd)
  return Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
}

/** 月份网格的单元格 */
export interface DateCell {
  /** YYYY-MM-DD */
  ymd: string
  /** 是否属于当前显示月（false 表示上月尾巴或下月开头，用于补齐网格） */
  inCurrentMonth: boolean
  /** 周几：0=周日, 1=周一, ... 6=周六 */
  weekday: number
}

/**
 * 获取月视图网格。约定网格首列为周一（中国语境），最后一列周日。
 *
 * - 首行包含上月尾部用于对齐周一
 * - 末行包含下月头部用于补齐到 7 列；
 * - 总行数 5 或 6（按当月长度自适应）
 *
 * @param year - 4 位年份，例如 2026
 * @param month - 1-12（注意：非 JS Date 的 0-11）
 */
export function getMonthGrid(year: number, month: number): DateCell[] {
  if (month < 1 || month > 12) {
    throw new RangeError(`Invalid month: ${month}（应为 1-12）`)
  }

  const firstOfMonth = new Date(year, month - 1, 1)
  // JS getDay：0=Sun..6=Sat；本日历周一为首列
  // 需要把"上月尾部"补到 firstOfMonth 之前 N 天
  const jsWeekday = firstOfMonth.getDay() // 0=Sun
  const mondayBased = (jsWeekday + 6) % 7 // 0=Mon, 6=Sun
  const gridStart = new Date(year, month - 1, 1 - mondayBased)

  // 当月天数
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCellsNeeded = mondayBased + daysInMonth
  const rows = Math.ceil(totalCellsNeeded / 7)
  const totalCells = rows * 7

  const cells: DateCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    )
    cells.push({
      ymd: toYmd(d),
      inCurrentMonth: d.getMonth() === month - 1,
      weekday: d.getDay(),
    })
  }
  return cells
}

/** 上一个月的 { year, month }（month 为 1-12） */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

/** 下一个月的 { year, month }（month 为 1-12） */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

/** 月份开始 / 结束的 ymd（用于 list 查询的 startDate/endDate） */
export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const days = new Date(year, month, 0).getDate()
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
  }
}
