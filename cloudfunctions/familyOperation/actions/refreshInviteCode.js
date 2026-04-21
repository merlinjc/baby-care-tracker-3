/**
 * action: refreshInviteCode (FR-8 补充)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');
const { generateInviteCode } = require('../lib/invite-code');

module.exports = async (ctx, params) => {
  const { db, userId } = ctx;
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能生成邀请码');
  }

  const inviteCode = generateInviteCode();
  const now = new Date();
  const nowTs = Date.now();
  const inviteExpiry = new Date(nowTs + 7 * 24 * 60 * 60 * 1000);

  await db.collection('families').doc(familyId).update({
    data: {
      inviteCode,
      inviteCodeExpiry: inviteExpiry,
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  return errors.ok({ inviteCode });
};
