import type { Baby } from '@/types'
import { Baby as BabyIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BabyCardProps {
  baby: Baby
  isActive?: boolean
  onClick?: () => void
}

export function BabyCard({ baby, isActive, onClick }: BabyCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'card-base w-full flex items-center gap-3 text-left transition-all hover:shadow-card',
        isActive && 'ring-2 ring-[var(--color-primary)]'
      )}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--color-primary)' + '20' }}
      >
        {baby.avatar ? (
          <img src={baby.avatar} alt={baby.name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <BabyIcon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{baby.name}</p>
        <p className="text-xs text-[var(--color-text-hint)] mt-0.5">
          {baby.gender === 'male' ? '男' : '女'} · {new Date(baby.birthDate).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </button>
  )
}
