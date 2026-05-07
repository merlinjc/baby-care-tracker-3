/**
 * jaundice.ts - 黄疸观察记录（客户端本地存储 MVP）
 *
 * 设计决策：
 * - **不改后端 schema / 数据库 / 接口**：黄疸记录作为"观察类数据"而非核心育儿记录，
 *   本期以 `localStorage` 落地，快速上线并验证产品价值。
 * - 后续迭代若需要多端同步 / 家庭共享，再抽出同名类型到 shared，
 *   新增 `recordType = 'jaundice'` 或独立 `jaundice_records` 表 + 接口。
 *
 * 存储 key：`baby_care_jaundice:${babyId}` → JSON 数组，按 `date` 降序存储。
 */

/** Kramer 五分区法：按皮肤黄染向下蔓延的程度估计血清胆红素范围 */
export type KramerZone = 1 | 2 | 3 | 4 | 5

export const KRAMER_ZONE_OPTIONS: Array<{
  value: KramerZone
  label: string
  desc: string
  /** 对应的 TSB 参考范围（mg/dL），仅作为临床教育参考，非诊断依据 */
  tsbRange: string
}> = [
  { value: 1, label: '仅面部 / 颈部', desc: 'Ⅰ 区', tsbRange: '约 4–8 mg/dL' },
  { value: 2, label: '上半身（躯干上方）', desc: 'Ⅱ 区', tsbRange: '约 5–12 mg/dL' },
  { value: 3, label: '下半身（躯干下方 + 大腿）', desc: 'Ⅲ 区', tsbRange: '约 8–16 mg/dL' },
  { value: 4, label: '四肢（含肘膝以下）', desc: 'Ⅳ 区', tsbRange: '约 11–18 mg/dL' },
  { value: 5, label: '手足心', desc: 'Ⅴ 区', tsbRange: '> 15 mg/dL' },
]

/** 黄疸分类（非诊断，用户主观选择） */
export type JaundiceType = 'physiologic' | 'pathologic' | 'breast_milk'

export const JAUNDICE_TYPE_OPTIONS: Array<{ value: JaundiceType; label: string }> = [
  { value: 'physiologic', label: '生理性' },
  { value: 'pathologic', label: '病理性' },
  { value: 'breast_milk', label: '母乳性' },
]

/** 伴随表现（多选标签） */
export const SYMPTOM_OPTIONS: string[] = [
  '精神状态好',
  '嗜睡',
  '易激惹',
  '吃奶正常',
  '吃奶减少',
  '拒绝吃奶',
  '大便金黄',
  '大便灰白',
  '尿色清亮',
  '尿色深黄',
  '巩膜不黄',
  '巩膜发黄',
]

/** 处置（多选标签） */
export const ACTION_OPTIONS: string[] = [
  '加强喂养',
  '多晒太阳',
  '就医复查',
  '居家蓝光',
  '住院蓝光',
  '换血治疗',
  '保持观察',
]

export interface JaundiceRecord {
  id: string
  babyId: string
  /** 测量时间（ISO 字符串） */
  date: string
  /** 日龄（出生后第 N 天，>= 1） */
  ageDays: number
  /** Kramer 分区；null 表示皮肤未见明显黄染 */
  kramerZone: KramerZone | null
  /** 巩膜是否黄染 */
  scleraYellow: boolean
  /** 经皮胆红素 TcB（mg/dL），家用/门诊常见单位 */
  tcb?: number
  /** 血清胆红素 TSB（mg/dL），抽血才有 */
  tsb?: number
  /** 用户主观分类，不做诊断 */
  jaundiceType?: JaundiceType | null
  /** 伴随表现（多选） */
  symptoms: string[]
  /** 处置（多选） */
  actions: string[]
  /** 备注文字 */
  note?: string
  createdAt: string
  updatedAt: string
}

const STORAGE_PREFIX = 'baby_care_jaundice:'

function storageKey(babyId: string): string {
  return `${STORAGE_PREFIX}${babyId}`
}

function safeParse(raw: string | null): JaundiceRecord[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as JaundiceRecord[]) : []
  } catch {
    return []
  }
}

/** 按 date 降序返回某宝宝的全部记录 */
export function listJaundiceRecords(babyId: string): JaundiceRecord[] {
  if (typeof localStorage === 'undefined') return []
  const records = safeParse(localStorage.getItem(storageKey(babyId)))
  return records.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** 覆盖写入（内部使用） */
function writeAll(babyId: string, list: JaundiceRecord[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(babyId), JSON.stringify(list))
  } catch {
    // ignore（隐私模式等）
  }
}

export function saveJaundiceRecord(
  babyId: string,
  input: Omit<JaundiceRecord, 'id' | 'babyId' | 'createdAt' | 'updatedAt'> & {
    id?: string
  },
): JaundiceRecord {
  const now = new Date().toISOString()
  const list = listJaundiceRecords(babyId)
  if (input.id) {
    const idx = list.findIndex((r) => r.id === input.id)
    if (idx >= 0) {
      const updated: JaundiceRecord = {
        ...list[idx],
        ...input,
        babyId,
        id: input.id,
        updatedAt: now,
      }
      list[idx] = updated
      writeAll(babyId, list)
      return updated
    }
  }
  const created: JaundiceRecord = {
    ...input,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `jaundice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    babyId,
    createdAt: now,
    updatedAt: now,
  }
  list.unshift(created)
  writeAll(babyId, list)
  return created
}

export function deleteJaundiceRecord(babyId: string, id: string): void {
  const next = listJaundiceRecords(babyId).filter((r) => r.id !== id)
  writeAll(babyId, next)
}

/** 根据出生日期计算某测量日的日龄（>=1） */
export function computeAgeDays(birthDateIso: string, measureDateIso: string): number {
  const birth = new Date(birthDateIso)
  const measure = new Date(measureDateIso)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(measure.getTime())) return 1
  const diff = Math.floor(
    (measure.setHours(0, 0, 0, 0) - birth.setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000),
  )
  return Math.max(1, diff + 1)
}

/** 简单的警戒线判定（仅提示，非诊断）：按 TSB 数值给色阶 */
export function classifyTsb(tsb?: number): {
  level: 'low' | 'attention' | 'warn' | 'danger' | null
  label: string
  color: string
} {
  if (typeof tsb !== 'number' || !Number.isFinite(tsb)) {
    return { level: null, label: '', color: 'var(--text-hint)' }
  }
  if (tsb < 8) return { level: 'low', label: '较轻', color: 'var(--success)' }
  if (tsb < 12) return { level: 'attention', label: '关注', color: 'var(--info)' }
  if (tsb < 17) return { level: 'warn', label: '偏高', color: 'var(--warning)' }
  return { level: 'danger', label: '需就医', color: 'var(--danger)' }
}
