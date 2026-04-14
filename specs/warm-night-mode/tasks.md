# 实施计划 - 暖夜模式（深色模式）

> **需求文档**: `specs/warm-night-mode/requirements.md` v1.1
> **设计文档**: `specs/warm-night-mode/design.md` v1.0
> **版本**: v1.0 | **日期**: 2026-04-08 | **状态**: ✅ 已完成（2026-04-08）

---

## 实施概览

**总任务数**: 25 个
**预计总工时**: ~40 小时
**关键原则**: 前置工作（PRE）保证亮色零影响，主线工作逐页/逐组件铺开

### 里程碑

| 里程碑 | 包含任务 | 交付物 | 验收标准 |
|--------|---------|--------|---------|
| M1: 基础架构就绪 | 1.1 ~ 1.4 | ThemeManager + theme.json + app.wxss 暗色块 | 设置页可切换三态，首页背景/文字色切换正常 |
| M2: JS 颜色集中化 | 2.1 ~ 2.4 | `utils/theme.js` 颜色迁移完成 | 亮色模式视觉不变，JS 颜色均从 ThemeManager 获取 |
| M3: WXSS 变量化 P0 | 3.1 ~ 3.3 | 公共样式 + 首页 + 记录页变量化 | 亮色模式视觉不变，新增 CSS 变量在 page{} 中有亮色默认值 |
| M4: WXSS 变量化 P1 | 3.4 | 4 个高频弹窗变量化 | 亮色模式视觉不变 |
| M5: WXSS 变量化 P2 | 3.5 ~ 3.6 | report-popup + growth 变量化 | 亮色模式视觉不变 |
| M6: WXSS 变量化 P3 | 3.7 | 低频页面/组件变量化 | 亮色模式视觉不变 |
| M7: 暗色适配 P0 | 4.1 ~ 4.4 | 首页 + 记录 + 设置 + TabBar 暗色完成 | 核心路径可在暖夜模式下正常使用 |
| M8: 暗色适配 P1 | 4.5 ~ 4.7 | 发现 + 我的 + auth 暗色完成 | 主包所有页面暗色可用 |
| M9: 暗色适配 P2 | 4.8 ~ 4.10 | 分包页面暗色完成 | 全部 18 页面暗色可用 |
| M10: 弹窗 + 收尾 | 5.1 ~ 5.4 | 10 个弹窗 + 图标 + 过渡动画 + 文档 | 功能完整交付 |

---

## Phase 1: 基础架构（PRE-1）

### 1.1 创建 ThemeManager 模块

- [ ] 创建 `miniprogram/utils/theme.js`
  - 实现单例 ThemeManager 对象（`init/getTheme/setTheme/isDark/getColor/onThemeChange`）
  - 定义 `LIGHT_COLORS` 和 `DARK_COLORS` 双套颜色映射（design §3.1）
  - 使用 `StorageUtil` 持久化主题偏好，key = `app_theme_mode`
  - 监听 `wx.onThemeChange`（仅 system 模式生效）
  - 导出 `THEME_LIGHT/THEME_DARK/THEME_SYSTEM` 常量
- **验证**: 在控制台调用 `ThemeManager.setTheme('dark')`/`isDark()` 工作正常
- _需求: FR-1, FR-7, FR-11_

### 1.2 创建 theme.json + 修改 app.json

- [ ] 新建 `miniprogram/theme.json`（design §3.4 中的完整内容）
- [ ] 修改 `miniprogram/app.json`:
  - 添加 `"darkmode": true` 和 `"themeLocation": "theme.json"`
  - 将 `window` 中 3 个颜色值替换为 `@变量` 引用
  - 将 `tabBar` 中 4 个颜色值替换为 `@变量` 引用
- **验证**: 在微信开发者工具中切换系统暗色模式，导航栏和 TabBar 颜色变化
- **⚠️ 亮色零影响**: `theme.json` 的 `light` 配置值与当前 `app.json` 硬编码值完全一致
- _需求: FR-3, FR-8_

