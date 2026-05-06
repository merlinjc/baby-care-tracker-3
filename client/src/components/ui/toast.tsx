/**
 * 极简 Toast 实现（FR-C/D 通用）
 *
 * 不引入 sonner / radix-ui，使用 Zustand + Portal 自实现：
 * - toast.success(message) / toast.error(message) / toast.info(message)
 * - 默认 3s 自动消失
 * - 全局唯一 <Toaster /> 挂载点（在 App 顶层）
 */
import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration: number
}

interface ToastStore {
  toasts: ToastItem[]
  push: (variant: ToastVariant, message: string, duration?: number) => string
  dismiss: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (variant, message, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((s) => ({ toasts: [...s.toasts, { id, variant, message, duration }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().push('success', message, duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().push('error', message, duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().push('info', message, duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().push('warning', message, duration),
}

const variantStyles: Record<ToastVariant, { bg: string; color: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'var(--success)', color: '#ffffff', Icon: CheckCircle2 },
  error: { bg: 'var(--danger)', color: '#ffffff', Icon: AlertCircle },
  info: { bg: 'var(--info)', color: '#ffffff', Icon: Info },
  warning: { bg: 'var(--warning)', color: '#ffffff', Icon: AlertCircle },
}

function ToastItemView({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const { Icon, bg, color } = variantStyles[item.variant]

  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.duration)
    return () => clearTimeout(t)
  }, [item.id, item.duration, dismiss])

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2.5 shadow-lg max-w-sm',
        'animate-fade-in-up'
      )}
      style={{ backgroundColor: bg, color }}
      role="alert"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="body-md flex-1 break-words">{item.message}</span>
      <button
        onClick={() => dismiss(item.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition"
        aria-label="关闭"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: '92vw' }}
    >
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItemView item={item} />
        </div>
      ))}
    </div>
  )
}
