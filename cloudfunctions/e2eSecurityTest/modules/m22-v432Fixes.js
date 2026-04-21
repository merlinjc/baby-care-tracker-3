/**
 * v4.3.2 专项测试模块
 *
 * 验收本迭代核心改动（使用 v43-prod 快照直接验证）：
 * - FR-6   限流扩面
 * - FR-A9  updateMemberRole BUSY 错误码
 * - FR-A10 transferAdmin isMember 交叉校验
 * - FR-A11 refreshInviteCode 冲突检测 + 限流 + logger
 * - FR-A12 全量 action 接入 logger
 * - FR-A17 rule-simulator 对齐线上规则
 * - FR-A18 clearBabyData 续传 BABY_NOT_FOUND
 */
const path = require('path');
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');

const realPath = path.resolve(__dirname, '../v43-prod');
const transferAdminAction = require(path.join(realPath, 'actions/transferAdmin'));
const refreshInviteCodeAction = require(path.join(realPath, 'actions/refreshInviteCode'));
const dissolveFamilyAction = require(path.join(realPath, 'actions/dissolveFamily'));
const removeMemberAction = require(path.join(realPath, 'actions/removeMember'));
const leaveFamilyAction = require(path.join(realPath, 'actions/leaveFamily'));
const createFamilyAction = require(path.join(realPath, 'actions/createFamily'));
const updateMemberRoleAction = require(path.join(realPath, 'actions/updateMemberRole'));
const clearBabyDataAction = require(path.join(realPath, 'actions/clearBabyData'));
const errors = require(path.join(realPath, 'errors'));
const { OperationLogger } = require(path.join(realPath, 'lib/logger'));
const { RateLimiter } = require(path.join(realPath, 'lib/rate-limit'));
const { RuleSimulator } = require('../lib/rule-simulator');

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();

  const buildCtx = (user, action) => ({
    db,
    _: db.command,
    user: { _id: user._id, familyId: user.familyId, nickname: user.nickname },
    userId: user._id,
    openid: user._openid,
    logger: new OperationLogger(db, action, user._id, user._openid),
    rateLimiter: new RateLimiter(db)
  });

  // ====================================================
  // V432-01：transferAdmin isMember 交叉校验（FR-A10）
  // ====================================================
  await runner.test('V432-01', '[FR-A10] transferAdmin 非成员 → NOT_MEMBER', async () => {
    const ctx = buildCtx(USERS.alice, 'transferAdmin');
    const res = await transferAdminAction(ctx, {
      familyId: FAMILIES.family_a._id,
      newAdminId: USERS.dave._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'NOT_MEMBER',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V432-02：refreshInviteCode admin 可正常刷新（FR-A11）
  // ====================================================
  await runner.test('V432-02', '[FR-A11] refreshInviteCode admin 可正常刷新', async () => {
    const ctx = buildCtx(USERS.alice, 'refreshInviteCode');
    const res = await refreshInviteCodeAction(ctx, {
      familyId: FAMILIES.family_a._id
    });

    const hasNewCode = res.success === true && res.data && res.data.inviteCode;

    return {
      pass: hasNewCode,
      actual: { success: res.success, hasNewCode: !!hasNewCode }
    };
  });

  // ====================================================
  // V432-03：refreshInviteCode 非 admin 拒绝（FR-A11）
  // ====================================================
  await runner.test('V432-03', '[FR-A11] refreshInviteCode editor → PERMISSION_DENIED', async () => {
    const ctx = buildCtx(USERS.bob, 'refreshInviteCode');
    const res = await refreshInviteCodeAction(ctx, {
      familyId: FAMILIES.family_a._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V432-04：errors.BUSY 错误码可用（FR-A9）
  // ====================================================
  await runner.test('V432-04', '[FR-A9] errors.BUSY 返回 code=BUSY', async () => {
    const busyErr = errors.BUSY();
    const hasCode = busyErr && busyErr.error && busyErr.error.code === 'BUSY';

    return {
      pass: hasCode,
      actual: { hasCode, code: busyErr?.error?.code }
    };
  });

  // ====================================================
  // V432-05：errors.NOT_MEMBER 错误码可用（FR-A10）
  // ====================================================
  await runner.test('V432-05', '[FR-A10] errors.NOT_MEMBER(msg) 返回正确结构', async () => {
    const notMemberErr = errors.NOT_MEMBER('test msg');
    const hasCode = notMemberErr && notMemberErr.error &&
      notMemberErr.error.code === 'NOT_MEMBER';

    return {
      pass: hasCode,
      actual: { hasCode, code: notMemberErr?.error?.code }
    };
  });

  // ====================================================
  // V432-06：dissolveFamily 复用 dissolveFamilyCore（T-3.21）
  // ====================================================
  await runner.test('V432-06', '[T-3.21] dissolveFamily editor 仍被拒 → PERMISSION_DENIED', async () => {
    const ctx = buildCtx(USERS.bob, 'dissolveFamily');
    const res = await dissolveFamilyAction(ctx, {
      familyId: FAMILIES.family_a._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V432-07：removeMember 限流 + logger（FR-6/A12）
  // ====================================================
  await runner.test('V432-07', '[FR-6/A12] removeMember 非 admin 拒绝', async () => {
    const ctx = buildCtx(USERS.bob, 'removeMember');
    const res = await removeMemberAction(ctx, {
      familyId: FAMILIES.family_a._id,
      targetUserId: USERS.carol._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V432-08：leaveFamily 幂等返回（FR-A12）
  // ====================================================
  await runner.test('V432-08', '[FR-A12] leaveFamily 不存在的家庭 → 仍返回 success（幂等）', async () => {
    const frankNoFamily = { ...USERS.frank, familyId: 'nonexistent' };
    const ctx = buildCtx(frankNoFamily, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, {
      familyId: 'nonexistent'
    });

    // leaveFamily 对不存在的家庭返回 success=true（幂等设计）
    return {
      pass: res.success === true,
      actual: { success: res.success, errorCode: res.error?.code, status: res.data?.status }
    };
  });

  // ====================================================
  // V432-09：createFamily logger + 去冗余入参（FR-5/A12）
  // ====================================================
  await runner.test('V432-09', '[FR-5/A12] createFamily 已在家庭 → ALREADY_IN_FAMILY', async () => {
    const ctx = buildCtx(USERS.alice, 'createFamily');
    const res = await createFamilyAction(ctx, {
      name: `${TEST_PREFIX}v432_dup`,
      creatorId: 'malicious_id',
      creatorName: 'hacker'
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'ALREADY_IN_FAMILY',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V432-10：RuleSimulator families.update 规则对齐（FR-A17）
  // ====================================================
  await runner.test('V432-10', '[FR-A17] RuleSimulator families.update = memberOpenids contains', async () => {
    const sim = new RuleSimulator(db);
    const hasUpdateRule = 'update' in sim.rules.families;
    const isMemberRule = hasUpdateRule && sim.rules.families.update.includes('memberOpenids');

    return {
      pass: isMemberRule,
      actual: { updateRule: sim.rules.families.update }
    };
  });

  // ====================================================
  // V432-11：RuleSimulator babies.delete = false（FR-A17）
  // ====================================================
  await runner.test('V432-11', '[FR-A17] RuleSimulator babies.delete = false', async () => {
    const sim = new RuleSimulator(db);
    const deleteDisabled = sim.rules.babies.delete === false;

    return {
      pass: deleteDisabled,
      actual: { babiesDelete: sim.rules.babies.delete }
    };
  });

  // ====================================================
  // V432-12：RateLimiter 支持 dissolve/refresh/transfer key（FR-6）
  // ====================================================
  await runner.test('V432-12', '[FR-6] RateLimiter 支持 dissolve/refresh/transfer key', async () => {
    const limiter = new RateLimiter(db);
    let dissolveOk = false, refreshOk = false, transferOk = false;

    try {
      const r1 = await limiter.check(`dissolve_test_openid`);
      dissolveOk = r1 && typeof r1.allowed === 'boolean';
    } catch(e) {}

    try {
      const r2 = await limiter.check(`refresh_invite_test_openid`);
      refreshOk = r2 && typeof r2.allowed === 'boolean';
    } catch(e) {}

    try {
      const r3 = await limiter.check(`transfer_admin_test_openid`);
      transferOk = r3 && typeof r3.allowed === 'boolean';
    } catch(e) {}

    return {
      pass: dissolveOk && refreshOk && transferOk,
      actual: { dissolveOk, refreshOk, transferOk }
    };
  });

  // ====================================================
  // V432-13：clearBabyData 续传 BABY_NOT_FOUND（FR-A18）
  // ====================================================
  await runner.test('V432-13', '[FR-A18] clearBabyData 不存在的 baby + cursor → babyAlreadyDeleted', async () => {
    const ghostBabyId = `${TEST_PREFIX}v432_ghost_baby_${Date.now()}`;
    const ctx = buildCtx(USERS.dave, 'clearBabyData');
    const res = await clearBabyDataAction(ctx, {
      babyId: ghostBabyId,
      familyId: FAMILIES.family_b._id,
      cursor: JSON.stringify({ phase: 'records', totalCleared: { records: 0, vaccine: 0, milestone: 0 } })
    });

    const isSucceeded = res.success === true && res.data &&
      (res.data.status === 'succeeded' || res.data.babyAlreadyDeleted === true);

    return {
      pass: isSucceeded,
      actual: {
        success: res.success,
        status: res.data?.status,
        babyAlreadyDeleted: res.data?.babyAlreadyDeleted
      }
    };
  });
};
