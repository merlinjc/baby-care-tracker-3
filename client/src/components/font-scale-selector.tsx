/**
 * FontScaleSelector - 字体大小 4 档选择器
 *
 * 4 档：小 / 标准 / 大 / 特大（特大适合老年人）
 * 切换时立即应用 + 持久化到 localStorage（由 font-scale-store 管理）。
 *
 * v5.0.1 Batch 4：重构为基于 <RadioGroup> + <RadioGroupCard>（自定义 icon 为预览字 A）。
 * 每个卡片的 icon 槽位用不同字号的"A"直观体现倍率，保留原视觉。
 *
 * v7.1：4 档紧凑布局下卡片改为**纵向布局**（icon 上 / label 中 / desc 隐藏在 lg 断点）：
 * - 大字号 A 在中央占主视觉，label 在下方
 * - 隐藏右侧圆点指示器，选中态用左上角 ✓ 角标 + 卡片底色/边框表达
 * - 解决原横向布局在 4 列窄列下"A 预览 + 文案 + 圆点"挤成一团的问题
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
    <div className="space-y-4">
      <RadioGroup
        value={scale}
        onValueChange={(v) => setScale(v as FontScale)}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 space-y-0"
      >
        {FONT_SCALE_OPTIONS.map((opt) => (
          <RadioGroupCard
            key={opt.value}
            value={opt.value}
            label={opt.label}
            description={opt.desc}
            orientation="vertical"
            hideIndicator
            icon={
              // 预览字：A 字母直接用倍率缩放，不依赖当前 root scale，
              // 这样在"当前选中档位"和"未选档位"都能直观看到差别
              // 用 line-height 1.2（而非 leading-none），避免大字号档下字形被父 line-box 裁切
              <span
                className="font-semibold inline-flex items-center justify-center"
                style={{
                  fontSize: `${opt.previewScale * 22}px`,
                  lineHeight: 1.2,
                  minWidth: 32,
                  minHeight: `${Math.ceil(opt.previewScale * 22 * 1.2)}px`,
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
      <Card
        variant="tinted"
        tintColor="var(--brand)"
        padding="md"
      >
        <div
          className="caption-2 mb-2"
          style={{ color: 'var(--label-tertiary)' }}
        >
          实时预览
        </div>
        <div
          className="font-semibold"
          style={{
            color: 'var(--label)',
            fontSize: 'var(--text-headline)',
            lineHeight: 1.45,
          }}
        >
          今日宝宝护理摘要
        </div>
        <div
          className="mt-1"
          style={{
            color: 'var(--label-secondary)',
            fontSize: 'var(--text-subheadline)',
            lineHeight: 1.55,
          }}
        >
          喂养 3 次 · 睡眠 4 小时 · 换尿布 5 次
        </div>
        <div
          className="mt-2"
          style={{
            color: 'var(--label-tertiary)',
            fontSize: 'var(--text-caption-1)',
            lineHeight: 1.5,
          }}
        >
          点击任一档位会立即在整个 App 生效
        </div>
      </Card>
    </div>
  )
}
