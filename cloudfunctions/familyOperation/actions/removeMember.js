/**
 * action: removeMember (FR-3, FR-11)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-5）：
 * - targetOpenid 为空时不再执行 _.pull('') 的破坏性 no-op
 * v4.3.2 改动（FR-6 / FR-A12）：
 * - FR-6：限流扩面（10 次/分钟）
 * - FR-A12：补全 logger.start/succeed/fail 标准化（原只有 partial 场景的 logger）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid, logger, rateLimiter } = ctx;
  const { familyId, targetUserId } = params || {};

  // [v4.3.2 FR-6] 限流
  if (rateLimiter) {
    const limit = await rateLimiter.check(`remove_member_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  await logger.start({ familyId, targetUserId });

  try {
    const family = await getFamily(db, familyId);
    if (!family) {
      await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
      return errors.FAMILY_NOT_FOUND();
    }

    if (!isAdmin(userId, family)) {
      await logger.fail({ reason: 'PERMISSION_DENIED' });
      return errors.PERMISSION_DENIED('只有管理员才能移除成员');
    }
    if (userId === targetUserId) {
      await logger.fail({ reason: 'CANNOT_REMOVE_SELF' });
      return errors.CANNOT_REMOVE_SELF();
    }
    if (isAdmin(targetUserId, family)) {
      await logger.fail({ reason: 'CANNOT_REMOVE_ADMIN' });
      return errors.CANNOT_REMOVE_ADMIN();
    }

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
      await logger.step('missing_target_openid', 'skip', { targetUserId });
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
      await logger.step('clear_target_user', 'skip', { error: e && e.message });
    });

    await logger.succeed({ targetUserId, openidPulled: !!targetOpenid });
    return errors.ok({ removedUserId: targetUserId, openidPulled: !!targetOpenid });
  } catch (err) {
    await logger.fail(err);
    throw err;
  }
};
