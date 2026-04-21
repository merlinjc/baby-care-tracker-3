/**
 * action: joinFamily (FR-2, FR-11)
 * v4.3.0 改动：
 * - 持久化限流替代内存 Map（FR-11 使用 ctx.rateLimiter）
 * - 时间戳改用 Date（FR-13）
 *
 * [v4.3.2 FR-A8 + FR-A12] 幽灵成员切换顺序反转 + 接入 logger
 *
 * 根因（v4.3.1 前）：顺序为"先 pull 旧家 + 清 users.familyId" → "再 push 新家 + 写新 users.familyId"；
 * 第二步中途失败（新家庭被并发 dissolve / 网络抖动 / admin SDK 限流）时：
 *   - 旧家庭 members 已被 pull（回不去）
 *   - users.familyId 已被清空
 *   - 新家庭 push 失败
 *   → 用户既不在旧家也不在新家，成为无家可归的孤儿
 *
 * 修复：反转顺序为"先 push 新家" → "写 users.familyId" → "最后 pull 旧家"。
 *   - 步骤 1（push 新家）失败：用户仍完整保留在旧家，无副作用 → INTERNAL_ERROR
 *   - 步骤 2（写 users.familyId）失败：用户已在新家 members 中但 users.familyId
 *     尚未切换，由 patrol 反向漂移（规则 A）自动修复 → ok + warning='STALE_USER_POINTER'
 *   - 步骤 3（pull 旧家）失败：旧家残留成员记录，由 patrol 反向漂移自动清理
 *     → ok + warning='STALE_OLD_FAMILY_MEMBERSHIP'
 *
 * 客户端感知：
 *   - success:true 时视为加入成功，但需识别 data.warning 字段
 *   - patrol 每日巡检会补偿 STALE_* 类状态
 */
const errors = require('../errors');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid, rateLimiter, logger } = ctx;
  const { inviteCode, userName, relation } = params;

  // [v4.3.0 FR-11] 持久化限流（60s 内最多 5 次）
  const limitKey = `invite_${openid}`;
  const limit = await rateLimiter.check(limitKey);
  if (!limit.allowed) {
    return errors.RATE_LIMITED();
  }

  // [v4.3.2 FR-A12] 接入 logger.start（多步操作失败时供 patrol 扫到补偿）
  await logger.start({ inviteCode: String(inviteCode || ''), userId });

  // 1. 查询家庭
  const familyRes = await db.collection('families')
    .where({ inviteCode: String(inviteCode || '').toUpperCase() })
    .get();

  if (familyRes.data.length === 0) {
    await logger.fail({ message: 'INVALID_CODE' });
    return errors.INVALID_CODE();
  }

  const family = familyRes.data[0];
  const now = new Date();
  const nowTs = Date.now();

  // 2. 检查过期（inviteCodeExpiry 可能是 Date 或 ISO 字符串）
  if (family.inviteCodeExpiry) {
    const expireAt = family.inviteCodeExpiry instanceof Date
      ? family.inviteCodeExpiry
      : new Date(family.inviteCodeExpiry);
    if (expireAt < now) {
      await logger.fail({ message: 'CODE_EXPIRED' });
      return errors.CODE_EXPIRED();
    }
  }

  // 3. 检查是否已是成员
  if (family.members && family.members.includes(userId)) {
    await logger.succeed({ status: 'already_member', familyId: family._id });
    return errors.ALREADY_MEMBER();
  }

  // 4. [v4.1 FR-9] 幽灵成员防护 —— 判定
  const existingFamilyRes = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();

  const existingFamily = existingFamilyRes.data[0] || null;
  const needsMigration = existingFamily && existingFamily._id !== family._id;

  if (needsMigration) {
    const memberDetail = existingFamily.memberDetails &&
      existingFamily.memberDetails.find(m => m.userId === userId);
    const isAdminRole = memberDetail && memberDetail.role === 'admin';
    const hasOtherAdmin = existingFamily.memberDetails &&
      existingFamily.memberDetails.some(m => m.role === 'admin' && m.userId !== userId);

    if (isAdminRole && !hasOtherAdmin) {
      await logger.fail({ message: 'SOLE_ADMIN' });
      return errors.SOLE_ADMIN();
    }
  }

  // ========================================
  // ★★ [v4.3.2 FR-A8] 反转顺序 ★★
  //   步骤 5：先 push 新家（失败 → 完整回滚，无副作用）
  //   步骤 6：写 users.familyId（失败 → patrol 规则 A 补偿）
  //   步骤 7：最后 pull 旧家（失败 → patrol 反向漂移清理）
  // ========================================

  const newMemberDetail = {
    userId,
    name: userName,
    relation: relation || '家人',
    role: 'editor',
    joinedAt: now
  };

  // 步骤 5：加入新家庭（第一优先）
  try {
    await db.collection('families').doc(family._id).update({
      data: {
        members: _.push(userId),
        memberDetails: _.push(newMemberDetail),
        memberOpenids: _.push(openid),
        updatedAt: now,
        updatedAtTs: nowTs
      }
    });
    await logger.step('join_new_family', 'ok', { familyId: family._id });
  } catch (err) {
    // 新家 push 失败 → 用户仍完整保留在旧家（无副作用）
    await logger.step('join_new_family', 'fail', { err: String(err && err.message || err) });
    await logger.fail(err);
    return errors.INTERNAL_ERROR(err);
  }

  // 步骤 6：更新 users.familyId
  try {
    await db.collection('users').doc(userId).update({
      data: {
        familyId: family._id,
        familyRole: 'editor',
        updatedAt: now,
        updatedAtTs: nowTs
      }
    });
    await logger.step('update_user_familyId', 'ok', {});
  } catch (err) {
    // 用户已在新家 members 中但 users.familyId 未切换
    // patrol 反向漂移（规则 A：若 user 在某 family.members 中但 users.familyId !== 该 family._id）会补偿
    await logger.step('update_user_familyId', 'fail', { err: String(err && err.message || err) });
    await logger.partial('USER_FAMILYID_UPDATE_FAILED');
    return errors.ok({
      familyId: family._id,
      familyName: family.name,
      warning: 'STALE_USER_POINTER'
    });
  }

  // 步骤 7：最后从旧家庭移除（失败不致命，patrol 反向漂移清理）
  if (needsMigration) {
    try {
      await db.collection('families').doc(existingFamily._id).update({
        data: {
          members: _.pull(userId),
          memberDetails: _.pull({ userId }),
          memberOpenids: _.pull(openid),
          updatedAt: now,
          updatedAtTs: nowTs
        }
      });
      await logger.step('leave_old_family', 'ok', { oldFamilyId: existingFamily._id });
    } catch (err) {
      // 旧家残留成员记录（user 仍在 existingFamily.members 里）
      // patrol 反向漂移扫描时会发现 user.familyId=新家 而 existingFamily.members 含 user._id
      // → 对应规则：从旧家 members 中 pull 该 user
      await logger.step('leave_old_family', 'fail', {
        oldFamilyId: existingFamily._id,
        err: String(err && err.message || err)
      });
      await logger.partial('STALE_OLD_FAMILY_MEMBERSHIP');
      return errors.ok({
        familyId: family._id,
        familyName: family.name,
        warning: 'STALE_OLD_FAMILY_MEMBERSHIP',
        oldFamilyId: existingFamily._id
      });
    }
  }

  await logger.succeed({ familyId: family._id });
  return errors.ok({ familyId: family._id, familyName: family.name });
};
