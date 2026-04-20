/**
 * 网络监测工具
 * 检测网络状态，管理离线/在线切换
 */

class NetworkUtil {
  constructor() {
    this.isOnline = true; // 默认在线，避免异步初始化期间的误判
    this.listeners = [];
    this.init();
  }

  /**
   * 初始化网络监听
   */
  init() {
    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none';
      }
    });

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      const wasOnline = this.isOnline;
      this.isOnline = res.isConnected;

      // 网络状态变化时通知监听器
      if (wasOnline !== this.isOnline) {
        this.notifyListeners(this.isOnline);
      }
    });
  }

  /**
   * 获取当前网络状态
   * @returns {Promise<boolean>} 是否在线
   */
  async getNetworkStatus() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve(res.networkType !== 'none');
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  }

  /**
   * 检查是否在线
   * @returns {boolean} 是否在线
   */
  checkOnline() {
    return this.isOnline;
  }

  /**
   * 添加网络状态监听器
   * @param {Function} listener 监听函数
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * 移除网络状态监听器
   * @param {Function} listener 监听函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   * @param {boolean} isOnline 是否在线
   */
  notifyListeners(isOnline) {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('网络监听器执行错误:', error);
      }
    });
  }

  /**
   * 显示网络状态提示
   * @param {boolean} isOnline 是否在线
   */
  showNetworkToast(isOnline) {
    if (!isOnline) {
      wx.showToast({
        title: '网络已断开，数据将保存到本地',
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '网络已恢复，正在同步数据',
        icon: 'success',
        duration: 2000
      });
    }
  }
}

// 单例模式（v4.3.0 FR-2：与其他 util 单例模式统一）
// 调用方：NetworkUtil.getInstance().checkOnline()
let instance = null;

NetworkUtil.getInstance = function () {
  if (!instance) instance = new NetworkUtil();
  return instance;
};

module.exports = NetworkUtil;
