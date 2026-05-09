/**
 * MilestonePage v8 - 打卡模式（Check-in）
 *
 * 改造点：
 * - 不再有"添加记录"表单，唯一交互是对标准 28 项做"打卡 / 取消打卡"
 * - 列表主体 = 标准里程碑卡片（按类别筛选），每张卡右侧一个圆形 toggle
 * - Detail 弹窗：未达成 → "标记达成"；已达成 → 可编辑达成日期 + 备注 + 取消打卡
 * - 旧的"标准推荐"抽屉移除（与主列表重复）
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { milestoneService } from '@/services/baby-extra'
import {
  MILESTONE_DEFINITIONS,
  getCategoryKey,
  getCategoryLabel,
} from '@/lib/milestone-defs'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { NumberRoll } from '@/components/number-roll'
import {
  staggerContainer,
  staggerItem,
  overlayFade,
  springSoft,
} from '@/lib/motion'
import type { MilestoneItem } from '@/lib/milestone-defs'
import type { MilestoneRecord, Baby } from '@/types'

type CategoryFilter = 'all' | string

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  )
}

function parseWindow(window: string): { min: number; max: number } {
  const match = window.match(/([\d.]+)-([\d.]+)月/)
  if (!match) return { min: 0, max: 24 }
  return { min: parseFloat(match[1]), max: parseFloat(match[2]) }
}

const categoryColorMap: Record<
  string,
  { color: string; bg: string; fg: string }
> = {
  motor: { color: 'var(--feeding)', bg: 'var(--feeding-bg)', fg: 'var(--feeding-fg)' },
  fine_motor: { color: 'var(--sleep)', bg: 'var(--sleep-bg)', fg: 'var(--sleep-fg)' },
  language: { color: 'var(--growth)', bg: 'var(--growth-bg)', fg: 'var(--growth-fg)' },
  social: { color: 'var(--diaper)', bg: 'var(--diaper-bg)', fg: 'var(--diaper-fg)' },
  cognitive: {
    color: 'var(--temperature)',
    bg: 'var(--temperature-bg)',
    fg: 'var(--temperature-fg)',
  },
}

function getCategoryStyle(key: string) {
  return (
    categoryColorMap[key] ?? {
      color: 'var(--brand)',
      bg: 'var(--brand-soft)',
      fg: 'var(--brand-ink)',
    }
  )
}

type StandardItem = {
  category: string
  categoryKey: string
  item: MilestoneItem
  status: 'achieved' | 'in_window' | 'upcoming' | 'warning'
  /** 已打卡时对应的服务端记录 */
  record: MilestoneRecord | null
}

