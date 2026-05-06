import { useState, useCallback } from 'react'

/**
 * useDialog - 弹窗开关 + 可选 payload（编辑模式所需的记录/数据）。
 *
 * 用法：
 *   const dlg = useDialog<CareRecord>()
 *   dlg.openDialog()                 // 创建模式
 *   dlg.openDialog(someRecord)       // 编辑模式，dlg.payload 将保存该记录
 *   <Dialog open={dlg.open} editRecord={dlg.payload} onClose={dlg.closeDialog} />
 *
 * 关闭时自动清空 payload，避免下次打开时残留。
 */
export function useDialog<T = unknown>() {
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<T | undefined>(undefined)

  const openDialog = useCallback((p?: T) => {
    setPayload(p)
    setOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setOpen(false)
    setPayload(undefined)
  }, [])

  const toggleDialog = useCallback(() => setOpen((prev) => !prev), [])

  return { open, openDialog, closeDialog, toggleDialog, payload }
}
