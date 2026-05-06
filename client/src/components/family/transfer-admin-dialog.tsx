/**
 * TransferAdminDialog - 转让管理员对话框（FR-C5）
 *
 * 列出候选成员（leaveFamily 返回的 otherMembers，或本地 family.members 排除自己）
 * 选择后调 store.transferAdmin，可选自动接续 leaveFamily
 */
import { useState } from 'react'
import { Crown, ArrowRight } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useFamilyStore } from '@/stores/family-store'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/components/ui/toast'
import type { ApiError } from '@/lib/api-error'

interface Candidate {
  id: string
  nickname: string
  avatar: string | null
}

interface TransferAdminDialogProps {
  open: boolean
  onClose: () => void
  /** 候选成员（leaveFamily 状态机返回时使用） */
  candidates?: Candidate[]
  /** 转让成功后是否继续退出家庭（leaveFamily.need_transfer 流程下为 true） */
  thenLeave?: boolean
  /** 退出成功后回调（用于跳转） */
  onLeaveDone?: () => void
}

export function TransferAdminDialog({
  open,
  onClose,
  candidates,
  thenLeave = false,
  onLeaveDone,
}: TransferAdminDialogProps) {
  const family = useFamilyStore((s) => s.family)
  const transferAdmin = useFamilyStore((s) => s.transferAdmin)
  const leaveFamily = useFamilyStore((s) => s.leaveFamily)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 候选源：优先用 props 传入，否则从 family.members 排除自己 + 排除现任 admin（self）
  const list: Candidate[] = candidates
    ? candidates
    : (family?.members ?? [])
        .filter((m) => m.userId !== currentUserId)
        .map((m) => ({
          id: m.userId,
          nickname: m.user?.nickname ?? '成员',
          avatar: m.user?.avatar ?? null,
        }))

  const handleSubmit = async () => {
    if (!selectedId) {
      toast.warning('请选择一位成员')
      return
    }
    setSubmitting(true)
    try {
      await transferAdmin(selectedId)
      toast.success('管理员已转让')

      if (thenLeave) {
        const result = await leaveFamily()
        if (result.status === 'ok' || result.status === 'dissolved') {
          onLeaveDone?.()
        } else {
          toast.error(result.message)
        }
      }
      onClose()
    } catch (err) {
      const e = err as ApiError
      toast.error(e.message ?? '转让失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={thenLeave ? '请先转让管理员' : '转让管理员'}
      icon={<Crown className="h-4 w-4" />}
      accentColor="var(--warning)"
      footer={
        <DialogFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={submitting ? '处理中...' : thenLeave ? '转让并退出' : '确认转让'}
          loading={submitting}
          disabled={!selectedId}
        />
      }
    >
      <p className="body-md text-[var(--text-secondary)] mb-4">
        {thenLeave
          ? '您是当前家庭的唯一管理员，请先选择一位成员接管管理权限，然后才能退出家庭。'
          : '选择一位成员，将管理员权限转让给他/她。转让后您将变为普通成员（editor）。'}
      </p>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {list.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">暂无可选成员</p>
            <p className="empty-state__desc">家庭中没有其他成员可以接管</p>
          </div>
        ) : (
          list.map((c) => {
            const isSelected = selectedId === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                    : 'var(--bg-primary)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                }}
              >
                {c.avatar ? (
                  <img src={c.avatar} alt={c.nickname} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {c.nickname.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="body-md font-medium truncate">{c.nickname}</div>
                  <div className="caption">将变为管理员</div>
                </div>
                {isSelected && <ArrowRight className="h-4 w-4" style={{ color: 'var(--primary)' }} />}
              </button>
            )
          })
        )}
      </div>
    </Dialog>
  )
}
