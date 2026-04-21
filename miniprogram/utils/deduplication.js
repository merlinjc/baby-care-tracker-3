/**
 * 去重工具
 * 防止重复创建记录
 */

class DeduplicationUtil {
  constructor() {
    this.pendingOperations = new Map();
    this.DEDUP_KEY_PREFIX = 'dedup_';
  }

  /**
   * 生成去重键
   * @param {string} type 操作类型
   * @param {Object} data 操作数据
   * @returns {string} 去重键
   */
  generateKey(type, data) {
    const keyData = {
      type,
      ...data,
      timestamp: Math.floor(Date.now() / 1000) // 秒级时间戳
    };
    return this.DEDUP_KEY_PREFIX + JSON.stringify(keyData);
  }

  /**
   * 检查是否为重复操作
   * @param {string} dedupKey 去重键
   * @returns {boolean} 是否重复
   */
  isDuplicate(dedupKey) {
    const now = Date.now();
    const lastOperation = this.pendingOperations.get(dedupKey);

    if (!lastOperation) {
      return false;
    }

    // 5秒内的相同操作视为重复
    const DEDUP_WINDOW = 5000;
    return (now - lastOperation) < DEDUP_WINDOW;
  }

  /**
   * 检查并记录操作（简化版）
   * @param {string} dedupKey 去重键
   * @param {number} window 去重窗口（毫秒）
   * @returns {boolean} 是否允许操作
   */
  check(dedupKey, window = 3000) {
    const now = Date.now();
    const lastOperation = this.pendingOperations.get(dedupKey);

    // 如果在窗口期内，返回 false（拒绝）
    if (lastOperation && (now - lastOperation) < window) {
      return false;
    }

    // 记录本次操作
    this.pendingOperations.set(dedupKey, now);
    
    // 清理过期操作
    this.cleanupExpired();
    
    return true;
  }

  /**
   * 记录操作
   * @param {string} dedupKey 去重键
   */
  recordOperation(dedupKey) {
    this.pendingOperations.set(dedupKey, Date.now());
  }

  /**
   * 清理过期操作
   */
  cleanupExpired() {
    const now = Date.now();
    const EXPIRE_TIME = 30000; // 30秒过期

    this.pendingOperations.forEach((timestamp, key) => {
      if (now - timestamp > EXPIRE_TIME) {
        this.pendingOperations.delete(key);
      }
    });
  }

  /**
   * 检查并执行操作（带去重）
   * @param {string} type 操作类型
   * @param {Object} data 操作数据
   * @param {Function} operation 操作函数
   * @returns {Promise<any>} 操作结果
   */
  async executeWithDedup(type, data, operation) {
    // 生成去重键
    const dedupKey = this.generateKey(type, data);

    // 检查是否重复
    if (this.isDuplicate(dedupKey)) {
      console.warn('检测到重复操作，已忽略:', type);
      return null;
    }

    // 记录操作
    this.recordOperation(dedupKey);

    // 清理过期操作
    this.cleanupExpired();

    // 执行操作
    try {
      return await operation();
    } catch (error) {
      // 操作失败，移除记录
      this.pendingOperations.delete(dedupKey);
      throw error;
    }
  }

  /**
   * 为记录生成唯一 ID
   * @param {string} babyId 宝宝 ID
   * @param {string} recordType 记录类型
   * @param {number} startTime 开始时间
   * @returns {string} 唯一 ID
   */
  generateRecordId(babyId, recordType, startTime) {
    return `${babyId}_${recordType}_${startTime}`;
  }
}

// 单例模式（v4.3.0 FR-2：与其他 util 单例模式统一）
// 调用方：DeduplicationUtil.getInstance().check(...)
let instance = null;

DeduplicationUtil.getInstance = function () {
  if (!instance) instance = new DeduplicationUtil();
  return instance;
};

module.exports = DeduplicationUtil;
