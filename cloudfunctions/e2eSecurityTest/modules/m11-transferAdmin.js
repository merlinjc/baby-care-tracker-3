/**
 * 模块 11: transferAdmin 测试 — 7 条 (TA-01 ~ TA-07)
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

  // TA-01: Alice 转让给 Bob
  await runner.test('TA-01', 'Alice 转让 admin 给 Bob → 成功 + creatorId 更新', async () => {
    await resetFamilyA();
    const result = await ops.transferAdmin(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.bob._id
    });
    if (!result.success) { await resetFamilyA(); return { pass: false, actual: result }; }
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const pass = family.data.creatorId === USERS.bob._id;
    await resetFamilyA();
    return { pass, actual: { creatorId: family.data.creatorId } };
  });

  // TA-02: Alice 转让给 Carol
  await runner.test('TA-02', 'Alice 转让 admin 给 Carol → 成功', async () => {
    await resetFamilyA();
    const result = await ops.transferAdmin(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.carol._id
    });
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // TA-03: Bob(editor) 转让 → PERMISSION_DENIED
  await runner.test('TA-03', 'Bob(editor) 转让 admin → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.transferAdmin(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.carol._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // TA-04: 转让给非成员 → NOT_MEMBER
  await runner.test('TA-04', 'Alice 转让给 Dave(非成员) → NOT_MEMBER', async () => {
    await resetFamilyA();
    const result = await ops.transferAdmin(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.dave._id
    });
    return { pass: !result.success && result.error && result.error.code === 'NOT_MEMBER', actual: result };
  });

  // TA-05: 跨家庭 admin → PERMISSION_DENIED
  await runner.test('TA-05', 'Dave(Family-B admin) 转让 Family-A → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.transferAdmin(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.bob._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // TA-06: 转让后双方 users.familyRole 一致性
  await runner.test('TA-06', '转让后 Alice=editor, Bob=admin (users 文档)', async () => {
    await resetFamilyA();
    await ops.transferAdmin(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.bob._id
    });
    const alice = await db.collection('users').doc(USERS.alice._id).get();
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const pass = alice.data.familyRole === 'editor' && bob.data.familyRole === 'admin';
    await resetFamilyA();
    return { pass, actual: { aliceRole: alice.data.familyRole, bobRole: bob.data.familyRole } };
  });

  // TA-07: 转让后新 admin 可以 refreshInviteCode
  await runner.test('TA-07', '转让后 Bob(新 admin) 可以 refreshInviteCode', async () => {
    await resetFamilyA();
    await ops.transferAdmin(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, newAdminId: USERS.bob._id
    });
    const result = await ops.refreshInviteCode(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });
};
