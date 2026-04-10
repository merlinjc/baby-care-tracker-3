# 需求文档 - 小程序全面性能优化

## 概述
基于对 miniprogram 全部 **18 个页面、15 个组件、13 个服务、6 个工具** 的 **七轮逐文件代码审查** + **一轮交叉验证 Review**（前四轮聚焦 setData/DB/缓存/搜索/弹窗/组件，后三轮分别从「数据库 + setData + 内存 + 缓存 + 组件通信」「包体积 + 资源 + 依赖 + 分包」「渲染 + 交互 + 动画 + WXS」三个专项维度深度审查，最后一轮从「DB 查询遗漏 + setData 连续调用 + wx:if/hidden + onShow 节流 + 定时器清理 + 全局事件监听」六个维度交叉验证），制定一套系统性的性能优化方案。目标是在不改变功能和 UI 的前提下，减少不必要的 setData / DB 查询 / 重复计算，优化包体积和分包策略，提升页面加载速度、流畅度和内存效率。

---

## 审查发现总览

| 优先级 | 问题数 | 影响范围 |
|-------|--------|---------|
| 🔴 高 (P0) | 10 | 首页/记录页/生长页/组件层/分包架构/疫苗&里程碑数据截断 — 用户最频繁使用的页面和交互 |
| 🟡 中 (P1) | 24 | 各功能页、服务层、模板层、样式层、缓存治理、生长页数据一致性 |
| 🟢 低 (P2) | 14 | 代码质量 / 死代码 / 架构建议 / 资源迁移 / WXS 引入 |

> **Review 变更说明（v2）：**
> - FR-17 合并入 FR-37（记录缓存统一治理）
> - FR-29 合并入 FR-39（WXML 表达式预计算统一）
> - FR-25 / FR-41 关于 subscribe.js 的职责去重
> - 新增 FR-49（vaccine/milestone 查询无 limit，🔴 P0 数据截断 bug）
> - 新增 FR-50（growth 写操作绕过 RecordService，P1 数据一致性）
> - FR-46 补充 report-popup.js 为第三处 parseTimestamp 重复

---

## 功能需求

### FR-1: setData 合并优化（P0）
**用户故事：** 作为用户，我希望页面切换更流畅，不出现明显卡顿
**涉及文件：** `home.js`, `record.js`, `growth.js`, `ai-assistant.js`, 6 个弹窗组件

**验收标准：**
1. `home.js#onShow()` 中 `setData({ currentBaby })` + `computeGreeting` + `checkActiveSleep` 合并为 1 次 setData
2. `home.js#loadData()` 中主体 setData 和 `sleepDurationText` 的 setData 合并为 1 次
3. `ai-assistant.js#onSend()` 中 messages 数组使用路径更新 `messages[${idx}]` 代替整体替换
4. `feeding-popup.js` 中 `selectQuickAmount` / `clearAmount` / `selectQuickDuration` / `clearDuration` 各自将两次连续 setData 合并为 1 次（同样适用于 `sleep-popup.js`）
5. `temperature-popup.js#onTemperatureInput` 中 setData + `checkFever` 内 setData 合并为 1 次
6. `diaper-popup.js#selectType` 中最坏情况 3 次 setData 合并为 1 次
7. `baby-list.js#selectBaby` 中 2 次 setData 合并为 1 次

### FR-2: onShow 节流统一（P0）
**用户故事：** 作为用户，我从其他页面返回时不应触发不必要的数据库查询
**涉及文件：** `growth.js`, `ai-assistant.js`, `baby-list.js`, `family.js`

**验收标准：**
1. `growth.js#onShow()` 增加 30s 节流（当前每次返回都查询数据库，无任何节流）
2. `ai-assistant.js#onShow()` 增加 30s 节流（当前每次触发 2+ 次 DB 查询）
3. `baby-list.js#onShow()` 增加 30s 节流（当前每次直接查询数据库）
4. `family.js#onShow()` 增加 30s 节流（当前每次查询 DB 且可能自动生成邀请码）

### FR-3: record.js 筛选计数优化（P0）
**用户故事：** 作为用户，切换筛选标签时不应有明显延迟
**涉及文件：** `record.js`

**验收标准：**
1. `calculateFilterCounts()` 不再在每次 `loadData` 后都调用
2. 仅在 refresh=true 时计算筛选计数（增量加载时跳过）
3. 筛选计数增加 30s 缓存，避免重复 6 次并行 DB count
4. 降级逻辑（catch 中基于本地数据计算）保持不变

### FR-4: Canvas / SystemInfo 缓存（P0）
**用户故事：** 作为用户，生长曲线页面图表绘制应更快
**涉及文件：** `growth.js`, `share-canvas.js`, `report-popup.js`

