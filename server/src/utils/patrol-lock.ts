/**
 * Patrol 任务的分布式锁（FR-E3）
 *
 * 复用 RateLimit 表实现"乐观锁式领导选举"：
 * - 任务启动时尝试 acquirePatrolLock(name) 申请锁
 * - 成功 → 当前实例获得本次执行资格，他实例返回 false
 * - 失败 → 跳过本次执行
 *
 * 锁 TTL 默认 10 分钟，超时自动可被新实例抢占。
 */
import { prisma } from '../config/database';

const LOCK_TTL_MS = 10 * 60 * 1000;
const LOCK_KEY_PREFIX = 'patrol_lock:';

export async function acquirePatrolLock(name: string): Promise<boolean> {
  const key = `${LOCK_KEY_PREFIX}${name}`;
  const now = new Date();
  const newExpire = new Date(now.getTime() + LOCK_TTL_MS);

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing) {
      // 首次获取
      await prisma.rateLimit.create({
        data: { key, count: 1, windowStart: now, expireAt: newExpire },
      });
      return true;
    }

    if (existing.expireAt.getTime() > now.getTime()) {
      // 锁未过期，被其他实例持有
      return false;
    }

    // 过期锁：用乐观条件 update 抢占（updateMany 返回受影响行数）
    const result = await prisma.rateLimit.updateMany({
      where: { key, expireAt: { lt: now } },
      data: {
        count: existing.count + 1,
        windowStart: now,
        expireAt: newExpire,
      },
    });
    return result.count > 0;
  } catch (err) {
    console.warn(`[acquirePatrolLock] ${name} failed`, err);
    return false;
  }
}

export async function releasePatrolLock(name: string): Promise<void> {
  const key = `${LOCK_KEY_PREFIX}${name}`;
  await prisma.rateLimit
    .update({
      where: { key },
      data: { expireAt: new Date(0) },
    })
    .catch(() => {
      /* ignore */
    });
}
