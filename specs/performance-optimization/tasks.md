# 实施计划 — 小程序全面性能优化

> 状态：✅ 已完成（2026-04-07）

## 实施概览

- **总任务数：** 37 个任务
- **6 个 Phase：** 按依赖关系顺序交付，每个 Phase 可独立验证
- **预估周期：** 每个 Phase 1-2 天，总计约 8-10 天

**Phase 依赖链：**
```
Phase 1（基础设施）→ Phase 2（setData 优化）→ Phase 3（DB & 缓存）
                  → Phase 4（渲染优化）→ Phase 5（分包）→ Phase 6（代码质量）
```

> Phase 2/3/4 可部分并行（均依赖 Phase 1 的工具层，但彼此无强依赖）。Phase 5 依赖 Phase 3/4 完成（分包前需确认页面改动稳定）。Phase 6 可与 Phase 5 并行。

---

## Phase 1: 基础设施 & 工具层

> **目标：** 为后续 Phase 提供公共工具函数和统一模式。

### Task 1.1: 创建 debounce/throttle 工具
- [ ] 新建 `miniprogram/utils/debounce.js`
- [ ] 实现 `debounce(fn, ms)` — 附带 `.cancel()` 方法
- [ ] 实现 `throttle(fn, ms)` — leading-edge，附带 `.cancel()` / `.force()` 方法
- [ ] 验证：在控制台手动调用确认节流/防抖行为正确
- _需求：FR-6 AC1_
- _设计：§3.1_

### Task 1.2: 创建分页查询工具
- [ ] 新建 `miniprogram/utils/db-helper.js`
- [ ] 实现 `fetchAll(query, pageSize = 100)` — 循环 skip+limit 获取全量数据
- [ ] 验证：对超过 20 条的集合调用，确认返回全量
- _需求：FR-49 AC2/AC3_
- _设计：§5.4_

### Task 1.3: Service 单例模式统一
- [ ] 为以下 8 个 Service 添加 `let instance = null` + constructor 守卫 + `getInstance()`：
  - `services/family.js`
  - `services/ai.js`
  - `services/content-filter.js`
  - `services/subscribe.js`
  - `services/auth.js`
  - `services/quota.js`
  - `services/filterService.js`
  - `services/trendService.js`
- [ ] `record.js` 中 6 处 `new RecordService()` → `onLoad` 中 `this._recordService = new RecordService()` 页面级缓存
- [ ] `home.js` 中 3 处同理
- [ ] 其他页面中 `new XxxService()` 统一改为页面级缓存
- [ ] 验证：多次进入页面，确认 Service 实例不重复创建
- _需求：FR-14 AC1/AC2/AC3_
- _设计：§3.2_

### Task 1.4: 重复工具函数统一
- [ ] `utils/date.js` 中追加 `parseTimestamp()` 函数（从 `record.js` 提取）
- [ ] `record.js`、`timeline.js`、`report-popup.js` 删除各自的 `parseTimestamp`，改为 `require('../../utils/date').parseTimestamp`
- [ ] 8 处 `calculateAgeMonths()` 重复实现统一改用 `utils/date.js`：
  - `home.js`、`growth.js`（保留 maxMonths=24）、`milestone.js`（保留 maxMonths=12）
  - `ai-assistant.js`、`baby-list.js`、`baby-card.js`、`report-popup.js`
  - `baby.js` 中删除 `calculateAgeInMonths`/`calculateAgeInDays`/`formatAge` 三个方法
- [ ] 验证：全项目搜索 `calculateAgeMonths` 和 `parseTimestamp`，确认仅 `utils/date.js` 有定义
- _需求：FR-10 AC1-AC4、FR-46 AC1-AC3_
- _设计：§3.3、§3.4_

### Task 1.5: 模块级常量提升
- [ ] `home.js` 顶部声明 `const WEEK_DAYS = ['日','一','二','三','四','五','六']`，`computeGreeting()` 改用常量引用
- [ ] `services/content-filter.js` 将 `parentingKeywords` 和 `blacklistKeywords` 从构造函数移到模块级 `const`
- [ ] `content-filter.js` 中 `checkRelevance` 的 `.filter().length > 0` 改为 `.some()` 短路返回
- [ ] 验证：首页问候语正常、内容过滤功能正常
- _需求：FR-40 AC1/AC2、FR-11 AC1-AC3_
- _设计：§3.5、§3.6_

