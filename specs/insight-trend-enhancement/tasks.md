# 实施计划 - 本周趋势智能增强（Insight Trend Enhancement）

> 版本：v1.0 | 日期：2026-04-07 | 状态：✅ 已完成（2026-04-07）
> 需求文档：`specs/insight-trend-enhancement/requirements.md` v1.1
> 设计文档：`specs/insight-trend-enhancement/design.md` v1.1

---

## 实施概览

- **预计总工时**：4-5 小时
- **涉及文件**：4 个（`trendService.js`、`insight-section.js`、`insight-section.wxml`、`insight-section.wxss`）
- **新增代码量**：约 350 行
- **风险等级**：低（增量扩展，不修改现有逻辑）

### 关键里程碑

| 里程碑 | 完成标志 | 预计时间 |
|--------|----------|----------|
| M1：数据层就绪 | trendService 新增方法可独立运行 | 1.5h |
| M2：组件逻辑就绪 | insight-section.js 增强数据计算完成 | 1h |
| M3：UI 呈现完成 | WXML + WXSS 重构完成，视觉效果符合设计 | 1.5h |
| M4：验收通过 | 所有 FR 验收标准通过 + 边界条件无异常 | 0.5h |

### 实施依赖关系

```
任务 1（trendService 常量+方法）
  │
  ├──→ 任务 2（insight-section.js 逻辑增强）
  │       │
  │       ├──→ 任务 3（WXML 模板重构）
  │       │       │
  │       │       └──→ 任务 4（WXSS 样式重构）
  │       │
  │       └──→ 任务 5（边界条件验证+集成测试）
  │
  └──→ 可独立单元测试验证
```

---

## 任务列表

### 1. trendService.js — 新增参考范围常量和静态方法

**预计耗时**：1.5 小时  
**文件**：`miniprogram/services/trendService.js`  
**改动类型**：增量扩展（不修改任何现有代码）

- [ ] **1.1** 在文件头部（`const RecordService = require('./record');` 之后）新增常量定义
  - `REFERENCE_RANGES` — 月龄参考范围配置对象（喂养/睡眠/排便，共 17 个分段）
  - `TREND_STATUS` — 趋势状态枚举（6 个值）
  - `TEMP_STATUS` — 体温状态枚举（4 个值）
  - `DEVIATION_THRESHOLD` — 偏离阈值常量 `0.30`
  - `CHANGE_THRESHOLD` — 环比变化颜色阈值 `{ MINOR: 10, MODERATE: 30 }`
  - `STATUS_DISPLAY` — 状态标签视觉映射（8 个状态）
  - `TIP_MESSAGES` — 智能提示语映射（4 个维度 × 5-6 个状态）
  - _设计文档：§3.1 ~ §3.5_
  - _需求：FR-1, FR-2, FR-4_

- [ ] **1.2** 在 `TrendService` 类末尾（`needsAttention()` 方法之后、`module.exports` 之前）新增 5 个静态方法
  - `static getReferenceRange(dimension, ageMonths)` — 月龄参考范围查找
  - `static calculateStatus(value, range, dimension, extra)` — 智能状态计算
  - `static calculateRangeBarPosition(value, range)` — 范围条定位计算
  - `static generateTip(dimension, status)` — 智能提示语生成
  - `static getStatusDisplay(status)` — 状态视觉映射查询
  - _设计文档：§4.1 ~ §4.4_
  - _需求：FR-1, FR-2, FR-3, FR-4_

- [ ] **1.3** 验证点
  - `getReferenceRange('feeding', 0)` → `{ min:8, max:12, label:'0-1月' }` ✓
  - `getReferenceRange('sleep', 5)` → `{ min:12, max:16, label:'3-6月' }` ✓
  - `getReferenceRange('temperature', 6)` → `null` ✓
  - `calculateStatus(8, {min:6,max:10}, 'feeding')` → `'normal'` ✓
  - `calculateStatus(3, {min:6,max:10}, 'feeding')` → `'veryLow'` ✓
  - `calculateRangeBarPosition(8, {min:6,max:10})` → `{ position:50, zone:'normal' }` ✓
  - `generateTip('feeding', 'normal')` → `'喂养规律，保持即可 👍'` ✓

---

### 2. insight-section.js — 组件逻辑增强

**预计耗时**：1 小时  
**文件**：`miniprogram/components/insight-section/insight-section.js`  
**改动类型**：增量改造  
**依赖**：任务 1 完成

