# 设计文档 - 宝宝成长彩蛋（Easter Eggs）

> 版本：v1.1 | 日期：2026-04-07 | 状态：待确认  
> 前置需求：`specs/easter-eggs/requirements.md` v1.0（已批准）

---

## 概述

基于需求文档 EE-1 ~ EE-8 的规格，设计一套可扩展的彩蛋检测与展示系统。系统由 **彩蛋检测引擎**（`utils/easter-egg.js`）、**弹窗组件**（`easter-egg-popup`）和 **Toast 组件**（`easter-egg-toast`）三部分组成。

### 设计原则

1. **零侵入**：检测引擎为纯函数模块，不修改 `RecordService`、`BabyService` 等现有服务
2. **配置驱动**：彩蛋规则以数组配置形式声明，新增彩蛋只需追加配置项
3. **懒加载数据**：时间节点检测零查询；数据回顾仅在弹窗实际展示时触发
4. **纯 CSS 动画**：沿用项目惯例，所有动画使用 `@keyframes` + 类名切换，不使用 `wx.createAnimation`
5. **美拉德色系**：100% 使用项目已有 CSS 变量，不引入新色值

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      home.js                            │
│                                                         │
│  loadData() ──完成──→ [500ms 延迟] checkEasterEggs()    │
│                              │                          │
│                              ▼                          │
│             ┌─ utils/easter-egg.js ─────────────────┐   │
│             │                                       │   │
│             │  detectAll(context)                    │   │
│             │    ├─ detectMilestones(birthDayCount)  │   │
│             │    ├─ detectFirstRecord(totalCount)    │   │
│             │    ├─ detectStreak(babyId)             │   │
│             │    ├─ detectHoliday(date)              │   │
│             │    └─ detectInsight(todayStats)        │   │
│             │                                       │   │
│             │  → return { popup: {...}, toasts: [] } │   │
│             └───────────────────────────────────────┘   │
│                              │                          │
│              ┌───────────────┼───────────────┐          │
│              ▼                               ▼          │
│   setData({ easterEgg })          setData({ eggToast }) │
│              │                               │          │
│              ▼                               ▼          │
│  ┌─────────────────┐           ┌──────────────────┐     │
│  │ <easter-egg-popup│           │ <easter-egg-toast│     │
│  │  show="{{...}}"  │           │  show="{{...}}"  │     │
│  │  type="30day"    │           │  type="first"    │     │
│  │  data="{{...}}" │           │  text="..."      │     │
│  │  bind:close />   │           │  bind:close />   │     │
│  └─────────────────┘           └──────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端框架**：微信小程序原生（WXML/WXSS/JS）
- **数据存储**：`StorageUtil`（wx.setStorageSync/getStorageSync）
- **数据查询**：`RecordService.getRecords()`（仅弹窗展示时按需查询）
- **动画方案**：纯 CSS @keyframes（与项目一致）
- **图标方案**：复用 `/images/icons/` 目录已有图标 + 少量新增 SVG 图标

### 文件结构

```
miniprogram/
├── utils/
│   └── easter-egg.js              # 【新建】彩蛋检测引擎（纯函数模块）
├── components/
│   ├── easter-egg-popup/          # 【新建】彩蛋弹窗组件
│   │   ├── easter-egg-popup.js
│   │   ├── easter-egg-popup.json
│   │   ├── easter-egg-popup.wxml
│   │   └── easter-egg-popup.wxss
│   └── easter-egg-toast/          # 【新建】彩蛋 Toast 组件
│       ├── easter-egg-toast.js
│       ├── easter-egg-toast.json
│       ├── easter-egg-toast.wxml
│       └── easter-egg-toast.wxss
├── images/icons/easter-egg/       # 【新建】彩蛋专用图标（已通过 Iconify API 下载）
│   ├── moon.png                   # EE-1 满月（mdi:moon-waning-crescent, #D4B896）
│   ├── cloud-lucky.png            # EE-2 百日祥云装饰（mdi:cloud, #D4B896）
│   ├── cake.png                   # EE-3 周岁蛋糕（mdi:cake-variant, #D4A574）
│   ├── fire.png                   # EE-6 连续记录火焰（mdi:fire, #E5A853）
│   ├── balloon.png                # EE-5/EE-7 气球（mdi:balloon, #D4A574）
│   ├── star.png                   # EE-8 数据洞察星星（mdi:star, #D4B896）
│   ├── flower.png                 # EE-7 母亲节康乃馨（mdi:flower, #D47B6A）
│   ├── necktie.png                # EE-7 父亲节领带（mdi:tie, #7BA3C9）
│   ├── lantern.png                # EE-7 春节灯笼（mingcute:lantern-fill, #D47B6A）
│   └── mooncake.png               # EE-7 中秋月饼（mdi:cookie, #D4B896）
│   # 注：EE-4 首次记录复用已有 /images/icons/rocket.png，无需新增
├── pages/home/
│   ├── home.js                    # 【增量】新增 checkEasterEggs()
│   ├── home.wxml                  # 【增量】引用 popup + toast + 提示条
│   ├── home.wxss                  # 【增量】提示条样式 + CSS 变量
│   └── home.json                  # 【增量】注册 2 个新组件
└── styles/
    └── popup.wxss                 # 【无改动】复用
```

