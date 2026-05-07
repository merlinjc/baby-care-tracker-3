import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { SleepType, CareRecord } from '@/types'
import type { RecordDialogMeta } from './feeding-dialog'

export interface SleepDialogSubmitData {
  sleepType: SleepType
  duration: number
  location?: string
  note?: string
}

interface SleepDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SleepDialogSubmitData, meta: RecordDialogMeta) => void | Promise<void>
  editRecord?: CareRecord
}

export function SleepDialog({ open, onClose, onSubmit, editRecord }: SleepDialogProps) {
  const [sleepType, setSleepType] = useState<SleepType>('night')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [recordTime, setRecordTime] = useState(() => toDateTimeLocalValue())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!editRecord

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      const sd = editRecord.sleepData
      setSleepType((sd?.sleepType as SleepType) ?? 'night')
      setDuration(sd?.duration != null ? String(Math.round(sd.duration / 60)) : '')
      setLocation(sd?.location ?? '')
      setNote(editRecord.note ?? '')
      setRecordTime(toDateTimeLocalValue(editRecord.startTime))
    } else {
      setSleepType('night')
      setDuration('')
      setLocation('')
      setNote('')
      setRecordTime(toDateTimeLocalValue())
    }
  }, [open, editRecord])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const startIso = fromDateTimeLocalValue(recordTime)
      const durationSec = Number(duration) * 60
      // 关键：dialog 录入的睡眠永远视为"已结束"，必须写入 endTime，
      // 否则服务端 `endTimeIsNull=true` 会把它当成进行中睡眠，
      // 导致首页状态胶囊显示"正在睡觉 · 已 0m"。
      const endIso = new Date(new Date(startIso).getTime() + durationSec * 1000).toISOString()
      await onSubmit(
        {
          sleepType,
          duration: durationSec,
          location: location || undefined,
          note: note || undefined,
        },
        {
          recordTime: startIso,
          endTime: endIso,
          editingId: editRecord?.id,
        },
      )
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const formId = 'sleep-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑睡眠记录' : '睡眠记录'}
      icon={<Moon className="h-4 w-4" />}
      accentColor="var(--sleep)"
      footer={
        <DialogFooter
          onCancel={onClose}
          confirmText={isEdit ? '保存修改' : '保存'}
          loading={isSubmitting}
          confirmType="submit"
          confirmFormId={formId}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} data-dialog-form className="space-y-5">
        <FormField label="类型">
          <SegmentedControl<SleepType>
            value={sleepType}
            onChange={setSleepType}
            accentColor="var(--sleep)"
            options={[
              { value: 'night', label: '夜间' },
              { value: 'nap', label: '午睡' },
            ]}
          />
        </FormField>

        <FormField label="时长" htmlFor="sleep-duration" required>
          <Input
            id="sleep-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            placeholder="输入时长"
            rightIcon={<span className="text-xs">分钟</span>}
          />
        </FormField>

        <FormField label="开始时间" htmlFor="sleep-time">
          <Input
            id="sleep-time"
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
          />
        </FormField>

        <FormField label="地点" htmlFor="sleep-location">
          <Input
            id="sleep-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="如：婴儿床、推车"
          />
        </FormField>

        <FormField label="备注">
          <NoteTagPicker
            value={note}
            onChange={setNote}
            recordType="sleep"
            accentColor="var(--sleep)"
          />
        </FormField>
      </form>
    </Dialog>
  )
}
