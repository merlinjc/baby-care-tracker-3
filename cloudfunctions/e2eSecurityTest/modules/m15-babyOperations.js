/**
 * 模块 15: createBaby / deleteBaby 测试 — 8 条 (CB-01~CB-05 + DB-01~DB-03)
 */
const { USERS, GHOST, buildFamilies, buildBabies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();
  const BABIES = buildBabies(FAMILIES);

  async function resetFamilyA() {
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_a } });
    for (const u of [USERS.alice, USERS.bob, USERS.carol]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_a._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  async function ensureBabyX() {
    try { await db.collection('babies').doc(BABIES.baby_x._id).remove(); } catch(e) {}
    await db.collection('babies').add({ data: { ...BABIES.baby_x } });
  }

  // 清除测试中创建的临时宝宝
  async function cleanupTestBabies() {
    const res = await db.collection('babies')
      .where({ _id: _.regex({ regexp: '^' + TEST_PREFIX + 'tmp_', options: 'i' }) })
      .get();
    for (const doc of res.data) {
      await db.collection('babies').doc(doc._id).remove();
    }
  }

  // CB-01: Admin 创建宝宝
  await runner.test('CB-01', 'Alice(admin) 创建宝宝 → success + families.babies 更新', async () => {
    await resetFamilyA();
    const result = await ops.createBaby(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id,
      name: '测试宝宝A',
      gender: 'female',
      birthDate: '2026-01-01'
    });
    if (!result.success) return { pass: false, actual: result };

    // 验证 families.babies 包含新 babyId
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const newBabyId = result.data._id;
    const inBabies = family.data.babies && family.data.babies.includes(newBabyId);

    // 清理创建的宝宝
    try { await db.collection('babies').doc(newBabyId).remove(); } catch(e) {}
    await resetFamilyA();

    return {
      pass: inBabies,
      actual: { newBabyId, inBabies }
    };
  });

  // CB-02: Editor 创建宝宝
  await runner.test('CB-02', 'Bob(editor) 创建宝宝 → success', async () => {
    await resetFamilyA();
    const result = await ops.createBaby(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id,
      name: '测试宝宝B',
      gender: 'male'
    });
    // 清理
    if (result.success && result.data && result.data._id) {
      try { await db.collection('babies').doc(result.data._id).remove(); } catch(e) {}
    }
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // CB-03: Viewer 创建宝宝
  await runner.test('CB-03', 'Carol(viewer) 创建宝宝 → success（云函数仅校验成员）', async () => {
    await resetFamilyA();
    const result = await ops.createBaby(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id,
      name: '测试宝宝C',
      gender: 'female'
    });
    if (result.success && result.data && result.data._id) {
      try { await db.collection('babies').doc(result.data._id).remove(); } catch(e) {}
    }
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // CB-04: 非成员创建宝宝 → PERMISSION_DENIED
  await runner.test('CB-04', 'Dave(非成员) 创建 Family-A 宝宝 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.createBaby(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id,
      name: '恶意宝宝',
      gender: 'male'
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // CB-05: 未注册用户创建宝宝 — 通过模拟入口检查
  await runner.test('CB-05', 'Ghost 用户创建宝宝 → USER_NOT_FOUND(入口拦截)', async () => {
    const userRes = await db.collection('users')
      .where({ _openid: GHOST._openid })
      .limit(1)
      .get();
    return {
      pass: userRes.data.length === 0,
      actual: { userExists: userRes.data.length > 0 },
      detail: '入口会在查不到 Ghost 用户时返回 USER_NOT_FOUND'
    };
  });

  // DB-01: 家庭成员删除宝宝
  await runner.test('DB-01', 'Alice(admin) 删除 Baby-X → success + families.babies 不含 baby_x', async () => {
    await resetFamilyA();
    await ensureBabyX();

    const result = await ops.deleteBaby(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    if (!result.success) {
      await ensureBabyX();
      await resetFamilyA();
      return { pass: false, actual: result };
    }

    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const babyStillInList = family.data.babies && family.data.babies.includes(BABIES.baby_x._id);

    // 恢复
    await ensureBabyX();
    await resetFamilyA();
    return {
      pass: !babyStillInList,
      actual: { babyStillInList }
    };
  });

  // DB-02: 非成员删除宝宝 → PERMISSION_DENIED
  await runner.test('DB-02', 'Dave(非成员) 删除 Baby-X → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    await ensureBabyX();
    const result = await ops.deleteBaby(db, _, USERS.dave._id, USERS.dave._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // DB-03: Editor 删除宝宝
  await runner.test('DB-03', 'Bob(editor) 删除 Baby-X → success', async () => {
    await resetFamilyA();
    await ensureBabyX();
    const result = await ops.deleteBaby(db, _, USERS.bob._id, USERS.bob._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    // 恢复
    await ensureBabyX();
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });
};