**Phase 1 验收标准：**
- `utils/debounce.js`、`utils/db-helper.js` 存在且可正常 require
- 8 个 Service 均有单例保护
- 全项目无 `calculateAgeMonths` / `parseTimestamp` 重复定义

---

## Phase 2: setData 合并 & 高频交互优化

> **目标：** 减少 setData 调用次数，降低视图层-逻辑层通信开销。
> **依赖：** Phase 1（需要 debounce/throttle 工具）

### Task 2.1: home.js setData 合并
- [ ] `loadData()` 中 3-5 次 setData 合并为 1 次（patch 对象模式）
- [ ] `onShow()` 中 `setData({ currentBaby })` + `computeGreeting` + `checkActiveSleep` 合并为 1 次
- [ ] 验证：微信开发者工具 Audits 中确认 setData 调用次数减少
- _需求：FR-1 AC1/AC2_
- _设计：§4.1.1、§4.1.2_

### Task 2.2: ai-assistant.js setData 路径更新
- [ ] `onSend()` 中 messages 数组使用路径更新 `messages[${idx}]` 代替整体替换
- [ ] 流式回复使用 `messages[${lastIdx}].content` 路径更新
- [ ] 验证：AI 对话发送和流式回复正常
- _需求：FR-1 AC3_
- _设计：§4.1.3_

### Task 2.3: 弹窗组件 setData 合并
- [ ] `feeding-popup.js` 中 `selectQuickAmount`/`clearAmount`/`selectQuickDuration`/`clearDuration` 各合并为 1 次 setData
- [ ] `sleep-popup.js` 同上 4 个函数
- [ ] `temperature-popup.js#onTemperatureInput` 合并 checkFever 的 setData
- [ ] `diaper-popup.js#selectType` 最坏 3 次 → 1 次
- [ ] `baby-list.js#selectBaby` 2 次 → 1 次
- [ ] 验证：各弹窗操作无功能异常
- _需求：FR-1 AC4/AC5/AC6/AC7_
- _设计：§4.1.4_

### Task 2.4: 弹窗 onTouchMove 优化 + Behavior 提取
- [ ] 新建 `miniprogram/behaviors/swipe-close.js`：
  - `touchStartY` 改为实例属性 `this._touchStartY`
  - `onTouchMove` 中 `popupTranslateY` 的 setData 添加 16ms 节流
  - 提供 `onTouchStart`、`onTouchMove`、`onTouchEnd` 方法
- [ ] 6 个弹窗组件引入 behavior，删除各自的触摸事件处理代码：
  - `feeding-popup.js`、`sleep-popup.js`、`diaper-popup.js`
  - `temperature-popup.js`、`baby-edit-popup.js`、`growth-popup.js`
- [ ] 验证：6 个弹窗的下滑关闭动画流畅、回弹正常
- _需求：FR-5 AC1/AC2/AC3_
- _设计：§4.2_

### Task 2.5: vaccine.js setData 合并 + sleep-popup 计时器优化
- [ ] `vaccine.js#onFilterChange()` 两次 setData 合并为 1 次
- [ ] `sleep-popup.js` 的 `trackingInterval` 从 `data` 移到 `this._trackingInterval`
- [ ] `sleep-popup.js` 计时器更新频率降为每 5 秒一次
- [ ] `detached` 中 `clearInterval(this._trackingInterval)`
- [ ] 验证：疫苗筛选切换无闪烁、睡眠计时正常
- _需求：FR-34 AC1/AC2、FR-23 AC1/AC2_
- _设计：§4.3、§4.4_

### Task 2.6: 弹窗 wx:if 改 hidden
- [ ] `home.wxml` 中 5 个弹窗组件从 `wx:if` 改为 `hidden`
- [ ] `record.wxml` 中弹窗组件同理
- [ ] `growth.wxml`、`baby-detail.wxml` 中弹窗组件同理
- [ ] 检查各弹窗的 `show` observer，确保 `show=false` 时不执行网络请求/定时器
- [ ] 验证：弹窗打开/关闭正常、不执行后台逻辑
- _需求：FR-36 AC1-AC4_
- _设计：§4.5_

