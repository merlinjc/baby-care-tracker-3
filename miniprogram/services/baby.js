/**
 * 宝宝管理服务
 * 实现宝宝档案管理功能
 * 
 * [v4.2] 适配器模式改造：
 * createBaby / deleteBaby 改为 callFunction 调用 familyOperation 云函数
 * 保留不改：getBabiesByFamilyId / getBabyById / updateBaby / uploadAvatar
 */

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
      const res = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: {
          action: 'createBaby',
          params: { familyId, name, gender, birthDate: birthDate.toISOString(), avatar }
        }
      });
      const result = res.result;
      if (!result.success) throw new Error(result.error?.message || '创建宝宝失败');
      return result.data;
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
   *
   * [v4.3.1 Hotfix] 改走云函数 admin SDK，不再客户端直连：
   * - 根因：babies.read 安全规则要求 auth.openid 在 families[doc.familyId].memberOpenids 中
   *   当真实 memberOpenids 未同步（v4.2 迁移漏洞 / removeMember 旧 bug / patrol 未跑）时，
   *   客户端 doc().get() 和 where({_id}).get() 都会被拒绝（-502003）
   * - 云函数内用 admin SDK 读取，业务层校验 baby.familyId === user.familyId 且用户是 family 成员
   *
   * @param {string} babyId 宝宝 ID
   * @returns {Promise<Object|null>} 宝宝信息（不存在或无权限时返回 null）
   */
  async getBabyById(babyId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: {
          action: 'getBabyById',
          params: { babyId }
        }
      });
      const result = res.result;
      if (!result.success) {
        // 权限错误（PERMISSION_DENIED）→ 返回 null，让调用方处理
        if (result.error && result.error.code === 'PERMISSION_DENIED') {
          console.warn('[BabyService] getBabyById 权限拒绝:', result.error.message);
          return null;
        }
        throw new Error(result.error?.message || '获取宝宝详情失败');
      }
      return result.data?.baby || null;
    } catch (error) {
      console.error('获取宝宝详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新宝宝信息
   *
   * [v4.3.1 Hotfix3] 改走云函数 `familyOperation/updateBaby`：
   * - 原客户端直连受 `doc._openid == auth.openid` 限制，非创建者 + 存量宝宝均失败
   * - 云函数 admin SDK 绕过规则，业务层校验：
   *   * 必须是家庭成员
   *   * 必须 admin 或 editor（viewer 不能改）
   *   * baby.familyId === user.familyId
   * - 允许字段白名单：name / gender / birthDate / avatar
   *
   * @param {string} babyId 宝宝 ID
   * @param {Object} data 更新数据（name / gender / birthDate / avatar）
   */
  async updateBaby(babyId, data) {
    try {
      // birthDate 如为 Date 对象，序列化为 ISO 字符串（云函数会归一为 Date）
      const payload = { ...data };
      if (payload.birthDate instanceof Date) {
        payload.birthDate = payload.birthDate.toISOString();
      }

      const res = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: {
          action: 'updateBaby',
          params: { babyId, data: payload }
        }
      });
      const result = res.result;
      if (!result.success) {
        const err = new Error(result.error?.message || '更新宝宝信息失败');
        err.code = result.error?.code || 'UNKNOWN';
        throw err;
      }
      return result.data;
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
    // [v4.3.2 FR-3] 支持 status='in_progress' 续传循环；透传 autoDissolved
    const MAX_CHUNKS = 20;
    let cursor = null;
    let lastData = null;

    for (let i = 0; i < MAX_CHUNKS; i++) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'familyOperation',
          data: {
            action: 'deleteBaby',
            params: { babyId, familyId, cursor }
          }
        });
        const result = res.result;
        if (!result || !result.success) {
          const err = new Error((result && result.error && result.error.message) || '删除宝宝失败');
          if (result && result.error && result.error.code) err.code = result.error.code;
          throw err;
        }
        lastData = result.data;
        if (lastData.status === 'in_progress' && lastData.cursor) {
          cursor = lastData.cursor;
          continue;
        }
        // 完成：返回含 autoDissolved 的完整结果
        return lastData;
      } catch (error) {
        console.error('删除宝宝档案失败:', error);
        throw error;
      }
    }
    // 超出分片上限仍未完成：保留已清理数据，提示用户下次继续
    console.warn('[babyService.deleteBaby] 超出 MAX_CHUNKS 仍未完成，返回中间结果');
    return lastData || { status: 'in_progress' };
  }
}

module.exports = BabyService;
