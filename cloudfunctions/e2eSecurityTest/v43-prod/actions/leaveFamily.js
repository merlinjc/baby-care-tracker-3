/**
 * action: leaveFamily (FR-7, FR-11)
 *
 * [v4.3.0 FR-5] 新契约（状态机）：
 * 所有分支均返回 success:true，业务状态由 data.status 表达：
 *   - 'ok'              正常退出
 *   - 'dissolved'       最后一人退出 → 家庭解散
 *   - 'family_not_found' 家庭已不存在（幂等）
 *   - 'not_member'      本就不是成员（幂等）
 *   - 'need_transfer'   唯一管理员需先转让 → 携带 otherMembers 供 UI 选择
 *
 * 兼容字段（过渡期保留）：
 *   legacy: familyNotFound / notMember / familyDissolved / needTransfer
 */
const errors = require('../errors');
const { getFamily, clearUserFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid } = ctx;
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) {
    return errors.ok({
      status: 'family_not_found',
      message: '家庭已不存在',
      // legacy
      familyNotFound: true
    });
  }

  if (!family.members || !family.members.includes(userId)) {
    return errors.ok({
      status: 'not_member',
      message: '您不是该家庭成员',
      // legacy
      notMember: true
    });
  }

  const adminRole = isAdmin(userId, family);
  const hasOtherAdmin = family.memberDetails &&
    family.memberDetails.some(m => m.role === 'admin' && m.userId !== userId);

  const now = new Date();
  const nowTs = Date.now();

  if (adminRole) {
    const otherMembers = family.members.filter(id => id !== userId);
    if (otherMembers.length > 0 && !hasOtherAdmin) {
      return errors.ok({
        status: 'need_transfer',
        otherMembers: (family.memberDetails || []).filter(m => m.userId !== userId),
        message: '您是唯一管理员，退出前请先转让管理员权限或解散家庭',
        // legacy
        needTransfer: true
      });
    }
    if (otherMembers.length === 0) {
      // 最后一个成员，解散家庭
      await db.collection('families').doc(familyId).remove();
      await clearUserFamily(db, _, userId);
      return errors.ok({
        status: 'dissolved',
        message: '家庭已解散',
        // legacy
        familyDissolved: true
      });
    }
  }

  // 正常退出
  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(userId),
      memberDetails: _.pull({ userId }),
      memberOpenids: _.pull(openid),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });
  await clearUserFamily(db, _, userId);

  return errors.ok({
    status: 'ok',
    message: '已退出家庭'
  });
};
