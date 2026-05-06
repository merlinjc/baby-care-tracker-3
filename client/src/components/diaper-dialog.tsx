import { useState } from 'react'
import { Droplets } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { DiaperType, Consistency, DiaperColor } from '@/types'

interface DiaperDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { diaperType: DiaperType; consistency?: Consistency; color?: DiaperColor; note?: string }) => void
}

export function DiaperDialog({ open, onClose, onSubmit }: DiaperDialogProps) {
  const [diaperType, setDiaperType] = useState<DiaperType>('both')
  const [consistency, setConsistency] = useState<Consistency | ''>('')
  const [color, setColor] = useState<DiaperColor | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        diaperType,
        consistency: consistency || undefined,
        color: color || undefined,
        note: note || undefined,
      })
      setDiaperType('both'); setConsistency(''); setColor(''); setNote('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="换尿布"
      icon={<Droplets className="h-4 w-4" />}
      accentColor="var(--diaper)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="label-base">备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注"
            className="input-base"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full"
          style={{ backgroundColor: 'var(--diaper)' }}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </form>
    </Dialog>
  )
}
