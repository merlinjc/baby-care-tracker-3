import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, LogOut, Trash2, Crown, Edit3, Eye } from 'lucide-react'
import { useFamilyStore } from '@/stores/family-store'
import { InviteSection } from '@/components/family/invite-section'
import { MembersSection } from '@/components/family/members-section'
import { TransferAdminDialog } from '@/components/family/transfer-admin-dialog'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { CareRoleSelector } from '@/components/care-role-selector'
import { getCareRoleMeta } from '@/lib/care-role'
import type { CareRole } from '@/types'
import { ApiError } from '@/lib/api-error'

const ROLE_BADGE: Record<'admin' | 'editor' | 'viewer', { icon: typeof Crown; label: string; color: string }> = {
  admin: { icon: Crown, label: '管理员', color: 'var(--primary)' },
  editor: { icon: Edit3, label: '成员', color: 'var(--sleep)' },
  viewer: { icon: Eye, label: '仅查看', color: 'var(--text-hint)' },
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

  // 选定身份时若昵称仍为空，自动填入身份默认名（如"妈妈"），用户仍可覆盖
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

  // FR-C5：退出家庭状态机
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
            candidates: (result.otherMembers ?? []).map((m: { id: string; nickname: string; avatar: string | null }) => ({
              id: m.id,
              nickname: m.nickname,
              avatar: m.avatar ?? null,
            })),
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
      <div className="space-y-5 animate-fade-in-up">
        <PageHeader title="家庭" backTo="/profile" />
        <div className="empty-state">
          <Users className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">您还未加入家庭</p>
          <p className="empty-state__desc">创建或加入一个家庭开始使用</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card
            as="article"
            variant="interactive"
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
            className="flex flex-col items-center gap-2 text-center"
          >
            <div
              className="icon-circle icon-circle--md"
              style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
            >
              <Plus className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span className="body-md font-medium">创建家庭</span>
          </Card>
          <Card
            as="article"
            variant="interactive"
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
            className="flex flex-col items-center gap-2 text-center"
          >
            <div
              className="icon-circle icon-circle--md"
              style={{ backgroundColor: 'color-mix(in srgb, var(--sleep) 12%, transparent)' }}
            >
              <Users className="h-5 w-5" style={{ color: 'var(--sleep)' }} />
            </div>
            <span className="body-md font-medium">加入家庭</span>
          </Card>
        </div>

        {showCreate && (
          <Card as="section" className="animate-slide-up">
            <form onSubmit={handleCreate} className="space-y-4">
              <h2 className="heading-sm">创建家庭</h2>
            <FormField label="家庭名称" htmlFor="family-name" required>
              <Input
                id="family-name"
                type="text"
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
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                placeholder="如：妈妈、爸爸"
              />
            </FormField>
            <Button type="submit" loading={isSubmitting} block>
              {isSubmitting ? '创建中...' : '创建家庭'}
            </Button>
            </form>
          </Card>
        )}

        {showJoin && (
          <Card as="section" className="animate-slide-up">
            <form onSubmit={handleJoin} className="space-y-4">
              <h2 className="heading-sm">加入家庭</h2>
            <FormField label="邀请码" htmlFor="family-invite-code" required>
              <Input
                id="family-invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                placeholder="ABC 123"
                className="font-mono text-center"
                style={{ fontSize: 'var(--text-lg)' }}
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
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                placeholder="如：妈妈、爸爸"
              />
            </FormField>
            <Button type="submit" loading={isSubmitting} block>
              {isSubmitting ? '加入中...' : '加入家庭'}
            </Button>
            </form>
          </Card>
        )}
      </div>
    )
  }

  // ========== 已加入家庭 ==========
  const roleBadge = currentRole ? ROLE_BADGE[currentRole] : null

  return (
    <>
      <div className="space-y-5 animate-fade-in-up">
        <PageHeader
          title={family.name}
          backTo="/profile"
          action={
            roleBadge ? (
              <Badge
                size="xs"
                accentColor={roleBadge.color}
                icon={<roleBadge.icon className="h-2.5 w-2.5" />}
              >
                {roleBadge.label}
              </Badge>
            ) : null
          }
        />

        {/* 邀请码区 —— 仅 admin 可见 */}
        {isAdmin && (
          <InviteSection
            inviteCode={family.inviteCode}
            inviteCodeExpiry={family.inviteCodeExpiry}
            canRefresh={isAdmin}
          />
        )}

        {/* 家庭成员列表 */}
        <Card>
          <div className="section-header">
            <span className="section-header__title">家庭成员 · {family.members.length}</span>
          </div>
          <MembersSection />
        </Card>

        {/* 危险操作区 */}
        <div className="space-y-2 pt-2">
          <Button
            variant="danger-outline"
            block
            onClick={handleLeave}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            退出家庭
          </Button>
          {isAdmin && (
            <Button
              variant="danger-outline"
              block
              onClick={handleDissolve}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              解散家庭
            </Button>
          )}
        </div>
      </div>

      {/* leaveFamily.need_transfer 触发的转让对话框 */}
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