- [ ] **2.1** 新增依赖引入
  - 在文件头部添加 `const StorageUtil = require('../../utils/storage');`
  - 在文件头部添加 `const { calculateAgeMonths } = require('../../utils/date');`
  - _设计文档：§5.1 新增依赖_

- [ ] **2.2** 扩展 `data` 初始值
  - 新增 `ageMonths: null`
  - 新增 `hasReference: false`
  - 新增 `feedingEnhanced: { status:'', statusText:'', statusClass:'', reference:null, referenceText:'', barPosition:50, barZone:'normal', tip:'', changeClass:'' }`
  - 新增 `sleepEnhanced`（同上结构）
  - 新增 `diaperEnhanced`（同上结构）
  - 新增 `temperatureEnhanced: { status:'', statusText:'', statusClass:'', tip:'' }`
  - _设计文档：§5.1 新增 data 字段_
  - _需求：FR-1, FR-2, FR-3, FR-4, FR-5_

- [ ] **2.3** 改造 `loadTrendData()` 方法
  - 在现有 `trendService.getTrendData()` 调用成功后，追加增强计算逻辑
  - 获取月龄：`StorageUtil.getCurrentBaby()` → `calculateAgeMonths(baby.birthDate)`
  - 调用 `_enhanceDimension()` 增强喂养/睡眠/排便三维度
  - 调用 `_enhanceTemperature()` 增强体温维度
  - 在 `setData` 中合并原有数据和增强数据
  - _设计文档：§5.1 loadTrendData 改造_
  - _需求：FR-1, FR-2, FR-3, FR-4, FR-5_

- [ ] **2.4** 新增 3 个私有方法
  - `_enhanceDimension(dimension, trend, ageMonths)` — 通用维度增强
  - `_enhanceTemperature(tempData)` — 体温专用增强
  - `_getChangeClass(changePercent, isUp, status)` — 环比变化 CSS class 计算
  - _设计文档：§5.1 新增私有方法_
  - _需求：FR-1, FR-4, FR-6_

---

### 3. insight-section.wxml — 模板重构

**预计耗时**：0.5 小时  
**文件**：`miniprogram/components/insight-section/insight-section.wxml`  
**改动类型**：全面重构卡片内部结构  
**依赖**：任务 2 完成（需要增强数据字段）

- [ ] **3.1** 重构趋势卡片为 4 行信息架构
  - 保持 `.insight-header` 和 `.view-report-link` 不变
  - 添加骨架屏加载态：`wx:if="{{loading}}"` 时渲染 4 个 `.trend-item-skeleton`
  - 喂养/睡眠/排便卡片：第一行（图标+名称+状态标签）→ 第二行（范围条）→ 第三行（日均+参考+环比）→ 第四行（智能提示）
  - 体温卡片：第一行（图标+名称+状态标签）→ 第三行（异常次数+最近体温）→ 第四行（智能提示）；无范围条
  - 移除现有的 `.attention` class 条件和 `.attention-tag` 元素
  - 环比变化：增加 `wx:elif` 条件，上周为 0 且本周有数据时显示"新"标签
  - _设计文档：§5.2_
  - _需求：FR-1, FR-2, FR-3, FR-4, FR-5, FR-6_

---

### 4. insight-section.wxss — 样式重构

**预计耗时**：1 小时  
**文件**：`miniprogram/components/insight-section/insight-section.wxss`  
**改动类型**：移除旧样式 + 新增增强样式  
**依赖**：任务 3 完成（需要与新 WXML 结构匹配）

- [ ] **4.1** 移除旧样式
  - 删除 `.trend-item.attention`（边框+背景变化）
  - 删除 `.trend-header`（被 `.trend-row-header` 替代）
  - 删除 `.attention-tag`（被 `.status-tag` 替代）
  - 删除 `.trend-detail`（被 `.trend-row-data` 替代）
  - 调整 `.trend-change`（从 28rpx/600 改为 20rpx/500，作为辅助信息）
  - _需求：FR-5（信息架构重组）_

- [ ] **4.2** 新增状态标签样式
  - `.status-tag` 基础样式（胶囊形状，22rpx，`--radius-sm` 圆角）
  - `.status-normal` / `.status-low` / `.status-high` / `.status-veryLow` / `.status-veryHigh` / `.status-noData` / `.status-attention` / `.status-alert` — 8 个状态色
  - _设计文档：§5.3 状态标签胶囊_
  - _需求：FR-1_

