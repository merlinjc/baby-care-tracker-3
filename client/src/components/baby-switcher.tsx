/**
 * BabySwitcher - 多宝快速切换头像组（FR-A2）
 *
 * v5.0.1 Batch 3：
 * - 头像迁移到 <BabyAvatar>（带 gender 配色 + name fallback + bordered）
 * - 每个头像外包 <Tooltip> 显示宝宝名
 *
 * v7.2 T-S1-F6-02：
 * - selectBaby + 手工 invalidate 切到 useActiveBaby().switchBaby，
 *   切换同时同步 URL `?babyId=`，分享链接对方可见同一胎；
 * - 仅替换调用入口，视觉与交互完全一致。
 *
 * 设计要点保持不变：
 * - babies.length <= 1 时不渲染
 * - 显示前 3 个其他宝宝头像（重叠 -8px）+ 「+N」灰色圆补尾
 */
import { useActiveBaby } from '@/hooks/use-active-baby'
import { cn } from '@/lib/utils'
import { BabyAvatar, type AvatarSize } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MAX_AVATAR = 3

export function BabySwitcher({ size = 'md' as AvatarSize }: { size?: AvatarSize } = {}) {
  const { babies, currentBaby, switchBaby } = useActiveBaby()

  if (babies.length <= 1) return null

  const others = babies.filter((b) => b.id !== currentBaby?.id)
  const visible = others.slice(0, MAX_AVATAR)
  const more = others.length - visible.length

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((b) => (
        <Tooltip key={b.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => switchBaby(b.id)}
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
