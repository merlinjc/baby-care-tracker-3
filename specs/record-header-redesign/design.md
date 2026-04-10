# 设计文档 - 记录页顶部导航栏重设计（方案 B）

## 概述

将记录页现有的 `.top-bar` 卡片式结构替换为与发现页一致的 `.page-header` 结构（左侧图标 + 右侧标题/副标题），并在副标题位置动态显示今日速览摘要。改造仅涉及 3 个文件（wxml/wxss/js），不抽取公共组件，最小改动范围。

## 架构设计

### 改造前后对比

```
改造前（top-bar 卡片式）：
┌──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────┐  │
│ │ 记录                         [管理]      │  │ ← sticky 卡片, 渐变背景, 圆角边框
│ └──────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────┐  │
│ │ [insight-section 组件]                   │  │
│ └──────────────────────────────────────────┘  │

改造后（page-header 统一风格）：
┌──────────────────────────────────────────────┐
│ ┌──┐  记录                      [管理]       │ ← 透明背景, 无卡片, 自然流
│ │📝│  今日 5 条 · 喂养 3  睡眠 1  排便 1    │
│ └──┘                                         │
│ ┌──────────────────────────────────────────┐  │
│ │ [insight-section 组件]                   │  │
│ └──────────────────────────────────────────┘  │
```

### 发现页 page-header 参考结构

```
┌──────────────────────────────────────────────┐
│ ┌──┐  发现更多                               │
│ │🧭│  专业育儿工具，助您科学育儿             │
│ └──┘                                         │
└──────────────────────────────────────────────┘
```

记录页的 page-header 需要在此基础上增加右侧"管理/取消"按钮。

## 详细设计

### 1. WXML 结构变更

**删除旧结构**（record.wxml 第 2-12 行）：

```html
<!-- ❌ 删除 -->
<view class="top-bar">
  <view class="top-bar-left">
    <text class="page-title">记录</text>
  </view>
  <view class="top-bar-right">
    <view class="action-btn" bindtap="toggleManageMode" wx:if="{{canEdit}}">
      <text>{{manageMode ? '取消' : '管理'}}</text>
    </view>
  </view>
</view>
```

**替换为新结构**：

```html
<!-- ✅ 新 page-header 结构 -->
<view class="page-header">
  <view class="header-icon">
    <image src="/images/icons/edit-gray.png" mode="aspectFit"></image>
  </view>
  <view class="header-text">
    <text class="header-title">记录</text>
    <text class="header-subtitle">{{todaySummaryText}}</text>
  </view>
  <view class="header-action" wx:if="{{canEdit}}">
    <view class="action-btn" bindtap="toggleManageMode">
      <text>{{manageMode ? '取消' : '管理'}}</text>
    </view>
  </view>
</view>
```

**关键差异点**（相对于发现页）：
- 图标使用 `edit-gray.png`（记录页特有），发现页用 `compass.png`
- 副标题为动态数据 `{{todaySummaryText}}`，发现页为静态文案
- 新增 `.header-action` 区域放置"管理/取消"按钮（发现页无此区域）

**管理按钮显示策略**：
- 按钮在 `canEdit` 时**始终显示**，不因管理模式切换而隐藏/显示
- 通过文案动态切换实现状态表达：正常模式 → "管理"，管理模式 → "取消"
- 这与需求 FR-1 AC-4/AC-5 的意图一致：用户始终能看到操作入口，降低认知负担

### 2. WXSS 样式规格

#### 2.1 删除的旧样式

以下 `.top-bar` 相关样式全部删除（record.wxss 第 3-56 行）：

| 选择器 | 删除原因 |
|--------|----------|
| `.top-bar` | 整体替换为 `.page-header` |
| `.page-title` | 改用 `.header-title` |
| `.top-bar-right` | 改用 `.header-action` |

> **注意**：`.action-btn` 和 `.action-btn:active` 和 `.action-btn text` 保留不动，因为管理按钮样式继续沿用。

#### 2.2 新增的 page-header 样式

直接复用发现页的 `.page-header` 样式体系，保持 100% 视觉一致性。以下是完整的样式规格：

