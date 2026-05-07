/**
 * Tooltip - 悬浮提示
 *
 * 基于 @radix-ui/react-tooltip。对标 shadcn/ui。
 *
 * 自带：
 * - 键盘 focus 时也会显示（而不是只有 mouseover）
 * - Provider 控制全局延迟（默认 300ms）
 * - Portal 渲染
 *
 * 本文件导出 `<TooltipProvider>` 应在 App 根部挂载一次（可选 delayDuration）。
 * 单个 Tooltip 用法：
 *
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button size="icon" aria-label="删除">
 *         <Trash2 />
 *       </Button>
 *     </TooltipTrigger>
 *     <TooltipContent>删除</TooltipContent>
 *   </Tooltip>
 */
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md px-2.5 py-1.5',
        'text-xs leading-snug',
        'bg-[var(--text-primary)] text-[var(--bg-card)]',
        'shadow-[var(--shadow-popup)]',
        'animate-fade-in',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'
