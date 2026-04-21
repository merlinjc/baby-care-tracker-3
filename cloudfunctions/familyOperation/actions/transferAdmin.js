/**
 * action: transferAdmin (FR-6)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, userId } = ctx;
  const { familyId, newAdminId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能转让管理员权限');
  }

  const newAdmin = family.memberDetails && family.memberDetails.find(m => m.userId === newAdminId);
  if (!newAdmin) return errors.NOT_MEMBER();

  const memberDetails = family.memberDetails.map(m => {
    if (m.userId === userId) return Object.assign({}, m, { role: 'editor' });
    if (m.userId === newAdminId) return Object.assign({}, m, { role: 'admin' });
    return m;
  });

  const now = new Date();
  const nowTs = Date.now();

  await db.collection('families').doc(familyId).update({
    data: { memberDetails, creatorId: newAdminId, updatedAt: now, updatedAtTs: nowTs }
  });

  // 同步双方 familyRole
  await db.collection('users').doc(userId).update({
    data: { familyRole: 'editor', updatedAt: now, updatedAtTs: nowTs }
  });
  await db.collection('users').doc(newAdminId).update({
    data: { familyRole: 'admin', updatedAt: now, updatedAtTs: nowTs }
  });

  return errors.ok({ oldAdminId: userId, newAdminId });
};
