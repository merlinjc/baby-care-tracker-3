/**
 * OnboardingHost - 引导触发与状态管理（v7.2 T-S1-F1-02）
 *
 * 职责
 * ----
 * - 在 MainLayout 内挂载一次，决定是否打开 Overlay、当前到哪一步、各步骤状态如何持久化
 * - 引导状态唯一来源：`user.preferences.onboardingCompleted` /
 *   `onboardingSkippedSteps`（详见 INF-01 / shared/types UserPreferences）
 * - localStorage 不另存任何引导状态，跨设备直接从 server 同步
 *
 * 触发条件
 * --------
 * 同时满足以下两点 Overlay 才打开：
 * 1. URL `?onboarding=1` 强制触发，OR `user.preferences?.onboardingCompleted` 为
 *    `false / undefined / null`
 * 2. 至少有一个未满足的步骤（findFirstPendingStep 返回 ≥ 0）
 *
 * 全部步骤已满足时直接 PATCH onboardingCompleted = true，不弹 Overlay。
 *
 * StrictMode / 多 tab 防御
 * -----------------------
 * - useRef `firedThisSession`：本次 React 会话内只决策一次开关，避免 StrictMode 双触发
 * - 用户主动跳过 / 完成后立刻设置 firedThisSession = true，即使后续 user 状态变化
 *   也不会再打开
 *
 * 错误处理
 * --------
 * `updatePreferences` 失败时仅打 console.warn + toast 提示一次，不阻塞主流程；
 * 下次启动会再次进入决策（直到一次成功为止）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { recordApi } from '@/services/record'
import { toast } from '@/components/ui/toast'
import {
  ONBOARDING_STEPS,
  findFirstPendingStep,
  type OnboardingContext,
} from '@/lib/onboarding-steps'
import { OnboardingOverlay } from './onboarding-overlay'

export function OnboardingHost() {
  const { t } = useTranslation('onboarding')
  const user = useAuthStore((s) => s.user)
  const updatePreferences = useAuthStore((s) => s.updatePreferences)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const babies = useBabyStore((s) => s.babies)
  const family = useFamilyStore((s) => s.family)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // 强制触发：URL ?onboarding=1
  const forceOpen = searchParams.get('onboarding') === '1'

  // 是否已经"完成"（来自 server preferences）
  const completedOnServer = Boolean(user?.preferences?.onboardingCompleted)

  // 上次跳过列表（跨会话保留）
  const skipped = useMemo<string[]>(
    () => user?.preferences?.onboardingSkippedSteps ?? [],
    [user?.preferences?.onboardingSkippedSteps],
  )

  /**
   * hasAnyRecord 判断：分页查 1 条即可，开销极小。
   *
   * 仅在 isAuthenticated && currentBaby 存在时才查；查询结果走 React Query 缓存
   * 30s，避免快速进入 / 离开 layout 重复打。
   *
   * 注意：用首胎判断；多胎家庭只要有 1 胎记过任意一条都视为"已记录"，对引导而言
   * 这个粒度足够。
   */
  const firstBabyId = babies[0]?.id
  const { data: anyRecordCount } = useQuery({
    queryKey: ['onboarding-any-record', firstBabyId],
    queryFn: async () => {
      if (!firstBabyId) return 0
      const res = await recordApi.getRecords({
        babyId: firstBabyId,
        page: 1,
        pageSize: 1,
      })
      return res?.total ?? (res?.items?.length ?? 0)
    },
    enabled: Boolean(isAuthenticated && firstBabyId),
    staleTime: 30_000,
  })

  const ctx: OnboardingContext = useMemo(
    () => ({
      babiesCount: babies.length,
      familyMemberCount: family?.members?.length ?? 1,
      hasAnyRecord: (anyRecordCount ?? 0) > 0,
    }),
    [babies.length, family?.members?.length, anyRecordCount],
  )

  // —— 触发决策 —— //
  const firedThisSession = useRef(false)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!isAuthenticated || !user) return
    if (firedThisSession.current && !forceOpen) return
    if (completedOnServer && !forceOpen) {
      firedThisSession.current = true
      return
    }

    const next = findFirstPendingStep(ctx, skipped)
    if (next === -1) {
      // 全部步骤都已满足 → 静默 PATCH 标记完成（避免老用户每次启动都决策）
      firedThisSession.current = true
      if (!completedOnServer) {
        updatePreferences({ onboardingCompleted: true }).catch((err) => {
          console.warn('[OnboardingHost] mark completed failed', err)
        })
      }
      return
    }

    firedThisSession.current = true
    setStepIndex(next)
    setOpen(true)
    // ctx / skipped / completedOnServer 变化均重新决策；forceOpen 变化也需重新评估
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, completedOnServer, ctx, skipped, forceOpen])

  /** 清掉 URL 上的 ?onboarding=1（避免刷新重复弹） */
  const clearForceParam = useCallback(() => {
    if (forceOpen) {
      setSearchParams(
        (prev) => {
          prev.delete('onboarding')
          return prev
        },
        { replace: true },
      )
    }
  }, [forceOpen, setSearchParams])

  /** 标记整个流程完成（成功 / 跳过全部都用此） */
  const markCompleted = useCallback(
    async (extraSkipped?: string[]) => {
      const merged = extraSkipped
        ? Array.from(new Set([...skipped, ...extraSkipped]))
        : skipped
      try {
        await updatePreferences({
          onboardingCompleted: true,
          onboardingSkippedSteps: merged,
        })
      } catch (err) {
        console.warn('[OnboardingHost] mark completed failed', err)
        toast.error(t('errors.save_failed'))
      }
    },
    [skipped, updatePreferences, t],
  )

  /** 仅追加单步到 skipped（不结束整个流程） */
  const recordSkippedStep = useCallback(
    async (id: string) => {
      const next = Array.from(new Set([...skipped, id]))
      try {
        await updatePreferences({ onboardingSkippedSteps: next })
      } catch (err) {
        console.warn('[OnboardingHost] record skipped failed', err)
      }
    },
    [skipped, updatePreferences],
  )

  // —— 用户行为 —— //

  const handleNext = () => {
    // 找下一个未满足且未跳过的步骤
    const remaining = ONBOARDING_STEPS.findIndex((step, i) => {
      if (i <= stepIndex) return false
      if (skipped.includes(step.id)) return false
      if (step.isAlreadySatisfied?.(ctx)) return false
      return true
    })
    if (remaining === -1) {
      setOpen(false)
      clearForceParam()
      void markCompleted()
      return
    }
    setStepIndex(remaining)
  }

  const handleSkipStep = async () => {
    const cur = ONBOARDING_STEPS[stepIndex]
    await recordSkippedStep(cur.id)
    handleNext()
  }

  const handleGo = (path?: string) => {
    setOpen(false)
    clearForceParam()
    // 「去试试」视为该步骤的目标行为已被触发；标记完成（后续步骤如已满足由
    // findFirstPendingStep 判定，下次启动若仍有 pending 步骤会自动续上）。
    // 简化处理：所有用户在 onboarding 流程中点 go 即视为整体完成，不再重复弹。
    void markCompleted()
    if (path) navigate(path)
  }

  const handleSkipAll = () => {
    setOpen(false)
    clearForceParam()
    void markCompleted()
  }

  const handleComplete = () => {
    setOpen(false)
    clearForceParam()
    void markCompleted()
  }

  // 渲染：仅在确实需要时挂 Overlay，避免无谓 portal
  if (!open) return null

  return (
    <OnboardingOverlay
      open={open}
      stepIndex={stepIndex}
      total={ONBOARDING_STEPS.length}
      step={ONBOARDING_STEPS[stepIndex]}
      onNext={handleNext}
      onSkipStep={handleSkipStep}
      onGo={handleGo}
      onSkipAll={handleSkipAll}
      onComplete={handleComplete}
    />
  )
}
