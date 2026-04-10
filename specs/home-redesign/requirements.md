# 需求文档 - 主页改版（Home Redesign）

> 版本：v1.1 | 更新日期：2026-04-01 | 状态：待确认

## 概述

本次主页改版旨在将现有"静态展示型"首页升级为"智能感知型"首页，提升信息密度、操作效率和情感温度。改版范围涵盖宝宝卡片、今日概览、智能提醒、快捷操作、时间线、视觉体验共六个模块，合计采纳 15 条优化建议（原建议编号 1/3/4/5/6/7/8/9/10/11/14/15/17/18/19）。

## 页面结构总览（自上而下）

```
┌─────────────────────────────┐
│  FR-13  顶部问候语 + 日期    │
├─────────────────────────────┤
│  FR-1   宝宝状态横幅         │  ← 含 FR-2 多宝切换
├─────────────────────────────┤
│  FR-7   今日待办（条件显示） │
├─────────────────────────────┤
│  FR-3/4/5/6  今日概览        │
├─────────────────────────────┤
│  FR-8/9/10   快捷记录        │
├─────────────────────────────┤
│  FR-14  宝宝洞察 AI 卡片     │
├─────────────────────────────┤
│  FR-11/12  今日记录时间线    │
└─────────────────────────────┘
```

---

## 用户角色

- **主要照护者**：父母/监护人，每日高频使用，需要快速了解宝宝当前状态并记录护理事件
- **协同照护者**：祖父母/其他家庭成员，偶发使用，查看记录为主
- **多宝家庭用户**：家中有 2 个及以上宝宝，需要在不同宝宝之间快速切换

---

## 功能需求

### FR-1：宝宝状态横幅（原建议 1）

**用户故事：** 作为照护者，我想要在打开首页时立刻看到宝宝的当前状态，以便快速判断是否需要喂奶、哄睡等操作，而不用查询和计算。

**验收标准：**
1. When 当前有正在进行的睡眠记录（有 `startTimeTs` 无 `endTimeTs` 的 sleep 类型记录），the system shall 在宝宝卡片下方显示"正在睡觉 · 已 Xh Xm"状态条，并提供"结束睡眠"快捷按钮
2. When 当前无正在进行的睡眠且今日有喂养记录，the system shall 显示"上次喂养 Xh Xm 前"（基于最新喂养记录的 `startTimeTs` 计算）
3. When 当前无睡眠中且今日无喂养记录但有其他记录，the system shall 显示"上次记录 Xh Xm 前"（取最新一条记录的 `startTimeTs`）
4. If 今日无任何记录，then the system shall 显示"今天还没有记录，点击下方快速添加"的引导文案
5. While 状态文案显示，the system shall 使用与状态对应的主题色（睡眠中-紫色 `#B8A8D4`、喂养-绿色 `#A8D4A8`、默认-主色调）
6. When 用户点击"结束睡眠"按钮，the system shall 执行与 FR-10 AC-3 相同的结束睡眠逻辑（两处共用同一入口）

> **与 FR-10 的关系**：FR-1 的"结束睡眠"按钮和 FR-10 的睡眠计时器按钮是同一功能的两个入口，状态数据共享，不重复存储。

---

### FR-2：多宝快速切换（原建议 3）

**用户故事：** 作为多宝家庭的照护者，我想要在首页直接切换当前关注的宝宝，以便不用进入"我的"页面多步操作。

**验收标准：**
1. When 当前家庭账户下有 2 个及以上宝宝，the system shall 在宝宝卡片右侧展示其他宝宝头像列表（最多显示 3 个，超出显示"+N"文字）
2. When 用户点击其他宝宝头像，the system shall 调用 `StorageUtil.saveCurrentBaby()` 更新本地缓存，并重新执行 `loadData()` 刷新首页全部数据
3. When 只有 1 个宝宝时，the system shall 不显示切换区域
4. While 切换宝宝数据加载中，the system shall 对宝宝卡片区域显示局部加载态（非全屏），避免页面闪烁
5. When 切换宝宝，the system shall 清除 FR-14 的 AI 洞察缓存（不同宝宝的缓存 key 不同，无需手动清除，天然隔离）

