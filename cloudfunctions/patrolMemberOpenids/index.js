/**
 * patrolMemberOpenids 巡检云函数（v4.3.0 FR-12）
 *
 * 功能：
 * - 遍历所有 families，核对 memberOpenids 与 members（通过 users._openid）的一致性
 * - 不一致时自动修复（可通过 event.dryRun = true 切换为只报告不修改）
 * - 巡检结果写入 operation_logs 集合供审计
 * - 支持断点续传（通过 event.cursor 传入 { skip } 继续）
 *
 * 触发方式：
 * - 定时触发器（建议 CloudBase 控制台或通过 createFunctionTrigger 配置，cron: 0 0 0 * * * * = 每天 0 点）
 * - 手动调用（建议 dryRun=true 先观察）
 *
 * 输入参数：
 *   { dryRun?: boolean = false, cursor?: { skip: number } }
 *
 * 返回：
 *   { success: true, stats: { scanned, consistent, fixed, failed, warnings },
 *     cursor: { skip } | null }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const BATCH_SIZE = 20;
const TIME_BUDGET_MS = 50000; // 留 10s 给落盘等尾部操作

exports.main = async (event = {}) => {
  const db = cloud.database();
  const dryRun = !!event.dryRun;
  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  const stats = { scanned: 0, consistent: 0, fixed: 0, failed: 0, warnings: [] };
  let cursor = event.cursor && typeof event.cursor.skip === 'number'
    ? event.cursor
    : { skip: 0 };

  let hasMore = true;
  while (budget() && hasMore) {
    const batch = await db.collection('families')
      .skip(cursor.skip).limit(BATCH_SIZE).get();
    if (batch.data.length === 0) {
      hasMore = false;
      break;
    }

    for (const family of batch.data) {
      stats.scanned++;
      const expectedOpenids = [];
      let anyMissing = false;

      for (const memberId of (family.members || [])) {
        try {
          const userDoc = await db.collection('users').doc(memberId).get();
          const openid = userDoc.data && userDoc.data._openid;
          if (openid) {
            expectedOpenids.push(openid);
          } else {
            anyMissing = true;
            stats.warnings.push(`family=${family._id} user=${memberId} has no _openid`);
          }
        } catch (e) {
          anyMissing = true;
          stats.warnings.push(`family=${family._id} user=${memberId} not found: ${(e && e.errMsg) || e.message || e}`);
        }
      }

      const current = family.memberOpenids || [];
      const consistent = expectedOpenids.length === current.length
        && expectedOpenids.every(o => current.includes(o));

      if (consistent) {
        stats.consistent++;
      } else if (anyMissing) {
        // 存在缺失用户，仅记录告警，不自动修改
        stats.failed++;
      } else if (dryRun) {
        // dryRun 模式只统计不修改
        stats.warnings.push(`DRY_RUN family=${family._id} expected=${JSON.stringify(expectedOpenids)} current=${JSON.stringify(current)}`);
        stats.failed++;
      } else {
        try {
          await db.collection('families').doc(family._id).update({
            data: { memberOpenids: expectedOpenids, updatedAt: new Date(), updatedAtTs: Date.now() }
          });
          stats.fixed++;
        } catch (e) {
          stats.failed++;
          stats.warnings.push(`family=${family._id} fix failed: ${(e && e.message) || e}`);
        }
      }
    }

    cursor.skip += batch.data.length;
    if (batch.data.length < BATCH_SIZE) {
      hasMore = false;
      break;
    }
  }

  // 巡检结果落盘
  try {
    await db.collection('operation_logs').add({
      data: {
        action: 'patrolMemberOpenids',
        status: hasMore ? 'in_progress' : 'succeeded',
        result: { dryRun, stats, cursor: hasMore ? cursor : null },
        startedAt: new Date(startedAt),
        startedAtTs: startedAt,
        finishedAt: new Date(),
        finishedAtTs: Date.now()
      }
    });
  } catch (e) {
    console.warn('[patrolMemberOpenids] 写入巡检日志失败:', e && e.message);
  }

  return {
    success: true,
    dryRun,
    stats,
    cursor: hasMore ? cursor : null,
    // warnings 可能很多，截断保护
    warningsTruncated: stats.warnings.length > 50
      ? stats.warnings.slice(0, 50)
      : stats.warnings
  };
};
