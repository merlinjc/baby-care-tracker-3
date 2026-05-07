/**
 * Card - 统一容器 Primitive
 *
 * 对标 shadcn/ui 的 `card.tsx` 组件族：<Card> / <CardHeader> / <CardTitle> /
 * <CardDescription> / <CardContent> / <CardFooter>。
 *
 * Variant：
 * - 'default'（默认）：等价旧 .card（bg-card + 1px border-light + radius-lg + padding 20px）
 * - 'interactive'：等价旧 .card-interactive（hover border-primary + bg-elevated）
 * - 'ghost'：无背景无边框，仅提供 header/content/footer 的布局语义
 * - 'accent'：左侧 3px 色条 + 其他同 default；配合 accentColor prop 使用
 *
 * 注意：Card 自带 padding 20px；内部使用 <CardHeader> / <CardContent> / <CardFooter>
 * 做分区时，这些子组件自身不带 padding（因为整体已由父 Card 提供）。若需要
 * "分区之间有视觉分隔线"，传 `<CardContent separated>` 或自行加 Separator。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  [
    'bg-[var(--bg-card)] rounded-[var(--radius-lg)]',
    'border border-[var(--border-light)]',
    'transition-[border-color,background-color,box-shadow] duration-200',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'hover:border-[var(--border)]',
        interactive: [
          // v5.1.0：hover 增加 shadow-soft 形成"微抬升"视觉
          'cursor-pointer',
          'hover:border-[var(--primary)] hover:bg-[var(--bg-elevated)]',
          'hover:shadow-[var(--shadow-soft)]',
          'active:opacity-95 active:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
        ].join(' '),
        ghost: 'bg-transparent border-transparent',
        accent: 'hover:border-[var(--border)]',
        // v5.1.0：cta —— 引导性空态 / 大型 CTA 卡；虚线 border + 中心对齐
        cta: [
          'border-dashed',
          'text-center',
          'cursor-pointer',
          'hover:border-[var(--primary)]',
          'hover:bg-[color-mix(in_srgb,var(--primary)_4%,var(--bg-card))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
        ].join(' '),
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
      },
    },
    defaultVariants: { variant: 'default', padding: 'md' },
  },
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** 仅 variant=accent 生效，左侧 3px 色条 */
  accentColor?: string
  /** 容器语义，默认 div；交互式 Card 建议 article / section */
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant, padding, accentColor, as: Comp = 'div', style, ...props },
    ref,
  ) => {
    const accentStyle: React.CSSProperties | undefined =
      variant === 'accent' && accentColor
        ? { ...style, borderLeft: `3px solid ${accentColor}` }
        : style

    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(cardVariants({ variant, padding }), className)}
        style={accentStyle}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'

/**
 * Card 内部语义区：Header（标题区）
 * 默认 flex（title 左、action 右），下方自带 12px margin-bottom
 */
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

/** CardTitle - 标题文案 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-base font-semibold text-[var(--text-primary)] leading-snug tracking-tight',
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

/** CardDescription - 描述副标题 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs leading-relaxed text-[var(--text-hint)] mt-0.5', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

/** CardContent - 正文区 */
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
))
CardContent.displayName = 'CardContent'

/** CardFooter - 底部操作区 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-2 mt-4 pt-3', className)}
    style={{ borderTop: '1px solid var(--border-light)' }}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { cardVariants }
