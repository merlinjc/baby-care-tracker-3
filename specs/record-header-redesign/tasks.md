# 实施计划 - 记录页顶部导航栏重设计（方案 B）

## 实施概览

- **预计总工时**：2 小时
- **涉及文件**：3 个（record.wxml / record.wxss / record.js）
- **关键里程碑**：
  1. WXML + WXSS 结构样式替换完成（视觉可验证）
  2. JS 逻辑完成（副标题动态数据可验证）
  3. 边界条件与管理模式兼容验证通过

## 任务列表

### 1. WXML 结构替换

- [x] **1.1 替换 top-bar 为 page-header 结构**
  - 删除 `record.wxml` 第 2-12 行的 `.top-bar` 结构
  - 替换为设计文档 §1 中定义的 `.page-header` 结构：
    - `.header-icon`：`<image src="/images/icons/edit-gray.png" mode="aspectFit">`
    - `.header-text`：标题 `记录` + 副标题 `{{todaySummaryText}}`
    - `.header-action`：`wx:if="{{canEdit}}"` 包裹管理按钮
  - 副标题使用 `wx:if="{{todaySummaryText}}"` 条件渲染（设计文档 §3.1 首屏闪烁处理）
  - **完成标准**：页面可渲染，新结构出现，副标题区域暂不显示（因 todaySummaryText 为空）
  - _需求：FR-1 AC-1/2/3/4/5_

### 2. WXSS 样式替换

- [ ] **2.1 删除旧 top-bar 样式，新增 page-header 样式**
  - 在 `record.wxss` 中删除以下选择器（设计文档 §2.1）：
    - `.top-bar`（第 4-16 行）
    - `.page-title`（第 18-23 行）
    - `.top-bar-right`（第 25-28 行）
  - **保留** `.action-btn`、`.action-btn:active`、`.action-btn text`（第 30-50 行）
  - 在删除位置新增设计文档 §2.2 中定义的完整样式：
    - `.page-header`：flex 布局、padding `var(--spacing-lg) var(--spacing-md)`
    - `.header-icon`：80rpx × 80rpx、渐变背景、`var(--radius-lg)` 圆角、`flex-shrink: 0`
    - `.header-icon image`：48rpx × 48rpx
    - `.header-text`：`flex: 1`、column 方向、`min-width: 0`
    - `.header-title`：40rpx、600 字重、`var(--text-primary)`、`margin-bottom: 4rpx`
    - `.header-subtitle`：26rpx、`var(--text-secondary)`、`text-overflow: ellipsis`
    - `.header-action`：`flex-shrink: 0`、`margin-left: var(--spacing-sm)`
  - **完成标准**：页面视觉与发现页 page-header 一致（参照设计文档 §2.3 对照表逐项核对）；管理按钮在右侧正确显示
  - _需求：FR-1 AC-1/2/3、FR-3 AC-1/2/3、NFR-3_

### 3. JS 逻辑实现

- [x] **3.1 新增 data 字段和纯函数**
  - 在 `record.js` 的 `data` 中新增 `todaySummaryText: ''`（设计文档 §3.1）
  - 新增 `buildTodaySummaryText(todayRecords)` 方法（设计文档 §3.2）：
    - 空数组 → 返回 `'尚未添加今日记录'`
    - 有数据 → 按 喂养>睡眠>排便>体温>生长 顺序，仅展示 count>0 的类型
    - 拼接格式：`今日 N 条 · 喂养 X  睡眠 Y  排便 Z`
  - 新增 `_buildTodaySummaryFromRecords(records)` 方法（设计文档 §3.4 最终版）：
    - 检测 `dateRange` 是否包含今日
    - 不含今日 → 返回 `'宝宝的日常养护记录'`
    - 含今日 → 过滤 `startTime >= todayStart` 的记录，调用 `buildTodaySummaryText()`
  - **完成标准**：两个方法可被调用，纯函数无副作用
  - _需求：FR-2 AC-1/2/5_

- [ ] **3.2 修改 loadData() 合并 setData**
  - 在 `loadData()` 方法的 `refresh = true` 分支中（设计文档 §3.3）：
    - 在构建 `setData` 对象时，追加 `todaySummaryText: this._buildTodaySummaryFromRecords(records)`
    - 确保与 `records`、`loading`、`hasMore`、`page` 在同一次 `this.setData()` 中更新
  - 在 `loadData()` 的 `catch` 分支中，追加降级：`todaySummaryText: '宝宝的日常养护记录'`
  - **完成标准**：首次进入页面 → 副标题从无到有自然出现；下拉刷新 → 副标题正确更新；网络异常 → 显示降级文案
  - _需求：FR-2 AC-1/2/3、NFR-1（setData 合并、零额外请求）_

- [x] **3.3 修改 toggleManageMode() 切回刷新**
  - 修改 `toggleManageMode()` 方法（设计文档 §3.5）：
    - 退出管理模式时（`manageMode` 从 true 变 false）：先 `setData({ manageMode: false, selectedRecords: [] })`，再调 `this.loadData(true)`
    - 进入管理模式时：保持现有逻辑不变
  - **完成标准**：进入管理模式 → 批量删除若干记录 → 点击"取消" → 副标题数字正确减少
  - _需求：FR-2 AC-3、边界条件"管理模式切回"_

### 4. 验证

- [ ] **4.1 视觉对比验证**
  - 截图对比记录页和发现页 page-header：图标尺寸、渐变背景、标题字号/字重、副标题字号/颜色、整体间距
  - 验证管理按钮（canEdit 时）定位在右侧，与副标题不重叠
  - 验证 viewer 角色不显示管理按钮，排版无异常
  - 验证页面滚动时 header 随页面自然滚动（无 sticky）
  - _需求：FR-1 全部 AC、FR-3 AC-2、NFR-3_

- [ ] **4.2 功能回归验证**
  - 新增一条喂养记录 → 副标题数字 +1
  - 删除一条记录 → 副标题数字 -1
  - 切换日期筛选到"最近 7 天" → 副标题显示"宝宝的日常养护记录"；切回"全部时间" → 恢复真实数据
  - 首屏加载 → 副标题区域先不出现，数据加载后自然出现，无闪烁
  - 搜索/类型筛选/FAB 按钮/弹窗等全部功能正常不受影响
  - _需求：FR-2 全部 AC、NFR-1、NFR-2_

## 任务依赖关系

```
1.1 (WXML) ─┐
             ├─→ 3.1 (JS 纯函数) → 3.2 (loadData 合并) → 3.3 (toggleManageMode)
2.1 (WXSS) ─┘                                                      │
                                                                    ↓
                                                          4.1 + 4.2 (验证)
```

- 任务 1.1 和 2.1 可**并行**执行（分别改 wxml 和 wxss）
- 任务 3.1 依赖 1.1（WXML 中引用了 `todaySummaryText`）
- 任务 3.2 依赖 3.1（调用 `_buildTodaySummaryFromRecords`）
- 任务 3.3 依赖 3.2（`toggleManageMode` 调用 `loadData(true)` 时需要合并逻辑已就绪）
- 任务 4.1/4.2 在全部代码任务完成后执行
