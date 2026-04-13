# 设计文档 - UI 重设计 v4.0（UI Redesign v4）

> 版本：v1.0 | 日期：2026-04-13 | 状态：已确认

---

## 一、设计规格引用

本次迭代的核心设计规格已在以下两份文档中完整定义：

| 文档 | 内容 | 路径 |
|------|------|------|
| **设计总纲** | 设计原则、色彩升级、首页/记录页/发现页/我的页 4 个 Tab 核心重设计、动画系统、组件变更清单 | `design-spec.md` |
| **逐页细化规格** | 全部 18 页面 + 15 组件的 v3.x→v4.0 逐项对比表、全局弹窗/表单/空状态/页头统一规范、暗色模式检查矩阵 | `detailed-spec.md` |

**本文档定位**：补充设计规格文档中未覆盖的**实施层面**细节 —— 文件修改方案、CSS 变更 diff、WXML 结构改造策略。

---

## 二、全局基础层改造

### 2.1 app.wxss 新增变量

在 `page {}` 选择器末尾追加（不修改任何现有变量）：

```css
/* v4.0 新增变量 */
--growth-color: #7BA9C9;
--surface-elevated: rgba(212, 184, 150, 0.06);
--elevation-1: 0 2rpx 8rpx rgba(139, 123, 107, 0.04);
--elevation-2: 0 4rpx 16rpx rgba(139, 123, 107, 0.06);
--radius-pill: 999rpx;
--radius-xl: 40rpx;
```

在 `.dark-mode` 选择器末尾追加：

```css
--growth-color: #5C8CA8;
--surface-elevated: rgba(212, 184, 150, 0.04);
--elevation-1: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
--elevation-2: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
```

### 2.2 app.wxss 新增动画

```css
@keyframes progressGrow {
  from { width: 0; }
  to { width: var(--progress-target); }
}

@keyframes recPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@keyframes capsuleTransition {
  0% { opacity: 0.7; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2.3 styles/popup.wxss 修改清单

| 选择器 | 属性 | v3.x 值 | v4.0 值 |
|--------|------|---------|---------|
| `.popup-container` | `border-radius` | `var(--radius-lg) var(--radius-lg) 0 0` | `var(--radius-xl) var(--radius-xl) 0 0` |
| `.popup-container` | `max-height` | `80vh` | `85vh` |
| `.popup-content` | `height` | `calc(80vh - 180rpx)` | `calc(85vh - 180rpx)` |
| `.swipe-indicator` | `width` | `80rpx` | `48rpx` |
| `.swipe-indicator` | `height` | `8rpx` | `4rpx` |
| `.swipe-indicator` | `border-radius` | `4rpx` | `var(--radius-pill)` |
| `.popup-icon` | `width`/`height` | `64rpx` | `56rpx` |
| `.popup-title` | `font-size` | `36rpx` | `32rpx` |
| `.popup-close` | — | 文字 `×`(48rpx) | 改为 `<image src="x-mark.png" />` 24rpx |
| `.submit-btn` | `height` | `88rpx` | `92rpx` |
| `.submit-btn` | `border-radius` | `var(--radius-lg)` | `var(--radius-md)` |

### 2.4 styles/form.wxss 修改

| 选择器 | 属性 | v3.x 值 | v4.0 值 |
|--------|------|---------|---------|
| `.submit-btn` | `height` | `96rpx` | `92rpx` |

---

## 三、首页改造策略

### 3.1 WXML 结构改造

**去掉的元素：**
- `<baby-card>` 组件引用（L47-50）
- 独立的 `.baby-switch` 区块（L74-92）

**改造的元素：**
- `.greeting-bar`（L24-34）→ 合并多宝切换头像组到右侧
- `.status-banner`（L53-72）→ 改为胶囊样式 `.status-capsule`，新增 `rec-dot` 录制指示灯
- `.todo-section`（L95-134）→ 从横向 `scroll-view` 改为竖向 `.todo-list`
- `.overview-card .stats-grid`（L137-208）→ 数字加大 + 新增进度条
- `.insight-card`（L275-296）→ 改为一行式收起态 + 展开态

**`onStatTap` 交互改变：**

```javascript
// v3.x: 跳转筛选
onStatTap(e) {
  const type = e.currentTarget.dataset.type;
  wx.switchTab({ url: `/pages/record/record?type=${type}` });
}

