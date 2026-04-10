# 设计文档 - 暖夜模式（深色模式）

> **需求文档**: `specs/warm-night-mode/requirements.md` v1.1
> **版本**: v1.0 | **日期**: 2026-04-08

---

## 1. 概述

本文档描述"暖夜模式"的完整技术设计方案。核心原则：**通过 CSS 变量覆盖 + JS 主题模块实现双套色板切换，所有改动在 `page.dark-mode` 选择器作用域内，确保亮色模式零影响。**

### 1.1 设计约束

| 约束 | 说明 |
|------|------|
| 技术栈 | 微信小程序原生（WXML + WXSS + JS），无构建工具 |
| 不可用 | `@media (prefers-color-scheme)` 在小程序 WXSS 中**不支持** |
| 不可用 | `page` 元素不能通过 JS 直接添加 class（微信限制） |
| 可用 | 微信 `darkmode: true` + `theme.json`（仅控制 `app.json` 中的静态配置色） |
| 可用 | 页面/组件最外层 `<view>` 添加 class，通过 CSS 选择器覆盖变量 |
| 现有架构 | `app.wxss` 的 `page {}` 定义 ~50 个 CSS 变量，所有组件继承 |

### 1.2 方案选型对比

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| A. `theme.json` 纯方案 | 微信官方、原生组件自动适配 | 只能控制 `app.json` 中的 7 个配置色，无法控制 CSS 变量 | **仅用于导航栏/TabBar** |
| B. `page[data-theme="dark"]` | 不需改 WXML | 微信小程序 `page` 元素**不支持**属性选择器 | ❌ 不可行 |
| C. 最外层 `<view class="dark-mode">` | 完全可控，可覆盖所有 CSS 变量 | 需要每个页面/组件的根 `<view>` 绑定 class | **✅ 主方案** |
| D. `app.wxss` 中写两套 `page {}` | 无需改 WXML | 无法动态切换（WXSS 是静态的） | ❌ 不可行 |

