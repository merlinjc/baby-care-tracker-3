/**
 * action: getFamilyDetail
 *
 * [v4.3.2 FR-1] 家庭详情查询云函数化
 *
 * 背景：families.read 规则从 `auth != null` 收紧为 "成员或创建者" 后，
 * 客户端直连读取会被安全规则拒绝。提供云函数路径作为替代读路径。
 *
 * 权限：调用者必须是目标 family.members 或 family.creatorOpenid。
 * 返回：过滤掉 _openid 的 family 完整文档。
 *
 * 灰度期：T-7 先部署云函数 + 客户端带双路径；T0 收紧规则后 fallback 失效。
 */
const errors = require('../errors');
const { isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, userId, openid, logger } = ctx;
  const { familyId } = params || {};

  if (!familyId) {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'familyId 必填' }
    };
  }

  try {
    const res = await db.collection('families').doc(familyId).get();
    const family = res.data;
    if (!family) return errors.FAMILY_NOT_FOUND();

    // 成员判定：优先 userId（权威）；兼容历史场景按 creatorOpenid 放行
    const allowed = isMember(userId, family)
      || family.creatorId === userId
      || (openid && family.creatorOpenid === openid);

    if (!allowed) {
      // 不 logger.start（查询类高频操作，仅失败时 step）
      await logger.step('getFamilyDetail_denied', 'warn', {
        familyId, userId
      });
      return errors.PERMISSION_DENIED('无权访问该家庭');
    }

    // 过滤敏感系统字段
    const { _openid, ...safe } = family;
    return errors.ok(safe);
  } catch (err) {
    // CloudBase 文档不存在 → errCode -1 或 message 包含 not found
    const errMsg = (err && err.errMsg) || (err && err.message) || '';
    if (err && (err.errCode === -1 || /not exist|not found|cannot find document/i.test(errMsg))) {
      return errors.FAMILY_NOT_FOUND();
    }
    await logger.step('getFamilyDetail_error', 'fail', {
      familyId, error: errMsg
    });
    return errors.INTERNAL_ERROR(err);
  }
};
