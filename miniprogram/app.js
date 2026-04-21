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

    // [v4.3.0 FR-6] 孤立缓存清理改为等待 initUser 完成后再执行
    // 避免 setTimeout 固定 5s 过早触发时 familyInfo 尚未就绪，误删正在使用的宝宝缓存
    this.globalData.initPromise
      .then(() => this.cleanOrphanedCache())
      .catch((err) => {
        console.warn('[cleanOrphanedCache] 跳过（initUser 未完成）:', err);
      });

    // 初始化主题管理器
    ThemeManager.init();
  },

  /**
   * 初始化用户信息
   * 微信小程序天然免登录，直接获取 openid 并创建用户记录
   */
  async initUser() {
    try {
      // [v4.3.1 FR-16] 统一单例：从 new AuthService() 改为 getInstance()
      const authService = AuthService.getInstance();
      
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

  /**
   * [v4.1] 统一用户就绪检查（含缓存穿透机制）
   * 各页面 init() 中调用，返回校验结果
   * 
   * @returns {Object} { ready, userInfo, familyInfo, redirectUrl, reason }
   */
  async ensureUserReady() {
    // 1. 等待 initUser 完成
    if (this.globalData.initPromise) {
      await this.globalData.initPromise;
    }
    
    // 2. 获取用户信息
    const userInfo = StorageUtil.getUserInfo();
    if (!userInfo || !userInfo._id || !userInfo.nickname) {
      return { ready: false, redirectUrl: '/pages/auth/auth' };
    }
    
    // 3. 检查家庭信息
    if (!userInfo.familyId) {
      return { ready: false, redirectUrl: '/pages/auth/auth' };
    }
    
    // 4. 获取 familyInfo（含缓存穿透）
    let familyInfo = StorageUtil.getFamilyInfo();
    const lastFetchTs = StorageUtil.get('_family_fetch_ts') || 0;
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 分钟
    const needsRefresh = !familyInfo 
      || familyInfo._id !== userInfo.familyId 
      || (Date.now() - lastFetchTs > REFRESH_INTERVAL);
    
    if (needsRefresh) {
      try {
        // D-1: 使用 getInstance 避免重复实例化
        const FamilyService = require('./services/family');
        const familyService = FamilyService.getInstance();
        const freshFamily = await familyService.getFamilyDetail(userInfo.familyId);
        
        if (freshFamily) {
          familyInfo = freshFamily;
          StorageUtil.saveFamilyInfo(freshFamily);
          StorageUtil.set('_family_fetch_ts', Date.now());
        } else {
          // 家庭已被解散
          this._clearFamilyData(userInfo);
          return { ready: false, redirectUrl: '/pages/auth/auth', reason: 'family_dissolved' };
        }
      } catch (err) {
        // 网络失败：如果有缓存就降级使用，没缓存则报错
        if (!familyInfo) {
          return { ready: false, redirectUrl: '/pages/auth/auth', reason: 'network_error' };
        }
        // 有缓存，降级使用（不阻断使用）
      }
    }
    
    if (!familyInfo) {
      return { ready: false, redirectUrl: '/pages/auth/auth' };
    }
    
    // 5. 验证用户仍在家庭成员中
    if (!familyInfo.members || !familyInfo.members.includes(userInfo._id)) {
      this._clearFamilyData(userInfo);
      return { ready: false, redirectUrl: '/pages/auth/auth', reason: 'removed' };
    }
    
    return { ready: true, userInfo, familyInfo };
  },

  /**
   * [v4.1] onShow 轻量校验（FR-5.6）
   * TabBar 页面 onShow 中调用，仅检查缓存时效性
   * 不发起网络请求，仅返回缓存是否过期
   * 
   * @returns {boolean} 是否需要强制重新 init
   */
  checkFamilyStale() {
    const userInfo = StorageUtil.getUserInfo();
    if (!userInfo || !userInfo.familyId) return true;
    
    const familyInfo = StorageUtil.getFamilyInfo();
    if (!familyInfo) return true;
    
    // 检查缓存时效
    const lastFetchTs = StorageUtil.get('_family_fetch_ts') || 0;
    const REFRESH_INTERVAL = 5 * 60 * 1000;
    return (Date.now() - lastFetchTs > REFRESH_INTERVAL);
  },

  /**
   * [v4.1] 清除家庭相关本地数据
   * @private
   */
  _clearFamilyData(userInfo) {
    StorageUtil.saveFamilyInfo(null);
    StorageUtil.saveCurrentBaby(null);
    StorageUtil.remove('_family_fetch_ts');
    const updated = { ...userInfo };
    delete updated.familyId;
    delete updated.familyRole;
    StorageUtil.saveUserInfo(updated);
    // D-3: 同步到 globalData
    this.globalData.userInfo = updated;
    this.globalData.familyInfo = null;
    this.globalData.currentBaby = null;
  },
  
  globalData: {
    version: 'v4.3.2',       // 当前版本号（Release 时同步更新）
    versionCodename: 'Milo',  // 当前版本代号
    userInfo: null,
    currentBaby: null,
    familyInfo: null,
    familyRole: null,    // 当前用户的家庭角色缓存
    systemInfo: null,    // 全局缓存 wx.getSystemInfoSync() 结果
    syncService: null,
    initPromise: null,  // app.initUser() 的 Promise，页面可 await 等待
    // [v4.3.2 FR-1] 灰度 fallback 开关：控制 getFamilyDetail 是否降级直连
    featureFlags: {
      directReadFamilyFallback: true  // T-7~T0 开启，T+7 关闭，T+14 移除代码
    }
  },

  /**
   * [v4.3.2 FR-A13] 重置所有 Service 单例 + globalData
   * 用于退出登录、家庭解散后清理，防止旧单例持有过期状态
   */
  resetAllServices() {
    try {
      const AuthService = require('./services/auth');
      const FamilyService = require('./services/family');
      const RecordService = require('./services/record');
      const BabyService = require('./services/baby');
      const SyncService = require('./services/sync');
      const QuotaService = require('./services/quota');
      const TodoService = require('./services/todo');
      const AIService = require('./services/ai');
      const TrendService = require('./services/trendService');

      AuthService.resetInstance();
      FamilyService.resetInstance();
      RecordService.resetInstance();
      BabyService.resetInstance();
      SyncService.resetInstance();
      QuotaService.resetInstance();
      TodoService.resetInstance();
      AIService.resetInstance();
      TrendService.resetInstance();
    } catch (e) {
      console.warn('[resetAllServices] Service 重置异常:', e);
    }

    this.globalData.userInfo = null;
    this.globalData.familyInfo = null;
    this.globalData.familyRole = null;
    this.globalData.currentBaby = null;
    this.globalData.syncService = null;
  }
}); 