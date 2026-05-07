/**
 * JaundiceDialog - 新建 / 编辑黄疸观察记录
 *
 * 数据仅落地到 localStorage（见 lib/jaundice.ts），当前不经后端。
 *
 * v5.0.1 Batch 2 改造：
 * - 所有裸 <input className="input-base"> → <Input> + <FormField>
 * - 多选 chip 栏 → 复用 <Badge interactive>
 * - Kramer 分区保持自定义 chip（因需要 title 悬停提示）
 */
import { useEffect, useMemo, useState } from 'react'
import { Sun } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '@/lib/date'
import {
  ACTION_OPTIONS,
  KRAMER_ZONE_OPTIONS,
  JAUNDICE_TYPE_OPTIONS,
  SYMPTOM_OPTIONS,
  computeAgeDays,
  type JaundiceRecord,
  type JaundiceType,
  type KramerZone,
} from '@/lib/jaundice'

interface JaundiceDialogProps {
  open: boolean
  onClose: () => void
  babyBirthDate?: string
  /** 有值时进入编辑模式 */
  editRecord?: JaundiceRecord | null
  onSubmit: (
    data: Omit<JaundiceRecord, 'id' | 'babyId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => void | Promise<void>
}

/** 一个可多选的 Badge 标签集合（用于伴随表现 / 处置） */
function MultiBadge({
  options,
  value,
  onChange,
  accentColor,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  accentColor: string
}) {
  const toggle = (item: string) => {
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((item) => {
        const selected = value.includes(item)
        return (
          <Badge
            key={item}
            size="sm"
            interactive
            variant={selected ? 'primary' : 'outline'}
            accentColor={selected ? accentColor : undefined}
            aria-pressed={selected}
            onClick={() => toggle(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle(item)
              }
            }}
          >
            {item}
          </Badge>
        )
      })}
    </div>
  )
}

