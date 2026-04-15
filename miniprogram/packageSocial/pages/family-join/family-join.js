/**
 * 加入家庭组页面
 */

const FamilyService = require('../../../services/family');
const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    inviteCode: '',
    loading: false
  },

  async onLoad() {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
  },

  /**
   * 输入邀请码
   */
  onInputCode(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() });
  },

  /**
   * 加入家庭
   */
  async onJoin() {
    const { inviteCode } = this.data;

    if (!inviteCode.trim()) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const familyService = new FamilyService();
      const userInfo = StorageUtil.getUserInfo();

      if (!userInfo || !userInfo._id) {
        wx.showToast({ title: '用户信息未找到，请重新登录', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const family = await familyService.joinFamily(inviteCode.trim(), userInfo._id);

      // 保存家庭信息到本地
      StorageUtil.saveFamilyInfo(family);

      wx.showToast({
        title: '加入成功',
        icon: 'success'
      });

      // 跳转到宝宝创建页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/baby-create/baby-create?familyId=' + family._id
        });
      }, 1000);
    } catch (error) {
      console.error('加入家庭失败:', error);
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
