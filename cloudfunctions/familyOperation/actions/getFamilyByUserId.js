/**
 * action: getFamilyByUserId (FR-12)
 */
const errors = require('../errors');

module.exports = async (ctx) => {
  const { db, userId } = ctx;
  const res = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();
  return errors.ok(res.data.length > 0 ? res.data[0] : null);
};
