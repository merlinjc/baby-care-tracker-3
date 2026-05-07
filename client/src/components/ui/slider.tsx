/**
 * Slider - 滑块
 *
 * 基于 @radix-ui/react-slider。对标 shadcn/ui，扩展 accentColor 与 showLabels。
 *
 * 键盘 A11y（radix 内置）：← → / Page↑↓ / Home / End。
 *
 * 用法示例（TemperatureDialog 内）：
 *   <Slider
 *     min={35} max={42} step={0.1}
 *     value={[temp]}
 *     onValueChange={([v]) => setTemperature(String(v))}
 *     accentColor={feverLevel === 'high' ? 'var(--danger)' : 'var(--temperature)'}
 *     showLabels={{ left: '35.0', center: '正常 36-37.2', right: '42.0' }}
 *   />
 */
import * as SliderPrimitive from '@radix-ui/react-slider'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    'className'
  > {
  className?: string
  /** 强调色（track filled + thumb border） */
  accentColor?: string
  /** 底部三段刻度标签（可选） */
  showLabels?: {
    left?: ReactNode
    center?: ReactNode
    right?: ReactNode
  }
}

export const Slider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, accentColor = 'var(--primary)', showLabels, style, ...props }, ref) => {
  const rootStyle = {
    ...style,
    // 通过 CSS 变量传递，避免给 Track / Thumb 再手动 inline style
    ['--slider-accent' as string]: accentColor,
  } as React.CSSProperties

  return (
    <div className="w-full">
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          'h-5',
          className,
        )}
        style={rootStyle}
        {...props}
      >
        <SliderPrimitive.Track
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--bg-elevated)]"
        >
          <SliderPrimitive.Range
            className="absolute h-full rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            'block h-4 w-4 rounded-full bg-white shadow-sm',
            'border-2 transition-[border-color,box-shadow]',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--slider-accent)_25%,transparent)]',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
          style={{ borderColor: accentColor }}
          aria-label="滑块"
        />
      </SliderPrimitive.Root>
      {showLabels && (
        <div className="mt-2 flex justify-between text-xs text-[var(--text-hint)] tabular-nums">
          <span>{showLabels.left}</span>
          {showLabels.center && <span>{showLabels.center}</span>}
          <span>{showLabels.right}</span>
        </div>
      )}
    </div>
  )
})
Slider.displayName = 'Slider'
