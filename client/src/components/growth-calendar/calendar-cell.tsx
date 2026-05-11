/**
 * CalendarCell - 日历单元格（v7.2 T-S2-F11-FE-03）
 *
 * 四态：
 *   1) future：未来日期 — 灰显数字 + 不可点
 *   2) supplement：过去未打卡 + 在 7d 窗口内 — hover 显 + 号 + 可点击触发打卡
 *   3) expired：过去未打卡 + 超 7d 窗口 — 灰显 + title 提示
 *   4) checked：已打卡 — 圆角照片背景 + 白色数字角标 + hover 显 AI 小记首行
 *
 * 可访问性：
 *   - 全用 button（即使不可交互）以保证 Tab 可达 + screen reader 阅读完整状态文本
 *   - aria-label 包含日期 + 状态 + 简要内容（已打卡时附 AI 小记首行片段）
 */
import type { MouseEventHandler, KeyboardEventHandler } from 'react'
import { Plus } from 'lucide-react'
import { buildImageUrl } from '@/lib/image-url'
import { cn } from '@/lib/utils'
import type { DailyCheckin } from '@/types'

export type CalendarCellState = 'future' | 'supplement' | 'expired' | 'checked' | 'out-of-month'

export interface CalendarCellProps {
  /** YYYY-MM-DD */
  ymd: string
  /** 显示的"日数字"（1-31） */
  day: number
  /** 是否属于当前显示月（false 则灰显且不交互） */
  inCurrentMonth: boolean
  state: CalendarCellState
  /** 已打卡时传入对应的 checkin，用于显缩略图 + AI 小记 */
  checkin?: DailyCheckin
  /** 点击后的回调（已打卡 → 打开详情；可补打卡 → 触发上传） */
  onClick?: () => void
  /** 提示文本（鼠标悬浮 / 屏幕阅读器） */
  tooltip?: string
}

export function CalendarCell({
  ymd,
  day,
  inCurrentMonth,
  state,
  checkin,
  onClick,
  tooltip,
}: CalendarCellProps) {
  const interactive = state === 'checked' || state === 'supplement'

  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    if (!interactive) return
    e.preventDefault()
    onClick?.()
  }

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  const ariaSummary = (() => {
    const dateText = ymd
    if (state === 'future') return `${dateText}（未来日期）`
    if (state === 'expired') return `${dateText}（超过 7 天，无法补打卡）`
    if (state === 'supplement') return `${dateText}（可补打卡）`
    if (state === 'checked') {
      const summary = checkin?.aiSummary ?? checkin?.caption ?? ''
      return `${dateText}（已打卡）${summary ? '：' + summary.slice(0, 40) : ''}`
    }
    return dateText
  })()

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={!interactive}
      aria-label={ariaSummary}
      title={tooltip}
      className={cn(
        'relative group',
        'aspect-square w-full overflow-hidden',
        'rounded-[var(--radius-md)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
        // 基础底色
        state === 'checked'
          ? 'bg-[var(--surface-2)]'
          : 'bg-[var(--surface-1)] hover:bg-[var(--surface-hover)]',
        // 未交互态降亮
        !interactive && 'cursor-default',
        // 当前月外的格子整体淡化
        !inCurrentMonth && 'opacity-40',
      )}
    >
      {/* 已打卡：照片背景 + 角标数字 */}
      {state === 'checked' && checkin && (
        <>
          <img
            src={buildImageUrl(checkin.photoKey)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <span
            className={cn(
              'absolute top-1 left-1',
              'inline-flex items-center justify-center',
              'min-w-[18px] h-[18px] px-1',
              'rounded-full',
              'bg-black/55 text-white',
              'text-[11px] font-medium tabular-nums',
              'pointer-events-none',
            )}
          >
            {day}
          </span>
          {/* hover 浮层：AI 小记首行 */}
          {checkin.aiSummary && (
            <span
              className={cn(
                'absolute inset-x-0 bottom-0 px-1.5 py-1',
                'bg-gradient-to-t from-black/70 to-transparent',
                'text-[10px] leading-tight text-white',
                'line-clamp-1 text-left',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'pointer-events-none',
              )}
            >
              {checkin.aiSummary}
            </span>
          )}
        </>
      )}

      {/* 非已打卡：数字 */}
      {state !== 'checked' && (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'text-[14px] font-medium tabular-nums',
            state === 'supplement' && 'text-[var(--label)]',
            state === 'future' && 'text-[var(--label-quaternary)]',
            state === 'expired' && 'text-[var(--label-quaternary)]',
          )}
        >
          {day}
        </span>
      )}

      {/* supplement hover：+ 号 */}
      {state === 'supplement' && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]',
          )}
        >
          <Plus className="h-4 w-4 text-[var(--brand-ink)]" strokeWidth={2.5} />
        </span>
      )}
    </button>
  )
}
