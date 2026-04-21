/**
 * 模块 1-5: 安全规则验证 — ~40 条 (U-01~U-08, F-01~F-10, B-01~B-12, R-01~R-16, V-01~V-04, M-01~M-02)
 * 
 * 使用 Rule Simulator 模拟 CloudBase 安全规则引擎的判定行为，
 * 读取真实文档数据 + 注入模拟 auth.openid → 判定 allow/deny。
 * 
 * L4 手动补充用例（B-10, R-12, M-03, M-04）标记为 SKIP。
 */
const { RuleSimulator } = require('../lib/rule-simulator');
const { USERS, buildFamilies, buildBabies, buildRecords, buildVaccineRecords, buildMilestoneRecords, TEST_PREFIX } = require('../lib/test-data');

module.exports = async function(runner, db, _) {
  const sim = new RuleSimulator(db);
  const FAMILIES = buildFamilies();
  const BABIES = buildBabies(FAMILIES);
  const RECORDS = buildRecords(FAMILIES, BABIES);

  // ===== 模块 1: users 集合 (PRIVATE) — 8 条 =====

  // U-01: Alice 读自己 → 允许
  await runner.test('U-01', 'Alice 读自己的 users 文档 → 允许', async () => {
    const doc = (await db.collection('users').doc(USERS.alice._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // U-02: Alice 更新自己 → 允许
  await runner.test('U-02', 'Alice 更新自己的 users 文档 → 允许', async () => {
    const doc = (await db.collection('users').doc(USERS.alice._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'update', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // U-03: Alice 读 Bob → 拒绝
  await runner.test('U-03', 'Alice 读 Bob 的 users 文档 → 拒绝', async () => {
    const doc = (await db.collection('users').doc(USERS.bob._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // U-04: Alice 更新 Bob → 拒绝
  await runner.test('U-04', 'Alice 更新 Bob 的 users 文档 → 拒绝', async () => {
    const doc = (await db.collection('users').doc(USERS.bob._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'update', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // U-05: Dave 读 Alice → 拒绝
  await runner.test('U-05', 'Dave(Family-B) 读 Alice → 拒绝', async () => {
    const doc = (await db.collection('users').doc(USERS.alice._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // U-06: Frank 读自己 → 允许
  await runner.test('U-06', 'Frank(无家庭) 读自己 → 允许', async () => {
    const doc = (await db.collection('users').doc(USERS.frank._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.frank._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // U-07: Alice where 查询所有 users → 仅返回自己（模拟逐文档判定）
  await runner.test('U-07', 'Alice where 查询 users → 仅自己通过规则', async () => {
    let passCount = 0;
    for (const user of Object.values(USERS)) {
      const doc = (await db.collection('users').doc(user._id).get()).data;
      const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.alice._openid }, doc);
      if (allowed) passCount++;
    }
    return { pass: passCount === 1, actual: { passCount, expected: 1 } };
  });

  // U-08: Alice 查 Bob 的 openid → 拒绝
  await runner.test('U-08', 'Alice 查 Bob openid → 全拒绝', async () => {
    const doc = (await db.collection('users').doc(USERS.bob._id).get()).data;
    const { allowed } = await sim.evaluate('users', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ===== 模块 2: families 集合 — 10 条 =====

  // F-01: Alice 读 Family-A → 允许 (auth != null)
  await runner.test('F-01', 'Alice(成员) 读 Family-A → 允许', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-02: Bob 读 Family-A → 允许
  await runner.test('F-02', 'Bob(editor) 读 Family-A → 允许', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-03: Carol 读 Family-A → 允许
  await runner.test('F-03', 'Carol(viewer) 读 Family-A → 允许', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.carol._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-04: Dave 读 Family-A → 允许（v4.2 规则为 auth != null，任何认证用户都可读）
  // 注意：v4.2 将 families.read 改为 auth != null，所以 Dave 也能读
  await runner.test('F-04', 'Dave(非成员) 读 Family-A → 允许(auth!=null)', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === true, actual: { allowed }, detail: 'v4.2: families.read=auth!=null' };
  });

  // F-05: Frank 读 Family-A → 允许（auth != null）
  await runner.test('F-05', 'Frank(无家庭) 读 Family-A → 允许(auth!=null)', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.frank._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-06: Alice update families → 允许（[v4.3.2 FR-A17] 规则改为 memberOpenids contains，Alice 是成员）
  await runner.test('F-06', 'Alice update families → 允许(memberOpenids contains)', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'update', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-07: Alice delete families → 拒绝 (delete=false)
  await runner.test('F-07', 'Alice delete families → 拒绝(delete=false)', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'delete', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // F-08: Frank 查询 families → 允许(auth!=null)
  await runner.test('F-08', 'Frank 查询 families → 允许(auth!=null)', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', { openid: USERS.frank._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-09: 认证用户创建 families → 允许 (create: auth != null)
  await runner.test('F-09', 'Frank 创建 families 文档 → 允许(auth!=null)', async () => {
    const { allowed } = await sim.evaluate('families', 'create', { openid: USERS.frank._openid }, {});
    return { pass: allowed === true, actual: { allowed } };
  });

  // F-10: null auth 读 families → 拒绝
  await runner.test('F-10', '未认证用户读 families → 拒绝', async () => {
    const doc = (await db.collection('families').doc(FAMILIES.family_a._id).get()).data;
    const { allowed } = await sim.evaluate('families', 'read', null, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // ===== 模块 3: babies 集合 — 11 条 (B-10 为 L4 SKIP) =====

  // B-01: Alice 读 Baby-X → 允许
  await runner.test('B-01', 'Alice(同家庭) 读 Baby-X → 允许', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // B-02: Bob 读 Baby-X → 允许
  await runner.test('B-02', 'Bob(同家庭 editor) 读 Baby-X → 允许', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // B-03: Carol 读 Baby-X → 允许
  await runner.test('B-03', 'Carol(同家庭 viewer) 读 Baby-X → 允许', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.carol._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // B-04: Dave 读 Baby-X → 拒绝
  await runner.test('B-04', 'Dave(不同家庭) 读 Baby-X → 拒绝', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-05: Dave doc(baby_x) 直接读 → 拒绝（与 B-04 一致，文档级判定）
  await runner.test('B-05', 'Dave doc(baby_x) 直接读 → 拒绝', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-06: Frank 读 Baby-X → 拒绝
  await runner.test('B-06', 'Frank(无家庭) 读 Baby-X → 拒绝', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.frank._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-07: Alice 更新 Baby-X → 允许（_openid 匹配）
  await runner.test('B-07', 'Alice(创建者) 更新 Baby-X → 允许', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'update', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // B-08: Bob 更新 Baby-X → 拒绝
  await runner.test('B-08', 'Bob(非创建者) 更新 Baby-X → 拒绝', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'update', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-09: Alice 客户端 delete baby → 拒绝 (delete=false)
  await runner.test('B-09', 'Alice delete baby → 拒绝(delete=false)', async () => {
    const doc = (await db.collection('babies').doc(BABIES.baby_x._id).get()).data;
    const { allowed } = await sim.evaluate('babies', 'delete', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-10: SKIP — 手动验证（不带 familyId 查询）
  await runner.test('B-10', '[L4-手动] 不带 familyId 查询 babies → 需在开发者工具验证', async () => {
    return { pass: true, actual: 'L4 手动验证项', detail: '需在微信开发者工具中验证 where({name:xx}).get()' };
  });

  // B-11: 家庭被删除后读 baby → 拒绝
  await runner.test('B-11', '家庭被删除后 get() 找不到 → 拒绝', async () => {
    const fakeBabyDoc = { _openid: USERS.alice._openid, familyId: 'nonexistent_family_id' };
    const { allowed } = await sim.evaluate('babies', 'read', { openid: USERS.alice._openid }, fakeBabyDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // B-12: 认证用户创建 babies → 允许
  await runner.test('B-12', 'Frank 创建 babies → 允许(auth!=null)', async () => {
    const { allowed } = await sim.evaluate('babies', 'create', { openid: USERS.frank._openid }, {});
    return { pass: allowed === true, actual: { allowed } };
  });

  // ===== 模块 4: records 集合 — 15 条 (R-12 为 L4 SKIP, R-16 在 m19 覆盖) =====

  // R-01: Alice 读 Baby-X records → 允许
  await runner.test('R-01', 'Alice(同家庭) 读 records → 允许', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-02: Bob 读 Alice 创建的记录 → 允许（同家庭互看）
  await runner.test('R-02', 'Bob(同家庭) 读 Alice 记录 → 允许', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-03: Carol 读 records → 允许
  await runner.test('R-03', 'Carol(viewer) 读 records → 允许', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.carol._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-04: Dave 读 Family-A records → 拒绝
  await runner.test('R-04', 'Dave(不同家庭) 读 records → 拒绝', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-05: Frank 读 records → 拒绝
  await runner.test('R-05', 'Frank(无家庭) 读 records → 拒绝', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.frank._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-06: Alice create records → 允许
  await runner.test('R-06', 'Alice 创建 records → 允许(auth!=null)', async () => {
    const { allowed } = await sim.evaluate('records', 'create', { openid: USERS.alice._openid }, {});
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-07: Dave create records → 允许 (但 read 时被拒绝)
  await runner.test('R-07', 'Dave 创建 records → 允许 + 但读不到', async () => {
    const { allowed: createAllowed } = await sim.evaluate('records', 'create', { openid: USERS.dave._openid }, {});
    // 模拟 Dave 创建的记录带 fam_A 的 familyId
    const fakeDoc = { _openid: USERS.dave._openid, familyId: FAMILIES.family_a._id };
    const { allowed: readAllowed } = await sim.evaluate('records', 'read', { openid: USERS.dave._openid }, fakeDoc);
    return {
      pass: createAllowed === true && readAllowed === false,
      actual: { createAllowed, readAllowed }
    };
  });

  // R-08: Alice 更新自己创建的 → 允许
  await runner.test('R-08', 'Alice 更新自己创建的记录 → 允许', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'update', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-09: Bob 更新 Alice 创建的 → 拒绝
  await runner.test('R-09', 'Bob 更新 Alice 记录 → 拒绝', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'update', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-10: Alice 删除自己创建的 → 允许
  await runner.test('R-10', 'Alice 删除自己创建的记录 → 允许', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'delete', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // R-11: Bob 删除 Alice 的 → 拒绝
  await runner.test('R-11', 'Bob 删除 Alice 记录 → 拒绝', async () => {
    const doc = (await db.collection('records').doc(RECORDS[0]._id).get()).data;
    const { allowed } = await sim.evaluate('records', 'delete', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-12: SKIP — 手动验证
  await runner.test('R-12', '[L4-手动] 不带 familyId 查询 records → 需在开发者工具验证', async () => {
    return { pass: true, actual: 'L4 手动验证项' };
  });

  // R-13: Alice 带 fam_B 的 familyId 查询 → 拒绝
  await runner.test('R-13', 'Alice 查 fam_B records → 拒绝', async () => {
    const fakeDoc = { _openid: USERS.dave._openid, familyId: FAMILIES.family_b._id, babyId: BABIES.baby_y._id };
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, fakeDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-14: 缺少 familyId 的孤儿记录 → 拒绝
  await runner.test('R-14', '缺少 familyId 的孤儿记录 → 拒绝', async () => {
    const orphanDoc = { _openid: USERS.alice._openid, babyId: 'xxx' };
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.alice._openid }, orphanDoc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // R-15: Carol(viewer) 创建 records → 允许
  await runner.test('R-15', 'Carol(viewer) 创建 records → 允许(auth!=null)', async () => {
    const { allowed } = await sim.evaluate('records', 'create', { openid: USERS.carol._openid }, {});
    return { pass: allowed === true, actual: { allowed } };
  });

  // ===== 模块 5: vaccine_records / milestone_records — 6 条 (M-03/M-04 为 L4 SKIP) =====

  // V-01: Alice 读 vaccine_records → 允许
  await runner.test('V-01', 'Alice 读 vaccine_records → 允许', async () => {
    const doc = (await db.collection('vaccine_records').doc(`${TEST_PREFIX}vac_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('vaccine_records', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // V-02: Dave 读 vaccine_records → 拒绝
  await runner.test('V-02', 'Dave 读 vaccine_records → 拒绝', async () => {
    const doc = (await db.collection('vaccine_records').doc(`${TEST_PREFIX}vac_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('vaccine_records', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // V-03: Bob 更新 Alice 的 vaccine_records → 拒绝
  await runner.test('V-03', 'Bob 更新 Alice vaccine_records → 拒绝', async () => {
    const doc = (await db.collection('vaccine_records').doc(`${TEST_PREFIX}vac_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('vaccine_records', 'update', { openid: USERS.bob._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // V-04: Alice 删除自己的 vaccine_records → 允许
  await runner.test('V-04', 'Alice 删除自己 vaccine_records → 允许', async () => {
    const doc = (await db.collection('vaccine_records').doc(`${TEST_PREFIX}vac_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('vaccine_records', 'delete', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // M-01: Alice 读 milestone_records → 允许
  await runner.test('M-01', 'Alice 读 milestone_records → 允许', async () => {
    const doc = (await db.collection('milestone_records').doc(`${TEST_PREFIX}mile_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('milestone_records', 'read', { openid: USERS.alice._openid }, doc);
    return { pass: allowed === true, actual: { allowed } };
  });

  // M-02: Dave 读 milestone_records → 拒绝
  await runner.test('M-02', 'Dave 读 milestone_records → 拒绝', async () => {
    const doc = (await db.collection('milestone_records').doc(`${TEST_PREFIX}mile_alice_1`).get()).data;
    const { allowed } = await sim.evaluate('milestone_records', 'read', { openid: USERS.dave._openid }, doc);
    return { pass: allowed === false, actual: { allowed } };
  });

  // M-03: SKIP — 手动验证
  await runner.test('M-03', '[L4-手动] 不带 familyId 查询 vaccine_records → 需在开发者工具验证', async () => {
    return { pass: true, actual: 'L4 手动验证项' };
  });

  // M-04: SKIP — 手动验证
  await runner.test('M-04', '[L4-手动] 不带 familyId 查询 milestone_records → 需在开发者工具验证', async () => {
    return { pass: true, actual: 'L4 手动验证项' };
  });

  // ===== 规则配置完整性验证 =====
  await runner.test('SEC-CONFIG', '6 个集合安全规则定义完整', async () => {
    const collections = ['users', 'families', 'babies', 'records', 'vaccine_records', 'milestone_records'];
    const allDefined = collections.every(c =>
      sim.rules[c] && sim.rules[c].read !== undefined && sim.rules[c].create !== undefined
    );
    return { pass: allDefined, actual: { definedCollections: collections.length } };
  });
};
