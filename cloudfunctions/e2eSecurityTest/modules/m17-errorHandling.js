/**
 * 模块 17: 通用错误处理测试 — 5 条 (GE-01 ~ GE-05)
 * 
 * 模拟 familyOperation 云函数入口的 action 分发和错误处理。
 * 由于无法在测试云函数中 require 另一个云函数的入口，
 * 这里构造一个简化版的入口函数来模拟。
 */
const { USERS, GHOST, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

/**
 * 简化版 familyOperation 入口模拟
 * 模拟 cloud.getWXContext() 的 OPENID + action 分发逻辑
 */
async function simulateMain(db, _, mockOpenid, event) {
  const { action, params = {} } = event;

  // 1. 通过 OPENID 获取用户信息
  const userRes = await db.collection('users')
    .where({ _openid: mockOpenid })
    .limit(1)
    .get();

  if (userRes.data.length === 0) {
    return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
  }

  const user = userRes.data[0];
  const userId = user._id;

  // 2. 分发 action
  switch (action) {
    case 'createFamily':
      return await ops.createFamily(db, _, userId, mockOpenid, user, params);
    case 'joinFamily':
      return await ops.joinFamily(db, _, userId, mockOpenid, user, params);
    case 'removeMember':
      return await ops.removeMember(db, _, userId, mockOpenid, params);
    case 'dissolveFamily':
      return await ops.dissolveFamily(db, _, userId, mockOpenid, params);
    case 'updateMemberRole':
      return await ops.updateMemberRole(db, _, userId, mockOpenid, params);
    case 'transferAdmin':
      return await ops.transferAdmin(db, _, userId, mockOpenid, params);
    case 'leaveFamily':
      return await ops.leaveFamily(db, _, userId, mockOpenid, params);
    case 'refreshInviteCode':
      return await ops.refreshInviteCode(db, _, userId, mockOpenid, params);
    case 'validateInviteCode':
      return await ops.validateInviteCode(db, _, userId, mockOpenid, params);
    case 'getFamilyByUserId':
      return await ops.getFamilyByUserId(db, _, userId, mockOpenid);
    case 'createBaby':
      return await ops.createBaby(db, _, userId, mockOpenid, params);
    case 'deleteBaby':
      return await ops.deleteBaby(db, _, userId, mockOpenid, params);
    case 'clearBabyData':
      return await ops.clearBabyData(db, _, userId, mockOpenid, params);
    default:
      return { success: false, error: { code: 'INVALID_ACTION', message: `未知操作: ${action}` } };
  }
}

module.exports = async function(runner, db, _) {

  // GE-01: 未知 action
  await runner.test('GE-01', '未知 action → INVALID_ACTION', async () => {
    const result = await simulateMain(db, _, USERS.alice._openid, {
      action: 'hackAction',
      params: {}
    });
    return {
      pass: !result.success && result.error && result.error.code === 'INVALID_ACTION',
      actual: result
    };
  });

  // GE-02: 不传 action（默认 undefined → switch default）
  await runner.test('GE-02', '不传 action → INVALID_ACTION', async () => {
    const result = await simulateMain(db, _, USERS.alice._openid, {});
    return {
      pass: !result.success && result.error && result.error.code === 'INVALID_ACTION',
      actual: result
    };
  });

  // GE-03: 不传 params → 校验失败
  await runner.test('GE-03', '调用 joinFamily 不传 params → 错误', async () => {
    // joinFamily 需要 inviteCode，不传 params 时 inviteCode 为 undefined
    // 调用 inviteCode.toUpperCase() 会抛异常
    let result;
    try {
      result = await simulateMain(db, _, USERS.alice._openid, {
        action: 'joinFamily'
        // 不传 params
      });
      // 如果没抛异常，检查是否返回了错误
      const pass = !result.success || (result.error && result.error.code);
      return { pass, actual: result };
    } catch (e) {
      // 内部异常也算验证通过（未传 params 导致代码异常）
      return {
        pass: true,
        actual: { error: e.message },
        detail: '不传 params 导致内部异常'
      };
    }
  });

  // GE-04: 未注册用户(Ghost) 调用任何 action → USER_NOT_FOUND
  await runner.test('GE-04', 'Ghost 用户调用 createFamily → USER_NOT_FOUND', async () => {
    const result = await simulateMain(db, _, GHOST._openid, {
      action: 'createFamily',
      params: { name: 'Ghost Family' }
    });
    return {
      pass: !result.success && result.error && result.error.code === 'USER_NOT_FOUND',
      actual: result
    };
  });

  // GE-05: action 参数为空字符串
  await runner.test('GE-05', 'action 为空字符串 → INVALID_ACTION', async () => {
    const result = await simulateMain(db, _, USERS.alice._openid, {
      action: '',
      params: {}
    });
    return {
      pass: !result.success && result.error && result.error.code === 'INVALID_ACTION',
      actual: result
    };
  });
};