### 1.3 app.wxss 追加暗色变量块

- [ ] 在 `miniprogram/app.wxss` 末尾追加 `.dark-mode {}` 块（design §3.2 的完整 CSS）
- [ ] 追加 `.theme-transition` 过渡动画规则（design §3.8）
- [ ] 追加 switch 组件暗色覆盖（design §3.10）
- **验证**: 手动给某个 view 添加 `class="dark-mode"` 确认变量覆盖生效
- **⚠️ 亮色零影响**: `.dark-mode {}` 在无该 class 时完全不匹配
- _需求: FR-2, FR-6, FR-8, FR-10_

### 1.4 app.js 初始化集成 + 设置页三态 UI

- [ ] 在 `miniprogram/app.js` 的 `onLaunch` 末尾追加 `ThemeManager.init()`（design §3.5）
- [ ] 改造 `packageSocial/pages/settings/settings.wxml`:
  - 将显示设置区的 `<switch>` 替换为三态选择器（design §3.6）
  - 新增 `.theme-options` / `.theme-option` 样式
- [ ] 改造 `packageSocial/pages/settings/settings.js`:
  - 引入 ThemeManager，`onLoad` 中读取当前主题
  - 实现 `onThemeSelect()` 方法
  - 接入 `_applyTheme()` 页面主题同步模式
  - 在根 `<view>` 绑定 `{{darkMode ? 'dark-mode' : ''}}`
- [ ] 迁移旧的 `settings.darkMode` 数据：若存在旧值 `true`，自动映射为 `ThemeManager.setTheme('dark')`
- **验证**: 在设置页点击"暖夜"后，本页背景/文字立即切换；点击"亮色"恢复
- _需求: FR-1, FR-11, FR-4 AC-4_

---

## Phase 2: JS 颜色集中化（PRE-2）

### 2.1 迁移 reportDataHelper.js 颜色

- [ ] 在 `services/reportDataHelper.js` 中引入 ThemeManager
- [ ] 将 `STATUS_CONFIG` 中 15 处硬编码颜色（`color`/`bgColor`）改为 `ThemeManager.getColor()` 调用
- [ ] 将生长评估颜色映射（5 处）改为 ThemeManager 调用
- **验证**: 亮色模式下报告弹窗的评分颜色、状态标签颜色与修改前完全一致
- **⚠️ 亮色零影响**: `LIGHT_COLORS` 值与原硬编码值一一对应
- _需求: FR-7 AC-1_

### 2.2 迁移 timeline.js + discover.js 颜色

- [ ] `components/timeline/timeline.js`: 将 `_getTypeColor()` 方法中 6 处颜色改为 ThemeManager 调用
- [ ] `pages/discover/discover.js`: 将 `data.menuItems` 中 4 处 `iconBg` 改为动态获取
  - `onLoad` 时调用 `_buildMenuColors()` 构建颜色
  - `onShow` 时若主题变化则重新构建
- **验证**: 亮色下时间线圆点色、发现页菜单图标背景与修改前完全一致
- _需求: FR-7 AC-1_

### 2.3 迁移 growth.js 百分位线颜色

- [ ] `packageGrowth/pages/growth/growth.js`: 将 5 处百分位线颜色配置改为 ThemeManager 调用
- **验证**: 亮色下生长曲线页百分位线颜色不变
- _需求: FR-7 AC-1_

### 2.4 统一 wx.showModal confirmColor

- [ ] 创建辅助函数 `ThemeManager.getConfirmColor(type)` （type: 'danger'|'warn'|'neutral'）
- [ ] 全局搜索 `confirmColor: '#` 约 12 处，逐一替换为 `ThemeManager.getConfirmColor()` 调用
  - `home.js`（2 处）、`record.js`（2 处）、`profile.js`（1 处）
  - `baby-list.js`（1 处）、`vaccine.js`（1 处）、`growth.js`（1 处）
  - `milestone.js`（1 处）、`family.js`（3 处）、`settings.js`（2 处）
