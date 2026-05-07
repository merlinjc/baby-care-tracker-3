import { useEffect, useState } from 'react'
import { Ruler } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { CareRecord } from '@/types'
import type { RecordDialogMeta } from './feeding-dialog'

export interface GrowthDialogSubmitData {
  height?: number
  weight?: number
  headCircumference?: number
  note?: string
}

interface GrowthDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: GrowthDialogSubmitData, meta: RecordDialogMeta) => void | Promise<void>
  editRecord?: CareRecord
}

export function GrowthDialog({ open, onClose, onSubmit, editRecord }: GrowthDialogProps) {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [headCircumference, setHeadCircumference] = useState('')
  const [note, setNote] = useState('')
  const [recordTime, setRecordTime] = useState(() => toDateTimeLocalValue())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!editRecord

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      const gd = editRecord.growthData
      setHeight(gd?.height != null ? String(gd.height) : '')
      setWeight(gd?.weight != null ? String(gd.weight) : '')
      setHeadCircumference(gd?.headCircumference != null ? String(gd.headCircumference) : '')
      setNote(editRecord.note ?? '')
      setRecordTime(toDateTimeLocalValue(editRecord.startTime))
    } else {
      setHeight('')
      setWeight('')
      setHeadCircumference('')
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
          height: height ? Number(height) : undefined,
          weight: weight ? Number(weight) : undefined,
          headCircumference: headCircumference ? Number(headCircumference) : undefined,
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

  const hasAnyMeasurement = height || weight || headCircumference
  const formId = 'growth-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑生长记录' : '生长记录'}
      icon={<Ruler className="h-4 w-4" />}
      accentColor="var(--growth)"
      footer={
        <DialogFooter
          onCancel={onClose}
          confirmText={isEdit ? '保存修改' : '保存'}
          loading={isSubmitting}
          disabled={!hasAnyMeasurement}
          confirmType="submit"
          confirmFormId={formId}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} data-dialog-form className="space-y-5">
        <FormField
          label="身高"
          htmlFor="growth-height"
          hint={!hasAnyMeasurement && !isEdit ? '请至少填写身高、体重或头围中的一项' : undefined}
        >
          <Input
            id="growth-height"
            type="number"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="如：70.5"
            rightIcon={<span className="text-xs">cm</span>}
          />
        </FormField>

        <FormField label="体重" htmlFor="growth-weight">
          <Input
            id="growth-weight"
            type="number"
            step="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="如：8.5"
            rightIcon={<span className="text-xs">kg</span>}
          />
        </FormField>

        <FormField label="头围" htmlFor="growth-head">
          <Input
            id="growth-head"
            type="number"
            step="0.1"
            value={headCircumference}
            onChange={(e) => setHeadCircumference(e.target.value)}
            placeholder="如：45.0"
            rightIcon={<span className="text-xs">cm</span>}
          />
        </FormField>

        <FormField label="测量时间" htmlFor="growth-time">
          <Input
            id="growth-time"
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
          />
        </FormField>

        <FormField label="备注">
          <NoteTagPicker
            value={note}
            onChange={setNote}
            recordType="growth"
            accentColor="var(--growth)"
          />
        </FormField>
      </form>
    </Dialog>
  )
}
