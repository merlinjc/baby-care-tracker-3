/**
 * action: clearBabyData (FR-14)
 *
 * [v4.3.0 FR-10] 断点续传 + 分批并发删除：
 * - 单次执行最多 CHUNK_SIZE 条记录 + TIME_BUDGET_MS 时间预算
 * - 超限时返回 { status: 'in_progress', cursor, progress } 让客户端循环调用
 * - 使用 chunkedDelete 并发（默认 10）加速
 *
 * [v4.3.0 FR-9] 接入 OperationLogger 补偿日志
 * [v4.3.0 FR-13] 时间戳改用 Date
 * [v4.3.1 FR-11] 所有查询附加 familyId（安全规则约束 + 防止跨家庭误删）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');
const { chunkedDelete } = require('../lib/db-helper');

const CHUNK_SIZE = 500;
const TIME_BUDGET_MS = 15000;
const CONCURRENCY = 10;

module.exports = async (ctx, params) => {
  const { db, _, userId, logger } = ctx;
  const { babyId, familyId, cursor } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能清除数据');
  }

  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  // 首次调用：初始化 logger + state；否则从 cursor 恢复
  let state;
  if (!cursor) {
    await logger.start({ babyId, familyId });
    state = {
      phase: 'records',        // records → vaccine → milestone → finalize
      totalCleared: { records: 0, vaccine: 0, milestone: 0 }
    };
  } else {
    try { state = JSON.parse(cursor); }
    catch (e) { return errors.INVALID_ACTION('invalid cursor'); }
  }

  // ===== Phase 1: records =====
  if (state.phase === 'records') {
    while (budget()) {
      // [v4.3.1 FR-11] 查询附 familyId
      const batch = await db.collection('records')
        .where({ babyId, familyId })
        .limit(CHUNK_SIZE)
        .get();
      if (batch.data.length === 0) {
        state.phase = 'vaccine';
        break;
      }
      const ids = batch.data.map(d => d._id);
      const deleted = await chunkedDelete(db, 'records', ids, CONCURRENCY);
      state.totalCleared.records += deleted;
      await logger.step('clear_records', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'vaccine';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 2: vaccine =====
  if (state.phase === 'vaccine') {
    while (budget()) {
      const batch = await db.collection('vaccine_records')
        .where({ babyId, familyId })
        .limit(CHUNK_SIZE)
        .get();
      if (batch.data.length === 0) {
        state.phase = 'milestone';
        break;
      }
      const ids = batch.data.map(d => d._id);
      const deleted = await chunkedDelete(db, 'vaccine_records', ids, CONCURRENCY);
      state.totalCleared.vaccine += deleted;
      await logger.step('clear_vaccine', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'milestone';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 3: milestone =====
  if (state.phase === 'milestone') {
    while (budget()) {
      const batch = await db.collection('milestone_records')
        .where({ babyId, familyId })
        .limit(CHUNK_SIZE)
        .get();
      if (batch.data.length === 0) {
        state.phase = 'finalize';
        break;
      }
      const ids = batch.data.map(d => d._id);
      const deleted = await chunkedDelete(db, 'milestone_records', ids, CONCURRENCY);
      state.totalCleared.milestone += deleted;
      await logger.step('clear_milestone', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'finalize';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 4: finalize =====
  const now = new Date();
  const nowTs = Date.now();

  try {
    await db.collection('babies').doc(babyId).remove();
    await logger.step('remove_baby', 'ok', { babyId });
  } catch (e) {
    await logger.step('remove_baby', 'fail', { error: e.message });
  }

  try {
    await db.collection('families').doc(familyId).update({
      data: { babies: _.pull(babyId), updatedAt: now, updatedAtTs: nowTs }
    });
    await logger.step('pull_family_baby', 'ok');
  } catch (e) {
    await logger.step('pull_family_baby', 'fail', { error: e.message });
  }

  // 如果家庭没有更多宝宝 → 解散家庭
  let familyDeleted = false;
  const remaining = await db.collection('babies').where({ familyId }).count();
  if ((remaining.total || 0) === 0) {
    try {
      await db.collection('families').doc(familyId).remove();
      familyDeleted = true;
      await logger.step('remove_family_when_empty', 'ok');
    } catch (e) {
      await logger.step('remove_family_when_empty', 'fail', { error: e.message });
    }

    for (const memberId of (family.members || [])) {
      try {
        await db.collection('users').doc(memberId).update({
          data: {
            familyId: _.remove(),
            familyRole: _.remove(),
            updatedAt: now,
            updatedAtTs: nowTs
          }
        });
        await logger.step(`clear_user_${memberId}`, 'ok');
      } catch (e) {
        await logger.step(`clear_user_${memberId}`, 'fail', { error: e.message });
      }
    }
  }

  const finalResult = Object.assign({
    status: 'succeeded',
    familyDeleted
  }, state.totalCleared);

  await logger.succeed(finalResult);
  return errors.ok(finalResult);
};

/**
 * 返回"进行中"响应，客户端循环调用
 */
function paused(state) {
  return {
    success: true,
    data: {
      status: 'in_progress',
      cursor: JSON.stringify(state),
      progress: state.totalCleared
    }
  };
}