**验收标准：**
1. `wx.getSystemInfoSync()` 的结果缓存到全局（`app.js` 的 `onLaunch` 或模块级变量），3 处调用统一复用
2. `drawChart()` 中 `months` 数组提升为类属性（固定 0-24），不在每次绘制时重新创建
3. `drawChart()` 中辅助函数 `getY`/`drawBand` 提取到类方法，避免每次绘图创建闭包

### FR-5: 弹窗 onTouchMove 高频 setData 优化（P0）
**用户故事：** 作为用户，下滑关闭弹窗时动画应流畅无卡顿
**涉及文件：** `feeding-popup.js`, `sleep-popup.js`, `diaper-popup.js`, `temperature-popup.js`, `baby-edit-popup.js`, `growth-popup.js`

**验收标准：**
1. 6 个弹窗组件的 `touchStartY` 从 `data` 改为实例属性 `this._touchStartY`（不走 setData）
2. `onTouchMove` 中 `popupTranslateY` 的 setData 添加 16ms 节流，或使用 WXS 响应式能力处理触摸动画
3. 抽取公共 behavior `behaviors/swipe-close.js`，6 个弹窗组件复用

### FR-6: 全项目 debounce/throttle 工具（P0）
**用户故事：** 作为用户，搜索和各类高频交互应流畅无卡顿
**涉及文件：** 新建 `utils/debounce.js`，应用到 `record.js`, 6 个弹窗组件, `timeline.js`

**验收标准：**
1. 创建 `utils/debounce.js` 提供 `debounce(fn, ms)` 和 `throttle(fn, ms)` 工具函数
2. `record.js#onSearch()` 添加 300ms debounce
3. 搜索时使用已加载的 records 数据筛选（无需重新查库获取全量）
4. 搜索关键词 < 2 字符时不触发搜索

### FR-7: 全项目 image lazy-load（P0）
**用户故事：** 作为用户，页面首屏加载应更快
**涉及文件：** 所有 WXML 文件中的 `<image>` 标签

**验收标准：**
1. 给所有非首屏可见的 `<image>` 标签添加 `lazy-load` 属性
2. 重点页面：`home.wxml` (15+张)、`timeline.wxml` (每条记录 2-3 张)、`vaccine.wxml`、`milestone.wxml`

### FR-8: timeline 组件性能优化（P0）
**用户故事：** 作为用户，记录列表滚动应流畅
**涉及文件：** `timeline.js`, `timeline.wxml`

**验收标准：**
1. WXML 中 `data-record="{{record}}"` 改为只传 `data-record-id="{{record._id}}"`，减少数据序列化开销
2. WXML 中 5 层嵌套三元表达式（图标 src）移到 JS 层预计算为 `iconUrl` 字段
3. observer `'records, selectedRecords'` 拆分：`'records'` 触发全量预处理，`'selectedRecords'` 仅更新选中状态
4. `formatDate` 中 `today`/`yesterday` 提到循环外缓存（observer 开始处计算一次）
5. `groupRecordsByDate` 排序中 `new Date(b.date)` 改为字符串比较，避免反复创建 Date

### FR-9: record.wxml wx:if 改 hidden（P1）
**用户故事：** 作为用户，切换管理模式时不应有明显闪烁
**涉及文件：** `record.wxml`

**验收标准：**
1. `insight-section` 组件从 `wx:if="{{!manageMode}}"` 改为 `hidden="{{manageMode}}"`，避免切换管理模式时重建组件和重复网络请求
2. 搜索区域和筛选标签同理改为 `hidden`

### FR-10: 重复 calculateAgeMonths 函数统一（P1）
**用户故事：** 作为开发者，消除重复代码减少维护成本
**涉及文件：** `home.js`, `growth.js`, `milestone.js`, `ai-assistant.js`, `baby-list.js`, `baby-card.js`, `report-popup.js`, `baby.js`

**验收标准：**
1. 8 处 `calculateAgeMonths()` 重复实现统一改用 `utils/date.js` 中的版本
2. 保持 `growth.js` 的 24 月上限参数 `calculateAgeMonths(birthDate, 24)`
3. 保持 `milestone.js` 的 12 月上限参数 `calculateAgeMonths(birthDate, 12)`
4. 删除 `baby.js` 中的 `calculateAgeInMonths` / `calculateAgeInDays` / `formatAge` 重复方法

### FR-11: ContentFilterService 关键词数组提升为模块常量（P1）
**用户故事：** 作为开发者，减少不必要的内存分配
**涉及文件：** `services/content-filter.js`

