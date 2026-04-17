/**
 * 发育里程碑页
 * 发育追踪、标记达成、时间窗口评估
 */

const StorageUtil = require('../../../utils/storage');
const { formatDate, calculateAgeMonths } = require('../../../utils/date');
const { MILESTONE_DEFINITIONS } = require('../../config/milestone-defs');
const { fetchAll } = require('../../../utils/db-helper');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    baby: null,
    babyAgeMonths: 0, // 宝宝实际月龄
    currentMonth: 6, // 当前查看的月份
    viewMode: 'current', // 'current' 当前月龄 | 'all' 全部里程碑
    milestones: [],
    focusMilestones: [], // 当前阶段需关注的里程碑
    overdueMilestones: [], // 逾期里程碑
    progress: { completed: 0, total: 0, overdue: 0 },
    loading: true,
    showDetailPopup: false,
    showStandardPopup: false,
    selectedMilestone: null,
    selectedIndexes: { cindex: 0, mindex: 0 },
    // 月份选项
    monthOptions: [
      { value: 'all', label: '全部' },
      { value: 0, label: '新生儿' },
      { value: 1, label: '1月' },
      { value: 2, label: '2月' },
      { value: 3, label: '3月' },
      { value: 4, label: '4月' },
      { value: 5, label: '5月' },
      { value: 6, label: '6月' },
      { value: 7, label: '7月' },
      { value: 8, label: '8月' },
      { value: 9, label: '9月' },
      { value: 10, label: '10月' },
      { value: 11, label: '11月' },
      { value: 12, label: '12月' }
    ]
  },

  async onLoad() {
    this._initialized = false;
    this._lastLoadTime = 0;
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    this._initPromise = this.initPage();
  },

  onShow() {
    this._applyTheme();
    if (!this._initPromise) return;
    this._initPromise.then(() => {
      const now = Date.now();
      if (now - this._lastLoadTime < 30000) return;
      this._lastLoadTime = now;
      this.loadMilestones();
    });
  },

  async initPage() {
    this.loadBabyInfo();
    await this.loadMilestones();
    this._initialized = true;
    this._lastLoadTime = Date.now();
  },

  loadBabyInfo() {
    const baby = StorageUtil.getCurrentBaby();
    if (baby) {
      const babyAgeMonths = this.calculateAgeMonths(baby.birthDate);
      this.setData({ 
        baby, 
        babyAgeMonths,
        currentMonth: babyAgeMonths, // 默认显示当前月龄
        viewMode: 'current'
      });
    }
  },

  calculateAgeMonths(birthDate) {
    return calculateAgeMonths(birthDate, 12);
  },

  async loadMilestones() {
    try {
      const db = wx.cloud.database();
      const baby = this.data.baby;
      
      if (!baby) {
        this.setData({ loading: false });
        return;
      }

      // 使用配置文件中的里程碑定义
      const definitions = MILESTONE_DEFINITIONS;
      // 使用 fetchAll 突破 20 条限制，修复 P0 数据截断
      // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
      const records = await fetchAll(
        db.collection('milestone_records').where({ babyId: baby._id, familyId: baby.familyId || '' })
      );

      const milestones = this.mergeMilestones(definitions, records);
      const progress = this.calculateProgress(milestones);

      this.setData({ 
        milestones, 
        progress,
        loading: false 
      });
    } catch (error) {
      console.error('加载里程碑失败:', error);
      this.setData({ loading: false });
    }
  },


  mergeMilestones(definitions, records) {
    const babyAgeMonths = this.data.babyAgeMonths; // 宝宝实际月龄
    const { viewMode, currentMonth } = this.data;
    const focusMilestones = [];
    const overdueMilestones = [];
    
    const milestones = definitions.map((def, cindex) => {
      const items = def.items.map((item, mindex) => {
        const record = records.find(r => r.name === item.name);
        const achieved = !!record;
        
        const windowParts = item.whoWindow.split('-');
        const minMonth = parseFloat(windowParts[0]);
        const maxMonth = parseFloat(windowParts[1].replace('月', ''));
        
        // 使用宝宝实际月龄判断逾期和窗口
        const isOverdue = !achieved && item.warningMonths && babyAgeMonths > item.warningMonths;
        const inWindow = babyAgeMonths >= minMonth && babyAgeMonths <= maxMonth;
        
        // 判断是否应该在列表中显示
        let shouldShow = false;
        if (viewMode === 'all') {
          // 全部模式：显示所有
          shouldShow = true;
        } else {
          // 按月份筛选模式
          const viewMonth = typeof currentMonth === 'number' ? currentMonth : babyAgeMonths;
          // 显示条件：在时间窗口内 或 已达成 或 已逾期
          const inViewWindow = viewMonth >= minMonth && viewMonth <= maxMonth;
          shouldShow = inViewWindow || achieved || isOverdue;
        }
        
        const result = {
          ...item,
          achieved,
          achievedDate: record ? formatDate(record.achievedDate) : null,
          achievedRecord: record || null,
          isOverdue,
          inWindow,
          minMonth,
          maxMonth,
          shouldShow,
          status: achieved ? 'achieved' : (isOverdue ? 'overdue' : (inWindow ? 'active' : 'pending')),
          categoryName: def.category,
          cindex,
          mindex
        };
        
        // 收集逾期里程碑（基于宝宝实际月龄，仅在当前月龄视图时显示）
        if (isOverdue && viewMode === 'current') {
          overdueMilestones.push(result);
        }
        // 收集当前阶段的里程碑（未达成且在窗口内）
        else if (inWindow && !achieved && viewMode === 'current') {
          focusMilestones.push(result);
        }
        
        return result;
      });
      
      // 筛选后显示的项目
      const filteredItems = items.filter(i => i.shouldShow);
      const completedCount = items.filter(i => i.achieved).length;
      
      return {
        ...def,
        items,
        filteredItems,
        completedCount,
        filteredCount: filteredItems.length
      };
    });

    // 按时间窗口排序逾期里程碑（越早逾期的排越前面）
    overdueMilestones.sort((a, b) => {
      const aMin = parseFloat(a.whoWindow.split('-')[0]);
      const bMin = parseFloat(b.whoWindow.split('-')[0]);
      return aMin - bMin;
    });

    // 限制显示数量
    const displayFocusMilestones = focusMilestones.slice(0, 5);
    const displayOverdueMilestones = overdueMilestones.slice(0, 5);

    this.setData({ 
      focusMilestones: displayFocusMilestones,
      overdueMilestones: displayOverdueMilestones
    });

    return milestones;
  },

  calculateProgress(milestones) {
    const { viewMode } = this.data;
    let completed = 0, total = 0, overdue = 0;
    
    milestones.forEach(category => {
      const items = viewMode === 'all' ? category.items : category.filteredItems;
      items.forEach(item => {
        total++;
        if (item.achieved) completed++;
        if (item.isOverdue) overdue++;
      });
    });
    
    // 预计算进度百分比（减少 WXML 层表达式）
    const percent = total > 0 ? Math.round(completed / total * 100) : 0;
    
    return { completed, total, overdue, percent };
  },

  /**
   * 切换视图模式
   */
  onViewModeChange(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === 'all') {
      this.setData({ viewMode: 'all', currentMonth: 'all' });
    } else {
      this.setData({ 
        viewMode: 'current', 
        currentMonth: this.data.babyAgeMonths 
      });
    }
    this.updateFilteredMilestones();
  },

  /**
   * 选择具体月份
   */
  onMonthSelect(e) {
    const { month } = e.currentTarget.dataset;
    if (month === 'all') {
      this.setData({ viewMode: 'all', currentMonth: 'all' });
    } else {
      this.setData({ viewMode: 'month', currentMonth: month });
    }
    this.updateFilteredMilestones();
  },

  /**
   * 回到宝宝当前月龄
   */
  goToCurrentAge() {
    this.setData({ 
      viewMode: 'current', 
      currentMonth: this.data.babyAgeMonths 
    });
    this.updateFilteredMilestones();
  },

  /**
   * 月份加减切换（保留旧接口兼容）
   */
  onMonthChange(e) {
    const { delta } = e.currentTarget.dataset;
    const currentMonth = this.data.currentMonth;
    
    // 如果当前是"全部"视图，从宝宝当前月龄开始
    if (currentMonth === 'all') {
      const startMonth = Math.max(0, Math.min(12, this.data.babyAgeMonths + delta));
      this.setData({ viewMode: 'month', currentMonth: startMonth });
    } else {
      const newMonth = Math.max(0, Math.min(12, currentMonth + delta));
      this.setData({ viewMode: 'month', currentMonth: newMonth });
    }
    this.updateFilteredMilestones();
  },

  /**
   * 更新筛选后的里程碑列表
   */
  updateFilteredMilestones() {
    const { milestones, viewMode, currentMonth, babyAgeMonths } = this.data;
    
    const updatedMilestones = milestones.map(category => {
      const filteredItems = category.items.filter(item => {
        if (viewMode === 'all') return true;
        
        const viewMonth = typeof currentMonth === 'number' ? currentMonth : babyAgeMonths;
        const inViewWindow = viewMonth >= item.minMonth && viewMonth <= item.maxMonth;
        return inViewWindow || item.achieved || item.isOverdue;
      });
      
      return {
        ...category,
        filteredItems,
        filteredCount: filteredItems.length
      };
    });
    
    const progress = this.calculateProgress(updatedMilestones);
    this.setData({ milestones: updatedMilestones, progress });
  },

  /**
   * 快速标记达成（列表页直接操作）
   */
  async quickAchieve(e) {
    const { cindex, mindex } = e.currentTarget.dataset;
    const milestone = this.data.milestones[cindex].items[mindex];
    await this._toggleAchievement(milestone, { closePopup: false });
  },

  showMilestoneDetail(e) {
    const { cindex, mindex } = e.currentTarget.dataset;
    // mindex 现在是原始索引，直接从 items 中获取
    const milestone = this.data.milestones[cindex].items[mindex];
    
    this.setData({
      showDetailPopup: true,
      selectedMilestone: milestone,
      selectedIndexes: { cindex, mindex }
    });
  },

  hideDetailPopup() {
    this.setData({ showDetailPopup: false });
  },

  showStandardInfo() {
    this.setData({ showStandardPopup: true });
  },

  hideStandardPopup() {
    this.setData({ showStandardPopup: false });
  },

  /**
   * 详情弹窗中切换达成状态
   */
  async toggleAchieved() {
    const { selectedMilestone } = this.data;
    await this._toggleAchievement(selectedMilestone, { closePopup: true });
  },

  /**
   * 统一的里程碑达成/取消逻辑
   * @param {Object} milestone 里程碑对象
   * @param {Object} options 选项
   * @param {boolean} options.closePopup 操作后是否关闭详情弹窗
   */
  async _toggleAchievement(milestone, { closePopup = false } = {}) {
    if (milestone.achieved) {
      // 已达成，确认取消
      const res = await wx.showModal({
        title: '取消达成',
        content: `确定要取消"${milestone.name}"的达成记录吗？`,
        confirmColor: ThemeManager.getConfirmColor('danger')
      });
      
      if (!res.confirm) return;
      
      try {
        wx.showLoading({ title: '处理中...' });
        
        const db = wx.cloud.database();
        await db.collection('milestone_records')
          .doc(milestone.achievedRecord._id)
          .remove();
        
        wx.hideLoading();
        wx.showToast({ title: '已取消', icon: 'success' });
        
        if (closePopup) this.setData({ showDetailPopup: false });
        this.loadMilestones();
        
      } catch (error) {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    } else {
      // 未达成，确认标记
      const res = await wx.showModal({
        title: '标记达成',
        content: `恭喜宝宝达成"${milestone.name}"里程碑！`,
        confirmText: '确认达成'
      });
      
      if (!res.confirm) return;
      
      try {
        wx.showLoading({ title: '保存中...' });
        
        const db = wx.cloud.database();
        const baby = this.data.baby;
        
        await db.collection('milestone_records').add({
          data: {
            babyId: baby._id,
            familyId: baby.familyId,
            name: milestone.name,
            category: milestone.categoryName,
            achievedDate: new Date(),
            createdAt: new Date()
          }
        });
        
        wx.hideLoading();
        wx.showToast({ title: '恭喜达成！', icon: 'success' });
        
        if (closePopup) this.setData({ showDetailPopup: false });
        this.loadMilestones();
        
      } catch (error) {
        wx.hideLoading();
        wx.showToast({ title: '标记失败', icon: 'none' });
      }
    }
  },

  async onPullDownRefresh() {
    await this.loadMilestones();
    wx.stopPullDownRefresh();
  },

  /** 应用当前主题 */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
