/**
 * MembersSection - 家庭成员列表（FR-C1）
 *
 * 显示头像 / 昵称 / 角色标签 / 加入时间
 * admin 可对其他成员显示三点菜单（编辑权限 / 移除）
 */
import { useState } from 'react'
import { MoreVertical, Crown, Edit3, Eye, UserCog, UserX, ArrowRightLeft } from 'lucide-react'
import { useFamilyStore } from '@/stores/family-store'
import { useAuthStore } from '@/stores/auth-store'
import { RoleEditDialog } from './role-edit-dialog'
import { RemoveMemberConfirm } from './remove-member-confirm'
import { TransferAdminDialog } from './transfer-admin-dialog'
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
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
          const showMenu = openMenuId === m.id

          return (
            <div key={m.id} className="card flex items-center gap-3 relative">
              {/* 头像 */}
              {m.user?.avatar ? (
                <img
                  src={m.user.avatar}
                  alt={m.user.nickname}
                  className="h-12 w-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {m.user?.nickname?.charAt(0) ?? '?'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="body-md font-medium truncate">{m.user?.nickname ?? '成员'}</span>
                  {isMe && (
                    <span className="type-badge type-badge--feeding text-xs">我</span>
                  )}
                  {isCreator && (
                    <span className="type-badge type-badge--diaper text-xs">创建者</span>
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
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenuId(showMenu ? null : m.id)}
                    aria-label="操作菜单"
                    className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-hint)' }} />
                  </button>
                  {showMenu && (
                    <>
                      {/* 点击外部关闭 */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div
                        className="absolute right-0 top-full mt-1 z-20 min-w-32 rounded-lg shadow-lg overflow-hidden"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        {m.role !== 'admin' && (
                          <button
                            onClick={() => {
                              setEditTarget(m)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            修改权限
                          </button>
                        )}
                        {m.role !== 'admin' && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null)
                              setTransferOpen(true)
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            转让管理员
                          </button>
                        )}
                        {m.role !== 'admin' && (
                          <button
                            onClick={() => {
                              setRemoveTarget(m)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                            style={{ color: 'var(--danger)' }}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            移除成员
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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
