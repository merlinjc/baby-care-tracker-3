/**
 * ReportAiSummary - 报告的 AI 总结段
 *
 * 交互策略：
 * - 默认**不自动请求**，用户点按"让 AI 写一段本期总结"再触发一次 chat，避免每次打开报告页都扣配额
 * - 生成失败 / 配额耗尽 → 不拦截整页，只降级为"跳 AI 助手详聊"
 * - 成功的总结 session 内缓存（不持久化），避免重复点击重复扣配额
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';import { aiService } from '@/services/ai'
import { toast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import type { Baby } from '@/types'
import type { ReportData } from '@/hooks/use-report-data'

interface ReportAiSummaryProps {
  baby: Baby
  data: ReportData
}

/** 基于报告数据构造对 AI 友好的 prompt */
function buildReportPrompt(baby: Baby, data: ReportData): string {
  const periodLabel = data.period === 'week' ? '本周' : '本月'
  const m = data.metrics
  const lines: string[] = []
  lines.push(
    `这是${baby.name}${periodLabel}的护理数据总结（${data.range.label}，共 ${data.range.days} 天）：`,
    `- 喂养：${m.feeding.count} 次${m.feeding.totalAmount > 0 ? `（共 ${m.feeding.totalAmount}ml）` : ''}，日均 ${(m.feeding.count / data.range.days).toFixed(1)} 次`,
    `- 睡眠：共 ${(m.sleep.totalDurationSec / 3600).toFixed(1)} 小时，${m.sleep.count} 段`,
    `- 排便：${m.diaper.count} 次（尿 ${m.diaper.peeCount} / 便 ${m.diaper.poopCount}）`,
    `- 体温：记录 ${m.temperature.count} 次${m.temperature.abnormalCount > 0 ? `，其中 ${m.temperature.abnormalCount} 次 ≥37.5°C` : '，均正常'}`,
  )
  if (data.growth.end) {
    const g = data.growth.end
    const parts: string[] = []
    if (g.weightKg != null) parts.push(`体重 ${g.weightKg}kg`)
    if (g.heightCm != null) parts.push(`身高 ${g.heightCm}cm`)
    if (g.headCircumferenceCm != null) parts.push(`头围 ${g.headCircumferenceCm}cm`)
    if (parts.length) lines.push(`- 最新体测：${parts.join(' / ')}`)
  }
  if (data.milestones.length > 0) {
    lines.push(`- 里程碑：${periodLabel}新达成 ${data.milestones.length} 项`)
  }
  if (data.vaccines.length > 0) {
    lines.push(`- 疫苗：${periodLabel}接种 ${data.vaccines.length} 针`)
  }
  lines.push(
    '',
    `请用 3 段简洁的自然语言总结${periodLabel}宝宝的护理情况：`,
    '1) 整体状态（1 句话）；',
    '2) 值得肯定的亮点（1 条）；',
    '3) 需要关注或改进的地方（1 条具体可执行的建议）。',
    '不要输出 Markdown 标记，不要列点，每段 30-60 字。',
  )
  return lines.join('\n')
}

export function ReportAiSummary({ baby, data }: ReportAiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleGenerate = async () => {
    if (isLoading || summary) return
    setIsLoading(true)
    try {
      const prompt = buildReportPrompt(baby, data)
      const res = await aiService.chat(
        [{ role: 'user', content: prompt }],
        baby.id,
      )
      setSummary(res.content.trim())
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '生成失败，请稍后再试'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAskMore = () => {
    const prompt = buildReportPrompt(baby, data)
    navigate('/ai-assistant', { state: { autoPrompt: prompt } })
  }

  return (
    <Card
      padding="md"
      variant="glass"
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <div
          className="icon-circle"
          style={{
            width: 28,
            height: 28,
            backgroundColor: 'color-mix(in srgb, var(--sleep) 16%, transparent)',
            color: 'var(--sleep)',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="body-md font-medium text-[var(--text-primary)] flex-1">
          AI 总结
        </span>
      </div>

      {summary ? (
        <p
          className="body-md whitespace-pre-wrap leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          {summary}
        </p>
      ) : (
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          让 AI 基于本期数据，为你写一段简短的护理总结与建议。
        </p>
      )}

      <div className="flex gap-2">
        {!summary && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors disabled:opacity-60"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--sleep) 16%, transparent)',
              color: 'var(--sleep)',
              border: '1px solid color-mix(in srgb, var(--sleep) 28%, transparent)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在生成…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                生成 AI 总结
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={handleAskMore}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
        >
          去 AI 助手详聊
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  )
}
