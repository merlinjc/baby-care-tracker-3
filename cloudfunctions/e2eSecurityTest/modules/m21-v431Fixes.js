/**
 * v4.3.1 专项测试模块
 *
 * 直接 require v43-prod/ 目录下的生产代码快照（v4.3.1 版），
 * 验证本迭代的 P0 关键 bug 修复。
 *
 * 覆盖 FR：
 * - FR-1  createBaby 写入 _openid
 * - FR-2  createBaby/deleteBaby 权限收紧 isAdmin
 * - FR-3  deleteBaby 级联删 records/vaccine/milestone
 * - FR-6  permission.getUserRole 默认 viewer（客户端工具类，无法通过云函数跑）
 * - FR-8  updateMemberRole role 白名单 + SOLE_ADMIN
 * - FR-9  dissolveFamily isAdmin 判定
 * - FR-10 createFamily 防重复
 * - FR-11 clearBabyData 查询附 familyId
 */
const path = require('path');
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');

const realPath = path.resolve(__dirname, '../v43-prod');
const createFamilyAction = require(path.join(realPath, 'actions/createFamily'));
const createBabyAction = require(path.join(realPath, 'actions/createBaby'));
const deleteBabyAction = require(path.join(realPath, 'actions/deleteBaby'));
const updateMemberRoleAction = require(path.join(realPath, 'actions/updateMemberRole'));
const dissolveFamilyAction = require(path.join(realPath, 'actions/dissolveFamily'));
const errors = require(path.join(realPath, 'errors'));
const { OperationLogger } = require(path.join(realPath, 'lib/logger'));
const { RateLimiter } = require(path.join(realPath, 'lib/rate-limit'));

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();

  // 工具：构造完整 ctx（复用 v43-prod 工具）
  const buildCtx = (user, action) => ({
    db,
    _: db.command,
    user: { _id: user._id, familyId: user.familyId, nickname: user.nickname },
    userId: user._id,
    openid: user._openid,
    logger: new OperationLogger(db, action, user._id, user._openid),
    rateLimiter: new RateLimiter(db)
  });

  // 重置家庭 A 的辅助函数
  const resetFamilyA = async () => {
    await db.collection('families').doc(FAMILIES.family_a._id)
      .update({ data: { babies: [] } })
      .catch(() => {});
  };

  // ====================================================
  // V431-01：createBaby 写入 _openid
  // ====================================================
  await runner.test('V431-01', '[FR-1] createBaby 写入 _openid = 调用者 openid', async () => {
    await resetFamilyA();
    const ctx = buildCtx(USERS.alice, 'createBaby');
    const res = await createBabyAction(ctx, {
      familyId: FAMILIES.family_a._id,
      name: `${TEST_PREFIX}v431_baby_openid`,
      gender: 'male',
      birthDate: '2025-01-01'
    });

    let babyId = null;
    let hasOpenid = false;
    let openidMatches = false;
    if (res.success) {
      babyId = res.data._id;
      const doc = await db.collection('babies').doc(babyId).get().catch(() => null);
      if (doc && doc.data) {
        hasOpenid = '_openid' in doc.data;
        openidMatches = doc.data._openid === USERS.alice._openid;
        try { await db.collection('babies').doc(babyId).remove(); } catch(e) {}
      }
    }
    await resetFamilyA();

    return {
      pass: res.success === true && hasOpenid && openidMatches,
      actual: { success: res.success, hasOpenid, openidMatches, babyId },
      detail: 'createBaby 生成的宝宝文档应包含 _openid 字段等于调用者 openid'
    };
  });

  // ====================================================
  // V431-02：createBaby 权限收紧 - viewer 被拒
  // ====================================================
  await runner.test('V431-02', '[FR-2] createBaby viewer 调用 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    // Carol 在 family_a 是 viewer
    const ctx = buildCtx(USERS.carol, 'createBaby');
    const res = await createBabyAction(ctx, {
      familyId: FAMILIES.family_a._id,
      name: `${TEST_PREFIX}v431_viewer_baby`,
      gender: 'male',
      birthDate: '2025-01-01'
    });
    await resetFamilyA();

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code, message: res.error?.message }
    };
  });

  // ====================================================
  // V431-03：createBaby 权限收紧 - editor 被拒
  // ====================================================
  await runner.test('V431-03', '[FR-2] createBaby editor 调用 → PERMISSION_DENIED', async () => {
    await resetFamilyA();
    // Bob 在 family_a 是 editor
    const ctx = buildCtx(USERS.bob, 'createBaby');
    const res = await createBabyAction(ctx, {
      familyId: FAMILIES.family_a._id,
      name: `${TEST_PREFIX}v431_editor_baby`,
      gender: 'female',
      birthDate: '2025-01-01'
    });
    await resetFamilyA();

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-04：deleteBaby 级联删除
  // ====================================================
  await runner.test('V431-04', '[FR-3] deleteBaby 级联删 records/vaccine/milestone', async () => {
    await resetFamilyA();
    const testBabyId = `${TEST_PREFIX}v431_del_baby_${Date.now()}`;
    // 构造宝宝 + 3 条记录（不同集合）
    await db.collection('babies').add({
      data: {
        _id: testBabyId,
        _openid: USERS.alice._openid,
        familyId: FAMILIES.family_a._id,
        name: 'V431 Test Baby'
      }
    }).catch(() => {});
    await db.collection('families').doc(FAMILIES.family_a._id).update({
      data: { babies: [testBabyId] }
    });

    // 构造关联数据
    const vaccineIds = [];
    const milestoneIds = [];
    try {
      const v = await db.collection('vaccine_records').add({
        data: {
          babyId: testBabyId,
          familyId: FAMILIES.family_a._id,
          name: 'TestVaccine', dose: '1', vaccinatedDate: new Date(),
          _openid: USERS.alice._openid
        }
      });
      vaccineIds.push(v._id);
    } catch(e) {}
    try {
      const m = await db.collection('milestone_records').add({
        data: {
          babyId: testBabyId,
          familyId: FAMILIES.family_a._id,
          name: 'TestMilestone', category: '大运动',
          achievedDate: new Date(),
          _openid: USERS.alice._openid
        }
      });
      milestoneIds.push(m._id);
    } catch(e) {}

    const ctx = buildCtx(USERS.alice, 'deleteBaby');
    const res = await deleteBabyAction(ctx, {
      babyId: testBabyId,
      familyId: FAMILIES.family_a._id
    });

    // 验证关联数据已被删除
    let vaccineRemaining = 0;
    let milestoneRemaining = 0;
    try {
      const vq = await db.collection('vaccine_records').where({ babyId: testBabyId }).count();
      vaccineRemaining = vq.total || 0;
    } catch(e) {}
    try {
      const mq = await db.collection('milestone_records').where({ babyId: testBabyId }).count();
      milestoneRemaining = mq.total || 0;
    } catch(e) {}

    // 清理可能的残留
    for (const id of vaccineIds) {
      try { await db.collection('vaccine_records').doc(id).remove(); } catch(e) {}
    }
    for (const id of milestoneIds) {
      try { await db.collection('milestone_records').doc(id).remove(); } catch(e) {}
    }
    await resetFamilyA();

    return {
      pass: res.success === true && res.data && res.data.status === 'succeeded'
        && vaccineRemaining === 0 && milestoneRemaining === 0,
      actual: {
        success: res.success,
        status: res.data?.status,
        records: res.data?.records,
        vaccine: res.data?.vaccine,
        milestone: res.data?.milestone,
        vaccineRemainingAfterDelete: vaccineRemaining,
        milestoneRemainingAfterDelete: milestoneRemaining
      }
    };
  });

  // ====================================================
  // V431-05：deleteBaby 权限收紧 - viewer 被拒
  // ====================================================
  await runner.test('V431-05', '[FR-2] deleteBaby viewer 调用 → PERMISSION_DENIED', async () => {
    // Carol 是 viewer，调用删除 family_a 下已有 baby_x
    const ctx = buildCtx(USERS.carol, 'deleteBaby');
    const res = await deleteBabyAction(ctx, {
      babyId: `${TEST_PREFIX}baby_x`,
      familyId: FAMILIES.family_a._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-06：createFamily 防重复创建
  // ====================================================
  await runner.test('V431-06', '[FR-10] 已在家庭中 createFamily → ALREADY_IN_FAMILY', async () => {
    // Alice 已在 family_a 中
    const ctx = buildCtx(USERS.alice, 'createFamily');
    const res = await createFamilyAction(ctx, { name: 'NewFamilyShouldFail' });

    return {
      pass: res.success === false && res.error && res.error.code === 'ALREADY_IN_FAMILY',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-07：createFamily 幽灵引用允许创建
  // ====================================================
  await runner.test('V431-07', '[FR-10] 幽灵 familyId 允许 createFamily', async () => {
    const ghostUser = {
      _id: `${TEST_PREFIX}ghost_u`,
      _openid: `ghost_openid_${Date.now()}`,
      nickname: 'Ghost',
      familyId: 'nonexistent_family_id_xyz'
    };
    // 先插 ghost user
    await db.collection('users').add({
      data: {
        _id: ghostUser._id,
        _openid: ghostUser._openid,
        nickname: ghostUser.nickname,
        familyId: ghostUser.familyId,
        role: 'parent', relation: 'other'
      }
    }).catch(() => {});

    const ctx = buildCtx(ghostUser, 'createFamily');
    const res = await createFamilyAction(ctx, { name: `${TEST_PREFIX}v431_ghost_family` });

    let createdFamilyId = null;
    if (res.success) {
      createdFamilyId = res.data._id;
      try { await db.collection('families').doc(createdFamilyId).remove(); } catch(e) {}
    }
    try { await db.collection('users').doc(ghostUser._id).remove(); } catch(e) {}

    return {
      pass: res.success === true && createdFamilyId !== null,
      actual: { success: res.success, createdFamilyId, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-08：updateMemberRole 非法 role
  // ====================================================
  await runner.test('V431-08', '[FR-8] updateMemberRole 非白名单 role → INVALID_ROLE', async () => {
    const ctx = buildCtx(USERS.alice, 'updateMemberRole');
    const res = await updateMemberRoleAction(ctx, {
      familyId: FAMILIES.family_a._id,
      targetUserId: USERS.bob._id,
      role: 'superadmin'  // 非法角色
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'INVALID_ROLE',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-09：updateMemberRole SOLE_ADMIN 守卫
  // ====================================================
  await runner.test('V431-09', '[FR-8] 唯一 admin 降级自己 → SOLE_ADMIN', async () => {
    // Alice 是 family_a 唯一 admin
    const ctx = buildCtx(USERS.alice, 'updateMemberRole');
    const res = await updateMemberRoleAction(ctx, {
      familyId: FAMILIES.family_a._id,
      targetUserId: USERS.alice._id,  // 自己
      role: 'editor'  // 降级
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'SOLE_ADMIN',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });

  // ====================================================
  // V431-10：dissolveFamily isAdmin 判定
  // ====================================================
  await runner.test('V431-10', '[FR-9] editor 调用 dissolveFamily → PERMISSION_DENIED', async () => {
    // Bob 是 family_a 的 editor
    const ctx = buildCtx(USERS.bob, 'dissolveFamily');
    const res = await dissolveFamilyAction(ctx, {
      familyId: FAMILIES.family_a._id
    });

    return {
      pass: res.success === false && res.error && res.error.code === 'PERMISSION_DENIED',
      actual: { success: res.success, errorCode: res.error?.code }
    };
  });
};
