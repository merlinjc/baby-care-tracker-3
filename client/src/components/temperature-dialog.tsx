import { useEffect, useState } from 'react'
import { Thermometer } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Slider } from '@/components/ui/slider'
import { Alert } from '@/components/ui/alert'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { TempMethod, CareRecord } from '@/types'
import type { RecordDialogMeta } from './feeding-dialog'

export interface TemperatureDialogSubmitData {
  temperature: number
  method?: TempMethod
  note?: string
}

interface TemperatureDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TemperatureDialogSubmitData, meta: RecordDialogMeta) => void | Promise<void>
  editRecord?: CareRecord
}

export function TemperatureDialog({ open, onClose, onSubmit, editRecord }: TemperatureDialogProps) {
  const [temperature, setTemperature] = useState('')
  const [method, setMethod] = useState<TempMethod | ''>('')
  const [note, setNote] = useState('')
  const [recordTime, setRecordTime] = useState(() => toDateTimeLocalValue())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!editRecord

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      const td = editRecord.temperatureData
      setTemperature(td?.temperature != null ? String(td.temperature) : '')
      setMethod((td?.method as TempMethod | undefined) ?? '')
      setNote(editRecord.note ?? '')
      setRecordTime(toDateTimeLocalValue(editRecord.startTime))
    } else {
      setTemperature('')
      setMethod('')
      setNote('')
      setRecordTime(toDateTimeLocalValue())
    }
  }, [open, editRecord])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(
        {
          temperature: Number(temperature),
          method: method || undefined,
          note: note || undefined,
        },
        {
          recordTime: fromDateTimeLocalValue(recordTime),
          editingId: editRecord?.id,
        },
      )
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Visual feedback for fever based on input
  const tempNum = Number(temperature)
  const isFever = temperature !== '' && tempNum >= 37.5
  const isHighFever = temperature !== '' && tempNum >= 38.5

  const inputVariant = isHighFever ? 'danger' : isFever ? 'warning' : 'default'
  const sliderAccent = isHighFever
    ? 'var(--danger)'
    : isFever
      ? 'var(--warning)'
      : 'var(--temperature)'

  const formId = 'temperature-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑体温记录' : '体温记录'}
      icon={<Thermometer className="h-4 w-4" />}
      accentColor="var(--temperature)"
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
        <FormField label="体温" htmlFor="temp-value" required>
          <Input
            id="temp-value"
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            required
            placeholder="36.5"
            variant={inputVariant}
            rightIcon={<span className="text-xs">°C</span>}
          />
          {/* 滑块（35.0–42.0），与数字输入双向绑定 */}
          <div className="mt-3">
            <Slider
              min={35}
              max={42}
              step={0.1}
              value={[temperature ? tempNum : 36.5]}
              onValueChange={([v]) => setTemperature(v != null ? String(v) : '')}
              accentColor={sliderAccent}
              showLabels={{
                left: '35.0',
                center: '正常 36.0–37.2',
                right: '42.0',
              }}
            />
          </div>
          {isFever && (
            <Alert
              variant={isHighFever ? 'danger' : 'warning'}
              size="compact"
              className="mt-2"
            >
              {isHighFever ? '高烧 · 建议就医' : '低烧 · 注意观察'}
            </Alert>
          )}
        </FormField>

        <FormField label="测量方式">
          <SegmentedControl<TempMethod>
            value={method || null}
            onChange={(v) => setMethod(v || '')}
            accentColor="var(--temperature)"
            toggleable
            layout="wrap"
            options={[
              { value: 'oral', label: '口腔' },
              { value: 'axillary', label: '腋下' },
              { value: 'rectal', label: '直肠' },
              { value: 'ear', label: '耳温' },
            ]}
          />
        </FormField>

        <FormField label="测量时间" htmlFor="temp-time">
          <Input
            id="temp-time"
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
          />
        </FormField>

        <FormField label="备注">
          <NoteTagPicker
            value={note}
            onChange={setNote}
            recordType="temperature"
            accentColor="var(--temperature)"
          />
        </FormField>
      </form>
    </Dialog>
  )
}
