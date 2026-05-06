/**
 * ThemeSelector - 三态主题选择器（FR-G1）
 *
 * 选项：亮色 / 暖夜 / 跟随系统
 * 切换时立即应用 + 持久化到 localStorage（由 theme-store 处理）
 */
import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '@/stores/theme-store'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemeMode; label: string; desc: string; Icon: typeof Sun }[] = [
  { value: 'light', label: '亮色', desc: '默认明亮配色', Icon: Sun },
  { value: 'warm-night', label: '暖夜', desc: '深棕暖色调，护眼', Icon: Moon },
  { value: 'system', label: '跟随系统', desc: '根据系统外观自动切换', Icon: Monitor },
]

export function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const isActive = mode === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl p-4 transition-all',
              'cursor-pointer',
            )}
            style={{
              backgroundColor: isActive
                ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
                : 'var(--bg-primary)',
              border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-light)',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            aria-pressed={isActive}
          >
            <opt.Icon className="h-5 w-5" />
            <div className="body-sm font-medium">{opt.label}</div>
            <div className="caption text-[var(--text-hint)] text-center">{opt.desc}</div>
          </button>
        )
      })}
    </div>
  )
}
