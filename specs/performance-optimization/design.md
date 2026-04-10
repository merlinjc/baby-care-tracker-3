# 技术方案设计 — 小程序全面性能优化

## 1. 概述

### 1.1 文档目的
本文档是对 `specs/performance-optimization/requirements.md` 中 48 个有效 FR（FR-1 ~ FR-50，其中 FR-17/FR-29 已合并）的技术实现方案。设计目标是在 **不改变功能和 UI** 的前提下，系统性提升性能、减小包体积、治理缓存、消除重复代码。

### 1.2 设计原则
1. **最小侵入** — 优先局部修改，避免大规模重构
2. **向后兼容** — 保持所有页面路由路径不变、组件外部接口不变
3. **渐进式交付** — 按优先级分 6 个 Phase 交付，每个 Phase 可独立验证
4. **可度量** — 每个优化项附带可量化的验收指标

### 1.3 当前架构快照

```
miniprogram/
├── app.js              # 入口（云开发初始化、initUser、initSync）
├── app.json            # 18 页面全在主包，无 subpackages
├── pages/              # 18 个页面
│   ├── home/           # 首页（TabBar）— 8 个组件依赖
│   ├── record/         # 记录（TabBar）— 7 个组件依赖
│   ├── discover/       # 发现（TabBar）
│   ├── profile/        # 我的（TabBar）
│   ├── growth/         # 生长曲线
│   ├── vaccine/        # 疫苗接种
│   ├── milestone/      # 里程碑
│   ├── ai-assistant/   # AI 助手
│   ├── family/         # 家庭管理
│   ├── baby-list/      # 宝宝列表
│   ├── baby-create/    # 创建宝宝
│   ├── baby-detail/    # 宝宝详情
│   ├── family-create/  # 创建家庭
│   ├── family-join/    # 加入家庭
│   ├── export/         # 数据导出
│   ├── settings/       # 设置
│   ├── auth/           # 授权
│   └── guide/          # 引导
├── components/         # 15 个组件（6 弹窗 + 9 功能组件）
├── services/           # 13 个服务（RecordService/SyncService 有单例，其余 8 个无）
├── utils/              # 6 个工具（date/storage/network/deduplication 等）
├── config/             # 3 个静态数据文件（合计 31.48 KB）
├── models/             # 数据模型
├── styles/             # 4 个公共样式（全项目无 @import 引用）
└── images/             # 113 个 PNG（全部 < 2.18 KB）
```

**数据库集合（7 个）：** `records`、`users`、`babies`、`families`、`vaccine_records`、`milestone_records`、`conversations`

**数据流模式：** `getApp().globalData` + `StorageUtil` 本地存储 + `initPromise` 异步等待

---

## 2. 分阶段交付计划

| Phase | 主题 | 涉及 FR | 优先级 | 预估改动文件 |
|-------|------|---------|--------|-------------|
| 1 | 基础设施 & 工具层 | FR-6, FR-14, FR-10, FR-46, FR-40, FR-11 | P0/P1 | 8 新建/修改 |
| 2 | setData 合并 & 高频交互优化 | FR-1, FR-5, FR-34, FR-23, FR-36 | P0/P1 | 20+ 文件 |
| 3 | DB 查询 & 缓存治理 | FR-2, FR-3, FR-4, FR-18, FR-19, FR-33, FR-49, FR-37, FR-32, FR-28, FR-50 | P0/P1 | 15+ 文件 |
| 4 | 渲染 & WXML 优化 | FR-7, FR-8, FR-9, FR-22, FR-39, FR-38, FR-30, FR-45 | P0/P1/P2 | 20+ 文件 |
| 5 | 分包 & 包体积优化 | FR-31, FR-44, FR-42, FR-41, FR-43, FR-35 | P0/P1/P2 | 30+ 文件 |
| 6 | 代码质量 & 清理 | FR-12, FR-13, FR-15, FR-16, FR-20, FR-21, FR-24, FR-25, FR-26, FR-27, FR-47, FR-48 | P1/P2 | 20+ 文件 |

---

## 3. Phase 1: 基础设施 & 工具层

> **目标：** 为后续 Phase 提供公共工具函数和统一模式，避免重复工作。

### 3.1 FR-6: 创建 debounce/throttle 工具

**新建文件：** `miniprogram/utils/debounce.js`

```javascript
// utils/debounce.js
/**
 * 防抖函数
 * @param {Function} fn - 目标函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Function} 包装后的函数（附带 .cancel() 方法）
 */
function debounce(fn, ms) {
  let timer = null;
  const wrapped = function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  };
  wrapped.cancel = function() {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return wrapped;
}

/**
 * 节流函数（leading edge）
 * @param {Function} fn - 目标函数
 * @param {number} ms - 节流间隔
 * @returns {Function} 包装后的函数（附带 .cancel() / .force() 方法）
 */
function throttle(fn, ms) {
  let lastTime = 0;
  let timer = null;
  const wrapped = function(...args) {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, ms - (now - lastTime));
    }
  };
  wrapped.cancel = function() {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return wrapped;
}

module.exports = { debounce, throttle };
```

**设计决策：**
- 采用 leading-edge throttle（首次触发立即执行），符合 onShow 节流场景
- 每个包装函数附带 `.cancel()` 方法，配合组件 `detached` / 页面 `onUnload` 清理
- 不依赖任何外部库，零副作用

**应用点：**
| 使用位置 | 函数 | 参数 | FR |
|----------|------|------|----|
| `record.js#onSearch` | `debounce` | 300ms | FR-6 |
| `growth.js#onShow` | `throttle` | 30000ms | FR-2 |
| `ai-assistant.js#onShow` | `throttle` | 30000ms | FR-2 |
| `baby-list.js#onShow` | `throttle` | 30000ms | FR-2 |
| `family.js#onShow` | `throttle` | 30000ms | FR-2 |
| 6 个弹窗 `onTouchMove` | `throttle` | 16ms | FR-5 |

#### 3.1.1 FR-6 AC3/AC4: record.js 搜索逻辑设计

**需求：** 搜索使用已加载的 records 本地筛选，关键词 < 2 字符时不触发搜索。

```javascript
// record.js
const { debounce } = require('../../utils/debounce');

Page({
  onLoad() {
    this._debouncedSearch = debounce((keyword) => {
      this._executeLocalSearch(keyword);
    }, 300);
  },

  onSearch(e) {
    const keyword = (e.detail.value || '').trim();
    this.setData({ searchKeyword: keyword });
    
    // AC4: 关键词 < 2 字符时不触发搜索，清空搜索结果
    if (keyword.length < 2) {
      this.setData({ searchResults: null, isSearching: false });
      return;
    }
    
    this._debouncedSearch(keyword);
  },

  // AC3: 使用已加载的 records 本地筛选（不重新查库）
  _executeLocalSearch(keyword) {
    const records = this.data.allRecords || [];
    const kw = keyword.toLowerCase();
    
    const filtered = records.filter(r => {
      // 按记录类型 label、备注、数据值等字段匹配
      const typeLabel = TYPE_LABELS[r.recordType] || '';
      const note = (r.data && r.data.note) || '';
      return typeLabel.includes(kw) || note.toLowerCase().includes(kw);
    });
    
    this.setData({ searchResults: filtered, isSearching: true });
  },

  onUnload() {
    if (this._debouncedSearch) this._debouncedSearch.cancel();
  }
});
```

---

### 3.2 FR-14: Service 单例模式统一

**问题：** 13 个 Service 中仅 `RecordService` 和 `SyncService` 有单例保护，其余 8 个每次 `new` 都创建新实例。

**方案：** 为以下 8 个 Service 添加模块级单例守卫（与 RecordService 模式一致）：

```javascript
// 统一单例模式模板（以 FamilyService 为例）
let instance = null;

class FamilyService {
  constructor() {
    if (instance) return instance;
    this.db = wx.cloud.database();
    // ... 初始化逻辑
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new FamilyService();
    return instance;
  }
}
```

