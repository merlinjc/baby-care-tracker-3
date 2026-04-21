/**
 * 我的页
 * 用户设置、家庭管理、数据导出
 */

const AuthService = require('../../services/auth');
const FamilyService = require('../../services/family');
const StorageUtil = require('../../utils/storage');
const { ICONS } = require('../../utils/icon-config');
const ThemeManager = require('../../utils/theme');
const shareBehavior = require('../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    userInfo: null,
    familyInfo: null,
    showEditPopup: false,
    editNickname: '',
    editAvatar: '',
    menuItems: [
      {
        icon: ICONS.menuBaby,
        title: '宝宝管理',
        desc: '添加、编辑宝宝信息',
        url: '/pages/baby-list/baby-list',
        bgClass: 'bg-baby'
      },
      {
        icon: ICONS.menuFamily,
        title: '家庭协作',
        desc: '邀请家人共同记录',
        url: '/packageSocial/pages/family/family',
        bgClass: 'bg-family'
      },
      {
        icon: ICONS.menuStats,
        title: '数据导出',
        desc: '备份育儿记录数据',
        url: '/packageSocial/pages/export/export',
        bgClass: 'bg-stats'
      },
      {
        icon: ICONS.menuSettings,
        title: '设置',
        desc: '通知、隐私等设置',
        url: '/packageSocial/pages/settings/settings',
        bgClass: 'bg-settings'
      },
      {
        icon: ICONS.menuHelp,
        title: '使用指南',
        desc: '快速了解功能使用',
        url: '/pages/guide/guide',
        bgClass: 'bg-help'
      }
    ]
  },

  async onLoad() {
    const app = getApp();
    this.setData({ appVersion: app.globalData.version || 'v4.0.1' });
    await this.init();
  },

  onShow() {
    this._applyTheme();
    this.loadFamilyInfo();
  },

  /**
   * [v4.1] 统一初始化（含用户校验）
   */
  async init() {
    const app = getApp();
    const check = await app.ensureUserReady();
    
    if (!check.ready) {
      if (check.reason === 'removed') {
        wx.showModal({
          title: '提示',
          content: '您已被移除出该家庭，请重新加入或创建新家庭。',
          showCancel: false,
          success: () => wx.reLaunch({ url: check.redirectUrl })
        });
      } else {
        wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      }
      return;
    }
    
    await this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      let userInfo = StorageUtil.getUserInfo();
      
      if (!userInfo) {
        const authService = AuthService.getInstance();
        userInfo = await authService.getUserInfo();
        StorageUtil.saveUserInfo(userInfo);
      }

      this.setData({ userInfo });
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  /**
   * 加载家庭信息
   */
  loadFamilyInfo() {
    const familyInfo = StorageUtil.getFamilyInfo();
    this.setData({ familyInfo });
  },

  /**
   * 跳转到功能页面
   */
  goToPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },

  /**
   * 编辑个人资料 - 打开编辑弹窗
   */
  editProfile() {
    this.setData({
      showEditPopup: true,
      editNickname: this.data.userInfo?.nickname || '',
      editAvatar: this.data.userInfo?.avatar || ''
    });
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  /**
   * 更换头像
   */
  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ editAvatar: tempFilePath });
      }
    });
  },

  /**
   * 关闭编辑弹窗
   */
  closeEditPopup() {
    this.setData({ showEditPopup: false });
  },

  /**
   * 保存个人资料（头像 + 昵称）
   */
  async saveProfile() {
    const nickname = this.data.editNickname.trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    const userInfo = this.data.userInfo;
    if (!userInfo || !userInfo._id) return;

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const updateData = { nickname };
      let newAvatar = userInfo.avatar;

      // 如果头像有变化（本地临时路径），上传到云存储
      const editAvatar = this.data.editAvatar;
      if (editAvatar && editAvatar !== userInfo.avatar && (editAvatar.startsWith('wxfile://') || editAvatar.startsWith('http://tmp'))) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/user_${userInfo._id}_${Date.now()}.jpg`,
          filePath: editAvatar
        });
        newAvatar = uploadRes.fileID;
        updateData.avatar = newAvatar;
      }

      const authService = AuthService.getInstance();
      await authService.updateUserInfo(userInfo._id, updateData);

      // 更新本地数据
      userInfo.nickname = nickname;
      if (updateData.avatar) {
        userInfo.avatar = newAvatar;
      }
      this.setData({
        userInfo,
        showEditPopup: false
      });
      StorageUtil.saveUserInfo(userInfo);
      getApp().globalData.userInfo = userInfo;

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.error('保存资料失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /**
   * 阻止弹窗滚动穿透
   */
  preventTouchMove() {
    return false;
  },

  /**
   * 跳转到家庭管理页
   */
  goToFamily() {
    wx.navigateTo({
      url: '/packageSocial/pages/family/family'
    });
  },

  /**
   * 退出使用
   * 删除用户数据，从家庭组中移除
   *
   * [v4.3.0 hotfix] 若用户是家庭唯一管理员 + 家庭有其他成员：
   * - 必须阻断注销流程，引导去家庭管理页转让
   * - 否则会导致"幽灵家庭"：用户已删除但 leaveFamily 因 need_transfer 被服务端拒绝
   */
  async logout() {
    // [v4.3.0 hotfix] 前置检查：唯一管理员禁止注销
    const userInfoPre = StorageUtil.getUserInfo();
    const familyInfoPre = StorageUtil.getFamilyInfo();
    if (userInfoPre && userInfoPre._id && familyInfoPre && familyInfoPre._id) {
      const PermissionUtil = require('../../utils/permission');
      const isAdmin = PermissionUtil.isAdmin(userInfoPre._id, familyInfoPre);
      const hasOtherAdmin = PermissionUtil.hasOtherAdmin(familyInfoPre, userInfoPre._id);
      const otherMembers = (familyInfoPre.members || []).filter(id => id !== userInfoPre._id);
      if (isAdmin && !hasOtherAdmin && otherMembers.length > 0) {
        wx.showModal({
          title: '无法注销',
          content: '您是当前家庭的唯一管理员，请先在「家庭管理」中转让管理员权限或退出家庭，再注销账号。',
          confirmText: '去家庭管理',
          cancelText: '取消',
          confirmColor: ThemeManager.getConfirmColor('primary'),
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/packageSocial/pages/family/family' });
            }
          }
        });
        return;
      }
    }

    const res = await wx.showModal({
      title: '退出使用',
      content: '退出使用将删除您的所有数据，并从家庭组中移除。下次使用需要重新注册。确定退出吗？',
      confirmText: '确定退出',
      confirmColor: ThemeManager.getConfirmColor('warn'),
      cancelText: '取消'
    });

    if (!res.confirm) return;

    wx.showLoading({ title: '退出中...', mask: true });

    try {
      const userInfo = StorageUtil.getUserInfo();
      const familyInfo = StorageUtil.getFamilyInfo();

      // 1. 如果用户在家庭组中，先退出家庭（即使家庭不存在也继续）
      if (familyInfo && userInfo && userInfo.familyId) {
        try {
          const familyService = FamilyService.getInstance();
          const leaveResult = await familyService.leaveFamily(familyInfo._id, userInfo._id);
          // [v4.3.0 hotfix] 兜底：若前置检查遗漏，服务端返回 need_transfer 时中止注销
          if (leaveResult.status === 'need_transfer') {
            wx.hideLoading();
            wx.showModal({
              title: '无法注销',
              content: '检测到您是家庭唯一管理员，请先转让管理员权限再注销账号。',
              showCancel: false
            });
            return;
          }
        } catch (familyError) {
          // 家庭退出失败（如家庭已不存在），继续清理本地数据
          console.warn('退出家庭时出错，继续清理本地数据:', familyError.message);
        }
      }

      // 2. 删除用户数据（如果用户存在）
      if (userInfo && userInfo._id) {
        try {
          const authService = AuthService.getInstance();
          await authService.deleteUser(userInfo._id);
        } catch (authError) {
          console.warn('删除用户数据时出错:', authError.message);
        }
      }

      // 3. 清除本地存储（最重要，确保本地数据被清理）
      StorageUtil.clear();

      // 4. 清除全局数据
      getApp().globalData.userInfo = null;
      getApp().globalData.familyInfo = null;
      getApp().globalData.currentBaby = null;

      wx.hideLoading();
      wx.showToast({
        title: '已退出使用',
        icon: 'success'
      });

      // 5. 跳转到引导页面
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/auth/auth'
        });
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('退出使用失败:', error);
      
      // 即使出错也尝试清理本地数据
      try {
        StorageUtil.clear();
      } catch (e) {
        // 忽略清理错误
      }
      
      // 显示详细错误信息
      wx.showModal({
        title: '退出失败',
        content: error.message || '退出使用失败，请重试',
        showCancel: false
      });
    }
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
