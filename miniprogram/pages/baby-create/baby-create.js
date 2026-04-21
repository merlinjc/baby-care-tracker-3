/**
 * 创建宝宝档案页面
 */

const BabyService = require('../../services/baby');
const FamilyService = require('../../services/family');
const AuthService = require('../../services/auth');
const StorageUtil = require('../../utils/storage');
const ThemeManager = require('../../utils/theme');
const shareBehavior = require('../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    familyId: '',
    name: '',
    gender: 'male',
    birthDate: '',
    currentDate: '', // 当前日期字符串，用于 picker 的 end 属性
    loading: false,
    creatingFamily: false // 是否正在自动创建家庭
  },

  async onLoad(options) {
    // 应用主题
    this._applyTheme();

    // [v4.1] 用户有效性验证
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }

    // 设置当前日期
    const today = new Date();
    const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    this.setData({ currentDate });

    if (options.familyId) {
      this.setData({ familyId: options.familyId });
    } else {
      // 从本地存储获取家庭信息
      const familyInfo = StorageUtil.getFamilyInfo();
      if (familyInfo) {
        this.setData({ familyId: familyInfo._id });
      } else {
        // 没有家庭信息，自动创建一个默认家庭
        await this.createDefaultFamily();
      }
    }
  },

  /**
   * 自动创建默认家庭
   */
  async createDefaultFamily() {
    this.setData({ creatingFamily: true, loading: true });
    
    try {
      const familyService = FamilyService.getInstance();
      const userInfo = StorageUtil.getUserInfo();
      
      if (!userInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/auth/auth'
          });
        }, 1500);
        return;
      }

      // 创建默认家庭
      const family = await familyService.createFamily({
        name: `${userInfo.nickname || '用户'}的家庭`,
        creatorId: userInfo._id,
        creatorName: userInfo.nickname || '用户'
      });

      // 更新用户信息，关联家庭
      const authService = AuthService.getInstance();
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
      StorageUtil.saveFamilyInfo(family);
      getApp().globalData.userInfo = newUserInfo;
      getApp().globalData.familyInfo = family;

      this.setData({ 
        familyId: family._id,
        creatingFamily: false,
        loading: false
      });
    } catch (error) {
      console.error('创建默认家庭失败:', error);
      wx.showToast({
        title: '初始化失败，请重试',
        icon: 'none'
      });
      this.setData({ creatingFamily: false, loading: false });
      
      // 跳转回首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }, 1500);
    }
  },

  /**
   * 输入宝宝姓名
   */
  onInputName(e) {
    this.setData({ name: e.detail.value });
  },

  /**
   * 选择性别
   */
  onGenderChange(e) {
    this.setData({ gender: e.detail.value });
  },

  /**
   * 选择出生日期
   */
  onDateChange(e) {
    this.setData({
      birthDate: e.detail.value
    });
  },

  /**
   * 创建宝宝档案
   */
  async onCreate() {
    const { familyId, name, gender, birthDate } = this.data;

    // 验证表单
    if (!name.trim()) {
      wx.showToast({
        title: '请输入宝宝姓名',
        icon: 'none'
      });
      return;
    }

    if (!birthDate) {
      wx.showToast({
        title: '请选择出生日期',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const babyService = BabyService.getInstance();
      
      const baby = await babyService.createBaby(
        familyId,
        name.trim(),
        gender,
        new Date(birthDate)
      );

      // 保存当前宝宝到本地
      StorageUtil.saveCurrentBaby(baby);

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }, 1000);
    } catch (error) {
      console.error('创建宝宝档案失败:', error);
      wx.showToast({
        title: '创建失败',
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
