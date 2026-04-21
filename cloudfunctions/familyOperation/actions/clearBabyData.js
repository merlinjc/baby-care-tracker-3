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
 * [v4.3.2 FR-A18] 续传恢复时检查 baby 是否仍存在（BABY_NOT_FOUND），
 *   防止并发 deleteBaby + clearBabyData 场景下操作已不存在的 baby
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

  // [v4.3.2 FR-A18] 续传恢复时检查 baby 是否仍存在
  if (cursor) {
    const babyDoc = await db.collection('babies').doc(babyId).get().catch(() => null);
    if (!babyDoc || !babyDoc.data) {
      // baby 已被并发删除（如 deleteBaby 已完成），视为成功
      await logger.start({ babyId, familyId, resumedFromCursor: true });
      await logger.succeed({ status: 'succeeded', babyAlreadyDeleted: true });
      return errors.ok({
        status: 'succeeded',
        babyAlreadyDeleted: true,
        message: '宝宝数据已被其他操作清除'
      });
    }
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
    // [v4.3.2 FR-A18] baby 已不存在时幂等处理
    if (e.errCode === -1 || (e.message && e.message.includes('cannot find document'))) {
      await logger.step('remove_baby', 'skip', { reason: 'already_deleted', babyId });
    } else {
      await logger.step('remove_baby', 'fail', { error: e.message });
    }
  }

  try {
    await db.collection('families').doc(familyId).update({
      data: { babies: _.pull(babyId), updatedAt: now, updatedAtTs: nowTs }
    });
    await logger.step('pull_family_baby', 'ok');
  } catch (e) {
    await logger.step('pull_family_baby', 'fail', { error: e.message });
  }

  // [v4.3.2 FR-3] 自动解散判断：与 deleteBaby 一致
  let autoDissolved = false;
  try {
    const freshRes = await db.collection('families').doc(familyId).get();
    const freshFamily = freshRes && freshRes.data;
    if (freshFamily) {
      const remainingBabies = (freshFamily.babies || []).length;
      const memberCount = (freshFamily.members || []).length;
      if (remainingBabies === 0 && memberCount <= 1) {
        const { dissolveFamilyCore } = require('../lib/family-dissolve');
        await dissolveFamilyCore(ctx, freshFamily, logger);
        autoDissolved = true;
      }
    }
  } catch (e) {
    await logger.step('auto_dissolve_check_failed', 'warn', { error: e.message });
  }

  const finalResult = Object.assign({
    status: 'succeeded',
    autoDissolved
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
