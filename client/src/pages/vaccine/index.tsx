/**
 * VaccinePage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - 状态 Tabs → SegmentedControl（带 count）
 * - 计划/记录列表：ListRow 风（左色条 + 圆 icon + 标题 + 状态 Badge + 标记按钮）
 * - 标准计划 Drawer 保留布局，配色暖调化
 *
 * v7.1（2026-05-09）：标准计划抽屉迁移到标准 <Dialog>，避免与 useConfirm() 的 z-index 冲突。
 */
import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, CheckCircle, Clock, ListChecks, PlusCircle, Syringe, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion'
import { useBabyStore } from '@/stores/baby-store'
import { vaccineService } from '@/services/baby-extra'
import { getVaccinePlans } from '@/lib/vaccine-plans'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { VaccineRecord, Baby } from '@/types'

type StatusFilter = 'all' | 'completed' | 'upcoming' | 'overdue'

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

const STATUS_STYLES: Record<
  'completed' | 'upcoming' | 'overdue',
  { bg: string; fg: string; color: string; Icon: typeof CheckCircle }
> = {
  completed: {
    bg: 'var(--feeding-bg)',
    fg: 'var(--feeding-fg)',
    color: 'var(--feeding)',
    Icon: CheckCircle,
  },
  upcoming: {
    bg: 'var(--sleep-bg)',
    fg: 'var(--sleep-fg)',
    color: 'var(--sleep)',
    Icon: Clock,
  },
  overdue: {
    bg: 'var(--danger-bg)',
    fg: 'var(--danger-fg)',
    color: 'var(--danger)',
    Icon: AlertTriangle,
  },
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

  useEffect(() => {
    loadVaccines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBaby])

  const standardPlans = useMemo(() => {
    if (!currentBaby) return []
    return getVaccinePlans(currentBaby.birthDate)
  }, [currentBaby])

  const vaccinatedSet = useMemo(() => {
    const set = new Set<string>()
    vaccines.forEach((v) => set.add(`${v.name}__${v.dose}`))
    return set
  }, [vaccines])

  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 0

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

  const stats = useMemo(
    () => ({
      total: standardPlans.length,
      completed: vaccinatedSet.size,
      upcoming: planCategories.upcoming.length,
      overdue: planCategories.overdue.length,
    }),
    [standardPlans, vaccinatedSet, planCategories],
  )

  /** 将 <input type="date"> 的 `YYYY-MM-DD` 转为后端 Zod `z.string().datetime()` 可接受的完整 ISO 8601 */
  const toIsoFromDateInput = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentBaby || !name || !dose || !date) return
    setIsSubmitting(true)
    try {
      await vaccineService.create(currentBaby.id, {
        name,
        dose,
        vaccinatedDate: toIsoFromDateInput(date),
        note: note || undefined,
      })
      setShowAdd(false)
      setName('')
      setDose('')
      setDate(new Date().toISOString().split('T')[0])
      setNote('')
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
        vaccinatedDate: new Date().toISOString(),
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

  const completionPct =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

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
          title="疫苗计划"
          backTo="/discover"
          rightAction={
            <div className="flex items-center gap-2">
              <Button
                variant="plain"
                size="sm"
                leftIcon={<ListChecks className="h-3.5 w-3.5" />}
                onClick={() => setShowRecommend(true)}
              >
                标准计划
              </Button>
              {!showAdd && (
                <Button
                  variant="tinted"
                  size="sm"
                  leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                  onClick={() => setShowAdd(true)}
                >
                  添加
                </Button>
              )}
            </div>
          }
        />
      </motion.div>

      {/* Hero 进度卡 */}
      <motion.div variants={staggerItem}>
        <Card variant="hero" style={{ backgroundColor: 'var(--brand-soft)' }}>
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className="footnote font-semibold mb-1"
                style={{ color: 'var(--brand-ink)' }}
              >
                接种进度
              </p>
              <div className="flex items-baseline gap-2">
                <span className="metric-lg" style={{ color: 'var(--brand-ink)' }}>
                  {stats.completed}
                </span>
                <span
                  className="title-3"
                  style={{ color: 'var(--label-secondary)' }}
                >
                  / {stats.total}
                </span>
                <Badge size="sm" variant="brand">
                  {completionPct}%
                </Badge>
              </div>
              <p
                className="caption-1 mt-1"
                style={{ color: 'var(--label-secondary)' }}
              >
                {stats.overdue > 0 && (
                  <span style={{ color: 'var(--danger)' }}>
                    {stats.overdue} 项逾期 ·{' '}
                  </span>
                )}
                {stats.upcoming} 项待接种
              </p>
            </div>
            <Syringe
              className="h-10 w-10 shrink-0"
              style={{ color: 'var(--brand)', opacity: 0.6 }}
            />
          </div>
          {/* 进度条 */}
          <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--surface-2)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: 'var(--brand)' }}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>
        </Card>
      </motion.div>

      {/* 状态筛选 */}
      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: 'all', label: `全部 ${stats.total}` },
            { value: 'completed', label: `已接种 ${stats.completed}` },
            { value: 'upcoming', label: `待接种 ${stats.upcoming}` },
            { value: 'overdue', label: `逾期 ${stats.overdue}` },
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
                  添加疫苗记录
                </h2>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  onClick={() => setShowAdd(false)}
                  aria-label="关闭"
                />
              </div>
              <FormField label="疫苗名称" htmlFor="vaccine-name" required>
                <Input
                  id="vaccine-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="如：乙肝疫苗"
                />
              </FormField>
              <FormField label="剂次" htmlFor="vaccine-dose" required>
                <Input
                  id="vaccine-dose"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  required
                  placeholder="如：第1针"
                />
              </FormField>
              <FormField label="接种日期" htmlFor="vaccine-date" required>
                <Input
                  id="vaccine-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="备注" htmlFor="vaccine-note">
                <Input
                  id="vaccine-note"
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
        <ListSkeleton count={5} />
      ) : displayItems.length === 0 ? (
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <Syringe
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              暂无疫苗记录
            </p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem}>
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {displayItems.map((item, i) => {
                if (item.type === 'record') {
                  const v = item.data as VaccineRecord
                  const s = STATUS_STYLES.completed
                  return (
                    <div
                      key={v.id}
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
                        <s.Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="callout font-semibold truncate"
                          style={{ color: 'var(--label)' }}
                        >
                          {v.name}
                        </p>
                        <p
                          className="footnote"
                          style={{ color: 'var(--label-secondary)' }}
                        >
                          {v.dose} · {new Date(v.vaccinatedDate).toLocaleDateString('zh-CN')}
                        </p>
                        {v.note && (
                          <p
                            className="caption-1 truncate"
                            style={{ color: 'var(--label-tertiary)' }}
                          >
                            {v.note}
                          </p>
                        )}
                      </div>
                      <IconButton
                        variant="danger-ghost"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(v.id)}
                        disabled={deletingId === v.id}
                        aria-label="删除"
                      />
                    </div>
                  )
                } else {
                  const p = item.data as (typeof standardPlans)[0]
                  const isOverdue = p.monthAge <= ageMonths
                  const s = STATUS_STYLES[isOverdue ? 'overdue' : 'upcoming']
                  return (
                    <div
                      key={`plan-${i}`}
                      className="relative flex items-center gap-3 px-5 py-3.5 min-w-0"
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
                        <s.Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="callout font-semibold truncate"
                            style={{ color: 'var(--label)' }}
                          >
                            {p.name}
                          </p>
                          <span
                            className="footnote"
                            style={{ color: 'var(--label-tertiary)' }}
                          >
                            {p.dose}
                          </span>
                          {!p.isFree && (
                            <Badge size="xs" variant="warning">
                              自费
                            </Badge>
                          )}
                        </div>
                        <p
                          className="footnote"
                          style={{ color: 'var(--label-secondary)' }}
                        >
                          {p.monthAge}月龄 · 计划：{p.plannedDate}
                          {isOverdue && (
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                              {' '}
                              · 逾期
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="tinted"
                        size="xs"
                        onClick={() => handleQuickAddFromPlan(p)}
                        disabled={isSubmitting}
                      >
                        标记已接种
                      </Button>
                    </div>
                  )
                }
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* 标准计划 Drawer（v7.1：迁移到标准 <Dialog>，避免 z-index 与 useConfirm 冲突） */}
      <Dialog
        open={showRecommend}
        onClose={() => setShowRecommend(false)}
        title="国家标准免疫计划"
        icon={<ListChecks className="h-4 w-4" />}
        accentColor="var(--brand)"
        size="lg"
      >
        <div className="space-y-3">
          <p
            className="caption-1"
            style={{ color: 'var(--label-tertiary)' }}
          >
            基于出生日期：
            {currentBaby
              ? new Date(currentBaby.birthDate).toLocaleDateString('zh-CN')
              : ''}
          </p>

          <div className="space-y-2">
            {standardPlans.map((plan, i) => {
              const isCompleted = vaccinatedSet.has(`${plan.name}__${plan.dose}`)
              const isOverdue = !isCompleted && plan.monthAge <= ageMonths
              const status = isCompleted
                ? 'completed'
                : isOverdue
                  ? 'overdue'
                  : 'upcoming'
              const s = STATUS_STYLES[status]
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: isCompleted ? 'transparent' : s.bg,
                    opacity: isCompleted ? 0.55 : 1,
                    border: '0.5px solid var(--separator)',
                  }}
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${s.color} 22%, transparent)`,
                      color: s.fg,
                    }}
                  >
                    <s.Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="callout font-medium"
                        style={{ color: 'var(--label)' }}
                      >
                        {plan.name}
                      </span>
                      <span
                        className="caption-1"
                        style={{ color: 'var(--label-tertiary)' }}
                      >
                        {plan.dose}
                      </span>
                      {!plan.isFree && (
                        <Badge size="xs" variant="warning">
                          自费
                        </Badge>
                      )}
                    </div>
                    <p
                      className="caption-1"
                      style={{ color: 'var(--label-tertiary)' }}
                    >
                      {plan.monthAge}月龄 · 计划：{plan.plannedDate}
                    </p>
                  </div>
                  {!isCompleted && (
                    <Button
                      variant="tinted"
                      size="xs"
                      onClick={() => handleQuickAddFromPlan(plan)}
                      disabled={isSubmitting}
                    >
                      标记已接种
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Dialog>
    </motion.div>
  )
}
