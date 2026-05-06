/**
 * InsightFallback - 本地规则引擎产出每日洞察（FR-A4 / FR-F2 降级）
 *
 * 与后端 ai.service.buildFallbackInsight 保持一致逻辑（双端对齐）。
 * AI 服务不可用 / 配额耗尽 / 网络异常时由前端就地产出，UI 标注「快速模式」。
 */
import type { TodayStats, DailyInsight } from '@/types'

export function buildFallbackInsight(stats: TodayStats): DailyInsight {
  const messages: string[] = []
  const suggestions: string[] = []
  const alerts: string[] = []

  if (stats.feeding.count === 0) {
    messages.push('今日尚未记录喂养')
    suggestions.push('建议按时喂养，并在每次喂养后记录')
  } else {
    const total = stats.feeding.totalAmount
    messages.push(
      `今日已喂养 ${stats.feeding.count} 次${total > 0 ? `，共 ${total}ml` : ''}`,
    )
  }

  if (stats.sleep.totalDuration > 0) {
    const h = Math.floor(stats.sleep.totalDuration / 3600)
    const m = Math.round((stats.sleep.totalDuration % 3600) / 60)
    messages.push(`总睡眠 ${h}h ${m}m`)
  }

  if (stats.diaper.count > 0) {
    messages.push(`换尿布 ${stats.diaper.count} 次`)
  }

  if (stats.temperature.latestValue !== null) {
    const t = stats.temperature.latestValue
    if (t >= 38.5) {
      alerts.push(`最新体温 ${t}°C 偏高，请密切观察`)
    } else if (t >= 37.5) {
      alerts.push(`最新体温 ${t}°C 偏高，可能为低烧`)
    }
  }

  return {
    summary: messages.join('，') || '今日尚未添加任何记录',
    suggestions,
    alerts,
    source: 'fallback',
  }
}

export function isInsightEmpty(insight: DailyInsight | null | undefined): boolean {
  if (!insight) return true
  return (
    !insight.summary &&
    insight.suggestions.length === 0 &&
    insight.alerts.length === 0
  )
}
