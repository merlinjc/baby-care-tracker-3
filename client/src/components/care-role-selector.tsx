/**
 * CareRoleSelector - "我的身份"网格选择器
 *
 * 用于创建家庭 / 加入家庭表单中，让用户一次性选定 CareRole（8 档）。
 * 选定后该值会作为 FamilyMember.relation 写入后端，供首页 AI 每日洞察
 * 直接读取；无需再靠中文关键字猜测（见 lib/care-role#relationToCareRole）。
 *
 * 视觉：3 列 chip 网格，选中项用 primary 高亮边框 + 浅色底。
 */
import type { CareRole } from '@baby-care-tracker/shared'
import { CARE_ROLE_OPTIONS } from '@/lib/care-role'
import { cn } from '@/lib/utils'

interface CareRoleSelectorProps {
  value: CareRole | null
  onChange: (next: CareRole) => void
  /** 选项是否紧凑（默认 true，创建/加入家庭表单用） */
  compact?: boolean
  className?: string
}

export function CareRoleSelector({
  value,
  onChange,
  compact = true,
  className,
}: CareRoleSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="我的身份"
      className={cn(
        'grid grid-cols-3 gap-2',
        compact ? 'sm:grid-cols-4' : 'sm:grid-cols-4',
        className,
      )}
    >
      {CARE_ROLE_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
              compact ? 'py-2 px-2' : 'py-3 px-2',
            )}
            style={{
              backgroundColor: active
                ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                : 'var(--bg-elevated, transparent)',
              borderColor: active
                ? 'var(--primary)'
                : 'var(--border, color-mix(in srgb, var(--text-hint) 25%, transparent))',
              color: active ? 'var(--primary)' : 'var(--text-primary)',
            }}
          >
            <span aria-hidden className="text-lg leading-none">
              {opt.emoji}
            </span>
            <span
              className="font-medium"
              style={{ fontSize: 'var(--text-xs)', lineHeight: 1.2 }}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
