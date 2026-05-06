import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'

interface GrowthDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { height?: number; weight?: number; headCircumference?: number; note?: string }) => void
}

export function GrowthDialog({ open, onClose, onSubmit }: GrowthDialogProps) {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [headCircumference, setHeadCircumference] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        headCircumference: headCircumference ? Number(headCircumference) : undefined,
        note: note || undefined,
      })
      setHeight(''); setWeight(''); setHeadCircumference(''); setNote('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasAnyMeasurement = height || weight || headCircumference

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="生长记录"
      icon={<Ruler className="h-4 w-4" />}
      accentColor="var(--growth)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-base">身高 (cm)</label>
          <input
            type="number"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="如：70.5"
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">体重 (kg)</label>
          <input
            type="number"
            step="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="如：8.5"
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">头围 (cm)</label>
          <input
            type="number"
            step="0.1"
            value={headCircumference}
            onChange={(e) => setHeadCircumference(e.target.value)}
            placeholder="如：45.0"
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

        <button
          type="submit"
          disabled={isSubmitting || !hasAnyMeasurement}
          className="btn-primary w-full"
          style={{ backgroundColor: 'var(--growth)' }}
        >
          {isSubmitting ? '保存中...' : hasAnyMeasurement ? '保存' : '请至少填写一项'}
        </button>
      </form>
    </Dialog>
  )
}
