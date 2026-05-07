/**
 * TodaySummary - 4 列进度条摘要（FR-A3）
 *
 * 列：feeding（次数/8）/ sleep（时长/月龄目标）/ diaper（次数/6）/ temperature（最新值，无进度条）
 * - 点击任一列调用对应回调（推荐打开对应 Dialog）
 * - 体温 ≥38.5 整列变红 + 顶部警示横条由父组件渲染
 * - 睡眠列右上角支持嵌入「开始/结束」实时计时按钮（v4.3.2）：
 *   传入 `sleepActive` 时显示「结束」按钮，否则显示「开始」按钮；
 *   点击按钮不会触发卡片本身的 onSelect。
 *
 * v5.0.1 Batch 3：
 * - 4 格容器 `.card-base` → `<Card variant="accent" accentColor>`
 * - 睡眠开始/结束按钮 → `<Button size="xs">`
 * - 条形进度 `.progress-bar` → `<Progress accentColor size="sm">`
 * - 发烧警示条 → `<Alert variant="danger" size="compact">`
 */
import { Baby, Moon, Droplets, Thermometer, Play, Square } from 'lucide-react'
import type { TodayStats } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert } from '@/components/ui/alert'
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
        <Alert
          variant="danger"
          size="compact"
          icon={<Thermometer className="h-3.5 w-3.5" />}
          className="animate-fade-in"
        >
          宝宝体温偏高，请注意观察
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => {
          const isSleep = item.key === 'sleep'
          const showSleepAction = isSleep && (onStartSleep || onEndSleep)
          return (
            <Card
              key={item.key}
              variant="accent"
              accentColor={item.color}
              padding="sm"
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(item.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(item.key)
                }
              }}
              className="cursor-pointer flex flex-col gap-2.5 transition-all hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
              // accent 在左侧 3px，这里用 borderTop 代替（保持旧视觉）
              style={{ borderLeft: 'none', borderTop: `3px solid ${item.color}` }}
            >
              <div className="flex items-center justify-between">
                <span className="caption">{item.label}</span>
                {showSleepAction ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    disabled={!canControlSleep}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (sleepActive) onEndSleep?.()
                      else onStartSleep?.()
                    }}
                    title={sleepActive ? '结束当前睡眠' : '开始睡眠计时'}
                    aria-label={sleepActive ? '结束当前睡眠' : '开始睡眠计时'}
                    accentColor={
                      sleepActive
                        ? 'var(--danger)'
                        : `color-mix(in srgb, ${item.color} 18%, transparent)`
                    }
                    className="rounded-full"
                    style={{ color: sleepActive ? '#FFFFFF' : item.color }}
                    leftIcon={
                      sleepActive ? (
                        <Square className="h-3 w-3 fill-current" />
                      ) : (
                        <Play className="h-3 w-3 fill-current" />
                      )
                    }
                  >
                    {sleepActive ? '结束' : '开始'}
                  </Button>
                ) : (
                  <item.Icon className="h-4 w-4" style={{ color: item.color }} />
                )}
              </div>
              <div
                className="flex items-baseline display-number"
                style={{ minHeight: 32, color: item.color }}
              >
                <span className="text-2xl leading-none">{item.value}</span>
              </div>
              <div className="caption text-[var(--text-hint)]">{item.detail}</div>
              {item.showProgress && (
                <Progress
                  value={Math.round(item.progress * 100)}
                  max={100}
                  size="sm"
                  accentColor={item.color}
                />
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
