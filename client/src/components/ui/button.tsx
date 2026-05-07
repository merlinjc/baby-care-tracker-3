/**
 * Button - 统一按钮 Primitive
 *
 * Variant：
 * - 'primary' (default)  主操作 / 品牌色 var(--primary)
 * - 'secondary'          次操作（描边）
 * - 'ghost'              低调/可切换；active 时自动填充
 * - 'outline'            通用描边按钮
 * - 'danger'             危险主按钮 var(--danger)
 * - 'danger-outline'     危险描边
 * - 'link'               纯文字链接
 *
 * Size：xs (h-7) / sm (h-8) / md (h-10, 默认) / lg (h-12) / icon (h-9 w-9)
 *
 * 规范化：
 * - 所有 variant 与 size 通过 CVA 管理
 * - 自动 focus-visible ring（无障碍）
 * - disabled 自动降透明 + not-allowed
 * - loading 时内部自动显示 spinner（不占位替换）
 * - leftIcon / rightIcon slot 省去每次手写 gap + icon
 *
 * 对标 shadcn/ui 的 `button.tsx`，但样式底层全部走 CSS 变量，与美拉德色系一致。
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { deriveIconSize, withIconSize, type IconSize } from '@/lib/icon-size'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium',
    'transition-colors shrink-0 whitespace-nowrap',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
    'focus-visible:ring-[var(--primary)]/40',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'text-white bg-[var(--primary)] hover:opacity-85 active:opacity-75',
        secondary: [
          'bg-[var(--bg-card)] text-[var(--text-secondary)]',
          'border border-[var(--border)]',
          'hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--bg-elevated)]',
        ].join(' '),
        ghost: [
          'border border-[var(--border-light)] bg-[var(--bg-card)]',
          'text-[var(--text-secondary)]',
          'hover:text-[var(--text-primary)] hover:border-[var(--border)]',
          'data-[active=true]:text-white data-[active=true]:border-transparent',
        ].join(' '),
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        danger: 'text-white bg-[var(--danger)] hover:opacity-85 active:opacity-75',
        'danger-outline': [
          'border bg-transparent text-[var(--danger)]',
          'border-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
          'hover:bg-[color-mix(in_srgb,var(--danger)_5%,transparent)]',
        ].join(' '),
        link: 'text-[var(--primary-dark)] hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs gap-1',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
        icon: 'h-9 w-9 p-0',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /**
   * 覆盖主色（仅 variant=primary/danger 时生效，通过 inline style 直接写 backgroundColor）
   * 用于 record 类型色主按钮等业务场景；避免为每种颜色都新增 variant。
   */
  accentColor?: string
  /**
   * ghost variant 的 active 态（类似 aria-pressed）
   * 会加 backgroundColor = accentColor (或 primary)
   */
  active?: boolean
  /**
   * v5.1.0：图标尺寸覆盖。默认根据 button size 自动推导：
   *  - xs/sm → sm (14px)
   *  - md    → md (16px)
   *  - lg    → lg (20px)
   *  - icon  → md (16px)
   * 用户传入了显式尺寸 className 的图标会被尊重，不会被覆盖。
   */
  iconSize?: IconSize
}

/**
 * 内置 spinner（复用 globals.css .spinner--sm）
 */
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
      children,
      type = 'button',
      style,
      ...props
    },
    ref,
  ) => {
    // 计算 inline style：只有 accentColor 存在且匹配的 variant 才覆盖
    const inlineStyle: React.CSSProperties | undefined = (() => {
      if (!accentColor) return style
      if (variant === 'primary' || variant === 'danger') {
        return { ...style, backgroundColor: accentColor }
      }
      if (variant === 'ghost' && active) {
        return { ...style, backgroundColor: accentColor }
      }
      return style
    })()

    // v5.1.0：自动给图标注入尺寸（仅当用户未显式写 h-/w- 时）
    const resolvedIconSize = iconSize ?? deriveIconSize(size)
    const sizedLeftIcon = withIconSize(leftIcon, resolvedIconSize)
    const sizedRightIcon = withIconSize(rightIcon, resolvedIconSize)

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-active={active ? 'true' : undefined}
        className={cn(buttonVariants({ variant, size, block }), className)}
        style={inlineStyle}
        {...props}
      >
        {loading ? <ButtonSpinner /> : sizedLeftIcon}
        {children}
        {!loading && sizedRightIcon}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
