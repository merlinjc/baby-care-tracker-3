/**
 * HeaderAction - 统一的页面右上角操作按钮
 *
 * 三种 variant：
 * - 'primary'：突出主操作（如「添加」），背景 var(--primary)
 * - 'secondary'：次要操作（描边按钮）
 * - 'ghost'：低调入口（如「标准计划」），无背景的 chip 样式
 *
 * 配合 <PageHeader action={...} /> 使用。
 */
import type { ReactNode, MouseEventHandler } from 'react'
import { cn } from '@/lib/utils'

interface HeaderActionProps {
  icon?: ReactNode
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  /** 自定义主色（仅 primary 时影响背景；ghost 时影响 hover 边框） */
  accentColor?: string
  /** 已激活态（仅 ghost variant 生效，例如「筛选」开关） */
  active?: boolean
  /** 可访问标签（label 已存在时通常不需要） */
  ariaLabel?: string
}

export function HeaderAction({
  icon,
  label,
  variant = 'primary',
  onClick,
  disabled,
  accentColor,
  active,
  ariaLabel,
}: HeaderActionProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed'

  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        className={cn(base, 'h-8 px-3 text-xs text-white')}
        style={{
          backgroundColor: accentColor ?? 'var(--primary)',
          letterSpacing: 'var(--tracking-wide)',
        }}
      >
        {icon}
        {label}
      </button>
    )
  }

  if (variant === 'secondary') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        className={cn(
          base,
          'h-8 px-3 text-xs',
          'border border-[var(--border)] bg-[var(--bg-card)]',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]',
        )}
      >
        {icon}
        {label}
      </button>
    )
  }

  // ghost
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      className={cn(
        base,
        'h-8 px-3 text-xs',
        active
          ? 'text-white'
          : 'border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]',
      )}
      style={
        active
          ? { backgroundColor: accentColor ?? 'var(--primary)' }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  )
}
