/**
 * 彩蛋检测引擎（纯函数模块）
 * 配置驱动检测 8 类彩蛋（EE-1 ~ EE-8）
 * 返回弹窗/Toast/Banner 三层结果
 */

const StorageUtil = require('./storage');

// ============ 配置常量 ============

/**
 * 时间节点彩蛋规则（EE-1/2/3）
 */
const MILESTONE_RULES = [
  {
    type: '30day',
    display: 'popup',
    priority: 0,
    range: [30, 33],
    storageKeyFn: (babyId) => `egg_30day_${babyId}`,
    title: '满月快乐！',
    subtitle: (name) => `${name}已经满月啦！恭喜新手爸妈度过了最辛苦的第一个月`,
    icon: '/images/icons/easter-egg/moon.png',
    dataQueryType: '30day'
  },
  {
    type: '100day',
    display: 'popup',
    priority: 0,
    range: [100, 103],
    storageKeyFn: (babyId) => `egg_100day_${babyId}`,
    title: '百日快乐！',
    subtitle: (name) => `${name}来到这个世界已经100天了，小家伙越来越棒了！`,
    icon: '/images/icons/easter-egg/cloud-lucky.png',
    dataQueryType: '100day',
    showGrowthComparison: true
  },
  {
    type: '365day',
    display: 'popup',
    priority: 1,
    range: [365, 368],
    storageKeyFn: (babyId) => `egg_365day_${babyId}`,
    title: '周岁快乐！',
    subtitle: (name) => `${name}一周岁了！感谢每一天的陪伴与付出`,
    icon: '/images/icons/easter-egg/cake.png',
    dataQueryType: '365day'
  }
];

/**
 * 固定日期节日（EE-7）
 */
const HOLIDAY_MAP = {
  '06-01': {
    id: 'children',
    text: (name, birthDayCount) => {
      const years = Math.ceil(birthDayCount / 365);
      return `${name}的第 ${years} 个儿童节快乐`;
    },
    icon: '/images/icons/easter-egg/balloon.png'
  }
};

/**
 * 农历节日硬编码（近3年）
 */
const LUNAR_HOLIDAYS = {
  '2026-02-17': 'spring_festival',
  '2027-02-06': 'spring_festival',
  '2028-01-26': 'spring_festival',
  '2026-10-04': 'mid_autumn',
  '2027-09-23': 'mid_autumn',
  '2028-09-12': 'mid_autumn'
};

// ============ 核心检测函数 ============

/**
 * 主入口：检测所有彩蛋
 * @param {Object} ctx - 检测上下文
 * @param {string} ctx.babyId - 当前宝宝 ID
 * @param {string} ctx.babyName - 宝宝昵称
 * @param {number} ctx.birthDayCount - 出生天数
 * @param {Object} ctx.todayStats - 今日统计
 * @param {number} ctx.totalTodayCount - 今日总记录数
 * @param {Array}  ctx.recentRecords - 最近记录
 * @returns {{ popup: Object|null, toasts: Array, banner: Object|null }}
 */
function detectAll(ctx) {
  const { babyId, birthDayCount, todayStats, totalTodayCount } = ctx;

  // 前置防护
  if (!babyId || birthDayCount <= 0) {
    return { popup: null, toasts: [], banner: null };
  }

  const candidates = [];

  // 1. 时间节点彩蛋（EE-1/2/3）
  MILESTONE_RULES.forEach(rule => {
    if (birthDayCount >= rule.range[0] && birthDayCount <= rule.range[1]) {
      const key = rule.storageKeyFn(babyId);
      if (!StorageUtil.get(key)) {
        candidates.push({
          type: rule.type,
          display: rule.display,
          priority: rule.priority,
          storageKey: key,
          data: {
            title: rule.title,
            subtitle: rule.subtitle(ctx.babyName),
            icon: rule.icon,
            dataQueryType: rule.dataQueryType,
            showGrowthComparison: rule.showGrowthComparison || false
          }
        });
      }
    }
  });

  // 2. 月龄提示（EE-5）— banner
  const monthAge = Math.floor(birthDayCount / 30);
  if (birthDayCount % 30 === 0 && birthDayCount > 0) {
    const excludeDays = [30, 100, 365];
    if (!excludeDays.includes(birthDayCount)) {
      const bannerKey = `egg_month_${monthAge}_${babyId}`;
      if (!StorageUtil.get(bannerKey)) {
        candidates.push({
          type: 'month_age',
          display: 'banner',
          priority: 2,
          storageKey: bannerKey,
          data: {
            text: `${ctx.babyName}今天 ${monthAge} 个月啦`,
            icon: '/images/icons/easter-egg/balloon.png'
          }
        });
      }
    }
  }

  // 3. 节日彩蛋（EE-7）
  const holidayEgg = detectHoliday(ctx);
  if (holidayEgg) candidates.push(holidayEgg);

  // 4. 数据洞察彩蛋（EE-8）
  const insightEggs = detectInsight(ctx);
  candidates.push(...insightEggs);

  // 5. 连续记录（EE-6）
  const streakEgg = detectStreak(ctx);
  if (streakEgg) candidates.push(streakEgg);

  // === 优先级裁决 ===

  // 弹窗类：取 priority 最小（最高优先）的一个
  const popupCandidates = candidates
    .filter(e => e.display === 'popup')
    .sort((a, b) => a.priority - b.priority);
  const popup = popupCandidates[0] || null;

  // Toast 类：全部保留，按 priority 排序
  const toasts = candidates
    .filter(e => e.display === 'toast')
    .sort((a, b) => a.priority - b.priority);

  // Banner 类：取 priority 最小的一个（节日优先于月龄）
  const bannerCandidates = candidates
    .filter(e => e.display === 'banner')
    .sort((a, b) => a.priority - b.priority);
  const banner = bannerCandidates[0] || null;

  return { popup, toasts, banner };
}

