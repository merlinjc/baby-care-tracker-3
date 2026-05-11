/**
 * Patrol 巡检任务（FR-E3）+ AIQuota TTL 清理（FR-E4）
 *
 * 实现要点：
 * - 不引入 node-cron，使用原生 setInterval + 启动校时
 * - 通过分布式锁（基于 RateLimit 表）确保多实例下同一时刻只一个执行
 * - 默认 dry-run，仅告警；规则 B 在 PATROL_DRY_RUN=false 时自动修复
 * - patrol 失败不阻断进程；OperationLog 写入失败不阻断巡检
 */
import { prisma } from '../config/database';
import { OperationLogger } from './operation-logger';
import { acquirePatrolLock, releasePatrolLock } from './patrol-lock';
import { uploadService } from '../services/upload.service';

const FAMILY_PATROL_NAME = 'familyConsistency';
const QUOTA_CLEANUP_NAME = 'aiQuotaCleanup';
const CHECKIN_ORPHAN_NAME = 'dailyCheckinOrphanCleanup';

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;
const QUOTA_RETAIN_DAYS = 60;
const CHECKIN_ORPHAN_AGE_DAYS = 30;

/**
 * familyConsistency 巡检：检查 users.familyId 与 family_members 一致性
 * 规则 B：family 已不存在 → 在 dryRun=false 时清 user.familyId
 * 规则 C：family 存在但 user 不在 members → 仅告警
 */
export async function runFamilyConsistencyPatrol(): Promise<{
  scanned: number;
  drift: number;
  autoRepaired: number;
  warnings: number;
}> {
  const acquired = await acquirePatrolLock(FAMILY_PATROL_NAME);
  if (!acquired) {
    console.log('[patrol] familyConsistency 锁未获取，跳过');
    return { scanned: 0, drift: 0, autoRepaired: 0, warnings: 0 };
  }

  const logger = await new OperationLogger('patrolFamilyConsistency').start();
  const stats = { scanned: 0, drift: 0, autoRepaired: 0, warnings: 0 };
  const dryRun = process.env.PATROL_DRY_RUN !== 'false';

  try {
    const users = await prisma.user.findMany({
      where: { familyId: { not: null } },
      select: { id: true, familyId: true },
    });

    for (const user of users) {
      stats.scanned++;
      if (!user.familyId) continue;

      const member = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: user.familyId, userId: user.id } },
      });

      if (!member) {
        stats.drift++;
        const family = await prisma.family.findUnique({ where: { id: user.familyId } });

        if (!family) {
          // 规则 B：family 已不存在 → 自动修复（dryRun=false）
          if (!dryRun) {
            await prisma.user.update({
              where: { id: user.id },
              data: { familyId: null },
            });
          }
          stats.autoRepaired++;
          logger.step('repair_dangling_familyId', dryRun ? 'skip' : 'ok', {
            userId: user.id,
            familyId: user.familyId,
            dryRun,
          });
        } else {
          // 规则 C：family 存在但 user 不在 members → 仅告警
          stats.warnings++;
          logger.step('user_not_in_members', 'skip', {
            userId: user.id,
            familyId: user.familyId,
          });
        }
      }
    }

    await logger.succeed(stats);
    return stats;
  } catch (err) {
    await logger.fail((err as Error).message ?? 'patrol failed', err as Error);
    throw err;
  } finally {
    await releasePatrolLock(FAMILY_PATROL_NAME);
  }
}

/**
 * AIQuota TTL 清理（FR-E4）：删除 60 天前的配额记录
 */
export async function runAIQuotaCleanup(): Promise<{ deleted: number }> {
  const acquired = await acquirePatrolLock(QUOTA_CLEANUP_NAME);
  if (!acquired) {
    console.log('[patrol] aiQuotaCleanup 锁未获取，跳过');
    return { deleted: 0 };
  }

  const logger = await new OperationLogger('patrolAIQuotaCleanup').start();
  try {
    const cutoff = new Date(Date.now() - QUOTA_RETAIN_DAYS * ONE_DAY);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const result = await prisma.aIQuota.deleteMany({
      where: { date: { lt: cutoffStr } },
    });
    await logger.succeed({ deleted: result.count, cutoff: cutoffStr });
    return { deleted: result.count };
  } catch (err) {
    await logger.fail((err as Error).message ?? 'cleanup failed', err as Error);
    throw err;
  } finally {
    await releasePatrolLock(QUOTA_CLEANUP_NAME);
  }
}

/**
 * 每日打卡 COS 孤儿对象清理（v7.2 T-S2-F11-BE-04）。
 *
 * 触发：每周一次（默认周日 04:00 调度，由 weeklyTickHandle 控制；测试中可直接调）。
 *
 * 思路：
 * 1) 列出 COS `checkins/` 前缀下所有对象（分页）
 * 2) 对每个 key 检查 DB 中是否存在对应 DailyCheckin.photoKey
 * 3) 同时满足"无 DB 引用"且"对象年龄 ≥ 30 天"才删除（30 天阈值给手动恢复留窗口）
 * 4) PATROL_DRY_RUN=true（默认）只统计不删
 *
 * 设计权衡：
 * - 不主动同步删除：避免业务删 DB 时网络抖动导致桶内残留无法对账
 * - 30 天年龄门槛：避免新写入还没落 DB 时被误清（极端场景：上传成功但 create 失败）
 * - DB 反查：用一次 IN 查询批量对比 1000 keys，性能更稳
 */
