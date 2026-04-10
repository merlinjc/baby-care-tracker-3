/**
 * 成长报告共用数据计算模块
 * 
 * 抽取 report-popup.js 和 share-canvas.js 的重复逻辑，
 * 统一维护：评分等级、状态映射、指标卡构建、密度计算、
 * 成就生成、AI建议精简等方法。
 * 
 * @version 1.0.0
 * @date 2026-04-07
 */

const TrendService = require('./trendService');
const ThemeManager = require('../utils/theme');

// ============================================================
// 评分等级
// ============================================================

/**
 * 根据评分返回等级文本
 * @param {number} score 0-100
 * @returns {string}
 */
function getScoreLabel(score) {
  if (score >= 90) return '非常棒!';
  if (score >= 80) return '状态良好';
  if (score >= 70) return '部分可优化';
  if (score >= 60) return '需要关注';
  return '建议咨询医生';
}

/**
 * 根据评分返回颜色 HEX 值
 * @param {number} score
 * @returns {string} HEX 色值
 */
function getScoreColor(score) {
  if (score >= 90) return ThemeManager.getColor('scoreExcellent');
  if (score >= 80) return ThemeManager.getColor('scoreGood');
  if (score >= 70) return ThemeManager.getColor('scoreFair');
  if (score >= 60) return ThemeManager.getColor('scorePoor');
  return ThemeManager.getColor('scoreCritical');
}

/**
 * 根据评分返回 CSS 类名（弹窗展示用）
 * @param {number} score
 * @returns {string}
 */
function getScoreColorClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'fair';
  if (score >= 60) return 'poor';
  return 'critical';
}

// ============================================================
// 状态标签映射
// ============================================================

/**
 * 状态→文本映射
 */
const STATUS_TEXT_MAP = {
  normal: '正常', low: '偏少', high: '偏多',
  veryLow: '明显偏少', veryHigh: '明显偏多',
  noData: '无数据', attention: '需关注', alert: '需就医',
};

/**
 * 获取状态→颜色配置映射（动态获取主题色）
 */
function _getStatusColorsMap() {
  return {
    normal:    { text: '正常',     color: ThemeManager.getColor('statusNormal'),  bgColor: 'rgba(123,201,80,0.15)' },
    low:       { text: '偏少',     color: ThemeManager.getColor('statusWarning'), bgColor: 'rgba(212,136,61,0.15)' },
    high:      { text: '偏多',     color: ThemeManager.getColor('statusWarning'), bgColor: 'rgba(212,136,61,0.15)' },
    veryLow:   { text: '明显偏少', color: ThemeManager.getColor('statusDanger'),  bgColor: 'rgba(232,84,84,0.15)' },
    veryHigh:  { text: '明显偏多', color: ThemeManager.getColor('statusDanger'),  bgColor: 'rgba(232,84,84,0.15)' },
    noData:    { text: '无数据',   color: ThemeManager.getColor('statusMuted'),   bgColor: 'rgba(153,153,153,0.15)' },
    attention: { text: '需关注',   color: ThemeManager.getColor('statusWarning'), bgColor: 'rgba(212,136,61,0.15)' },
    alert:     { text: '需就医',   color: ThemeManager.getColor('statusDanger'),  bgColor: 'rgba(232,84,84,0.15)' },
  };
}

/**
 * 获取状态文本
 * @param {string} status
 * @returns {string}
 */
function getStatusText(status) {
  return STATUS_TEXT_MAP[status] || '';
}

/**
 * 获取状态颜色配置（Canvas 用）
 * @param {string} status
 * @returns {{ text: string, color: string, bgColor: string }}
 */
function getStatusColors(status) {
  const map = _getStatusColorsMap();
  return map[status] || map.noData;
}

/**
 * 获取状态 CSS 类名（WXML 用）
 * @param {string} status
 * @returns {string}
 */
function getStatusClass(status) {
  const map = {
    normal: 'status-normal', low: 'status-warning', high: 'status-warning',
    veryLow: 'status-danger', veryHigh: 'status-danger',
    noData: 'status-muted', attention: 'status-warning', alert: 'status-danger',
  };
  return map[status] || 'status-muted';
}

// ============================================================
// 四维指标卡数据构建
// ============================================================