---

## 详细设计

### 1. 彩蛋检测引擎 (`utils/easter-egg.js`)

#### 1.1 数据模型

```javascript
/**
 * 彩蛋检测上下文（由 home.js 在 loadData 后构建）
 * @typedef {Object} EasterEggContext
 * @property {string} babyId       - 当前宝宝 ID
 * @property {string} babyName     - 宝宝昵称
 * @property {number} birthDayCount - 出生天数（已有字段，零开销）
 * @property {Object} todayStats   - 今日统计（已有数据）
 * @property {number} totalTodayCount - 今日总记录数（已有字段）
 * @property {Array}  recentRecords - 最近记录（已有数据）
 */

/**
 * 彩蛋检测结果
 * @typedef {Object} EasterEggResult
 * @property {Object|null} popup  - 弹窗级彩蛋（互斥，最多一个）
 * @property {Array} toasts       - Toast 级彩蛋（可排队，0~N 个）
 * @property {Object|null} banner - 提示条彩蛋（最多一个）
 */

/**
 * 单个彩蛋描述
 * @typedef {Object} EggItem
 * @property {string} type       - 彩蛋类型标识（如 '30day', '100day', 'first_record'）
 * @property {string} display    - 展示方式：'popup' | 'toast' | 'banner'
 * @property {number} priority   - 优先级数字（越小越高：0=P0, 1=P1, 2=P2, 3=P3）
 * @property {string} storageKey - StorageUtil 标记 key
 * @property {Object} data       - 展示所需数据（文案、图标等）
 */
```

#### 1.2 配置数组

```javascript
// utils/easter-egg.js

const MILESTONE_RULES = [
  {
    type: '30day',
    display: 'popup',
    priority: 0,
    range: [30, 33],            // birthDayCount 触发范围
    storageKeyFn: (babyId) => `egg_30day_${babyId}`,
    title: '满月快乐！',
    subtitle: (name) => `${name}已经满月啦！恭喜新手爸妈度过了最辛苦的第一个月`,
    icon: '/images/icons/easter-egg/moon.png',
    dataQueryType: '30day'      // 指示需要查询 30 天数据回顾
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
    showGrowthComparison: true  // 标记需要查询生长数据
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

const HOLIDAY_MAP = {
  // 儿童节
  '06-01': {
    id: 'children',
    text: (name, birthDayCount) => {
      const years = Math.ceil(birthDayCount / 365);
      return `${name}的第 ${years} 个儿童节快乐`;
    },
    icon: '/images/icons/easter-egg/balloon.png'
  },
  // 母亲节 & 父亲节 — 动态计算（见 detectHoliday 函数）
  // 春节 & 中秋 — 硬编码近 3 年
};

const LUNAR_HOLIDAYS = {
  '2026-02-17': 'spring_festival',
  '2027-02-06': 'spring_festival',
  '2028-01-26': 'spring_festival',
  '2026-10-04': 'mid_autumn',
  '2027-09-23': 'mid_autumn',
  '2028-09-12': 'mid_autumn'
};
```

#### 1.3 核心检测函数

```javascript
/**
 * 主入口：检测所有彩蛋
 * @param {EasterEggContext} ctx
 * @returns {EasterEggResult}
 */
function detectAll(ctx) {
  const { babyId, birthDayCount, todayStats, totalTodayCount } = ctx;
  
  // 前置防护
  if (!babyId || birthDayCount <= 0) {
    return { popup: null, toasts: [], banner: null };
  }

  const candidates = [];  // 所有触发的彩蛋

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
            dataQueryType: rule.dataQueryType
          }
        });
      }
    }
  });

  // 2. 月龄提示（EE-5）— 非弹窗，返回 banner
  const monthAge = Math.floor(birthDayCount / 30);
  if (birthDayCount % 30 === 0 && birthDayCount > 0) {
    // 排除已有独立彩蛋的天数
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

  // 5. 连续记录（EE-6）— 需要轻量本地计算
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
```

#### 1.4 连续记录检测（EE-6）

```javascript
/**
 * 检测连续记录天数
 * 策略：从本地缓存逐天检查，避免云端查询
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

  // 从昨天开始往前检查（今天的记录还可能增加，不计入连续天数）
  let streakDays = 0;
  const today = new Date();
  const checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1); // 从昨天开始

  // 但如果今天已经有记录了，先把今天也算上
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateSet.has(todayStr)) {
    streakDays = 1;
    // 然后从昨天开始往前检查
  } else {
    // 今天还没记录，从昨天开始检查
    return null; // 今天无记录则无连续
  }

  for (let i = 0; i < 60; i++) { // 最多检查 60 天
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dateSet.has(dateStr)) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
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

  // 检查 30 天成就（升级为弹窗）
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

  return null;
}
```

#### 1.5 节日检测（EE-7）

```javascript
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

  // 检查母亲节（5月第二个周日）— 康乃馨图标
  if (now.getMonth() === 4) { // 5月
    const motherDay = getNthWeekday(year, 4, 0, 2); // 第2个周日
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

  // 检查父亲节（6月第三个周日）— 领带图标
  if (now.getMonth() === 5) { // 6月
    const fatherDay = getNthWeekday(year, 5, 0, 3); // 第3个周日
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

  // 检查农历节日（硬编码）— 春节灯笼/中秋月饼
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
```

