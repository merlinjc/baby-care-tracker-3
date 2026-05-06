import { create } from 'zustand'
import type { FamilyDetail, FamilyMember, FamilyRole, LeaveFamilyResult } from '@/types'
import { familyService } from '@/services/family'
import { useAuthStore } from '@/stores/auth-store'

interface FamilyStore {
  family: FamilyDetail | null
  members: FamilyMember[]
  currentRole: FamilyRole | null
  isLoading: boolean

  loadFamily: () => Promise<void>
  createFamily: (name: string, nickname: string, relation?: string, relationText?: string) => Promise<void>
  joinFamily: (inviteCode: string, nickname: string, relation?: string, relationText?: string) => Promise<void>
  /** FR-C5：返回完整状态机结果，由调用方根据 status 字段分支处理 */
  leaveFamily: () => Promise<LeaveFamilyResult>
  refreshInviteCode: () => Promise<{ inviteCode: string; inviteCodeExpiry: string }>
  updateMemberRole: (userId: string, role: FamilyRole) => Promise<void>
  removeMember: (userId: string) => Promise<void>
  transferAdmin: (newAdminId: string) => Promise<void>
  dissolveFamily: () => Promise<void>
  isCurrentUserAdmin: () => boolean
  clearFamily: () => void
}

export const useFamilyStore = create<FamilyStore>()((set, get) => ({
  family: null,
  members: [],
  currentRole: null,
  isLoading: false,

  loadFamily: async () => {
    set({ isLoading: true })
    try {
      const family = await familyService.getCurrent()
      const currentUserId = useAuthStore.getState().user?.id ?? null
      const currentMember = family?.members?.find((m) => m.userId === currentUserId)
      set({
        family,
        members: family?.members ?? [],
        currentRole: (currentMember?.role as FamilyRole) ?? null,
        isLoading: false,
      })
    } catch {
      set({ family: null, members: [], currentRole: null, isLoading: false })
    }
  },

  createFamily: async (name, nickname, relation) => {
    const family = await familyService.create(name, nickname, relation)
    set({ family, members: family.members, currentRole: 'admin' })
  },

  joinFamily: async (inviteCode, nickname) => {
    const result = await familyService.join(inviteCode, nickname)
    const family = result.family
    const currentUserId = useAuthStore.getState().user?.id ?? null
    const currentMember = family?.members?.find((m) => m.userId === currentUserId)
    set({
      family,
      members: family?.members ?? [],
      currentRole: (currentMember?.role as FamilyRole) ?? 'editor',
    })
  },

  leaveFamily: async () => {
    const { family } = get()
    if (!family) {
      return { status: 'family_not_found', message: '当前未加入家庭' }
    }
    const result = await familyService.leave(family.id)
    if (result.status === 'ok' || result.status === 'dissolved') {
      set({ family: null, members: [], currentRole: null })
    }
    return result
  },

  refreshInviteCode: async () => {
    const { family } = get()
    if (!family) throw new Error('当前未加入家庭')
    const result = await familyService.refreshInviteCode(family.id)
    set({
      family: {
        ...family,
        inviteCode: result.inviteCode,
        inviteCodeExpiry: result.inviteCodeExpiry,
      },
    })
    return result
  },

  updateMemberRole: async (userId, role) => {
    const { family } = get()
    if (!family) throw new Error('当前未加入家庭')
    await familyService.updateMemberRole(family.id, userId, role)
    // 局部更新：更新 members 数组中对应成员的 role（FR-C3 设计要求）
    const newMembers = family.members.map((m) =>
      m.userId === userId ? { ...m, role } : m,
    )
    set({
      family: { ...family, members: newMembers },
      members: newMembers,
    })
  },

  removeMember: async (userId) => {
    const { family } = get()
    if (!family) throw new Error('当前未加入家庭')
    await familyService.removeMember(family.id, userId)
    const newMembers = family.members.filter((m) => m.userId !== userId)
    set({
      family: { ...family, members: newMembers },
      members: newMembers,
    })
  },

  transferAdmin: async (newAdminId) => {
    const { family } = get()
    if (!family) throw new Error('当前未加入家庭')
    const currentUserId = useAuthStore.getState().user?.id ?? null
    await familyService.transferAdmin(family.id, newAdminId)
    // 局部更新：当前用户 role -> editor，新 admin role -> admin
    const newMembers = family.members.map((m) => {
      if (m.userId === currentUserId) return { ...m, role: 'editor' as FamilyRole }
      if (m.userId === newAdminId) return { ...m, role: 'admin' as FamilyRole }
      return m
    })
    set({
      family: { ...family, members: newMembers },
      members: newMembers,
      currentRole: 'editor',
    })
  },

  dissolveFamily: async () => {
    const { family } = get()
    if (!family) throw new Error('当前未加入家庭')
    await familyService.dissolve(family.id)
    set({ family: null, members: [], currentRole: null })
  },

  isCurrentUserAdmin: () => {
    return get().currentRole === 'admin'
  },

  clearFamily: () => {
    set({ family: null, members: [], currentRole: null })
  },
}))
