/**
 * FontScaleSelector - 字体大小 4 档选择器
 *
 * 4 档：小 / 标准 / 大 / 特大（特大适合老年人）
 * 切换时立即应用 + 持久化到 localStorage（由 font-scale-store 管理）。
 *
 * v5.0.1 Batch 4：重构为基于 <RadioGroup> + <RadioGroupCard>（自定义 icon 为预览字 A）。
 * 每个卡片的 icon 槽位用不同字号的"A"直观体现倍率，保留原视觉。
 */
import {
  useFontScaleStore,
  FONT_SCALE_OPTIONS,
  type FontScale,
} from '@/stores/font-scale-store'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'

export function FontScaleSelector() {
  const scale = useFontScaleStore((s) => s.scale)
  const setScale = useFontScaleStore((s) => s.setScale)

  return (
    <div className="space-y-3">
      <RadioGroup
        value={scale}
        onValueChange={(v) => setScale(v as FontScale)}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 space-y-0"
      >
        {FONT_SCALE_OPTIONS.map((opt) => (
          <RadioGroupCard
            key={opt.value}
            value={opt.value}
            label={opt.label}
            description={opt.desc}
            icon={
              // 预览字：A 字母直接用倍率缩放，不依赖当前 root scale，
              // 这样在"当前选中档位"和"未选档位"都能直观看到差别
              <span
                className="font-semibold leading-none inline-flex items-center justify-center"
                style={{
                  fontSize: `${opt.previewScale * 22}px`,
                  minWidth: 28,
                }}
              >
                A
              </span>
            }
            accentColor="var(--primary)"
          />
        ))}
      </RadioGroup>

      {/* 实时预览条：用当前档位真实 token 渲染示例 */}
      <Card padding="sm" className="bg-[var(--bg-elevated)]!">
        <div
          className="caption mb-1.5"
          style={{ color: 'var(--text-hint)' }}
        >
          实时预览
        </div>
        <div className="heading-md" style={{ color: 'var(--text-primary)' }}>
          今日宝宝护理摘要
        </div>
        <div className="body-md mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          喂养 3 次 · 睡眠 4 小时 · 换尿布 5 次
        </div>
        <div className="caption mt-1">点击任一档位会立即在整个 App 生效</div>
      </Card>
    </div>
  )
}
