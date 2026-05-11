/**
 * jaundice-to-cloud.ts - 黄疸 localStorage → 云端一次性迁移（v7.2 T-S1-F2-05）
 *
 * 设计要点
 * --------
 * - **幂等**：`localStorage[MIGRATION_FLAG_KEY] === MIGRATION_VERSION` 时跳过；
 *   迁移成功（即使 0 条数据）也立即写入标记，永不重复执行。
 * - **不破坏数据**：先创建到云端，全部成功才清理对应 baby 的 localStorage 项；
 *   单条失败不影响其它条；批次内有任何失败，本批 baby 的 localStorage 保留，
 *   下次启动可重试。
 * - **不抛错**：迁移层任何异常都吞掉并 console.warn，避免影响主流程。
 * - **触发时机**：在 MainLayout 内 `isAuthenticated && babies.length > 0` 之后
 *   `setTimeout(..., 1500)`，避免阻塞首屏。
 *
 * 数据形态
 * --------
 * 历史 localStorage：
 *   key: `baby_care_jaundice:${babyId}` → JSON 数组（按 date 降序），元素结构见 lib/jaundice。
 * 云端：
 *   POST /api/babies/:id/jaundice，字段映射在 services/jaundice 内完成。
 *
 * 失败统计
 * --------
 * 返回 { migrated, failed }；上层在 migrated > 0 时 toast「已同步 N 条黄疸记录到云端」，
 * failed > 0 时静默不打扰用户。
 */
import {
  readLocalJaundiceRecords,
  clearLocalJaundiceStorage,
} from '@/lib/jaundice'
import { jaundiceService } from '@/services/jaundice'

/**
 * 标记 key：刻意区分 v1 / v2 版本号，将来如果迁移逻辑升级再改 version 触发再次执行。
 */
const MIGRATION_FLAG_KEY = 'baby_care_jaundice_migrated'
const MIGRATION_VERSION = 'v1'

export interface MigrationResult {
  migrated: number
  failed: number
  /** 是否本次实际触发了迁移（false=已迁移过被跳过 / 无数据） */
  ran: boolean
}

function alreadyMigrated(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(MIGRATION_FLAG_KEY) === MIGRATION_VERSION
  } catch {
    return true
  }
}

function markMigrated(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, MIGRATION_VERSION)
  } catch {
    // ignore（隐私模式 / 配额）
  }
}

/**
 * 执行迁移。
 *
 * @param babyIds 当前用户能访问的所有宝宝 id（一般来自 baby-store.babies.map(b => b.id)）
 *   只迁移参数列表里的宝宝，避免迁移到对方家庭看不见的宝宝产生数据污染。
 */
export async function migrateJaundiceToCloud(
  babyIds: string[],
): Promise<MigrationResult> {
  if (alreadyMigrated()) {
    return { migrated: 0, failed: 0, ran: false }
  }
  if (!babyIds || babyIds.length === 0) {
    // 没有可迁移的宝宝，直接打标记，避免下次反复进入
    markMigrated()
    return { migrated: 0, failed: 0, ran: false }
  }

  let migrated = 0
  let failed = 0
  let anyDataSeen = false

  for (const babyId of babyIds) {
    let local: ReturnType<typeof readLocalJaundiceRecords>
    try {
      local = readLocalJaundiceRecords(babyId)
    } catch (e) {
      // 读 localStorage 失败本身就跳过，不影响其它 baby
      console.warn('[migrateJaundiceToCloud] 读取本地数据失败', babyId, e)
      continue
    }
    if (!local || local.length === 0) continue
    anyDataSeen = true

    let babyMigrated = 0
    let babyFailed = 0
    for (const r of local) {
      try {
        await jaundiceService.create(babyId, {
          date: r.date,
          ageDays: r.ageDays,
          kramerZone: r.kramerZone,
          scleraYellow: r.scleraYellow,
          tcb: r.tcb,
          tsb: r.tsb,
          jaundiceType: r.jaundiceType ?? null,
          symptoms: r.symptoms,
          actions: r.actions,
          note: r.note,
        })
        babyMigrated++
      } catch (e) {
        babyFailed++
        console.warn('[migrateJaundiceToCloud] 单条迁移失败', babyId, r.id, e)
      }
    }
    migrated += babyMigrated
    failed += babyFailed
    // 仅当该 baby 全部成功时才清 localStorage（部分失败保留以便下次重试）
    if (babyFailed === 0 && babyMigrated > 0) {
      clearLocalJaundiceStorage(babyId)
    }
  }

  // 全部成功才打迁移标记；存在失败，下次启动还会再试
  if (failed === 0) {
    markMigrated()
  }

  return { migrated, failed, ran: anyDataSeen }
}