```css
/* ========== page-header（对齐发现页） ========== */

.page-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-md);
  /* 不设 margin-bottom，因为下方紧跟 insight-section 组件，
     由 insight-section 自身的 padding-top 控制间距 */
}

.header-icon {
  width: 80rpx;
  height: 80rpx;
  margin-right: var(--spacing-md);      /* 24rpx */
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, 
    rgba(212, 184, 150, 0.2) 0%, 
    rgba(184, 212, 184, 0.2) 100%
  );
  border-radius: var(--radius-lg);      /* 32rpx */
  flex-shrink: 0;
}

.header-icon image {
  width: 48rpx;
  height: 48rpx;
}

.header-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* 防止 flex 子元素溢出 */
}

.header-title {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary);           /* #3D3D3D */
  margin-bottom: 4rpx;
}

.header-subtitle {
  font-size: 26rpx;
  color: var(--text-secondary);         /* #666666 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 管理按钮区域 — 记录页独有 */
.header-action {
  flex-shrink: 0;
  margin-left: var(--spacing-sm);       /* 16rpx */
}
```

#### 2.3 样式对照表

| 属性 | 发现页 `.page-header` | 记录页 `.page-header`（新） | 说明 |
|------|----------------------|---------------------------|------|
| `display` | flex | flex | ✅ 一致 |
| `align-items` | center | center | ✅ 一致 |
| `padding` | `var(--spacing-lg) var(--spacing-md)` | `var(--spacing-lg) var(--spacing-md)` | ✅ 一致 = `32rpx 24rpx` |
| `margin-bottom` | `var(--spacing-md)` | 无 | ⚡ 差异：记录页下方紧跟 insight-section，间距由组件内 padding 控制 |
| `.header-icon` 尺寸 | 80rpx × 80rpx | 80rpx × 80rpx | ✅ 一致 |
| `.header-icon` 背景 | `rgba(212,184,150,0.2) → rgba(184,212,184,0.2)` | 同左 | ✅ 一致 |
| `.header-icon` 圆角 | `var(--radius-lg)` = 32rpx | 同左 | ✅ 一致 |
| `.header-icon image` | 48rpx | 48rpx | ✅ 一致 |
| `.header-title` 字号 | 40rpx | 40rpx | ✅ 一致 |
| `.header-title` 字重 | 600 | 600 | ✅ 一致 |
| `.header-subtitle` 字号 | 26rpx | 26rpx | ✅ 一致 |
| `.header-subtitle` 颜色 | `var(--text-secondary)` | `var(--text-secondary)` | ✅ 一致 |
| 管理按钮 | 无 | `.header-action` → `.action-btn` | ⚡ 记录页独有 |

### 3. JS 逻辑变更

#### 3.1 新增 data 字段

```javascript
data: {
  // ... 现有字段保持不变 ...
  
  // ⭐ 新增：今日速览摘要文案
  todaySummaryText: ''    // 默认空字符串，避免首屏闪烁
}
```

**首屏闪烁处理**：
- 默认值设为空字符串 `''`（而非静态文案），避免"静态文案 → 真实数据"的视觉跳变
- WXML 中副标题使用 `wx:if="{{todaySummaryText}}"` 条件渲染，空字符串时不显示副标题区域
- 数据加载完成后 `todaySummaryText` 被赋值，副标题自然出现，无闪烁

对应 WXML 调整：

```html
<text class="header-subtitle" wx:if="{{todaySummaryText}}">{{todaySummaryText}}</text>
```

#### 3.2 新增 `buildTodaySummaryText()` 方法

```javascript
/**
 * 构建今日速览副标题文案
 * 复用 loadTodayStats() 返回的数据 或 自行统计今日记录
 * 
 * @param {Array} todayRecords - 今日记录数组（可选，若不传则从现有数据过滤）
 * @returns {string} 副标题文案
 */
buildTodaySummaryText(todayRecords) {
  if (!todayRecords || todayRecords.length === 0) {
    return '尚未添加今日记录';
  }
  
  const total = todayRecords.length;
  
  // 按类型统计
  const typeCounts = {};
  todayRecords.forEach(record => {
    const type = record.recordType || record.type;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  // 类型中文映射（展示顺序：喂养 > 睡眠 > 排便 > 体温 > 生长）
  const typeLabels = [
    { key: 'feeding',     label: '喂养' },
    { key: 'sleep',       label: '睡眠' },
    { key: 'diaper',      label: '排便' },
    { key: 'temperature', label: '体温' },
    { key: 'growth',      label: '生长' }
  ];
  
  // 仅显示有数据的类型
  const parts = typeLabels
    .filter(t => typeCounts[t.key] > 0)
    .map(t => `${t.label} ${typeCounts[t.key]}`);
  
  // 拼接格式：今日 N 条 · 喂养 X  睡眠 Y  排便 Z
  return `今日 ${total} 条 · ${parts.join('  ')}`;
}
```

