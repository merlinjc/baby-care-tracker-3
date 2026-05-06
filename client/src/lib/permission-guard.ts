/**
 * PermissionGuard - 客户端写操作前置权限校验（FR-C6 双层防护中的 hook 层）
 *
 * 设计要点：
 * - 在 hook / service 层执行写动作前调用 require(perm) 拦截 viewer
 * - 不重复实现权限矩阵：直接复用 @/types 的 Permission 枚举
 * - 与 usePermission()（UI 层）配合：UI 隐藏按钮 + Guard 兜底拦截
 * - 失败抛 PermissionError，axios 拦截器 + Toast 统一处理
 */
import { Permission } from '@/types'
import type { FamilyRole, CareRecord } from '@/types'
import { useFamilyStore } from '@/stores/family-store'
import { useAuthStore } from '@/stores/auth-store'
import { PermissionError } from './api-error'

const ROLE_PERMISSIONS: Record<FamilyRole, Permission[]> = {
  admin: Object.values(Permission),
  editor: [
    Permission.RECORD_CREATE,
    Permission.RECORD_UPDATE_OWN,
    Permission.RECORD_DELETE_OWN,
  ],
  viewer: [],
}

function getCurrentRole(): FamilyRole | null {
  return useFamilyStore.getState().currentRole
}

function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

export const permissionGuard = {
  /**
   * 写动作前校验：失败抛 PermissionError
   * @example permissionGuard.require(Permission.RECORD_CREATE)
   */
  require(permission: Permission): void {
    const role = getCurrentRole()
    if (!role) {
      throw new PermissionError('未加入家庭，无法执行此操作')
    }
    const perms = ROLE_PERMISSIONS[role] ?? []
    if (!perms.includes(permission)) {
      throw new PermissionError('您没有此操作的权限')
    }
  },

  /**
   * 删除前置校验：admin 可删任意；editor 只能删自己创建的
   */
  requireCanDelete(record: Pick<CareRecord, 'createdBy'>): void {
    const role = getCurrentRole()
    if (!role) {
      throw new PermissionError('未加入家庭，无法执行此操作')
    }
    if (role === 'admin') return
    if (role === 'editor') {
      const currentUserId = getCurrentUserId()
      if (record.createdBy !== currentUserId) {
        throw new PermissionError('无权删除他人记录')
      }
      return
    }
    throw new PermissionError('您没有删除权限')
  },

  /** 静态查询当前是否有某权限（不抛错），与 require 互补 */
  has(permission: Permission): boolean {
    const role = getCurrentRole()
    if (!role) return false
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
  },
}
