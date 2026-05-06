/**
 * 月龄目标计算（FR-A3）
 *
 * 推荐睡眠时长（NSF 标准简化）：
 * - 0-3 月：14h
 * - 4-11 月：13h
 * - 12 月+：12h
 *
 * 喂养目标：8 次/日（默认值，与小程序保持一致）
 * 排便目标：6 次/日
 */
export interface DailyGoals {
  feeding: number
  /** 单位：秒 */
  sleep: number
  diaper: number
}

export function computeAgeMonths(birthDateIso: string): number {
  const birth = new Date(birthDateIso)
  const now = new Date()
  return Math.floor((now.getTime() - birth.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
}

export function computeDailyGoals(birthDateIso?: string): DailyGoals {
  const ageMonths = birthDateIso ? computeAgeMonths(birthDateIso) : 6
  let sleepHours = 12
  if (ageMonths <= 3) sleepHours = 14
  else if (ageMonths <= 11) sleepHours = 13

  return {
    feeding: 8,
    sleep: sleepHours * 3600,
    diaper: 6,
  }
}