**改造文件清单：**

| 文件 | 当前状态 | 改造方式 |
|------|---------|---------|
| `services/family.js` | 无单例 | 加 `let instance = null` + constructor 守卫 + `getInstance()` |
| `services/ai.js` | 无单例 | 同上 |
| `services/content-filter.js` | 无单例 | 同上 |
| `services/subscribe.js` | 无单例 | 同上（FR-41 可能删除此文件，此处先加保护） |
| `services/auth.js` | 无单例 | 同上 |
| `services/quota.js` | 无单例 | 同上 |
| `services/filterService.js` | 无单例 | 同上 |
| `services/trendService.js` | 无单例 | 同上 |

**页面级缓存改造：**
- `record.js` 中 6 处 `new RecordService()` → 页面 `onLoad` 中 `this._recordService = new RecordService()` 复用
- `home.js` 中 3 处同理
- 其他页面中 `new XxxService()` 统一改为页面级缓存

---

### 3.3 FR-10: 重复 calculateAgeMonths 统一

**现状：** 8 处重复实现，`utils/date.js` 已有标准版本。

**方案：** 逐文件替换为 `require('../../utils/date.js').calculateAgeMonths`

| 文件 | 当前实现 | 改动 |
|------|---------|------|
| `home.js` | 内联 `calculateAgeMonths()` | 删除，改用 `require` |
| `growth.js` | 内联 + `maxMonths=24` | 改用 `calculateAgeMonths(birthDate, 24)` |
| `milestone.js` | 内联 + `maxMonths=12` | 改用 `calculateAgeMonths(birthDate, 12)` |
| `ai-assistant.js` | 内联 | 删除，改用 `require` |
| `baby-list.js` | 内联 | 删除，改用 `require` |
| `components/baby-card/baby-card.js` | 内联 | 删除，改用 `require` |
| `components/report-popup/report-popup.js` | 内联 | 删除，改用 `require` |
| `services/baby.js` | `calculateAgeInMonths` + `calculateAgeInDays` + `formatAge` | 删除三个方法，改用 `utils/date.js` 导出 |

---

### 3.4 FR-46: parseTimestamp 函数统一

**现状：** 3 处重复实现（`record.js`、`timeline.js`、`report-popup.js`），逻辑完全相同。

**方案：** 将 `record.js` 中的 `parseTimestamp` 提取到 `utils/date.js`，支持 5 种格式：

```javascript
// 追加到 utils/date.js
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp;
  if (typeof timestamp === 'object') {
    if (timestamp.$date) { /* ... */ }
    if (typeof timestamp.seconds === 'number') { /* ... */ }
    if (typeof timestamp._seconds === 'number') { /* ... */ }
    if (typeof timestamp.getTime === 'function') { /* ... */ }
  }
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

// module.exports 中增加 parseTimestamp
```

**改造：**
- `record.js`: 删除 `parseTimestamp` 方法，构造函数中 `this.parseTimestamp = require('../utils/date').parseTimestamp`（保持内部调用兼容）
- `timeline.js`: 删除内联 `parseTimestamp`，顶部 `const { parseTimestamp } = require('../../utils/date')`
- `report-popup.js`: 同上

---

### 3.5 FR-40: computeGreeting weekDays 缓存

**方案：** 在 `home.js` 顶部声明模块级常量：

```javascript
// home.js 顶部
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
```

`computeGreeting()` 内部直接引用 `WEEK_DAYS[day]`，避免每次调用重建数组。

---

### 3.6 FR-11: ContentFilterService 关键词提升

**方案：** 在 `services/content-filter.js` 模块顶部声明常量：

```javascript
// 模块级常量（避免每次 new 时重建）
const PARENTING_KEYWORDS = ['宝宝', '婴儿', '幼儿', /* ... */];
const BLACKLIST_KEYWORDS = ['广告', '推销', /* ... */];
```

构造函数中改为引用：`this.parentingKeywords = PARENTING_KEYWORDS;`

`checkRelevance()` 中 `.filter().length > 0` 改为 `.some()` 短路返回。

---

## 4. Phase 2: setData 合并 & 高频交互优化

> **目标：** 减少 setData 调用次数，降低视图层-逻辑层通信开销。

### 4.1 FR-1: setData 合并（P0）

**核心策略：** 在同一函数内将多次 setData 合并为一次，通过构建一个 `patch` 对象收集所有变更。

#### 4.1.1 home.js#loadData() 合并

**当前问题：** `loadData()` 中 3-5 次连续 setData。

**方案：**
```javascript
async loadData() {
  // 收集所有需要更新的数据到 patch 对象
  const patch = {};
  
  // 1. 加载记录
  const records = await this._recordService.getRecords(babyId, options);
  patch.records = records;
  patch.hasRecords = records.length > 0;
  
  // 2. 加载今日统计
  const stats = await this._recordService.getTodayStats(babyId);
  Object.assign(patch, this._formatStats(stats));
  
  // 3. 计算睡眠时长文本
  patch.sleepDurationText = this._computeSleepDurationText(stats);
  
  // 4. 一次性 setData
  this.setData(patch);
  
  // 5. 后续非 UI 计算
  this.computeFeedingPrediction(records);
}
```

#### 4.1.2 home.js#onShow() 合并

**方案：** 将 `setData({ currentBaby })` + `computeGreeting` 结果 + `checkActiveSleep` 结果合并：

```javascript
onShow() {
  const patch = {};
  const baby = getApp().globalData.currentBaby;
  if (baby) patch.currentBaby = baby;
  
  // 问候语计算（纯同步）
  const greetingData = this.computeGreeting(); // 返回 { greeting, dateStr }
  Object.assign(patch, greetingData);
  
  // 活跃睡眠检查（纯同步，读本地状态）
  const sleepData = this.checkActiveSleep();
  Object.assign(patch, sleepData);
  
  this.setData(patch);
  
  // 异步数据加载（已有 30s 节流）
  this._throttledLoadData();
}
```

#### 4.1.3 ai-assistant.js#onSend() 路径更新

**当前问题：** 每次 AI 回复都整体替换 `messages` 数组。

**方案：** 使用 setData 路径更新语法：
```javascript
// 追加新消息
this.setData({ [`messages[${this.data.messages.length}]`]: newMessage });

// 更新最后一条消息的内容（流式回复）
this.setData({ [`messages[${lastIdx}].content`]: updatedContent });
```

#### 4.1.4 弹窗组件 setData 合并

**统一模式（以 feeding-popup.js 为例）：**
```javascript
// Before: 2 次 setData
selectQuickAmount(e) {
  this.setData({ selectedAmount: amount });  // 第1次
  this.setData({ customAmount: '' });        // 第2次
}

// After: 1 次 setData
selectQuickAmount(e) {
  this.setData({ selectedAmount: amount, customAmount: '' });
}
```

**涉及文件和具体位置：**

| 文件 | 函数 | 当前次数 | 目标 |
|------|------|---------|------|
| `feeding-popup.js` | `selectQuickAmount` | 2 | 1 |
| `feeding-popup.js` | `clearAmount` | 2 | 1 |
| `feeding-popup.js` | `selectQuickDuration` | 2 | 1 |
| `feeding-popup.js` | `clearDuration` | 2 | 1 |
| `sleep-popup.js` | 同上 4 个函数 | 各 2 | 各 1 |
| `temperature-popup.js` | `onTemperatureInput` | 2 | 1（合并 checkFever） |
| `diaper-popup.js` | `selectType` | 3（最坏） | 1 |
| `baby-list.js` | `selectBaby` | 2 | 1 |

---

### 4.2 FR-5: 弹窗 onTouchMove 优化（P0）

**问题：** 6 个弹窗的 `touchStartY` 在 `data` 中（触发 setData），`onTouchMove` 每帧更新 `popupTranslateY`。

**方案 A（推荐）：抽取公共 Behavior + 16ms 节流**

**新建文件：** `miniprogram/behaviors/swipe-close.js`

