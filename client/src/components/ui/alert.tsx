/**
 * Alert - 内联提示条
 *
 * 对标 shadcn/ui 的 `alert.tsx`。纯自研无 radix 依赖（因为 alert 是展示型非交互）。
 *
 * 5 种 variant（color-mix 实现与主题 / 暖夜模式兼容）：
 * - 'info' (默认)：灰白底，中性提示（替代旧 .notice-info）
 * - 'success'：绿色 / 达标提示
 * - 'warning'：橙色 / 低烧 / 轻度警告
 * - 'danger'：红色 / 高烧 / 删除警示
 * - 'primary'：品牌色 / 主题引导
 *
 * 结构：Alert + AlertTitle + AlertDescription；也可不用子组件，直接当单行条使用（size="compact"）。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { withIconSize } from '@/lib/icon-size'

const alertVariants = cva(
  [
    'flex gap-2 rounded-md',
    'text-xs leading-relaxed',
  ].join(' '),
  {
    variants: {
      variant: {
        info: 'bg-[var(--bg-elevated)] text-[var(--text-hint)]',
        primary:
          'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary-dark)]',
        success:
          'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]',
        warning:
          'bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]',
        danger:
          'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]',
      },
      size: {
        /** 单行紧凑（旧 .notice-info 等价） */
        compact: 'items-center px-3 py-2',
        /** 两行多内容（带 title + description） */
        md: 'items-start px-3 py-2.5',
      },
    },
    defaultVariants: { variant: 'info', size: 'md' },
  },
)

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** 左侧装饰 icon（lucide）；默认跟随 variant 自动匹配见 <AlertIcon>。 */
  icon?: ReactNode
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    // v5.1.0：根据 size 自动推导图标尺寸（compact→sm / md→md）
    const sizedIcon = withIconSize(icon, size === 'compact' ? 'sm' : 'md')
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant, size }), className)}
        {...props}
      >
        {sizedIcon && <span className="shrink-0 mt-[1px]">{sizedIcon}</span>}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    )
  },
)
Alert.displayName = 'Alert'

/** AlertTitle - 第一行加粗标题（可选） */
export const AlertTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm font-semibold leading-tight', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

/** AlertDescription - 描述文案 */
export const AlertDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mt-0.5', className)} {...props} />
))
AlertDescription.displayName = 'AlertDescription'

export { alertVariants }
