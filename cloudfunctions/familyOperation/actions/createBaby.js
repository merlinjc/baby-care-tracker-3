/**
 * action: createBaby (FR-13)
 * v4.3.0 改动：时间戳改用 Date（FR-13）
 */
const errors = require('../errors');
const { getFamily } = require('../lib/family');
const { isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, _, userId } = ctx;
  const { familyId, name, gender, birthDate, avatar } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isMember(userId, family)) return errors.PERMISSION_DENIED('不是家庭成员');

  const now = new Date();
  const nowTs = Date.now();
  const babyData = {
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
