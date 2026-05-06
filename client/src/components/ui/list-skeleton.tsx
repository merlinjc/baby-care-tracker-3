/**
 * ListSkeleton - 列表型卡片骨架
 *
 * 用于"首次加载"列表场景（记录页 / 疫苗页 / 里程碑页 / 宝宝列表 / 家庭成员等）。
 * 形状：左侧圆形图标占位 + 中间两行文字占位 + 右侧操作按钮占位（可选）。
 *
 * 与 spinner 的分工：
 * - 首次/全量加载 → ListSkeleton（模拟最终 DOM 形状）
 * - 分页加载 / 局部刷新 → spinner
 */
import { Skeleton } from './skeleton'

interface ListSkeletonProps {
  /** 占位条数量，默认 5 */
  count?: number
  /** 是否显示右侧操作占位（pencil/trash 按钮区域），默认 true */
  showActions?: boolean
  /** 单条卡片是否使用左侧色条样式（card-base + borderLeft） */
  withAccent?: boolean
}

export function ListSkeleton({
  count = 5,
  showActions = true,
  withAccent = true,
}: ListSkeletonProps) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="加载中">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-base flex items-center gap-3"
          style={
            withAccent
              ? { borderLeft: '3px solid var(--border)' }
              : undefined
          }
        >
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-3/5" />
          </div>
          {showActions && (
            <div className="flex items-center gap-1 shrink-0">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