#### 3.3 调用时机与 setData 合并策略

在以下已有流程中加入副标题更新：

| 调用时机 | 触发方法 | 说明 |
|----------|----------|------|
| 页面首次加载 | `loadData(refresh=true)` 成功后 | 初始渲染 |
| 下拉刷新 | `onPullDownRefresh()` → `loadData(true)` 后 | 刷新数据 |
| 新增记录 | `onRecordCreated()` → `loadData(true)` 后 | 新记录后更新 |
| 删除记录 | `deleteRecord()` → `loadData(true)` 后 | 删除后更新 |
| 批量删除 | `batchDelete()` → `loadData(true)` 后 | 批量删除后更新 |
| 宝宝切换 | `init()` → `loadData(true)` 后 | 切换宝宝后更新 |
| **管理模式切回** | `toggleManageMode()` 退出管理模式时 | 管理期间可能有删除，需刷新 |

**⚠️ setData 合并策略（修复 NFR-1 性能要求）**：

`buildTodaySummaryText()` 是纯函数，仅返回字符串，**不调用 `setData`**。由调用方将返回值合并到同一次 `setData` 中，避免额外渲染。

**实现方案**：在 `loadData()` 的 `refresh = true` 分支中，将 `todaySummaryText` 合并到已有的 `setData` 调用：

```javascript
// loadData() 中的修改（伪代码）
async loadData(refresh = false) {
  // ... 现有逻辑 ...
  
  try {
    const records = await recordService.getRecords(babyId, options);
    
    // 构建 setData 对象
    const updateData = {
      records: refresh ? records : [...this.data.records, ...records],
      loading: false,
      hasMore: records.length === pageSize,
      page: page + 1
    };
    
    // ⭐ 合并今日速览到同一次 setData（仅在 refresh 时计算）
    if (refresh) {
      updateData.todaySummaryText = this._buildTodaySummaryFromRecords(records);
    }
    
    // 单次 setData，避免额外渲染
    this.setData(updateData);
    
    // ... 后续逻辑 ...
  } catch (error) {
    // ...
  }
}

/**
 * 从已加载的记录数组中过滤今日数据并构建摘要文案
 * 纯函数，不调用 setData，不发起网络请求
 * 
 * @param {Array} records - loadData() 返回的记录数组
 * @returns {string} 副标题文案
 */
_buildTodaySummaryFromRecords(records) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const todayRecords = records.filter(r => {
    const timestamp = r.startTime || r.timestamp || r.createTime;
    return timestamp >= todayStart;
  });
  
  return this.buildTodaySummaryText(todayRecords);
}
```

**关键优化**：
- `todaySummaryText` 与 `records`、`loading` 等字段合并到同一次 `setData`，满足 NFR-1 "不单独触发渲染"的要求
- `_buildTodaySummaryFromRecords()` 是纯计算函数，零副作用、零网络请求

#### 3.4 日期筛选兼容方案

当用户选择了日期筛选（如"最近 7 天"且范围不含今日）时，`loadData()` 返回的 records 数组可能不包含今日记录。

**方案：直接使用静态降级文案，不额外发起网络请求**

```javascript
_buildTodaySummaryFromRecords(records) {
  const { dateRange } = this.data;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // 判断当前筛选范围是否包含今日
  const isDateFilterActive = dateRange.start !== null;
  const isFilterIncludesToday = !isDateFilterActive || 
    (dateRange.start <= now.getTime() && (!dateRange.end || dateRange.end >= todayStart));
  
  if (isDateFilterActive && !isFilterIncludesToday) {
    // 筛选范围不含今日 → 直接降级为静态文案（不发起额外请求）
    return '宝宝的日常养护记录';
  }
  
  // 筛选包含今日（或无日期筛选）→ 从已加载数据过滤
  const todayRecords = records.filter(r => {
    const timestamp = r.startTime || r.timestamp || r.createTime;
    return timestamp >= todayStart;
  });
  
  return this.buildTodaySummaryText(todayRecords);
}
```

