/**
 * 权限工具类
 * 实现 admin/editor/viewer 三级权限检查体系
 * 
 * 权限矩阵：
 * | 操作               | Admin | Editor | Viewer |
 * |-------------------|-------|--------|--------|
 * | 查看记录           | ✅    | ✅     | ✅     |
 * | 添加记录           | ✅    | ✅     | ❌     |
 * | 编辑记录           | ✅    | ✅     | ❌     |
 * | 删除自己的记录      | ✅    | ✅     | ❌     |
 * | 删除他人记录        | ✅    | ❌     | ❌     |
 * | 生成邀请码         | ✅    | ❌     | ❌     |
 * | 修改成员权限        | ✅    | ❌     | ❌     |
 * | 移除成员           | ✅    | ❌     | ❌     |
 * | 解散家庭           | ✅    | ❌     | ❌     |
 */

class PermissionUtil {
  /**
   * 权限映射表
   * key: 权限标识
   * value: 允许的角色数组
   */
  static PERMISSIONS = {
    'record.view': ['admin', 'editor', 'viewer'],
    'record.create': ['admin', 'editor'],
    'record.edit': ['admin', 'editor'],
    'record.delete.own': ['admin', 'editor'],
    'record.delete.other': ['admin'],
    'member.invite': ['admin'],
    'member.manage': ['admin'],
    'member.remove': ['admin'],
    'family.dissolve': ['admin'],
    'family.settings': ['admin']
  };

  /**
   * 角色显示文本映射
   */
  static ROLE_TEXT = {
    'admin': '管理员',
    'editor': '成员',
    'viewer': '仅查看'
  };

  /**
   * 角色列表（用于权限编辑弹窗）
   */
  static ROLE_OPTIONS = [
    { value: 'admin', text: '管理员', desc: '可管理成员和所有设置' },
    { value: 'editor', text: '成员', desc: '可添加和编辑记录' },
    { value: 'viewer', text: '仅查看', desc: '只能查看记录' }
  ];

  /**
   * 检查用户是否拥有指定权限
   * @param {string} userId - 当前用户 ID
   * @param {Object} family - 家庭信息对象（需包含 memberDetails）
   * @param {string} permission - 权限标识（如 'record.create'）
   * @returns {boolean} 是否拥有权限
   */
  static checkPermission(userId, family, permission) {
    if (!userId || !family) return false;

    const role = this.getUserRole(userId, family);
    const allowedRoles = this.PERMISSIONS[permission];

    if (!allowedRoles) {
      console.warn(`[PermissionUtil] 未知权限标识: ${permission}`);
      return false;
    }

    return allowedRoles.includes(role);
  }

  /**
   * 获取用户在家庭中的角色
   *
   * [v4.3.1 FR-6] 安全加固：默认角色从 editor 改为 viewer（最小权限原则）
   *
   * 查找逻辑：
   * 1. 从 memberDetails 中查找（主路径）
   * 2. 如果是 creatorId 且无 memberDetails，返回 admin（兼容旧数据）
   * 3. 默认返回 viewer（替代原 'editor'）—— 避免用户被踢出家庭后本地缓存
   *    过期窗口内仍能写记录产生脏数据；v4.2 迁移已补齐 memberDetails，
   *    此分支在正常态下不会触发
   *
   * @param {string} userId - 用户 ID
   * @param {Object} family - 家庭信息对象
   * @returns {'admin'|'editor'|'viewer'} 用户角色
   */
  static getUserRole(userId, family) {
    if (!userId || !family) return 'viewer';

    // 优先从 memberDetails 查找
    if (family.memberDetails && Array.isArray(family.memberDetails)) {
      const member = family.memberDetails.find(m => m.userId === userId);
      if (member && member.role) {
        return member.role;
      }
    }

    // fallback: 创建者默认 admin（兼容无 memberDetails 的旧数据）
    if (family.creatorId === userId) {
      return 'admin';
    }

    // [v4.3.1 FR-6] 默认 viewer（最小权限），替代原 'editor'
    // 能走到这里说明：memberDetails 中不含该用户 且 非 creatorId
    // 正常态下不会触发；触发即意味着用户已不是合法成员（被踢 / 脏缓存）
    return 'viewer';
  }

  /**
   * 判断用户是否为管理员
   * @param {string} userId - 用户 ID
   * @param {Object} family - 家庭信息对象
   * @returns {boolean} 是否为管理员
   */
  static isAdmin(userId, family) {
    return this.getUserRole(userId, family) === 'admin';
  }

  /**
   * 判断用户是否可以编辑（admin 或 editor）
   * @param {string} userId - 用户 ID
   * @param {Object} family - 家庭信息对象
   * @returns {boolean} 是否可编辑
   */
  static canEdit(userId, family) {
    const role = this.getUserRole(userId, family);
    return role === 'admin' || role === 'editor';
  }

  /**
   * 判断用户是否可以删除指定记录
   * - Admin: 可删除任何记录
   * - Editor: 只能删除自己创建的记录
   * - Viewer: 不能删除
   * 
   * @param {string} userId - 当前用户 ID
   * @param {Object} family - 家庭信息对象
   * @param {Object} record - 记录对象（需包含 createdBy 或 creatorId）
   * @returns {boolean} 是否可以删除
   */
  static canDeleteRecord(userId, family, record) {
    const role = this.getUserRole(userId, family);

    if (role === 'viewer') return false;
    if (role === 'admin') return true;

    // Editor: 只能删除自己创建的
    const recordCreatorId = record.createdBy?.userId || record.creatorId || '';
    return recordCreatorId === userId;
  }

  /**
   * 获取角色的显示文本
   * @param {string} role - 角色标识
   * @returns {string} 显示文本
   */
  static getRoleText(role) {
    return this.ROLE_TEXT[role] || '成员';
  }

  /**
   * 检查家庭中是否至少有一个 admin
   * 用于防止最后一个 admin 被降级
   * 
   * @param {Object} family - 家庭信息对象
   * @param {string} [excludeUserId] - 排除的用户 ID（用于检查移除/降级后是否还有 admin）
   * @returns {boolean} 是否至少有一个 admin
   */
  static hasOtherAdmin(family, excludeUserId) {
    if (!family.memberDetails || !Array.isArray(family.memberDetails)) {
      return false;
    }

    return family.memberDetails.some(
      m => m.role === 'admin' && m.userId !== excludeUserId
    );
  }
}

module.exports = PermissionUtil;
