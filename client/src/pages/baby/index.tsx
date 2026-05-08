/**
 * BabyPage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - 无家庭引导卡：tinted Card
 * - 表单卡：plain Card + iOS Input
 * - 宝宝列表：ListRow 风（头像 + 姓名 + 月龄 + 当前 Badge）
 * - 性别色：male=sleep（焦糖紫）female=temperature（蜜桃）
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Lock, Mars, Pencil, PlusCircle, Trash2, User, UserCircle, Venus, X } from 'lucide-react';import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { usePermission } from '@/hooks/use-permission'
import { recordService } from '@/services/record'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { staggerContainer, staggerItem, pressableSubtle } from '@/lib/motion'
import type { TodayStats } from '@/types'

function getAgeDisplay(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) {
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
    return `${days}天`
  }
  if (months < 24) return `${months}个月`
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
  const confirm = useConfirm()

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

  const handleEdit = (baby: {
    id: string
    name: string
    gender: 'male' | 'female'
    birthDate: string
  }) => {
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
    const ok = await confirm({
      title: '删除该宝宝？',
      description: '相关记录不会被删除。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
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
        recordService
          .getTodayStats(baby.id)
          .then((stats) => {
            setBabyStats((prev) => ({ ...prev, [baby.id]: stats }))
          })
          .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babies])

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
          title="宝宝管理"
          backTo="/profile"
          rightAction={
            !isFormOpen && isAdmin && family?.id ? (
              <Button
                variant="tinted"
                size="sm"
                leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                onClick={() => {
                  resetForm()
                  setShowAdd(true)
                }}
              >
                添加
              </Button>
            ) : null
          }
        />
      </motion.div>

      {/* No Family 引导 */}
      {!family?.id && !isFormOpen && (
        <motion.div variants={staggerItem}>
          <Card
            padding="md"
            className="flex items-center gap-3"
            style={{ backgroundColor: 'var(--sleep-bg)' }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--sleep) 22%, transparent)',
                color: 'var(--sleep-fg)',
              }}
            >
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="headline" style={{ color: 'var(--sleep-fg)' }}>
                先创建或加入家庭
              </p>
              <p
                className="footnote mt-0.5"
                style={{ color: 'var(--sleep-fg)', opacity: 0.78 }}
              >
                添加宝宝信息前，需要先建立家庭空间
              </p>
            </div>
            <Link
              to="/family"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full footnote font-semibold transition-colors"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--sleep) 22%, transparent)',
                color: 'var(--sleep-fg)',
              }}
            >
              前往
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </motion.div>
      )}

      {/* 表单 */}
      {isFormOpen && (
        <motion.div
          variants={staggerItem}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card as="section">
            <form onSubmit={editingId ? handleUpdate : handleAdd} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="headline" style={{ color: 'var(--label)' }}>
                  {editingId ? '编辑宝宝' : '添加宝宝'}
                </h2>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  onClick={resetForm}
                  aria-label="关闭"
                />
              </div>
              <FormField label="姓名" htmlFor="baby-name" required>
                <Input
                  id="baby-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="宝宝的小名"
                />
              </FormField>
              <FormField label="性别">
                <SegmentedControl<'male' | 'female'>
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: 'male', label: '男孩' },
                    { value: 'female', label: '女孩' },
                  ]}
                />
              </FormField>
              <FormField label="出生日期" htmlFor="baby-birth" required>
                <Input
                  id="baby-birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
              </FormField>
              <Button type="submit" variant="filled" block loading={isSubmitting}>
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </form>
          </Card>
        </motion.div>
      )}

      {isViewer && (
        <motion.div variants={staggerItem}>
          <Alert
            variant="info"
            size="compact"
            icon={<Lock className="h-3.5 w-3.5" />}
          >
            您是查看者，无法添加或修改宝宝信息
          </Alert>
        </motion.div>
      )}

      {/* 宝宝列表 */}
      {babies.length === 0 ? (
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <User
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              暂无宝宝信息
            </p>
            <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
              {family?.id && isAdmin
                ? '点击右上角「添加」，开始记录成长'
                : family?.id && isViewer
                  ? '您是查看者，等待管理员添加宝宝'
                  : !family?.id
                    ? '请先创建或加入家庭'
                    : '等待管理员添加宝宝'}
            </p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem}>
          <SectionHeader title="家庭宝宝" variant="grouped" />
          <div className="space-y-3">
            {babies.map((baby) => {
              const isCurrent = baby.id === currentBabyId
              const stats = babyStats[baby.id]
              const GenderIcon = baby.gender === 'male' ? Mars : Venus
              const genderColor =
                baby.gender === 'male' ? 'var(--sleep)' : 'var(--temperature)'
              const genderBg =
                baby.gender === 'male' ? 'var(--sleep-bg)' : 'var(--temperature-bg)'
              const genderFg =
                baby.gender === 'male' ? 'var(--sleep-fg)' : 'var(--temperature-fg)'
              return (
                <motion.div
                  key={baby.id}
                  whileTap={pressableSubtle.whileTap}
                  transition={pressableSubtle.transition}
                >
                  <Card
                    as="article"
                    padding="md"
                    onClick={() => selectBaby(baby.id)}
                    className="flex items-center gap-3 cursor-pointer"
                    style={
                      isCurrent
                        ? {
                            backgroundColor: 'var(--brand-soft)',
                            outline: '2px solid var(--brand)',
                            outlineOffset: '-1px',
                          }
                        : undefined
                    }
                  >
                    <div
                      className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: genderBg, color: genderFg }}
                    >
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="headline truncate"
                          style={{ color: 'var(--label)' }}
                        >
                          {baby.name}
                        </p>
                        {isCurrent && (
                          <Badge size="xs" variant="brand">
                            当前
                          </Badge>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1.5 footnote mt-0.5"
                        style={{ color: 'var(--label-secondary)' }}
                      >
                        <GenderIcon
                          className="h-3 w-3"
                          style={{ color: genderColor }}
                        />
                        {getAgeDisplay(baby.birthDate)} ·{' '}
                        {new Date(baby.birthDate).toLocaleDateString('zh-CN')}
                      </div>
                      {stats &&
                        (stats.feeding.count > 0 ||
                          stats.sleep.count > 0 ||
                          stats.diaper.count > 0) && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {stats.feeding.count > 0 && (
                              <Badge size="xs" variant="feeding">
                                喂养·{stats.feeding.count}
                              </Badge>
                            )}
                            {stats.sleep.count > 0 && (
                              <Badge size="xs" variant="sleep">
                                睡眠·{stats.sleep.count}
                              </Badge>
                            )}
                            {stats.diaper.count > 0 && (
                              <Badge size="xs" variant="diaper">
                                换尿布·{stats.diaper.count}
                              </Badge>
                            )}
                          </div>
                        )}
                    </div>
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAdmin && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => handleEdit(baby)}
                          aria-label="编辑"
                        />
                      )}
                      {isAdmin && (
                        <IconButton
                          variant="danger-ghost"
                          size="sm"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => handleDelete(baby.id)}
                          aria-label="删除"
                        />
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
