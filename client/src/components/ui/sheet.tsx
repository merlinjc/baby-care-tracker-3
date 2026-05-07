/**
 * Sheet - 侧边 / 底部抽屉（基于 Dialog 的变体）
 *
 * 对标 shadcn/ui 的 `sheet.tsx`。
 *
 * 与 `<Dialog>` 的区别：
 * - Dialog 是"中心弹窗"（移动端才退化为底部 sheet）
 * - Sheet 在**任何断点**都是侧边 / 底部滑出，用于：
 *   - 桌面端右侧筛选抽屉（如记录页高级筛选）
 *   - 桌面端左侧导航抽屉（窄屏 < 1024px 的 Sidebar）
 *   - 底部/顶部粘性内容
 *
 * 底层共享 `@radix-ui/react-dialog`，但定位 / 动画 / 对齐不同。
 *
 * 用法：
 *   <Sheet open={open} onOpenChange={setOpen} side="right">
 *     <SheetContent size="md">
 *       <SheetHeader>
 *         <SheetTitle>高级筛选</SheetTitle>
 *       </SheetHeader>
 *       <SheetBody>…</SheetBody>
 *       <SheetFooter>
 *         <Button onClick={onApply}>应用</Button>
 *       </SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

const sheetContentVariants = cva(
  [
    'fixed z-50 flex flex-col',
    'bg-[var(--bg-card)]',
    'shadow-[var(--shadow-elevated)]',
    'outline-none',
  ].join(' '),
  {
    variants: {
      side: {
        right: [
          'inset-y-0 right-0 h-full',
          'border-l border-[var(--border-light)]',
          'data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
        ].join(' '),
        left: [
          'inset-y-0 left-0 h-full',
          'border-r border-[var(--border-light)]',
          'data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
        ].join(' '),
        top: [
          'inset-x-0 top-0 w-full',
          'border-b border-[var(--border-light)]',
          'data-[state=open]:animate-slide-in-top data-[state=closed]:animate-slide-out-top',
        ].join(' '),
        bottom: [
          'inset-x-0 bottom-0 w-full rounded-t-[20px]',
          'border-t border-[var(--border-light)]',
          'data-[state=open]:animate-slide-up',
        ].join(' '),
      },
      size: {
        sm: '',
        md: '',
        lg: '',
      },
    },
    compoundVariants: [
      { side: 'right', size: 'sm', class: 'w-full sm:max-w-sm' },
      { side: 'right', size: 'md', class: 'w-full sm:max-w-md' },
      { side: 'right', size: 'lg', class: 'w-full sm:max-w-lg' },
      { side: 'left', size: 'sm', class: 'w-full sm:max-w-sm' },
      { side: 'left', size: 'md', class: 'w-full sm:max-w-md' },
      { side: 'left', size: 'lg', class: 'w-full sm:max-w-lg' },
      { side: 'top', size: 'sm', class: 'max-h-[40vh]' },
      { side: 'top', size: 'md', class: 'max-h-[60vh]' },
      { side: 'top', size: 'lg', class: 'max-h-[80vh]' },
      { side: 'bottom', size: 'sm', class: 'max-h-[40vh]' },
      { side: 'bottom', size: 'md', class: 'max-h-[60vh]' },
      { side: 'bottom', size: 'lg', class: 'max-h-[90vh]' },
    ],
    defaultVariants: { side: 'right', size: 'md' },
  },
)

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetContentVariants> {
  /** 是否渲染默认关闭按钮（右上角 X），默认 true */
  showCloseButton?: boolean
  /** 是否点击遮罩关闭，默认 true */
  dismissOnBackdrop?: boolean
}

export const SheetContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = 'right',
      size = 'md',
      className,
      children,
      showCloseButton = true,
      dismissOnBackdrop = true,
      ...props
    },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 animate-fade-in"
        style={{ backgroundColor: 'var(--mask-dark)' }}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetContentVariants({ side, size }), className)}
        onPointerDownOutside={(e) => {
          if (!dismissOnBackdrop) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (!dismissOnBackdrop) e.preventDefault()
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label="关闭"
              className={cn(
                'absolute top-4 right-4',
                'p-1.5 rounded-lg text-[var(--text-hint)]',
                'hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
              )}
            >
              <X className="h-5 w-5" />
            </button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
)
SheetContent.displayName = 'SheetContent'

/** SheetHeader - 顶部标题区 */
export function SheetHeader({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-6 pt-5 pb-3',
        'border-b border-[var(--border-light)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** SheetTitle - 对标 DialogTitle */
export const SheetTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('heading-md text-[var(--text-primary)]', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

/** SheetDescription - 对标 DialogDescription */
export const SheetDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-hint)]', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

/** SheetBody - 可滚动的主体 */
export function SheetBody({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)}>
      {children}
    </div>
  )
}

/** SheetFooter - 底部操作区（可选 sticky） */
export function SheetFooter({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-6 py-4',
        'border-t border-[var(--border-light)]',
        'bg-[var(--bg-card)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export { sheetContentVariants }
