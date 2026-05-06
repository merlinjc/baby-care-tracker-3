import { useState } from 'react'
import { Thermometer } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { TempMethod } from '@/types'

interface TemperatureDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { temperature: number; method?: TempMethod; note?: string }) => void
}

export function TemperatureDialog({ open, onClose, onSubmit }: TemperatureDialogProps) {
  const [temperature, setTemperature] = useState('')
  const [method, setMethod] = useState<TempMethod | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        temperature: Number(temperature),
        method: method || undefined,
        note: note || undefined,
      })
      setTemperature(''); setMethod(''); setNote('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Visual feedback for fever based on input
  const tempNum = Number(temperature)
  const isFever = tempNum >= 37.5
  const isHighFever = tempNum >= 38.5

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="体温记录"
      icon={<Thermometer className="h-4 w-4" />}
      accentColor="var(--temperature)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          style={{ backgroundColor: 'var(--temperature)' }}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </form>
    </Dialog>
  )
}
