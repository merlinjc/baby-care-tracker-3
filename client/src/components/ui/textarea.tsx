/**
 * Textarea - 多行输入 Primitive
 *
 * 对标 shadcn/ui 的 `textarea.tsx`。
 * - 默认 rows=3
 * - autoResize=true 时自动根据内容扩展（max-h 限制 + overflow-auto）
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, useEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const textareaVariants = cva(
  [
    'block w-full rounded-md resize-none',
    'bg-[var(--bg-primary)] text-[var(--text-primary)]',
    'placeholder:text-[var(--text-hint)]',
    'outline-none transition-[border-color,box-shadow] duration-150',
    'focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border border-[var(--border)] focus:border-[var(--primary)]',
        warning:
          'border border-[var(--warning)] focus:border-[var(--warning)]',
        danger:
          'border border-[var(--danger)] focus:border-[var(--danger)]',
      },
      size: {
        sm: 'px-2.5 py-2 text-xs',
        md: 'px-3 py-2.5 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof textareaVariants> {
  autoResize?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, autoResize, rows = 3, value, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    // 合并 ref
    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    }

    useEffect(() => {
      if (!autoResize || !innerRef.current) return
      const el = innerRef.current
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 300)}px`
    }, [value, autoResize])

    return (
      <textarea
        ref={setRef}
        rows={rows}
        value={value}
        className={cn(textareaVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { textareaVariants }
