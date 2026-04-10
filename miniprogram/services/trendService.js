/**
 * 趋势数据计算服务
 * 用于计算周环比趋势数据
 */

const RecordService = require('./record');

/**
 * 月龄参考范围配置
 * 来源：NSF (睡眠)、AAP/CDC (喂养)、Baaleman 2023 系统综述 (排便)
 * 
 * 数据结构：{ dimension: { monthKey: { min, max, label } } }
 * monthKey 为月龄分段起始值，查找时取 ≤ ageMonths 的最大 key
 */
const REFERENCE_RANGES = {
  feeding: {
    0:  { min: 8,  max: 12, label: '0-1月' },
    1:  { min: 6,  max: 10, label: '1-3月' },
    3:  { min: 5,  max: 8,  label: '3-6月' },
    6:  { min: 4,  max: 6,  label: '6-12月' },
    12: { min: 3,  max: 5,  label: '12-24月' },
    24: { min: 3,  max: 5,  label: '24月+' }
  },
  sleep: {
    0:  { min: 14, max: 17, label: '0-1月' },
    1:  { min: 14, max: 17, label: '1-3月' },
    3:  { min: 12, max: 16, label: '3-6月' },
    6:  { min: 12, max: 15, label: '6-12月' },
    12: { min: 11, max: 14, label: '12-24月' },
    24: { min: 10, max: 13, label: '24月+' }
  },
  diaper: {
    0:  { min: 3, max: 8, label: '0-1月' },
    1:  { min: 2, max: 5, label: '1-3月' },
    3:  { min: 1, max: 4, label: '3-6月' },
    6:  { min: 1, max: 3, label: '6-12月' },
    12: { min: 1, max: 3, label: '12月+' }
  }
  // temperature 无参考范围概念，通过异常次数判定
};

/**
 * 趋势状态枚举
 * 用于 FR-1 智能状态标签
 */
const TREND_STATUS = {
  NORMAL:       'normal',
  LOW:          'low',
  HIGH:         'high',
  VERY_LOW:     'veryLow',
  VERY_HIGH:    'veryHigh',
  NO_DATA:      'noData'
};

/**
 * 体温状态枚举（独立逻辑，基于异常次数）
 */
const TEMP_STATUS = {
  NORMAL:       'normal',
  ATTENTION:    'attention',
  ALERT:        'alert',
  NO_DATA:      'noData'
};

/**
 * 偏离阈值常量（FR-1 定义）
 */
const DEVIATION_THRESHOLD = 0.30;

/**
 * 周环比变化颜色阈值（FR-6 定义）
 */
const CHANGE_THRESHOLD = {
  MINOR: 10,
  MODERATE: 30
};

/**
 * 状态标签视觉配置
 * 复用 app.wxss 中已有的语义色变量
 */
const STATUS_DISPLAY = {
  normal:    { text: '正常',     colorVar: '--success-color', bgAlpha: 0.1 },
  low:       { text: '偏少',     colorVar: '--warning-color', bgAlpha: 0.1 },
  high:      { text: '偏多',     colorVar: '--warning-color', bgAlpha: 0.1 },
  veryLow:   { text: '明显偏少', colorVar: '--danger-color',  bgAlpha: 0.1 },
  veryHigh:  { text: '明显偏多', colorVar: '--danger-color',  bgAlpha: 0.1 },
  noData:    { text: '无数据',   colorVar: '--text-hint',     bgAlpha: 0.1 },
  attention: { text: '需关注',   colorVar: '--warning-color', bgAlpha: 0.1 },
  alert:     { text: '需就医',   colorVar: '--danger-color',  bgAlpha: 0.1 }
};

/**
 * 智能提示语映射（FR-4）
 * 纯本地规则引擎，不调用 AI
 */
const TIP_MESSAGES = {
  feeding: {
    normal:   '喂养规律，保持即可 👍',
    low:      '日均喂养略少，注意宝宝饥饿信号',
    high:     '喂养频率偏高，可观察是否吃饱',
    veryLow:  '喂养次数明显偏少，建议关注',
    veryHigh: '频繁喂养，建议咨询是否需调整',
    noData:   '开始记录喂养，获取趋势分析'
  },
  sleep: {
    normal:   '睡眠充足，继续保持作息规律',
    low:      '日均睡眠略低，关注夜间作息',
    high:     '睡眠偏多，注意观察精神状态',
    veryLow:  '睡眠明显不足，建议改善睡眠环境',
    veryHigh: '嗜睡需关注，如持续请咨询医生',
    noData:   '开始记录睡眠，了解作息规律'
  },
  diaper: {
    normal:   '排便正常，消化良好',
    low:      '排便次数略少，多注意饮食',
    high:     '排便次数偏多，注意大便性状',
    veryLow:  '排便明显减少，如持续请咨询医生',
    veryHigh: '腹泻风险，注意补水和就医',
    noData:   '开始记录排便，跟踪消化情况'
  },
  temperature: {
    normal:    '体温正常，宝宝很健康',
    attention: '有体温偏高记录，注意观察',
    alert:     '多次发热，建议及时就医',
    noData:    '定期测量体温，关注健康状况'
  }
};

