/**
 * PageHeader - 通用页面头部组件
 *
 * Variant：
 * - 'sub'（默认）：子页头部，左侧返回键 + 标题（+可选 icon/副标题）+ 右侧 action
 * - 'tab'：Tab 主页头部，无返回键，标题更显眼，可选副标题 + 右侧 action
 *
 * 子页推荐：set `showBack` + `backTo`
 * Tab 主页（record/discover/profile）：set `variant="tab"`
 */
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** 标题文案 */
  title: string
  /** 副标题文案 */
  subtitle?: string
  /** Variant，默认 'sub'（子页样式） */
  variant?: 'sub' | 'tab'
  /** 子页：是否显示返回按钮（默认 true） */
  showBack?: boolean
  /** 返回路由（默认 '/profile'） */
  backTo?: string
  /** 左侧装饰图标（仅 tab variant 显示，sub variant 默认不渲染避免视觉过重） */
  icon?: ReactNode
  /** 图标背景色（CSS 变量），仅 tab variant 生效 */
  accentColor?: string
  /** 右侧操作按钮（如「添加」/「筛选」） */
  action?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  variant = 'sub',
  showBack = true,
  backTo = '/profile',
  icon,
  accentColor = 'var(--primary)',
  action,
}: PageHeaderProps) {
  if (variant === 'tab') {
    return (
      <header className="flex items-center gap-3 py-1">
        {icon && (
          <div
            className="rounded-2xl shrink-0 flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
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

  // sub variant
  return (
    <header className="flex items-center gap-3 py-1">
      {showBack && (
        <Link
          to={backTo}
          aria-label="返回"
          className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="heading-lg text-[var(--text-primary)] truncate">{title}</h1>
        {subtitle && (
          <p className="body-sm text-[var(--text-hint)] truncate mt-0.5" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
