/**
 * action: removeMember (FR-3, FR-11)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-5）：
 * - targetOpenid 为空时不再执行 _.pull('') 的破坏性 no-op（原实现会使被移除用户的
 *   openid 残留在 memberOpenids 中，仍能读取家庭数据）
 * - 改为跳过 memberOpenids 更新 + 写 operation_logs 告警，由 patrolMemberOpenids 后续巡检修复
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId, logger } = ctx;
  const { familyId, targetUserId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) return errors.PERMISSION_DENIED('只有管理员才能移除成员');
  if (userId === targetUserId) return errors.CANNOT_REMOVE_SELF();
  if (isAdmin(targetUserId, family)) return errors.CANNOT_REMOVE_ADMIN();

  const now = new Date();
  const nowTs = Date.now();

  // 获取被移除用户的 openid（文档可能已不存在）
  const targetUserDoc = await db.collection('users').doc(targetUserId).get().catch(() => null);
  const targetOpenid = targetUserDoc && targetUserDoc.data && targetUserDoc.data._openid;

  // [v4.3.1 FR-5] 构造差异化更新数据
  const updateData = {
    members: _.pull(targetUserId),
    memberDetails: _.pull({ userId: targetUserId }),
    updatedAt: now,
    updatedAtTs: nowTs
  };

  if (targetOpenid) {
    updateData.memberOpenids = _.pull(targetOpenid);
  } else {
    // 目标用户文档丢失 / _openid 为空：不触碰 memberOpenids，避免误操作
    await logger.start({ familyId, targetUserId });
    await logger.step('missing_target_openid', 'skip', { targetUserId });
    // 不立即 succeed，让后续写入完成后统一 succeed
  }

  // pull 成员 + memberDetails（+ 可能的 memberOpenids）
  await db.collection('families').doc(familyId).update({ data: updateData });

  // 清除被移除用户的家庭信息
  await db.collection('users').doc(targetUserId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  }).catch(async (e) => {
    // 目标用户文档可能已删除，忽略即可
    await logger.step('clear_target_user', 'skip', { error: e && e.message });
  });

  if (!targetOpenid) {
    await logger.succeed({ targetUserId, reason: 'missing_openid_left_for_patrol' });
  }

  return errors.ok({ removedUserId: targetUserId, openidPulled: !!targetOpenid });
};
