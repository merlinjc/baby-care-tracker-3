/**
 * useReportData - 成长报告页的数据聚合 Hook
 *
 * 不新增后端接口，基于现有端点组合：
 * - /records?startDate&endDate           → 本期所有记录，用于聚合关键指标 / 每日节律 / 生长变化
 * - /babies/:id/vaccines                 → 本期已接种的疫苗
 * - /babies/:id/milestones               → 本期达成的里程碑
 * - /babies/:id/trend/weekly             → 仅周报模式用，复用上周 vs 本周卡
 *
 * 时间窗：
 * - period='week'  本周一 00:00 → 今天 23:59:59（与后端 trend.service 口径一致）
 * - period='month' 本月 1 号 00:00 → 今天 23:59:59
 *
 * 设计决策：不引入 zustand，每类数据独立 useQuery，方便局部 loading/error。
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recordService } from '@/services/record'
import { vaccineService, milestoneService } from '@/services/baby-extra'
import { useWeeklyTrend } from '@/hooks/use-weekly-trend'
import type {
  CareRecord,
  VaccineRecord,
  MilestoneRecord,
  WeeklyTrendData,
  FeedingData,
  SleepData,
  DiaperData,
  TemperatureData,
  GrowthData,
} from '@/types'

export type ReportPeriod = 'week' | 'month'

export interface ReportPeriodRange {
  start: Date
  end: Date
  /** 实际覆盖的天数（至少 1），用于算日均 */
  days: number
  /** 可读文案，如 "5.1 – 5.7" */
  label: string
}

export interface ReportMetrics {
  feeding: { count: number; totalAmount: number }
  sleep: { count: number; totalDurationSec: number }
  diaper: { count: number; peeCount: number; poopCount: number }
  temperature: { count: number; abnormalCount: number }
}

export interface DailyBucket {
  /** YYYY-MM-DD（本地时区） */
  date: string
  /** 月/日 展示 */
  label: string
  feedingCount: number
  sleepHours: number
  diaperCount: number
}

export interface GrowthSnapshot {
  weightKg: number | null
  heightCm: number | null
  headCircumferenceCm: number | null
  measuredAt: string | null
}

export interface ReportData {
  period: ReportPeriod
  range: ReportPeriodRange
  metrics: ReportMetrics
  daily: DailyBucket[]
  /** 本期新达成的里程碑（按达成日期） */
  milestones: MilestoneRecord[]
  /** 本期已接种的疫苗 */
  vaccines: VaccineRecord[]
  /** 期初与期末的最新 growth 快照（可能为 null） */
  growth: {
    start: GrowthSnapshot | null
    end: GrowthSnapshot | null
  }
  /** 周报模式下的上周 vs 本周对比（月报为 null） */
  weeklyTrend: WeeklyTrendData | null
  isLoading: boolean
}