// ============ 连续记录检测（EE-6） ============

/**
 * 检测连续记录天数
 * 从本地缓存逐天检查，避免云端查询，最多回溯 60 天
 */
function detectStreak(ctx) {
  const { babyId } = ctx;
  const cacheKey = `records_${babyId}`;
  const records = StorageUtil.get(cacheKey) || [];

  if (records.length === 0) return null;

  // 构建日期集合（YYYY-MM-DD）
  const dateSet = new Set();
  records.forEach(r => {
    const ts = r.startTimeTs || (r.startTime ? new Date(r.startTime).getTime() : 0);
    if (ts) {
      const d = new Date(ts);
      dateSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  });

  // 从昨天开始往前检查
  let streakDays = 0;
  const today = new Date();
  const checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1);

  // 如果今天已有记录，先算上今天
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateSet.has(todayStr)) {
    streakDays = 1;
  } else {
    return null; // 今天无记录则无连续
  }

  for (let i = 0; i < 60; i++) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dateSet.has(dateStr)) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 检查 30 天成就（优先级更高，升级为弹窗）
  if (streakDays >= 30) {
    const key30 = `egg_streak_30_${babyId}`;
    if (!StorageUtil.get(key30)) {
      return {
        type: 'streak_30',
        display: 'popup',
        priority: 1,
        storageKey: key30,
        data: {
          title: '坚持30天！',
          subtitle: `连续记录${streakDays}天，你的坚持是给${ctx.babyName}最好的礼物`,
          icon: '/images/icons/easter-egg/fire.png',
          streakDays
        }
      };
    }
  }

  // 检查 7 天成就
  if (streakDays >= 7) {
    const key7 = `egg_streak_7_${babyId}`;
    if (!StorageUtil.get(key7)) {
      return {
        type: 'streak_7',
        display: 'toast',
        priority: 2,
        storageKey: key7,
        data: {
          text: `连续打卡 ${streakDays} 天！你是最棒的爸/妈`,
          icon: '/images/icons/easter-egg/fire.png'
        }
      };
    }
  }

  return null;
}

// ============ 节日检测（EE-7） ============

/**
 * 检测节日彩蛋
 */
function detectHoliday(ctx) {
  const { babyId, babyName, birthDayCount } = ctx;
  const now = new Date();
  const year = now.getFullYear();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fullDate = `${year}-${monthDay}`;

  // 检查固定日期节日
  const fixedHoliday = HOLIDAY_MAP[monthDay];
  if (fixedHoliday) {
    const key = `egg_holiday_${fixedHoliday.id}_${year}_${babyId}`;
    if (!StorageUtil.get(key)) {
      return {
        type: `holiday_${fixedHoliday.id}`,
        display: 'banner',
        priority: 3,
        storageKey: key,
        data: { text: fixedHoliday.text(babyName, birthDayCount), icon: fixedHoliday.icon }
      };
    }
  }

  // 检查母亲节（5月第二个周日）
  if (now.getMonth() === 4) {
    const motherDay = getNthWeekday(year, 4, 0, 2);
    if (now.getDate() === motherDay) {
      const key = `egg_holiday_mother_${year}_${babyId}`;
      if (!StorageUtil.get(key)) {
        return {
          type: 'holiday_mother',
          display: 'banner',
          priority: 3,
          storageKey: key,
          data: { text: `妈妈辛苦了，${babyName}最爱你`, icon: '/images/icons/easter-egg/flower.png' }
        };
      }
    }
  }

  // 检查父亲节（6月第三个周日）
  if (now.getMonth() === 5) {
    const fatherDay = getNthWeekday(year, 5, 0, 3);
    if (now.getDate() === fatherDay) {
      const key = `egg_holiday_father_${year}_${babyId}`;
      if (!StorageUtil.get(key)) {
        return {
          type: 'holiday_father',
          display: 'banner',
          priority: 3,
          storageKey: key,
          data: { text: `爸爸辛苦了，${babyName}最爱你`, icon: '/images/icons/easter-egg/necktie.png' }
        };
      }
    }
  }

  // 检查农历节日（硬编码）
  const lunarHoliday = LUNAR_HOLIDAYS[fullDate];
  if (lunarHoliday) {
    const holidayConfig = {
      spring_festival: {
        text: `新年好！祝${babyName}健康成长`,
        icon: '/images/icons/easter-egg/lantern.png'
      },
      mid_autumn: {
        text: `中秋快乐！一家人团团圆圆`,
        icon: '/images/icons/easter-egg/mooncake.png'
      }
    };
    const config = holidayConfig[lunarHoliday];
    const key = `egg_holiday_${lunarHoliday}_${year}_${babyId}`;
    if (config && !StorageUtil.get(key)) {
      return {
        type: `holiday_${lunarHoliday}`,
        display: 'banner',
        priority: 3,
        storageKey: key,
        data: { text: config.text, icon: config.icon }
      };
    }
  }

  return null;
}

