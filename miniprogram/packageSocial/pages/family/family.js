/**
 * 家庭管理页
 * 成员管理、邀请、权限设置
 */

const StorageUtil = require('../../../utils/storage');
const FamilyService = require('../../../services/family');
const PermissionUtil = require('../../../utils/permission');
const { formatDate } = require('../../../utils/date');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    familyInfo: null,
    members: [],
    inviteCode: '',
    inviteCodeExpiry: '',
    inviteExpiryText: '',
    inviteExpiryWarning: false,
    loading: true,
    
    // 当前用户角色
    currentRole: 'editor',
    currentRoleText: '成员',
    isAdmin: false,
    currentUserId: '',

    // 权限编辑弹窗
    showRoleModal: false,
    targetMember: null,
    selectedRole: '',

    // 管理员转让弹窗
    showTransferModal: false,
    transferCandidates: [],
    selectedTransferId: '',

    // 成员操作菜单
    showMemberMenu: false,
    menuMember: null
  },

  async onLoad() {
    this._lastShowTime = 0;
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    const userInfo = StorageUtil.getUserInfo();
    this.setData({
      currentUserId: userInfo?._id || userInfo?.openid || ''
    });
    this.familyService = new FamilyService();
    this.loadFamilyInfo();
  },

  onShow() {
    this._applyTheme();
    // 30s 节流：避免频繁切换重复加载
    const now = Date.now();
    if (this._lastShowTime && now - this._lastShowTime < 30000) return;
    this._lastShowTime = now;
    this.loadFamilyInfo();
  },

  /**
   * 加载家庭信息
   */
  async loadFamilyInfo() {
    try {
      const db = wx.cloud.database();
      let familyInfo = StorageUtil.getFamilyInfo();
      
      if (!familyInfo || !familyInfo._id) {
        this.setData({ loading: false });
        return;
      }

      // 从数据库获取最新的家庭信息
      let familyRes;
      try {
        familyRes = await db.collection('families').doc(familyInfo._id).get();
      } catch (docError) {
        // 家庭文档不存在，清理本地数据
        if (docError.errMsg && docError.errMsg.includes('cannot find document')) {
          console.warn('家庭文档不存在，清理本地数据');
          StorageUtil.remove('family_info');
          this.setData({ 
            familyInfo: null, 
            members: [],
            inviteCode: '',
            loading: false 
          });
          return;
        }
        throw docError;
      }
      
      familyInfo = familyRes.data;
      const userId = this.data.currentUserId;
      
      // 获取当前用户角色
      const currentRole = PermissionUtil.getUserRole(userId, familyInfo);
      const isAdmin = currentRole === 'admin';

      // 从 memberDetails 获取成员信息
      const memberDetails = familyInfo.memberDetails || [];
      const members = memberDetails.map(m => ({
        ...m,
        roleText: PermissionUtil.getRoleText(m.role),
        joinTimeText: formatDate(m.joinedAt),
        isMe: m.userId === userId
      }));

      // 把"我"排到第一个
      members.sort((a, b) => {
        if (a.isMe) return -1;
        if (b.isMe) return 1;
        if (a.role === 'admin') return -1;
        if (b.role === 'admin') return 1;
        return 0;
      });

      let inviteCode = familyInfo.inviteCode || '';
      
      // 如果邀请码为空，自动生成一个
      if (!inviteCode) {
        try {
          inviteCode = this.generateInviteCode();
          const now = new Date();
          const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          await db.collection('families').doc(familyInfo._id).update({
            data: {
              inviteCode: inviteCode,
              inviteCodeExpiry: inviteExpiry.toISOString(),
              updatedAt: now
            }
          });
          
          // 更新本地对象
          familyInfo.inviteCode = inviteCode;
          familyInfo.inviteCodeExpiry = inviteExpiry.toISOString();
          StorageUtil.saveFamilyInfo(familyInfo);
        } catch (err) {
          console.error('自动生成邀请码失败:', err);
        }
      }

      // 计算邀请码有效期
      const expiryInfo = this._calcInviteExpiry(familyInfo.inviteCodeExpiry);

      this.setData({ 
        familyInfo, 
        members,
        inviteCode: inviteCode,
        inviteCodeExpiry: familyInfo.inviteCodeExpiry || '',
        inviteExpiryText: expiryInfo.text,
        inviteExpiryWarning: expiryInfo.warning,
        currentRole,
        currentRoleText: PermissionUtil.getRoleText(currentRole),
        isAdmin,
        loading: false 
      });
    } catch (error) {
      console.error('加载家庭信息失败:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 计算邀请码有效期文本
   */
  _calcInviteExpiry(expiryStr) {
    if (!expiryStr) return { text: '', warning: false };

    const expiry = new Date(expiryStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) {
      return { text: '已过期', warning: true };
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 1) {
      return { text: `${days}天后过期`, warning: false };
    } else if (days === 1) {
      return { text: '明天过期', warning: true };
    } else {
      return { text: `${hours}小时后过期`, warning: true };
    }
  },

  /**
   * 复制邀请码
   */
  copyInviteCode() {
    const code = this.data.inviteCode;
    if (!code) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '已复制邀请码', icon: 'success' });
      }
    });
  },

  /**
   * 分享邀请
   */
  shareInvite() {
    const code = this.data.inviteCode;
    if (!code) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '邀请家人',
      content: `邀请码: ${code}\n\n请让家人在小程序"加入家庭"页面输入此邀请码`,
      confirmText: '复制',
      success: (res) => {
        if (res.confirm) {
          this.copyInviteCode();
        }
      }
    });
  },

  /**
   * 重新生成邀请码（仅管理员）
   */
  async regenerateCode() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅管理员可操作', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '重新生成邀请码',
      content: '确定要重新生成邀请码吗？旧邀请码将失效。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newCode = this.generateInviteCode();
            const db = wx.cloud.database();
            const now = new Date();
            const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            await db.collection('families').doc(this.data.familyInfo._id).update({
              data: {
                inviteCode: newCode,
                inviteCodeExpiry: inviteExpiry.toISOString(),
                updatedAt: now
              }
            });

            // 更新本地存储
            const familyInfo = StorageUtil.getFamilyInfo();
            if (familyInfo) {
              familyInfo.inviteCode = newCode;
              familyInfo.inviteCodeExpiry = inviteExpiry.toISOString();
              StorageUtil.saveFamilyInfo(familyInfo);
            }

            const expiryInfo = this._calcInviteExpiry(inviteExpiry.toISOString());
            this.setData({ 
              inviteCode: newCode,
              inviteCodeExpiry: inviteExpiry.toISOString(),
              inviteExpiryText: expiryInfo.text,
              inviteExpiryWarning: expiryInfo.warning
            });
            wx.showToast({ title: '生成成功', icon: 'success' });
          } catch (error) {
            console.error('生成邀请码失败:', error);
            wx.showToast({ title: '生成失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 生成邀请码
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // =================== 成员管理 ===================

  /**
   * 成员长按事件（仅管理员有效）
   */
  onMemberLongPress(e) {
    if (!this.data.isAdmin) return;
    const member = e.currentTarget.dataset.member;
    if (member.isMe) return; // 不能操作自己

    this.setData({
      showMemberMenu: true,
      menuMember: member
    });
  },

  /**
   * 成员操作按钮点击
   */
  onMemberAction(e) {
    const member = e.currentTarget.dataset.member;
    this.setData({
      showMemberMenu: true,
      menuMember: member
    });
  },

  /**
   * 关闭成员操作菜单
   */
  closeMemberMenu() {
    this.setData({ showMemberMenu: false, menuMember: null });
  },

  /**
   * 打开权限编辑弹窗
   */
  editMemberRole() {
    const member = this.data.menuMember;
    this.setData({
      showMemberMenu: false,
      showRoleModal: true,
      targetMember: member,
      selectedRole: member.role || 'editor'
    });
  },

  /**
   * 选择角色
   */
  selectRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role });
  },

  /**
   * 关闭权限编辑弹窗
   */
  closeRoleModal() {
    this.setData({ showRoleModal: false, targetMember: null, selectedRole: '' });
  },

  /**
   * 确认修改权限
   */
  async confirmRoleChange() {
    const { targetMember, selectedRole, familyInfo, currentUserId } = this.data;
    
    if (!targetMember || !selectedRole) return;
    if (selectedRole === targetMember.role) {
      this.closeRoleModal();
      return;
    }

    wx.showLoading({ title: '修改中...', mask: true });
    try {
      await this.familyService.updateMemberRole(
        familyInfo._id, 
        currentUserId, 
        targetMember.userId, 
        selectedRole
      );

      wx.hideLoading();
      wx.showToast({ title: '权限已修改', icon: 'success' });
      this.closeRoleModal();
      this.loadFamilyInfo(); // 刷新数据
    } catch (error) {
      wx.hideLoading();
      console.error('修改权限失败:', error);
      wx.showToast({ title: error.message || '修改失败', icon: 'none' });
    }
  },

  /**
   * 确认移除成员
   */
  removeMemberConfirm() {
    const member = this.data.menuMember;
    this.closeMemberMenu();

    wx.showModal({
      title: '移除成员',
      content: `确定要移除 ${member.name || member.nickName || '该成员'} 吗？移除后对方将无法访问家庭数据。`,
      confirmColor: ThemeManager.getConfirmColor('warn'),
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '移除中...', mask: true });
          try {
            await this.familyService.removeMember(
              this.data.familyInfo._id,
              this.data.currentUserId,
              member.userId
            );

            wx.hideLoading();
            wx.showToast({ title: '已移除', icon: 'success' });
            this.loadFamilyInfo();
          } catch (error) {
            wx.hideLoading();
            console.error('移除成员失败:', error);
            wx.showToast({ title: error.message || '移除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // =================== 退出 / 转让 ===================

  /**
   * 退出家庭
   */
  leaveFamily() {
    wx.showModal({
      title: '退出家庭',
      content: '确定要退出当前家庭吗？退出后数据将无法访问。',
      confirmColor: ThemeManager.getConfirmColor('warn'),
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...', mask: true });
          try {
            const userInfo = StorageUtil.getUserInfo();
            if (userInfo && (userInfo._id || userInfo.openid) && this.data.familyInfo && this.data.familyInfo._id) {
              const userId = userInfo._id || userInfo.openid;
              const result = await this.familyService.leaveFamily(this.data.familyInfo._id, userId);
              
              // 需要先转让管理员
              if (result && result.needTransfer) {
                wx.hideLoading();
                this.setData({
                  showTransferModal: true,
                  transferCandidates: result.otherMembers || [],
                  selectedTransferId: ''
                });
                return;
              }
            }
            
            // 清理本地存储并返回
            StorageUtil.clear();
            wx.hideLoading();
            wx.reLaunch({ url: '/pages/auth/auth' });
          } catch (error) {
            wx.hideLoading();
            console.error('退出失败:', error);
            wx.showToast({ title: error.message || '退出失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 选择转让目标
   */
  selectTransferTarget(e) {
    this.setData({ selectedTransferId: e.currentTarget.dataset.userId });
  },

  /**
   * 关闭转让弹窗
   */
  closeTransferModal() {
    this.setData({ showTransferModal: false, transferCandidates: [], selectedTransferId: '' });
  },

  /**
   * 转让管理员并退出
   */
  async transferAndLeave() {
    const { selectedTransferId, familyInfo, currentUserId } = this.data;
    if (!selectedTransferId) {
      wx.showToast({ title: '请选择新管理员', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '转让中...', mask: true });
    try {
      // 先转让管理员
      await this.familyService.transferAdmin(familyInfo._id, currentUserId, selectedTransferId);
      
      // 再退出家庭
      await this.familyService.leaveFamily(familyInfo._id, currentUserId);

      StorageUtil.clear();
      wx.hideLoading();
      wx.reLaunch({ url: '/pages/auth/auth' });
    } catch (error) {
      wx.hideLoading();
      console.error('转让并退出失败:', error);
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
  },

  /**
   * 解散家庭并退出
   */
  dissolveAndLeave() {
    this.closeTransferModal();
    
    wx.showModal({
      title: '解散家庭',
      content: '确定要解散家庭吗？所有成员将被移出，此操作不可撤销。',
      confirmColor: ThemeManager.getConfirmColor('warn'),
      confirmText: '确认解散',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '解散中...', mask: true });
          try {
            await this.familyService.dissolveFamily(
              this.data.familyInfo._id, 
              this.data.currentUserId
            );

            StorageUtil.clear();
            wx.hideLoading();
            wx.reLaunch({ url: '/pages/auth/auth' });
          } catch (error) {
            wx.hideLoading();
            console.error('解散家庭失败:', error);
            wx.showToast({ title: error.message || '解散失败', icon: 'none' });
          }
        }
      }
    });
  },

  // =================== 通用 ===================

  /**
   * 阻止事件冒泡
   */
  preventBubble() {},

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadFamilyInfo();
    wx.stopPullDownRefresh();
  },

  /**
   * 跳转到引导页面创建家庭
   */
  goToCreate() {
    wx.redirectTo({
      url: '/pages/auth/auth?step=3'
    });
  },

  /** 应用当前主题 */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
