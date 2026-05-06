/**
 * useLocalStorageState - localStorage 持久化的 React state hook（FR-A4）
 *
 * 用于纯 UI 偏好（如 AI 洞察折叠态、彩蛋去重 key）。
 * 不依赖云端，跨页面刷新保留。多 tab 间通过 storage 事件同步。
 */
import { useCallback, useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  })

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(v))
        } catch {
          /* storage full / disabled, ignore */
        }
        return v
      })
    },
    [key],
  )

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return
      try {
        setValue(JSON.parse(e.newValue) as T)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [key])

  return [value, setStoredValue]
}