/**
 * 辅助：获取某月第 N 个指定星期几的日期
 * @param {number} year    年份
 * @param {number} month   月份（0 起始）
 * @param {number} weekday 星期几（0=周日）
 * @param {number} nth     第几个
 * @returns {number} 日期
 */
function getNthWeekday(year, month, weekday, nth) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) break;
    if (d.getDay() === weekday) {
      count++;
      if (count === nth) return day;
    }
  }
  return 1;
}

// ============ 数据洞察检测（EE-8） ============

/**
 * 检测数据洞察彩蛋
 * 仅使用 todayStats 已有数据，零额外查询
 * 互斥规则：多个洞察同时满足时只返回优先级最高的一个
 * 优先级排序：完美一天 > 喂养冠军 > 睡神降临
 */
function detectInsight(ctx) {
  const { babyId, todayStats } = ctx;
  
  if (!todayStats) return [];

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 1. 完美一天（最高优先级）
  if (todayStats.feeding && todayStats.sleep && todayStats.diaper &&
      todayStats.feeding.count >= 3 &&
      todayStats.sleep.count >= 2 &&
      todayStats.diaper.count >= 1) {
    const key = `egg_insight_perfect_${dateStr}_${babyId}`;
    if (!StorageUtil.get(key)) {
      return [{
        type: 'insight_perfect',
        display: 'toast',
        priority: 3,
        storageKey: key,
        data: {
          text: '今天是完美的一天！所有类型都有记录',
          icon: '/images/icons/easter-egg/star.png'
        }
      }];
    }
  }

  // 2. 喂养冠军（今日 > 7 次）
  // 注：需求原始条件为「> 历史7天日均的1.5倍」，简化为固定阈值 7 次
  if (todayStats.feeding && todayStats.feeding.count > 7) {
    const key = `egg_insight_feeding_${dateStr}_${babyId}`;
    if (!StorageUtil.get(key)) {
      return [{
        type: 'insight_feeding',
        display: 'toast',
        priority: 3,
        storageKey: key,
        data: {
          text: `今天喂了 ${todayStats.feeding.count} 次，大胃王宝宝`,
          icon: '/images/icons/easter-egg/star.png'
        }
      }];
    }
  }

  // 3. 睡神降临（单次平均 > 4h = 14400s）
  if (todayStats.sleep && todayStats.sleep.totalDuration > 0 && todayStats.sleep.count > 0) {
    const avgDuration = todayStats.sleep.totalDuration / todayStats.sleep.count;
    if (avgDuration > 14400) {
      const hours = Math.round(avgDuration / 3600 * 10) / 10;
      const key = `egg_insight_sleep_${dateStr}_${babyId}`;
      if (!StorageUtil.get(key)) {
        return [{
          type: 'insight_sleep',
          display: 'toast',
          priority: 3,
          storageKey: key,
          data: {
            text: `这觉睡了 ${hours} 小时，睡神附体`,
            icon: '/images/icons/easter-egg/star.png'
          }
        }];
      }
    }
  }

  return [];
}

// ============ 标记函数 ============

/**
 * 标记彩蛋已展示
 * @param {string} storageKey
 */
function markShown(storageKey) {
  StorageUtil.set(storageKey, { shown: true, shownAt: Date.now() });
}

// ============ 模块导出 ============

module.exports = {
  detectAll,
  markShown,
  MILESTONE_RULES,
  HOLIDAY_MAP,
  LUNAR_HOLIDAYS
};
