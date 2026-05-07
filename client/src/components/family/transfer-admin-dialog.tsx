/**
 * TransferAdminDialog - 转让管理员对话框（FR-C5）
 *
 * 列出候选成员（leaveFamily 返回的 otherMembers，或本地 family.members 排除自己）
 * 选择后调 store.transferAdmin，可选自动接续 leaveFamily
 *
 * v5.0.1 Batch 2：
 * - 成员选择改为 <RadioGroup> + <RadioGroupCard>（含 Avatar）
 * - thenLeave 场景顶部加 <Alert variant="warning"> 强调警告
 */
import { useState } from 'react'
import { Crown, ArrowRight } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Alert } from '@/components/ui/alert'
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

function CandidateAvatar({ candidate }: { candidate: Candidate }) {
  return candidate.avatar ? (
    <img
      src={candidate.avatar}
      alt={candidate.nickname}
      className="h-10 w-10 rounded-full object-cover shrink-0"
    />
  ) : (
    <div
      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      {candidate.nickname.charAt(0)}
    </div>
  )
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
      <Alert variant={thenLeave ? 'warning' : 'info'} size="md" className="mb-4">
        {thenLeave
          ? '您是当前家庭的唯一管理员，请先选择一位成员接管管理权限，然后才能退出家庭。'
          : '选择一位成员，将管理员权限转让给他/她。转让后您将变为普通成员（editor）。'}
      </Alert>

      <div className="max-h-72 overflow-y-auto">
        {list.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">暂无可选成员</p>
            <p className="empty-state__desc">家庭中没有其他成员可以接管</p>
          </div>
        ) : (
          <RadioGroup
            value={selectedId ?? ''}
            onValueChange={(v) => setSelectedId(v || null)}
          >
            {list.map((c) => (
              <RadioGroupCard
                key={c.id}
                value={c.id}
                label={c.nickname}
                description="将变为管理员"
                icon={<CandidateAvatar candidate={c} />}
                accentColor="var(--primary)"
                checkedAdornment={<ArrowRight className="h-4 w-4" />}
              />
            ))}
          </RadioGroup>
        )}
      </div>
    </Dialog>
  )
}