/**
 * 构建四维指标卡数据（喂养/睡眠/排便/体温）
 * 返回通用数据结构，弹窗和 Canvas 都能使用
 * 
 * @param {Object} reportData - 报告统计数据
 * @param {Object|null} trendData - 趋势数据
 * @param {Object|null} baby - 宝宝信息（含 birthDate）
 * @param {number} days - 统计天数
 * @returns {Array<Object>} 四张指标卡数据
 */
function buildIndicatorCards(reportData, trendData, baby, days) {
  let ageMonths = null;
  if (baby?.birthDate) {
    const { calculateAgeMonths } = require('../utils/date');
    ageMonths = calculateAgeMonths(baby.birthDate);
  }

  const cards = [];

  // 喂养卡
  const feedingRange = ageMonths !== null ? TrendService.getReferenceRange('feeding', ageMonths) : null;
  const feedingAvg = parseFloat(reportData.feeding.avgCount);
  const feedingStatus = TrendService.calculateStatus(feedingAvg, feedingRange, 'feeding', { lastWeekAvg: trendData?.feeding?.lastWeekAvg || 0 });
  cards.push(_buildSingleCard('feeding', '喂养', ThemeManager.getColor('dotFeeding'), feedingAvg, '次/日', feedingStatus, feedingRange, TrendService.generateTip('feeding', feedingStatus), trendData?.feeding));

  // 睡眠卡
  const sleepRange = ageMonths !== null ? TrendService.getReferenceRange('sleep', ageMonths) : null;
  const sleepAvg = parseFloat(reportData.sleep.avgHours);
  const sleepStatus = TrendService.calculateStatus(sleepAvg, sleepRange, 'sleep', { lastWeekAvg: trendData?.sleep?.lastWeekAvg || 0 });
  cards.push(_buildSingleCard('sleep', '睡眠', ThemeManager.getColor('dotSleep'), sleepAvg, 'h/日', sleepStatus, sleepRange, TrendService.generateTip('sleep', sleepStatus), trendData?.sleep));

  // 排便卡
  const diaperRange = ageMonths !== null ? TrendService.getReferenceRange('diaper', ageMonths) : null;
  const diaperAvg = Math.round(reportData.diaper.totalCount / days * 10) / 10;
  const diaperStatus = TrendService.calculateStatus(diaperAvg, diaperRange, 'diaper', { lastWeekAvg: trendData?.diaper?.lastWeekAvg || 0 });
  cards.push(_buildSingleCard('diaper', '排便', ThemeManager.getColor('dotDiaper'), diaperAvg, '次/日', diaperStatus, diaperRange, TrendService.generateTip('diaper', diaperStatus), trendData?.diaper));

  // 体温卡
  const tempData = reportData.temperature;
  const tempStatus = TrendService.calculateStatus(null, null, 'temperature', {
    abnormalCount: tempData.records ? tempData.records.filter(t => t >= 37.5).length : 0,
    hasData: tempData.count > 0
  });
  cards.push({
    key: 'temperature',
    title: '体温',
    color: ThemeManager.getColor('dotTemperature'),
    value: tempData.count > 0 ? tempData.avgTemp : '--',
    unit: tempData.count > 0 ? '°C' : '',
    status: tempStatus,
    statusText: getStatusText(tempStatus),
    statusClass: getStatusClass(tempStatus),
    statusColors: getStatusColors(tempStatus),
    range: null,
    rangeText: '',
    rangePosition: 50,
    rangeZone: 'normal',
    tip: TrendService.generateTip('temperature', tempStatus),
    changeText: '',
    changeClass: '',
    hasChange: false,
    hasRange: false,
  });

  return cards;
}

/**
 * 构建单张指标卡数据（内部方法）
 */
function _buildSingleCard(key, title, color, value, unit, status, range, tip, change) {
  let changeText = '';
  let changeClass = '';
  let hasChange = false;
  if (change && change.changePercent > 0 && change.changeValue !== 0) {
    const arrow = change.isUp ? '↑' : '↓';
    changeText = `${arrow}${change.changePercent}%`;
    changeClass = change.isUp ? 'up' : 'down';
    hasChange = true;
  }

  let rangeText = '';
  let rangePosition = 50;
  let rangeZone = 'normal';
  if (range) {
    const refUnit = key === 'sleep' ? 'h' : '次';
    rangeText = `参考 ${range.min}-${range.max}${refUnit}`;
    const pos = TrendService.calculateRangeBarPosition(value, range);
    rangePosition = pos.position;
    rangeZone = pos.zone;
  }

  return {
    key,
    title,
    color,
    value,
    unit,
    status,
    statusText: getStatusText(status),
    statusClass: getStatusClass(status),
    statusColors: getStatusColors(status),
    range,
    rangeText,
    rangePosition,
    rangeZone,
    tip,
    changeText,
    changeClass,
    hasChange,
    hasRange: !!range,
  };
}

