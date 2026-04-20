/**
 * 认证与身份识别工具（v4.3.0 FR-7）
 */

/**
 * 通过 openid 查找当前用户（云函数入口统一调用）
 * @param {Object} db 云数据库实例
 * @param {string} openid cloud.getWXContext().OPENID
 * @returns {Promise<Object|null>} 用户文档或 null
 */
async function getUserFromOpenid(db, openid) {
  const res = await db.collection('users')
    .where({ _openid: openid })
    .limit(1)
    .get();
  return res.data.length > 0 ? res.data[0] : null;
}

/**
 * 判断用户是否为家庭管理员
 * - 优先匹配 memberDetails 中 role='admin'
 * - 兼容旧数据：creatorId 等于用户 _id
 * @param {string} userId users._id
 * @param {Object} family 家庭文档
 * @returns {boolean}
 */
function isAdmin(userId, family) {
  if (!userId || !family) return false;
  const member = family.memberDetails && family.memberDetails.find(m => m.userId === userId);
  if (member && member.role === 'admin') return true;
  if (family.creatorId === userId) return true;
  return false;
}

/**
 * 判断用户是否为家庭成员
 * @param {string} userId users._id
 * @param {Object} family 家庭文档
 * @returns {boolean}
 */
function isMember(userId, family) {
  return !!(userId && family && Array.isArray(family.members) && family.members.includes(userId));
}

module.exports = {
  getUserFromOpenid,
  isAdmin,
  isMember
};
