# 设计文档 - UI 重设计 v4.0（UI Redesign v4）

> 版本：v2.0 | 日期：2026-04-13 | 状态：已确认
> **Review 轮次**：10 轮交叉对比 design-spec.md + detailed-spec.md，已修复 30 处遗漏

---

## 一、设计规格引用

| 文档 | 内容 | 路径 |
|------|------|------|
| **设计总纲** | 设计原则、色彩升级、4 个 Tab 核心重设计、动画系统、组件变更清单 | `design-spec.md` |
| **逐页细化规格** | 全部 18 页面 + 15 组件 v3.x→v4.0 逐项对比、弹窗/表单/空状态/页头统一规范、暗色检查矩阵 | `detailed-spec.md` |

**本文档定位**：补充设计规格中未覆盖的**实施层面**细节 —— 文件修改方案、CSS diff、WXML 结构改造、JS 交互变更。

---

## 二、全局基础层改造

### 2.1 app.wxss 新增变量（6 个）

在 `page {}` 选择器末尾追加：

```css
--growth-color: #7BA9C9;
--surface-elevated: rgba(212, 184, 150, 0.06);
--elevation-1: 0 2rpx 8rpx rgba(139, 123, 107, 0.04);
--elevation-2: 0 4rpx 16rpx rgba(139, 123, 107, 0.06);
--radius-pill: 999rpx;
--radius-xl: 40rpx;
```

在 `.dark-mode` 选择器末尾追加（4 个需要暗色覆盖的）：

```css
--growth-color: #5C8CA8;
--surface-elevated: rgba(212, 184, 150, 0.04);
--elevation-1: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
--elevation-2: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
/* --radius-pill / --radius-xl 为固定值，无需暗色覆盖 */
```

### 2.2 app.wxss 新增动画（3 个 + reduce-motion）

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

| 选择器 | 属性 | v3.x | v4.0 |
|--------|------|------|------|
| `.popup-container` | `border-radius` | `var(--radius-lg) ... 0 0` | `var(--radius-xl) ... 0 0` |
| `.popup-container` | `max-height` | `80vh` | `85vh` |
| `.popup-content` | `height` | `calc(80vh - 180rpx)` | `calc(85vh - 180rpx)` |
| `.swipe-indicator` | `width/height/border-radius` | `80rpx/8rpx/4rpx` | `48rpx/4rpx/var(--radius-pill)` |
| `.popup-icon` | `width/height` | `64rpx` | `56rpx` |
| `.popup-icon image` | `width/height` | `48rpx` | `40rpx` |
| `.popup-title` | `font-size` | `36rpx` | `32rpx` |
| `.popup-close` | 结构 | 文字 `×`(48rpx) | 改为 `<image>` 24rpx |
| `.submit-btn` | `height` | `88rpx` | `92rpx` |
| `.submit-btn` | `border-radius` | `var(--radius-lg)` | `var(--radius-md)` |

**`.popup-close` 改造说明**：

CSS 中新增：
```css
.popup-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-close image {
  width: 24rpx;
  height: 24rpx;
  opacity: 0.5;
}
```

**需同步修改 WXML 的组件**（7 个弹窗 + 页面内联弹窗）：
- `feeding-popup`、`sleep-popup`、`diaper-popup`、`temperature-popup`、`growth-popup`、`baby-edit-popup`、`export-popup`
- 将 `<text>×</text>` 改为 `<image src="/images/icons/x-mark.png" mode="aspectFit" />`

### 2.4 styles/form.wxss 修改

| 选择器 | v3.x | v4.0 |
|--------|------|------|
| `.submit-btn` height | `96rpx` | `92rpx` |

### 2.5 空状态统一规范（新增）

所有页面/组件的空状态统一为：

| 元素 | 规格 |
|------|------|
| 图标 | 80rpx / 对应功能色图标 / `opacity: 0.5` |
| 主文字 | 28rpx / 500 / `--text-secondary` / margin-top: 24rpx |
| 辅文字 | 24rpx / 400 / `--text-hint` / margin-top: 8rpx |
| 操作按钮 | `btn-primary` 样式 / margin-top: 32rpx |

---

## 三、首页改造策略

### 3.1 WXML 结构改造

**去掉**：
- `<baby-card>` 组件引用（L47-50）
- 独立 `.baby-switch` 区块（L74-92）

