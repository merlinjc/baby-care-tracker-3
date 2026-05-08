/**
 * LargeTitleHeader v7 - iOS Large Title 风页面头（新增原子）
 *
 * 布局：
 *   [back?]  [right actions]
 *   大标题 Large Title（34px / bold）
 *   [subtitle（可选）]
 *
 * 滚动时 Large Title 会自动"缩回"成 Navigation Bar 小标题（可选交互）。
 *
 * 用法：
 *   <LargeTitleHeader
 *     title="早上好，妈妈"
 *     subtitle="小宝 · 3个月18天"
 *     rightAction={<BabySwitcher />}
 *   />
 *
 *   // 带返回
 *   <LargeTitleHeader backTo="/discover" title="疫苗计划" />
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export interface LargeTitleHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  subtitle?: ReactNode
  /** 返回链接；传 'back' 使用 history.back() */
  backTo?: string | 'back'
  backLabel?: string
  /** 右上角操作区 */
  rightAction?: ReactNode
  /** variant:
   *  - 'large'（默认）：大标题形态
   *  - 'nav'：常规 Navigation Bar（小标题居中）
   */
  variant?: 'large' | 'nav'
  /** 对齐（nav 形态有效） */
  align?: 'left' | 'center'
}

export const LargeTitleHeader = forwardRef<HTMLElement, LargeTitleHeaderProps>(
  (
    {
      className,
      title,
      subtitle,
      backTo,
      backLabel,
      rightAction,
      variant = 'large',
      align = 'left',
      ...props
    },
    ref,
  ) => {
    const navigate = useNavigate()

    const BackButton = backTo ? (
      <motion.button
        type="button"
        onClick={
          backTo === 'back'
            ? () => navigate(-1)
            : () => navigate(backTo)
        }
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          'inline-flex items-center gap-0.5 -ml-1.5 pressable',
          'text-[var(--brand-ink)] hover:text-[var(--label)]',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
          'rounded-md px-1.5 py-0.5',
        )}
        aria-label={backLabel ?? '返回'}
      >
        <ChevronLeft className="h-5 w-5" />
        {backLabel && <span className="text-[15px]">{backLabel}</span>}
      </motion.button>
    ) : null

    if (variant === 'nav') {
      return (
        <header
          ref={ref}
          className={cn('flex items-center justify-between gap-3 min-h-11', className)}
          {...props}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">{BackButton}</div>
          <h1
            className={cn(
              'headline truncate',
              align === 'center' ? 'absolute left-1/2 -translate-x-1/2' : '',
            )}
            style={align === 'center' ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } : undefined}
          >
            {title}
          </h1>
          {rightAction && <div className="shrink-0 flex items-center gap-1">{rightAction}</div>}
        </header>
      )
    }

    // Large title
    return (
      <header
        ref={ref}
        data-large-title-header
        className={cn('flex flex-col gap-1', className)}
        {...props}
      >
        {/* 顶部操作行 */}
        {(BackButton || rightAction) && (
          <div className="flex items-center justify-between min-h-[28px]" data-large-title-actions>
            <div>{BackButton}</div>
            {rightAction && <div className="shrink-0 flex items-center gap-2">{rightAction}</div>}
          </div>
        )}

        {/* Large Title */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col gap-0.5"
          data-large-title-body
        >
          <h1 className="large-title text-[var(--label)]">{title}</h1>
          {subtitle && (
            <p className="subheadline text-[var(--label-secondary)]">{subtitle}</p>
          )}
        </motion.div>
      </header>
    )
  },
)
LargeTitleHeader.displayName = 'LargeTitleHeader'

/**
 * NavLink — 用于 LargeTitleHeader 的 rightAction slot 中常见的
 * "文字+箭头"iOS 风 Tappable Link（避免每次手写）。
 */
export function HeaderLink({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'text-[15px] font-medium text-[var(--brand-ink)]',
        'hover:opacity-70 active:opacity-50 transition-opacity',
      )}
    >
      {children}
    </Link>
  )
}