```javascript
// behaviors/swipe-close.js
const { throttle } = require('../utils/debounce');

module.exports = Behavior({
  properties: {
    show: { type: Boolean, value: false }
  },
  
  data: {
    popupTranslateY: 0,
    isClosing: false
  },
  
  lifetimes: {
    attached() {
      // 实例属性（不走 setData）
      this._touchStartY = 0;
      this._touchStartTranslateY = 0;
      
      // 16ms 节流的 setData
      this._throttledSetTranslateY = throttle((y) => {
        this.setData({ popupTranslateY: y });
      }, 16);
    },
    detached() {
      if (this._throttledSetTranslateY) {
        this._throttledSetTranslateY.cancel();
      }
    }
  },
  
  methods: {
    onTouchStart(e) {
      this._touchStartY = e.touches[0].clientY;
      this._touchStartTranslateY = this.data.popupTranslateY;
    },
    
    onTouchMove(e) {
      const deltaY = e.touches[0].clientY - this._touchStartY;
      if (deltaY > 0) { // 仅下滑
        this._throttledSetTranslateY(this._touchStartTranslateY + deltaY);
      }
    },
    
    onTouchEnd(e) {
      const deltaY = e.changedTouches[0].clientY - this._touchStartY;
      if (deltaY > 150) {
        // 滑动超过阈值，关闭弹窗
        this.setData({ isClosing: true });
        this.triggerEvent('close');
      } else {
        // 回弹
        this.setData({ popupTranslateY: 0 });
      }
    }
  }
});
```

**6 个弹窗组件改造：**
```javascript
// 以 feeding-popup.js 为例
const swipeClose = require('../../behaviors/swipe-close');

Component({
  behaviors: [swipeClose],
  // 删除原有的 touchStartY (data)、onTouchStart、onTouchMove、onTouchEnd
  // Behavior 中的同名方法自动生效
});
```

**方案 B（进阶，FR-45 配合）：WXS 处理触摸动画**

若后续引入 WXS，可将整个触摸动画逻辑移入 WXS 层，彻底消除逻辑层-视图层通信。Phase 4 的 FR-45 中详述。

---

### 4.3 FR-34: vaccine.js 连续 setData 合并

```javascript
// Before
onFilterChange(e) {
  const status = e.currentTarget.dataset.status;
  this.setData({ filterStatus: status });           // 第1次
  this.setData({ filteredList: this.filterList() }); // 第2次
}

// After
onFilterChange(e) {
  const status = e.currentTarget.dataset.status;
  this.setData({
    filterStatus: status,
    filteredList: this._filterList(status)  // 传参避免依赖 data 更新
  });
}
```

---

### 4.4 FR-23: sleep-popup 计时器优化

**方案：**
1. `trackingInterval` 从 `data` 移到 `this._trackingInterval`（实例属性）
2. 降低更新频率到每 5 秒一次（用户感知足够）
3. `detached` 中清理 `clearInterval(this._trackingInterval)`

---

### 4.5 FR-36: 弹窗 wx:if 改 hidden

**方案：** 在父页面 WXML 中将弹窗组件的 `wx:if` 改为 `hidden`：

```xml
<!-- Before -->
<feeding-popup wx:if="{{showFeedingPopup}}" show="{{showFeedingPopup}}" bind:close="onPopupClose" />

<!-- After -->
<feeding-popup hidden="{{!showFeedingPopup}}" show="{{showFeedingPopup}}" bind:close="onPopupClose" />
```

**注意事项：**
- 弹窗组件内部已有 `show` 属性 observer，`hidden` 切换时组件不销毁重建
- 需确保 `show=false` 时组件不执行后台逻辑（检查定时器、网络请求等）
- 高频弹窗优先：`feeding-popup`、`diaper-popup`、`sleep-popup`
- 内存影响评估：6 个弹窗常驻约增加 ~50KB 内存，在可接受范围内

**涉及页面：**

| 页面 | 弹窗组件 | 优先级 |
|------|---------|-------|
| `home.wxml` | feeding-popup, sleep-popup, diaper-popup, temperature-popup, growth-popup | 高 |
| `record.wxml` | feeding-popup, sleep-popup, diaper-popup, temperature-popup, report-popup | 高 |
| `growth.wxml` | growth-popup（如有） | 中 |
| `baby-detail.wxml` | baby-edit-popup | 低 |

---

## 5. Phase 3: DB 查询 & 缓存治理

> **目标：** 减少不必要的数据库请求，治理缓存膨胀。

### 5.1 FR-2: onShow 节流统一（P0）

**方案：** 在 4 个页面的 `onLoad` 中创建节流函数，`onShow` 中调用：

```javascript
// growth.js 示例
const { throttle } = require('../../utils/debounce');

Page({
  onLoad() {
    this._throttledLoad = throttle(() => this.loadData(), 30000);
  },
  onShow() {
    this._throttledLoad();
  },
  onPullDownRefresh() {
    // 下拉刷新跳过节流，强制加载
    this.loadData();
  },
  onUnload() {
    if (this._throttledLoad) this._throttledLoad.cancel();
  }
});
```

**4 个页面改造清单：**

| 页面 | 当前 onShow | 改造后 |
|------|-----------|--------|
| `growth.js` | 直接调用 loadData（无节流） | 30s 节流 |
| `ai-assistant.js` | 直接查 DB（2+ 次） | 30s 节流 |
| `baby-list.js` | 直接查 DB | 30s 节流 |
| `family.js` | 直接查 DB + 可能生成邀请码 | 30s 节流 |

> `home.js` 已有 30s 节流，无需改动。

---

### 5.2 FR-3: record.js 筛选计数优化（P0）

**当前问题：** 每次 `loadData` 后调用 `calculateFilterCounts()`，触发 6 次并行 DB count 请求。

**方案：**
```javascript
async loadData(options = {}) {
  const { refresh = false } = options;
  
  // ... 加载记录逻辑 ...
  
  // 仅 refresh 时重新计算筛选计数
  if (refresh) {
    this._loadFilterCounts(babyId);
  }
}

// 独立方法 + 30s 缓存
_filterCountsCache = { data: null, ts: 0, babyId: null };

async _loadFilterCounts(babyId) {
  const now = Date.now();
  const cache = this._filterCountsCache;
  if (cache.babyId === babyId && cache.data && now - cache.ts < 30000) {
    this.setData({ filterCounts: cache.data });
    return;
  }
  
  try {
    const counts = await this.calculateFilterCounts(babyId);
    this._filterCountsCache = { data: counts, ts: now, babyId };
    this.setData({ filterCounts: counts });
  } catch (err) {
    // 降级：基于本地数据计算
  }
}
```

---

### 5.3 FR-4: Canvas / SystemInfo 缓存（P0）

**方案 1 — SystemInfo 全局缓存：**

在 `app.js` 的 `onLaunch` 中缓存：

```javascript
// app.js onLaunch 中
this.globalData.systemInfo = wx.getSystemInfoSync();
```

3 处调用点（`growth.js`、`share-canvas.js`、`report-popup.js`）改为 `getApp().globalData.systemInfo`。

**方案 2 — drawChart 优化：**

```javascript
// growth.js 页面级缓存
onLoad() {
  this._months = Array.from({ length: 25 }, (_, i) => i); // 0-24 固定数组
  this._bindDrawHelpers(); // 绑定 getY/drawBand 到实例方法
}

// drawChart 中引用 this._months，不再每次创建
```

---

### 5.4 FR-49: vaccine/milestone 查询加 limit + 分页（🔴 P0）

**问题：** 微信小程序端 `.get()` 默认 limit=20，超过 20 条记录会静默截断。

**方案：创建分页查询工具函数**

```javascript
// utils/db-helper.js（新建）
/**
 * 分页获取全量数据（突破小程序端 20 条 limit 限制）
 * @param {Object} query - 已经 .where() 后的查询对象
 * @param {number} pageSize - 每页大小（默认 100）
 * @returns {Promise<Array>} 全量数据
 */
async function fetchAll(query, pageSize = 100) {
  let allData = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data } = await query.skip(offset).limit(pageSize).get();
    allData = allData.concat(data);
    offset += data.length;
    hasMore = data.length === pageSize;
  }
  
  return allData;
}

module.exports = { fetchAll };
```

