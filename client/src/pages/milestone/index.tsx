import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Trophy, Plus, X, Star, AlertTriangle, Check, Trash2, ListChecks } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { milestoneService } from '@/services/baby-extra'
import { MILESTONE_DEFINITIONS, getCategoryKey, getCategoryLabel } from '@/lib/milestone-defs'
import type { MilestoneRecord, MilestoneItem, Baby } from '@/types'

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
    if (!confirm('确定删除这条里程碑记录吗？')) return
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="heading-lg text-[var(--text-primary)]">里程碑</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecommend(true)}
            className="chip chip--inactive"
          >
            <ListChecks className="h-3.5 w-3.5" />
            标准推荐
          </button>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary text-[var(--text-xs)] px-3 py-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              记录
            </button>
          )}
        </div>
      </div>

      {/* Stats - 4 column compact cards */}
      <div className="grid grid-cols-4 gap-2 stagger-children">
        {[
          { label: '已达成', value: stats.achieved, color: 'var(--feeding)' },
          { label: '进行中', value: stats.inWindow, color: 'var(--sleep)' },
          { label: '需关注', value: stats.warning, color: 'var(--danger)' },
          { label: '待发育', value: stats.total - stats.achieved - stats.inWindow - stats.warning, color: 'var(--text-hint)' },
        ].map((s) => (
          <div key={s.label} className="card-base text-center" style={{ borderTop: `2px solid ${s.color}` }}>
            <p className="heading-md number-display" style={{ color: s.color }}>{s.value}</p>
            <p className="caption mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`chip ${categoryFilter === 'all' ? 'chip--active' : 'chip--inactive'}`}
          style={categoryFilter === 'all' ? { backgroundColor: 'var(--primary)' } : undefined}
        >
          全部
        </button>
        {Object.entries(categoryColors).map(([key, color]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={`chip ${categoryFilter === key ? 'chip--active' : 'chip--inactive'}`}
            style={categoryFilter === key ? { backgroundColor: color } : undefined}
          >
            {getCategoryLabel(key)}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="heading-sm text-[var(--text-primary)]">记录里程碑</h2>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <label className="label-base">里程碑名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="如：第一次翻身" className="input-base" />
          </div>
          <div>
            <label className="label-base">类别</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {Object.entries(categoryColors).map(([key, color]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`chip ${category === key ? 'chip--active' : 'chip--inactive'}`}
                  style={category === key ? { backgroundColor: color } : undefined}
                >
                  {getCategoryLabel(key)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-base">达成日期</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="input-base" />
          </div>
          <div>
            <label className="label-base">备注</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" className="input-base" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </form>
      )}

      {/* Milestone List */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-hint)]">
          <div className="spinner" />
          <span className="body-md">加载中...</span>
        </div>
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
            <div key={cat} className="card-base">
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
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="p-1 rounded text-[var(--text-hint)] hover:text-[var(--danger)] transition-colors shrink-0"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
                <button
                  onClick={() => setShowRecommend(false)}
                  className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
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
                  <button
                    key={i}
                    onClick={() => setDetailItem(m)}
                    className="card-interactive text-left flex flex-col gap-2 p-3"
                    style={{
                      opacity: m.status === 'achieved' ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="icon-circle icon-circle--sm w-7 h-7"
                        style={{ backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)` }}
                      >
                        <StatusIcon className="h-3.5 w-3.5" style={{ color: statusColor }} />
                      </div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                      >
                        {m.category}
                      </span>
                    </div>
                    <div>
                      <p className="body-md font-medium text-[var(--text-primary)] line-clamp-1">{m.item.name}</p>
                      <p className="caption mt-0.5 line-clamp-2">{m.item.window}</p>
                    </div>
                  </button>
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
              <button
                onClick={() => setDetailItem(null)}
                className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="label-base">描述</p>
                <p className="body-md text-[var(--text-secondary)]">{detailItem.item.description}</p>
              </div>
              <div>
                <p className="label-base">参考标准</p>
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
                <p className="label-base">如何帮助</p>
                <p className="body-md text-[var(--text-secondary)]">{detailItem.item.howToHelp}</p>
              </div>
              {detailItem.status !== 'achieved' && (
                <button
                  onClick={() => handleQuickAddFromDef(detailItem.item, detailItem.categoryKey)}
                  disabled={isSubmitting}
                  className="btn-primary w-full"
                >
                  {isSubmitting ? '保存中...' : '标记已达成'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
