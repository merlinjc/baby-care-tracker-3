/**
 * Easter Egg Engine - 8 类彩蛋检测引擎（FR-G2）
 *
 * 8 类检测：
 *   EE-1: 30天满月 / EE-2: 100天百日 / EE-3: 365天周岁
 *   EE-4: 第一次记录 / EE-5: 月龄提示条（非 30/100/365 整月）
 *   EE-6: 连续 7 / 30 天打卡
 *   EE-7: 节日（儿童节、母亲节、父亲节、春节、中秋）
 *   EE-8: 数据洞察（喂养冠军 / 睡神 / 完美一天）
 *
 * 触发与 localStorage 标记 key（与小程序保持一致，便于未来数据迁移）：
 *   egg_30day_${babyId} / egg_100day_${babyId} / egg_365day_${babyId}
 *   egg_first_record_${babyId}
 *   egg_month_${N}_${babyId}（N 为月龄数）
 *   egg_streak_${N}_${babyId}（N=7 / 30）
 *   egg_holiday_${holidayId}_${year}_${babyId}
 *   egg_insight_${type}_${YYYY-MM-DD}_${babyId}
 */
import type { CareRecord, TodayStats } from '@/types'

export type EggType =
  | '30day' | '100day' | '365day'
  | 'first_record' | 'month_milestone' | 'streak_7' | 'streak_30'
  | 'holiday' | 'insight_feeding_champion' | 'insight_sleep_god' | 'insight_perfect_day'

export interface EggResult {
  type: EggType
  /** 数字越大越优先 */
  priority: number
  /** 渲染形式：弹窗（半屏）/ Toast（顶部短消息）/ Banner（横条） */
  variant: 'popup' | 'toast' | 'banner'
  title: string
  message: string
  /** 用于点击关闭后写入 localStorage 的 key */
  storageKey: string
  emoji?: string
  /** 子文案（弹窗用） */
  subtitle?: string
}

export interface EasterEggContext {
  babyId: string
  babyName: string
  /** 出生天数（≥1，由 ageDays 计算） */
  birthDayCount: number
  todayStats: TodayStats
  /** 最近若干天记录（用于连续天数判断），优先 30 天内 */
  recentRecords: CareRecord[]
}

