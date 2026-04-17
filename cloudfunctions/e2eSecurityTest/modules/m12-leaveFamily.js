/**
 * 模块 12: leaveFamily 测试 — 9 条 (LF-01 ~ LF-09)
 */
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');
const ops = require('../lib/family-operations');
const { RuleSimulator } = require('../lib/rule-simulator');

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();
  const sim = new RuleSimulator(db);

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

  // LF-01: Editor 正常退出
  await runner.test('LF-01', 'Bob(editor) 正常退出 → success + memberOpenids 不含 Bob', async () => {
    await resetFamilyA();
    const result = await ops.leaveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    if (!result.success) return { pass: false, actual: result };
    const family = await db.collection('families').doc(FAMILIES.family_a._id).get();
    const bobInOpenids = family.data.memberOpenids && family.data.memberOpenids.includes(USERS.bob._openid);
    const bobInMembers = family.data.members && family.data.members.includes(USERS.bob._id);
    await resetFamilyA();
    return {
      pass: !bobInOpenids && !bobInMembers,
      actual: { bobInOpenids, bobInMembers },
      detail: bobInOpenids ? 'Bob openid 仍在 memberOpenids 中' : ''
    };
  });

  // LF-02: Viewer 正常退出
  await runner.test('LF-02', 'Carol(viewer) 正常退出 → success', async () => {
    await resetFamilyA();
    const result = await ops.leaveFamily(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id
    });
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // LF-03: 唯一 admin 退出（还有其他成员）→ needTransfer
  await runner.test('LF-03', 'Alice(唯一admin,3人家庭) 退出 → needTransfer=true', async () => {
    await resetFamilyA();
    const result = await ops.leaveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });
    const pass = result.success === false && result.data && result.data.needTransfer === true;
    return { pass, actual: result };
  });

  // LF-04: 唯一 admin 退出（无其他成员 → 1 人家庭自动解散）
  await runner.test('LF-04', 'Alice(1人家庭) 退出 → familyDissolved + 文档已删', async () => {
    // 构造只有 Alice 一人的家庭
    const soloFamily = {
      ...FAMILIES.family_a,
      members: [USERS.alice._id],
      memberDetails: [FAMILIES.family_a.memberDetails[0]],
      memberOpenids: [USERS.alice._openid]
    };
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: soloFamily });

    const result = await ops.leaveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });
    if (!result.success || !result.data || !result.data.familyDissolved) {
      await resetFamilyA();
      return { pass: false, actual: result };
    }

    // 验证家庭文档已删除
    let familyExists = true;
    try {
      await db.collection('families').doc(FAMILIES.family_a._id).get();
    } catch(e) {
      familyExists = false;
    }
    await resetFamilyA();
    return {
      pass: result.data.familyDissolved === true && !familyExists,
      actual: { familyDissolved: result.data.familyDissolved, familyExists }
    };
  });

  // LF-05: 有其他 admin 的 admin 退出 → 成功
  await runner.test('LF-05', 'Alice(双admin) 退出 → success', async () => {
    await resetFamilyA();
    // 把 Bob 也设为 admin
    const family = FAMILIES.family_a;
    const memberDetails = family.memberDetails.map(m =>
      m.userId === USERS.bob._id ? { ...m, role: 'admin' } : m
    );
    await db.collection('families').doc(family._id).update({ data: { memberDetails } });

    const result = await ops.leaveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });
    await resetFamilyA();
    return { pass: result.success === true, actual: result };
  });

  // LF-06: 家庭已不存在时退出
  await runner.test('LF-06', '家庭已删除时退出 → familyNotFound=true', async () => {
    const result = await ops.leaveFamily(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: `${TEST_PREFIX}nonexistent_family`
    });
    const pass = result.success === true && result.data && result.data.familyNotFound === true;
    return { pass, actual: result };
  });

  // LF-07: 非成员退出
  await runner.test('LF-07', 'Dave(非成员) 退出 Family-A → notMember=true', async () => {
    await resetFamilyA();
    const result = await ops.leaveFamily(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id
    });
    const pass = result.success === true && result.data && result.data.notMember === true;
    return { pass, actual: result };
  });

  // LF-08: 退出后 users.familyId 被清除
  await runner.test('LF-08', 'Bob 退出后 users.familyId 已清除', async () => {
    await resetFamilyA();
    await ops.leaveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    const bob = await db.collection('users').doc(USERS.bob._id).get();
    const pass = !bob.data.familyId;
    await resetFamilyA();
    return { pass, actual: { familyId: bob.data.familyId || '(cleared)' } };
  });

  // LF-09: 退出后 Rule Simulator 验证 read denied
  await runner.test('LF-09', 'Bob 退出后 Rule Simulator 验证 records read denied', async () => {
    await resetFamilyA();
    await ops.leaveFamily(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });

    // 用 Rule Simulator 验证 Bob 读 records 被拒绝
    const recDoc = {
      _openid: USERS.alice._openid,
      familyId: FAMILIES.family_a._id,
      babyId: `${TEST_PREFIX}baby_x`
    };
    const { allowed } = await sim.evaluate('records', 'read', { openid: USERS.bob._openid }, recDoc);
    await resetFamilyA();
    return {
      pass: allowed === false,
      actual: { allowed },
      detail: allowed ? 'Bob 退出后仍能通过安全规则读 records!' : ''
    };
  });
};
