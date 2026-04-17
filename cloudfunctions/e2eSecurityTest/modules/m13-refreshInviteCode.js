/**
 * 模块 13: refreshInviteCode 测试 — 5 条 (RI-01 ~ RI-05)
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

  // RI-01: Admin 刷新邀请码
  await runner.test('RI-01', 'Alice(admin) 刷新邀请码 → 新码与旧码不同', async () => {
    await resetFamilyA();
    const oldCode = FAMILIES.family_a.inviteCode;
    const result = await ops.refreshInviteCode(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });
    if (!result.success) return { pass: false, actual: result };
    const newCode = result.data.inviteCode;
    // 新码格式验证：6位大写字母+数字（排除 I/O/0/1）
    const codeRegex = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    const validFormat = codeRegex.test(newCode);
    await resetFamilyA();
    return {
      pass: newCode !== oldCode && validFormat,
      actual: { oldCode, newCode, validFormat }
    };
  });

  // RI-02: Editor 刷新邀请码 → PERMISSION_DENIED
  await runner.test('RI-02', 'Bob(editor) 刷新邀请码 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.refreshInviteCode(db, _, USERS.bob._id, USERS.bob._openid, {
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // RI-03: Viewer 刷新邀请码 → PERMISSION_DENIED
  await runner.test('RI-03', 'Carol(viewer) 刷新邀请码 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.refreshInviteCode(db, _, USERS.carol._id, USERS.carol._openid, {
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // RI-04: 跨家庭 admin 刷新 → PERMISSION_DENIED
  await runner.test('RI-04', 'Dave(Family-B admin) 刷新 Family-A → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    const result = await ops.refreshInviteCode(db, _, USERS.dave._id, USERS.dave._openid, {
      familyId: FAMILIES.family_a._id
    });
    return {
      pass: !result.success && result.error && result.error.code === 'PERMISSION_DENIED',
      actual: result
    };
  });

  // RI-05: 刷新后旧邀请码失效
  await runner.test('RI-05', '刷新后用旧码验证 → invalid', async () => {
    await resetFamilyA();
    const oldCode = FAMILIES.family_a.inviteCode;

    // 刷新邀请码
    await ops.refreshInviteCode(db, _, USERS.alice._id, USERS.alice._openid, {
      familyId: FAMILIES.family_a._id
    });

    // 用旧码验证
    const result = await ops.validateInviteCode(db, _, USERS.frank._id, USERS.frank._openid, {
      inviteCode: oldCode
    });
    await resetFamilyA();
    return {
      pass: result.success === true && result.data && result.data.valid === false,
      actual: result,
      detail: result.data && result.data.valid ? '旧码仍然有效!' : ''
    };
  });
};
