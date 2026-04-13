/**
 * 图标统一配置中心
 * 所有图标路径的唯一真实来源
 * 
 * 目录结构：扁平化 /images/icons/{name}.png
 * 保留 popup/ 子目录存放弹窗专用图标
 * 
 * 颜色方案：美拉德色系（温暖自然）
 * - 主色：#8B7B6B (灰棕)
 * - 功能-喂养：#A8D4A8 (浅绿)
 * - 功能-睡眠：#B8A8D4 (淡紫)
 * - 功能-排便：#D4C8A8 (浅棕)
 * - 功能-体温：#D4A8A8 (浅红)
 * - 状态-成功：#7FB069 (柔和绿)
 * - 状态-警告：#E5A853 (暖橙)
 * - 状态-错误：#D47B6A (柔和红)
 * - 状态-信息：#7BA3C9 (柔和蓝)
 */

// ============================================
// 基础路径常量
// ============================================
const BASE = '/images/icons';
const POPUP = '/images/icons/popup';
const IMAGES = '/images';

// ============================================
// 默认头像配置
// ============================================
const DEFAULT_AVATARS = {
  baby: `${IMAGES}/default-baby-avatar.svg`
};

// ============================================
// ICONS - 页面级快捷引用对象
// 供 profile.js / discover.js / baby-list.js / timeline.js 使用
// ============================================
const ICONS = {
  // 我的页 - 菜单图标
  menuBaby: `${BASE}/baby.png`,
  menuFamily: `${BASE}/family.png`,
  menuStats: `${BASE}/arrow-down-tray.png`,
  menuSettings: `${BASE}/settings.png`,
  menuHelp: `${BASE}/book.png`,

  // 性别图标
  gender: {
    boy: `${BASE}/boy.png`,
    girl: `${BASE}/girl.png`
  },

  // 发现页 - 功能入口图标
  discover: {
    vaccine: `${BASE}/vaccine-color.png`,
    growth: `${BASE}/growth-color.png`,
    milestone: `${BASE}/milestone-color.png`,
    ai: `${BASE}/robot.png`
  },

  // v4.0 新增图标
  sun: `${BASE}/sun.png`,           // 亮色主题
  moon: `${BASE}/moon.png`,         // 暗夜主题
  recDot: `${BASE}/rec-dot.png`     // 录制指示灯
};

// ============================================
// IconConfig - icon组件使用的分类配置
// ============================================
const IconConfig = {
  // 功能图标 - 用于核心功能模块
  functional: {
    rocket: `${BASE}/rocket.png`,           // 快速开始
    clipboard: `${BASE}/clipboard-list.png`, // 日常记录
    syringe: `${BASE}/syringe.png`,         // 健康追踪
    users: `${BASE}/users.png`,             // 家庭协作
    robot: `${BASE}/robot.png`              // AI助手
  },
  
  // 发育领域图标 - 用于里程碑评估
  milestone: {
    running: `${BASE}/running.png`,     // 大运动
    hand: `${BASE}/hand.png`,           // 精细动作
    comments: `${BASE}/comments.png`,   // 语言
    baby: `${BASE}/baby.png`,           // 社交
    brain: `${BASE}/brain.png`          // 认知
  },
  
  // 状态图标 - 用于状态指示
  status: {
    success: `${BASE}/check-circle.png`,    // 完成/成功
    warning: `${BASE}/warning.png`,         // 警告/逾期
    error: `${BASE}/times-circle.png`,      // 错误状态
    info: `${BASE}/lightbulb.png`,          // 提示/建议
    wifi: `${BASE}/wifi.png`,               // 网络状态
    chart: `${BASE}/chart-line.png`         // 图表/数据
  },
  
  // 导航图标 - 用于页面导航和操作
  navigation: {
    chart: `${BASE}/chart-line.png`,     // 发育评估
    users: `${BASE}/users.png`,          // 家庭图标
    list: `${BASE}/clipboard-list.png`,  // 列表/全部
    target: `${BASE}/bullseye.png`,      // 目标/关注
    copy: `${BASE}/copy.png`,            // 复制按钮
    share: `${BASE}/share.png`           // 分享按钮
  }
};

// ============================================
// 弹窗图标配置 - 记录类型细分选项
// ============================================
const PopupIcons = {
  // 喂养方式
  feedingBottle: `${POPUP}/feeding-bottle.png`,
  feedingMeal: `${POPUP}/feeding-meal.png`,
  
  // 睡眠类型
  sleepAuto: `${POPUP}/sleep-auto.png`,
  sleepNight: `${POPUP}/sleep-night.png`,
  sleepNap: `${POPUP}/sleep-nap.png`,
  
  // 排便类型
  diaperPee: `${POPUP}/diaper-pee.png`,
  diaperPoop: `${POPUP}/diaper-poop.png`,
  diaperBoth: `${POPUP}/diaper-both.png`,
  
  // 体温测量方式
  temperatureThermometer: `${POPUP}/temperature-thermometer.png`,
  temperatureEar: `${POPUP}/temperature-ear.png`,
  temperatureForehead: `${POPUP}/temperature-forehead.png`
};

// ============================================
// 工具函数
// ============================================

/**
 * 根据状态获取对应图标
 * @param {string} status - 状态类型 (success|warning|error|info|normal|attention|delayed)
 * @returns {string} 图标路径
 */
function getStatusIcon(status) {
  const statusMap = {
    'success': IconConfig.status.success,
    'warning': IconConfig.status.warning,
    'error': IconConfig.status.error,
    'info': IconConfig.status.info,
    'normal': IconConfig.status.success,
    'attention': IconConfig.status.warning,
    'delayed': IconConfig.status.warning
  };
  return statusMap[status] || IconConfig.status.info;
}

/**
 * 根据发育领域获取对应图标
 * @param {string} domain - 发育领域 (motor|fine_motor|language|social|cognitive 或中文)
 * @returns {string} 图标路径
 */
function getMilestoneIcon(domain) {
  const domainMap = {
    'motor': IconConfig.milestone.running,
    'fine_motor': IconConfig.milestone.hand,
    'language': IconConfig.milestone.comments,
    'social': IconConfig.milestone.baby,
    'cognitive': IconConfig.milestone.brain,
    '大运动': IconConfig.milestone.running,
    '精细动作': IconConfig.milestone.hand,
    '语言': IconConfig.milestone.comments,
    '社交': IconConfig.milestone.baby,
    '认知': IconConfig.milestone.brain
  };
  return domainMap[domain] || IconConfig.milestone.baby;
}

/**
 * 根据记录类型获取对应图标
 * @param {string} type - 记录类型 (feeding|sleep|diaper|vaccine|temperature|health)
 * @returns {string} 图标路径
 */
function getRecordIcon(type) {
  const typeMap = {
    'feeding': `${BASE}/feeding-color.png`,
    'sleep': `${BASE}/sleep-color.png`,
    'diaper': `${BASE}/diaper-color.png`,
    'vaccine': IconConfig.functional.syringe,
    'temperature': `${BASE}/temperature.png`,
    'health': `${BASE}/health-color.png`
  };
  return typeMap[type] || IconConfig.functional.clipboard;
}

// ============================================
// 导出
// ============================================
module.exports = {
  // 页面级快捷引用
  ICONS,
  
  // icon组件配置
  IconConfig,
  
  // 弹窗图标
  PopupIcons,
  
  // 默认头像
  DEFAULT_AVATARS,
  
  // 工具函数
  getStatusIcon,
  getMilestoneIcon,
  getRecordIcon
};