**验收标准：**
1. `parentingKeywords` 和 `blacklistKeywords` 从构造函数移到模块级 `const`
2. 构造函数中通过 `this.parentingKeywords` 引用模块常量
3. `checkRelevance` 中 `.filter()` 改为 `.some()` 短路返回

### FR-12: milestone.js 重复代码合并（P1）
**用户故事：** 作为开发者，减少代码重复和维护成本
**涉及文件：** `milestone.js`

**验收标准：**
1. `quickAchieve()`（行 314-385）和 `toggleAchieved()`（行 411-479）合并为一个通用方法
2. 两处调用复用同一逻辑，避免 ~90 行几乎完全重复的代码

### FR-13: 批量删除并发控制（P1）
**用户故事：** 作为用户，批量删除大量记录时不应导致请求雪崩
**涉及文件：** `settings.js`, `record.js`

**验收标准：**
1. `settings.js#clearAllCloudData()` 中 `Promise.all` 改为分批并发（每批最多 10 个）
2. `record.js#batchDelete()` 同理

### FR-14: Service 单例模式统一（P1）
**用户故事：** 作为开发者，减少不必要的对象创建和资源浪费
**涉及文件：** `family.js`, `ai.js`, `content-filter.js`, `subscribe.js`, `auth.js`, `quota.js`, `filterService.js`, `trendService.js`

**验收标准：**
1. 为 8 个缺少单例模式的 Service 类添加单例保护（参照 RecordService/BabyService 的模式）
2. 页面中使用 `new XxxService()` 的地方改为页面级缓存（如 `this._recordService = this._recordService || new RecordService()`）
3. 特别是 `record.js` 中 6 处 `new RecordService()`、`home.js` 中 3 处 `new RecordService()` 改为页面级缓存

### FR-15: growth.js loadGrowthRecords 循环计算优化（P1）
**用户故事：** 作为用户，生长记录加载更快
**涉及文件：** `growth.js`

**验收标准：**
1. `loadGrowthRecords()` 中对每条记录的 `calculatePercentile()` 减少重复 WHO 数据查找
2. 提前缓存当前宝宝性别对应的 WHO 数据集，避免在循环中反复判断（当前 30 条记录 × 8 次 WHO 查找 = 240 次对象访问）

### FR-16: 疫苗/里程碑配置数据三重维护统一（P1）
**用户故事：** 作为开发者，消除数据不一致风险
**涉及文件：** `config/vaccine-plans.js`, `services/todo.js`, `services/subscribe.js`, `config/milestone-defs.js`

**验收标准：**
1. `todo.js#_getVaccinePlans()` 改为使用 `config/vaccine-plans.js` 中的 `getVaccinePlans()`（当前三处独立维护）
2. `subscribe.js#generateVaccineSchedule()` 同理
3. `todo.js#_getMilestoneDefinitions()` 改为使用 `config/milestone-defs.js` 中的 `MILESTONE_DEFINITIONS`（当前两处独立维护）

### ~~FR-17: 已合并入 FR-37~~
> **合并原因：** FR-17（本地缓存大小限制）的 `updateLocalCache` / `saveToLocalCache` 截断逻辑是 FR-37（记录缓存统一治理）的子集。合并后在 FR-37 中统一管理缓存大小、孤立缓存清理和全局监控。原 FR-17 的验收标准已移入 FR-37。

### FR-18: record.js getTodayStats 缓存（P1）
**用户故事：** 作为用户，首页刷新更快
**涉及文件：** `services/record.js`

**验收标准：**
1. `getTodayStats` 增加 10-30s 内存缓存，避免每次调用都走完整的 `getRecords` 链路
2. 缓存键包含 babyId + 日期，保证切换宝宝或跨天时失效

### FR-19: trendService 四次独立 filter 遍历优化（P1）
**用户故事：** 作为用户，记录页趋势加载更快
**涉及文件：** `services/trendService.js`

**验收标准：**
1. `calculateFeedingTrend` / `calculateSleepTrend` / `calculateDiaperTrend` / `calculateTemperatureTrend` 四个方法各自独立 `.filter()` 全量记录（共 8 次遍历），改为一次遍历按 `recordType` 分桶到 Map
2. `getTrendData` 增加 30-60s 内存缓存

### FR-20: 组件 attached + observer 重复调用修复（P1）
**用户故事：** 作为开发者，减少组件初始化时的重复计算
**涉及文件：** `icon.js`, `insight-section.js`, `export-popup.js`

**验收标准：**
1. `icon.js`: 移除 `attached()` 中的 `updateIconSrc()` 调用（observer 初始化时会触发）
2. `insight-section.js`: 移除 `attached()` 中的 `loadTrendData()` 调用
3. `export-popup.js`: 移除 `attached()` 中的 `checkExportLimit()` 调用

