/**
 * useJaundice - 黄疸记录 React Query hooks（v7.2 T-S1-F2-03）
 *
 * 设计要点：
 * - 单一 query key：['jaundice', babyId]，所有 mutate 完成后 invalidate 该 key
 * - 列表数据形态保持 client lib/jaundice 的 JaundiceRecord（UI 不动）
 * - mutation onError 不在 hook 层 toast；UI 端按需处理（与 milestone 风格一致）
 *
 * 用法：
 *   const { data: records = [], isLoading } = useJaundiceRecords(babyId)
 *   const create = useCreateJaundice(babyId)
 *   await create.mutateAsync(input)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jaundiceService, type ListJaundiceParams } from '@/services/jaundice'
import type { JaundiceRecord } from '@/lib/jaundice'

const baseKey = (babyId: string | undefined) => ['jaundice', babyId] as const

export function useJaundiceRecords(
  babyId: string | undefined,
  params?: ListJaundiceParams,
) {
  return useQuery<JaundiceRecord[]>({
    queryKey: [...baseKey(babyId), params ?? null],
    queryFn: () => jaundiceService.list(babyId!, params),
    enabled: Boolean(babyId),
    staleTime: 30_000,
  })
}

export function useCreateJaundice(babyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof jaundiceService.create>[1]) => {
      if (!babyId) throw new Error('babyId 为空')
      return jaundiceService.create(babyId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(babyId) })
    },
  })
}

export function useUpdateJaundice(babyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      patch,
    }: {
      recordId: string
      patch: Parameters<typeof jaundiceService.update>[2]
    }) => {
      if (!babyId) throw new Error('babyId 为空')
      return jaundiceService.update(babyId, recordId, patch)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(babyId) })
    },
  })
}

export function useDeleteJaundice(babyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => {
      if (!babyId) throw new Error('babyId 为空')
      return jaundiceService.remove(babyId, recordId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(babyId) })
    },
  })
}
