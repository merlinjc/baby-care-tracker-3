/**
 * Dialog v7 - iOS 风响应式弹窗（framer-motion 驱动）
 *
 * - 移动端 (< 640px)：底部 Sheet，spring 弹性上滑，带拖拽条
 * - 桌面端 (≥ 640px)：居中 Modal，spring scale+opacity 入场
 *
 * 保持 radix 底座（焦点陷阱 / ESC / aria / inert 背景 / Portal），
 * 但用 framer-motion 接管动画（替代 CSS keyframes）。
 *
 * 对外 API 100% 兼容旧 Dialog。
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { overlayFade, sheetMobile, sheetDesktop } from '@/lib/motion'

/** 简单响应式 hook：判断是否桌面端断点（sm: 640px） */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 640px)')
    const handler = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

type DialogSize = 'sm' | 'md' | 'lg'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  accentColor?: string
  children: ReactNode
  showDragIndicator?: boolean
  footer?: ReactNode
  size?: DialogSize
  dismissOnBackdrop?: boolean
  description?: string
  /** v6 兼容：glass 玻璃态（v7 默认不启用） */
  glass?: boolean
}

const sizeMap: Record<DialogSize, string> = {
  sm: 'sm:max-w-[380px]',
  md: 'sm:max-w-[460px]',
  lg: 'sm:max-w-[560px]',
}

/**
 * 用 useMediaQuery 识别 sm 断点以选用对应动画变体。
 * 这里用 CSS 断点 + duplicate variants 方案：
 *   移动端用 sheetMobile，桌面端用 sheetDesktop。
 * 通过 responsive transforms 避免 JS 判断。
 */
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
  glass,
}: DialogProps) {
  const isDesktop = useIsDesktop()
  const variants = isDesktop ? sheetDesktop : sheetMobile

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50"
                style={{ backgroundColor: 'var(--mask-dark)' }}
                variants={overlayFade}
                initial="initial"
                animate="animate"
                exit="exit"
              />
            </DialogPrimitive.Overlay>

            {/* 定位容器 */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
              <DialogPrimitive.Content
                asChild
                forceMount
                onPointerDownOutside={(e) => {
                  if (!dismissOnBackdrop) e.preventDefault()
                }}
                onInteractOutside={(e) => {
                  if (!dismissOnBackdrop) e.preventDefault()
                }}
              >
                <motion.div
                  data-dialog-container
                  className={cn(
                    'relative w-full flex flex-col pointer-events-auto max-h-[90vh]',
                    // Mobile: bottom sheet
                    'rounded-t-[20px] rounded-b-none',
                    // Desktop: centered fully rounded
                    'sm:rounded-[20px] sm:mx-4',
                    sizeMap[size],
                  )}
                  style={{
                    backgroundColor: glass ? 'var(--glass-bg)' : 'var(--surface-raised)',
                    ...(glass
                      ? {
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid var(--separator)',
                          boxShadow: 'var(--shadow-lg)',
                        }
                      : { boxShadow: 'var(--shadow-lg)' }),
                  }}
                  aria-describedby={description ? 'dialog-description' : undefined}
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* 移动端拖拽条 */}
                  {showDragIndicator && (
                    <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                      <div
                        className="w-10 h-1 rounded-full"
                        style={{ backgroundColor: 'var(--separator-opaque)' }}
                        aria-hidden
                      />
                    </div>
                  )}

                  {/* Header */}
                  <div
                    data-dialog-header
                    className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {icon && (
                        <div
                          className="icon-circle icon-circle--sm shrink-0"
                          style={{
                            backgroundColor: accentColor
                              ? `color-mix(in srgb, ${accentColor} 14%, transparent)`
                              : 'var(--surface-2)',
                          }}
                          aria-hidden
                        >
                          <span style={{ color: accentColor || 'var(--label)' }}>{icon}</span>
                        </div>
                      )}
                      <DialogPrimitive.Title asChild>
                        <h2 className="title-3 truncate">{title}</h2>
                      </DialogPrimitive.Title>
                    </div>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label="关闭"
                        className={cn(
                          'p-1.5 rounded-full shrink-0 pressable',
                          'text-[var(--label-tertiary)] hover:text-[var(--label)]',
                          'hover:bg-[var(--surface-2)]',
                          'transition-colors',
                        )}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </DialogPrimitive.Close>
                  </div>

                  {/* Body（可滚动） */}
                  <div
                    data-dialog-body
                    className="px-6 pb-5 pt-2 overflow-y-auto flex-1"
                  >
                    {description && (
                      <DialogPrimitive.Description id="dialog-description" className="sr-only">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                    {children}
                  </div>

                  {/* Footer */}
                  {footer && (
                    <div
                      data-dialog-footer
                      className="px-6 py-4 shrink-0 border-t border-[var(--separator)]"
                      style={{
                        backgroundColor: glass ? 'var(--glass-bg)' : 'var(--surface-raised)',
                        ...(glass
                          ? {
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                            }
                          : {}),
                      }}
                    >
                      {footer}
                    </div>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

/**
 * 标准双按钮 Footer：[取消] [确认]
 * v7 保持 API 一致；内部使用 Button v7（filled/destructive）。
 */
interface DialogFooterProps {
  onCancel: () => void
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'danger'
  confirmType?: 'button' | 'submit'
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
  return (
    <div className="grid grid-cols-2 gap-2.5">
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
        variant={variant === 'danger' ? 'destructive' : 'filled'}
        block
      >
        {loading ? '处理中...' : confirmText}
      </Button>
    </div>
  )
}