**为什么不在筛选不含今日时发起额外请求？**

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **A. 异步 get 查询今日记录** | 数据准确 | 违反 NFR-1"不额外发起独立请求"；全量 get(limit=200) 开销不小 | ❌ 不采用 |
| **B. 静态降级文案** | 零请求、零延迟、完全满足 NFR-1 | 筛选非今日时副标题不显示今日统计 | ✅ 采用 |

**合理性**：用户主动选择了非今日的日期范围，此时关注的是历史数据而非今日速览。显示静态文案是合理的 UX 降级，不影响核心体验。当用户切回"全部时间"或"今天"筛选时，副标题会自动恢复为真实数据。

#### 3.5 管理模式切回触发更新

```javascript
toggleManageMode() {
  const manageMode = !this.data.manageMode;
  
  if (!manageMode) {
    // 从管理模式切回正常模式 → 刷新数据（管理期间可能有删除操作）
    this.setData({ manageMode, selectedRecords: [] });
    this.loadData(true);  // loadData 内部会合并更新 todaySummaryText
    return;
  }
  
  this.setData({
    manageMode,
    selectedRecords: []
  });
}
```

**为什么切回时需要 `loadData(true)`？**
- 管理模式下用户可能执行了批量删除，数据已变化
- `loadData(true)` 会重新加载记录并在同一次 `setData` 中更新 `todaySummaryText`
- 如果管理模式下无任何操作，`loadData` 的 30s 节流机制会避免重复请求

### 4. 边界条件处理

| 场景 | `todaySummaryText` 值 | 实现方式 |
|------|----------------------|----------|
| 今日有记录 | `今日 5 条 · 喂养 3  睡眠 1  排便 1` | `buildTodaySummaryText()` 正常计算 |
| 今日无记录 | `尚未添加今日记录` | `buildTodaySummaryText([])` 返回 |
| 仅 1 种类型 | `今日 3 条 · 喂养 3` | 仅显示有数据的类型 |
| 全部 5 种类型 | `今日 12 条 · 喂养 3  睡眠 2  排便 3  体温 2  生长 2` | 单行展示，`text-overflow: ellipsis` 截断 |
| 数据加载中（首屏） | 副标题不显示（`todaySummaryText` 为空字符串） | `wx:if="{{todaySummaryText}}"` 条件渲染，无闪烁 |
| 数据加载中（刷新） | 保持上一次文案 | 新文案在 `loadData` 的 setData 中一次性更新 |
| 网络异常 | `宝宝的日常养护记录` | catch 降级 |
| 日期筛选不含今日 | `宝宝的日常养护记录` | 静态降级，不发额外请求（见 §3.4） |
| 管理模式下 | 正常显示副标题 | page-header 在管理模式下**不隐藏**，管理按钮文案变为"取消" |
| 管理模式切回 | 恢复为最新今日速览 | `toggleManageMode()` 退出时调 `loadData(true)` 刷新（见 §3.5） |
| 当前无宝宝 | 页面直接 redirect，不渲染 header | 现有 `init()` 逻辑已处理 |

### 5. 视觉还原标注

```
┌─ page-header ──────────────────────────────────────────┐
│ padding: 32rpx 24rpx                                   │
│                                                        │
│  ┌──────────┐  ┌──────────────────────┐  ┌──────────┐ │
│  │ 80 × 80  │  │ 记录      40rpx/600 │  │ [管理]   │ │
│  │ 渐变圆角 │  │ 今日 5 条  26rpx    │  │ action   │ │
│  │ 32rpx    │  │  · 喂养 3  睡眠 1   │  │ -btn     │ │
│  └──────────┘  └──────────────────────┘  └──────────┘ │
│  margin-right     flex: 1                flex-shrink:0 │
│  = 24rpx         min-width: 0           margin-left    │
│                                          = 16rpx       │
└────────────────────────────────────────────────────────┘
```

**图标容器**：
- 尺寸：80rpx × 80rpx
- 背景：`linear-gradient(135deg, rgba(212,184,150,0.2) 0%, rgba(184,212,184,0.2) 100%)`
- 圆角：`var(--radius-lg)` = 32rpx
- 图标：`edit-gray.png` 48rpx × 48rpx

**标题**：
- 字号：40rpx
- 字重：600
- 颜色：`var(--text-primary)` = #3D3D3D
- 行间距：`margin-bottom: 4rpx`

**副标题**：
- 字号：26rpx
- 颜色：`var(--text-secondary)` = #666666
- 溢出：`text-overflow: ellipsis` + `white-space: nowrap`

