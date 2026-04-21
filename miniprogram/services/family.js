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
      // [v4.3.2 FR-1] 保留 error.code 到抛出的 Error 实例，便于调用方按业务码分支
      const err = new Error((result.error && result.error.message) || `${action} 失败`);
      if (result.error && result.error.code) err.code = result.error.code;
      err.action = action;
      throw err;
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
      // [v4.3.2 FR-A8] 透传 data.warning（STALE_USER_POINTER / STALE_OLD_FAMILY_MEMBERSHIP）
      // 云函数顺序反转后，中途失败可能返回 success=true 但附带 warning 标记，
      // 业务上视为加入成功（云端已落库），由 patrol 巡检后续补偿。
      const result = {
        success: true,
        familyId: data.familyId,
        familyName: data.familyName
      };
      if (data && data.warning) {
        result.warning = data.warning;
        if (data.oldFamilyId) result.oldFamilyId = data.oldFamilyId;
        console.warn('[family.joinByInviteCode] 加入成功但带 warning:', data.warning);
      }
      return result;
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
  /**
   * 获取家庭详情
   *
   * [v4.3.2 FR-1] 双路径读取（灰度期）
   *   1. 优先走云函数 getFamilyDetail（安全规则收紧后的替代路径）
   *   2. 云函数失败时按 feature flag 决定是否降级直连
   *      - T-7 ~ T0：directReadFamilyFallback=true，失败自动降级（保障启动）
   *      - T+7 稳定后：手工关闭 fallback，强制云函数路径
   *      - T+14 下个版本：移除 fallback 代码
   *
   * 错误语义：
   *   - FAMILY_NOT_FOUND → 返回 null
   *   - PERMISSION_DENIED → 返回 null + warn（已被踢出场景）
   *   - 其他云函数异常 → 按 fallback 开关决定降级 or 抛错
   */
  async getFamilyDetail(familyId) {
    if (!familyId) return null;

    // 1. 优先走云函数
    try {
      const data = await this._callFamilyOperation('getFamilyDetail', { familyId });
      return data || null;
    } catch (error) {
      // _callFamilyOperation 对 USER_NOT_FOUND/INVALID_ACTION 等会抛 error.code
      const code = error && error.code;
      if (code === 'FAMILY_NOT_FOUND') {
        return null;
      }
      if (code === 'PERMISSION_DENIED') {
        console.warn('[family.getFamilyDetail] PERMISSION_DENIED（可能已被踢出家庭）:', familyId);
        return null;
      }

      // 云函数调用层失败（网络 / 函数未部署 / 内部错）：按 fallback 开关决定
      console.warn('[family.getFamilyDetail] 云函数失败:', error);
      if (!this._allowDirectReadFallback()) {
        // fallback 已关闭（T+7 之后）：直接向上抛
        throw error;
      }

      // 灰度期降级：沿用老的直连读取
      try {
        const familyRes = await this.familyCollection.doc(familyId).get();
        return familyRes.data || null;
      } catch (directErr) {
        if (directErr.errMsg && directErr.errMsg.includes('cannot find document')) {
          console.warn('家庭文档不存在:', familyId);
          return null;
        }
        // ★ [v4.2] 权限拒绝时返回 null 并打印警告，避免阻塞启动流程
        //   [v4.3.2 FR-1] T0 收紧规则后，非成员直连必返回 -502003，降级不可用
        if (directErr.errCode === -502003 || (directErr.errMsg && directErr.errMsg.includes('Permission denied'))) {
          console.warn('获取家庭详情权限不足（安全规则可能未生效或用户不在家庭成员中）:', familyId);
          return null;
        }
        console.error('获取家庭详情失败（云函数+直连均失败）:', directErr);
        return null;
      }
    }
  }

  /**
   * [v4.3.2 FR-1] fallback 开关：灰度期允许降级直连
   * 通过 globalData.featureFlags.directReadFamilyFallback 控制
   * 默认 true（未显式设置 false 即开启）
   * @private
   */
  _allowDirectReadFallback() {
    try {
      const app = getApp();
      const flag = app && app.globalData && app.globalData.featureFlags
        && app.globalData.featureFlags.directReadFamilyFallback;
      return flag !== false;
    } catch (_) {
      return true;
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
  /**
   * 用户主动退出家庭
   *
   * [v4.3.0 FR-5] 契约重构：
   * 统一使用 `_callFamilyOperation`；返回 `data.status` 状态机：
   *   - 'ok'              → 正常退出
   *   - 'dissolved'       → 最后一人退出，家庭已解散
   *   - 'need_transfer'   → 唯一管理员需先转让
   *   - 'family_not_found' / 'not_member' → 幂等
   *
   * 为兼容未升级的调用方，返回值同时保留 legacy 字段：
   *   { success, status, otherMembers?, message,
   *     familyNotFound?, notMember?, familyDissolved?, needTransfer? }
   *
   * @param {string} familyId 家庭 ID
   * @param {string} userId 用户 ID（v4.2: 云函数内自动识别，此参数忽略）
   * @returns {Promise<Object>} 结构化结果
   */
  async leaveFamily(familyId, userId) {
    try {
      const data = await this._callFamilyOperation('leaveFamily', { familyId });
      // 新契约：所有业务分支都在 data.status 中；legacy 字段由云函数返回过渡期保留
      return {
        success: data.status !== 'need_transfer',
        status: data.status,
        otherMembers: data.otherMembers || [],
        message: data.message,
        // legacy 兼容（推荐调用方迁移到 status）
        needTransfer: data.status === 'need_transfer' || !!data.needTransfer,
        familyNotFound: data.status === 'family_not_found' || !!data.familyNotFound,
        notMember: data.status === 'not_member' || !!data.notMember,
        familyDissolved: data.status === 'dissolved' || !!data.familyDissolved
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
