/**
 * AddRecordMenu - 「添加记录」下拉菜单
 *
 * v5.0.1 Batch 2：重写为基于 <DropdownMenu> (radix) 驱动。
 *
 * 配合记录页右上角使用，点击触发按钮展开 5 种记录类型选择：
 * 喂养 / 睡眠 / 排便 / 体温 / 生长。
 *
 * 由 radix 提供：点击外部/Esc 关闭、focus trap、return-focus、aria-haspopup="menu"、
 * 键盘 ↑↓/Enter 导航、Portal 渲染避开 z-index。
 */
import { Plus, Baby, Moon, Droplets, Thermometer, Ruler, ChevronDown } from 'lucide-react'
import type { RecordType } from '@baby-care-tracker/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemText,
} from '@/components/ui/dropdown-menu'

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="primary"
          size="sm"
          disabled={disabled}
          aria-label="添加记录"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          rightIcon={<ChevronDown className="h-3 w-3" />}
          data-onboarding-target="add-record-fab"
        >
          添加
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[220px]">
        {ITEMS.map((item) => {
          const Icon = item.Icon
          return (
            <DropdownMenuItem key={item.type} onSelect={() => onPick(item.type)}>
              <DropdownMenuItemIcon accentColor={item.color}>
                <Icon className="h-3.5 w-3.5" />
              </DropdownMenuItemIcon>
              <DropdownMenuItemText title={item.label} description={item.desc} />
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
