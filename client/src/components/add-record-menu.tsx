/**
 * AddRecordMenu - 「添加记录」下拉菜单
 *
 * 配合记录页右上角 HeaderAction 使用，点击「添加」展开 5 种记录类型选择：
 * 喂养 / 睡眠 / 排便 / 体温 / 生长。
 *
 * 视觉与暖夜模式强相关，统一通过 CSS 变量；点击菜单项后回调 `onPick(type)`，
 * 由父组件打开对应的 Dialog。点击外部 / Esc 自动关闭。
 */
import { useEffect, useRef, useState } from 'react'
import { Plus, Baby, Moon, Droplets, Thermometer, Ruler, ChevronDown } from 'lucide-react'
import type { RecordType } from '@baby-care-tracker/shared'

interface MenuItem {
  type: RecordType
  label: string
  Icon: typeof Baby
  color: string
  desc: string
}

const ITEMS: MenuItem[] = [
  { type: 'feeding', label: '喂养', Icon: Baby, color: 'var(--feeding)', desc: '母乳 / 配方奶 / 辅食' },
  { type: 'sleep', label: '睡眠', Icon: Moon, color: 'var(--sleep)', desc: '夜间 / 午睡' },
  { type: 'diaper', label: '排便', Icon: Droplets, color: 'var(--diaper)', desc: '尿 / 便 / 性状' },
  { type: 'temperature', label: '体温', Icon: Thermometer, color: 'var(--temperature)', desc: '腋下 / 耳温等' },
  { type: 'growth', label: '生长', Icon: Ruler, color: 'var(--growth)', desc: '身高 / 体重 / 头围' },
]

export function AddRecordMenu({
  onPick,
  disabled,
}: {
  onPick: (type: RecordType) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 点击外部 + Esc 关闭
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="添加记录"
        className="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed h-8 px-3 text-xs text-white"
        style={{
          backgroundColor: 'var(--primary)',
          letterSpacing: 'var(--tracking-wide)',
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        添加
        <ChevronDown
          className="h-3 w-3 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-30 min-w-[210px] rounded-xl shadow-lg animate-fade-in overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
          }}
        >
          {ITEMS.map((item) => {
            const Icon = item.Icon
            return (
              <button
                key={item.type}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  onPick(item.type)
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div
                  className="icon-circle icon-circle--sm shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${item.color} 14%, transparent)` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="body-md font-medium text-[var(--text-primary)] leading-tight">
                    {item.label}
                  </div>
                  <div className="caption mt-0.5 truncate">{item.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
