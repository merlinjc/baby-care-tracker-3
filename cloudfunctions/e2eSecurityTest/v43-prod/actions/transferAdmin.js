/**
 * action: transferAdmin (FR-6)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.2 改动（FR-6 / FR-A10 / FR-A12）：
 * - FR-6：限流扩面（10 次/分钟）
 * - FR-A10：isMember 交叉校验（确保 newAdminId 是 family.members 的成员）
 *   原只校验 memberDetails.find → 若 members 与 memberDetails 不一致，
 *   可能把 admin 权限给一个不在 members 中的用户
 * - FR-A12：接入 logger.start/succeed/fail
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin, isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, userId, openid, logger, rateLimiter } = ctx;
  const { familyId, newAdminId } = params || {};

  // [v4.3.2 FR-6] 限流
  if (rateLimiter) {
    const limit = await rateLimiter.check(`transfer_admin_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  await logger.start({ familyId, newAdminId });

  try {
    const family = await getFamily(db, familyId);
    if (!family) {
      await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
      return errors.FAMILY_NOT_FOUND();
    }

    if (!isAdmin(userId, family)) {
      await logger.fail({ reason: 'PERMISSION_DENIED' });
      return errors.PERMISSION_DENIED('只有管理员才能转让管理员权限');
    }

    // [v4.3.2 FR-A10] isMember 交叉校验：确保目标用户在 members 中
    // 原只校验 memberDetails.find → 若 members 与 memberDetails 不一致时，可能给一个已退出的用户转让 admin
    if (!isMember(newAdminId, family)) {
      await logger.fail({ reason: 'TARGET_NOT_MEMBER' });
      return errors.NOT_MEMBER();
    }

    const newAdmin = family.memberDetails && family.memberDetails.find(m => m.userId === newAdminId);
    if (!newAdmin) {
      await logger.fail({ reason: 'TARGET_NOT_IN_MEMBER_DETAILS' });
      return errors.NOT_MEMBER();
    }

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
    }).catch((e) => logger.step('sync_old_admin_role_failed', 'warn', { error: e.message }));
    await db.collection('users').doc(newAdminId).update({
      data: { familyRole: 'admin', updatedAt: now, updatedAtTs: nowTs }
    }).catch((e) => logger.step('sync_new_admin_role_failed', 'warn', { error: e.message }));

    await logger.succeed({ oldAdminId: userId, newAdminId });
    return errors.ok({ oldAdminId: userId, newAdminId });
  } catch (err) {
    await logger.fail(err);
    throw err;
  }
};
