/**
 * action: removeMember (FR-3, FR-11)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId } = ctx;
  const { familyId, targetUserId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) return errors.PERMISSION_DENIED('只有管理员才能移除成员');
  if (userId === targetUserId) return errors.CANNOT_REMOVE_SELF();
  if (isAdmin(targetUserId, family)) return errors.CANNOT_REMOVE_ADMIN();

  const now = new Date();
  const nowTs = Date.now();

  // 获取被移除用户的 openid
  const targetUser = await db.collection('users').doc(targetUserId).get();
  const targetOpenid = targetUser.data && targetUser.data._openid;

  // pull 成员 + memberOpenids
  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(targetUserId),
      memberDetails: _.pull({ userId: targetUserId }),
      memberOpenids: targetOpenid ? _.pull(targetOpenid) : _.pull(''),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  // 清除被移除用户的家庭信息
  await db.collection('users').doc(targetUserId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  return errors.ok({ removedUserId: targetUserId });
};