// 春节硬编码近 3 年
const SPRING_FESTIVAL_DATES: Record<number, string> = {
  2026: '02-17',
  2027: '02-06',
  2028: '01-26',
}
// 中秋节硬编码近 3 年
const MID_AUTUMN_DATES: Record<number, string> = {
  2026: '09-25',
  2027: '09-15',
  2028: '10-03',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayMonthDay(): string {
  const d = new Date()
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nthSundayOfMonth(year: number, month: number, n: number): string {
  // month: 1-12, n: 第 N 个周日（1 = 第一个）
  const d = new Date(year, month - 1, 1)
  const offsetToSunday = (7 - d.getDay()) % 7
  const day = 1 + offsetToSunday + (n - 1) * 7
  return `${pad(month)}-${pad(day)}`
}

function isHolidayToday(): { id: string; name: string; emoji: string } | null {
  const today = todayMonthDay()
  const year = new Date().getFullYear()

  if (today === '06-01') return { id: 'children_day', name: '儿童节', emoji: '🎈' }
  if (today === nthSundayOfMonth(year, 5, 2)) return { id: 'mothers_day', name: '母亲节', emoji: '🌷' }
  if (today === nthSundayOfMonth(year, 6, 3)) return { id: 'fathers_day', name: '父亲节', emoji: '👔' }
  if (today === SPRING_FESTIVAL_DATES[year]) return { id: 'spring_festival', name: '春节', emoji: '🧧' }
  if (today === MID_AUTUMN_DATES[year]) return { id: 'mid_autumn', name: '中秋节', emoji: '🥮' }
  return null
}

function hasShown(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/**
 * 计算连续打卡天数：从今天起向前逐日检查 recentRecords
 */
function computeStreakDays(records: CareRecord[]): number {
  if (records.length === 0) return 0
  const dayKeys = new Set(
    records.map((r) => {
      const d = new Date(r.startTime)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }),
  )
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (dayKeys.has(key)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * 主入口：返回所有触发的彩蛋（按 priority 排序）
 * 调用方决定如何渲染（一次只显示最高优先级 popup，toast 类可排队）
 */
export function detectAll(ctx: EasterEggContext): EggResult[] {
  const results: EggResult[] = []
  const { babyId, babyName, birthDayCount, todayStats, recentRecords } = ctx

  // EE-1 / EE-2 / EE-3 时间节点（条件放宽 +3 天容错）
  if (birthDayCount >= 30 && birthDayCount <= 33) {
    const key = `egg_30day_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: '30day',
        priority: 100,
        variant: 'popup',
        title: '满月快乐！🌙',
        subtitle: `${babyName}已经满月啦！恭喜新手爸妈度过了最辛苦的第一个月`,
        message: '满月快乐',
        storageKey: key,
        emoji: '🌙',
      })
    }
  } else if (birthDayCount >= 100 && birthDayCount <= 103) {
    const key = `egg_100day_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: '100day',
        priority: 100,
        variant: 'popup',
        title: '百日快乐！',
        subtitle: `${babyName}来到这个世界已经100天了，小家伙越来越棒了！`,
        message: '百日快乐',
        storageKey: key,
        emoji: '💯',
      })
    }
  } else if (birthDayCount >= 365 && birthDayCount <= 368) {
    const key = `egg_365day_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: '365day',
        priority: 110,
        variant: 'popup',
        title: '周岁快乐！🎂',
        subtitle: `${babyName}一周岁了！感谢每一天的陪伴与付出`,
        message: '周岁快乐',
        storageKey: key,
        emoji: '🎂',
      })
    }
  }

  // EE-4：第一次记录
  const totalToday =
    todayStats.feeding.count + todayStats.sleep.count + todayStats.diaper.count + todayStats.temperature.count
  if (totalToday === 1 && recentRecords.length === 1) {
    const key = `egg_first_record_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'first_record',
        priority: 80,
        variant: 'toast',
        title: '第一次记录完成！',
        message: '育儿之旅正式开始 🚀',
        storageKey: key,
        emoji: '🚀',
      })
    }
  }

  // EE-5：月龄提示（30 倍数，且不在 EE-1/2/3 范围内）
  if (
    birthDayCount > 0 &&
    birthDayCount % 30 === 0 &&
    !(birthDayCount >= 30 && birthDayCount <= 33) &&
    !(birthDayCount >= 100 && birthDayCount <= 103) &&
    !(birthDayCount >= 365 && birthDayCount <= 368)
  ) {
    const months = Math.floor(birthDayCount / 30)
    const key = `egg_month_${months}_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'month_milestone',
        priority: 30,
        variant: 'banner',
        title: '',
        message: `${babyName}今天 ${months} 个月啦 🎈`,
        storageKey: key,
        emoji: '🎈',
      })
    }
  }

  // EE-6：连续打卡
  const streakDays = computeStreakDays(recentRecords)
  if (streakDays >= 30) {
    const key = `egg_streak_30_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'streak_30',
        priority: 90,
        variant: 'popup',
        title: '坚持30天！',
        subtitle: `连续记录30天，你的坚持是给${babyName}最好的礼物`,
        message: '连续打卡 30 天',
        storageKey: key,
        emoji: '🏆',
      })
    }
  } else if (streakDays >= 7) {
    const key = `egg_streak_7_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'streak_7',
        priority: 60,
        variant: 'toast',
        title: '连续打卡 7 天！',
        message: '你是最棒的爸/妈 💪',
        storageKey: key,
        emoji: '💪',
      })
    }
  }

  // EE-7：节日
  const holiday = isHolidayToday()
  if (holiday) {
    const year = new Date().getFullYear()
    const key = `egg_holiday_${holiday.id}_${year}_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'holiday',
        priority: 50,
        variant: 'banner',
        title: '',
        message: `${holiday.name}快乐 ${holiday.emoji}`,
        storageKey: key,
        emoji: holiday.emoji,
      })
    }
  }

  // EE-8：数据洞察
  const dateKey = todayKey()
  // 完美一天（最高优先级）
  if (
    todayStats.feeding.count >= 3 &&
    todayStats.sleep.count >= 2 &&
    todayStats.diaper.count >= 1
  ) {
    const key = `egg_insight_perfect_day_${dateKey}_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'insight_perfect_day',
        priority: 70,
        variant: 'toast',
        title: '完美的一天！',
        message: '今天所有类型都有记录 ⭐',
        storageKey: key,
        emoji: '⭐',
      })
    }
  } else if (todayStats.feeding.count >= 8) {
    // 喂养冠军
    const key = `egg_insight_feeding_champion_${dateKey}_${babyId}`
    if (!hasShown(key)) {
      results.push({
        type: 'insight_feeding_champion',
        priority: 65,
        variant: 'toast',
        title: '大胃王宝宝 🍼',
        message: `今天喂了 ${todayStats.feeding.count} 次，创下新纪录！`,
        storageKey: key,
        emoji: '🍼',
      })
    }
  } else if (
    // 睡神：检测今日单次最长睡眠 > 4 小时
    recentRecords.some(
      (r) =>
        r.recordType === 'sleep' &&
        new Date(r.startTime).toDateString() === new Date().toDateString() &&
        (r.sleepData?.duration ?? 0) > 4 * 3600,
    )
  ) {
    const key = `egg_insight_sleep_god_${dateKey}_${babyId}`
    if (!hasShown(key)) {
      const longest = recentRecords
        .filter((r) => r.recordType === 'sleep')
        .reduce((max, r) => Math.max(max, r.sleepData?.duration ?? 0), 0)
      const hours = Math.round(longest / 3600)
      results.push({
        type: 'insight_sleep_god',
        priority: 55,
        variant: 'toast',
        title: '睡神附体 💤',
        message: `这觉睡了 ${hours} 小时`,
        storageKey: key,
        emoji: '💤',
      })
    }
  }

  // 按 priority 降序
  results.sort((a, b) => b.priority - a.priority)
  return results
}

/** 写入 localStorage 标记，下次不再触发 */
export function markEggShown(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ shown: true, shownAt: Date.now() }))
  } catch {
    // storage full / disabled, accept
  }
}
