/**
 * 模块 8: removeMember 测试 — 8 条 (RM-01 ~ RM-08)
 */
const { USERS, buildFamilies } = require('../lib/test-data');
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

  // RM-01
  await runner.test('RM-01', 'Admin(Alice) 移除 Editor(Bob) → 成功', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    const bobUser = await db.collection('users').doc(USERS.bob._id).get();
    const pass = result.success === true && !bobUser.data.familyId;
    await resetFamilyA();
    return { pass, actual: result };
  });

  // RM-02
  await runner.test('RM-02', 'Admin(Alice) 移除 Viewer(Carol) → 成功', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.carol._id
    });
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // RM-03
  await runner.test('RM-03', 'Editor(Bob) 移除他人 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.carol._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // RM-04
  await runner.test('RM-04', 'Viewer(Carol) 移除他人 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // RM-05
  await runner.test('RM-05', 'Admin(Alice) 移除自己 → CANNOT_REMOVE_SELF', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.alice._id
    });
    return { pass: !result.success && result.error && result.error.code === 'CANNOT_REMOVE_SELF', actual: result };
  });

  // RM-06
  await runner.test('RM-06', 'Admin 移除另一个 Admin → CANNOT_REMOVE_ADMIN', async () => {
    await resetFamilyA();
    // 把 Bob 设为 admin
    const newDetails = FAMILIES.family_a.memberDetails.map(m =>
      m.userId === USERS.bob._id ? { ...m, role: 'admin' } : m
    );
    await db.collection('families').doc(FAMILIES.family_a._id).update({ data: { memberDetails: newDetails } });
    const result = await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    await resetFamilyA();
    return { pass: !result.success && result.error && result.error.code === 'CANNOT_REMOVE_ADMIN', actual: result };
  });

  // RM-07
  await runner.test('RM-07', 'Dave(Family-B) 移除 Bob(Family-A) → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.removeMember(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    return { pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED', actual: result };
  });

  // RM-08
  await runner.test('RM-08', '被移除后 Bob 不在 memberOpenids 中', async () => {
    await resetFamilyA();
    await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id, targetUserId: USERS.bob._id
    });
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const pass = !family.data.memberOpenids.includes(USERS.bob._openid) && !family.data.members.includes(USERS.bob._id);
    await resetFamilyA();
    return { pass, actual: { memberOpenids: family.data.memberOpenids, members: family.data.members } };
  });
};