### FR-21: 组件 detached 生命周期补全（P1）
**用户故事：** 作为开发者，防止内存泄漏
**涉及文件：** `feeding-popup.js`, `diaper-popup.js`, `temperature-popup.js`, `growth-popup.js`, `report-popup.js`, `export-popup.js`, `timeline.js`

**验收标准：**
1. 7 个缺少 `detached` 生命周期的组件添加清理逻辑
2. `report-popup.js`: 清理 `imageCache` 和 `_isGenerating` 锁
3. `report-popup.js`: `preloadImages` 改为首次 `show=true` 时再执行（而非 `attached` 时预加载）

### FR-22: vaccine.wxml 嵌套 wx:for 筛选优化（P1）
**用户故事：** 作为用户，疫苗页面列表渲染更快
**涉及文件：** `vaccine.wxml`, `vaccine.js`

**验收标准：**
1. WXML 中内层 `wx:if="{{filterStatus === 'all' || vaccine.status === filterStatus}}"` 条件筛选移到 JS 层预计算
2. 只传递已筛选后的数据到 WXML，避免在模板中做条件过滤

### FR-23: sleep-popup 计时器 setData 优化（P1）
**用户故事：** 作为用户，睡眠追踪时计时显示流畅
**涉及文件：** `sleep-popup.js`

**验收标准：**
1. `setInterval` 中的 `trackingInterval` ID 从 `data` 移到实例属性 `this._trackingInterval`（视图层不需要此值）
2. 考虑降低计时更新频率（如每 5 秒）或使用 WXS 计时

### FR-24: baby.js N+1 查询修复（P2）
**用户故事：** 作为用户，切换宝宝时加载更快
**涉及文件：** `services/baby.js`

**验收标准：**
1. `getBabiesByFamilyId` 回退逻辑中对 `family.babies` 的逐个 `doc(babyId).get()` 改为 `where({ _id: db.command.in(family.babies) })` 批量查询

### FR-25: 死代码清理（P2）
**用户故事：** 作为开发者，代码库保持精简
**涉及文件：** `record.js`, `filterService.js`, `trendService.js`, `icon.js`, `temperature-popup.js`
> **注：** `subscribe.js` 的清理已移至 FR-41 统一处理，避免与 FR-41.AC3 重复

**验收标准：**
1. `record.js` 中 `loadStats()` 和 `loadTodayStats()` 确认未被调用后标注或移除
2. `filterService.js` / `trendService.js` 确认引用关系，未被引用的考虑移除
3. `icon.js` 中 @2x/@3x 回退逻辑（handleError 行 144）属于死代码，删除
4. `temperature-popup.js` 中空 observer `'show'`（只有注释）删除

### FR-26: 生产环境 console.log 清理（P2）
**用户故事：** 作为开发者，减少不必要的日志输出
**涉及文件：** `timeline.js`, `record.js`, `ai-assistant.js`, `sync.js`, `home.js`

**验收标准：**
1. `timeline.js` observer 中 `console.log` 移除
2. `record.js` 中 `onRecordSelect` / `selectAllVisible` 的 7+ 处 console.log 移除
3. `ai-assistant.js` 中 15+ 处调试 console.log 移除
4. `sync.js` 中 `console.log('记录变化:', snapshot)` 移除（Watch 推送可能频繁触发）

### FR-27: sync.js 离线队列串行改并行（P2）
**用户故事：** 作为用户，网络恢复后离线数据同步更快
**涉及文件：** `services/sync.js`

**验收标准：**
1. `syncOfflineQueue` 中 `for` 循环串行 `await` 改为分批并行（如每批 5 个）
2. `syncInProgress` 标志增加 `try-finally` 异常保护

### FR-28: diaper-popup 直接数据库查询改用 Service（P2）
**用户故事：** 作为开发者，保持一致的数据访问层
**涉及文件：** `diaper-popup.js`

**验收标准：**
1. `checkConsecutiveWatery()` 中直接查询 `wx.cloud.database()` 改为通过 RecordService
2. 增加 30 秒缓存避免每次选择"水样"都发 DB 请求

### ~~FR-29: 已合并入 FR-39~~
> **合并原因：** FR-29（`report-popup.wxml` / `milestone.wxml` 的复杂表达式预计算）与 FR-39（`timeline.wxml` / `home.wxml` / `record.wxml` 的三元表达式预计算）属于同一类优化，合并后统一管理。原 FR-29 的验收标准已移入 FR-39。