// ============================================================
// 每日密度计算
// ============================================================

/**
 * 计算每日记录数（喂养+睡眠+排便）
 * @param {Object} reportData - 报告数据
 * @param {number} [days=7] - 天数
 * @returns {Array<number>} 每日记录总数
 */
function calculateDailyCounts(reportData, days = 7) {
  const counts = [];
  for (let i = 0; i < days; i++) {
    counts.push(
      (reportData.feeding.dailyRecords?.[i] || 0) +
      (reportData.sleep.dailyRecords?.[i] > 0 ? 1 : 0) +
      (reportData.diaper.dailyRecords?.[i] || 0)
    );
  }
  return counts;
}

/**
 * 构建每日密度数据（弹窗展示用，含日期标签和等级）
 * @param {Object} reportData
 * @param {Date} [startDate] - 报告起始日期（周报时为周一）
 * @returns {Array<{label: string, count: number, level: number}>}
 */
function buildDailyDensity(reportData, startDate) {
  const allDayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const days = reportData.feeding.dailyRecords?.length || 7;
  const counts = calculateDailyCounts(reportData, days);
  const maxCount = Math.max(...counts, 1);
  
  // 根据起始日期动态生成星期标签
  let labels;
  if (startDate) {
    labels = [];
    const d = new Date(startDate);
    for (let i = 0; i < days; i++) {
      labels.push(allDayLabels[d.getDay()]);
      d.setDate(d.getDate() + 1);
    }
  } else {
    // 降级：默认周一到周日
    labels = ['一', '二', '三', '四', '五', '六', '日'];
  }
  
  return counts.map((count, i) => ({
    label: labels[i] || '',
    count,
    level: count === 0 ? 0 : Math.min(4, Math.ceil(count / maxCount * 4)),
  }));
}

// ============================================================
// 有记录天数统计
// ============================================================

/**
 * 统计有记录的天数
 * @param {Object} reportData
 * @param {number} days
 * @returns {number}
 */
function countRecordDays(reportData, days) {
  let count = 0;
  for (let i = 0; i < days; i++) {
    const hasRecord = (reportData.feeding.dailyRecords?.[i] || 0) > 0 ||
                      (reportData.sleep.dailyRecords?.[i] || 0) > 0 ||
                      (reportData.diaper.dailyRecords?.[i] || 0) > 0;
    if (hasRecord) count++;
  }
  return count;
}

// ============================================================
// 本周成就
// ============================================================

/**
 * 构建本周成就列表
 * 返回统一数据结构，弹窗用 icon+text，Canvas 用带 emoji 的 text
 * 
 * @param {Object} params
 * @param {Object} params.reportData - 报告数据
 * @param {Object|null} params.vaccineData - 疫苗数据
 * @param {Array} params.indicatorCards - 指标卡数据（已构建）
 * @param {number} params.days - 统计天数
 * @returns {Array<{icon: string, text: string, fullText: string}>}
 */
function buildAchievements({ reportData, vaccineData, indicatorCards, days }) {
  const achievements = [];

  // 连续记录天数
  const recordDays = countRecordDays(reportData, days);
  if (recordDays >= 5) {
    achievements.push({ iconPath: '/images/icons/clipboard-list.png', text: `连续 ${recordDays} 天坚持记录`, fullText: `连续 ${recordDays} 天坚持记录` });
  }

  // 从指标卡获取状态
  const feedingCard = indicatorCards.find(c => c.key === 'feeding');
  const sleepCard = indicatorCards.find(c => c.key === 'sleep');
  const diaperCard = indicatorCards.find(c => c.key === 'diaper');

  if (feedingCard?.status === 'normal') {
    achievements.push({ iconPath: '/images/icons/feeding-color.png', text: '喂养规律达标', fullText: '喂养规律达标' });
  }
  if (sleepCard?.status === 'normal') {
    achievements.push({ iconPath: '/images/icons/sleep-color.png', text: '睡眠充足', fullText: '睡眠充足' });
  }
  if (reportData.temperature.count > 0) {
    const abnormal = reportData.temperature.records ? reportData.temperature.records.filter(t => t >= 37.5).length : 0;
    if (abnormal === 0) {
      achievements.push({ iconPath: '/images/icons/temperature.png', text: '体温全部正常', fullText: '体温全部正常' });
    }
  }
  if (diaperCard?.status === 'normal') {
    achievements.push({ iconPath: '/images/icons/diaper-color.png', text: '排便规律', fullText: '排便规律' });
  }
  if (vaccineData && vaccineData.overdue === 0 && vaccineData.done > 0) {
    achievements.push({ iconPath: '/images/icons/vaccine-color.png', text: '疫苗按时接种', fullText: '疫苗按时接种' });
  }

  if (achievements.length === 0) {
    achievements.push({ iconPath: '/images/icons/hand.png', text: '每一天的记录都是对宝宝的爱', fullText: '每一天的记录都是对宝宝的爱' });
  }

  return achievements.slice(0, 3);
}

