import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

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
}

/**
 * Reusable bottom-sheet / centered dialog with:
 * - ESC key to close
 * - Focus trap within dialog
 * - Body scroll lock when open
 * - Drag indicator on mobile bottom sheet
 * - Click outside to close
 */
export function Dialog({
  open,
  onClose,
  title,
  icon,
  accentColor,
  children,
  showDragIndicator = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // ESC key + body scroll lock
  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)

    // Body scroll lock
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Auto-focus first focusable element
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = originalOverflow
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  // Focus trap: Tab cycling within dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return

    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="fixed inset-0 animate-fade-in"
        style={{ backgroundColor: 'var(--mask-dark)' }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        {/* Mobile drag indicator */}
        {showDragIndicator && (
          <div className="flex justify-center pt-2 pb-1 sm:hidden">
            <div
              className="w-10 h-1 rounded-full"
              style={{ backgroundColor: 'var(--border)' }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && (
              <div
                className="icon-circle icon-circle--sm shrink-0"
                style={{
                  backgroundColor: accentColor
                    ? `color-mix(in srgb, ${accentColor} 15%, transparent)`
                    : 'var(--bg-elevated)',
                }}
              >
                <span style={{ color: accentColor || 'var(--text-primary)' }}>{icon}</span>
              </div>
            )}
            <h2
              id="dialog-title"
              className="heading-md text-[var(--text-primary)] truncate"
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          [role="dialog"] > [class*="animate-slide-up"] {
            border-radius: var(--radius-xl) !important;
          }
        }
      `}</style>
    </div>
  )
}
