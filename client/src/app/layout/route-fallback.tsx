/**
 * RouteFallback — 路由切换时的统一占位骨架（F9 路由级代码分割）
 *
 * 设计要点：
 * - surface-0 背景与 MainLayout 一致，避免切换闪烁
 * - 占满 60vh 高度，避免布局抖动
 * - 200ms 延迟显示动画点阵，快速切换时几乎不可见，减少视觉噪音
 * - 包含 role/aria-live/aria-label，满足 a11y 可达性
 */
import { useEffect, useState } from 'react'

export function RouteFallback() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="正在加载"
      className="min-h-[60vh] flex items-center justify-center"
    >
      {visible && (
        <div className="flex gap-1.5" aria-hidden="true">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--brand)' }}
          />
          <span
            className="w-2 h-2 rounded-full animate-pulse [animation-delay:120ms]"
            style={{ backgroundColor: 'var(--brand)' }}
          />
          <span
            className="w-2 h-2 rounded-full animate-pulse [animation-delay:240ms]"
            style={{ backgroundColor: 'var(--brand)' }}
          />
        </div>
      )}
    </div>
  )
}
