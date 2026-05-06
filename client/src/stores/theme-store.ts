import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/config'

/**
 * 三态主题（FR-G1）：
 * - 'light'：亮色（美拉德暖米）
 * - 'warm-night'：暖夜（深棕暖色调）
 * - 'system'：跟随系统 prefers-color-scheme
 *
 * 兼容性：仍向 root 添加 `.dark` class，便于未升级的 Tailwind 选择器继续工作。
 * 新组件应优先使用 `[data-theme="..."]` 选择器或 CSS 变量。
 */
export type ThemeMode = 'light' | 'warm-night' | 'system'

interface ThemeStore {
  mode: ThemeMode
  /** 实际渲染时是否处于暖夜（深色）状态，由 mode + 系统偏好计算得出 */
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode): boolean {
  const root = document.documentElement
  // 写 data-theme（语义化、暴露给 CSS 选择器）
  root.dataset.theme = mode
  // 兼容旧代码：暖夜或系统暗色时同时挂 .dark class
  const isDark = mode === 'warm-night' || (mode === 'system' && getSystemDark())
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  return isDark
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'light',
      isDark: false,

      setMode: (mode: ThemeMode) => {
        const isDark = applyTheme(mode)
        set({ mode, isDark })
      },
    }),
    {
      name: config.themeKey,
      // 兼容旧持久化值 'dark' → 升级为 'warm-night'
      migrate: (persistedState: unknown) => {
        const state = persistedState as { mode?: string; isDark?: boolean } | null
        if (state && (state.mode as string) === 'dark') {
          state.mode = 'warm-night'
        }
        return state ?? { mode: 'light' as ThemeMode, isDark: false }
      },
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = applyTheme(state.mode)
          state.isDark = isDark
        }
      },
    }
  )
)

// 监听系统主题变化（仅 system 模式下生效）
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode } = useThemeStore.getState()
    if (mode === 'system') {
      const isDark = applyTheme(mode)
      useThemeStore.setState({ isDark })
    }
  })
}
