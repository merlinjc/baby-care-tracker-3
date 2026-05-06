import { useEffect, useState } from 'react'
import { Thermometer } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
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
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-base">体温 (°C)</label>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            required
            placeholder="36.5"
            className="input-base"
            style={
              isFever
                ? {
                    borderColor: isHighFever ? 'var(--danger)' : 'var(--warning)',
                    color: isHighFever ? 'var(--danger)' : 'var(--warning)',
                  }
                : undefined
            }
          />
          {/* 滑块（35.0–42.0），与数字输入双向绑定 */}
          <div className="mt-3">
            <input
              type="range"
              min={35}
              max={42}
              step={0.1}
              value={temperature || 36.5}
              onChange={(e) => setTemperature(e.target.value)}
              aria-label="体温滑块"
              className="w-full"
              style={{ accentColor: isHighFever ? 'var(--danger)' : isFever ? 'var(--warning)' : 'var(--temperature)' }}
            />
            <div className="flex justify-between caption mt-1 number-display">
              <span>35.0</span>
              <span>正常 36.0–37.2</span>
              <span>42.0</span>
            </div>
          </div>
          {isFever && (
            <p
              className="caption mt-1"
              style={{ color: isHighFever ? 'var(--danger)' : 'var(--warning)' }}
            >
              {isHighFever ? '高烧 · 建议就医' : '低烧 · 注意观察'}
            </p>
          )}
        </div>

        <div>
          <label className="label-base">测量方式</label>
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
        </div>

        <div>
          <label className="label-base">测量时间</label>
          <input
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注"
            className="input-base"
          />
        </div>
      </form>
    </Dialog>
  )
}
