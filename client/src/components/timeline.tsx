import type { CareRecord as Record, RecordType } from '@baby-care-tracker/shared'
import { Baby, Moon, Droplets, Thermometer, Ruler } from 'lucide-react'
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

export function Timeline({ records, className }: TimelineProps) {
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

        return (
          <div key={record.id} className="flex gap-3 relative">
            {index < records.length - 1 && (
              <div
                className="absolute left-[15px] top-[36px] w-0.5 bottom-0"
                style={{ backgroundColor: 'var(--border-light)' }}
              />
            )}

            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>

            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <span className="body-md font-medium text-[var(--text-primary)]">{label}</span>
                <span className="caption number-display">
                  {new Date(record.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {record.note && (
                <p className="caption mt-0.5">{record.note}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