---

### FR-3：统计数字可跳转（原建议 4）

**用户故事：** 作为照护者，我想要点击今日概览中的统计数字后直接进入对应的记录详情，以便快速查看具体内容而无需手动筛选。

**验收标准：**
1. When 用户点击"喂养"统计格，the system shall 调用 `wx.switchTab` 跳转到记录页，并通过 URL 参数 `?type=feeding` 传递筛选条件
2. When 用户点击"睡眠"统计格，the system shall 跳转记录页并传参 `?type=sleep`
3. When 用户点击"排便"统计格，the system shall 跳转记录页并传参 `?type=diaper`
4. When 用户点击"体温"统计格，the system shall 跳转记录页并传参 `?type=temperature`
5. When 对应类型今日无记录，the system shall 仍可点击跳转，记录页展示该类型空状态

> **技术说明**：记录页（`pages/record/record.js`）已有 `FILTER_TYPE_MAP`（feeding/sleep/diaper/temperature/growth）和 `currentFilter` 状态，`onLoad` 中读取 URL 参数 `type` 并自动映射到 `currentFilter` 下标即可；记录页无需改动筛选核心逻辑。

---

### FR-4：距上次操作时间提示（原建议 5）

**用户故事：** 作为照护者，我想要在今日概览中看到"距上次喂养/睡眠已过多久"，以便判断是否该喂奶或哄睡，减少焦虑。

**验收标准：**
1. When 今日有喂养记录，the system shall 在喂养统计格的次数下方以小字（22rpx）显示"上次 Xh Xm 前"（基于最新喂养的 `startTimeTs`）
2. When 当前正在睡眠中，the system shall 在睡眠统计格下方显示"已睡 Xh Xm"
3. When 当前不在睡眠中且今日有睡眠记录，the system shall 在睡眠统计格下方显示"上次醒来 Xh Xm 前"（基于最新睡眠的 `endTimeTs`）
4. If 无对应今日记录，then the system shall 不显示时间文案（保持空白，不占位）
5. While 计算时间差，the system shall 以页面 `onShow` 时的本地时间戳为基准，不实时计时（避免 setInterval 影响性能）

---

### FR-5：睡眠统计改为时长优先（原建议 6）

**用户故事：** 作为照护者，我想要在今日概览看到宝宝今日总睡眠时长而非睡眠次数，以便快速评估睡眠质量是否充足。

**验收标准：**
1. When 今日睡眠 `totalDuration > 0`，the system shall 将睡眠统计格的主数值显示为格式化时长（Xh Xm），次数降级为下方辅助小字（如"共 3 次"）
2. When 今日睡眠 `totalDuration === 0` 且次数 > 0（记录了睡眠但无 duration 数据），the system shall 降级仅显示次数
3. When `totalDuration === 0` 且次数 === 0，the system shall 主数值显示"0m"
4. When 总时长满足年龄推荐睡眠时长（月龄 0-3: ≥14h，月龄 4-11: ≥12h，月龄 12+: ≥11h），the system shall 在时长右侧显示绿色 ✓ 标识
5. While 有正在进行的睡眠（FR-10 计时中），the system shall 在时长后追加"（+计时中）"小字提示

> **说明**：推荐睡眠时长参考 NSF（美国国家睡眠基金会）标准，月龄分段简化为 3 档便于实现。

---

### FR-6：体温统计改为最新值优先（原建议 7）

**用户故事：** 作为照护者，我想要在今日概览直接看到最新体温数值并知道是否正常，以便快速掌握宝宝健康状态。

