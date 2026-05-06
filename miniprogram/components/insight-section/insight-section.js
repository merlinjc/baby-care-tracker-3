/**
 * 数据洞察区组件
 * 显示本周趋势对比数据
 */

const TrendService = require('../../services/trendService');
const StorageUtil = require('../../utils/storage');
const { calculateAgeMonths } = require('../../utils/date');

Component({
  properties: {
    babyId: {
      type: String,
      value: ''
    },
    darkMode: {
      type: Boolean,
      value: false
    }
  },

  data: {
    expanded: true,
    loading: false,
    trendPeriod: '',
    trendData: {
      feeding: { changePercent: 0, changeValue: 0, isUp: true, thisWeekAvg: 0, lastWeekAvg: 0 },
      sleep: { changePercent: 0, changeValue: 0, isUp: true, thisWeekAvg: 0, lastWeekAvg: 0 },
      diaper: { changePercent: 0, changeValue: 0, isUp: true, thisWeekAvg: 0, lastWeekAvg: 0 },
      temperature: { abnormalCount: 0, latestValue: '--' }
    },
    // 新增：增强趋势数据
    ageMonths: null,
    hasReference: false,
    feedingEnhanced: {
      status: '', statusText: '', statusClass: '',
      reference: null, referenceText: '',
      barPosition: 50, barZone: 'normal',
      tip: '', changeClass: ''
    },
    sleepEnhanced: {
      status: '', statusText: '', statusClass: '',
      reference: null, referenceText: '',
      barPosition: 50, barZone: 'normal',
      tip: '', changeClass: ''
    },
    diaperEnhanced: {
      status: '', statusText: '', statusClass: '',
      reference: null, referenceText: '',
      barPosition: 50, barZone: 'normal',
      tip: '', changeClass: ''
    },
    temperatureEnhanced: {
      status: '', statusText: '', statusClass: '', tip: ''
    }
  },

  lifetimes: {
    // loadTrendData 由 observers['babyId'] 在属性初始化时自动触发，无需 attached 重复调用
    detached() {
      // 清理状态
    }
  },

  observers: {
    'babyId': function(babyId) {
      if (babyId) {
        this.loadTrendData();
      }
    }
  },

  methods: {
    /**
     * 加载趋势数据
     */
    async loadTrendData() {
      if (!this.data.babyId) return;

      this.setData({ loading: true });

      try {
        const trendService = TrendService.getInstance();
        const { trendData, trendPeriod } = await trendService.getTrendData(this.data.babyId);

        // 获取月龄
        const baby = StorageUtil.getCurrentBaby();
        const ageMonths = baby?.birthDate
          ? calculateAgeMonths(baby.birthDate)
          : null;
        const hasReference = ageMonths !== null;

        // 增强四维数据
        const feedingEnhanced = this._enhanceDimension('feeding', trendData.feeding, ageMonths);
        const sleepEnhanced = this._enhanceDimension('sleep', trendData.sleep, ageMonths);
        const diaperEnhanced = this._enhanceDimension('diaper', trendData.diaper, ageMonths);
        const temperatureEnhanced = this._enhanceTemperature(trendData.temperature);

        this.setData({
          trendData,
          trendPeriod,
          ageMonths,
          hasReference,
          feedingEnhanced,
          sleepEnhanced,
          diaperEnhanced,
          temperatureEnhanced,
          loading: false
        });
      } catch (error) {
        console.error('加载趋势数据失败:', error);
        this.setData({ loading: false });
      }
    },

    /**
     * 增强单个维度的趋势数据
     */
    _enhanceDimension(dimension, trend, ageMonths) {
      const value = trend.thisWeekAvg;
      const range = ageMonths !== null
        ? TrendService.getReferenceRange(dimension, ageMonths)
        : null;

      const status = TrendService.calculateStatus(value, range, dimension, {
        lastWeekAvg: trend.lastWeekAvg
      });

      const display = TrendService.getStatusDisplay(status);
      const barInfo = range
        ? TrendService.calculateRangeBarPosition(value, range)
        : null;

      // 参考范围文字
      const unit = dimension === 'sleep' ? 'h' : '次';
      const referenceText = range ? `参考${range.min}-${range.max}${unit}` : '';

      // 环比变化 CSS class
      const changeClass = this._getChangeClass(trend.changePercent, trend.isUp, status);

      return {
        status: status || '',
        statusText: display?.text || '',
        statusClass: status || '',
        reference: range,
        referenceText,
        barPosition: barInfo?.position ?? 50,
        barZone: barInfo?.zone ?? 'normal',
        tip: TrendService.generateTip(dimension, status || 'noData'),
        changeClass
      };
    },

    /**
     * 增强体温维度数据
     */
    _enhanceTemperature(tempData) {
      const hasData = tempData.latestValue !== '--';
      const status = TrendService.calculateStatus(null, null, 'temperature', {
        abnormalCount: tempData.abnormalCount,
        hasData
      });

      const display = TrendService.getStatusDisplay(status);

      return {
        status,
        statusText: display?.text || '',
        statusClass: status || '',
        tip: TrendService.generateTip('temperature', status)
      };
    },

    /**
     * 获取环比变化 CSS class（FR-6）
     */
    _getChangeClass(changePercent, isUp, status) {
      if (changePercent === 100 && !isUp) return 'change-new';
      if (changePercent <= 10) return 'change-minor';
      if (changePercent <= 30) return isUp ? 'change-up' : 'change-down';
      // >30%
      if (status === 'veryLow' || status === 'veryHigh') return 'change-danger';
      return isUp ? 'change-up' : 'change-down';
    },

    /**
     * 切换折叠状态
     */
    toggleInsight() {
      this.setData({
        expanded: !this.data.expanded
      });
    },

    /**
     * 显示报告弹窗
     */
    showReportPopup() {
      this.triggerEvent('showReport');
    },

    /**
     * 刷新数据
     */
    refresh() {
      this.loadTrendData();
    }
  }
});
