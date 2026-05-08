/**
 * StatusCapsule v7 — iOS 风状态 Hero 卡片
 *
 * 关键变化：
 * - 去掉"窄条幅"形态，升级为独立 Hero Card（大圆角 + 浅色底）
 * - 4 种状态：none（问候）/ sleeping（正在睡眠）/ feeding_ago（上次喂养）/ sleep_abnormal（异常）
 * - 使用 --*-bg tinted 底色 + 深色前景，完全对齐 iOS Health 情绪卡风格
 * - sleeping 态附带 呼吸灯（pulse-soft）替代原 breathe-glow
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Coffee, Moon, Sparkles } from 'lucide-react'
import type { CareRecord, TodayStats } from '@/types'
import { Button } from '@/components/ui/button'
import {
  buildCapsuleText,
  computeCapsuleState,
  type CapsuleState,
} from '@/lib/capsule-state'
import { cn } from '@/lib/utils'

interface StatusCapsuleProps {
  stats: TodayStats | null
  activeSleep: CareRecord | null
  babyName?: string
  onEndSleep?: () => void
  onCancelAbnormal?: () => void
}

type StyleConfig = {
  bg: string
  fg: string
  accent: string
  Icon: typeof Moon
  label: string
}

const styleMap: Record<CapsuleState, StyleConfig> = {
  none: {
    bg: 'var(--brand-soft)',
    fg: 'var(--brand-ink)',
    accent: 'var(--brand)',
    Icon: Sparkles,
    label: '今日问候',
  },
  sleeping: {
    bg: 'var(--sleep-bg)',
    fg: 'var(--sleep-fg)',
    accent: 'var(--sleep)',
    Icon: Moon,
    label: '睡眠中',
  },
  feeding_ago: {
    bg: 'var(--feeding-bg)',
    fg: 'var(--feeding-fg)',
    accent: 'var(--feeding)',
    Icon: Coffee,
    label: '刚刚喂养',
  },
  sleep_abnormal: {
    bg: 'var(--danger-bg)',
    fg: 'var(--temperature-fg)',
    accent: 'var(--danger)',
    Icon: AlertTriangle,
    label: '异常',
  },
}

export function StatusCapsule({
  stats,
  activeSleep,
  babyName,
  onEndSleep,
  onCancelAbnormal,
}: StatusCapsuleProps) {
  // 每 60s 重新计算 Xh Ym
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!activeSleep && !stats?.feeding.lastTimeTs) return
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [activeSleep, stats?.feeding.lastTimeTs])

  const state = computeCapsuleState(stats, activeSleep)
  const text = buildCapsuleText(state, stats, activeSleep, babyName)
  const { bg, fg, accent, Icon, label } = styleMap[state]
  const isSleeping = state === 'sleeping'
  const isAbnormal = state === 'sleep_abnormal'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      data-status-capsule
      className={cn(
        'relative overflow-hidden',
        'rounded-[var(--radius-xl)]',
      )}
      style={{ backgroundColor: bg, padding: '20px' }}
    >
      {/* 背景装饰光晕（仅 sleeping 态） */}
      {isSleeping && (
        <div
          aria-hidden
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 blur-2xl"
          style={{ backgroundColor: accent }}
        />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <motion.div
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 20%, transparent)` }}
          animate={isSleeping ? { opacity: [0.7, 1, 0.7] } : {}}
          transition={isSleeping ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-semibold mb-1"
            style={{ color: fg, opacity: 0.7 }}
          >
            {label}
          </div>
          <div
            className="text-[16px] font-semibold leading-snug"
            style={{ color: fg }}
          >
            {text}
          </div>

          {/* Action buttons */}
          {(isSleeping && onEndSleep) || (isAbnormal && onCancelAbnormal) ? (
            <div className="mt-3">
              {isSleeping && onEndSleep && (
                <Button
                  variant="filled"
                  size="sm"
                  onClick={onEndSleep}
                  accentColor={accent}
                  className="rounded-full px-4"
                >
                  结束睡眠
                </Button>
              )}
              {isAbnormal && onCancelAbnormal && (
                <Button
                  variant="destructive-plain"
                  size="sm"
                  onClick={onCancelAbnormal}
                  className="rounded-full px-4 bg-white/90"
                >
                  取消计时
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