**vaccine.js 改造：**
```javascript
const { fetchAll } = require('../../utils/db-helper');

// Before (第 105-109 行)
const { data } = await db.collection('vaccine_records').where({ babyId }).get();

// After
const data = await fetchAll(
  db.collection('vaccine_records').where({ babyId }).orderBy('createdAt', 'desc')
);
```

**milestone.js 同理改造（第 100-102 行）。**

**长期方案（FR-49.AC5）：** 封装 `VaccineService` 和 `MilestoneService`，与项目 Service 层保持一致。结构参照 `RecordService` 但更轻量（无离线缓存需求）。

---

### 5.5 FR-18: getTodayStats 缓存

**方案：** 在 `RecordService` 中添加内存缓存：

```javascript
// record.js
_todayStatsCache = { data: null, ts: 0, key: '' };

async getTodayStats(babyId) {
  const dateKey = new Date().toDateString();
  const cacheKey = `${babyId}_${dateKey}`;
  const now = Date.now();
  
  if (this._todayStatsCache.key === cacheKey && 
      now - this._todayStatsCache.ts < 15000) { // 15s 缓存
    return this._todayStatsCache.data;
  }
  
  const stats = await this._computeTodayStats(babyId);
  this._todayStatsCache = { data: stats, ts: now, key: cacheKey };
  return stats;
}
```

---

### 5.6 FR-19: trendService 遍历优化 + 缓存

**方案：一次遍历分桶**

```javascript
// trendService.js
_classifyRecords(records) {
  const buckets = { feeding: [], sleep: [], diaper: [], temperature: [] };
  for (const r of records) {
    if (buckets[r.recordType]) {
      buckets[r.recordType].push(r);
    }
  }
  return buckets;
}

async getTrendData(babyId) {
  // 缓存检查（30s）
  const now = Date.now();
  if (this._cache && this._cache.babyId === babyId && now - this._cache.ts < 30000) {
    return this._cache.data;
  }
  
  const [thisWeek, lastWeek] = await Promise.all([...]);
  
  // 一次遍历分桶（代替 8 次独立 .filter）
  const thisWeekBuckets = this._classifyRecords(thisWeek);
  const lastWeekBuckets = this._classifyRecords(lastWeek);
  
  const trendData = {
    feeding: this.calculateChange(thisWeekBuckets.feeding.length, lastWeekBuckets.feeding.length),
    sleep: this._calcSleepTrend(thisWeekBuckets.sleep, lastWeekBuckets.sleep),
    diaper: this.calculateChange(thisWeekBuckets.diaper.length, lastWeekBuckets.diaper.length),
    temperature: this._calcTempTrend(thisWeekBuckets.temperature)
  };
  
  this._cache = { data: { trendData, trendPeriod }, babyId, ts: now };
  return this._cache.data;
}
```

---

### 5.7 FR-33: todo.js 查询加 limit（使用 fetchAll）

**问题分析：** `_computeVaccineStats()` 和 `_computeMilestoneStats()` 中的 `.get()` 无 limit，受小程序端默认 20 条限制会截断数据。

**⚠️ 代码验证：这两个方法需要全量遍历记录**（用 `.find()` 逐一比对 vaccinePlans/milestoneDefs 来计算"哪些未完成"，返回完整的 items 数组），**不能用 `.count()` 替代**。

**方案：复用 FR-49 的 `fetchAll` 工具**

```javascript
// todo.js
const { fetchAll } = require('../utils/db-helper');

async _computeVaccineStats(baby, ageMonths) {
  // Before: const vaccineRecords = await this.db.collection('vaccine_records')
  //           .where({ babyId: baby._id }).get();
  
  // After: 使用 fetchAll 确保全量获取（突破 20 条限制）
  const data = await fetchAll(
    this.db.collection('vaccine_records').where({ babyId: baby._id })
  );
  
  // 优化：预建索引，避免循环内 O(n) 查找
  const doneSet = new Set(data.map(r => `${r.name}||${r.dose}`));
  
  const vaccinePlans = this._getVaccinePlans(baby.birthDate);
  let count = 0, overdueCount = 0;
  const items = [];
  
  vaccinePlans.forEach(plan => {
    if (plan.monthAge <= ageMonths) {
      plan.vaccines.forEach(v => {
        if (!doneSet.has(`${v.name}||${v.dose}`)) {
          count++;
          // ... 构建 items
        }
      });
    }
  });
  
  return { count, overdue: overdueCount, items };
}

// _computeMilestoneStats 同理使用 fetchAll + Set 索引优化
```

> **注意：** 这里复用了 FR-49 的 `utils/db-helper.js#fetchAll`，Phase 3 中 FR-49 和 FR-33 可并行开发，共享同一工具函数。同时通过 `Set` 索引将循环内 `.find()` 的 O(n) 查找优化为 O(1)。

---

### 5.8 FR-37: 记录缓存统一治理（含 FR-17）

**方案：**

1. **缓存大小限制：** `updateLocalCache` 和 `saveToLocalCache` 中添加 `.slice(0, 200)`

```javascript
// record.js
saveToLocalCache(babyId, records) {
  const sorted = records.sort((a, b) => b.startTimeTs - a.startTimeTs);
  const trimmed = sorted.slice(0, 200); // 最多 200 条
  StorageUtil.set(`records_baby_${babyId}`, trimmed);
}
```

2. **指定 babyId 更新：** `updateRecordInCache(recordId, data)` 当前遍历所有宝宝缓存查找记录（`familyInfo.babies.forEach`），改为仅更新对应 babyId 的缓存

```javascript
// record.js — 方案 A：扩展方法签名（推荐）
// 新增 babyId 参数（可选，向后兼容）
updateRecordInCache(recordId, data, babyId) {
  if (babyId) {
    // 直接定位，无需遍历
    const key = this.getLocalCacheKey(babyId);
    const cached = StorageUtil.get(key) || [];
    const idx = cached.findIndex(r => r._id === recordId);
    if (idx >= 0) {
      cached[idx] = { ...cached[idx], ...data, updatedAt: new Date() };
      StorageUtil.set(key, cached.slice(0, 200)); // 同时应用大小限制
    }
    return;
  }
  
  // 无 babyId 时降级为遍历（兼容旧调用方式）
  const familyInfo = StorageUtil.getFamilyInfo();
  if (!familyInfo || !familyInfo.babies) return;
  familyInfo.babies.forEach(bid => {
    const key = this.getLocalCacheKey(bid);
    const records = StorageUtil.get(key) || [];
    const index = records.findIndex(r => r._id === recordId);
    if (index >= 0) {
      records[index] = { ...records[index], ...data, updatedAt: new Date() };
      StorageUtil.set(key, records.slice(0, 200));
    }
  });
}
```

> **注：** 调用处（record.js L467/470/485）的 `data` 参数中包含 `babyId` 字段时，应传入第三个参数 `this.updateRecordInCache(recordId, data, data.babyId)`。

3. **孤立缓存清理（FR-37 AC4）：** 当宝宝被删除后，`records_baby_{oldBabyId}` 的缓存会残留。

```javascript
// 在 app.js onLaunch 的缓存监控中添加：
_cleanOrphanedCache() {
  const familyInfo = StorageUtil.getFamilyInfo();
  const validBabyIds = new Set(familyInfo && familyInfo.babies || []);
  const storageInfo = wx.getStorageInfoSync();
  
  storageInfo.keys.forEach(key => {
    const match = key.match(/^records_baby_(.+)$/);
    if (match && !validBabyIds.has(match[1])) {
      StorageUtil.remove(key); // 清理孤立缓存
    }
  });
}
```

3. **全局缓存监控（app.js）：**

