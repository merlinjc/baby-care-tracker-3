/**
 * useDailyCheckins - 每日打卡 React Query hooks（v7.2 T-S2-F11-FE-01）
 *
 * 设计：
 * - useDailyCheckins({ babyId, year, month })：按月查询；queryKey 含 year/month 便于切月
 * - useDailyCheckin({ babyId, date })：单日；命中 useDailyCheckins 已有数据时复用 placeholderData
 * - useCreateCheckin / useUpdateCheckin / useDeleteCheckin / useGenerateAiSummary
 * - 所有 mutation 成功后 invalidate ['daily-checkins', babyId] 及 ['daily-checkin', babyId, date]
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dailyCheckinService } from '@/services/daily-checkin'
import { getMonthRange } from '@/lib/daily-checkin-date'
import type {
  DailyCheckin,
  DailyCheckinCreateInput,
  DailyCheckinPatchInput,
  CareRole,
} from '@/types'

const monthKey = (babyId: string | undefined, year?: number, month?: number) =>
  ['daily-checkins', babyId, 'month', year, month] as const

const dateKey = (babyId: string | undefined, date: string) =>
  ['daily-checkin', babyId, date] as const

interface UseDailyCheckinsParams {
  babyId: string | undefined
  year: number
  month: number // 1-12
}

export function useDailyCheckins({ babyId, year, month }: UseDailyCheckinsParams) {
  return useQuery({
    queryKey: monthKey(babyId, year, month),
    enabled: Boolean(babyId),
    staleTime: 60_000,
    queryFn: async () => {
      const { startDate, endDate } = getMonthRange(year, month)
      return dailyCheckinService.list(babyId!, { startDate, endDate })
    },
  })
}

export function useDailyCheckin(babyId: string | undefined, date: string | undefined) {
  return useQuery<DailyCheckin | null>({
    queryKey: dateKey(babyId, date ?? ''),
    enabled: Boolean(babyId && date),
    staleTime: 60_000,
    queryFn: () => dailyCheckinService.getByDate(babyId!, date!),
  })
}

export function useCreateCheckin(babyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DailyCheckinCreateInput) => {
      if (!babyId) throw new Error('babyId 为空')
      return dailyCheckinService.create(babyId, payload)
    },
    onSuccess: (created) => {
      // 同时刷新月查询和单日查询
      qc.invalidateQueries({ queryKey: ['daily-checkins', babyId] })
      qc.setQueryData(dateKey(babyId, created.checkinDate), created)
    },
  })
}

export function useUpdateCheckin(babyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      date,
      patch,
    }: {
      date: string
      patch: DailyCheckinPatchInput
    }) => {
      if (!babyId) throw new Error('babyId 为空')
      return dailyCheckinService.update(babyId, date, patch)
    },
    onSuccess: (updated, { date }) => {
      qc.invalidateQueries({ queryKey: ['daily-checkins', babyId] })
      qc.setQueryData(dateKey(babyId, date), updated)
    },
  })
}

export function useDeleteCheckin(babyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => {
      if (!babyId) throw new Error('babyId 为空')
      return dailyCheckinService.remove(babyId, date)
    },
    onSuccess: (_data, date) => {
      qc.invalidateQueries({ queryKey: ['daily-checkins', babyId] })
      qc.setQueryData(dateKey(babyId, date), null)
    },
  })
}

export function useGenerateAiSummary(babyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, role }: { date: string; role?: CareRole }) => {
      if (!babyId) throw new Error('babyId 为空')
      return dailyCheckinService.generateAiSummary(babyId, date, role)
    },
    onSuccess: (updated, { date }) => {
      qc.invalidateQueries({ queryKey: ['daily-checkins', babyId] })
      qc.setQueryData(dateKey(babyId, date), updated)
    },
  })
}