**改造**：
- `.greeting-bar`（L24-34）→ 合并多宝切换头像组到右侧
- `.status-banner`（L53-72）→ `.status-capsule` 胶囊 + `rec-dot` 指示灯
- `.todo-section`（L95-134）→ 竖向 `.todo-list`
- `.stats-grid`（L137-208）→ 数字加大 + 进度条 + 辅助行精简为 1 行
- `.insight-card`（L275-296）→ 折叠/展开双态
- 彩蛋横幅 `.egg-banner`（L37-44）→ **保留不变**（不影响 v4.0 布局精简目标）

### 3.2 `onStatTap` 交互改变

```javascript
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

### 3.3 进度条数据计算

```javascript
// computeDisplayFields() 中新增
const feedingProgress = Math.min(100, (todayStats.feeding.count / 8) * 100);
const sleepProgress = Math.min(100, (todayStats.sleep.totalDuration / getSleepGoal(ageMonths)) * 100);
const diaperProgress = Math.min(100, (todayStats.diaper.count / 6) * 100);
const tempProgress = -1; // 体温无进度条
```

**进度条高度统一为 4rpx**（design-spec §2.4 定义）。

### 3.4 状态胶囊 WXML

```xml
<view class="status-capsule {{capsuleState}}" bindtap="onCapsuleTap">
  <image class="capsule-icon" src="{{capsuleIcon}}" mode="aspectFit" />
  <text class="capsule-text">{{activeStatus.text}}</text>
  <view class="rec-indicator" wx:if="{{activeSleep && !sleepAbnormal}}">
    <image class="rec-dot" src="/images/icons/rec-dot.png" mode="aspectFit" />
    <text class="rec-label">REC</text>
  </view>
  <view class="capsule-action" wx:if="{{activeSleep && !sleepAbnormal}}" catchtap="endSleepFromCapsule">结束</view>
  <view class="capsule-action danger" wx:if="{{sleepAbnormal}}" catchtap="cancelAbnormalSleep">取消计时</view>
</view>
```

### 3.5 首页无宝宝空状态

现有 `.empty-state`（L387-390）保留，升级为统一空状态规范（2.5 节）。

---

## 四、记录页改造策略

### 4.1 筛选栏吸顶 + 选中指示条

```css
.filter-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-secondary);
}
.filter-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32rpx;
  height: 4rpx;
  background: var(--primary-color);
  border-radius: var(--radius-pill);
}
```

---

## 五、发现页改造策略

### 5.1 focus-card 组件

**路径**：`/components/focus-card/`

```javascript
properties: {
  type: String,       // 'vaccine' | 'milestone' | 'encouragement'
  title: String,
  description: String,
  icon: String,
  urgency: String,    // 'overdue' | 'upcoming' | 'normal'
  targetUrl: String,  // 点击跳转 URL
  darkMode: Boolean
}
// Events: tap
```

### 5.2 功能入口 2x2 网格

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

### 5.3 页头副标题变更

从「专业育儿工具，助您科学育儿」改为「科学育儿，温暖陪伴」。

---

## 六、我的页改造策略

（同 v1.0，无遗漏。profile 编辑弹窗底部化 + 居中头像 + 去菜单描述。）

---

## 七、居中弹窗改底部弹出 — 通用改造模板

```xml
<!-- 改造后 -->
<view class="popup-mask {{show ? 'popup-mask-visible' : ''}}" bindtap="close">
  <view class="popup-container {{show ? 'popup-enter' : ''}}" catchtap>
    <view class="swipe-indicator"></view>
    <view class="popup-header">
      <view class="popup-icon"><image src="{{icon}}" mode="aspectFit" /></view>
      <text class="popup-title">{{title}}</text>
      <view class="popup-close" bindtap="close">
        <image src="/images/icons/x-mark.png" mode="aspectFit" />
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

**适用页面**：discover、profile、growth、vaccine、milestone、family、auth

---

## 八、timeline 组件时间轴线

```css
.timeline-list { position: relative; }
.timeline-line {
  position: absolute; left: 56rpx; top: 0; bottom: 0;
  width: 2rpx; background: var(--border-color);
}
.timeline-node {
  position: absolute; left: 51rpx;
  width: 10rpx; height: 10rpx; border-radius: 50%;
  border: 2rpx solid var(--bg-secondary);
}
.timeline-node.feeding { background: var(--feeding-color); }
.timeline-node.sleep { background: var(--sleep-color); }
.timeline-node.diaper { background: var(--diaper-color); }
.timeline-node.temperature { background: var(--temperature-color); }
.timeline-node.growth { background: var(--growth-color); }
```

