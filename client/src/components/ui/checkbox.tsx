/**
 * Checkbox - 复选框
 *
 * 基于 @radix-ui/react-checkbox。对标 shadcn/ui。
 *
 * - 受控：checked={v} onCheckedChange={setV}
 * - 支持 `indeterminate` 三态
 * - 键盘 A11y：Space 切换；radix 自动 aria-checked
 */
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const checkboxVariants = cva(
  [
    'peer shrink-0 rounded border-2 bg-transparent',
    'transition-colors cursor-pointer',
    'border-[var(--border)]',
    'data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]',
    'data-[state=indeterminate]:bg-[var(--primary)] data-[state=indeterminate]:border-[var(--primary)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface CheckboxProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
      'className'
    >,
    VariantProps<typeof checkboxVariants> {
  className?: string
}

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxVariants({ size }), className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount
      className="flex items-center justify-center text-white"
    >
      {props.checked === 'indeterminate' ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'

export { checkboxVariants }