let instance = null;

class TrendService {
  constructor() {
    if (instance) return instance;
    this.recordService = RecordService.getInstance();
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new TrendService();
    return instance;
  }

  /**
   * 获取本周开始时间（周一）
   * @param {Date} date 参考日期
   * @returns {Date} 本周开始时间
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * 格式化日期为显示字符串
   * @param {Date} date 日期
   * @returns {string} 格式化的日期字符串
   */
  formatDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * 计算本周已经过的天数（至少为1，避免除零）
   * @param {Date} weekStart 本周开始时间
   * @param {Date} now 当前时间
   * @returns {number} 天数
   */
  getDaysElapsed(weekStart, now) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((now.getTime() - weekStart.getTime()) / msPerDay) + 1;
    return Math.max(days, 1);
  }

  /**
   * 计算变化百分比和绝对值（基于日均值对比）
   * @param {number} currentTotal 本周总量
   * @param {number} previousTotal 上周总量
   * @param {number} currentDays 本周天数
   * @param {number} previousDays 上周天数
   * @returns {Object} 变化数据
   */
  calculateChange(currentTotal, previousTotal, currentDays, previousDays) {
    const currentAvg = Math.round((currentTotal / currentDays) * 10) / 10;
    const previousAvg = Math.round((previousTotal / previousDays) * 10) / 10;

    if (previousAvg === 0) {
      return {
        thisWeekAvg: currentAvg,
        lastWeekAvg: previousAvg,
        changePercent: currentAvg > 0 ? 100 : 0,
        changeValue: currentAvg,
        isUp: currentAvg > 0
      };
    }

    const changeValue = currentAvg - previousAvg;
    const changePercent = Math.round(Math.abs(changeValue / previousAvg) * 100);

    return {
      thisWeekAvg: currentAvg,
      lastWeekAvg: previousAvg,
      changePercent,
      changeValue: Math.round(Math.abs(changeValue) * 10) / 10,
      isUp: changeValue > 0
    };
  }

  /**
   * 计算喂养趋势（日均次数对比）
   * @param {Array} thisWeekFeedings 本周喂养记录（已分桶）
   * @param {Array} lastWeekFeedings 上周喂养记录（已分桶）
   * @param {number} thisWeekDays 本周天数
   * @param {number} lastWeekDays 上周天数
   * @returns {Object} 喂养趋势数据
   */
  calculateFeedingTrend(thisWeekFeedings, lastWeekFeedings, thisWeekDays, lastWeekDays) {
    return this.calculateChange(thisWeekFeedings.length, lastWeekFeedings.length, thisWeekDays, lastWeekDays);
  }

  /**
   * 计算睡眠趋势（日均小时数对比）
   * @param {Array} thisWeekSleeps 本周睡眠记录（已分桶）
   * @param {Array} lastWeekSleeps 上周睡眠记录（已分桶）
   * @param {number} thisWeekDays 本周天数
   * @param {number} lastWeekDays 上周天数
   * @returns {Object} 睡眠趋势数据
   */
  calculateSleepTrend(thisWeekSleeps, lastWeekSleeps, thisWeekDays, lastWeekDays) {
    const calcTotalHours = (records) => {
      return records.reduce((total, r) => {
          const duration = r.data?.duration || 0;
          // BUG-32: duration 单位为秒，转换为小时应除以 3600（不是 60）
          return total + duration / 3600;
        }, 0);
    };

    const thisWeekHours = calcTotalHours(thisWeekSleeps);
    const lastWeekHours = calcTotalHours(lastWeekSleeps);

    const trend = this.calculateChange(thisWeekHours, lastWeekHours, thisWeekDays, lastWeekDays);
    trend.changeValue = Math.round(trend.changeValue * 10) / 10; // 保留一位小数

    return trend;
  }

  /**
   * 计算排便趋势（日均次数对比）
   * @param {Array} thisWeekDiapers 本周排便记录（已分桶）
   * @param {Array} lastWeekDiapers 上周排便记录（已分桶）
   * @param {number} thisWeekDays 本周天数
   * @param {number} lastWeekDays 上周天数
   * @returns {Object} 排便趋势数据
   */
  calculateDiaperTrend(thisWeekDiapers, lastWeekDiapers, thisWeekDays, lastWeekDays) {
    return this.calculateChange(thisWeekDiapers.length, lastWeekDiapers.length, thisWeekDays, lastWeekDays);
  }

  /**
   * 计算体温趋势
   * @param {Array} temperatureRecords 本周体温记录（已分桶）
   * @returns {Object} 体温趋势数据
   */
  calculateTemperatureTrend(temperatureRecords) {
    const validRecords = temperatureRecords
      .filter(r => r.data?.temperature)
      .sort((a, b) => {
        const timeA = a.startTimeTs || new Date(a.startTime).getTime();
        const timeB = b.startTimeTs || new Date(b.startTime).getTime();
        return timeB - timeA;
      });

    // 统计异常体温（>= 37.5°C）
    const abnormalCount = validRecords.filter(r => r.data.temperature >= 37.5).length;

    // 获取最近一次体温（validRecords 已按时间降序排序）
    const latestRecord = validRecords[0];
    const latestValue = latestRecord?.data?.temperature || null;
    const latestTime = latestRecord?.startTimeTs || latestRecord?.startTime || null;

    return {
      abnormalCount,
      latestValue: latestValue ? latestValue.toFixed(1) : '--',
      latestTime
    };
  }

  /**
   * 一次遍历将记录按 recordType 分桶
   * @param {Array} records 记录列表
   * @returns {Object} { feeding: [], sleep: [], diaper: [], temperature: [] }
   */
  bucketByType(records) {
    const buckets = { feeding: [], sleep: [], diaper: [], temperature: [] };
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (buckets[r.recordType]) {
        buckets[r.recordType].push(r);
      }
    }
    return buckets;
  }

  /**
   * 获取趋势数据（带 30s 缓存）
   * @param {string} babyId 宝宝ID
   * @returns {Promise<Object>} 趋势数据
   */
  async getTrendData(babyId) {
    // 30s 缓存
    const now = Date.now();
    if (this._cache &&
        this._cache.babyId === babyId &&
        now - this._cache.ts < 30000) {
      return this._cache.data;
    }

    const nowDate = new Date();

    // 本周时间范围（周一到今天）
    const thisWeekStart = this.getWeekStart(nowDate);
    const thisWeekEnd = nowDate;

    // 上周时间范围
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setTime(lastWeekEnd.getTime() - 1);

    try {
      // 获取两周数据
      const [thisWeekRecords, lastWeekRecords] = await Promise.all([
        this.recordService.getRecords(babyId, {
          startDate: thisWeekStart.getTime(),
          endDate: thisWeekEnd.getTime(),
          limit: 500
        }),
        this.recordService.getRecords(babyId, {
          startDate: lastWeekStart.getTime(),
          endDate: lastWeekEnd.getTime(),
          limit: 500
        })
      ]);

      // 一次遍历分桶，避免 4 次 .filter()
      const thisWeekBuckets = this.bucketByType(thisWeekRecords);
      const lastWeekBuckets = this.bucketByType(lastWeekRecords);

      // 计算各周实际天数（用于日均值计算）
      const thisWeekDays = this.getDaysElapsed(thisWeekStart, thisWeekEnd);
      const lastWeekDays = 7; // 上周固定 7 天

      // 计算趋势（基于日均值对比）
      const trendData = {
        feeding: this.calculateFeedingTrend(thisWeekBuckets.feeding, lastWeekBuckets.feeding, thisWeekDays, lastWeekDays),
        sleep: this.calculateSleepTrend(thisWeekBuckets.sleep, lastWeekBuckets.sleep, thisWeekDays, lastWeekDays),
        diaper: this.calculateDiaperTrend(thisWeekBuckets.diaper, lastWeekBuckets.diaper, thisWeekDays, lastWeekDays),
        temperature: this.calculateTemperatureTrend(thisWeekBuckets.temperature)
      };

      // 格式化周期显示
      const trendPeriod = `${this.formatDate(thisWeekStart)} - ${this.formatDate(nowDate)}`;

      const result = { trendData, trendPeriod };

      // 更新 30s 缓存
      this._cache = { babyId, ts: Date.now(), data: result };

      return result;
    } catch (error) {
      console.error('获取趋势数据失败:', error);
      throw error;
    }
  }

  /**
   * 根据报告周期获取趋势数据
   * 趋势逻辑：当前周期 vs 上一个同类周期
   *   thisWeek  → 本周 vs 上周
   *   lastWeek  → 上周 vs 上上周
   *   thisMonth → 本月 vs 上月
   *   lastMonth → 上月 vs 上上月
   * @param {string} babyId 宝宝ID
   * @param {string} currentPeriod 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'
   * @returns {Promise<Object>} { trendData, trendPeriod }
   */
  async getTrendDataForPeriod(babyId, currentPeriod) {
    // 带周期的缓存 key
    const cacheKey = `${babyId}_${currentPeriod}`;
    const now = Date.now();
    if (this._periodCache &&
        this._periodCache.key === cacheKey &&
        now - this._periodCache.ts < 30000) {
      return this._periodCache.data;
    }

    const nowDate = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    let currentStart, currentEnd, currentDays;
    let previousStart, previousEnd, previousDays;

    switch (currentPeriod) {
      case 'thisWeek': {
        // 当前：本周一 → 今天；对比：上周一 → 上周日
        currentStart = this.getWeekStart(nowDate);
        currentEnd = nowDate;
        currentDays = this.getDaysElapsed(currentStart, currentEnd);

        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousDays = 7;
        break;
      }
      case 'lastWeek': {
        // 当前：上周一 → 上周日；对比：上上周一 → 上上周日
        const thisWeekStart = this.getWeekStart(nowDate);
        currentStart = new Date(thisWeekStart);
        currentStart.setDate(currentStart.getDate() - 7);
        currentEnd = new Date(thisWeekStart.getTime() - 1);
        currentDays = 7;

        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousDays = 7;
        break;
      }
      case 'thisMonth': {
        // 当前：本月1号 → 今天；对比：上月1号 → 上月最后一天
        currentStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
        currentEnd = nowDate;
        currentDays = Math.max(Math.floor((currentEnd.getTime() - currentStart.getTime()) / msPerDay) + 1, 1);

        const lastMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1, 0, 0, 0, 0);
        previousStart = lastMonthStart;
        previousEnd = new Date(currentStart.getTime() - 1);
        previousDays = Math.max(Math.floor((currentStart.getTime() - lastMonthStart.getTime()) / msPerDay), 1);
        break;
      }
      case 'lastMonth': {
        // 当前：上月1号 → 上月最后一天；对比：上上月1号 → 上上月最后一天
        const thisMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
        currentStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1, 0, 0, 0, 0);
        currentEnd = new Date(thisMonthStart.getTime() - 1);
        currentDays = Math.max(Math.floor((thisMonthStart.getTime() - currentStart.getTime()) / msPerDay), 1);

        previousStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 2, 1, 0, 0, 0, 0);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousDays = Math.max(Math.floor((currentStart.getTime() - previousStart.getTime()) / msPerDay), 1);
        break;
      }
      default: {
        // 兜底：使用原始 getTrendData 逻辑
        return this.getTrendData(babyId);
      }
    }

    try {
      // 并行获取两个周期的数据
      const [currentRecords, previousRecords] = await Promise.all([
        this.recordService.getRecords(babyId, {
          startDate: currentStart.getTime(),
          endDate: currentEnd.getTime(),
          limit: 1000
        }),
        this.recordService.getRecords(babyId, {
          startDate: previousStart.getTime(),
          endDate: previousEnd.getTime(),
          limit: 1000
        })
      ]);

      // 一次遍历分桶
      const currentBuckets = this.bucketByType(currentRecords);
      const previousBuckets = this.bucketByType(previousRecords);

      // 计算趋势（基于日均值对比）
      const trendData = {
        feeding: this.calculateFeedingTrend(currentBuckets.feeding, previousBuckets.feeding, currentDays, previousDays),
        sleep: this.calculateSleepTrend(currentBuckets.sleep, previousBuckets.sleep, currentDays, previousDays),
        diaper: this.calculateDiaperTrend(currentBuckets.diaper, previousBuckets.diaper, currentDays, previousDays),
        temperature: this.calculateTemperatureTrend(currentBuckets.temperature)
      };

      // 格式化周期显示
      const trendPeriod = `${this.formatDate(currentStart)} - ${this.formatDate(currentEnd)}`;

      const result = { trendData, trendPeriod };

      // 更新缓存
      this._periodCache = { key: cacheKey, ts: Date.now(), data: result };

      return result;
    } catch (error) {
      console.error('获取趋势数据失败(周期):', error);
      throw error;
    }
  }

  /**
   * 检查是否需要关注
   * @param {Object} trendItem 趋势项
   * @returns {boolean} 是否需要关注
   */
  needsAttention(trendItem) {
    return trendItem.changePercent >= 20;
  }

  /**
   * 获取指定维度和月龄的参考范围
   * @param {string} dimension - 维度名：'feeding' | 'sleep' | 'diaper'
   * @param {number} ageMonths - 月龄
   * @returns {Object|null} { min, max, label } 或 null
   */
  static getReferenceRange(dimension, ageMonths) {
    const ranges = REFERENCE_RANGES[dimension];
    if (!ranges || ageMonths < 0) return null;

    const keys = Object.keys(ranges).map(Number).sort((a, b) => a - b);
    let matchedKey = keys[0];

    for (let i = keys.length - 1; i >= 0; i--) {
      if (ageMonths >= keys[i]) {
        matchedKey = keys[i];
        break;
      }
    }

    return ranges[matchedKey];
  }

  /**
   * 计算趋势状态
   * @param {number} value - 当前日均值
   * @param {Object|null} range - 参考范围 { min, max }
   * @param {string} dimension - 维度名
   * @param {Object} [extra] - 额外参数
   * @returns {string|null} 状态值
   */
  static calculateStatus(value, range, dimension, extra = {}) {
    // 体温特殊逻辑
    if (dimension === 'temperature') {
      const { abnormalCount, hasData } = extra;
      if (!hasData) return TEMP_STATUS.NO_DATA;
      if (abnormalCount === 0) return TEMP_STATUS.NORMAL;
      if (abnormalCount <= 2) return TEMP_STATUS.ATTENTION;
      return TEMP_STATUS.ALERT;
    }

    // 无数据判定
    if (value === 0 && (!extra.lastWeekAvg || extra.lastWeekAvg === 0)) {
      return TREND_STATUS.NO_DATA;
    }

    // 无参考范围（出生日期缺失）
    if (!range) return null;

    // 含边界的正常判定
    if (value >= range.min && value <= range.max) {
      return TREND_STATUS.NORMAL;
    }

    // 偏低
    if (value < range.min) {
      const deviation = (range.min - value) / range.min;
      return deviation > DEVIATION_THRESHOLD
        ? TREND_STATUS.VERY_LOW
        : TREND_STATUS.LOW;
    }

    // 偏高
    const deviation = (value - range.max) / range.max;
    return deviation > DEVIATION_THRESHOLD
      ? TREND_STATUS.VERY_HIGH
      : TREND_STATUS.HIGH;
  }

  /**
   * 计算范围条定位点位置百分比
   * @param {number} value - 当前日均值
   * @param {Object} range - 参考范围 { min, max }
   * @returns {Object} { position: number(0-100), zone: 'left'|'normal'|'right' }
   */
  static calculateRangeBarPosition(value, range) {
    if (!range) return { position: 50, zone: 'normal' };

    const { min, max } = range;

    // 参考范围上下限相同
    if (min === max) {
      return value === min
        ? { position: 50, zone: 'normal' }
        : value < min
          ? { position: 10, zone: 'left' }
          : { position: 90, zone: 'right' };
    }

    // 正常范围内
    if (value >= min && value <= max) {
      const position = 20 + ((value - min) / (max - min)) * 60;
      return { position: Math.round(position), zone: 'normal' };
    }

    // 偏低
    if (value < min) {
      const ratio = value / min;
      const position = Math.max(2, Math.round(20 * ratio));
      return { position, zone: 'left' };
    }

    // 偏高
    const excess = (value - max) / max;
    const position = Math.min(98, Math.round(80 + 20 * excess));
    return { position, zone: 'right' };
  }

  /**
   * 生成一句话智能提示
   * @param {string} dimension - 维度名
   * @param {string} status - 状态值
   * @returns {string} 提示语文本
   */
  static generateTip(dimension, status) {
    const dimensionTips = TIP_MESSAGES[dimension];
    if (!dimensionTips) return '';
    return dimensionTips[status] || '';
  }

  /**
   * 获取状态标签视觉配置
   * @param {string} status - 状态值
   * @returns {Object|null} { text, colorVar, bgAlpha }
   */
  static getStatusDisplay(status) {
    return STATUS_DISPLAY[status] || null;
  }
}

module.exports = TrendService;