---

## 九、弹窗组件内部样式升级（遗漏补充）

### 9.1 feeding-popup 喂养弹窗

| 区域 | 变更 |
|------|------|
| 类型三栏 | 改为等宽三栏 / 选中态 `--feeding-color` 边框 2rpx + 背景 8% |
| 母乳侧选择 | `--radius-pill` 胶囊按钮 |
| 总奶量显示 | 数字加大到 40rpx/700 / `--feeding-color` |
| **新增：常用量** | 快捷用量上方显示「最近: 120ml 150ml 180ml」可点击填入 |

**常用量实现方案**：
```javascript
// feeding-popup.js
// 从 StorageUtil 读取最近 3 次配方奶用量（去重）
getRecentAmounts() {
  const key = `recent_formula_amounts_${this.data.babyId}`;
  const amounts = StorageUtil.get(key) || [];
  return [...new Set(amounts)].slice(0, 3);
}
// 保存记录后更新
saveRecentAmount(amount) {
  const key = `recent_formula_amounts_${this.data.babyId}`;
  let amounts = StorageUtil.get(key) || [];
  amounts.unshift(amount);
  StorageUtil.set(key, [...new Set(amounts)].slice(0, 10));
}
```

### 9.2 sleep-popup 睡眠弹窗

| 区域 | 变更 |
|------|------|
| 模式切换 | `--radius-pill` 胶囊切换 |
| 追踪时间显示 | 字号 **56rpx / 700** / `--sleep-color` |
| 追踪按钮 | 开始 `--sleep-color` 渐变 / 结束 `--primary-color` 渐变 / 取消 `--text-secondary` 文字按钮 |
| 地点选择 | `--radius-pill` 胶囊按钮 |

### 9.3 diaper-popup 排便弹窗

| 区域 | 变更 |
|------|------|
| 质地选择 | 从文字按钮 grid **改为描述卡片式** / 选中态边框 `--diaper-color` |

### 9.4 temperature-popup 体温弹窗

| 区域 | 变更 |
|------|------|
| 体温输入 | 字号加大到 **48rpx** / 居中 |
| 发热等级 | `--radius-pill` / 对应发热色背景 10% + 文字色 |

### 9.5 growth-popup 生长弹窗

| 区域 | 变更 |
|------|------|
| **新增：上次对比** | 输入框右侧显示「上次: 6.8kg (+0.3)」/ 22rpx / `--text-hint` |

**上次对比实现方案**：
```javascript
// growth-popup.js
// 打开弹窗时查询最近一条生长记录
async loadLastGrowthData(babyId) {
  const records = await RecordService.getRecords(babyId, {
    recordType: 'growth', limit: 1, orderBy: 'startTimeTs', order: 'desc'
  });
  if (records.length > 0) {
    this.setData({ lastGrowth: records[0].data });
  }
}
// WXML 中输入框右侧
// <text class="last-value" wx:if="{{lastGrowth.weight}}">上次: {{lastGrowth.weight}}kg</text>
```

### 9.6 report-popup 成长报告弹窗

| 区域 | 变更 |
|------|------|
| 周期选择 tab | `--radius-pill` 胶囊 |
| 综合评分数字 | **48rpx / 700** |

### 9.7 export-popup 导出弹窗

| 区域 | 变更 |
|------|------|
| 格式选择 | 改用对应 PNG 图标 / 圆角 `--radius-lg` |
| 时间范围 | `--radius-pill` 胶囊 |

### 9.8 baby-edit-popup

| 区域 | 变更 |
|------|------|
| 头像 | **100rpx** / 覆盖层半透明 0.4 |

### 9.9 error-state 组件

| 区域 | 变更 |
|------|------|
| 重试按钮 | `btn-secondary` 样式 / 92rpx |

---

## 十、分包页面样式升级

### 10.1 auth（登录/引导）

| 区域 | 变更 |
|------|------|
| 功能特点图标 | 容器改圆形 56rpx / 功能色背景 10% |
| 「开始使用」按钮 | 高度 96rpx / `--radius-pill` / 品牌色渐变 |
| 步骤指示器 | 圆点 10rpx / 活动态品牌色 |
| 关系选择网格 | 每格 padding 增到 20rpx / 选中态边框 `--primary-color` 2rpx |
| 家庭选项卡片 | 圆角 `--radius-lg` / 间距 20rpx |

