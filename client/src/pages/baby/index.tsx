import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Baby, Plus, Pencil, Trash2, X, Lock, Mars, Venus } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { usePermission } from '@/hooks/use-permission'
import { recordService } from '@/services/record'
import type { TodayStats } from '@/types'

function getAgeDisplay(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) {
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
    return `${days}天`
  }
  if (months < 24) {
    return `${months}个月`
  }
  const years = Math.floor(months / 12)
  const remainMonths = months % 12
  return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`
}

export function BabyPage() {
  const babies = useBabyStore((s) => s.babies)
  const currentBabyId = useBabyStore((s) => s.currentBabyId)
  const selectBaby = useBabyStore((s) => s.selectBaby)
  const createBaby = useBabyStore((s) => s.createBaby)
  const updateBaby = useBabyStore((s) => s.updateBaby)
  const deleteBaby = useBabyStore((s) => s.deleteBaby)
  const family = useFamilyStore((s) => s.family)
  const { isAdmin, isViewer } = usePermission()

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [babyStats, setBabyStats] = useState<Record<string, TodayStats>>({})
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [birthDate, setBirthDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setGender('male')
    setBirthDate('')
    setShowAdd(false)
    setEditingId(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family?.id || !name || !birthDate) return
    setIsSubmitting(true)
    try {
      await createBaby({ familyId: family.id, name, gender, birthDate })
      resetForm()
    } catch (err) {
      console.error('Failed to create baby:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (baby: { id: string; name: string; gender: 'male' | 'female'; birthDate: string }) => {
    setEditingId(baby.id)
    setName(baby.name)
    setGender(baby.gender)
    setBirthDate(baby.birthDate)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !name || !birthDate) return
    setIsSubmitting(true)
    try {
      await updateBaby(editingId, { name, gender, birthDate })
      resetForm()
    } catch (err) {
      console.error('Failed to update baby:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!family?.id) return
    if (!confirm('确定删除该宝宝吗？相关记录不会被删除。')) return
    try {
      await deleteBaby(id, family.id)
    } catch (err) {
      console.error('Failed to delete baby:', err)
    }
  }

  const isFormOpen = showAdd || editingId !== null

  useEffect(() => {
    babies.forEach((baby) => {
      if (!babyStats[baby.id]) {
        recordService.getTodayStats(baby.id).then((stats) => {
          setBabyStats((prev) => ({ ...prev, [baby.id]: stats }))
        }).catch(() => {})
      }
    })
  }, [babies])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="heading-lg text-[var(--text-primary)]">宝宝管理</h1>
        </div>
        {!isFormOpen && isAdmin && (
          <button
            onClick={() => { resetForm(); setShowAdd(true) }}
            className="btn-primary text-[var(--text-xs)] px-3 py-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isFormOpen && (
        <form onSubmit={editingId ? handleUpdate : handleAdd} className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="heading-sm text-[var(--text-primary)]">
              {editingId ? '编辑宝宝' : '添加宝宝'}
            </h2>
            <button type="button" onClick={resetForm} className="p-1 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="label-base">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="宝宝的小名"
              className="input-base"
            />
          </div>

          <div>
            <label className="label-base">性别</label>
            <div className="flex gap-2 mt-1">
              {([
                { value: 'male' as const, label: '男孩', Icon: Mars },
                { value: 'female' as const, label: '女孩', Icon: Venus },
              ]).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`chip flex-1 justify-center ${gender === value ? 'chip--active' : 'chip--inactive'}`}
                  style={gender === value ? { backgroundColor: 'var(--primary)' } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-base">出生日期</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className="input-base"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </form>
      )}

      {/* Viewer notice */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[var(--text-xs)] text-[var(--text-hint)] bg-[var(--bg-elevated)]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          您是查看者，无法添加或修改宝宝信息
        </div>
      )}

      {/* Baby List */}
      {babies.length === 0 ? (
        <div className="empty-state">
          <Baby className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">暂无宝宝信息</p>
          <p className="empty-state__desc">点击上方添加宝宝</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {babies.map((baby) => {
            const isCurrent = baby.id === currentBabyId
            const stats = babyStats[baby.id]
            const GenderIcon = baby.gender === 'male' ? Mars : Venus
            return (
              <div
                key={baby.id}
                className="card-base flex items-center gap-3 cursor-pointer transition-colors"
                style={{
                  outline: isCurrent ? '2px solid var(--primary)' : 'none',
                  outlineOffset: '-1px',
                  backgroundColor: isCurrent ? 'color-mix(in srgb, var(--primary) 4%, var(--bg-card))' : undefined,
                }}
                onClick={() => selectBaby(baby.id)}
              >
                <div
                  className="icon-circle icon-circle--md"
                  style={{
                    backgroundColor: baby.gender === 'male'
                      ? 'color-mix(in srgb, var(--sleep) 12%, transparent)'
                      : 'color-mix(in srgb, var(--temperature) 12%, transparent)',
                  }}
                >
                  <Baby
                    className="h-5 w-5"
                    style={{ color: baby.gender === 'male' ? 'var(--sleep)' : 'var(--temperature)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="body-md font-medium text-[var(--text-primary)]">{baby.name}</p>
                    {isCurrent && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 caption">
                    <GenderIcon
                      className="h-3 w-3"
                      style={{ color: baby.gender === 'male' ? 'var(--sleep)' : 'var(--temperature)' }}
                    />
                    {getAgeDisplay(baby.birthDate)} · {new Date(baby.birthDate).toLocaleDateString('zh-CN')}
                  </div>
                  {stats && (stats.feeding.count > 0 || stats.sleep.count > 0 || stats.diaper.count > 0) && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {stats.feeding.count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--feeding) 12%, transparent)',
                            color: 'var(--feeding)',
                          }}
                        >
                          喂养·{stats.feeding.count}
                        </span>
                      )}
                      {stats.sleep.count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--sleep) 12%, transparent)',
                            color: 'var(--sleep)',
                          }}
                        >
                          睡眠·{stats.sleep.count}
                        </span>
                      )}
                      {stats.diaper.count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--diaper) 12%, transparent)',
                            color: 'var(--diaper)',
                          }}
                        >
                          换尿布·{stats.diaper.count}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isAdmin && (
                    <button
                      onClick={() => handleEdit(baby)}
                      className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--primary)] hover:bg-[color-mix(in_srgb,_var(--primary)_12%,_transparent)] transition-colors"
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(baby.id)}
                      className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,_var(--danger)_12%,_transparent)] transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
