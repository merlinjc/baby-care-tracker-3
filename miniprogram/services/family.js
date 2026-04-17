/**
 * 家庭组服务
 * 实现家庭组管理功能
 * 
 * [v4.2] 适配器模式改造：
 * 以下 10 个方法内部替换为 callFunction 调用 familyOperation 云函数：
 * createFamily / joinByInviteCode / removeMember / dissolveFamily /
 * updateMemberRole / transferAdmin / leaveFamily / refreshInviteCode /
 * validateInviteCode / getFamilyByUserId
 * 
 * 保留不改（客户端直连，安全规则允许成员读取）：
 * getFamilyDetail / getFamilyMembers / checkMembership
 */

const PermissionUtil = require('../utils/permission');

let instance = null;

class FamilyService {
  constructor() {
    if (instance) return instance;
    this.db = wx.cloud.database();
    this.familyCollection = this.db.collection('families');
    this.userCollection = this.db.collection('users');
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new FamilyService();
    return instance;
  }

  /**
   * [v4.2] 调用 familyOperation 云函数的统一方法
   * @private
   * @param {string} action 操作名称
   * @param {Object} params 参数
   * @returns {Promise<Object>} 云函数返回的 data
   */
  async _callFamilyOperation(action, params = {}) {
    const res = await wx.cloud.callFunction({
      name: 'familyOperation',
      data: { action, params }
    });
    const result = res.result;
    if (!result.success) {
      throw new Error(result.error?.message || `${action} 失败`);
    }
    return result.data;
  }

  /**
   * 创建家庭组
   * @param {Object} options 创建选项
   * @param {string} options.name 家庭名称
   * @param {string} options.creatorId 创建者 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @param {string} options.creatorName 创建者名称（v4.2: 云函数内自动获取，此参数忽略）
   * @returns {Promise<Object>} 家庭信息
   */
  async createFamily(options) {
    try {
      return await this._callFamilyOperation('createFamily', { name: options.name });
    } catch (error) {
      console.error('创建家庭组失败:', error);
      throw error;
    }
  }

  /**
   * 通过邀请码加入家庭
   * @param {string} inviteCode 邀请码
   * @param {Object} memberInfo 成员信息
   * @param {string} memberInfo.userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @param {string} memberInfo.userName 用户名称
   * @param {string} memberInfo.relation 与宝宝的关系
   * @returns {Promise<Object>} 加入结果
   */
  async joinByInviteCode(inviteCode, memberInfo) {
    const { userName, relation } = memberInfo;
    try {
      const data = await this._callFamilyOperation('joinFamily', {
        inviteCode, userName, relation
      });
      return {
        success: true,
        familyId: data.familyId,
        familyName: data.familyName
      };
    } catch (error) {
      console.error('加入家庭失败:', error);
      throw error;
    }
  }

  /**
   * 通过邀请码加入家庭（旧方法，保留兼容）
   * @param {string} inviteCode 邀请码
   * @param {string} userId 用户 ID
   * @returns {Promise<Object>} 家庭信息
   */
  async joinFamily(inviteCode, userId) {
    return this.joinByInviteCode(inviteCode, {
      userId: userId,
      userName: '',
      relation: ''
    });
  }

