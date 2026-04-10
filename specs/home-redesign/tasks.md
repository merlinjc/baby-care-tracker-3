# 实施计划 - 主页改版（Home Redesign）

> 版本：v1.0 | 日期：2026-04-01 | 状态：✅ 已完成（2026-04-02）

## 实施概览

预计总工时：约 32 小时  
关键里程碑：
- M1（工时 1-8h）：基础层改造 — 服务扩展 + 新建 TodoService + growth-popup
- M2（工时 9-18h）：首页核心模块 — 骨架屏、问候语、宝宝横幅、多宝切换、今日概览
- M3（工时 19-26h）：首页交互模块 — 快捷操作、时间线编辑、AI 洞察
- M4（工时 27-32h）：关联页改造 + 联调验收

---

## 任务列表

### 阶段一：基础服务层改造（M1）

- [x] **T-1.1** 扩展 `RecordService.getTodayStats` ✅
  - 在 `feeding` 统计中追加 `lastTimeTs`（最新喂养 startTimeTs）
  - 在 `sleep` 统计中追加 `lastEndTimeTs`（最新睡眠 endTimeTs）
  - 在 `temperature` 统计中追加 `latestValue`（最大 startTimeTs 对应的体温值）+ `latestValueTs`
  - 验证：`temperature.values[0]` 不可靠时的降级逻辑
  - _依赖：无 | 涉及：FR-1/4/5/6_

- [x] **T-1.2** 扩展 `RecordService.getRecords` 支持 `dateRange` 参数 ✅
  - 新增可选参数 `{ dateRange: { start: number, end: number } }`，按 `startTimeTs` 范围筛选
  - 默认行为（无 dateRange 时）保持不变，不影响其他调用方
  - _依赖：无 | 涉及：FR-8_

- [x] **T-1.3** 新建 `services/todo.js` — TodoService ✅
  - 将 `discover.js` 的 `loadTodoStats()` 核心逻辑提取到 `TodoService._compute(baby)`
  - 实现 30s 内存缓存（`_cache = { babyId, ts, data }`）
  - 导出单例：`module.exports = new TodoService()`
  - _依赖：无 | 涉及：FR-7_

- [x] **T-1.4** 修改 `pages/discover/discover.js` 接入 TodoService ✅
  - `loadTodoStats()` 改为调用 `todoService.getTodoStats(this.data.currentBaby)`
  - 回归测试：发现页「疫苗」「里程碑」待办数据保持正常显示
  - _依赖：T-1.3 | 涉及：FR-7_

- [x] **T-1.5** 新建 `components/growth-popup/` 组件 ✅
  - 创建 `growth-popup.js/.wxml/.wxss/.json` 四个文件
  - 从 `pages/growth/growth.js` 提取 `formData`、`saveGrowthData`、弹窗显示逻辑
  - 从 `pages/growth/growth.wxml` 提取 add-popup 片段
  - Properties：`show: Boolean`，`babyId: String`
  - Events：`close`（关闭弹窗）、`saved`（保存成功）
  - 回归测试：在 growth 页验证原弹窗功能不受影响（growth 页继续使用自身实现，不强制迁移）
  - _依赖：无 | 涉及：FR-9_

- [x] **T-1.6** 新增 `utils/date.js` 的 `formatDuration(ms)` 函数 ✅
  - 入参：毫秒数（number）
  - 返回：`"Xh Ym"` / `"Xh"` / `"Ym"` 格式字符串
  - 0ms 返回 `"0m"`；负值按 0 处理
  - 补充单元测试用例（注释形式）
  - _依赖：无 | 涉及：FR-1/4/5/10_

---

### 阶段二：首页核心模块（M2）

- [x] **T-2.1** 首页骨架屏（FR-15） ✅
  - 在 `home.wxss` 顶部 `page {}` 块中追加 4.2 节中的新增 CSS 变量
  - 在 `home.wxss` 中添加 `@keyframes shimmer` 和 `.skeleton-block` 样式（使用 CSS 变量）
  - 在 `home.wxml` 最外层增加 `wx:if="{{loading}}"` 骨架屏块（含问候语/卡片/概览/操作/时间线共 7 个占位块）
  - 将原有 `.loading-container` 全屏转圈移除
  - 验收：`loading=true` 时显示骨架屏，`loading=false` 时显示真实内容
  - _依赖：无 | 涉及：FR-15_

- [x] **T-2.2** 顶部问候语模块（FR-13） ✅
  - `home.js` 新增 `computeGreeting(baby)` 方法（按时段/星期/出生天数计算）
  - `home.js` 的 `onShow` 中同步调用 `computeGreeting`（不等待网络）
  - `home.wxml` 顶部新增 `.greeting-bar` 区块（两行布局：问候+日期 / 出生天数）
  - `home.wxss` 新增对应样式（使用 `var(--text-primary)` / `var(--text-secondary)`）
  - 验收：不同时段显示不同问候语；宝宝为空时不显示出生天数
  - _依赖：T-2.1 | 涉及：FR-13_

