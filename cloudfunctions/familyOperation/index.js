/**
 * familyOperation 云函数入口（v4.3.0 重构）
 *
 * 职责：
 * - 入口鉴权（通过 openid 查用户）
 * - 构造 ctx 上下文（含 logger / rateLimiter 等）
 * - action 分发到 actions/<name>.js
 * - 全局异常捕获 + 错误日志
 *
 * 详细 action 实现见 actions/ 目录
 * 工具函数见 lib/ 目录
 * 错误码见 errors.js
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const errors = require('./errors');
const { getUserFromOpenid } = require('./lib/auth');
const { OperationLogger } = require('./lib/logger');
const { RateLimiter } = require('./lib/rate-limit');

// action 注册表
const actions = {
  createFamily: require('./actions/createFamily'),
  joinFamily: require('./actions/joinFamily'),
  removeMember: require('./actions/removeMember'),
  dissolveFamily: require('./actions/dissolveFamily'),
  updateMemberRole: require('./actions/updateMemberRole'),
  transferAdmin: require('./actions/transferAdmin'),
  leaveFamily: require('./actions/leaveFamily'),
  refreshInviteCode: require('./actions/refreshInviteCode'),
  validateInviteCode: require('./actions/validateInviteCode'),
  getFamilyByUserId: require('./actions/getFamilyByUserId'),
  createBaby: require('./actions/createBaby'),
  deleteBaby: require('./actions/deleteBaby'),
  clearBabyData: require('./actions/clearBabyData')
};

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, params = {} } = event || {};

  // 构造 logger（延迟 start；start 由具体 action 决定是否开启）
  const logger = new OperationLogger(db, action, '', OPENID);
  const rateLimiter = new RateLimiter(db);

  try {
    // 1. 通过 openid 查用户
    const user = await getUserFromOpenid(db, OPENID);
    if (!user) return errors.USER_NOT_FOUND();

    const userId = user._id;
    logger.userId = userId; // 更新 logger 的 userId

    // 2. 分发 action
    const handler = actions[action];
    if (!handler) return errors.INVALID_ACTION(action);

    const ctx = {
      db, _, user, userId, openid: OPENID,
      logger, rateLimiter
    };
    return await handler(ctx, params);
  } catch (error) {
    console.error(`[familyOperation] action=${action} error:`, error);
    await logger.fail(error);
    return errors.INTERNAL_ERROR(error);
  }
};
