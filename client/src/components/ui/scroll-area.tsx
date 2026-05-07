/**
 * ScrollArea - 自定义滚动容器
 *
 * 基于 @radix-ui/react-scroll-area。对标 shadcn/ui。
 *
 * 作用：把浏览器原生 scrollbar 统一为美拉德色系的细滚动条（与全局
 * `::-webkit-scrollbar` 风格一致），并提供 A11y 友好的滚动感知。
 *
 * 典型用法：
 *   <ScrollArea className="h-72">
 *     <div>超出高度的长内容…</div>
 *   </ScrollArea>
 *
 * 注意：外层 ScrollArea **必须有固定高度**（通过 `className="h-xx"` 或 parent flex）。
 */
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const ScrollArea = forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = 'ScrollArea'

const ScrollBar = forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-1.5 border-l border-l-transparent',
      orientation === 'horizontal' && 'h-1.5 flex-col border-t border-t-transparent',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      className="relative flex-1 rounded-full bg-[var(--border)] hover:bg-[var(--primary-dark)] transition-colors"
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = 'ScrollBar'

export { ScrollBar }
