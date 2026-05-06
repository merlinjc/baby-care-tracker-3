/**
 * BabySwitcher - 多宝快速切换头像组（FR-A2）
 *
 * 设计要点：
 * - babies.length <= 1 时不渲染
 * - 显示前 3 个其他宝宝头像（重叠 -8px）+ 「+N」灰色圆补尾
 * - 点击头像调 selectBaby（baby-store 已实现）
 * - React Query 自动通过 key 中的 babyId 触发对应数据 invalidate（HomePage 已挂 useQuery）
 */
import { useQueryClient } from '@tanstack/react-query'
import { useBabyStore } from '@/stores/baby-store'
import { cn } from '@/lib/utils'
import type { Baby } from '@/types'

const MAX_AVATAR = 3

function BabyAvatar({ baby, size = 40 }: { baby: Baby; size?: number }) {
  const colorByGender = baby.gender === 'female' ? 'var(--temperature)' : 'var(--growth)'
  return baby.avatar ? (
    <img
      src={baby.avatar}
      alt={baby.name}
      className="rounded-full object-cover"
      style={{ width: size, height: size, border: '2px solid var(--bg-card)' }}
      loading="lazy"
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: colorByGender,
        border: '2px solid var(--bg-card)',
        fontSize: size * 0.4,
      }}
      aria-label={baby.name}
    >
      {baby.name.charAt(0)}
    </div>
  )
}

export function BabySwitcher({ size = 40 }: { size?: number }) {
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
        <button
          key={b.id}
          type="button"
          onClick={() => handleClick(b)}
          className={cn(
            'transition-transform hover:scale-110 hover:z-10 focus-visible:z-10',
          )}
          title={`切换到 ${b.name}`}
        >
          <BabyAvatar baby={b} size={size} />
        </button>
      ))}
      {more > 0 && (
        <span
          className="rounded-full flex items-center justify-center font-semibold"
          style={{
            width: size,
            height: size,
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            border: '2px solid var(--bg-card)',
            fontSize: size * 0.32,
          }}
          aria-label={`还有 ${more} 个宝宝`}
        >
          +{more}
        </span>
      )}
    </div>
  )
}
