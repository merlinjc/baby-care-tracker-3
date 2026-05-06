import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Users, Plus, LogOut, Trash2, Crown, Edit3, Eye } from 'lucide-react'
import { useFamilyStore } from '@/stores/family-store'
import { InviteSection } from '@/components/family/invite-section'
import { MembersSection } from '@/components/family/members-section'
import { TransferAdminDialog } from '@/components/family/transfer-admin-dialog'
import { toast } from '@/components/ui/toast'
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

  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean
    candidates: Array<{ id: string; nickname: string; avatar: string | null }>
    thenLeave: boolean
  }>({ open: false, candidates: [], thenLeave: false })

  const isAdmin = currentRole === 'admin'

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyName) return
    setIsSubmitting(true)
    try {
      await createFamily(familyName, nickname)
      toast.success('家庭已创建')
      setShowCreate(false)
      setFamilyName('')
      setNickname('')
    } catch (err) {
      toast.error((err as ApiError).message ?? '创建家庭失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) return
    setIsSubmitting(true)
    try {
      await joinFamily(inviteCode.replace(/\s/g, '').toUpperCase(), nickname)
      toast.success('已加入家庭')
      setShowJoin(false)
      setInviteCode('')
      setNickname('')
    } catch (err) {
      toast.error((err as ApiError).message ?? '加入家庭失败，请检查邀请码')
    } finally {
      setIsSubmitting(false)
    }
  }

  // FR-C5：退出家庭状态机
  const handleLeave = async () => {
    if (!confirm('确定要退出这个家庭吗？')) return
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
    if (!confirm('确定要解散这个家庭吗？此操作不可撤销！所有成员都将被移除。')) return
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
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-[var(--text-hint)] hover:text-[var(--text-primary)]">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="heading-lg">家庭</h1>
        </div>
        <div className="empty-state">
          <Users className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">您还未加入家庭</p>
          <p className="empty-state__desc">创建或加入一个家庭开始使用</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setShowCreate(true)
              setShowJoin(false)
            }}
            className="card-interactive flex flex-col items-center gap-2 py-8"
          >
            <div
              className="icon-circle icon-circle--md"
              style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
            >
              <Plus className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span className="body-md font-medium">创建家庭</span>
          </button>
          <button
            onClick={() => {
              setShowJoin(true)
              setShowCreate(false)
            }}
            className="card-interactive flex flex-col items-center gap-2 py-8"
          >
            <div
              className="icon-circle icon-circle--md"
              style={{ backgroundColor: 'color-mix(in srgb, var(--sleep) 12%, transparent)' }}
            >
              <Users className="h-5 w-5" style={{ color: 'var(--sleep)' }} />
            </div>
            <span className="body-md font-medium">加入家庭</span>
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="card space-y-4 animate-slide-up">
            <h2 className="heading-sm">创建家庭</h2>
            <div>
              <label className="label-base">家庭名称</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                placeholder="如：小明的家"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">您的昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                placeholder="如：妈妈、爸爸"
                className="input-base"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? '创建中...' : '创建家庭'}
            </button>
          </form>
        )}

        {showJoin && (
          <form onSubmit={handleJoin} className="card space-y-4 animate-slide-up">
            <h2 className="heading-sm">加入家庭</h2>
            <div>
              <label className="label-base">邀请码</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                placeholder="ABC 123"
                className="input-base font-mono text-center"
                style={{ fontSize: 'var(--text-lg)' }}
                maxLength={10}
              />
            </div>
            <div>
              <label className="label-base">您的昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                placeholder="如：妈妈、爸爸"
                className="input-base"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? '加入中...' : '加入家庭'}
            </button>
          </form>
        )}
      </div>
    )
  }

  // ========== 已加入家庭 ==========
  const roleBadge = currentRole ? ROLE_BADGE[currentRole] : null

  return (
    <>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-[var(--text-hint)] hover:text-[var(--text-primary)]">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="heading-lg flex-1 truncate">{family.name}</h1>
          {roleBadge && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${roleBadge.color} 12%, transparent)`,
                color: roleBadge.color,
              }}
            >
              <roleBadge.icon className="h-2.5 w-2.5" />
              {roleBadge.label}
            </span>
          )}
        </div>

        {/* 邀请码区 —— 仅 admin 可见 */}
        {isAdmin && (
          <InviteSection
            inviteCode={family.inviteCode}
            inviteCodeExpiry={family.inviteCodeExpiry}
            canRefresh={isAdmin}
          />
        )}

        {/* 家庭成员列表 */}
        <div className="card">
          <div className="section-header">
            <span className="section-header__title">家庭成员 · {family.members.length}</span>
          </div>
          <MembersSection />
        </div>

        {/* 危险操作区 */}
        <div className="space-y-2 pt-2">
          <button onClick={handleLeave} className="btn-danger-outline w-full">
            <LogOut className="h-4 w-4" />
            退出家庭
          </button>
          {isAdmin && (
            <button onClick={handleDissolve} className="btn-danger-outline w-full">
              <Trash2 className="h-4 w-4" />
              解散家庭
            </button>
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