export function MilestonePage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<StandardItem | null>(null)
  // 详情弹窗内联编辑（仅已达成态可用）
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const loadMilestones = useCallback(async () => {
    if (!currentBaby) return
    setIsLoading(true)
    try {
      // 后端 pageSize 上限 100，循环拉完（标准 28 项实际一页搞定，这里是防御性分页）
      const all: MilestoneRecord[] = []
      const PAGE_SIZE = 100
      const MAX_PAGES = 10
      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await milestoneService.list(currentBaby.id, {
          page,
          pageSize: PAGE_SIZE,
        })
        all.push(...(result.items || []))
        if (!result.hasMore) break
      }
      setMilestones(all)
    } catch {
      setMilestones([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBaby])

  useEffect(() => {
    loadMilestones()
  }, [loadMilestones])

  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 0

  /** name → record，方便 O(1) 查询打卡状态 */
  const recordByName = useMemo(() => {
    const map = new Map<string, MilestoneRecord>()
    milestones.forEach((m) => map.set(m.name, m))
    return map
  }, [milestones])

  const standardMilestones = useMemo<StandardItem[]>(() => {
    const result: StandardItem[] = []
    for (const cat of MILESTONE_DEFINITIONS) {
      for (const item of cat.items) {
        const { min, max } = parseWindow(item.window)
        const record = recordByName.get(item.name) ?? null
        let status: StandardItem['status']
        if (record) status = 'achieved'
        else if (ageMonths >= min && ageMonths <= max) status = 'in_window'
        else if (ageMonths > item.warningMonths) status = 'warning'
        else status = 'upcoming'
        result.push({
          category: cat.category,
          categoryKey: getCategoryKey(cat.category),
          item,
          status,
          record,
        })
      }
    }
    return result
  }, [recordByName, ageMonths])

  const stats = useMemo(() => {
    const total = standardMilestones.length
    const achieved = standardMilestones.filter((m) => m.status === 'achieved').length
    const inWindow = standardMilestones.filter((m) => m.status === 'in_window').length
    const warning = standardMilestones.filter((m) => m.status === 'warning').length
    return { total, achieved, inWindow, warning }
  }, [standardMilestones])

  const completionPct =
    stats.total > 0 ? Math.round((stats.achieved / stats.total) * 100) : 0

  const filtered =
    categoryFilter === 'all'
      ? standardMilestones
      : standardMilestones.filter((m) => m.categoryKey === categoryFilter)

  /** 打卡（未达成 → 已达成） */
  const checkIn = useCallback(
    async (target: StandardItem) => {
      if (!currentBaby || target.record) return
      setPendingName(target.item.name)
      try {
        const created = await milestoneService.create(currentBaby.id, {
          name: target.item.name,
          category: target.categoryKey,
          achievedDate: new Date().toISOString(),
        })
        // 乐观合并
        setMilestones((prev) => {
          const next = prev.filter((m) => m.name !== created.name)
          next.unshift(created)
          return next
        })
      } catch (err) {
        console.error('Failed to check-in milestone:', err)
      } finally {
        setPendingName(null)
      }
    },
    [currentBaby],
  )

  /** 取消打卡（已达成 → 未达成） */
  const checkOut = useCallback(
    async (target: StandardItem, opts: { skipConfirm?: boolean } = {}) => {
      if (!currentBaby || !target.record) return
      if (!opts.skipConfirm) {
        const ok = await confirm({
          title: `取消"${target.item.name}"的打卡？`,
          description: '记录将被删除，可随时重新打卡。',
          confirmText: '取消打卡',
          variant: 'danger',
        })
        if (!ok) return
      }
      setPendingName(target.item.name)
      try {
        await milestoneService.remove(currentBaby.id, target.record.id)
        setMilestones((prev) => prev.filter((m) => m.id !== target.record!.id))
      } catch (err) {
        console.error('Failed to check-out milestone:', err)
      } finally {
        setPendingName(null)
      }
    },
    [currentBaby, confirm],
  )

  /** 卡片右侧 toggle 按钮点击 */
  const handleToggle = useCallback(
    (e: React.MouseEvent, target: StandardItem) => {
      e.stopPropagation()
      if (pendingName === target.item.name) return
      if (target.record) {
        // 已达成 → 取消打卡（需要二次确认）
        checkOut(target)
      } else {
        // 未达成 → 直接打卡（轻量动作，无需确认）
        checkIn(target)
      }
    },
    [pendingName, checkIn, checkOut],
  )

  /** 打开详情弹窗，进入时同步初始化编辑表单 */
  const openDetail = useCallback((target: StandardItem) => {
    setDetailItem(target)
    if (target.record) {
      setEditDate(target.record.achievedDate.split('T')[0])
      setEditNote(target.record.note ?? '')
    } else {
      setEditDate('')
      setEditNote('')
    }
  }, [])

  /** 详情里：标记达成（未达成态主按钮） */
  const handleMarkFromDetail = useCallback(async () => {
    if (!detailItem) return
    await checkIn(detailItem)
    // 关弹窗（也可以保留弹窗；这里关闭让用户感受到状态切换完成）
    setDetailItem(null)
  }, [detailItem, checkIn])

  /** 详情里：保存编辑（已达成态） */
  const handleSaveEdit = useCallback(async () => {
    if (!detailItem || !detailItem.record || !currentBaby) return
    setIsSavingEdit(true)
    try {
      const isoDate = new Date(`${editDate}T00:00:00`).toISOString()
      const updated = await milestoneService.update(
        currentBaby.id,
        detailItem.record.id,
        {
          achievedDate: isoDate,
          note: editNote.trim() ? editNote.trim() : null,
        },
      )
      setMilestones((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      )
      setDetailItem(null)
    } catch (err) {
      console.error('Failed to update milestone:', err)
    } finally {
      setIsSavingEdit(false)
    }
  }, [detailItem, currentBaby, editDate, editNote])

  /** 详情里：取消打卡 */
  const handleCheckOutFromDetail = useCallback(async () => {
    if (!detailItem) return
    await checkOut(detailItem)
    setDetailItem(null)
  }, [detailItem, checkOut])

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader title="里程碑" backTo="/discover" />
      </motion.div>

      {/* Hero 进度卡 */}
      <motion.div variants={staggerItem}>
        <Card variant="hero" style={{ backgroundColor: 'var(--diaper-bg)' }}>
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className="footnote font-semibold mb-1"
                style={{ color: 'var(--diaper-fg)' }}
              >
                成长进度
              </p>
              <div className="flex items-baseline gap-2">
                <span className="metric-lg" style={{ color: 'var(--diaper-fg)' }}>
                  <NumberRoll value={stats.achieved} />
                </span>
                <span className="title-3" style={{ color: 'var(--label-secondary)' }}>
                  / {stats.total}
                </span>
                <Badge size="sm" variant="diaper">
                  {completionPct}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {stats.inWindow > 0 && (
                  <Badge size="xs" variant="sleep">
                    进行中 · {stats.inWindow}
                  </Badge>
                )}
                {stats.warning > 0 && (
                  <Badge size="xs" variant="danger">
                    需关注 · {stats.warning}
                  </Badge>
                )}
                {currentBaby && (
                  <Badge size="xs" accentColor="var(--label-tertiary)">
                    {ageMonths} 月龄
                  </Badge>
                )}
              </div>
            </div>
            <Trophy
              className="h-10 w-10 shrink-0"
              style={{ color: 'var(--diaper)', opacity: 0.6 }}
            />
          </div>
          <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--surface-2)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: 'var(--diaper)' }}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </Card>
      </motion.div>

      {/* 类别筛选 */}
      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v)}
          options={[
            { value: 'all', label: '全部' },
            ...Object.keys(categoryColorMap).map((key) => ({
              value: key,
              label: getCategoryLabel(key),
            })),
          ]}
          size="md"
        />
      </motion.div>

      {/* 打卡列表 */}
      {isLoading ? (
        <ListSkeleton count={6} withAccent={false} />
      ) : (
        <motion.div variants={staggerItem}>
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {filtered.map((m) => {
                const cs = getCategoryStyle(m.categoryKey)
                const isAchieved = m.status === 'achieved'
                const isPending = pendingName === m.item.name
                const StatusIcon =
                  m.status === 'warning'
                    ? AlertTriangle
                    : m.status === 'in_window'
                      ? Sparkles
                      : Sparkles
                const accentColor =
                  m.status === 'warning' ? 'var(--danger)' : cs.color
                return (
                  <button
                    key={m.item.name}
                    type="button"
                    onClick={() => openDetail(m)}
                    className="relative flex items-center gap-3 px-5 py-3.5 min-w-0 w-full text-left transition-colors hover:bg-[var(--surface-2)]"
                    style={{
                      opacity: isAchieved ? 0.7 : 1,
                    }}
                  >
                    <span
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                      style={{ backgroundColor: accentColor }}
                      aria-hidden
                    />
                    <div
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: cs.bg, color: cs.fg }}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className="callout font-semibold truncate"
                          style={{
                            color: 'var(--label)',
                            textDecoration: isAchieved ? 'line-through' : 'none',
                          }}
                        >
                          {m.item.name}
                        </p>
                        <Badge size="xs" accentColor={cs.color}>
                          {getCategoryLabel(m.categoryKey)}
                        </Badge>
                        {m.status === 'warning' && !isAchieved && (
                          <Badge size="xs" variant="danger">
                            需关注
                          </Badge>
                        )}
                        {m.status === 'in_window' && !isAchieved && (
                          <Badge size="xs" variant="sleep">
                            进行中
                          </Badge>
                        )}
                      </div>
                      <p
                        className="footnote mt-0.5"
                        style={{ color: 'var(--label-secondary)' }}
                      >
                        {isAchieved && m.record
                          ? `已打卡 · ${new Date(m.record.achievedDate).toLocaleDateString('zh-CN')}`
                          : `窗口期 ${m.item.window}`}
                      </p>
                    </div>
                    {/* 打卡 toggle 按钮 */}
                    <motion.span
                      role="checkbox"
                      aria-checked={isAchieved}
                      aria-label={isAchieved ? '取消打卡' : '打卡'}
                      tabIndex={0}
                      onClick={(e) => handleToggle(e, m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          handleToggle(e as unknown as React.MouseEvent, m)
                        }
                      }}
                      whileTap={{ scale: 0.88 }}
                      transition={springSoft}
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                      style={{
                        backgroundColor: isAchieved ? cs.color : 'transparent',
                        border: isAchieved
                          ? `1.5px solid ${cs.color}`
                          : '1.5px solid var(--separator-opaque)',
                        color: isAchieved
                          ? 'var(--surface-1)'
                          : 'var(--label-tertiary)',
                        opacity: isPending ? 0.5 : 1,
                      }}
                    >
                      {isAchieved ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" strokeWidth={1.5} />
                      )}
                    </motion.span>
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Detail Popup */}
      <AnimatePresence>
        {detailItem && (
          <>
            <motion.div
              {...overlayFade}
              className="fixed inset-0 z-[60]"
              style={{ backgroundColor: 'var(--mask-dark)' }}
              onClick={() => setDetailItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={springSoft}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] max-h-[80vh] overflow-y-auto max-w-md mx-auto"
              style={{
                backgroundColor: 'var(--surface-1)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className="title-3"
                      style={{ color: 'var(--label)' }}
                    >
                      {detailItem.item.name}
                    </h3>
                    {detailItem.status === 'achieved' && (
                      <Badge
                        size="xs"
                        accentColor={getCategoryStyle(detailItem.categoryKey).color}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
                        已达成
                      </Badge>
                    )}
                  </div>
                  <p
                    className="caption-1 mt-0.5"
                    style={{ color: 'var(--label-tertiary)' }}
                  >
                    {detailItem.category} · 窗口期 {detailItem.item.window}
                  </p>
                </div>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  onClick={() => setDetailItem(null)}
                  aria-label="关闭"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <Label>描述</Label>
                  <p
                    className="footnote"
                    style={{ color: 'var(--label-secondary)' }}
                  >
                    {detailItem.item.description}
                  </p>
                </div>
                <div>
                  <Label>参考标准</Label>
                  <p
                    className="footnote"
                    style={{ color: 'var(--label-secondary)' }}
                  >
                    {detailItem.item.standard}
                  </p>
                  <p
                    className="caption-1 mt-0.5"
                    style={{ color: 'var(--label-tertiary)' }}
                  >
                    {detailItem.item.whoWindow}
                  </p>
                </div>
                {detailItem.item.warningMonths &&
                  detailItem.status !== 'achieved' && (
                    <div
                      className="px-3 py-2 rounded-[var(--radius-md)] flex items-start gap-2"
                      style={{ backgroundColor: 'var(--danger-bg)' }}
                    >
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color: 'var(--danger-fg)' }}
                      />
                      <p
                        className="caption-1"
                        style={{ color: 'var(--danger-fg)' }}
                      >
                        超过 {detailItem.item.warningMonths} 月未达成建议就医评估
                      </p>
                    </div>
                  )}
                <div>
                  <Label>如何帮助</Label>
                  <p
                    className="footnote"
                    style={{ color: 'var(--label-secondary)' }}
                  >
                    {detailItem.item.howToHelp}
                  </p>
                </div>

                {/* 已达成态：可编辑达成日期 + 备注 */}
                {detailItem.status === 'achieved' && detailItem.record && (
                  <div className="space-y-3 pt-2 border-t border-[var(--separator)]">
                    <FormField label="达成日期" htmlFor="ms-edit-date">
                      <Input
                        id="ms-edit-date"
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </FormField>
                    <FormField label="备注" htmlFor="ms-edit-note">
                      <Input
                        id="ms-edit-note"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="可选"
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {/* 主按钮区 */}
              <div className="mt-4 space-y-2">
                {detailItem.status !== 'achieved' ? (
                  <Button
                    variant="filled"
                    block
                    onClick={handleMarkFromDetail}
                    loading={pendingName === detailItem.item.name}
                  >
                    标记达成
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="filled"
                      block
                      onClick={handleSaveEdit}
                      loading={isSavingEdit}
                    >
                      保存修改
                    </Button>
                    <Button
                      variant="plain"
                      block
                      onClick={handleCheckOutFromDetail}
                      disabled={pendingName === detailItem.item.name}
                      style={{ color: 'var(--danger)' }}
                    >
                      取消打卡
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
