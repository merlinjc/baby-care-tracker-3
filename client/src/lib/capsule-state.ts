/**
 * 状态胶囊状态机（FR-A1）
 *
 * 4 种态决策树：
 *   1. activeSleep 存在 + 已计时 > 24h → sleep_abnormal
 *   2. activeSleep 存在                → sleeping
 *   3. stats.feeding.lastTimeTs 存在  → feeding_ago
 *   4. 否则                            → none（"今天还没有记录..."）
 */
import type { CareRecord, TodayStats } from '@/types'

export type CapsuleState = 'none' | 'sleeping' | 'feeding_ago' | 'sleep_abnormal'

const ABNORMAL_THRESHOLD_MS = 24 * 60 * 60 * 1000

export function computeCapsuleState(
  stats: TodayStats | null,
  activeSleep: CareRecord | null,
): CapsuleState {
  if (activeSleep) {
    const startTs = new Date(activeSleep.startTime).getTime()
    if (Date.now() - startTs > ABNORMAL_THRESHOLD_MS) return 'sleep_abnormal'
    return 'sleeping'
  }
  if (stats?.feeding.lastTimeTs) return 'feeding_ago'
  return 'none'
}

/** 格式化时长：秒数 → "Xh Ym" 或 "Xm" */
export function formatDurationFromMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function buildCapsuleText(
  state: CapsuleState,
  stats: TodayStats | null,
  activeSleep: CareRecord | null,
  babyName?: string,
): string {
  switch (state) {
    case 'sleeping': {
      if (!activeSleep) return '正在睡觉'
      const startTs = new Date(activeSleep.startTime).getTime()
      return `正在睡觉 · 已 ${formatDurationFromMs(Date.now() - startTs)}`
    }
    case 'sleep_abnormal':
      return '睡眠时间异常，已超过 24 小时'
    case 'feeding_ago': {
      if (!stats?.feeding.lastTimeTs) return ''
      return `上次喂养 ${formatDurationFromMs(Date.now() - stats.feeding.lastTimeTs)} 前`
    }
    case 'none':
    default:
      return babyName
        ? `${babyName} 今天还没有记录，点下方按钮添加`
        : '今天还没有记录，点下方按钮添加'
  }
}
