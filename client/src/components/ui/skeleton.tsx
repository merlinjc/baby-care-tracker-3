/**
 * Skeleton 占位组件（FR-A5）
 * 复用 globals.css 的 `animate-shimmer` 动画
 */
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind 类名扩展 */
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-shimmer rounded-md', className)}
      style={{ minHeight: '1rem' }}
      aria-hidden="true"
      {...props}
    />
  )
}
