/**
 * ThemeSelector - 三态主题选择器（FR-G1）
 *
 * 选项：亮色 / 暖夜 / 跟随系统
 * 切换时立即应用 + 持久化到 localStorage（由 theme-store 处理）
 *
 * v5.0.1 Batch 4：重构为基于 <RadioGroup> + <RadioGroupCard>（竖向网格布局）。
 * 由 radix 提供键盘 ← → 导航、roving tabindex、aria-checked。
 */
import { Monitor, Moon, Sun } from 'lucide-react';import { useThemeStore, type ThemeMode } from '@/stores/theme-store'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'

const OPTIONS: { value: ThemeMode; label: string; desc: string; Icon: typeof Sun }[] = [
  { value: 'light', label: '亮色', desc: '默认明亮配色', Icon: Sun },
  { value: 'warm-night', label: '暖夜', desc: '深棕暖色调，护眼', Icon: Moon },
  { value: 'system', label: '跟随系统', desc: '根据系统外观自动切换', Icon: Monitor },
]

export function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <RadioGroup
      value={mode}
      onValueChange={(v) => setMode(v as ThemeMode)}
      className="grid grid-cols-1 sm:grid-cols-3 gap-2 space-y-0"
    >
      {OPTIONS.map((opt) => (
        <RadioGroupCard
          key={opt.value}
          value={opt.value}
          label={opt.label}
          description={opt.desc}
          icon={<opt.Icon className="h-5 w-5" />}
          accentColor="var(--primary)"
        />
      ))}
    </RadioGroup>
  )
}
