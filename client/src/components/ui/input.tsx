/**
 * Input v7 - iOS Health 风输入框
 *
 * iOS 特征：
 * - 浅灰底 (surface-2) + 无可见边框（聚焦才出现）
 * - 圆角 14px
 * - focus 状态：底色略深 + 2px 外阴影（替代边框 + ring 组合）
 *
 * 保留旧 API：leftIcon/rightIcon/accentColor/variant/size/wrapperClassName
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const inputWrapperVariants = cva(
  [
    'flex items-center gap-2 w-full rounded-[var(--radius-md)]',
    'transition-[background-color,box-shadow] duration-[150ms]',
    'has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--surface-2)]',
          'focus-within:bg-[var(--surface-1)]',
          'focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--brand)_50%,transparent)]',
        ].join(' '),
        warning: [
          'bg-[var(--warning-bg)]',
          'focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--warning)_60%,transparent)]',
        ].join(' '),
        danger: [
          'bg-[var(--danger-bg)]',
          'focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--danger)_60%,transparent)]',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-11 px-4 text-[15px]',
        lg: 'h-12 px-4 text-[17px]',
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
  wrapperClassName?: string
  /** 聚焦时左侧色条（业务类型色，如 var(--feeding)） */
  accentColor?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, wrapperClassName, variant, size, leftIcon, rightIcon, accentColor, style, ...props },
    ref,
  ) => {
    const textColorStyle: React.CSSProperties | undefined =
      variant === 'danger'
        ? { color: 'var(--danger)' }
        : variant === 'warning'
          ? { color: 'var(--warning)' }
          : undefined

    return (
      <div
        className={cn(
          inputWrapperVariants({ variant, size }),
          'group/input relative',
          wrapperClassName,
        )}
      >
        {/* 聚焦时左侧色条 */}
        {accentColor && (
          <span
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full',
              'transition-[height] duration-[200ms] ease-[var(--ease-ios)]',
              'h-0 group-focus-within/input:h-[60%]',
            )}
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />
        )}
        {leftIcon && (
          <span className="shrink-0 text-[var(--label-tertiary)] inline-flex items-center" aria-hidden>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none border-none p-0',
            'text-[var(--label)] placeholder:text-[var(--label-tertiary)]',
            'disabled:cursor-not-allowed',
            className,
          )}
          style={{ ...textColorStyle, ...style }}
          {...props}
        />
        {rightIcon && (
          <span className="shrink-0 text-[var(--label-tertiary)] inline-flex items-center" aria-hidden>
            {rightIcon}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { inputWrapperVariants }
