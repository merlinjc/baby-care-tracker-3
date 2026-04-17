/**
 * 模块 9: dissolveFamily 测试 — 6 条 (DF-01 ~ DF-06)
 */
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
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

  // DF-01: 创建者解散 → 成功 + 所有成员 familyId 清除
  await runner.test('DF-01', 'Alice(创建者) 解散 Family-A → 成功 + 成员 familyId 被清除', async () => {
    await resetFamilyA();
    const result = await ops.dissolveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });
    if (!result.success) { await resetFamilyA(); return { pass: false, actual: result }; }
    // 验证成员 familyId 清除
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const carol = await db.collection('users').doc(USERS.carol._id).get();
    const pass = !bob.data.familyId && !carol.data.familyId;
    await resetFamilyA();
    return { pass, actual: { bobFamilyId: bob.data.familyId, carolFamilyId: carol.data.familyId } };
  });

  // DF-02: 非创建者 admin → PERMISSION_DENIED
  await runner.test('DF-02', 'Bob(非 creatorId, 假设改为 admin) 解散 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    // creatorId 是 alice，即使 bob 是 admin 也不能解散
    const newDetails = FAMILIES.family_a.memberDetails.map(m =>
      m.userId === USERS.bob._id ? { ...m, role: 'admin' } : m
    );
    await db.collection('families').doc(FAMILIES.family_a._id).update({ data: { memberDetails: newDetails } });
    const result = await ops.dissolveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    await resetFamilyA();
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // DF-03: Editor 解散 → PERMISSION_DENIED
  await runner.test('DF-03', 'Bob(editor) 解散 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.dissolveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // DF-04: Viewer 解散 → PERMISSION_DENIED
  await runner.test('DF-04', 'Carol(viewer) 解散 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.dissolveFamily(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // DF-05: 跨家庭 admin 解散 → PERMISSION_DENIED
  await runner.test('DF-05', 'Dave(Family-B admin) 解散 Family-A → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.dissolveFamily(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // DF-06: 不存在的 familyId → FAMILY_NOT_FOUND
  await runner.test('DF-06', '不存在的 familyId → FAMILY_NOT_FOUND', async () => {
    const result = await ops.dissolveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: `${TEST_PREFIX}nonexistent`
    });
    return { pass: !result.success && result.error && result.error.code === 'FAMILY_NOT_FOUND', actual: result };
  });
};
