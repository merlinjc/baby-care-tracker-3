/**
 * 设置页
 * 通知、提醒、主题等设置
 */

const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    themeMode: 'light',
    themeTransition: false,
    settings: {
      notification: true,
      feedingReminder: true,
      sleepReminder: true,
      diaperReminder: true,
      temperatureAlert: true,
      language: 'zh-CN'
    },
    aboutInfo: {
      version: '3.0.0',
      author: 'Baby Care Tracker Team'
    }
  },

  async onLoad() {
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    this.loadSettings();
    // 初始化主题状态
    this.setData({
      themeMode: ThemeManager.getTheme(),
      darkMode: ThemeManager.isDark()
    });
    // 监听主题变更（系统主题变化时）
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
  },

  onShow() {
    this._applyTheme();
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
  },

  /**
   * 应用当前主题
   */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  /**
   * 主题选择
   */
  onThemeSelect(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.themeMode) return;

    // 启用过渡动画
    this.setData({ themeTransition: true });
    
    setTimeout(() => {
      ThemeManager.setTheme(mode);
      this.setData({
        themeMode: mode,
        darkMode: ThemeManager.isDark()
      });
      // 300ms 后移除过渡 class
      setTimeout(() => this.setData({ themeTransition: false }), 350);
    }, 16);
  },

  /**
   * 加载设置
   */
  loadSettings() {
    const settings = StorageUtil.get('settings') || this.data.settings;
    // 移除旧的 darkMode 字段（已迁移到 ThemeManager）
    if (settings.darkMode !== undefined) {
      delete settings.darkMode;
      StorageUtil.save('settings', settings);
    }
    this.setData({ settings });
  },

  /**
   * 保存设置
   */
  saveSettings() {
    StorageUtil.save('settings', this.data.settings);
  },

  /**
   * 切换开关设置
   */
  toggleSetting(e) {
    const { key } = e.currentTarget.dataset;
    const settings = {
      ...this.data.settings,
      [key]: !this.data.settings[key]
    };
    this.setData({ settings });
    this.saveSettings();
  },

  /**
   * 清除缓存
   */
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？这不会删除云端数据。',
      success: (res) => {
        if (res.confirm) {
          try {
            // BUG-12: 清缓存前保存核心信息，清后恢复
            const userInfo = StorageUtil.getUserInfo();
            const currentBaby = StorageUtil.getCurrentBaby();
            const familyInfo = StorageUtil.getFamilyInfo();
            const themeMode = StorageUtil.get('app_theme_mode');
            
            // 清除本地缓存
            wx.clearStorageSync();
            
            // 恢复核心数据，保持应用可正常运行
            if (userInfo) StorageUtil.saveUserInfo(userInfo);
            if (currentBaby) StorageUtil.saveCurrentBaby(currentBaby);
            if (familyInfo) StorageUtil.saveFamilyInfo(familyInfo);
            if (themeMode) StorageUtil.save('app_theme_mode', themeMode);
            
            wx.showToast({ title: '清除成功', icon: 'success' });
            
            // 重新加载设置
            setTimeout(() => {
              this.loadSettings();
            }, 500);
          } catch (error) {
            console.error('清除缓存失败:', error);
            wx.showToast({ title: '清除失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 清除云端所有数据
   * ★ [v4.2 FR-14] 改为通过云函数 familyOperation/clearBabyData 执行，
   * 使用 admin SDK 可删除包括其他成员创建的记录
   */
  async clearAllCloudData() {
    const currentBaby = StorageUtil.getCurrentBaby();
    
    if (!currentBaby) {
      wx.showToast({ title: '未找到宝宝信息', icon: 'none' });
      return;
    }

    const res = await wx.showModal({
      title: '危险操作',
      content: '此操作将删除所有云端数据，包括：\n• 所有记录数据\n• 疫苗接种记录\n• 里程碑记录\n• 宝宝信息\n\n删除后无法恢复，确定继续吗？',
      confirmText: '确认删除',
      confirmColor: ThemeManager.getConfirmColor('danger'),
      cancelText: '取消'
    });

    if (!res.confirm) return;

    // 二次确认
    const confirm2 = await wx.showModal({
      title: '最后确认',
      content: `即将删除宝宝「${currentBaby.name}」的所有数据，此操作不可撤销！`,
      confirmText: '确定删除',
      confirmColor: ThemeManager.getConfirmColor('danger')
    });

    if (!confirm2.confirm) return;

    wx.showLoading({ title: '删除中...', mask: true });

    try {
      const babyId = currentBaby._id;
      const familyId = currentBaby.familyId;

      const callRes = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: {
          action: 'clearBabyData',
          params: { babyId, familyId }
        }
      });

      const result = callRes.result;
      if (!result.success) throw new Error(result.error?.message || '删除失败');

      // 清除本地缓存
      wx.clearStorageSync();

      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });

      // 根据云函数返回判断跳转目标
      setTimeout(() => {
        if (result.data && result.data.familyDeleted) {
          wx.reLaunch({ url: '/pages/auth/auth' });
        } else {
          wx.reLaunch({ url: '/pages/baby-create/baby-create' });
        }
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('清除云端数据失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 查看隐私政策
   */
  viewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '【Baby Care Tracker 隐私政策】\n\n'
        + '生效日期：2026年3月1日\n\n'
        + '一、信息收集\n'
        + '我们仅收集您主动提供的宝宝护理数据（喂养、睡眠、排便、体温、生长等记录），用于为您提供数据记录与分析服务。\n\n'
        + '二、数据存储\n'
        + '所有数据存储在腾讯云CloudBase加密数据库中，通过微信账号体系进行身份验证，仅您和您授权的家庭成员可访问。\n\n'
        + '三、信息安全\n'
        + '我们采用传输加密（HTTPS）和存储加密双重保护，不会主动向任何第三方出售、交换或提供您的个人信息。\n\n'
        + '四、第三方服务\n'
        + '本应用使用微信开放平台能力和腾讯云CloudBase服务，相关数据处理遵循微信和腾讯云的隐私保护标准。\n\n'
        + '五、数据删除\n'
        + '您可随时在"设置 > 清除云端数据"中永久删除所有云端数据，操作不可撤销。\n\n'
        + '六、未成年人保护\n'
        + '本应用记录的宝宝信息仅供监护人使用，我们高度重视未成年人隐私保护。\n\n'
        + '七、政策更新\n'
        + '如政策变更，我们将通过应用内通知告知。继续使用即视为同意更新后的政策。\n\n'
        + '联系方式：neo-chang@163.com',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 查看用户协议
   */
  viewTerms() {
    wx.showModal({
      title: '用户协议',
      content: '【Baby Care Tracker 用户服务协议】\n\n'
        + '生效日期：2026年3月1日\n\n'
        + '一、服务说明\n'
        + 'Baby Care Tracker 是一款面向家庭的宝宝护理记录工具，提供喂养、睡眠、排便、体温、生长数据记录与可视化分析功能。\n\n'
        + '二、账号与数据\n'
        + '本应用通过微信账号登录，您对账号下的所有操作和数据负责。家庭协作功能允许您邀请家人共同记录，请妥善管理邀请码。\n\n'
        + '三、使用规范\n'
        + '• 请如实记录数据，本应用提供的参考范围和建议仅供参考，不构成医疗建议\n'
        + '• 如宝宝出现健康异常，请及时就医咨询专业医生\n'
        + '• 不得利用本应用从事违法违规活动\n\n'
        + '四、免责声明\n'
        + '• 本应用提供的生长曲线、发育里程碑等参考数据来源于WHO等权威机构，但每个宝宝发育存在个体差异\n'
        + '• 我们不对因使用本应用数据做出的医疗决策承担责任\n'
        + '• 因网络、设备等不可控因素导致的数据延迟或丢失，我们将尽力但不保证完全恢复\n\n'
        + '五、知识产权\n'
        + '本应用的界面设计、图标、代码等知识产权归开发者所有。\n\n'
        + '六、协议修订\n'
        + '我们保留修订本协议的权利，修订后的协议将在应用内公布。\n\n'
        + '联系方式：neo-chang@163.com',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 反馈建议
   */
  giveFeedback() {
    wx.showActionSheet({
      itemList: ['发送邮件反馈', '复制联系邮箱'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.setClipboardData({
            data: 'neo-chang@163.com',
            success: () => {
              wx.showModal({
                title: '反馈建议',
                content: '邮箱地址已复制到剪贴板！\n\n'
                  + '请发送邮件至：neo-chang@163.com\n\n'
                  + '为了更快解决您的问题，建议包含以下信息：\n'
                  + '1. 问题描述或建议内容\n'
                  + '2. 操作步骤（如遇bug）\n'
                  + '3. 手机型号和微信版本\n'
                  + '4. 截图（如有）\n\n'
                  + '我们会尽快回复您，感谢您的宝贵意见！',
                showCancel: false,
                confirmText: '好的'
              });
            }
          });
        } else if (res.tapIndex === 1) {
          wx.setClipboardData({
            data: 'neo-chang@163.com',
            success: () => {
              wx.showToast({ title: '邮箱已复制', icon: 'success' });
            }
          });
        }
      }
    });
  }
});
