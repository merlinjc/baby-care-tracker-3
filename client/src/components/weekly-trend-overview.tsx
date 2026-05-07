/**
 * WeeklyTrendOverview - 发现页「上周 vs 本周」趋势总览
 *
 * 与记录页 `<InsightSection>` 差异化：
 * - 记录页：4 张精细卡，含范围条 / 日均 / 参考 / 环比 / 建议
 * - 发现页（本组件）：单张总览卡，每个维度展示「上周 vs 本周日均 + 对比箭头」，
 *   异常维度整行变色高亮；底部提供「向 AI 咨询建议」按钮，会带上结构化的趋势
 *   摘要跳转到 AI 助手页（路由 state，由 AI 助手页消费并自动发送）。
 */
import { Link, useNavigate } from 'react-router-dom'
import { Baby, Moon, Droplets, Thermometer, CheckCircle2, AlertTriangle, ChevronRight, Sparkles, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { WeeklyTrendData, WeeklyTrendDimension, WeeklyTrendStatus } from '@/types'

interface WeeklyTrendOverviewProps {
  trend: WeeklyTrendData | null
  isLoading?: boolean
  /** 点击「详情」的目标路由，默认 /record */
  detailUrl?: string
  /** 宝宝名（用于 AI 咨询时拼接更自然的问题；缺省 fallback 为「宝宝」） */
  babyName?: string | null
}

type Tone = 'normal' | 'warn' | 'danger'

function statusTone(status: WeeklyTrendStatus): Tone {
  switch (status) {
    case 'low':
    case 'high':
    case 'attention':
      return 'warn'
    case 'very_low':
    case 'very_high':
    case 'medical_attention':
      return 'danger'
    default:
      return 'normal'
  }
}

const STATUS_SHORT: Record<WeeklyTrendStatus, string> = {
  normal: '正常',
  low: '偏少',
  high: '偏多',
  very_low: '明显偏少',
  very_high: '明显偏多',
  attention: '需关注',
  medical_attention: '需就医',
  no_data: '无数据',
}

interface DimensionMeta {
  key: keyof Pick<WeeklyTrendData, 'feeding' | 'sleep' | 'diaper' | 'temperature'>
  label: string
  Icon: typeof Baby
  iconColor: string
  unit: string
}

const DIMENSIONS: DimensionMeta[] = [
  { key: 'feeding', label: '喂养', Icon: Baby, iconColor: 'var(--feeding)', unit: '次/日' },
  { key: 'sleep', label: '睡眠', Icon: Moon, iconColor: 'var(--sleep)', unit: 'h/日' },
  { key: 'diaper', label: '排便', Icon: Droplets, iconColor: 'var(--diaper)', unit: '次/日' },
  { key: 'temperature', label: '体温异常', Icon: Thermometer, iconColor: 'var(--temperature)', unit: '次/周' },
]

function toneColor(tone: Tone): string {
  switch (tone) {
    case 'warn':
      return 'var(--warning)'
    case 'danger':
      return 'var(--danger)'
    default:
      return 'var(--text-hint)'
  }
}

/** 计算环比箭头与色调（基于 lastWeekAvg vs thisWeekAvg） */
function computeDelta(thisAvg: number, lastAvg: number): {
  arrow: '↑' | '↓' | '→'
  pct: number | null
  /** 视觉色：变化幅度 ≤10% 视为持平，灰色 */
  color: string
} {
  if (lastAvg === 0 && thisAvg === 0) return { arrow: '→', pct: null, color: 'var(--text-hint)' }
  if (lastAvg === 0) return { arrow: '↑', pct: null, color: 'var(--text-hint)' }
  const pct = Math.round(((thisAvg - lastAvg) / lastAvg) * 100)
  const abs = Math.abs(pct)
  if (abs <= 10) return { arrow: '→', pct, color: 'var(--text-hint)' }
  return {
    arrow: pct > 0 ? '↑' : '↓',
    pct,
    color: pct > 0 ? 'var(--success)' : 'var(--warning)',
  }
}

function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(s)} – ${fmt(e)}`
}

function DimensionRow({ meta, data }: { meta: DimensionMeta; data: WeeklyTrendDimension }) {
  const tone = statusTone(data.status)
  const isAbnormal = tone !== 'normal'
  const toneC = toneColor(tone)
  const delta = computeDelta(data.thisWeekAvg, data.lastWeekAvg)

  return (
    <div
      className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-2 py-2 px-2 rounded-lg transition-colors"
      style={
        isAbnormal
          ? { backgroundColor: `color-mix(in srgb, ${toneC} 8%, transparent)` }
          : undefined
      }
    >
      {/* 指标名 + 图标 */}
      <div className="flex items-center gap-2 min-w-0">
        <meta.Icon className="h-4 w-4 shrink-0" style={{ color: meta.iconColor }} />
        <div className="min-w-0">
          <div className="body-md font-medium text-[var(--text-primary)] truncate">{meta.label}</div>
          <div
            className="text-[11px] mt-0.5 truncate"
            style={{ color: isAbnormal ? toneC : 'var(--text-hint)' }}
          >
            {STATUS_SHORT[data.status]}
          </div>
        </div>
      </div>

      {/* 上周 */}
      <div className="text-center">
        <div className="caption" style={{ color: 'var(--text-hint)' }}>
          上周
        </div>
        <div className="number-display body-md font-medium text-[var(--text-secondary)]">
          {data.lastWeekAvg}
          <span className="text-[10px] opacity-60 ml-0.5">{meta.unit}</span>
        </div>
      </div>

      {/* 本周 */}
      <div className="text-center">
        <div className="caption" style={{ color: 'var(--text-hint)' }}>
          本周
        </div>
        <div
          className="number-display body-md font-semibold"
          style={{ color: isAbnormal ? toneC : 'var(--text-primary)' }}
        >
          {data.thisWeekAvg}
          <span className="text-[10px] opacity-60 ml-0.5">{meta.unit}</span>
        </div>
      </div>

      {/* 对比箭头 */}
      <div
        className="text-[11px] number-display font-medium tabular-nums shrink-0 min-w-[40px] text-right"
        style={{ color: delta.color }}
        title={delta.pct === null ? '无对比基线' : `相比上周 ${delta.pct > 0 ? '+' : ''}${delta.pct}%`}
      >
        {delta.arrow}
        {delta.pct !== null && Math.abs(delta.pct) > 10 && (
          <span className="ml-0.5">{Math.abs(delta.pct)}%</span>
        )}
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <Card padding="sm" className="space-y-3" aria-busy>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
    </Card>
  )
}

/**
 * 把 trend 摘要拼成一个对 AI 友好的问题文本，方便 AI 助手直接给出建议。
 */
function buildAIPrompt(trend: WeeklyTrendData, babyName?: string | null): string {
  const subject = babyName?.trim() || '宝宝'
  const lines: string[] = []
  lines.push(`这是${subject}最近两周的护理趋势对比：`)

  if (trend.lastWeekPeriod) {
    lines.push(`【上周 ${formatRange(trend.lastWeekPeriod.start, trend.lastWeekPeriod.end)}】`)
  } else {
    lines.push('【上周】（无数据）')
  }
  lines.push(
    `- 喂养：日均 ${trend.feeding.lastWeekAvg} 次`,
    `- 睡眠：日均 ${trend.sleep.lastWeekAvg} 小时`,
    `- 排便：日均 ${trend.diaper.lastWeekAvg} 次`,
    `- 体温异常：${trend.temperature.lastWeekAvg} 次`,
  )

  lines.push(`【本周 ${formatRange(trend.period.start, trend.period.end)}】`)
  lines.push(
    `- 喂养：日均 ${trend.feeding.thisWeekAvg} 次（${STATUS_SHORT[trend.feeding.status]}）`,
    `- 睡眠：日均 ${trend.sleep.thisWeekAvg} 小时（${STATUS_SHORT[trend.sleep.status]}）`,
    `- 排便：日均 ${trend.diaper.thisWeekAvg} 次（${STATUS_SHORT[trend.diaper.status]}）`,
    `- 体温异常：${trend.temperature.thisWeekAvg} 次（${STATUS_SHORT[trend.temperature.status]}）`,
  )

  lines.push(`月龄：${trend.ageMonths} 个月。`)
  lines.push('请基于上周与本周的对比，给出 3 条具体可执行的护理建议，并指出是否有需要重点关注或就医的指标。')

  return lines.join('\n')
}

export function WeeklyTrendOverview({
  trend,
  isLoading,
  detailUrl = '/record',
  babyName,
}: WeeklyTrendOverviewProps) {
  const navigate = useNavigate()

  if (isLoading || !trend) {
    return <OverviewSkeleton />
  }

  // 统计偏离维度
  const abnormalDimensions = DIMENSIONS.filter((m) => statusTone(trend[m.key].status) !== 'normal')
  const abnormalCount = abnormalDimensions.length
  const HeaderIcon = abnormalCount === 0 ? CheckCircle2 : AlertTriangle
  const headerBadgeVariant: BadgeProps['variant'] =
    abnormalCount === 0 ? 'success' : abnormalCount >= 3 ? 'danger' : 'warning'
  const headerTone =
    abnormalCount === 0
      ? 'var(--success)'
      : abnormalCount >= 3
        ? 'var(--danger)'
        : 'var(--warning)'

  const askAI = () => {
    const prompt = buildAIPrompt(trend, babyName)
    navigate('/ai-assistant', { state: { autoPrompt: prompt } })
  }

  return (
    <Card padding="sm" className="space-y-3">
      {/* 头部：icon + 标题 + 偏离徽章 + 详情入口 */}
      <div className="flex items-center gap-2">
        <HeaderIcon className="h-4 w-4 shrink-0" style={{ color: headerTone }} />
        <span className="body-md font-medium text-[var(--text-primary)] flex-1">
          上周 vs 本周
        </span>
        <Badge size="sm" variant={headerBadgeVariant}>
          {abnormalCount === 0 ? '状态良好' : `${abnormalCount} 项偏离`}
        </Badge>
        <Link
          to={detailUrl}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium shrink-0 hover:underline"
          style={{ color: 'var(--primary)' }}
          aria-label="查看本周趋势详情"
        >
          详情
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* 时间窗副标题 */}
      <div className="flex items-center gap-2 caption" style={{ color: 'var(--text-hint)' }}>
        <span>
          上周 {trend.lastWeekPeriod
            ? formatRange(trend.lastWeekPeriod.start, trend.lastWeekPeriod.end)
            : '—'}
        </span>
        <ArrowRight className="h-3 w-3 opacity-50" />
        <span>本周 {formatRange(trend.period.start, trend.period.end)}</span>
      </div>

      {/* 4 维度对比行 */}
      <div className="space-y-1">
        {DIMENSIONS.map((meta) => (
          <DimensionRow key={meta.key} meta={meta} data={trend[meta.key]} />
        ))}
      </div>

      {/* 异常维度提示（最多一条） */}
      {abnormalDimensions[0] && trend[abnormalDimensions[0].key].tip && (
        <p
          className="body-sm leading-snug line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
          title={trend[abnormalDimensions[0].key].tip}
        >
          <span className="font-medium">{abnormalDimensions[0].label}：</span>
          {trend[abnormalDimensions[0].key].tip}
        </p>
      )}

      {/* 向 AI 咨询建议 */}
      <Button
        type="button"
        variant="primary"
        size="sm"
        block
        onClick={askAI}
        accentColor="var(--sleep)"
        leftIcon={<Sparkles className="h-3.5 w-3.5" />}
        rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
      >
        基于趋势向 AI 咨询建议
      </Button>
    </Card>
  )
}