// v4.0: 直接打开弹窗
onStatTap(e) {
  const type = e.currentTarget.dataset.type;
  const popupMap = {
    feeding: 'showFeedingPopup',
    sleep: 'showSleepPopup',
    diaper: 'showDiaperPopup',
    temperature: 'showTemperaturePopup'
  };
  if (popupMap[type]) this.setData({ [popupMap[type]]: true });
}
```

### 3.2 进度条数据计算

在 `computeDisplayFields()` 中新增进度条百分比计算：

```javascript
// 进度条百分比（0-100）
const feedingProgress = Math.min(100, (todayStats.feeding.count / 8) * 100);
const sleepProgress = Math.min(100, (todayStats.sleep.totalDuration / getSleepGoal(ageMonths)) * 100);
const diaperProgress = Math.min(100, (todayStats.diaper.count / 6) * 100);
// 体温无进度条，用 tempProgress: -1 标记
```

### 3.3 状态胶囊 WXML 结构

```xml
<view class="status-capsule {{capsuleState}}" bindtap="onCapsuleTap">
  <image class="capsule-icon" src="{{capsuleIcon}}" mode="aspectFit" />
  <text class="capsule-text">{{activeStatus.text}}</text>
  <!-- 录制指示灯 -->
  <view class="rec-indicator" wx:if="{{activeSleep && !sleepAbnormal}}">
    <image class="rec-dot" src="/images/icons/rec-dot.png" mode="aspectFit" />
    <text class="rec-label">REC</text>
  </view>
  <!-- 操作按钮 -->
  <view class="capsule-action" wx:if="{{activeSleep && !sleepAbnormal}}" catchtap="endSleepFromCapsule">结束</view>
  <view class="capsule-action danger" wx:if="{{sleepAbnormal}}" catchtap="cancelAbnormalSleep">取消计时</view>
</view>
```

---

## 四、发现页改造策略

### 4.1 focus-card 组件设计

**路径**：`/components/focus-card/`

**Properties：**
```javascript
properties: {
  type: String,       // 'vaccine' | 'milestone' | 'encouragement'
  title: String,      // 卡片标题
  description: String,// 描述文字
  icon: String,       // 图标路径
  urgency: String,    // 'overdue' | 'upcoming' | 'normal'
  darkMode: Boolean
}
// Events: tap（点击跳转）
```

### 4.2 功能入口 2x2 网格

```xml
<view class="tool-grid">
  <view class="tool-item" wx:for="{{toolItems}}" wx:key="title" data-url="{{item.url}}" bindtap="goToPage">
    <view class="tool-icon-wrapper" style="background: {{item.bgColor}};">
      <image class="tool-icon" src="{{item.icon}}" mode="aspectFit" />
    </view>
    <text class="tool-title">{{item.title}}</text>
    <view class="tool-badge" wx:if="{{item.badge > 0}}">{{item.badge}}</view>
  </view>
</view>
```

---

## 五、居中弹窗改为底部弹出 — 通用改造模板

**改造前（居中弹窗）：**
```xml
<view class="xxx-popup-mask" wx:if="{{show}}" bindtap="close">
  <view class="xxx-popup" catchtap>
    <!-- 内容 -->
  </view>
</view>
```

**改造后（底部弹出）：**
```xml
<view class="popup-mask {{show ? 'popup-mask-visible' : ''}}" bindtap="close">
  <view class="popup-container {{show ? 'popup-enter' : ''}}" catchtap>
    <view class="swipe-indicator"></view>
    <view class="popup-header">
      <view class="popup-icon"><image src="{{icon}}" mode="aspectFit" /></view>
      <text class="popup-title">{{title}}</text>
      <view class="popup-close" bindtap="close">
        <image src="/images/icons/x-mark.png" mode="aspectFit" style="width:24rpx;height:24rpx;" />
      </view>
    </view>
    <scroll-view class="popup-content" scroll-y>
      <view class="popup-inner">
        <!-- 原有内容迁移到这里 -->
      </view>
    </scroll-view>
  </view>
