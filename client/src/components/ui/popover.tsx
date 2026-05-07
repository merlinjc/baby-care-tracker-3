/**
 * Popover - 可定位浮层
 *
 * 基于 @radix-ui/react-popover。对标 shadcn/ui。
 *
 * 自带：
 * - 点击外部关闭
 * - ESC 关闭
 * - Portal 渲染（避开 z-index / overflow 问题）
 * - 自动 focus trap + return-focus
 * - 键盘 Tab 循环
 *
 * Content 默认面板样式统一 `<shadow-popup> + border`，与 Dialog / DropdownMenu 视觉协调。
 */
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverClose = PopoverPrimitive.Close

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  /** 面板内边距挡位 */
  padding?: 'none' | 'sm' | 'md'
}

const paddingMap: Record<NonNullable<PopoverContentProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-3',
}

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, padding = 'md', align = 'center', sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[200px] rounded-xl',
        'bg-[var(--bg-card)] border border-[var(--border-light)]',
        'shadow-[var(--shadow-popup)]',
        'animate-fade-in',
        'outline-none',
        paddingMap[padding],
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'