**验收标准：**
1. When 今日有体温记录，the system shall 将体温统计格的主数值显示为最新一条体温值（取 `todayStats.temperature.values[0]`，即最新值），记录次数降级为辅助小字
2. When 体温值 < 37.5°C，the system shall 数值显示绿色，图标下方附文案"正常"
3. When 体温值 ≥ 37.5°C 且 < 38.5°C，the system shall 数值显示橙色，附文案"低烧"
4. When 体温值 ≥ 38.5°C，the system shall 数值显示红色，附文案"发烧"，并在整个今日概览卡片顶部插入橙色警示横条（"⚠️ 宝宝体温偏高，请注意观察"）
5. If 今日无体温记录，then the system shall 主数值显示"--"，无颜色标注，标签文案保持"体温记录"

> **说明**：`todayStats.temperature.values` 由 `RecordService.getTodayStats()` 按记录顺序 push，需确认其为时间倒序（最新在前），若非倒序需在统计时调整为取最大 `startTimeTs` 对应的值。

---

### FR-7：今日待办智能提醒卡片（原建议 8）

**用户故事：** 作为照护者，我想要在首页看到当前待办的疫苗、里程碑等重要事项，以便不因在"发现"页看不到而错过重要节点。

**验收标准：**
1. When 有待接种疫苗（月龄已到且未接种）或有逾期里程碑，the system shall 在宝宝状态横幅下方显示"今日待办"横向滚动卡片区域
2. When 有待接种疫苗，the system shall 显示疫苗提醒卡片，文案"疫苗待接种 · X 剂"；当距接种日 ≤ 7 天时卡片标注橙色"即将到期"，已逾期标注红色"已逾期"
3. When 有当前月龄待达成的里程碑（`ageMonths >= item.warningMonths` 且未标记达成），the system shall 显示里程碑提醒卡片，文案"里程碑待记录 · X 项"
4. When 所有待办均已完成或无待办事项，the system shall 整个区域不渲染（`wx:if` 而非 `visibility:hidden`）
5. When 用户点击待办卡片，the system shall 跳转对应页面（疫苗页/里程碑页）
6. While 待办数量超过 3 个，the system shall 支持横向滑动查看（`scroll-view scroll-x`）

> **技术说明**：待办统计逻辑直接复用 `discover.js` 的 `loadTodoStats()` 方法，**提取为独立 Service**（如 `TodoService`），首页和发现页共同调用，避免重复的云端查询。首页调用同样遵守 30 秒节流规则（与发现页一致）。

---

### FR-8：喂养节律智能预测角标（原建议 9）

**用户故事：** 作为照护者，我想要在快捷入口的喂养按钮上看到预计下次喂养时间提示，以便不用自己计算喂养间隔。

**验收标准：**
1. When 今日+昨日合计有至少 3 条喂养记录，the system shall 计算最近 3 次喂养间隔均值，在喂养快捷按钮上方显示角标"约 Xh 后"（距上次喂养时间 + 平均间隔 - 当前时间）
2. When 预计时间已过（超时），the system shall 角标文案改为"该喂了 ⚡"并变为橙色背景
3. When 历史记录不足 3 条，the system shall 不显示角标
4. If 计算出的间隔均值 > 6 小时或 < 1 小时（超出合理范围），then the system shall 不显示角标（异常数据过滤）
5. While 角标显示，the system shall 角标悬浮于按钮右上角，不遮挡按钮文字

---

### FR-9：快捷入口增加生长记录（原建议 10）

**用户故事：** 作为照护者，我想要在首页直接添加生长数据（体重/身高），以便不用进入"发现→生长追踪"的多步路径。

**验收标准：**
1. When 首页加载完成，the system shall 在快捷入口区域增加"生长"按钮，布局由 4 格改为 5 格横向滚动（`scroll-view scroll-x`，每格固定宽度，不压缩现有按钮尺寸）
2. When 用户点击"生长"按钮，the system shall 弹出生长数据录入弹窗（复用 `growth` 页的 `add-popup` 组件，将其提取为独立组件 `growth-popup`）
3. When 生长数据保存成功，the system shall 关闭弹窗（无需刷新首页其他数据，生长数据不影响今日概览统计）
4. If 弹窗需要 `babyId`，then the system shall 从 `currentBaby._id` 传入

