/**
 * 创建家庭组页面
 */

const FamilyService = require('../../../services/family');
const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    familyName: '',
    loading: false
  },

  onLoad() {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
  },

  /**
   * 输入家庭名称
   */
  onInputName(e) {
    this.setData({ familyName: e.detail.value });
  },

  /**
   * 创建家庭组
   */
  async onCreate() {
    const { familyName } = this.data;

    if (!familyName.trim()) {
      wx.showToast({
        title: '请输入家庭名称',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const familyService = FamilyService.getInstance();
      const userInfo = StorageUtil.getUserInfo();

      if (!userInfo || !userInfo._id) {
        wx.showToast({ title: '用户信息未找到，请重新登录', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const family = await familyService.createFamily({
        name: familyName.trim(),
        creatorId: userInfo._id,
        creatorName: userInfo.nickname || userInfo.nickName || '家长'
      });

      // 保存家庭信息到本地
      StorageUtil.saveFamilyInfo(family);

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });

      // 跳转到宝宝创建页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/baby-create/baby-create?familyId=' + family._id
        });
      }, 1000);
    } catch (error) {
      console.error('创建家庭失败:', error);
      wx.showToast({
        title: error.message || '创建失败',
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
