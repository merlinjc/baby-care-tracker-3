/**
 * familyOperation 云函数错误码注册表
 * v4.3.0 FR-8：统一结构化错误码，客户端通过 error.code 可靠判断业务场景
 */

const makeError = (code, defaultMessage) => (extra) => ({
  success: false,
  error: {
    code,
    message: (extra && extra.message) || defaultMessage,
    context: extra && extra.context !== undefined ? extra.context : undefined
  }
});

module.exports = {
  USER_NOT_FOUND: makeError('USER_NOT_FOUND', '用户不存在'),
  FAMILY_NOT_FOUND: makeError('FAMILY_NOT_FOUND', '家庭不存在'),
  PERMISSION_DENIED: (msg) => ({
    success: false,
    error: { code: 'PERMISSION_DENIED', message: msg || '权限不足' }
  }),
  INVALID_CODE: makeError('INVALID_CODE', '邀请码无效'),
  CODE_EXPIRED: makeError('CODE_EXPIRED', '邀请码已过期'),
  ALREADY_MEMBER: makeError('ALREADY_MEMBER', '已经是家庭成员'),
  SOLE_ADMIN: makeError('SOLE_ADMIN', '您是当前家庭的唯一管理员，请先转让管理权限或解散旧家庭再加入新家庭'),
  CANNOT_REMOVE_SELF: makeError('CANNOT_REMOVE_SELF', '不能移除自己，请使用退出家庭功能'),
  CANNOT_REMOVE_ADMIN: makeError('CANNOT_REMOVE_ADMIN', '不能移除管理员，请先修改其权限'),
  NOT_MEMBER: makeError('NOT_MEMBER', '目标用户不是家庭成员'),
  NO_MEMBER_DATA: makeError('NO_MEMBER_DATA', '家庭成员数据不存在'),
  RATE_LIMITED: makeError('RATE_LIMITED', '操作过于频繁，请稍后再试'),
  INVALID_ACTION: (action) => ({
    success: false,
    error: { code: 'INVALID_ACTION', message: `未知操作: ${action}` }
  }),
  BUSY: makeError('BUSY', '操作并发冲突，请重试'),
  INTERNAL_ERROR: (err) => ({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: (err && err.message) || '服务器内部错误',
      stack: err && err.stack
    }
  }),

  /**
   * 成功返回构造器
   * @param {Object} data 业务数据
   * @returns {Object} { success: true, data }
   */
  ok(data) {
    return { success: true, data: data === undefined ? {} : data };
  }
};
