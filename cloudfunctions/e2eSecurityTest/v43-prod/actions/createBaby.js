/**
 * action: createBaby (FR-13)
 *
 * v4.3.0 改动：时间戳改用 Date（FR-13），新增 updatedAtTs 双时间戳
 * v4.3.1 改动（FR-1 / FR-2）：
 * - 写入 _openid = ctx.openid（创建者后续可通过客户端安全规则 `doc._openid == auth.openid` 修改）
 * - 权限收紧：仅 admin 可创建宝宝（原 isMember 允许 viewer，违反权限矩阵）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isAdmin } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId, openid } = ctx;
  const { familyId, name, gender, birthDate, avatar } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  // [v4.3.1 FR-2] 权限收紧为 admin；旧 isMember 允许 viewer 创建宝宝
  if (!isAdmin(userId, family)) {
    return errors.PERMISSION_DENIED('只有管理员才能创建宝宝');
  }

  const now = new Date();
  const nowTs = Date.now();
  const babyData = {
    // [v4.3.1 FR-1] admin SDK 写入的文档默认无 _openid，
    // 会导致客户端后续 updateBaby 被安全规则 `doc._openid == auth.openid` 拒绝；
    // 这里显式写入调用者 openid，使创建者能继续修改宝宝信息。
    _openid: openid || '',
    familyId,
    name,
    gender: gender || 'male',
    birthDate: birthDate ? new Date(birthDate) : now,
    avatar: avatar || '',
    createdAt: now,
    createdAtTs: nowTs,
    updatedAt: now,
    updatedAtTs: nowTs
  };

  const res = await db.collection('babies').add({ data: babyData });
  const babyId = res._id;

  // 更新 families.babies 数组
  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.push(babyId),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  return errors.ok(Object.assign({ _id: babyId }, babyData));
};
