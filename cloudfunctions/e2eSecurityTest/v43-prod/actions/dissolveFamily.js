/**
 * action: dissolveFamily (FR-4)
 * v4.3.0 改动：
 * - 接入 OperationLogger 补偿日志（FR-9）
 * - 时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-9）：
 * - 权限判定改 isAdmin，兼容 transferAdmin 后的新 admin 解散家庭
 *   （原 creatorId === userId 不兼容"旧管理员转让后新管理员解散"场景）
 * v4.3.2 改动（FR-6 / FR-A12 / T-3.21）：
 * - FR-6：限流扩面（5 次/分钟）
 * - FR-A12：logger 已有，补全 start/fail 标准化
 * - T-3.21：核心流程复用 dissolveFamilyCore，消除重复代码
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');
const { dissolveFamilyCore } = require('../lib/family-dissolve');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid, logger, rateLimiter } = ctx;
  const { familyId } = params || {};

  // [v4.3.2 FR-6] 限流
  if (rateLimiter) {
    const limit = await rateLimiter.check(`dissolve_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  const family = await getFamily(db, familyId);
  if (!family) {
    await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
    return errors.FAMILY_NOT_FOUND();
  }

  // [v4.3.1 FR-9] 改为 isAdmin（兼容多 admin 场景与 transferAdmin 后的新 admin）
  if (!isAdmin(userId, family)) {
    await logger.fail({ reason: 'PERMISSION_DENIED' });
    return errors.PERMISSION_DENIED('只有管理员才能解散家庭');
  }

  // [v4.3.0 FR-9] 启动补偿日志
  await logger.start({
    familyId,
    memberCount: (family.members && family.members.length) || 0
  });

  // [v4.3.2 T-3.21] 核心流程复用 dissolveFamilyCore
  try {
    const result = await dissolveFamilyCore(ctx, family, logger);
    await logger.succeed(result);
    return errors.ok(result);
  } catch (e) {
    await logger.fail({ reason: 'DISSOLVE_CORE_FAILED', error: e.message });
    throw e;
  }
};