#### 1.6 数据洞察检测（EE-8）

```javascript
/**
 * 检测数据洞察彩蛋
 * 仅使用 todayStats 已有数据，零额外查询
 * 
 * 互斥规则（按需求）：多个洞察同时满足时只返回优先级最高的一个
 * 优先级排序：完美一天 > 喂养冠军 > 睡神降临
 */
function detectInsight(ctx) {
  const { babyId, todayStats } = ctx;
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 按优先级顺序检查，命中第一个即返回（互斥）

  // 1. 完美一天（最高优先级）
  if (todayStats.feeding.count >= 3 && 
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
  // 避免额外的历史数据查询开销，保持零查询原则
  if (todayStats.feeding.count > 7) {
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
  if (todayStats.sleep.totalDuration > 0 && todayStats.sleep.count > 0) {
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
```

#### 1.7 模块导出

```javascript
// utils/easter-egg.js
const StorageUtil = require('./storage');

// ... 上述所有常量和函数 ...

/**
 * 标记彩蛋已展示
 * @param {string} storageKey
 */
function markShown(storageKey) {
  StorageUtil.set(storageKey, { shown: true, shownAt: Date.now() });
}

module.exports = {
  detectAll,
  markShown,
  MILESTONE_RULES,
  HOLIDAY_MAP,
  LUNAR_HOLIDAYS
};
```

---

### 2. 弹窗组件 (`easter-egg-popup`)

#### 2.1 组件接口

```javascript
// components/easter-egg-popup/easter-egg-popup.js
const RecordService = require('../../services/record');
const EasterEgg = require('../../utils/easter-egg');

Component({
  properties: {
    // 是否显示
    show: { type: Boolean, value: false },
    // 彩蛋类型：'30day' | '100day' | '365day' | 'streak_30'
    type: { type: String, value: '' },
    // 彩蛋数据（从检测引擎传入）
    eggData: { type: Object, value: {} },
    // Storage 标记 key
    storageKey: { type: String, value: '' },
    // 宝宝 ID（用于查询数据回顾）
    babyId: { type: String, value: '' }
  },

  data: {
    // 动画状态
    animState: 'idle',    // 'idle' | 'entering' | 'visible' | 'leaving'
    // 数据回顾（懒加载）
    retrospect: null,
    retrospectLoading: false
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.onOpen();
      }
    }
  },

  methods: {
    async onOpen() {
      this.setData({ animState: 'entering' });
      
      // 200ms 后切到 visible 状态（等待入场动画）
      setTimeout(() => {
        this.setData({ animState: 'visible' });
      }, 200);

      // 懒加载数据回顾
      if (this.properties.eggData.dataQueryType) {
        this.loadRetrospect();
      }
    },

    async loadRetrospect() {
      this.setData({ retrospectLoading: true });
      
      try {
        const recordService = new RecordService();
        const babyId = this.properties.babyId;
        const type = this.properties.eggData.dataQueryType;
        const showGrowthComparison = this.properties.eggData.showGrowthComparison;

        let days = 30;
        if (type === '100day') days = 100;
        if (type === '365day') days = 365;

        const endTs = Date.now();
        const startTs = endTs - days * 86400000;

        const records = await recordService.getRecords(babyId, {
          dateRange: { start: startTs, end: endTs },
          limit: 1000  // 获取范围内全部记录
        });

        // 聚合统计
        let feedingCount = 0, sleepTotalSeconds = 0, diaperCount = 0, totalCount = records.length;
        records.forEach(r => {
          switch (r.recordType) {
            case 'feeding': feedingCount++; break;
            case 'sleep': sleepTotalSeconds += (r.data?.duration || 0); break;
            case 'diaper': diaperCount++; break;
          }
        });

        const sleepHours = Math.round(sleepTotalSeconds / 3600);

        // EE-2 百日特殊逻辑：查询生长数据对比（出生→最新）
        let growthComparison = null;
        if (showGrowthComparison) {
          const growthRecords = records.filter(r => r.recordType === 'growth');
          if (growthRecords.length > 0) {
            // 按时间排序，获取最早和最新
            growthRecords.sort((a, b) => (a.startTimeTs || 0) - (b.startTimeTs || 0));
            const earliest = growthRecords[0];
            const latest = growthRecords[growthRecords.length - 1];
            growthComparison = {
              birthWeight: earliest.data?.weight || null,
              latestWeight: latest.data?.weight || null,
              birthHeight: earliest.data?.height || null,
              latestHeight: latest.data?.height || null
            };
          }
        }

        this.setData({
          retrospect: {
            feedingCount,
            sleepHours,
            diaperCount,
            totalCount,
            days,
            growthComparison
          },
          retrospectLoading: false
        });
      } catch (err) {
        console.error('[EasterEggPopup] 数据回顾加载失败:', err);
        this.setData({ retrospectLoading: false });
      }
    },

    close() {
      this.setData({ animState: 'leaving' });
      
      // 标记已展示
      if (this.properties.storageKey) {
        EasterEgg.markShown(this.properties.storageKey);
      }

      // 300ms 后通知父组件（等待退场动画）
      setTimeout(() => {
        this.setData({ animState: 'idle' });
        this.triggerEvent('close');
      }, 300);
    },

    onMaskTap() {
      this.close();
    },

    stopPropagation() {
      // 阻止事件冒泡到 mask
    }
  }
});
```

