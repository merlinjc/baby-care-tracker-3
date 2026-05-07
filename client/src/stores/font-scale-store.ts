import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 字体大小档位（FR-G1.2 无障碍字体适配）
 *
 * - 'sm'：小（适合小屏信息密度需求）
 * - 'md'：标准（默认）
 * - 'lg'：大
 * - 'xl'：特大（适合老年人 / 低视力场景）
 *
 * 实现：挂 `<html data-font-scale="sm|md|lg|xl">`，由 `globals.css`
 * 根据属性覆盖 `--text-*` tokens。业务代码无需感知档位，
 * 所有通过 `var(--text-*)` / `.heading-*` / `.body-*` / `.caption`
 * 语义类消费字号的组件会自动响应。
 *
 * 持久化 key：`baby_care_font_scale`，跨会话保持。
 */
export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

interface FontScaleStore {
  scale: FontScale
  setScale: (scale: FontScale) => void
}

const STORAGE_KEY = 'baby_care_font_scale'

function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.fontScale = scale
}

export const useFontScaleStore = create<FontScaleStore>()(
  persist(
    (set) => ({
      scale: 'md',
      setScale: (scale: FontScale) => {
        applyFontScale(scale)
        set({ scale })
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyFontScale(state.scale)
        } else {
          applyFontScale('md')
        }
      },
    },
  ),
)

/** 档位元信息，供 UI 组件复用（标签 / 说明 / 预览倍率） */
export const FONT_SCALE_OPTIONS: Array<{
  value: FontScale
  label: string
  desc: string
  /** 预览倍率，用于按钮内示例字号 */
  previewScale: number
}> = [
  { value: 'sm', label: '小', desc: '信息更密集', previewScale: 0.9 },
  { value: 'md', label: '标准', desc: '默认大小', previewScale: 1 },
  { value: 'lg', label: '大', desc: '更易阅读', previewScale: 1.15 },
  { value: 'xl', label: '特大', desc: '适合老年人', previewScale: 1.35 },
]
