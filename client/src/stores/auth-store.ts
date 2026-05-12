import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser, UserPreferences } from '@/types'
import { authService } from '@/services/auth'
import { config } from '@/config'

export interface LoginCredentials {
  /** 邮箱（与 phone 二选一） */
  email?: string
  /** 手机号（与 email 二选一） */
  phone?: string
  /** 明文密码（仅在内存中，绝不持久化） */
  password: string
}

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  setToken: (token: string) => void
  /** 通用登录入口：根据 credentials 中的 email/phone 字段调后端 */
  login: (credentials: LoginCredentials) => Promise<void>
  register: (email: string, password: string, nickname: string) => Promise<void>
  /** 清除内存 + localStorage 中的登录态（不调用后端 logout，调后端请走 services/auth.logout） */
  logout: () => void
  loadUser: () => Promise<void>
  setLoading: (loading: boolean) => void
  /**
   * v7.2+：更新用户偏好（顶层 key 级深合并）。
   *
   * - 仅传想修改的子集即可，未传 key 保留原值
   * - 调 PATCH /auth/profile 后同步 store.user.preferences
   * - 失败时 throw 给调用方，由 UI 决定 toast / 重试
   * - 业务调用：F1 引导完成 / F8 语言切换 / 主题 / 字体档跨设备种子等
   */
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setToken: (token: string) => {
        set({ token, isAuthenticated: true })
      },

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true })
        try {
          const data = await authService.login(credentials)
          set({
            user: data.user,
            token: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string, nickname: string) => {
        set({ isLoading: true })
        try {
          const data = await authService.register({ email, password, nickname })
          set({
            user: data.user,
            token: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      loadUser: async () => {
        const { token } = get()
        if (!token) return

        try {
          const user = await authService.getMe()
          set({ user, isAuthenticated: true })
        } catch {
          set({ user: null, token: null, isAuthenticated: false })
        }
      },

      setLoading: (isLoading: boolean) => set({ isLoading }),

      updatePreferences: async (patch) => {
        const updated = await authService.updatePreferences(patch)
        set({ user: updated })
      },
    }),
    {
      name: config.tokenKey,
      // 显式指定 localStorage：刷新/关闭页面再打开都能恢复登录态。
      // 长期保持登录依赖：①此处的 access token 持久化 + ②后端 httpOnly refreshToken cookie（默认 7 天）。
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
