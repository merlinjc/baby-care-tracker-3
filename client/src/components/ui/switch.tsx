/**
 * Switch - 开关组件
 *
 * 基于 @radix-ui/react-switch。对标 shadcn/ui。
 *
 * - 受控：value={checked} onChange={setChecked}
 * - 非受控：defaultChecked
 * - size: sm / md
 * - 颜色：on=var(--primary) / off=var(--border)
 *
 * 典型用法（替代 Login 页"记住我"的原生 checkbox）：
 *   <Switch checked={rememberMe} onCheckedChange={setRememberMe} />
 */
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const switchRootVariants = cva(
  [
    'peer inline-flex shrink-0 items-center rounded-full',
    'cursor-pointer transition-colors',
    'bg-[var(--border)]',
    'data-[state=checked]:bg-[var(--primary)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-4 w-7',
        md: 'h-5 w-9',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

const switchThumbVariants = cva(
  [
    'pointer-events-none block rounded-full bg-white shadow-sm',
    'transition-transform duration-150',
    'data-[state=unchecked]:translate-x-0.5',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-3 w-3 data-[state=checked]:translate-x-[0.875rem]',
        md: 'h-4 w-4 data-[state=checked]:translate-x-[1.125rem]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface SwitchProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
      'className'
    >,
    VariantProps<typeof switchRootVariants> {
  className?: string
}

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(switchRootVariants({ size }), className)}
    {...props}
  >
    <SwitchPrimitive.Thumb className={switchThumbVariants({ size })} />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export { switchRootVariants }