/** 计算当前周期的起止 */
export function computeReportRange(
  period: ReportPeriod,
  babyBirthDateIso?: string,
): ReportPeriodRange {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  let start: Date
  if (period === 'week') {
    // 本周一 00:00（getDay 0=周日，转为 1..7）
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    start = new Date(now)
    start.setDate(now.getDate() - (dayOfWeek - 1))
    start.setHours(0, 0, 0, 0)
  } else {
    // 本月 1 号 00:00
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }

  // 受 birthDate 限制
  if (babyBirthDateIso) {
    const birth = new Date(babyBirthDateIso)
    birth.setHours(0, 0, 0, 0)
    if (birth > start) start = birth
  }

  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  )

  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`
  return { start, end, days, label: `${fmt(start)} – ${fmt(end)}` }
}

/** 把本地 Date 转为 YYYY-MM-DD（不走 UTC） */
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 聚合 records 为各项指标与每日桶 */
function aggregateRecords(records: CareRecord[], range: ReportPeriodRange): {
  metrics: ReportMetrics
  daily: DailyBucket[]
  growthSnapshots: { start: GrowthSnapshot | null; end: GrowthSnapshot | null }
} {
  const metrics: ReportMetrics = {
    feeding: { count: 0, totalAmount: 0 },
    sleep: { count: 0, totalDurationSec: 0 },
    diaper: { count: 0, peeCount: 0, poopCount: 0 },
    temperature: { count: 0, abnormalCount: 0 },
  }

  // 初始化每日桶（保证空日也出现在图上）
  const bucketMap = new Map<string, DailyBucket>()
  const dayCursor = new Date(range.start)
  while (dayCursor <= range.end) {
    const key = toLocalDateKey(dayCursor)
    bucketMap.set(key, {
      date: key,
      label: `${dayCursor.getMonth() + 1}/${dayCursor.getDate()}`,
      feedingCount: 0,
      sleepHours: 0,
      diaperCount: 0,
    })
    dayCursor.setDate(dayCursor.getDate() + 1)
  }

  const growthRecordsSorted = [...records]
    .filter((r) => r.recordType === 'growth' && r.growthData)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  for (const r of records) {
    const key = toLocalDateKey(new Date(r.startTime))
    const bucket = bucketMap.get(key)

    switch (r.recordType) {
      case 'feeding': {
        metrics.feeding.count += 1
        const d = r.feedingData as FeedingData | undefined
        if (d?.amount && d.amount > 0) metrics.feeding.totalAmount += d.amount
        if (bucket) bucket.feedingCount += 1
        break
      }
      case 'sleep': {
        metrics.sleep.count += 1
        const d = r.sleepData as SleepData | undefined
        const dur = d?.duration ?? 0
        metrics.sleep.totalDurationSec += dur
        if (bucket) bucket.sleepHours += dur / 3600
        break
      }
      case 'diaper': {
        metrics.diaper.count += 1
        const d = r.diaperData as DiaperData | undefined
        if (d?.diaperType === 'pee') metrics.diaper.peeCount += 1
        else if (d?.diaperType === 'poop') metrics.diaper.poopCount += 1
        else if (d?.diaperType === 'both') {
          metrics.diaper.peeCount += 1
          metrics.diaper.poopCount += 1
        }
        if (bucket) bucket.diaperCount += 1
        break
      }
      case 'temperature': {
        metrics.temperature.count += 1
        const d = r.temperatureData as TemperatureData | undefined
        if (d && d.temperature >= 37.5) metrics.temperature.abnormalCount += 1
        break
      }
      default:
        break
    }
  }

  // sleepHours 保留一位小数
  const daily = Array.from(bucketMap.values()).map((b) => ({
    ...b,
    sleepHours: Math.round(b.sleepHours * 10) / 10,
  }))

  const toSnapshot = (rec?: CareRecord): GrowthSnapshot | null => {
    if (!rec || !rec.growthData) return null
    const d = rec.growthData as GrowthData
    return {
      weightKg: d.weight ?? null,
      heightCm: d.height ?? null,
      headCircumferenceCm: d.headCircumference ?? null,
      measuredAt: rec.startTime,
    }
  }

  const growthSnapshots = {
    start: toSnapshot(growthRecordsSorted[0]),
    end: toSnapshot(growthRecordsSorted[growthRecordsSorted.length - 1]),
  }

  return { metrics, daily, growthSnapshots }
}

/** 在 JS 中按 date 字段过滤属于本期的成就 */
function filterByDate<T extends { vaccinatedDate?: string; achievedDate?: string }>(
  items: T[],
  dateKey: 'vaccinatedDate' | 'achievedDate',
  range: ReportPeriodRange,
): T[] {
  return items.filter((it) => {
    const raw = it[dateKey]
    if (!raw) return false
    const t = new Date(raw).getTime()
    return t >= range.start.getTime() && t <= range.end.getTime()
  })
}

export function useReportData(
  babyId: string | undefined,
  period: ReportPeriod,
  babyBirthDateIso?: string,
): ReportData {
  const range = useMemo(
    () => computeReportRange(period, babyBirthDateIso),
    [period, babyBirthDateIso],
  )

  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  // 记录列表：循环分页直到 hasMore=false（后端 pageSize 上限 100）。
  // 周报 ≤ 7 天、月报 ≤ 31 天，实际一般 1-2 页；保留硬上限防失控。
  const recordsQuery = useQuery({
    queryKey: ['report', 'records', babyId, period, startIso, endIso],
    queryFn: async () => {
      if (!babyId) return [] as CareRecord[]
      const all: CareRecord[] = []
      const PAGE_SIZE = 100
      const MAX_PAGES = 20 // 兜底：最多 2000 条
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await recordService.getRecords({
          babyId,
          startDate: startIso,
          endDate: endIso,
          page,
          pageSize: PAGE_SIZE,
        })
        all.push(...res.items)
        if (!res.hasMore) break
      }
      return all
    },
    enabled: !!babyId,
    staleTime: 60 * 1000,
  })

  // 疫苗 / 里程碑：后端无 startDate 参数，列出后前端按日期过滤。
  // 正常项目里数量不大，循环分页也只有 1-2 页。
  const vaccinesQuery = useQuery({
    queryKey: ['report', 'vaccines', babyId],
    queryFn: async () => {
      if (!babyId) return [] as VaccineRecord[]
      const all: VaccineRecord[] = []
      const PAGE_SIZE = 100
      const MAX_PAGES = 10
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await vaccineService.list(babyId, { page, pageSize: PAGE_SIZE })
        all.push(...res.items)
        if (!res.hasMore) break
      }
      return all
    },
    enabled: !!babyId,
    staleTime: 60 * 1000,
  })

  const milestonesQuery = useQuery({
    queryKey: ['report', 'milestones', babyId],
    queryFn: async () => {
      if (!babyId) return [] as MilestoneRecord[]
      const all: MilestoneRecord[] = []
      const PAGE_SIZE = 100
      const MAX_PAGES = 10
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await milestoneService.list(babyId, { page, pageSize: PAGE_SIZE })
        all.push(...res.items)
        if (!res.hasMore) break
      }
      return all
    },
    enabled: !!babyId,
    staleTime: 60 * 1000,
  })

  // 仅周报模式复用上周 vs 本周
  const weeklyTrendQuery = useWeeklyTrend(period === 'week' ? babyId : undefined)

  const aggregated = useMemo(() => {
    const records = recordsQuery.data ?? []
    return aggregateRecords(records, range)
  }, [recordsQuery.data, range])

  const milestones = useMemo(
    () => filterByDate(milestonesQuery.data ?? [], 'achievedDate', range),
    [milestonesQuery.data, range],
  )

  const vaccines = useMemo(
    () => filterByDate(vaccinesQuery.data ?? [], 'vaccinatedDate', range),
    [vaccinesQuery.data, range],
  )

  const isLoading =
    recordsQuery.isLoading ||
    vaccinesQuery.isLoading ||
    milestonesQuery.isLoading ||
    (period === 'week' && weeklyTrendQuery.isLoading)

  return {
    period,
    range,
    metrics: aggregated.metrics,
    daily: aggregated.daily,
    growth: aggregated.growthSnapshots,
    milestones,
    vaccines,
    weeklyTrend: period === 'week' ? weeklyTrendQuery.data ?? null : null,
    isLoading,
  }
}
