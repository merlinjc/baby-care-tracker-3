/**
 * action: createFamily (FR-11 已于 v4.2.0 引入 memberOpenids)
 * v4.3.0 改动：
 * - 时间戳改用 Date（FR-13）
 * - 新增 updatedAtTs 双时间戳
 */
const errors = require('../errors');
const { generateInviteCode } = require('../lib/invite-code');

module.exports = async (ctx, params) => {
  const { db, user, userId, openid } = ctx;
  const { name } = params;
  const creatorName = (user && user.nickname) || '';

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

  return errors.ok(Object.assign({ _id: res._id }, familyData));
};
