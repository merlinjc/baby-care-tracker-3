/**
 * patrolMemberOpenids 巡检云函数（v4.3.0 FR-12 / v4.3.1 FR-18）
 *
 * 功能：
 * === 阶段 1（v4.3.0）families → users ===
 * - 遍历所有 families，核对 memberOpenids 与 members（通过 users._openid）的一致性
 * - 不一致时自动修复（dryRun=true 只报告）
 *
 * === 阶段 2（v4.3.1 FR-18）users → families 反向漂移 ===
 * - 遍历 users.familyId 非空的用户，校验对应 family 的 members 是否包含该 user
 * - 不一致时仅告警（不自动修复，避免误伤注销中间态）
 *
 * - 巡检结果写入 operation_logs 集合供审计
 * - 支持断点续传（event.cursor.stage = 'stage1'|'stage2'，skip = number）
 *
 * 触发方式：
 * - 定时触发器（CloudBase 控制台配置，cron: 0 0 0 * * * * = 每天 0 点）
 * - 手动调用（建议 dryRun=true 先观察）
 *
 * 输入参数：
 *   { dryRun?: boolean = false, cursor?: { stage, skip } }
 *
 * 返回：
 *   { success: true, stats: { scanned, consistent, fixed, failed, reverseDrift, warnings },
 *     cursor: { stage, skip } | null }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const BATCH_SIZE = 20;
const USER_BATCH_SIZE = 50;
const TIME_BUDGET_MS = 50000;  // 留 10s 给落盘等尾部操作

exports.main = async (event = {}) => {
  const db = cloud.database();
  const _ = db.command;
  const dryRun = !!event.dryRun;
  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  const stats = {
    scanned: 0,       // stage 1 扫描的 family 数
    consistent: 0,
    fixed: 0,
    failed: 0,
    userScanned: 0,   // stage 2 扫描的 user 数
    reverseDrift: 0,  // stage 2 发现的反向漂移数
    warnings: []
  };

  let cursor = event.cursor && typeof event.cursor.skip === 'number'
    ? Object.assign({ stage: 'stage1', skip: 0 }, event.cursor)
    : { stage: 'stage1', skip: 0 };

  // ===== 阶段 1：families → users 核对 =====
  if (cursor.stage === 'stage1') {
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
          stats.failed++;
        } else if (dryRun) {
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

    // 阶段 1 完成 → 切到阶段 2
    if (!hasMore) {
      cursor = { stage: 'stage2', skip: 0 };
    } else {
      // 时间耗尽但阶段 1 还没跑完 → 保留当前 cursor
      return finalize(db, stats, cursor, dryRun, startedAt);
    }
  }

  // ===== 阶段 2（v4.3.1 FR-18）：users → families 反向漂移 =====
  if (cursor.stage === 'stage2') {
    let hasMoreUsers = true;
    while (budget() && hasMoreUsers) {
      const batch = await db.collection('users')
        .where({ familyId: _.exists(true).and(_.neq('')) })
        .skip(cursor.skip).limit(USER_BATCH_SIZE).get();
      if (batch.data.length === 0) {
        hasMoreUsers = false;
        break;
      }

      for (const user of batch.data) {
        stats.userScanned++;
        if (!user.familyId) continue;  // 防御
        try {
          const familyDoc = await db.collection('families').doc(user.familyId).get();
          const f = familyDoc.data;
          if (!f || !Array.isArray(f.members) || !f.members.includes(user._id)) {
            stats.reverseDrift++;
            stats.warnings.push(
              `user=${user._id} familyId=${user.familyId} not in family.members`
            );
          }
        } catch (e) {
          // 家庭文档不存在 → 幽灵引用
          stats.reverseDrift++;
          stats.warnings.push(
            `user=${user._id} familyId=${user.familyId} family not found`
          );
        }
      }

      cursor.skip += batch.data.length;
      if (batch.data.length < USER_BATCH_SIZE) {
        hasMoreUsers = false;
        break;
      }
    }

    if (!hasMoreUsers) {
      cursor = null;  // 完全结束
    }
  }

  return finalize(db, stats, cursor, dryRun, startedAt);
};

/**
 * 统一结果落盘 + 返回
 */
async function finalize(db, stats, cursor, dryRun, startedAt) {
  const inProgress = cursor !== null;

  try {
    await db.collection('operation_logs').add({
      data: {
        action: 'patrolMemberOpenids',
        status: inProgress ? 'in_progress' : 'succeeded',
        result: { dryRun, stats, cursor },
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
    cursor,
    warningsTruncated: stats.warnings.length > 50
      ? stats.warnings.slice(0, 50)
      : stats.warnings
  };
}
