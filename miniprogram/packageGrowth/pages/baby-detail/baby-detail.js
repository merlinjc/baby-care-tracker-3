/**
 * 宝宝详情页面
 */

const BabyService = require('../../../services/baby');
const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    baby: null,
    ageText: '',
    loading: false,
    uploading: false,
    showEditPopup: false
  },

  async onLoad(options) {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    // BUG-21: 缺少 id 参数时提示用户并返回
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.loadBaby(options.id);
  },

  /**
   * 加载宝宝信息
   *
   * [v4.3.1 Hotfix] getBabyById 改 where 查询后，不存在或无权限时返回 null（不再抛错）
   */
  async loadBaby(babyId) {
    try {
      const babyService = new BabyService();
      const baby = await babyService.getBabyById(babyId);

      // [v4.3.1 Hotfix] null 守卫：宝宝不存在或无访问权限
      if (!baby) {
        wx.showToast({ title: '宝宝不存在或无权限查看', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
        return;
      }

      // [v4.1] 校验宝宝归属当前家庭（Review R1-2）
      const userInfo = StorageUtil.getUserInfo();
      if (baby.familyId && userInfo?.familyId && baby.familyId !== userInfo.familyId) {
        wx.showToast({ title: '无权限查看', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
        return;
      }
      
      const ageText = babyService.formatAge(baby.birthDate);

      // 格式化出生日期为字符串
      const birthDateStr = this.formatBirthDate(baby.birthDate);

      this.setData({
        baby: {
          ...baby,
          birthDate: birthDateStr
        },
        ageText
      });
    } catch (error) {
      console.error('加载宝宝信息失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化出生日期
   * @param {Date|string|Object} birthDate 出生日期
   * @returns {string} 格式化后的日期字符串
   */
  formatBirthDate(birthDate) {
    let date;
    
    // 处理不同类型的日期数据
    if (birthDate instanceof Date) {
      date = birthDate;
    } else if (typeof birthDate === 'string') {
      date = new Date(birthDate);
    } else if (birthDate && typeof birthDate === 'object') {
      // 云数据库返回的 Date 对象格式
      date = new Date(birthDate);
    } else {
      return '未知';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },

  /**
   * 编辑宝宝信息
   */
  onEdit() {
    this.setData({ showEditPopup: true });
  },

  /**
   * 关闭编辑弹窗
   */
  closeEditPopup() {
    this.setData({ showEditPopup: false });
  },

  /**
   * 宝宝信息更新成功
   */
  onBabyUpdated(e) {
    const { name, birthDate, avatar } = e.detail;
    
    // 更新页面数据
    this.setData({
      'baby.name': name,
      'baby.birthDate': birthDate,
      'baby.avatar': avatar,
      ageText: this.formatAgeText(new Date(birthDate))
    });
  },

  /**
   * 格式化年龄文本
   */
  formatAgeText(birthDate) {
    const babyService = new BabyService();
    return babyService.formatAge(birthDate);
  },

  /**
   * 选择并上传头像
   */
  async onChooseAvatar() {
    if (this.data.uploading || !this.data.baby) {
      return;
    }

    try {
      // 选择图片
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      });

      const tempFilePath = res.tempFiles[0].tempFilePath;

      // 显示上传状态
      this.setData({ uploading: true });

      // 上传头像
      const babyService = new BabyService();
      const avatarUrl = await babyService.uploadAvatar(this.data.baby._id, tempFilePath);

      // 更新页面数据
      this.setData({
        'baby.avatar': avatarUrl,
        uploading: false
      });

      // 更新本地存储
      const currentBaby = StorageUtil.getCurrentBaby();
      if (currentBaby && currentBaby._id === this.data.baby._id) {
        currentBaby.avatar = avatarUrl;
        StorageUtil.saveCurrentBaby(currentBaby);
      }

      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('上传头像失败:', error);
      this.setData({ uploading: false });

      // 用户取消不提示错误
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 切换当前宝宝
   */
  async onSwitch() {
    if (this.data.baby) {
      StorageUtil.saveCurrentBaby(this.data.baby);
      wx.showToast({
        title: '切换成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }, 1000);
    }
  },

  /**
   * 分享宝宝档案
   */
  onShare() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
