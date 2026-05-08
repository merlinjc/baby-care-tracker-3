/**
 * Button v7 - iOS Health 风按钮
 *
 * Variant（iOS 标准 4 档）：
 * - 'filled'（主操作）：实色背景 + 白文字，默认 brand 主色
 * - 'tinted'（次操作）：柔和底色 bg + 深色文字（iOS tint button）
 * - 'plain'（无底）：透明背景 + 主色文字
 * - 'secondary'（次要描边）：surface-2 灰底 + 深色文字（iOS secondary filled）
 * - 'destructive'：systemRed 实色（替代旧 'danger'）
 * - 'destructive-plain'：透明 + systemRed 文字
 *
 * 兼容旧 variant（primary/secondary/ghost/outline/danger/danger-outline/link/gradient-*）
 * 继续可用，内部 alias 到新体系。
 *
 * Size：xs (28) / sm (32) / md (40, 默认) / lg (48) / icon (36×36)
 * 交互：whileTap scale 0.96（iOS 典型）+ 色彩透明度反馈
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { deriveIconSize, withIconSize, type IconSize } from '@/lib/icon-size'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 font-medium',
    'rounded-[var(--radius-md)]',
    'shrink-0 whitespace-nowrap select-none',
    'transition-[background-color,opacity,color,border-color]',
    'duration-[150ms]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[color-mix(in_srgb,var(--brand)_50%,transparent)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
  ].join(' '),
  {
    variants: {
      variant: {
        // ─── v7 iOS 标准 ───
        filled: 'text-white bg-[var(--brand)] hover:opacity-90 active:opacity-80',
        tinted: [
          'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]',
          'text-[var(--brand-ink)]',
          'hover:bg-[color-mix(in_srgb,var(--brand)_18%,transparent)]',
          'active:bg-[color-mix(in_srgb,var(--brand)_22%,transparent)]',
        ].join(' '),
        plain: [
          'bg-transparent text-[var(--brand-ink)]',
          'hover:bg-[var(--surface-2)]',
          'active:bg-[var(--surface-hover)]',
        ].join(' '),
        secondary: [
          'bg-[var(--surface-2)] text-[var(--label)]',
          'hover:bg-[var(--surface-hover)]',
          'active:opacity-80',
        ].join(' '),
        destructive: 'text-white bg-[var(--danger)] hover:opacity-90 active:opacity-80',
        'destructive-plain': [
          'bg-transparent text-[var(--danger)]',
          'hover:bg-[var(--danger-bg)]',
        ].join(' '),

        // ─── 兼容旧 variant（渐进下线） ───
        primary: 'text-white bg-[var(--brand)] hover:opacity-90 active:opacity-80',
        ghost: [
          'border border-[var(--separator-opaque)] bg-transparent text-[var(--label-secondary)]',
          'hover:text-[var(--label)] hover:bg-[var(--surface-2)]',
          'data-[active=true]:text-white data-[active=true]:border-transparent',
        ].join(' '),
        outline: [
          'border border-[var(--border-default)] bg-transparent text-[var(--label)]',
          'hover:bg-[var(--surface-2)]',
        ].join(' '),
        danger: 'text-white bg-[var(--danger)] hover:opacity-90 active:opacity-80',
        'danger-outline': [
          'border bg-transparent text-[var(--danger)]',
          'border-[color-mix(in_srgb,var(--danger)_35%,transparent)]',
          'hover:bg-[var(--danger-bg)]',
        ].join(' '),
        link: 'text-[var(--brand-ink)] hover:underline p-0 h-auto bg-transparent',

        // v6 兼容：渐变/玻璃态（保留但不推荐新用）
        'gradient-primary':
          'text-white bg-[var(--gradient-primary)] hover:opacity-85 active:opacity-75',
        'gradient-feeding':
          'text-white bg-[var(--gradient-feeding)] hover:opacity-85 active:opacity-75',
        'gradient-sleep':
          'text-white bg-[var(--gradient-sleep)] hover:opacity-85 active:opacity-75',
        'gradient-diaper':
          'text-white bg-[var(--gradient-diaper)] hover:opacity-85 active:opacity-75',
        'gradient-temperature':
          'text-white bg-[var(--gradient-temperature)] hover:opacity-85 active:opacity-75',
        'gradient-growth':
          'text-white bg-[var(--gradient-growth)] hover:opacity-85 active:opacity-75',
        glass: [
          'bg-[var(--glass-bg)] backdrop-blur-[20px]',
          'border border-[var(--separator)] text-[var(--label)]',
          'hover:bg-[var(--surface-2)]',
        ].join(' '),
      },
      size: {
        xs: 'h-7 px-2.5 text-[12px] gap-1 rounded-[8px]',
        sm: 'h-8 px-3 text-[13px] rounded-[10px]',
        md: 'h-10 px-4 text-[15px] font-semibold',
        lg: 'h-12 px-5 text-[17px] font-semibold rounded-[14px]',
        icon: 'h-9 w-9 p-0 rounded-[10px]',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'filled', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onDragStart' | 'onDragEnd' | 'onDrag'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** 覆盖主色（仅 filled/primary/destructive/tinted/ghost+active 时生效） */
  accentColor?: string
  /** ghost / tinted 的 active 态 */
  active?: boolean
  /** 自动推导图标尺寸（xs/sm→sm / md→md / lg→lg / icon→md） */
  iconSize?: IconSize
  /** 是否禁用按压动效（仅在极少数 layout sensitive 场景用） */
  disableTapAnim?: boolean
}

function ButtonSpinner() {
  return <span className="spinner spinner--sm" aria-hidden />
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      loading,
      disabled,
      leftIcon,
      rightIcon,
      accentColor,
      active,
      iconSize,
      disableTapAnim,
      children,
      type = 'button',
      style,
      ...props
    },
    ref,
  ) => {
    // accentColor 应用规则
    const inlineStyle: React.CSSProperties | undefined = (() => {
      if (!accentColor) return style
      const filledLike = ['filled', 'primary', 'danger', 'destructive'].includes(variant ?? 'filled')
      if (filledLike) return { ...style, backgroundColor: accentColor }
      if (variant === 'tinted') {
        return {
          ...style,
          backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
          color: accentColor,
        }
      }
      if (variant === 'ghost' && active) return { ...style, backgroundColor: accentColor }
      return style
    })()

    const resolvedIconSize = iconSize ?? deriveIconSize(size)
    const sizedLeftIcon = withIconSize(leftIcon, resolvedIconSize)
    const sizedRightIcon = withIconSize(rightIcon, resolvedIconSize)

    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-active={active ? 'true' : undefined}
        className={cn(buttonVariants({ variant, size, block }), className)}
        style={inlineStyle}
        whileTap={!isDisabled && !disableTapAnim ? { scale: 0.96 } : undefined}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        {...props}
      >
        {loading ? <ButtonSpinner /> : sizedLeftIcon}
        {children}
        {!loading && sizedRightIcon}
      </motion.button>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
