/**
 * BabySwitcher - 多宝快速切换头像组（FR-A2）
 *
 * v5.0.1 Batch 3：
 * - 头像迁移到 <BabyAvatar>（带 gender 配色 + name fallback + bordered）
 * - 每个头像外包 <Tooltip> 显示宝宝名
 *
 * 设计要点保持不变：
 * - babies.length <= 1 时不渲染
 * - 显示前 3 个其他宝宝头像（重叠 -8px）+ 「+N」灰色圆补尾
 * - 点击头像调 selectBaby（baby-store 已实现）
 * - React Query 自动通过 key 中的 babyId 触发对应数据 invalidate
 */
import { useQueryClient } from '@tanstack/react-query'
import { useBabyStore } from '@/stores/baby-store'
import { cn } from '@/lib/utils'
import { BabyAvatar, type AvatarSize } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Baby } from '@/types'

const MAX_AVATAR = 3

export function BabySwitcher({ size = 'md' as AvatarSize }: { size?: AvatarSize } = {}) {
  const babies = useBabyStore((s) => s.babies)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const selectBaby = useBabyStore((s) => s.selectBaby)
  const queryClient = useQueryClient()

  if (babies.length <= 1) return null

  const others = babies.filter((b) => b.id !== currentBaby?.id)
  const visible = others.slice(0, MAX_AVATAR)
  const more = others.length - visible.length

  const handleClick = (baby: Baby) => {
    selectBaby(baby.id)
    // 触发对应 baby 的 React Query 数据刷新
    queryClient.invalidateQueries({ queryKey: ['todayStats', baby.id] })
    queryClient.invalidateQueries({ queryKey: ['records', baby.id] })
    queryClient.invalidateQueries({ queryKey: ['activeSleep', baby.id] })
  }

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((b) => (
        <Tooltip key={b.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleClick(b)}
              className={cn(
                'transition-transform hover:scale-110 hover:z-10 focus-visible:z-10',
                'focus-visible:outline-none rounded-full',
              )}
              aria-label={`切换到 ${b.name}`}
            >
              <BabyAvatar baby={b} size={size} bordered />
            </button>
          </TooltipTrigger>
          <TooltipContent>切换到 {b.name}</TooltipContent>
        </Tooltip>
      ))}
      {more > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'rounded-full flex items-center justify-center font-semibold',
                'ring-2 ring-[var(--bg-card)]',
                size === 'xs' && 'h-6 w-6 text-[9px]',
                size === 'sm' && 'h-8 w-8 text-[11px]',
                size === 'md' && 'h-10 w-10 text-xs',
                size === 'lg' && 'h-12 w-12 text-sm',
                size === 'xl' && 'h-16 w-16 text-base',
              )}
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
              }}
              aria-label={`还有 ${more} 个宝宝`}
            >
              +{more}
            </span>
          </TooltipTrigger>
          <TooltipContent>还有 {more} 个宝宝</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
