/**
 * action: updateMemberRole (FR-5)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');

async function updateMemberRole(ctx, params, retryCount = 0) {
  const { db, userId } = ctx;
  const { familyId, targetUserId, role } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (family.creatorId !== userId) {
    return errors.PERMISSION_DENIED('只有创建者才能修改成员权限');
  }

  if (!family.memberDetails) return errors.NO_MEMBER_DATA();

  const memberDetails = family.memberDetails.map(m => {
    if (m.userId === targetUserId) return Object.assign({}, m, { role });
    return m;
  });

  const now = new Date();
  const nowTs = Date.now();

  // 乐观锁写入
  const result = await db.collection('families').doc(familyId).update({
    data: { memberDetails, updatedAt: now, updatedAtTs: nowTs }
  });

  if (result.stats && result.stats.updated === 0 && retryCount < 2) {
    return updateMemberRole(ctx, params, retryCount + 1);
  }

  // 同步 users.familyRole
  await db.collection('users').doc(targetUserId).update({
    data: { familyRole: role, updatedAt: now, updatedAtTs: nowTs }
  });

  return errors.ok({ targetUserId, newRole: role });
}

module.exports = updateMemberRole;