// ============================================================
// AI 建议精简
// ============================================================

/**
 * 精简 AI 建议
 * 优先级：需关注类 > 正面肯定
 * 
 * @param {string} aiComment - 原始 AI 评语
 * @param {number} [maxLength=80] - 最大字数（弹窗 80，Canvas 60）
 * @returns {string}
 */
function truncateAIAdvice(aiComment, maxLength = 80) {
  if (!aiComment) return '';

  const paragraphs = aiComment.split('\n').filter(p => p.trim());
  const prioritized = [];
  const normal = [];

  paragraphs.forEach(p => {
    if (p.includes('偏少') || p.includes('偏多') ||
        p.includes('不足') || p.includes('关注') ||
        p.includes('发热') || p.includes('就医')) {
      prioritized.push(p);
    } else {
      normal.push(p);
    }
  });

  const selected = [...prioritized, ...normal].slice(0, 2);
  let result = selected.join(' ');

  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + '...';
  }

  return result;
}

// ============================================================
// 百分位显示配置
// ============================================================

/**
 * WHO 百分位标签显示配置
 * @param {string} percentile - 'low'|'lowNormal'|'normal'|'highNormal'|'high'
 * @returns {{ text: string, color: string, bgColor: string }}
 */
function getPercentileDisplay(percentile) {
  const map = {
    low:        { text: '偏低',     color: ThemeManager.getColor('statusDanger'),  bgColor: 'rgba(232,84,84,0.12)' },
    lowNormal:  { text: '偏低正常', color: ThemeManager.getColor('statusWarning'), bgColor: 'rgba(212,136,61,0.12)' },
    normal:     { text: '达标',     color: ThemeManager.getColor('statusNormal'),  bgColor: 'rgba(123,201,80,0.12)' },
    highNormal: { text: '偏高正常', color: ThemeManager.getColor('statusNormal'),  bgColor: 'rgba(123,163,201,0.12)' },
    high:       { text: '偏高',     color: ThemeManager.getColor('statusDanger'),  bgColor: 'rgba(232,84,84,0.12)' },
  };
  return map[percentile] || map.normal;
}

/**
 * 根据密度强度返回颜色（0→浅，1→深）
 * @param {number} intensity 0-1
 * @returns {string} HEX 色值
 */
function getDensityColor(intensity) {
  if (intensity <= 0.25) return '#D4B896';
  if (intensity <= 0.5)  return '#C49A6C';
  if (intensity <= 0.75) return '#A0785A';
  return '#8B6B4E';
}

/**
 * 范围条定位点颜色
 * @param {string} zone 'normal'|'left'|'right'
 * @returns {string}
 */
function getZoneDotColor(zone) {
  if (zone === 'normal') return ThemeManager.getColor('statusNormal');
  return ThemeManager.getColor('statusWarning');
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 评分
  getScoreLabel,
  getScoreColor,
  getScoreColorClass,

  // 状态
  getStatusText,
  getStatusColors,
  getStatusClass,

  // 指标卡
  buildIndicatorCards,

  // 密度
  calculateDailyCounts,
  buildDailyDensity,

  // 记录天数
  countRecordDays,

  // 成就
  buildAchievements,

  // AI 建议
  truncateAIAdvice,

  // 百分位
  getPercentileDisplay,

  // 密度颜色
  getDensityColor,

  // 范围条
  getZoneDotColor,
};