---

### FR-10：睡眠按钮实时计时状态（原建议 11）

**用户故事：** 作为照护者，我想要在首页直接开始/结束睡眠计时，以便实时追踪宝宝睡眠，而不用事后回忆时间再手动填写。

**验收标准：**
1. When 当前无正在进行的睡眠，the system shall 睡眠快捷按钮显示正常"睡眠"样式
2. When 用户点击睡眠快捷按钮且当前无进行中睡眠，the system shall 调用 `RecordService.createRecord()` 创建一条 `recordType: 'sleep'`、`startTimeTs = Date.now()`、无 `endTimeTs` 的记录，并将 `activeSleepId` 存入 Storage
3. When 当前有正在进行的睡眠（`activeSleepId` 存在且对应记录无 `endTimeTs`），the system shall 睡眠按钮变为"X h Xm · 结束"样式，带脉冲动画
4. When 用户点击"结束"，the system shall 调用 `RecordService.updateRecord(activeSleepId, { endTimeTs, data.duration })` 完成记录，清除 Storage 中的 `activeSleepId`，并刷新统计数据
5. If 睡眠开始距当前时间 > 24 小时，then the system shall 按钮显示"⚠️ 异常"样式，点击后弹出提示引导用户手动修正（打开完整睡眠编辑弹窗）
6. While 小程序进入后台再恢复前台（`onShow`），the system shall 重新读取 `activeSleepId` 并刷新计时显示，确保跨会话状态一致

> **技术说明**：`activeSleepId` 存储于 `StorageUtil`（key: `active_sleep_{babyId}`），onShow 时校验其有效性（查询记录是否仍无 endTimeTs）。

---

### FR-11：时间线记录支持快速编辑（原建议 14）

**用户故事：** 作为照护者，我想要在首页时间线中直接左滑记录条目来编辑或删除，以便修正错误记录时不用进入多个页面。

**验收标准：**
1. When 用户在时间线记录条目上向左滑动，the system shall 显示"编辑"和"删除"两个操作按钮（滑动操作样式参考微信原生 swipe-cell 交互）
2. When 用户点击"编辑"，the system shall 弹出与该记录 `recordType` 对应的编辑弹窗（feeding/sleep/diaper/temperature-popup），并将记录数据预填写到弹窗表单
3. When 用户点击"删除"，the system shall 弹出 `wx.showModal` 二次确认，确认后调用 `RecordService.deleteRecord()`，删除成功后从 `recentRecords` 中移除该条并更新 `todayStats`
4. When 编辑保存成功，the system shall 刷新 `recentRecords` 和 `todayStats`
5. While 滑动操作按钮展开时，the system shall 点击其他区域自动收起（通过记录 `openedSwipeId` 控制互斥）

> **技术说明**：微信小程序无内置 swipe-cell 组件，可通过 `bindtouchstart/bindtouchmove/bindtouchend` 手势监听 + 绝对定位的操作按钮实现，或使用 `movable-view` 方案。

---

### FR-12：时间线限制 5 条并增加"查看全部"（原建议 15）

**用户故事：** 作为照护者，我想要首页时间线只展示最新的 5 条记录，以便主页不过度冗长，需要更多内容时点击跳转。

**验收标准：**
1. When 首页加载数据，the system shall 将 `RecordService.getRecords()` 的 `limit` 参数从 10 改为 5（代码改动：`home.js` 第 134 行）
2. When 今日记录总数 ≤ 5，the system shall 全部展示，不显示"查看全部"按钮
3. When 今日记录总数 > 5，the system shall 底部显示"查看全部 X 条今日记录 ›"按钮，点击调用 `wx.switchTab` 跳转到记录页
4. While 数据加载中（骨架屏阶段），the system shall 时间线区域占位展示 3 条骨架条目（FR-15 统一处理）

