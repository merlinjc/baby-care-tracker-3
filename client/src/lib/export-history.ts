/**
 * export-history.ts - 导出历史本地存储（v7.2 T-S1-F3-02）
 *
 * 设计要点
 * --------
 * - localStorage 落地，FIFO 上限 10 条；写入失败（隐私模式 / 配额）静默吞错。
 * - 文件本身不存（Blob 不便序列化），仅存"已下载文件名 + 元数据"，提供"重新下载"
 *   按钮以同样的 params 重新调 `/api/export`，不依赖任何 7d 链接。
 * - 与 babyId 无关：所有宝宝的历史共用一个 list（用 babyName 区分），便于切换多宝
 *   时仍能看到完整记录。
 *
 * 数据形态
 * --------
 * ```
 * {
 *   id: cuid,
 *   exportedAt: ISO,
 *   babyId, babyName,
 *   format: 'csv' | 'json',
 *   types: string[],         // 选中的数据类型
 *   startDate, endDate?,     // 可选时间范围（ISO）
 *   filename                 // 实际下载的文件名
 * }
 * ```
 */

const STORAGE_KEY = 'baby_care_export_history'
const MAX_ENTRIES = 10

export interface ExportHistoryItem {
  id: string
  exportedAt: string
  babyId: string
  babyName: string
  format: 'csv' | 'json'
  types: string[]
  startDate?: string
  endDate?: string
  filename: string
}

function safeRead(): ExportHistoryItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x): x is ExportHistoryItem =>
        x &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        typeof x.babyId === 'string' &&
        typeof x.babyName === 'string' &&
        typeof x.exportedAt === 'string' &&
        (x.format === 'csv' || x.format === 'json') &&
        Array.isArray(x.types) &&
        typeof x.filename === 'string',
    )
  } catch {
    return []
  }
}

function safeWrite(list: ExportHistoryItem[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

/** 读取全部历史（按 exportedAt desc 已存好，直接返回） */
export function listExportHistory(): ExportHistoryItem[] {
  return safeRead()
}

/** 追加一条；超过 MAX_ENTRIES 时丢最旧的；返回写入后完整列表 */
export function addExportHistory(
  item: Omit<ExportHistoryItem, 'id' | 'exportedAt'>,
): ExportHistoryItem[] {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const entry: ExportHistoryItem = {
    ...item,
    id,
    exportedAt: new Date().toISOString(),
  }
  const list = [entry, ...safeRead()].slice(0, MAX_ENTRIES)
  safeWrite(list)
  return list
}

/** 清空全部历史 */
export function clearExportHistory(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** 删除单条 */
export function removeExportHistory(id: string): ExportHistoryItem[] {
  const next = safeRead().filter((x) => x.id !== id)
  safeWrite(next)
  return next
}
