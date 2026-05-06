/**
 * useActiveSleep - 进行中睡眠的 React Query 包装（FR-A1）
 *
 * 设计要点（design.md §2.3.1，跨设备一致性）：
 * - 进行中的睡眠存储为 endTime=null 的 Record（云端唯一来源）
 * - hook 暴露 start / end / cancel 三个动作，全部经 PermissionGuard 双层防护
 * - React Query staleTime=30s，避免频繁查询
 * - 写动作完成后失效相关 query（todayStats、records）
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CareRecord, SleepData } from '@/types'
import { recordService } from '@/services/record'
import { permissionGuard } from '@/lib/permission-guard'
import { Permission } from '@/types'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'

const STALE_TIME_MS = 30 * 1000

export function useActiveSleep(babyId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: activeSleep, isLoading } = useQuery({
    queryKey: ['activeSleep', babyId],
    queryFn: async (): Promise<CareRecord | null> => {
      if (!babyId) return null
      return recordService.getActiveSleep(babyId)
    },
    enabled: !!babyId,
    staleTime: STALE_TIME_MS,
  })

  const start = useCallback(
    async (sleepType: 'night' | 'nap' = 'nap') => {
      if (!babyId) return null
      // FR-C6 hook 层防护：确保 viewer 角色无法绕过 UI 启动计时
      permissionGuard.require(Permission.RECORD_CREATE)

      try {
        const record = await recordService.createRecord({
          babyId,
          recordType: 'sleep',
          startTime: new Date().toISOString(),
          sleepData: { sleepType, duration: 0 } as Partial<SleepData> as Record<string, unknown>,
        })
        queryClient.setQueryData(['activeSleep', babyId], record)
        return record
      } catch (err) {
        const e = err as ApiError
        if (e.code === 'SLEEP_ALREADY_ACTIVE') {
          // 服务端兜底：另一个设备/标签页已开始计时，触发本地刷新
          await queryClient.invalidateQueries({ queryKey: ['activeSleep', babyId] })
          toast.warning(e.message)
          return null
        }
        throw err
      }
    },
    [babyId, queryClient],
  )

  const end = useCallback(async () => {
    if (!activeSleep || !babyId) return null
    permissionGuard.require(Permission.RECORD_UPDATE_OWN)

    const startTs = new Date(activeSleep.startTime).getTime()
    const duration = Math.max(0, Math.round((Date.now() - startTs) / 1000))
    const updated = await recordService.updateRecord(activeSleep.id, {
      endTime: new Date().toISOString(),
      sleepData: {
        ...((activeSleep.sleepData ?? { sleepType: 'nap' }) as SleepData),
        duration,
      } as SleepData,
    })
    queryClient.setQueryData(['activeSleep', babyId], null)
    queryClient.invalidateQueries({ queryKey: ['todayStats', babyId] })
    queryClient.invalidateQueries({ queryKey: ['records', babyId] })
    return updated
  }, [activeSleep, babyId, queryClient])

  const cancel = useCallback(async () => {
    if (!activeSleep || !babyId) return
    // 删除自己创建的记录走 RECORD_DELETE_OWN（admin 兜底通过 requireCanDelete）
    permissionGuard.requireCanDelete({ createdBy: activeSleep.createdBy })
    await recordService.deleteRecord(activeSleep.id)
    queryClient.setQueryData(['activeSleep', babyId], null)
  }, [activeSleep, babyId, queryClient])

  return { activeSleep: activeSleep ?? null, isLoading, start, end, cancel }
}
