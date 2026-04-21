/**
 * action: updateRecord
 *
 * [v4.3.2 FR-2] 跨归属记录更新云函数化
 *
 * 背景：records 安全规则仅允许 `doc._openid === auth.openid`（自己创建的记录）写。
 * admin 跨归属编辑他人记录时，客户端直连被规则拒，但本地缓存已改 → 数据不一致。
 *
 * 客户端策略：`record._openid === my_openid` 时走直连（99% 场景，保持原性能）；
 *             跨归属或归属未知时走云函数（本 action）。
 *
 * 权限：
 * - 必须是 record.familyId 的成员
 * - admin 可编辑任何人的记录
 * - editor 只能编辑自己创建的记录（isOwnRecord 判定）
 * - viewer 禁止编辑
 *
 * 字段白名单：仅允许 data / startTime* / endTime* / note / recordType 被更新；
 * 系统字段（_openid / _id / createdBy / familyId / babyId / creatorId 等）拒绝篡改。
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember, getUserRole } = require('../lib/auth');

// 允许客户端通过云函数修改的字段白名单
const ALLOWED_FIELDS = [
  'data', 'startTime', 'endTime', 'startTimeTs', 'endTimeTs',
  'note', 'recordType'
];

module.exports = async (ctx, params) => {
  const { db, userId, logger } = ctx;
  const { recordId, familyId, data: patch } = params || {};

  if (!recordId || !familyId || !patch || typeof patch !== 'object') {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'recordId / familyId / data 必填' }
    };
  }

  await logger.start({ recordId, familyId });

  // 1. 记录存在性 + 归属校验
  let rec;
  try {
    const res = await db.collection('records').doc(recordId).get();
    rec = res && res.data;
  } catch (err) {
    const errMsg = (err && err.errMsg) || (err && err.message) || '';
    if (err && (err.errCode === -1 || /not exist|not found|cannot find document/i.test(errMsg))) {
      await logger.fail({ reason: 'RECORD_NOT_FOUND' });
      return errors.RECORD_NOT_FOUND();
    }
    await logger.fail(err);
    return errors.INTERNAL_ERROR(err);
  }
  if (!rec) {
    await logger.fail({ reason: 'RECORD_NOT_FOUND' });
    return errors.RECORD_NOT_FOUND();
  }
  if (rec.familyId !== familyId) {
    await logger.fail({ reason: 'CROSS_FAMILY', recFamilyId: rec.familyId });
    return errors.PERMISSION_DENIED('跨家庭操作');
  }

  // 2. 家庭成员校验
  const family = await getFamily(db, familyId);
  if (!family) {
    await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
    return errors.FAMILY_NOT_FOUND();
  }
  if (!isMember(userId, family)) {
    await logger.fail({ reason: 'NOT_MEMBER' });
    return errors.PERMISSION_DENIED();
  }

  // 3. 角色与归属判定
  const role = getUserRole(userId, family);
  const isOwnRecord = (rec.createdBy && rec.createdBy.userId === userId)
    || rec.creatorId === userId;

  if (role === 'viewer') {
    await logger.fail({ reason: 'VIEWER_DENIED' });
    return errors.PERMISSION_DENIED('查看者无权编辑');
  }
  if (role === 'editor' && !isOwnRecord) {
    await logger.fail({ reason: 'EDITOR_NOT_OWN' });
    return errors.PERMISSION_DENIED('无权编辑他人记录');
  }

  // 4. 字段白名单过滤（拒绝 _openid/_id/createdBy/familyId 等系统字段篡改）
  const safePatch = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in patch) safePatch[k] = patch[k];
  }
  const nowTs = Date.now();
  safePatch.updatedAt = new Date();
  safePatch.updatedAtTs = nowTs;

  // 5. 执行更新
  try {
    await db.collection('records').doc(recordId).update({ data: safePatch });
    await logger.succeed({ recordId, updatedAtTs: nowTs });
    return errors.ok({ recordId, updatedAtTs: nowTs });
  } catch (err) {
    await logger.fail(err);
    return errors.INTERNAL_ERROR(err);
  }
};
