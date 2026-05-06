/**
 * TodaySummary - 4 列进度条摘要（FR-A3）
 *
 * 列：feeding（次数/8）/ sleep（时长/月龄目标）/ diaper（次数/6）/ temperature（最新值，无进度条）
 * - 点击任一列调用对应回调（推荐打开对应 Dialog）
 * - 体温 ≥38.5 整列变红 + 顶部警示横条由父组件渲染
 * - 睡眠列右上角支持嵌入「开始/结束」实时计时按钮（v4.3.2）：
 *   传入 `sleepActive` 时显示「结束」按钮，否则显示「开始」按钮；
 *   点击按钮不会触发卡片本身的 onSelect。
 */
import { Baby, Moon, Droplets, Thermometer, Play, Square } from 'lucide-react'
import type { TodayStats } from '@/types'
import { cn } from '@/lib/utils'
import { computeDailyGoals } from '@/lib/age-goals'

interface TodaySummaryProps {
  stats: TodayStats
  birthDateIso?: string
  onSelect?: (key: 'feeding' | 'sleep' | 'diaper' | 'temperature') => void
  /** 是否存在进行中睡眠（用于切换按钮形态） */
  sleepActive?: boolean
  /** 是否允许写操作（viewer / 未授权时为 false，按钮禁用） */
  canControlSleep?: boolean
  /** 点击睡眠卡片右上角按钮：开始计时 */
  onStartSleep?: () => void
  /** 点击睡眠卡片右上角按钮：结束计时 */
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
  const tempColor =
    tempValue == null
      ? 'var(--temperature)'
      : tempValue >= 38.5
        ? 'var(--danger)'
        : tempValue >= 37.5
          ? 'var(--warning)'
          : 'var(--temperature)'

  const items = [
    {
      key: 'feeding' as const,
      label: '喂养',
      Icon: Baby,
      value: stats.feeding.count,
      detail:
        stats.feeding.totalAmount > 0
          ? `共 ${stats.feeding.totalAmount}ml`
          : `目标 ${goals.feeding} 次`,
      progress: Math.min(1, stats.feeding.count / goals.feeding),
      color: 'var(--feeding)',
      showProgress: true,
    },
    {
      key: 'sleep' as const,
      label: '睡眠',
      Icon: Moon,
      value: formatSleepDuration(stats.sleep.totalDuration),
      detail: `共 ${stats.sleep.count} 次`,
      progress: Math.min(1, stats.sleep.totalDuration / goals.sleep),
      color: 'var(--sleep)',
      showProgress: true,
      isText: true,
    },
    {
      key: 'diaper' as const,
      label: '换尿布',
      Icon: Droplets,
      value: stats.diaper.count,
      detail: `尿 ${stats.diaper.peeCount} / 便 ${stats.diaper.poopCount}`,
      progress: Math.min(1, stats.diaper.count / goals.diaper),
      color: 'var(--diaper)',
      showProgress: true,
    },
    {
      key: 'temperature' as const,
      label: '体温',
      Icon: Thermometer,
      value: tempValue != null ? `${tempValue}°C` : '--',
      detail:
        tempValue == null
          ? '尚未测量'
          : tempValue >= 38.5
            ? '发烧'
            : tempValue >= 37.5
              ? '低烧'
              : '正常',
      progress: 0,
      color: tempColor,
      showProgress: false,
      isText: true,
    },
  ]

  const showFeverWarning = tempValue != null && tempValue >= 38.5

  return (
    <div className="space-y-2">
      {showFeverWarning && (
        <div
          className="rounded-lg px-3 py-2 text-xs flex items-center gap-2 animate-fade-in"
          style={{
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
            color: 'var(--danger)',
          }}
          role="alert"
        >
          <Thermometer className="h-3.5 w-3.5 shrink-0" />
          宝宝体温偏高，请注意观察
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const isSleep = item.key === 'sleep'
          const showSleepAction = isSleep && (onStartSleep || onEndSleep)
          return (
            <div
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(item.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(item.key)
                }
              }}
              className={cn(
                'card-base text-left flex flex-col gap-2 transition-all hover:border-[var(--primary)]',
                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40',
              )}
              style={{ borderTop: `3px solid ${item.color}` }}
            >
              <div className="flex items-center justify-between">
                <span className="caption">{item.label}</span>
                {showSleepAction ? (
                  <button
                    type="button"
                    disabled={!canControlSleep}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (sleepActive) onEndSleep?.()
                      else onStartSleep?.()
                    }}
                    title={sleepActive ? '结束当前睡眠' : '开始睡眠计时'}
                    aria-label={sleepActive ? '结束当前睡眠' : '开始睡眠计时'}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity',
                      'disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-85',
                    )}
                    style={{
                      backgroundColor: sleepActive
                        ? 'var(--danger)'
                        : `color-mix(in srgb, ${item.color} 18%, transparent)`,
                      color: sleepActive ? '#FFFFFF' : item.color,
                    }}
                  >
                    {sleepActive ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        结束
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" />
                        开始
                      </>
                    )}
                  </button>
                ) : (
                  <item.Icon className="h-4 w-4" style={{ color: item.color }} />
                )}
              </div>
              <div
                className="flex items-baseline number-display font-bold"
                style={{ minHeight: 32, color: item.color }}
              >
                <span className="text-2xl leading-none">{item.value}</span>
              </div>
              <div className="caption text-[var(--text-hint)]">{item.detail}</div>
              {item.showProgress && (
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${Math.round(item.progress * 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
