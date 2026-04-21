/**
 * action: deleteBaby (FR-13)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId } = ctx;
  const { babyId, familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isMember(userId, family)) return errors.PERMISSION_DENIED('不是家庭成员');

  const now = new Date();
  const nowTs = Date.now();

  // 从 families.babies 数组 pull
  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.pull(babyId),
      updatedAt: now,
      updatedAtTs: nowTs
    }
  });

  // 删除 babies 文档
  await db.collection('babies').doc(babyId).remove();

  return errors.ok({ deletedBabyId: babyId });
};
