/**
 * FormField - <Label> + control + error 的组合壳
 *
 * 把散落在各表单中的：
 *   <div>
 *     <label className="label-base">...</label>
 *     <input className="input-base" />
 *     {err && <p style={{color:'var(--danger)'}}>{err}</p>}
 *   </div>
 *
 * 收敛为：
 *   <FormField label="..." error={err} required>
 *     <Input ... />
 *   </FormField>
 *
 * 仅做布局聚合，不管理表单状态（state 交给业务层或未来引入的 react-hook-form）。
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps {
  /** 字段标签，留空时不渲染 Label */
  label?: ReactNode
  /** for/htmlFor，关联到子控件的 id */
  htmlFor?: string
  /** 必填标记 */
  required?: boolean
  /** 错误文案，存在时整行变红 */
  error?: string
  /** 辅助提示文案（无错误时显示） */
  hint?: string
  /** 子控件（Input / Textarea / SegmentedControl 等） */
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    // v5.0.0+：label 与控件之间由 space-y-1(4px) 升级到 space-y-2(8px)；
    // 外加 data-form-field 钩子 + globals.css 兜底，避免 Tailwind 4 JIT 漏扫。
    <div data-form-field className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs leading-tight" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-tight text-[var(--text-hint)]">{hint}</p>
      ) : null}
    </div>
  )
}