**管理按钮**：
- 沿用现有 `.action-btn` 样式（胶囊形、26rpx 文字、#666 色）
- 无需修改

## 技术选型决策

### 为什么不抽取公共组件？

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **A. 公共 page-header 组件** | 复用性高、后续维护统一 | 需新建 component、两个页面同时改造、增加测试范围 | ❌ 不采用 |
| **B. 直接复制样式到记录页** | 改动范围小、不影响发现页、风险低 | 样式重复（约 40 行 CSS） | ✅ 采用 |

**理由**：当前仅有 2 个页面使用 page-header（发现页 + 记录页），且两者在结构上有细微差异（管理按钮），抽取组件的 ROI 不高。优先保证改动范围最小、风险可控。后续如有第三个页面需要相同结构，再重构为公共组件。

### 为什么不额外请求今日数据？

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **A. 额外调 `loadTodayStats()`** | 数据准确 | 增加 1 次云数据库请求、影响首屏时间 | ❌ 不采用 |
| **B. 复用 `loadData()` 的 records** | 零额外请求、零延迟 | 筛选状态下可能不含今日全量数据 | ✅ 采用（带降级） |

**降级方案**：当日期筛选范围不包含今日时，直接显示静态文案"宝宝的日常养护记录"，不发起任何额外网络请求。用户主动选择非今日范围时关注的是历史数据，此降级合理。

## 影响分析

### 文件变更清单

| 文件 | 变更类型 | 行数估算 | 说明 |
|------|----------|----------|------|
| `record.wxml` | 替换 | −10 / +13 | top-bar → page-header，副标题增加 `wx:if` 条件渲染 |
| `record.wxss` | 替换 + 新增 | −14 / +42 | 删除 .top-bar 系列（保留 .action-btn）, 新增 .page-header 系列 |
| `record.js` | 新增 + 小改 | +45 | 新增 todaySummaryText / buildTodaySummaryText / _buildTodaySummaryFromRecords；修改 loadData() 合并 setData；修改 toggleManageMode() 切回时刷新 |

### 不受影响的功能

- ✅ insight-section 洞察组件
- ✅ 搜索栏 / 日期筛选 / 类型筛选
- ✅ 记录列表 / 时间线组件
- ✅ FAB 悬浮添加按钮
- ✅ 所有弹窗（喂养/睡眠/排便/体温/报告）
- ✅ 批量管理模式（选择/删除功能）
- ✅ 分享功能

### 潜在风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| `.top-bar` 删除后其他页面受影响 | 极低 | 低 | `.top-bar` 仅在 record.wxss 中定义，为页面私有样式 |
| 副标题文案过长截断 | 低 | 低 | CSS `text-overflow: ellipsis` 兜底，最长场景约 35 字符 |
| 日期筛选"非今日"时副标题降级 | 低 | 极低 | 用户此时关注历史数据而非今日，显示静态文案合理 |
| 管理模式切回多触发一次 loadData | 低 | 极低 | 已有 30s 节流机制兜底，且管理模式退出时用户预期数据刷新 |

## 测试策略

### 视觉验证

1. **对比发现页**：截图对比记录页和发现页的 page-header，确认字号/字重/间距/颜色/图标尺寸一致
2. **长文案**：模拟今日 5 种类型均有记录的场景，验证截断效果
3. **空状态**：清空今日记录，验证"尚未添加今日记录"文案
4. **管理模式**：进入管理模式，验证"取消"按钮定位正确

### 功能验证

1. **新增记录**：添加一条喂养记录 → 副标题数字 +1
2. **删除记录**：删除一条记录 → 副标题数字 -1
3. **批量删除**：批量删除 → 副标题正确更新
4. **日期筛选**：切换到"最近 7 天" → 副标题显示静态降级文案；切回"全部时间" → 恢复真实数据
5. **下拉刷新**：下拉 → 副标题重新计算
6. **管理模式切回**：进入管理模式 → 删除若干记录 → 点击"取消"退出 → 副标题数字正确减少
7. **首屏无闪烁**：首次进入页面 → 副标题区域不出现 → 数据加载完毕后副标题自然出现，无文案跳变

### 兼容验证

1. **viewer 角色**：不显示管理按钮，header 排版无异常
2. **无宝宝**：直接跳转创建页，不渲染 header
3. **弱网**：模拟网络异常，验证降级文案
