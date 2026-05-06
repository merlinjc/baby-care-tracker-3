import { useState, useCallback } from 'react'

export function useDialog() {
  const [open, setOpen] = useState(false)

  const openDialog = useCallback(() => setOpen(true), [])
  const closeDialog = useCallback(() => setOpen(false), [])
  const toggleDialog = useCallback(() => setOpen((prev) => !prev), [])

  return { open, openDialog, closeDialog, toggleDialog }
}
