/**
 * 引导页面
 * 多步骤引导流程：欢迎页 → 用户信息 → 家庭协作选择
 */

const AuthService = require('../../services/auth');
const FamilyService = require('../../services/family');
const StorageUtil = require('../../utils/storage');
const ThemeManager = require('../../utils/theme');

// 身份关系映射（完整版）
const RELATION_MAP = {
  mom: '妈妈',
  dad: '爸爸',
  grandma_m: '奶奶',      // 父系祖母
  grandpa_m: '爷爷',      // 父系祖父
  grandma_p: '外婆',      // 母系祖母
  grandpa_p: '外公',      // 母系祖父
  nanny: '保姆',
  other: '其他'
};

// 身份选项数组（用于UI渲染）
const RELATION_OPTIONS = [
  { value: 'mom', label: '妈妈', icon: '/images/icons/mom.png' },
  { value: 'dad', label: '爸爸', icon: '/images/icons/dad.png' },
  { value: 'grandma_m', label: '奶奶', icon: '/images/icons/grandma.png' },
  { value: 'grandpa_m', label: '爷爷', icon: '/images/icons/grandpa.png' },
  { value: 'grandma_p', label: '外婆', icon: '/images/icons/grandma.png' },
  { value: 'grandpa_p', label: '外公', icon: '/images/icons/grandpa.png' },
  { value: 'nanny', label: '保姆', icon: '/images/icons/nanny.png' },
  { value: 'other', label: '其他', icon: '/images/icons/family.png' }
];

