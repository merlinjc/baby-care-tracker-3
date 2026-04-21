/**
 * action: deleteBaby
 *
 * [v4.3.1 FR-2 / FR-3] 改动：
 * - 权限收紧：仅 admin 可删除（原 isMember 允许 viewer/editor 删宝宝）
 * - 级联删除：同步删除 records / vaccine_records / milestone_records，避免孤儿数据
 * - 支持断点续传：大数据量时返回 { status: 'in_progress', cursor }，客户端携 cursor 续调
 *
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 *
 * 与 clearBabyData 的区别：
 * - clearBabyData：清空后若家庭无其他 baby 则解散家庭
 * - deleteBaby：仅删除该宝宝相关数据 + pull families.babies，家庭保留
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

  // [v4.3.1 FR-2] 权限收紧为 admin
  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能删除宝宝');
  }

  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  // 首次调用：初始化 state；否则从 cursor 恢复
  let state;
  if (!cursor) {
    await logger.start({ babyId, familyId });
    state = {
      phase: 'records',  // records → vaccine → milestone → finalize
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
      await logger.step('delete_records', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'vaccine';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 2: vaccine_records =====
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
      await logger.step('delete_vaccine', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'milestone';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 3: milestone_records =====
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
      await logger.step('delete_milestone', 'ok', { deleted });
      if (batch.data.length < CHUNK_SIZE) {
        state.phase = 'finalize';
        break;
      }
    }
    if (!budget()) return paused(state);
  }

  // ===== Phase 4: finalize — 删除 baby 文档 + pull families.babies =====
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

  const finalResult = Object.assign(
    { status: 'succeeded', deletedBabyId: babyId },
    state.totalCleared
  );
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
