import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Baby } from '@/types'
import { babyService } from '@/services/baby'

interface BabyStore {
  babies: Baby[]
  currentBaby: Baby | null
  currentBabyId: string | null
  isLoading: boolean

  loadBabies: (familyId: string) => Promise<void>
  selectBaby: (id: string) => void
  createBaby: (data: { familyId: string; name: string; gender: 'male' | 'female'; birthDate: string; avatar?: string }) => Promise<void>
  updateBaby: (id: string, data: { name?: string; gender?: 'male' | 'female'; birthDate?: string; avatar?: string }) => Promise<void>
  deleteBaby: (id: string, familyId: string) => Promise<void>
  clearBabies: () => void
}

export const useBabyStore = create<BabyStore>()(
  persist(
    (set, get) => ({
      babies: [],
      currentBaby: null,
      currentBabyId: null,
      isLoading: false,

      loadBabies: async (familyId: string) => {
        set({ isLoading: true })
        try {
          const babies = await babyService.list(familyId)
          const currentBabyId = get().currentBabyId
          const currentBaby = currentBabyId
            ? babies.find((b: Baby) => b.id === currentBabyId) ?? babies[0] ?? null
            : babies[0] ?? null

          set({
            babies,
            currentBaby,
            currentBabyId: currentBaby?.id ?? null,
            isLoading: false,
          })
        } catch {
          set({ babies: [], currentBaby: null, currentBabyId: null, isLoading: false })
        }
      },

      selectBaby: (id: string) => {
        const baby = get().babies.find((b) => b.id === id)
        set({ currentBaby: baby ?? null, currentBabyId: id })
      },

      createBaby: async (data) => {
        const baby = await babyService.create(data)
        const babies = [...get().babies, baby]
        set({
          babies,
          currentBaby: baby,
          currentBabyId: baby.id,
        })
      },

      updateBaby: async (id, data) => {
        const updated = await babyService.update(id, data)
        const babies = get().babies.map((b) => b.id === id ? updated : b)
        const currentBaby = get().currentBabyId === id ? updated : get().currentBaby
        set({ babies, currentBaby })
      },

      deleteBaby: async (id, familyId) => {
        await babyService.delete(id, familyId)
        const babies = get().babies.filter((b) => b.id !== id)
        const currentBaby = get().currentBabyId === id ? babies[0] ?? null : get().currentBaby
        set({ babies, currentBaby, currentBabyId: currentBaby?.id ?? null })
      },

      clearBabies: () => {
        set({ babies: [], currentBaby: null, currentBabyId: null })
      },
    }),
    {
      name: 'baby_care_current_baby',
      partialize: (state) => ({
        currentBabyId: state.currentBabyId,
      }),
    }
  )
)
