/**
 * RoleEditDialog - 修改成员权限对话框（FR-C3）
 *
 * 三选一 RadioGroup（admin/editor/viewer），提交后调 store.updateMemberRole
 * 后端拦截 SOLE_ADMIN 时前端 toast 提示
 *
 * v5.0.1 Batch 2：<label> + 原生 radio 组合重构为 <RadioGroup> + <RadioGroupCard>，
 * 由 radix 负责键盘 ↑↓ 导航、aria-checked、roving tabindex。
 */
import { useEffect, useState } from 'react'
import { Shield, Edit, Eye, UserCog } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { useFamilyStore } from '@/stores/family-store'
import { toast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api-error'
import type { FamilyMember, FamilyRole } from '@/types'

interface RoleEditDialogProps {
  open: boolean
  onClose: () => void
  member: FamilyMember | null
}

const OPTIONS: { value: FamilyRole; label: string; desc: string; Icon: typeof Shield }[] = [
  { value: 'admin', label: '管理员', desc: '所有权限：管理成员、记录、宝宝档案', Icon: Shield },
  { value: 'editor', label: '成员', desc: '可添加 / 编辑 / 删除自己创建的记录', Icon: Edit },
  { value: 'viewer', label: '仅查看', desc: '只能查看记录，不能修改任何数据', Icon: Eye },
]

export function RoleEditDialog({ open, onClose, member }: RoleEditDialogProps) {
  const updateMemberRole = useFamilyStore((s) => s.updateMemberRole)
  const [selected, setSelected] = useState<FamilyRole>(member?.role ?? 'editor')
  const [submitting, setSubmitting] = useState(false)

  // member 变化（弹窗打开/切换目标成员）时同步选择
  useEffect(() => {
    if (open && member) {
      setSelected(member.role)
    }
  }, [open, member])

  if (!member) return null

  const handleSubmit = async () => {
    if (selected === member.role) {
      onClose()
      return
    }
    setSubmitting(true)
    try {
      await updateMemberRole(member.userId, selected)
      toast.success('权限已更新')
      onClose()
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'SOLE_ADMIN') {
        toast.error('家庭至少需要一位管理员')
      } else {
        toast.error(e.message ?? '权限修改失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`修改 ${member.user?.nickname ?? '成员'} 的权限`}
      icon={<UserCog className="h-4 w-4" />}
      accentColor="var(--primary)"
      footer={
        <DialogFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={submitting ? '保存中...' : '确认'}
          loading={submitting}
          disabled={selected === member.role}
        />
      }
    >
      <RadioGroup
        value={selected}
        onValueChange={(v) => setSelected(v as FamilyRole)}
      >
        {OPTIONS.map((opt) => (
          <RadioGroupCard
            key={opt.value}
            value={opt.value}
            label={opt.label}
            description={opt.desc}
            icon={<opt.Icon className="h-4 w-4" />}
            accentColor="var(--primary)"
          />
        ))}
      </RadioGroup>
    </Dialog>
  )
}
