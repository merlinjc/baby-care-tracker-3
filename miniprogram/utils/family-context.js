/**
 * FamilyContext — 当前登录上下文统一读取工具
 *
 * 设计目标（v4.3.0 FR-1）：
 * - 统一全项目 14 处 `familyId` 获取点，消除"familyInfo._id / userInfo.familyId / baby.familyId"三源漂移
 * - 统一 userId / role / currentBaby 等上下文字段读取
 * - 纯读取、无状态；纯静态方法类（对标 PermissionUtil），无需 getInstance
 *
 * 读取优先级（高 → 低）：
 * 1. getApp().globalData   （最新内存）
 * 2. StorageUtil 本地缓存  （持久化）
 * 3. 传入的 baby 对象字段  （仅 resolveForBaby；老接口兼容）
 *
 * 失败返回值约定：
 * - 所有字符串字段（familyId/userId/role/babyId）取不到时返回空字符串 ''（不抛错）
 * - 对象字段（family / memberDetail）取不到时返回 null
 */
const StorageUtil = require('./storage');

class FamilyContext {
  /**
   * 获取当前家庭 ID
   * @returns {string} familyId；不可得时返回 ''
   */
  static resolve() {
    const app = typeof getApp === 'function' ? getApp() : null;
    // 1. globalData 最新
    if (app && app.globalData && app.globalData.familyInfo && app.globalData.familyInfo._id) {
      return app.globalData.familyInfo._id;
    }
    // 2. StorageUtil 缓存
    const cachedFamily = StorageUtil.getFamilyInfo();
    if (cachedFamily && cachedFamily._id) {
      return cachedFamily._id;
    }
    // 3. userInfo.familyId 兜底
    const userInfo = StorageUtil.getUserInfo();
    return (userInfo && userInfo.familyId) || '';
  }

  /**
   * 针对特定宝宝解析 familyId
   * 优先使用 baby.familyId（跨家庭场景下宝宝自己的 familyId 更准确），否则回退 resolve()
   * @param {Object} baby 宝宝对象
   * @returns {string} familyId；不可得时返回 ''
   */
  static resolveForBaby(baby) {
    if (baby && baby.familyId) return baby.familyId;
    return this.resolve();
  }

  /**
   * 获取当前用户 ID（users._id）
   * @returns {string} userId；不可得时返回 ''
   */
  static getUserId() {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo._id) {
      return app.globalData.userInfo._id;
    }
    const userInfo = StorageUtil.getUserInfo();
    return (userInfo && userInfo._id) || '';
  }

  /**
   * 获取当前用户在家庭中的角色
   * @returns {'admin'|'editor'|'viewer'|''} 角色；不可得时返回 ''
   */
  static getCurrentRole() {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.familyRole) {
      return app.globalData.familyRole;
    }
    const userInfo = StorageUtil.getUserInfo();
    return (userInfo && userInfo.familyRole) || '';
  }

  /**
   * 获取当前选中的宝宝 ID
   * @returns {string} babyId；不可得时返回 ''
   */
  static getCurrentBabyId() {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.currentBaby && app.globalData.currentBaby._id) {
      return app.globalData.currentBaby._id;
    }
    const baby = StorageUtil.getCurrentBaby();
    return (baby && baby._id) || '';
  }

  /**
   * 获取完整家庭对象
   * @returns {Object|null} family；不可得时返回 null
   */
  static getFamily() {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.familyInfo) {
      return app.globalData.familyInfo;
    }
    return StorageUtil.getFamilyInfo() || null;
  }

  /**
   * 获取当前用户的 memberDetail 条目（来自 families.memberDetails）
   * @returns {Object|null} memberDetail；不可得时返回 null
   */
  static getCurrentMemberDetail() {
    const userId = this.getUserId();
    const family = this.getFamily();
    if (!userId || !family || !Array.isArray(family.memberDetails)) return null;
    return family.memberDetails.find(m => m.userId === userId) || null;
  }

  /**
   * 获取完整用户信息
   * @returns {Object|null}
   */
  static getUserInfo() {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.userInfo) {
      return app.globalData.userInfo;
    }
    return StorageUtil.getUserInfo() || null;
  }
}

module.exports = FamilyContext;