> **说明**：今日记录总数从 `getTodayStats` 中各类型 count 之和获取，无需额外接口。

---

### FR-13：顶部日期与问候语（原建议 17）

**用户故事：** 作为照护者，我想要在首页顶部看到当天日期和宝宝的出生天数，以便感受到记录的仪式感和情感连接。

**验收标准：**
1. When 用户进入首页，the system shall 在页面最顶部（宝宝卡片上方）显示问候语区域，格式：
   - 第一行：`[时段问候语] · X月X日 周X`
   - 第二行：`[宝宝名] 出生第 XXX 天 🎉`（出生当天显示"出生第 1 天"）
2. When 当前时间 5:00-11:59，显示"早安 ☀️"；12:00-13:59 显示"午安"；14:00-17:59 显示"下午好"；18:00-21:59 显示"晚上好 🌙"；22:00-4:59 显示"夜深了，注意休息"
3. When 宝宝信息存在，the system shall 计算出生天数：`Math.floor((today - birthDate) / 86400000) + 1`
4. If `currentBaby` 为空，then the system shall 第二行不渲染
5. While 问候语区域显示，the system shall 字体使用主色调（`var(--text-primary)`），问候语大字（32rpx）+ 日期小字（26rpx）双行布局

---

### FR-14：宝宝洞察 AI 摘要卡片（原建议 18）

**用户故事：** 作为照护者，我想要在首页看到 AI 自动生成的今日宝宝状态摘要，以便快速了解宝宝整体状况而无需逐条查看记录。

**验收标准：**
1. When 今日概览数据加载完成且有任意记录（总 count > 0），the system shall 在时间线卡片上方展示"宝宝洞察"卡片，并异步发起 AI 摘要请求（不阻塞页面渲染）
2. When AI 请求进行中，the system shall 卡片内显示打字机动效文案"正在分析今日数据..."
3. When AI 摘要返回成功（`AIService.generateText()` resolve），the system shall 展示 AI 生成文案（2~4 句话），涵盖睡眠、喂养等综合评估
4. When AI 请求失败或超时（超过 8 秒），the system shall 降级展示本地规则引擎的简短摘要，卡片右下角标注"快速模式"灰色小字
5. When 今日无任何记录，the system shall 不渲染洞察卡片，不发起 AI 请求
6. When 用户点击洞察卡片，the system shall 跳转到 AI 助手页（`pages/ai-assistant`），并以 URL 参数 `?presetMsg=true` 标记，AI 助手页 `onLoad` 时读取当日 todayStats 生成首条预置消息（避免参数过长）
7. While 洞察卡片展示，the system shall 右上角提供折叠/展开按钮（▲/▼），折叠状态通过 `StorageUtil.set('insight_collapsed', true)` 持久化，下次进入首页恢复折叠状态
8. While 同一天内 AI 摘要已成功生成，the system shall 从 `StorageUtil` 读取缓存（key: `ai_insight_{babyId}_{YYYY-MM-DD}`），不重复调用 AI；次日 key 自然失效（无需主动清除）
9. When 用户手动下拉刷新，the system shall 删除当日缓存 key 并重新请求 AI 摘要
10. While 发起 AI 请求前，the system shall 调用 `QuotaService.getQuotaInfo()` 检查余量；余量为 0 时直接走降级策略，不弹出任何提示

> **AI Prompt 模板：**
> ```
> System: 你是一位专业育儿顾问。请根据以下数据，用简洁温暖的中文给家长提供今日宝宝状态总结，控制在 80 字以内，不要分点列出，用自然的句子表达。
> User: 宝宝 {name}，{age}个月。今日数据：喂养 {feedCount} 次（配方奶 {totalAmount}ml）、睡眠 {sleepH}h{sleepM}m（共 {sleepCount} 次）、换尿布 {diaperCount} 次、最新体温 {temp}°C。
> ```

