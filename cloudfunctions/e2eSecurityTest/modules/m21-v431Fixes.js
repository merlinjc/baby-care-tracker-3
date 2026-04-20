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
 *
 * Hotfix 补充（V431-11 ~ V431-13）：
 * - getBabyById action（admin SDK + 业务层同家庭校验）
 * - updateBaby action（admin SDK + editor+ 权限 + 白名单 + 跨家庭拦截）
 */
const path = require('path');
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');

const realPath = path.resolve(__dirname, '../v43-prod');
const createFamilyAction = require(path.join(realPath, 'actions/createFamily'));
const createBabyAction = require(path.join(realPath, 'actions/createBaby'));
const deleteBabyAction = require(path.join(realPath, 'actions/deleteBaby'));
const updateMemberRoleAction = require(path.join(realPath, 'actions/updateMemberRole'));
const dissolveFamilyAction = require(path.join(realPath, 'actions/dissolveFamily'));
const getBabyByIdAction = require(path.join(realPath, 'actions/getBabyById'));
const updateBabyAction = require(path.join(realPath, 'actions/updateBaby'));
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

  // ====================================================
  // V431-11：getBabyById 同家庭成员可读、跨家庭/viewer 拒绝
  // ====================================================
  await runner.test('V431-11', '[Hotfix2] getBabyById 同家庭可读、跨家庭拒绝、无家庭拒绝', async () => {
    const babyId = `${TEST_PREFIX}baby_x`;

    // 同家庭 admin Alice → 可读
    const aliceRes = await getBabyByIdAction(
      buildCtx(USERS.alice, 'getBabyById'),
      { babyId }
    );

    // 同家庭 viewer Carol → 也应可读（getBabyById 只校验成员，不校验角色）
    const carolRes = await getBabyByIdAction(
      buildCtx(USERS.carol, 'getBabyById'),
      { babyId }
    );

    // 跨家庭 Dave (family_b) → PERMISSION_DENIED
    const daveRes = await getBabyByIdAction(
      buildCtx(USERS.dave, 'getBabyById'),
      { babyId }
    );

    // 无家庭 Frank → PERMISSION_DENIED
    const frankRes = await getBabyByIdAction(
      buildCtx(USERS.frank, 'getBabyById'),
      { babyId }
    );

    const aliceCanRead = aliceRes.success === true && aliceRes.data?.baby?._id === babyId;
    const carolCanRead = carolRes.success === true && carolRes.data?.baby?._id === babyId;
    const daveBlocked = daveRes.success === false && daveRes.error?.code === 'PERMISSION_DENIED';
    const frankBlocked = frankRes.success === false && frankRes.error?.code === 'PERMISSION_DENIED';

    return {
      pass: aliceCanRead && carolCanRead && daveBlocked && frankBlocked,
      actual: { aliceCanRead, carolCanRead, daveBlocked, frankBlocked },
      detail: '同家庭成员（含 viewer）均可读；跨家庭/无家庭 → PERMISSION_DENIED'
    };
  });

  // ====================================================
  // V431-12：updateBaby editor 可改、viewer 拒绝、白名单过滤
  // ====================================================
  await runner.test('V431-12', '[Hotfix3] updateBaby editor 可改、viewer 拒绝、白名单过滤敏感字段', async () => {
    const babyId = `${TEST_PREFIX}baby_x`;

    // 1. Bob(editor) 修改 name → 成功
    const bobRes = await updateBabyAction(
      buildCtx(USERS.bob, 'updateBaby'),
      { babyId, data: { name: 'V431-12-BobEdit' } }
    );
    const bobCanEdit = bobRes.success === true && bobRes.data?.updated === true;

    // 2. Carol(viewer) 修改 name → PERMISSION_DENIED
    const carolRes = await updateBabyAction(
      buildCtx(USERS.carol, 'updateBaby'),
      { babyId, data: { name: 'ShouldFail' } }
    );
    const carolBlocked = carolRes.success === false && carolRes.error?.code === 'PERMISSION_DENIED';

    // 3. Bob 尝试篡改 familyId / _openid → 白名单过滤后应仅 name 生效
    await updateBabyAction(
      buildCtx(USERS.bob, 'updateBaby'),
      {
        babyId,
        data: {
          name: 'V431-12-Whitelist',
          familyId: 'malicious_family_id',
          _openid: 'malicious_openid',
          _id: 'malicious_id'
        }
      }
    );
    const afterDoc = await db.collection('babies').doc(babyId).get();
    const familyIdUntouched = afterDoc.data.familyId === FAMILIES.family_a._id;
    const openidUntouched = afterDoc.data._openid !== 'malicious_openid';

    // 还原 name 为 Baby X
    await updateBabyAction(
      buildCtx(USERS.bob, 'updateBaby'),
      { babyId, data: { name: 'Baby X' } }
    );

    return {
      pass: bobCanEdit && carolBlocked && familyIdUntouched && openidUntouched,
      actual: {
        bobCanEdit,
        carolBlocked,
        carolErrorCode: carolRes.error?.code,
        familyIdUntouched,
        openidUntouched,
        currentFamilyId: afterDoc.data.familyId
      },
      detail: 'editor 可改 name、viewer 被拒、白名单过滤 familyId/_openid/_id 篡改'
    };
  });

  // ====================================================
  // V431-13：updateBaby 跨家庭拦截 + 双时间戳
  // ====================================================
  await runner.test('V431-13', '[Hotfix3] updateBaby 跨家庭 → PERMISSION_DENIED + 自动写 updatedAtTs', async () => {
    const babyId = `${TEST_PREFIX}baby_x`;  // family_a 的宝宝

    // 1. Dave (family_b) 尝试改 family_a 的 baby_x → PERMISSION_DENIED
    const daveRes = await updateBabyAction(
      buildCtx(USERS.dave, 'updateBaby'),
      { babyId, data: { name: 'HackedByDave' } }
    );
    const daveBlocked = daveRes.success === false && daveRes.error?.code === 'PERMISSION_DENIED';

    // 2. Alice 正常修改，验证 updatedAtTs 双时间戳写入
    const beforeTs = Date.now();
    const aliceRes = await updateBabyAction(
      buildCtx(USERS.alice, 'updateBaby'),
      { babyId, data: { name: 'V431-13-Timestamp' } }
    );

    let updatedAtTsOk = false;
    let updatedAtOk = false;
    if (aliceRes.success) {
      const doc = await db.collection('babies').doc(babyId).get();
      const ts = doc.data.updatedAtTs;
      updatedAtTsOk = typeof ts === 'number' && ts >= beforeTs && ts <= Date.now() + 1000;
      updatedAtOk = doc.data.updatedAt !== undefined;
    }

    // 还原 name
    await updateBabyAction(
      buildCtx(USERS.alice, 'updateBaby'),
      { babyId, data: { name: 'Baby X' } }
    );

    return {
      pass: daveBlocked && aliceRes.success === true && updatedAtTsOk && updatedAtOk,
      actual: {
        daveBlocked,
        daveErrorCode: daveRes.error?.code,
        aliceUpdateSuccess: aliceRes.success,
        updatedAtTsOk,
        updatedAtOk
      },
      detail: '跨家庭被拦截；同家庭 admin 修改后自动写 updatedAt + updatedAtTs'
    };
  });
};
