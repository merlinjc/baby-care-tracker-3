/**
 * 宝宝管理服务
 * 实现宝宝档案管理功能
 */

const { createBaby } = require('../models/index');

// 单例模式
let instance = null;

class BabyService {
  constructor() {
    if (instance) return instance;
    
    this.db = wx.cloud.database();
    this.babyCollection = this.db.collection('babies');
    this.familyCollection = this.db.collection('families');
    
    instance = this;
  }
  
  static getInstance() {
    if (!instance) {
      instance = new BabyService();
    }
    return instance;
  }

  /**
   * 创建宝宝档案
   * @param {string} familyId 家庭 ID
   * @param {string} name 姓名
   * @param {'male'|'female'} gender 性别
   * @param {Date} birthDate 出生日期
   * @param {string} [avatar] 头像 URL
   * @returns {Promise<Object>} 宝宝信息
   */
  async createBaby(familyId, name, gender, birthDate, avatar = '') {
    try {
      const baby = createBaby(familyId, name, gender, birthDate);
      baby.avatar = avatar;

      const res = await this.babyCollection.add({
        data: baby
      });

      // 更新家庭的宝宝列表
      await this.familyCollection.doc(familyId).update({
        data: {
          babies: this.db.command.push(res._id),
          updatedAt: this.db.serverDate()
        }
      });

      return {
        _id: res._id,
        ...baby
      };
    } catch (error) {
      console.error('创建宝宝档案失败:', error);
      throw error;
    }
  }

  /**
   * 获取家庭的宝宝列表
   * @param {string} familyId 家庭 ID
   * @returns {Promise<Array>} 宝宝列表
   */
  async getBabiesByFamilyId(familyId) {
    try {
      // 方式1: 通过 where 查询
      const res = await this.babyCollection
        .where({
          familyId
        })
        .orderBy('createdAt', 'asc')
        .get();

      if (res.data.length > 0) {
        return res.data;
      }

      // 方式2: 通过家庭 babies 数组批量查询（使用 db.command.in 替代 N+1 查询）
      try {
        const familyRes = await this.familyCollection.doc(familyId).get();
        const family = familyRes.data;
        
        if (family && family.babies && family.babies.length > 0) {
          const batchRes = await this.babyCollection
            .where({ _id: this.db.command.in(family.babies) })
            .orderBy('createdAt', 'asc')
            .get();
          return batchRes.data;
        }
      } catch (familyErr) {
        // families 集合也受安全规则限制，doc().get() 可能报权限错误
        console.warn('[BabyService] 通过 families 获取 babies 数组失败 (安全规则限制):', familyErr.errMsg || familyErr.message);
      }

      // 两种方式都未获取到，返回空数组
      return [];
    } catch (error) {
      console.error('获取宝宝列表失败:', error);
      // 查询失败也返回空数组，避免阻断整个初始化流程
      return [];
    }
  }

  /**
   * 获取宝宝详情
   * @param {string} babyId 宝宝 ID
   * @returns {Promise<Object>} 宝宝信息
   */
  async getBabyById(babyId) {
    try {
      const res = await this.babyCollection.doc(babyId).get();
      return res.data;
    } catch (error) {
      console.error('获取宝宝详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新宝宝信息
   * @param {string} babyId 宝宝 ID
   * @param {Object} data 更新数据
   */
  async updateBaby(babyId, data) {
    try {
      await this.babyCollection.doc(babyId).update({
        data: {
          ...data,
          updatedAt: this.db.serverDate()
        }
      });
    } catch (error) {
      console.error('更新宝宝信息失败:', error);
      throw error;
    }
  }

  /**
   * 上传宝宝头像
   * @param {string} babyId 宝宝 ID
   * @param {string} filePath 本地文件路径
   * @returns {Promise<string>} 云存储文件 ID
   */
  async uploadAvatar(babyId, filePath) {
    try {
      const res = await wx.cloud.uploadFile({
        cloudPath: `babies/${babyId}_${Date.now()}.jpg`,
        filePath
      });

      // 更新宝宝头像
      await this.updateBaby(babyId, { avatar: res.fileID });

      return res.fileID;
    } catch (error) {
      console.error('上传宝宝头像失败:', error);
      throw error;
    }
  }

  /**
   * 计算宝宝月龄
   * @param {Date} birthDate 出生日期
   * @returns {number} 月龄
   */
  calculateAgeInMonths(birthDate) {
    const now = new Date();
    const birth = new Date(birthDate);
    
    let months = (now.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += now.getMonth();
    
    // 如果当前日期小于出生日期，月龄减 1
    if (now.getDate() < birth.getDate()) {
      months--;
    }
    
    return Math.max(0, months);
  }

  /**
   * 计算宝宝天数
   * @param {Date} birthDate 出生日期
   * @returns {number} 天数
   */
  calculateAgeInDays(birthDate) {
    const now = new Date();
    const birth = new Date(birthDate);
    const diffTime = Math.abs(now - birth);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * 格式化年龄显示
   * @param {Date} birthDate 出生日期
   * @returns {string} 格式化的年龄
   */
  formatAge(birthDate) {
    const months = this.calculateAgeInMonths(birthDate);
    
    if (months < 1) {
      const days = this.calculateAgeInDays(birthDate);
      return `${days}天`;
    } else if (months < 12) {
      return `${months}个月`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0 ? `${years}岁${remainingMonths}个月` : `${years}岁`;
    }
  }

  /**
   * 删除宝宝档案
   * @param {string} babyId 宝宝 ID
   * @param {string} familyId 家庭 ID
   */
  async deleteBaby(babyId, familyId) {
    try {
      // 使用原子操作 pull 从家庭的宝宝列表中移除，避免并发竞态
      await this.familyCollection.doc(familyId).update({
        data: {
          babies: this.db.command.pull(babyId),
          updatedAt: this.db.serverDate()
        }
      });

      // 删除宝宝档案
      await this.babyCollection.doc(babyId).remove();
    } catch (error) {
      console.error('删除宝宝档案失败:', error);
      throw error;
    }
  }
}

module.exports = BabyService;