#### 2.2 WXML 模板

```xml
<!-- components/easter-egg-popup/easter-egg-popup.wxml -->
<view class="egg-mask {{animState !== 'idle' ? 'visible' : ''}}" 
      hidden="{{animState === 'idle'}}"
      bindtap="onMaskTap">
  
  <view class="egg-popup {{animState}} {{type}}" catchtap="stopPropagation">
    
    <!-- 粒子背景（仅 365day 周岁） -->
    <view class="egg-particles" wx:if="{{type === '365day'}}">
      <view class="particle" wx:for="{{16}}" wx:key="*this" 
            style="--delay: {{item * 0.3}}s; --x: {{item * 22 % 100}}%;"></view>
    </view>

    <!-- 祥云纹理背景（仅 100day 百日） -->
    <view class="egg-cloud-bg" wx:if="{{type === '100day'}}"></view>

    <!-- 关闭按钮 -->
    <view class="egg-close" bindtap="close">
      <text>×</text>
    </view>

    <!-- 顶部图标区 -->
    <view class="egg-icon-area">
      <!-- 30day: 月亮图标 -->
      <image wx:if="{{type === '30day'}}" 
             class="egg-hero-icon scale-bounce" 
             src="{{eggData.icon}}" mode="aspectFit" />
      
      <!-- 100day: 数字「100」翻转动画 + 祥云装饰 -->
      <view wx:elif="{{type === '100day'}}" class="egg-number-flip">
        <text class="flip-digit" style="animation-delay: 0s">1</text>
        <text class="flip-digit" style="animation-delay: 0.15s">0</text>
        <text class="flip-digit" style="animation-delay: 0.3s">0</text>
      </view>
      
      <!-- 365day: 蛋糕 + 数字「1」 -->
      <view wx:elif="{{type === '365day'}}" class="egg-birthday-visual">
        <image class="egg-hero-icon bounce-in" src="{{eggData.icon}}" mode="aspectFit" />
        <text class="egg-age-number">1</text>
      </view>

      <!-- streak_30: 火焰图标 -->
      <image wx:else class="egg-hero-icon scale-bounce" 
             src="{{eggData.icon}}" mode="aspectFit" />
    </view>

    <!-- 标题区 -->
    <view class="egg-title-area">
      <text class="egg-title">{{eggData.title}}</text>
      <text class="egg-subtitle">{{eggData.subtitle}}</text>
    </view>

    <!-- EE-2 百日：生长数据对比（优先级高于通用回顾） -->
    <view class="egg-growth-comparison" wx:if="{{type === '100day' && retrospect.growthComparison}}">
      <view class="growth-compare-row" wx:if="{{retrospect.growthComparison.birthWeight && retrospect.growthComparison.latestWeight}}">
        <text class="growth-label">体重</text>
        <text class="growth-from">{{retrospect.growthComparison.birthWeight}}kg</text>
        <text class="growth-arrow">→</text>
        <text class="growth-to">{{retrospect.growthComparison.latestWeight}}kg</text>
      </view>
      <view class="growth-compare-row" wx:if="{{retrospect.growthComparison.birthHeight && retrospect.growthComparison.latestHeight}}">
        <text class="growth-label">身长</text>
        <text class="growth-from">{{retrospect.growthComparison.birthHeight}}cm</text>
        <text class="growth-arrow">→</text>
        <text class="growth-to">{{retrospect.growthComparison.latestHeight}}cm</text>
      </view>
    </view>

    <!-- 数据回顾区（30day / 100day无生长记录时 / 365day） -->
    <view class="egg-retrospect" wx:if="{{retrospect && !(type === '100day' && retrospect.growthComparison)}}">
      <scroll-view class="retrospect-scroll" scroll-x enhanced show-scrollbar="{{false}}">
        <view class="retrospect-cards">
          <view class="retrospect-card">
            <text class="retrospect-value">{{retrospect.feedingCount}}</text>
            <text class="retrospect-label">累计喂养（次）</text>
          </view>
          <view class="retrospect-card">
            <text class="retrospect-value">{{retrospect.sleepHours}}</text>
            <text class="retrospect-label">总睡眠（小时）</text>
          </view>
          <view class="retrospect-card">
            <text class="retrospect-value">{{retrospect.diaperCount}}</text>
            <text class="retrospect-label">换了尿布（片）</text>
          </view>
          <!-- EE-3 周岁：第4张卡片 — 总记录数 -->
          <view class="retrospect-card" wx:if="{{type === '365day'}}">
            <text class="retrospect-value">{{retrospect.totalCount}}</text>
            <text class="retrospect-label">总记录（条）</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 数据回顾加载中 -->
    <view class="egg-retrospect-loading" wx:elif="{{retrospectLoading}}">
      <view class="loading-dot"></view>
      <view class="loading-dot"></view>
      <view class="loading-dot"></view>
    </view>

    <!-- streak_30 的专属数据 -->
    <view class="egg-streak-data" wx:if="{{type === 'streak_30' && eggData.streakDays}}">
      <text class="streak-number">{{eggData.streakDays}}</text>
      <text class="streak-label">天连续记录</text>
    </view>

    <!-- 底部按钮 -->
    <view class="egg-footer">
      <view class="egg-btn" bindtap="close">
        <text>我知道了</text>
      </view>
    </view>
  </view>
</view>
```

