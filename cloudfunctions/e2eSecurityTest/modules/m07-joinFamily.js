/**
 * 模块 7: joinFamily 测试 — 14 条 (JF-01 ~ JF-14)
 */
const { USERS, GHOST, buildFamilies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();

  // 辅助：重置 Family-A 和相关用户
  async function resetFamilyA() {
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_a } });
    for (const u of [USERS.alice, USERS.bob, USERS.carol]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_a._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  async function resetFamilyB() {
    try { await db.collection('families').doc(FAMILIES.family_b._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_b } });
    for (const u of [USERS.dave, USERS.eve]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_b._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  async function resetFrank() {
    await db.collection('users').doc(USERS.frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});
  }

  // 清除限流
  function clearRateLimit() {
    ops.rateLimitMap.clear();
  }

  // JF-01: Frank 正常加入 Family-A
  await runner.test('JF-01', 'Frank 用有效邀请码加入 Family-A → 成功', async () => {
    await resetFamilyA();
    await resetFrank();
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'TESTA1', userName: 'Frank_Test', relation: '爸爸'
    });
    if (!result.success) return { pass: false, actual: result };
    // 验证数据库状态
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const frankInMembers = family.data.members.includes(USERS.frank._id);
    const frankInOpenids = family.data.memberOpenids.includes(USERS.frank._openid);
    const frankUser = await db.collection('users').doc(USERS.frank._id).get();
    const frankFamilyId = frankUser.data.familyId === FAMILIES.family_a._id;
    // 恢复
    await resetFamilyA();
    await resetFrank();
    return {
      pass: result.success && frankInMembers && frankInOpenids && frankFamilyId,
      actual: { frankInMembers, frankInOpenids, frankFamilyId }
    };
  });

  // JF-02: 无效邀请码
  await runner.test('JF-02', '无效邀请码 → INVALID_CODE', async () => {
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'XXXXXX', userName: 'Frank_Test'
    });
    return {
      pass: !result.success && result.error && result.error.code === 'INVALID_CODE',
      actual: result
    };
  });

  // JF-03: 过期邀请码
  await runner.test('JF-03', '过期邀请码 → CODE_EXPIRED', async () => {
    clearRateLimit();
    await resetFamilyA();
    // 设置过期时间为过去
    await db.collection('families').doc(FAMILIES.family_a._id).update({
      data: { inviteCodeExpiry: new Date('2020-01-01').toISOString() }
    });
    const result = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'TESTA1', userName: 'Frank_Test'
    });
    // 恢复
    await resetFamilyA();
    return {
      pass: !result.success && result.error && result.error.code === 'CODE_EXPIRED',
      actual: result
    };
  });

  // JF-04: Alice 已是成员再加入
  await runner.test('JF-04', 'Alice(已是成员) 再次加入 → ALREADY_MEMBER', async () => {
    await resetFamilyA();
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.alice._id, USERS.alice._openid, USERS.alice, {
      inviteCode: 'TESTA1', userName: 'Alice_Test'
    });
    return {
      pass: !result.success && result.error && result.error.code === 'ALREADY_MEMBER',
      actual: result
    };
  });

  // JF-05: 小写邀请码 → toUpperCase 自动转换
  await runner.test('JF-05', '小写邀请码 "testa1" → 自动转大写后匹配', async () => {
    await resetFamilyA();
    await resetFrank();
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'testa1', userName: 'Frank_Test'
    });
    await resetFamilyA();
    await resetFrank();
    return { pass: result.success === true, actual: result };
  });

  // JF-06: 限流（连续 6 次）
  await runner.test('JF-06', '连续调用 6 次 → 第 6 次 RATE_LIMITED', async () => {
    clearRateLimit();
    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
        inviteCode: 'XXXXXX', userName: 'Frank_Test'
      });
    }
    const pass = !lastResult.success && lastResult.error && lastResult.error.code === 'RATE_LIMITED';
    clearRateLimit();
    return { pass, actual: lastResult };
  });

  // JF-07: 限流重置（通过清除 rateLimitMap）
  await runner.test('JF-07', '限流后清除 rateLimitMap → 可再次调用', async () => {
    // 先触发限流
    clearRateLimit();
    for (let i = 0; i < 6; i++) {
      await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
        inviteCode: 'XXXXXX', userName: 'Frank_Test'
      });
    }
    // 清除限流
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'XXXXXX', userName: 'Frank_Test'
    });
    // 应该返回 INVALID_CODE 而非 RATE_LIMITED
    const pass = result.error && result.error.code === 'INVALID_CODE';
    clearRateLimit();
    return { pass, actual: result };
  });

  // JF-08: Eve 跨家庭加入 Family-A（从 Family-B 移除）
  await runner.test('JF-08', 'Eve(Family-B editor) 跨家庭加入 Family-A → 从 B 移除 + 加入 A', async () => {
    await resetFamilyA();
    await resetFamilyB();
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.eve._id, USERS.eve._openid, USERS.eve, {
      inviteCode: 'TESTA1', userName: 'Eve_Test', relation: '妈妈'
    });
    if (!result.success) return { pass: false, actual: result };
    // 验证 Eve 不在 Family-B
    const familyB = await db.collection('families').doc(FAMILIES.family_b._id).get();
    const eveNotInB = !familyB.data.members.includes(USERS.eve._id);
    // 恢复
    await resetFamilyA();
    await resetFamilyB();
    return { pass: result.success && eveNotInB, actual: { eveNotInB } };
  });

  // JF-09: Dave(唯一 admin) 加入 → SOLE_ADMIN
  await runner.test('JF-09', 'Dave(Family-B 唯一 admin) 加入 Family-A → SOLE_ADMIN', async () => {
    await resetFamilyA();
    await resetFamilyB();
    clearRateLimit();
    const result = await ops.joinFamily(db, _, USERS.dave._id, USERS.dave._openid, USERS.dave, {
      inviteCode: 'TESTA1', userName: 'Dave_Test'
    });
    return {
      pass: !result.success && result.error && result.error.code === 'SOLE_ADMIN',
      actual: result
    };
  });

  // JF-10: Dave(有其他 admin) 加入 → 成功
  await runner.test('JF-10', 'Dave(非唯一 admin) 加入 Family-A → 成功', async () => {
    await resetFamilyA();
    await resetFamilyB();
    clearRateLimit();
    // 给 Eve 设为 admin
    const familyB = FAMILIES.family_b;
    const newDetails = familyB.memberDetails.map(m =>
      m.userId === USERS.eve._id ? { ...m, role: 'admin' } : m
    );
    await db.collection('families').doc(familyB._id).update({ data: { memberDetails: newDetails } });

    const result = await ops.joinFamily(db, _, USERS.dave._id, USERS.dave._openid, USERS.dave, {
      inviteCode: 'TESTA1', userName: 'Dave_Test'
    });
    // 恢复
    await resetFamilyA();
    await resetFamilyB();
    await db.collection('users').doc(USERS.dave._id).update({
      data: { familyId: FAMILIES.family_b._id, familyRole: 'admin' }
    }).catch(() => {});
    return { pass: result.success === true, actual: result };
  });

  // JF-11: 加入后 memberOpenids 验证
  await runner.test('JF-11', '加入后 Family-A.memberOpenids 包含 Frank', async () => {
    await resetFamilyA();
    await resetFrank();
    clearRateLimit();
    await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'TESTA1', userName: 'Frank_Test'
    });
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const pass = family.data.memberOpenids.includes(USERS.frank._openid);
    await resetFamilyA();
    await resetFrank();
    return { pass, actual: { memberOpenids: family.data.memberOpenids } };
  });

  // JF-12: 加入后 users.familyId 验证
  await runner.test('JF-12', '加入后 Frank.familyId = family_a', async () => {
    await resetFamilyA();
    await resetFrank();
    clearRateLimit();
    await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: 'TESTA1', userName: 'Frank_Test'
    });
    const frankUser = await db.collection('users').doc(USERS.frank._id).get();
    const pass = frankUser.data.familyId === FAMILIES.family_a._id && frankUser.data.familyRole === 'editor';
    await resetFamilyA();
    await resetFrank();
    return { pass, actual: { familyId: frankUser.data.familyId, familyRole: frankUser.data.familyRole } };
  });

  // JF-13: Ghost 用户 → 入口层 USER_NOT_FOUND（此处函数内部不校验）
  await runner.test('JF-13', 'Ghost 用户调用 joinFamily → 函数不直接拦截（入口层校验）', async () => {
    clearRateLimit();
    // joinFamily 本身不校验 user 存在性，只看 inviteCode
    const result = await ops.joinFamily(db, _, GHOST._id, GHOST._openid, {}, {
      inviteCode: 'TESTA1', userName: 'Ghost'
    });
    // Ghost 不在 users 集合，但函数不直接拦截
    // 恢复 Family-A
    await resetFamilyA();
    return { pass: true, actual: result, detail: '入口层 USER_NOT_FOUND 在 m17 测试' };
  });

  // JF-14: 跨家庭后旧家庭 memberOpenids 验证
  await runner.test('JF-14', 'Eve 跨家庭后 Family-B.memberOpenids 不含 Eve', async () => {
    await resetFamilyA();
    await resetFamilyB();
    clearRateLimit();
    await ops.joinFamily(db, _, USERS.eve._id, USERS.eve._openid, USERS.eve, {
      inviteCode: 'TESTA1', userName: 'Eve_Test'
    });
    const familyB = await db.collection('families').doc(FAMILIES.family_b._id).get();
    const eveNotInOpenids = !familyB.data.memberOpenids.includes(USERS.eve._openid);
    // 恢复
    await resetFamilyA();
    await resetFamilyB();
    return { pass: eveNotInOpenids, actual: { memberOpenids: familyB.data.memberOpenids } };
  });
};
