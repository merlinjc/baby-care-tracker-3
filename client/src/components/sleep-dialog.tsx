import { useState } from 'react'
import { Moon } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { SleepType } from '@/types'

interface SleepDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { sleepType: SleepType; duration: number; location?: string; note?: string }) => void
}

export function SleepDialog({ open, onClose, onSubmit }: SleepDialogProps) {
  const [sleepType, setSleepType] = useState<SleepType>('night')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        sleepType,
        duration: Number(duration) * 60,
        location: location || undefined,
        note: note || undefined,
      })
      setSleepType('night'); setDuration(''); setLocation(''); setNote('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="睡眠记录"
      icon={<Moon className="h-4 w-4" />}
      accentColor="var(--sleep)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-base">类型</label>
          <SegmentedControl<SleepType>
            value={sleepType}
            onChange={setSleepType}
            accentColor="var(--sleep)"
            options={[
              { value: 'night', label: '夜间' },
              { value: 'nap', label: '午睡' },
            ]}
          />
        </div>

        <div>
          <label className="label-base">时长 (分钟)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            placeholder="输入时长"
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">地点</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="如：婴儿床、推车"
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
          disabled={isSubmitting}
          className="btn-primary w-full"
          style={{ backgroundColor: 'var(--sleep)' }}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </form>
    </Dialog>
  )
}
