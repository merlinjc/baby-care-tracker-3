/**
 * note-tags.ts - 记录备注的「标签 + 自由文本」协议
 *
 * 为了保持与老数据（纯文本 note）以及后端接口的**完全向后兼容**，
 * 本期采用最简化的 `#tag` 内联格式，不引入新的 DB 字段：
 *
 *   "#吃得多 #打嗝多 今晚多喝了 30ml"
 *   ↑ 标签用 `#` 前缀 + 空白分隔；其余文字原样保留为自由备注
 *
 * 解析/构造时允许任意空白分隔；展示侧把命中的 `#tag` 渲染为彩色 pill，
 * 其余内容按普通文字展示。
 *
 * 自定义标签持久化：
 * - key: `baby_care_custom_tags:${recordType}`
 * - value: JSON string array，跨宝宝 / 跨家庭成员共用（体验一致）
 * - 上限：每类型最多 30 个自定义标签（超出自动 FIFO 裁剪）
 */
import type { RecordType } from '@baby-care-tracker/shared'

// ============ 预设标签（按记录类型分组） ============

/** 通用标签：5 种记录类型都会附加 */
const COMMON_TAGS = ['情绪好', '哭闹多', '外出中', '家里来客人', '感冒中'] as const

/** 按 recordType 细分的预设标签（不含通用） */
const TYPE_TAGS: Record<RecordType, readonly string[]> = {
  feeding: [
    '吃得多',
    '吃得少',
    '吐奶',
    '打嗝多',
    '吃奶急',
    '吃完就睡',
    '拒绝吃奶',
    '换新奶粉',
    '第一次辅食',
    '疑似过敏',
    '追奶中',
    '混合喂养',
  ],
  sleep: [
    '秒睡',
    '入睡困难',
    '频繁夜醒',
    '睡得香',
    '抱睡',
    '自主入睡',
    '开空调',
    '打呼噜',
    '做梦说话',
    '出汗多',
  ],
  diaper: [
    '红屁股',
    '腹泻',
    '便秘',
    '尿量少',
    '尿量多',
    '放屁多',
    '便色异常',
    '换新品牌',
    '夜间尿湿',
  ],
  temperature: [
    '刚睡醒测',
    '活动后测',
    '吃奶后测',
    '洗澡后测',
    '退烧后复测',
    '精神状态好',
    '精神差',
    '伴咳嗽',
    '伴流涕',
  ],
  growth: [
    '医院测量',
    '家中测量',
    '穿衣测量',
    '空腹测量',
    '疫苗前测',
    '体检时测',
  ],
}

/** 返回某 recordType 可用的预设标签（通用 + 细分） */
export function getPresetNoteTags(recordType: RecordType): string[] {
  return [...TYPE_TAGS[recordType], ...COMMON_TAGS]
}

// ============ 自定义标签持久化 ============

const MAX_CUSTOM_TAGS = 30

function customTagsKey(recordType: RecordType): string {
  return `baby_care_custom_tags:${recordType}`
}

export function readCustomNoteTags(recordType: RecordType): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(customTagsKey(recordType))
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  } catch {
    return []
  }
}

export function writeCustomNoteTags(recordType: RecordType, tags: string[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    // 去重 + 去空白 + 限长
    const cleaned = Array.from(
      new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 10)),
    ).slice(-MAX_CUSTOM_TAGS)
    localStorage.setItem(customTagsKey(recordType), JSON.stringify(cleaned))
  } catch {
    // 忽略存储异常（隐私模式等）
  }
}

export function addCustomNoteTag(recordType: RecordType, tag: string): string[] {
  const trimmed = tag.trim()
  if (!trimmed || trimmed.length > 10) return readCustomNoteTags(recordType)
  const list = readCustomNoteTags(recordType)
  const next = list.filter((t) => t !== trimmed).concat(trimmed)
  writeCustomNoteTags(recordType, next)
  return next
}

export function removeCustomNoteTag(recordType: RecordType, tag: string): string[] {
  const list = readCustomNoteTags(recordType).filter((t) => t !== tag)
  writeCustomNoteTags(recordType, list)
  return list
}

// ============ 解析 / 构造 ============

export interface ParsedNote {
  tags: string[]
  freeText: string
}

/**
 * 从 note 字符串里提取 `#tag` 标签和剩余自由文本。
 * - 老数据（无 `#`）：tags = []，freeText = 原文本
 * - 标签必须是连续的非空白字符，形如 `#吃得多`；空格结束
 * - `#` 字符若出现在自由文本中间（如中文 `编号#1`）同样会被识别为标签；
 *   这个副作用可接受，因为应用场景是家长备注，几乎不会出现带 # 的自由文字。
 */
export function parseNote(note: string | null | undefined): ParsedNote {
  if (!note) return { tags: [], freeText: '' }
  const tags: string[] = []
  const rest: string[] = []
  // 按空白切分（含全角空格）
  const tokens = note.split(/[\s\u3000]+/)
  for (const token of tokens) {
    if (token.startsWith('#') && token.length > 1) {
      tags.push(token.slice(1))
    } else if (token.length > 0) {
      rest.push(token)
    }
  }
  return { tags: Array.from(new Set(tags)), freeText: rest.join(' ') }
}

/** 根据 tags + 自由文本构造 note 字符串；全部为空返回空串 */
export function buildNote(tags: string[], freeText: string): string {
  const cleanedTags = Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)),
  )
  const tagStr = cleanedTags.map((t) => `#${t}`).join(' ')
  const text = freeText.trim()
  return [tagStr, text].filter((s) => s.length > 0).join(' ')
}
