/**
 * action: dissolveFamily (FR-4)
 * v4.3.0 改动：
 * - 接入 OperationLogger 补偿日志（FR-9）
 * - 时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');

module.exports = async (ctx, params) => {
  const { db, _, userId, logger } = ctx;
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (family.creatorId !== userId) {
    return errors.PERMISSION_DENIED('只有创建者才能解散家庭');
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
