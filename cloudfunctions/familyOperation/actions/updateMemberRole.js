/**
 * action: updateMemberRole (FR-5)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 * v4.3.1 改动（FR-8 / FR-9）：
 * - role 白名单校验（admin / editor / viewer），拒绝脏值
 * - 权限判定改 isAdmin（原 creatorId === userId 不兼容 transferAdmin 后的新 admin）
 * - Sole admin 守卫：不允许唯一 admin 把自己降级
 * - 单一管理员约束：把他人设为 admin 时，当前 admin 自动降为 editor（保持唯一）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

const VALID_ROLES = ['admin', 'editor', 'viewer'];

async function updateMemberRole(ctx, params, retryCount = 0) {
  const { db, userId } = ctx;
  const { familyId, targetUserId, role } = params;

  // [v4.3.1 FR-8] role 白名单
  if (!VALID_ROLES.includes(role)) {
    return errors.INVALID_ROLE(role);
  }

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  // [v4.3.1 FR-9] 改 isAdmin（与 dissolveFamily 对齐，兼容 transferAdmin 后的新 admin）
  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能修改成员权限');
  }

  if (!family.memberDetails) return errors.NO_MEMBER_DATA();

  const targetMember = family.memberDetails.find(m => m.userId === targetUserId);
  if (!targetMember) return errors.NOT_MEMBER();

  // [v4.3.1 FR-8] Sole admin 守卫：唯一 admin 不能把自己降级
  if (targetUserId === userId && targetMember.role === 'admin' && role !== 'admin') {
    const hasOtherAdmin = family.memberDetails.some(
      m => m.role === 'admin' && m.userId !== userId
    );
    if (!hasOtherAdmin) {
      return errors.SOLE_ADMIN();
    }
  }

  // [v4.3.1 FR-8] 保持唯一 admin：把他人设为 admin 时，当前 admin 自动降级 editor
  const memberDetails = family.memberDetails.map(m => {
    if (m.userId === targetUserId) return Object.assign({}, m, { role });
    if (role === 'admin' && m.role === 'admin' && m.userId !== targetUserId) {
      // 原 admin 自动降级为 editor
      return Object.assign({}, m, { role: 'editor' });
    }
    return m;
  });

  const now = new Date();
  const nowTs = Date.now();

  // 乐观锁写入
  const updateData = { memberDetails, updatedAt: now, updatedAtTs: nowTs };
  // 若产生了 admin 转让（role='admin' 且 targetUserId 非自己），同步更新 creatorId 便于后续统一识别
  if (role === 'admin' && targetUserId !== userId) {
    updateData.creatorId = targetUserId;
  }

  const result = await db.collection('families').doc(familyId).update({ data: updateData });

  if (result.stats && result.stats.updated === 0 && retryCount < 2) {
    return updateMemberRole(ctx, params, retryCount + 1);
  }

  // 同步 users.familyRole（目标用户）
  await db.collection('users').doc(targetUserId).update({
    data: { familyRole: role, updatedAt: now, updatedAtTs: nowTs }
  });

  // [v4.3.1 FR-8] 若发生了 admin 转让，同步原 admin 的 familyRole 为 editor
  if (role === 'admin' && targetUserId !== userId) {
    await db.collection('users').doc(userId).update({
      data: { familyRole: 'editor', updatedAt: now, updatedAtTs: nowTs }
    }).catch(() => {});
  }

  return errors.ok({ targetUserId, newRole: role });
}

module.exports = updateMemberRole;