**Phase 2 验收标准：**
- 首页 loadData 的 setData ≤ 2 次
- 弹窗 onTouchMove setData 频率从 ~60fps 降为 ≤16ms/次
- 所有弹窗打开/关闭功能正常

---

## Phase 3: DB 查询 & 缓存治理

> **目标：** 减少不必要的数据库请求，治理缓存膨胀，修复 P0 数据截断 bug。
> **依赖：** Phase 1（需要 debounce/throttle 和 db-helper 工具）

### Task 3.1: onShow 节流 + 搜索逻辑
- [ ] `growth.js`、`ai-assistant.js`、`baby-list.js`、`family.js` 的 onShow 添加 30s 节流
- [ ] 4 个页面的 `onPullDownRefresh` 直接调用 `loadData()` 跳过节流
- [ ] 4 个页面的 `onUnload` 中 cancel 节流函数
- [ ] `record.js#onSearch` 添加 300ms debounce + 本地筛选逻辑
- [ ] 关键词 < 2 字符时不触发搜索
- [ ] `record.js#onUnload` 中 cancel debounce
- [ ] 验证：快速返回页面时不重复查库、搜索功能正常
- _需求：FR-2 AC1-AC4、FR-6 AC2-AC4_
- _设计：§5.1、§3.1.1_

### Task 3.2: record.js 筛选计数优化 + Canvas 缓存
- [ ] `record.js#loadData` 中仅 `refresh=true` 时调用 `calculateFilterCounts`
- [ ] 筛选计数添加 30s 缓存（含 babyId 校验）
- [ ] `app.js#onLaunch` 中缓存 `wx.getSystemInfoSync()` 到 `globalData.systemInfo`
- [ ] `growth.js`、`share-canvas.js`、`report-popup.js` 3 处改用全局缓存
- [ ] `growth.js#drawChart` 中 `months` 数组提升为页面级属性、`getY`/`drawBand` 提取为实例方法
- [ ] 验证：筛选切换时无 DB 请求（30s 内）、图表绘制正常
- _需求：FR-3 AC1-AC4、FR-4 AC1-AC3_
- _设计：§5.2、§5.3_

### Task 3.3: vaccine/milestone/todo 查询修复（P0 数据截断）
- [ ] `vaccine.js` 第 105-109 行：`.get()` 改为 `fetchAll(query)` + `.orderBy('createdAt', 'desc')`
- [ ] `milestone.js` 第 100-102 行：同理改为 `fetchAll(query)` + `.orderBy('createdAt', 'desc')`
- [ ] `todo.js#_computeVaccineStats`：改用 `fetchAll` + `Set` 索引优化（替换 `.find()` 为 O(1) 查找）
- [ ] `todo.js#_computeMilestoneStats`：同理
- [ ] `todo.js#_getVaccinePlans()` 改为 `require('../config/vaccine-plans').getVaccinePlans()`（同步完成 FR-16）
- [ ] `todo.js#_getMilestoneDefinitions()` 改为 `require('../config/milestone-defs').MILESTONE_DEFINITIONS`
- [ ] `subscribe.js#generateVaccineSchedule()` 同理改用 config
- [ ] 验证：有 20+ 条疫苗/里程碑记录时数据完整显示、待办统计准确
- _需求：FR-49 AC1-AC5、FR-33 AC1-AC3、FR-16 AC1-AC3_
- _设计：§5.4、§5.7、§8.4_

### Task 3.4: Service 缓存增强
- [ ] `RecordService#getTodayStats` 添加 15s 内存缓存（含 babyId+dateKey）
- [ ] `trendService.js` 四次独立 filter 改为一次遍历分桶到 Map
- [ ] `trendService#getTrendData` 添加 30s 内存缓存
- [ ] 验证：首页刷新更快、趋势数据正确
- _需求：FR-18 AC1/AC2、FR-19 AC1/AC2_
- _设计：§5.5、§5.6_