- [ ] **4.3** 新增范围条样式
  - `.range-bar-container` — 容器（上下 padding）
  - `.range-bar` — 条形背景（`rgba(212, 165, 116, 0.12)`，8rpx 高，4rpx 圆角）
  - `.range-bar-normal` — 正常区段（绿色 30% 透明度，占 60% 宽度居中）
  - `.range-bar-dot` + `.dot-normal` / `.dot-left` / `.dot-right` — 定位圆点（12rpx）
  - _设计文档：§5.3 迷你范围条_
  - _需求：FR-3_

- [ ] **4.4** 新增数据行和提示行样式
  - `.trend-row-data` — flex 行（baseline 对齐，不换行）
  - `.trend-avg` — 日均值（24rpx，主色，font-weight 500）
  - `.trend-ref` — 参考范围（22rpx，hint 色，可截断）
  - `.trend-tip` — 智能提示（22rpx，secondary 色，单行截断）
  - _设计文档：§5.3 第三行/第四行_
  - _需求：FR-2, FR-4_

- [ ] **4.5** 新增环比变化和骨架屏样式
  - `.change-minor` / `.change-up` / `.change-down` / `.change-danger` / `.change-new` — 5 种环比色
  - `.trend-item-skeleton` + `.skeleton-line` + `@keyframes shimmer` — 骨架屏动画
  - 更新 `.trend-item` 为 flex column 布局，`gap: var(--spacing-xs)`
  - _设计文档：§5.3 环比变化颜色 + 骨架屏_
  - _需求：FR-5, FR-6_

---

### 5. 集成验证与边界条件测试

**预计耗时**：0.5 小时  
**依赖**：任务 1-4 全部完成

- [ ] **5.1** 正常场景验证
  - 有出生日期的新生儿（0-1 月）：检查喂养/睡眠/排便均显示状态标签 + 范围条 + 参考范围 + 提示语
  - 6 月龄婴儿：检查参考范围自动切换到 6-12 月段
  - 体温卡片：确认无范围条、无参考范围文字，仅有状态标签和提示语
  - _需求：FR-1 ~ FR-6 全部验收标准_

- [ ] **5.2** 边界条件验证
  - **无出生日期**：确认状态标签/范围条/参考范围均不显示，退化为原有展示
  - **本周和上周均无数据**：确认显示灰色「无数据」标签 + 引导提示语
  - **上周无数据本周有数据**：确认显示蓝色「新」标签代替百分比
  - **月龄超过 36 个月**：确认使用 24 月+ 参考范围，不报错
  - **日均值恰好等于边界值**：确认判定为「正常」
  - _需求：边界条件和异常处理表_

- [ ] **5.3** 视觉与性能验证
  - 在 320px ~ 414px 屏幕宽度范围确认 2×2 网格不溢出
  - 确认所有颜色复用 `app.wxss` 现有 CSS 变量
  - 确认骨架屏在 loading 时正确显示 shimmer 动画
  - 确认折叠/展开功能正常
  - 确认"查看详细报告"功能不受影响
  - _需求：NFR-1 ~ NFR-5_

---

## 风险评估

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| `StorageUtil.getCurrentBaby()` 返回 null | 中 | 低 | 已有 `baby?.birthDate` 安全判断，退化为无参考范围模式 |
| WXML `wx:elif` 语法兼容性 | 低 | 中 | 需求文档要求基础库 ≥2.20.0，`wx:elif` 从 2.9.5 起支持 |
| 范围条定位在极端值时溢出 | 低 | 低 | 算法已含 `Math.max(2)` / `Math.min(98)` 安全边界 |
| 骨架屏 CSS 动画在低端机型卡顿 | 低 | 低 | 仅使用 `background-position` 动画，GPU 加速，性能影响极小 |

---

## 回归验证清单

完成所有任务后，需额外确认以下模块不受影响：

- [ ] `report-popup` 组件 — "查看详细报告"弹窗功能正常
- [ ] `record.js` 页面 — 管理模式切换不影响趋势组件
- [ ] 首页 AI 洞察卡片 — 独立模块，数据来源不同
- [ ] `trendService.js` 现有方法 — `getTrendData()`、`calculateChange()` 等返回值不变

---

*文档版本：v1.0*  
*创建日期：2026-04-07*  
*状态：待确认*
