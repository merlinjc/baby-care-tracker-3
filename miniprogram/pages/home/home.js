/**
 * 首页
 * 显示今日概览、快捷入口、时间线
 * 
 * 首页改版 v2.0 - FR-1~FR-15 实现
 */

const RecordService = require('../../services/record');
const FamilyService = require('../../services/family');
const BabyService = require('../../services/baby');
const ThemeManager = require('../../utils/theme');
const StorageUtil = require('../../utils/storage');
const todoService = require('../../services/todo').getInstance();
const PermissionUtil = require('../../utils/permission');
const { formatDuration, calculateAgeInDays, calculateAgeMonths } = require('../../utils/date');
const EasterEgg = require('../../utils/easter-egg');
const shareBehavior = require('../../behaviors/share-behavior');

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    currentBaby: null,
    todayStats: {
      // FR-1/FR-4: 扩展字段 lastTimeTs、lastEndTimeTs、latestValue/latestValueTs
      feeding: { count: 0, totalAmount: 0, lastTimeTs: null },
      sleep: { count: 0, totalDuration: 0, lastEndTimeTs: null },
      diaper: { count: 0, wet: 0, dirty: 0 },
      temperature: { count: 0, values: [], latestValue: null, latestValueTs: null }
    },
    sleepDurationText: '',
    recentRecords: [],
    loading: true,
    error: false,
    errorMsg: '',
    
    // FR-13: 顶部问候语
    greeting: '',
    todayDateText: '',
    birthDayCount: 0,
    
    // FR-2: 多宝快速切换
    familyBabies: [],
    switching: false,
    
    // FR-1/FR-10: 宝宝状态横幅 + 睡眠计时
    activeSleep: null,
    activeStatus: { type: 'none', text: '', color: '' },
    activeSleepDisplay: '',
    sleepAbnormal: false,
    
    // FR-7: 今日待办
    todoStats: { total: 0, vaccine: 0, milestone: 0, overdue: 0, vaccineItems: [], milestoneItems: [] },
    
    // FR-3/4/5/6: 今日概览增强
    sleepDisplay: '',
    sleepGoalMet: false,
    tempStatus: '',
    tempStatusText: '',
    tempColor: '',
    showFeverAlert: false,
    feedingAgoText: '',
    sleepAgoText: '',
    totalTodayCount: 0,
    
    // FR-8: 喂养预测
    feedingPrediction: { show: false, text: '', urgent: false },
    
    // FR-14: AI 洞察
    aiInsight: { show: false, loading: false, text: '', fallback: false, collapsed: false },
    
    // FR-11: 时间线编辑
    openedSwipeId: '',
    editingRecord: null,
    
    // 家庭协作：权限相关
    userRole: 'editor',
    isAdmin: false,
    canEdit: true,
    currentUserId: '',
    
    // FR-9: 生长弹窗
    showGrowthPopup: false,
    
    // 弹窗显示状态
    showFeedingPopup: false,
    showSleepPopup: false,
    showDiaperPopup: false,
    showTemperaturePopup: false,

    // 彩蛋状态
    easterEggPopup: { show: false, type: '', eggData: {}, storageKey: '' },
    easterEggToast: { show: false, text: '', icon: '', storageKey: '' },
    easterEggBanner: { show: false, text: '', icon: '', storageKey: '' }
  },

  onLoad() {
    this._lastLoadTime = 0;
    this._recordService = RecordService.getInstance();
    this.init();
  },

  onShow() {
    this._applyTheme();
    
    // [v4.1] FR-5.6: 轻量校验 — 缓存过期时强制重新 init
    const app = getApp();
    if (app.checkFamilyStale()) {
      this.init();
      return;
    }
    
    // 重新获取当前宝宝信息（确保头像等数据是最新的）
    const currentBaby = StorageUtil.getCurrentBaby();
    if (currentBaby) {
      this.setData({ currentBaby });
      
      // FR-13: 更新问候语
      this.computeGreeting(currentBaby);
      
      // FR-10: 检查睡眠计时状态
      this.checkActiveSleep();
    }
    
    // NFR-1: 30秒节流，避免 Tab 切换频繁查询
    const now = Date.now();
    if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
    this._lastLoadTime = now;
    this.loadData();
    
    // FR-7: 并行加载待办数据（使用 TodoService 30s 缓存）
    this.loadTodoStats();
  },

  /**
   * FR-13: 计算问候语（纯计算函数，返回 patch 对象）
   * 5 档时段：5-12 早安 / 12-14 午安 / 14-18 下午好 / 18-22 晚上好 / 22-5 夜深了
   */
  computeGreeting(baby) {
    const now = new Date();
    const hour = now.getHours();
    
    let greeting = '';
    if (hour >= 5 && hour < 12) {
      greeting = '早安';
    } else if (hour >= 12 && hour < 14) {
      greeting = '午安';
    } else if (hour >= 14 && hour < 18) {
      greeting = '下午好';
    } else if (hour >= 18 && hour < 22) {
      greeting = '晚上好';
    } else {
      greeting = '夜深了';
    }
    
    // 格式化今日日期
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const todayDateText = `${month}月${day}日 周${WEEK_DAYS[now.getDay()]}`;
    
    // 计算出生天数
    let birthDayCount = 0;
    if (baby && baby.birthDate) {
      birthDayCount = calculateAgeInDays(baby.birthDate);
    }
    
    return { greeting, todayDateText, birthDayCount };
  },

  /**
   * FR-10: 检查活动睡眠状态（纯计算函数，返回 patch 对象）
   * 从 StorageUtil 读取 active_sleep_{babyId}
   */
  checkActiveSleep() {
    const baby = this.data.currentBaby;
    if (!baby) return { activeSleep: null, sleepAbnormal: false, activeSleepDisplay: '' };
    
    const storageKey = `active_sleep_${baby._id}`;
    const activeSleep = StorageUtil.get(storageKey);
    
    if (!activeSleep || !activeSleep.startTimeTs) {
      return {
        activeSleep: null,
        sleepAbnormal: false,
        activeSleepDisplay: ''
      };
    }
    
    const now = Date.now();
    const elapsed = now - activeSleep.startTimeTs;
    
    // 超过 24 小时视为异常
    const sleepAbnormal = elapsed > 24 * 60 * 60 * 1000;
    
    return {
      activeSleep,
      sleepAbnormal,
      activeSleepDisplay: formatDuration(elapsed)
    };
  },

  /**
   * FR-1: 计算当前状态
   * 优先级：睡眠中 > 上次喂养 > 上次记录 > 无记录
   */
  computeActiveStatus(todayStats, activeSleep, nowTs, latestRecordTs) {
    if (activeSleep) {
      const elapsed = nowTs - activeSleep.startTimeTs;
      return { 
        type: 'sleeping', 
        text: `正在睡觉 · 已 ${formatDuration(elapsed)}`, 
        color: 'var(--sleep-color)' 
      };
    }
    
    if (todayStats.feeding.lastTimeTs) {
      const ago = nowTs - todayStats.feeding.lastTimeTs;
      return { 
        type: 'feeding_ago', 
        text: `上次喂养 ${formatDuration(ago)} 前`, 
        color: 'var(--feeding-color)' 
      };
    }
    
    const latestTs = todayStats.sleep.lastEndTimeTs || latestRecordTs;
    if (latestTs) {
      const ago = nowTs - latestTs;
      return { 
        type: 'record_ago', 
        text: `上次记录 ${formatDuration(ago)} 前`, 
        color: 'var(--primary-color)' 
      };
    }
    
    return { 
      type: 'none', 
      text: '今天还没有记录，点击下方快速添加', 
      color: 'var(--text-hint)' 
    };
  },

  /**
   * FR-6: 计算体温状态
   */
  computeTempStatus(value) {
    if (value === null || value === undefined) {
      return { status: 'none', text: '--', color: 'var(--text-hint)' };
    }
    if (value < 37.5) {
      return { status: 'normal', text: '正常', color: 'var(--success-color)' };
    }
    if (value < 38.5) {
      return { status: 'low_fever', text: '低烧', color: 'var(--warning-color)' };
    }
    return { status: 'fever', text: '发烧', color: 'var(--danger-color)' };
  },

  /**
   * FR-5: 获取睡眠达标标准（NSF 3 档）
   * @param {number} ageMonths 月龄
   * @returns {number} 达标秒数
   */
  getSleepGoal(ageMonths) {
    if (ageMonths <= 3) return 14 * 3600;  // 0-3个月: 14h
    if (ageMonths <= 11) return 12 * 3600; // 4-11个月: 12h
    return 11 * 3600;                       // 12月+: 11h
  },

  /**
   * 计算月龄（使用 utils/date 统一实现）
   */
  calculateAgeMonths(birthDate) {
    return calculateAgeMonths(birthDate);
  },

  /**
   * FR-7: 加载待办统计
   */
  async loadTodoStats() {
    try {
      const baby = this.data.currentBaby;
      if (!baby) return;
      
      const todoStats = await todoService.getTodoStats(baby);
      this.setData({ todoStats });
    } catch (error) {
      console.error('[Home] 加载待办统计失败:', error);
    }
  },

  /**
   * 初始化
   * 
   * 关键修复：
   * 1. 等待 app.initUser() 完成，避免竞态条件
   * 2. 优先使用 userInfo.familyId 直接获取家庭信息（而非间接查询）
   * 3. 本地缓存 + 云端查询双路径，确保数据可靠
   */
  async init() {
    try {
      // [v4.1] 统一用户校验（替代原有的 initPromise + userInfo + familyInfo + 成员检测）
      const app = getApp();
      const check = await app.ensureUserReady();
      
      if (!check.ready) {
        if (check.reason === 'removed') {
          wx.showModal({
            title: '提示',
            content: '您已被移除出该家庭，请重新加入或创建新家庭。',
            showCancel: false,
            success: () => wx.reLaunch({ url: check.redirectUrl })
          });
        } else {
          wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
        }
        return;
      }
      
      const { userInfo, familyInfo } = check;

      // === 步骤 2: 获取宝宝列表 ===
      let currentBaby = StorageUtil.getCurrentBaby();
      const babyService = BabyService.getInstance();
      const familyBabies = await babyService.getBabiesByFamilyId(familyInfo._id);

      if (familyBabies.length === 0) {
        // 没有宝宝，跳转创建页
        console.warn('[Home] 未找到宝宝记录，跳转创建页. familyId=', familyInfo._id);
        wx.redirectTo({
          url: '/pages/baby-create/baby-create?familyId=' + familyInfo._id
        });
        return;
      }

      // 如果本地无当前宝宝，或本地缓存的宝宝不在家庭列表中，选择第一个
      if (!currentBaby || !familyBabies.find(b => b._id === currentBaby._id)) {
        currentBaby = familyBabies[0];
        StorageUtil.saveCurrentBaby(currentBaby);
      }

      // === 步骤 3: 计算用户权限 ===
      const userRole = PermissionUtil.getUserRole(userInfo._id, familyInfo);
      const isAdmin = userRole === 'admin';
      const canEdit = PermissionUtil.canEdit(userInfo._id, familyInfo);

      // === 步骤 4: 设置数据并加载 ===
      const greetingPatch = this.computeGreeting(currentBaby);
      this.setData({
        currentBaby,
        familyBabies,  // FR-2: 保存家庭宝宝列表
        userRole,
        isAdmin,
        canEdit,
        currentUserId: userInfo._id,
        ...greetingPatch
      });

      await this.loadData();
    } catch (error) {
      console.error('[Home] 初始化失败:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 加载数据
   */
  async loadData() {
    if (!this.data.currentBaby) return;

    this.setData({ loading: true, error: false });

    try {
      const recordService = RecordService.getInstance();
      const nowTs = Date.now();
      
      // 并行获取今日统计和最近记录
      const [todayStats, recentRecords] = await Promise.all([
        recordService.getTodayStats(this.data.currentBaby._id),
        recordService.getRecords(this.data.currentBaby._id, { limit: 5 })  // FR-12: 改为 5 条
      ]);

      // FR-10: 检查睡眠计时状态（纯计算）
      const sleepPatch = this.checkActiveSleep();
      
      // FR-1: 计算当前状态
      const latestRecordTs = recentRecords.length > 0 ? 
        (recentRecords[0].startTimeTs || new Date(recentRecords[0].startTime).getTime()) : null;
      const activeStatus = this.computeActiveStatus(
        todayStats, 
        sleepPatch.activeSleep, 
        nowTs, 
        latestRecordTs
      );

      // FR-5: 计算睡眠显示和达标状态
      const ageMonths = this.calculateAgeMonths(this.data.currentBaby.birthDate);
      const sleepGoal = this.getSleepGoal(ageMonths);
      const sleepGoalMet = todayStats.sleep.totalDuration >= sleepGoal;
      
      // 格式化睡眠时长显示（秒转毫秒后格式化）
      const sleepDisplay = todayStats.sleep.totalDuration > 0 
        ? formatDuration(todayStats.sleep.totalDuration * 1000)
        : '0m';
      
      // FR-6: 计算体温状态
      const tempResult = this.computeTempStatus(todayStats.temperature.latestValue);
      const showFeverAlert = tempResult.status === 'fever' || tempResult.status === 'low_fever';
      
      // 预计算体温显示文字（减少 WXML 层表达式）
      const tempDisplayText = todayStats.temperature.latestValue 
        ? todayStats.temperature.latestValue + '°C' 
        : '--';
      
      // FR-4: 计算时间提示
      const feedingAgoText = todayStats.feeding.lastTimeTs 
        ? formatDuration(nowTs - todayStats.feeding.lastTimeTs) + ' 前'
        : '';
      const sleepAgoText = todayStats.sleep.lastEndTimeTs 
        ? formatDuration(nowTs - todayStats.sleep.lastEndTimeTs) + ' 前'
        : '';

      // 统计今日总记录数
      const totalTodayCount = todayStats.feeding.count + todayStats.sleep.count + 
                              todayStats.diaper.count + todayStats.temperature.count;

      // v4.0: 进度条百分比计算
      const feedingProgress = Math.min(100, Math.round((todayStats.feeding.count / 8) * 100));
      const sleepProgress = sleepGoal > 0 ? Math.min(100, Math.round((todayStats.sleep.totalDuration / sleepGoal) * 100)) : 0;
      const diaperProgress = Math.min(100, Math.round((todayStats.diaper.count / 6) * 100));

      // 家庭协作：归一化 createdBy 字段
      const normalizedRecords = recentRecords.map(r => {
        const createdBy = RecordService.normalizeCreatedBy(r);
        return { ...r, _createdBy: createdBy };
      });

      // 兼容旧的睡眠时长显示（提前计算以合并 setData）
      let sleepDurationText = '';
      if (todayStats.sleep && todayStats.sleep.totalDuration > 0) {
        const totalMinutes = Math.floor(todayStats.sleep.totalDuration / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        sleepDurationText = hours > 0 
          ? (minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`)
          : `${minutes}分钟`;
      }

      // 合并为一次 setData（包含 sleepPatch + 主数据 + sleepDurationText）
      this.setData({
        ...sleepPatch,
        todayStats,
        recentRecords: normalizedRecords,
        loading: false,
        error: false,
        activeStatus,
        sleepDisplay,
        sleepGoalMet,
        tempStatus: tempResult.status,
        tempStatusText: tempResult.text,
        tempColor: tempResult.color,
        showFeverAlert,
        feedingAgoText,
        sleepAgoText,
        totalTodayCount,
        feedingProgress,
        sleepProgress,
        diaperProgress,
        sleepDurationText,
        tempDisplayText
      });
      
      // FR-8: 异步计算喂养预测（不阻塞主渲染）
      this.computeFeedingPrediction(this.data.currentBaby._id, nowTs);
      
      // 彩蛋检测（500ms 延迟，不阻塞渲染）
      setTimeout(() => {
        this.checkEasterEggs();
      }, 500);
      
    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({ 
        loading: false, 
        error: true,
        errorMsg: '加载失败，请检查网络后重试'
      });
    }
  },

  /**
   * FR-8: 计算喂养预测
   */
  async computeFeedingPrediction(babyId, nowTs) {
    try {
      const recordService = this._recordService;
      
      // 获取今昨两天的喂养记录
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = todayStart.getTime() - 86400000;
      
      const records = await recordService.getRecords(babyId, {
        recordType: 'feeding',
        dateRange: { start: yesterdayStart, end: nowTs },
        limit: 3,
        orderBy: 'startTimeTs',
        order: 'desc'
      });
      
      if (records.length < 3) {
        this.setData({ feedingPrediction: { show: false } });
        return;
      }

      // 计算间隔
      const intervals = [];
      for (let i = 0; i < records.length - 1; i++) {
        const ts1 = records[i].startTimeTs || new Date(records[i].startTime).getTime();
        const ts2 = records[i + 1].startTimeTs || new Date(records[i + 1].startTime).getTime();
        intervals.push(ts1 - ts2);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // 过滤异常值（> 6h 或 < 1h）
      if (avgInterval > 6 * 3600000 || avgInterval < 3600000) {
        this.setData({ feedingPrediction: { show: false } });
        return;
      }

      const lastFeedingTs = records[0].startTimeTs || new Date(records[0].startTime).getTime();
      const nextPredictTs = lastFeedingTs + avgInterval;
      const remaining = nextPredictTs - nowTs;

      if (remaining <= 0) {
        this.setData({ feedingPrediction: { show: true, text: '该喂了 ⚡', urgent: true } });
      } else {
        this.setData({ feedingPrediction: { show: true, text: `约 ${formatDuration(remaining)} 后`, urgent: false } });
      }
    } catch (error) {
      console.error('[Home] 计算喂养预测失败:', error);
      this.setData({ feedingPrediction: { show: false } });
    }
  },

  /**
   * 统计数字点击 → 跳转记录页（带类型筛选）
   */
  onStatTap(e) {
    const { type } = e.currentTarget.dataset;
    if (type) {
      wx.reLaunch({ url: `/pages/record/record?type=${type}` });
    }
  },

  /**
   * 重试加载
   */
  onRetry() {
    this.loadData();
  },

  /**
   * 打开喂养记录弹窗
   */
  openFeedingPopup() {
    this.setData({ showFeedingPopup: true });
  },

  /**
   * 打开睡眠记录弹窗
   */
  openSleepPopup() {
    this.setData({ showSleepPopup: true });
  },

  /**
   * 打开排便记录弹窗
   */
  openDiaperPopup() {
    this.setData({ showDiaperPopup: true });
  },

  /**
   * 打开体温记录弹窗
   */
  openTemperaturePopup() {
    this.setData({ showTemperaturePopup: true });
  },

  /**
   * FR-9: 打开生长记录弹窗
   */
  openGrowthPopup() {
    this.setData({ showGrowthPopup: true });
  },

  /**
   * 关闭喂养弹窗
   */
  closeFeedingPopup() {
    this.setData({ showFeedingPopup: false });
  },

  /**
   * 关闭睡眠弹窗
   */
  closeSleepPopup() {
    this.setData({ showSleepPopup: false });
  },

  /**
   * 关闭排便弹窗
   */
  closeDiaperPopup() {
    this.setData({ showDiaperPopup: false });
  },

  /**
   * 关闭体温弹窗
   */
  closeTemperaturePopup() {
    this.setData({ showTemperaturePopup: false });
  },

  /**
   * FR-9: 关闭生长弹窗
   */
  closeGrowthPopup() {
    this.setData({ showGrowthPopup: false });
  },

  /**
   * FR-9: 生长记录保存成功回调
   */
  onGrowthSaved() {
    wx.showToast({ title: '生长数据已记录', icon: 'success' });
    this.setData({ showGrowthPopup: false });
  },

  /**
   * 记录创建成功回调
   */
  onRecordCreated() {
    // 检查首次记录彩蛋
    this._checkFirstRecordEgg();
    // 重新加载数据
    this.loadData();
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    // 强制刷新待办缓存
    todoService.clearCache();
    
    await Promise.all([
      this.loadData(),
      this.loadTodoStats()
    ]);
    
    wx.stopPullDownRefresh();
  },

  /**
   * 跳转到记录列表
   */
  goToRecordList() {
    wx.switchTab({
      url: '/pages/record/record'
    });
  },

  /**
   * 跳转到宝宝详情
   */
  goToBabyDetail() {
    // BUG-11: currentBaby 可能为 null
    if (!this.data.currentBaby || !this.data.currentBaby._id) {
      wx.showToast({ title: '未找到宝宝信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/packageGrowth/pages/baby-detail/baby-detail?id=${this.data.currentBaby._id}`
    });
  },

  /**
   * 跳转到创建宝宝页面
   */
  goToBabyCreate() {
    wx.navigateTo({
      url: '/pages/baby-create/baby-create'
    });
  },

  /**
   * FR-7: 查看全部待办（跳转到疫苗页）
   */
  goToDiscover() {
    wx.navigateTo({
      url: '/packageGrowth/pages/vaccine/vaccine'
    });
  },

  /**
   * FR-7: 跳转到疫苗页
   */
  goToVaccine() {
    wx.navigateTo({
      url: '/packageGrowth/pages/vaccine/vaccine'
    });
  },

  /**
   * FR-7: 跳转到里程碑页
   */
  goToMilestone() {
    wx.navigateTo({
      url: '/packageGrowth/pages/milestone/milestone'
    });
  },

  /**
   * FR-2: 切换宝宝
   */
  async switchBaby(e) {
    const { babyId } = e.currentTarget.dataset;
    if (!babyId || babyId === this.data.currentBaby?._id || this.data.switching) return;
    
    const baby = this.data.familyBabies.find(b => b._id === babyId);
    if (!baby) return;
    
      this.setData({ switching: true });
    
    try {
      StorageUtil.saveCurrentBaby(baby);
      
      // 清除待办缓存（切换宝宝后需要重新计算）
      todoService.clearCache();
      
      // 合并为一次 setData（baby + greeting + sleep）
      const greetingPatch = this.computeGreeting(baby);
      const sleepPatch = this.checkActiveSleep();
      this.setData({ 
        currentBaby: baby,
        switching: false,
        ...greetingPatch,
        ...sleepPatch
      });
      
      await Promise.all([
        this.loadData(),
        this.loadTodoStats()
      ]);
    } catch (error) {
      console.error('[Home] 切换宝宝失败:', error);
      this.setData({ switching: false });
      wx.showToast({ title: '切换失败', icon: 'none' });
    }
  },

  /**
   * FR-10: 从状态横幅结束睡眠
   */
  endSleepFromBanner() {
    // 显示睡眠弹窗以完成睡眠记录
    this.setData({ showSleepPopup: true });
  },

  /**
   * FR-10: 取消异常睡眠计时
   */
  async cancelAbnormalSleep() {
    const res = await wx.showModal({
      title: '取消睡眠计时',
      content: '睡眠计时已超过24小时，是否取消此次计时？',
      confirmText: '确定取消',
      confirmColor: ThemeManager.getConfirmColor('danger')
    });
    
    if (res.confirm) {
      const baby = this.data.currentBaby;
      if (baby) {
        const storageKey = `active_sleep_${baby._id}`;
        StorageUtil.remove(storageKey);
        
        // 重新计算状态（合并为一次 setData）
        const nowTs = Date.now();
        const activeStatus = this.computeActiveStatus(
          this.data.todayStats, 
          null, 
          nowTs, 
          null
        );
        this.setData({
          activeSleep: null,
          sleepAbnormal: false,
          activeSleepDisplay: '',
          activeStatus
        });
        
        wx.showToast({ title: '已取消计时', icon: 'success' });
      }
    }
  },

  /**
   * FR-14: 加载 AI 洞察
   * 流程：检查缓存 -> QuotaService 检查 -> AIService 生成 -> 缓存 -> 降级
   */
  async loadAiInsight() {
    const baby = this.data.currentBaby;
    if (!baby) return;
    
    // 生成缓存 key
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const cacheKey = `ai_insight_${baby._id}_${dateStr}`;
    
    // 写入时清理 7 天前的 AI 洞察缓存（避免缓存膨胀）
    this._cleanExpiredAiCache(baby._id, dateStr);
    
    // 读取折叠状态
    const collapsedKey = `ai_insight_collapsed_${baby._id}`;
    const collapsed = StorageUtil.get(collapsedKey) === true;
    
    // 检查缓存
    const cachedInsight = StorageUtil.get(cacheKey);
    if (cachedInsight && cachedInsight.text) {
      this.setData({
        aiInsight: {
          show: true,
          loading: false,
          text: cachedInsight.text,
          fallback: cachedInsight.fallback || false,
          collapsed
        }
      });
      return;
    }
    
    // 开始加载
    this.setData({
      aiInsight: {
        show: true,
        loading: true,
        text: '',
        fallback: false,
        collapsed
      }
    });
    
    try {
      // 检查 QuotaService
      const QuotaService = require('../../services/quota');
      const quotaService = QuotaService.getInstance();
      
      if (!quotaService.hasQuota()) {
        // 配额用完，使用本地降级
        this.generateFallbackInsight(cacheKey);
        return;
      }
      
      // 准备 prompt
      const { todayStats } = this.data;
      const prompt = this.buildInsightPrompt(baby, todayStats);
      
      // 调用 AIService（8s 超时）
      const AIService = require('../../services/ai');
      const aiService = AIService.getInstance();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      
      const aiPromise = aiService.generateText(prompt, 
        '你是一位专业的育儿助手。请用一句话（最多80字）总结今日的育儿情况，包含关键数据和温馨提醒。语气亲切友好。'
      );
      
      const result = await Promise.race([aiPromise, timeoutPromise]);
      
      // 使用配额
      quotaService.useQuota();
      
      // 截断到 80 字
      const text = result.length > 80 ? result.substring(0, 80) + '...' : result;
      
      // 缓存结果
      StorageUtil.set(cacheKey, { text, fallback: false });
      
      this.setData({
        aiInsight: {
          show: true,
          loading: false,
          text,
          fallback: false,
          collapsed
        }
      });
      
    } catch (error) {
      console.error('[Home] AI 洞察加载失败:', error);
      // 降级到本地规则摘要
      this.generateFallbackInsight(cacheKey);
    }
  },

  /**
   * FR-14: 构建 AI 洞察 prompt
   */
  buildInsightPrompt(baby, todayStats) {
    const parts = [];
    
    if (todayStats.feeding.count > 0) {
      parts.push(`喂养${todayStats.feeding.count}次${todayStats.feeding.totalAmount > 0 ? '，共' + todayStats.feeding.totalAmount + 'ml' : ''}`);
    }
    
    if (todayStats.sleep.count > 0) {
      const hours = Math.floor(todayStats.sleep.totalDuration / 3600);
      const mins = Math.floor((todayStats.sleep.totalDuration % 3600) / 60);
      const durationStr = hours > 0 ? `${hours}小时${mins > 0 ? mins + '分钟' : ''}` : `${mins}分钟`;
      parts.push(`睡眠${todayStats.sleep.count}次，共${durationStr}`);
    }
    
    if (todayStats.diaper.count > 0) {
      parts.push(`换尿布${todayStats.diaper.count}次（湿${todayStats.diaper.wet}次/脏${todayStats.diaper.dirty}次）`);
    }
    
    if (todayStats.temperature.latestValue) {
      parts.push(`最新体温${todayStats.temperature.latestValue}°C`);
    }
    
    return `宝宝${baby.nickName || ''}今日记录：${parts.join('，')}。请用一句话总结今日情况并给出温馨提醒。`;
  },

  /**
   * FR-14: 生成本地降级摘要
   */
  generateFallbackInsight(cacheKey) {
    const { todayStats, currentBaby } = this.data;
    const parts = [];
    
    if (todayStats.feeding.count > 0) {
      parts.push(`喂养${todayStats.feeding.count}次`);
    }
    if (todayStats.sleep.count > 0) {
      parts.push(`睡眠${todayStats.sleep.count}次`);
    }
    if (todayStats.diaper.count > 0) {
      parts.push(`换尿布${todayStats.diaper.count}次`);
    }
    
    let text = `${currentBaby.nickName || '宝宝'}今天${parts.join('、')}`;
    
    // 添加简单的提醒
    const hour = new Date().getHours();
    if (hour >= 20) {
      text += '，注意安排晚间作息哦 🌙';
    } else if (hour >= 12 && hour < 14) {
      text += '，记得午休充电哦 ☀️';
    } else {
      text += '，继续加油 💪';
    }
    
    // 缓存
    StorageUtil.set(cacheKey, { text, fallback: true });
    
    // 读取折叠状态
    const collapsedKey = `ai_insight_collapsed_${currentBaby._id}`;
    const collapsed = StorageUtil.get(collapsedKey) === true;
    
    this.setData({
      aiInsight: {
        show: true,
        loading: false,
        text,
        fallback: true,
        collapsed
      }
    });
  },

  /**
   * FR-14: 切换 AI 洞察折叠状态
   */
  toggleAiInsight() {
    const { aiInsight, currentBaby } = this.data;
    const newCollapsed = !aiInsight.collapsed;
    
    // 持久化折叠状态
    if (currentBaby) {
      const collapsedKey = `ai_insight_collapsed_${currentBaby._id}`;
      StorageUtil.set(collapsedKey, newCollapsed);
    }
    
    this.setData({
      'aiInsight.collapsed': newCollapsed
    });
  },

  /**
   * 清理 7 天前的 AI 洞察缓存
   * @param {string} babyId 宝宝 ID
   * @param {string} todayStr 今天日期字符串 YYYY-MM-DD
   */
  _cleanExpiredAiCache(babyId, todayStr) {
    try {
      const res = wx.getStorageInfoSync();
      const keys = res.keys || [];
      const prefix = `ai_insight_${babyId}_`;
      const todayDate = new Date(todayStr);
      const expiryMs = 7 * 24 * 60 * 60 * 1000;

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          const datePartStr = key.replace(prefix, '');
          const cacheDate = new Date(datePartStr);
          if (!isNaN(cacheDate.getTime()) && todayDate - cacheDate > expiryMs) {
            wx.removeStorageSync(key);
          }
        }
      });
    } catch (e) {
      // 清理失败不影响正常使用
    }
  },

  // [v4.1] AI 功能已屏蔽，保留代码待后续恢复
  // goToAiAssistant() {
  //   wx.navigateTo({
  //     url: '/packageSocial/pages/ai-assistant/ai-assistant?presetMsg=true'
  //   });
  // },

  /**
   * FR-11: 时间线左滑编辑
   */
  onTimelineEdit(e) {
    const { record } = e.detail;
    if (!record) return;
    
    // 权限检查：viewer 不能编辑
    if (!this.data.canEdit) {
      wx.showToast({ title: '仅查看权限，无法编辑', icon: 'none' });
      return;
    }
    
    // record-edit 页面不存在，改为打开对应类型的弹窗进行编辑
    const type = record.type || record.recordType;
    const popupMap = {
      'feeding': 'showFeedingPopup',
      'sleep': 'showSleepPopup',
      'diaper': 'showDiaperPopup',
      'temperature': 'showTemperaturePopup'
    };
    
    const popupKey = popupMap[type];
    if (popupKey) {
      this.setData({ 
        editingRecord: record,
        [popupKey]: true 
      });
    } else {
      wx.showToast({ title: '暂不支持编辑该类型', icon: 'none' });
    }
  },

  /**
   * FR-11: 时间线左滑删除
   */
  /**
   * 彩蛋检测主入口
   */
  checkEasterEggs() {
    const { currentBaby, birthDayCount, todayStats, totalTodayCount, recentRecords } = this.data;
    if (!currentBaby) return;

    const ctx = {
      babyId: currentBaby._id,
      babyName: currentBaby.nickName || '宝宝',
      birthDayCount,
      todayStats,
      totalTodayCount,
      recentRecords
    };

    const result = EasterEgg.detectAll(ctx);

    // 处理弹窗
    if (result.popup) {
      this.setData({
        easterEggPopup: {
          show: true,
          type: result.popup.type,
          eggData: result.popup.data,
          storageKey: result.popup.storageKey
        }
      });
    }

    // 处理提示条
    if (result.banner) {
      this.setData({
        easterEggBanner: {
          show: true,
          text: result.banner.data.text,
          icon: result.banner.data.icon,
          storageKey: result.banner.storageKey
        }
      });
    }

    // 处理 Toast 队列（弹窗关闭后或无弹窗时开始）
    if (result.toasts.length > 0) {
      this._eggToastQueue = result.toasts;
      if (!result.popup) {
        this._showNextToast();
      }
    }
  },

  /**
   * 显示下一个 Toast
   */
  _showNextToast() {
    if (!this._eggToastQueue || this._eggToastQueue.length === 0) return;

    const next = this._eggToastQueue.shift();
    this.setData({
      easterEggToast: {
        show: true,
        text: next.data.text,
        icon: next.data.icon,
        storageKey: next.storageKey
      }
    });
  },

  /**
   * 弹窗关闭回调
   */
  onEasterEggPopupClose() {
    this.setData({
      'easterEggPopup.show': false
    });
    // 弹窗关闭后开始 Toast 队列
    setTimeout(() => {
      this._showNextToast();
    }, 500);
  },

  /**
   * Toast 关闭回调
   */
  onEasterEggToastClose() {
    this.setData({
      'easterEggToast.show': false
    });
    // 1 秒后显示下一个 Toast
    setTimeout(() => {
      this._showNextToast();
    }, 1000);
  },

  /**
   * 关闭提示条
   */
  closeEasterEggBanner() {
    const { storageKey } = this.data.easterEggBanner;
    if (storageKey) {
      EasterEgg.markShown(storageKey);
    }
    this.setData({ 'easterEggBanner.show': false });
  },

  /**
   * EE-4: 首次记录彩蛋
   */
  _checkFirstRecordEgg() {
    const baby = this.data.currentBaby;
    if (!baby) return;

    const key = `egg_first_record_${baby._id}`;
    if (StorageUtil.get(key)) return;

    // 延迟 300ms（等记录弹窗关闭动画），然后显示 Toast
    setTimeout(() => {
      this.setData({
        easterEggToast: {
          show: true,
          text: '第一次记录完成！育儿之旅正式开始',
          icon: '/images/icons/rocket.png',
          storageKey: key
        }
      });
    }, 300);
  },

  async onTimelineDelete(e) {
    const { record } = e.detail;
    if (!record) return;
    
    // 权限检查：使用 PermissionUtil.canDeleteRecord
    const familyInfo = StorageUtil.getFamilyInfo();
    const canDelete = PermissionUtil.canDeleteRecord(
      this.data.currentUserId, familyInfo, record
    );
    
    if (!canDelete) {
      if (this.data.userRole === 'viewer') {
        wx.showToast({ title: '仅查看权限，无法删除', icon: 'none' });
      } else {
        wx.showToast({ title: '只能删除自己创建的记录', icon: 'none' });
      }
      return;
    }
    
    // Editor 删除他人记录需要额外确认（理论上不会走到这里，因为 canDeleteRecord 已拦截）
    const recordCreatorId = record.createdBy?.userId || record.creatorId || '';
    const isOwnRecord = recordCreatorId === this.data.currentUserId;
    
    const confirmContent = isOwnRecord
      ? '确定要删除这条记录吗？此操作不可恢复。'
      : '确定要删除他人创建的记录吗？此操作不可恢复。';
    
    const res = await wx.showModal({
      title: '删除记录',
      content: confirmContent,
      confirmText: '删除',
      confirmColor: ThemeManager.getConfirmColor('danger')
    });
    
    if (res.confirm) {
      try {
        const recordService = this._recordService;
        await recordService.deleteRecord(record._id);
        
        wx.showToast({ title: '已删除', icon: 'success' });
        
        // 刷新数据
        this.loadData();
      } catch (error) {
        console.error('[Home] 删除记录失败:', error);
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    }
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
