/**
 * 家庭组服务
 * 实现家庭组管理功能
 */

const { generateInviteCode } = require('../models/index');
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
   * 创建家庭组
   * @param {Object} options 创建选项
   * @param {string} options.name 家庭名称
   * @param {string} options.creatorId 创建者 ID
   * @param {string} options.creatorName 创建者名称
   * @returns {Promise<Object>} 家庭信息
   */
  async createFamily(options) {
    const { name, creatorId, creatorName } = options;
    
    try {
      const inviteCode = generateInviteCode();
      const now = new Date();
      const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

      const family = {
        name: name,
        creatorId: creatorId,
        creatorName: creatorName,
        members: [creatorId],
        memberDetails: [{
          userId: creatorId,
          name: creatorName,
          role: 'admin',
          joinedAt: now.toISOString()
        }],
        inviteCode: inviteCode,
        inviteCodeExpiry: inviteExpiry.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      const res = await this.familyCollection.add({
        data: family
      });

      return {
        _id: res._id,
        ...family
      };
    } catch (error) {
      console.error('创建家庭组失败:', error);
      throw error;
    }
  }

  /**
   * 通过邀请码加入家庭
   * @param {string} inviteCode 邀请码
   * @param {Object} memberInfo 成员信息
   * @param {string} memberInfo.userId 用户 ID
   * @param {string} memberInfo.userName 用户名称
   * @param {string} memberInfo.relation 与宝宝的关系
   * @returns {Promise<Object>} 加入结果
   */
  async joinByInviteCode(inviteCode, memberInfo) {
    const { userId, userName, relation } = memberInfo;
    
    try {
      // 查询家庭
      const familyRes = await this.familyCollection
        .where({
          inviteCode: inviteCode.toUpperCase()
        })
        .get();

      if (familyRes.data.length === 0) {
        throw new Error('邀请码无效');
      }

      const family = familyRes.data[0];

      // 检查邀请码是否过期
      if (family.inviteCodeExpiry) {
        const expiryDate = new Date(family.inviteCodeExpiry);
        if (expiryDate < new Date()) {
          throw new Error('邀请码已过期');
        }
      }

      // 检查是否已经是成员
      if (family.members && family.members.includes(userId)) {
        throw new Error('已经是家庭成员');
      }

      const now = new Date().toISOString();

      // 添加成员
      const newMemberDetail = {
        userId: userId,
        name: userName,
        relation: relation || '家人',
        role: 'editor',
        joinedAt: now
      };

      await this.familyCollection.doc(family._id).update({
        data: {
          members: this.db.command.push(userId),
          memberDetails: this.db.command.push(newMemberDetail),
          updatedAt: now
        }
      });

      return {
        success: true,
        familyId: family._id,
        familyName: family.name
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
   * @param {string} userId 用户 ID
   * @returns {Promise<Object|null>} 家庭信息
   */
  async getFamilyByUserId(userId) {
    try {
      const res = await this.familyCollection
        .where({
          members: userId
        })
        .get();

      return res.data.length > 0 ? res.data[0] : null;
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
   * @param {string} userId 用户 ID
   * @returns {Promise<string>} 新邀请码
   */
  async refreshInviteCode(familyId, userId) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (!PermissionUtil.isAdmin(userId, family)) {
        throw new Error('只有管理员才能生成邀请码');
      }

      const inviteCode = generateInviteCode();
      const now = new Date();
      const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await this.familyCollection.doc(familyId).update({
        data: {
          inviteCode: inviteCode,
          inviteCodeExpiry: inviteExpiry.toISOString(),
          updatedAt: now.toISOString()
        }
      });

      return inviteCode;
    } catch (error) {
      console.error('生成邀请码失败:', error);
      throw error;
    }
  }

  /**
   * 移除家庭成员
   * @param {string} familyId 家庭 ID
   * @param {string} userId 操作用户 ID
   * @param {string} targetUserId 要移除的用户 ID
   */
  async removeMember(familyId, userId, targetUserId) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (!PermissionUtil.isAdmin(userId, family)) {
        throw new Error('只有管理员才能移除成员');
      }

      // 不能移除自己（应使用 leaveFamily）
      if (userId === targetUserId) {
        throw new Error('不能移除自己，请使用退出家庭功能');
      }

      // 不能移除其他管理员（需先降级）
      if (PermissionUtil.isAdmin(targetUserId, family)) {
        throw new Error('不能移除管理员，请先修改其权限');
      }

      // 使用原子操作 pull 移除成员，避免并发读写竞态
      await this.familyCollection.doc(familyId).update({
        data: {
          members: this.db.command.pull(targetUserId),
          memberDetails: this.db.command.pull({
            userId: targetUserId
          }),
          updatedAt: new Date().toISOString()
        }
      });

      // 清除被移除用户的家庭关联
      try {
        await this.userCollection.where({
          _openid: targetUserId
        }).update({
          data: {
            familyId: this.db.command.remove(),
            familyRole: this.db.command.remove(),
            updatedAt: new Date().toISOString()
          }
        });
      } catch (userErr) {
        console.warn('清除被移除用户家庭信息失败（非致命）:', userErr);
      }
    } catch (error) {
      console.error('移除家庭成员失败:', error);
      throw error;
    }
  }

  /**
   * 解散家庭
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID
   */
  async dissolveFamily(familyId, userId) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (family.creatorId !== userId) {
        throw new Error('只有创建者才能解散家庭');
      }

      await this.familyCollection.doc(familyId).remove();
    } catch (error) {
      console.error('解散家庭失败:', error);
      throw error;
    }
  }

  /**
   * 更新成员权限
   * @param {string} familyId 家庭 ID
   * @param {string} userId 操作用户 ID
   * @param {string} targetUserId 目标用户 ID
   * @param {string} role 新角色
   */
  async updateMemberRole(familyId, userId, targetUserId, role) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (family.creatorId !== userId) {
        throw new Error('只有创建者才能修改成员权限');
      }

      if (!family.memberDetails) {
        throw new Error('家庭成员数据不存在');
      }

      const memberDetails = family.memberDetails.map(m => {
        if (m.userId === targetUserId) {
          return { ...m, role: role };
        }
        return m;
      });

      await this.familyCollection.doc(familyId).update({
        data: {
          memberDetails: memberDetails,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('更新成员权限失败:', error);
      throw error;
    }
  }

  /**
   * 用户主动退出家庭
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID
   * @returns {Promise<Object>} 退出结果
   */
  async leaveFamily(familyId, userId) {
    try {
      const family = await this.getFamilyDetail(familyId);
      
      // 家庭不存在，直接返回成功（本地数据已失效）
      if (!family) {
        return { 
          success: true, 
          familyNotFound: true,
          message: '家庭已不存在，本地数据已清理'
        };
      }

      // 检查用户是否是家庭成员
      if (!family.members || !family.members.includes(userId)) {
        return { 
          success: true, 
          notMember: true,
          message: '您不是该家庭成员'
        };
      }

      // 检查是否是管理员
      const isAdmin = PermissionUtil.isAdmin(userId, family);
      
      if (isAdmin) {
        // 检查是否还有其他成员
        const otherMembers = family.members.filter(id => id !== userId);
        
        if (otherMembers.length > 0) {
          // 还有其他成员，检查是否有其他管理员
          if (PermissionUtil.hasOtherAdmin(family, userId)) {
            // 有其他管理员，可以安全退出
            await this._removeSelfFromFamily(familyId, userId);
            return { 
              success: true, 
              isAdmin: true,
              message: '已退出家庭'
            };
          } else {
            // 是唯一管理员且有其他成员，需要先转让
            return {
              success: false,
              needTransfer: true,
              otherMembers: family.memberDetails?.filter(m => m.userId !== userId) || [],
              message: '您是唯一管理员，退出前请先转让管理员权限或解散家庭'
            };
          }
        } else {
          // 没有其他成员，解散家庭
          await this.familyCollection.doc(familyId).remove();
          // 清除自己的家庭关联
          await this._clearUserFamilyInfo(userId);
          return { 
            success: true, 
            isCreator: true,
            familyDissolved: true,
            message: '家庭已解散'
          };
        }
      } else {
        // 不是管理员，直接退出
        await this._removeSelfFromFamily(familyId, userId);
        return { 
          success: true, 
          isCreator: false,
          message: '已退出家庭'
        };
      }
    } catch (error) {
      console.error('退出家庭失败:', error);
      throw error;
    }
  }

  /**
   * 转让管理员权限
   * @param {string} familyId 家庭 ID
   * @param {string} currentAdminId 当前管理员 ID
   * @param {string} newAdminId 新管理员 ID
   * @returns {Promise<Object>} 转让结果
   */
  async transferAdmin(familyId, currentAdminId, newAdminId) {
    try {
      const family = await this.getFamilyDetail(familyId);

      if (!PermissionUtil.isAdmin(currentAdminId, family)) {
        throw new Error('只有管理员才能转让管理员权限');
      }

      // 验证新管理员是家庭成员
      const newAdmin = family.memberDetails?.find(m => m.userId === newAdminId);
      if (!newAdmin) {
        throw new Error('目标用户不是家庭成员');
      }

      // 更新 memberDetails 中两人的角色
      const memberDetails = family.memberDetails.map(m => {
        if (m.userId === currentAdminId) {
          return { ...m, role: 'editor' };
        }
        if (m.userId === newAdminId) {
          return { ...m, role: 'admin' };
        }
        return m;
      });

      await this.familyCollection.doc(familyId).update({
        data: {
          memberDetails: memberDetails,
          creatorId: newAdminId,
          updatedAt: new Date().toISOString()
        }
      });

      // 同步 users 集合
      try {
        await this.userCollection.where({
          _openid: currentAdminId
        }).update({
          data: { familyRole: 'editor', updatedAt: new Date().toISOString() }
        });

        await this.userCollection.where({
          _openid: newAdminId
        }).update({
          data: { familyRole: 'admin', updatedAt: new Date().toISOString() }
        });
      } catch (userErr) {
        console.warn('同步用户角色失败（非致命）:', userErr);
      }

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
      const familyRes = await this.familyCollection
        .where({
          inviteCode: inviteCode.toUpperCase()
        })
        .get();

      if (familyRes.data.length === 0) {
        return { valid: false, reason: '邀请码无效' };
      }

      const family = familyRes.data[0];

      // 检查是否过期
      if (family.inviteCodeExpiry) {
        const expiryDate = new Date(family.inviteCodeExpiry);
        if (expiryDate < new Date()) {
          return { valid: false, reason: '邀请码已过期' };
        }
      }

      return {
        valid: true,
        familyId: family._id,
        familyName: family.name,
        memberCount: family.members?.length || 0,
        creatorName: family.creatorName || ''
      };
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

  /**
   * 内部方法：将自己从家庭中移除
   * @private
   */
  async _removeSelfFromFamily(familyId, userId) {
    await this.familyCollection.doc(familyId).update({
      data: {
        members: this.db.command.pull(userId),
        memberDetails: this.db.command.pull({
          userId: userId
        }),
        updatedAt: new Date().toISOString()
      }
    });

    // 清除自己的家庭关联
    await this._clearUserFamilyInfo(userId);
  }

  /**
   * 内部方法：清除用户的家庭关联信息
   * @private
   */
  async _clearUserFamilyInfo(userId) {
    try {
      await this.userCollection.where({
        _openid: userId
      }).update({
        data: {
          familyId: this.db.command.remove(),
          familyRole: this.db.command.remove(),
          updatedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.warn('清除用户家庭信息失败（非致命）:', err);
    }
  }
}

module.exports = FamilyService;