- [ ] `diaper-popup.js` 的 5 处大便颜色**不迁移**（实际颜色，design §8 决策 6）
- **验证**: 亮色下所有确认弹窗按钮颜色与修改前一致
- _需求: FR-7 AC-2, AC-3_

---

## Phase 3: WXSS 硬编码变量化（PRE-3）

> ⚠️ **每个子任务的亮色零影响验证**: 修改后在亮色模式下逐页对比截图，确认视觉无差异。

### 3.1 公共样式文件变量化（4 文件，~9 处 rgba）

- [ ] `styles/popup.wxss`: 将遮罩 `rgba` 背景改为 `var(--mask-color)` / `var(--mask-color-dark)`
  - 追加 `.dark-mode .popup-mask` 和 `.dark-mode .popup-container` 覆盖（design §3.9）
- [ ] `styles/form.wxss`: 将 input/textarea 背景/边框的 `rgba` 改为 CSS 变量
  - 追加 `.dark-mode .form-input` 等覆盖（design §3.9）
- [ ] `styles/page-header.wxss`: 将渐变背景的 `rgba` 值改为 CSS 变量
- [ ] `styles/loading.wxss`: 将 spinner 的 `rgba` 值改为 CSS 变量
- **在 `app.wxss` `page {}` 中新增对应亮色默认变量**
- _需求: FR-12_

### 3.2 首页变量化（home.wxss，~8 处 hex）

- [ ] 将快捷入口 `.action-btn.feeding/sleep/diaper/temperature/growth` 的渐变硬编码色
  改为 `var(--feeding-color)`/`var(--feeding-gradient-end)` 等变量
- [ ] 在 `app.wxss` `page {}` 中新增 `--feeding-gradient-end` 等 5 个亮色变量（design §6.3）
- [ ] 在 `app.wxss` `.dark-mode {}` 中追加对应暗色值
- [ ] 在 `home.wxss` 末尾追加 `.dark-mode {}` 局部变量覆盖（design §3.7，13 个变量）
- _需求: FR-4 AC-1,2_

### 3.3 记录页变量化（record.wxss，13 处 hex）

- [ ] FAB 按钮渐变色 → `var(--fab-start)` / `var(--fab-end)`
- [ ] 筛选项 active 渐变 → `var(--filter-active-start)` / `var(--filter-active-end)`
- [ ] 筛选项文字色 → `var(--filter-text)`
- [ ] 批量模式 header 背景/边框 → `var(--batch-header-bg)` / `var(--batch-header-border)`
- [ ] FAB 菜单图标渐变（5 个类型）→ 复用 `var(--feeding-color)` + `var(--feeding-gradient-end)` 等
- [ ] 在 `app.wxss` `page {}` 新增 FAB/筛选相关 7 个亮色变量（design §6.4）
- [ ] 在 `app.wxss` `.dark-mode {}` 追加对应暗色值
- _需求: FR-4 AC-3_

### 3.4 高频弹窗变量化（4 个弹窗，13 处 hex）

- [ ] `feeding-popup.wxss`（2 处）: 渐变终止色 `#98C498` → `var(--feeding-gradient-end)`
- [ ] `sleep-popup.wxss`（3 处）: 渐变终止色 → `var(--sleep-gradient-end)` 等
- [ ] `diaper-popup.wxss`（1 处）: 渐变终止色 → `var(--diaper-gradient-end)`
- [ ] `temperature-popup.wxss`（7 处）:
  - 6 处发热等级颜色 → `var(--fever-low)` ~ `var(--fever-ultra-high)`（design §6.2）
  - 1 处提交按钮渐变终止色 → `var(--temperature-gradient-end)`
  - 在 `app.wxss` `page {}` 新增 6 个 `--fever-*` 亮色变量
- _需求: FR-5 AC-3_

### 3.5 report-popup 变量化（38 处 hex — 最大单文件）

