import { useState, useEffect, useMemo } from 'react'
import { Trophy, Plus, X, Star, AlertTriangle, Check, Trash2, ListChecks } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { milestoneService } from '@/services/baby-extra'
import { MILESTONE_DEFINITIONS, getCategoryKey, getCategoryLabel } from '@/lib/milestone-defs'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import type { MilestoneItem } from '@/lib/milestone-defs'
import type { MilestoneRecord, Baby } from '@/types'

type CategoryFilter = 'all' | string

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

/** Parse window string like "3.0-6.5月" to get min/max months */
function parseWindow(window: string): { min: number; max: number } {
  const match = window.match(/([\d.]+)-([\d.]+)月/)
  if (!match) return { min: 0, max: 24 }
  return { min: parseFloat(match[1]), max: parseFloat(match[2]) }
}

const categoryColors: Record<string, string> = {
  motor: 'var(--feeding)',
  fine_motor: 'var(--sleep)',
  language: 'var(--growth)',
  social: 'var(--diaper)',
  cognitive: 'var(--temperature)',
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

  useEffect(() => { loadMilestones() }, [currentBaby])

  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 0

  // Achieved milestone names set
  const achievedSet = useMemo(() => {
    const set = new Set<string>()
    milestones.forEach((m) => set.add(m.name))
    return set
  }, [milestones])

  // Standard milestone recommendations with status
  const standardMilestones = useMemo<StandardItem[]>(() => {
    const result: StandardItem[] = []

    for (const cat of MILESTONE_DEFINITIONS) {
      for (const item of cat.items) {
        const { min, max } = parseWindow(item.window)
        let status: StandardItem['status']
        if (achievedSet.has(item.name)) {
          status = 'achieved'
        } else if (ageMonths >= min && ageMonths <= max) {
          status = 'in_window'
        } else if (ageMonths > item.warningMonths) {
          status = 'warning'
        } else {
          status = 'upcoming'
        }
        result.push({ category: cat.category, categoryKey: getCategoryKey(cat.category), item, status })
      }
    }
    return result
  }, [achievedSet, ageMonths])

  // Stats
  const stats = useMemo(() => {
    const total = standardMilestones.length
    const achieved = standardMilestones.filter((m) => m.status === 'achieved').length
    const inWindow = standardMilestones.filter((m) => m.status === 'in_window').length
    const warning = standardMilestones.filter((m) => m.status === 'warning').length
    return { total, achieved, inWindow, warning }
  }, [standardMilestones])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentBaby || !name || !date) return
    setIsSubmitting(true)
    try {
      await milestoneService.create(currentBaby.id, { name, category, achievedDate: date, note: note || undefined })
      setShowAdd(false)
      setName(''); setCategory('motor'); setDate(new Date().toISOString().split('T')[0]); setNote('')
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

  // Group milestones by category
  const grouped = milestones.reduce((acc, m) => {
    const cat = m.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {} as Record<string, MilestoneRecord[]>)

  // Filter standard milestones by category
  const filteredStandardMilestones = categoryFilter === 'all'
    ? standardMilestones
    : standardMilestones.filter((m) => m.categoryKey === categoryFilter)

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="里程碑"
        backTo="/discover"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ListChecks className="h-3.5 w-3.5" />}
              onClick={() => setShowRecommend(true)}
            >
              标准推荐
            </Button>
            {!showAdd && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAdd(true)}
              >
                记录
              </Button>
            )}
          </div>
        }
      />

      {/* Stats - 4 column compact cards */}
      <div className="grid grid-cols-4 gap-2 stagger-children">
        {[
          { label: '已达成', value: stats.achieved, color: 'var(--feeding)' },
          { label: '进行中', value: stats.inWindow, color: 'var(--sleep)' },
          { label: '需关注', value: stats.warning, color: 'var(--danger)' },
          { label: '待发育', value: stats.total - stats.achieved - stats.inWindow - stats.warning, color: 'var(--text-hint)' },
        ].map((s) => (
          <Card
            key={s.label}
            padding="sm"
            className="text-center"
            style={{ borderTop: `2px solid ${s.color}` }}
          >
            <p className="heading-md number-display" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="caption mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant="ghost"
          size="sm"
          active={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
          accentColor="var(--primary)"
          className="rounded-full"
        >
          全部
        </Button>
        {Object.entries(categoryColors).map(([key, color]) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            active={categoryFilter === key}
            onClick={() => setCategoryFilter(key)}
            accentColor={color}
            className="rounded-full"
          >
            {getCategoryLabel(key)}
          </Button>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <Card as="section" className="animate-slide-up">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-sm text-[var(--text-primary)]">记录里程碑</h2>
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
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="如：第一次翻身"
              />
            </FormField>
            <FormField label="类别">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(categoryColors).map(([key, color]) => (
                  <Button
                    key={key}
                    type="button"
                    variant="ghost"
                    size="sm"
                    active={category === key}
                    accentColor={color}
                    onClick={() => setCategory(key)}
                    className="rounded-full"
                  >
                    {getCategoryLabel(key)}
                  </Button>
                ))}
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
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="可选"
              />
            </FormField>
            <Button type="submit" block loading={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </form>
        </Card>
      )}

      {/* Milestone List */}
      {isLoading ? (
        <ListSkeleton count={4} withAccent={false} />
      ) : milestones.length === 0 ? (
        <div className="empty-state">
          <Trophy className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">暂无里程碑记录</p>
          <p className="empty-state__desc">记录宝宝成长的每个重要时刻</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const color = categoryColors[cat] || 'var(--primary)'
          return (
            <Card key={cat} padding="md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="heading-sm" style={{ color }}>
                  {getCategoryLabel(cat)} · {items.length}
                </h3>
              </div>
              <div className="space-y-2">
                {items.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <Star className="h-4 w-4 shrink-0" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <p className="body-md text-[var(--text-primary)]">{m.name}</p>
                      <p className="caption">{new Date(m.achievedDate).toLocaleDateString('zh-CN')}</p>
                    </div>
                    {m.note && <p className="caption truncate max-w-[100px]">{m.note}</p>}
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
          )
        })
      )}

      {/* Standard Recommendation Drawer */}
      {showRecommend && (
        <>
          <div
            className="fixed inset-0 z-40 animate-fade-in"
            style={{ backgroundColor: 'var(--mask-dark)' }}
            onClick={() => setShowRecommend(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto animate-slide-up"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>
            <div className="p-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between">
                <h3 className="heading-sm text-[var(--text-primary)]">发育里程碑标准（WHO/CDC）</h3>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  onClick={() => setShowRecommend(false)}
                  aria-label="关闭"
                />
              </div>
              <p className="caption mt-1">当前：{ageMonths}月龄</p>
            </div>

            <div className="px-4 pb-6 grid grid-cols-2 gap-2">
              {filteredStandardMilestones.map((m, i) => {
                const color = categoryColors[m.categoryKey] || 'var(--primary)'
                const StatusIcon =
                  m.status === 'achieved' ? Check :
                  m.status === 'warning' ? AlertTriangle : Star
                const statusColor =
                  m.status === 'achieved' ? color :
                  m.status === 'warning' ? 'var(--danger)' :
                  m.status === 'in_window' ? color : 'var(--text-hint)'

                return (
                  <Card
                    key={i}
                    as="article"
                    variant="interactive"
                    padding="sm"
                    onClick={() => setDetailItem(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetailItem(m)
                      }
                    }}
                    className="text-left flex flex-col gap-2"
                    style={{ opacity: m.status === 'achieved' ? 0.55 : 1 }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="icon-circle icon-circle--sm w-7 h-7"
                        style={{ backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)` }}
                      >
                        <StatusIcon className="h-3.5 w-3.5" style={{ color: statusColor }} />
                      </div>
                      <Badge size="xs" accentColor={color}>
                        {getCategoryLabel(m.categoryKey)}
                      </Badge>
                    </div>
                    <div>
                      <p className="body-md font-medium text-[var(--text-primary)] line-clamp-1">{m.item.name}</p>
                      <p className="caption mt-0.5 line-clamp-2">{m.item.window}</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Detail Popup */}
      {detailItem && (
        <>
          <div
            className="fixed inset-0 z-[60] animate-fade-in"
            style={{ backgroundColor: 'var(--mask-dark)' }}
            onClick={() => setDetailItem(null)}
          />
          <div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] max-h-[80vh] overflow-y-auto animate-fade-in max-w-md mx-auto"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-md)',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="heading-sm text-[var(--text-primary)]">{detailItem.item.name}</h3>
                <p className="caption mt-0.5">{detailItem.category} · 窗口期 {detailItem.item.window}</p>
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
                <p className="body-md text-[var(--text-secondary)]">{detailItem.item.description}</p>
              </div>
              <div>
                <Label>参考标准</Label>
                <p className="body-md text-[var(--text-secondary)]">{detailItem.item.standard}</p>
                <p className="caption mt-0.5">{detailItem.item.whoWindow}</p>
              </div>
              {detailItem.item.warningMonths && (
                <div
                  className="px-3 py-2 rounded-xl flex items-start gap-2"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                  <p className="caption" style={{ color: 'var(--danger)' }}>
                    超过 {detailItem.item.warningMonths} 月未达成建议就医评估
                  </p>
                </div>
              )}
              <div>
                <Label>如何帮助</Label>
                <p className="body-md text-[var(--text-secondary)]">{detailItem.item.howToHelp}</p>
              </div>
              {detailItem.status !== 'achieved' && (
                <Button
                  onClick={() => handleQuickAddFromDef(detailItem.item, detailItem.categoryKey)}
                  disabled={isSubmitting}
                  block
                >
                  {isSubmitting ? '保存中...' : '标记已达成'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
