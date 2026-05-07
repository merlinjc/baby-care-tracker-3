/**
 * QuotaBar - AI 配额条（FR-F3）
 *
 * 两种展现：
 * - variant='bar'（默认）：完整横条带进度条 —— 用于页面主要位置
 * - variant='badge'：紧凑徽章 —— 嵌入 header 右上角
 *
 * 剩余 < 5 时变橙；剩余 0 时变红 + 提示
 *
 * v5.0.1 Batch 3：badge 模式用 <Badge>，bar 模式用 <Progress accentColor>。
 */
import { Sparkles } from 'lucide-react'
import type { AIQuotaStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface QuotaBarProps {
  quota: AIQuotaStatus | null
  isLoading?: boolean
  variant?: 'bar' | 'badge'
}

export function QuotaBar({ quota, isLoading, variant = 'bar' }: QuotaBarProps) {
  if (isLoading || !quota) {
    if (variant === 'badge') {
      return (
        <Badge size="sm" variant="ghost" icon={<Sparkles className="h-3 w-3" />}>
          配额…
        </Badge>
      )
    }
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-hint)]">
        <Sparkles className="h-3 w-3" />
        加载配额…
      </div>
    )
  }

  const percent =
    quota.dailyLimit > 0 ? Math.max(0, quota.remaining) / quota.dailyLimit : 0
  const isLow = quota.remaining < 5
  const isExhausted = quota.remaining === 0
  const color = isExhausted
    ? 'var(--danger)'
    : isLow
      ? 'var(--warning)'
      : 'var(--primary)'

  if (variant === 'badge') {
    return (
      <Badge
        size="sm"
        accentColor={color}
        icon={<Sparkles className="h-3 w-3" />}
        title={
          isExhausted
            ? '今日配额已用完，请明天再试'
            : `今日剩余 ${quota.remaining} / ${quota.dailyLimit}`
        }
      >
        <span className="number-display">
          {quota.remaining}
          <span className="opacity-70">/{quota.dailyLimit}</span>
        </span>
      </Badge>
    )
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      <Sparkles className="h-4 w-4 shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color }}>
            今日剩余配额：
            <span className="font-semibold ml-0.5">{quota.remaining}</span>
            <span className="text-[var(--text-hint)] ml-1">/ {quota.dailyLimit}</span>
          </span>
          {isExhausted && (
            <span className="text-xs" style={{ color }}>
              请明天再试
            </span>
          )}
        </div>
        <Progress
          value={Math.round(percent * 100)}
          max={100}
          size="sm"
          accentColor={color}
          className="mt-1.5"
        />
      </div>
    </div>
  )
}