### FR-30: record.wxss backdrop-filter 优化（P2）
**用户故事：** 作为用户，低端设备上浮窗菜单不掉帧
**涉及文件：** `record.wxss`

**验收标准：**
1. `.fab-container` 的 `backdrop-filter: blur(4rpx)` 在低端设备上可能掉帧，改为纯色半透明背景替代

---

### FR-31: 分包加载配置（P0）
**用户故事：** 作为用户，我希望小程序启动更快，首屏加载时间更短
**涉及文件：** `app.json`, 各页面目录

**验收标准：**
1. 当前 18 个页面全部在主包，未配置 `subpackages`，需要拆分为主包 + 分包
2. 主包保留核心页面：`home`, `record`, `baby-list`（约 3 个高频页面）
3. 分包 A（生长发育）：`growth`, `milestone`, `vaccine`（含 31.48 KB 静态配置数据 `milestone-defs.js` / `who-standards.js` / `vaccine-plans.js`）
4. 分包 B（辅助功能）：`ai-assistant`, `family`, `settings`, `report`, `export` 等
5. 配置 `preloadRule` 对即将访问的分包进行预加载
6. 验证分包后主包体积降低 40%+

### FR-32: AI 洞察缓存过期清理（P1）
**用户故事：** 作为用户，长期使用不应因过期缓存导致存储膨胀
**涉及文件：** `home.js`

**验收标准：**
1. `home.js` 中 `_getCachedInsight()` / `_cacheInsight()` 当前使用 `${babyId}_${dateKey}` 为键存储 AI 洞察，每天累积一条永不清理
2. 增加缓存过期清理机制：仅保留最近 7 天的 AI 洞察缓存
3. 在 `_cacheInsight()` 写入时执行一次过期清理（遍历同前缀的 key，删除超过 7 天的）
4. 或在 `app.js#onLaunch()` 中统一执行全局缓存清理

### FR-33: todo.js 数据库查询加 limit（P1）
**用户故事：** 作为用户，待办列表加载更快，不会因历史数据过多而变慢
**涉及文件：** `services/todo.js`

**验收标准：**
1. `_computeVaccineStats()` 中 `.where({...}).get()` 无 limit 限制，对于历史数据多的用户可能返回大量记录，增加 `.limit(100)` 或合理上限
2. `_computeMilestoneStats()` 同理增加 limit
3. 确保 limit 不影响统计准确性（如需要全量数据则改用分页聚合）

### FR-34: vaccine.js 连续 setData 合并（P1）
**用户故事：** 作为用户，切换疫苗筛选标签时不应有闪烁
**涉及文件：** `vaccine.js`

**验收标准：**
1. `onFilterChange()` 中连续两次 setData（先设 `filterStatus`，再设筛选后的列表）合并为 1 次 setData
2. 确保合并后 UI 状态一致

### FR-35: 公共样式 @import 统一引用（P1）
**用户故事：** 作为开发者，减少重复样式代码，保持样式一致性
**涉及文件：** `styles/popup.wxss`, `styles/form.wxss`, `styles/page-header.wxss`, `styles/loading.wxss`, 13+ 个页面/组件 WXSS 文件

**验收标准：**
1. `styles/` 目录下 4 个公共样式文件已存在但全项目无任何页面通过 `@import` 实际引用
2. 至少 13 个文件（6 个弹窗组件 + 记录页/首页/设置页等）存在与 `styles/popup.wxss` 重复的弹窗样式（`.popup-overlay`, `.popup-content`, `.popup-header` 等），改为 `@import '../../styles/popup.wxss'`
3. 表单类页面引用 `styles/form.wxss`
4. 所有页面头部样式引用 `styles/page-header.wxss`
5. 删除各文件中被 @import 替代的重复样式代码

### FR-36: 弹窗组件 wx:if 改 hidden（P1）
**用户故事：** 作为用户，反复打开弹窗时响应更快
**涉及文件：** 6 个弹窗组件的父页面 WXML

**验收标准：**
1. 弹窗组件（`feeding-popup`, `sleep-popup`, `diaper-popup`, `temperature-popup`, `growth-popup`, `baby-edit-popup`）在父页面中使用 `wx:if="{{showXxxPopup}}"` 控制，每次打开都重建组件树
2. 改为 `hidden="{{!showXxxPopup}}"` + 组件内部 observer 监听 `show` 属性变化来初始化数据
3. 频繁打开的弹窗（如 feeding-popup、diaper-popup）优先改造
4. 注意：使用 hidden 后组件常驻内存，需确保 `show=false` 时不执行后台逻辑