```javascript
// app.js onLaunch 中
const storageInfo = wx.getStorageInfoSync();
if (storageInfo.currentSize > 8000) { // 超过 8MB 告警
  this._cleanupExpiredCache();
}
```

---

### 5.9 FR-32: AI 洞察缓存过期清理

**现状：** 缓存逻辑内联在 `home.js#loadAiInsight()` 方法中（非独立方法），使用 `StorageUtil.get(cacheKey)` / `StorageUtil.set(cacheKey, { text, fallback })` 读写，key 格式为 `ai_insight_${babyId}_${dateStr}`，每天每个宝宝累积一条永不清理。

**方案：** 在 `loadAiInsight()` 写入缓存后触发过期清理：

```javascript
// home.js — 在 loadAiInsight() 方法末尾（成功写入缓存后）
// 原代码：StorageUtil.set(cacheKey, { text, fallback: false });
// 新增：
this._cleanExpiredInsights(baby._id);

// 同理在 generateFallbackInsight() 中也添加：
// 原代码：StorageUtil.set(cacheKey, { text, fallback: true });
// 新增：
this._cleanExpiredInsights(currentBaby._id);

// 新增方法
_cleanExpiredInsights(babyId) {
  const storageInfo = wx.getStorageInfoSync();
  const prefix = `ai_insight_${babyId}_`;
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  
  storageInfo.keys.forEach(key => {
    if (key.startsWith(prefix)) {
      // 从 key 中提取日期：ai_insight_{babyId}_{yyyy-MM-dd}
      const dateStr = key.replace(prefix, '');
      const cacheDate = new Date(dateStr);
      if (!isNaN(cacheDate.getTime()) && cacheDate.getTime() < sevenDaysAgo) {
        StorageUtil.remove(key);
      }
    }
  });
}
```

> **设计考虑：** 选择"写入时清理"而非"app.js onLaunch 统一清理"，原因是：(1) 清理操作与写入操作在同一文件中，代码内聚性更好；(2) 避免 onLaunch 初始化路径变长影响启动速度；(3) AI 洞察缓存是页面级关注点，不应污染全局初始化逻辑。折叠状态 key（`ai_insight_collapsed_${babyId}`）不含日期不需清理。

---

### 5.10 FR-28: diaper-popup 改用 Service

**方案：** `checkConsecutiveWatery()` 改为通过 RecordService 获取 + 30s 缓存：

```javascript
// diaper-popup.js
_wateryCache = { data: null, ts: 0, babyId: null };

async checkConsecutiveWatery(babyId) {
  const now = Date.now();
  if (this._wateryCache.babyId === babyId && now - this._wateryCache.ts < 30000) {
    return this._wateryCache.data;
  }
  
  const records = await this._recordService.getRecords(babyId, {
    recordType: 'diaper',
    limit: 5
  });
  // ... 判断连续水样逻辑 ...
  this._wateryCache = { data: result, ts: now, babyId };
  return result;
}
```

---

### 5.11 FR-50: growth.js 写操作改用 RecordService

**方案：**

```javascript
// growth.js
// Before (第 880 行)
await db.collection('records').doc(recordId).update({ data: updateData });

// After
await this._recordService.updateRecord(recordId, updateData);

// Before (第 934 行)
await db.collection('records').doc(recordId).remove();

// After  
await this._recordService.deleteRecord(recordId);
```

`growth-popup.js` 第 240 行 `.add()` 同理改为 `this._recordService.addRecord(recordData)`，需确保 `recordType: 'growth'` 字段正确设置。

---

## 6. Phase 4: 渲染 & WXML 优化

> **目标：** 减少视图层计算开销，提升列表滚动流畅度。

### 6.1 FR-7: image lazy-load（P0）

**方案：** 全项目 `<image>` 标签添加 `lazy-load` 属性。

```xml
<!-- Before -->
<image src="{{item.icon}}" />

<!-- After -->
<image src="{{item.icon}}" lazy-load />
```

**重点文件：** `home.wxml`（15+ 张）、`timeline.wxml`（每条记录 2-3 张）、`vaccine.wxml`、`milestone.wxml`。

**排除：** 首屏可见的关键图标（TabBar 图标、logo）不需要 lazy-load。

---

### 6.2 FR-8: timeline 组件优化（P0）

**8.1 data-record 精简：**
```xml
<!-- Before -->
<view data-record="{{record}}" bindtap="onRecordTap">

<!-- After -->
<view data-record-id="{{record._id}}" bindtap="onRecordTap">
```

`onRecordTap` 中通过 `_id` 从 `this.data.groupedRecords` 查找完整记录。

**8.2 图标 src 预计算：**
```javascript
// observers 中预计算
_preprocessRecords(records) {
  return records.map(r => ({
    ...r,
    _iconUrl: this._getIconUrl(r.recordType, r.data),
    _typeLabel: this._getTypeLabel(r.recordType)
  }));
}
```

**8.3 observers 拆分：**
```javascript
observers: {
  'records': function(records) {
    // 全量预处理（分组、排序、预计算字段）
    this._processRecords(records);
  },
  'selectedRecords': function(selected) {
    // 仅更新选中状态（轻量）
    this._updateSelection(selected);
  }
}
```

**8.4 formatDate 缓存 today/yesterday：**
```javascript
_processRecords(records) {
  const now = new Date();
  const todayStr = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  
  // 传入缓存的日期字符串
  const grouped = this._groupByDate(records, todayStr, yesterdayStr);
}
```

**8.5 排序改字符串比较：**
```javascript
// Before
groups.sort((a, b) => new Date(b.date) - new Date(a.date));

// After (date 格式为 YYYY-MM-DD，字符串比较即可)
groups.sort((a, b) => b.date > a.date ? 1 : b.date < a.date ? -1 : 0);
```

---

### 6.3 FR-9: record.wxml wx:if 改 hidden

```xml
<!-- insight-section: 切换管理模式时不销毁 -->
<insight-section hidden="{{manageMode}}" ... />

<!-- 搜索区域和筛选标签同理 -->
<view class="search-bar" hidden="{{manageMode}}"> ... </view>
<view class="filter-tabs" hidden="{{manageMode}}"> ... </view>
```

---

### 6.4 FR-22: vaccine.wxml 筛选预计算

**方案：** 在 JS 层预筛选，WXML 仅渲染筛选后的列表：

```javascript
// vaccine.js
_applyFilter(status) {
  if (status === 'all') {
    this.setData({ displayGroups: this.data.allGroups });
  } else {
    const filtered = this.data.allGroups.map(group => ({
      ...group,
      vaccines: group.vaccines.filter(v => v.status === status)
    })).filter(group => group.vaccines.length > 0);
    this.setData({ displayGroups: filtered });
  }
}
```

---

### 6.5 FR-39: WXML 复杂表达式预计算（合并 FR-29）

**统一策略：** 在 JS 的数据准备阶段为每条记录预计算所有展示字段。

```javascript
// 预计算辅助函数
_enrichRecord(record) {
  return {
    ...record,
    _typeLabel: TYPE_LABELS[record.recordType] || '其他',
    _iconUrl: `/images/icon-${record.recordType}.png`,
    _timeStr: this._formatTime(record.startTime),
    _summary: this._buildSummary(record)
  };
}
```

WXML 中仅引用 `{{item._typeLabel}}`、`{{item._iconUrl}}` 等预计算字段。

**涉及文件：** `timeline.wxml`、`home.wxml`、`record.wxml`、`report-popup.wxml`、`milestone.wxml`。

---

### 6.6 FR-38: transition 属性精确化

**方案：** 全项目搜索 `transition: all` 替换为具体属性：

```css
/* Before */
.popup-content { transition: all 0.3s ease; }

/* After */
.popup-content { transition: transform 0.3s ease, opacity 0.3s ease; }
```

---

### 6.7 FR-30: backdrop-filter 优化

```css
/* Before */
.fab-container { backdrop-filter: blur(4rpx); }

/* After */
.fab-container { background-color: rgba(255, 255, 255, 0.95); }
```

---

