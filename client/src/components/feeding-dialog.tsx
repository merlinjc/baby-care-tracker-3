import { useEffect, useState } from 'react'
import { Baby } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { NoteTagPicker } from '@/components/note-tag-picker'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import type { FeedingType, BreastSide, CareRecord } from '@/types'

export interface FeedingDialogSubmitData {
  feedingType: FeedingType
  amount: number | null
  duration: number | null
  breastSide: BreastSide | null
  note?: string
}

export interface RecordDialogMeta {
  recordTime: string
  editingId?: string
  /**
   * 记录结束时间（ISO 字符串）。
   * 当前仅 SleepDialog 在新建/编辑"已完成的睡眠"时使用：
   * 通过传出 endTime，避免被服务端 `endTimeIsNull=true` 误判为进行中睡眠。
   */
  endTime?: string
}

interface FeedingDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FeedingDialogSubmitData, meta: RecordDialogMeta) => void | Promise<void>
  /** 传入已有记录时进入编辑模式（预填所有字段，保存时走 update） */
  editRecord?: CareRecord
}

export function FeedingDialog({ open, onClose, onSubmit, editRecord }: FeedingDialogProps) {
  const [feedingType, setFeedingType] = useState<FeedingType>('formula')
  const [amount, setAmount] = useState<string>('')
  const [duration, setDuration] = useState<string>('')
  const [breastSide, setBreastSide] = useState<BreastSide | null>(null)
  const [note, setNote] = useState('')
  const [recordTime, setRecordTime] = useState(() => toDateTimeLocalValue())
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** 快捷按钮模式：'set' = 直接设值 / 'add' = 累加（保留原行为） */
  const [quickMode, setQuickMode] = useState<'set' | 'add'>('set')

  const isEdit = !!editRecord

  // 每次打开弹窗时根据 editRecord 重置状态
  useEffect(() => {
    if (!open) return
    if (editRecord) {
      const fd = editRecord.feedingData
      setFeedingType((fd?.feedingType as FeedingType) ?? 'formula')
      setAmount(fd?.amount != null ? String(fd.amount) : '')
      setDuration(fd?.duration != null ? String(Math.round(fd.duration / 60)) : '')
      setBreastSide((fd?.breastSide as BreastSide | undefined) ?? null)
      setNote(editRecord.note ?? '')
      setRecordTime(toDateTimeLocalValue(editRecord.startTime))
    } else {
      setFeedingType('formula')
      setAmount('')
      setDuration('')
      setBreastSide(null)
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
          feedingType,
          amount: amount ? Number(amount) : null,
          duration: duration ? Number(duration) * 60 : null,
          breastSide: feedingType === 'breast' ? breastSide : null,
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

  const formId = 'feeding-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑喂养记录' : '喂养记录'}
      icon={<Baby className="h-4 w-4" />}
      accentColor="var(--feeding)"
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
        {/* Type */}
        <FormField label="类型">
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
        </FormField>

        {/* Amount (formula/solid) */}
        {(feedingType === 'formula' || feedingType === 'solid') && (
          <FormField label="量" htmlFor="feeding-amount">
            <Input
              id="feeding-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="输入量"
              rightIcon={<span className="text-xs">ml</span>}
            />
            {/* FR-A6：配方奶快捷用量（双模式：直接设值 / 累加） */}
            {feedingType === 'formula' && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="caption">快捷用量</span>
                  <div
                    className="inline-flex rounded-md p-0.5"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setQuickMode('set')}
                      className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor:
                          quickMode === 'set' ? 'var(--bg-card)' : 'transparent',
                        color:
                          quickMode === 'set'
                            ? 'var(--text-primary)'
                            : 'var(--text-hint)',
                      }}
                      aria-pressed={quickMode === 'set'}
                    >
                      设值
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickMode('add')}
                      className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor:
                          quickMode === 'add' ? 'var(--bg-card)' : 'transparent',
                        color:
                          quickMode === 'add'
                            ? 'var(--text-primary)'
                            : 'var(--text-hint)',
                      }}
                      aria-pressed={quickMode === 'add'}
                    >
                      累加
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 30, 60, 90, 120, 150, 180, 210].map((q) => (
                    <Button
                      key={q}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        if (quickMode === 'set') {
                          setAmount(String(q))
                        } else {
                          setAmount(String(Number(amount || 0) + q))
                        }
                      }}
                    >
                      {quickMode === 'set' ? `${q}` : `+${q}`}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  block
                  onClick={() => setAmount('')}
                >
                  清空
                </Button>
              </div>
            )}
          </FormField>
        )}

        {/* Breast side */}
        {feedingType === 'breast' && (
          <FormField label="哺乳侧">
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
          </FormField>
        )}

        {/* Duration */}
        <FormField label="时长" htmlFor="feeding-duration">
          <Input
            id="feeding-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="输入时长"
            rightIcon={<span className="text-xs">分钟</span>}
          />
        </FormField>

        {/* Time */}
        <FormField label="记录时间" htmlFor="feeding-time">
          <Input
            id="feeding-time"
            type="datetime-local"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
          />
        </FormField>

        {/* Note */}
        <FormField label="备注">
          <NoteTagPicker
            value={note}
            onChange={setNote}
            recordType="feeding"
            accentColor="var(--feeding)"
            placeholder="补充说明（如实际场景）"
          />
        </FormField>
      </form>
    </Dialog>
  )
}