---

### FR-15：骨架屏替换 Loading 转圈（原建议 19）

**用户故事：** 作为照护者，我想要首页加载时看到内容的占位轮廓而非全屏转圈，以便感知页面即将呈现的结构，减少等待焦虑。

**验收标准：**
1. When 首页数据加载中（`loading === true`），the system shall 以骨架屏替换全屏 loading-spinner，骨架屏包含：问候语条、宝宝卡片块、今日概览 4 格、快捷入口 5 格、时间线 3 条
2. When 数据加载完成（`loading === false`），the system shall 骨架屏整体 `opacity: 0` 过渡消失（300ms），真实内容 `opacity: 0 → 1` 渐显
3. While 骨架屏显示，the system shall 各占位块使用灰色（`#E8E0D8`）背景配 shimmer 扫光动画（CSS `@keyframes`，从左到右，周期 1.5s）
4. If 数据加载失败（`error === true`），the system shall 骨架屏直接切换为现有 `error-state` 组件，不显示过渡动画
5. While shimmer 动画运行，the system shall 使用纯 CSS animation 实现（`background: linear-gradient` + `background-position` 动画），不使用 JS 定时器

---

## 非功能需求

### NFR-1：性能要求
- 首页核心数据（todayStats + recentRecords 5 条）加载完成 ≤ 2 秒（4G 网络环境）
- 骨架屏（FR-15）在 JS bundle 执行完毕后 100ms 内渲染，无需等待数据
- 宝宝切换（FR-2）操作本地响应 ≤ 200ms（Storage 先行更新），云端数据刷新异步进行
- AI 洞察（FR-14）请求异步发起，不阻塞首页主体内容渲染
- 今日待办（FR-7）遵守 30 秒节流规则，与发现页保持一致

### NFR-2：兼容性要求
- 兼容微信小程序基础库 ≥ 2.20.0
- 兼容 iOS 14+ 和 Android 8.0+
- 屏幕宽度支持 320rpx - 414px（iPhone SE 至 iPhone Pro Max）
- 骨架屏 shimmer 动画在低端 Android 机型上需降级为静态灰色块（通过 CSS animation 支持检测）

### NFR-3：数据一致性
- 睡眠计时状态（FR-10）持久化到 `StorageUtil`（key: `active_sleep_{babyId}`），小程序后台切换恢复后自动同步
- 今日待办（FR-7）与发现页数据来源完全一致（共用 `TodoService`），不允许出现两页数据不同步
- AI 洞察缓存（FR-14）key 包含 babyId，多宝切换天然隔离

### NFR-4：用户体验
- 所有新增交互动效时长 ≤ 300ms
- 滑动操作（FR-11）触发阈值：水平滑动距离 > 30px 且水平方向明显（角度 < 30°），避免误触
- 快捷入口横向滚动（FR-9）需隐藏滚动条（`show-scrollbar="{{false}}"`）

### NFR-5：安全与隐私
- AI 洞察 Prompt（FR-14）不包含宝宝的姓名全称，仅使用昵称（`baby.name`）
- 本地 Storage 缓存的 AI 摘要内容不包含健康诊断性结论，仅作状态描述

