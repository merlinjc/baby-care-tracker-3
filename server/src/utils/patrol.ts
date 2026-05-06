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

const FAMILY_PATROL_NAME = 'familyConsistency';
const QUOTA_CLEANUP_NAME = 'aiQuotaCleanup';

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;
const QUOTA_RETAIN_DAYS = 60;

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