export function JaundiceDialog({
  open,
  onClose,
  babyBirthDate,
  editRecord,
  onSubmit,
}: JaundiceDialogProps) {
  const isEdit = !!editRecord
  const accentColor = 'var(--warning)'

  const [date, setDate] = useState(() => toDateTimeLocalValue())
  const [kramerZone, setKramerZone] = useState<KramerZone | null>(null)
  const [scleraYellow, setScleraYellow] = useState(false)
  const [tcb, setTcb] = useState<string>('')
  const [tsb, setTsb] = useState<string>('')
  const [jaundiceType, setJaundiceType] = useState<JaundiceType | null>(null)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [note, setNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      setDate(toDateTimeLocalValue(editRecord.date))
      setKramerZone(editRecord.kramerZone)
      setScleraYellow(editRecord.scleraYellow)
      setTcb(typeof editRecord.tcb === 'number' ? String(editRecord.tcb) : '')
      setTsb(typeof editRecord.tsb === 'number' ? String(editRecord.tsb) : '')
      setJaundiceType(editRecord.jaundiceType ?? null)
      setSymptoms(editRecord.symptoms ?? [])
      setActions(editRecord.actions ?? [])
      setNote(editRecord.note ?? '')
    } else {
      setDate(toDateTimeLocalValue())
      setKramerZone(null)
      setScleraYellow(false)
      setTcb('')
      setTsb('')
      setJaundiceType(null)
      setSymptoms([])
      setActions([])
      setNote('')
    }
  }, [open, editRecord])

  const ageDays = useMemo(() => {
    if (!babyBirthDate) return null
    return computeAgeDays(babyBirthDate, fromDateTimeLocalValue(date))
  }, [babyBirthDate, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(
        {
          date: fromDateTimeLocalValue(date),
          ageDays: ageDays ?? 1,
          kramerZone,
          scleraYellow,
          tcb: tcb ? Number(tcb) : undefined,
          tsb: tsb ? Number(tsb) : undefined,
          jaundiceType,
          symptoms,
          actions,
          note: note.trim() || undefined,
        },
        editRecord?.id,
      )
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const formId = 'jaundice-dialog-form'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑黄疸记录' : '新增黄疸记录'}
      icon={<Sun className="h-4 w-4" />}
      accentColor={accentColor}
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
        {/* 测量时间 + 日龄 */}
        <FormField
          label="测量时间"
          htmlFor="jaundice-date"
          hint={
            ageDays !== null
              ? `宝宝此时为出生后 ${ageDays} 天`
              : undefined
          }
        >
          <Input
            id="jaundice-date"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </FormField>

        {/* Kramer 分区 */}
        <FormField
          label="皮肤黄染范围（Kramer 分区）"
          hint={
            kramerZone !== null
              ? `分区参考 TSB 范围：${KRAMER_ZONE_OPTIONS.find((o) => o.value === kramerZone)?.tsbRange}（仅用于自检教育，不能替代诊断）`
              : undefined
          }
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge
              size="sm"
              interactive
              variant={kramerZone === null ? 'primary' : 'outline'}
              accentColor={kramerZone === null ? accentColor : undefined}
              aria-pressed={kramerZone === null}
              onClick={() => setKramerZone(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setKramerZone(null)
                }
              }}
            >
              无明显黄染
            </Badge>
            {KRAMER_ZONE_OPTIONS.map((opt) => {
              const active = kramerZone === opt.value
              return (
                <Badge
                  key={opt.value}
                  size="sm"
                  interactive
                  variant={active ? 'primary' : 'outline'}
                  accentColor={active ? accentColor : undefined}
                  aria-pressed={active}
                  title={`${opt.desc} · 参考 TSB ${opt.tsbRange}`}
                  onClick={() => setKramerZone(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setKramerZone(opt.value)
                    }
                  }}
                >
                  {opt.desc} · {opt.label}
                </Badge>
              )
            })}
          </div>
        </FormField>

        {/* 巩膜 */}
        <FormField label="巩膜（眼白）">
          <SegmentedControl<'no' | 'yes'>
            value={scleraYellow ? 'yes' : 'no'}
            onChange={(v) => setScleraYellow(v === 'yes')}
            accentColor={accentColor}
            options={[
              { value: 'no', label: '不黄' },
              { value: 'yes', label: '发黄' },
            ]}
          />
        </FormField>

        {/* TcB / TSB */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="经皮胆红素 TcB" htmlFor="jaundice-tcb">
            <Input
              id="jaundice-tcb"
              type="number"
              step="0.1"
              value={tcb}
              onChange={(e) => setTcb(e.target.value)}
              placeholder="如：10.5"
              rightIcon={<span className="text-xs">mg/dL</span>}
            />
          </FormField>
          <FormField label="血清胆红素 TSB" htmlFor="jaundice-tsb">
            <Input
              id="jaundice-tsb"
              type="number"
              step="0.1"
              value={tsb}
              onChange={(e) => setTsb(e.target.value)}
              placeholder="抽血才有"
              rightIcon={<span className="text-xs">mg/dL</span>}
            />
          </FormField>
        </div>

        {/* 分类 */}
        <FormField label="黄疸类型（可选）">
          <SegmentedControl<JaundiceType>
            value={jaundiceType}
            onChange={(v) => setJaundiceType(v)}
            accentColor={accentColor}
            toggleable
            options={JAUNDICE_TYPE_OPTIONS}
          />
        </FormField>

        {/* 伴随表现 */}
        <FormField label="伴随表现">
          <MultiBadge
            options={SYMPTOM_OPTIONS}
            value={symptoms}
            onChange={setSymptoms}
            accentColor={accentColor}
          />
        </FormField>

        {/* 处置 */}
        <FormField label="处置">
          <MultiBadge
            options={ACTION_OPTIONS}
            value={actions}
            onChange={setActions}
            accentColor={accentColor}
          />
        </FormField>

        {/* 备注 */}
        <FormField label="备注" htmlFor="jaundice-note">
          <Input
            id="jaundice-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="补充说明（选填）"
          />
        </FormField>

        <Alert variant="info" size="compact">
          本页数据仅保存在本机浏览器，不会上传。黄疸严重或持续时间过长时请及时就医。
        </Alert>
      </form>
    </Dialog>
  )
}
