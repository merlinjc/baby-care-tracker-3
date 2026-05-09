/**
 * Timeline v7 — iOS 风时间线
 *
 * 关键变化：
 * - 从"圆点+连接线"改为 ListRow 风格（左色条 + 图标 + 标题副标题 + 右时间）
 * - 使用 ios-list 分隔线（hairline）
 * - 记录卡入场 stagger 动效
 * - 类型 Badge 统一使用 v7 分组色（feeding-bg/fg）
 */
import type { CareRecord as Record, RecordType } from '@baby-care-tracker/shared'
import {
  Baby as BabyIcon,
  Moon,
  Droplets,
  Thermometer,
  Ruler,
  Clock,
  User as UserIcon,
  MessageSquare,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import { formatDuration } from '@/lib/date'
import { getRecordSummary } from '@/lib/record'
import { parseNote } from '@/lib/note-tags'
import { Badge } from '@/components/ui/badge'
import { staggerContainer, staggerCompact, staggerItem } from '@/lib/motion'
import { cn } from '@/lib/utils'

const recordTypeIcon: { [K in RecordType]: typeof BabyIcon } = {
  feeding: BabyIcon,
  sleep: Moon,
  diaper: Droplets,
  temperature: Thermometer,
  growth: Ruler,
}

const recordTypeAccent: {
  [K in RecordType]: { bg: string; fg: string; main: string; tone: 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth' }
} = {
  feeding: { bg: 'var(--feeding-bg)', fg: 'var(--feeding-fg)', main: 'var(--feeding)', tone: 'feeding' },
  sleep: { bg: 'var(--sleep-bg)', fg: 'var(--sleep-fg)', main: 'var(--sleep)', tone: 'sleep' },
  diaper: { bg: 'var(--diaper-bg)', fg: 'var(--diaper-fg)', main: 'var(--diaper)', tone: 'diaper' },
  temperature: { bg: 'var(--temperature-bg)', fg: 'var(--temperature-fg)', main: 'var(--temperature)', tone: 'temperature' },
  growth: { bg: 'var(--growth-bg)', fg: 'var(--growth-fg)', main: 'var(--growth)', tone: 'growth' },
}

const recordTypeLabel: { [K in RecordType]: string } = {
  feeding: '喂养',
  sleep: '睡眠',
  diaper: '尿布',
  temperature: '体温',
  growth: '生长',
}

interface TimelineProps {
  records: Record[]
  className?: string
  /** 紧凑模式（首页时间线 N=5）*/
  compact?: boolean
}

function getElapsedMinutes(record: Record): number | null {
  if (!record.endTime) return null
  const start = new Date(record.startTime).getTime()
  const end = new Date(record.endTime).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return Math.round((end - start) / 60000)
}

function getHeadlineBadge(
  record: Record,
): { text: string; tone: 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth' | 'warning' | 'danger' } | null {
  const accent = recordTypeAccent[record.recordType]
  switch (record.recordType) {
    case 'feeding': {
      const d = record.feedingData
      if (!d) return null
      if (d.feedingType === 'formula' && d.amount) return { text: `${d.amount}ml`, tone: accent.tone }
      if (d.feedingType === 'breast') {
        const sideMap = { left: '左', right: '右', both: '双' } as const
        const side = d.breastSide ? sideMap[d.breastSide] : null
        const mins = d.duration ? Math.round(d.duration / 60) : null
        const parts = [side && `${side}侧`, mins && `${mins}分`].filter(Boolean)
        return parts.length ? { text: parts.join(' · '), tone: accent.tone } : null
      }
      if (d.feedingType === 'solid') return { text: '辅食', tone: accent.tone }
      return null
    }
    case 'sleep': {
      const d = record.sleepData
      if (!d) return null
      const mins = d.duration || 0
      if (mins <= 0) return { text: d.sleepType === 'night' ? '夜间' : '午睡', tone: accent.tone }
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
      return { text: label, tone: accent.tone }
    }
    case 'diaper': {
      const d = record.diaperData
      if (!d) return null
      const map = { pee: '尿', poop: '便', both: '尿+便' } as const
      return { text: map[d.diaperType], tone: accent.tone }
    }
    case 'temperature': {
      const d = record.temperatureData
      if (!d) return null
      let tone: 'temperature' | 'warning' | 'danger' = 'temperature'
      if (d.temperature >= 38) tone = 'danger'
      else if (d.temperature >= 37.5) tone = 'warning'
      return { text: `${d.temperature.toFixed(1)}°C`, tone }
    }
    case 'growth': {
      const d = record.growthData
      if (!d) return null
      const parts: string[] = []
      if (d.weight) parts.push(`${d.weight}kg`)
      else if (d.height) parts.push(`${d.height}cm`)
      if (!parts.length && d.headCircumference) parts.push(`头围${d.headCircumference}cm`)
      return parts.length ? { text: parts[0], tone: accent.tone } : null
    }
    default:
      return null
  }
}

function getTemperatureAlert(record: Record): { text: string; tone: 'warning' | 'danger' } | null {
  if (record.recordType !== 'temperature' || !record.temperatureData) return null
  const t = record.temperatureData.temperature
  if (t >= 38) return { text: '发烧', tone: 'danger' }
  if (t >= 37.5) return { text: '低烧', tone: 'warning' }
  return null
}

export function Timeline({ records, className, compact }: TimelineProps) {
  const currentUserId = useAuthStore((s) => s.user?.id)

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-[var(--label-tertiary)]">
        暂无记录
      </div>
    )
  }

  return (
    <motion.div
      className={cn('ios-list', className)}
      data-timeline
      variants={compact ? staggerCompact : staggerContainer}
      initial="initial"
      animate="animate"
    >
      {records.map((record) => {
        const Icon = recordTypeIcon[record.recordType]
        const accent = recordTypeAccent[record.recordType]
        const label = recordTypeLabel[record.recordType]
        const summary = getRecordSummary(record)
        const badge = getHeadlineBadge(record)
        const tempAlert = getTemperatureAlert(record)
        const elapsedMin = getElapsedMinutes(record)
        const creatorName =
          record.creator && record.creator.id !== currentUserId
            ? record.creator.nickname
            : null
        const noteParsed = parseNote(record.note)
        const hasNoteTags = noteParsed.tags.length > 0
        const hasNoteFreeText = noteParsed.freeText.length > 0
        const hasAuxLine =
          elapsedMin !== null || !!creatorName || hasNoteTags || hasNoteFreeText

        return (
          <motion.div
            key={record.id}
            variants={staggerItem}
            data-timeline-row
            className={cn(
              'relative flex items-start gap-3 min-w-0',
              compact ? 'px-5 py-3' : 'px-5 py-3.5',
            )}
          >
            {/* 左侧色条 */}
            <span
              aria-hidden
              className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
              style={{ backgroundColor: accent.main }}
            />

            {/* 类型图标 */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: accent.bg }}
            >
              <Icon className="h-4 w-4" style={{ color: accent.main }} />
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-w-0">
              {/* 第一行：标签 + 关键 badge + 时间 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold text-[var(--label)] shrink-0">
                  {label}
                </span>
                {badge && (
                  <Badge size="xs" variant={badge.tone}>
                    {badge.text}
                  </Badge>
                )}
                {tempAlert && (
                  <Badge size="xs" variant={tempAlert.tone === 'danger' ? 'danger' : 'warning'}>
                    {tempAlert.text}
                  </Badge>
                )}
                <span className="ml-auto shrink-0 text-[13px] font-mono tabular-nums text-[var(--label-tertiary)]">
                  {new Date(record.startTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* 第二行：摘要 */}
              <p className="text-[13px] text-[var(--label-secondary)] mt-0.5 truncate">
                {summary}
              </p>

              {/* 第三行：辅助信息 */}
              {hasAuxLine && (
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {elapsedMin !== null && (
                    <span className="text-[12px] flex items-center gap-1 text-[var(--label-tertiary)]">
                      <Clock className="h-3 w-3" />
                      <span className="number-display">
                        {formatDuration(elapsedMin * 60)}
                      </span>
                    </span>
                  )}
                  {creatorName && (
                    <span className="text-[12px] flex items-center gap-1 text-[var(--label-tertiary)]">
                      <UserIcon className="h-3 w-3" />
                      {creatorName}
                    </span>
                  )}
                  {hasNoteTags &&
                    noteParsed.tags.map((tag) => (
                      <Badge key={tag} size="xs" variant={accent.tone}>
                        #{tag}
                      </Badge>
                    ))}
                  {hasNoteFreeText && (
                    <span className="text-[12px] flex items-center gap-1 min-w-0 text-[var(--label-tertiary)]">
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <span className="truncate">{noteParsed.freeText}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
