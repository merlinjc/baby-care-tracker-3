/**
 * action: createFamily (FR-11 已于 v4.2.0 引入 memberOpenids)
 * v4.3.0 改动：
 * - 时间戳改用 Date（FR-13）
 * - 新增 updatedAtTs 双时间戳
 * v4.3.1 改动（FR-10）：
 * - 防止已在家庭中的用户绕过客户端重复创建，导致幽灵成员
 * - 用户已属有效家庭 → 返回 ALREADY_IN_FAMILY；幽灵引用 → 允许创建（顺带修复）
 * v4.3.2 改动（FR-5）：
 * - 显式声明：除 name 外，所有 creatorId/creatorName/creatorOpenid 入参一律 silent drop
 *   （由 ctx.user / ctx.userId / ctx.openid 权威构造，防止客户端伪造身份）
 * - 接入 logger.start/succeed/fail（FR-A12）
 */
const errors = require('../errors');
const { generateInviteCode } = require('../lib/invite-code');
const { getFamily } = require('../lib/family');

module.exports = async (ctx, params) => {
  const { db, user, userId, openid, logger } = ctx;
  // [v4.3.2 FR-5] 仅接收 name；creatorId/creatorName/creatorOpenid 即使客户端传入也忽略
  const { name } = params || {};
  const creatorName = (user && user.nickname) || '';

  await logger.start({ userId, name });

  try {
    // [v4.3.1 FR-10] 已在家庭中则拒绝（除非是幽灵引用）
    if (user && user.familyId) {
      const existing = await getFamily(db, user.familyId);
      if (existing && Array.isArray(existing.members) && existing.members.includes(userId)) {
        await logger.fail({ reason: 'ALREADY_IN_FAMILY' });
        return errors.ALREADY_IN_FAMILY();
      }
      // 幽灵引用（family 已删 或 当前用户已不在 members 中）→ 允许继续创建
    }

    const inviteCode = generateInviteCode();
    const now = new Date();
    const nowTs = Date.now();
    const inviteExpiry = new Date(nowTs + 7 * 24 * 60 * 60 * 1000);

    const familyData = {
      name,
      creatorId: userId,
      creatorName,
      members: [userId],
      memberDetails: [{
        userId,
        name: creatorName,
        role: 'admin',
        joinedAt: now
      }],
      memberOpenids: [openid],
      inviteCode,
      inviteCodeExpiry: inviteExpiry,
      createdAt: now,
      createdAtTs: nowTs,
      updatedAt: now,
      updatedAtTs: nowTs
    };

    const res = await db.collection('families').add({ data: familyData });

    await logger.succeed({ familyId: res._id, inviteCode });
    return errors.ok(Object.assign({ _id: res._id }, familyData));
  } catch (err) {
    await logger.fail(err);
    throw err;
  }
};
