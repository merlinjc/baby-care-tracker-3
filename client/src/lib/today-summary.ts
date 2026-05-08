/**
 * buildTodaySummaryText - 记录页副标题构建（FR-D1.AC2）
 *
 * 格式（精确按 requirements §2.4 + design §5.1.buildTodaySummaryText）：
 * - 主结构：`今日 {总数} 条 · {分项序列}`
 * - 分项顺序固定：feeding → sleep → diaper → temperature
 * - 仅渲染 count > 0（temperature 改为 latestValue !== null）的分项
 * - 分项之间使用 2 个全角空格分隔；总数与分项之间使用 半角 + · + 半角
 *
 * 例：`今日 5 条 · 喂养 3{U+3000}{U+3000}睡眠 4h20m{U+3000}{U+3000}排便 2`（{U+3000}=全角空格；无体温记录时省略体温）
 */
import type { CareRecord } from '@/types'

export interface SubtitleContext {
  /** 当前筛选范围是否包含今日 */
  rangeIncludesToday: boolean
  /** 今日记录列表（已过滤） */
  todayRecords: CareRecord[]
  /** 用于体温显示：取最新一条的温度值 */
  latestTemperature?: number | null
}

const SEPARATOR = '\u3000\u3000' // 2 个全角空格
const PRIMARY_SEPARATOR = ' · '

export function buildTodaySummaryText(ctx: SubtitleContext): string {
  if (!ctx.rangeIncludesToday) {
    return '宝宝的日常养护记录'
  }

  const total = ctx.todayRecords.length
  if (total === 0) {
    return '尚未添加今日记录'
  }

  const counts = {
    feeding: 0,
    sleep: 0,
    diaper: 0,
    temperature: 0,
  }
  let sleepDurationSec = 0

  for (const r of ctx.todayRecords) {
    switch (r.recordType) {
      case 'feeding':
        counts.feeding++
        break
      case 'sleep':
        counts.sleep++
        sleepDurationSec += r.sleepData?.duration ?? 0
        break
      case 'diaper':
        counts.diaper++
        break
      case 'temperature':
        counts.temperature++
        break
    }
  }

  const parts: string[] = []
  if (counts.feeding > 0) parts.push(`喂养 ${counts.feeding}`)
  if (counts.sleep > 0) {
    parts.push(`睡眠 ${formatSleepDuration(sleepDurationSec, counts.sleep)}`)
  }
  if (counts.diaper > 0) parts.push(`排便 ${counts.diaper}`)
  if (ctx.latestTemperature != null) parts.push(`体温 ${ctx.latestTemperature}°C`)

  if (parts.length === 0) {
    return `今日 ${total} 条`
  }

  return `今日 ${total} 条${PRIMARY_SEPARATOR}${parts.join(SEPARATOR)}`
}

function formatSleepDuration(totalSec: number, count: number): string {
  if (totalSec <= 0) return `${count} 次`
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}
