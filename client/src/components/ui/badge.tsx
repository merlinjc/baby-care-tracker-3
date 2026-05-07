/**
 * Badge - 小型徽章 Primitive
 *
 * 对标 shadcn/ui 的 `badge.tsx`，扩展了 5 个记录类型色与 4 个语义色。
 *
 * Size：
 * - xs (10px)：列表角标、"自费/当前/逾期"等装饰性短文字
 * - sm (12px)：主要分类标签
 * - md (14px)：可读性优先场景
 *
 * Variant（语义色）：
 * - default                 灰底中性
 * - primary                 米色
 * - feeding/sleep/diaper/temperature/growth  记录类型色
 * - success/warning/danger/info  语义色
 * - outline                 仅描边
 * - ghost                   透明底仅文字
 *
 * Tone（v5.1.0 新增 · 对比度调节）：
 * - soft（默认）             color-mix 14% 底 + 类型色文字（适合装饰）
 * - solid                   纯类型色背景 + 白色文字（适合强调，如未读数 / 严重警示）
 * - outline                 透明 + 1px 类型色边 + 类型色文字（适合 meta）
 * - 注意：tone 仅对类型色 / 语义色 variant 生效；default / outline / ghost variant 自身已是特定 tone
 *
 * 字体 xl 档可读性优化：xs 尺寸在 [data-font-scale='xl'] 下自动放大到 12px（见 globals.css）。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { withIconSize, type IconSize } from '@/lib/icon-size'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded-full whitespace-nowrap',
    'font-medium leading-tight',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-light)]',
        primary:
          'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary-dark)]',
        feeding:
          'bg-[color-mix(in_srgb,var(--feeding)_15%,transparent)] text-[var(--feeding)]',
        sleep:
          'bg-[color-mix(in_srgb,var(--sleep)_15%,transparent)] text-[var(--sleep)]',
        diaper:
          'bg-[color-mix(in_srgb,var(--diaper)_18%,transparent)] text-[color-mix(in_srgb,var(--diaper)_80%,black)]',
        temperature:
          'bg-[color-mix(in_srgb,var(--temperature)_15%,transparent)] text-[var(--temperature)]',
        growth:
          'bg-[color-mix(in_srgb,var(--growth)_15%,transparent)] text-[var(--growth)]',
        success:
          'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]',
        warning:
          'bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]',
        danger:
          'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]',
        info:
          'bg-[color-mix(in_srgb,var(--info)_15%,transparent)] text-[var(--info)]',
        outline:
          'border border-[var(--border)] text-[var(--text-secondary)] bg-transparent',
        ghost: 'text-[var(--text-secondary)] bg-transparent',
      },
      size: {
        xs: 'badge-xs text-[10px] px-1.5 py-0.5 font-mono tabular-nums',
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
      },
      interactive: {
        true: [
          'cursor-pointer select-none',
          'hover:opacity-80 active:opacity-70',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
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

type BadgeTone = 'soft' | 'solid' | 'outline'

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 自定义前缀 icon（lucide 或其它 SVG） */
  icon?: React.ReactNode
  /**
   * 当使用 custom 类型色时（不在 variant 枚举里），可直接传 accentColor，
   * 内部会覆盖 backgroundColor + color。
   */
  accentColor?: string
  /**
   * v5.1.0：tone 调节 —— 只影响"类型色 / 语义色 variant 与 accentColor"的呈现。
   * 'soft' 默认（color-mix 底色）；'solid' 纯色 + 白字；'outline' 透明 + 描边。
   */
  tone?: BadgeTone
  /** 可访问性：interactive=true 时建议传（否则默认 span 不可 focus） */
  'aria-pressed'?: boolean
}

/** 哪些 variant 是"类型/语义色"，可以接受 tone 切换 */
const TONABLE_VARIANTS = new Set([
  'primary',
  'feeding',
  'sleep',
  'diaper',
  'temperature',
  'growth',
  'success',
  'warning',
  'danger',
  'info',
])

/** variant 到 CSS 变量的映射，供 tone=solid/outline 直接读色 */
const VARIANT_COLOR: Record<string, string> = {
  primary: 'var(--primary)',
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

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      interactive,
      tone = 'soft',
      icon,
      accentColor,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    /** 解析有效色：accentColor > VARIANT_COLOR[variant] > undefined（保留 cva 默认） */
    const resolvedColor = accentColor ?? (variant ? VARIANT_COLOR[variant] : undefined)
    const isTonable = !!resolvedColor && (
      !!accentColor || (variant ? TONABLE_VARIANTS.has(variant) : false)
    )

    /** 根据 tone 算出 inline style；soft 优先用 cva 内置（除非自定义 accentColor） */
    const customStyle: React.CSSProperties | undefined = (() => {
      if (!isTonable) return style
      if (tone === 'solid') {
        return {
          ...style,
          backgroundColor: resolvedColor,
          color: '#fff',
          borderColor: 'transparent',
        }
      }
      if (tone === 'outline') {
        return {
          ...style,
          backgroundColor: 'transparent',
          color: resolvedColor,
          borderColor: `color-mix(in srgb, ${resolvedColor} 50%, transparent)`,
          borderWidth: 1,
          borderStyle: 'solid',
        }
      }
      // soft：仅当传了自定义 accentColor 时才覆盖（不传则保留 cva 默认）
      if (accentColor) {
        return {
          ...style,
          backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
          color: accentColor,
        }
      }
      return style
    })()

    // v5.1.0：根据 badge size 自动推导图标尺寸（xs→xs / sm→xs / md→sm）
    const iconSize: IconSize = size === 'md' ? 'sm' : 'xs'
    const sizedIcon = withIconSize(icon, iconSize)

    return (
      <span
        ref={ref}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        data-tone={tone}
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
