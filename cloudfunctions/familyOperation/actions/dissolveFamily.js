/**
 * action: dissolveFamily (FR-4)
 * v4.3.0 改动：
 * - 接入 OperationLogger 补偿日志（FR-9）
 * - 时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-9）：
 * - 权限判定改 isAdmin，兼容 transferAdmin 后的新 admin 解散家庭
 *   （原 creatorId === userId 不兼容"旧管理员转让后新管理员解散"场景）
 * v4.3.2 改动（FR-6 / FR-A12）：
 * - FR-6：限流扩面（5 次/分钟）
 * - FR-A12：logger 已有，补全 start/fail 标准化
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid, logger, rateLimiter } = ctx;
  const { familyId } = params || {};

  // [v4.3.2 FR-6] 限流
  if (rateLimiter) {
    const limit = await rateLimiter.check(`dissolve_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  const family = await getFamily(db, familyId);
  if (!family) {
    await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
    return errors.FAMILY_NOT_FOUND();
  }

  // [v4.3.1 FR-9] 改为 isAdmin（兼容多 admin 场景与 transferAdmin 后的新 admin）
  if (!isAdmin(userId, family)) {
    await logger.fail({ reason: 'PERMISSION_DENIED' });
    return errors.PERMISSION_DENIED('只有管理员才能解散家庭');
  }

  // [v4.3.0 FR-9] 启动补偿日志
  await logger.start({
    familyId,
    memberCount: (family.members && family.members.length) || 0
  });

  const now = new Date();
  const nowTs = Date.now();

  // 先删除家庭文档（其他成员读取时立即得到"不存在"）
  try {
    await db.collection('families').doc(familyId).remove();
    await logger.step('remove_family_doc', 'ok', { familyId });
  } catch (e) {
    await logger.step('remove_family_doc', 'fail', { error: e.message });
    throw e;
  }

  // 批量清除成员的 familyId/familyRole
  let membersCleared = 0;
  let membersFailed = 0;
  if (family.members && family.members.length > 0) {
    for (const memberId of family.members) {
      try {
        await db.collection('users').doc(memberId).update({
          data: {
            familyId: _.remove(),
            familyRole: _.remove(),
            updatedAt: now,
            updatedAtTs: nowTs
          }
        });
        membersCleared++;
        await logger.step(`clear_user_${memberId}`, 'ok');
      } catch (err) {
        membersFailed++;
        await logger.step(`clear_user_${memberId}`, 'fail', { error: err.message });
      }
    }
  }

  const result = { dissolvedFamilyId: familyId, membersCleared, membersFailed };
  if (membersFailed > 0) {
    await logger.partial(`${membersFailed} users failed to clear`);
  } else {
    await logger.succeed(result);
  }

  return errors.ok(result);
};