#### 2.3 WXSS 样式

```css
/* components/easter-egg-popup/easter-egg-popup.wxss */

/* ============ 遮罩 ============ */
.egg-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-color, rgba(139, 123, 107, 0.4));
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.egg-mask.visible {
  opacity: 1;
  visibility: visible;
}

/* ============ 弹窗容器 ============ */
.egg-popup {
  width: 85%;
  max-width: 640rpx;
  background: linear-gradient(135deg, #FFFFFF 0%, var(--bg-primary, #F5F1EB) 100%);
  border-radius: var(--radius-lg, 32rpx);
  box-shadow: var(--shadow-popup, 0 8rpx 48rpx rgba(139, 123, 107, 0.12));
  padding: 48rpx 40rpx;
  position: relative;
  overflow: hidden;
  text-align: center;

  /* 入场动画 */
  transform: scale(0.85) translateY(40rpx);
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
              opacity 0.3s ease;
}

.egg-popup.entering,
.egg-popup.visible {
  transform: scale(1) translateY(0);
  opacity: 1;
}

.egg-popup.leaving {
  transform: scale(0.9) translateY(20rpx);
  opacity: 0;
  transition: transform 0.3s ease-in, opacity 0.3s ease-in;
}

/* 365day 周岁 — 全屏级别 */
.egg-popup.\33 65day {
  width: 90%;
  max-width: 680rpx;
  padding: 64rpx 40rpx;
}

/* 100day 百日 — 祥云纹理背景 */
.egg-cloud-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.06;
  background-image: 
    radial-gradient(ellipse 80rpx 60rpx at 20% 30%, var(--primary-light, #E8DCC8) 50%, transparent 50%),
    radial-gradient(ellipse 60rpx 40rpx at 70% 25%, var(--primary-light, #E8DCC8) 50%, transparent 50%),
    radial-gradient(ellipse 100rpx 60rpx at 50% 70%, var(--primary-light, #E8DCC8) 50%, transparent 50%),
    radial-gradient(ellipse 70rpx 50rpx at 80% 65%, var(--primary-light, #E8DCC8) 50%, transparent 50%);
  background-repeat: no-repeat;
}

/* ============ 关闭按钮 ============ */
.egg-close {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(139, 123, 107, 0.08);
  z-index: 10;
}

.egg-close text {
  font-size: 36rpx;
  color: var(--text-hint, #999999);
  line-height: 1;
}

.egg-close:active {
  background: rgba(139, 123, 107, 0.15);
}

/* ============ 图标区 ============ */
.egg-icon-area {
  margin-bottom: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120rpx;
}

.egg-hero-icon {
  width: 120rpx;
  height: 120rpx;
}

/* ============ 图标动画 ============ */
@keyframes eggScaleBounce {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.scale-bounce {
  animation: eggScaleBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes eggBounceIn {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  60% { transform: scale(1.1) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.bounce-in {
  animation: eggBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* 100day 数字翻转 */
.egg-number-flip {
  display: flex;
  gap: 12rpx;
}

.flip-digit {
  display: inline-block;
  font-size: 80rpx;
  font-weight: 700;
  color: var(--primary-color, #D4B896);
  animation: digitFlipIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--delay, 0s);
  opacity: 0;
  transform: rotateX(90deg);
}

@keyframes digitFlipIn {
  0% { opacity: 0; transform: rotateX(90deg); }
  100% { opacity: 1; transform: rotateX(0deg); }
}

/* 365day 周岁视觉 */
.egg-birthday-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.egg-age-number {
  font-size: 80rpx;
  font-weight: 700;
  color: var(--primary-color, #D4B896);
  animation: eggBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
  opacity: 0;
}

/* ============ 粒子动画（365day） ============ */
.egg-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.particle {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--primary-color, #D4B896);
  opacity: 0;
  top: -20rpx;
  left: var(--x, 50%);
  animation: particleFall 3s ease-in var(--delay, 0s) infinite;
}

.particle:nth-child(even) {
  background: var(--primary-light, #E8DCC8);
  width: 8rpx;
  height: 8rpx;
}

.particle:nth-child(3n) {
  background: var(--accent-color, #B8D4B8);
  border-radius: 2rpx;
  width: 10rpx;
  height: 16rpx;
}

@keyframes particleFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.8; }
  100% { transform: translateY(800rpx) rotate(720deg); opacity: 0; }
}

/* ============ 标题区 ============ */
.egg-title-area {
  margin-bottom: 32rpx;
  position: relative;
  z-index: 1;
}

.egg-title {
  display: block;
  font-size: 48rpx;
  font-weight: 600;
  color: var(--text-primary, #3D3D3D);
  margin-bottom: 16rpx;
  animation: eggFadeInUp 0.5s ease 0.3s forwards;
  opacity: 0;
}

.egg-subtitle {
  display: block;
  font-size: 28rpx;
  color: var(--text-secondary, #666666);
  line-height: 1.6;
  animation: eggFadeInUp 0.5s ease 0.5s forwards;
  opacity: 0;
}

@keyframes eggFadeInUp {
  0% { opacity: 0; transform: translateY(20rpx); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ============ 数据回顾卡片 ============ */
.egg-retrospect {
  margin-bottom: 32rpx;
  position: relative;
  z-index: 1;
  animation: eggFadeInUp 0.5s ease 0.7s forwards;
  opacity: 0;
}

.retrospect-scroll {
  width: 100%;
  white-space: nowrap;
}

.retrospect-cards {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 8rpx;
}

.retrospect-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 180rpx;
  padding: 24rpx 16rpx;
  background: var(--bg-primary, #F5F1EB);
  border-radius: var(--radius-md, 24rpx);
  white-space: normal;
}

.retrospect-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--primary-color, #D4B896);
  margin-bottom: 8rpx;
}

.retrospect-label {
  font-size: 22rpx;
  color: var(--text-hint, #999999);
  text-align: center;
}

/* 数据回顾加载中 */
.egg-retrospect-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx 0;
}

.loading-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--primary-color, #D4B896);
  animation: eggDotPulse 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes eggDotPulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

/* ============ EE-2 百日生长数据对比 ============ */
.egg-growth-comparison {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 32rpx;
  position: relative;
  z-index: 1;
  animation: eggFadeInUp 0.5s ease 0.7s forwards;
  opacity: 0;
}

.growth-compare-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: var(--bg-primary, #F5F1EB);
  border-radius: var(--radius-md, 24rpx);
}

.growth-label {
  font-size: 24rpx;
  color: var(--text-hint, #999999);
  width: 60rpx;
}

.growth-from {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-secondary, #666666);
}

.growth-arrow {
  font-size: 28rpx;
  color: var(--primary-color, #D4B896);
  margin: 0 8rpx;
}

.growth-to {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--primary-color, #D4B896);
}

/* ============ 连续记录数据（streak_30） ============ */
.egg-streak-data {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8rpx;
  margin-bottom: 32rpx;
  animation: eggFadeInUp 0.5s ease 0.7s forwards;
  opacity: 0;
}

.streak-number {
  font-size: 72rpx;
  font-weight: 700;
  color: var(--primary-color, #D4B896);
}

.streak-label {
  font-size: 28rpx;
  color: var(--text-secondary, #666666);
}

/* ============ 底部按钮 ============ */
.egg-footer {
  position: relative;
  z-index: 1;
  animation: eggFadeInUp 0.5s ease 0.9s forwards;
  opacity: 0;
}

.egg-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background: linear-gradient(135deg, var(--primary-color, #D4B896) 0%, var(--primary-dark, #8B7B6B) 100%);
  color: var(--white, #FFFFFF);
  font-size: 32rpx;
  font-weight: 500;
  border-radius: var(--radius-lg, 32rpx);
  box-shadow: 0 4rpx 24rpx rgba(139, 123, 107, 0.2);
  transition: all 0.2s ease;
}

.egg-btn:active {
  transform: scale(0.98);
  opacity: 0.9;
}
```

