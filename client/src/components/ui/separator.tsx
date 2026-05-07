/**
 * Separator - 分隔线
 *
 * 基于 @radix-ui/react-separator（自动 aria-orientation / role="separator"）。
 *
 * 用法：
 *   <Separator />                         // 水平实线
 *   <Separator variant="dashed" />        // 水平虚线
 *   <Separator orientation="vertical" />  // 垂直
 *   <Separator label="或" />              // 带居中文案（水平时）
 */
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const separatorLineVariants = cva('shrink-0', {
  variants: {
    orientation: {
      horizontal: 'w-full h-px',
      vertical: 'h-full w-px',
    },
    variant: {
      solid: 'bg-[var(--border)]',
      dashed:
        'bg-[linear-gradient(90deg,var(--border)_0_50%,transparent_50%_100%)] bg-[length:8px_1px]',
      light: 'bg-[var(--border-light)]',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'solid' },
})

interface SeparatorProps
  extends VariantProps<typeof separatorLineVariants> {
  /** 可选文字标签，只在 horizontal 下生效 */
  label?: React.ReactNode
  className?: string
  decorative?: boolean
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', variant, label, className, decorative = true }, ref) => {
    if (label && orientation === 'horizontal') {
      return (
        <div
          ref={ref}
          className={cn('flex items-center gap-3', className)}
          role={decorative ? undefined : 'separator'}
          aria-hidden={decorative ? true : undefined}
        >
          <div className={separatorLineVariants({ orientation, variant })} />
          <span className="text-xs shrink-0 text-[var(--text-hint)]">{label}</span>
          <div className={separatorLineVariants({ orientation, variant })} />
        </div>
      )
    }

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        orientation={orientation ?? 'horizontal'}
        decorative={decorative}
        className={cn(separatorLineVariants({ orientation, variant }), className)}
      />
    )
  },
)
Separator.displayName = 'Separator'

export { separatorLineVariants }
