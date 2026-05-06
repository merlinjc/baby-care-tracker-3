import { useState } from 'react'
import { Baby } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { FeedingType, BreastSide } from '@/types'

interface FeedingDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { feedingType: FeedingType; amount: number | null; duration: number | null; breastSide: BreastSide | null; note?: string }) => void
}

export function FeedingDialog({ open, onClose, onSubmit }: FeedingDialogProps) {
  const [feedingType, setFeedingType] = useState<FeedingType>('formula')
  const [amount, setAmount] = useState<string>('')
  const [duration, setDuration] = useState<string>('')
  const [breastSide, setBreastSide] = useState<BreastSide | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit({
        feedingType,
        amount: amount ? Number(amount) : null,
        duration: duration ? Number(duration) * 60 : null,
        breastSide: feedingType === 'breast' ? breastSide : null,
        note: note || undefined,
      })
      setFeedingType('formula'); setAmount(''); setDuration(''); setBreastSide(null); setNote('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="喂养记录"
      icon={<Baby className="h-4 w-4" />}
      accentColor="var(--feeding)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type */}
        <div>
          <label className="label-base">类型</label>
          <SegmentedControl<FeedingType>
            value={feedingType}
            onChange={setFeedingType}
            accentColor="var(--feeding)"
            options={[
              { value: 'formula', label: '配方奶' },
              { value: 'breast', label: '母乳' },
              { value: 'solid', label: '辅食' },
            ]}
          />
        </div>

        {/* Amount (formula/solid) */}
        {(feedingType === 'formula' || feedingType === 'solid') && (
          <div>
            <label className="label-base">量 (ml)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="输入量"
              className="input-base"
            />
            {/* FR-A6：配方奶快捷用量 8 按钮 [10, 30, 60, 90, 120, 150, 180, 210] */}
            {feedingType === 'formula' && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[10, 30, 60, 90, 120, 150, 180, 210].map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setAmount(String(Number(amount || 0) + q))}
                    className="rounded-lg py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    +{q}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="col-span-4 mt-1 rounded-lg py-1 text-xs"
                  style={{ color: 'var(--text-hint)' }}
                >
                  清空
                </button>
              </div>
            )}
          </div>
        )}

        {/* Breast side */}
        {feedingType === 'breast' && (
          <div>
            <label className="label-base">哺乳侧</label>
            <SegmentedControl<BreastSide>
              value={breastSide}
              onChange={setBreastSide}
              accentColor="var(--feeding)"
              options={[
                { value: 'left', label: '左侧' },
                { value: 'right', label: '右侧' },
                { value: 'both', label: '两侧' },
              ]}
            />
          </div>
        )}

        {/* Duration */}
        <div>
          <label className="label-base">时长 (分钟)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="输入时长"
            className="input-base"
          />
        </div>

        {/* Note */}
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
          style={{ backgroundColor: 'var(--feeding)' }}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </form>
    </Dialog>
  )
}
