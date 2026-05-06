/**
 * StatusCapsule - 首页状态胶囊（FR-A1）
 *
 * 4 种态：
 * - none：今天还没有记录
 * - sleeping：正在睡觉 · Xh Ym + [结束] 按钮 + 录制指示灯
 * - feeding_ago：上次喂养 Xh Ym 前
 * - sleep_abnormal：睡眠时间异常 + [取消计时] 按钮（红色）
 */
import { useEffect, useState } from 'react'
import { Moon, Coffee, AlertTriangle, Sparkles } from 'lucide-react'
import type { CareRecord, TodayStats } from '@/types'
import { cn } from '@/lib/utils'
import {
  buildCapsuleText,
  computeCapsuleState,
  type CapsuleState,
} from '@/lib/capsule-state'

interface StatusCapsuleProps {
  stats: TodayStats | null
  activeSleep: CareRecord | null
  babyName?: string
  onEndSleep?: () => void
  onCancelAbnormal?: () => void
}

export function StatusCapsule({
  stats,
  activeSleep,
  babyName,
  onEndSleep,
  onCancelAbnormal,
}: StatusCapsuleProps) {
  // 文案需根据当前时间实时更新（每 60s 重新计算 Xh Ym）
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!activeSleep && !stats?.feeding.lastTimeTs) return
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [activeSleep, stats?.feeding.lastTimeTs])

  const state = computeCapsuleState(stats, activeSleep)
  const text = buildCapsuleText(state, stats, activeSleep, babyName)

  if (state === 'none') {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 16%, transparent)',
        }}
      >
        <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
        <span className="body-md flex-1 text-[var(--text-secondary)]">{text}</span>
      </div>
    )
  }

  const styleMap: Record<Exclude<CapsuleState, 'none'>, { bg: string; color: string; Icon: typeof Moon }> = {
    sleeping: { bg: 'var(--sleep)', color: '#3D2D5A', Icon: Moon },
    feeding_ago: { bg: 'var(--feeding)', color: '#2D5A2D', Icon: Coffee },
    sleep_abnormal: { bg: 'var(--danger)', color: '#FFFFFF', Icon: AlertTriangle },
  }
  const { bg, color, Icon } = styleMap[state]

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors',
        'animate-fade-in',
      )}
      style={{
        background: `color-mix(in srgb, ${bg} 14%, var(--bg-card))`,
        border: `1px solid color-mix(in srgb, ${bg} 24%, transparent)`,
      }}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: bg }} />
      <span className="body-md flex-1" style={{ color: 'var(--text-primary)' }}>
        {text}
      </span>

      {state === 'sleeping' && (
        <>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: '#E85454',
              animation: 'recPulse 1.5s ease-in-out infinite',
            }}
            aria-label="正在记录"
          />
          {onEndSleep && (
            <button
              onClick={onEndSleep}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: bg, color }}
            >
              结束
            </button>
          )}
        </>
      )}

      {state === 'sleep_abnormal' && onCancelAbnormal && (
        <button
          onClick={onCancelAbnormal}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: '#FFFFFF', color: 'var(--danger)' }}
        >
          取消计时
        </button>
      )}
    </div>
  )
}
