/**
 * Dialog - 基于 @radix-ui/react-dialog 的响应式弹窗
 *
 * - 移动端（< 640px）：底部 sheet，slide-up 动画，带拖拽条
 * - 桌面端（≥ 640px）：居中，scale-in 动画，四角全圆角
 *
 * 特性（由 radix 提供）：
 * - 自动焦点陷阱（首元素 focus / Tab 循环）
 * - 关闭时 return-focus 到触发元素
 * - ESC 关闭、背景点击关闭（可关）
 * - 自动 aria-labelledby / aria-describedby
 * - inert 背景（屏幕阅读器忽略 Dialog 外的 DOM）
 * - Portal 渲染，规避 z-index / overflow hidden 问题
 *
 * 对外 API 与旧自建 Dialog 完全一致（open / onClose / title / icon / accentColor /
 * children / showDragIndicator / footer / size / dismissOnBackdrop），
 * 业务代码无需改动。
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DialogSize = 'sm' | 'md' | 'lg'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional icon shown next to title */
  icon?: ReactNode
  /** Title accent color (icon tint) */
  accentColor?: string
  children: ReactNode
  /** Show drag indicator for mobile bottom sheet (default true) */
  showDragIndicator?: boolean
  /** Sticky footer slot, rendered at bottom with top border + bg */
  footer?: ReactNode
  /** Width on desktop: sm ~380 / md ~460 / lg ~560 (default md) */
  size?: DialogSize
  /** Allow dismissing on backdrop click (default true) */
  dismissOnBackdrop?: boolean
  /** 可选描述文案 id（用于 aria-describedby） */
  description?: string
}

const sizeMap: Record<DialogSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

export function Dialog({
  open,
  onClose,
  title,
  icon,
  accentColor,
  children,
  showDragIndicator = true,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
  description,
}: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ backgroundColor: 'var(--mask-dark)' }}
        />

        {/* Content wrapper for positioning (bottom on mobile / center on desktop) */}
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <DialogPrimitive.Content
            data-dialog-container
            className={cn(
              'relative w-full flex flex-col pointer-events-auto',
              'max-h-[90vh]',
              // Mobile: bottom sheet
              'animate-slide-up rounded-t-[20px] rounded-b-none',
              // Desktop: centered, fully rounded, scale animation
              'sm:animate-scale-in sm:rounded-[20px] sm:mx-4',
              sizeMap[size],
            )}
            style={{ backgroundColor: 'var(--bg-card)' }}
            aria-describedby={description ? 'dialog-description' : undefined}
            onOpenAutoFocus={(e) => {
              // 默认 radix 会把 focus 放到第一个 focusable；交给 autofocus 行为即可
              // 如有表单则会自动 focus 第一个输入框
              void e
            }}
            onPointerDownOutside={(e) => {
              if (!dismissOnBackdrop) e.preventDefault()
            }}
            onInteractOutside={(e) => {
              if (!dismissOnBackdrop) e.preventDefault()
            }}
          >
            {/* Mobile drag indicator */}
            {showDragIndicator && (
              <div className="flex justify-center pt-3 pb-1.5 sm:hidden shrink-0">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border)' }}
                  aria-hidden
                />
              </div>
            )}

            {/* Header */}
            <div data-dialog-header className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {icon && (
                  <div
                    className="icon-circle icon-circle--sm shrink-0"
                    style={{
                      backgroundColor: accentColor
                        ? `color-mix(in srgb, ${accentColor} 15%, transparent)`
                        : 'var(--bg-elevated)',
                    }}
                    aria-hidden
                  >
                    <span style={{ color: accentColor || 'var(--text-primary)' }}>{icon}</span>
                  </div>
                )}
                <DialogPrimitive.Title asChild>
                  <h2 className="heading-md text-[var(--text-primary)] truncate">{title}</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="关闭"
                  className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogPrimitive.Close>
            </div>

            {/* Body (scrollable) */}
            <div data-dialog-body className="px-6 pb-5 pt-2 overflow-y-auto flex-1">
              {description && (
                <DialogPrimitive.Description
                  id="dialog-description"
                  className="sr-only"
                >
                  {description}
                </DialogPrimitive.Description>
              )}
              {children}
            </div>

            {/* Sticky footer */}
            {footer && (
              <div
                data-dialog-footer
                className="px-6 py-4 shrink-0"
                style={{
                  borderTop: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Standard double-button footer: [cancel] [confirm], equal width.
 * Use inside <Dialog footer={<DialogFooter ... />}>.
 *
 * v5.1.0：内部迁移到 <Button> primitive，不再直接使用 globals.css 的 .btn-primary/.btn-secondary。
 */
interface DialogFooterProps {
  onCancel: () => void
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  /** Submitting indicator */
  loading?: boolean
  /** Disable confirm button */
  disabled?: boolean
  /** 'primary' (default) or 'danger' */
  variant?: 'primary' | 'danger'
  /** If confirm is inside a <form>, pass "submit" so the button triggers form submit */
  confirmType?: 'button' | 'submit'
  /** Optional form id to associate a submit button that lives outside the form element */
  confirmFormId?: string
}

import { Button } from '@/components/ui/button'

export function DialogFooter({
  onCancel,
  onConfirm,
  confirmText = '保存',
  cancelText = '取消',
  loading = false,
  disabled = false,
  variant = 'primary',
  confirmType = 'button',
  confirmFormId,
}: DialogFooterProps) {
  // 使用 grid 布局而非 flex：Button primitive 带有 `shrink-0`（防止图标按钮被压扁），
  // 若用 flex + `w-full` 会导致两个按钮各自坚持 100% 宽度并溢出容器。
  // grid grid-cols-2 保证每个按钮严格占据等宽格子。
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onCancel}
        disabled={loading}
        block
      >
        {cancelText}
      </Button>
      <Button
        type={confirmType}
        form={confirmFormId}
        onClick={onConfirm}
        disabled={disabled || loading}
        loading={loading}
        variant={variant === 'danger' ? 'danger' : 'primary'}
        block
      >
        {loading ? '处理中...' : confirmText}
      </Button>
    </div>
  )
}