### Task 3.5: 记录缓存统一治理
- [ ] `record.js#updateLocalCache` 和 `saveToLocalCache` 添加 `.slice(0, 200)` 限制
- [ ] `updateRecordInCache(recordId, data, babyId)` 新增可选 babyId 参数，有 babyId 时直接定位
- [ ] 调用处（record.js L467/470/485）传入 `data.babyId` 第三参数
- [ ] `app.js#onLaunch` 新增 `_cleanOrphanedCache()` — 清理已删除宝宝的残留缓存
- [ ] `app.js#onLaunch` 新增全局缓存大小监控（`currentSize > 8MB` 时触发清理）
- [ ] 验证：缓存不超过 200 条、删除宝宝后无孤立缓存
- _需求：FR-37 AC1-AC5_
- _设计：§5.8_

### Task 3.6: AI 洞察缓存清理 + diaper-popup 改用 Service
- [ ] `home.js#loadAiInsight` 末尾添加 `this._cleanExpiredInsights(babyId)` — 清理 7 天前的 AI 洞察缓存
- [ ] `home.js#generateFallbackInsight` 同理添加清理
- [ ] `diaper-popup.js#checkConsecutiveWatery` 改为通过 RecordService 获取 + 30s 缓存
- [ ] 验证：AI 洞察缓存不无限增长、尿布弹窗连续水样判断正常
- _需求：FR-32 AC1-AC4、FR-28 AC1/AC2_
- _设计：§5.9、§5.10_

### Task 3.7: growth.js 写操作改用 RecordService
- [ ] `growth.js` 顶部添加 `const RecordService = require('../../services/record')`
- [ ] `onLoad` 中初始化 `this._recordService = new RecordService()`
- [ ] 第 880-886 行 `.update()`/`.add()` 改用 `this._recordService.updateRecord()`/`addRecord()`
- [ ] 第 934-936 行 `.remove()` 改用 `this._recordService.deleteRecord()`
- [ ] `growth-popup.js` 第 240 行 `.add()` 改用 RecordService，确保 `recordType: 'growth'`
- [ ] 验证：生长记录增删改正常、其他页面能看到同步数据
- _需求：FR-50 AC1-AC4_
- _设计：§5.11、§13.1_

**Phase 3 验收标准：**
- vaccine/milestone 数据截断率 = 0%（核心 P0 修复）
- 记录页筛选 DB 请求从 6 次降为 0 次（30s 内缓存命中）
- onShow 节流后不再每次返回都查库

---

## Phase 4: 渲染 & WXML 优化

> **目标：** 减少视图层计算开销，提升列表滚动流畅度。
> **依赖：** Phase 1（部分工具）

### Task 4.1: image lazy-load 全项目加载
- [ ] `home.wxml`（15+ 张 image）添加 `lazy-load` 属性
- [ ] `timeline.wxml`（每条记录 2-3 张）添加 `lazy-load`
- [ ] `vaccine.wxml`、`milestone.wxml` 添加 `lazy-load`
- [ ] 其他页面的非首屏 `<image>` 标签补充 `lazy-load`
- [ ] **排除：** TabBar 图标、首屏 logo 等关键图标不加 lazy-load
- [ ] 验证：页面滚动时图片按需加载
- _需求：FR-7 AC1/AC2_
- _设计：§6.1_

### Task 4.2: timeline 组件全面优化
- [ ] `timeline.wxml` 中 `data-record="{{record}}"` 改为 `data-record-id="{{record._id}}"`
- [ ] `onRecordTap` 中通过 `_id` 从 `groupedRecords` 查找完整记录
- [ ] 5 层嵌套三元表达式（图标 src）移到 JS 层预计算为 `_iconUrl` 字段
- [ ] observer `'records, selectedRecords'` 拆分为独立 observers
- [ ] `formatDate` 中 `today`/`yesterday` 提到 observer 开始处缓存
- [ ] `groupRecordsByDate` 排序中 `new Date(b.date)` 改为字符串比较
- [ ] 验证：记录列表滚动流畅、点击记录正确跳转
- _需求：FR-8 AC1-AC5_
- _设计：§6.2_

### Task 4.3: WXML wx:if 改 hidden + 筛选预计算
- [ ] `record.wxml` 中 `insight-section`、搜索区域、筛选标签从 `wx:if` 改为 `hidden`
- [ ] `vaccine.wxml` 中内层 `wx:if` 条件筛选移到 JS 层预计算 `displayGroups`
- [ ] 验证：切换管理模式无闪烁、疫苗筛选正常
- _需求：FR-9 AC1/AC2、FR-22 AC1/AC2_
- _设计：§6.3、§6.4_

