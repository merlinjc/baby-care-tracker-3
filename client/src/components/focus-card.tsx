/**
 * FocusCard - 发现页聚焦卡片
 *
 * 动态展示"最紧急事项"：优先级 overdue > upcoming > encouragement。
 * 左侧 3px 色条 + 图标 + 标题 + 描述 + 右侧跳转指示。
 *
 * 点击整卡跳转到 targetUrl 或触发 onClick。
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FocusUrgency = 'overdue' | 'upcoming' | 'normal'

interface FocusCardProps {
  urgency: FocusUrgency
  title: string
  description: string
  icon?: ReactNode
  /** 跳转路由；传 targetUrl 则渲染为可跳转卡 */
  targetUrl?: string
  onClick?: () => void
  /** 可选右上角标签文案（例如"1 项逾期"） */
  badge?: string
}

const urgencyColor: Record<FocusUrgency, string> = {
  overdue: 'var(--danger)',
  upcoming: 'var(--warning)',
  normal: 'var(--success)',
}

const urgencyLabel: Record<FocusUrgency, string> = {
  overdue: '需处理',
  upcoming: '即将到来',
  normal: '进展顺利',
}

export function FocusCard({
  urgency,
  title,
  description,
  icon,
  targetUrl,
  onClick,
  badge,
}: FocusCardProps) {
  const navigate = useNavigate()
  const color = urgencyColor[urgency]

  const handleClick = () => {
    if (onClick) onClick()
    else if (targetUrl) navigate(targetUrl)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'card-interactive w-full flex items-center gap-3 text-left',
        'transition-transform hover:-translate-y-px',
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {icon && (
        <div
          className="icon-circle icon-circle--md shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="body-md font-medium text-[var(--text-primary)] truncate">{title}</span>
          <span
            className="badge-mini"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
              color,
            }}
          >
            {badge ?? urgencyLabel[urgency]}
          </span>
        </div>
        <p className="caption mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-hint)' }} />
    </button>
  )
}
