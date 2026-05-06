/**
 * useWeeklyTrend - 本周趋势 React Query 包装（FR-B）
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { WeeklyTrendData } from '@/types'

export function useWeeklyTrend(babyId: string | undefined) {
  return useQuery({
    queryKey: ['weeklyTrend', babyId],
    queryFn: async (): Promise<WeeklyTrendData | null> => {
      if (!babyId) return null
      const res = await api.get(`/babies/${babyId}/trend/weekly`)
      return (res.data?.data?.trend as WeeklyTrendData) ?? null
    },
    enabled: !!babyId,
    staleTime: 60 * 1000,
  })
}
