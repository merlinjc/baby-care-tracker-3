/**
 * Input - 统一输入框 Primitive
 *
 * 对标 shadcn/ui 的 `input.tsx`；关键差异：
 * - 颜色 token 走 var(--*)（与美拉德系适配）
 * - 三种语义 variant：default / warning / danger（替代 TemperatureDialog 里手写的 inline style 切色）
 * - leftIcon / rightIcon slot（类似右侧 "°C" 单位、左侧搜索图标）
 * - size: sm / md / lg（md 为默认，与旧 .input-base 等价）
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const inputWrapperVariants = cva(
  [
    'flex items-center gap-2 w-full rounded-md',
    'bg-[var(--bg-primary)]',
    'transition-[border-color,box-shadow] duration-150',
    'focus-within:ring-[3px] focus-within:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]',
    'has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border border-[var(--border)] focus-within:border-[var(--primary)]',
        warning:
          'border border-[var(--warning)] focus-within:border-[var(--warning)]',
        danger:
          'border border-[var(--danger)] focus-within:border-[var(--danger)]',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-10 px-3 text-sm',
        lg: 'h-12 px-3.5 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputWrapperVariants> {
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** 容器 className（影响 wrapper，如宽度） */
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      variant,
      size,
      leftIcon,
      rightIcon,
      style,
      ...props
    },
    ref,
  ) => {
    // variant=warning/danger 时同步 text color
    const textColorStyle: React.CSSProperties | undefined =
      variant === 'danger'
        ? { color: 'var(--danger)' }
        : variant === 'warning'
          ? { color: 'var(--warning)' }
          : undefined

    return (
      <div className={cn(inputWrapperVariants({ variant, size }), wrapperClassName)}>
        {leftIcon && (
          <span
            className="shrink-0 text-[var(--text-hint)] inline-flex items-center"
            aria-hidden
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none border-none',
            'text-[var(--text-primary)] placeholder:text-[var(--text-hint)]',
            'disabled:cursor-not-allowed',
            // 消除浏览器默认 padding；已由 wrapper padding 控制
            'p-0',
            className,
          )}
          style={{ ...textColorStyle, ...style }}
          {...props}
        />
        {rightIcon && (
          <span
            className="shrink-0 text-[var(--text-hint)] inline-flex items-center"
            aria-hidden
          >
            {rightIcon}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { inputWrapperVariants }
