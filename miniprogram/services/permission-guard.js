/**
 * PermissionGuard — 服务层前置权限预检
 *
 * 设计目标（v4.3.0 FR-3 / FR-14）：
 * - 在 RecordService 等写操作的**第一行**完成权限校验，不依赖 UI 按钮显隐 + 安全规则兜底的两层间接防护
 * - 失败时抛出 PermissionError（含 code='PERMISSION_DENIED'），调用方可通过 error.code 识别
 * - 内部委托给 PermissionUtil 提供的权限矩阵和角色判定，不重复定义规则
 *
 * 使用模式（推荐）：
 *   async createRecord(data) {
 *     PermissionGuard.require('record.create');  // 第一行
 *     // ... 业务逻辑
 *   }
 *
 * UI 显隐控制使用 check()（返回 boolean）：
 *   wx:if="{{canCreate}}"
 *   this.setData({ canCreate: PermissionGuard.check('record.create') });
 */

const PermissionUtil = require('../utils/permission');
const FamilyContext = require('../utils/family-context');

/**
 * 权限校验失败专用错误类
 */
class PermissionError extends Error {
  /**
   * @param {string} message 用户可读的错误信息
   * @param {string} permission 权限标识
   */
  constructor(message, permission) {
    super(message);
    this.name = 'PermissionError';
    this.code = 'PERMISSION_DENIED';
    this.permission = permission;
  }
}

class PermissionGuard {
  /**
   * 要求拥有指定权限，失败抛 PermissionError
   * @param {string} permission 权限标识，如 'record.create' / 'record.edit' / 'record.delete.other'
   * @throws {PermissionError}
   */
  static require(permission) {
    const userId = FamilyContext.getUserId();
    const family = FamilyContext.getFamily();

    if (!userId) {
      throw new PermissionError('用户信息缺失，请重新登录', permission);
    }
    if (!family) {
      throw new PermissionError('家庭信息缺失，请加入或创建家庭', permission);
    }
    if (!PermissionUtil.checkPermission(userId, family, permission)) {
      throw new PermissionError('您没有执行该操作的权限', permission);
    }
  }

  /**
   * 要求能够删除指定记录（考虑 admin 可删他人、editor 仅能删自己）
   * @param {Object} record 记录对象（需含 createdBy 或 creatorId）
   * @throws {PermissionError}
   */
  static requireCanDelete(record) {
    const userId = FamilyContext.getUserId();
    const family = FamilyContext.getFamily();

    if (!userId || !family) {
      throw new PermissionError('用户或家庭信息缺失', 'record.delete');
    }
    if (!PermissionUtil.canDeleteRecord(userId, family, record)) {
      throw new PermissionError('您没有权限删除该记录', 'record.delete');
    }
  }

  /**
   * 非抛错版本（返回 boolean），用于 UI 显隐控制
   * @param {string} permission 权限标识
   * @returns {boolean}
   */
  static check(permission) {
    try {
      this.require(permission);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 非抛错版本的删除权限判断
   * @param {Object} record 记录对象
   * @returns {boolean}
   */
  static checkCanDelete(record) {
    try {
      this.requireCanDelete(record);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = { PermissionGuard, PermissionError };
