/**
 * FocusCard - 发现页聚焦卡片
 *
 * 动态展示"最紧急事项"：优先级 overdue > upcoming > encouragement。
 * 左侧 3px 色条 + 图标 + 标题 + 描述 + 右侧跳转指示。
 *
 * v5.0.1 Batch 3：
 * - 外层 `.card-interactive` + inline borderLeft → `<Card variant="accent" accentColor>`
 * - 右上角徽章 → `<Badge size="xs">`（根据 urgency 映射 variant）
 * - 保持"点击整卡"交互（以及 Enter/Space 键盘可达）
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'

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

const URGENCY_COLOR: Record<FocusUrgency, string> = {
  overdue: 'var(--danger)',
  upcoming: 'var(--warning)',
  normal: 'var(--success)',
}

const URGENCY_BADGE_VARIANT: Record<FocusUrgency, BadgeProps['variant']> = {
  overdue: 'danger',
  upcoming: 'warning',
  normal: 'success',
}

const URGENCY_LABEL: Record<FocusUrgency, string> = {
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
  const color = URGENCY_COLOR[urgency]

  const handleClick = () => {
    if (onClick) onClick()
    else if (targetUrl) navigate(targetUrl)
  }

  return (
    <Card
      as="article"
      variant="accent"
      accentColor={color}
      padding="md"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className="cursor-pointer w-full flex items-center gap-3 text-left transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
    >
      {icon && (
        <div
          className="icon-circle icon-circle--md shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            color,
          }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="body-md font-medium text-[var(--text-primary)] truncate">
            {title}
          </span>
          <Badge size="xs" variant={URGENCY_BADGE_VARIANT[urgency]}>
            {badge ?? URGENCY_LABEL[urgency]}
          </Badge>
        </div>
        <p className="caption mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-hint)' }} />
    </Card>
  )
}
