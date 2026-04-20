/**
 * action: validateInviteCode (FR-12)
 */
const errors = require('../errors');

module.exports = async (ctx, params) => {
  const { db } = ctx;
  const { inviteCode } = params;

  const familyRes = await db.collection('families')
    .where({ inviteCode: String(inviteCode || '').toUpperCase() })
    .get();

  if (familyRes.data.length === 0) {
    return errors.ok({ valid: false, reason: '邀请码无效' });
  }

  const family = familyRes.data[0];
  if (family.inviteCodeExpiry) {
    const expireAt = family.inviteCodeExpiry instanceof Date
      ? family.inviteCodeExpiry
      : new Date(family.inviteCodeExpiry);
    if (expireAt < new Date()) {
      return errors.ok({ valid: false, reason: '邀请码已过期' });
    }
  }

  return errors.ok({
    valid: true,
    familyId: family._id,
    familyName: family.name,
    memberCount: (family.members && family.members.length) || 0,
    creatorName: family.creatorName || ''
  });
};
