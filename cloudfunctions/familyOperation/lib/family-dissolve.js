/**
 * [v4.3.2 FR-3] 家庭解散公共 lib
 *
 * 抽象 dissolveFamily action 的核心流程，供 deleteBaby（自动解散）复用。
 * 语义：清除所有成员的 users.familyId/familyRole → 删除 families 文档。
 *
 * 设计原则：
 * - 不处理权限校验（由调用方在上游完成 isAdmin / 调用场景保证）
 * - 不单独 start logger（由调用方在 action 入口 start，此处仅 step）
 * - 清用户失败仅记录 warning，不中断删家庭主流程（与 dissolveFamily 原行为一致）
 * - 失败时抛错由调用方 logger.fail 处理
 *
 * @param {Object} ctx familyOperation 通用 context（含 db/_）
 * @param {Object} family 家庭文档（必须包含 _id 和 members）
 * @param {Object} logger OperationLogger 实例
 * @returns {Promise<{dissolvedFamilyId: string, membersCleared: number, membersFailed: number}>}
 */
async function dissolveFamilyCore(ctx, family, logger) {
  const { db, _ } = ctx;
  const familyId = family._id;
  const now = new Date();
  const nowTs = Date.now();

  await logger.step('dissolve_start', 'ok', {
    familyId,
    memberCount: (family.members && family.members.length) || 0
  });

  // 1. 批量清除成员的 familyId/familyRole
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
      } catch (err) {
        membersFailed++;
        await logger.step(`clear_user_${memberId}`, 'fail', { error: err.message });
      }
    }
  }

  // 2. 删除 family 文档
  try {
    await db.collection('families').doc(familyId).remove();
    await logger.step('remove_family_doc', 'ok', { familyId });
  } catch (err) {
    await logger.step('remove_family_doc', 'fail', { error: err.message });
    throw err;
  }

  await logger.step('dissolve_done', 'ok', { familyId, membersCleared, membersFailed });

  return { dissolvedFamilyId: familyId, membersCleared, membersFailed };
}

module.exports = { dissolveFamilyCore };
