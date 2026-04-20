/**
 * action: updateBaby (v4.3.1 Hotfix3)
 *
 * 背景：
 * - 客户端直连 `babyCollection.doc().update()` 受规则 `doc._openid == auth.openid` 限制
 * - 存量宝宝 _openid 字段可能缺失或非当前 openid（admin SDK 早期创建 / v4.3.1 前），非创建者改不了
 * - 本 action 改走云函数 admin SDK，业务层做权限校验
 *
 * 权限模型：
 * - 必须是家庭成员（isMember）
 * - 必须是 admin 或 editor（viewer 不能改宝宝档案）
 * - baby.familyId 必须等于 user.familyId（防止跨家庭操作）
 *
 * 允许的字段：name / gender / birthDate / avatar
 * 不允许直接修改：_id / familyId / _openid / createdAt 等敏感字段（白名单过滤）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember, getUserRole } = require('../lib/auth');

// 允许更新的字段白名单
const ALLOWED_FIELDS = ['name', 'gender', 'birthDate', 'avatar'];

module.exports = async (ctx, params) => {
  const { db, user, userId } = ctx;
  const { babyId, data } = params;

  if (!babyId || !data || typeof data !== 'object') {
    return errors.PERMISSION_DENIED('参数错误');
  }

  // 1. 读取 baby
  let baby;
  try {
    const res = await db.collection('babies').doc(babyId).get();
    baby = res.data;
  } catch (err) {
    return errors.PERMISSION_DENIED('宝宝不存在');
  }

  if (!baby || !baby.familyId) {
    return errors.PERMISSION_DENIED('宝宝信息异常');
  }

  // 2. 权限校验
  // 2.1 用户必须属于某个家庭
  if (!user || !user.familyId) {
    return errors.PERMISSION_DENIED('未加入家庭');
  }

  // 2.2 baby 必须在用户当前家庭
  if (baby.familyId !== user.familyId) {
    return errors.PERMISSION_DENIED('该宝宝不属于您的家庭');
  }

  // 2.3 获取 family 做成员 + 角色校验
  const family = await getFamily(db, baby.familyId);
  if (!family) {
    return errors.FAMILY_NOT_FOUND();
  }
  if (!isMember(userId, family)) {
    return errors.PERMISSION_DENIED('您不是该家庭成员');
  }

  // 2.4 角色校验：viewer 不能改
  const role = getUserRole(userId, family);
  if (role === 'viewer') {
    return errors.PERMISSION_DENIED('仅查看权限，无法修改宝宝信息');
  }

  // 3. 白名单过滤 + 类型归一
  const updateData = {};
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }
  // birthDate 归一为 Date
  if (updateData.birthDate && typeof updateData.birthDate === 'string') {
    updateData.birthDate = new Date(updateData.birthDate);
  }

  if (Object.keys(updateData).length === 0) {
    return errors.ok({ updated: false, message: '没有可更新的字段' });
  }

  updateData.updatedAt = new Date();
  updateData.updatedAtTs = Date.now();

  // 4. 执行更新（admin SDK 绕过安全规则）
  await db.collection('babies').doc(babyId).update({ data: updateData });

  return errors.ok({
    updated: true,
    babyId,
    fields: Object.keys(updateData)
  });
};