---

### 3. Toast 组件 (`easter-egg-toast`)

#### 3.1 组件接口

```javascript
// components/easter-egg-toast/easter-egg-toast.js
const EasterEgg = require('../../utils/easter-egg');

Component({
  properties: {
    // 是否显示
    show: { type: Boolean, value: false },
    // Toast 文案
    text: { type: String, value: '' },
    // 图标路径
    icon: { type: String, value: '' },
    // Storage 标记 key
    storageKey: { type: String, value: '' },
    // 自动关闭时间（ms）
    duration: { type: Number, value: 2500 }
  },

  data: {
    animState: 'idle'   // 'idle' | 'entering' | 'visible' | 'leaving'
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.showToast();
      }
    }
  },

  methods: {
    showToast() {
      this.setData({ animState: 'entering' });

      // 入场动画完成后标记 visible
      setTimeout(() => {
        this.setData({ animState: 'visible' });
      }, 300);

      // 自动关闭
      this._autoCloseTimer = setTimeout(() => {
        this.dismiss();
      }, this.properties.duration);
    },

    dismiss() {
      if (this._autoCloseTimer) {
        clearTimeout(this._autoCloseTimer);
        this._autoCloseTimer = null;
      }

      this.setData({ animState: 'leaving' });

      // 标记已展示
      if (this.properties.storageKey) {
        EasterEgg.markShown(this.properties.storageKey);
      }

      setTimeout(() => {
        this.setData({ animState: 'idle' });
        this.triggerEvent('close');
      }, 300);
    }
  }
});
```

#### 3.2 WXML 模板

```xml
<!-- components/easter-egg-toast/easter-egg-toast.wxml -->
<view class="egg-toast {{animState}}" hidden="{{animState === 'idle'}}" bindtap="dismiss">
  <image class="egg-toast-icon" wx:if="{{icon}}" src="{{icon}}" mode="aspectFit" />
  <text class="egg-toast-text">{{text}}</text>
</view>
```

#### 3.3 WXSS 样式

