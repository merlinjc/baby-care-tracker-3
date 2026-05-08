/**
 * FamilyPage v7 - iOS Settings × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - 未加入家庭：tinted Card 大入口（创建/加入）
 * - 已加入：family Hero（家庭名 + 当前角色 Badge）+ 邀请码段 + 成员段 + 危险操作段
 * - 危险操作改为 destructive-plain Button block
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, Edit3, Eye, LogOut, PlusCircle, Trash2, Users } from 'lucide-react';import { useFamilyStore } from '@/stores/family-store'
import { InviteSection } from '@/components/family/invite-section'
import { MembersSection } from '@/components/family/members-section'
import { TransferAdminDialog } from '@/components/family/transfer-admin-dialog'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { CareRoleSelector } from '@/components/care-role-selector'
import { getCareRoleMeta } from '@/lib/care-role'
import { staggerContainer, staggerItem, pressableSubtle } from '@/lib/motion'
import type { CareRole } from '@/types'
import { ApiError } from '@/lib/api-error'

const ROLE_BADGE: Record<
  'admin' | 'editor' | 'viewer',
  { icon: typeof Crown; label: string; variant: 'brand' | 'sleep' | 'default' }
> = {
  admin: { icon: Crown, label: '管理员', variant: 'brand' },
  editor: { icon: Edit3, label: '成员', variant: 'sleep' },
  viewer: { icon: Eye, label: '仅查看', variant: 'default' },
}

export function FamilyPage() {
  const navigate = useNavigate()
  const family = useFamilyStore((s) => s.family)
  const currentRole = useFamilyStore((s) => s.currentRole)
  const createFamily = useFamilyStore((s) => s.createFamily)
  const joinFamily = useFamilyStore((s) => s.joinFamily)
  const leaveFamily = useFamilyStore((s) => s.leaveFamily)
  const dissolveFamily = useFamilyStore((s) => s.dissolveFamily)
  const confirm = useConfirm()

  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [careRole, setCareRole] = useState<CareRole | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean
    candidates: Array<{ id: string; nickname: string; avatar: string | null }>
    thenLeave: boolean
  }>({ open: false, candidates: [], thenLeave: false })

  const isAdmin = currentRole === 'admin'

  const handleSelectCareRole = (next: CareRole) => {
    setCareRole(next)
    if (!nickname.trim()) {
      setNickname(getCareRoleMeta(next).label)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyName) return
    if (!careRole) {
      toast.error('请先选择您的身份')
      return
    }
    setIsSubmitting(true)
    try {
      await createFamily(familyName, nickname, careRole)
      toast.success('家庭已创建')
      setShowCreate(false)
      setFamilyName('')
      setNickname('')
      setCareRole(null)
    } catch (err) {
      toast.error((err as ApiError).message ?? '创建家庭失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) return
    if (!careRole) {
      toast.error('请先选择您的身份')
      return
    }
    setIsSubmitting(true)
    try {
      await joinFamily(inviteCode.replace(/\s/g, '').toUpperCase(), nickname, careRole)
      toast.success('已加入家庭')
      setShowJoin(false)
      setInviteCode('')
      setNickname('')
      setCareRole(null)
    } catch (err) {
      toast.error((err as ApiError).message ?? '加入家庭失败，请检查邀请码')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeave = async () => {
    const ok = await confirm({
      title: '退出当前家庭？',
      description: '退出后需要重新加入才能看到家庭数据。',
      confirmText: '退出',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const result = await leaveFamily()
      switch (result.status) {
        case 'ok':
          toast.success('已退出家庭')
          navigate('/')
          break
        case 'dissolved':
          toast.info('家庭已解散')
          navigate('/')
          break
        case 'need_transfer':
          setTransferDialog({
            open: true,
            candidates: (result.otherMembers ?? []).map(
              (m: { id: string; nickname: string; avatar: string | null }) => ({
                id: m.id,
                nickname: m.nickname,
                avatar: m.avatar ?? null,
              }),
            ),
            thenLeave: true,
          })
          break
        case 'family_not_found':
        case 'not_member':
          toast.info('家庭已不存在')
          navigate('/')
          break
      }
    } catch (err) {
      toast.error((err as ApiError).message ?? '退出失败')
    }
  }

  const handleDissolve = async () => {
    const ok = await confirm({
      title: '解散当前家庭？',
      description: '解散后所有成员都将被移除，所有宝宝与记录也将一并清理。此操作不可撤销。',
      confirmText: '解散家庭',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await dissolveFamily()
      toast.info('家庭已解散')
      navigate('/')
    } catch (err) {
      toast.error((err as ApiError).message ?? '解散失败')
    }
  }

  // ========== 未加入家庭 ==========
  if (!family) {
    return (
      <motion.div
        className="space-y-5"
        data-page-stack
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <LargeTitleHeader title="家庭" backTo="/profile" />
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <Users
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--brand)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              您还未加入家庭
            </p>
            <p
              className="footnote mt-1"
              style={{ color: 'var(--label-tertiary)' }}
            >
              创建或加入一个家庭开始使用
            </p>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3" data-grid-2>
          <motion.div whileTap={pressableSubtle.whileTap} transition={pressableSubtle.transition}>
            <Card
              as="article"
              padding="lg"
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowCreate(true)
                setShowJoin(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowCreate(true)
                  setShowJoin(false)
                }
              }}
              className="flex flex-col items-center gap-2 text-center cursor-pointer"
              style={{ backgroundColor: 'var(--brand-soft)' }}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--brand) 22%, transparent)',
                  color: 'var(--brand-ink)',
                }}
              >
                <PlusCircle className="h-6 w-6" />
              </div>
              <span className="headline" style={{ color: 'var(--brand-ink)' }}>
                创建家庭
              </span>
            </Card>
          </motion.div>
          <motion.div whileTap={pressableSubtle.whileTap} transition={pressableSubtle.transition}>
            <Card
              as="article"
              padding="lg"
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowJoin(true)
                setShowCreate(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowJoin(true)
                  setShowCreate(false)
                }
              }}
              className="flex flex-col items-center gap-2 text-center cursor-pointer"
              style={{ backgroundColor: 'var(--sleep-bg)' }}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--sleep) 22%, transparent)',
                  color: 'var(--sleep-fg)',
                }}
              >
                <Users className="h-6 w-6" />
              </div>
              <span className="headline" style={{ color: 'var(--sleep-fg)' }}>
                加入家庭
              </span>
            </Card>
          </motion.div>
        </motion.div>

        {showCreate && (
          <motion.div
            variants={staggerItem}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card as="section">
              <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="headline" style={{ color: 'var(--label)' }}>
                  创建家庭
                </h2>
                <FormField label="家庭名称" htmlFor="family-name" required>
                  <Input
                    id="family-name"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    placeholder="如：小明的家"
                  />
                </FormField>
                <FormField
                  label="我的身份"
                  htmlFor="family-create-role"
                  required
                  hint="用于 AI 每日洞察个性化称呼与建议，日后可在家庭页调整"
                >
                  <CareRoleSelector value={careRole} onChange={handleSelectCareRole} />
                </FormField>
                <FormField
                  label="在家庭中的昵称"
                  htmlFor="family-create-nickname"
                  required
                  hint="家庭成员列表里显示的名字，默认跟随身份"
                >
                  <Input
                    id="family-create-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    placeholder="如：妈妈、爸爸"
                  />
                </FormField>
                <Button type="submit" variant="filled" loading={isSubmitting} block>
                  {isSubmitting ? '创建中...' : '创建家庭'}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {showJoin && (
          <motion.div
            variants={staggerItem}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card as="section">
              <form onSubmit={handleJoin} className="space-y-4">
                <h2 className="headline" style={{ color: 'var(--label)' }}>
                  加入家庭
                </h2>
                <FormField label="邀请码" htmlFor="family-invite-code" required>
                  <Input
                    id="family-invite-code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                    placeholder="ABC 123"
                    className="font-mono text-center"
                    style={{ fontSize: '20px', letterSpacing: '0.1em' }}
                    maxLength={10}
                  />
                </FormField>
                <FormField
                  label="我的身份"
                  htmlFor="family-join-role"
                  required
                  hint="用于 AI 每日洞察个性化称呼与建议，日后可在家庭页调整"
                >
                  <CareRoleSelector value={careRole} onChange={handleSelectCareRole} />
                </FormField>
                <FormField
                  label="在家庭中的昵称"
                  htmlFor="family-join-nickname"
                  required
                  hint="家庭成员列表里显示的名字，默认跟随身份"
                >
                  <Input
                    id="family-join-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    placeholder="如：妈妈、爸爸"
                  />
                </FormField>
                <Button type="submit" variant="filled" loading={isSubmitting} block>
                  {isSubmitting ? '加入中...' : '加入家庭'}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ========== 已加入家庭 ==========
  const roleBadge = currentRole ? ROLE_BADGE[currentRole] : null

  return (
    <>
      <motion.div
        className="space-y-5"
        data-page-stack
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <LargeTitleHeader
            title={family.name}
            subtitle={`${family.members.length} 位成员`}
            backTo="/profile"
            rightAction={
              roleBadge ? (
                <Badge
                  size="sm"
                  variant={roleBadge.variant}
                  icon={<roleBadge.icon className="h-3 w-3" />}
                >
                  {roleBadge.label}
                </Badge>
              ) : null
            }
          />
        </motion.div>

        {/* 邀请码段 - 仅 admin */}
        {isAdmin && (
          <motion.div variants={staggerItem}>
            <SectionHeader title="邀请新成员" variant="grouped" />
            <InviteSection
              inviteCode={family.inviteCode}
              inviteCodeExpiry={family.inviteCodeExpiry}
              canRefresh={isAdmin}
            />
          </motion.div>
        )}

        {/* 成员段 */}
        <motion.div variants={staggerItem}>
          <SectionHeader
            title={`成员 · ${family.members.length}`}
            variant="grouped"
          />
          <Card padding="md">
            <MembersSection />
          </Card>
        </motion.div>

        {/* 危险操作 */}
        <motion.div variants={staggerItem} className="space-y-2 pt-2">
          <SectionHeader title="危险操作" variant="grouped" />
          <Card padding="md" className="space-y-2">
            <Button
              variant="destructive-plain"
              block
              onClick={handleLeave}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              退出家庭
            </Button>
            {isAdmin && (
              <Button
                variant="destructive-plain"
                block
                onClick={handleDissolve}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                解散家庭
              </Button>
            )}
          </Card>
        </motion.div>
      </motion.div>

      <TransferAdminDialog
        open={transferDialog.open}
        onClose={() => setTransferDialog({ ...transferDialog, open: false })}
        candidates={transferDialog.candidates}
        thenLeave={transferDialog.thenLeave}
        onLeaveDone={() => navigate('/')}
      />
    </>
  )
}
