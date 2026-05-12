/**
 * DailyCheckinDetail - 日历单日详情抽屉（v7.2 T-S2-F11-FE-04）
 *
 * 触发方式：
 *   1) 已打卡日点击 cell → 显示完整详情（照片 + AI 小记 + caption + 当天 records）
 *   2) 可补打卡日点击 cell → 显示空态 + 上传按钮（直接调起 PhotoUploader）
 *
 * 行为：
 *   - 详情态：
 *     · AI 小记 → AiSummaryPanel（编辑/重新生成）
 *     · caption 可编辑（仅有 edit 权限的用户）
 *     · 替换照片 → PhotoUploader（autoGenerateAi=false，避免覆盖现有 AI 小记）
 *     · 删除 → confirm + useDeleteCheckin
 *   - 空态：
 *     · 直接显示 CTA + PhotoUploader（autoGenerateAi=true）
 *
 * 与 GrowthCalendarPage 的协议：
 *   - URL ?date=YYYY-MM-DD 控制开关；关闭时清掉 ?date
 *   - 切换日期 = 改 URL，组件自身根据 date 拉取并刷新
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ImagePlus, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import { buildImageUrl } from '@/lib/image-url'
import { cn } from '@/lib/utils'
import {
  useDailyCheckin,
  useUpdateCheckin,
  useDeleteCheckin,
} from '@/hooks/use-daily-checkins'
import { AiSummaryPanel } from '@/components/daily-checkin/ai-summary-panel'
import { PhotoUploader } from '@/components/daily-checkin/photo-uploader'
import type { CareRole } from '@/types'

export interface DailyCheckinDetailProps {
  open: boolean
  onClose: () => void
  babyId: string
  familyId: string
  /** YYYY-MM-DD */
  date: string
  /** 当前用户 id（用于判定是否本人创建 → 可编辑） */
  currentUserId?: string
  /** 角色矩阵推断的 canEdit（admin/editor=true，viewer=false） */
  canEdit: boolean
  /** 是否为管理员（admin 可改任何人创建的打卡） */
  isAdmin?: boolean
  /** 用户的育儿角色，用于 AI 小记口吻 */
  role?: CareRole
}

