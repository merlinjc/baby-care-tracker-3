/**
 * 模块 19: 状态变更可见性测试 — 6 条 (SV-01 ~ SV-06)
 * 
 * 先执行状态变更操作，再用 Rule Simulator 验证数据可见性变化。
 */
const { RuleSimulator } = require('../lib/rule-simulator');
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
  const sim = new RuleSimulator(db);
  const FAMILIES = buildFamilies();

  async function resetFamilyA() {
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_a } });
    for (const u of [USERS.alice, USERS.bob, USERS.carol]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_a._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  const recDoc = {
    _openid: USERS.alice._openid,
    familyId: FAMILIES.family_a._id,
    babyId: `${TEST_PREFIX}baby_x`
  };

  // SV-01: removeMember(Bob) 后 → Bob read records denied
  await runner.test('SV-01', 'removeMember(Bob) 后 → Bob read denied', async () => {
    await resetFamilyA();
    await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, recDoc);
    await resetFamilyA();
    return { pass: allowed === false, actual: { allowed } };
  });

  // SV-02: leaveFamily(Bob) 后 → Bob read families denied
  await runner.test('SV-02', 'Bob leaveFamily 后 → Bob read records denied', async () => {
    await resetFamilyA();
    await ops.leaveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, recDoc);
    await resetFamilyA();
    return { pass: allowed === false, actual: { allowed } };
  });

  // SV-03: updateRole(Bob,viewer) 后 → Bob read 仍 allowed
  await runner.test('SV-03', 'Bob 降为 viewer 后 → 仍可读 records', async () => {
    await resetFamilyA();
    await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'viewer'
    });
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, recDoc);
    await resetFamilyA();
    return { pass: allowed === true, actual: { allowed } };
  });

  // SV-04: updateRole(Carol,editor) 后 → Carol create allowed
  await runner.test('SV-04', 'Carol 升为 editor 后 → create records 仍 allowed', async () => {
    await resetFamilyA();
    await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.carol._id, role: 'editor'
    });
    const { allowed } = await sim.evaluate('records', 'create', { openid: USERS.carol._openid }, {});
    await resetFamilyA();
    return { pass: allowed === true, actual: { allowed } };
  });

  // SV-05: Frank joinFamily 后 → Frank read allowed
  await runner.test('SV-05', 'Frank 加入后 → read records allowed', async () => {
    await resetFamilyA();
    // 确保 Frank 无家庭
    await db.collection('users').doc(USERS.frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});

    await ops.joinFamily(db, _, USERS.frank._id, USERS.frank._openid, USERS.frank, {
      inviteCode: FAMILIES.family_a.inviteCode, userName: 'Frank_Test', relation: '爸爸'
    });
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.frank._openid }, recDoc);

    // 清理：移除 Frank
    await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.frank._id
    }).catch(() => {});
    await db.collection('users').doc(USERS.frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});
    await resetFamilyA();
    return { pass: allowed === true, actual: { allowed } };
  });

  // SV-06: dissolveFamily 后 → 全员 read denied
  await runner.test('SV-06', 'dissolveFamily 后 → 全员 read denied', async () => {
    await resetFamilyA();
    await ops.dissolveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });

    // families 文档已删除，get() 会失败 → denied
    const { allowed: aliceRead } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, recDoc);
    const { allowed: bobRead } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, recDoc);
    const { allowed: carolRead } = await sim.evaluate('records', 'read', { openid: USERS.carol._openid }, recDoc);

    await resetFamilyA();
    return {
      pass: !aliceRead && !bobRead && !carolRead,
      actual: { aliceRead, bobRead, carolRead }
    };
  });
};