---

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 新用户（无任何记录）进入首页 | FR-1 显示引导文案；FR-7/FR-8/FR-14 不显示；时间线空状态 |
| 睡眠记录 `endTimeTs` 早于 `startTimeTs`（数据异常） | FR-10 忽略该条，不显示"睡眠中"状态；FR-5 该条 duration 按 0 计 |
| 网络断开，云端数据加载失败 | 降级读取本地 Storage 缓存；骨架屏切换 error-state；FR-14 走降级摘要 |
| 多设备同时操作（家庭共享账户） | FR-10 睡眠状态以 DB 中 `endTimeTs` 是否为空为准，`onShow` 每次重新校验 |
| 宝宝出生当天进入首页 | FR-13 显示"出生第 1 天 🎉" |
| 今日有多条体温记录 | FR-6 取 `temperature.values[0]`（`getTodayStats` 按 `startTimeTs` 倒序 push 保证最新在前）|
| FR-14 AI 配额耗尽 | `QuotaService.remaining === 0` 时直接走本地降级，不显示配额提示，不影响用户感知 |
| FR-9 生长弹窗所需的 `GrowthService` 尚未注入 | 弹窗内部自行实例化 `GrowthService`，与首页 `RecordService` 无耦合 |
| FR-3 记录页 `onLoad` 收到 `type` 参数但 `FILTER_TYPE_MAP` 无对应 key | 默认跳转至"全部"筛选，不报错 |

---

## 模块依赖关系与新增接口

```
FR-1  宝宝状态横幅
  └── RecordService.getRecords()（已有，取最近 1 条喂养/sleep 记录）
  └── StorageUtil.get('active_sleep_{babyId}')（FR-10 共享）

FR-2  多宝快速切换
  └── BabyService.getBabiesByFamilyId()（已有）
  └── StorageUtil.saveCurrentBaby()（已有）

FR-3  统计数字跳转
  └── 记录页 onLoad 新增读取 URL 参数 ?type= 并映射 currentFilter（需改动 record.js）

FR-7  今日待办
  └── 【新建】TodoService（从 discover.js loadTodoStats 逻辑提取）
  └── discover.js 同步改为调用 TodoService（保持发现页功能不变）

FR-8  喂养节律预测
  └── RecordService.getRecords()（已有，取前 3 条 type=feeding 记录，跨今日+昨日）

FR-9  生长快捷入口
  └── 【新建】growth-popup 组件（从 growth 页的 add-popup 提取）
  └── GrowthService（growth 页已有）

FR-10 睡眠计时
  └── RecordService.createRecord()（已有）
  └── RecordService.updateRecord()（已有，更新 endTimeTs 和 data.duration）
  └── StorageUtil（key: active_sleep_{babyId}，新增读写）

FR-11 时间线快速编辑
  └── RecordService.updateRecord()（已有）
  └── RecordService.deleteRecord()（已有）
  └── 各类型 popup 组件（已有，feeding/sleep/diaper/temperature-popup）

FR-13 问候语
  └── 纯本地计算，无外部依赖

FR-14 AI 洞察
  └── AIService.generateText()（已有，services/ai.js）
  └── QuotaService.getQuotaInfo()（已有）
  └── StorageUtil（key: ai_insight_{babyId}_{YYYY-MM-DD}，新增读写）
  └── todayStats（FR-5/6 改版后的数据，同一请求复用）

FR-15 骨架屏
  └── 纯 UI 层改动，在 home.wxml 中新增 skeleton 模板，无服务层依赖
```

---

## 变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `pages/home/home.js` | 大改 | FR-1/2/4/5/6/7/8/9/10/12/13/14 |
| `pages/home/home.wxml` | 大改 | 全部 |
| `pages/home/home.wxss` | 增量 | FR-1/5/6/7/8/9/10/13/14/15 |
| `pages/home/home.json` | 增量（新增组件引用） | FR-9/11 |
| `pages/record/record.js` | 小改（onLoad 读 type 参数） | FR-3 |
| `services/todo.js` | 新建 | FR-7 |
| `pages/discover/discover.js` | 小改（调用 TodoService） | FR-7 |
| `components/growth-popup/` | 新建（从 growth 页提取） | FR-9 |
| `components/timeline/timeline.wxml` | 增量（swipe 交互） | FR-11 |
| `components/timeline/timeline.js` | 增量（swipe 手势逻辑） | FR-11 |

---

*文档版本：v1.1*  
*创建日期：2026-04-01*  
*状态：待确认*
