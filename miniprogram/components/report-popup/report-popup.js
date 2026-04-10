/**
 * 成长报告弹窗组件
 * 支持周报/月报生成、AI评语、分享功能
 * 
 * 优化版本：
 * - Canvas 绘制逻辑迁移到 ShareCanvasService
 * - 动态高度计算，适应不同长度的 AI 评语
 * - DPR 限制为 2，避免内存溢出
 * - 底部操作区支持保存/分享/重新生成
 */

const RecordService = require('../../services/record');
const StorageUtil = require('../../utils/storage');
const ShareCanvasService = require('../../services/share-canvas');
const { parseTimestamp } = require('../../utils/date');
const ReportHelper = require('../../services/reportDataHelper');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    darkMode: {
      type: Boolean,
      value: false
    },
    babyId: {
      type: String,
      value: ''
    }
  },

  data: {
    periodType: 'week',        // 'week' | 'month' - 一级选择
    currentPeriod: 'lastWeek', // 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' - 二级选择
    highlightTitle: '上周亮点', // 动态亮点标题
    reportTitle: '上周',        // 动态报告标题（本周/上周/本月/上月）
    babyInfo: null,
    reportPeriod: '',
    overallScore: 0,
    scoreComment: '',
    scoreLabel: '',
    scoreColorClass: '',
    reportData: {
      feeding: { totalCount: 0, avgCount: 0, totalAmount: 0, trend: 0 },
      sleep: { totalHours: 0, avgHours: 0, trend: 0 },
      diaper: { totalCount: 0, wetCount: 0, dirtyCount: 0 },
      temperature: { count: 0, avgTemp: 0, minTemp: 0, maxTemp: 0 }
    },
    aiComment: '',
    shareImagePath: '',
    lastReportHash: '', // 用于缓存判断
    canvasHeight: 1340, // Canvas 动态高度
    // V2 新增展示数据
    daysSinceBirth: 0,
    indicatorCards: [],   // 四维指标卡数据
    dailyDensity: [],     // 7日密度数据
    growthData: null,
    vaccineData: null,
    milestoneData: null,
    trendData: null,
    achievements: [],     // 本周成就
    briefAIAdvice: '',    // 精简AI建议
  },

  observers: {
    'show, babyId': function(show, babyId) {
      if (show && babyId) {
        this.loadReport();
      }
    }
  },

  lifetimes: {
    attached() {
      this.loadBabyInfo();
      // 延迟预加载图片，避免阻塞首次渲染
      setTimeout(() => this.preloadImages(), 500);
    },
    detached() {
      // 清理图片缓存和生成锁
      this.imageCache = null;
      this._isGenerating = false;
    }
  },

  methods: {
    /**
     * 加载宝宝信息
     */
    loadBabyInfo() {
      const currentBaby = StorageUtil.getCurrentBaby();
      if (currentBaby) {
        const ageText = this.calculateAgeText(currentBaby.birthDate);
        this.setData({
          babyInfo: {
            ...currentBaby,
            ageText
          }
        });
      }
    },

    /**
     * 计算年龄文本
     */
    calculateAgeText(birthDate) {
      if (!birthDate) return '';
      const birth = new Date(birthDate);
      const now = new Date();
      const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      const days = now.getDate() - birth.getDate();
      
      if (months === 0) {
        return `${Math.max(0, days)}天`;
      } else if (months < 12) {
        return days >= 0 ? `${months}个月` : `${months - 1}个月`;
      } else {
        const years = Math.floor(months / 12);
        const remainMonths = months % 12;
        return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`;
      }
    },

    /**
     * 判断宝宝是否有足够的历史数据来做趋势对比
     * 出生第一周（周报）或第一个月（月报）没有前一个周期可比较，返回 false
     * 
     * 判断逻辑：对比周期的起始时间是否不早于出生日期
     *   thisWeek  → 对比周期为上周（出生需 ≥ 上周一）
     *   lastWeek  → 对比周期为上上周（出生需 ≥ 上上周一）
     *   thisMonth → 对比周期为上月（出生需 ≥ 上月1号）
     *   lastMonth → 对比周期为上上月（出生需 ≥ 上上月1号）
     */
    _hasPreviousPeriodData(baby, currentPeriod) {
      if (!baby?.birthDate) return false;

      const birth = new Date(baby.birthDate);
      birth.setHours(0, 0, 0, 0);
      const now = new Date();

      // 获取本周一
      const getWeekStart = (d) => {
        const result = new Date(d);
        result.setHours(0, 0, 0, 0);
        const day = result.getDay();
        const diff = day === 0 ? 6 : day - 1; // 周日算上周第7天
        result.setDate(result.getDate() - diff);
        return result;
      };

      let previousStart;

      switch (currentPeriod) {
        case 'thisWeek': {
          // 对比：上周一
          const thisWeekStart = getWeekStart(now);
          previousStart = new Date(thisWeekStart);
          previousStart.setDate(previousStart.getDate() - 7);
          break;
        }
        case 'lastWeek': {
          // 对比：上上周一
          const thisWeekStart = getWeekStart(now);
          previousStart = new Date(thisWeekStart);
          previousStart.setDate(previousStart.getDate() - 14);
          break;
        }
        case 'thisMonth': {
          // 对比：上月1号
          previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          break;
        }
        case 'lastMonth': {
          // 对比：上上月1号
          previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
          break;
        }
        default:
          return true;
      }

      // 出生日期不晚于对比周期起始日 → 有足够数据
      return birth <= previousStart;
    },

    /**
     * 预加载图片资源（仅预热文件路径，实际 Image 对象在 share-canvas 中按需创建）
     */
    async preloadImages() {
      const images = [
        '/images/icons/feeding-color.png',
        '/images/icons/sleep-color.png',
        '/images/icons/diaper-color.png',
        '/images/icons/temperature.png'
      ];
      
      // 不再缓存路径字符串到 imageCache，因为 Canvas 2D 需要 Image 对象
      // 这里只做预热（让微信提前解析路径），实际加载由 share-canvas._loadImage 完成
      this.imageCache = {};
      
      await Promise.all(
        images.map(src => 
          new Promise((resolve) => {
            wx.getImageInfo({
              src,
              success: () => resolve(true),
              fail: () => resolve(false)
            });
          })
        )
      );
    },

    /**
     * 计算报告数据哈希（用于缓存判断）
     * 注意：aiComment 在 this.data 顶层，不在 reportData 内
     */
    hashReportData() {
      const { feeding, sleep, diaper, temperature } = this.data.reportData;
      const { aiComment } = this.data; // 修复 C3: aiComment 从顶层读取
      const hashObj = {
        feeding: { count: feeding.totalCount, amount: feeding.totalAmount },
        sleep: { hours: sleep.totalHours },
        diaper: { count: diaper.totalCount },
        temperature: { count: temperature.count },
        aiComment: aiComment ? aiComment.substring(0, 50) : '',
        period: this.data.currentPeriod,
        babyId: this.data.babyInfo?._id
      };
      
      return JSON.stringify(hashObj);
    },

    /**
     * 切换报告类型（一级：周报/月报）
     */
    onPeriodTypeChange(e) {
      const { type } = e.currentTarget.dataset;
      if (type === this.data.periodType) return;
      
      // 切换类型时自动选中对应的默认子选项
      const defaultPeriod = type === 'week' ? 'lastWeek' : 'thisMonth';
      this.setData({ 
        periodType: type,
        currentPeriod: defaultPeriod,
        shareImagePath: '',
        lastReportHash: ''
      });
      this.loadReport();
    },

    /**
     * 切换具体周期（二级：本周/上周 或 本月/上月）
     */
    onPeriodChange(e) {
      const { period } = e.currentTarget.dataset;
      if (period === this.data.currentPeriod) return;
      
      this.setData({ 
        currentPeriod: period,
        shareImagePath: '',
        lastReportHash: ''
      });
      this.loadReport();
    },

    /**
     * 加载报告数据
     */
    async loadReport() {
      wx.showLoading({ title: '生成报告中...' });
      
      try {
        const recordService = new RecordService();
        const { currentPeriod, babyId } = this.data;
        
        // 计算时间范围
        const now = new Date();
        let startDate;
        let endDate;
        let days;
        const msPerDay = 24 * 60 * 60 * 1000;
        
        switch (currentPeriod) {
          case 'thisWeek': {
            // 本周：本周一到今天
            startDate = this._getWeekStart(now);
            endDate = now;
            days = Math.floor((now.getTime() - startDate.getTime()) / msPerDay) + 1;
            days = Math.max(days, 1);
            break;
          }
          case 'lastWeek': {
            // 上周：上周一到上周日（完整7天）
            const thisWeekStart = this._getWeekStart(now);
            startDate = new Date(thisWeekStart);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(thisWeekStart.getTime() - 1); // 上周日 23:59:59.999
            days = 7;
            break;
          }
          case 'thisMonth': {
            // 本月：本月1号到今天
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            endDate = now;
            days = Math.floor((now.getTime() - startDate.getTime()) / msPerDay) + 1;
            days = Math.max(days, 1);
            break;
          }
          case 'lastMonth': {
            // 上月：上月1号到上月最后一天
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            startDate = lastMonthStart;
            endDate = new Date(thisMonthStart.getTime() - 1); // 上月最后一天 23:59:59.999
            days = Math.floor((thisMonthStart.getTime() - lastMonthStart.getTime()) / msPerDay);
            days = Math.max(days, 1);
            break;
          }
          default: {
            // 兜底：上周
            const wsStart = this._getWeekStart(now);
            startDate = new Date(wsStart);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(wsStart.getTime() - 1);
            days = 7;
          }
        }
        
        // 保存起始日期，供 getDayIndex 使用
        this._reportStartDate = startDate;
        
        // 获取记录
        const records = await recordService.getRecords(babyId, {
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
          limit: 1000
        });
        
        // 计算报告数据
        const reportData = this.calculateReportData(records, days);
        
        // 预计算趋势显示文字和 CSS 类名（减少 WXML 层三元表达式）
        reportData.feeding.trendText = reportData.feeding.trend > 0 ? '↑ 上升' : reportData.feeding.trend < 0 ? '↓ 下降' : '— 平稳';
        reportData.feeding.trendClass = reportData.feeding.trend > 0 ? 'up' : reportData.feeding.trend < 0 ? 'down' : '';
        reportData.sleep.trendText = reportData.sleep.trend > 0 ? '↑ 增加' : reportData.sleep.trend < 0 ? '↓ 减少' : '— 平稳';
        reportData.sleep.trendClass = reportData.sleep.trend > 0 ? 'up' : reportData.sleep.trend < 0 ? 'down' : '';
        
        // 计算综合评分
        const { score, comment } = this.calculateScore(reportData, days);
        
        // 生成 AI 评语
        const aiComment = this.generateAIComment(reportData, days);
        
        // 格式化日期范围
        const formatDate = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
        const reportPeriod = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        
        // === V2 新增：并行查询额外数据 ===
        const db = wx.cloud.database();
        const baby = this.data.babyInfo;
        
        const [growthResult, vaccineResult, milestoneResult, todoStats] = 
          await Promise.all([
            // 最近一条生长记录
            db.collection('records')
              .where({ babyId, recordType: 'growth' })
              .orderBy('startTime', 'desc')
              .limit(1)
              .get()
              .catch(() => ({ data: [] })),
            
            // 已接种疫苗记录
            db.collection('vaccine_records')
              .where({ babyId })
              .get()
              .catch(() => ({ data: [] })),
            
            // 已达成里程碑
            db.collection('milestone_records')
              .where({ babyId })
              .get()
              .catch(() => ({ data: [] })),
            
            // 待办统计（含疫苗+里程碑）
            require('../../services/todo').getTodoStats(baby)
              .catch(() => null),
          ]);
        
        // 处理生长数据
        let growthData = null;
        if (growthResult.data.length > 0) {
          const g = growthResult.data[0];
          const nowTime = new Date();
          const { parseTimestamp } = require('../../utils/date');
          const recordDate = parseTimestamp(g.startTime) || new Date(g.startTime);
          const daysSince = Math.floor((nowTime - recordDate) / 86400000);
          
          growthData = {
            weight: g.data?.weight || null,
            height: g.data?.height || null,
            daysSinceRecord: daysSince,
            weightPercentile: this._calcPercentile('weight', g.data?.weight, baby),
            heightPercentile: this._calcPercentile('height', g.data?.height, baby),
          };
        }
        
        // 处理疫苗数据
        let vaccineData = null;
        const { calculateAgeMonths } = require('../../utils/date');
        const babyAgeMonths = baby?.birthDate ? calculateAgeMonths(baby.birthDate) : 0;
        
        if (babyAgeMonths >= 1) {
          const doneCount = vaccineResult.data.length;
          const totalVaccines = todoStats 
            ? doneCount + (todoStats.vaccine || 0)
            : doneCount;
          
          vaccineData = {
            done: doneCount,
            total: totalVaccines,
            overdue: todoStats?.overdue || 0,
          };
        }
        
        // 处理里程碑数据
        let milestoneData = null;
        if (milestoneResult.data.length > 0 || todoStats?.milestoneItems?.length > 0) {
          milestoneData = {
            achieved: milestoneResult.data.map(m => m.name),
            nextPending: todoStats?.milestoneItems?.[0]?.name || null,
          };
        }
        
        // 获取趋势数据（根据当前选择的周期）
        // 出生第一周/第一个月没有前一个周期的对比数据，跳过趋势计算
        let trendData = null;
        const TrendService = require('../../services/trendService');
        const hasPreviousPeriod = this._hasPreviousPeriodData(baby, currentPeriod);
        if (hasPreviousPeriod) {
          try {
            const trendInstance = TrendService.getInstance();
            const result = await trendInstance.getTrendDataForPeriod(babyId, currentPeriod);
            trendData = result.trendData;
          } catch (e) {
            console.warn('趋势数据获取失败:', e);
          }
        } else {
          console.log('宝宝出生时间不足，跳过趋势对比');
        }
        
        // === V2 弹窗展示数据计算（使用共用模块） ===
        
        // 出生天数
        let daysSinceBirth = 0;
        if (baby?.birthDate) {
          const birth = new Date(baby.birthDate);
          daysSinceBirth = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
        }
        
        // 评分等级（共用）
        const scoreLabel = ReportHelper.getScoreLabel(score);
        const scoreColorClass = ReportHelper.getScoreColorClass(score);
        
        // 四维指标卡计算（共用）
        const indicatorCards = ReportHelper.buildIndicatorCards(reportData, trendData, baby, days);
        
        // 每日密度数据（共用，传入起始日期用于正确的星期标签）
        const dailyDensity = ReportHelper.buildDailyDensity(reportData, startDate);
        
        // 本周成就（共用）
        const achievements = ReportHelper.buildAchievements({ reportData, trendData, vaccineData, indicatorCards, days });
        
        // 精简AI建议（共用，弹窗限 80 字）
        const briefAIAdvice = ReportHelper.truncateAIAdvice(aiComment, 80);

        // 动态亮点标题
        const highlightTitleMap = {
          'thisWeek': '本周亮点',
          'lastWeek': '上周亮点',
          'thisMonth': '本月亮点',
          'lastMonth': '上月亮点',
        };
        const highlightTitle = highlightTitleMap[currentPeriod] || '亮点';

        // 动态报告标题（用于成绩单主标题）
        const reportTitleMap = {
          'thisWeek': '本周',
          'lastWeek': '上周',
          'thisMonth': '本月',
          'lastMonth': '上月',
        };
        const reportTitle = reportTitleMap[currentPeriod] || '一周';

        this.setData({
          reportData,
          overallScore: score,
          scoreComment: comment,
          scoreLabel,
          scoreColorClass,
          aiComment,
          reportPeriod,
          highlightTitle,
          reportTitle,
          shareImagePath: '',
          // V2 新增
          daysSinceBirth,
          indicatorCards,
          dailyDensity,
          growthData,
          vaccineData,
          milestoneData,
          trendData,
          achievements,
          briefAIAdvice,
        });
        
        wx.hideLoading();
      } catch (error) {
        wx.hideLoading();
        console.error('加载报告失败:', error);
        wx.showToast({ title: '加载失败', icon: 'error' });
      }
    },

    /**
     * 计算报告数据
     */
    calculateReportData(records, days) {
      const data = {
        feeding: { totalCount: 0, avgCount: 0, totalAmount: 0, trend: 0, dailyRecords: [] },
        sleep: { totalMinutes: 0, avgHours: 0, trend: 0, dailyRecords: [] },
        diaper: { totalCount: 0, wetCount: 0, dirtyCount: 0, dailyRecords: [] },
        temperature: { count: 0, avgTemp: 0, minTemp: 99, maxTemp: 35, records: [] }
      };
      
      // 初始化每日记录
      for (let i = 0; i < days; i++) {
        data.feeding.dailyRecords.push(0);
        data.sleep.dailyRecords.push(0);
        data.diaper.dailyRecords.push(0);
      }
      
      // 遍历记录
      records.forEach(record => {
        const type = record.recordType || record.type;
        const recordData = record.data || record;
        const timestamp = record.startTime || record.timestamp;
        const dayIndex = this.getDayIndex(timestamp, days);
        
        if (dayIndex < 0 || dayIndex >= days) return;

        switch (type) {
          case 'feeding':
            data.feeding.totalCount++;
            data.feeding.dailyRecords[dayIndex]++;
            // 只统计配方奶的奶量（母乳没有 amount，辅食不算奶量）
            if (recordData.feedingType === 'formula' && recordData.amount) {
              data.feeding.totalAmount += Number(recordData.amount) || 0;
            }
            break;
            
          case 'sleep':
            if (recordData.duration) {
              // duration 存储的是秒，转换为分钟
              const durationMinutes = Math.floor(recordData.duration / 60);
              data.sleep.totalMinutes += durationMinutes;
              data.sleep.dailyRecords[dayIndex] += durationMinutes;
            }
            break;
            
          case 'diaper':
            data.diaper.totalCount++;
            data.diaper.dailyRecords[dayIndex]++;
            if (recordData.diaperType === 'pee' || recordData.diaperType === 'both') {
              data.diaper.wetCount++;
            }
            if (recordData.diaperType === 'poop' || recordData.diaperType === 'both') {
              data.diaper.dirtyCount++;
            }
            break;
            
          case 'temperature':
            data.temperature.count++;
            data.temperature.records.push(recordData.temperature);
            data.temperature.minTemp = Math.min(data.temperature.minTemp, recordData.temperature);
            data.temperature.maxTemp = Math.max(data.temperature.maxTemp, recordData.temperature);
            break;
        }
      });
      
      // 计算平均值
      data.feeding.avgCount = (data.feeding.totalCount / days).toFixed(1);
      data.sleep.totalHours = (data.sleep.totalMinutes / 60).toFixed(1);
      data.sleep.avgHours = (data.sleep.totalMinutes / 60 / days).toFixed(1);
      
      if (data.temperature.count > 0) {
        const sum = data.temperature.records.reduce((a, b) => a + b, 0);
        data.temperature.avgTemp = (sum / data.temperature.count).toFixed(1);
      }
      
      // 计算趋势（后半段 vs 前半段）
      const half = Math.floor(days / 2);
      data.feeding.trend = this.calculateTrend(data.feeding.dailyRecords, half);
      data.sleep.trend = this.calculateTrend(data.sleep.dailyRecords, half);
      
      return data;
    },

    /**
     * 安全地解析时间戳（代理到 utils/date.parseTimestamp）
     */
    parseTimestamp(timestamp) {
      return parseTimestamp(timestamp);
    },

    /**
     * 获取本周开始时间（周一 00:00:00）
     * 逻辑与 trendService.getWeekStart 一致
     */
    _getWeekStart(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    },

    /**
     * 获取日期索引（基于报告起始日期）
     */
    getDayIndex(timestamp, days) {
      const date = this.parseTimestamp(timestamp);
      if (!date) return -1; // 返回无效索引
      
      const start = this._reportStartDate;
      if (!start) return -1;
      
      // 将 date 归零到当天 00:00，再计算与 startDate 的天数差
      const dateDay = new Date(date);
      dateDay.setHours(0, 0, 0, 0);
      
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      
      const diff = Math.floor((dateDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    },

    /**
     * 计算趋势
     */
    calculateTrend(dailyRecords, half) {
      const firstHalf = dailyRecords.slice(0, half);
      const secondHalf = dailyRecords.slice(half);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const diff = secondAvg - firstAvg;
      if (diff > 0.5) return 1;
      if (diff < -0.5) return -1;
      return 0;
    },

    /**
     * 计算综合评分
     */
    calculateScore(reportData, days) {
      let score = 60;
      let comments = [];
      
      // 喂养评分
      const avgFeeding = reportData.feeding.totalCount / days;
      if (avgFeeding >= 6 && avgFeeding <= 10) {
        score += 10;
      } else if (avgFeeding >= 5 && avgFeeding <= 12) {
        score += 5;
      } else {
        comments.push('喂养频率需要注意');
      }
      
      // 睡眠评分
      const avgSleepHours = reportData.sleep.totalMinutes / 60 / days;
      if (avgSleepHours >= 12 && avgSleepHours <= 16) {
        score += 15;
      } else if (avgSleepHours >= 10 && avgSleepHours <= 18) {
        score += 8;
      } else {
        comments.push('睡眠时长需要关注');
      }
      
      // 排便评分
      const avgDiaper = reportData.diaper.totalCount / days;
      if (avgDiaper >= 4 && avgDiaper <= 8) {
        score += 10;
      } else if (avgDiaper >= 3 && avgDiaper <= 10) {
        score += 5;
      } else {
        comments.push('排便频率需要关注');
      }
      
      // 趋势评分
      if (reportData.feeding.trend >= 0) score += 5;
      if (reportData.sleep.trend >= 0) score += 5;
      
      score = Math.min(100, Math.max(0, score));
      
      let comment = '';
      if (score >= 90) {
        comment = '宝宝状态非常好，继续保持！';
      } else if (score >= 80) {
        comment = '宝宝状态良好，继续保持日常照护';
      } else if (score >= 70) {
        comment = '宝宝状态正常，部分指标可优化';
      } else if (score >= 60) {
        comment = '宝宝状态一般，建议关注相关指标';
      } else {
        comment = '宝宝状态需要关注，建议咨询医生';
      }
      
      if (comments.length > 0) {
        comment += `（${comments.join('、')}）`;
      }
      
      return { score, comment };
    },

    /**
     * 生成 AI 评语
     */
    generateAIComment(reportData, days) {
      const comments = [];
      const avgSleepHours = reportData.sleep.totalMinutes / 60 / days;
      const avgFeeding = reportData.feeding.totalCount / days;
      
      // 睡眠建议
      if (avgSleepHours < 10) {
        comments.push('睡眠时长偏少，建议营造安静舒适的睡眠环境，建立规律的作息时间。白天可以适当增加活动量，帮助宝宝晚上更好入睡。');
      } else if (avgSleepHours > 16) {
        comments.push('睡眠时长偏多，建议白天适当增加互动和活动，观察宝宝的精神状态。如持续嗜睡建议咨询医生。');
      } else {
        comments.push('睡眠时长处于正常范围，作息规律对宝宝成长很重要，请继续保持。');
      }
      
      // 喂养建议
      if (avgFeeding < 5) {
        comments.push('喂养次数偏少，建议增加喂养频率，确保宝宝获得足够的营养。如有厌奶情况，可尝试换姿势或环境。');
      } else if (avgFeeding > 12) {
        comments.push('喂养次数较多，可以观察宝宝是否每次都能吃饱，避免频繁少量喂养。');
      } else {
        comments.push('喂养频率正常，保持定时定量的喂养习惯有助于宝宝消化吸收。');
      }
      
      // 排便建议
      const avgDiaper = reportData.diaper.totalCount / days;
      if (avgDiaper < 4) {
        comments.push('排便次数较少，需确保宝宝摄入充足，如持续减少建议咨询医生。');
      }
      
      // 体温建议
      if (reportData.temperature.count > 0) {
        if (reportData.temperature.maxTemp > 37.5) {
          comments.push('期间有发热记录，请注意观察宝宝状态，必要时及时就医。');
        } else {
          comments.push('体温记录正常，继续保持定期测量体温的好习惯。');
        }
      }
      
      return comments.join('\n\n');
    },

    /**
     * 生成分享图（V2 版本）
     * 使用 ShareCanvasService 进行绘制
     */
    async generateShareImage() {
      // 防重复点击
      if (this._isGenerating) return;
      this._isGenerating = true;

      try {
        // 检查缓存 + 文件存在性验证
        const currentHash = this.hashReportData();
        if (this.data.lastReportHash === currentHash && this.data.shareImagePath) {
          try {
            await new Promise((resolve, reject) => {
              wx.getFileInfo({
                filePath: this.data.shareImagePath,
                success: resolve,
                fail: reject
              });
            });
            wx.showToast({ title: '分享图已生成', icon: 'success' });
            return;
          } catch (e) {
            // 文件不存在，继续生成
          }
        }

        wx.showLoading({ title: '生成分享图中...', mask: true });

        // 构建 V2 数据包（统一接口）
        const v2Data = {
          // V1 已有字段
          reportData: this.data.reportData,
          babyInfo: this.data.babyInfo,
          reportPeriod: this.data.reportPeriod,
          overallScore: this.data.overallScore,
          aiComment: this.data.aiComment,
          imageCache: this.imageCache || {},
          // V2 新增字段
          currentPeriod: this.data.currentPeriod || 'lastWeek',
          periodType: this.data.periodType || 'week',
          highlightTitle: this.data.highlightTitle || '亮点',
          growthData: this.data.growthData || null,
          vaccineData: this.data.vaccineData || null,
          milestoneData: this.data.milestoneData || null,
          trendData: this.data.trendData || null,
          reportStartDate: this._reportStartDate || null,
        };

        // 初始化 Canvas 服务
        const shareCanvas = new ShareCanvasService();

        // 先获取一次 Canvas 用于测量文字
        const { canvas, ctx } = await this._initCanvas();

        // V2: 使用统一 data 对象计算高度
        const totalHeight = shareCanvas.calculateCanvasHeight(v2Data, ctx);

        // 更新 Canvas 高度
        this.setData({ canvasHeight: totalHeight });

        // 等待 WXML 更新后重新获取 Canvas
        await new Promise(r => setTimeout(r, 100));
        const { canvas: updatedCanvas, ctx: updatedCtx } = await this._initCanvas();

        // 初始化 Canvas 尺寸
        shareCanvas.initCanvas(updatedCanvas, totalHeight);

        // V2: 使用统一 data 对象绘制
        await shareCanvas.draw(updatedCtx, v2Data);

        // 导出图片
        const imagePath = await shareCanvas.exportImage(updatedCanvas, totalHeight);

        // 更新状态
        this.setData({ 
          shareImagePath: imagePath,
          lastReportHash: currentHash
        });

        // 触发事件
        this.triggerEvent('shareready', { 
          imagePath: imagePath,
          babyName: this.data.babyInfo?.name || '宝宝'
        });

        wx.hideLoading();
        wx.showToast({ title: '生成成功', icon: 'success' });

      } catch (error) {
        console.error('生成分享图失败:', error);
        wx.hideLoading();
        
        this.setData({
          lastReportHash: '',
          shareImagePath: ''
        });
        
        wx.showToast({ title: '生成失败，请重试', icon: 'error' });
      } finally {
        this._isGenerating = false;
      }
    },

    /**
     * 重新生成分享图（任务 3.11）
     */
    regenerateShareImage() {
      this.setData({ 
        shareImagePath: '', 
        lastReportHash: '' 
      });
      this.generateShareImage();
    },

    /**
     * 内部方法：初始化 Canvas
     */
    _initCanvas() {
      return new Promise((resolve, reject) => {
        const query = this.createSelectorQuery();
        query.select('#shareCanvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res[0] || !res[0].node) {
              reject(new Error('Canvas 初始化失败'));
              return;
            }
            
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            
            // 使用 ShareCanvasService 的配置
            const dpr = Math.min(wx.getSystemInfoSync().pixelRatio, 2);
            const canvasHeight = this.data.canvasHeight || 1340;
            
            canvas.width = 750 * dpr;
            canvas.height = canvasHeight * dpr;
            ctx.scale(dpr, dpr);
            
            resolve({ canvas, ctx });
          });
      });
    },

    // ========== 以下绘制方法已迁移到 ShareCanvasService ==========
    // 删除的方法: exportCanvas, drawShareBackground, drawShareHeader,
    // drawShareStats, drawStatCard, drawShareAIComment, wrapText, 
    // drawShareFooter, roundRect, shareToFriend
    // 详见: services/share-canvas.js

    /**
     * 保存到相册（任务 3.12 优化错误处理）
     */
    async saveToAlbum() {
      if (!this.data.shareImagePath) {
        await this.generateShareImage();
      }
      
      if (this.data.shareImagePath) {
        try {
          await wx.saveImageToPhotosAlbum({
            filePath: this.data.shareImagePath
          });
          wx.showToast({ title: '保存成功', icon: 'success' });
        } catch (error) {
          // 任务 3.12: 完善权限拒绝检测
          const errMsg = error.errMsg || '';
          if (errMsg.includes('auth deny') || 
              errMsg.includes('auth denied') || 
              errMsg.includes('authorize no response')) {
            wx.showModal({
              title: '提示',
              content: '需要授权保存图片到相册，请在设置中开启相册权限',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting();
                }
              }
            });
          } else {
            wx.showToast({ title: '保存失败，请重试', icon: 'error' });
          }
        }
      }
    },

    // ========== V2 辅助方法已迁移到 services/reportDataHelper.js ==========
    // 共用方法: getScoreLabel, getScoreColorClass, getStatusText, getStatusClass,
    //           buildIndicatorCards, buildDailyDensity, buildAchievements, truncateAIAdvice

    /**
     * WHO 百分位计算
     * @param {string} type - 'weight' | 'height'
     * @param {number} value - 测量值
     * @param {Object} baby - 宝宝信息
     * @returns {string|null} 'low'|'lowNormal'|'normal'|'highNormal'|'high'
     */
    _calcPercentile(type, value, baby) {
      if (!value || !baby?.birthDate || !baby?.gender) return null;
      
      const { WHO_WEIGHT, WHO_HEIGHT } = require('../../config/who-standards');
      const { calculateAgeMonths } = require('../../utils/date');
      
      const ageMonths = calculateAgeMonths(baby.birthDate);
      const gender = baby.gender === 'male' ? 'Boy' : 'Girl';
      
      const standards = type === 'weight' ? WHO_WEIGHT[gender] : WHO_HEIGHT[gender];
      if (!standards) return null;
      
      // 找到对应月龄的标准（使用 ≤ ageMonths 的最大 key）
      const keys = Object.keys(standards).map(Number).sort((a, b) => a - b);
      let matchedKey = keys[0];
      for (let i = keys.length - 1; i >= 0; i--) {
        if (ageMonths >= keys[i]) { matchedKey = keys[i]; break; }
      }
      
      const std = standards[matchedKey];
      if (!std) return null;
      
      if (value < std.p3)  return 'low';
      if (value < std.p15) return 'lowNormal';
      if (value <= std.p85) return 'normal';
      if (value <= std.p97) return 'highNormal';
      return 'high';
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.triggerEvent('close');
    }
  }
});