export async function runDailyCheckinOrphanCleanup(): Promise<{
  scanned: number;
  orphaned: number;
  deleted: number;
  dryRun: boolean;
}> {
  const acquired = await acquirePatrolLock(CHECKIN_ORPHAN_NAME);
  if (!acquired) {
    console.log('[patrol] dailyCheckinOrphanCleanup 锁未获取，跳过');
    return { scanned: 0, orphaned: 0, deleted: 0, dryRun: true };
  }

  const logger = await new OperationLogger('patrolDailyCheckinOrphan').start();
  const stats = { scanned: 0, orphaned: 0, deleted: 0, dryRun: true };
  const dryRun = process.env.PATROL_DRY_RUN !== 'false';
  stats.dryRun = dryRun;

  const ageThreshold = Date.now() - CHECKIN_ORPHAN_AGE_DAYS * ONE_DAY;

  try {
    let marker: string | undefined;
    do {
      const page = await uploadService.listObjectsByPrefix('checkins/', {
        marker,
        maxKeys: 1000,
      });
      stats.scanned += page.items.length;

      // 仅考虑 ≥ 30 天的对象
      const candidates = page.items.filter((o) => {
        const ts = new Date(o.lastModified).getTime();
        return Number.isFinite(ts) && ts <= ageThreshold;
      });

      if (candidates.length > 0) {
        const candidateKeys = candidates.map((o) => o.key);
        // 批量 DB 反查：被任何 DailyCheckin 引用的 key 都不算孤儿
        const referenced = await prisma.dailyCheckin.findMany({
          where: { photoKey: { in: candidateKeys } },
          select: { photoKey: true },
        });
        const referencedSet = new Set(referenced.map((r) => r.photoKey));
        const orphans = candidateKeys.filter((k) => !referencedSet.has(k));
        stats.orphaned += orphans.length;

        if (!dryRun && orphans.length > 0) {
          // 分批 100 个一组（COS 上限 1000，留余量并降低单次失败面）
          for (let i = 0; i < orphans.length; i += 100) {
            const batch = orphans.slice(i, i + 100);
            const result = await uploadService.deleteObjects(batch);
            stats.deleted += result.deleted.length;
            if (result.failed.length > 0) {
              logger.step('delete_failed', 'fail', {
                count: result.failed.length,
                samples: result.failed.slice(0, 5),
              });
            }
          }
        }
      }

      marker = page.isTruncated ? page.nextMarker : undefined;
    } while (marker);

    await logger.succeed(stats);
    return stats;
  } catch (err) {
    await logger.fail((err as Error).message ?? 'patrol failed', err as Error);
    throw err;
  } finally {
    await releasePatrolLock(CHECKIN_ORPHAN_NAME);
  }
}

// ============ 调度 ============
//
// 不依赖 node-cron：使用 setInterval + 启动时校时。每次 tick 检查"距离上次执行
// 是否超过预定间隔"，超过则执行。简单可靠，无需第三方依赖。

let dailyTickHandle: NodeJS.Timeout | null = null;
let weeklyTickHandle: NodeJS.Timeout | null = null;
let lastDailyRun = 0;
let lastWeeklyRun = 0;

function shouldRegister(): boolean {
  return process.env.NODE_ENV !== 'test' && process.env.PATROL_ENABLED !== 'false';
}

export function registerPatrolTasks(): void {
  if (!shouldRegister()) {
    console.log('[patrol] disabled (NODE_ENV=test or PATROL_ENABLED=false)');
    return;
  }

  console.log('[patrol] registering tasks');

  // 每小时 tick 检查是否到执行时刻
  dailyTickHandle = setInterval(async () => {
    const now = Date.now();
    if (now - lastDailyRun < ONE_DAY) return;
    lastDailyRun = now;
    try {
      const stats = await runFamilyConsistencyPatrol();
      console.log('[patrol] familyConsistency done', stats);
    } catch (err) {
      console.error('[patrol] familyConsistency error', err);
    }
  }, ONE_HOUR);

  // 每天 tick 检查是否需要每周清理
  weeklyTickHandle = setInterval(async () => {
    const now = Date.now();
    if (now - lastWeeklyRun < ONE_WEEK) return;
    lastWeeklyRun = now;
    try {
      const stats = await runAIQuotaCleanup();
      console.log('[patrol] aiQuotaCleanup done', stats);
    } catch (err) {
      console.error('[patrol] aiQuotaCleanup error', err);
    }
    // 周巡检顺带清理每日打卡的 COS 孤儿对象
    try {
      const stats = await runDailyCheckinOrphanCleanup();
      console.log('[patrol] dailyCheckinOrphanCleanup done', stats);
    } catch (err) {
      console.error('[patrol] dailyCheckinOrphanCleanup error', err);
    }
  }, ONE_DAY);
}

export function stopPatrolTasks(): void {
  if (dailyTickHandle) {
    clearInterval(dailyTickHandle);
    dailyTickHandle = null;
  }
  if (weeklyTickHandle) {
    clearInterval(weeklyTickHandle);
    weeklyTickHandle = null;
  }
}

// 自启动：模块加载即注册（除非测试环境）
if (shouldRegister()) {
  registerPatrolTasks();
}