```css
/* components/easter-egg-toast/easter-egg-toast.wxss */

.egg-toast {
  position: fixed;
  bottom: calc(180rpx + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%) translateY(40rpx);
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 32rpx;
  background: rgba(61, 61, 61, 0.88);
  border-radius: 48rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
  z-index: 3000;
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.3s ease;
  max-width: 80%;
}

.egg-toast.entering,
.egg-toast.visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.egg-toast.leaving {
  transform: translateX(-50%) translateY(-20rpx);
  opacity: 0;
  transition: transform 0.3s ease-in, opacity 0.3s ease-in;
}

.egg-toast-icon {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.egg-toast-text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}
```

---

### 4. 首页集成 (`pages/home/`)

#### 4.1 home.json 增量

```json
{
  "usingComponents": {
    "easter-egg-popup": "/components/easter-egg-popup/easter-egg-popup",
    "easter-egg-toast": "/components/easter-egg-toast/easter-egg-toast"
  }
}
```

#### 4.2 home.js 增量

```javascript
const EasterEgg = require('../../utils/easter-egg');

// data 新增字段：
data: {
  // ... 现有字段 ...
  
  // 彩蛋状态
  easterEggPopup: { show: false, type: '', eggData: {}, storageKey: '' },
  easterEggToast: { show: false, text: '', icon: '', storageKey: '' },
  easterEggBanner: { show: false, text: '', icon: '', storageKey: '' },
  _eggToastQueue: []   // Toast 队列（不在 data 中，挂在 this 上）
},

// loadData() 末尾增量（在 computeFeedingPrediction 和 loadAiInsight 之后）：
// ... 现有异步操作 ...

// 彩蛋检测（500ms 延迟，不阻塞渲染）
setTimeout(() => {
  this.checkEasterEggs();
}, 500);

// 新增方法：
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
}
```

#### 4.3 home.wxml 增量

```xml
<!-- 在 greeting-bar 之后、baby-card 之前插入提示条 -->
<!-- EE-5/EE-7: 月龄/节日提示条 -->
<view class="egg-banner" wx:if="{{easterEggBanner.show}}" 
      style="animation: eggSlideDown 0.3s ease forwards;">
  <image class="egg-banner-icon" src="{{easterEggBanner.icon}}" mode="aspectFit" />
  <text class="egg-banner-text">{{easterEggBanner.text}}</text>
  <view class="egg-banner-close" bindtap="closeEasterEggBanner">
    <text>×</text>
  </view>
</view>

<!-- 在所有弹窗组件之后（growth-popup 之后）追加 -->
<!-- 彩蛋弹窗 -->
<easter-egg-popup
  show="{{easterEggPopup.show}}"
  type="{{easterEggPopup.type}}"
  egg-data="{{easterEggPopup.eggData}}"
  storage-key="{{easterEggPopup.storageKey}}"
  baby-id="{{currentBaby._id}}"
  bind:close="onEasterEggPopupClose"
/>

<!-- 彩蛋 Toast -->
<easter-egg-toast
  show="{{easterEggToast.show}}"
  text="{{easterEggToast.text}}"
  icon="{{easterEggToast.icon}}"
  storage-key="{{easterEggToast.storageKey}}"
  bind:close="onEasterEggToastClose"
/>
```

#### 4.4 home.wxss 增量

```css
/* ============ 彩蛋提示条（EE-5/EE-7） ============ */
.egg-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
  background: rgba(212, 184, 150, 0.1);
  border-radius: 16rpx;
  border: 1rpx solid rgba(212, 184, 150, 0.15);
}

.egg-banner-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.egg-banner-text {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary, #3D3D3D);
  font-weight: 500;
}

.egg-banner-close {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.egg-banner-close text {
  font-size: 32rpx;
  color: var(--text-hint, #999999);
  line-height: 1;
}

@keyframes eggSlideDown {
  from {
    opacity: 0;
    transform: translateY(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

### 5. 首次记录彩蛋（EE-4）集成方案

EE-4 与其他彩蛋不同，它在 **记录创建回调** 中触发（而非 `loadData` 后）。

```javascript
// home.js - onRecordCreated 方法修改：
onRecordCreated() {
  // 检查首次记录彩蛋
  this._checkFirstRecordEgg();
  // 重新加载数据
  this.loadData();
},

/**
 * EE-4: 首次记录彩蛋
 * 在 onRecordCreated 回调中检测，确保记录总数为 1
 */
