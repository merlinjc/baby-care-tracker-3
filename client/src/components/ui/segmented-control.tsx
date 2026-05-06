interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** Active state background color (defaults to var(--primary)) */
  accentColor?: string
  /** Toggle behavior: clicking active option clears (sets to '' via empty cb) */
  toggleable?: boolean
  /** Layout: 'flex' for equal-width tabs, 'wrap' for chip-style wrap */
  layout?: 'flex' | 'wrap'
}

/**
 * Segmented control for selecting one option from a small set.
 * Used for: feeding type, breast side, sleep type, diaper type, temp method, etc.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  accentColor = 'var(--primary)',
  toggleable = false,
  layout = 'flex',
}: SegmentedControlProps<T>) {
  const containerCls = layout === 'flex' ? 'flex gap-2' : 'flex gap-2 flex-wrap'

  return (
    <div className={containerCls}>
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (isActive && toggleable) {
                onChange('' as T)
              } else {
                onChange(opt.value)
              }
            }}
            className={`chip ${isActive ? 'chip--active' : 'chip--inactive'} ${
              layout === 'flex' ? 'flex-1 justify-center' : ''
            }`}
            style={isActive ? { backgroundColor: accentColor } : undefined}
            aria-pressed={isActive}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
