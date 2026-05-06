/**
 * RemoveMemberConfirm - 移除成员二次确认（FR-C4）
 *
 * 要求用户输入「确认移除」字样才能点击红色按钮，防止误操作
 */
import { useState } from 'react'
import { UserX, AlertTriangle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useFamilyStore } from '@/stores/family-store'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import type { FamilyMember } from '@/types'

interface RemoveMemberConfirmProps {
  open: boolean
  onClose: () => void
  member: FamilyMember | null
}

const CONFIRM_TEXT = '确认移除'

export function RemoveMemberConfirm({ open, onClose, member }: RemoveMemberConfirmProps) {
  const removeMember = useFamilyStore((s) => s.removeMember)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const valid = input === CONFIRM_TEXT

  const handleClose = () => {
    if (!submitting) {
      setInput('')
      onClose()
    }
  }

  const handleSubmit = async () => {
    if (!valid || !member) return
    setSubmitting(true)
    try {
      await removeMember(member.userId)
      toast.success(`已移除 ${member.user?.nickname ?? '成员'}`)
      setInput('')
      onClose()
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'CANNOT_REMOVE_ADMIN') {
        toast.error('不能移除其他管理员，请先降级其权限')
      } else {
        toast.error(e.message ?? '移除失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!member) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="移除家庭成员"
      icon={<UserX className="h-4 w-4" />}
      accentColor="var(--danger)"
      footer={
        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmText={submitting ? '移除中...' : '移除'}
          loading={submitting}
          disabled={!valid}
          variant="danger"
        />
      }
    >
      <div
        className="rounded-md p-3 mb-4 flex items-start gap-2"
        style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)' }}
      >
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
        <div className="body-sm space-y-1">
          <p style={{ color: 'var(--danger)' }}>
            您正在移除 <span className="font-semibold">{member.user?.nickname ?? '成员'}</span>。
          </p>
          <p className="text-[var(--text-secondary)]">
            移除后该成员将无法访问家庭数据。其历史记录会保留并标注为「已退出成员」。
          </p>
        </div>
      </div>

      <label className="label-base">
        请输入「{CONFIRM_TEXT}」以继续：
      </label>
      <input
        type="text"
        className="input-base mt-1"
        placeholder={CONFIRM_TEXT}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={submitting}
        autoComplete="off"
      />
    </Dialog>
  )
}
