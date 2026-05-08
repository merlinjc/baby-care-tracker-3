/**
 * SegmentedControl v7 - iOS 风分段控件
 *
 * 完全重写为 iOS 标准样式：
 * - 外层灰底胶囊 (surface-2)
 * - 选中项：白底 + 微阴影 + spring 滑动指示器
 * - 未选中：透明底 + 灰字
 *
 * 使用 framer-motion 的 layout animation，选中态切换自带 spring 滑动效果。
 */
import { motion } from 'framer-motion'
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  accentColor?: string
  toggleable?: boolean
  layout?: 'flex' | 'wrap'
  /** v7：尺寸 */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// 共享的 layoutId 前缀（保证每个 SegmentedControl 内的 indicator 独立）
// 注：v7.2 改为 React useId 实现，下面的旧实现保留兼容但不再使用

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  accentColor,
  toggleable = false,
  layout = 'flex',
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  // 用 React useId 给每个 SegmentedControl 实例独立 layoutId，避免跨页面
  // 卸载/挂载时 layoutId 冲突触发 framer-motion 的 getBoundingClientRect 报错
  const reactId = useId()
  const heights = { sm: 'h-8', md: 'h-9', lg: 'h-10' }
  const textSizes = { sm: 'text-[12px]', md: 'text-[13px]', lg: 'text-[14px]' }
  const padding = { sm: 'p-0.5', md: 'p-1', lg: 'p-1' }

  // wrap 模式退化为自由 chip（每个独立）
  if (layout === 'wrap') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {options.map((opt) => {
          const isActive = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (isActive && toggleable) onChange('' as T)
                else onChange(opt.value)
              }}
              className={cn(
                'px-3 rounded-full font-medium transition-colors pressable',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
                heights[size],
                textSizes[size],
                isActive
                  ? 'text-white'
                  : 'bg-[var(--surface-2)] text-[var(--label-secondary)] hover:bg-[var(--surface-hover)]',
              )}
              style={
                isActive ? { backgroundColor: accentColor ?? 'var(--brand)' } : undefined
              }
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  // flex 模式 = iOS segmented control
  return (
    <div
      role="tablist"
      data-segmented-control
      data-size={size}
      className={cn(
        'relative inline-flex w-full rounded-[10px] bg-[var(--surface-2)]',
        padding[size],
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (isActive && toggleable) onChange('' as T)
              else onChange(opt.value)
            }}
            data-segmented-item
            data-active={isActive ? 'true' : 'false'}
            className={cn(
              'relative flex-1 flex items-center justify-center',
              'rounded-[8px] font-medium transition-colors',
              'focus-visible:outline-none',
              heights[size],
              textSizes[size],
              isActive
                ? 'text-[var(--label)]'
                : 'text-[var(--label-secondary)] hover:text-[var(--label)]',
            )}
            aria-pressed={isActive}
          >
            {isActive && (
              <motion.span
                layoutId={`seg-indicator-${reactId}`}
                className="absolute inset-0 rounded-[8px] bg-[var(--surface-1)]"
                style={{
                  boxShadow: 'var(--shadow-xs), 0 0 0 0.5px var(--separator)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 32,
                }}
              />
            )}
            <span className="relative z-10" style={isActive && accentColor ? { color: accentColor } : undefined}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
