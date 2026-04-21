/**
 * 记录页
 * 显示所有记录列表，支持筛选和搜索
 */

const RecordService = require('../../services/record');
const StorageUtil = require('../../utils/storage');
const PermissionUtil = require('../../utils/permission');
const { PermissionGuard } = require('../../services/permission-guard');
const { debounce } = require('../../utils/debounce');
const ThemeManager = require('../../utils/theme');

const { batchExecute } = require('../../utils/batch');

// 中文筛选名称到英文 recordType 的映射
const FILTER_TYPE_MAP = {
  '全部': null,
  '喂养': 'feeding',
  '睡眠': 'sleep',
  '排便': 'diaper',
  '体温': 'temperature',
  '生长': 'growth'
};

// FR-3: recordType 到筛选索引的映射
const TYPE_TO_FILTER_INDEX = {
  'feeding': 1,
  'sleep': 2,
  'diaper': 3,
  'temperature': 4,
  'growth': 5
};

Page({
  data: {
    darkMode: false,
    currentBaby: null,
    records: [],
    filters: ['全部', '喂养', '睡眠', '排便', '体温', '生长'],
    filterIcons: ['', 'feeding-color', 'sleep-color', 'diaper-color', 'health-color', 'growth-white'],
    filterCounts: [0, 0, 0, 0, 0, 0],
    currentFilter: 0,
    loading: true,
    hasMore: true,
    page: 0,
    pageSize: 20,
    
    // 搜索关键词
    searchKeyword: '',
    
    // 日期筛选
    showDatePicker: false,
    dateRange: {
      start: null,
      end: null
    },
    dateRangeText: '全部时间',
    
    // 批量管理模式
    manageMode: false,
    selectedRecords: [],
    
    // 记录操作
    showActionSheet: false,
    selectedRecord: null,
    
    // 悬浮按钮
    showFabMenu: false,
    
    // 弹窗控制
    showFeedingPopup: false,
    showSleepPopup: false,
    showDiaperPopup: false,
    showTemperaturePopup: false,
    showGrowthPopup: false,
    showReportPopup: false,
    showDetailPopup: false,   // BUG-15: 记录详情弹窗
    // 分享相关
    shareImagePath: '',
    shareBabyName: '',

    // 今日速览摘要文案
    todaySummaryText: ''
  },

  // 空方法：用于 catchtap 阻止事件冒泡
  noop() {},

  onLoad(options) {
    this._lastLoadTime = 0;
    this._recordService = RecordService.getInstance();
    
    // 任务 4.2: 处理分享链接参数
    if (options.showReport === '1') {
      this._showReportOnReady = true;
      this._reportPeriod = options.period || 'week';
    }
    
    // FR-3: 从 URL 参数读取类型筛选
    if (options.type && TYPE_TO_FILTER_INDEX[options.type] !== undefined) {
      this._initialFilter = TYPE_TO_FILTER_INDEX[options.type];
    }
    
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
    
    const now = Date.now();
    if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
    this._lastLoadTime = now;
    this.loadData(true);
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
    // 清理防抖定时器
    if (this._debouncedSearch) {
      this._debouncedSearch.cancel();
    }
  },

  /**
   * 初始化
   */
  async init() {
    // [v4.1] 统一用户校验
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

    const currentBaby = StorageUtil.getCurrentBaby();
    if (!currentBaby) {
      wx.reLaunch({
        url: '/pages/baby-create/baby-create'
      });
      return;
    }
    
    // [v4.1] 校验当前宝宝归属当前家庭
    if (currentBaby.familyId && currentBaby.familyId !== userInfo.familyId) {
      StorageUtil.saveCurrentBaby(null);
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    
    // FR-3: 应用初始筛选（如果有）
    const initialData = { currentBaby };
    if (this._initialFilter !== undefined) {
      initialData.currentFilter = this._initialFilter;
      delete this._initialFilter; // 只应用一次
    }

    // 计算编辑权限（使用 ensureUserReady 返回的数据）
    initialData.canEdit = PermissionUtil.canEdit(userInfo._id, familyInfo);

    // 默认日期筛选为"今天"
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    initialData.dateRange = { start: todayStart.getTime(), end: null };
    initialData.dateRangeText = '今天';
    
    this.setData(initialData);
    
    // init 完成后主动加载数据（避免与 onShow 的竞态问题）
    this._lastLoadTime = Date.now();
    this.loadData(true);
  },

  /**
   * 加载数据
   */
  async loadData(refresh = false) {
    if (!this.data.currentBaby) return;

    if (refresh) {
      this.setData({
        loading: true,
        page: 0,
        hasMore: true
      });
    }

    try {
      const recordService = this._recordService;
      const { currentFilter, filters, page, pageSize, dateRange } = this.data;
      
      // 使用映射表将中文筛选名称转换为英文 recordType
      const filterName = filters[currentFilter];
      const recordType = FILTER_TYPE_MAP[filterName];
      
      const options = {
        recordType,
        skip: page * pageSize,
        limit: pageSize
      };
      
      // 添加日期筛选
      if (dateRange.start) {
        options.startDate = dateRange.start;
      }
      if (dateRange.end) {
        options.endDate = dateRange.end;
      }
      
      const records = await recordService.getRecords(
        this.data.currentBaby._id,
        options
      );

      const updateData = {
        records: refresh ? records : [...this.data.records, ...records],
        loading: false,
        hasMore: records.length === pageSize,
        page: page + 1
      };

      // 合并今日速览到同一次 setData（仅在 refresh 时计算）
      if (refresh) {
        updateData.todaySummaryText = this._buildTodaySummaryFromRecords(records);
      }

      this.setData(updateData);
      
      // 加载统计数据
      if (refresh) {
        // 仅保留趋势数据加载（由洞察区组件处理）
      }
      
      // 计算筛选计数
      this.calculateFilterCounts();
      
      // 任务 4.3: 从分享链接进入时自动打开报告弹窗
      if (this._showReportOnReady) {
        this._showReportOnReady = false;
        // 延迟 500ms 等待数据加载完成
        setTimeout(() => {
          this.setData({ showReportPopup: true });
        }, 500);
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  /**
   * 加载统计数据（近7天）
   */
  async loadStats() {
    try {
      const recordService = this._recordService;
      const babyId = this.data.currentBaby._id;
      
      // 计算7天前的日期
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      // 获取近7天所有记录
      const records = await recordService.getRecords(babyId, {
        startDate: sevenDaysAgo.getTime(),
        endDate: now.getTime(),
        limit: 500
      });
      
      // 计算统计数据
      const stats = this.calculateStats(records, sevenDaysAgo, now);
      
      // 格式化日期范围
      const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
      const statsPeriod = `${formatDate(sevenDaysAgo)} - ${formatDate(now)}`;
      
      this.setData({ stats, statsPeriod });
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  },

  /**
   * 计算统计数据
   */
  calculateStats(records, startDate, endDate) {
    const stats = {
      feeding: { totalCount: 0, avgCount: 0, dailyRecords: {} },
      sleep: { totalMinutes: 0, avgHours: 0, dailyRecords: {} },
      diaper: { totalCount: 0, wetCount: 0, dirtyCount: 0, dailyRecords: {} },
      temperature: { count: 0, latest: null, records: [] }
    };
    
    // 初始化每日记录
    const days = 7;
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = this.formatDateKey(date);
      stats.feeding.dailyRecords[dateKey] = 0;
      stats.sleep.dailyRecords[dateKey] = 0;
      stats.diaper.dailyRecords[dateKey] = 0;
    }
    
    // 遍历记录
    records.forEach(record => {
      const type = record.recordType || record.type;
      const data = record.data || record;
      const timestamp = record.startTime || record.timestamp;
      const dateKey = this.formatDateKey(new Date(timestamp));
      
      switch (type) {
        case 'feeding':
          stats.feeding.totalCount++;
          if (stats.feeding.dailyRecords[dateKey] !== undefined) {
            stats.feeding.dailyRecords[dateKey]++;
          }
          break;
          
        case 'sleep':
          if (data.duration) {
            // duration 存储的是秒，转换为分钟
            const durationMinutes = Math.floor(data.duration / 60);
            stats.sleep.totalMinutes += durationMinutes;
            if (stats.sleep.dailyRecords[dateKey] !== undefined) {
              stats.sleep.dailyRecords[dateKey] += durationMinutes;
            }
          }
          break;
          
        case 'diaper':
          stats.diaper.totalCount++;
          if (data.diaperType === 'pee' || data.diaperType === 'both') {
            stats.diaper.wetCount++;
          }
          if (data.diaperType === 'poop' || data.diaperType === 'both') {
            stats.diaper.dirtyCount++;
          }
          if (stats.diaper.dailyRecords[dateKey] !== undefined) {
            stats.diaper.dailyRecords[dateKey]++;
          }
          break;
          
        case 'temperature':
          stats.temperature.count++;
          stats.temperature.records.push({
            value: data.temperature,
            time: timestamp
          });
          break;
      }
    });
    
    // 计算平均值
    stats.feeding.avgCount = (stats.feeding.totalCount / days).toFixed(1);
    stats.sleep.totalHours = (stats.sleep.totalMinutes / 60).toFixed(1);
    stats.sleep.avgHours = (stats.sleep.totalMinutes / 60 / days).toFixed(1);
    
    // 获取最近体温
    if (stats.temperature.records.length > 0) {
      stats.temperature.records.sort((a, b) => b.time - a.time);
      stats.temperature.latest = stats.temperature.records[0].value;
    }
    
    return stats;
  },

  /**
   * 加载今日统计数据
   */
  async loadTodayStats() {
    try {
      const recordService = this._recordService;
      const babyId = this.data.currentBaby._id;
      
      // 获取今日时间范围
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // 格式化今日日期
      const todayDate = `${now.getMonth() + 1}月${now.getDate()}日`;
      
      // 获取今日所有记录
      const records = await recordService.getRecords(babyId, {
        startDate: todayStart.getTime(),
        endDate: now.getTime(),
        limit: 200
      });
      
      // 计算今日统计
      const todayStats = {
        feedingCount: 0,
        feedingAmount: 0,
        sleepHours: 0,
        diaperCount: 0,
        temperature: null
      };
      
      records.forEach(record => {
        const type = record.recordType || record.type;
        const data = record.data || record;
        
        switch (type) {
          case 'feeding':
            todayStats.feedingCount++;
            if (data.amount) {
              todayStats.feedingAmount += data.amount;
            }
            break;
          case 'sleep':
            if (data.duration) {
              // duration 存储的是秒，转换为小时
              todayStats.sleepHours += data.duration / 3600;
            }
            break;
          case 'diaper':
            todayStats.diaperCount++;
            break;
          case 'temperature':
            if (data.temperature) {
              todayStats.temperature = data.temperature;
            }
            break;
        }
      });
      
      // 格式化数值
      todayStats.sleepHours = todayStats.sleepHours.toFixed(1);
      todayStats.feedingAmount = Math.round(todayStats.feedingAmount);
      
      this.setData({ todayStats, todayDate });
    } catch (error) {
      console.error('加载今日统计失败:', error);
    }
  },

  /**
   * 计算各类型筛选计数
   * BUG-20: 从数据库分别 count 各类型，而非基于已加载（有限制）的数据
   * 优化：30s 缓存，仅在刷新且缓存过期时重新计算
   */
  async calculateFilterCounts() {
    const { currentBaby, dateRange } = this.data;
    if (!currentBaby) return;

    // 30s 缓存检查
    const now = Date.now();
    if (this._filterCountsTime && now - this._filterCountsTime < 30000) return;

    try {
      const db = wx.cloud.database();
      // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
      const familyInfo = StorageUtil.getFamilyInfo();
      const baseWhere = { babyId: currentBaby._id, familyId: familyInfo?._id || '' };
      
      // 添加日期筛选
      if (dateRange.start) {
        baseWhere.startTime = db.command.gte(dateRange.start);
      }
      if (dateRange.end) {
        if (baseWhere.startTime) {
          baseWhere.startTime = db.command.gte(dateRange.start).and(db.command.lte(dateRange.end));
        } else {
          baseWhere.startTime = db.command.lte(dateRange.end);
        }
      }

      const types = ['feeding', 'sleep', 'diaper', 'temperature', 'growth'];
      
      // 并行查询各类型计数
      const [totalRes, ...typeRes] = await Promise.all([
        db.collection('records').where(baseWhere).count(),
        ...types.map(t => db.collection('records').where({ ...baseWhere, recordType: t }).count())
      ]);

      const counts = [
        totalRes.total,
        typeRes[0].total,
        typeRes[1].total,
        typeRes[2].total,
        typeRes[3].total,
        typeRes[4].total
      ];
      
      this.setData({ filterCounts: counts });
      this._filterCountsTime = Date.now();
    } catch (error) {
      // 降级：基于已加载数据计算（兼容离线场景）
      const counts = [0, 0, 0, 0, 0, 0];
      const { records } = this.data;
      counts[0] = records.length;
      records.forEach(record => {
        const type = record.recordType || record.type;
        switch (type) {
          case 'feeding': counts[1]++; break;
          case 'sleep': counts[2]++; break;
          case 'diaper': counts[3]++; break;
          case 'temperature': counts[4]++; break;
          case 'growth': counts[5]++; break;
        }
      });
      this.setData({ filterCounts: counts });
    }
  },

  /**
   * 格式化日期键
   */
  formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  /**
   * 构建今日速览副标题文案
   * @param {Array} todayRecords - 今日记录数组
   * @returns {string} 副标题文案
   */
  buildTodaySummaryText(todayRecords) {
    if (!todayRecords || todayRecords.length === 0) {
      return '尚未添加今日记录';
    }

    const total = todayRecords.length;
    const typeCounts = {};
    todayRecords.forEach(record => {
      const type = record.recordType || record.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const typeLabels = [
      { key: 'feeding',     label: '喂养' },
      { key: 'sleep',       label: '睡眠' },
      { key: 'diaper',      label: '排便' },
      { key: 'temperature', label: '体温' },
      { key: 'growth',      label: '生长' }
    ];

    const parts = typeLabels
      .filter(t => typeCounts[t.key] > 0)
      .map(t => `${t.label} ${typeCounts[t.key]}`);

    return `今日 ${total} 条 · ${parts.join('  ')}`;
  },

  /**
   * 从已加载记录中过滤今日数据并构建摘要文案
   * 纯函数，不调用 setData，不发起网络请求
   * @param {Array} records - loadData() 返回的记录数组
   * @returns {string} 副标题文案
   */
  _buildTodaySummaryFromRecords(records) {
    const { dateRange } = this.data;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const isDateFilterActive = dateRange.start !== null;
    const isFilterIncludesToday = !isDateFilterActive ||
      (dateRange.start <= now.getTime() && (!dateRange.end || dateRange.end >= todayStart));

    if (isDateFilterActive && !isFilterIncludesToday) {
      return '宝宝的日常养护记录';
    }

    const todayRecords = records.filter(r => {
      const timestamp = r.startTime || r.timestamp || r.createTime;
      return timestamp >= todayStart;
    });

    return this.buildTodaySummaryText(todayRecords);
  },

  /**
   * 切换筛选
   */
  onFilterChange(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ currentFilter: index });
    this.loadData(true);
  },

  /**
   * 显示日期选择器
   */
  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  /**
   * 隐藏日期选择器
   */
  hideDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 选择日期范围
   */
  onDateRangeSelect(e) {
    const { range } = e.currentTarget.dataset;
    
    let dateRange = { start: null, end: null };
    let dateRangeText = '全部时间';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case 'today':
        dateRange.start = today.getTime();
        dateRange.end = now.getTime();
        dateRangeText = '今天';
        break;
        
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateRange.start = weekAgo.getTime();
        dateRange.end = now.getTime();
        dateRangeText = '最近7天';
        break;
        
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateRange.start = monthAgo.getTime();
        dateRange.end = now.getTime();
        dateRangeText = '最近30天';
        break;
        
      case 'all':
        dateRange = { start: null, end: null };
        dateRangeText = '全部时间';
        break;
    }
    
    this.setData({
      dateRange,
      dateRangeText,
      showDatePicker: false
    });
    
    this.loadData(true);
  },

  /**
   * 上拉加载更多
   */
  async onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      await this.loadData(false);
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadData(true);
    wx.stopPullDownRefresh();
  },

  /**
   * 点击记录
   */
  onRecordTap(e) {
    const { record } = e.detail;
    this.setData({
      selectedRecord: record,
      showActionSheet: true
    });
  },

  /**
   * 长按记录
   */
  onRecordLongPress(e) {
    const { record } = e.detail;
    this.setData({
      selectedRecord: record,
      showActionSheet: true
    });
  },

  /**
   * 查看记录详情
   * BUG-15: record-detail 页面不存在，改为弹窗展示
   */
  viewRecordDetail() {
    this.setData({ 
      showActionSheet: false,
      showDetailPopup: true
    });
  },

  /**
   * 关闭详情弹窗
   */
  hideDetailPopup() {
    this.setData({ showDetailPopup: false });
  },

  /**
   * 编辑记录
   */
  editRecord() {
    // 权限检查：viewer 不能编辑
    if (!this.data.canEdit) {
      this.setData({ showActionSheet: false });
      wx.showToast({ title: '仅查看权限，无法编辑', icon: 'none' });
      return;
    }
    
    const { selectedRecord } = this.data;
    this.setData({ showActionSheet: false });
    
    // BUG-4: 兼容 recordType（新）和 type（旧）字段名
    const type = selectedRecord.recordType || selectedRecord.type;
    
    const showMap = {
      feeding: 'showFeedingPopup',
      sleep: 'showSleepPopup',
      diaper: 'showDiaperPopup',
      temperature: 'showTemperaturePopup',
      growth: 'showGrowthPopup'
    };
    
    const showKey = showMap[type];
    if (showKey) {
      this.setData({ [showKey]: true });
    }
  },

  /**
   * 删除记录
   */
  async deleteRecord() {
    const { selectedRecord } = this.data;
    
    const res = await wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmColor: ThemeManager.getConfirmColor('danger')
    });
    
    if (!res.confirm) {
      this.setData({ showActionSheet: false });
      return;
    }
    
    try {
      wx.showLoading({ title: '删除中...' });
      
      const recordService = this._recordService;
      await recordService.deleteRecord(selectedRecord._id);
      
      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      this.setData({ showActionSheet: false });
      this.loadData(true);
    } catch (error) {
      wx.hideLoading();
      console.error('删除失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  /**
   * 关闭操作菜单
   */
  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  /**
   * 切换悬浮菜单
   */
  toggleFabMenu() {
    this.setData({ showFabMenu: !this.data.showFabMenu });
  },

  /**
   * 隐藏悬浮菜单
   */
  hideFabMenu() {
    this.setData({ showFabMenu: false });
  },

  /**
   * 悬浮按钮添加记录
   */
  onFabAdd(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ showFabMenu: false });
    
    switch (type) {
      case 'feeding':
        this.setData({ showFeedingPopup: true });
        break;
      case 'sleep':
        this.setData({ showSleepPopup: true });
        break;
      case 'diaper':
        this.setData({ showDiaperPopup: true });
        break;
      case 'temperature':
        this.setData({ showTemperaturePopup: true });
        break;
      case 'growth':
        this.setData({ showGrowthPopup: true });
        break;
    }
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
   * 关闭生长弹窗
   */
  closeGrowthPopup() {
    this.setData({ showGrowthPopup: false });
  },

  /**
   * 记录创建成功回调
   */
  onRecordCreated() {
    this.loadData(true);
  },

  /**
   * 显示成长报告弹窗
   */
  showReportPopup() {
    this.setData({ showReportPopup: true });
  },

  /**
   * 关闭成长报告弹窗
   */
  closeReportPopup() {
    this.setData({ showReportPopup: false });
  },

  /**
   * 分享图准备完成
   */
  onShareReady(e) {
    const { imagePath, babyName } = e.detail;
    this.setData({ 
      shareImagePath: imagePath,
      shareBabyName: babyName
    });
  },

  /**
   * 分享给好友（任务 4.1: 分享路径带参数）
   */
  onShareAppMessage() {
    const { shareImagePath, shareBabyName, currentBaby } = this.data;
    
    // 获取当前报告周期
    const reportPopup = this.selectComponent('#reportPopup');
    const period = reportPopup?.data?.currentPeriod || 'week';
    
    return {
      title: `${shareBabyName || currentBaby?.name || '宝宝'}的成长报告`,
      path: `/pages/record/record?showReport=1&period=${period}`,
      imageUrl: shareImagePath
    };
  },

  onShareTimeline() {
    const { shareBabyName, currentBaby } = this.data;
    return {
      title: `${shareBabyName || currentBaby?.name || '宝宝'}的成长报告`,
      imageUrl: '/images/share-default.png'
    };
  },

  // ========== 批量管理模式 ==========

  /**
   * 进入/退出管理模式
   */
  toggleManageMode() {
    const manageMode = !this.data.manageMode;
    
    if (!manageMode) {
      // 从管理模式切回正常模式 → 刷新数据（管理期间可能有删除操作）
      this.setData({ manageMode, selectedRecords: [] });
      this.loadData(true);
      return;
    }

    this.setData({
      manageMode,
      selectedRecords: []
    });
  },

  /**
   * 选择/取消选择记录
   */
  onRecordSelect(e) {
    const { recordId, selected } = e.detail;
    
    let { selectedRecords } = this.data;
    
    if (selected) {
      selectedRecords = [...selectedRecords, recordId];
    } else {
      selectedRecords = selectedRecords.filter(id => id !== recordId);
    }
    
    this.setData({ selectedRecords });
  },

  /**
   * 全选当前筛选结果
   */
  selectAllVisible() {
    const allIds = this.data.records.map(r => r._id);
    const allSelected = this.data.selectedRecords.length === allIds.length;
    
    this.setData({
      selectedRecords: allSelected ? [] : allIds
    });
  },

  /**
   * 批量删除
   *
   * [v4.3.1 FR-13] 归属校验：
   * - editor 只能删自己创建的记录，对他人记录跳过（不等云端拒绝再回滚缓存，避免 UI 闪烁）
   * - admin 全删，行为无变化
   * - 全部被跳过时提示用户，不发起任何云端调用
   */
  async batchDelete() {
    const { selectedRecords, records } = this.data;

    if (selectedRecords.length === 0) return;

    // 按 _id 建立索引（records 结构可能含当前筛选结果的全部记录）
    const recordMap = new Map();
    (records || []).forEach(r => recordMap.set(r._id, r));

    // 按归属分桶
    const deletable = [];
    const skipped = [];
    selectedRecords.forEach(id => {
      const rec = recordMap.get(id);
      if (!rec) {
        // 列表中找不到记录（如被其他人删了）→ 跳过
        skipped.push(id);
        return;
      }
      if (PermissionGuard.checkCanDelete(rec)) {
        deletable.push(id);
      } else {
        skipped.push(id);
      }
    });

    if (deletable.length === 0) {
      wx.showToast({ title: '选中记录均无权限删除', icon: 'none' });
      return;
    }

    const confirmContent = skipped.length > 0
      ? `将删除 ${deletable.length} 条，其中 ${skipped.length} 条他人记录已跳过。确定继续吗？`
      : `确定删除选中的 ${deletable.length} 条记录吗？删除后无法恢复。`;

    const res = await wx.showModal({
      title: '确认删除',
      content: confirmContent,
      confirmColor: ThemeManager.getConfirmColor('neutral')
    });

    if (!res.confirm) return;

    wx.showLoading({ title: '删除中...' });

    try {
      const recordService = this._recordService;

      // 使用 batchExecute 限制并发（避免云 DB 限流）
      await batchExecute(deletable, id => recordService.deleteRecord(id));

      wx.hideLoading();
      wx.showToast({
        title: skipped.length > 0
          ? `已删 ${deletable.length}，跳过 ${skipped.length}`
          : '删除成功',
        icon: 'success'
      });

      // 退出管理模式并刷新
      this.setData({ manageMode: false, selectedRecords: [] });
      this.loadData(true);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'error' });
      console.error('批量删除失败:', error);
    }
  },

  /** 应用当前主题 */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },
});
