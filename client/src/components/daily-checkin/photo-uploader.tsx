/**
 * PhotoUploader - 每日打卡照片上传业务封装（v7.2 T-S2-F11-FE-01）
 *
 * 功能：
 * 1) 包装 ImageUploader，方形预览（圆角）+ 上传进度遮罩
 * 2) 上传成功拿到 photoKey 后：
 *    a. 调 createCheckin POST /api/babies/:id/checkins
 *    b. 异步触发 generateAiSummary（不阻塞 UI；失败 toast 不阻断）
 * 3) 失败回滚：createCheckin 失败 toast；上传层失败由 ImageUploader 自行 toast
 *
 * 设计要点：
 * - 不渲染默认 chrome（CTA 文字、占位图等）；调用方提供 children 决定外观
 * - children 是 render-prop：返回触发上传的 UI
 * - 业务事件回调：onCreated（拿到完整 DailyCheckin）/ onAiGenerated（小记到位）
 *
 * 用法：
 *   <PhotoUploader
 *     babyId={babyId}
 *     familyId={familyId}
 *     date="2026-05-15"
 *     onCreated={(c) => console.log('打卡完成', c)}
 *   >
 *     {({ openPicker, isWorking }) => (
 *       <button onClick={openPicker}>{isWorking ? '上传中...' : '今天给宝宝拍一张'}</button>
 *     )}
 *   </PhotoUploader>
 */
import { useCallback, useState, type ReactNode } from 'react'
import { ImageUploader } from '@/components/ui/image-uploader'
import { useCreateCheckin, useGenerateAiSummary } from '@/hooks/use-daily-checkins'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import type { CareRole, DailyCheckin } from '@/types'

export interface PhotoUploaderRenderProps {
  /** 触发文件选择 */
  openPicker: () => void
  /** 是否正在压缩/上传/落库（含 createCheckin 等待） */
  isWorking: boolean
  /** 是否在 AI 生成阶段（落库成功 → AI 小记到位 / 失败） */
  isGeneratingAi: boolean
  /** 上传进度 0-1（仅 multipart POST 阶段；压缩阶段为 0） */
  progress: number
  /** disabled 透传 */
  disabled: boolean
}

export interface PhotoUploaderProps {
  babyId: string
  familyId: string
  /** YYYY-MM-DD（本地时区） */
  date: string
  /** 用户当前角色，用于 AI 小记的口吻 */
  role?: CareRole
  /** 打卡创建成功回调（含 photoKey + 当前 aiSummary=null） */
  onCreated?: (checkin: DailyCheckin) => void
  /** AI 小记生成成功回调 */
  onAiGenerated?: (checkin: DailyCheckin) => void
  /** 是否在创建后自动调用 generateAiSummary（默认 true） */
  autoGenerateAi?: boolean
  disabled?: boolean
  className?: string
  children: (props: PhotoUploaderRenderProps) => ReactNode
}

export function PhotoUploader({
  babyId,
  familyId,
  date,
  role,
  onCreated,
  onAiGenerated,
  autoGenerateAi = true,
  disabled = false,
  className,
  children,
}: PhotoUploaderProps) {
  const create = useCreateCheckin(babyId)
  const generateAi = useGenerateAiSummary(babyId)
  const [isGeneratingAi, setGeneratingAi] = useState(false)

  const handleUploaded = useCallback(
    async (photoKey: string) => {
      // 1) POST /checkins 落库
      let created: DailyCheckin
      try {
        created = await create.mutateAsync({
          checkinDate: date,
          photoKey,
        })
        onCreated?.(created)
      } catch (err) {
        // 重复打卡（409）友好提示，建议跳详情查看；其余错误透传
        if (err instanceof ApiError && err.code === 'CHECKIN_DUPLICATE') {
          toast.error('今天已经打过卡了，可在日历中查看或编辑')
        } else if (err instanceof ApiError && err.code === 'CHECKIN_WINDOW_EXPIRED') {
          toast.error('该日期超过 7 天补打卡窗口')
        } else if (err instanceof ApiError) {
          toast.error(err.message || '打卡失败')
        } else {
          toast.error('打卡失败，请重试')
        }
        return
      }

      // 2) 异步触发 AI 小记（不阻塞）
      if (autoGenerateAi) {
        setGeneratingAi(true)
        generateAi
          .mutateAsync({ date, role })
          .then((withAi) => {
            onAiGenerated?.(withAi)
          })
          .catch((err) => {
            // AI 失败不影响打卡本身；用户仍可在详情里手动重试
            if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
              toast.info('今日 AI 额度已用完，明天再试')
            } else {
              toast.info('AI 小记暂时无法生成，可稍后重试')
            }
          })
          .finally(() => {
            setGeneratingAi(false)
          })
      }
    },
    [create, generateAi, date, role, onCreated, onAiGenerated, autoGenerateAi],
  )

  const isCreatePending = create.isPending

  return (
    <ImageUploader
      kind="daily-checkin"
      ctx={{ familyId, babyId, date }}
      onChange={handleUploaded}
      disabled={disabled}
      className={className}
    >
      {({ openPicker, isUploading, progress, disabled: d }) =>
        children({
          openPicker,
          isWorking: isUploading || isCreatePending,
          isGeneratingAi,
          progress,
          disabled: d,
        })
      }
    </ImageUploader>
  )
}
