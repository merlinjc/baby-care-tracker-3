/**
 * 家庭相关工具函数（v4.3.0 FR-7）
 */

/**
 * 获取家庭文档
 * @param {Object} db 云数据库实例
 * @param {string} familyId 家庭 ID
 * @returns {Promise<Object|null>} 家庭文档或 null
 */
async function getFamily(db, familyId) {
  try {
    const res = await db.collection('families').doc(familyId).get();
    return res.data;
  } catch (e) {
    const msg = e && e.errMsg || '';
    if (msg.includes('cannot find document') || msg.includes('does not exist')) return null;
    throw e;
  }
}

/**
 * 清除用户的家庭关联信息
 * @param {Object} db 云数据库实例
 * @param {Object} _ db.command
 * @param {string} userId users._id
 * @returns {Promise<void>}
 */
async function clearUserFamily(db, _, userId) {
  await db.collection('users').doc(userId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: new Date(),
      updatedAtTs: Date.now()
    }
  });
}

module.exports = {
  getFamily,
  clearUserFamily
};