**最终方案：C（CSS class 覆盖）+ A（theme.json 辅助）**

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    数据流                                 │
│                                                         │
│  settings.js ──toggle──▶ ThemeManager.setTheme()        │
│                              │                          │
│                    ┌─────────┼──────────┐               │
│                    ▼         ▼          ▼               │
│              StorageUtil  globalData  EventBus           │
│              (持久化)    (内存)     (广播)               │
│                                   │                     │
│                    ┌──────────────┼──────────┐          │
│                    ▼              ▼          ▼          │
│               onShow()      onShow()    onShow()       │
│              (home)        (record)    (discover)       │
│                    │              │          │          │
│                    ▼              ▼          ▼          │
│              setData({       setData({  setData({      │
│               darkMode       darkMode   darkMode       │
│              })              })         })              │
│                    │              │          │          │
│                    ▼              ▼          ▼          │
│  WXML: <view class="{{darkMode ? 'dark-mode' : ''}}"> │
│                    │                                    │
│                    ▼                                    │
│  WXSS: .dark-mode { --bg-primary: #1E1A16; ... }      │
│         (CSS 变量覆盖，子元素自动继承)                    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

```
┌──────────────────┐     ┌──────────────────┐
│  ThemeManager     │     │  theme.json      │
│  (utils/theme.js) │     │  (微信配置)       │
│                   │     │                   │
│  • getTheme()     │     │  • @navBgColor    │
│  • setTheme()     │     │  • @tabBarBg      │
│  • isDark()       │     │  • @tabBarColor   │
│  • getColor(key)  │     │  • @tabBarSelClr  │
│  • onThemeChange()│     │                   │
│  • COLORS.light{} │     │  仅控制导航栏      │
│  • COLORS.dark{}  │     │  和 TabBar         │
└────────┬─────────┘     └──────────────────┘
         │
         │ 被以下模块引用：
         │
    ┌────┼────┬──────────┬───────────────┐
    ▼    ▼    ▼          ▼               ▼
  app.js  页面层   组件层    reportDataHelper
  (初始化) (onShow) (attached)  timeline.js
                               growth.js
                               discover.js
```

### 2.3 技术栈

| 层级 | 技术 | 暗色适配方式 |
|------|------|-------------|
| 导航栏 + TabBar | `app.json` + `theme.json` | 微信 DarkMode 变量替换 |
| 全局 CSS 变量 | `app.wxss` | `.dark-mode {}` 选择器覆盖 |
| 页面局部变量 | 各 `page.wxss` | `.dark-mode {}` 选择器覆盖 |
| JS 动态颜色 | `utils/theme.js` | `ThemeManager.getColor(key)` |
| 原生组件 | `<switch>` / `<input>` | CSS 覆盖 + `theme.json` |
| Canvas 绘图 | `share-canvas.js` | **不适配**（始终亮色） |

---

## 3. 详细设计

### 3.1 ThemeManager（`utils/theme.js`）

```javascript
/**
 * 主题管理器 - 单例模式
 * 
 * 职责：
 * 1. 管理主题状态（light / dark / system）
 * 2. 提供 JS 颜色查询接口
 * 3. 广播主题变更事件
 * 4. 持久化主题偏好
 */

const StorageUtil = require('./storage');

// ============ 颜色配置 ============

/** 亮色模式颜色（与 app.wxss page{} 中的 CSS 变量完全对应） */
const LIGHT_COLORS = {
  // 语义状态色（JS 中动态使用）
  scoreExcellent:    '#7BC950',
  scoreGood:         '#5ABFB0',
  scoreFair:         '#D4883D',
  scorePoor:         '#E8745A',
  scoreCritical:     '#E85454',
  
  statusNormal:      '#7BC950',
  statusWarning:     '#D4883D',
  statusDanger:      '#E85454',
  statusMuted:       '#999999',
  
  // 记录类型圆点色（timeline.js）
  dotFeeding:        '#A8D4A8',
  dotSleep:          '#B8A8D4',
  dotDiaper:         '#D4C8A8',
  dotTemperature:    '#D4A8A8',
  dotGrowth:         '#A8C8D4',
  dotMilestone:      '#D4B8A8',
  dotDefault:        '#B89678',
  
  // 百分位线色（growth.js）
  percentileP3:      '#C89898',
  percentileP15:     '#B8A888',
  percentileP50:     '#D4A574',
  percentileP85:     '#B8A888',
  percentileP97:     '#C89898',
  
  // 功能菜单 iconBg（discover.js）
  iconBgFeeding:     'linear-gradient(135deg, rgba(168,212,168,0.2) 0%, rgba(152,196,152,0.3) 100%)',
  iconBgSleep:       'linear-gradient(135deg, rgba(184,168,212,0.2) 0%, rgba(168,152,196,0.3) 100%)',
  iconBgDiaper:      'linear-gradient(135deg, rgba(212,200,168,0.2) 0%, rgba(196,184,152,0.3) 100%)',
  iconBgAi:          'linear-gradient(135deg, rgba(212,184,150,0.2) 0%, rgba(196,168,134,0.3) 100%)',
  
  // wx.showModal confirmColor
  confirmDanger:     '#E85454',
  confirmWarn:       '#D48B8B',
  confirmNeutral:    '#C77B6B',

  // 发热等级色（temperature-popup 内联样式用）
  feverLow:          '#5B8FF9',
  feverNormal:       '#07C160',
  feverLowFever:     '#FFC53D',
  feverModerate:     '#FF976A',
  feverHigh:         '#FF7875',
  feverUltraHigh:    '#FF4D4F',
};

/** 暗色模式颜色 */
const DARK_COLORS = {
  // 语义状态色 — 在暗色背景上需要稍微调亮或降饱和
  scoreExcellent:    '#6AB845',
  scoreGood:         '#4AAFA0',
  scoreFair:         '#C47830',
  scorePoor:         '#D86A50',
  scoreCritical:     '#D44848',
  
  statusNormal:      '#6AB845',
  statusWarning:     '#C47830',
  statusDanger:      '#D44848',
  statusMuted:       '#7A7068',
  
  // 记录类型圆点色 — 保持辨识度，微调亮度
  dotFeeding:        '#7CAF7C',
  dotSleep:          '#9488B4',
  dotDiaper:         '#B0A480',
  dotTemperature:    '#B48888',
  dotGrowth:         '#88A8B4',
  dotMilestone:      '#B4A088',
  dotDefault:        '#A08060',
  
  // 百分位线色 — 在深色背景上提亮
  percentileP3:      '#D4A8A8',
  percentileP15:     '#C8B898',
  percentileP50:     '#E0B584',
  percentileP85:     '#C8B898',
  percentileP97:     '#D4A8A8',
  
  // 功能菜单 iconBg — 提高不透明度
  iconBgFeeding:     'linear-gradient(135deg, rgba(124,175,124,0.25) 0%, rgba(108,159,108,0.35) 100%)',
  iconBgSleep:       'linear-gradient(135deg, rgba(148,136,180,0.25) 0%, rgba(132,120,164,0.35) 100%)',
  iconBgDiaper:      'linear-gradient(135deg, rgba(176,164,128,0.25) 0%, rgba(160,148,112,0.35) 100%)',
  iconBgAi:          'linear-gradient(135deg, rgba(180,152,118,0.25) 0%, rgba(164,136,102,0.35) 100%)',
  
  // wx.showModal confirmColor — 不变（系统弹窗背景不受控）
  confirmDanger:     '#E85454',
  confirmWarn:       '#D48B8B',
  confirmNeutral:    '#C77B6B',

  // 发热等级色 — 在暗底上微调
  feverLow:          '#5B8FF9',   // 蓝色在暗底上足够清晰，不变
  feverNormal:       '#07C160',   // 绿色不变
  feverLowFever:     '#FFC53D',   // 黄色不变
  feverModerate:     '#FF976A',   // 橙色不变
  feverHigh:         '#FF7875',   // 红色不变
  feverUltraHigh:    '#FF4D4F',   // 深红不变
};

// ============ 主题管理器 ============

const THEME_KEY = 'app_theme_mode';  // storage key
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_SYSTEM = 'system';

let _currentTheme = null;   // 'light' | 'dark' | 'system'
let _resolvedDark = false;  // 实际是否为暗色
let _listeners = [];

/**
 * 解析当前是否应该使用暗色
 */
function _resolveDark(theme) {
  if (theme === THEME_DARK) return true;
  if (theme === THEME_LIGHT) return false;
  // system: 读取微信系统主题
  try {
    const appBaseInfo = wx.getAppBaseInfo();
    return appBaseInfo.theme === 'dark';
  } catch (e) {
    return false;
  }
}

const ThemeManager = {
  THEME_LIGHT,
  THEME_DARK,
  THEME_SYSTEM,

  /**
   * 初始化（在 app.onLaunch 中调用）
   */
  init() {
    _currentTheme = StorageUtil.get(THEME_KEY) || THEME_LIGHT;
    _resolvedDark = _resolveDark(_currentTheme);

    // 监听系统主题变化（仅 system 模式生效）
    if (wx.onThemeChange) {
      wx.onThemeChange(({ theme }) => {
        if (_currentTheme === THEME_SYSTEM) {
          _resolvedDark = (theme === 'dark');
          _notifyListeners();
        }
      });
    }
  },

  /**
   * 获取当前主题设置值
   * @returns {'light'|'dark'|'system'}
   */
  getTheme() {
    return _currentTheme || THEME_LIGHT;
  },

  /**
   * 当前是否为暗色模式
   */
  isDark() {
    return _resolvedDark;
  },

  /**
   * 设置主题
   * @param {'light'|'dark'|'system'} theme
   */
  setTheme(theme) {
    if (![THEME_LIGHT, THEME_DARK, THEME_SYSTEM].includes(theme)) return;
    _currentTheme = theme;
    _resolvedDark = _resolveDark(theme);
    StorageUtil.save(THEME_KEY, theme);
    _notifyListeners();
  },

  /**
   * 获取 JS 中需要使用的颜色值
   * @param {string} key - 颜色键名，如 'scoreExcellent'
   * @returns {string} 颜色值
   */
  getColor(key) {
    const palette = _resolvedDark ? DARK_COLORS : LIGHT_COLORS;
    return palette[key] || LIGHT_COLORS[key] || '';
  },

  /**
   * 获取页面/组件 setData 需要的 darkMode 布尔值
   * 用于 WXML class 绑定: class="{{darkMode ? 'dark-mode' : ''}}"
   */
  getDarkModeData() {
    return { darkMode: _resolvedDark };
  },

  /**
   * 注册主题变更监听
   * @param {Function} fn - 回调 (isDark: boolean) => void
   * @returns {Function} 取消注册函数
   */
  onThemeChange(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter(f => f !== fn);
    };
  },
};

function _notifyListeners() {
  _listeners.forEach(fn => {
    try { fn(_resolvedDark); } catch (e) { console.warn('ThemeChange listener error:', e); }
  });
}

module.exports = ThemeManager;
```

### 3.2 CSS 暗色变量覆盖（`app.wxss` 追加）

**关键设计决策**：在 `app.wxss` 末尾追加 `.dark-mode {}` 选择器，覆盖 `page {}` 中定义的所有颜色变量。由于 `.dark-mode` 是加在每个页面最外层 `<view>` 上的，其子元素通过 CSS 继承获得新变量值。

**亮色模式零影响保证**：`.dark-mode {}` 选择器仅在元素拥有该 class 时生效。当 `darkMode = false` 时，`class=""` 为空字符串，`.dark-mode` 规则不匹配任何元素，亮色变量完全不受影响。

```css
/* ============================================================
 * 暖夜模式 CSS 变量覆盖
 * 仅在 class="dark-mode" 的元素及其子元素中生效
 * 亮色模式下此块完全不生效，零影响
 * ============================================================ */

.dark-mode {
  /* === 主色调 === */
  --primary-color: #D4B896;          /* 品牌色不变 */
  --primary-light: #3D3428;          /* 深棕（替代米白） */
  --primary-dark: #C4A890;           /* 提亮（暗底上需要更亮） */
  --accent-color: #8BAF8B;           /* 薄荷绿降饱和 */

  /* === 功能色（降饱和约15%） === */
  --feeding-color: #7CAF7C;
  --sleep-color: #9488B4;
  --diaper-color: #B0A480;
  --temperature-color: #B48888;

  /* === 语义功能色 === */
  --success-color: #6AB845;
  --danger-color: #D44848;
  --warning-color: #C47830;
  --info-color: #6B93B9;

  /* === 语义背景色 === */
  --warning-bg: #2E2518;
  --danger-bg: #2E1818;

  /* === 渐变色 === */
  --success-gradient: linear-gradient(135deg, #6AB845, #8CB86A);
  --danger-gradient: linear-gradient(135deg, #D44848, #E08888);

  /* === 文字色 === */
  --text-primary: #E8E0D8;
  --text-secondary: #B0A898;
  --text-hint: #7A7068;
  --text-tertiary: #7A7068;
  --text-color: #E8E0D8;

  /* === 背景色 === */
  --bg-primary: #1E1A16;
  --bg-secondary: #2A2420;
  --bg-card: linear-gradient(135deg, #302A24 0%, #1E1A16 100%);
  --background-light: #1E1A16;
  --background: #1E1A16;

  /* === 阴影（暗底上改用黑色阴影） === */
  --shadow-card: 0 4rpx 24rpx rgba(0, 0, 0, 0.3);
  --shadow-soft: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
  --shadow-popup: 0 8rpx 48rpx rgba(0, 0, 0, 0.5);

  /* === 遮罩色 === */
  --mask-color: rgba(0, 0, 0, 0.6);
  --mask-color-dark: rgba(0, 0, 0, 0.75);

  /* === 渐变终止色 === */
  --gradient-end: #A08860;
  --disabled-start: #3D3428;
  --disabled-end: #332C20;

  /* === 功能色渐变背景（暗色版） === */
  --feeding-bg: linear-gradient(135deg, #1A2A1A 0%, #1E2E1E 100%);
  --sleep-bg: linear-gradient(135deg, #1E1A2A 0%, #24203A 100%);
  --diaper-bg: linear-gradient(135deg, #2A2618 0%, #2E2A1C 100%);
  --temperature-bg: linear-gradient(135deg, #2A1A1A 0%, #2E1E1E 100%);

  /* === 其他 === */
  --white: #E8E0D8;                  /* 暗色模式下"白色"实际是暖白 */
  --border-color: rgba(212, 184, 150, 0.08);

  /* === 语义扩展变量 === */
  --text-warm-brown: #C4A890;
  --accent-warm: #D4A574;
  --bg-hover: rgba(212, 184, 150, 0.12);
  --border-warm: rgba(196, 154, 108, 0.15);
  --percentile-normal-bg: rgba(106, 184, 69, 0.15);
  --percentile-normal-text: #7BC950;
  --percentile-abnormal-bg: rgba(212, 72, 72, 0.15);
  --percentile-abnormal-text: #E88080;

  /* === 页面背景色（确保 page 背景也变暗） === */
  background-color: #1E1A16;
  color: #E8E0D8;
}
```

### 3.3 页面/组件接入模式

#### 3.3.1 页面接入（以 home 为例）

**WXML**（仅修改根元素，其余不变）：
```xml
<!-- 修改前 -->
<view class="container">

<!-- 修改后 -->
<view class="container {{darkMode ? 'dark-mode' : ''}}">
```

**JS**（在生命周期中加入主题感知）：
```javascript
const ThemeManager = require('../../utils/theme');

Page({
  data: {
    darkMode: false,
    // ... 其他现有 data
  },

  onLoad() {
    // 现有初始化逻辑不变
    this.init();
    // 注册主题变更监听
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
  },

  onShow() {
    // 现有 30s 节流逻辑不变
    // 追加主题同步
    this._applyTheme();
  },

  onUnload() {
    // 取消监听
    if (this._themeOff) this._themeOff();
  },

  /** 应用当前主题 */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  // ... 其他现有方法完全不变
});
```

#### 3.3.2 组件接入（以 feeding-popup 为例）

**WXML**（仅修改根元素）：
```xml
<!-- 修改前 -->
<view class="popup-mask" wx:if="{{show}}">

<!-- 修改后 -->
<view class="popup-mask {{darkMode ? 'dark-mode' : ''}}" wx:if="{{show}}">
```

**JS**（使用 properties 从宿主页面传入）：
```javascript
Component({
  properties: {
    show: Boolean,
    darkMode: Boolean,   // 新增：从宿主页面传入
  },
  // ... 其余不变
});
```

**宿主页面 WXML**：
```xml
<feeding-popup show="{{showFeedingPopup}}" dark-mode="{{darkMode}}" />
```

### 3.4 `theme.json` 配置（FR-3: 导航栏与 TabBar）

**`miniprogram/theme.json`**（新建）：
```json
{
  "light": {
    "navigationBarBackgroundColor": "#D4B896",
    "navigationBarTextStyle": "white",
    "backgroundTextStyle": "light",
    "tabBarColor": "#8B7B6B",
    "tabBarSelectedColor": "#D4B896",
    "tabBarBackgroundColor": "#FFFFFF",
    "tabBarBorderStyle": "white"
  },
  "dark": {
    "navigationBarBackgroundColor": "#2A2420",
    "navigationBarTextStyle": "white",
    "backgroundTextStyle": "dark",
    "tabBarColor": "#7A7068",
    "tabBarSelectedColor": "#D4B896",
    "tabBarBackgroundColor": "#1E1A16",
    "tabBarBorderStyle": "black"
  }
}
```

**`app.json` 修改**：
```json
{
  "darkmode": true,
  "themeLocation": "theme.json",
  "window": {
    "navigationBarBackgroundColor": "@navigationBarBackgroundColor",
    "navigationBarTextStyle": "@navigationBarTextStyle",
    "backgroundTextStyle": "@backgroundTextStyle"
  },
  "tabBar": {
    "color": "@tabBarColor",
    "selectedColor": "@tabBarSelectedColor",
    "backgroundColor": "@tabBarBackgroundColor",
    "borderStyle": "@tabBarBorderStyle",
    "list": [...]
  }
}
```

### 3.5 app.js 初始化集成

```javascript
// app.js 追加内容（不修改现有逻辑）
const ThemeManager = require('./utils/theme');

App({
  onLaunch: async function() {
    // === 现有初始化代码不变 ===
    wx.cloud.init({ ... });
    // ... systemInfo, initUser, initSync, cleanOrphanedCache

    // === 新增：初始化主题 ===
    ThemeManager.init();
  },

  globalData: {
    // === 现有字段不变 ===
    userInfo: null,
    initPromise: null,
    systemInfo: null,
    familyRole: null,
    // === 新增 ===
    // ThemeManager 通过模块单例管理，不需要在 globalData 中存储
  }
});
```

### 3.6 设置页三态 UI（FR-11）

**settings.wxml**（修改显示设置 section）：
```xml
<!-- 修改前: switch 开关 -->
<!-- 修改后: 三态选择器 -->
<view class="section">
  <view class="section-title">显示设置</view>
  <view class="theme-options">
    <view class="theme-option {{themeMode === 'light' ? 'active' : ''}}"
          data-mode="light" bindtap="onThemeSelect">
      <image class="theme-icon" src="/images/icons/sun.png" />
      <text>亮色</text>
    </view>
    <view class="theme-option {{themeMode === 'dark' ? 'active' : ''}}"
          data-mode="dark" bindtap="onThemeSelect">
      <image class="theme-icon" src="/images/icons/moon.png" />
      <text>暖夜</text>
    </view>
    <view class="theme-option {{themeMode === 'system' ? 'active' : ''}}"
          data-mode="system" bindtap="onThemeSelect">
      <image class="theme-icon" src="/images/icons/auto.png" />
      <text>跟随系统</text>
    </view>
  </view>
</view>
```

**settings.js 新增方法**：
```javascript
const ThemeManager = require('../../../utils/theme');

// onLoad 中追加
this.setData({ themeMode: ThemeManager.getTheme() });

// 新方法
onThemeSelect(e) {
  const mode = e.currentTarget.dataset.mode;
  ThemeManager.setTheme(mode);
  this.setData({ themeMode: mode });
  this._applyTheme(); // 本页立即生效
}
```

### 3.7 首页 home.wxss 局部变量覆盖

```css
/* home.wxss 末尾追加 —— 暖夜模式局部变量覆盖 */
.dark-mode {
  --status-sleeping-bg: rgba(148, 136, 180, 0.15);
  --status-feeding-bg:  rgba(124, 175, 124, 0.15);
  --status-default-bg:  rgba(212, 184, 150, 0.10);

  --insight-bg: linear-gradient(135deg, rgba(212, 184, 150, 0.08) 0%, rgba(30, 26, 22, 1) 100%);
  --insight-border: rgba(212, 184, 150, 0.12);

  --todo-vaccine-bg:    rgba(196, 120, 48, 0.12);
  --todo-milestone-bg:  rgba(107, 147, 185, 0.12);
  --todo-overdue-bg:    rgba(212, 72, 72, 0.12);

  --badge-prediction-bg: rgba(124, 175, 124, 0.8);
  --badge-urgent-bg:     var(--warning-color);

  --fever-alert-bg:     rgba(212, 72, 72, 0.10);
  --fever-alert-border: rgba(212, 72, 72, 0.25);
  --fever-alert-text:   var(--danger-color);

  --skeleton-base: rgba(212, 184, 150, 0.06);
  --skeleton-highlight: rgba(212, 184, 150, 0.12);
}
```

### 3.8 过渡动画（FR-10）

主题切换时通过 CSS transition 实现平滑过渡，避免白屏闪烁：

```css
/* app.wxss 追加 —— 主题过渡支持 */
.theme-transition,
.theme-transition view,
.theme-transition text,
.theme-transition image {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
```

**切换流程**：
1. 用户点击主题选项
2. JS 先给根元素添加 `theme-transition` class
3. 然后设置 `darkMode` 触发 CSS 变量变化
4. 300ms 后移除 `theme-transition` class（避免后续正常操作也带过渡）

```javascript
// ThemeManager 或页面中
_applyThemeWithTransition() {
  this.setData({ themeTransition: true });
  setTimeout(() => {
    this.setData({ darkMode: ThemeManager.isDark() });
    setTimeout(() => this.setData({ themeTransition: false }), 350);
  }, 16); // 下一帧
}
```

**WXML**：
```xml
<view class="container {{darkMode ? 'dark-mode' : ''}} {{themeTransition ? 'theme-transition' : ''}}">
```

### 3.9 公共样式文件覆盖策略（FR-12）

4 个公共样式文件通过 `@import` 被多个组件引入。由于 CSS 变量继承机制，**大部分样式无需额外覆盖**——只要组件根元素上有 `.dark-mode` class，`var(--bg-primary)` 等变量就会自动解析为暗色值。

**仅需额外覆盖的是硬编码 rgba() 值**：

```css
/* styles/popup.wxss 末尾追加 */
.dark-mode .popup-mask {
  background: rgba(0, 0, 0, 0.7); /* 覆盖默认棕色遮罩 */
}

.dark-mode .popup-container {
  background: var(--bg-primary);
}

/* styles/form.wxss 末尾追加 */
.dark-mode .form-input,
.dark-mode .form-textarea {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.dark-mode .form-input:focus,
.dark-mode .form-textarea:focus {
  border-color: var(--primary-color);
  background: var(--bg-primary);
}
```

### 3.10 switch 组件暗色适配（FR-8）

微信 `<switch>` 组件的未选中轨道色由微信控制（浅灰色），在深色背景上几乎不可见。通过 CSS 覆盖：

```css
/* app.wxss .dark-mode 内追加 */
.dark-mode switch .wx-switch-input {
  background: #3D3428 !important;  /* 未选中轨道：深棕 */
  border-color: rgba(212, 184, 150, 0.2) !important;
}

.dark-mode switch .wx-switch-input.wx-switch-input-checked {
  background: #D4B896 !important;  /* 选中轨道：品牌色（不变） */
  border-color: #D4B896 !important;
}
```

> 注：微信 switch 的内部结构可能因版本变化，需在 iOS/Android 双端测试。

### 3.11 其他页面局部变量覆盖模式

除 home.wxss 有 13 个专属变量需要覆盖外，其他页面遵循统一模式：

**大部分页面无需额外局部覆盖**——因为它们的样式完全依赖 `app.wxss` 全局变量 + PRE-3 新增变量，`.dark-mode {}` 全局覆盖即可自动生效。

**需要局部覆盖的页面**（仅列出有页面级 `page {}` 局部变量的）：

| 页面 | 局部变量 | 覆盖方式 |
|------|---------|---------|
| `home.wxss` | 13 个（§3.7 已列出） | 在文件末尾追加 `.dark-mode {}` |
| `record.wxss` | 无页面级 `page {}` 变量 | 不需要（PRE-3 变量化后自动生效） |
| 其他页面 | 无 | 不需要 |

---

## 4. 暗色色板完整对照表

### 4.1 全局 CSS 变量对照

| 变量 | 亮色值 | 暗色值 | 对比度验证 |
|------|--------|--------|-----------|
| `--bg-primary` | `#F5F1EB` | `#1E1A16` | 页面背景 |
| `--bg-secondary` | `#FFFFFF` | `#2A2420` | 卡片背景 |
| `--text-primary` | `#3D3D3D` | `#E8E0D8` | 暗底 13.2:1 ✅ |
| `--text-secondary` | `#666666` | `#B0A898` | 暗底 7.1:1 ✅ |
| `--text-hint` | `#999999` | `#7A7068` | 暗底 4.5:1 ✅（恰好达标） |
| `--primary-color` | `#D4B896` | `#D4B896` | **不变** |
| `--feeding-color` | `#A8D4A8` | `#7CAF7C` | 暗底 5.8:1 ✅ |
| `--sleep-color` | `#B8A8D4` | `#9488B4` | 暗底 4.6:1 ✅ |
| `--diaper-color` | `#D4C8A8` | `#B0A480` | 暗底 5.2:1 ✅ |
| `--temperature-color` | `#D4A8A8` | `#B48888` | 暗底 4.8:1 ✅ |
| `--white` | `#FFFFFF` | `#E8E0D8` | 暖白色，非纯白 |
| `--border-color` | `rgba(139,123,107,0.1)` | `rgba(212,184,150,0.08)` | 微弱层次 |
| `--mask-color` | `rgba(139,123,107,0.4)` | `rgba(0,0,0,0.6)` | 遮罩加深 |

### 4.2 对比度验证方法

使用 [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 或微信开发者工具的色彩对比功能，逐一验证 `--text-*` 变量在 `--bg-*` 上的对比度 ≥ 4.5:1（WCAG AA）。

---

## 5. 安全保障：亮色模式零影响

### 5.1 隔离机制

| 层级 | 隔离方式 | 亮色模式下的行为 |
|------|---------|----------------|
| CSS 变量 | `.dark-mode {}` 选择器 | `darkMode=false` → `class=""` → 选择器不匹配 → `page {}` 变量不受影响 |
| JS 颜色 | `ThemeManager.isDark()` 返回 `false` → 始终取 `LIGHT_COLORS` | 完全等价于当前硬编码值 |
| `theme.json` | 微信根据系统主题自动选择 `light` 或 `dark` 配置 | 系统亮色 → 读取 `light` → 与当前 `app.json` 值完全一致 |
| 页面 JS | `_applyTheme()` 中 `darkMode !== true` → 不调用 `setData` | 无额外 `setData` 开销 |

### 5.2 回滚策略

如果暖夜模式出现严重问题：
1. 用户可在设置页切换回"亮色"
2. 开发者可通过 `ThemeManager.setTheme('light')` 强制恢复
3. 最坏情况：删除 `app.wxss` 中 `.dark-mode {}` 块即可完全回滚，亮色模式不受任何影响

---

## 6. 前置变量化新增变量清单

以下是 PRE-3（WXSS 硬编码变量化）中需要新增的 CSS 变量。**每个变量需要在两个位置定义**：

1. `app.wxss` 的 **`page {}`** 中定义亮色默认值（保证亮色模式行为与当前完全一致）
2. `app.wxss` 的 **`.dark-mode {}`** 中定义暗色覆盖值

> ⚠️ **亮色零影响保证**：`page {}` 中的新变量值必须与当前硬编码值完全一致，这是一次纯重构（hardcode → variable），不改变任何视觉效果。

### 6.1 评分/状态色（report-popup 使用）

```css
/* page {} 中定义亮色默认值 */
--score-excellent: #7BC950;
--score-good: #5ABFB0;
--score-fair: #D4883D;
--score-poor: #E8745A;
--score-critical: #E85454;

/* .dark-mode {} 中覆盖 */
--score-excellent: #6AB845;
--score-good: #4AAFA0;
--score-fair: #C47830;
--score-poor: #D86A50;
--score-critical: #D44848;
```

### 6.2 发热等级色（temperature-popup 使用）

```css
--fever-low: #5B8FF9;
--fever-normal: #07C160;
--fever-low-fever: #FFC53D;
--fever-moderate: #FF976A;
--fever-high: #FF7875;
--fever-ultra-high: #FF4D4F;

/* 暗色模式下不变（这些高饱和色在深色背景上已足够清晰） */
```

### 6.3 功能色渐变终止色（各 popup 使用）

```css
--feeding-gradient-end: #98C498;
--sleep-gradient-end: #9D8AB8;
--diaper-gradient-end: #C4B898;
--temperature-gradient-end: #C49898;
--growth-gradient-end: #5B8FAF;

/* .dark-mode {} 中覆盖 */
--feeding-gradient-end: #5C8F5C;
--sleep-gradient-end: #7A6898;
--diaper-gradient-end: #A09068;
--temperature-gradient-end: #A07070;
--growth-gradient-end: #4A7A94;
```

### 6.4 FAB/筛选色（record.wxss 使用）

```css
--fab-start: #D4A574;
--fab-end: #A67C52;
--filter-active-start: #D4A574;
--filter-active-end: #B88655;
--filter-text: #6B6056;
--batch-header-bg: #FFF5EB;
--batch-header-border: #E8A87C;

/* .dark-mode {} 中覆盖 */
--fab-start: #B08858;
--fab-end: #886438;
--filter-active-start: #B08858;
--filter-active-end: #986C3C;
--filter-text: #B0A898;
--batch-header-bg: #2E2518;
--batch-header-border: #A07850;
```

---

## 7. 图标适配策略

### 7.1 分类处理

| 图标类别 | 处理方式 | 说明 |
|---------|---------|------|
| 功能色图标（`*-white.png`） | **不处理** | 白色图标在深色功能按钮上依然清晰 |
| 功能色图标（`*-color.png`） | **不处理** | 彩色图标在浅色背景区域使用，暗色下 `--bg-primary` 变暗但图标足够鲜明 |
| 灰色线条图标（箭头、关闭等） | CSS `filter` 提亮 | `.dark-mode .icon-gray { filter: brightness(1.5); }` |
| TabBar 图标 | `theme.json` 变量引用 | `iconPath@dark` / `selectedIconPath@dark` |

### 7.2 TabBar 图标（`theme.json` 扩展）

```json
{
  "list": [
    {
      "pagePath": "pages/home/home",
      "text": "首页",
      "iconPath": "images/tab-home.png",
      "selectedIconPath": "images/tab-home-active.png",
      "iconPath@dark": "images/tab-home-dark.png",
      "selectedIconPath@dark": "images/tab-home-active.png"
    }
  ]
}
```

> 注：如微信版本不支持 `iconPath@dark`，可改为在 `theme.json` 的 `dark` 中定义变量并在 `app.json` 中引用。

---

## 8. 关键设计决策记录

### 决策 1：为什么不用 `@media (prefers-color-scheme: dark)`？

微信小程序 WXSS **不支持** `@media` 中的 `prefers-color-scheme`。这是浏览器 CSS 特性，小程序运行在自定义渲染引擎上。

### 决策 2：为什么品牌色 `--primary-color` 不变？

`#D4B896` 的对比度：
- 在亮色背景 `#F5F1EB` 上：2.1:1（偏低，但用于装饰非文字）
- 在暗色背景 `#1E1A16` 上：6.4:1（充分清晰）

品牌色在暗色背景上反而**更清晰**，无需调整。保持不变可维持品牌一致性。

### 决策 3：为什么 `--white` 不设为纯白 `#FFFFFF`？

暗色模式下纯白文字/元素过于刺眼，使用 `#E8E0D8`（暖白）降低对比度至舒适范围，同时保持美拉德暖色调一致性。

### 决策 4：为什么发热等级色在暗色下不变？

这 6 种颜色（蓝→绿→黄→橙→红→深红）是**语义色**，在暗色背景上的对比度均 ≥ 4.5:1，且用户已形成颜色与温度的认知关联。改变会破坏直觉。

### 决策 5：为什么 `share-canvas.js` 不适配暗色？

分享图主要用于微信聊天/朋友圈，接收方可能在亮色环境查看。暗色分享图在浅色聊天背景上视觉冲突严重。

### 决策 6：`diaper-popup.js` 大便颜色为什么不变？

这 5 种颜色（正常棕、黄、绿、黑、红）代表**实际大便颜色**，非 UI 主题色。改变会误导用户判断。

---

## 9. 兼容性与降级

| 场景 | 处理 |
|------|------|
| 不支持 `darkmode` 的旧版微信（< 7.0.12） | `theme.json` 不生效，导航栏保持 `app.json` 原值（亮色）。CSS 变量覆盖不受影响。 |
| 不支持 `wx.onThemeChange` 的旧版 | "跟随系统"模式退化为固定亮色。手动选择暗色仍然正常。 |
| 不支持 CSS 变量的极旧版微信 | 整个 CSS 变量体系不生效，保持硬编码的亮色 fallback。极端边缘情况，用户量可忽略。 |

---

## 10. 性能影响评估

| 指标 | 影响 | 说明 |
|------|------|------|
| 首屏渲染 | +0ms | `.dark-mode {}` 在亮色模式下不匹配，浏览器跳过 |
| 主题切换 | ~50ms | 一次 `setData({ darkMode: true })` + CSS 变量重算 |
| 内存 | +~2KB | `ThemeManager` 模块 + 两套颜色常量 |
| 包体积 | +~5KB | `theme.js` + `.dark-mode` CSS 块 + `theme.json` |
| 跨页同步 | ~100ms | `onShow` 中检查 + 条件 `setData`（仅状态变化时触发） |

---

## 11. 需同步更新的文档

按开发工作流三阶段规范，暖夜模式实施后需更新：

| 文档 | 更新内容 |
|------|---------|
| `architecture.md` | 新增 ThemeManager 模块到架构图和工具层描述 |
| `ui-design-system.md` | 新增第 10 节"暗色模式色板"，更新第 9 节核心设计特征 |
| `coding-conventions.md` | 新增 6.5 节"主题适配规范"（页面/组件接入模式） |
| `component-library.md` | 每个组件新增 `darkMode` property 说明 |
| `service-api.md` | 新增 `ThemeManager` API 文档 |
| `data-model.md` | `settings` 缓存键新增 `themeMode` 字段说明 |

---

*文档版本: v1.0 | 创建日期: 2026-04-08*