### FR-37: 记录缓存统一治理（含大小限制）（P1）
**用户故事：** 作为用户，长期使用不会因缓存膨胀导致小程序变慢或存储溢出
**涉及文件：** `services/record.js`, `app.js`
> **注：** 本条目已合并原 FR-17 的内容

**验收标准：**
1. `updateLocalCache` 排序后增加 `merged = merged.slice(0, 200)` 限制最大缓存条数（原 FR-17.AC1）
2. `saveToLocalCache` 同理检查缓存大小（原 FR-17.AC2）
3. `updateRecordInCache()` 当前遍历所有宝宝的缓存（`records_baby_*`），即使只修改了一个宝宝的记录，改为仅更新指定 `babyId` 的缓存
4. 当缓存条数超过上限（200条）时，除了截断还需要清理对应的 localStorage key，避免孤立缓存
5. 新增全局缓存大小监控：在 `app.js#onLaunch()` 中检查 `wx.getStorageInfoSync()` 的 `currentSize`，超过阈值时触发清理

### FR-38: transition 属性精确化（P1）
**用户故事：** 作为用户，动画过渡更流畅，不出现意外的重排动画
**涉及文件：** 多个 WXSS 文件

**验收标准：**
1. 全项目搜索 `transition: all`（或 `transition:all`），将 `all` 替换为具体属性名（如 `transition: transform 0.3s, opacity 0.3s`）
2. 重点修复弹窗组件的 `.popup-content` 和 `.popup-overlay` 的 transition
3. 避免 `transition: all` 导致非预期属性（如 height、padding、margin）触发 GPU 合成层

### FR-39: WXML 复杂表达式 / 三元表达式统一预计算（P1）
**用户故事：** 作为用户，列表滚动更流畅，模板渲染效率更高
**涉及文件：** `timeline.wxml`, `home.wxml`, `record.wxml`, `report-popup.wxml`, `milestone.wxml`
> **注：** 本条目已合并原 FR-29 的内容

**验收标准：**
1. `home.wxml` 和 `record.wxml` 中的复杂条件表达式（如 `{{item.type === 'feeding' ? '喂养' : item.type === 'sleep' ? '睡眠' : ...}}`）在 JS 层预计算为 `typeLabel` 字段
2. `report-popup.wxml` 中嵌套三元表达式（趋势 class/text）在 JS 层预计算为 `feedingTrendClass` / `feedingTrendText`（原 FR-29.AC1）
3. `milestone.wxml` 中 `class` 条件表达式在 JS 层预计算为 `windowClass` 字段（原 FR-29.AC2）
4. 循环体内的所有三元/逻辑表达式计算移到 JS 的数据准备阶段
5. 模板中仅保留简单的变量引用

### FR-40: home.js computeGreeting weekDays 数组缓存（P1）
**用户故事：** 作为开发者，减少高频函数中的不必要内存分配
**涉及文件：** `home.js`

**验收标准：**
1. `computeGreeting()` 中 `weekDays` 数组（`['日','一','二',...]`）在每次调用时重新创建，改为模块级常量
2. `computeGreeting()` 中的 `Date` 对象创建减少到一次

### FR-41: 删除未使用组件和服务（P2）
**用户故事：** 作为开发者，减小包体积，保持代码库整洁
**涉及文件：** `components/common/popup/*`, `components/cloudbase-badge/*`, `services/subscribe.js`, `services/sync.js`（部分方法）

**验收标准：**
1. `components/common/popup/` 通用弹窗组件：全项目无任何页面 JSON 注册、无 WXML 引用，确认后删除
2. `components/cloudbase-badge/` 组件：仅自身 WXML 自引用，无任何页面使用，确认后删除
3. `services/subscribe.js`：无任何页面 `require` 此文件，且 `templateIds` 为空字符串，确认后删除或标注废弃
4. `services/sync.js` 中 `subscribeRecords()` / `subscribeFamily()`：已实现但全项目无调用，标注为死代码

### FR-42: error-state 全局组件改为局部注册（P2）
**用户故事：** 作为开发者，减少不必要的全局组件注册
**涉及文件：** `app.json`, `home.json`

**验收标准：**
1. `app.json#usingComponents` 中 `error-state` 注册为全局组件，但仅 `home.wxml` 使用
2. 从 `app.json` 移除，改为在 `home.json#usingComponents` 中局部注册
3. 减少其他页面的组件解析开销

### FR-43: 图标资源 CDN 迁移评估（P2）
**用户故事：** 作为用户，小程序包下载更快
**涉及文件：** `miniprogram/images/` 目录（113 个 PNG 文件）

