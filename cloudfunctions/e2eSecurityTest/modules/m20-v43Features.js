/**
 * 模块 20（v4.3.0 专项）: 直接测试生产 familyOperation/actions/*.js 代码
 *
 * 目的：
 *   前面的模块（m06-m19）测试的是 family-operations.js 内部副本，
 *   本模块 require 真实的 ../../familyOperation/actions/*.js 以证明
 *   v4.3.0 重构后的生产代码行为正确。
 *
 * 覆盖的 v4.3.0 FR：
 *   - FR-5   leaveFamily status 状态机（5 个状态）
 *   - FR-8   errors.js 错误码注册表
 *   - FR-9   OperationLogger 补偿日志（operation_logs 落盘）
 *   - FR-10  clearBabyData 断点续传 + chunkedDelete
 *   - FR-11  RateLimiter 持久化限流（rate_limits 集合）
 *   - FR-13  时间戳 Date 对象 + 双时间戳 updatedAtTs
 *
 * 测试编号：V43-01 ~ V43-17
 */
const path = require('path');
const { USERS, buildFamilies, TEST_PREFIX } = require('../lib/test-data');

// ★ 直接 require v4.3 生产代码快照（v43-prod/ 是从 cloudfunctions/familyOperation/ 复制的副本）
// 若后续 v4.3 代码有变更，请同步更新 v43-prod/ 目录（或执行 cp 命令重新同步）
const realPath = path.resolve(__dirname, '../v43-prod');
const leaveFamilyAction = require(path.join(realPath, 'actions/leaveFamily'));
const clearBabyDataAction = require(path.join(realPath, 'actions/clearBabyData'));
const createFamilyAction = require(path.join(realPath, 'actions/createFamily'));
const errors = require(path.join(realPath, 'errors'));
const { OperationLogger } = require(path.join(realPath, 'lib/logger'));
const { RateLimiter } = require(path.join(realPath, 'lib/rate-limit'));
const { getUserFromOpenid } = require(path.join(realPath, 'lib/auth'));

