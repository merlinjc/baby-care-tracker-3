/**
 * AiSummaryPanel - AI 小记展示 / 编辑 / 重新生成（v7.2 T-S2-F11-FE-02）
 *
 * 状态：
 * - 加载中（isLoading）：spinner + "AI 正在为今天写小记…"
 * - 已 AI 生成（aiSummary 非空 & aiSummaryAt 非空）：渲染 + 「重新生成」按钮
 * - 已人工修改（aiSummary 非空 & aiSummaryAt 为 null）：右上角"已人工修改" pill +「重新生成」
 * - 编辑模式：textarea + 保存 / 取消
 * - 空状态：「生成 AI 小记」按钮（显式触发，避免每次点开抽屉都扣配额）
 *
 * 设计要点：
 * - 「重新生成」需要 confirm（明确扣配额）
 * - 编辑保存调 useUpdateCheckin，aiSummary 写入后 service 自动清 aiSummaryAt
 * - 所有错误统一 toast，本组件不抛错
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, Pencil, Loader2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import {
  useGenerateAiSummary,
  useUpdateCheckin,
} from '@/hooks/use-daily-checkins'
import type { CareRole, DailyCheckin } from '@/types'
import { cn } from '@/lib/utils'

export interface AiSummaryPanelProps {
  babyId: string
  date: string
  checkin: DailyCheckin
  /** 当前用户的育儿角色，用于 AI 小记口吻 */
  role?: CareRole
  /** 是否允许编辑 / 重新生成（依赖权限矩阵：editor 仅自己创建的） */
  canEdit: boolean
  className?: string
}

export function AiSummaryPanel({
  babyId,
  date,
  checkin,
  role,
  canEdit,
  className,
}: AiSummaryPanelProps) {
  const { t } = useTranslation('daily-checkin')
  const confirm = useConfirm()
  const [isEditing, setEditing] = useState(false)
  const [draft, setDraft] = useState(checkin.aiSummary ?? '')
  const generate = useGenerateAiSummary(babyId)
  const update = useUpdateCheckin(babyId)

  const isHumanEdited = !!checkin.aiSummary && !checkin.aiSummaryAt

  const startEdit = useCallback(() => {
    setDraft(checkin.aiSummary ?? '')
    setEditing(true)
  }, [checkin.aiSummary])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setDraft(checkin.aiSummary ?? '')
  }, [checkin.aiSummary])

  const saveEdit = useCallback(async () => {
    try {
      await update.mutateAsync({
        date,
        patch: { aiSummary: draft.trim() || null },
      })
      setEditing(false)
      toast.success(t('ai_summary.save'))
    } catch (err) {
      const e = err as ApiError
      toast.error(e?.message ?? '保存失败')
    }
  }, [update, date, draft, t])

  const regenerate = useCallback(async () => {
    const ok = await confirm({
      title: t('ai_summary.regenerate_confirm_title'),
      description: t('ai_summary.regenerate_confirm_desc'),
      confirmText: t('ai_summary.regenerate_confirm_ok'),
      cancelText: t('ai_summary.regenerate_confirm_cancel'),
    })
    if (!ok) return
    try {
      await generate.mutateAsync({ date, role })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        toast.warning(t('errors.ai_quota_exceeded'))
      } else {
        toast.error(t('errors.ai_failed'))
      }
    }
  }, [confirm, generate, date, role, t])

  const generateFirst = useCallback(async () => {
    try {
      await generate.mutateAsync({ date, role })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        toast.warning(t('errors.ai_quota_exceeded'))
      } else {
        toast.error(t('errors.ai_failed'))
      }
    }
  }, [generate, date, role, t])

  if (generate.isPending) {
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="flex items-center gap-2 text-[var(--label-secondary)] text-[14px]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('card.ai_generating')}
        </div>
      </Card>
    )
  }

  if (isEditing) {
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={4}
            className={cn(
              'w-full text-[15px] leading-relaxed',
              'bg-[var(--surface-1)] border border-[var(--separator)] rounded-[var(--radius-md)]',
              'px-3 py-2',
              'focus:outline-none focus:ring-2 focus:ring-[var(--brand)]',
              'text-[var(--label)]',
            )}
          />
          <div className="flex justify-end gap-2">
            <Button variant="plain" size="sm" onClick={cancelEdit}>
              {t('ai_summary.cancel')}
            </Button>
            <Button
              variant="filled"
              size="sm"
              onClick={saveEdit}
              disabled={update.isPending}
            >
              {t('ai_summary.save')}
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!checkin.aiSummary) {
    // 空态：显式按钮触发首次生成
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-[var(--label-tertiary)]">
            {t('ai_summary.empty')}
          </span>
          {canEdit && (
            <Button
              variant="plain"
              size="sm"
              onClick={generateFirst}
              disabled={generate.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {t('ai_summary.generate')}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card variant="plain" padding="md" className={className}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[var(--label-secondary)]">
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
            <span>{t('ai_summary.label')}</span>
            {isHumanEdited && (
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-px rounded-full',
                  'text-[11px] font-medium',
                  'bg-[var(--surface-2)] text-[var(--label-tertiary)]',
                )}
              >
                {t('ai_summary.edited_pill')}
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startEdit}
                className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
                aria-label={t('ai_summary.edit')}
                title={t('ai_summary.edit')}
              >
                <Pencil className="h-3.5 w-3.5 text-[var(--label-secondary)]" />
              </button>
              <button
                type="button"
                onClick={regenerate}
                className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
                aria-label={t('ai_summary.regenerate')}
                title={t('ai_summary.regenerate')}
              >
                <RefreshCw className="h-3.5 w-3.5 text-[var(--label-secondary)]" />
              </button>
            </div>
          )}
        </div>
        <p className="text-[15px] leading-relaxed text-[var(--label)] whitespace-pre-wrap">
          {checkin.aiSummary}
        </p>
      </div>
    </Card>
  )
}
