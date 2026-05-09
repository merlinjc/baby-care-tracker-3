/**
 * FocusCard v7.1 - iOS Hero 风聚焦卡（视觉层次微调）
 *
 * v7.1 改动：
 * - icon 与文字间距 gap-3 → gap-3.5（更呼吸）
 * - 标题与描述行间距 mt-0.5 → mt-1（4px，避免标题压描述）
 * - 描述 truncate → line-clamp-2（长文案优雅折行而非截断）
 * - 卡片内 padding md → 上下各 +2px（更稳重）
 */
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { pressableSubtle } from '@/lib/motion'

export type FocusUrgency = 'overdue' | 'upcoming' | 'normal'

interface FocusCardProps {
  urgency: FocusUrgency
  title: string
  description: string
  icon?: ReactNode
  targetUrl?: string
  onClick?: () => void
  badge?: string
}

const URGENCY_CONFIG: Record<
  FocusUrgency,
  { color: string; bg: string; fg: string; badge: BadgeProps['variant'] }
> = {
  overdue: {
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
    fg: 'var(--danger-fg)',
    badge: 'danger',
  },
  upcoming: {
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    fg: 'var(--warning-fg)',
    badge: 'warning',
  },
  normal: {
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    fg: 'var(--success-fg)',
    badge: 'success',
  },
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
  const cfg = URGENCY_CONFIG[urgency]

  const handleClick = () => {
    if (onClick) onClick()
    else if (targetUrl) navigate(targetUrl)
  }

  return (
    <motion.div whileTap={pressableSubtle.whileTap} transition={pressableSubtle.transition}>
      <Card
        as="article"
        variant="tinted"
        tintColor={cfg.color}
        padding="none"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        className="cursor-pointer w-full flex items-center gap-3.5 text-left px-5 py-3.5 sm:px-6 sm:py-4 focus-visible:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: cfg.bg,
        }}
        data-focus-card
      >
        {icon && (
          <div
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `color-mix(in srgb, ${cfg.color} 22%, transparent)`,
              color: cfg.fg,
            }}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="headline truncate" style={{ color: cfg.fg }}>
              {title}
            </span>
            <Badge size="xs" variant={cfg.badge}>
              {badge ?? URGENCY_LABEL[urgency]}
            </Badge>
          </div>
          <p
            className="footnote mt-1"
            style={{
              color: cfg.fg,
              opacity: 0.78,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0"
          style={{ color: cfg.fg, opacity: 0.55 }}
        />
      </Card>
    </motion.div>
  )
}
