/**
 * 模块 6: createFamily 测试 — 5 条 (CF-01 ~ CF-05)
 */
const { USERS, GHOST, buildFamilies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {

  // 辅助：清理 frank 创建的测试家庭
  async function cleanupCreatedFamilies() {
    const res = await db.collection('families').where({ creatorId: USERS.frank._id }).limit(10).get();
    for (const f of res.data) {
      await db.collection('families').doc(f._id).remove().catch(() => {});
    }
    // 恢复 frank 无家庭状态
    await db.collection('users').doc(USERS.frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});
  }

  // CF-01: 正常创建家庭
  await runner.test('CF-01', 'Frank 创建家庭 → 成功，返回 familyData + memberOpenids', async () => {
    await cleanupCreatedFamilies();
    const result = await ops.createFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      name: 'Frank Test Family'
    });
    const pass = result.success === true
      && result.data
      && result.data._id
      && result.data.memberOpenids
      && result.data.memberOpenids.includes(USERS.frank._openid)
      && result.data.members && result.data.members.includes(USERS.frank._id);
    // 清理
    if (result.data && result.data._id) {
      await db.collection('families').doc(result.data._id).remove().catch(() => {});
    }
    return { pass, actual: result };
  });

  // CF-02: Ghost 用户创建 → 函数层面不拦截（USER_NOT_FOUND 由入口层检查）
  await runner.test('CF-02', 'Ghost 用户调用 createFamily → 成功（函数不校验用户存在）', async () => {
    const result = await ops.createFamily(db, _, GHOST._id, GHOST._openid, { nickname: 'Ghost' }, {
      name: 'Ghost Family'
    });
    // createFamily 本身不校验 user 是否在 users 集合中（由入口层检查）
    const pass = result.success === true;
    if (result.data && result.data._id) {
      await db.collection('families').doc(result.data._id).remove().catch(() => {});
    }
    return { pass, actual: result, detail: '入口层 USER_NOT_FOUND 在 m17 测试' };
  });

  // CF-03: 不传 name
  await runner.test('CF-03', '不传 name 创建家庭 → 成功但 name 为 undefined', async () => {
    const result = await ops.createFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {});
    const pass = result.success === true && result.data && result.data.name === undefined;
    if (result.data && result.data._id) {
      await db.collection('families').doc(result.data._id).remove().catch(() => {});
    }
    return { pass, actual: { name: result.data && result.data.name } };
  });

  // CF-04: 邀请码格式验证
  await runner.test('CF-04', '邀请码格式：6 位，仅含 ABCDEFGHJKLMNPQRSTUVWXYZ23456789', async () => {
    const result = await ops.createFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      name: 'Code Test'
    });
    const code = result.data && result.data.inviteCode;
    const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    const pass = code && validChars.test(code);
    if (result.data && result.data._id) {
      await db.collection('families').doc(result.data._id).remove().catch(() => {});
    }
    return { pass, actual: { inviteCode: code } };
  });

  // CF-05: 过期时间约 7 天后
  await runner.test('CF-05', 'inviteCodeExpiry ≈ now + 7 天', async () => {
    const before = Date.now();
    const result = await ops.createFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      name: 'Expiry Test'
    });
    const after = Date.now();
    const expiry = result.data && new Date(result.data.inviteCodeExpiry).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    // 允许 10 秒误差
    const pass = expiry >= before + sevenDays - 10000 && expiry <= after + sevenDays + 10000;
    if (result.data && result.data._id) {
      await db.collection('families').doc(result.data._id).remove().catch(() => {});
    }
    return { pass, actual: { inviteCodeExpiry: result.data && result.data.inviteCodeExpiry } };
  });
};