Page({
  data: {
    currentStep: 1, // 当前步骤：1-欢迎页，2-用户信息，3-家庭选择
    avatarUrl: '',
    nickname: '',
    selectedRelation: '',
    inviteCode: '',
    showInvitePopup: false,
    showSuccessPopup: false, // 创建成功弹窗
    createdInviteCode: '', // 创建家庭后生成的邀请码
    familyName: '', // 创建的家庭名称
    loading: false,
    loadingText: '',
    joiningFamily: false,
    canGoNext: false,
    isAutoLoggingIn: true // 自动登录中
  },

  async onLoad(options) {
    // 检查是否有邀请码参数（通过分享链接进入）
    if (options.inviteCode) {
      this.setData({ 
        inviteCode: options.inviteCode,
        showInvitePopup: true 
      });
    }

    // 尝试自动登录（查询数据库判断用户是否已注册）
    await this.tryAutoLogin();
  },

  /**
   * 尝试自动登录
   * 微信小程序天然免登录，退出后可自动重新登录
   */
  async tryAutoLogin() {
    this.setData({ loading: true, loadingText: '加载中...' });

    try {
      const authService = new AuthService();
      // 获取用户信息（会查询数据库判断是否已存在）
      const userInfo = await authService.getUserInfo();

      // 判断用户是否已完善信息
      if (userInfo && userInfo.nickname) {
        // 用户已注册，自动登录
        StorageUtil.saveUserInfo(userInfo);
        getApp().globalData.userInfo = userInfo;

        // 加载家庭信息
        if (userInfo.familyId) {
          await this.loadFamilyInfo(userInfo.familyId);
        }

        // 加载当前宝宝信息
        await this.loadCurrentBaby();

        // 跳转到首页
        wx.switchTab({
          url: '/pages/home/home'
        });
        return;
      }

      // 用户未完善信息，显示引导流程
      // 重要：保存用户信息到本地存储，确保后续流程能获取到 userId
      StorageUtil.saveUserInfo(userInfo);
      getApp().globalData.userInfo = userInfo;

      this.setData({
        avatarUrl: userInfo.avatar || '',
        nickname: userInfo.nickname || '',
        selectedRelation: userInfo.relation || '',
        currentStep: 1,
        loading: false,
        isAutoLoggingIn: false
      });

      // 如果有头像但没有昵称，直接进入步骤2
      if (userInfo.avatar && !userInfo.nickname) {
        this.setData({ currentStep: 2 });
      }

      this.checkCanGoNext();
    } catch (error) {
      console.error('自动登录失败:', error);
      // 自动登录失败，显示欢迎页
      this.setData({
        currentStep: 1,
        loading: false,
        isAutoLoggingIn: false
      });
    }
  },

  /**
   * 加载家庭信息
   */
  async loadFamilyInfo(familyId) {
    try {
      const FamilyService = require('../../services/family');
      const familyService = new FamilyService();
      const familyInfo = await familyService.getFamilyDetail(familyId);
      
      if (familyInfo) {
        StorageUtil.saveFamilyInfo(familyInfo);
        getApp().globalData.familyInfo = familyInfo;
      } else {
        // 家庭不存在，清理本地存储的家庭信息
        console.warn('家庭不存在:', familyId);
        StorageUtil.remove('family_info');
        getApp().globalData.familyInfo = null;
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 加载当前宝宝信息
   */
  async loadCurrentBaby() {
    try {
      const db = wx.cloud.database();
      const userInfo = StorageUtil.getUserInfo();
      
      // BUG-6: 检查 userInfo 和 familyId 是否存在
      if (!userInfo || !userInfo.familyId) {
        console.warn('loadCurrentBaby: userInfo 或 familyId 不存在');
        return;
      }
      
      // 查询用户关联的宝宝
      const res = await db.collection('babies').where({
        familyId: userInfo.familyId
      }).get();

      if (res.data && res.data.length > 0) {
        // 默认选择第一个宝宝
        const currentBaby = res.data[0];
        StorageUtil.saveCurrentBaby(currentBaby);
        getApp().globalData.currentBaby = currentBaby;
      }
    } catch (error) {
      console.error('加载宝宝信息失败:', error);
    }
  },

  /**
   * 开始引导流程
   */
  startOnboarding() {
    this.setData({ currentStep: 2 });
  },

  /**
   * 直接登录（已有账号的用户）
   */
  async handleDirectLogin() {
    await this.tryAutoLogin();
  },

  /**
   * 选择头像
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
  },

  /**
   * 输入昵称
   */
  onInputNickname(e) {
    this.setData({ nickname: e.detail.value });
    this.checkCanGoNext();
  },

  /**
   * 选择身份关系
   */
  selectRelation(e) {
    const relation = e.currentTarget.dataset.relation;
    this.setData({ selectedRelation: relation });
    this.checkCanGoNext();
  },

  /**
   * 检查是否可以进入下一步
   */
  checkCanGoNext() {
    const { nickname, selectedRelation } = this.data;
    const canGoNext = nickname.trim().length > 0 && selectedRelation !== '';
    this.setData({ canGoNext });
  },

  /**
   * 进入下一步
   */
  async goToNextStep() {
    if (!this.data.canGoNext) {
      return;
    }

    this.setData({ loading: true, loadingText: '保存中...' });

    try {
      const authService = new AuthService();
      let userInfo = StorageUtil.getUserInfo();

      // 防御性检查：确保用户信息存在
      if (!userInfo || !userInfo._id) {
        // 重新获取用户信息
        userInfo = await authService.getUserInfo();
        StorageUtil.saveUserInfo(userInfo);
        getApp().globalData.userInfo = userInfo;
      }

      // 上传头像到云存储
      let avatarCloudUrl = this.data.avatarUrl;
      if (this.data.avatarUrl && !this.data.avatarUrl.startsWith('cloud://')) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/${userInfo._id}_${Date.now()}.jpg`,
          filePath: this.data.avatarUrl
        });
        avatarCloudUrl = uploadRes.fileID;
      }

      // 更新用户信息
      const updateData = {
        nickname: this.data.nickname.trim(),
        avatar: avatarCloudUrl,
        relation: this.data.selectedRelation,
        relationText: RELATION_MAP[this.data.selectedRelation]
      };

      await authService.updateUserInfo(userInfo._id, updateData);

      // 更新本地存储和全局数据
      const newUserInfo = { ...userInfo, ...updateData };
      StorageUtil.saveUserInfo(newUserInfo);
      getApp().globalData.userInfo = newUserInfo;

      // 进入下一步
      this.setData({ 
        currentStep: 3,
        loading: false 
      });
    } catch (error) {
      console.error('保存用户信息失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 创建家庭组
   */
  async createFamily() {
    this.setData({ loading: true, loadingText: '创建中...' });

    try {
      const familyService = new FamilyService();
      let userInfo = StorageUtil.getUserInfo();

      // 防御性检查：确保用户信息存在
      if (!userInfo || !userInfo._id) {
        const authService = new AuthService();
        userInfo = await authService.getUserInfo();
        StorageUtil.saveUserInfo(userInfo);
        getApp().globalData.userInfo = userInfo;
      }
      
      // 创建家庭组
      const family = await familyService.createFamily({
        name: `${userInfo.nickname}的家庭`,
        creatorId: userInfo._id,
        creatorName: userInfo.nickname
      });

      // 更新用户信息，关联家庭
      const authService = new AuthService();
      await authService.updateUserInfo(userInfo._id, {
        familyId: family._id,
        familyRole: 'admin'
      });

      // 更新本地存储
      const newUserInfo = { 
        ...userInfo, 
        familyId: family._id,
        familyRole: 'admin'
      };
      StorageUtil.saveUserInfo(newUserInfo);
      StorageUtil.saveFamilyInfo(family);  // 保存家庭信息
      getApp().globalData.userInfo = newUserInfo;
      getApp().globalData.familyInfo = family;

      // 显示成功弹窗，展示邀请码
      this.setData({ 
        loading: false,
        showSuccessPopup: true,
        createdInviteCode: family.inviteCode || '',
        familyName: family.name || `${userInfo.nickname}的家庭`
      });
    } catch (error) {
      console.error('创建家庭失败:', error);
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 复制邀请码
   */
  copyCreatedInviteCode() {
    const code = this.data.createdInviteCode;
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
   * 分享邀请码给微信好友
   */
  shareInviteCode() {
    const code = this.data.createdInviteCode;
    const familyName = this.data.familyName;
    // 注意：小程序分享需要通过 button open-type="share" 实现
    // 这里提示用户使用分享按钮
    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  /**
   * 关闭成功弹窗，继续下一步
   */
  closeSuccessPopup() {
    this.setData({ showSuccessPopup: false });
    // 跳转到创建宝宝页面
    wx.redirectTo({
      url: '/pages/baby-create/baby-create?from=onboarding'
    });
  },

  /**
   * 分享给好友（通过button触发）
   */
  onShareAppMessage() {
    const code = this.data.createdInviteCode;
    const familyName = this.data.familyName;
    return {
      title: `邀请你加入「${familyName}」家庭，一起记录宝宝成长`,
      path: `/pages/auth/auth?inviteCode=${code}`,
      imageUrl: '/images/share-invite.png'
    };
  },

  onShareTimeline() {
    return {
      title: '宝宝护理记录 - 科学育儿好帮手',
      imageUrl: '/images/share-default.png'
    };
  },

  /**
   * 显示邀请码输入弹窗
   */
  showInviteCodeInput() {
    this.setData({ showInvitePopup: true });
  },

  /**
   * 隐藏邀请码输入弹窗
   */
  hideInviteCodeInput() {
    this.setData({ showInvitePopup: false, inviteCode: '' });
  },

  /**
   * 输入邀请码
   */
  onInputInviteCode(e) {
    const code = e.detail.value.toUpperCase();
    this.setData({ inviteCode: code });
  },

  /**
   * 通过邀请码加入家庭
   */
  async joinFamily() {
    if (this.data.inviteCode.length !== 6) {
      wx.showToast({
        title: '请输入6位邀请码',
        icon: 'none'
      });
      return;
    }

    this.setData({ joiningFamily: true });

    try {
      const familyService = new FamilyService();
      let userInfo = StorageUtil.getUserInfo();

      // 防御性检查：确保用户信息存在
      if (!userInfo || !userInfo._id) {
        const authService = new AuthService();
        userInfo = await authService.getUserInfo();
        StorageUtil.saveUserInfo(userInfo);
        getApp().globalData.userInfo = userInfo;
      }

      // 通过邀请码加入家庭
      const result = await familyService.joinByInviteCode(this.data.inviteCode, {
        userId: userInfo._id,
        userName: userInfo.nickname,
        relation: userInfo.relationText
      });

      if (result.success) {
        // 获取完整的家庭信息
        const familyInfo = await familyService.getFamilyDetail(result.familyId);

        // 更新用户信息
        const authService = new AuthService();
        await authService.updateUserInfo(userInfo._id, {
          familyId: result.familyId,
          familyRole: 'editor'
        });

        // 更新本地存储
        const newUserInfo = { 
          ...userInfo, 
          familyId: result.familyId,
          familyRole: 'editor'
        };
        StorageUtil.saveUserInfo(newUserInfo);
        StorageUtil.saveFamilyInfo(familyInfo);  // 保存家庭信息
        getApp().globalData.userInfo = newUserInfo;
        getApp().globalData.familyInfo = familyInfo;

        wx.showToast({
          title: '加入成功',
          icon: 'success'
        });

        // 隐藏弹窗
        this.setData({ showInvitePopup: false, joiningFamily: false });

        // 跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/home/home'
          });
        }, 1000);
      } else {
        // BUG-19: result.success 为 false 或未定义时，给出明确提示
        wx.showToast({
          title: result.message || '邀请码无效，请检查后重试',
          icon: 'none'
        });
        this.setData({ joiningFamily: false });
      }
    } catch (error) {
      console.error('加入家庭失败:', error);
      wx.showToast({
        title: error.message || '邀请码无效或已过期',
        icon: 'none'
      });
      this.setData({ joiningFamily: false });
    }
  },

  /**
   * 跳过家庭设置
   */
  skipFamily() {
    wx.showModal({
      title: '提示',
      content: '跳过后可在个人中心创建或加入家庭',
      confirmText: '继续',
      success: (res) => {
        if (res.confirm) {
          // 跳转到创建宝宝页面
          wx.redirectTo({
            url: '/pages/baby-create/baby-create?from=onboarding'
          });
        }
      }
    });
  },

  /**
   * 阻止弹窗底部滚动穿透
   */
  preventTouchMove() {
    return false;
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
