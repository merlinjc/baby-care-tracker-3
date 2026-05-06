import { useThemeStore } from '@/stores/theme-store'

export function useTheme() {
  const { mode, isDark, setMode } = useThemeStore()
  return { mode, isDark, setMode }
}