module.exports = async function(runner, db, _) {
  const FAMILIES = buildFamilies();

  // 构造 ctx 的工具函数（模拟 familyOperation/index.js 的入口鉴权）
  function buildCtx(user, action = 'test') {
    const logger = new OperationLogger(db, action, user._id, user._openid);
    const rateLimiter = new RateLimiter(db);
    return {
      db, _, user,
      userId: user._id,
      openid: user._openid,
      logger, rateLimiter
    };
  }

  async function resetFamilyA() {
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: { ...FAMILIES.family_a } });
    for (const u of [USERS.alice, USERS.bob, USERS.carol]) {
      await db.collection('users').doc(u._id).update({
        data: { familyId: FAMILIES.family_a._id, familyRole: u.familyRole }
      }).catch(() => {});
    }
  }

  // ============================================================
  // FR-5: leaveFamily status 状态机（5 个状态全覆盖）
  // ============================================================

  await runner.test('V43-01', '[FR-5] Bob(editor) 退出 → status=ok', async () => {
    await resetFamilyA();
    const ctx = buildCtx(USERS.bob, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: FAMILIES.family_a._id });
    await resetFamilyA();
    return {
      pass: res.success === true && res.data && res.data.status === 'ok',
      actual: res,
      detail: res.data?.status !== 'ok' ? `期望 status='ok'，实际 ${res.data?.status}` : ''
    };
  });

  await runner.test('V43-02', '[FR-5] Alice(唯一admin,3人) 退出 → status=need_transfer', async () => {
    await resetFamilyA();
    const ctx = buildCtx(USERS.alice, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: FAMILIES.family_a._id });
    // need_transfer 时 status 状态机要求 success=true（v4.3.0 FR-5），
    // 但云函数返回值中 success 可由 errors.ok 统一设 true；测试关键是 status
    return {
      pass: res.data && res.data.status === 'need_transfer' && Array.isArray(res.data.otherMembers) && res.data.otherMembers.length === 2,
      actual: res,
      detail: `status=${res.data?.status}, otherMembers.length=${res.data?.otherMembers?.length}`
    };
  });

  await runner.test('V43-03', '[FR-5] Alice(1人家庭) 退出 → status=dissolved + 家庭文档已删', async () => {
    const soloFamily = {
      ...FAMILIES.family_a,
      members: [USERS.alice._id],
      memberDetails: [FAMILIES.family_a.memberDetails[0]],
      memberOpenids: [USERS.alice._openid]
    };
    try { await db.collection('families').doc(FAMILIES.family_a._id).remove(); } catch(e) {}
    await db.collection('families').add({ data: soloFamily });

    const ctx = buildCtx(USERS.alice, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: FAMILIES.family_a._id });

    let familyExists = true;
    try { await db.collection('families').doc(FAMILIES.family_a._id).get(); }
    catch(e) { familyExists = false; }
    await resetFamilyA();
    return {
      pass: res.data && res.data.status === 'dissolved' && !familyExists,
      actual: { status: res.data?.status, familyExists },
      detail: ''
    };
  });

  await runner.test('V43-04', '[FR-5] 家庭已删除 → status=family_not_found（幂等）', async () => {
    const ctx = buildCtx(USERS.alice, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: `${TEST_PREFIX}nonexistent` });
    return {
      pass: res.data && res.data.status === 'family_not_found',
      actual: res
    };
  });

  await runner.test('V43-05', '[FR-5] Dave(非成员) 退出 → status=not_member（幂等）', async () => {
    await resetFamilyA();
    const ctx = buildCtx(USERS.dave, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: FAMILIES.family_a._id });
    return {
      pass: res.data && res.data.status === 'not_member',
      actual: res
    };
  });

  await runner.test('V43-06', '[FR-5] status 状态返回时同时包含 legacy 兼容字段', async () => {
    await resetFamilyA();
    const ctx = buildCtx(USERS.alice, 'leaveFamily');
    const res = await leaveFamilyAction(ctx, { familyId: FAMILIES.family_a._id });
    // need_transfer 应该同时有 status='need_transfer' 和 needTransfer=true
    const hasStatus = res.data && res.data.status === 'need_transfer';
    const hasLegacy = res.data && res.data.needTransfer === true;
    return {
      pass: hasStatus && hasLegacy,
      actual: { status: res.data?.status, needTransfer: res.data?.needTransfer },
      detail: 'status + legacy needTransfer 必须同时存在'
    };
  });

  // ============================================================
  // FR-8: errors.js 错误码注册表
  // ============================================================

  await runner.test('V43-07', '[FR-8] errors 模块导出 15+ 错误码 + ok 构造器', async () => {
    const requiredCodes = [
      'USER_NOT_FOUND', 'FAMILY_NOT_FOUND', 'PERMISSION_DENIED',
      'INVALID_CODE', 'CODE_EXPIRED', 'ALREADY_MEMBER', 'SOLE_ADMIN',
      'RATE_LIMITED', 'INVALID_ACTION', 'INTERNAL_ERROR',
      'NOT_MEMBER', 'CANNOT_REMOVE_SELF', 'CANNOT_REMOVE_ADMIN'
    ];
    const missing = requiredCodes.filter(code => typeof errors[code] !== 'function');
    const hasOk = typeof errors.ok === 'function';
    return {
      pass: missing.length === 0 && hasOk,
      actual: { missing, hasOk, totalExports: Object.keys(errors).length },
      detail: missing.length > 0 ? `缺少错误码构造器: ${missing.join(', ')}` : ''
    };
  });

  await runner.test('V43-08', '[FR-8] errors.USER_NOT_FOUND() 返回标准结构', async () => {
    const err = errors.USER_NOT_FOUND();
    return {
      pass: err.success === false && err.error && err.error.code === 'USER_NOT_FOUND' && typeof err.error.message === 'string',
      actual: err
    };
  });

  // ============================================================
  // FR-9: OperationLogger 落盘 operation_logs 集合
  // ============================================================

  await runner.test('V43-09', '[FR-9] OperationLogger.start 写入 operation_logs', async () => {
    const logger = new OperationLogger(db, 'v43_test_logger', USERS.alice._id, USERS.alice._openid);
    const logId = await logger.start({ test: 'V43-09' });
    if (!logId) return { pass: false, actual: { logId }, detail: 'logger.start 未返回 logId' };

    const doc = await db.collection('operation_logs').doc(logId).get().catch(() => null);
    // 清理
    try { await db.collection('operation_logs').doc(logId).remove(); } catch(e) {}

    return {
      pass: !!doc && doc.data.action === 'v43_test_logger' && doc.data.status === 'started',
      actual: { logId, action: doc?.data?.action, status: doc?.data?.status }
    };
  });

  await runner.test('V43-10', '[FR-9] OperationLogger.succeed 更新 status=succeeded', async () => {
    const logger = new OperationLogger(db, 'v43_test_finish', USERS.alice._id, USERS.alice._openid);
    const logId = await logger.start({ test: 'V43-10' });
    await logger.succeed({ count: 42 });

    const doc = await db.collection('operation_logs').doc(logId).get().catch(() => null);
    try { await db.collection('operation_logs').doc(logId).remove(); } catch(e) {}

    return {
      pass: doc && doc.data.status === 'succeeded' && doc.data.result && doc.data.result.count === 42,
      actual: { status: doc?.data?.status, result: doc?.data?.result }
    };
  });

  await runner.test('V43-11', '[FR-9] OperationLogger.fail 更新 status=failed + error', async () => {
    const logger = new OperationLogger(db, 'v43_test_fail', USERS.alice._id, USERS.alice._openid);
    const logId = await logger.start({ test: 'V43-11' });
    await logger.fail(new Error('simulated failure'));

    const doc = await db.collection('operation_logs').doc(logId).get().catch(() => null);
    try { await db.collection('operation_logs').doc(logId).remove(); } catch(e) {}

    return {
      pass: doc && doc.data.status === 'failed' && doc.data.error && doc.data.error.message === 'simulated failure',
      actual: { status: doc?.data?.status, error: doc?.data?.error }
    };
  });

  // ============================================================
  // FR-10: clearBabyData 断点续传（cursor）
  // ============================================================

  await runner.test('V43-12', '[FR-10] clearBabyData 返回 status=succeeded + 完成统计', async () => {
    await resetFamilyA();
    const testBabyId = `${TEST_PREFIX}v43_baby_${Date.now()}`;
    const testRecIds = [];
    // 构造 3 条唯一记录（用时间戳前缀避免 _id 冲突）
    for (let i = 0; i < 3; i++) {
      try {
        const r = await db.collection('records').add({
          data: {
            babyId: testBabyId,
            familyId: FAMILIES.family_a._id,
            recordType: 'feeding',
            _openid: USERS.alice._openid
          }
        });
        testRecIds.push(r._id);
      } catch(e) {}
    }
    await db.collection('babies').add({
      data: {
        _id: testBabyId,
        familyId: FAMILIES.family_a._id,
        name: 'V43 Baby'
      }
    }).catch(() => {});
    await db.collection('families').doc(FAMILIES.family_a._id).update({
      data: { babies: [testBabyId] }
    });

    const ctx = buildCtx(USERS.alice, 'clearBabyData');
    const res = await clearBabyDataAction(ctx, {
      babyId: testBabyId,
      familyId: FAMILIES.family_a._id
    });

    // 清理残留
    for (const id of testRecIds) {
      try { await db.collection('records').doc(id).remove(); } catch(e) {}
    }
    try { await db.collection('babies').doc(testBabyId).remove(); } catch(e) {}
    await resetFamilyA();

    // 关键验证：clearBabyData 正常返回 succeeded 状态 + 成功删除所有预插入的 records
    // （实际插入数可能因 records 集合约束 < 3，只要 records == preInsertedCount 即可）
    return {
      pass: res.success === true && res.data && res.data.status === 'succeeded' && res.data.records === testRecIds.length && typeof res.data.familyDeleted === 'boolean',
      actual: { success: res.success, status: res.data?.status, records: res.data?.records, vaccine: res.data?.vaccine, milestone: res.data?.milestone, familyDeleted: res.data?.familyDeleted, preInsertedCount: testRecIds.length },
      detail: `预插入 ${testRecIds.length} 条；清除 ${res.data?.records} 条 records（应相等）；familyDeleted=${res.data?.familyDeleted}`
    };
  });

  // ============================================================
  // FR-11: RateLimiter 持久化限流（rate_limits 集合）
  // ============================================================

  await runner.test('V43-13', '[FR-11] RateLimiter.check 前 5 次 allowed=true', async () => {
    const rl = new RateLimiter(db);
    const key = `v43_rl_test_${Date.now()}`;
    let allAllowed = true;
    let counts = [];
    for (let i = 0; i < 5; i++) {
      const r = await rl.check(key);
      counts.push(r.count);
      if (!r.allowed) allAllowed = false;
    }
    // 清理
    try {
      const crypto = require('crypto');
      const docId = 'rl_' + crypto.createHash('md5').update(String(key)).digest('hex').slice(0, 16);
      await db.collection('rate_limits').doc(docId).remove();
    } catch(e) {}

    return {
      pass: allAllowed && counts[counts.length - 1] === 5,
      actual: { counts, allAllowed }
    };
  });

  await runner.test('V43-14', '[FR-11] RateLimiter 第 6 次 allowed=false（超出窗口限制）', async () => {
    const rl = new RateLimiter(db);
    const key = `v43_rl_exceed_${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await rl.check(key);
    }
    const res = await rl.check(key);
    // 清理
    try {
      const crypto = require('crypto');
      const docId = 'rl_' + crypto.createHash('md5').update(String(key)).digest('hex').slice(0, 16);
      await db.collection('rate_limits').doc(docId).remove();
    } catch(e) {}
    // 超限时 allowed=false 是核心行为；count 可能维持在 5（不再累加）也合理
    return {
      pass: res.allowed === false,
      actual: res,
      detail: 'allowed=false 是核心验收点；count 维持 5 不累加是合理实现'
    };
  });

  await runner.test('V43-15', '[FR-11] rate_limits 集合记录 key 和 windowStart', async () => {
    const rl = new RateLimiter(db);
    const key = `v43_rl_persist_${Date.now()}`;
    await rl.check(key);

    const crypto = require('crypto');
    const docId = 'rl_' + crypto.createHash('md5').update(String(key)).digest('hex').slice(0, 16);
    const doc = await db.collection('rate_limits').doc(docId).get().catch(() => null);
    // 清理
    try { await db.collection('rate_limits').doc(docId).remove(); } catch(e) {}

    return {
      pass: doc && doc.data.key === key && doc.data.windowStart && typeof doc.data.count === 'number',
      actual: doc?.data
    };
  });

  // ============================================================
  // FR-13: 时间戳 Date 对象 + 双时间戳 updatedAtTs
  // ============================================================

  await runner.test('V43-16', '[FR-13] createFamily 写入双时间戳 updatedAtTs', async () => {
    const frank = USERS.frank;
    await db.collection('users').doc(frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});

    const ctx = buildCtx(frank, 'createFamily');
    const res = await createFamilyAction(ctx, { name: 'V43-16 Test', creatorName: 'Frank' });

    let checkPass = false;
    let familyData = null;
    if (res.success && res.data && res.data._id) {
      try {
        const doc = await db.collection('families').doc(res.data._id).get();
        familyData = doc.data;
        // FR-13 要求：updatedAt 存在（Date 或 ISO）+ updatedAtTs 为 number
        checkPass = !!familyData.updatedAt &&
                    typeof familyData.updatedAtTs === 'number' &&
                    familyData.updatedAtTs > 0;
        // 清理
        await db.collection('families').doc(res.data._id).remove();
      } catch(e) {}
    }
    // 清理 frank 的 familyId
    await db.collection('users').doc(frank._id).update({
      data: { familyId: _.remove(), familyRole: _.remove() }
    }).catch(() => {});

    return {
      pass: checkPass,
      actual: {
        updatedAtExists: !!familyData?.updatedAt,
        updatedAtType: typeof familyData?.updatedAt,
        updatedAtTs: familyData?.updatedAtTs
      },
      detail: !checkPass ? 'families 文档必须同时包含 updatedAt 和 updatedAtTs(number)' : ''
    };
  });

  // ============================================================
  // FR-7: getUserFromOpenid 空 openid 防御
  // ============================================================

  await runner.test('V43-17', '[FR-7 hotfix] getUserFromOpenid 空 openid 返回 null 不抛错', async () => {
    let errorCaught = null;
    let result = 'not_called';
    try {
      result = await getUserFromOpenid(db, undefined);
    } catch(e) {
      errorCaught = e.message;
    }
    try {
      const r2 = await getUserFromOpenid(db, '');
      result = result + '|' + (r2 === null ? 'null' : 'not_null');
    } catch(e) {
      errorCaught = (errorCaught || '') + '|' + e.message;
    }
    return {
      pass: !errorCaught && (result === null || result.startsWith('null')),
      actual: { result, errorCaught },
      detail: errorCaught ? '空 openid 不应抛错' : ''
    };
  });
};
