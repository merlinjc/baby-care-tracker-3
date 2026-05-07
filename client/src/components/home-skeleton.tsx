/**
 * HomeSkeleton - 首页骨架屏（FR-A5）
 *
 * 5 个区块占位：问候栏 / 状态胶囊 / TodaySummary 4 列 / Timeline 3 条 / InsightSection
 * 使用 globals.css 的 .animate-shimmer 动画。
 */
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export function HomeSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 问候栏 */}
      <div className="space-y-2 pt-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* 状态胶囊 */}
      <Skeleton className="h-12 w-full" />

      {/* TodaySummary 4 列 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} padding="sm" className="flex flex-col gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-1 w-full" />
          </Card>
        ))}
      </div>

      {/* Timeline 3 条 */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Card className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* InsightSection 折叠态 */}
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
