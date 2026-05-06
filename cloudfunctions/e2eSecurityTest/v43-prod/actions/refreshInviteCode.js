/**
 * action: refreshInviteCode (FR-8 补充)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.2 改动（FR-6 / FR-A11 / FR-A12）：
 * - FR-6：限流扩面（5 次/分钟，比其他操作更严格，防暴力猜测邀请码）
 * - FR-A11：冲突检测 — 生成后验证唯一性，冲突则重试（最多 3 次）
 *   6 位邀请码在家庭量 >50 万后理论冲突率不可忽视
 * - FR-A12：接入 logger.start/succeed/fail
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');
const { generateInviteCode } = require('../lib/invite-code');

const MAX_CODE_RETRY = 3;

module.exports = async (ctx, params) => {
  const { db, userId, openid, logger, rateLimiter } = ctx;
  const { familyId } = params || {};

  // [v4.3.2 FR-6] 限流（更严格：5 次/分钟）
  if (rateLimiter) {
    const limit = await rateLimiter.check(`refresh_code_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  await logger.start({ familyId });

  try {
    const family = await getFamily(db, familyId);
    if (!family) {
      await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
      return errors.FAMILY_NOT_FOUND();
    }

    if (!isAdmin(userId, family)) {
      await logger.fail({ reason: 'PERMISSION_DENIED' });
      return errors.PERMISSION_DENIED('只有管理员才能生成邀请码');
    }

    // [v4.3.2 FR-A11] 冲突检测 + 重试
    let inviteCode = null;
    for (let i = 0; i < MAX_CODE_RETRY; i++) {
      const candidate = generateInviteCode();
      const conflict = await db.collection('families')
        .where({ inviteCode: candidate })
        .count();
      if (conflict.total === 0) {
        inviteCode = candidate;
        break;
      }
      await logger.step('invite_code_conflict', 'warn', { attempt: i + 1, code: candidate });
    }
    if (!inviteCode) {
      await logger.fail({ reason: 'INVITE_CODE_CONFLICT', retries: MAX_CODE_RETRY });
      return errors.INTERNAL_ERROR(new Error('邀请码生成冲突，请稍后重试'));
    }

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

    await logger.succeed({ inviteCode });
    return errors.ok({ inviteCode });
  } catch (err) {
    await logger.fail(err);
    throw err;
  }
};
