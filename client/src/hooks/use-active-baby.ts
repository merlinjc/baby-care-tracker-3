/**
 * useActiveBaby - 多宝快捷切换的 URL ↔ store 双向同步 hook（v7.2 T-S1-F6-01）
 *
 * 设计理念
 * --------
 * "选中哪个宝宝"在 v7.2 之前只持久化在 zustand baby-store（partialize 到 localStorage），
 * 跨设备 / 跨标签页 / 分享链接都无法复用同一胎。F6 引入"URL 优先"的轻量同步层：
 *
 *   URL ?babyId=xxx
 *        ↓ 命中
 *   zustand currentBabyId（已 persist）
 *        ↓ 命中
 *   babies[0]（家庭第一胎）
 *
 * 单一信号源仍然是 store；hook 只负责"读 URL 写 store"和"切换时写 URL"。
 *
 * 用法
 * ----
 * 1. 在 MainLayout 顶部挂一次：`useActiveBaby()` —— 子页面只需 `useBabyStore(s => s.currentBaby)`
 * 2. 用户操作 BabySwitcher 时调 `switchBaby(id)`，hook 帮你同时改 store + URL + invalidate React Query
 *
 * 关键约束
 * --------
 * - URL 中的 babyId 不存在于 babies 列表时，**清掉 URL 不报错**（优雅降级）
 * - URL ↔ store 同步用 `replaceState`（router 的 `{ replace: true }`），不污染 history
 * - 同步只单向：URL → store（用户切换时 store → URL 由 switchBaby 显式触发）
 *
 * 关联：T-S1-F6-02 把 BabySwitcher / SidebarBabyCard 切到本 hook 的 switchBaby
 */
import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useBabyStore } from '@/stores/baby-store'
import type { Baby } from '@/types'

/**
 * 纯函数：根据 URL / store / babies 解析"应该选中哪个宝宝"。
 *
 * 抽出来便于在不依赖 react-router / DOM 的环境单测（即使 client 端尚未引入 vitest，
 * 服务端 vitest 与未来引入的 client vitest 都能直接复用本函数）。
 *
 * @returns
 *   - id：最终生效的 babyId（null 表示无可选宝宝）
 *   - shouldClearUrl：URL 上的 babyId 非法（不在 babies 中），上层应该清 URL
 *   - source：调试 / 文档用，标记命中的优先级层级
 */
export type ActiveBabySource = 'url' | 'store' | 'first' | 'none'

export interface ResolveActiveBabyResult {
  id: string | null
  shouldClearUrl: boolean
  source: ActiveBabySource
}

export function resolveActiveBabyId(
  urlBabyId: string | null | undefined,
  babies: ReadonlyArray<Pick<Baby, 'id'>>,
  currentBabyId: string | null | undefined,
): ResolveActiveBabyResult {
  // 1. URL 优先
  if (urlBabyId) {
    const exists = babies.some((b) => b.id === urlBabyId)
    if (exists) {
      return { id: urlBabyId, shouldClearUrl: false, source: 'url' }
    }
    // URL 里的 babyId 不存在 → 走兜底，但要清 URL
    if (currentBabyId && babies.some((b) => b.id === currentBabyId)) {
      return { id: currentBabyId, shouldClearUrl: true, source: 'store' }
    }
    if (babies.length > 0) {
      return { id: babies[0].id, shouldClearUrl: true, source: 'first' }
    }
    return { id: null, shouldClearUrl: true, source: 'none' }
  }

  // 2. store
  if (currentBabyId && babies.some((b) => b.id === currentBabyId)) {
    return { id: currentBabyId, shouldClearUrl: false, source: 'store' }
  }

  // 3. 兜底
  if (babies.length > 0) {
    return { id: babies[0].id, shouldClearUrl: false, source: 'first' }
  }
  return { id: null, shouldClearUrl: false, source: 'none' }
}

/**
 * useActiveBaby —— 在 MainLayout 顶部挂一次。
 *
 * 返回：
 *   - currentBaby / babies：透传 store
 *   - switchBaby(id)：用户切换宝宝时调，会同步 store + URL + invalidate React Query
 *
 * 不返回 isLoading：babies 为空数组时不会做任何动作，调用方按需观察 store.isLoading。
 */
export function useActiveBaby() {
  const [search, setSearch] = useSearchParams()
  const babies = useBabyStore((s) => s.babies)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const currentBabyId = useBabyStore((s) => s.currentBabyId)
  const selectBaby = useBabyStore((s) => s.selectBaby)
  const queryClient = useQueryClient()

  const urlBabyId = search.get('babyId')

  // URL → store 同步（babies 加载完成才动作，避免 babies 还是空数组就清 URL）
  useEffect(() => {
    if (babies.length === 0) return
    const { id, shouldClearUrl } = resolveActiveBabyId(urlBabyId, babies, currentBabyId)
    // 只有当解析结果与 store 不一致时才 selectBaby，避免无谓重渲染
    if (id && id !== currentBabyId) {
      selectBaby(id)
    }
    if (shouldClearUrl) {
      setSearch(
        (prev) => {
          prev.delete('babyId')
          return prev
        },
        { replace: true },
      )
    }
    // urlBabyId / babies / currentBabyId 任一变化都重新解析；setSearch / selectBaby 引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBabyId, babies, currentBabyId])

  // 用户主动切换：store → URL（replace 不污染 history）+ invalidate 关键查询
  const switchBaby = useCallback(
    (id: string) => {
      if (!id || id === currentBabyId) return
      selectBaby(id)
      queryClient.invalidateQueries({ queryKey: ['todayStats', id] })
      queryClient.invalidateQueries({ queryKey: ['records', id] })
      queryClient.invalidateQueries({ queryKey: ['activeSleep', id] })
      setSearch(
        (prev) => {
          prev.set('babyId', id)
          return prev
        },
        { replace: true },
      )
    },
    [currentBabyId, selectBaby, queryClient, setSearch],
  )

  return { currentBaby, babies, switchBaby }
}
