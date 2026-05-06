/**
 * 宝宝管理页
 * 宝宝列表、添加、切换、删除
 */

const StorageUtil = require('../../utils/storage');
const { ICONS } = require('../../utils/icon-config');
const ThemeManager = require('../../utils/theme');
const shareBehavior = require('../../behaviors/share-behavior');
const BabyService = require('../../services/baby');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    babies: [],
    currentBabyId: '',
    loading: true
  },

  async onLoad() {
    this._applyTheme();
    this._lastShowTime = 0;
    
    // [v4.1] 用户校验
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    this.loadBabies();
  },

  onShow() {
    this._applyTheme();
    // 30s 节流：避免频繁 tab 切换重复加载
    const now = Date.now();
    if (this._lastShowTime && now - this._lastShowTime < 30000) return;
    this._lastShowTime = now;
    this.loadBabies();
  },

  /**
   * 加载宝宝列表
   */
  async loadBabies() {
    try {
      const db = wx.cloud.database();
      const familyInfo = StorageUtil.getFamilyInfo();
      
      if (!familyInfo) {
        this.setData({ loading: false });
        return;
      }

      const res = await db.collection('babies')
        .where({
          familyId: familyInfo._id
        })
        .get();

      const currentBaby = StorageUtil.getCurrentBaby();
      const babies = res.data.map(baby => ({
        ...baby,
        ageText: this.calculateAge(baby.birthDate),
        genderIcon: baby.gender === 'male' ? ICONS.gender.boy : ICONS.gender.girl,
        isCurrent: currentBaby && currentBaby._id === baby._id
      }));

      this.setData({ 
        babies, 
        currentBabyId: currentBaby ? currentBaby._id : '',
        loading: false 
      });
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 计算年龄
   */
  calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    
    const years = today.getFullYear() - birth.getFullYear();
    const months = today.getMonth() - birth.getMonth();
    const days = today.getDate() - birth.getDate();
    
    let ageMonths = years * 12 + months;
    if (days < 0) ageMonths--;
    
    if (ageMonths >= 12) {
      return `${Math.floor(ageMonths / 12)}岁${ageMonths % 12}个月`;
    }
    return `${ageMonths}个月${days >= 0 ? days : 30 + days}天`;
  },

  /**
   * 添加宝宝
   */
  addBaby() {
    wx.navigateTo({ url: '/pages/baby-create/baby-create' });
  },

  /**
   * 选择宝宝
   */
  selectBaby(e) {
    const { id } = e.currentTarget.dataset;
    const baby = this.data.babies.find(b => b._id === id);
    
    if (baby) {
      StorageUtil.saveCurrentBaby(baby);
      
      // 更新列表状态（合并为一次 setData）
      const babies = this.data.babies.map(b => ({
        ...b,
        isCurrent: b._id === id
      }));
      this.setData({ currentBabyId: id, babies });
      
      wx.showToast({ title: '已切换宝宝', icon: 'success' });
    }
  },

  /**
   * 查看宝宝详情
   */
  viewBabyDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/packageGrowth/pages/baby-detail/baby-detail?id=${id}` });
  },

  /**
   * 删除宝宝
   */
  deleteBaby(e) {
    const { id, name } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除宝宝"${name}"吗？此操作不可恢复。`,
      confirmColor: ThemeManager.getConfirmColor('warn'),
      success: async (res) => {
        if (res.confirm) {
          try {
            // [v4.2] 通过 babyService 走云函数删除，同步维护 families.babies
            const babyService = BabyService.getInstance();
            const familyInfo = StorageUtil.getFamilyInfo();
            const deleteResult = await babyService.deleteBaby(id, familyInfo._id);

            // [v4.3.2 FR-3] 自动解散分支：admin 单人家庭删完最后 baby → 家庭自动解散
            // 此时需清空本地状态、重置服务单例、跳回登录页
            if (deleteResult && deleteResult.autoDissolved) {
              wx.showModal({
                title: '已删除最后一个宝宝',
                content: '家庭已自动解散，点击确定返回登录页重新创建或加入家庭。',
                showCancel: false,
                success: () => {
                  StorageUtil.clear();
                  const app = getApp();
                  if (app && typeof app.resetAllServices === 'function') {
                    // FR-A13 全局服务单例清理（M4 阶段实现）
                    try { app.resetAllServices(); } catch (_) { /* 静默 */ }
                  }
                  if (app && app.globalData) {
                    app.globalData.userInfo = null;
                    app.globalData.familyInfo = null;
                    app.globalData.familyRole = null;
                    app.globalData.currentBaby = null;
                  }
                  wx.reLaunch({ url: '/pages/auth/auth' });
                }
              });
              return;
            }

            // BUG-13: 如果删除的是当前宝宝，清理本地存储并切换
            const currentBaby = StorageUtil.getCurrentBaby();
            if (currentBaby && currentBaby._id === id) {
              StorageUtil.remove('current_baby');
              getApp && getApp().globalData && (getApp().globalData.currentBaby = null);
              
              // 尝试切换到其他宝宝
              const remainingBabies = this.data.babies.filter(b => b._id !== id);
              if (remainingBabies.length > 0) {
                StorageUtil.saveCurrentBaby(remainingBabies[0]);
                getApp && getApp().globalData && (getApp().globalData.currentBaby = remainingBabies[0]);
                wx.showToast({ title: '已切换到其他宝宝', icon: 'success' });
              } else {
                wx.showToast({ title: '删除成功', icon: 'success' });
              }
            } else {
              wx.showToast({ title: '删除成功', icon: 'success' });
            }
            
            this.loadBabies();
          } catch (error) {
            console.error('删除宝宝失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadBabies();
    wx.stopPullDownRefresh();
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
