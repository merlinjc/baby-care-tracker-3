/**
 * action: updateMemberRole (FR-5)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-8 / FR-9）：
 * - role 白名单校验（admin / editor / viewer），拒绝脏值
 * - 权限判定改 isAdmin（原 creatorId === userId 不兼容 transferAdmin 后的新 admin）
 * - Sole admin 守卫：不允许唯一 admin 把自己降级
 * - 单一管理员约束：把他人设为 admin 时，当前 admin 自动降为 editor（保持唯一）
 * v4.3.2 改动（FR-6 / FR-A9 / FR-A12）：
 * - FR-6：限流扩面（10 次/分钟）
 * - FR-A9：乐观锁重试耗尽后返回 BUSY（原静默返回 ok，掩盖并发冲突）
 *         重试前重拉最新 family，否则重试永远用陈旧数据
 * - FR-A12：接入 logger.start/succeed/fail
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

const VALID_ROLES = ['admin', 'editor', 'viewer'];
const MAX_RETRY = 2;

async function updateMemberRole(ctx, params) {
  const { db, userId, openid, logger, rateLimiter } = ctx;
  const { familyId, targetUserId, role } = params || {};

  // [v4.3.2 FR-6] 限流
  if (rateLimiter) {
    const limit = await rateLimiter.check(`update_role_${openid}`);
    if (!limit.allowed) return errors.RATE_LIMITED();
  }

  await logger.start({ familyId, targetUserId, role });

  try {
    // [v4.3.1 FR-8] role 白名单
    if (!VALID_ROLES.includes(role)) {
      await logger.fail({ reason: 'INVALID_ROLE', role });
      return errors.INVALID_ROLE(role);
    }

    // [v4.3.2 FR-A9] 乐观锁重试循环（重试前重拉 family 避免陈旧数据）
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      const family = await getFamily(db, familyId);
      if (!family) {
        await logger.fail({ reason: 'FAMILY_NOT_FOUND' });
        return errors.FAMILY_NOT_FOUND();
      }

      // [v4.3.1 FR-9] isAdmin
      if (!isAdmin(userId, family)) {
        await logger.fail({ reason: 'PERMISSION_DENIED' });
        return errors.PERMISSION_DENIED('只有管理员才能修改成员权限');
      }

      if (!family.memberDetails) {
        await logger.fail({ reason: 'NO_MEMBER_DATA' });
        return errors.NO_MEMBER_DATA();
      }

      const targetMember = family.memberDetails.find(m => m.userId === targetUserId);
      if (!targetMember) {
        await logger.fail({ reason: 'NOT_MEMBER' });
        return errors.NOT_MEMBER();
      }

      // [v4.3.1 FR-8] Sole admin 守卫
      if (targetUserId === userId && targetMember.role === 'admin' && role !== 'admin') {
        const hasOtherAdmin = family.memberDetails.some(
          m => m.role === 'admin' && m.userId !== userId
        );
        if (!hasOtherAdmin) {
          await logger.fail({ reason: 'SOLE_ADMIN' });
          return errors.SOLE_ADMIN();
        }
      }

      // [v4.3.1 FR-8] 保持唯一 admin
      const memberDetails = family.memberDetails.map(m => {
        if (m.userId === targetUserId) return Object.assign({}, m, { role });
        if (role === 'admin' && m.role === 'admin' && m.userId !== targetUserId) {
          return Object.assign({}, m, { role: 'editor' });
        }
        return m;
      });

      const now = new Date();
      const nowTs = Date.now();

      // [v4.3.2 FR-A9] 乐观锁带 updatedAtTs 条件：只更新"我刚读到的版本"
      const updateData = { memberDetails, updatedAt: now, updatedAtTs: nowTs };
      if (role === 'admin' && targetUserId !== userId) {
        updateData.creatorId = targetUserId;
      }

      const result = await db.collection('families')
        .where({
          _id: familyId,
          updatedAtTs: family.updatedAtTs  // 乐观锁版本匹配
        })
        .update({ data: updateData });

      if (result.stats && result.stats.updated > 0) {
        // 成功：同步 users.familyRole
        await db.collection('users').doc(targetUserId).update({
          data: { familyRole: role, updatedAt: now, updatedAtTs: nowTs }
        }).catch((e) => logger.step('sync_target_user_role_failed', 'warn', { error: e.message }));

        if (role === 'admin' && targetUserId !== userId) {
          await db.collection('users').doc(userId).update({
            data: { familyRole: 'editor', updatedAt: now, updatedAtTs: nowTs }
          }).catch((e) => logger.step('sync_old_admin_role_failed', 'warn', { error: e.message }));
        }

        await logger.succeed({ targetUserId, newRole: role, attempts: attempt + 1 });
        return errors.ok({ targetUserId, newRole: role });
      }

      // 乐观锁未命中：继续下一轮（重新读 family）
      await logger.step('optimistic_lock_retry', 'warn', { attempt });
    }

    // MAX_RETRY 耗尽 → BUSY
    await logger.fail({ reason: 'UPDATE_ROLE_BUSY', retries: MAX_RETRY });
    return errors.BUSY({ message: '角色修改并发冲突，请稍后重试' });
  } catch (err) {
    await logger.fail(err);
    throw err;
  }
}

module.exports = updateMemberRole;