### 10.2 baby-create

| 区域 | 变更 |
|------|------|
| 性别选择 | 改为**两个等宽卡片按钮** / 选中态边框 `--primary-color` + 背景 `--surface-elevated` |
| 日期选择箭头 | 文字 `>` → `chevron-right.png` |

### 10.3 baby-list

| 区域 | 变更 |
|------|------|
| 操作按钮 | 改为图标按钮：`arrow-right.png`(详情) / `trash-red.png`(删除)，各 36rpx |
| 「当前」标记 | `--radius-pill` / `--primary-color` 背景 12% / 品牌色文字 |
| 底部添加 | 改用 `plus.png` 24rpx + 文字 |

### 10.4 baby-detail

| 区域 | 变更 |
|------|------|
| 头像 | 120rpx / `--primary-color` 3rpx 边框 |
| 操作按钮 | 3 全宽 → **1 主按钮(`btn-primary`) + 2 次要(`btn-secondary`)** |

### 10.5 growth（生长曲线）

| 区域 | 变更 |
|------|------|
| 类型选择器 | 吸顶 / 选中态底部指示条 4rpx |
| 数据卡片 | 四列 → **2x2 网格** / gap: 16rpx |
| 百分位标签 | `--radius-pill` / 正常绿/偏低黄/异常红 背景 10% |
| 历史记录箭头 | `>` → `chevron-right.png` |
| FAB | 统一 96rpx 圆形 |

### 10.6 vaccine（疫苗追踪）

| 区域 | 变更 |
|------|------|
| 待办卡片 | 横滚 → **竖向条**（同首页待办规格）|
| 筛选 tab | 增加底部指示条 / 选中 `--primary-color` |
| 状态图标 | 文字 → PNG: `check-circle.png` / `warning.png` / 空心圆 CSS |

### 10.7 milestone（发育里程碑）

| 区域 | 变更 |
|------|------|
| 进度条 | 纯色 → **品牌色渐变** |
| 状态图标 | 同 vaccine |
| 标签 | `--radius-xs` / 对应色背景 10% |

### 10.8 ai-assistant

| 区域 | 变更 |
|------|------|
| 配额条 | 进度条品牌色渐变 / 容器 `--radius-md` |
| 评估分数 | **48rpx / 700** |
| 快捷问题 | `--radius-pill` / `--surface-elevated` 背景 |
| 输入区 | 输入框 `--radius-pill` / 发送按钮 `--radius-pill` |

### 10.9 family（家庭管理）

| 区域 | 变更 |
|------|------|
| 角色标签 | `--radius-pill` |
| 邀请码 | 字号 **40rpx / 600** / 字符间距 8rpx |
| 成员操作菜单 | 底部 action-sheet / `--radius-xl` 顶部圆角 |

### 10.10 family-join

| 区域 | 变更 |
|------|------|
| 邀请码输入 | 居中大字 / 每位字符间 12rpx / 字号 **40rpx** |

### 10.11 export（数据导出页）

| 区域 | 变更 |
|------|------|
| 统计数字 | **48rpx / 700** |
| 类型选择 | checkbox → **多选卡片按钮** / 选中 `--primary-color` 边框 + `check.png` 角标 |
| 日期范围 | `--radius-pill` 胶囊 tab |
| 格式选择 | `--radius-pill` 胶囊 tab |
| 导出按钮 | `btn-primary` / 92rpx |

### 10.12 settings（设置）

| 区域 | 变更 |
|------|------|
| 主题图标 | Unicode/emoji → PNG（sun.png/moon.png/settings.png）|
| 菜单箭头 | `›` → `chevron-right.png` 16rpx |
| 危险操作 | 增加 `--danger-color` 左侧 4rpx 色条 |

---

## 十一、文件变更完整清单