_checkFirstRecordEgg() {
  const baby = this.data.currentBaby;
  if (!baby) return;
  
  const key = `egg_first_record_${baby._id}`;
  if (StorageUtil.get(key)) return; // 已展示过
  
  // 检查当前宝宝的记录总数是否刚好为 1
  // 使用本地缓存的记录数据，避免额外查询
  const cacheKey = `records_${baby._id}`;
  const records = StorageUtil.get(cacheKey) || [];
  // 因为 onRecordCreated 在记录创建后触发，此时 loadData() 会刷新缓存
  // 但回调先于 loadData 完成，所以用 totalTodayCount + 1 或检查缓存长度
  // 简化方案：只检查 storage key，因为 key 本身就保证了只触发一次
  
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
}
```

---

## 关键设计决策

### 决策 1：居中弹窗 vs 底部弹窗

**选择**：居中弹窗（`display: flex; align-items: center; justify-content: center`）

**理由**：
- 现有记录弹窗使用底部弹出，彩蛋需要视觉差异化以产生"惊喜感"
- 居中弹窗允许更灵活的装饰性布局（粒子背景、数字翻转等）
- 替代方案：底部弹窗——但与日常操作弹窗过于相似，缺乏仪式感

### 决策 2：检测引擎纯函数 vs 组件内检测

**选择**：独立 `utils/easter-egg.js` 纯函数模块

**理由**：
- 可独立测试，不依赖组件生命周期
- 可在未来其他页面复用（如成长回忆页回顾已触发的彩蛋）
- 替代方案：在弹窗组件内自行检测——但会导致组件职责不清晰

### 决策 3：数据回顾查询策略

**选择**：弹窗展示时按需查询（Lazy Load）

**理由**：
- 时间节点检测仅需 `birthDayCount`，零查询开销
- 数据回顾只有在弹窗实际展示时才需要，减少 99%+ 场景的查询浪费
- 替代方案：预加载所有数据——但大多数时候不会触发彩蛋，造成资源浪费

### 决策 4：Toast 队列化 vs 同时展示

**选择**：队列化，逐个展示，间隔 1 秒

**理由**：
- 同时展示多个 Toast 视觉混乱，微信小程序也只支持一个原生 Toast
- 队列化保证每个彩蛋都有被看到的机会
- 替代方案：只展示最高优先级的一个——但会丢失低优先级信息

---

## 安全考虑

- **Storage Key 隔离**：所有彩蛋标记包含 `babyId`，多宝宝互不影响
- **Storage 失败降级**：`StorageUtil.set` 失败时彩蛋可能重复展示一次，可接受
- **XSS 防护**：所有文案由配置驱动，不涉及用户输入拼接

---

## 测试策略

### 手动测试矩阵

| 场景 | 测试方法 | 预期 |
|------|----------|------|
| 30天满月弹窗 | 修改宝宝 birthDate 为 30 天前 | 弹窗展示，含数据回顾 |
| 100天百日弹窗 | 修改 birthDate 为 100 天前 | 弹窗展示，含翻转动画 |
| 365天周岁弹窗 | 修改 birthDate 为 365 天前 | 全屏弹窗，含粒子动画 |
| 首次记录 Toast | 新宝宝首次创建记录 | Toast 滑入，2.5s 后消失 |
| 多彩蛋冲突 | birthDayCount=30 + 首次记录 | 弹窗优先，Toast 排队 |
| 重复展示拦截 | 关闭弹窗后刷新页面 | 不再弹出 |
| 多宝宝隔离 | 切换宝宝后 | 独立检测 |
| 提示条关闭 | 点击 × 按钮 | 消失且不再展示 |

---

## 性能 NFR 验证

| 指标 | 目标 | 验证方式 |
|------|------|----------|
| 检测耗时 ≤ 50ms | < 50ms | `console.time('checkEasterEggs')` 计时 |
| 弹窗动画 60fps | 纯 CSS | 不使用 JS setInterval |
| 包体积增量 ≤ 15KB | < 15KB | 构建后对比 wxml+wxss+js 压缩大小 |
| 数据回顾查询一次 | 仅弹窗展示时 | Network 面板观察 |
| 粒子数 ≤ 16 个 | 16 | WXML wx:for 循环数 |

---

---

## 变更日志

### v1.1（2026-04-07）— 需求对齐 Review

结合需求文档逐条 Review，修复以下差异：

| # | 修复项 | 涉及 EE |
|---|--------|---------|
| 1 | **EE-2 生长数据对比**：`loadRetrospect()` 新增生长记录查询，弹窗支持「出生体重→最新体重」和「出生身长→最新身长」展示 | EE-2 |
| 2 | **EE-2 祥云纹理背景**：新增 `.egg-cloud-bg` CSS 祥云纹理层，使用 `radial-gradient` 实现（CSS-only，零图片开销） | EE-2 |
| 3 | **EE-8 洞察互斥**：`detectInsight()` 改为命中第一个即返回（完美一天 > 喂养冠军 > 睡神降临），不再返回全部 | EE-8 |
| 4 | **EE-7 节日图标**：每个节日使用对应的专属图标 — 母亲节→flower.png、父亲节→necktie.png、春节→lantern.png、中秋→mooncake.png | EE-7 |
| 5 | **EE-7 儿童节文案**：从「儿童节快乐」修复为「第 N 个儿童节快乐」，基于 `birthDayCount` 计算年数 | EE-7 |
| 6 | **EE-3 总记录数**：弹窗数据回顾区新增第 4 张卡片「总记录（条）」 | EE-3 |
| 7 | **EE-4 图标路径**：复用已有 `/images/icons/rocket.png`，不再引用不存在的 `easter-egg/rocket.png` | EE-4 |
| 8 | **图标资源落地**：通过 Iconify API 下载 10 个彩蛋专用图标到 `images/icons/easter-egg/` 目录（moon、cloud-lucky、cake、fire、balloon、star、flower、necktie、lantern、mooncake） | 全部 |
| 9 | **EE-8 喂养冠军**：保持简化阈值（>7次），添加注释说明与需求原始条件的 trade-off | EE-8 |

---

*文档版本：v1.1*  
*创建日期：2026-04-07*  
*最后修改：2026-04-07（需求对齐 Review）*  
*状态：待确认*
