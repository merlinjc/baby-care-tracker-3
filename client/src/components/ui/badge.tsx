/**
 * Badge v7 - iOS Health 风徽章
 *
 * 重写重点：颜色体系全部走 bg/fg 分组色（--feeding-bg + --feeding-fg），
 * 替代旧的 color-mix 方案。对比度更好，视觉更明确。
 *
 * Variant：
 * - default          中性灰（surface-2 + label-secondary）
 * - primary/brand    品牌色
 * - feeding/sleep/diaper/temperature/growth  业务色
 * - success/warning/danger/info  语义色
 * - outline / ghost  透明变体
 *
 * Tone（v7 规范）：
 * - filled-light（默认）：--*-bg 底 + --*-fg 字
 * - filled-solid：类型色实底 + 白字
 * - outline：透明 + 类型色边与字
 *
 * Size：xs (10) / sm (12) / md (14)
 *
 * 兼容旧 v6 gradient-* / glass variant（降级为实色）。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { withIconSize, type IconSize } from '@/lib/icon-size'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 shrink-0',
    'rounded-full whitespace-nowrap',
    'font-medium leading-tight',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-2)] text-[var(--label-secondary)]',
        primary: 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-ink)]',
        brand: 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-ink)]',

        feeding: 'bg-[var(--feeding-bg)] text-[var(--feeding-fg)]',
        sleep: 'bg-[var(--sleep-bg)] text-[var(--sleep-fg)]',
        diaper: 'bg-[var(--diaper-bg)] text-[var(--diaper-fg)]',
        temperature: 'bg-[var(--temperature-bg)] text-[var(--temperature-fg)]',
        growth: 'bg-[var(--growth-bg)] text-[var(--growth-fg)]',

        success: 'bg-[var(--success-bg)] text-[var(--feeding-fg)]',
        warning: 'bg-[var(--warning-bg)] text-[var(--diaper-fg)]',
        danger: 'bg-[var(--danger-bg)] text-[var(--temperature-fg)]',
        info: 'bg-[var(--info-bg)] text-[var(--growth-fg)]',

        outline: 'border border-[var(--border-default)] text-[var(--label-secondary)] bg-transparent',
        ghost: 'text-[var(--label-secondary)] bg-transparent',

        // v6 兼容（降级为实色纯底）
        'gradient-primary': 'text-white bg-[var(--brand)]',
        'gradient-feeding': 'text-white bg-[var(--feeding)]',
        'gradient-sleep': 'text-white bg-[var(--sleep)]',
        'gradient-diaper': 'text-white bg-[var(--diaper)]',
        'gradient-temperature': 'text-white bg-[var(--temperature)]',
        'gradient-growth': 'text-white bg-[var(--growth)]',
        glass: 'bg-[var(--surface-2)] text-[var(--label)] border border-[var(--separator)]',
      },
      size: {
        xs: 'badge-xs text-[10px] px-1.5 py-0.5 font-mono tabular-nums',
        sm: 'text-[11px] px-2 py-0.5',
        md: 'text-[13px] px-2.5 py-1',
      },
      interactive: {
        true: [
          'cursor-pointer select-none',
          'hover:opacity-80 active:opacity-70',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
        ].join(' '),
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      interactive: false,
    },
  },
)

type BadgeTone = 'filled-light' | 'filled-solid' | 'outline' | 'soft' | 'solid'

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  /** 自定义色：覆盖 variant 的色方案（backgroundColor/color 根据 tone 计算） */
  accentColor?: string
  /**
   * Tone：
   * - 'filled-light'（默认）：柔和底 + 深色字
   * - 'filled-solid'：类型色实底 + 白字
   * - 'outline'：透明 + 类型色字与边
   * - 'soft' / 'solid'：v5 兼容，等价 filled-light / filled-solid
   */
  tone?: BadgeTone
  'aria-pressed'?: boolean
}

const TONABLE = new Set([
  'primary', 'brand',
  'feeding', 'sleep', 'diaper', 'temperature', 'growth',
  'success', 'warning', 'danger', 'info',
])

const VARIANT_COLOR: Record<string, string> = {
  primary: 'var(--brand)',
  brand: 'var(--brand)',
  feeding: 'var(--feeding)',
  sleep: 'var(--sleep)',
  diaper: 'var(--diaper)',
  temperature: 'var(--temperature)',
  growth: 'var(--growth)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

function normalizeTone(t: BadgeTone | undefined): 'filled-light' | 'filled-solid' | 'outline' {
  if (t === 'soft') return 'filled-light'
  if (t === 'solid') return 'filled-solid'
  return t ?? 'filled-light'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant, size, interactive, tone, icon, accentColor, style, children, ...props },
    ref,
  ) => {
    const t = normalizeTone(tone)
    const resolvedColor = accentColor ?? (variant ? VARIANT_COLOR[variant] : undefined)
    const isTonable = !!resolvedColor && (!!accentColor || (variant ? TONABLE.has(variant) : false))

    const customStyle: React.CSSProperties | undefined = (() => {
      if (!isTonable) return style
      if (t === 'filled-solid') {
        return {
          ...style,
          backgroundColor: resolvedColor,
          color: '#fff',
          borderColor: 'transparent',
        }
      }
      if (t === 'outline') {
        return {
          ...style,
          backgroundColor: 'transparent',
          color: resolvedColor,
          borderColor: `color-mix(in srgb, ${resolvedColor} 50%, transparent)`,
          borderWidth: 1,
          borderStyle: 'solid',
        }
      }
      // filled-light：只有自定义 accentColor 时才覆盖（否则走 cva 默认）
      if (accentColor) {
        return {
          ...style,
          backgroundColor: `color-mix(in srgb, ${accentColor} 14%, var(--surface-1))`,
          color: accentColor,
        }
      }
      return style
    })()

    const iconSize: IconSize = size === 'md' ? 'sm' : 'xs'
    const sizedIcon = withIconSize(icon, iconSize)

    return (
      <span
        ref={ref}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        data-tone={t}
        className={cn(badgeVariants({ variant, size, interactive }), className)}
        style={customStyle}
        {...props}
      >
        {sizedIcon}
        {children}
      </span>
    )
  },
)
Badge.displayName = 'Badge'

export { badgeVariants }
