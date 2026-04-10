/**
 * 统一日期/月龄工具函数
 * 替代 6 个页面中重复的 formatDate / calculateAgeMonths / formatAge
 */

/**
 * 安全解析日期（兼容云数据库多种格式）
 * @param {Date|string|Object|number} date - 支持 Date/string/云数据库 {$date} 格式/时间戳
 * @returns {Date|null}
 */
function parseDate(date) {
  if (!date) return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === 'object' && date.$date) return new Date(date.$date);
  if (typeof date === 'number') return new Date(date);
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string|Object|number} date - 支持 Date/string/云数据库格式/时间戳
 * @returns {string}
 */
function formatDate(date) {
  const d = parseDate(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 计算天龄
 * @param {Date|string|Object} birthDate
 * @returns {number} 天数
 */
function calculateAgeInDays(birthDate) {
  const birth = parseDate(birthDate);
  if (!birth) return 0;
  const today = new Date();
  const diff = today.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * 计算月龄
 * @param {Date|string|Object} birthDate
 * @param {number} [maxMonths] - 可选上限（不传则不限制）
 * @returns {number}
 */
function calculateAgeMonths(birthDate, maxMonths) {
  const birth = parseDate(birthDate);
  if (!birth) return 0;
  const today = new Date();
  const months = (today.getFullYear() - birth.getFullYear()) * 12 +
                 (today.getMonth() - birth.getMonth());
  const result = Math.max(0, months);
  return maxMonths !== undefined ? Math.min(maxMonths, result) : result;
}

/**
 * 格式化年龄显示
 * @param {Date|string|Object} birthDate
 * @returns {string} 如 "3天", "6个月", "1岁2个月"
 */
function formatAge(birthDate) {
  const months = calculateAgeMonths(birthDate);
  if (months < 1) {
    const days = calculateAgeInDays(birthDate);
    return `${days}天`;
  } else if (months < 12) {
    return `${months}个月`;
  } else {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}岁${rem}个月` : `${years}岁`;
  }
}

/**
 * 格式化时长（毫秒转换为可读字符串）
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时长，如 "3h 25m"、"45m"、"2h"、"0m"
 * 
 * 用于 FR-1/FR-4/FR-5/FR-10：
 * - 状态横幅："已睡 2h 30m"
 * - 时间提示："上次喂养 1h 15m 前"
 * - 睡眠统计：今日总睡眠时长
 */
function formatDuration(ms) {
  // 处理无效输入
  if (!ms || ms < 0) return '0m';
  
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  // 格式化输出
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * 格式化时长为中文格式
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时长，如 "3小时25分钟"、"45分钟"
 */
function formatDurationChinese(ms) {
  if (!ms || ms < 0) return '0分钟';
  
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时`;
  }
  return `${minutes}分钟`;
}

/**
 * 安全地解析时间戳（兼容微信云数据库所有时间格式）
 * 支持格式：
 *   - Date 对象
 *   - { $date: <milliseconds> }
 *   - { seconds: number, nanoseconds?: number }
 *   - { _seconds: number, _nanoseconds?: number }
 *   - 类 Date 对象（含 getTime 方法）
 *   - 字符串/数字时间戳
 * @param {Date|string|number|Object} timestamp
 * @returns {Date|null}
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return null;

  // 已是 Date 对象
  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime()) ? null : timestamp;
  }

  // 对象类型：云数据库多种格式
  if (typeof timestamp === 'object') {
    // 格式1: { $date: <milliseconds> }
    if (timestamp.$date) {
      const date = new Date(timestamp.$date);
      return isNaN(date.getTime()) ? null : date;
    }

    // 格式2: { seconds: number, nanoseconds?: number }
    if (typeof timestamp.seconds === 'number') {
      const ms = timestamp.nanoseconds
        ? timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000)
        : timestamp.seconds * 1000;
      const date = new Date(ms);
      return isNaN(date.getTime()) ? null : date;
    }

    // 格式3: { _seconds: number, _nanoseconds?: number }
    if (typeof timestamp._seconds === 'number') {
      const ms = timestamp._nanoseconds
        ? timestamp._seconds * 1000 + Math.floor(timestamp._nanoseconds / 1000000)
        : timestamp._seconds * 1000;
      const date = new Date(ms);
      return isNaN(date.getTime()) ? null : date;
    }

    // 格式4: 类 Date 对象
    if (typeof timestamp.getTime === 'function') {
      const ms = timestamp.getTime();
      const date = new Date(ms);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // 字符串或数字
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

module.exports = {
  parseDate,
  formatDate,
  calculateAgeInDays,
  calculateAgeMonths,
  formatAge,
  formatDuration,
  formatDurationChinese,
  parseTimestamp
};
