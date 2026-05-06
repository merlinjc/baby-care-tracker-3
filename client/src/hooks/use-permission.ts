import { useFamilyStore } from '@/stores/family-store'
import type { FamilyRole } from '@/types'
import { Permission } from '@/types'

const ROLE_PERMISSIONS: { [K in FamilyRole]: Permission[] } = {
  admin: Object.values(Permission),
  editor: [
    Permission.RECORD_CREATE,
    Permission.RECORD_UPDATE_OWN,
    Permission.RECORD_DELETE_OWN,
  ],
  viewer: [],
}

export function usePermission() {
  const currentRole = useFamilyStore((s) => s.currentRole)

  const hasPermission = (permission: Permission): boolean => {
    if (!currentRole) return false
    const perms = ROLE_PERMISSIONS[currentRole]
    return perms.includes(permission)
  }

  const isAdmin = currentRole === 'admin'
  const isEditor = currentRole === 'editor'
  const isViewer = currentRole === 'viewer'
  const canEdit = isAdmin || isEditor

  return { hasPermission, isAdmin, isEditor, isViewer, canEdit, currentRole }
}