### 6.8 FR-45: WXS 引入评估

**新建文件：** `miniprogram/utils/format.wxs`

```javascript
// format.wxs
var formatDuration = function(ms) {
  if (!ms || ms < 0) return '0m';
  var totalMinutes = Math.floor(ms / 60000);
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return hours + 'h ' + minutes + 'm';
  if (hours > 0) return hours + 'h';
  return minutes + 'm';
};

module.exports = { formatDuration: formatDuration };
```

WXML 中引入：
```xml
<wxs module="fmt" src="../../utils/format.wxs" />
<text>{{fmt.formatDuration(item.duration)}}</text>
```

**WXS 适用场景：** 简单格式化函数（日期、时长、条件判断）。**不适用：** 需要访问 `wx` API 或异步操作的逻辑。

---

## 7. Phase 5: 分包 & 包体积优化

> **目标：** 减小主包体积 40%+，提升首屏加载速度。

### 7.1 FR-31: 分包配置（P0）

**分包方案：**

```
主包（TabBar 必须在主包）：
├── pages/home/           # TabBar
├── pages/record/         # TabBar
├── pages/discover/       # TabBar
├── pages/profile/        # TabBar
├── pages/auth/           # 启动可能跳转
├── pages/baby-create/    # 新用户引导
├── pages/baby-list/      # 首页切换宝宝
└── pages/guide/          # 新用户引导

分包 A - growth（生长发育）：
├── pages/growth/
├── pages/vaccine/
├── pages/milestone/
└── pages/baby-detail/

分包 B - social（社交 & 工具）：
├── pages/ai-assistant/
├── pages/family/
├── pages/family-create/
├── pages/family-join/
├── pages/export/
└── pages/settings/
```

**app.json 配置：**

```json
{
  "pages": [
    "pages/home/home",
    "pages/record/record",
    "pages/discover/discover",
    "pages/profile/profile",
    "pages/auth/auth",
    "pages/baby-create/baby-create",
    "pages/baby-list/baby-list",
    "pages/guide/guide"
  ],
  "subpackages": [
    {
      "root": "packageGrowth",
      "name": "growth",
      "pages": [
        "pages/growth/growth",
        "pages/vaccine/vaccine",
        "pages/milestone/milestone",
        "pages/baby-detail/baby-detail"
      ]
    },
    {
      "root": "packageSocial",
      "name": "social",
      "pages": [
        "pages/ai-assistant/ai-assistant",
        "pages/family/family",
        "pages/family-create/family-create",
        "pages/family-join/family-join",
        "pages/export/export",
        "pages/settings/settings"
      ]
    }
  ],
  "preloadRule": {
    "pages/home/home": {
      "network": "all",
      "packages": ["growth"]
    },
    "pages/profile/profile": {
      "network": "all",
      "packages": ["social"]
    }
  }
}
```

**路由兼容：** 分包后页面路径变更（如 `pages/growth/growth` → `packageGrowth/pages/growth/growth`），需全项目搜索 `wx.navigateTo`/`wx.redirectTo` 中的路径并更新。

**路由修改清单（共 24 处，其中 10 处需修改路径）：**

| 原路径 | 新路径 | 涉及文件 | 调用数 |
|--------|--------|---------|-------|
| `/pages/growth/growth` | `/packageGrowth/pages/growth/growth` | `home.js`、无其他 | 0（通过 `discover.js` 动态 url） |
| `/pages/vaccine/vaccine` | `/packageGrowth/pages/vaccine/vaccine` | `home.js`、`discover.js` | 2 处 |
| `/pages/milestone/milestone` | `/packageGrowth/pages/milestone/milestone` | `home.js`、`discover.js` | 2 处 |
| `/pages/baby-detail/baby-detail` | `/packageGrowth/pages/baby-detail/baby-detail` | `home.js`、`baby-list.js` | 2 处 |
| `/pages/ai-assistant/ai-assistant` | `/packageSocial/pages/ai-assistant/ai-assistant` | `home.js` | 1 处 |
| `/pages/family/family` | `/packageSocial/pages/family/family` | `profile.js` | 1 处 |
| `/pages/settings/settings` | `/packageSocial/pages/settings/settings` | `profile.js`（动态 url） | 1 处 |
| `/pages/export/export` | `/packageSocial/pages/export/export` | `profile.js`（动态 url） | 1 处 |
| `/pages/family-create/family-create` | `/packageSocial/pages/family-create/family-create` | — | 0（从 family 页内跳转） |
| `/pages/family-join/family-join` | `/packageSocial/pages/family-join/family-join` | — | 0（从 family 页内跳转） |

> **注：** `discover.js` 中有 3 处 `navigateTo` 使用动态 `url`（来自 dataset），需检查模板中传入的路径是否也需更新。`family.js` 中 `wx.redirectTo({ url: '/pages/auth/auth' })` 不需修改（auth 在主包）。

**文件迁移计划：**
1. 创建 `miniprogram/packageGrowth/pages/` 和 `miniprogram/packageSocial/pages/` 目录
2. 移动对应页面目录（含 js/wxml/wxss/json 四件套）
3. 按上表精确修改 10 处路由跳转路径
4. 检查 `discover.wxml` 中 dataset 传入的动态 url
5. 更新 `project.config.json` 中的编译路径
6. 分包内页面之间的跳转路径也需更新（如 `family.js` → `family-create`，两者同在 packageSocial 内可用相对路径）

---

### 7.2 FR-44: 配置数据随分包移动

**⚠️ 跨分包 require 风险评估后的修订方案：**

微信小程序中**主包不能 require 分包文件**（分包未加载时会报错 `module "xxx" is not defined`），且 `preloadRule` 仅在指定入口页预加载，不能保证所有场景下分包已就绪。

**最终方案（混合策略）：**
- `who-standards.js`（10.03KB）：**移入分包** `packageGrowth/config/`，仅 `growth.js` 使用，且 growth.js 本身在分包内
- `vaccine-plans.js`（9.24KB）和 `milestone-defs.js`（12.21KB）：**保留在主包** `config/` 目录，因为 `todo.js`（主包 services/）需要引用

```
miniprogram/
├── config/
│   ├── vaccine-plans.js     # 9.24 KB（保留主包 — todo.js 依赖）
│   └── milestone-defs.js    # 12.21 KB（保留主包 — todo.js 依赖）
└── packageGrowth/
    ├── config/
    │   └── who-standards.js # 10.03 KB（移入分包 — 仅 growth.js 使用）
    └── pages/
```

> **收益：** 主包减少 10.03KB（who-standards），同时避免跨分包 require 风险。分包内 `growth.js` 改为 `require('../config/who-standards')` 引用本分包文件。`vaccine.js` 和 `milestone.js` 已在分包内，可从主包或分包内均可安全 require 主包的 config 文件。

---

### 7.3 FR-42: error-state 改局部注册

```json
// app.json — 删除全局注册
{
  "usingComponents": {}
}

// pages/home/home.json — 局部注册
{
  "usingComponents": {
    "error-state": "/components/error-state/error-state"
  }
}
```

---

### 7.4 FR-41: 删除未使用组件和服务

**删除清单：**
1. `components/common/popup/` — 全项目无引用
2. `components/cloudbase-badge/` — 仅自引用，无页面使用
3. `services/subscribe.js` — 无页面 require，templateIds 为空（标注废弃或删除）
4. `services/sync.js` 中 `subscribeRecords()`/`subscribeFamily()` — 标注 `@deprecated` 死代码注释

---

### 7.5 FR-43: 图标 CDN 迁移评估

**评估结论：** 当前 113 个 PNG 全部 < 2.18KB，总体积约 100KB。考虑到：
- 本地图标加载速度最快
- 迁移 CDN 需要处理离线兜底
- 当前体积不大

**建议：** 仅将低频使用的图标（report-popup、export 相关，约 20 个）迁移至云存储。核心图标保留本地。

---

### 7.6 FR-35: 公共样式 @import 统一

