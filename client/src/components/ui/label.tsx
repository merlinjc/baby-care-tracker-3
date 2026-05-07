/**
 * Label - 表单字段标签
 *
 * 对标 shadcn/ui 的 `label.tsx`（但我们不依赖 @radix-ui/react-label，原生 <label> 足够）。
 * - required=true 时追加红色 `*`
 * - 统一样式与旧 `.label-base` 一致，但组件化后自动随字体档位变化
 */
import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-xs font-medium text-[var(--text-secondary)] mb-1',
        'tracking-wide',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span
          className="ml-0.5"
          style={{ color: 'var(--danger)' }}
          aria-hidden
        >
          *
        </span>
      )}
    </label>
  ),
)
Label.displayName = 'Label'
