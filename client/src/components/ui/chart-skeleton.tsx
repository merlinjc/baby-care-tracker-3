/**
 * ChartSkeleton - 图表区域骨架
 *
 * 用于生长曲线、本周趋势等"图形 + 数据表格"复合视图的首次加载占位。
 * 形状：标题占位 + 图表区占位（高度 200px）+ 下方 2 行数据条目占位。
 */
import { Skeleton } from './skeleton'
import { Card } from './card'

interface ChartSkeletonProps {
  /** 图表区高度（px），默认 200 */
  chartHeight?: number
  /** 下方数据行数量，默认 4 */
  rows?: number
}

export function ChartSkeleton({ chartHeight = 200, rows = 4 }: ChartSkeletonProps) {
  return (
    <Card
      padding="md"
      className="space-y-3"
      aria-busy="true"
      aria-label="加载中"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-full rounded-lg" style={{ height: chartHeight }} />
      <div className="space-y-2 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-[var(--border-light)] last:border-0 py-1.5"
          >
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </Card>
  )
}
