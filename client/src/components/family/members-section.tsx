/**
 * MembersSection - 家庭成员列表（FR-C1）
 *
 * 显示头像 / 昵称 / 角色标签 / 加入时间
 * admin 可对其他成员显示三点菜单（编辑权限 / 移除 / 转让管理员）
 *
 * v5.0.1 Batch 2：⋮ 菜单重构为基于 <DropdownMenu> (radix)，
 * 由 radix 负责点击外部/Esc 关闭、focus trap、键盘 ↑↓ 导航 / Tab 循环 / return-focus。
 */
import { useState } from 'react'
import { MoreVertical, Crown, Edit3, Eye, UserCog, UserX, ArrowRightLeft } from 'lucide-react'
import { useFamilyStore } from '@/stores/family-store'
import { useAuthStore } from '@/stores/auth-store'
import { IconButton } from '@/components/ui/icon-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { RoleEditDialog } from './role-edit-dialog'
import { RemoveMemberConfirm } from './remove-member-confirm'
import { TransferAdminDialog } from './transfer-admin-dialog'
import { relationToCareRole, getCareRoleMeta } from '@/lib/care-role'
import type { FamilyMember, FamilyRole } from '@/types'

const ROLE_LABEL: Record<FamilyRole, string> = {
  admin: '管理员',
  editor: '成员',
  viewer: '仅查看',
}

const ROLE_ICON: Record<FamilyRole, typeof Crown> = {
  admin: Crown,
  editor: Edit3,
  viewer: Eye,
}

function formatJoinedAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear) return `${d.getMonth() + 1}月${d.getDate()}日 加入`
  return `${d.getFullYear()}年${d.getMonth() + 1}月 加入`
}

export function MembersSection() {
  const family = useFamilyStore((s) => s.family)
  const isCurrentUserAdmin = useFamilyStore((s) => s.isCurrentUserAdmin)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [editTarget, setEditTarget] = useState<FamilyMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  if (!family) return null
  const isAdmin = isCurrentUserAdmin()

  // 排序：admin 在前，按 joinedAt desc
  const sortedMembers = [...family.members].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (b.role === 'admin' && a.role !== 'admin') return 1
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  })

  return (
    <>
      <div className="space-y-2">
        {sortedMembers.map((m) => {
          const isMe = m.userId === currentUserId
          const isCreator = family.creatorId === m.userId
          const RoleIcon = ROLE_ICON[m.role]
          const careRole = relationToCareRole(m.relation)
          const careRoleMeta = careRole ? getCareRoleMeta(careRole) : null

          return (
            <Card key={m.id} className="flex items-center gap-3">
              {/* 头像 */}
              <UserAvatar user={{ nickname: m.user?.nickname, avatar: m.user?.avatar }} size="lg" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="body-md font-medium truncate">
                    {m.user?.nickname ?? '成员'}
                  </span>
                  {isMe && (
                    <Badge size="xs" variant="feeding">
                      我
                    </Badge>
                  )}
                  {isCreator && (
                    <Badge size="xs" variant="diaper">
                      创建者
                    </Badge>
                  )}
                  {careRoleMeta && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full"
                      style={{
                        padding: '1px 6px',
                        fontSize: 'var(--text-xs)',
                        lineHeight: 1.4,
                        backgroundColor: 'color-mix(in srgb, var(--sleep) 10%, transparent)',
                        color: 'var(--sleep)',
                      }}
                      title="AI 每日洞察使用的身份视角"
                    >
                      <span aria-hidden>{careRoleMeta.emoji}</span>
                      <span>{careRoleMeta.label}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <RoleIcon className="h-3 w-3" style={{ color: 'var(--text-hint)' }} />
                  <span className="caption">{ROLE_LABEL[m.role]}</span>
                  <span className="caption">·</span>
                  <span className="caption">{formatJoinedAt(m.joinedAt)}</span>
                </div>
              </div>

              {/* 三点菜单（admin 可见，且不是自己） */}
              {isAdmin && !isMe && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="操作菜单"
                      icon={<MoreVertical className="h-4 w-4" />}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {/* 修改权限：对 admin 也允许操作（降级为 editor/viewer）；
                        服务端 `SOLE_ADMIN` 会兜底拦截"最后一个 admin 不能降级" */}
                    <DropdownMenuItem onSelect={() => setEditTarget(m)}>
                      <UserCog className="h-3.5 w-3.5" />
                      <span>修改权限</span>
                    </DropdownMenuItem>
                    {/* 转让管理员：目标必须是非 admin（服务端 `INVALID_PARAMS`
                        拒绝把已是 admin 的人再次"转让"为 admin） */}
                    {m.role !== 'admin' && (
                      <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span>转让管理员</span>
                      </DropdownMenuItem>
                    )}
                    {/* 移除成员：admin 之间不能互踢（服务端 `CANNOT_REMOVE_ADMIN`） */}
                    {m.role !== 'admin' && (
                      <DropdownMenuItem
                        variant="danger"
                        onSelect={() => setRemoveTarget(m)}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>移除成员</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Card>
          )
        })}
      </div>

      <RoleEditDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        member={editTarget}
      />
      <RemoveMemberConfirm
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        member={removeTarget}
      />
      <TransferAdminDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
      />
    </>
  )
}