**验收标准：**
1. 当前 113 个 PNG 图标全部打包在本地（`images/` 目录），评估哪些可以迁移到 CDN
2. 低频使用的图标（如 `report-popup`、`export` 相关）优先迁移
3. 高频使用的核心图标（如记录类型图标、底部导航图标）保留本地
4. 迁移后通过 `image` 组件的网络 URL 加载，配合 FR-7 的 lazy-load

### FR-44: 配置数据懒加载（P2）
**用户故事：** 作为用户，首页加载不受非首页数据影响
**涉及文件：** `config/milestone-defs.js` (12.21 KB), `config/who-standards.js` (10.03 KB), `config/vaccine-plans.js` (9.24 KB)

**验收标准：**
1. 三个配置文件合计 31.48 KB 纯静态数据，仅 `growth.js`、`milestone.js`、`vaccine.js`、`todo.js` 使用
2. 配合 FR-31 分包：将这三个配置文件移入对应分包目录
3. 若不分包，则改为动态 `require()` 按需加载，避免主包启动时加载全部配置

### FR-45: WXS 引入评估（P2）
**用户故事：** 作为用户，高频交互（如滑动关闭弹窗）更流畅
**涉及文件：** 新建 `utils/` 下的 WXS 模块

**验收标准：**
1. 当前项目无任何 `.wxs` 文件，所有视图层计算均在 JS 层完成
2. 评估并引入 WXS 的场景：
   - 弹窗 `onTouchMove` 滑动关闭动画（配合 FR-5）
   - `timeline.wxml` 中的格式化函数（日期格式化、时间差计算）
   - 列表项中的简单条件判断
3. 创建 `utils/format.wxs` 提供 `formatDate`、`formatDuration` 等 WXS 函数
4. 在 WXML 中通过 `<wxs module="fmt" src="../../utils/format.wxs"/>` 引入

### FR-46: parseTimestamp 函数统一（P2）
**用户故事：** 作为开发者，消除重复实现，减少维护成本
**涉及文件：** `components/timeline/timeline.js`, `services/record.js`, `components/report-popup/report-popup.js`

**验收标准：**
1. `timeline.js`、`record.js` 和 `report-popup.js` 各有一份 `parseTimestamp()` 实现，逻辑相同（共 3 处重复）
2. 统一提取到 `utils/date.js`（与 FR-10 的 `calculateAgeMonths` 统一维护）
3. 三处引用改为 `require('../../utils/date.js').parseTimestamp`

### FR-47: ai-assistant.js 直接 DB 查询改用 Service（P2）
**用户故事：** 作为开发者，保持统一的数据访问层
**涉及文件：** `pages/ai-assistant/ai-assistant.js`

**验收标准：**
1. `ai-assistant.js` 中直接调用 `wx.cloud.database()` 查询记录（约行 138-143），绕过了 RecordService 的缓存机制
2. 改为通过 `RecordService.getRecords()` 获取数据，复用缓存
3. 减少不必要的 DB 请求

### FR-48: setTimeout/setInterval 清理补全（P2）
**用户故事：** 作为开发者，防止页面销毁后定时器继续执行导致内存泄漏
**涉及文件：** `ai-assistant.js`, `home.js`, `sleep-popup.js`

**验收标准：**
1. `ai-assistant.js` 中 `setTimeout`（约行 269-271）未保存 timer ID，页面销毁时无法清理
2. 保存 timer ID 到 `this._scrollTimer`，在 `onUnload` 中 `clearTimeout`
3. `home.js` 中 `checkActiveSleep` 的定时器（如有）同理清理
4. 配合 FR-21 的组件 `detached` 生命周期补全

### FR-49: vaccine.js / milestone.js 查询加 limit + 分页（🔴 P0）
**用户故事：** 作为用户，当我已接种超过 20 支疫苗或完成超过 20 个里程碑时，所有记录应正确显示，不丢失数据
**涉及文件：** `pages/vaccine/vaccine.js`, `pages/milestone/milestone.js`

**验收标准：**
1. `vaccine.js` 第 105-109 行 `db.collection('vaccine_records').where({babyId}).get()` 当前无 `.limit()`，小程序端默认上限 20 条，当疫苗接种记录 > 20 条时会静默截断数据（**严重功能 bug**）
2. 添加 `.limit(100)` 或实现分页循环查询，确保全量获取已接种记录
3. `milestone.js` 第 100-102 行 `db.collection('milestone_records').where({babyId}).get()` 同理无 limit，添加 `.limit(100)` 或分页
4. 两处查询均应添加 `.orderBy('createdAt', 'desc')` 确保数据有序
5. 考虑将查询封装为 `VaccineService` / `MilestoneService`，与项目 Service 层架构保持一致