- [x] **T-2.3** 宝宝状态横幅 + 睡眠计时基础（FR-1 + FR-10 核心） ✅
  - `home.js` 新增 `data.activeSleep`、`data.activeStatus`、`data.activeSleepDisplay`、`data.sleepAbnormal`
  - `home.js` 新增 `checkActiveSleep()` 方法：从 StorageUtil 读取 `active_sleep_{babyId}`，校验记录有效性（仍无 endTimeTs）
  - `home.js` 的 `onShow` 中同步调用 `checkActiveSleep()`
  - `home.js` 新增 `computeDisplayFields(nowTs)` 方法，在 `loadData()` 完成后调用（含 activeStatus/sleepAgoText/feedingAgoText）
  - `home.wxml` 宝宝卡片下方增加 `.status-banner` 区块（条件渲染，使用 `activeStatus.type` 控制样式）
  - 睡眠中时显示"结束睡眠"按钮，绑定 `onEndSleepTap`
  - `home.wxss` 新增 `.status-banner` 及状态色样式（使用 `var(--status-sleeping-bg)` 等新增变量）
  - _依赖：T-1.1/T-1.6/T-2.1 | 涉及：FR-1/FR-10 部分_

- [x] **T-2.4** 多宝快速切换（FR-2） ✅
  - `home.js` 新增 `data.familyBabies: []`、`data.switching: false`
  - `onLoad` 时调用 `BabyService.getBabiesByFamilyId()` 加载所有宝宝
  - 新增 `switchBaby(e)` 事件处理：StorageUtil.saveCurrentBaby → setData → loadData
  - `home.wxml` 在宝宝卡片内增加 `.baby-switch` 区块（`wx:if="{{familyBabies.length > 1}}"`）
  - 最多显示 3 个头像，超出显示 `+N`；当前宝宝头像加 `.active` 样式
  - `home.wxss` 新增切换头像样式（40rpx 圆形，`.active` 边框高亮）
  - 验收：只有 1 个宝宝时不显示切换区；切换后全页数据刷新；切换中显示局部 loading
  - _依赖：T-2.3 | 涉及：FR-2_

- [x] **T-2.5** 今日概览增强（FR-3/4/5/6） ✅
  - `home.js` 新增展示字段：`sleepDisplay`、`sleepGoalMet`、`tempStatus`、`tempStatusText`、`tempColor`、`showFeverAlert`、`feedingAgoText`、`sleepAgoText`、`totalTodayCount`
  - 新增 `computeTempStatus(value)` 方法（使用 CSS 变量字符串作为颜色返回值）
  - 新增 `getSleepGoal(ageMonths)` 工具函数（NSF 3 档标准）
  - `home.wxml` 今日概览区块改造：
    - 睡眠格：主值改为 `sleepDisplay`，辅助小字显示次数 + `sleepGoalMet` 绿勾
    - 体温格：主值改为 `latestValue`，颜色绑定 `tempColor`，附状态文案
    - 发烧时在概览卡片顶部插入橙色警示条（`wx:if="{{showFeverAlert}}"`）
    - 4 个统计格绑定 `bindtap="onStatTap"`，传 `data-type` 参数
    - 各格下方新增时间提示小字（`feedingAgoText` / `sleepAgoText`）
  - `home.wxss` 新增体温颜色绑定样式、警示横条样式、时间提示文字样式
  - 验收：体温 38.5°C 时显示红色+警示条；睡眠 8h 且月龄 3 个月显示绿勾
  - _依赖：T-1.1/T-1.6/T-2.3 | 涉及：FR-3/4/5/6_

---

### 阶段三：首页交互模块（M3）

- [x] **T-3.1** 今日待办卡片（FR-7） ✅
  - `home.js` 新增 `data.todoStats`（total/vaccine/milestone/overdue）
  - `onShow` 中并行调用 `loadTodoStats()`，内部调用 `todoService.getTodoStats(currentBaby)`
  - `home.wxml` 在状态横幅下方插入 `.todo-section`（`wx:if="{{todoStats.total > 0}}"`）
    - 横向 `scroll-view scroll-x`
    - 疫苗卡片：`wx:if="{{todoStats.vaccine > 0}}"`，`overdue` 时红色角标
    - 里程碑卡片：`wx:if="{{todoStats.milestone > 0}}"`
    - 点击各卡片绑定跳转事件
  - `home.wxss` 新增待办卡片样式（使用 `var(--todo-vaccine-bg)` 等变量）
  - 验收：无待办时区域不渲染；疫苗逾期标红；点击跳转正确页面
  - _依赖：T-1.3/T-2.3 | 涉及：FR-7_