**方案：** 为 13+ 个存在重复弹窗样式的文件添加 `@import`：

```css
/* feeding-popup.wxss 顶部 */
@import '../../styles/popup.wxss';

/* 删除文件中与 popup.wxss 重复的规则 */
```

**注意：** 组件的 `styleIsolation` 默认为 `isolated`，`@import` 的样式会被正确作用域隔离。需逐文件对比确认删除的重复规则与公共样式完全一致。

---

## 8. Phase 6: 代码质量 & 清理

### 8.1 FR-12: milestone.js 重复代码合并

**方案：** 提取公共方法 `_toggleAchievement(milestoneId, achieved)`：

```javascript
async _toggleAchievement(milestoneId, achieved) {
  // 合并 quickAchieve 和 toggleAchieved 的公共逻辑
  // 参数 achieved: true=标记完成, false=取消完成
}

quickAchieve(e) {
  const id = e.currentTarget.dataset.id;
  this._toggleAchievement(id, true);
}

toggleAchieved(e) {
  const id = e.currentTarget.dataset.id;
  const current = e.currentTarget.dataset.achieved;
  this._toggleAchievement(id, !current);
}
```

---

### 8.2 FR-13: 批量删除并发控制

**方案：** 创建通用分批执行工具：

```javascript
// utils/batch.js（新建）
async function batchExecute(items, fn, concurrency = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

module.exports = { batchExecute };
```

---

### 8.3 FR-15: growth.js WHO 数据查找缓存

```javascript
loadGrowthRecords(records) {
  const gender = this.data.currentBaby.gender;
  // 预缓存当前性别的 WHO 数据集
  const whoData = WHOStandards.getDataByGender(gender);
  
  records.forEach(record => {
    record.percentile = this.calculatePercentile(record, whoData);
  });
}
```

---

### 8.4 FR-16: 配置数据三重维护统一

**方案：**
- `todo.js#_getVaccinePlans()` → `require('../config/vaccine-plans').getVaccinePlans()`
- `subscribe.js#generateVaccineSchedule()` → 同上
- `todo.js#_getMilestoneDefinitions()` → `require('../config/milestone-defs').MILESTONE_DEFINITIONS`

---

### 8.5 FR-20: 组件 attached + observer 重复调用修复

| 组件 | 移除的 attached 调用 | 原因 |
|------|-------------------|------|
| `icon.js` | `updateIconSrc()` | observer 初始化时自动触发 |
| `insight-section.js` | `loadTrendData()` | observer 初始化时自动触发 |
| `export-popup.js` | `checkExportLimit()` | observer 初始化时自动触发 |

---

### 8.6 FR-21: 组件 detached 生命周期补全

| 组件 | 清理内容 |
|------|---------|
| `feeding-popup.js` | 清理 `_throttledSetTranslateY`（来自 swipe-close behavior） |
| `diaper-popup.js` | 清理 `_wateryCache`、behavior 清理 |
| `temperature-popup.js` | behavior 清理 |
| `growth-popup.js` | behavior 清理 |
| `report-popup.js` | 清理 `imageCache`、`_isGenerating` 锁；`preloadImages` 改为 `show=true` 时执行 |
| `export-popup.js` | 清理可能的定时器 |
| `timeline.js` | 清理 observer 相关的计算缓存 |

**report-popup.js preloadImages 延迟加载方案（FR-21 AC3）：**

```javascript
// report-popup.js
lifetimes: {
  attached() {
    this.loadBabyInfo();
    // 删除原来的 this.preloadImages(); — 不再在 attached 时预加载
    this._imagesPreloaded = false;
  },
  detached() {
    // 清理 imageCache 释放内存
    this.imageCache = null;
    this._isGenerating = false;
    this._imagesPreloaded = false;
  }
},

observers: {
  'show, babyId': function(show, babyId) {
    if (show && babyId) {
      // 首次显示时预加载图片
      if (!this._imagesPreloaded) {
        this.preloadImages();
        this._imagesPreloaded = true;
      }
      this.loadReport();
    }
  }
}
```

---

### 8.7 FR-24: baby.js N+1 查询修复

```javascript
// Before: 逐个查询
for (const babyId of family.babies) {
  const { data } = await db.collection('babies').doc(babyId).get();
  babies.push(data[0]);
}

// After: 批量查询
const { data: babies } = await db.collection('babies')
  .where({ _id: db.command.in(family.babies) })
  .get();
```

---

### 8.8 FR-25/FR-26: 死代码 & console.log 清理

**FR-25 清理清单：**
- `record.js` 中 `loadStats()` / `loadTodayStats()` — 确认无调用后删除
- `filterService.js` — **已确认全项目零引用（无任何 require），为死代码，直接删除整个文件**
- `trendService.js` — 仅被 `insight-section.js` 1 处引用，**非死代码，保留**
- `icon.js` 中 @2x/@3x 回退逻辑（handleError L144）— 删除
- `temperature-popup.js` 中空 observer `'show'` — 删除

**FR-26 清理清单：**
- `timeline.js` observer 中 console.log — 删除
- `record.js` 中 7+ 处 — 删除
- `ai-assistant.js` 中 15+ 处 — 删除
- `sync.js` 中 Watch 推送 log — 删除

---

### 8.9 FR-27: sync.js 离线队列并行

```javascript
async syncOfflineQueue() {
  if (this.syncInProgress) return;
  this.syncInProgress = true;
  
  try {
    const queue = StorageUtil.getOfflineQueue();
    // 分批并行（每批 5 个）
    for (let i = 0; i < queue.length; i += 5) {
      const batch = queue.slice(i, i + 5);
      await Promise.allSettled(
        batch.map(op => this.executeOperation(op))
      );
    }
  } finally {
    this.syncInProgress = false; // try-finally 保护
  }
}
```

---

### 8.10 FR-47: ai-assistant.js 改用 Service

```javascript
// Before (约行 138-143)
const { data } = await wx.cloud.database().collection('records')
  .where({ babyId }).orderBy('startTime', 'desc').limit(20).get();

// After
const records = await this._recordService.getRecords(babyId, {
  limit: 20,
  orderBy: { field: 'startTime', direction: 'desc' }
});
```

---

### 8.11 FR-48: setTimeout/setInterval 清理

```javascript
// ai-assistant.js
onSend() {
  // ...
  this._scrollTimer = setTimeout(() => { /* ... */ }, 100);
}

onUnload() {
  if (this._scrollTimer) clearTimeout(this._scrollTimer);
}
```

---

## 9. 新建文件清单

| 文件路径 | 用途 | 涉及 FR |
|----------|------|---------|
| `utils/debounce.js` | debounce/throttle 工具 | FR-6 |
| `utils/db-helper.js` | 分页查询工具 | FR-49 |
| `utils/batch.js` | 批量执行工具 | FR-13 |
| `utils/format.wxs` | WXS 格式化函数 | FR-45 |
| `behaviors/swipe-close.js` | 弹窗下滑关闭 Behavior | FR-5 |

---

## 10. 关键设计决策

### KDD-1: 节流方式选择
**决策：** 使用自定义 throttle 而非 `wx.nextTick`。
**理由：** `wx.nextTick` 仅保证在下一次渲染前执行，无法控制时间间隔。自定义 throttle 可精确控制 30s/16ms 等间隔。

### KDD-2: 弹窗 wx:if → hidden 的内存权衡
**决策：** 高频弹窗用 `hidden`，低频弹窗保留 `wx:if`。
**理由：** 6 个弹窗常驻约增加 50KB 内存，但消除了频繁打开时的组件重建开销（100-200ms/次）。

### KDD-3: 分包粒度选择
**决策：** 2 个分包（growth + social）而非更细粒度。
**理由：** 微信限制最多 8 个分包，2 个分包已能有效减小主包体积，且降低路由管理复杂度。