### Task 4.4: WXML 复杂表达式统一预计算
- [ ] `home.wxml` / `record.wxml` 中复杂条件表达式在 JS 层预计算为 `_typeLabel` 等字段
- [ ] `report-popup.wxml` 中趋势 class/text 预计算为 `feedingTrendClass` / `feedingTrendText`
- [ ] `milestone.wxml` 中 class 条件预计算为 `_windowClass`
- [ ] `timeline.wxml` 中循环体内三元表达式全部移到数据准备阶段
- [ ] 验证：各页面展示数据正确
- _需求：FR-39 AC1-AC5_
- _设计：§6.5_

### Task 4.5: CSS 优化 + WXS 引入
- [ ] 全项目搜索 `transition: all` / `transition:all`，替换为具体属性名
- [ ] `record.wxss` 中 `.fab-container` 的 `backdrop-filter: blur(4rpx)` 改为纯色半透明
- [ ] 新建 `miniprogram/utils/format.wxs`，实现 `formatDuration` 等 WXS 函数
- [ ] `timeline.wxml` 中引入 `<wxs module="fmt" src="../../utils/format.wxs" />`
- [ ] 验证：动画过渡正常、WXS 格式化输出与 JS 层一致
- _需求：FR-38 AC1-AC3、FR-30 AC1、FR-45 AC1-AC4_
- _设计：§6.6、§6.7、§6.8_

**Phase 4 验收标准：**
- timeline 组件 observers 触发次数减半
- WXML 模板中仅保留简单变量引用，无复杂三元/逻辑表达式
- 全项目无 `transition: all`

---

## Phase 5: 分包 & 包体积优化

> **目标：** 减小主包体积 40%+，提升首屏加载速度。
> **依赖：** Phase 3/4 完成（分包前需确认页面改动稳定）

### Task 5.1: 分包结构搭建
- [ ] 创建 `miniprogram/packageGrowth/pages/` 目录
- [ ] 创建 `miniprogram/packageSocial/pages/` 目录
- [ ] 移动 growth 分包页面（含 js/wxml/wxss/json 四件套）：
  - `pages/growth/` → `packageGrowth/pages/growth/`
  - `pages/vaccine/` → `packageGrowth/pages/vaccine/`
  - `pages/milestone/` → `packageGrowth/pages/milestone/`
  - `pages/baby-detail/` → `packageGrowth/pages/baby-detail/`
- [ ] 移动 social 分包页面：
  - `pages/ai-assistant/` → `packageSocial/pages/ai-assistant/`
  - `pages/family/` → `packageSocial/pages/family/`
  - `pages/family-create/` → `packageSocial/pages/family-create/`
  - `pages/family-join/` → `packageSocial/pages/family-join/`
  - `pages/export/` → `packageSocial/pages/export/`
  - `pages/settings/` → `packageSocial/pages/settings/`
- [ ] 更新 `app.json`：添加 `subpackages` 和 `preloadRule` 配置
- [ ] `project.config.json` 中提升最低基础库版本到 2.7.3
- _需求：FR-31 AC1-AC5_
- _设计：§7.1_

### Task 5.2: 分包路由修复
- [ ] 按设计文档路由修改清单（10 处）逐一修改路径：
  - `home.js` 中 vaccine/milestone/baby-detail/ai-assistant 路径
  - `discover.js` / `discover.wxml` 中动态 url 和 dataset 传入的路径
  - `baby-list.js` 中 baby-detail 路径
  - `profile.js` 中 family/settings/export 路径
- [ ] 分包内页面之间的跳转路径更新（如 `family.js` → `family-create`）
- [ ] 全局搜索 `navigateTo` / `redirectTo` 确认无遗漏
- [ ] 验证：所有页面跳转正常，无路径 404
- _需求：FR-31 AC5/AC6_
- _设计：§7.1 路由修改清单_

