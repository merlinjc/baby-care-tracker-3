/**
 * ThemeSelector - 三态主题选择器（FR-G1）
 *
 * 选项：亮色 / 暖夜 / 跟随系统
 * 切换时立即应用 + 持久化到 localStorage（由 theme-store 处理）
 *
 * v5.0.1 Batch 4：重构为基于 <RadioGroup> + <RadioGroupCard>（竖向网格布局）。
 * 由 radix 提供键盘 ← → 导航、roving tabindex、aria-checked。
 *
 * v7.1：紧凑 3 列布局下传入 `hideIndicator`，避免右侧圆点贴边/溢出；
 * 选中态改用左上角 ✓ 角标 + 卡片底色/边框双重表达。
 * gap 由 2 升级为 sm:gap-2.5，让卡片之间稍微透气。
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
      className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5 space-y-0"
    >
      {OPTIONS.map((opt) => (
        <RadioGroupCard
          key={opt.value}
          value={opt.value}
          label={opt.label}
          description={opt.desc}
          icon={<opt.Icon className="h-5 w-5" />}
          accentColor="var(--primary)"
          hideIndicator
        />
      ))}
    </RadioGroup>
  )
}
