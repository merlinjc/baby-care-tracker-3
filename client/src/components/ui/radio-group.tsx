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
      style,
      ...props
    },
    ref,
  ) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'group relative w-full text-left',
        'flex items-start gap-3 rounded-lg p-3',
        'cursor-pointer transition-colors',
        'border bg-[var(--bg-primary)] border-[var(--border-light)]',
        'hover:border-[var(--border)]',
        // 选中态
        'data-[state=checked]:border-[color:var(--rgc-accent)]',
        'data-[state=checked]:bg-[color-mix(in_srgb,var(--rgc-accent)_8%,transparent)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
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
      {icon && (
        <span
          className="mt-0.5 shrink-0"
          style={{ color: accentColor }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)] leading-tight">
          {label}
        </div>
        {description && (
          <div className="text-xs mt-0.5 text-[var(--text-hint)] leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {/* 内嵌指示器（圆点 or 自定义 adornment） */}
      <div className="shrink-0 flex items-center">
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
    </RadioGroupPrimitive.Item>
  ),
)
RadioGroupCard.displayName = 'RadioGroupCard'
