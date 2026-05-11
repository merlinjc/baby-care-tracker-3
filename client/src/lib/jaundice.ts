/**
 * jaundice.ts - 黄疸观察记录（v7.2 起改云端化）
 *
 * v7.2 T-S1-F2 起本模块仅保留：
 *   - 类型 / 常量（`KRAMER_ZONE_OPTIONS` / `JAUNDICE_TYPE_OPTIONS` /
 *     `SYMPTOM_OPTIONS` / `ACTION_OPTIONS` / `JaundiceRecord` / `KramerZone` / `JaundiceType`）
 *   - 纯函数（`computeAgeDays` / `classifyTsb`）
 *   - 一次性迁移用的"读 localStorage" helper：`readLocalJaundiceRecords` /
 *     `clearLocalJaundiceStorage`（migrations/jaundice-to-cloud 使用，业务侧不要调用）
 *
 * 旧版本的 listJaundiceRecords / saveJaundiceRecord / deleteJaundiceRecord
 * 已删除：业务请改用 services/jaundice + hooks/use-jaundice。
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

// ============ localStorage 迁移辅助（仅供 migrations/jaundice-to-cloud 使用） ============

/**
 * 历史本地存储 key 前缀。F2 完成迁移后会被清理，不应在新代码引用。
 * @internal
 */
export const LEGACY_JAUNDICE_STORAGE_PREFIX = 'baby_care_jaundice:'

/**
 * 读取某宝宝的本地缓存黄疸记录（仅供迁移脚本使用）。
 * 失败 / 解析错误 / 非数组 → 返回 []。不抛错。
 *
 * @internal
 */
export function readLocalJaundiceRecords(babyId: string): JaundiceRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${LEGACY_JAUNDICE_STORAGE_PREFIX}${babyId}`)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as JaundiceRecord[]) : []
  } catch {
    return []
  }
}

/**
 * 清理某宝宝的本地缓存黄疸记录（迁移成功后调用）。
 *
 * @internal
 */
export function clearLocalJaundiceStorage(babyId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(`${LEGACY_JAUNDICE_STORAGE_PREFIX}${babyId}`)
  } catch {
    // ignore (隐私模式 / 配额)
  }
}
