/**
 * 模块 16: clearBabyData 测试 — 8 条 (CD-01 ~ CD-08)
 */
const { USERS, buildFamilies, buildBabies, buildRecords, buildVaccineRecords, buildMilestoneRecords, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();
  const BABIES = buildBabies(FAMILIES);
  const RECORDS = buildRecords(FAMILIES, BABIES);
  const VACCINE_RECORDS = buildVaccineRecords(FAMILIES, BABIES);
  const MILESTONE_RECORDS = buildMilestoneRecords(FAMILIES, BABIES);

  async function resetFamilyA() {
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_a } });
    for (const u of [USERS.alice, USERS.bob, USERS.carol]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_a._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  async function resetBabyXData() {
    // 恢复 Baby-X
    try { await db.collection('babies').doc(BABIES.baby_x._id).remove(); } catch(e) {}
    await db.collection('babies').add({ data: { ...BABIES.baby_x } });

    // 恢复 Family-A 的 records
    const familyARecords = RECORDS.filter(r => r.familyId === FAMILIES.family_a._id);
    for (const rec of familyARecords) {
      try { await db.collection('records').doc(rec._id).remove(); } catch(e) {}
      await db.collection('records').add({ data: { ...rec } });
    }

    // 恢复 vaccine_records
    for (const vac of VACCINE_RECORDS) {
      try { await db.collection('vaccine_records').doc(vac._id).remove(); } catch(e) {}
      await db.collection('vaccine_records').add({ data: { ...vac } });
    }

    // 恢复 milestone_records
    for (const mile of MILESTONE_RECORDS) {
      try { await db.collection('milestone_records').doc(mile._id).remove(); } catch(e) {}
      await db.collection('milestone_records').add({ data: { ...mile } });
    }
  }

  // CD-01: Admin 清除宝宝数据
  await runner.test('CD-01', 'Alice(admin) 清除 Baby-X 全部数据 → success', async () => {
    await resetFamilyA();
    await resetBabyXData();

    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    if (!result.success) {
      await resetBabyXData();
      await resetFamilyA();
      return { pass: false, actual: result };
    }

    // 验证 records 已删除（使用 babyId 查询，不依赖 _.regex）
    const recs = await db.collection('records')
      .where({ babyId: BABIES.baby_x._id })
      .get();
    const vacs = await db.collection('vaccine_records')
      .where({ babyId: BABIES.baby_x._id })
      .get();

    const pass = result.success && recs.data.length === 0 && vacs.data.length === 0;

    await resetBabyXData();
    await resetFamilyA();
    return {
      pass,
      actual: { records: recs.data.length, vaccine: vacs.data.length, stats: result.data }
    };
  });

  // CD-02: Editor 清除宝宝数据 → PERMISSION_DENIED
  await runner.test('CD-02', 'Bob(editor) 清除 Baby-X → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.clearBabyData(db, _, USERS.bob._id, USERS.bob._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // CD-03: Viewer 清除宝宝数据 → PERMISSION_DENIED
  await runner.test('CD-03', 'Carol(viewer) 清除 Baby-X → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.clearBabyData(db, _, USERS.carol._id, USERS.carol._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // CD-04: Admin 清除包括他人创建的记录（Bob 创建的 rec_bob_1 也被删除）
  await runner.test('CD-04', 'Alice(admin) 清除含 Bob 记录的数据 → 全部删除', async () => {
    await resetFamilyA();
    await resetBabyXData();

    // 确认 Bob 创建的记录存在
    const bobRecBefore = await db.collection('records').doc(`${TEST_PREFIX}rec_bob_1`).get().catch(() => ({ data: null }));
    if (!bobRecBefore.data) {
      await resetBabyXData();
      return { pass: false, actual: { error: 'Bob 记录不存在' } };
    }

    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });

    // 验证 Bob 创建的记录也被删除
    let bobRecExists = true;
    try {
      await db.collection('records').doc(`${TEST_PREFIX}rec_bob_1`).get();
    } catch(e) {
      bobRecExists = false;
    }

    await resetBabyXData();
    await resetFamilyA();
    return {
      pass: result.success && !bobRecExists,
      actual: { bobRecExists, stats: result.data }
    };
  });

  // CD-05: 跨家庭 admin 清除 → PERMISSION_DENIED
  await runner.test('CD-05', 'Dave(Family-B admin) 清除 Baby-X → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.clearBabyData(db, _, USERS.dave._id, USERS.dave._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // CD-06: 清除最后一个宝宝后自动解散
  await runner.test('CD-06', '清除最后宝宝 → familyDeleted=true + 成员 familyId 清除', async () => {
    await resetFamilyA();
    await resetBabyXData();

    // 确保 Family-A 只有 Baby-X（移除 babies 数组中其他的）
    await db.collection('families').doc(FAMILIES.family_a._id).update({
      data: { babies: [BABIES.baby_x._id] }
    });
    // 删除其他测试宝宝（如果有）
    const otherBabies = await db.collection('babies')
      .where({ familyId: FAMILIES.family_a._id, _id: _.neq(BABIES.baby_x._id) })
      .get();
    for (const b of otherBabies.data) {
      if (b._id.startsWith(TEST_PREFIX)) {
        await db.collection('babies').doc(b._id).remove();
      }
    }

    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });

    if (!result.success || !result.data) {
      await resetBabyXData();
      await resetFamilyA();
      return { pass: false, actual: result };
    }

    // 验证家庭已解散
    const familyDeleted = result.data.familyDeleted === true;

    // 验证成员 familyId 被清除
    const alice = await db.collection('users').doc(USERS.alice._id).get();
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const aliceCleared = !alice.data.familyId;
    const bobCleared = !bob.data.familyId;

    await resetBabyXData();
    await resetFamilyA();
    return {
      pass: familyDeleted && aliceCleared && bobCleared,
      actual: { familyDeleted, aliceCleared, bobCleared }
    };
  });

  // CD-07: 清除非最后一个宝宝 → familyDeleted=false
  await runner.test('CD-07', '清除非最后宝宝 → familyDeleted=false', async () => {
    await resetFamilyA();
    await resetBabyXData();

    // 添加一个额外宝宝
    const extraBabyId = `${TEST_PREFIX}baby_extra`;
    try { await db.collection('babies').doc(extraBabyId).remove(); } catch(e) {}
    await db.collection('babies').add({
      data: {
        _id: extraBabyId,
        _openid: USERS.alice._openid,
        familyId: FAMILIES.family_a._id,
        name: 'Extra Baby',
        gender: 'male'
      }
    });
    await db.collection('families').doc(FAMILIES.family_a._id).update({
      data: { babies: [BABIES.baby_x._id, extraBabyId] }
    });

    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id
    });

    // 清理 extra baby
    try { await db.collection('babies').doc(extraBabyId).remove(); } catch(e) {}
    await resetBabyXData();
    await resetFamilyA();

    return {
      pass: result.success && result.data && result.data.familyDeleted === false,
      actual: result.data
    };
  });

  // CD-08: 清除不存在家庭的宝宝 → FAMILY_NOT_FOUND
  await runner.test('CD-08', '清除不存在家庭的宝宝 → FAMILY_NOT_FOUND', async () => {
    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_x._id,
      familyId: `${TEST_PREFIX}nonexistent_family`
    });
    return {
      pass: !result.success && result.error && result.error.code === 'FAMILY_NOT_FOUND',
      actual: result
    };
  });
};
