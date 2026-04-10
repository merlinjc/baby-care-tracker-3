/**
 * 配额管理服务
 * 管理用户AI助手的使用配额
 */

const StorageUtil = require('../utils/storage');

let instance = null;

class QuotaService {
  constructor() {
    if (instance) return instance;
    this.DAILY_LIMIT = 100; // 每日限制100条
    this.STORAGE_KEY = 'ai_quota';
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new QuotaService();
    return instance;
  }

  /**
   * 获取今日配额信息
   * @returns {Object} { used: number, remaining: number, date: string }
   */
  getQuotaInfo() {
    try {
      const today = this.getTodayString();
      const quotaData = StorageUtil.get(this.STORAGE_KEY);
      
      // 如果是新的一天，重置配额
      if (!quotaData || quotaData.date !== today) {
        const newData = {
          date: today,
          used: 0
        };
        StorageUtil.set(this.STORAGE_KEY, newData);
        return {
          used: 0,
          remaining: this.DAILY_LIMIT,
          date: today
        };
      }
      
      return {
        used: quotaData.used,
        remaining: Math.max(0, this.DAILY_LIMIT - quotaData.used),
        date: quotaData.date
      };
    } catch (error) {
      console.error('获取配额信息失败:', error);
      return {
        used: 0,
        remaining: this.DAILY_LIMIT,
        date: this.getTodayString()
      };
    }
  }

  /**
   * 检查是否还有配额
   * @returns {boolean}
   */
  hasQuota() {
    const quotaInfo = this.getQuotaInfo();
    return quotaInfo.remaining > 0;
  }

  /**
   * 使用一次配额
   * @returns {boolean} 是否成功使用
   */
  useQuota() {
    try {
      const today = this.getTodayString();
      const quotaData = StorageUtil.get(this.STORAGE_KEY) || { date: today, used: 0 };
      
      // 如果是新的一天，重置
      if (quotaData.date !== today) {
        quotaData.date = today;
        quotaData.used = 0;
      }
      
      // 检查是否超过限制
      if (quotaData.used >= this.DAILY_LIMIT) {
        return false;
      }
      
      // 增加使用次数
      quotaData.used += 1;
      StorageUtil.set(this.STORAGE_KEY, quotaData);
      
      return true;
    } catch (error) {
      console.error('使用配额失败:', error);
      return false;
    }
  }

  /**
   * 获取今日日期字符串
   * @returns {string} YYYY-MM-DD
   */
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = QuotaService;