### Task 5.3: 配置数据迁移 + 分包内路径修复
- [ ] `config/who-standards.js` 移入 `packageGrowth/config/who-standards.js`
- [ ] `growth.js` 中 require 路径更新为 `../config/who-standards`
- [ ] `vaccine-plans.js` 和 `milestone-defs.js` **保留在主包** `config/` 目录（todo.js 依赖）
- [ ] 分包内页面的 `require` 路径全部更新（services、utils、config 的相对路径）
- [ ] 验证：growth 页面 WHO 数据加载正常、todo 待办统计正常
- _需求：FR-44 AC1-AC3_
- _设计：§7.2（KDD-4 混合策略）_

### Task 5.4: 包体积瘦身
- [ ] `app.json#usingComponents` 中 `error-state` 全局注册 → `home.json` 局部注册
- [ ] 删除 `components/common/popup/` 目录（全项目无引用）
- [ ] 删除 `components/cloudbase-badge/` 目录（仅自引用）
- [ ] 删除 `services/subscribe.js`（无页面 require、templateIds 为空）
- [ ] `services/sync.js` 中 `subscribeRecords()`/`subscribeFamily()` 添加 `@deprecated` 注释
- [ ] 验证：编译无报错、主包体积降低 40%+
- _需求：FR-42 AC1-AC3、FR-41 AC1-AC4_
- _设计：§7.3、§7.4_

### Task 5.5: 公共样式 @import 统一
- [ ] 6 个弹窗组件 WXSS 顶部添加 `@import '../../styles/popup.wxss'`
- [ ] 删除弹窗组件中与 `popup.wxss` 重复的样式规则（`.popup-overlay`、`.popup-content`、`.popup-header` 等）
- [ ] 表单类页面引用 `styles/form.wxss`
- [ ] 页面头部样式引用 `styles/page-header.wxss`
- [ ] **注意：** 逐文件对比确认删除的规则与公共样式完全一致，检查 `styleIsolation` 不受影响
- [ ] 验证：所有弹窗和页面样式正常、无样式丢失
- _需求：FR-35 AC1-AC5_
- _设计：§7.6_

### Task 5.6: 图标 CDN 迁移评估（仅记录）
- [ ] 评估 113 个 PNG 图标，标记低频图标（report-popup、export 相关约 20 个）
- [ ] 记录评估结论到文档，本次迭代不实施代码改动
- [ ] 如后续决定迁移，需为 `<image>` 添加 `binderror` 回调显示 placeholder
- _需求：FR-43 AC1-AC4_
- _设计：§7.5_

**Phase 5 验收标准：**
- 分包配置正确，所有页面可正常访问
- 主包体积降低 40%+
- 全项目重复弹窗样式代码减少 80%+

---

## Phase 6: 代码质量 & 清理

> **目标：** 消除重复代码、补全生命周期、清理死代码。
> **依赖：** 可与 Phase 5 并行

### Task 6.1: 重复代码合并 + 批量工具
- [ ] `milestone.js` 中 `quickAchieve()`（L314-385）和 `toggleAchieved()`（L411-479）合并为 `_toggleAchievement(id, achieved)`
- [ ] 新建 `miniprogram/utils/batch.js` — `batchExecute(items, fn, concurrency = 10)`
- [ ] `settings.js#clearAllCloudData` 中 `Promise.all` 改为 `batchExecute`（每批 10 个）
- [ ] `record.js#batchDelete` 同理
- [ ] 验证：里程碑快速达成/切换正常、批量删除不雪崩
- _需求：FR-12 AC1/AC2、FR-13 AC1/AC2_
- _设计：§8.1、§8.2_

### Task 6.2: growth.js WHO 数据缓存 + 组件 attached 修复
- [ ] `growth.js#loadGrowthRecords` 预缓存当前性别的 WHO 数据集，循环中复用
- [ ] `icon.js` 移除 `attached()` 中的 `updateIconSrc()` 调用
- [ ] `insight-section.js` 移除 `attached()` 中的 `loadTrendData()` 调用
- [ ] `export-popup.js` 移除 `attached()` 中的 `checkExportLimit()` 调用
- [ ] 验证：生长百分位计算正确、图标/趋势/导出组件初始化正常
- _需求：FR-15 AC1/AC2、FR-20 AC1-AC3_
- _设计：§8.3、§8.5_

