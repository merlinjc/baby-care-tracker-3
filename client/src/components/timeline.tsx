import type { CareRecord as Record, RecordType } from '@baby-care-tracker/shared'
import { Baby, Moon, Droplets, Thermometer, Ruler, Clock, User, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { formatDuration } from '@/lib/date'
import { getRecordSummary } from '@/lib/record'
import { parseNote } from '@/lib/note-tags'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const recordTypeIcon: { [K in RecordType]: typeof Baby } = {
  feeding: Baby,
  sleep: Moon,
  diaper: Droplets,
  temperature: Thermometer,
  growth: Ruler,
}

const recordTypeColor: { [K in RecordType]: string } = {
  feeding: 'var(--feeding)',
  sleep: 'var(--sleep)',
  diaper: 'var(--diaper)',
  temperature: 'var(--temperature)',
  growth: 'var(--growth)',
}

const recordTypeLabel: { [K in RecordType]: string } = {
  feeding: '喂养',
  sleep: '睡眠',
  diaper: '换尿布',
  temperature: '体温',
  growth: '生长',
}

interface TimelineProps {
  records: Record[]
  className?: string
}

/** 计算 startTime → endTime 的时长（分钟），无 endTime 返回 null */
function getElapsedMinutes(record: Record): number | null {
  if (!record.endTime) return null
  const start = new Date(record.startTime).getTime()
  const end = new Date(record.endTime).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return Math.round((end - start) / 60000)
}

/**
 * 提取每条记录的首个"关键指标徽章"内容。
 * 位于右上角，作为一眼可见的高优先级数值。
 */
function getHeadlineBadge(
  record: Record,
): { text: string; color: string; bgAlpha?: number } | null {
  switch (record.recordType) {
    case 'feeding': {
      const d = record.feedingData
      if (!d) return null
      if (d.feedingType === 'formula' && d.amount) {
        return { text: `${d.amount}ml`, color: 'var(--feeding)' }
      }
      if (d.feedingType === 'breast') {
        const sideMap = { left: '左', right: '右', both: '双' } as const
        const side = d.breastSide ? sideMap[d.breastSide] : null
        const mins = d.duration ? Math.round(d.duration / 60) : null
        const parts = [side && `${side}侧`, mins && `${mins}分`].filter(Boolean)
        return parts.length ? { text: parts.join(' · '), color: 'var(--feeding)' } : null
      }
      if (d.feedingType === 'solid') {
        return { text: '辅食', color: 'var(--feeding)' }
      }
      return null
    }
    case 'sleep': {
      const d = record.sleepData
      if (!d) return null
      const mins = d.duration || 0
      if (mins <= 0) return { text: d.sleepType === 'night' ? '夜间' : '午睡', color: 'var(--sleep)' }
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const label = h > 0 ? (m > 0 ? `${h}小时${m}分` : `${h}小时`) : `${m}分`
      return { text: label, color: 'var(--sleep)' }
    }
    case 'diaper': {
      const d = record.diaperData
      if (!d) return null
      const map = { pee: '尿', poop: '便', both: '尿+便' } as const
      return { text: map[d.diaperType], color: 'var(--diaper)' }
    }
    case 'temperature': {
      const d = record.temperatureData
      if (!d) return null
      // 体温异常色阶：≥38 danger / ≥37.5 warning / 其余正常色
      let color = 'var(--temperature)'
      if (d.temperature >= 38) color = 'var(--danger)'
      else if (d.temperature >= 37.5) color = 'var(--warning)'
      return { text: `${d.temperature.toFixed(1)}°C`, color }
    }
    case 'growth': {
      const d = record.growthData
      if (!d) return null
      const parts: string[] = []
      if (d.weight) parts.push(`${d.weight}kg`)
      else if (d.height) parts.push(`${d.height}cm`)
      if (!parts.length && d.headCircumference) parts.push(`头围${d.headCircumference}cm`)
      return parts.length ? { text: parts[0], color: 'var(--growth)' } : null
    }
    default:
      return null
  }
}

/** 体温告警副标签：仅在 ≥37.5 显示 */
function getTemperatureAlert(record: Record): { text: string; color: string } | null {
  if (record.recordType !== 'temperature' || !record.temperatureData) return null
  const t = record.temperatureData.temperature
  if (t >= 38) return { text: '发烧', color: 'var(--danger)' }
  if (t >= 37.5) return { text: '低烧', color: 'var(--warning)' }
  return null
}

export function Timeline({ records, className }: TimelineProps) {
  const currentUserId = useAuthStore((s) => s.user?.id)

  if (records.length === 0) {
    return (
      <div className="text-center py-8 caption">
        暂无记录
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {records.map((record, index) => {
        const Icon = recordTypeIcon[record.recordType]
        const color = recordTypeColor[record.recordType]
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

        // 是否渲染辅助信息行（时长 / 创建者 / 备注）
        const hasAuxLine =
          elapsedMin !== null || !!creatorName || hasNoteTags || hasNoteFreeText

        return (
          <div key={record.id} className="flex gap-3 relative group">
            {/* 连接线 */}
            {index < records.length - 1 && (
              <div
                className="absolute left-[15px] top-[36px] w-0.5 bottom-0"
                style={{ backgroundColor: 'var(--border-light)' }}
              />
            )}

            {/* 类型图标 */}
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>

            {/* 内容区 */}
            <div className="flex-1 pb-4 min-w-0">
              {/* 第一行：标签 + 头部徽章 + 时间 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="body-md font-medium text-[var(--text-primary)] shrink-0">
                  {label}
                </span>
                {badge && (
                  <Badge size="xs" accentColor={badge.color}>
                    {badge.text}
                  </Badge>
                )}
                {tempAlert && (
                  <Badge size="xs" accentColor={tempAlert.color}>
                    {tempAlert.text}
                  </Badge>
                )}
                <span className="caption number-display ml-auto shrink-0">
                  {new Date(record.startTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* 第二行：结构化摘要（与记录页一致） */}
              <p className="body-sm text-[var(--text-secondary)] mt-0.5 truncate">
                {summary}
              </p>

              {/* 第三行：时长 / 创建者 / 备注（标签化） */}
              {hasAuxLine && (
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                  {elapsedMin !== null && (
                    <span className="caption flex items-center gap-1 text-[var(--text-hint)]">
                      <Clock className="h-3 w-3" />
                      <span className="number-display">
                        持续 {formatDuration(elapsedMin * 60)}
                      </span>
                    </span>
                  )}
                  {creatorName && (
                    <span className="caption flex items-center gap-1 text-[var(--text-hint)]">
                      <User className="h-3 w-3" />
                      {creatorName}
                    </span>
                  )}
                  {hasNoteTags &&
                    noteParsed.tags.map((tag) => (
                      <Badge key={tag} size="xs" accentColor={color}>
                        #{tag}
                      </Badge>
                    ))}
                  {hasNoteFreeText && (
                    <span className="caption flex items-center gap-1 min-w-0 text-[var(--text-hint)]">
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <span className="truncate">{noteParsed.freeText}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
