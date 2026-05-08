import type { Baby } from '@/types'
import { Card } from '@/components/ui/card'
import { BabyAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BabyCardProps {
  baby: Baby
  isActive?: boolean
  onClick?: () => void
}

/**
 * BabyCard - 宝宝信息卡
 *
 * v5.0.1 Batch 3：使用 <Card variant="interactive"> + <BabyAvatar> + <Badge>。
 * 旧版用 ring-2 做选中态；新版用 border-[var(--primary)] + bg-elevated，与 Card interactive 统一。
 */
export function BabyCard({ baby, isActive, onClick }: BabyCardProps) {
  return (
    <Card
      as="article"
      variant="interactive"
      padding="md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'w-full flex items-center gap-3 text-left',
        isActive &&
          'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--bg-card))]',
      )}
      aria-pressed={isActive}
    >
      <BabyAvatar baby={baby} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="body-md font-medium text-[var(--text-primary)] truncate">
            {baby.name}
          </p>
          {isActive && (
            <Badge size="xs" variant="primary">
              当前
            </Badge>
          )}
        </div>
        <p className="caption mt-0.5">
          {baby.gender === 'male' ? '男' : '女'} ·{' '}
          {new Date(baby.birthDate).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </Card>
  )
}
