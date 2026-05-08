import { useEffect, useState, useRef } from 'react'

interface NumberRollProps {
  /** 目标数值 */
  value: number
  /** 动画时长（ms），默认 400 */
  duration?: number
  /** 额外 className */
  className?: string
}

/**
 * NumberRoll - 数字滚动入场动画
 * 使用 requestAnimationFrame + easeOutCubic 实现平滑的数字递增效果
 */
export function NumberRoll({ value, duration = 400, className }: NumberRollProps) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startTime = Date.now()
    const startValue = display

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startValue + (value - startValue) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={className}>{display}</span>
}