- [ ] 评分 5 级颜色（color + background 各 5 处 = 15 处）→ `var(--score-excellent)` 等
- [ ] 状态标签 4 种（4 处）→ `var(--status-normal)` / `var(--status-warning)` 等
  - 注：可复用 `--success-color` / `--warning-color` / `--danger-color`
- [ ] 密度色块 5 级（5 处）→ 新增 `--density-level-0` ~ `--density-level-4`
- [ ] 范围条指示点 3 种（3 处）→ 复用 `--success-color` / `--warning-color`
- [ ] 百分位标签 3 种（3 处）→ 复用语义色变量
- [ ] 疫苗进度条/文字 4 处 → 复用语义色变量 + 新增 `--vaccine-progress`
- [ ] indicator-change 2 处 → 复用语义色变量
- [ ] 在 `app.wxss` `page {}` 新增评分 5 个 + 密度 5 个 + 疫苗 1 个 = 11 个亮色变量
- [ ] 在 `app.wxss` `.dark-mode {}` 追加对应 11 个暗色值（design §6.1）
- _需求: FR-5 AC-4_

### 3.6 growth.wxss 变量化（17 处 hex）

- [ ] 百分位颜色 3 处 → 复用 `--percentile-normal-text` 等已有变量 + 新增 `--percentile-warning`
- [ ] 数据卡片背景/边框 5 处 → 新增 `--growth-card-bg` / `--growth-border`
- [ ] 图表元素色 9 处 → 部分复用功能色变量，部分新增
- [ ] 在 `app.wxss` 补充亮色/暗色变量
- _需求: FR-4 AC-8_

### 3.7 低频页面/组件变量化（批次 4，~20 处 hex）

- [ ] `icon/icon.wxss`（7 处）: `--icon-color` 改为引用全局语义色变量
- [ ] `discover.wxss`（6 处）: WHO/CDC/中国标准图标渐变 → 新增 3 个 `--ref-icon-*` 变量
- [ ] `profile.wxss`（2 处）: 角色 badge 色 → 新增 `--role-badge-color`；退出按钮色 → `--logout-text`
- [ ] `vaccine.wxss`（2 处）+ `family.wxss`（2 处）+ `app.wxss`（2 处禁用按钮）→ 变量化
- [ ] 剩余组件（baby-edit-popup/growth-popup/easter-egg-popup/toast，共 4 处）→ 变量化
- _需求: FR-4 AC-5,6,8,9,10,11_

---

## Phase 4: 暗色模式页面适配

> 前置条件：Phase 1-3 已完成。从此阶段开始，每个任务同时在亮色和暗色下验证。

### 4.1 P0-首页暗色适配

- [ ] `pages/home/home.wxml`: 根 `<view>` 绑定 `{{darkMode ? 'dark-mode' : ''}}`
- [ ] `pages/home/home.js`: 引入 ThemeManager，追加 `_applyTheme()` + `onThemeChange` 监听 + `onShow` 同步
- [ ] 传递 `dark-mode="{{darkMode}}"` 给所有子组件：
  - `baby-card`、`timeline`、`feeding-popup`、`sleep-popup`、`diaper-popup`、`temperature-popup`、`growth-popup`、`easter-egg-popup`、`easter-egg-toast`
- [ ] 验证: 暗色下问候语、概览 4 色统计、快捷入口按钮、状态横幅、AI 洞察、时间线、骨架屏全部正确
- _需求: FR-1, FR-4 AC-1,2_

### 4.2 P0-记录页暗色适配

- [ ] `pages/record/record.wxml`: 根 `<view>` 绑定暗色 class
- [ ] `pages/record/record.js`: 接入主题同步模式
- [ ] 传递 `dark-mode` 给子组件（insight-section、timeline、6 个 popup）
- [ ] 验证: 暗色下筛选栏、FAB 按钮、日期弹窗、Action Sheet、概览统计、时间线全部正确
- _需求: FR-1, FR-4 AC-3_

### 4.3 P0-设置页暗色验证