### FR-50: growth.js / growth-popup.js 写操作改用 RecordService（P1）
**用户故事：** 作为用户，通过生长页录入的数据应与其他页面一样支持离线同步和完整的数据一致性
**涉及文件：** `pages/growth/growth.js`, `components/growth-popup/growth-popup.js`

**验收标准：**
1. `growth.js` 第 880-886 行的 `.update()` 和 `.add()` 直接操作数据库，绕过了 RecordService，导致：
   - 缺少 `createdBy` / `updatedBy` 字段
   - 不触发离线同步机制
   - 不更新本地缓存，其他页面数据不同步
2. `growth.js` 第 934-936 行的 `.remove()` 同理改用 `RecordService.deleteRecord()`
3. `growth-popup.js` 第 240 行的 `.add()` 同理改用 `RecordService.addRecord()`
4. 改用 RecordService 后，确保 growth 相关记录的增删改查路径与 record 页面一致

---

## 非功能需求

### NFR-1: 性能指标
- 首页 loadData 的 setData 调用次数从 ~5 次减少到 ≤2 次
- 首页 onShow（被节流时）setData 从 3 次减少到 1 次
- 生长页 drawChart 闭包创建数量减少 50%+
- 记录页切换筛选标签的 DB 请求从 6 次降为 0 次（30s 内缓存）
- 搜索操作响应 < 300ms
- 弹窗下滑关闭时 setData 频率从 60fps 降为 ≤16ms 一次
- 全项目 image 加载采用 lazy-load
- 6 个弹窗的 onTouchMove setData 频率降低 90%+
- **（新增）** 分包后主包体积降低 40%+，首屏加载时间降低 30%+
- **（新增）** timeline 组件 observers 触发次数减半（records/selectedRecords 分离后）
- **（新增）** 公共样式统一后，全项目重复弹窗样式代码减少 80%+（约 13 个文件受益）
- **（新增）** 删除未使用组件/服务后，包体积减少约 15-20KB
- **（新增 v2）** vaccine/milestone 查询确保全量获取，数据截断率降为 0%
- **（新增 v2）** growth 页面写操作经过 RecordService，与 record 页面数据路径一致

### NFR-2: 稳定性
- 所有优化不得改变现有功能行为
- 所有优化不得改变 UI 表现
- 保持离线模式的完整功能
- 本地缓存增加大小限制，防止 Storage 溢出
- **（新增）** AI 洞察缓存自动过期清理，保留最近 7 天
- **（新增）** 全局缓存大小监控，超过阈值自动触发清理
- **（新增）** 所有 setTimeout/setInterval 在页面/组件销毁时正确清理

### NFR-3: 兼容性
- 保持 `lazyCodeLoading: "requiredComponents"` 配置
- 保持现有的单例模式和模块结构
- 公共 behavior 提取不改变组件的外部接口
- **（新增）** 分包配置需兼容现有路由跳转（`wx.navigateTo` 等路径不变）
- **（新增）** WXS 引入需确保低版本基础库降级兼容（`<wxs>` 标签在不支持时静默忽略）
- **（新增）** `hidden` 替换 `wx:if` 后，组件内存占用增加在可接受范围内

---

## 边界条件和异常处理
- 节流机制需确保下拉刷新时强制跳过（已有的 `onPullDownRefresh` 逻辑保持不变）
- setData 合并时需确保回调时序正确（如 `loadData` 中先 setData 再 `computeFeedingPrediction`）
- 缓存失效时自动降级到实时查询
- debounce 工具需确保组件销毁时自动取消挂起的回调
- 本地缓存裁剪时保留最新的记录，不丢失未同步的离线记录
- sync.js 的 `syncInProgress` 标志需在异常时正确重置
- **（新增）** 分包加载失败时的容错处理：`wx.loadSubpackage` 失败后给出用户友好提示，不影响主包功能
- **（新增）** 弹窗从 `wx:if` 改为 `hidden` 后，需确保 `show=false` 时组件内部不执行后台逻辑（如定时器、网络请求）
- **（新增）** 公共样式 @import 后，需验证各组件的样式隔离不受影响（组件 `styleIsolation` 配置）
- **（新增）** 图标迁移 CDN 后，需确保离线模式下有兜底显示（本地 fallback 或 placeholder）
- **（新增）** WXS 函数需保持与 JS 层同名函数的计算结果完全一致
- **（新增 v2）** vaccine/milestone 查询改为分页后，需确保合并逻辑对重复记录做去重（避免分页边界记录重复）
- **（新增 v2）** growth 写操作切换到 RecordService 后，需确保 `recordType: 'growth'` 字段正确设置，不影响 RecordService 内部的类型过滤逻辑
