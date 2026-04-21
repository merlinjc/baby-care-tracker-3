/**
 * 疫苗接种追踪页
 * 接种计划、记录、提醒
 */

const StorageUtil = require('../../../utils/storage');
const { formatDate, calculateAgeMonths } = require('../../../utils/date');
const { getVaccinePlans } = require('../../config/vaccine-plans');
const { fetchAll } = require('../../../utils/db-helper');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');
const FamilyContext = require('../../../utils/family-context');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    baby: null,
    filterStatus: 'all',
    vaccineList: [],
    todoVaccines: [], // 待办疫苗列表
    loading: true,
    stats: { total: 0, done: 0, pending: 0, overdue: 0 },
    filteredTotal: 0,
    showDetailPopup: false,
    showDatePopup: false,
    selectedVaccine: null,
    selectedIndexes: { index: 0, vindex: 0 },
    pickerValue: [0, 0, 0],
    years: [],
    months: [],
    days: []
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
      this.loadVaccineList();
    });
  },

  async initPage() {
    this.initPickerData();
    this.loadBabyInfo();
    await this.loadVaccineList();
    this._initialized = true;
    this._lastLoadTime = Date.now();
  },

  /**
   * 初始化日期选择器数据
   */
  initPickerData() {
    const now = new Date();
    const years = [];
    const months = [];
    const days = [];
    
    for (let i = now.getFullYear() - 1; i <= now.getFullYear() + 1; i++) {
      years.push(i);
    }
    for (let i = 1; i <= 12; i++) {
      months.push(i);
    }
    for (let i = 1; i <= 31; i++) {
      days.push(i);
    }
    
    this.setData({
      years,
      months,
      days,
      pickerValue: [1, now.getMonth(), now.getDate() - 1]
    });
  },

  /**
   * 加载宝宝信息
   */
  loadBabyInfo() {
    const baby = StorageUtil.getCurrentBaby();
    this.setData({ baby });
  },

  /**
   * 加载疫苗列表
   */
  async loadVaccineList() {
    try {
      const db = wx.cloud.database();
      const baby = this.data.baby;
      
      if (!baby) {
        this.setData({ loading: false });
        return;
      }

      // 获取疫苗计划（使用配置文件）
      const plans = getVaccinePlans(baby.birthDate);
      
      // 获取已接种记录（使用 fetchAll 突破 20 条限制，修复 P0 数据截断）
      // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
      const records = await fetchAll(
        db.collection('vaccine_records').where({ babyId: baby._id, familyId: FamilyContext.resolveForBaby(baby) })
      );

      // 合并计划和记录
      const { vaccineList, todoVaccines } = this.mergePlansWithRecords(plans, records);
      
      // 计算统计
      const stats = this.calculateStats(vaccineList);
      
      // 计算筛选后的总数
      const filteredTotal = this.calculateFilteredTotal(vaccineList);
      
      this.setData({ vaccineList, todoVaccines, stats, filteredTotal, loading: false });
    } catch (error) {
      console.error('加载疫苗列表失败:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 合并计划和记录
   */
  mergePlansWithRecords(plans, records) {
    const today = new Date();
    const baby = this.data.baby;
    
    // 计算宝宝当前月龄
    const currentMonthAge = calculateAgeMonths(baby.birthDate);
    
    const vaccineList = plans.map(plan => ({
      ...plan,
      vaccines: plan.vaccines.map((vaccine, vindex) => {
        const record = records.find(r => r.name === vaccine.name && r.dose === vaccine.dose);
        const status = this.getVaccineStatus(vaccine.plannedDate, record, today);
        
        // 格式化接种日期
        let formattedRecord = null;
        if (record) {
          formattedRecord = {
              ...record,
              vaccinatedDate: formatDate(record.vaccinatedDate)
            };
          }
          
          return {
            ...vaccine,
            _origIndex: vindex,
            status,
            record: formattedRecord,
            plannedDateText: formatDate(vaccine.plannedDate),
          ageText: plan.age
        };
      })
    })).map(plan => {
      const filteredVaccines = plan.vaccines.filter(v => 
        this.data.filterStatus === 'all' || v.status === this.data.filterStatus
      );
      return {
        ...plan,
        filteredVaccines,
        filteredCount: filteredVaccines.length
      };
    });

    // 提取待办疫苗（待接种和已逾期的，最多显示5个）
    // 只统计月龄已到达的疫苗
    const todoVaccines = [];
    vaccineList.forEach((plan, index) => {
      // 只处理月龄已到达的疫苗计划
      if (plan.monthAge <= currentMonthAge) {
        plan.vaccines.forEach((vaccine, vindex) => {
          if (vaccine.status === 'pending' || vaccine.status === 'overdue') {
            const overdueDays = vaccine.status === 'overdue' 
              ? Math.floor((today - vaccine.plannedDate) / (1000 * 60 * 60 * 24))
              : 0;
            todoVaccines.push({
              ...vaccine,
              index,
              vindex,
              isOverdue: vaccine.status === 'overdue',
              overdueDays
            });
          }
        });
      }
    });

    // 按状态和时间排序：逾期的排前面，然后按计划日期排序
    todoVaccines.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.plannedDate) - new Date(b.plannedDate);
    });

    // 只保留前5个
    const displayTodoVaccines = todoVaccines.slice(0, 5);

    // 返回 vaccineList 和 todoVaccines，由调用方统一 setData
    return { vaccineList, todoVaccines: displayTodoVaccines };
  },

  /**
   * 获取疫苗状态
   */
  getVaccineStatus(plannedDate, record, today) {
    if (record) return 'done';
    if (plannedDate < today) return 'overdue';
    return 'pending';
  },

  /**
   * 计算统计
   */
  calculateStats(vaccineList) {
    let total = 0, done = 0, pending = 0, overdue = 0;
    
    vaccineList.forEach(plan => {
      plan.vaccines.forEach(v => {
        total++;
        if (v.status === 'done') done++;
        else if (v.status === 'overdue') overdue++;
        else pending++;
      });
    });
    
    return { total, done, pending, overdue };
  },

  /**
   * 计算筛选后总数（利用预计算的 filteredCount）
   */
  calculateFilteredTotal(vaccineList) {
    let count = 0;
    vaccineList.forEach(plan => {
      count += plan.filteredCount;
    });
    return count;
  },

  /**
   * 筛选状态切换
   */
  onFilterChange(e) {
    const { status } = e.currentTarget.dataset;
    
    // 预计算筛选结果，合并为一次 setData（消除 callback 双 setData）
    const vaccineList = this.data.vaccineList.map(plan => {
      const filteredVaccines = plan.vaccines.filter(v => 
        status === 'all' || v.status === status
      );
      return {
        ...plan,
        filteredVaccines,
        filteredCount: filteredVaccines.length
      };
    });
    
    let filteredTotal = 0;
    vaccineList.forEach(plan => {
      plan.vaccines.forEach(v => {
        if (status === 'all' || v.status === status) {
          filteredTotal++;
        }
      });
    });
    
    this.setData({ filterStatus: status, filteredTotal, vaccineList });
  },

  /**
   * 快速接种
   */
  async quickVaccinate(e) {
    const { index, vindex } = e.currentTarget.dataset;
    const vaccine = this.data.vaccineList[index].vaccines[vindex];
    
    // 直接用今天日期确认接种
    const res = await wx.showModal({
      title: '确认接种',
      content: `确认已接种 ${vaccine.name} ${vaccine.dose}？`,
      confirmText: '确认接种'
    });
    
    if (!res.confirm) return;
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const db = wx.cloud.database();
      const baby = this.data.baby;
      
      await db.collection('vaccine_records').add({
        data: {
          babyId: baby._id,
          familyId: baby.familyId,
          name: vaccine.name,
          dose: vaccine.dose,
          vaccinatedDate: new Date(),
          createdAt: new Date()
        }
      });
      
      wx.hideLoading();
      wx.showToast({ title: '接种成功', icon: 'success' });
      
      this.loadVaccineList();
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存接种记录失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /**
   * 显示疫苗详情
   */
  showVaccineDetail(e) {
    const { index, vindex } = e.currentTarget.dataset;
    const vaccine = this.data.vaccineList[index].vaccines[vindex];
    
    this.setData({
      showDetailPopup: true,
      selectedVaccine: vaccine,
      selectedIndexes: { index, vindex }
    });
  },

  hideDetailPopup() {
    this.setData({ showDetailPopup: false });
  },

  /**
   * 显示疫苗信息
   */
  showVaccineInfo() {
    wx.showModal({
      title: '数据来源',
      content: '本疫苗接种计划依据中国疾病预防控制中心《国家免疫规划疫苗儿童免疫程序（2025年版）》制定，部分二类疫苗为推荐接种，具体以当地疾控中心为准。',
      showCancel: false
    });
  },

  /**
   * 疫苗操作
   */
  onVaccineAction() {
    const { selectedVaccine, selectedIndexes } = this.data;
    
    if (selectedVaccine.status === 'done') {
      // 已接种，允许修改日期
      const date = new Date(selectedVaccine.record.vaccinatedDate);
      this.setData({
        showDetailPopup: false,
        showDatePopup: true,
        pickerValue: [
          this.data.years.indexOf(date.getFullYear()),
          date.getMonth(),
          date.getDate() - 1
        ]
      });
    } else {
      // 未接种，显示日期选择
      const now = new Date();
      this.setData({
        showDetailPopup: false,
        showDatePopup: true,
        pickerValue: [1, now.getMonth(), now.getDate() - 1]
      });
    }
  },

  hideDatePopup() {
    this.setData({ showDatePopup: false });
  },

  onPickerChange(e) {
    this.setData({ pickerValue: e.detail.value });
  },

  /**
   * 确认接种
   */
  async confirmVaccinate() {
    const { pickerValue, years, months, days, selectedVaccine, selectedIndexes, baby } = this.data;
    
    const vaccinatedDate = new Date(
      years[pickerValue[0]],
      months[pickerValue[1]] - 1,
      days[pickerValue[2]]
    );
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const db = wx.cloud.database();
      
      if (selectedVaccine.status === 'done' && selectedVaccine.record) {
        // 更新记录
        await db.collection('vaccine_records')
          .doc(selectedVaccine.record._id)
          .update({
            data: {
              vaccinatedDate,
              updatedAt: new Date()
            }
          });
      } else {
        // 新增记录
        await db.collection('vaccine_records').add({
          data: {
            babyId: baby._id,
            familyId: baby.familyId,
            name: selectedVaccine.name,
            dose: selectedVaccine.dose,
            vaccinatedDate,
            createdAt: new Date()
          }
        });
      }
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      this.setData({ showDatePopup: false });
      this.loadVaccineList();
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存接种记录失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /**
   * 删除接种记录
   */
  async deleteVaccineRecord() {
    const { selectedVaccine } = this.data;
    
    const res = await wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${selectedVaccine.name} ${selectedVaccine.dose} 的接种记录吗？`,
      confirmColor: ThemeManager.getConfirmColor('danger')
    });
    
    if (!res.confirm) return;
    
    try {
      wx.showLoading({ title: '删除中...' });
      
      const db = wx.cloud.database();
      await db.collection('vaccine_records')
        .doc(selectedVaccine.record._id)
        .remove();
      
      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
      
      this.setData({ showDetailPopup: false });
      this.loadVaccineList();
      
    } catch (error) {
      wx.hideLoading();
      console.error('删除接种记录失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadVaccineList();
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