- [ ] 任务 1.4 已完成设置页接入，此处做全面验证
- [ ] 验证: 三态选择器 active 态、switch 组件轨道色（§3.10）、危险操作项红色背景、菜单箭头可见性
- _需求: FR-4 AC-4, FR-8 AC-3_

### 4.4 TabBar 图标暗色适配

- [ ] 准备 4 个暗色版 TabBar 图标（`tab-home-dark.png` 等），或通过 `theme.json` 变量引用
- [ ] 更新 `theme.json` 和/或 `app.json` TabBar list 配置
- [ ] 验证: 暗色下 TabBar 图标清晰可见，亮色下图标不变
- _需求: FR-3 AC-4_

### 4.5 P1-发现页暗色适配

- [ ] `pages/discover/discover.wxml` + `.js`: 接入主题同步
- [ ] `discover.js`: `onShow` 时若主题变化则重建 `menuItems` 颜色
- [ ] 验证: 暗色下待办卡片、菜单图标 bg、参考标准图标、信息弹窗全部正确
- _需求: FR-4 AC-5_

### 4.6 P1-我的页暗色适配

- [ ] `pages/profile/profile.wxml` + `.js`: 接入主题同步
- [ ] 验证: 暗色下用户卡片、家庭卡片、功能菜单卡片层次感、退出按钮可见
- _需求: FR-4 AC-6_

### 4.7 P1-登录页暗色适配

- [ ] `pages/auth/auth.wxml` + `.js`: 接入主题同步
- [ ] 为 auth 页面的全屏渐变背景设计暗色方案（21 处 rgba 需逐一审查并调整不透明度）
- [ ] 验证: 暗色下选项卡片、邀请码弹窗、成功弹窗背景对比度达标
- _需求: FR-4 AC-7_

### 4.8 P2-分包 packageGrowth 暗色适配

- [ ] `growth/growth.wxml` + `.js`: 接入主题同步
  - 百分位线颜色已在 2.3 中通过 ThemeManager 动态获取
  - 数据卡片/WHO 弹窗依赖 CSS 变量自动生效
- [ ] `vaccine/vaccine.wxml` + `.js`: 接入主题同步
- [ ] `milestone/milestone.wxml` + `.js`: 接入主题同步
- [ ] `baby-detail/baby-detail.wxml` + `.js`: 接入主题同步
- [ ] 验证: 4 个分包页面在暗色下可读
- _需求: FR-4 AC-8,9,10_

### 4.9 P2-分包 packageSocial 暗色适配

- [ ] `ai-assistant/ai-assistant.wxml` + `.js`: 接入主题同步
- [ ] `family/family.wxml` + `.js`: 接入主题同步
- [ ] `family-create/family-create.wxml` + `.js`: 接入主题同步
- [ ] `family-join/family-join.wxml` + `.js`: 接入主题同步
- [ ] `export/export.wxml` + `.js`: 接入主题同步
- [ ] 验证: 5 个分包页面在暗色下可读
- _需求: FR-4 AC-11_

### 4.10 非 TabBar 主包页面适配

- [ ] `baby-create/baby-create.wxml` + `.js`: 接入主题同步
- [ ] `baby-list/baby-list.wxml` + `.js`: 接入主题同步
- [ ] `guide/guide.wxml` + `.js`: 接入主题同步
- [ ] 验证: 3 个页面暗色下可读
- _需求: FR-4_

---

## Phase 5: 弹窗 + 收尾

### 5.1 10 个自定义弹窗组件暗色接入

- [ ] 为每个弹窗组件添加 `darkMode: Boolean` property（design §3.3.2）
- [ ] 在每个弹窗根元素绑定 `{{darkMode ? 'dark-mode' : ''}}`
- [ ] 涉及组件清单:
  - `feeding-popup`、`sleep-popup`、`diaper-popup`、`temperature-popup`
  - `growth-popup`、`report-popup`、`baby-edit-popup`、`export-popup`
  - `easter-egg-popup`、`easter-egg-toast`
