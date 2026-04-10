/**
 * 数据模型定义
 * 使用 JSDoc 定义数据结构
 */

/**
 * @typedef {Object} User
 * @property {string} _id - 用户 ID
 * @property {string} _openid - 微信 openid（系统自动添加）
 * @property {string} nickname - 昵称
 * @property {string} avatar - 头像 URL
 * @property {'parent'|'family_member'} role - 角色
 * @property {string} relation - 身份关系标识
 * @property {string} relationText - 身份关系文本
 * @property {string} [familyId] - 家庭 ID
 * @property {'admin'|'editor'|'viewer'} [familyRole] - 家庭角色
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * @typedef {Object} Family
 * @property {string} _id - 家庭 ID
 * @property {string} name - 家庭名称
 * @property {string} inviteCode - 邀请码
 * @property {string} creatorId - 创建者 ID
 * @property {Array<string>} members - 成员 ID 列表
 * @property {Array<string>} babies - 宝宝 ID 列表
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * @typedef {Object} Baby
 * @property {string} _id - 宝宝 ID
 * @property {string} familyId - 家庭 ID
 * @property {string} name - 姓名
 * @property {'male'|'female'} gender - 性别
 * @property {Date} birthDate - 出生日期
 * @property {string} [avatar] - 头像 URL
 * @property {Array<string>} [vaccinePlan] - 疫苗计划 ID 列表
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * @typedef {Object} Record
 * @property {string} _id - 记录 ID
 * @property {string} babyId - 宝宝 ID
 * @property {'feeding'|'sleep'|'diaper'|'temperature'|'growth'|'milestone'} recordType - 记录类型
 * @property {Date} startTime - 开始时间
 * @property {Date} [endTime] - 结束时间
 * @property {FeedingData|SleepData|DiaperData|TemperatureData|GrowthData|MilestoneData} data - 记录数据
 * @property {string} [note] - 备注
 * @property {string} [createdBy] - 创建者 ID
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * @typedef {Object} FeedingData
 * @property {'breast'|'formula'|'solid'} feedingType - 喂养类型
 * @property {number} [amount] - 喂养量 (ml)
 * @property {number} [duration] - 持续时间 (秒)
 * @property {string} [breastSide] - 母乳喂养侧 (left|right|both)
 */

/**
 * @typedef {Object} SleepData
 * @property {'night'|'nap'} sleepType - 睡眠类型
 * @property {number} duration - 持续时间 (秒)
 * @property {string} [location] - 睡眠地点
 */

/**
 * @typedef {Object} DiaperData
 * @property {'pee'|'poop'|'both'} diaperType - 排便类型
 * @property {'watery'|'soft'|'formed'|'hard'} [consistency] - 质地
 * @property {'normal'|'yellow'|'green'|'black'|'red'} [color] - 颜色
 */

/**
 * @typedef {Object} TemperatureData
 * @property {number} temperature - 体温 (°C)
 * @property {'oral'|'axillary'|'rectal'|'ear'} [method] - 测量方式
 */

/**
 * @typedef {Object} GrowthData
 * @property {number} height - 身高 (cm)
 * @property {number} weight - 体重 (kg)
 * @property {number} [headCircumference] - 头围 (cm)
 */

/**
 * @typedef {Object} MilestoneData
 * @property {string} milestoneId - 里程碑 ID
 * @property {string} category - 分类 (motor|cognitive|language|social)
 * @property {string} description - 描述
 * @property {Date} achievedDate - 达成日期
 */

/**
 * @typedef {Object} SyncStatus
 * @property {string} _id - 同步状态 ID
 * @property {string} userId - 用户 ID
 * @property {string} deviceId - 设备 ID
 * @property {number} lastSyncVersion - 最后同步版本号
 * @property {Date} lastSyncTime - 最后同步时间
 * @property {Array<Object>} offlineQueue - 离线操作队列
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 数据模型工厂函数
 */

/**
 * 创建用户对象
 * 注意：不需要传入 openid，系统会自动添加 _openid 字段
 * @returns {User}
 */
function createUser() {
  return {
    nickname: '',
    avatar: '',
    role: 'parent',
    relation: '',
    relationText: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * 创建家庭对象
 * @param {string} name - 家庭名称
 * @param {string} creatorId - 创建者 ID
 * @returns {Family}
 */
function createFamily(name, creatorId) {
  return {
    name,
    inviteCode: generateInviteCode(),
    creatorId,
    members: [creatorId],
    babies: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * 创建宝宝对象
 * @param {string} familyId - 家庭 ID
 * @param {string} name - 姓名
 * @param {'male'|'female'} gender - 性别
 * @param {Date} birthDate - 出生日期
 * @returns {Baby}
 */
function createBaby(familyId, name, gender, birthDate) {
  return {
    familyId,
    name,
    gender,
    birthDate,
    avatar: '',
    vaccinePlan: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * 创建记录对象
 * @param {string} babyId - 宝宝 ID
 * @param {string} recordType - 记录类型
 * @param {Object} data - 记录数据
 * @param {string} [note] - 备注
 * @returns {Record}
 */
function createRecord(babyId, recordType, data, note = '') {
  return {
    babyId,
    recordType,
    startTime: new Date(),
    data,
    note,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * 生成邀请码
 * @returns {string}
 */
function generateInviteCode() {
  // 去除易混淆字符：I/O/0/1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  createUser,
  createFamily,
  createBaby,
  createRecord,
  generateInviteCode
};
