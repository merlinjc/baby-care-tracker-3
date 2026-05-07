/**
 * IconButton - 只有图标的小按钮
 *
 * 对标 shadcn/ui 的 `Button size="icon"`；这里单独抽出是因为我们有 3 种语义：
 * - 'ghost'（默认）：列表行的编辑按钮等，hover → primary
 * - 'danger-ghost'：列表行的删除按钮，hover → danger
 * - 'primary-ghost'：主色 hover 反馈
 *
 * 等价于 globals.css 里已废弃（@deprecated）的 `.icon-btn` / `.icon-btn--danger` 体系。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { withIconSize, type IconSize } from '@/lib/icon-size'

const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-md shrink-0',
    'bg-transparent border-none cursor-pointer',
    'transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[var(--primary)]/40',
  ].join(' '),
  {
    variants: {
      variant: {
        ghost: [
          'text-[var(--text-hint)]',
          'hover:text-[var(--primary)]',
          'hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]',
        ].join(' '),
        'danger-ghost': [
          'text-[var(--text-hint)]',
          'hover:text-[var(--danger)]',
          'hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]',
        ].join(' '),
        'primary-ghost': [
          'text-[var(--primary)]',
          'hover:bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]',
        ].join(' '),
      },
      size: {
        xs: 'h-6 w-6 p-1',
        sm: 'h-8 w-8 p-1.5',
        md: 'h-9 w-9 p-2',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'sm' },
  },
)

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  icon: ReactNode
  /** 可访问性标签（必需；IconButton 没有文字） */
  'aria-label': string
  /**
   * v5.1.0：图标尺寸覆盖。默认根据 button size 自动推导：xs→xs / sm→sm / md→md。
   */
  iconSize?: IconSize
}

const ICON_SIZE_BY_BUTTON: Record<NonNullable<VariantProps<typeof iconButtonVariants>['size']>, IconSize> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, icon, iconSize, type = 'button', ...props }, ref) => {
    const resolvedIconSize = iconSize ?? ICON_SIZE_BY_BUTTON[size ?? 'sm']
    const sizedIcon = withIconSize(icon, resolvedIconSize)
    return (
      <button
        ref={ref}
        type={type}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {sizedIcon}
      </button>
    )
  },
)
IconButton.displayName = 'IconButton'

export { iconButtonVariants }