- [ ] 更新所有宿主页面的组件引用，传入 `dark-mode="{{darkMode}}"`
- [ ] 验证: 每个弹窗在暗色下遮罩加深、容器背景变暗、输入框对比度达标
- [ ] 附加验证: 非弹窗组件（`baby-card`、`timeline`、`insight-section`、`icon`、`error-state`）在暗色下通过 CSS 变量继承自动适配，无需额外 property（它们是宿主页面 `.dark-mode` 的子元素）
- _需求: FR-5 AC-1,2,5_

### 5.2 9 个页面内嵌弹窗适配

- [ ] `auth.wxml`: 邀请码弹窗 + 成功弹窗（2 个）的根元素绑定暗色 class
- [ ] `vaccine.wxml`: 详情弹窗 + 日期弹窗（2 个）
- [ ] `growth.wxml`: 添加数据弹窗 + WHO 弹窗（2 个）
- [ ] `discover.wxml`: 信息弹窗（1 个）
- [ ] `record.wxml`: 日期选择器弹窗 + Action Sheet（2 个）
- [ ] 验证: 所有内嵌弹窗在暗色下背景/文字正确
- _需求: FR-5_

### 5.3 图标暗色适配 + 过渡动画验收

- [ ] 在 `app.wxss` `.dark-mode` 中追加灰色图标 `filter: brightness(1.5)` 规则（design §7.1）
- [ ] 逐页检查 100+ PNG 图标在暗色下的可见性，必要时调整 filter 值或准备 dark 版本
- [ ] 验证过渡动画: 在设置页切换主题时，确认无白屏闪烁、300ms 平滑过渡
- _需求: FR-10, 图标边界条件_

### 5.4 文档更新 + 全面验收

- [ ] 更新 `ui-design-system.md`: 新增第 10 节"暖夜模式色板"（完整亮/暗对照表），更新第 9 节核心特征
- [ ] 更新 `architecture.md`: 工具层新增 ThemeManager 模块描述
- [ ] 更新 `coding-conventions.md`: 新增 §6.5"主题适配规范"（页面/组件接入模板）
- [ ] 更新 `component-library.md`: 所有组件新增 `darkMode` property
- [ ] 更新 `service-api.md`: 新增 ThemeManager API 文档
- [ ] 更新 `data-model.md`: settings 缓存键新增 `app_theme_mode` 说明
- [ ] **全面验收**: 在 iOS + Android 双端逐页走查 18 个页面 + 19 个弹窗的亮色/暗色模式
- _需求: design §11, NFR-3_

---

## 依赖关系

```
Phase 1 (架构)
  ├── 1.1 ThemeManager ──┬──▶ Phase 2 (JS 迁移) 全部
  ├── 1.2 theme.json     │
  ├── 1.3 app.wxss 暗色块│
  └── 1.4 设置页 ────────┘
                          │
                          ▼
Phase 2 (JS 迁移)        Phase 3 (WXSS 变量化)
  2.1 reportDataHelper      3.1 公共样式
  2.2 timeline+discover     3.2 首页
  2.3 growth                3.3 记录页
  2.4 confirmColor          3.4 高频弹窗
  （无互相依赖，可并行）      3.5 report-popup
                             3.6 growth.wxss
                             3.7 低频页面
                             （3.1→3.2→...有序，但与 Phase 2 可并行）
                          │
         ┌────────────────┘
         ▼
Phase 4 (页面适配) ——需 Phase 1+2+3 对应批次完成
  4.1~4.3 P0 核心 ──需 3.1+3.2+3.3 完成
  4.4 TabBar 图标 ──需 1.2 完成
  4.5~4.7 P1 ──需 3.7 部分完成
  4.8~4.10 P2 ──需 3.5+3.6+3.7 完成
         │
         ▼
Phase 5 (弹窗+收尾) ──需 Phase 4 完成
  5.1 弹窗组件 ──需 3.4+3.5 完成
  5.2 内嵌弹窗
  5.3 图标+动画
  5.4 文档
```

---

*文档版本: v1.0 | 创建日期: 2026-04-08*
