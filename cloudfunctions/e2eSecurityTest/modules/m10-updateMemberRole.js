/**
 * 模块 10: updateMemberRole 测试 — 8 条 (UR-01 ~ UR-08)
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

  // UR-01: Alice 改 Bob → viewer
  await runner.test('UR-01', 'Alice(creatorId) 改 Bob→viewer → 成功 + users.familyRole 同步', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'viewer'
    });
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const pass = result.success && bob.data.familyRole === 'viewer';
    await resetFamilyA();
    return { pass, actual: { result, bobRole: bob.data.familyRole } };
  });

  // UR-02: Alice 改 Carol → editor
  await runner.test('UR-02', 'Alice 改 Carol→editor → 成功', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.carol._id, role: 'editor'
    });
    const carol = await db.collection('users').doc(USERS.carol._id).get();
    const pass = result.success && carol.data.familyRole === 'editor';
    await resetFamilyA();
    return { pass, actual: { carolRole: carol.data.familyRole } };
  });

  // UR-03: Alice 改 Bob → admin
  await runner.test('UR-03', 'Alice 改 Bob→admin → 成功', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'admin'
    });
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const pass = result.success && bob.data.familyRole === 'admin';
    await resetFamilyA();
    return { pass, actual: { bobRole: bob.data.familyRole } };
  });

  // UR-04: Bob(非 creatorId) → PERMISSION_DENIED
  await runner.test('UR-04', 'Bob(非 creatorId) 改角色 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.carol._id, role: 'editor'
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // UR-05: Carol(editor) → PERMISSION_DENIED
  await runner.test('UR-05', 'Carol(viewer) 改角色 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'viewer'
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // UR-06: Dave(跨家庭) → PERMISSION_DENIED
  await runner.test('UR-06', 'Dave(跨家庭 admin) 改角色 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.updateMemberRole(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'viewer'
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // UR-07: 不存在 familyId → FAMILY_NOT_FOUND
  await runner.test('UR-07', '不存在 familyId → FAMILY_NOT_FOUND', async () => {
    const result = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: `${TEST_PREFIX}nonexistent`, targetUserId: USERS.bob._id, role: 'viewer'
    });
    return { pass: !result.success && result.error && result.error.code === 'FAMILY_NOT_FOUND', actual: result };
  });

  // UR-08: 并发乐观锁（简化：连续调用 2 次验证都成功）
  await runner.test('UR-08', '连续调用 2 次 updateMemberRole → 都成功（乐观锁重试）', async () => {
    await resetFamilyA();
    const r1 = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'viewer'
    });
    const r2 = await ops.updateMemberRole(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id, role: 'admin'
    });
    const pass = r1.success && r2.success;
    await resetFamilyA();
    return { pass, actual: { r1_success: r1.success, r2_success: r2.success } };
  });
};
