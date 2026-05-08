/**
 * ListRow v7 - iOS 风列表项（新增原子）
 *
 * 布局：[leading] [title + subtitle] [value] [trailing/chevron]
 *
 * 用法：
 *   <ListRow
 *     leading={<FeedingIcon />}
 *     title="配方奶"
 *     subtitle="120 ml"
 *     value="09:30"
 *     interactive
 *     onClick={...}
 *   />
 *
 * 与 Card 搭配：
 *   <Card padding="none">
 *     <div className="ios-list">
 *       <ListRow ... />
 *       <ListRow ... />
 *     </div>
 *   </Card>
 *
 * 支持 `accentColor` —— 左侧 3px 色条（记录类型色）。
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ListRowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 左侧图标/头像（通常 32×32 icon circle） */
  leading?: ReactNode
  /** 主标题 */
  title: ReactNode
  /** 副标题（灰字小号） */
  subtitle?: ReactNode
  /** 右值（灰字，数字优先） */
  value?: ReactNode
  /** 右侧 trailing 元素（chevron/操作按钮等） */
  trailing?: ReactNode
  /** 可点击（加 hover + pressable） */
  interactive?: boolean
  /** 左侧色条（记录类型色等） */
  accentColor?: string
  /** 紧凑模式（更小 padding / 更小字号） */
  compact?: boolean
  /** 自定义 padding（覆盖默认） */
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddingMap = {
  none: '',
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-5 py-4',
}

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(
  (
    {
      className,
      leading,
      title,
      subtitle,
      value,
      trailing,
      interactive,
      accentColor,
      compact,
      padding = 'md',
      onClick,
      role,
      tabIndex,
      style,
      ...props
    },
    ref,
  ) => {
    const baseClass = cn(
      'relative flex items-center gap-3 w-full',
      paddingMap[padding],
      interactive && [
        'cursor-pointer select-none',
        'transition-colors duration-150',
        'hover:bg-[var(--surface-hover)]',
        'focus-visible:outline-none focus-visible:bg-[var(--surface-hover)]',
      ],
      className,
    )

    const content = (
      <>
        {/* 左侧色条 */}
        {accentColor && (
          <span
            aria-hidden
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        )}

        {leading && <div className="shrink-0">{leading}</div>}

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className={cn(
            'truncate',
            compact ? 'text-[14px] font-medium' : 'text-[15px] font-medium',
            'text-[var(--label)]',
          )}>
            {title}
          </div>
          {subtitle && (
            <div className={cn(
              'truncate',
              compact ? 'text-[12px]' : 'text-[13px]',
              'text-[var(--label-secondary)]',
            )}>
              {subtitle}
            </div>
          )}
        </div>

        {value && (
          <div className={cn(
            'shrink-0 text-[var(--label-secondary)] number-display',
            compact ? 'text-[13px]' : 'text-[14px]',
          )}>
            {value}
          </div>
        )}

        {trailing && <div className="shrink-0 flex items-center">{trailing}</div>}
      </>
    )

    if (interactive) {
      return (
        <motion.div
          ref={ref}
          className={baseClass}
          style={style}
          role={role ?? 'button'}
          tabIndex={tabIndex ?? 0}
          onClick={onClick}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.1, ease: [0.32, 0.72, 0, 1] }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
            }
            props.onKeyDown?.(e)
          }}
          {...(props as Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onDragStart' | 'onDrag' | 'onDragEnd'>)}
        >
          {content}
        </motion.div>
      )
    }

    return (
      <div ref={ref} className={baseClass} style={style} {...props}>
        {content}
      </div>
    )
  },
)
ListRow.displayName = 'ListRow'
