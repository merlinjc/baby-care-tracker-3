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
  // 防御：openid 为空（如通过 MCP/后台直接调用云函数）→ 直接返回 null
  if (!openid) return null;
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

/**
 * 获取用户在家庭中的角色（v4.3.1 Hotfix3）
 * 与 miniprogram/utils/permission.js:getUserRole 保持一致
 * - 优先从 memberDetails 读取
 * - fallback: creatorId → 'admin'
 * - 默认 'viewer'（最小权限原则，v4.3.1 FR-6）
 * @param {string} userId users._id
 * @param {Object} family 家庭文档
 * @returns {'admin'|'editor'|'viewer'}
 */
function getUserRole(userId, family) {
  if (!userId || !family) return 'viewer';
  if (Array.isArray(family.memberDetails)) {
    const m = family.memberDetails.find(x => x.userId === userId);
    if (m && m.role) return m.role;
  }
  if (family.creatorId === userId) return 'admin';
  return 'viewer';
}

module.exports = {
  getUserFromOpenid,
  isAdmin,
  isMember,
  getUserRole
};
