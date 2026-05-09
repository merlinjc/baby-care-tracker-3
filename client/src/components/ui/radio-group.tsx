/**
 * RadioGroup - 单选组
 *
 * 基于 @radix-ui/react-radio-group。对标 shadcn/ui。
 *
 * 提供三层 API：
 * - <RadioGroup value onValueChange>：外壳（radix Root）
 * - <RadioGroupItem value id>：单个 radio 点（原始圆点样式）
 * - <RadioGroupCard value label description icon>：**卡片式**单选项
 *   用于 RoleEditDialog、TransferAdminDialog 等需要"图标 + 标题 + 描述"一体化选项的场景
 *
 * Keyboard A11y 由 radix 负责（↑↓←→ 导航）。
 */
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Check } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** RadioGroup - 外壳 */
export const RadioGroup = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn('space-y-2', className)}
    {...props}
  />
))
RadioGroup.displayName = 'RadioGroup'

/** RadioGroupItem - 原始圆点 */
export const RadioGroupItem = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'aspect-square h-4 w-4 rounded-full shrink-0',
      'border-2 border-[var(--border)]',
      'data-[state=checked]:border-[var(--primary)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = 'RadioGroupItem'

/**
 * RadioGroupCard - 卡片式单选项（图标 + 标题 + 描述）
 *
 * 用在 RoleEditDialog、TransferAdminDialog 这类需要"点击整个卡片选中"的场景。
 * 点击选中时卡片底色 + 边框变为 accentColor。
 *
 * v7.1 增强：
 * - `hideIndicator`：隐藏右侧/底部圆点指示器，选中态改用左上角 ✓ 角标。
 *   适合在窄网格列宽下使用（ThemeSelector / FontScaleSelector），避免圆点贴边。
 * - `orientation='vertical'`：纵向布局（icon 上 / label+desc 下 / 居中对齐）。
 *   适合"短 label + 短 desc + 大 icon 预览"场景（FontScaleSelector 的 A 字号档位）。
 */
export interface RadioGroupCardProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    'children'
  > {
  /** 主标题 */
  label: ReactNode
  /** 副标题/描述 */
  description?: ReactNode
  /** 左侧图标（lucide icon 或其它 ReactNode） */
  icon?: ReactNode
  /** 右侧装饰 slot（例如 ArrowRight 指示）；仅在 checked 时显示 */
  checkedAdornment?: ReactNode
  /** 定义选中时的强调色，默认 var(--primary) */
  accentColor?: string
  /**
   * 隐藏右侧/底部的圆点指示器；
   * 选中态改用左上角 ✓ 角标（依旧有边框 + 底色变化）。
   * 适合紧凑网格布局（ThemeSelector / FontScaleSelector）。
   */
  hideIndicator?: boolean
  /**
   * 卡片内布局方向：
   * - `horizontal`（默认）：icon 左、文案右
   * - `vertical`：icon 上、文案下，整体居中
   */
  orientation?: 'horizontal' | 'vertical'
}

export const RadioGroupCard = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupCardProps
>(
  (
    {
      className,
      label,
      description,
      icon,
      checkedAdornment,
      accentColor = 'var(--primary)',
      hideIndicator = false,
      orientation = 'horizontal',
      style,
      ...props
    },
    ref,
  ) => {
    const isVertical = orientation === 'vertical'

    return (
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          'group relative w-full text-left',
          'rounded-lg p-3',
          'cursor-pointer transition-colors',
          'border bg-[var(--bg-primary)] border-[var(--border-light)]',
          'hover:border-[var(--border)]',
          // 选中态
          'data-[state=checked]:border-[color:var(--rgc-accent)]',
          'data-[state=checked]:bg-[color-mix(in_srgb,var(--rgc-accent)_8%,transparent)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // 布局
          isVertical
            ? 'flex flex-col items-center text-center gap-1.5'
            : 'flex items-start gap-3',
          className,
        )}
        style={
          {
            ...style,
            // 通过 CSS 变量传递 accentColor，避免 styled-components 样式冲突
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            '--rgc-accent': accentColor,
          } as React.CSSProperties
        }
        {...props}
      >
        {/* hideIndicator 模式下用左上角 ✓ 角标表达"选中"
            （依赖父级 Item 的 data-state，无需走 radix Indicator） */}
        {hideIndicator && (
          <span
            aria-hidden
            className={cn(
              'absolute top-1.5 right-1.5',
              'w-4 h-4 rounded-full',
              'flex items-center justify-center',
              'opacity-0 scale-75 transition-all duration-150',
              'group-data-[state=checked]:opacity-100 group-data-[state=checked]:scale-100',
            )}
            style={{ backgroundColor: accentColor, color: 'white' }}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}

        {icon && (
          <span
            className={cn(
              'shrink-0',
              isVertical ? 'flex items-center justify-center' : 'mt-0.5',
            )}
            style={{ color: accentColor }}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className={cn('min-w-0', isVertical ? 'w-full' : 'flex-1')}>
          {/* leading 用 snug(1.375) 而非 tight(1.25)，避免中文 descender 被 line-box 裁切 */}
          <div className="text-sm font-medium text-[var(--text-primary)] leading-snug truncate">
            {label}
          </div>
          {description && (
            <div
              className={cn(
                'text-xs mt-1 text-[var(--text-hint)] leading-normal',
                // 横向布局 + 紧凑列下，描述容易撑爆主轴；统一 2 行省略
                isVertical ? 'line-clamp-1' : 'line-clamp-2',
              )}
            >
              {description}
            </div>
          )}
        </div>
        {/* 内嵌指示器（圆点 or 自定义 adornment）；hideIndicator=true 时不渲染 */}
        {!hideIndicator && (
          <div
            className={cn(
              'shrink-0 flex items-center',
              isVertical && 'mt-1',
            )}
          >
            {checkedAdornment ? (
              <RadioGroupPrimitive.Indicator asChild>
                <span className="inline-flex" style={{ color: accentColor }}>
                  {checkedAdornment}
                </span>
              </RadioGroupPrimitive.Indicator>
            ) : (
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  'border-[var(--border)]',
                  'group-data-[state=checked]:border-[color:var(--rgc-accent)]',
                  'flex items-center justify-center',
                )}
              >
                <RadioGroupPrimitive.Indicator asChild>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                </RadioGroupPrimitive.Indicator>
              </span>
            )}
          </div>
        )}
      </RadioGroupPrimitive.Item>
    )
  },
)
RadioGroupCard.displayName = 'RadioGroupCard'
