# 需求文档 - 记录页顶部导航栏重设计（方案 B）

## 概述

对记录页（`pages/record/record`）的顶部导航栏进行重设计，将现有的"卡片式独立 top-bar"改为与发现页一致的"page-header"结构（图标 + 标题 + 动态副标题），并在副标题位置动态展示**今日速览数据**，让用户一进入页面就能掌握当日记录概况，无需翻页。

## 背景与动机

### 现状问题

| 问题 | 描述 |
|------|------|
| **信息密度低** | 顶部仅"记录"二字 + "管理"按钮，大量留白浪费空间 |
| **风格不统一** | 使用白色渐变卡片容器（background + border + radius + margin），与发现页的 `page-header` 完全不同 |
| **缺少上下文** | 用户进入记录页后不知道今天记了多少条，需要翻页才能看到洞察区 |
| **视觉断层** | `top-bar` 使用 sticky + 圆角卡片，与下方搜索栏/筛选区存在割裂感 |

### 各页面顶部风格现状对比

| 页面 | 头部组件 | 风格 |
|------|----------|------|
| **首页** | `.greeting-bar` | 问候语 + 宝宝昵称 + 日期 + 出生天数 |
| **记录页** | `.top-bar` | ❌ sticky 卡片式、渐变背景、圆角边框（待改造） |
| **发现页** | `.page-header` | ✅ flex 横排：左图标（80rpx 渐变圆角）+ 右标题/副标题 |
| **个人页** | `.user-card` | 卡片式头像 + 昵称 + 角色 |

首页和个人页因功能性质特殊（问候语/头像展示），风格差异可以接受。但**记录页**与**发现页**同属"工具型内页"，头部风格应该统一。

## 用户角色

- **家长（editor/admin）**：日常记录宝宝喂养、睡眠、排便、体温等数据的主要使用者。关注今日记录概况和快速添加操作
- **家庭成员（viewer）**：仅查看数据，不可编辑。同样需要快速了解今日概况

## 功能需求

### FR-1: 顶部结构改为 page-header 统一风格

**用户故事：** 作为用户，我希望记录页的顶部导航栏与发现页风格一致，以获得统一、专业的视觉体验。

**验收标准：**

1. When 用户进入记录页, the system shall 展示与发现页一致的 `page-header` 结构：左侧图标 + 右侧标题/副标题纵向排列
2. When 页面渲染完成, the system shall 在左侧显示一个 80rpx × 80rpx 的圆角图标容器，内含记录相关图标（`edit-gray.png` 或类似图标），使用与发现页一致的渐变背景
3. When 页面渲染完成, the system shall 在右侧上方显示主标题"记录"，字体大小 40rpx、字重 600，与发现页的 `header-title` 一致
4. When 用户拥有编辑权限（canEdit）且非管理模式, the system shall 在右侧最末端显示"管理"按钮，样式保持现有的 `action-btn` 胶囊按钮风格
5. When 用户处于管理模式, the system shall 将"管理"按钮文案变为"取消"

### FR-2: 动态今日速览副标题

**用户故事：** 作为家长，我希望一进入记录页就能看到今天的记录概况（记了多少条、各类型分布），以便快速了解当日状况。

**验收标准：**

1. When 页面加载完成且今日有记录, the system shall 在主标题下方显示动态副标题，格式为：`今日 N 条 · 喂养 X  睡眠 Y  排便 Z`
   - 仅显示有数据的类型（count > 0），跳过无数据的类型
   - 各类型之间用两个空格分隔，总条数与类型明细之间用 ` · ` 分隔
2. When 今日无任何记录, the system shall 显示副标题文案为"尚未添加今日记录"，以引导用户操作
3. When 数据刷新完成（下拉刷新、新增记录、删除记录后）, the system shall 自动重新计算并更新副标题文案
4. When 宝宝切换（如有多宝宝场景）, the system shall 重新计算新宝宝的今日速览数据
5. When 副标题文案显示, the system shall 使用与发现页 `header-subtitle` 一致的样式：字号 26rpx，颜色 `var(--text-secondary)`

### FR-3: 去除 top-bar 卡片样式

**用户故事：** 作为用户，我希望页面顶部不再有多余的卡片边框和间距，使页面更加紧凑、流畅。

**验收标准：**

1. When 记录页渲染, the system shall 移除原 `.top-bar` 的以下样式属性：
   - `background: linear-gradient(180deg, ...)` → 改为透明
   - `border-bottom: 1rpx solid ...` → 移除
   - `border-radius: var(--radius-lg)` → 移除
   - `margin: var(--spacing-sm) var(--spacing-md)` → 移除（改用 padding）
   - `position: sticky` → 移除（不再需要 sticky 定位）
2. When 页面滚动时, the system shall 不再出现 sticky 的顶部悬浮效果（header 随页面自然滚动）
3. When 新样式应用后, the system shall 使顶部与下方 insight-section 之间的过渡更加自然，无视觉断层

## 非功能需求

### NFR-1: 性能要求

- 今日速览数据的计算应复用现有的 `loadTodayStats()` 方法或类似逻辑，不额外发起独立的云数据库请求
- 副标题文案更新采用 `setData` 合并调用，不单独触发渲染
- 整体改造不应增加页面首屏渲染时间

### NFR-2: 兼容性

- 必须兼容管理模式（manageMode）切换：管理模式下 page-header 应正常隐藏或显示
- 必须兼容搜索关键词筛选、日期筛选、类型筛选等现有功能，不影响其正常运作
- 必须兼容 viewer 角色（无编辑权限）：不显示管理按钮

### NFR-3: 视觉一致性

- 新的 page-header 样式必须与发现页的 `.page-header`、`.header-icon`、`.header-text`、`.header-title`、`.header-subtitle` 在视觉上保持一致（字号、字重、间距、颜色、渐变方向等）
- 仍使用美拉德色彩系统（`--primary-color`、`--text-primary`、`--text-secondary`、`--bg-primary` 等 CSS 变量）

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 今日无记录 | 副标题显示"尚未添加今日记录" |
| 仅有 1 种类型的记录 | 副标题仍按格式显示，如 `今日 3 条 · 喂养 3` |
| 今日全部 5 种类型都有记录 | 副标题完整显示所有类型，文本可能较长但仍单行展示，超出部分截断 |
| 数据加载中（loading 态） | 副标题显示"加载中..."或保持上一次文案 |
| 当前无宝宝信息 | 整个 page-header 不显示（redirect 到创建宝宝页） |
| 网络异常导致今日数据加载失败 | 副标题降级显示静态文案"宝宝的日常养护记录" |
| 从管理模式切回正常模式 | 副标题恢复显示今日速览数据 |

## 影响范围

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `pages/record/record.wxml` | 结构变更 | `top-bar` → `page-header`（图标 + 标题 + 动态副标题 + 管理按钮） |
| `pages/record/record.wxss` | 样式重写 | 删除 `.top-bar` 卡片样式，新增 `.page-header` 透明样式（对齐发现页） |
| `pages/record/record.js` | 逻辑新增 | 新增 `todaySummaryText` 数据字段及计算逻辑，在数据加载/刷新后更新 |

**不涉及的文件/功能**：
- insight-section 组件（保持不变）
- search-filter-section（保持不变）
- filters 筛选标签（保持不变）
- FAB 悬浮按钮（保持不变）
- 所有弹窗组件（保持不变）
- 批量管理模式的功能逻辑（保持不变，仅视觉上适配新 header）
