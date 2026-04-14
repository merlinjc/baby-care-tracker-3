// app.js
const AuthService = require('./services/auth');
const SyncService = require('./services/sync');
const StorageUtil = require('./utils/storage');
const ThemeManager = require('./utils/theme');

App({
  onLaunch: async function() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'neo3-7gtg0bdtc9fcc672', // CloudBase 环境 ID  
        traceUser: true,
      });
    }

    // 全局缓存 systemInfo，使用新 API 替代已废弃的 wx.getSystemInfoSync()
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      this.globalData.systemInfo = Object.assign({}, deviceInfo, windowInfo, appBaseInfo);
    } catch (e) {
      this.globalData.systemInfo = null;
    }

    // 初始化用户信息（将 Promise 存到 globalData 供页面等待）
    this.globalData.initPromise = this.initUser();
    
    // 初始化同步服务（不依赖 initUser）
    this.initSync();

    // 延迟清理孤立缓存（不阻塞启动）
    setTimeout(() => this.cleanOrphanedCache(), 5000);

    // 初始化主题管理器
    ThemeManager.init();
  },

  /**
   * 初始化用户信息
   * 微信小程序天然免登录，直接获取 openid 并创建用户记录
   */
  async initUser() {
    try {
      const authService = new AuthService();
      
      // 获取或创建用户信息
      const userInfo = await authService.getUserInfo();
      
      // 保存到全局数据和本地存储
      this.globalData.userInfo = userInfo;
      StorageUtil.saveUserInfo(userInfo);
      
      // 缓存 familyRole 到 globalData（供各页面快速读取）
      if (userInfo && userInfo.familyRole) {
        this.globalData.familyRole = userInfo.familyRole;
      }
      
      return userInfo;
    } catch (error) {
      console.error('用户初始化失败:', error);
      return null;
    }
  },
  
  /**
   * 初始化同步服务
   */
  initSync() {
    const syncService = SyncService.getInstance();
    
    // 检查是否有待同步的离线操作
    const syncStatus = syncService.getSyncStatus();
    
    if (syncStatus.hasPendingSync && syncStatus.isOnline) {
      syncService.syncOfflineQueue().then(result => {
        if (result.success > 0) {
          wx.showToast({
            title: `已同步 ${result.success} 条记录`,
            icon: 'success'
          });
        }
      }).catch(error => {
        console.error('离线队列同步失败:', error);
      });
    }
    
    // 保存同步服务到全局
    this.globalData.syncService = syncService;
  },
  
  /**
   * 清理孤立缓存
   * 移除不属于当前家庭宝宝列表的 records_xxx 缓存，防止缓存膨胀
   */
  cleanOrphanedCache() {
    try {
      const familyInfo = StorageUtil.getFamilyInfo();
      if (!familyInfo || !familyInfo.babies || familyInfo.babies.length === 0) return;

      const validBabyIds = new Set(familyInfo.babies);
      const res = wx.getStorageInfoSync();
      const keys = res.keys || [];

      keys.forEach(key => {
        if (key.startsWith('records_')) {
          const babyId = key.replace('records_', '');
          if (!validBabyIds.has(babyId)) {
            wx.removeStorageSync(key);
          }
        }
      });
    } catch (e) {
      // 清理失败不影响正常使用
    }
  },
  
  globalData: {
    version: 'v4.0.1',       // 当前版本号（Release 时同步更新）
    versionCodename: 'Milo',  // 当前版本代号
    userInfo: null,
    currentBaby: null,
    familyInfo: null,
    familyRole: null,    // 当前用户的家庭角色缓存
    systemInfo: null,    // 全局缓存 wx.getSystemInfoSync() 结果
    syncService: null,
    initPromise: null  // app.initUser() 的 Promise，页面可 await 等待
  }
}); 