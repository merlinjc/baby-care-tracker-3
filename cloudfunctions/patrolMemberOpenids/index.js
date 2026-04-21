/**
 * patrolMemberOpenids 巡检云函数
 *
 * === 阶段 1（v4.3.0）families → users ===
 * - 遍历所有 families，核对 memberOpenids 与 members（通过 users._openid）的一致性
 * - 不一致时自动修复（dryRun=true 只报告）
 *
 * === 阶段 2（v4.3.1 FR-18 → v4.3.2 FR-A15）users → families 反向漂移 ===
 * - 遍历 users.familyId 非空的用户，校验对应 family 的 members 是否包含该 user
 * - [v4.3.2 FR-A15] 反向漂移自动修复（v4.3.1 只告警，v4.3.2 改为默认自修复）
 *   - 规则 A：family.members 含 userId 但 users.familyId !== family._id → 修复 users.familyId
 *   - 规则 B：family 不存在 → 清除 users.familyId（幽灵引用）
 *   - 规则 C：family 存在但 members 不含 userId → 清除 users.familyId（过期引用）
 *   - 安全保护：MAX_REPAIR_PER_RUN=100 + dryRun 开关 + joinedAt < 7天不修复
 *
 * [v4.3.2 FR-A16] 阶段 1 使用 Set 去重比较（修复 memberOpenids 含重复项时误报一致）
 *
 * 触发方式：定时触发器 / 手动调用
 * 输入参数：{ dryRun?: boolean = false, cursor?: { stage, skip } }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const BATCH_SIZE = 20;
const USER_BATCH_SIZE = 50;
const TIME_BUDGET_MS = 50000;

// [v4.3.2 FR-A15] 安全阈值
const MAX_REPAIR_PER_RUN = 100;

exports.main = async (event = {}) => {
  const db = cloud.database();
  const _ = db.command;
  const dryRun = event.dryRun !== false;  // 默认 dryRun=true（安全第一）
  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  const stats = {
    scanned: 0,
    consistent: 0,
    fixed: 0,
    failed: 0,
    userScanned: 0,
    reverseDriftFound: 0,   // [v4.3.2 FR-A15] 细化
    reverseDriftFixed: 0,
    reverseDriftSkipped: 0,
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

        // [v4.3.2 FR-A16] Set 去重比较：修复 memberOpenids 含重复项时误报一致
        const expectedSet = new Set(expectedOpenids);
        const currentSet = new Set(current);
        const consistent = expectedSet.size === currentSet.size
          && [...expectedSet].every(o => currentSet.has(o));

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

    if (!hasMore) {
      cursor = { stage: 'stage2', skip: 0 };
    } else {
      return finalize(db, stats, cursor, dryRun, startedAt);
    }
  }

  // ===== 阶段 2（v4.3.2 FR-A15）：users → families 反向漂移 + 自修复 =====
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
        if (!user.familyId) continue;

        try {
          const familyDoc = await db.collection('families').doc(user.familyId).get();
          const f = familyDoc.data;

          if (!f || !Array.isArray(f.members)) {
            // 规则 B：家庭文档不存在或数据损坏 → 清除幽灵引用
            stats.reverseDriftFound++;
            if (stats.reverseDriftFixed < MAX_REPAIR_PER_RUN && !dryRun) {
              await db.collection('users').doc(user._id).update({
                data: { familyId: _.remove(), familyRole: _.remove(), updatedAt: new Date(), updatedAtTs: Date.now() }
              });
              stats.reverseDriftFixed++;
            } else {
              stats.reverseDriftSkipped++;
              stats.warnings.push(`DRY_RUN user=${user._id} ghost familyId=${user.familyId}`);
            }
            continue;
          }

          if (!f.members.includes(user._id)) {
            // 规则 C：family 存在但 members 不含 userId → 清除过期引用
            stats.reverseDriftFound++;

            // 安全保护：joinedAt < 7 天的用户可能正在退出中间态，跳过
            const memberDetail = (f.memberDetails || []).find(m => m.userId === user._id);
            if (memberDetail && memberDetail.joinedAt) {
              const joinedAt = memberDetail.joinedAt instanceof Date
                ? memberDetail.joinedAt.getTime()
                : new Date(memberDetail.joinedAt).getTime();
              if (Date.now() - joinedAt < 7 * 24 * 60 * 60 * 1000) {
                stats.reverseDriftSkipped++;
                stats.warnings.push(`SKIP user=${user._id} recently joined family=${user.familyId} (< 7d)`);
                continue;
              }
            }

            if (stats.reverseDriftFixed < MAX_REPAIR_PER_RUN && !dryRun) {
              await db.collection('users').doc(user._id).update({
                data: { familyId: _.remove(), familyRole: _.remove(), updatedAt: new Date(), updatedAtTs: Date.now() }
              });
              stats.reverseDriftFixed++;
            } else {
              stats.reverseDriftSkipped++;
              stats.warnings.push(`SKIP user=${user._id} not in members of family=${user.familyId} (limit or dryRun)`);
            }
          } else {
            // 规则 A 隐含：family.members 含 userId 且 users.familyId 匹配 → 一致，无需修复
          }
        } catch (e) {
          // 家庭文档不存在 → 幽灵引用（规则 B）
          stats.reverseDriftFound++;
          if (stats.reverseDriftFixed < MAX_REPAIR_PER_RUN && !dryRun) {
            await db.collection('users').doc(user._id).update({
              data: { familyId: _.remove(), familyRole: _.remove(), updatedAt: new Date(), updatedAtTs: Date.now() }
            }).catch((e2) => {
              stats.warnings.push(`user=${user._id} fix failed: ${e2.message}`);
            });
            stats.reverseDriftFixed++;
          } else {
            stats.reverseDriftSkipped++;
            stats.warnings.push(`SKIP user=${user._id} family not found: ${user.familyId}`);
          }
        }
      }

      cursor.skip += batch.data.length;
      if (batch.data.length < USER_BATCH_SIZE) {
        hasMoreUsers = false;
        break;
      }
    }

    if (!hasMoreUsers) {
      cursor = null;
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
