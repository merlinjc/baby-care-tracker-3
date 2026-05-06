/**
 * PageHeader - 通用页面标题组件（FR-D1）
 *
 * 结构：80px 渐变图标 + 标题 + 副标题 + 右侧 action（如「管理」按钮）
 * 用于 RecordPage（FR-D1）、未来其他列表页可复用
 */
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** 标题文案 */
  title: string
  /** 副标题文案（FR-D1.AC2 动态构建） */
  subtitle?: string
  /** 左侧图标（lucide icon） */
  icon?: ReactNode
  /** 图标背景色（CSS 变量） */
  accentColor?: string
  /** 右侧操作按钮（如「管理」/「取消」） */
  action?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  icon,
  accentColor = 'var(--primary)',
  action,
}: PageHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 md:px-6 py-4 md:py-6">
      {icon && (
        <div
          className="rounded-2xl shrink-0 flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, transparent), color-mix(in srgb, ${accentColor} 8%, transparent))`,
            color: accentColor,
          }}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="heading-lg text-[var(--text-primary)] truncate">{title}</h1>
        {subtitle && (
          <p className="body-md text-[var(--text-hint)] truncate mt-0.5" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