### Task 6.3: 组件 detached 生命周期补全
- [ ] `feeding-popup.js` — detached 中清理 behavior 相关资源
- [ ] `diaper-popup.js` — 清理 `_wateryCache`、behavior 清理
- [ ] `temperature-popup.js`、`growth-popup.js` — behavior 清理
- [ ] `report-popup.js` — 清理 `imageCache`、`_isGenerating` 锁；`preloadImages` 改为首次 `show=true` 时执行（observer 监听方案）
- [ ] `export-popup.js` — 清理可能的定时器
- [ ] `timeline.js` — 清理 observer 相关计算缓存
- [ ] 验证：反复打开/关闭组件无内存泄漏（微信开发者工具 Memory 面板）
- _需求：FR-21 AC1-AC3_
- _设计：§8.6_

### Task 6.4: DB 查询优化 + Service 层对齐
- [ ] `baby.js#getBabiesByFamilyId` 回退逻辑中 N+1 查询改为 `db.command.in()` 批量查询
- [ ] `ai-assistant.js` 约第 138-143 行直接 DB 查询改为 `RecordService.getRecords()`
- [ ] 验证：宝宝列表加载正常、AI 助手获取记录正常
- _需求：FR-24 AC1、FR-47 AC1-AC3_
- _设计：§8.7、§8.10_

### Task 6.5: 死代码清理 + console.log 清理
- [ ] 删除 `services/filterService.js`（全项目零引用，已确认死代码）
- [ ] `record.js` 中 `loadStats()`/`loadTodayStats()` 确认无调用后删除
- [ ] `icon.js` 中 @2x/@3x 回退逻辑（handleError L144）删除
- [ ] `temperature-popup.js` 中空 observer `'show'` 删除
- [ ] `timeline.js` observer 中 console.log 删除
- [ ] `record.js` 中 7+ 处 console.log 删除
- [ ] `ai-assistant.js` 中 15+ 处 console.log 删除
- [ ] `sync.js` 中 Watch 推送 console.log 删除
- [ ] 验证：编译无报错、各功能正常
- _需求：FR-25 AC1-AC4、FR-26 AC1-AC4_
- _设计：§8.8_

### Task 6.6: sync.js 并行优化 + 定时器清理
- [ ] `sync.js#syncOfflineQueue` 中 `for` 循环串行 `await` 改为 `batchExecute`（每批 5 个）
- [ ] `syncInProgress` 标志增加 `try-finally` 保护
- [ ] `ai-assistant.js` 中 `setTimeout` 保存 ID 到 `this._scrollTimer`，`onUnload` 中清理
- [ ] `home.js` 中 `checkActiveSleep` 相关定时器在 `onUnload` 中清理
- [ ] `sleep-popup.js` detached 中 `clearInterval`（Phase 2 已处理 interval 迁移，此处确认清理）
- [ ] 验证：离线同步恢复正常、页面销毁后无残留定时器
- _需求：FR-27 AC1/AC2、FR-48 AC1-AC4_
- _设计：§8.9、§8.11_

**Phase 6 验收标准：**
- milestone.js 重复代码减少 ~90 行
- 全项目无生产环境 console.log
- 所有组件 detached 生命周期完整

---

## 总体验收标准（NFR 对照）

| 指标 | 基线 | 目标 | 验收方法 |
|------|------|------|---------|
| 首页 loadData setData 次数 | ~5 次 | ≤2 次 | 微信开发者工具 Audits |
| 首页 onShow setData（节流时） | 3 次 | 1 次 | 同上 |
| 记录页筛选 DB 请求 | 6 次/次 | 0 次（30s 内缓存） | Network 面板 |
| 弹窗 onTouchMove setData 频率 | ~60fps | ≤16ms/次 | Performance 面板 |
| 主包体积 | 100%（基线） | -40% | 代码包分析 |
| vaccine/milestone 数据截断率 | >0%（bug） | 0% | 20+ 条记录测试 |
| 全项目重复弹窗样式代码 | ~13 文件 | -80% | 搜索 `.popup-overlay` 计数 |
| growth 写操作数据一致性 | 不经过 RecordService | 经过 RecordService | 功能测试 |

---

## 文档状态

| 版本 | 日期 | 状态 | 说明 |
|------|------|------|------|
| v1.0 | 2026-04-07 | 🟡 待确认 | 初版任务拆分，基于 design v1.1 |
