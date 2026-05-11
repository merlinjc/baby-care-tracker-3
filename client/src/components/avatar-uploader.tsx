/**
 * AvatarUploader - 头像上传薄封装（v7.2 T-S1-F12-02）
 *
 * 设计：
 * - 视觉：圆形头像 + 右下角小相机角标，hover 整体降亮提示可点击
 * - 行为：薄封装 ImageUploader（kind=avatar），上传成功后回调拿到 **桶内 key**
 * - 业务侧负责把 key 写入 DB（如 PATCH /auth/profile）
 *
 * 与 BabyAvatar / UserAvatar 的关系：
 * - 本组件**不**负责 fallback 渲染（首字 + 哈希色），由调用方传入 children 自行渲染
 *   通常调用方传 <UserAvatar size="xl" /> 或 <BabyAvatar size="xl" />
 *
 * 用法：
 *   <AvatarUploader
 *     kind="avatar"
 *     value={user?.avatar}
 *     onChange={async (key) => {
 *       await authService.updateProfile({ avatar: key })
 *       await loadUser()
 *     }}
 *   >
 *     <UserAvatar user={user} size="xl" />
 *   </AvatarUploader>
 */
import { Camera, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ImageUploader, type ImageUploaderRenderProps } from '@/components/ui/image-uploader'
import { cn } from '@/lib/utils'
import type { UploadContext, UploadKind } from '@/types'

export interface AvatarUploaderProps {
  /** 上传分类（avatar / baby-avatar） */
  kind: Extract<UploadKind, 'avatar' | 'baby-avatar'>
  /** baby-avatar 必填 babyId 等上下文 */
  ctx?: UploadContext
  /** 当前 avatar 字段（key 或旧 URL）；仅供 children 透传，本组件不读取 */
  value?: string | null
  /** 上传成功的 key 回调，业务侧负责落库 */
  onChange: (key: string) => void | Promise<void>
  /** 已渲染好的头像（如 <UserAvatar size="xl" />） */
  children: ReactNode
  /** 禁用上传 */
  disabled?: boolean
  /** 容器额外类名 */
  className?: string
  /** 角标尺寸（默认 24px，建议跟随头像 size） */
  badgeSize?: number
  /** 无障碍 label，默认"上传头像" */
  ariaLabel?: string
}

/**
 * AvatarUploader：圆形头像 + 右下相机角标 + 上传中遮罩。
 *
 * 角标色卡：使用 brand soft / brand 与全局一致，避免引入新色。
 */
export function AvatarUploader({
  kind,
  ctx,
  value,
  onChange,
  children,
  disabled = false,
  className,
  badgeSize = 24,
  ariaLabel = '上传头像',
}: AvatarUploaderProps) {
  return (
    <ImageUploader
      kind={kind}
      ctx={ctx}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      {(props) => (
        <AvatarUploaderTrigger
          {...props}
          badgeSize={badgeSize}
          ariaLabel={ariaLabel}
        >
          {children}
        </AvatarUploaderTrigger>
      )}
    </ImageUploader>
  )
}

interface AvatarUploaderTriggerProps extends ImageUploaderRenderProps {
  children: ReactNode
  badgeSize: number
  ariaLabel: string
}

function AvatarUploaderTrigger({
  isUploading,
  progress,
  openPicker,
  disabled,
  children,
  badgeSize,
  ariaLabel,
}: AvatarUploaderTriggerProps) {
  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={disabled || isUploading}
      aria-label={
        isUploading ? `${ariaLabel}（${Math.round(progress * 100)}%）` : ariaLabel
      }
      className={cn(
        'relative inline-block rounded-full',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-[color-mix(in_srgb,var(--brand)_50%,transparent)]',
        'focus-visible:ring-offset-[var(--bg)]',
        'hover:opacity-90',
        'disabled:cursor-not-allowed',
      )}
    >
      {/* 头像本体 */}
      {children}

      {/* 上传中遮罩 */}
      {isUploading && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full',
            'flex items-center justify-center',
            'bg-black/40 backdrop-blur-[1px]',
          )}
        >
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </span>
      )}

      {/* 右下角相机角标（上传中隐藏，避免视觉干扰） */}
      {!isUploading && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0',
            'flex items-center justify-center',
            'rounded-full',
            'bg-[var(--brand)] text-white',
            'ring-2 ring-[var(--bg-card)]',
            'shadow-sm',
          )}
          style={{
            width: badgeSize,
            height: badgeSize,
          }}
        >
          <Camera className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
      )}
    </button>
  )
}
