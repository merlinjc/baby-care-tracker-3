import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { DiaperType, Consistency, DiaperColor, CareRecord } from '@/types'
import type { RecordDialogMeta } from './feeding-dialog'

export interface DiaperDialogSubmitData {
  diaperType: DiaperType
  consistency?: Consistency
  color?: DiaperColor
  note?: string
}

interface DiaperDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: DiaperDialogSubmitData, meta: RecordDialogMeta) => void | Promise<void>
  editRecord?: CareRecord
}

export function DiaperDialog({ open, onClose, onSubmit, editRecord }: DiaperDialogProps) {
  const [diaperType, setDiaperType] = useState<DiaperType>('both')
  const [consistency, setConsistency] = useState<Consistency | ''>('')
  const [color, setColor] = useState<DiaperColor | ''>('')
  const [note, setNote] = useState('')
  const [recordTime, setRecordTime] = useState(() => toDateTimeLocalValue())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!editRecord

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      const dd = editRecord.diaperData
      setDiaperType((dd?.diaperType as DiaperType) ?? 'both')
      setConsistency((dd?.consistency as Consistency | undefined) ?? '')
      setColor((dd?.color as DiaperColor | undefined) ?? '')
      setNote(editRecord.note ?? '')
      setRecordTime(toDateTimeLocalValue(editRecord.startTime))
    } else {
      setDiaperType('both')
      setConsistency('')
      setColor('')
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
          diaperType,
          consistency: consistency || undefined,
          color: color || undefined,
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

  const formId = 'diaper-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑换尿布记录' : '换尿布'}
      icon={<Droplets className="h-4 w-4" />}
      accentColor="var(--diaper)"
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
          <SegmentedControl<DiaperType>
            value={diaperType}
            onChange={setDiaperType}
            accentColor="var(--diaper)"
            options={[
              { value: 'pee', label: '尿' },
              { value: 'poop', label: '便' },
              { value: 'both', label: '都有' },
            ]}
          />
        </FormField>

        {(diaperType === 'poop' || diaperType === 'both') && (
          <>
            <FormField label="性状">
              <SegmentedControl<Consistency>
                value={consistency || null}
                onChange={(v) => setConsistency(v || '')}
                accentColor="var(--diaper)"
                toggleable
                layout="wrap"
                options={[
                  { value: 'watery', label: '水样' },
                  { value: 'soft', label: '软便' },
                  { value: 'formed', label: '成型' },
                  { value: 'hard', label: '硬便' },
                ]}
              />
            </FormField>

            <FormField label="颜色">
              <SegmentedControl<DiaperColor>
                value={color || null}
                onChange={(v) => setColor(v || '')}
                accentColor="var(--diaper)"
                toggleable
                layout="wrap"
                options={[
                  { value: 'normal', label: '正常' },
                  { value: 'yellow', label: '黄色' },
                  { value: 'green', label: '绿色' },
                  { value: 'black', label: '黑色' },
                  { value: 'red', label: '红色' },
                ]}
              />
            </FormField>
          </>
        )}

        <FormField label="记录时间" htmlFor="diaper-time">
          <Input
            id="diaper-time"
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
          />
        </FormField>

        <FormField label="备注">
          <NoteTagPicker
            value={note}
            onChange={setNote}
            recordType="diaper"
            accentColor="var(--diaper)"
          />
        </FormField>
      </form>
    </Dialog>
  )
}
