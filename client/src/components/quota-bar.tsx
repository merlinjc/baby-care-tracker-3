/**
 * QuotaBar - AI 配额条（FR-F3）
 *
 * 显示剩余配额：x / Y。剩余 < 5 时变橙；剩余 0 时变红 + 提示
 */
import { Sparkles } from 'lucide-react'
import type { AIQuotaStatus } from '@/types'

interface QuotaBarProps {
  quota: AIQuotaStatus | null
  isLoading?: boolean
}

export function QuotaBar({ quota, isLoading }: QuotaBarProps) {
  if (isLoading || !quota) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-hint)]">
        <Sparkles className="h-3 w-3" />
        加载配额…
      </div>
    )
  }

  const percent = quota.dailyLimit > 0 ? Math.max(0, quota.remaining) / quota.dailyLimit : 0
  const isLow = quota.remaining < 5
  const isExhausted = quota.remaining === 0
  const color = isExhausted
    ? 'var(--danger)'
    : isLow
      ? 'var(--warning)'
      : 'var(--primary)'

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
        <div className="mt-1.5 h-1 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round(percent * 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    </div>
  )
}
