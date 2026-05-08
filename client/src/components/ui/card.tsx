/**
 * Card v7 - iOS Health 风卡片
 *
 * Variant（iOS 标准）：
 * - 'plain'（默认）：surface-1 + radius-lg + 无边框（仅阴影做层次）
 * - 'elevated'：同 plain 但阴影加重（Hero/关键数据卡）
 * - 'interactive'：可点击卡片（hover 轻抬 + active 微缩）
 * - 'hero'：Hero 区（radius-xl 28px + 更大 padding + 阴影）
 * - 'tinted'：柔和底色卡（配合 accentColor 生成 12% 底色，用于状态提示）
 *
 * 兼容旧 variant（default/ghost/accent/glass/gradient-header/cta）继续可用。
 *
 * Padding：none / sm / md (默认) / lg / xl
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  ['transition-[box-shadow,background-color,border-color,transform] duration-200 ease-[var(--ease-ios)]'].join(' '),
  {
    variants: {
      variant: {
        // ── v7 标准 ──
        plain: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-xs)]',
        ].join(' '),
        elevated: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-sm)]',
        ].join(' '),
        interactive: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-xs)]',
          'cursor-pointer',
          'hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px]',
          'active:scale-[0.985] active:shadow-[var(--shadow-xs)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
        ].join(' '),
        hero: [
          'bg-[var(--surface-1)] rounded-[var(--radius-xl)]',
          'shadow-[var(--shadow-md)]',
        ].join(' '),
        tinted: [
          'rounded-[var(--radius-lg)]',
        ].join(' '),

        // ── 兼容旧 variant ──
        default: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-xs)]',
        ].join(' '),
        ghost: 'bg-transparent',
        accent: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-xs)]',
        ].join(' '),
        glass: [
          'bg-[var(--glass-bg)] backdrop-blur-[20px] rounded-[var(--radius-lg)]',
          'border border-[var(--separator)]',
          'shadow-[var(--shadow-sm)]',
        ].join(' '),
        'gradient-header': [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-xs)]',
        ].join(' '),
        cta: [
          'bg-[var(--surface-1)] rounded-[var(--radius-lg)]',
          'border border-dashed border-[var(--border-default)]',
          'text-center cursor-pointer',
          'hover:border-[var(--brand)] hover:bg-[var(--surface-2)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
        ].join(' '),
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
        xl: 'p-7',
      },
    },
    defaultVariants: { variant: 'plain', padding: 'md' },
  },
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** 仅 accent 生效：左侧色条 */
  accentColor?: string
  accentWidth?: number | string
  /** 仅 gradient-header 兼容：顶部渐变色条 */
  gradientColor?: string
  /** tinted variant：柔和底色（基于 accentColor 生成 12% 底） */
  tintColor?: string
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      accentColor,
      accentWidth,
      gradientColor,
      tintColor,
      as: Comp = 'div',
      style,
      ...props
    },
    ref,
  ) => {
    const aw = accentWidth ?? 3
    const computedStyle: React.CSSProperties | undefined = (() => {
      if (variant === 'accent' && accentColor) {
        return { ...style, borderLeft: `${aw}px solid ${accentColor}` }
      }
      if (variant === 'gradient-header' && gradientColor) {
        return {
          ...style,
          borderTop: `${aw}px solid`,
          borderImage: `${gradientColor} 1`,
        }
      }
      if (variant === 'tinted' && (tintColor || accentColor)) {
        const c = tintColor ?? accentColor!
        return {
          ...style,
          backgroundColor: `color-mix(in srgb, ${c} 10%, var(--surface-1))`,
        }
      }
      return style
    })()

    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        data-card
        data-card-variant={variant ?? 'plain'}
        data-card-padding={padding ?? 'md'}
        className={cn(cardVariants({ variant, padding }), className)}
        style={computedStyle}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'

/** CardHeader - 标题区（iOS 风紧凑） */
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 mb-3', className)}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('headline text-[var(--label)]', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('footnote text-[var(--label-secondary)] mt-0.5', className)}
      {...props}
    />
  ),
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 mt-4 pt-3 border-t border-[var(--separator)]',
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { cardVariants }