- [x] **T-3.2** 睡眠计时完整实现（FR-10） ✅
  - `home.js` 新增 `startSleep()` 方法：创建 sleep 记录（`startTimeTs=Date.now()`，无 `endTimeTs`），写入 StorageUtil
  - `home.js` 新增 `endSleep()` 方法：更新记录 `endTimeTs`，清除 StorageUtil，刷新 `computeDisplayFields`
  - `home.js` 新增 `onSleepBtnTap()` 路由逻辑：无 activeSleep → startSleep；有 activeSleep + 正常 → endSleep；有 activeSleep + 异常 → 打开 sleep-popup
  - `home.wxml` 睡眠快捷按钮改为三态渲染（正常/计时中/异常，详见 design.md 3.8 节）
  - `home.wxss` 新增 `.sleep-active` 脉冲动画样式（复用 app.wxss 已有 `@keyframes pulse`）
  - 验收：开始睡眠后按钮变计时样式；结束后统计更新；跨会话（后台切换）恢复正确
  - _依赖：T-1.1/T-1.6/T-2.3 | 涉及：FR-10_

- [x] **T-3.3** 喂养预测角标（FR-8） ✅
  - `home.js` 新增 `data.feedingPrediction: { show, text, urgent }`
  - `loadData()` 完成后异步调用 `computeFeedingPrediction(babyId, nowTs)`（使用 T-1.2 的 `dateRange` 参数）
  - `home.wxml` 喂养快捷按钮上方增加角标（`wx:if="{{feedingPrediction.show}}"`）
  - `home.wxss` 新增角标样式（绝对定位右上角；urgent 时背景使用 `var(--badge-urgent-bg)`，普通使用 `var(--badge-prediction-bg)`）
  - 验收：历史记录 < 3 条时不显示；间隔 > 6h 或 < 1h 不显示；超时时橙色"该喂了 ⚡"
  - _依赖：T-1.2/T-1.6 | 涉及：FR-8_

- [x] **T-3.4** 生长快捷入口（FR-9） ✅
  - `home.json` 新增 `"growth-popup": "/components/growth-popup/growth-popup"` 引用
  - `home.js` 新增 `data.showGrowthPopup: false` 及开关事件
  - `home.wxml` 快捷操作区改为横向 `scroll-view scroll-x`（固定宽度，5 格），新增「生长」按钮
  - `home.wxml` 添加 `<growth-popup>` 组件，绑定 `show`/`babyId`/`bind:close`/`bind:saved`
  - `home.wxss` 新增「生长」按钮样式（与现有 4 个按钮保持美拉德色系统一，使用 `var(--primary-color)` 渐变）
  - 快捷操作区隐藏滚动条（`show-scrollbar="{{false}}"`）
  - 验收：点击生长按钮弹窗出现；保存后弹窗关闭；生长数据可在生长页查看
  - _依赖：T-1.5 | 涉及：FR-9_

- [x] **T-3.5** 时间线左滑快速编辑（FR-11） ✅
  - `components/timeline/timeline.js` 新增 `swipeEnabled` property（Boolean，默认 false）
  - 新增 `data.openedSwipeId: ''` + touch 手势逻辑（含角度判断，详见 design.md 3.9 节）
  - 新增 `onEditTap(e)`、`onDeleteTap(e)` 事件方法，通过 `triggerEvent` 向父组件传递
  - `components/timeline/timeline.wxml` 将 record-item 包裹 `.record-item-wrapper`，追加 `.swipe-actions` 滑出区
  - `components/timeline/timeline.wxss` 新增 swipe 相关样式（操作按钮使用 `var(--danger-color)` 和 `var(--warning-color)`）
  - `home.js` 监听 timeline 的 `edit`/`delete` 事件：编辑 → 打开对应 popup 并预填数据；删除 → showModal 二次确认 → deleteRecord → 刷新
  - `home.wxml` 中 timeline 组件增加 `swipe-enabled="{{true}}"`
  - 验收：左滑显示编辑/删除按钮；点击其他区域收起；删除后统计数据更新
  - _依赖：T-2.5 | 涉及：FR-11_

- [x] **T-3.6** 时间线限 5 条 + 查看全部（FR-12） ✅
  - `home.js` 将 `getRecords` 的 `limit` 参数从 10 改为 5
  - `home.wxml` 时间线卡片底部增加"查看全部 {{totalTodayCount}} 条记录 ›"按钮（`wx:if="{{totalTodayCount > 5}}"`），绑定 `onViewAllTap`
  - `home.js` 新增 `onViewAllTap` → `wx.switchTab({ url: '/pages/record/record' })`
  - 验收：≤ 5 条时不显示按钮；> 5 条时按钮显示正确总数；点击跳转记录页
  - _依赖：T-2.5 | 涉及：FR-12_

