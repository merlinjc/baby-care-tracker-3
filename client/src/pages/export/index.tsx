/**
 * ExportPage v7.2 T-S1-F3 — 数据导出独立页 `/export`
 *
 * 设计：iOS Settings × 美拉德。4 张卡片（宝宝 / 范围 / 类型 / 格式）+ 主按钮 + 历史。
 *
 * 路由位置：MainLayout 内的 lazy 路由（routes.tsx）。
 *
 * 业务流程：
 *   1. 用户在 4 张卡片里设置参数（默认：当前 baby / 最近 7 天 / 5 个 Record 子类型 / CSV）
 *   2. 点「开始导出」→ 调 exportService.exportData(...) 拿 Blob
 *   3. 用 a[download] 直接下载 + revokeObjectURL
 *   4. 把元数据塞进 localStorage 历史（FIFO 上限 10 条）
 *   5. 历史列表点「重新下载」→ 用同一组 params 重发请求
 *
 * 与 Settings 旧入口的关系：Settings → 资料 tab 已不再展示导出按钮，旧 `/settings?tab=export`
 * 路由会通过页面内 useEffect 重定向到 `/export`（保留 deep link 兼容）。
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  AlertCircle,
  Calendar,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  History,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { BabyAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  exportService,
  EXPORT_DATA_TYPES,
  type ExportDataType,
} from '@/services/baby-extra'
import {
  addExportHistory,
  clearExportHistory,
  listExportHistory,
  removeExportHistory,
  type ExportHistoryItem,
} from '@/lib/export-history'
import { ApiError } from '@/lib/api-error'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { Baby } from '@/types'

type RangePreset = '7d' | '30d' | '90d' | 'all' | 'custom'

const PRESETS: RangePreset[] = ['7d', '30d', '90d', 'all', 'custom']
const PRESET_DAYS: Record<Exclude<RangePreset, 'all' | 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** 默认勾选 5 个 Record 子类型（与 v7.1 行为一致） */
const DEFAULT_TYPES: ExportDataType[] = [
  'feeding',
  'sleep',
  'diaper',
  'temperature',
  'growth',
]

function todayStartIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function isoToDateInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dateInputToIso(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined
  const d = new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return undefined
  if (endOfDay) d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ExportPage() {
  const { t } = useTranslation('export')
  const babies = useBabyStore((s) => s.babies)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()

  const [selectedBabyId, setSelectedBabyId] = useState<string>(currentBaby?.id ?? '')
  const [preset, setPreset] = useState<RangePreset>('7d')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>(isoToDateInput(todayStartIso()))
  const [selectedTypes, setSelectedTypes] = useState<ExportDataType[]>(DEFAULT_TYPES)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [history, setHistory] = useState<ExportHistoryItem[]>(() => listExportHistory())

  /**
   * 解析当前选中的时间范围 → ISO 字符串。
   * - 7d / 30d / 90d：endDate = 今天 23:59，startDate = 今天减 N 天的 00:00
   * - all：返回 undefined（后端忽略 startDate/endDate）
   * - custom：取用户填写的两端日期；endDate 转 23:59 兼容人工选当天导出当天
   */
  const range = useMemo(() => {
    if (preset === 'all') return { startDate: undefined, endDate: undefined }
    if (preset === 'custom') {
      const start = dateInputToIso(customStart)
      const end = dateInputToIso(customEnd, true)
      return { startDate: start, endDate: end }
    }
    const days = PRESET_DAYS[preset]
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    start.setHours(0, 0, 0, 0)
    return { startDate: start.toISOString(), endDate: end.toISOString() }
  }, [preset, customStart, customEnd])

  const customRangeInvalid =
    preset === 'custom' &&
    range.startDate &&
    range.endDate &&
    new Date(range.startDate).getTime() > new Date(range.endDate).getTime()

  const toggleType = (type: ExportDataType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }
  const selectAllTypes = () => setSelectedTypes([...EXPORT_DATA_TYPES])
  const clearTypes = () => setSelectedTypes([])

  const targetBaby: Baby | undefined =
    babies.find((b) => b.id === selectedBabyId) ?? currentBaby ?? babies[0]

  const handleExport = async () => {
    if (!targetBaby) {
      toast.error(t('toasts.no_baby'))
      return
    }
    if (selectedTypes.length === 0) {
      toast.error(t('toasts.no_types'))
      return
    }
    if (customRangeInvalid) {
      toast.error(t('toasts.invalid_range'))
      return
    }

    setIsExporting(true)
    setProgress(0)
    try {
      const blob = await exportService.exportData(
        {
          babyId: targetBaby.id,
          format,
          types: selectedTypes,
          startDate: range.startDate,
          endDate: range.endDate,
        },
        (p) => setProgress(p),
      )
      const date = new Date().toISOString().split('T')[0]
      const filename = `baby_care_${targetBaby.name}_${date}.${format}`
      downloadBlob(blob, filename)
      const next = addExportHistory({
        babyId: targetBaby.id,
        babyName: targetBaby.name,
        format,
        types: selectedTypes,
        startDate: range.startDate,
        endDate: range.endDate,
        filename,
      })
      setHistory(next)
      toast.success(t('toasts.success', { format: format.toUpperCase() }))
    } catch (err) {
      toast.error(formatExportError(err, t))
    } finally {
      setIsExporting(false)
      setProgress(0)
    }
  }

  const handleRedownload = async (item: ExportHistoryItem) => {
    const baby = babies.find((b) => b.id === item.babyId)
    if (!baby) {
      toast.error(t('toasts.no_baby'))
      return
    }
    setIsExporting(true)
    try {
      const blob = await exportService.exportData({
        babyId: item.babyId,
        format: item.format,
        types: item.types as ExportDataType[],
        startDate: item.startDate,
        endDate: item.endDate,
      })
      downloadBlob(blob, item.filename)
      toast.success(t('toasts.success', { format: item.format.toUpperCase() }))
    } catch (err) {
      toast.error(formatExportError(err, t))
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearHistory = async () => {
    const ok = await confirm({
      title: t('actions.clear_history'),
      description: t('history.empty_hint'),
      variant: 'danger',
      confirmText: t('actions.clear_history'),
    })
    if (!ok) return
    clearExportHistory()
    setHistory([])
  }

  const handleRemove = (id: string) => {
    setHistory(removeExportHistory(id))
  }

  // 没有宝宝时给一个空态
  if (babies.length === 0) {
    return (
      <motion.div
        className="space-y-5"
        data-page-stack
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <LargeTitleHeader title={t('title')} backTo="/profile" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <User
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              {t('no_baby.title')}
            </p>
            <p
              className="footnote mt-1"
              style={{ color: 'var(--label-tertiary)' }}
            >
              {t('no_baby.hint')}
            </p>
          </Card>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* —— 大标题 —— */}
      <motion.div variants={staggerItem}>
        <LargeTitleHeader title={t('title')} backTo="/profile" />
      </motion.div>

      {/* —— 副标题 —— */}
      <motion.div variants={staggerItem}>
        <p className="footnote" style={{ color: 'var(--label-tertiary)' }}>
          {t('subtitle')}
        </p>
      </motion.div>

      {/* —— 宝宝 —— */}
      {babies.length > 1 && (
        <motion.div variants={staggerItem}>
          <SectionHeader title={t('sections.baby')} variant="grouped" />
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {babies.map((b) => {
                const checked = selectedBabyId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBabyId(b.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                    aria-pressed={checked}
                  >
                    <BabyAvatar baby={b} size="md" />
                    <span
                      className="callout flex-1 truncate"
                      style={{ color: 'var(--label)' }}
                    >
                      {b.name}
                    </span>
                    {checked && (
                      <Check
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--brand)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* —— 时间范围 —— */}
      <motion.div variants={staggerItem}>
        <SectionHeader title={t('sections.range')} variant="grouped" />
        <Card as="section" padding="md" className="space-y-3">
          <SegmentedControl<RangePreset>
            value={preset}
            onChange={setPreset}
            options={PRESETS.map((p) => ({
              value: p,
              label: t(`range.${rangeKey(p)}`),
            }))}
          />
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('range.start')} htmlFor="export-start">
                <Input
                  id="export-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  max={customEnd || undefined}
                />
              </FormField>
              <FormField label={t('range.end')} htmlFor="export-end">
                <Input
                  id="export-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart || undefined}
                />
              </FormField>
            </div>
          )}
          {customRangeInvalid && (
            <p
              className="footnote flex items-center gap-1.5"
              style={{ color: 'var(--danger)' }}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {t('toasts.invalid_range')}
            </p>
          )}
        </Card>
      </motion.div>

      {/* —— 数据类型 —— */}
      <motion.div variants={staggerItem}>
        <SectionHeader title={t('sections.types')} variant="grouped" />
        <Card as="section" padding="md" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPORT_DATA_TYPES.map((type) => {
              const checked = selectedTypes.includes(type)
              const id = `export-type-${type}`
              return (
                <label
                  key={type}
                  htmlFor={id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] cursor-pointer transition-colors hover:bg-[var(--surface-hover)] border border-[var(--separator)]"
                  style={
                    checked
                      ? {
                          backgroundColor: 'var(--brand-soft)',
                          borderColor: 'var(--brand)',
                        }
                      : undefined
                  }
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <span
                    className="callout truncate"
                    style={{
                      color: checked ? 'var(--brand-ink)' : 'var(--label)',
                    }}
                  >
                    {t(`types.${type}`)}
                  </span>
                </label>
              )
            })}
          </div>
          <div className="flex items-center justify-between footnote">
            <span style={{ color: 'var(--label-tertiary)' }}>
              {selectedTypes.length} / {EXPORT_DATA_TYPES.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllTypes}
                className="px-2 py-1 rounded transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--brand-ink)' }}
              >
                {t('actions.select_all')}
              </button>
              <button
                type="button"
                onClick={clearTypes}
                className="px-2 py-1 rounded transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--label-tertiary)' }}
              >
                {t('actions.clear_selection')}
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* —— 格式 —— */}
      <motion.div variants={staggerItem}>
        <SectionHeader title={t('sections.format')} variant="grouped" />
        <div className="grid grid-cols-2 gap-3">
          <FormatCard
            active={format === 'csv'}
            Icon={FileSpreadsheet}
            label={t('format.csv')}
            desc={t('format.csv_desc')}
            onClick={() => setFormat('csv')}
            accent="var(--temperature)"
          />
          <FormatCard
            active={format === 'json'}
            Icon={FileJson}
            label={t('format.json')}
            desc={t('format.json_desc')}
            onClick={() => setFormat('json')}
            accent="var(--brand)"
          />
        </div>
      </motion.div>

      {/* —— 主按钮 —— */}
      <motion.div variants={staggerItem} className="pt-2">
        <Button
          variant="filled"
          block
          size="lg"
          loading={isExporting}
          disabled={selectedTypes.length === 0 || !targetBaby}
          leftIcon={<Download className="h-4 w-4" />}
          onClick={handleExport}
        >
          {isExporting && progress > 0
            ? `${t('actions.exporting')} ${Math.round(progress * 100)}%`
            : isExporting
              ? t('actions.exporting')
              : t('actions.export')}
        </Button>
      </motion.div>

      {/* —— 历史 —— */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between">
          <SectionHeader title={t('sections.history')} variant="grouped" />
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="footnote px-2 py-1 rounded transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--label-tertiary)' }}
            >
              {t('actions.clear_history')}
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <Card variant="cta" padding="lg" className="text-center">
            <History
              className="h-9 w-9 mx-auto mb-2"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              {t('history.empty')}
            </p>
            <p
              className="footnote mt-1"
              style={{ color: 'var(--label-tertiary)' }}
            >
              {t('history.empty_hint')}
            </p>
          </Card>
        ) : (
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-5 py-3.5 min-w-0"
                >
                  <div
                    className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
                    style={{
                      backgroundColor:
                        item.format === 'csv'
                          ? 'var(--temperature-bg)'
                          : 'var(--brand-soft)',
                      color:
                        item.format === 'csv'
                          ? 'var(--temperature-fg)'
                          : 'var(--brand-ink)',
                    }}
                  >
                    {item.format === 'csv' ? (
                      <FileSpreadsheet className="h-4 w-4" />
                    ) : (
                      <FileJson className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="callout truncate"
                      style={{ color: 'var(--label)' }}
                      title={item.filename}
                    >
                      {item.filename}
                    </p>
                    <p
                      className="caption-1 mt-0.5"
                      style={{ color: 'var(--label-tertiary)' }}
                    >
                      <Calendar className="inline h-3 w-3 mr-1 align-[-1px]" />
                      {formatDateTime(item.exportedAt)} · {item.babyName}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.types.map((type) => (
                        <Badge
                          key={`${item.id}-${type}`}
                          size="xs"
                          variant="default"
                        >
                          {t(`types.${type}`, { defaultValue: type })}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => handleRedownload(item)}
                      aria-label={t('actions.redownload')}
                    />
                    <IconButton
                      variant="danger-ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => handleRemove(item.id)}
                      aria-label={t('actions.clear_history')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}

/** SegmentedControl key 与 i18n key 映射（'7d' → 'last_7_days'） */
function rangeKey(preset: RangePreset): string {
  switch (preset) {
    case '7d':
      return 'last_7_days'
    case '30d':
      return 'last_30_days'
    case '90d':
      return 'last_90_days'
    case 'custom':
      return 'custom'
    case 'all':
      return 'all'
  }
}

interface FormatCardProps {
  active: boolean
  Icon: typeof FileJson
  label: string
  desc: string
  onClick: () => void
  accent: string
}

function FormatCard({ active, Icon, label, desc, onClick, accent }: FormatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-left rounded-[14px] transition-all"
    >
      <Card
        variant="elevated"
        padding="md"
        className="flex flex-col items-center text-center gap-2 h-full"
        style={
          active
            ? {
                backgroundColor: 'var(--brand-soft)',
                outline: `2px solid ${accent}`,
                outlineOffset: '-1px',
              }
            : undefined
        }
      >
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
            color: accent,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p
            className="headline"
            style={{ color: active ? 'var(--brand-ink)' : 'var(--label)' }}
          >
            {label}
          </p>
          <p
            className="caption-1 mt-0.5"
            style={{ color: 'var(--label-tertiary)' }}
          >
            {desc}
          </p>
        </div>
      </Card>
    </button>
  )
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 给浏览器一点时间触发下载再 revoke，避免某些移动端 race
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function formatExportError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return t('errors.rate_limited')
    if (err.status === 401) return t('errors.unauthorized')
    return t('toasts.failed', { message: err.message })
  }
  if (err instanceof Error) {
    if (/network|timeout|aborted/i.test(err.message)) return t('errors.network')
    return t('toasts.failed', { message: err.message })
  }
  return t('toasts.failed', { message: 'Unknown' })
}
