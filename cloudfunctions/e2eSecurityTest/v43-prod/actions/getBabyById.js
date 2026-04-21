/**
 * action: getBabyById (v4.3.1 Hotfix)
 *
 * 背景：
 * - `babies.read` 安全规则要求 auth.openid 在 families[doc.familyId].memberOpenids 中
 * - 若当前用户 openid 未出现在 family.memberOpenids（v4.2 迁移漏洞 / removeMember 旧 bug /
 *   patrolMemberOpenids 未执行），客户端直连 doc().get() 或 where().get() 都会被拒 (-502003)
 * - 即便数据一致，对"非本人创建的宝宝"（_openid 不是当前用户）客户端读取依然脆弱
 *
 * 处理策略：
 * 1. 通过 admin SDK 读取 baby（绕过安全规则）
 * 2. 业务层做权限校验：
 *    - baby.familyId 必须等于 用户 users.familyId（用户只能看自己家庭的宝宝）
 *    - 调用者必须是该 family 的 members（使用 isMember 工具）
 * 3. 返回 null 而非抛错，保持与 BabyService 契约一致
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, user, userId } = ctx;
  const { babyId } = params;

  if (!babyId) {
    return errors.ok({ baby: null });
  }

  // 1. admin SDK 读取 baby
  let baby;
  try {
    const res = await db.collection('babies').doc(babyId).get();
    baby = res.data;
  } catch (err) {
    // doc 不存在
    return errors.ok({ baby: null });
  }

  if (!baby) {
    return errors.ok({ baby: null });
  }

  // 2. 业务层权限校验
  // 2.1 baby 必须有 familyId
  if (!baby.familyId) {
    return errors.ok({ baby: null });
  }

  // 2.2 用户必须属于某个家庭（未加入家庭的用户不应能访问任何 baby）
  if (!user || !user.familyId) {
    return errors.PERMISSION_DENIED('未加入家庭');
  }

  // 2.3 baby.familyId 必须等于 user.familyId
  if (baby.familyId !== user.familyId) {
    return errors.PERMISSION_DENIED('该宝宝不属于您的家庭');
  }

  // 2.4 双重校验：确保用户仍在 family.members 中（防止 user 文档 familyId 未同步）
  const family = await getFamily(db, baby.familyId);
  if (!family || !isMember(userId, family)) {
    return errors.PERMISSION_DENIED('您不是该家庭成员');
  }

  return errors.ok({ baby });
};
