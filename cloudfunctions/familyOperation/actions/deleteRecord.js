/**
 * action: deleteRecord
 *
 * [v4.3.2 FR-2] 跨归属记录删除云函数化
 *
 * 权限：
 * - 必须是 record.familyId 的成员
 * - admin 可删除任何人的记录
 * - editor 只能删除自己创建的记录
 * - viewer 禁止删除
 *
 * 幂等性：目标文档不存在时视为已删除成功（返回 RECORD_NOT_FOUND，
 * 客户端应走"本地已删"分支，不再入队）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember, getUserRole } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, userId, logger } = ctx;
  const { recordId, familyId } = params || {};

  if (!recordId || !familyId) {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'recordId / familyId 必填' }
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
      await logger.succeed({ reason: 'RECORD_ALREADY_DELETED' });
      return errors.RECORD_NOT_FOUND();
    }
    await logger.fail(err);
    return errors.INTERNAL_ERROR(err);
  }
  if (!rec) {
    // 幂等：目标已不存在视为成功
    await logger.succeed({ reason: 'RECORD_ALREADY_DELETED' });
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
    return errors.PERMISSION_DENIED('查看者无权删除');
  }
  if (role === 'editor' && !isOwnRecord) {
    await logger.fail({ reason: 'EDITOR_NOT_OWN' });
    return errors.PERMISSION_DENIED('无权删除他人记录');
  }
  // admin + 任何记录 / editor + 自己记录 → 放行

  // 4. 执行删除
  try {
    await db.collection('records').doc(recordId).remove();
    await logger.succeed({ recordId });
    return errors.ok({ recordId });
  } catch (err) {
    await logger.fail(err);
    return errors.INTERNAL_ERROR(err);
  }
};
