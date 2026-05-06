/**
 * ConfirmDialog - 全局确认弹窗
 *
 * 替代浏览器原生 window.confirm / alert，保持品牌一致性与暖夜模式支持。
 *
 * 使用：
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: '删除记录？', variant: 'danger' })
 *   if (!ok) return
 *
 * 在应用根部（App.tsx）挂载一次 <ConfirmHost />。
 */
import { create } from 'zustand'
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog, DialogFooter } from './dialog'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  /** Optional custom icon; when omitted and variant='danger', 默认展示警示图标 */
  icon?: ReactNode
}

interface ConfirmState extends ConfirmOptions {
  id: string
  resolve: (result: boolean) => void
}

interface ConfirmStore {
  current: ConfirmState | null
  show: (options: ConfirmOptions) => Promise<boolean>
  settle: (result: boolean) => void
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  current: null,
  show: (options) => {
    // 若已有未关闭的 confirm，先将其 resolve(false)
    const prev = get().current
    if (prev) prev.resolve(false)

    return new Promise<boolean>((resolve) => {
      const id = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      set({
        current: {
          id,
          resolve,
          ...options,
        },
      })
    })
  },
  settle: (result) => {
    const cur = get().current
    if (!cur) return
    cur.resolve(result)
    set({ current: null })
  },
}))

/**
 * Hook 返回一个 confirm 函数，调用返回 Promise<boolean>。
 * true = 用户确认，false = 用户取消 / 背景点击 / ESC / 被新的 confirm 取代。
 */
export function useConfirm() {
  return useConfirmStore.getState().show
}

/**
 * 全局挂载点。请在 App 根部渲染一次（紧邻 <Toaster /> 即可）。
 */
export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current)
  const settle = useConfirmStore((s) => s.settle)

  if (!current) return null

  const variant = current.variant ?? 'primary'
  const icon =
    current.icon ??
    (variant === 'danger' ? <AlertTriangle className="h-4 w-4" /> : undefined)
  const accentColor = variant === 'danger' ? 'var(--danger)' : 'var(--primary)'

  return (
    <Dialog
      key={current.id}
      open
      onClose={() => settle(false)}
      title={current.title}
      icon={icon}
      accentColor={accentColor}
      size="sm"
      showDragIndicator={false}
      footer={
        <DialogFooter
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
          confirmText={current.confirmText ?? '确认'}
          cancelText={current.cancelText ?? '取消'}
          variant={variant}
        />
      }
    >
      {current.description ? (
        typeof current.description === 'string' ? (
          <p className="body-md text-[var(--text-secondary)] leading-relaxed">
            {current.description}
          </p>
        ) : (
          current.description
        )
      ) : null}
    </Dialog>
  )
}
