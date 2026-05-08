/**
 * SectionHeader v7 - iOS 分组标题（新增原子）
 *
 * 样式：
 * - 主标题：小写大写金字塔字体 + tracking-wide + label-secondary
 * - 可选右侧 action（链接 / 按钮）
 *
 * 用法：
 *   <SectionHeader title="今日概览" action={<Link to="/record">全部</Link>} />
 *   <SectionHeader title="AI 洞察" variant="prominent" />
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  /** 次标题（小字，灰色） */
  subtitle?: ReactNode
  /** 右侧操作（链接 / 按钮 / icon） */
  action?: ReactNode
  /**
   * variant:
   * - 'default'（默认）：caption-2 风（小字大写 tracking-wide）
   * - 'prominent'：headline 风（17px 加粗，iOS Settings 风 Group Header）
   * - 'grouped'：iOS Grouped Settings 风（插入组之间）
   */
  variant?: 'default' | 'prominent' | 'grouped'
}

export const SectionHeader = forwardRef<HTMLElement, SectionHeaderProps>(
  ({ className, title, subtitle, action, variant = 'default', ...props }, ref) => {
    return (
      <header
        ref={ref}
        data-section-header
        data-section-variant={variant}
        className={cn(
          'flex items-baseline justify-between gap-3',
          variant === 'default' && 'mb-2',
          variant === 'prominent' && 'mb-3',
          variant === 'grouped' && 'mb-2',
          className,
        )}
        {...props}
      >
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          {variant === 'default' && (
            <h2 className="text-[13px] font-semibold text-[var(--label-secondary)] truncate">
              {title}
            </h2>
          )}
          {variant === 'prominent' && (
            <h2 className="text-[17px] font-semibold text-[var(--label)] truncate">
              {title}
            </h2>
          )}
          {variant === 'grouped' && (
            <h2 className="text-[13px] font-semibold text-[var(--label-tertiary)] truncate">
              {title}
            </h2>
          )}
          {subtitle && (
            <span className="text-[12px] text-[var(--label-tertiary)] truncate">
              {subtitle}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    )
  },
)
SectionHeader.displayName = 'SectionHeader'
