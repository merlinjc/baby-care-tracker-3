import { useState, useEffect, useMemo } from 'react'
import { Syringe, Plus, X, Check, Clock, AlertTriangle, Trash2, ListChecks } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { vaccineService } from '@/services/baby-extra'
import { getVaccinePlans } from '@/lib/vaccine-plans'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { HeaderAction } from '@/components/header-action'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import type { VaccineRecord, Baby } from '@/types'

type StatusFilter = 'all' | 'completed' | 'upcoming' | 'overdue'

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

export function VaccinePage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadVaccines = async () => {
    if (!currentBaby) return
    setIsLoading(true)
    try {
      const result = await vaccineService.list(currentBaby.id)
      setVaccines(result.items || [])
    } catch {
      setVaccines([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadVaccines() }, [currentBaby])

  // Standard vaccine plans from birth date
  const standardPlans = useMemo(() => {
    if (!currentBaby) return []
    return getVaccinePlans(currentBaby.birthDate)
  }, [currentBaby])

  // Get already vaccinated names+dose combinations
  const vaccinatedSet = useMemo(() => {
    const set = new Set<string>()
    vaccines.forEach((v) => set.add(`${v.name}__${v.dose}`))
    return set
  }, [vaccines])

  // Age in months for determining upcoming/overdue
  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 0

  // Categorize standard plans into upcoming/overdue
  const planCategories = useMemo(() => {
    const upcoming: typeof standardPlans = []
    const overdue: typeof standardPlans = []
    standardPlans.forEach((plan) => {
      if (vaccinatedSet.has(`${plan.name}__${plan.dose}`)) return
      if (plan.monthAge > ageMonths) {
        upcoming.push(plan)
      } else {
        overdue.push(plan)
      }
    })
    return { upcoming, overdue }
  }, [standardPlans, vaccinatedSet, ageMonths])

  // Stats
  const stats = useMemo(() => ({
    total: standardPlans.length,
    completed: vaccinatedSet.size,
    upcoming: planCategories.upcoming.length,
    overdue: planCategories.overdue.length,
  }), [standardPlans, vaccinatedSet, planCategories])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentBaby || !name || !dose || !date) return
    setIsSubmitting(true)
    try {
      await vaccineService.create(currentBaby.id, { name, dose, vaccinatedDate: date, note: note || undefined })
      setShowAdd(false)
      setName(''); setDose(''); setDate(new Date().toISOString().split('T')[0]); setNote('')
      loadVaccines()
    } catch (err) {
      console.error('Failed to create vaccine:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickAddFromPlan = async (plan: { name: string; dose: string }) => {
    if (!currentBaby) return
    setIsSubmitting(true)
    try {
      await vaccineService.create(currentBaby.id, {
        name: plan.name,
        dose: plan.dose,
        vaccinatedDate: new Date().toISOString().split('T')[0],
      })
      loadVaccines()
    } catch (err) {
      console.error('Failed to create vaccine:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '删除这条疫苗记录？',
      description: '删除后不可恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    try {
      const api = (await import('@/services/api')).default
      await api.delete(`/babies/${currentBaby?.id}/vaccines/${id}`)
      setVaccines((prev) => prev.filter((v) => v.id !== id))
    } catch (err) {
      console.error('Failed to delete vaccine:', err)
    } finally {
      setDeletingId(null)
    }
  }

  // Filter display items
  const displayItems = useMemo(() => {
    switch (statusFilter) {
      case 'completed':
        return vaccines.map((v) => ({ type: 'record' as const, data: v }))
      case 'upcoming':
        return planCategories.upcoming.map((p) => ({ type: 'plan' as const, data: p }))
      case 'overdue':
        return planCategories.overdue.map((p) => ({ type: 'plan' as const, data: p }))
      default:
        return [
          ...planCategories.overdue.map((p) => ({ type: 'plan' as const, data: p })),
          ...planCategories.upcoming.map((p) => ({ type: 'plan' as const, data: p })),
          ...vaccines.map((v) => ({ type: 'record' as const, data: v })),
        ]
    }
  }, [statusFilter, vaccines, planCategories])

  const statusTabs: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: '全部', count: stats.total, color: 'var(--primary)' },
    { key: 'completed', label: '已接种', count: stats.completed, color: 'var(--feeding)' },
    { key: 'upcoming', label: '待接种', count: stats.upcoming, color: 'var(--sleep)' },
    { key: 'overdue', label: '逾期', count: stats.overdue, color: 'var(--danger)' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <PageHeader
        title="疫苗计划"
        backTo="/discover"
        action={
          <div className="flex items-center gap-2">
            <HeaderAction
              variant="ghost"
              icon={<ListChecks className="h-3.5 w-3.5" />}
              label="标准计划"
              onClick={() => setShowRecommend(true)}
            />
            {!showAdd && (
              <HeaderAction
                variant="primary"
                icon={<Plus className="h-3.5 w-3.5" />}
                label="添加"
                onClick={() => setShowAdd(true)}
              />
            )}
          </div>
        }
      />

      {/* Status Filter Tabs with count badge */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`chip ${statusFilter === tab.key ? 'chip--active' : 'chip--inactive'}`}
            style={statusFilter === tab.key ? { backgroundColor: tab.color } : undefined}
          >
            {tab.label}
            <span
              className="ml-1 px-1.5 rounded-full number-display text-[10px] leading-4"
              style={{
                backgroundColor: statusFilter === tab.key ? 'rgba(255,255,255,0.25)' : `color-mix(in srgb, ${tab.color} 12%, transparent)`,
                color: statusFilter === tab.key ? 'white' : tab.color,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="heading-sm text-[var(--text-primary)]">添加疫苗记录</h2>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <label className="label-base">疫苗名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="如：乙肝疫苗" className="input-base" />
          </div>
          <div>
            <label className="label-base">剂次</label>
            <input type="text" value={dose} onChange={(e) => setDose(e.target.value)} required placeholder="如：第1针" className="input-base" />
          </div>
          <div>
            <label className="label-base">接种日期</label>
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

      {/* Vaccine List */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : displayItems.length === 0 ? (
        <div className="empty-state">
          <Syringe className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">暂无疫苗记录</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {displayItems.map((item, i) => {
            if (item.type === 'record') {
              const v = item.data as VaccineRecord
              return (
                <div key={v.id} className="card-base flex items-center gap-3" style={{ borderLeft: '3px solid var(--feeding)' }}>
                  <div
                    className="icon-circle icon-circle--sm"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--feeding) 15%, transparent)' }}
                  >
                    <Check className="h-4 w-4" style={{ color: 'var(--feeding)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="body-md font-medium text-[var(--text-primary)]">{v.name}</p>
                    <p className="caption">
                      {v.dose} · {new Date(v.vaccinatedDate).toLocaleDateString('zh-CN')}
                    </p>
                    {v.note && <p className="caption truncate">{v.note}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(v.id)}
                    disabled={deletingId === v.id}
                    className="icon-btn icon-btn--danger"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            } else {
              const p = item.data as (typeof standardPlans)[0]
              const isOverdue = p.monthAge <= ageMonths
              const accentColor = isOverdue ? 'var(--danger)' : 'var(--sleep)'
              return (
                <div key={`plan-${i}`} className="card-base flex items-center gap-3" style={{ borderLeft: `3px solid ${accentColor}` }}>
                  <div
                    className="icon-circle icon-circle--sm"
                    style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
                  >
                    {isOverdue ? (
                      <AlertTriangle className="h-4 w-4" style={{ color: accentColor }} />
                    ) : (
                      <Clock className="h-4 w-4" style={{ color: accentColor }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="body-md font-medium text-[var(--text-primary)]">{p.name}</p>
                      <span className="caption">{p.dose}</span>
                      {!p.isFree && (
                        <span
                          className="badge-mini"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                            color: 'var(--warning)',
                          }}
                        >
                          自费
                        </span>
                      )}
                    </div>
                    <p className="caption">
                      {p.monthAge}月龄 · 计划：{p.plannedDate}
                      {isOverdue && <span style={{ color: 'var(--danger)' }}> (逾期)</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleQuickAddFromPlan(p)}
                    disabled={isSubmitting}
                    className="btn-primary px-2 py-1 text-[10px] shrink-0"
                  >
                    标记已接种
                  </button>
                </div>
              )
            }
          })}
        </div>
      )}

      {/* Standard Plan Drawer (bottom sheet) */}
      {showRecommend && (
        <>
          <div
            className="fixed inset-0 z-40 animate-fade-in"
            style={{ backgroundColor: 'var(--mask-dark)' }}
            onClick={() => setShowRecommend(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto animate-slide-up"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
            }}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            <div className="p-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between">
                <h3 className="heading-sm text-[var(--text-primary)]">国家标准免疫计划</h3>
                <button
                  onClick={() => setShowRecommend(false)}
                  className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="caption mt-1">
                基于出生日期：{currentBaby ? new Date(currentBaby.birthDate).toLocaleDateString('zh-CN') : ''}
              </p>
            </div>

            <div className="px-4 pb-6 space-y-2">
              {standardPlans.map((plan, i) => {
                const isCompleted = vaccinatedSet.has(`${plan.name}__${plan.dose}`)
                const isOverdue = !isCompleted && plan.monthAge <= ageMonths
                const accentColor = isCompleted ? 'var(--feeding)' : isOverdue ? 'var(--danger)' : 'var(--sleep)'
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      backgroundColor: isCompleted
                        ? 'transparent'
                        : `color-mix(in srgb, ${accentColor} 6%, transparent)`,
                      opacity: isCompleted ? 0.6 : 1,
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div
                      className="icon-circle icon-circle--sm"
                      style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" style={{ color: accentColor }} />
                      ) : isOverdue ? (
                        <AlertTriangle className="h-4 w-4" style={{ color: accentColor }} />
                      ) : (
                        <Clock className="h-4 w-4" style={{ color: accentColor }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="body-md font-medium text-[var(--text-primary)]">{plan.name}</span>
                        <span className="caption">{plan.dose}</span>
                        {!plan.isFree && (
                          <span
                            className="badge-mini"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                              color: 'var(--warning)',
                            }}
                          >
                            自费
                          </span>
                        )}
                      </div>
                      <p className="caption">
                        {plan.monthAge}月龄 · 计划：{plan.plannedDate}
                      </p>
                    </div>
                    {!isCompleted && (
                      <button
                        onClick={() => handleQuickAddFromPlan(plan)}
                        disabled={isSubmitting}
                        className="btn-primary px-2 py-1 text-[10px] shrink-0"
                      >
                        标记已接种
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