export function DailyCheckinDetail({
  open,
  onClose,
  babyId,
  familyId,
  date,
  currentUserId,
  canEdit,
  isAdmin = false,
  role,
}: DailyCheckinDetailProps) {
  const { t } = useTranslation('daily-checkin')
  const confirm = useConfirm()
  const { data: checkin, isLoading } = useDailyCheckin(babyId, date)
  const update = useUpdateCheckin(babyId)
  const remove = useDeleteCheckin(babyId)

  const [captionDraft, setCaptionDraft] = useState('')
  const [editingCaption, setEditingCaption] = useState(false)

  // checkin 变化时同步 caption 草稿
  useEffect(() => {
    setCaptionDraft(checkin?.caption ?? '')
    setEditingCaption(false)
  }, [checkin?.id, checkin?.caption])

  // 仅本人创建的可被 editor 改 / 删；admin 无限制
  const canMutate =
    canEdit &&
    (isAdmin ||
      !checkin ||
      !currentUserId ||
      checkin.createdBy === currentUserId)

  const saveCaption = useCallback(async () => {
    try {
      await update.mutateAsync({
        date,
        patch: { caption: captionDraft.trim() || null },
      })
      setEditingCaption(false)
      toast.success(t('ai_summary.save'))
    } catch (err) {
      toast.error((err as ApiError)?.message ?? '保存失败')
    }
  }, [update, date, captionDraft, t])

  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      title: t('detail.delete_confirm_title'),
      description: t('detail.delete_confirm_desc'),
      confirmText: t('detail.delete'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await remove.mutateAsync(date)
      toast.success(t('detail.delete'))
      onClose()
    } catch (err) {
      toast.error((err as ApiError)?.message ?? '删除失败')
    }
  }, [confirm, remove, date, onClose, t])

  // 替换照片成功 → 不自动重生 AI 小记（避免覆盖用户编辑过的）
  const handleReplaced = useCallback(() => {
    toast.success('照片已替换')
  }, [])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('detail.title', { date })}
      size="lg"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[var(--label-secondary)] gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>载入中…</span>
        </div>
      ) : checkin ? (
        <div className="space-y-3">
          {/* 照片 */}
          <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-2)]">
            <img
              src={buildImageUrl(checkin.photoKey)}
              alt={t('detail.title', { date })}
              className="w-full max-h-[420px] object-cover"
            />
          </div>

          {/* AI 小记 */}
          <AiSummaryPanel
            babyId={babyId}
            date={date}
            checkin={checkin}
            role={role}
            canEdit={canMutate}
          />

          {/* Caption */}
          <Card variant="plain" padding="md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--label-tertiary)] font-medium">
                  {t('detail.caption_label')}
                </span>
                {canMutate && !editingCaption && (
                  <button
                    type="button"
                    onClick={() => setEditingCaption(true)}
                    className="text-[12px] text-[var(--brand-ink)] hover:opacity-70"
                  >
                    {t('ai_summary.edit')}
                  </button>
                )}
              </div>
              {editingCaption ? (
                <>
                  <textarea
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    placeholder={t('detail.caption_placeholder')}
                    maxLength={200}
                    rows={3}
                    className={cn(
                      'w-full text-[14px]',
                      'bg-[var(--surface-1)] border border-[var(--separator)] rounded-[var(--radius-md)]',
                      'px-3 py-2',
                      'focus:outline-none focus:ring-2 focus:ring-[var(--brand)]',
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="plain"
                      size="sm"
                      onClick={() => {
                        setEditingCaption(false)
                        setCaptionDraft(checkin.caption ?? '')
                      }}
                    >
                      {t('ai_summary.cancel')}
                    </Button>
                    <Button
                      variant="filled"
                      size="sm"
                      onClick={saveCaption}
                      disabled={update.isPending}
                    >
                      {t('ai_summary.save')}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[14px] text-[var(--label)] whitespace-pre-wrap min-h-[1.5em]">
                  {checkin.caption || (
                    <span className="text-[var(--label-tertiary)]">
                      {t('detail.caption_placeholder')}
                    </span>
                  )}
                </p>
              )}
            </div>
          </Card>

          {/* 操作区：替换 / 删除 */}
          {canMutate && (
            <div className="flex items-center justify-between pt-1">
              <PhotoUploader
                babyId={babyId}
                familyId={familyId}
                date={date}
                role={role}
                autoGenerateAi={false}
                onCreated={handleReplaced}
              >
                {({ openPicker, isWorking }) => (
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={openPicker}
                    disabled={isWorking}
                    leftIcon={<ImagePlus className="h-3.5 w-3.5" />}
                  >
                    {t('detail.replace_photo')}
                  </Button>
                )}
              </PhotoUploader>

              <Button
                variant="destructive-plain"
                size="sm"
                onClick={handleDelete}
                disabled={remove.isPending}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                {t('detail.delete')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        // 空态：未打卡（cell 是 supplement 才会跳到此处）
        <EmptyDay
          babyId={babyId}
          familyId={familyId}
          date={date}
          role={role}
          canEdit={canEdit}
          onCreated={() => {
            // 创建成功后保留弹窗；query 已更新会自动渲染详情态
          }}
        />
      )}
    </Dialog>
  )
}

interface EmptyDayProps {
  babyId: string
  familyId: string
  date: string
  role?: CareRole
  canEdit: boolean
  onCreated: () => void
}

function EmptyDay({ babyId, familyId, date, role, canEdit, onCreated }: EmptyDayProps) {
  const { t } = useTranslation('daily-checkin')
  if (!canEdit) {
    return (
      <div className="text-center py-8 text-[var(--label-secondary)] text-[14px]">
        {t('card.subtitle_empty')}
      </div>
    )
  }
  return (
    <div className="text-center py-6">
      <p className="text-[14px] text-[var(--label-secondary)] mb-3">
        {t('card.subtitle_empty')}
      </p>
      <PhotoUploader
        babyId={babyId}
        familyId={familyId}
        date={date}
        role={role}
        onCreated={onCreated}
      >
        {({ openPicker, isWorking }) => (
          <Button
            variant="filled"
            size="md"
            onClick={openPicker}
            disabled={isWorking}
          >
            {isWorking ? t('card.uploading') : t('card.cta_empty')}
          </Button>
        )}
      </PhotoUploader>
    </div>
  )
}