### KDD-4: 配置数据处理策略
**决策：** 混合策略 — `who-standards.js` 移入分包，`vaccine-plans.js` 和 `milestone-defs.js` 保留主包。
**理由：** `todo.js`（主包 services/）需要引用 vaccine-plans 和 milestone-defs，微信小程序主包不能 require 分包文件。仅移动只被分包内页面使用的 who-standards（10.03KB），既减小主包体积又避免跨分包 require 风险。

### KDD-5: WXS 引入范围
**决策：** 仅用于简单格式化函数，不用于复杂业务逻辑。
**理由：** WXS 调试困难、不支持 ES6+、无法访问 `wx` API。仅将纯计算的格式化函数移入 WXS 层，ROI 最高。

### KDD-6: VaccineService/MilestoneService 是否新建
**决策：** Phase 3 中先用 `utils/db-helper.js#fetchAll` 快速修复截断 bug，Phase 6 中再评估是否新建独立 Service。
**理由：** P0 数据截断 bug 需优先修复，新建 Service 属于架构优化可延后。

### KDD-7: AI 洞察缓存清理策略
**决策：** 在 `loadAiInsight()` 写入缓存时触发过期清理，而非 `app.js#onLaunch` 统一清理。
**理由：** (1) 清理操作与写入操作在同一文件中，代码内聚性更好；(2) 避免 onLaunch 初始化路径变长影响启动速度；(3) AI 洞察缓存是页面级关注点，不应污染全局初始化逻辑。

### KDD-8: 分包路由路径管理策略
**决策：** 直接修改各页面中的硬编码路径，而非引入路由映射工具。
**理由：** 全项目仅 10 处路径需修改（已精确列出清单），规模可控。引入路由映射工具会增加一层抽象和运行时开销，对于 10 处修改来说 ROI 不够。但需确保：(1) 修改时全局搜索不遗漏；(2) 自动化验证所有路径可达。

---

## 11. 测试策略

### 11.1 每个 Phase 的验收测试

| Phase | 测试重点 | 工具/方法 |
|-------|---------|----------|
| 1 | debounce/throttle 单元测试；单例模式验证 | 手动调用验证 |
| 2 | setData 调用次数统计；弹窗滑动流畅度 | 微信开发者工具 Audits |
| 3 | DB 请求数量监控；缓存命中率 | Network 面板 + console.log |
| 4 | 渲染耗时；FPS | 微信开发者工具 Performance |
| 5 | 主包体积；首屏加载时间 | 代码包分析 + 体验评分 |
| 6 | 回归测试全量功能 | 手动测试所有页面 |

### 11.2 NFR 验收标准

| 指标 | 基线 | 目标 |
|------|------|------|
| 首页 loadData setData 次数 | ~5 次 | ≤2 次 |
| 记录页筛选 DB 请求 | 6 次/次 | 0 次（30s 内） |
| 弹窗 onTouchMove setData 频率 | ~60fps | ≤16ms/次 |
| 主包体积 | 100%（基线） | -40% |
| vaccine/milestone 数据截断率 | >0%（bug） | 0% |
| 全项目重复弹窗样式代码 | ~13 文件 | -80% |

---

## 12. 风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 分包后路由路径全量修改遗漏 | 高 | 已列出精确修改清单（10 处），全局搜索验证 + 自动化脚本校验所有路径可达 |
| hidden 改造后弹窗后台逻辑未正确暂停 | 中 | 逐组件审查 `show` observer 内的条件判断，确保 `show=false` 时不执行网络请求和定时器 |
| fetchAll 在数据量极大时性能问题 | 中 | 疫苗/里程碑数据量天然有限（疫苗最多 ~50 剂，里程碑 ~100 项），fetchAll 最多 1-2 次分页查询，性能可控 |
| 图标 CDN 迁移后离线无法显示 | 中 | 仅低频图标迁移 CDN + `<image>` 组件添加 `binderror` 回调显示 placeholder 或本地 fallback |
| trendService 缓存导致数据延迟 | 低 | 30s 缓存足够短，下拉刷新时手动清除缓存 |
| WXS 与 JS 层同名函数结果不一致 | 低 | 编写对照测试用例，确保 `format.wxs` 和 `utils/date.js` 中同名函数输入输出一致 |
| 分包基础库版本要求提升 | 低 | 分包功能需基础库 2.7.3+，当前项目设置为 2.2.3。需在 `project.config.json` 中提升 `miniprogramRoot` 的 `setting.minified` 最低基础库到 2.7.3（影响极少量低版本用户） |

### 12.1 需求边界条件覆盖确认

| 需求边界条件 | 设计方案覆盖 |
|------------|------------|
| 节流机制确保下拉刷新跳过（L530） | ✅ §5.1 `onPullDownRefresh` 直接调用 `loadData()` |
| setData 合并时回调时序（L531） | ✅ §4.1.1 先收集 patch 再一次 setData，后续计算在 setData 之后 |
| 缓存失效自动降级（L532） | ✅ §5.2/5.5 均有 try-catch 降级逻辑 |
| debounce 组件销毁时取消（L533） | ✅ §3.1 `wrapped.cancel()` + `onUnload`/`detached` 调用 |
| 缓存裁剪保留最新记录（L534） | ✅ §5.8 `sort` 后 `slice(0, 200)` |
| syncInProgress 异常重置（L535） | ✅ §8.9 `try-finally` 保护 |
| 分包加载失败容错（L536） | ✅ KDD-4 改为混合策略，避免跨分包 require |
| hidden 后组件不执行后台逻辑（L537） | ✅ §4.5 注意事项 |
| @import 后样式隔离验证（L538） | ✅ §7.6 注意事项 |
| CDN 迁移后离线兜底（L539） | ✅ 风险表补充 placeholder 方案 |
| WXS 与 JS 函数结果一致（L540） | ✅ 风险表补充对照测试 |
| 分页查询边界去重（L541） | ⚠️ `fetchAll` 使用 `skip+limit` 分页，数据库无并发写入时不会重复；若有并发写入可能出现偏移，但疫苗/里程碑数据写入频率极低，风险可忽略 |
| growth recordType 正确设置（L542） | ✅ §5.11 明确要求设置 `recordType: 'growth'` |

---

## 13. 安全与兼容性

- **安全：** 所有 DB 查询通过 Service 层，不直接暴露 collection 引用给视图层
- **兼容性：** 
  - 保持 `lazyCodeLoading: "requiredComponents"` 配置
  - WXS 在不支持的基础库版本上静默忽略（`<wxs>` 标签兼容性良好，基础库 2.4.4+）
  - **分包配置需要基础库 2.7.3+**，当前项目 `project.config.json` 中最低要求为 2.2.3。需在 Phase 5 实施前将最低基础库版本提升到 2.7.3。根据微信官方数据，2.7.3+ 覆盖率 > 99.5%，影响面极小
  - `hidden` 属性兼容所有基础库版本
  - `fetchAll` 工具使用 `skip` + `limit` 标准 API，兼容所有基础库版本

### 13.1 Phase 3 FR-50 实施注意

`growth.js` 当前没有 `require('../../services/record')`，Phase 3 实施 FR-50 时需要：
1. 在 `growth.js` 顶部添加 `const RecordService = require('../../services/record');`
2. 在 `onLoad` 中初始化 `this._recordService = new RecordService();`（页面级缓存模式）
3. 将 `growth-popup.js` 中的直接 DB 操作同步改为通过 `this._recordService` 调用（popup 通过 `properties` 或 `selectComponent` 获取 service 实例）

---

## 14. 文档状态

| 版本 | 日期 | 状态 | 说明 |
|------|------|------|------|
| v1.0 | 2026-04-07 | 🔴 已取代 | 初版设计 |
| v1.1 | 2026-04-07 | 🟡 待确认 | 三轮 Review 后修订版：修复 FR-33 方案错误、FR-32 方法名引用、FR-37 签名不一致、FR-44 跨分包风险；补充 FR-6 搜索逻辑、FR-21 延迟加载方案、FR-25 FilterService 死代码确认、FR-31 路由修改清单；新增 KDD-7/KDD-8、边界条件覆盖矩阵、风险项补充 |