- [x] **T-3.7** 宝宝洞察 AI 摘要卡片（FR-14） ✅
  - `home.js` 新增 `data.aiInsight: { show, loading, text, fallback, collapsed }`
  - `onLoad` 时读取折叠状态：`StorageUtil.get('insight_collapsed')`
  - `loadData()` 完成后触发 `loadAiInsight()`
  - `loadAiInsight()` 实现完整流程：检查总记录数 → 检查缓存（`ai_insight_{babyId}_{YYYY-MM-DD}`）→ QuotaService 检查 → AIService.generateText → 缓存 → 降级兜底（buildFallbackInsight）
  - `buildInsightPrompt(baby, stats)` 构造 Prompt（与 requirements 模板一致）
  - 下拉刷新（`onPullDownRefresh`）时删除当日缓存 key 并重新 loadAiInsight
  - `home.wxml` 在时间线卡片上方插入「宝宝洞察」卡片（`wx:if="{{aiInsight.show}}"`）
    - 加载中：显示"正在分析今日数据..."打字机占位
    - 成功：显示 AI 文案；降级：文案 + 右下角"快速模式"灰字
    - 右上角折叠/展开按钮（▲/▼）
    - 整张卡片 `bindtap="onInsightTap"` 跳转 AI 助手
  - `home.wxss` 新增洞察卡片样式（使用 `var(--insight-bg)` 和 `var(--insight-border)`）
  - 验收：无记录时不显示；当日缓存命中不重复调用；折叠状态持久化；降级时标注"快速模式"
  - _依赖：T-2.5 | 涉及：FR-14_

---

### 阶段四：关联页改造 + 联调验收（M4）

- [x] **T-4.1** 修改 `pages/record/record.js` 接收跳转参数（FR-3） ✅
  - `onLoad(options)` 中读取 `options.type`
  - 通过 `FILTER_TYPE_MAP.indexOf(options.type)` 映射到 `currentFilter` 下标
  - 无效 type 时保持 `currentFilter: 0`（全部），不报错
  - 验收：从首页概览格点击喂养跳转后，记录页自动筛选喂养类型
  - _依赖：无 | 涉及：FR-3_

- [x] **T-4.2** 修改 `pages/ai-assistant/ai-assistant.js` 接收预置消息（FR-14） ✅
  - `onLoad(options)` 中读取 `options.presetMsg`
  - 当 `presetMsg === 'true'` 时，调用 `RecordService.getTodayStats` 获取今日数据，构造首条预置消息插入对话列表
  - 验收：从洞察卡片跳转后，AI 助手页首条消息包含今日宝宝数据摘要
  - _依赖：T-3.7 | 涉及：FR-14_

- [x] **T-4.3** 全局联调与回归测试 ✅
  - 验证骨架屏 → 真实内容渐显过渡（FR-15）
  - 验证下拉刷新重新加载所有模块（包括 AI 洞察缓存清除，FR-14 AC-9）
  - 验证多宝切换后全部数据（待办/洞察/统计）刷新正确（FR-2）
  - 验证睡眠计时跨后台会话正常（FR-10 AC-6）
  - 验证发烧警示横条与体温颜色一致（FR-6 AC-4）
  - 验证时间线 swipe 在安卓/iOS 上触发无误差，角度判断防误触（FR-11 NFR-4）
  - _依赖：T-1.x ~ T-4.2 全部 | 涉及：所有 FR_

---

## 任务依赖关系

```
T-1.1 ─┐
T-1.2 ─┤
T-1.3 ─┼─→ T-2.3 → T-2.4
T-1.4  │         └→ T-2.5 → T-3.5
T-1.5 ─┤                 └→ T-3.6
T-1.6 ─┘                 └→ T-3.7 → T-4.2

T-2.1 → T-2.2 → T-2.3（均需要骨架屏先完成）

T-1.3 → T-3.1（TodoService 先建好）

T-3.1 ~ T-3.7 可并行执行（无内部依赖）

T-4.1 独立（可在 T-2.5 完成后任意时间执行）
```

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| growth-popup 提取破坏 growth 页 | 中 | 中 | T-1.5 完成后回归 growth 页全功能 |
| discover.js 迁移到 TodoService 后待办数据不同步 | 低 | 高 | T-1.4 必须验证发现页徽章与首页待办数一致 |
| RecordService.getTodayStats 扩展影响其他调用方 | 低 | 中 | 新字段追加式扩展，原有字段保持不变 |
| AI 洞察缓存 key 碰撞（多宝同日） | 极低 | 低 | key 含 babyId，天然隔离 |
| swipe 手势与页面滚动冲突 | 中 | 中 | 角度判断（< 30°）限制水平触发，实际测试优先 |

---

*文档版本：v1.1*  
*创建日期：2026-04-01*  
*完成日期：2026-04-02*  
*状态：✅ 全部完成*
