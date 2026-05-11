/**
 * DailyCheckinCard - 首页"今日打卡"卡片（v7.2 T-S2-F11-FE-02）
 *
 * 三态：
 * 1) 空：CTA 风格卡片 + Camera 图标 + 鼓励文案 + PhotoUploader 触发
 * 2) 处理中（上传 / 创建 / AI 生成）：占位 + 进度文本
 * 3) 已打卡：缩略图 + AI 小记前 2 行 + 「查看完整」 → /growth/calendar?date=YYYY-MM-DD
 *
 * 设计要点：
 * - 当 babyId 缺失（无家庭）时不渲染，由父组件兜底
 * - 不阻塞主线：网络异常时静默 fallback；用户仍能看到 TodaySummary 等其他模块
 * - viewer 角色（无 canEdit）：已打卡仍可见，但空态不显示 CTA
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Camera, Loader2, ChevronRight, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PhotoUploader } from '@/components/daily-checkin/photo-uploader'
import { useDailyCheckin } from '@/hooks/use-daily-checkins'
import { todayLocalYmd } from '@/lib/daily-checkin-date'
import { buildImageUrl } from '@/lib/image-url'
import { formatTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { CareRole } from '@/types'

export interface DailyCheckinCardProps {
  babyId: string
  familyId: string
  role?: CareRole
  /** 是否允许打卡（依赖权限：admin/editor=true，viewer=false） */
  canEdit: boolean
  className?: string
}

export function DailyCheckinCard({
  babyId,
  familyId,
  role,
  canEdit,
  className,
}: DailyCheckinCardProps) {
  const { t } = useTranslation('daily-checkin')
  const today = todayLocalYmd()
  const { data: checkin, isLoading } = useDailyCheckin(babyId, today)

  // 加载中骨架（短暂）
  if (isLoading) {
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="flex items-center gap-2 text-[var(--label-tertiary)] text-[14px]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('card.compressing')}
        </div>
      </Card>
    )
  }

  // 已打卡
  if (checkin) {
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="flex items-center gap-3">
          {/* 缩略图 */}
          <Link
            to={`/growth/calendar?date=${today}`}
            className={cn(
              'relative shrink-0 overflow-hidden rounded-[var(--radius-md)]',
              'w-16 h-16',
              'bg-[var(--surface-2)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
            )}
            aria-label={t('card.view_full')}
          >
            <img
              src={buildImageUrl(checkin.photoKey)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </Link>

          {/* 文本 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--label-tertiary)]">
              <Sparkles className="h-3 w-3" style={{ color: 'var(--brand)' }} />
              <span>
                {t('card.subtitle_done', {
                  time: formatTime(checkin.createdAt),
                })}
              </span>
            </div>
            <p
              className={cn(
                'mt-0.5 text-[14px] leading-relaxed text-[var(--label)]',
                'line-clamp-2',
              )}
            >
              {checkin.aiSummary || checkin.caption || ' '}
            </p>
          </div>

          {/* 跳转按钮 */}
          <Link
            to={`/growth/calendar?date=${today}`}
            className={cn(
              'shrink-0 p-1.5 rounded-md',
              'text-[var(--label-tertiary)] hover:text-[var(--label-secondary)]',
              'hover:bg-[var(--surface-hover)] transition-colors',
            )}
            aria-label={t('card.view_full')}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    )
  }

  // 未打卡：viewer 不显示 CTA，仅给一句提示
  if (!canEdit) {
    return (
      <Card variant="plain" padding="md" className={className}>
        <div className="text-[14px] text-[var(--label-tertiary)] text-center py-2">
          {t('card.subtitle_empty')}
        </div>
      </Card>
    )
  }

  // 未打卡 + 可打卡：CTA
  return (
    <PhotoUploader
      babyId={babyId}
      familyId={familyId}
      date={today}
      role={role}
    >
      {({ openPicker, isWorking, isGeneratingAi }) => (
        <Card
          variant="cta"
          padding="lg"
          className={cn('cursor-pointer', className)}
          onClick={!isWorking && !isGeneratingAi ? openPicker : undefined}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isWorking && !isGeneratingAi) {
              e.preventDefault()
              openPicker()
            }
          }}
        >
          <div className="flex flex-col items-center text-center gap-2">
            <div
              className="icon-circle icon-circle--lg"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--brand) 14%, transparent)',
              }}
            >
              {isWorking ? (
                <Loader2
                  className="h-5 w-5 animate-spin"
                  style={{ color: 'var(--brand-ink)' }}
                />
              ) : (
                <Camera className="h-5 w-5" style={{ color: 'var(--brand-ink)' }} />
              )}
            </div>

            <h3 className="text-[15px] font-semibold text-[var(--label)]">
              {isWorking
                ? t('card.uploading')
                : isGeneratingAi
                ? t('card.ai_generating')
                : t('card.subtitle_empty')}
            </h3>

            {!isWorking && !isGeneratingAi && (
              <>
                <p className="text-[13px] text-[var(--label-secondary)]">
                  {t('card.subtitle_empty_hint')}
                </p>
                <Button variant="filled" size="sm" className="mt-1" onClick={(e) => {
                  e.stopPropagation()
                  openPicker()
                }}>
                  {t('card.cta_empty')}
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </PhotoUploader>
  )
}
