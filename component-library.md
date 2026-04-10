# Baby Care Tracker 组件库文档

> **版本**: v3.1 | **更新日期**: 2026-04-08

---

## 组件总览

| 组件 | 路径 | 类型 | 全局注册 |
|------|------|------|---------|
| feeding-popup | `/components/feeding-popup/` | 记录弹窗 | 否 |
| sleep-popup | `/components/sleep-popup/` | 记录弹窗 | 否 |
| diaper-popup | `/components/diaper-popup/` | 记录弹窗 | 否 |
| temperature-popup | `/components/temperature-popup/` | 记录弹窗 | 否 |
| growth-popup | `/components/growth-popup/` | 记录弹窗 | 否 |
| timeline | `/components/timeline/` | 展示组件 | 否 |
| insight-section | `/components/insight-section/` | 展示组件 | 否 |
| report-popup | `/components/report-popup/` | 功能弹窗 | 否 |
| export-popup | `/components/export-popup/` | 功能弹窗 | 否 |
| baby-card | `/components/baby-card/` | 展示组件 | 否 |
| baby-edit-popup | `/components/baby-edit-popup/` | 编辑弹窗 | 否 |
| error-state | `/components/error-state/` | 状态组件 | **是** |
| icon | `/components/icon/` | 基础组件 | 否 |
| easter-egg-popup | `/components/easter-egg-popup/` | 彩蛋弹窗 | 否 |
| easter-egg-toast | `/components/easter-egg-toast/` | 彩蛋提示 | 否 |

---

## 记录弹窗组件（5个）

所有记录弹窗共享以下特征：
- 使用 `swipe-close` Behavior（下滑手势关闭）
- 底部弹出式布局（`slideUp` 动画）
- 统一的 `.popup-mask → .popup-container → .popup-header → .popup-content → .popup-footer` 结构
- 安全区适配：`padding-bottom: calc(24rpx + env(safe-area-inset-bottom))`

### feeding-popup 喂养记录弹窗

**属性**: `show`, `babyId`
**事件**: `close`, `created`
**功能**: 支持母乳（左/右/双侧选择）、配方奶（快捷用量累加）、辅食三种类型，含编辑模式

### sleep-popup 睡眠记录弹窗

**属性**: `show`, `babyId`
**事件**: `close`, `created`
**功能**: 支持夜间/午睡类型选择，含睡眠计时器功能

### diaper-popup 排便记录弹窗

**属性**: `show`, `babyId`
**事件**: `close`, `created`
**功能**: 类型（小便/大便/混合）、质地、颜色选择

### temperature-popup 体温记录弹窗

**属性**: `show`, `babyId`
**事件**: `close`, `created`
**功能**: 体温值输入 + 测量方式选择

### growth-popup 生长记录弹窗

**属性**: `show`, `baby-id`
**事件**: `close`, `saved`
**功能**: 身高/体重/头围输入，含日期选择

---

## 展示组件

### timeline 时间线组件

**属性**: `records`, `swipe-enabled`, `manageMode`, `selectedRecords`
**事件**: `swipeEdit`, `swipeDelete`, `recordTap`, `recordSelect`, `recordLongPress`
**功能**: 按日期分组展示记录列表，支持左滑编辑/删除，批量选择模式

### insight-section 数据洞察区

**属性**: `babyId`
**事件**: `showReport`
**功能**: 本周趋势展示（喂养/睡眠/排便/体温），含范围条、状态标签、智能提示、骨架屏

### baby-card 宝宝信息卡片

**属性**: `baby`
**功能**: 展示宝宝头像、姓名、年龄

### error-state 错误状态组件

**属性**: `message`
**事件**: `retry`
**功能**: 全局注册，通用错误展示 + 重试按钮

### icon 图标组件

**属性**: `type` (functional/milestone/status/navigation), `name`, `size` (small/medium/large/xlarge/custom), `color`
**功能**: 统一图标渲染，通过 `icon-config.js` 解析图标路径

---

## 功能弹窗

### report-popup 成长报告弹窗

**属性**: `show`, `babyId`
**事件**: `close`, `shareready`
**功能**: 成绩单式成长报告（周报/月报），包含综合评分、四维指标、密度条、生长数据、疫苗进度、里程碑、成就、AI建议，支持 Canvas 绘制分享图

### export-popup 导出弹窗

**属性**: `show`
**事件**: `close`
**功能**: JSON 格式数据导出，支持分享

---

## 共享 Behavior

### swipe-close

**路径**: `/behaviors/swipe-close.js`
**数据**: `popupTranslateY`
**方法**: `onTouchStart`, `onTouchMove`, `onTouchEnd`
**特性**:
- 阻力效果 `resistance=0.5`
- 最大滑动 `maxSlide=300`
- 滑动阈值 100px 触发关闭
- 16ms 节流 setData（约 60fps）

---

*文档维护：新增或修改组件时同步更新此文档。*
