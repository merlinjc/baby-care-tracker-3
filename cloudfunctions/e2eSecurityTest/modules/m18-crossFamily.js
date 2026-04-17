/**
 * 模块 18: 跨家庭数据隔离验证 — 10 条 (ISO-01 ~ ISO-10)
 */
const { RuleSimulator } = require('../lib/rule-simulator');
const { USERS, buildFamilies, buildBabies, buildRecords, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');

module.exports = async function(runner, db, _) {
  const sim = new RuleSimulator(db);
  const FAMILIES = buildFamilies();
  const BABIES = buildBabies(FAMILIES);
  const RECORDS = buildRecords(FAMILIES, BABIES);

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

  // ISO-01: Alice 读 Family-B records → 拒绝
  await runner.test('ISO-01', 'Alice(Family-A) 读 Family-B records → 拒绝', async () => {
    const recDoc = (await db.collection('records').doc(RECORDS[3]._id).get()).data; // dave_rec_1
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, recDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ISO-02: Alice 读 Family-B babies → 拒绝
  await runner.test('ISO-02', 'Alice(Family-A) 读 Family-B babies → 拒绝', async () => {
    const babyDoc = (await db.collection('babies').doc(BABIES.baby_y._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.alice._openid }, babyDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ISO-03: Alice 读 Family-B vaccine_records → 拒绝
  // 注意：Family-B 没有 vaccine_records，所以用模拟文档
  await runner.test('ISO-03', 'Alice(Family-A) 读 Family-B vaccine_records → 拒绝', async () => {
    const fakeVacDoc = { _openid: USERS.dave._openid, familyId: FAMILIES.family_b._id, babyId: BABIES.baby_y._id };
    const { allowed } = await sim.evaluate('vaccine_records', 'read', { openid: USERS.alice._openid }, fakeVacDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ISO-04: Alice 读 Family-B milestone_records → 拒绝
  await runner.test('ISO-04', 'Alice(Family-A) 读 Family-B milestone_records → 拒绝', async () => {
    const fakeMileDoc = { _openid: USERS.dave._openid, familyId: FAMILIES.family_b._id, babyId: BABIES.baby_y._id };
    const { allowed } = await sim.evaluate('milestone_records', 'read', { openid: USERS.alice._openid }, fakeMileDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ISO-05: Dave 读 Family-A records → 拒绝
  await runner.test('ISO-05', 'Dave(Family-B) 读 Family-A records → 拒绝', async () => {
    const recDoc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.dave._openid }, recDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ISO-06: Alice removeMember on Family-B → PERMISSION_DENIED
  await runner.test('ISO-06', 'Alice(Family-A) 对 Family-B removeMember → PERMISSION_DENIED', async () => {
    await resetFamilyB();
    const result = await ops.removeMember(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_b._id,
      targetUserId: USERS.eve._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // ISO-07: Alice dissolveFamily on Family-B → PERMISSION_DENIED
  await runner.test('ISO-07', 'Alice(Family-A) 对 Family-B dissolveFamily → PERMISSION_DENIED', async () => {
    await resetFamilyB();
    const result = await ops.dissolveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_b._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // ISO-08: Alice clearBabyData on Baby-Y → PERMISSION_DENIED
  await runner.test('ISO-08', 'Alice(Family-A) 对 Baby-Y clearBabyData → PERMISSION_DENIED', async () => {
    await resetFamilyB();
    const result = await ops.clearBabyData(db, _, USERS.alice._id, USERS.alice._openid, {
      babyId: BABIES.baby_y._id,
      familyId: FAMILIES.family_b._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // ISO-09: Alice createBaby on Family-B → PERMISSION_DENIED
  await runner.test('ISO-09', 'Alice(Family-A) 对 Family-B createBaby → PERMISSION_DENIED', async () => {
    await resetFamilyB();
    const result = await ops.createBaby(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_b._id,
      name: '恶意宝宝',
      gender: 'male'
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // ISO-10: 双向 familyId 隔离验证
  await runner.test('ISO-10', '双向隔离：Alice 仅能读 fam_A 记录，Dave 仅能读 fam_B 记录', async () => {
    // Alice 读 fam_A → 允许
    const recA = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed: aliceReadA } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, recA);

    // Alice 读 fam_B → 拒绝
    const recB = (await db.collection('records').doc(RECORDS[3]._id).get()).data;
    const { allowed: aliceReadB } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, recB);

    // Dave 读 fam_B → 允许
    const { allowed: daveReadB } = await sim.evaluate('records', 'read', { openid: USERS.dave._openid }, recB);

    // Dave 读 fam_A → 拒绝
    const { allowed: daveReadA } = await sim.evaluate('records', 'read', { openid: USERS.dave._openid }, recA);

    const pass = aliceReadA && !aliceReadB && daveReadB && !daveReadA;
    return {
      pass,
      actual: { aliceReadA, aliceReadB, daveReadB, daveReadA }
    };
  });
};
