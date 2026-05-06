import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
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
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-base">类型</label>
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
        </div>

        {(diaperType === 'poop' || diaperType === 'both') && (
          <>
            <div>
              <label className="label-base">性状</label>
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
            </div>

            <div>
              <label className="label-base">颜色</label>
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
            </div>
          </>
        )}

        <div>
          <label className="label-base">记录时间</label>
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
