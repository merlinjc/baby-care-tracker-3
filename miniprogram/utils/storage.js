/**
 * 本地存储工具
 * 实现离线优先的数据缓存
 */

const STORAGE_KEYS = {
  USER_INFO: 'user_info',
  CURRENT_BABY: 'current_baby',
  FAMILY_INFO: 'family_info',
  OFFLINE_QUEUE: 'offline_queue',
  LAST_SYNC_TIME: 'last_sync_time'
};

class StorageUtil {
  /**
   * 保存数据到本地
   * @param {string} key 键名
   * @param {any} data 数据
   */
  static set(key, data) {
    try {
      wx.setStorageSync(key, data);
      return true;
    } catch (error) {
      console.error('本地存储失败:', error);
      return false;
    }
  }

  /**
   * 从本地读取数据
   * @param {string} key 键名
   * @returns {any} 数据
   */
  static get(key) {
    try {
      return wx.getStorageSync(key);
    } catch (error) {
      console.error('本地读取失败:', error);
      return null;
    }
  }

  /**
   * 删除本地数据
   * @param {string} key 键名
   */
  static remove(key) {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (error) {
      console.error('本地删除失败:', error);
      return false;
    }
  }

  /**
   * 清空所有本地数据
   */
  static clear() {
    try {
      wx.clearStorageSync();
      return true;
    } catch (error) {
      console.error('清空本地数据失败:', error);
      return false;
    }
  }

  /**
   * 保存用户信息
   * @param {Object} userInfo 用户信息
   */
  static saveUserInfo(userInfo) {
    return this.set(STORAGE_KEYS.USER_INFO, userInfo);
  }

  /**
   * 获取用户信息
   * @returns {Object|null} 用户信息
   */
  static getUserInfo() {
    return this.get(STORAGE_KEYS.USER_INFO);
  }

  /**
   * 保存当前宝宝信息
   * @param {Object} babyInfo 宝宝信息
   */
  static saveCurrentBaby(babyInfo) {
    return this.set(STORAGE_KEYS.CURRENT_BABY, babyInfo);
  }

  /**
   * 获取当前宝宝信息
   * @returns {Object|null} 宝宝信息
   */
  static getCurrentBaby() {
    return this.get(STORAGE_KEYS.CURRENT_BABY);
  }

  /**
   * 保存家庭信息
   * @param {Object} familyInfo 家庭信息
   */
  static saveFamilyInfo(familyInfo) {
    return this.set(STORAGE_KEYS.FAMILY_INFO, familyInfo);
  }

  /**
   * 获取家庭信息
   * @returns {Object|null} 家庭信息
   */
  static getFamilyInfo() {
    return this.get(STORAGE_KEYS.FAMILY_INFO);
  }

  /**
   * 添加离线操作到队列
   * @param {Object} operation 操作对象
   */
  static addToOfflineQueue(operation) {
    const queue = this.get(STORAGE_KEYS.OFFLINE_QUEUE) || [];
    queue.push({
      ...operation,
      timestamp: Date.now()
    });
    return this.set(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }

  /**
   * 获取离线队列
   * @returns {Array} 离线操作队列
   */
  static getOfflineQueue() {
    return this.get(STORAGE_KEYS.OFFLINE_QUEUE) || [];
  }

  /**
   * 清空离线队列
   */
  static clearOfflineQueue() {
    return this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  /**
   * 保存最后同步时间
   * @param {number} timestamp 时间戳
   */
  static saveLastSyncTime(timestamp = Date.now()) {
    return this.set(STORAGE_KEYS.LAST_SYNC_TIME, timestamp);
  }

  /**
   * 获取最后同步时间
   * @returns {number|null} 时间戳
   */
  static getLastSyncTime() {
    return this.get(STORAGE_KEYS.LAST_SYNC_TIME);
  }

  /**
   * 保存数据（set 方法的别名，兼容 settings.js 等调用）
   * @param {string} key 键名
   * @param {any} data 数据
   */
  static save(key, data) {
    return this.set(key, data);
  }
}

module.exports = StorageUtil;
