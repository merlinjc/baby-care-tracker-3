/**
 * 图标尺寸 5 档系统（v5.1.0）
 *
 * 建立"图标尺寸阶梯"，与文本字号匹配，让组件内部图标自动按 size 推导。
 *
 * | Size token | 像素 | Tailwind class | 适用文本 |
 * |-----------|-----|----------------|---------|
 * | xs        | 12  | h-3 w-3        | caption (11px) |
 * | sm        | 14  | h-3.5 w-3.5    | body-sm (13px) |
 * | md        | 16  | h-4 w-4        | body-md (15px) |
 * | lg        | 20  | h-5 w-5        | body-lg / heading-md |
 * | xl        | 24  | h-6 w-6        | heading-lg+ |
 *
 * 用法：
 *   <Button size="md" leftIcon={<Plus />} />          // 自动 16px
 *   <Button size="md" leftIcon={<Plus className="h-4 w-4" />} />  // 仍可手动覆盖
 *
 * 设计原则：业务侧默认不需要手写图标尺寸；只有在特殊场景（如装饰图标）才显式指定。
 */
import { cloneElement, isValidElement, type ReactNode } from 'react'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const ICON_SIZE_CLASS: Record<IconSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
}

/**
 * 给 ReactNode 中的根 SVG/icon 元素自动注入尺寸 className。
 *
 * - 如果传入的 icon 已经有 `h-` / `w-` className（用户显式指定），直接返回不修改
 * - 否则克隆并注入 `ICON_SIZE_CLASS[size]`
 *
 * 注意：仅作用于"直接子元素"，不递归。lucide-react 的所有图标都是单个 svg，符合此约定。
 */
export function withIconSize(
  icon: ReactNode | undefined,
  size: IconSize,
): ReactNode | undefined {
  if (!icon) return icon
  if (!isValidElement(icon)) return icon

  // 已有显式尺寸 className → 不修改
  const existing =
    typeof (icon.props as { className?: unknown }).className === 'string'
      ? ((icon.props as { className: string }).className)
      : ''
  if (/\bh-(\[|\d)/.test(existing) || /\bw-(\[|\d)/.test(existing)) {
    return icon
  }

  const sizeCls = ICON_SIZE_CLASS[size]
  const merged = existing ? `${existing} ${sizeCls}` : sizeCls
  return cloneElement(icon as React.ReactElement<{ className?: string }>, {
    className: merged,
  })
}

/**
 * 推荐：根据组件 size 推导图标 size。
 *
 * - Button size="xs" / "sm" → icon size="sm" (14px)
 * - Button size="md"        → icon size="md" (16px)
 * - Button size="lg"        → icon size="lg" (20px)
 * - Button size="icon"      → icon size="md" (16px)
 */
export function deriveIconSize(componentSize: string | null | undefined): IconSize {
  switch (componentSize) {
    case 'xs':
    case 'sm':
      return 'sm'
    case 'lg':
      return 'lg'
    case 'icon':
    case 'md':
    default:
      return 'md'
  }
}
