/**
 * action: joinFamily (FR-2, FR-11)
 * v4.3.0 改动：
 * - 持久化限流替代内存 Map（FR-11 使用 ctx.rateLimiter）
 * - 时间戳改用 Date（FR-13）
 */
const errors = require('../errors');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid, rateLimiter } = ctx;
  const { inviteCode, userName, relation } = params;

  // [v4.3.0 FR-11] 持久化限流（60s 内最多 5 次）
  const limitKey = `invite_${openid}`;
  const limit = await rateLimiter.check(limitKey);
  if (!limit.allowed) {
    return errors.RATE_LIMITED();
  }

  // 1. 查询家庭
  const familyRes = await db.collection('families')
    .where({ inviteCode: String(inviteCode || '').toUpperCase() })
    .get();

  if (familyRes.data.length === 0) {
    return errors.INVALID_CODE();
  }

  const family = familyRes.data[0];
  const now = new Date();
  const nowTs = Date.now();

  // 2. 检查过期（inviteCodeExpiry 可能是 Date 或 ISO 字符串）
  if (family.inviteCodeExpiry) {
    const expireAt = family.inviteCodeExpiry instanceof Date
      ? family.inviteCodeExpiry
      : new Date(family.inviteCodeExpiry);
    if (expireAt < now) return errors.CODE_EXPIRED();
  }

  // 3. 检查是否已是成员
  if (family.members && family.members.includes(userId)) {
    return errors.ALREADY_MEMBER();
  }

  // 4. [v4.1 FR-9] 幽灵成员防护
  const existingFamilyRes = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();

  if (existingFamilyRes.data.length > 0) {
    const existingFamily = existingFamilyRes.data[0];
    if (existingFamily._id !== family._id) {
      const memberDetail = existingFamily.memberDetails &&
        existingFamily.memberDetails.find(m => m.userId === userId);
      const isAdminRole = memberDetail && memberDetail.role === 'admin';
      const hasOtherAdmin = existingFamily.memberDetails &&
        existingFamily.memberDetails.some(m => m.role === 'admin' && m.userId !== userId);

      if (isAdminRole && !hasOtherAdmin) {
        return errors.SOLE_ADMIN();
      }

      // 从旧家庭移除
      await db.collection('families').doc(existingFamily._id).update({
        data: {
          members: _.pull(userId),
          memberDetails: _.pull({ userId }),
          memberOpenids: _.pull(openid),
          updatedAt: now,
          updatedAtTs: nowTs
        }
      });

      // 清除用户的旧家庭信息
      await db.collection('users').doc(userId).update({
        data: {
          familyId: _.remove(),
          familyRole: _.remove(),
          updatedAt: now,
          updatedAtTs: nowTs
        }
      });
    }
  }

  // 5. 加入新家庭
  const newMemberDetail = {
    userId,
    name: userName,
    relation: relation || '家人',
    role: 'editor',
    joinedAt: now
  };

  await db.collection('families').doc(family._id).update({
    data: {
      members: _.push(userId),
      memberDetails: _.push(newMemberDetail),
      memberOpenids: _.push(openid),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  // 6. 更新用户 familyId
  await db.collection('users').doc(userId).update({
    data: {
      familyId: family._id,
      familyRole: 'editor',
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  return errors.ok({ familyId: family._id, familyName: family.name });
};
