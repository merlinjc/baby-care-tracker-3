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

    // [v4.3.0 hotfix] 服务实例必须在任何 await 之前初始化
    // 小程序生命周期：onLoad 的 await 等待期间 onShow 会先触发，
    // 若 familyService 放在 await 之后赋值，onShow 的 loadFamilyInfo 会拿到 undefined
    this.familyService = FamilyService.getInstance();

    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    const userInfo = StorageUtil.getUserInfo();
    this.setData({
      // ★ [v4.1 FR-6] ensureUserReady 已保证 _id 存在，不再 fallback openid
      currentUserId: userInfo?._id || ''
    });
    this.loadFamilyInfo();
  },

  onShow() {
    this._applyTheme();
    // [v4.3.0 hotfix] 防御：若 onShow 早于 onLoad 完成触发（async 生命周期竞态），跳过本次刷新
    // onLoad 内部尾部已经会调用 loadFamilyInfo，数据一定会被加载
    if (!this.familyService) return;
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
      let familyInfo = StorageUtil.getFamilyInfo();

      if (!familyInfo || !familyInfo._id) {
        this.setData({ loading: false });
        return;
      }

      // ★ [v4.2.2 FR-8] 统一通过服务层获取（内部已处理 cannot find document 和权限拒绝降级）
      const fresh = await this.familyService.getFamilyDetail(familyInfo._id);
      if (!fresh) {
        console.warn('家庭文档不存在或无权访问，清理本地数据');
        StorageUtil.remove('family_info');
        this.setData({
          familyInfo: null,
          members: [],
          inviteCode: '',
          loading: false
        });
        return;
      }

      familyInfo = fresh;
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
      
      // ★ [v4.2 FR-15] 如果邀请码为空，通过云函数自动生成
      if (!inviteCode) {
        try {
          const result = await this.familyService.refreshInviteCode(
            familyInfo._id, this.data.currentUserId
          );
          inviteCode = result; // refreshInviteCode 返回新邀请码
          // 从云函数返回后重新加载家庭信息
          await this.loadFamilyInfo();
          return; // loadFamilyInfo 会重新设置所有 data
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
   * ★ [v4.2 FR-15] 改为通过 familyService.refreshInviteCode() 调用云函数
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
            await this.familyService.refreshInviteCode(
              this.data.familyInfo._id, this.data.currentUserId
            );
            // 刷新页面数据
            await this.loadFamilyInfo();
            wx.showToast({ title: '生成成功', icon: 'success' });
          } catch (error) {
            console.error('生成邀请码失败:', error);
            wx.showToast({ title: error.message || '生成失败', icon: 'none' });
          }
        }
      }
    });
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
   *
   * [v4.3.0 hotfix] 增强流程：
   * 1. 前置预判：点击时先基于本地 familyInfo 判断是否唯一管理员
   *    - 是 + 有其他成员 → 直接弹转让选择弹窗（跳过"确认退出"二次弹窗，避免两次交互）
   *    - 否（普通成员 / 最后一人 / 有其他 admin）→ 正常"确认退出"流程
   * 2. 双重防御：即便 UI 预判被绕过，服务端仍会返回 status='need_transfer' 兜底
   * 3. 统一使用 v4.3.0 FR-5 的 status 状态机（兼容 legacy 字段）
   */
  leaveFamily() {
    const userInfo = StorageUtil.getUserInfo();
    const { familyInfo } = this.data;

    if (!userInfo || !userInfo._id || !familyInfo || !familyInfo._id) {
      wx.showToast({ title: '未找到家庭信息', icon: 'none' });
      return;
    }

    // 前置预判：是否唯一管理员 + 有其他成员
    const isAdmin = PermissionUtil.isAdmin(userInfo._id, familyInfo);
    const hasOtherAdmin = PermissionUtil.hasOtherAdmin(familyInfo, userInfo._id);
    const otherMembers = (familyInfo.memberDetails || []).filter(m => m.userId !== userInfo._id);
    const needTransferLocal = isAdmin && !hasOtherAdmin && otherMembers.length > 0;

    if (needTransferLocal) {
      // 唯一管理员 + 有其他成员 → 直接进入转让流程
      wx.showModal({
        title: '需先转让管理员',
        content: '您是当前家庭的唯一管理员，退出前请先将管理员权限转让给其他成员。',
        confirmText: '去转让',
        cancelText: '取消',
        confirmColor: ThemeManager.getConfirmColor('primary'),
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.setData({
              showTransferModal: true,
              transferCandidates: otherMembers,
              selectedTransferId: ''
            });
          }
        }
      });
      return;
    }

    // 普通成员 / 最后一人 / 有其他 admin：常规确认流程
    const isLastMember = (familyInfo.members || []).length <= 1;
    const confirmContent = isLastMember
      ? '您是家庭中最后一名成员，退出将解散家庭，所有家庭数据不可恢复。确定退出吗？'
      : '确定要退出当前家庭吗？退出后数据将无法访问。';

    wx.showModal({
      title: '退出家庭',
      content: confirmContent,
      confirmColor: ThemeManager.getConfirmColor('warn'),
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '退出中...', mask: true });
        try {
          const result = await this.familyService.leaveFamily(familyInfo._id, userInfo._id);

          // v4.3.0 FR-5 新契约：使用 status 状态机判断
          if (result.status === 'need_transfer') {
            // 兜底：服务端检测到仍需转让（本地 familyInfo 可能已过期）
            wx.hideLoading();
            this.setData({
              showTransferModal: true,
              transferCandidates: result.otherMembers || [],
              selectedTransferId: ''
            });
            return;
          }

          // status: 'ok' | 'dissolved' | 'family_not_found' | 'not_member' 均视为退出成功
          StorageUtil.clear();
          wx.hideLoading();

          if (result.status === 'dissolved') {
            wx.showToast({ title: '家庭已解散', icon: 'success' });
          }

          setTimeout(() => {
            wx.reLaunch({ url: '/pages/auth/auth' });
          }, result.status === 'dissolved' ? 800 : 0);
        } catch (error) {
          wx.hideLoading();
          console.error('退出失败:', error);
          wx.showToast({ title: error.message || '退出失败', icon: 'none' });
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
