/**
 * MilestonePage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - 顶部 4 列 stats → 简化为 Hero 卡（已达成 / 总数 + 进度 + 进行中/需关注 chip）
 * - 类别筛选 → SegmentedControl（横向滚动备份）
 * - 列表：按类别分组，每组一张 Card padding="none" + ListRow
 * - Drawer：保留功能，配色暖调化
 * - Detail Popup：保留功能
 */
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle, ListChecks, PlusCircle, Sparkles, Trash2, Trophy, X } from 'lucide-react';
import { useBabyStore } from '@/stores/baby-store'
import { milestoneService } from '@/services/baby-extra'
import { MILESTONE_DEFINITIONS, getCategoryKey, getCategoryLabel } from '@/lib/milestone-defs'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
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
import { staggerContainer, staggerItem, sheetMobile, overlayFade, springSoft } from '@/lib/motion'
import type { MilestoneItem } from '@/lib/milestone-defs'
import type { MilestoneRecord, Baby } from '@/types'

type CategoryFilter = 'all' | string

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
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
}

export function MilestonePage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('motor')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<StandardItem | null>(null)

  const loadMilestones = async () => {
    if (!currentBaby) return
    setIsLoading(true)
    try {
      const result = await milestoneService.list(currentBaby.id)
      setMilestones(result.items || [])
    } catch {
      setMilestones([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMilestones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBaby])

  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 0

  const achievedSet = useMemo(() => {
    const set = new Set<string>()
    milestones.forEach((m) => set.add(m.name))
    return set
  }, [milestones])

  const standardMilestones = useMemo<StandardItem[]>(() => {
    const result: StandardItem[] = []
    for (const cat of MILESTONE_DEFINITIONS) {
      for (const item of cat.items) {
        const { min, max } = parseWindow(item.window)
        let status: StandardItem['status']
        if (achievedSet.has(item.name)) status = 'achieved'
        else if (ageMonths >= min && ageMonths <= max) status = 'in_window'
        else if (ageMonths > item.warningMonths) status = 'warning'
        else status = 'upcoming'
        result.push({
          category: cat.category,
          categoryKey: getCategoryKey(cat.category),
          item,
          status,
        })
      }
    }
    return result
  }, [achievedSet, ageMonths])

  const stats = useMemo(() => {
    const total = standardMilestones.length
    const achieved = standardMilestones.filter((m) => m.status === 'achieved').length
    const inWindow = standardMilestones.filter((m) => m.status === 'in_window').length
    const warning = standardMilestones.filter((m) => m.status === 'warning').length
    return { total, achieved, inWindow, warning }
  }, [standardMilestones])

  const completionPct = stats.total > 0 ? Math.round((stats.achieved / stats.total) * 100) : 0

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentBaby || !name || !date) return
    setIsSubmitting(true)
    try {
      await milestoneService.create(currentBaby.id, {
        name,
        category,
        achievedDate: date,
        note: note || undefined,
      })
      setShowAdd(false)
      setName('')
      setCategory('motor')
      setDate(new Date().toISOString().split('T')[0])
      setNote('')
      loadMilestones()
    } catch (err) {
      console.error('Failed to create milestone:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickAddFromDef = async (item: MilestoneItem, categoryKey: string) => {
    if (!currentBaby) return
    setIsSubmitting(true)
    try {
      await milestoneService.create(currentBaby.id, {
        name: item.name,
        category: categoryKey,
        achievedDate: new Date().toISOString().split('T')[0],
      })
      loadMilestones()
      setDetailItem(null)
    } catch (err) {
      console.error('Failed to create milestone:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '删除这条里程碑记录？',
      description: '删除后不可恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    try {
      const api = (await import('@/services/api')).default
      await api.delete(`/babies/${currentBaby?.id}/milestones/${id}`)
      setMilestones((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error('Failed to delete milestone:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = milestones.reduce(
    (acc, m) => {
      const cat = m.category || 'other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(m)
      return acc
    },
    {} as Record<string, MilestoneRecord[]>,
  )

  const filteredStandardMilestones =
    categoryFilter === 'all'
      ? standardMilestones
      : standardMilestones.filter((m) => m.categoryKey === categoryFilter)

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title="里程碑"
          backTo="/discover"
          rightAction={
            <div className="flex items-center gap-2">
              <Button
                variant="plain"
                size="sm"
                leftIcon={<ListChecks className="h-3.5 w-3.5" />}
                onClick={() => setShowRecommend(true)}
              >
                标准推荐
              </Button>
              {!showAdd && (
                <Button
                  variant="tinted"
                  size="sm"
                  leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                  onClick={() => setShowAdd(true)}
                >
                  记录
                </Button>
              )}
            </div>
          }
        />
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
                <span
                  className="title-3"
                  style={{ color: 'var(--label-secondary)' }}
                >
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

      {/* 添加表单 */}
      {showAdd && (
        <motion.div
          variants={staggerItem}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card as="section">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="headline" style={{ color: 'var(--label)' }}>
                  记录里程碑
                </h2>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  onClick={() => setShowAdd(false)}
                  aria-label="关闭"
                />
              </div>
              <FormField label="里程碑名称" htmlFor="ms-name" required>
                <Input
                  id="ms-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="如：第一次翻身"
                />
              </FormField>
              <FormField label="类别">
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(categoryColorMap).map((key) => {
                    const s = getCategoryStyle(key)
                    const active = category === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        className="px-3 py-1.5 rounded-full footnote font-medium transition-colors"
                        style={
                          active
                            ? { backgroundColor: s.color, color: 'var(--surface-1)' }
                            : { backgroundColor: s.bg, color: s.fg }
                        }
                      >
                        {getCategoryLabel(key)}
                      </button>
                    )
                  })}
                </div>
              </FormField>
              <FormField label="达成日期" htmlFor="ms-date" required>
                <Input
                  id="ms-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="备注" htmlFor="ms-note">
                <Input
                  id="ms-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="可选"
                />
              </FormField>
              <Button type="submit" variant="filled" block loading={isSubmitting}>
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </form>
          </Card>
        </motion.div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={4} withAccent={false} />
      ) : milestones.length === 0 ? (
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <Trophy
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              暂无里程碑记录
            </p>
            <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
              记录宝宝成长的每个重要时刻
            </p>
          </Card>
        </motion.div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const s = getCategoryStyle(cat)
          return (
            <motion.div key={cat} variants={staggerItem}>
              <SectionHeader
                title={`${getCategoryLabel(cat)} · ${items.length}`}
                variant="grouped"
              />
              <Card padding="none">
                <div className="ios-list">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="relative flex items-center gap-3 px-4 py-3.5 min-w-0"
                    >
                      <span
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <div
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: s.bg, color: s.fg }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="callout font-semibold truncate"
                          style={{ color: 'var(--label)' }}
                        >
                          {m.name}
                        </p>
                        <p
                          className="footnote"
                          style={{ color: 'var(--label-secondary)' }}
                        >
                          {new Date(m.achievedDate).toLocaleDateString('zh-CN')}
                        </p>
                        {m.note && (
                          <p
                            className="caption-1 truncate"
                            style={{ color: 'var(--label-tertiary)' }}
                          >
                            {m.note}
                          </p>
                        )}
                      </div>
                      <IconButton
                        variant="danger-ghost"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        aria-label="删除"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )
        })
      )}

      {/* 标准推荐 Drawer */}
      <AnimatePresence>
        {showRecommend && (
          <>
            <motion.div
              {...overlayFade}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'var(--mask-dark)' }}
              onClick={() => setShowRecommend(false)}
            />
            <motion.div
              variants={sheetMobile}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto"
              style={{
                backgroundColor: 'var(--surface-1)',
                borderTopLeftRadius: 'var(--radius-xl)',
                borderTopRightRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex justify-center pt-2 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--separator-opaque)' }}
                />
              </div>
              <div
                className="p-4 sticky top-0 z-10"
                style={{
                  backgroundColor: 'var(--surface-1)',
                  borderBottom: '0.5px solid var(--separator)',
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="headline" style={{ color: 'var(--label)' }}>
                    发育里程碑标准（WHO/CDC）
                  </h3>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<X className="h-5 w-5" />}
                    onClick={() => setShowRecommend(false)}
                    aria-label="关闭"
                  />
                </div>
                <p
                  className="caption-1 mt-1"
                  style={{ color: 'var(--label-tertiary)' }}
                >
                  当前：{ageMonths}月龄
                </p>
              </div>

              <div className="px-4 pb-6 pt-2 grid grid-cols-2 gap-2" data-grid-2>
                {filteredStandardMilestones.map((m, i) => {
                  const cs = getCategoryStyle(m.categoryKey)
                  const StatusIcon =
                    m.status === 'achieved'
                      ? CheckCircle
                      : m.status === 'warning'
                        ? AlertTriangle
                        : Sparkles
                  const statusColor =
                    m.status === 'achieved'
                      ? cs.color
                      : m.status === 'warning'
                        ? 'var(--danger)'
                        : m.status === 'in_window'
                          ? cs.color
                          : 'var(--label-tertiary)'
                  return (
                    <motion.div
                      key={i}
                      whileTap={{ scale: 0.98 }}
                      transition={springSoft}
                    >
                      <Card
                        as="article"
                        variant="interactive"
                        padding="md"
                        onClick={() => setDetailItem(m)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDetailItem(m)
                          }
                        }}
                        className="text-left flex flex-col gap-2 cursor-pointer h-full"
                        style={{
                          opacity: m.status === 'achieved' ? 0.55 : 1,
                          backgroundColor: cs.bg,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${statusColor} 22%, transparent)`,
                              color: statusColor,
                            }}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                          </div>
                          <Badge size="xs" accentColor={cs.color}>
                            {getCategoryLabel(m.categoryKey)}
                          </Badge>
                        </div>
                        <div>
                          <p
                            className="callout font-semibold line-clamp-1"
                            style={{ color: cs.fg }}
                          >
                            {m.item.name}
                          </p>
                          <p
                            className="caption-1 mt-0.5 line-clamp-2"
                            style={{ color: cs.fg, opacity: 0.7 }}
                          >
                            {m.item.window}
                          </p>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <div className="flex-1">
                  <h3 className="title-3" style={{ color: 'var(--label)' }}>
                    {detailItem.item.name}
                  </h3>
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
                {detailItem.item.warningMonths && (
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
                {detailItem.status !== 'achieved' && (
                  <Button
                    variant="filled"
                    onClick={() =>
                      handleQuickAddFromDef(detailItem.item, detailItem.categoryKey)
                    }
                    disabled={isSubmitting}
                    block
                  >
                    {isSubmitting ? '保存中...' : '标记已达成'}
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