</view>
```

**需要添加的 @import**：
```css
@import '../../styles/popup.wxss'; /* 或 /styles/popup.wxss */
```

**适用页面清单**：discover、profile、growth、vaccine、milestone、family、auth

---

## 六、timeline 组件时间轴线改造

在 `timeline.wxss` 中新增：

```css
/* v4.0: 时间轴线 */
.timeline-list {
  position: relative;
}

.timeline-line {
  position: absolute;
  left: 56rpx;
  top: 0;
  bottom: 0;
  width: 2rpx;
  background: var(--border-color);
}

.timeline-node {
  position: absolute;
  left: 51rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  border: 2rpx solid var(--bg-secondary);
}

.timeline-node.feeding { background: var(--feeding-color); }
.timeline-node.sleep { background: var(--sleep-color); }
.timeline-node.diaper { background: var(--diaper-color); }
.timeline-node.temperature { background: var(--temperature-color); }
.timeline-node.growth { background: var(--growth-color); }
```

---

## 七、文件变更清单

| 文件路径 | 改动类型 | 主要变更说明 |
|----------|----------|-------------|
| `app.wxss` | 增量 | +6 CSS 变量 + 暗色对应 + 3 动画 + reduce-motion |
| `styles/popup.wxss` | 小改 | 圆角/指示条/标题行/按钮/max-height 6 处修改 |
| `styles/form.wxss` | 小改 | `.submit-btn` 高度 96→92rpx |
| `utils/icon-config.js` | 增量 | 注册 sun/moon/rec-dot 3 个图标 |
| `images/icons/` | 新增 3 文件 | sun.png / moon.png / rec-dot.png |
| `pages/home/home.wxml` | **大改** | 去 baby-card、合并问候区、胶囊、摘要进度条、待办竖向、AI 一行式 |
| `pages/home/home.wxss` | **大改** | 胶囊样式、进度条、待办竖向、AI 一行式全部新样式 |
| `pages/home/home.js` | 中改 | `onStatTap` 改弹窗、进度条百分比计算、胶囊状态管理 |
| `pages/record/record.wxml` | 小改 | 去页头图标、筛选栏吸顶 |
| `pages/record/record.wxss` | 小改 | sticky 筛选栏 + 选中指示条 |
| `pages/discover/discover.wxml` | **大改** | 聚焦卡片、2x2 网格、参考精简、弹窗底部化 |
| `pages/discover/discover.wxss` | **大改** | 全部新结构样式 |
| `pages/discover/discover.js` | 中改 | 聚焦卡片优先级算法、toolItems 数据 |
| `pages/profile/profile.wxml` | 中改 | 居中头像、去菜单描述、编辑弹窗底部化 |
| `pages/profile/profile.wxss` | 中改 | 居中布局 + 底部弹窗样式 |
| `components/focus-card/` | **新建** | 发现页聚焦卡片组件 |
| `components/timeline/timeline.wxss` | 增量 | 时间轴线 + 功能色节点 |
| `components/timeline/timeline.wxml` | 增量 | 轴线 DOM 结构 |
| 14 个页面 WXML | 小改 | 去页头 `.header-icon` 区块 |
| 7 个页面 | 中改 | 居中弹窗→底部弹出改造 |
| `pages/settings/settings.wxml` | 小改 | 主题图标改 PNG、危险操作色条 |
| `components/easter-egg-popup/` | 小改 | 关闭按钮改 x-mark.png |

---

## 八、关键设计决策

### 决策 1：摘要卡片点击交互
- **方案 A（v3.x）**：点击跳转记录页并筛选
- **方案 B（v4.0 选定）**：直接打开对应记录弹窗
- **理由**：「一次点击完成记录」核心原则，减少页面切换

### 决策 2：AI 洞察展示形式
- **方案 A（v3.x）**：始终展开的卡片
- **方案 B（v4.0 选定）**：默认折叠一行，可展开
- **理由**：首页空间宝贵，AI 洞察非高频操作，折叠节省空间

### 决策 3：弹窗统一方向
- **方案 A**：保持部分居中、部分底部
- **方案 B（v4.0 选定）**：全部底部弹出（auth 成功弹窗除外）
- **理由**：拇指操作一致性，单手持机友好

---

*文档版本：v1.0*
*创建日期：2026-04-13*
*状态：已确认*
