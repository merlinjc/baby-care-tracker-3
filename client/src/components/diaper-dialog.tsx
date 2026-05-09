import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { DiaperType, Consistency, DiaperColor, CareRecord } from '@/types'
import type { RecordDialogMeta } from './feeding-dialog'

/** 性状选项（含次行提示） */
const CONSISTENCY_OPTIONS: Array<{ value: Consistency; label: string; description: string }> = [
  { value: 'watery', label: '水样', description: '稀如水' },
  { value: 'soft', label: '软便', description: '糊状' },
  { value: 'formed', label: '成型', description: '香蕉状' },
  { value: 'hard', label: '硬便', description: '颗粒/干硬' },
]

/** 颜色选项（含真实色块） */
const COLOR_OPTIONS: Array<{ value: DiaperColor; label: string; swatch: string }> = [
  { value: 'normal', label: '正常', swatch: '#B07A3D' },
  { value: 'yellow', label: '黄色', swatch: '#E9B95B' },
  { value: 'green', label: '绿色', swatch: '#7BAE5C' },
  { value: 'black', label: '黑色', swatch: '#2C2A28' },
  { value: 'red', label: '红色', swatch: '#C84A3F' },
]

/** 根据性状/颜色组合给出医学提示 */
function getDiaperAdvice(
  consistency: Consistency | '',
  color: DiaperColor | '',
): { variant: 'info' | 'success' | 'warning' | 'danger'; text: string } | null {
  // 颜色异常优先级最高
  if (color === 'red') {
    return { variant: 'danger', text: '红色便可能含血，建议拍照留存并尽快就医。' }
  }
  if (color === 'black') {
    return {
      variant: 'danger',
      text: '黑色便除新生儿胎便外，可能提示消化道出血，建议尽快就医。',
    }
  }
  if (color === 'green') {
    return {
      variant: 'info',
      text: '绿色便常见于配方奶、含铁辅食或肠道蠕动较快，多观察一两次即可。',
    }
  }
  // 性状提示
  if (consistency === 'watery') {
    return {
      variant: 'warning',
      text: '水样便注意脱水风险，及时补充水分；若一日多次或伴发热，建议就医。',
    }
  }
  if (consistency === 'hard') {
    return {
      variant: 'warning',
      text: '硬便提示便秘倾向，建议多补水、增加膳食纤维，必要时咨询医生。',
    }
  }
  if (consistency === 'soft' || consistency === 'formed') {
    return { variant: 'success', text: '形态健康，继续保持当前喂养节奏即可。' }
  }
  return null
}

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
  const advice =
    diaperType === 'pee' ? null : getDiaperAdvice(consistency, color)

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
                layout="grid"
                columns={4}
                options={CONSISTENCY_OPTIONS}
              />
            </FormField>

            <FormField label="颜色">
              <SegmentedControl<DiaperColor>
                value={color || null}
                onChange={(v) => setColor(v || '')}
                accentColor="var(--diaper)"
                toggleable
                layout="grid"
                columns={5}
                options={COLOR_OPTIONS}
              />
            </FormField>

            {advice && (
              <Alert variant={advice.variant} size="compact">
                {advice.text}
              </Alert>
            )}
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