  /**
   * 获取用户的家庭信息
   * @param {string} userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @returns {Promise<Object|null>} 家庭信息
   */
  async getFamilyByUserId(userId) {
    try {
      return await this._callFamilyOperation('getFamilyByUserId');
    } catch (error) {
      console.error('获取家庭信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取家庭详情
   * @param {string} familyId 家庭 ID
   * @returns {Promise<Object|null>} 家庭详情，不存在时返回 null
   */
  async getFamilyDetail(familyId) {
    try {
      const familyRes = await this.familyCollection.doc(familyId).get();
      return familyRes.data;
    } catch (error) {
      // 文档不存在时返回 null，而不是抛出错误
      if (error.errMsg && error.errMsg.includes('cannot find document')) {
        console.warn('家庭文档不存在:', familyId);
        return null;
      }
      console.error('获取家庭详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取家庭成员列表
   * @param {string} familyId 家庭 ID
   * @returns {Promise<Array>} 成员列表
   */
  async getFamilyMembers(familyId) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (!family || !family.members || family.members.length === 0) {
        return [];
      }

      // 如果有 memberDetails，直接返回
      if (family.memberDetails && family.memberDetails.length > 0) {
        return family.memberDetails;
      }

      // 否则查询成员详情（兼容旧数据）
      const membersRes = await this.userCollection
        .where({
          _id: this.db.command.in(family.members)
        })
        .get();

      return membersRes.data;
    } catch (error) {
      console.error('获取家庭成员失败:', error);
      throw error;
    }
  }

  /**
   * 生成新的邀请码
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @returns {Promise<string>} 新邀请码
   */
  async refreshInviteCode(familyId, userId) {
    try {
      const data = await this._callFamilyOperation('refreshInviteCode', { familyId });
      return data.inviteCode;
    } catch (error) {
      console.error('生成邀请码失败:', error);
      throw error;
    }
  }

  /**
   * 移除家庭成员
   * @param {string} familyId 家庭 ID
   * @param {string} userId 操作用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @param {string} targetUserId 要移除的用户 ID
   */
  async removeMember(familyId, userId, targetUserId) {
    try {
      await this._callFamilyOperation('removeMember', { familyId, targetUserId });
    } catch (error) {
      console.error('移除家庭成员失败:', error);
      throw error;
    }
  }

  /**
   * 解散家庭
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   */
  async dissolveFamily(familyId, userId) {
    try {
      await this._callFamilyOperation('dissolveFamily', { familyId });
    } catch (error) {
      console.error('解散家庭失败:', error);
      throw error;
    }
  }

  /**
   * 更新成员权限
   * @param {string} familyId 家庭 ID
   * @param {string} userId 操作用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @param {string} targetUserId 目标用户 ID
   * @param {string} role 新角色
   */
  async updateMemberRole(familyId, userId, targetUserId, role) {
    try {
      await this._callFamilyOperation('updateMemberRole', { familyId, targetUserId, role });
    } catch (error) {
      console.error('更新成员权限失败:', error);
      throw error;
    }
  }

  /**
   * 用户主动退出家庭
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @returns {Promise<Object>} 退出结果
   */
  async leaveFamily(familyId, userId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: { action: 'leaveFamily', params: { familyId } }
      });
      const result = res.result;
      // leaveFamily 在 needTransfer 时 success=false 但 data 中包含信息
      if (!result.success && result.data?.needTransfer) {
        return {
          success: false,
          needTransfer: true,
          otherMembers: result.data.otherMembers || [],
          message: result.data.message
        };
      }
      if (!result.success) {
        throw new Error(result.error?.message || '退出家庭失败');
      }
      return {
        success: true,
        familyNotFound: result.data?.familyNotFound || false,
        notMember: result.data?.notMember || false,
        familyDissolved: result.data?.familyDissolved || false,
        message: result.data?.message || '已退出家庭'
      };
    } catch (error) {
      console.error('退出家庭失败:', error);
      throw error;
    }
  }

  /**
   * 转让管理员权限
   * @param {string} familyId 家庭 ID
   * @param {string} currentAdminId 当前管理员 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @param {string} newAdminId 新管理员 ID
   * @returns {Promise<Object>} 转让结果
   */
  async transferAdmin(familyId, currentAdminId, newAdminId) {
    try {
      await this._callFamilyOperation('transferAdmin', { familyId, newAdminId });
      return { success: true, message: '管理员权限已转让' };
    } catch (error) {
      console.error('转让管理员失败:', error);
      throw error;
    }
  }

  /**
   * 验证邀请码有效性
   * @param {string} inviteCode 邀请码
   * @returns {Promise<Object>} 验证结果（包含家庭基本信息）
   */
  async validateInviteCode(inviteCode) {
    try {
      return await this._callFamilyOperation('validateInviteCode', { inviteCode });
    } catch (error) {
      console.error('验证邀请码失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否仍是某家庭的有效成员
   * @param {string} userId 用户 ID
   * @param {string} familyId 家庭 ID
   * @returns {Promise<Object>} 检查结果
   */
  async checkMembership(userId, familyId) {
    try {
      const family = await this.getFamilyDetail(familyId);
      
      if (!family) {
        return { isMember: false, reason: 'family_not_found' };
      }

      if (!family.members || !family.members.includes(userId)) {
        return { isMember: false, reason: 'removed' };
      }

      return { 
        isMember: true, 
        role: PermissionUtil.getUserRole(userId, family) 
      };
    } catch (error) {
      console.error('检查成员身份失败:', error);
      return { isMember: false, reason: 'error' };
    }
  }

}

module.exports = FamilyService;