| 文件路径 | 改动类型 | 主要变更 |
|----------|----------|----------|
| `app.wxss` | 增量 | +6 变量 + 暗色覆盖 + 3 动画 + reduce-motion |
| `styles/popup.wxss` | 小改 | 10 处 CSS 属性修改 |
| `styles/form.wxss` | 小改 | `.submit-btn` 96→92rpx |
| `utils/icon-config.js` | 增量 | 注册 3 新图标 |
| `images/icons/` | +3 | sun.png / moon.png / rec-dot.png |
| `pages/home/*` | **大改** | 去 baby-card、胶囊、进度条、待办竖向、AI 一行式 |
| `pages/record/*` | 中改 | 去页头图标、筛选栏吸顶 + 指示条 |
| `pages/discover/*` | **大改** | 聚焦卡片、2x2 网格、参考精简、弹窗底部化、副标题变更 |
| `pages/profile/*` | 中改 | 居中头像、去菜单描述、弹窗底部化 |
| `pages/auth/*` | 小改 | 功能特点/步骤指示器/关系网格视觉微调 + 邀请码弹窗底部化 |
| `pages/baby-create/*` | 小改 | 去页头图标 + 性别卡片按钮 + picker 箭头 |
| `pages/baby-list/*` | 小改 | 去页头图标 + 操作图标化 + 当前标记 pill |
| `pages/guide/*` | 小改 | 去页头图标 + 指南圆点 + 按钮 92rpx |
| `packageGrowth/pages/growth/*` | 中改 | 去页头图标 + 吸顶 tab + 2x2 数据卡片 + pill 标签 + 2 弹窗底部化 |
| `packageGrowth/pages/vaccine/*` | 中改 | 去页头图标 + 待办竖向 + tab 指示条 + PNG 状态图标 + 2 弹窗底部化 |
| `packageGrowth/pages/milestone/*` | 中改 | 去页头图标 + 渐变进度条 + pill 标签 + 2 弹窗底部化 |
| `packageGrowth/pages/baby-detail/*` | 小改 | 去页头图标 + 头像边框 + 按钮层级化 |
| `packageSocial/pages/ai-assistant/*` | 小改 | 去页头图标 + 配额条/快捷问题/输入区视觉升级 |
| `packageSocial/pages/family/*` | 中改 | 去页头图标 + pill 标签 + 邀请码字号 + 3 弹窗底部化 |
| `packageSocial/pages/family-create/*` | 小改 | 去页头图标 |
| `packageSocial/pages/family-join/*` | 小改 | 去页头图标 + 邀请码居中大字输入 |
| `packageSocial/pages/export/*` | 小改 | 统计数字 48rpx + 卡片选择 + 胶囊 tab |
| `packageSocial/pages/settings/*` | 小改 | 主题 PNG + 箭头 PNG + 危险色条 |
| `components/focus-card/` | **新建** | 发现页聚焦卡片 |
| `components/timeline/*` | 增量 | 时间轴线 + 功能色节点 |
| `components/feeding-popup/*` | 中改 | 三栏等宽 + 母乳胶囊 + 常用量 + 关闭按钮图标 |
| `components/sleep-popup/*` | 小改 | 胶囊切换 + 56rpx 时间 + 关闭按钮图标 |
| `components/diaper-popup/*` | 小改 | 质地描述卡片 + 关闭按钮图标 |
| `components/temperature-popup/*` | 小改 | 48rpx 输入 + pill 标签 + 关闭按钮图标 |
| `components/growth-popup/*` | 中改 | 上次对比 + 关闭按钮图标 |
| `components/report-popup/*` | 小改 | pill tab + 48rpx 评分 |
| `components/export-popup/*` | 小改 | PNG 图标 + 胶囊 + 关闭按钮图标 |
| `components/baby-edit-popup/*` | 小改 | 头像 100rpx + 覆盖层 0.4 + 关闭按钮图标 |
| `components/error-state/*` | 小改 | 重试按钮 btn-secondary / 92rpx |
| `components/easter-egg-popup/*` | 小改 | 关闭按钮 x-mark.png + 按钮 pill 92rpx |

---

## 十二、关键设计决策

| # | 决策 | 选定方案 | 理由 |
|---|------|---------|------|
| 1 | 摘要卡片点击 | 直接打开弹窗（非跳转筛选）| 「一次点击」原则 |
| 2 | AI 洞察展示 | 默认折叠一行 | 首页空间宝贵 |
| 3 | 弹窗方向 | 全部底部弹出（auth 成功除外）| 拇指一致性 |
| 4 | 进度条高度 | 4rpx（非 6rpx）| design-spec 主规格定义 |
| 5 | 彩蛋横幅 | v4.0 保留不变 | 不影响布局精简目标，用户情感价值高 |
| 6 | 喂养常用量存储 | 本地 StorageUtil（非云端）| 个性化偏好，无需跨设备同步 |

---

*文档版本：v2.0*
*创建日期：2026-04-13*
*状态：已确认*
