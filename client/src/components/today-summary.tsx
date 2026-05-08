/**
 * TodaySummary v7 — iOS Health 风今日指标卡（2×2 格）
 *
 * 关键变化（相对 v6）：
 * - 从 4 列并排改为 2×2 网格（更接近 iOS Health 的 Summary 布局）
 * - 每格 iOS tinted 风：浅底色（--feeding-bg 等）+ 深色主字 + 柔和副字
 * - 大数字用 metric-md (22px SF Rounded)，去掉 Progress 条（iOS Health 风不用）
 * - 睡眠计时按钮：放在 "睡眠" 卡片右下角，圆形 icon button
 * - 发烧预警：整卡背景变 --danger-bg + 主字变 --danger-fg
 * - 卡片入场：staggerCompact
 */
import { motion } from 'framer-motion'
import type { ComponentType, SVGProps } from 'react'
import { Baby as BabyIcon, Droplets, Moon, Play, Square, Thermometer } from 'lucide-react';import type { TodayStats } from '@/types'
import { staggerContainer, staggerItem, pressableSubtle } from '@/lib/motion'
import { computeDailyGoals } from '@/lib/age-goals'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface TodaySummaryProps {
  stats: TodayStats
  birthDateIso?: string
  onSelect?: (key: 'feeding' | 'sleep' | 'diaper' | 'temperature') => void
  sleepActive?: boolean
  canControlSleep?: boolean
  onStartSleep?: () => void
  onEndSleep?: () => void
}

function formatSleepDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function TodaySummary({
  stats,
  birthDateIso,
  onSelect,
  sleepActive = false,
  canControlSleep = true,
  onStartSleep,
  onEndSleep,
}: TodaySummaryProps) {
  const goals = computeDailyGoals(birthDateIso)
  const tempValue = stats.temperature.latestValue

  // 体温预警级别
  const tempLevel =
    tempValue == null
      ? 'normal'
      : tempValue >= 38.5
        ? 'danger'
        : tempValue >= 37.5
          ? 'warning'
          : 'normal'

  type Item = {
    key: 'feeding' | 'sleep' | 'diaper' | 'temperature'
    label: string
    Icon: IconComponent
    mainValue: string
    subValue: string
    bg: string // --feeding-bg / --sleep-bg / ...
    fg: string // --feeding-fg / --sleep-fg / ...
    accent: string // --feeding / --sleep / ... (图标+按钮色)
  }

  const items: Item[] = [
    {
      key: 'feeding',
      label: '喂养',
      Icon: BabyIcon,
      mainValue: `${stats.feeding.count}`,
      subValue:
        stats.feeding.totalAmount > 0
          ? `共 ${stats.feeding.totalAmount} ml`
          : `目标 ${goals.feeding} 次`,
      bg: 'var(--feeding-bg)',
      fg: 'var(--feeding-fg)',
      accent: 'var(--feeding)',
    },
    {
      key: 'sleep',
      label: '睡眠',
      Icon: Moon,
      mainValue: formatSleepDuration(stats.sleep.totalDuration),
      subValue: `共 ${stats.sleep.count} 次`,
      bg: 'var(--sleep-bg)',
      fg: 'var(--sleep-fg)',
      accent: 'var(--sleep)',
    },
    {
      key: 'diaper',
      label: '尿布',
      Icon: Droplets,
      mainValue: `${stats.diaper.count}`,
      subValue: `尿 ${stats.diaper.peeCount} · 便 ${stats.diaper.poopCount}`,
      bg: 'var(--diaper-bg)',
      fg: 'var(--diaper-fg)',
      accent: 'var(--diaper)',
    },
    {
      key: 'temperature',
      label: '体温',
      Icon: Thermometer,
      mainValue: tempValue != null ? `${tempValue}°` : '—',
      subValue:
        tempValue == null
          ? '尚未测量'
          : tempLevel === 'danger'
            ? '发烧'
            : tempLevel === 'warning'
              ? '低烧'
              : '正常',
      bg: tempLevel === 'danger' ? 'var(--danger-bg)' : tempLevel === 'warning' ? 'var(--warning-bg)' : 'var(--temperature-bg)',
      fg: tempLevel === 'danger' ? 'var(--temperature-fg)' : tempLevel === 'warning' ? 'var(--diaper-fg)' : 'var(--temperature-fg)',
      accent: tempLevel === 'danger' ? 'var(--danger)' : tempLevel === 'warning' ? 'var(--warning)' : 'var(--temperature)',
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 gap-3"
      data-today-summary
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {items.map((item) => {
        const isSleep = item.key === 'sleep'
        const showSleepAction = isSleep && (onStartSleep || onEndSleep)

        return (
          <motion.div
            key={item.key}
            variants={staggerItem}
            data-today-card
            className={cn(
              'relative overflow-hidden',
              'rounded-[var(--radius-lg)]',
              'p-4 cursor-pointer select-none min-w-0',
              'transition-shadow duration-200',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
            )}
            style={{ backgroundColor: item.bg }}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.(item.key)
              }
            }}
            whileTap={pressableSubtle.whileTap}
            transition={pressableSubtle.transition}
          >
            {/* Header: label + icon */}
            <div className="flex items-center justify-between mb-3 min-w-0 gap-2">
              <span
                className="text-[13px] font-semibold truncate"
                style={{ color: item.fg, opacity: 0.8 }}
              >
                {item.label}
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${item.accent} 18%, transparent)`,
                }}
              >
                <item.Icon
                  className="h-4 w-4"
                  style={{ color: item.accent }}
                />
              </div>
            </div>

            {/* Main value */}
            <div
              className="metric-lg mb-1 truncate"
              style={{ color: item.fg }}
            >
              {item.mainValue}
            </div>

            {/* Sub value */}
            <div
              className="text-[12px] font-medium truncate"
              style={{ color: item.fg, opacity: 0.7 }}
            >
              {item.subValue}
            </div>

            {/* Sleep action button — 右下角悬浮 */}
            {showSleepAction && (
              <motion.button
                type="button"
                disabled={!canControlSleep}
                onClick={(e) => {
                  e.stopPropagation()
                  if (sleepActive) onEndSleep?.()
                  else onStartSleep?.()
                }}
                className={cn(
                  'absolute bottom-3 right-3',
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'shadow-[var(--shadow-sm)]',
                  'transition-opacity disabled:opacity-40',
                  'focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
                )}
                style={{
                  backgroundColor: sleepActive ? 'var(--danger)' : item.accent,
                  color: '#fff',
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                aria-label={sleepActive ? '结束睡眠' : '开始睡眠'}
                title={sleepActive ? '结束当前睡眠' : '开始睡眠计时'}
              >
                {sleepActive ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </motion.button>
            )}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
