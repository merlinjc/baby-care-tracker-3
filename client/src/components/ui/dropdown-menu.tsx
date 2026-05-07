/**
 * DropdownMenu - 下拉菜单
 *
 * 基于 @radix-ui/react-dropdown-menu。对标 shadcn/ui。
 *
 * 自带能力（由 radix 提供）：
 * - 点击 trigger 切换、点击外部/ESC 关闭
 * - 键盘导航：Space/Enter 打开、↑↓ 选择、Enter 触发、Esc 关闭
 * - aria-haspopup="menu" / aria-expanded / role="menu" / role="menuitem" 自动加
 * - inert 背景 + Portal 渲染（避开 z-index / overflow 问题）
 * - return-focus 到 trigger
 *
 * 用法示例：
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild>
 *       <Button>添加</Button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuItem onSelect={() => onPick('feeding')}>
 *         <DropdownMenuItemIcon accentColor="var(--feeding)">
 *           <Baby className="h-3.5 w-3.5" />
 *         </DropdownMenuItemIcon>
 *         <DropdownMenuItemText title="喂养" description="母乳 / 配方奶 / 辅食" />
 *       </DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem variant="danger" onSelect={handleDelete}>
 *         删除
 *       </DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal

/** 下拉面板 */
export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, align = 'end', sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[180px] overflow-hidden rounded-xl p-1',
        'bg-[var(--bg-card)] border border-[var(--border-light)]',
        'shadow-[var(--shadow-popup)]',
        'animate-fade-in outline-none',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

/** 菜单项 */
export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  /** 'default' | 'danger'；danger 时 hover 色为 danger */
  variant?: 'default' | 'danger'
}

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, variant = 'default', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex items-center gap-2.5 rounded-lg px-3 py-2',
      'text-sm cursor-pointer select-none outline-none',
      'text-[var(--text-primary)]',
      'data-[highlighted]:bg-[var(--bg-elevated)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      variant === 'danger' && [
        'text-[var(--danger)]',
        'data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]',
      ],
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

/** 菜单项内嵌的"图标圆" */
export function DropdownMenuItemIcon({
  children,
  accentColor,
  className,
}: {
  children: ReactNode
  accentColor?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 rounded-full',
        'h-7 w-7',
        className,
      )}
      style={{
        backgroundColor: accentColor
          ? `color-mix(in srgb, ${accentColor} 14%, transparent)`
          : 'var(--bg-elevated)',
        color: accentColor ?? 'var(--text-primary)',
      }}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** 菜单项内嵌的"主标题 + 副描述" 文字块 */
export function DropdownMenuItemText({
  title,
  description,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex-1 min-w-0 text-left', className)}>
      <div className="text-sm font-medium text-[var(--text-primary)] leading-tight">
        {title}
      </div>
      {description && (
        <div className="text-xs mt-0.5 text-[var(--text-hint)] truncate">
          {description}
        </div>
      )}
    </div>
  )
}

/** 菜单分隔线 */
export const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('h-px bg-[var(--border-light)] my-1', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

/** 菜单分组标签 */
export const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider',
      'text-[var(--text-hint)]',
      className,
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'
