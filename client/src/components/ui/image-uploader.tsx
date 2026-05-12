/**
 * ImageUploader - 通用单图上传组件（v7.2 T-S1-INF-02 方案 B 服务端代理）
 *
 * 设计目标：
 * - 视觉无主张：仅暴露"点击/拖拽 → 选择 → 上传 → 回调 onChange"的最小行为
 * - 业务侧负责"长什么样"（头像圆形 / 打卡卡片方形等），通过 children render-prop 传入预览 UI
 * - 上传失败 toast 提示，不抛出（业务侧不需关心）
 *
 * 与 v7.2 服务端代理架构配套：
 * - 上传成功后 onChange 收到的是 **桶内 key**（如 `avatars/u1/abc.jpg`），不是 URL
 * - 业务层把 key 写入 DB（`User.avatar` / `Baby.avatar` 等）
 * - 展示时用 `buildImageUrl(key)` 拼成 `/api/uploads/{key}` 走我方下载代理
 *
 * 用法：
 *   <ImageUploader kind="avatar" onChange={async (key) => {
 *     await authService.updateProfile({ avatar: key })
 *   }}>
 *     {({ openPicker, isUploading }) => (
 *       <button onClick={openPicker}>
 *         <img src={buildImageUrl(user.avatar)} />
 *       </button>
 *     )}
 *   </ImageUploader>
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { uploadService } from '@/services/upload'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { UploadKind, UploadContext } from '@/types'

export interface ImageUploaderRenderProps {
  /** 当前是否正在上传中（含压缩 + 网络） */
  isUploading: boolean
  /** 上传进度 0-1（仅 multipart POST 阶段；压缩阶段为 0） */
  progress: number
  /** 触发文件选择对话框 */
  openPicker: () => void
  /** 是否被禁用（disabled prop 透传） */
  disabled: boolean
}

export interface ImageUploaderProps {
  /** 上传分类，决定 key 前缀与压缩长边 */
  kind: UploadKind
  /** 上下文（baby-avatar / daily-checkin 必填对应字段） */
  ctx?: UploadContext
  /**
   * 上传成功后的 **key 回调**（如 `avatars/u1/abc.jpg`）；业务侧负责落库。
   * 注意：传入的不是 URL！展示时用 `buildImageUrl(key)` 拼接。
   */
  onChange: (key: string) => void | Promise<void>
  /** 当前已有的 key（仅供 children render-prop 读取） */
  value?: string | null
  /** 自定义 accept（默认 image/jpeg,image/png,image/webp） */
  accept?: string
  /** 禁用上传 */
  disabled?: boolean
  /** 自定义压缩长边（覆盖 kind 默认值） */
  maxDimension?: number
  /**
   * Render-prop：返回触发上传的 UI。
   * 不传时渲染默认 "+ 上传图片" 按钮。
   */
  children?: (props: ImageUploaderRenderProps) => ReactNode
  /** 容器额外类名（仅作用于 wrapper，不影响 children） */
  className?: string
}

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp'

export function ImageUploader({
  kind,
  ctx,
  onChange,
  accept = DEFAULT_ACCEPT,
  disabled = false,
  maxDimension,
  children,
  className,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const openPicker = useCallback(() => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }, [disabled, isUploading])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // input 重置：让用户能重选同一文件触发 onChange
      e.target.value = ''
      if (!file) return

      setIsUploading(true)
      setProgress(0)
      try {
        const result = await uploadService.upload(file, kind, ctx, {
          maxDimension,
          onProgress: (p) => setProgress(p),
        })
        await onChange(result.key)
        toast.success('上传成功')
      } catch (err) {
        if (err instanceof ApiError) {
          switch (err.code) {
            case 'UPLOAD_NOT_CONFIGURED':
              toast.error('图片上传服务未配置，请联系管理员')
              break
            case 'UPLOAD_INVALID_EXT':
              toast.error('不支持的图片格式，请使用 JPG / PNG / WebP')
              break
            case 'UPLOAD_TOO_LARGE':
              toast.error('图片过大，请选择小一点的图片')
              break
            case 'RATE_LIMITED':
              toast.error('上传过于频繁，请稍后再试')
              break
            default:
              toast.error(err.message || '上传失败')
          }
        } else {
          const msg = err instanceof Error ? err.message : '上传失败'
          // 用户主动取消时静默
          if (!/abort|canceled/i.test(msg)) {
            toast.error(`上传失败：${msg}`)
          }
        }
      } finally {
        setIsUploading(false)
        setProgress(0)
      }
    },
    [kind, ctx, maxDimension, onChange],
  )

  const renderProps: ImageUploaderRenderProps = {
    isUploading,
    progress,
    openPicker,
    disabled,
  }

  return (
    <div className={cn('inline-block relative', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* eslint-disable-next-line react-hooks/refs -- openPicker 仅在点击事件中调用，不会在 render 期间访问 ref */}
      {children ? children(renderProps) : <DefaultUploaderButton {...renderProps} />}
    </div>
  )
}

/**
 * 默认按钮：圆形 + Camera 图标 + 加载态。
 * 仅在调用方未提供 children 时使用，便于快速验证上传链路。
 */
function DefaultUploaderButton({
  isUploading,
  progress,
  openPicker,
  disabled,
}: ImageUploaderRenderProps) {
  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={disabled || isUploading}
      className={cn(
        'inline-flex items-center justify-center',
        'w-12 h-12 rounded-full',
        'bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]',
        'border border-dashed border-[var(--separator)]',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
      aria-label={isUploading ? `正在上传 ${Math.round(progress * 100)}%` : '上传图片'}
    >
      {isUploading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[var(--label-secondary)]" />
      ) : (
        <Camera className="w-5 h-5 text-[var(--label-secondary)]" />
      )}
    </button>
  )
}
