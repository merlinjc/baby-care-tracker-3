# 实施计划 - 暖夜模式（深色模式）

> **需求文档**: `specs/warm-night-mode/requirements.md` v1.1
> **设计文档**: `specs/warm-night-mode/design.md` v1.0
> **任务清单**: `specs/warm-night-mode/tasks.md` v1.0
> **版本**: v1.0 | **日期**: 2026-04-08

---

## 开发工作流遵循

按照项目三阶段工作流规范执行：
1. **开发前**：已完成 — architecture.md（整体架构）、service-api.md（现有服务）、component-library.md（组件）、ui-design-system.md（设计变量）已阅读
2. **开发中**：遵循 coding-conventions.md 的命名约定、单例模式、节流模式、错误处理模式；引用 ui-design-system.md 的设计变量
3. **开发后**：同步更新 architecture.md、data-model.md、coding-conventions.md、ui-design-system.md、component-library.md、service-api.md

---

## 实施顺序总览

```
Phase 1: 基础架构（PRE-1）
  ├── STEP-1: ThemeManager 模块 ──────────────────┐
  ├── STEP-2: theme.json + app.json 配置 ──────────┤
  ├── STEP-3: app.wxss 暗色变量块 + 过渡动画 + switch ┤
  └── STEP-4: app.js 初始化 + 设置页三态 UI ────────┘
                                                    │
Phase 2: JS 颜色集中化（PRE-2）               可与 Phase 3 并行
  ├── STEP-5: reportDataHelper.js 迁移              │
  ├── STEP-6: timeline.js + discover.js 迁移        │
  ├── STEP-7: growth.js 百分位线迁移                 │
  └── STEP-8: wx.showModal confirmColor 统一        │
                                                    │
Phase 3: WXSS 硬编码变量化（PRE-3）                  │
  ├── STEP-9:  公共样式（popup/form/page-header/loading）
  ├── STEP-10: home.wxss 变量化 + 局部暗色覆盖       │
  ├── STEP-11: record.wxss 变量化                    │
  ├── STEP-12: 4 个高频弹窗变量化                     │
  ├── STEP-13: report-popup.wxss 变量化（38 处）     │
  ├── STEP-14: growth.wxss 变量化（17 处）           │
  └── STEP-15: 低频页面/组件变量化                    │
                                                    │
Phase 4: 暗色模式页面适配                            │
  ├── STEP-16: P0-首页暗色适配                       │
  ├── STEP-17: P0-记录页暗色适配                     │
  ├── STEP-18: P0-设置页暗色验证                     │
  ├── STEP-19: TabBar 图标暗色适配                   │
  ├── STEP-20: P1-发现/我的/登录页适配               │
  ├── STEP-21: P2-packageGrowth 适配                │
  └── STEP-22: P2-packageSocial + 主包非TabBar 适配 │
                                                    │
Phase 5: 弹窗 + 收尾                                │
  ├── STEP-23: 10 个弹窗组件暗色接入                  │
  ├── STEP-24: 9 个内嵌弹窗 + 图标适配               │
  └── STEP-25: 文档更新 + 全面验收                    │
```

---

## Phase 1: 基础架构（对应 PRE-1 + tasks 1.1~1.4）

### STEP-1: 创建 ThemeManager 模块

**文件**: `miniprogram/utils/theme.js`（新建）

**实现内容**（对应 design §3.1）：
- 单例 ThemeManager 对象
- `LIGHT_COLORS` / `DARK_COLORS` 双套颜色映射（design §3.1 完整代码）
- `init()` / `getTheme()` / `setTheme()` / `isDark()` / `getColor()` / `getDarkModeData()` / `onThemeChange()` API
- 使用 `StorageUtil` 持久化，key = `app_theme_mode`
- 监听 `wx.onThemeChange`（仅 system 模式生效）
- 导出 `THEME_LIGHT` / `THEME_DARK` / `THEME_SYSTEM` 常量

**编码规范遵循**：
- 单例模式（coding-conventions.md §2.1）
- `StorageUtil` 使用约定（coding-conventions.md §2.2）
- 错误处理静默模式（coding-conventions.md §4.3）

**验证**: 控制台调用 `ThemeManager.setTheme('dark')` / `isDark()` 正确
**亮色零影响**: 模块加载不改变任何视觉，需显式调用 `setTheme('dark')` 才生效

### STEP-2: 创建 theme.json + 修改 app.json

**文件**: 
- `miniprogram/theme.json`（新建，design §3.4 完整内容）
- `miniprogram/app.json`（修改 window + tabBar 颜色为 `@变量` 引用）

**实现内容**：
- `theme.json` 定义 `light` / `dark` 两套配置
- `app.json` 添加 `"darkmode": true` 和 `"themeLocation": "theme.json"`
- `window` 中 3 个颜色值替换为 `@navigationBarBackgroundColor` 等变量引用
- `tabBar` 中 4 个颜色值替换为 `@tabBarColor` 等变量引用

**亮色零影响**: `theme.json` 的 `light` 配置与当前 `app.json` 硬编码值完全一致
**验证**: 微信开发者工具切换系统暗色模式，导航栏和 TabBar 颜色变化

### STEP-3: app.wxss 追加暗色变量块

**文件**: `miniprogram/app.wxss`（追加内容，不修改现有代码）

**追加内容**（对应 design §3.2 + §3.8 + §3.10）：
1. `.dark-mode {}` 完整暗色变量覆盖块（~50 个变量）
2. `.theme-transition` 过渡动画规则
3. `.dark-mode switch .wx-switch-input` switch 组件暗色覆盖

**亮色零影响**: `.dark-mode {}` 仅在元素有该 class 时匹配，亮色模式下零开销
**验证**: 手动给 view 添加 `class="dark-mode"` 确认变量覆盖生效

### STEP-4: app.js 初始化 + 设置页三态 UI

**文件**:
- `miniprogram/app.js`（追加 `ThemeManager.init()`）
- `miniprogram/packageSocial/pages/settings/settings.wxml`（替换 switch 为三态选择器）
- `miniprogram/packageSocial/pages/settings/settings.wxss`（新增 `.theme-options` / `.theme-option` / `.theme-icon` 样式）
- `miniprogram/packageSocial/pages/settings/settings.js`（接入 ThemeManager）

**前置准备**：
- 准备 3 个主题图标：`images/icons/sun.png`（亮色）、`images/icons/moon.png`（暖夜）、`images/icons/auto.png`（跟随系统）
- 如项目中无合适图标，使用 iconify 下载 `sun`、`moon`、`monitor-smartphone` 图标

**实现内容**（对应 design §3.5 + §3.6）：
- app.js onLaunch 末尾追加 `ThemeManager.init()`
- 设置页 WXML：将显示设置区的 switch 替换为三态选择器（亮色/暖夜/跟随系统）
- 设置页 WXSS：新增 `.theme-options`（flex 容器）、`.theme-option`（选项样式）、`.theme-option.active`（选中态高亮）、`.theme-icon`（图标样式）
- 设置页 JS：引入 ThemeManager，实现 `onThemeSelect()`，接入 `_applyTheme()`
- 旧数据迁移：若 `settings.darkMode === true`，自动映射为 `ThemeManager.setTheme('dark')`
- 根 view 绑定 `{{darkMode ? 'dark-mode' : ''}} {{themeTransition ? 'theme-transition' : ''}}`

**验证**: 设置页点击"暖夜"后本页背景/文字切换；点击"亮色"恢复

---

## Phase 2: JS 颜色集中化（对应 PRE-2 + tasks 2.1~2.4）

> Phase 2 与 Phase 3 可并行执行（JS 和 WXSS 互不干扰）

### STEP-5: 迁移 reportDataHelper.js 颜色

**文件**: `miniprogram/services/reportDataHelper.js`

- 引入 ThemeManager
- `STATUS_CONFIG` 中 15 处硬编码颜色（`color`/`bgColor`）改为 `ThemeManager.getColor()` 调用
- 生长评估颜色映射 5 处改为 ThemeManager 调用

**亮色零影响**: `LIGHT_COLORS` 值与原硬编码值一一对应

### STEP-6: 迁移 timeline.js + discover.js 颜色

**文件**: 
- `miniprogram/components/timeline/timeline.js`（6 处）
- `miniprogram/pages/discover/discover.js`（4 处）

- timeline: `_getTypeColor()` 中 6 处颜色改为 ThemeManager 调用
- discover: `menuItems` 的 4 处 `iconBg` 改为 `onShow` 时动态构建

### STEP-7: 迁移 growth.js 百分位线颜色

**文件**: `miniprogram/packageGrowth/pages/growth/growth.js`（5 处）

### STEP-8: 统一 wx.showModal confirmColor

**文件**: 全局 12 处（home.js×2, record.js×2, profile.js×1, baby-list.js×1, vaccine.js×1, growth.js×1, milestone.js×1, family.js×3, settings.js×2）

- 创建 `ThemeManager.getConfirmColor(type)` 辅助函数（type: 'danger'|'warn'|'neutral'）
- 逐一替换 `confirmColor: '#xxx'` 为 ThemeManager 调用
- **保持** `diaper-popup.js` 的 5 处大便颜色不变（design §8 决策 6）

---

## Phase 3: WXSS 硬编码变量化（对应 PRE-3 + tasks 3.1~3.7）

> ⚠️ 每个 STEP 完成后在亮色模式下对比截图，确认视觉无差异
> ⚠️ **app.wxss 编辑顺序**：新增 CSS 变量的亮色默认值添加到 `page {}` 块中（位于 `.dark-mode {}` 之前），暗色覆盖值添加到 `.dark-mode {}` 块中

### STEP-9: 公共样式文件变量化

**文件**: `styles/popup.wxss` + `styles/form.wxss` + `styles/page-header.wxss` + `styles/loading.wxss`

- 将遮罩/容器/输入框/渐变的硬编码 rgba 改为 CSS 变量
- 在 `app.wxss` `page {}` 中新增对应亮色默认变量
- 追加 `.dark-mode .popup-mask` 等暗色覆盖规则（design §3.9）

### STEP-10: home.wxss 变量化 + 局部暗色覆盖

**文件**: `miniprogram/pages/home/home.wxss` + `miniprogram/app.wxss`

- 8 处 hex 硬编码改为 CSS 变量
- `app.wxss` `page {}` 新增 `--feeding-gradient-end` 等 5 个亮色变量（design §6.3）
- `app.wxss` `.dark-mode {}` 追加对应暗色值
- `home.wxss` 末尾追加 `.dark-mode {}` 局部覆盖（design §3.7，13 个变量）

### STEP-11: record.wxss 变量化

**文件**: `miniprogram/pages/record/record.wxss` + `miniprogram/app.wxss`

- 13 处 hex 硬编码（FAB/筛选/批量 header）改为 CSS 变量
- `app.wxss` `page {}` 新增 FAB/筛选相关 7 个亮色变量（design §6.4）
- `app.wxss` `.dark-mode {}` 追加对应暗色值

### STEP-12: 4 个高频弹窗变量化

**文件**: `feeding-popup.wxss`(2) + `sleep-popup.wxss`(3) + `diaper-popup.wxss`(1) + `temperature-popup.wxss`(7)

- 渐变终止色改为 `var(--xxx-gradient-end)` 变量
- 发热等级 6 色改为 `var(--fever-*)` 变量
- `app.wxss` `page {}` 新增 6 个 `--fever-*` 亮色变量（design §6.2）

### STEP-13: report-popup.wxss 变量化（最大单文件）

**文件**: `miniprogram/components/report-popup/report-popup.wxss`(38 处) + `miniprogram/app.wxss`

- 评分 5 级 → `var(--score-*)` 变量（design §6.1）
- 密度 5 级 → `var(--density-level-*)` 变量
- 状态/范围/百分位/疫苗进度 → 复用语义色变量
- `app.wxss` `page {}` 新增 11 个亮色变量，`.dark-mode {}` 追加 11 个暗色值

### STEP-14: growth.wxss 变量化

**文件**: `miniprogram/packageGrowth/pages/growth/growth.wxss`(17 处) + `miniprogram/app.wxss`

- 百分位/数据卡片/图表元素色变量化
- `app.wxss` 补充亮色/暗色变量

### STEP-15: 低频页面/组件变量化

**文件**: `icon.wxss`(7) + `discover.wxss`(6) + `profile.wxss`(2) + `vaccine.wxss`(2) + `family.wxss`(2) + `app.wxss`(2) + 4 个低频组件(各 1 处)

---

## Phase 4: 暗色模式页面适配（对应 tasks 4.1~4.10）

> 前置条件：Phase 1-3 已完成。每个 STEP 同时在亮色和暗色下验证。

### STEP-16: P0-首页暗色适配

**文件**: `home.wxml` + `home.js`

- 根 view 绑定 `{{darkMode ? 'dark-mode' : ''}}`
- JS 引入 ThemeManager，追加 `_applyTheme()` + `onThemeChange` + `onShow` 同步
- 传递 `dark-mode="{{darkMode}}"` 给 9 个子组件
- **验证**: 问候语、概览 4 色、快捷入口、骨架屏、时间线、AI 洞察全部正确

### STEP-17: P0-记录页暗色适配

**文件**: `record.wxml` + `record.js`

- 接入主题同步，传递给子组件
- **验证**: 筛选栏、FAB、日期弹窗、概览统计、时间线正确

### STEP-18: P0-设置页验证 + TabBar 图标

- 任务 STEP-4 已完成设置页接入，此处做全面验证
- 准备暗色版 TabBar 图标或通过 `theme.json` 变量引用
- **验证**: 三态选择器、switch 轨道色、危险操作项、TabBar 图标

### STEP-19: P1-发现/我的/登录页适配

**文件**: `discover` + `profile` + `auth` 三个页面的 `.wxml` + `.js`

- 接入主题同步
- discover: `onShow` 时若主题变化重建 menuItems 颜色
- auth: 全屏渐变背景暗色方案（21 处 rgba 逐一审查调整不透明度）
- **验证**: 待办卡片、菜单图标、用户/家庭卡片、登录页选项卡片

### STEP-20: P2-packageGrowth 适配

**文件**: `growth` + `vaccine` + `milestone` + `baby-detail` 四个页面

- 各自接入主题同步
- **验证**: 百分位线、疫苗卡片状态色、月份选择器、进度条

### STEP-21: P2-packageSocial + 主包非 TabBar 适配

**文件**: `ai-assistant` + `family` + `family-create` + `family-join` + `export` + `baby-create` + `baby-list` + `guide`

- 各自接入主题同步
- **验证**: 基本可读性

---

## Phase 5: 弹窗 + 收尾（对应 tasks 5.1~5.4）

### STEP-22: 10 个弹窗组件暗色接入

- 为每个弹窗添加 `darkMode: Boolean` property（design §3.3.2）
- 根元素绑定 `{{darkMode ? 'dark-mode' : ''}}`
- 更新所有宿主页面组件引用
- 附加验证：非弹窗组件通过 CSS 变量继承自动适配

### STEP-23: 内嵌弹窗 + 图标适配

- 9 个页面内嵌弹窗根元素绑定暗色 class
- `app.wxss .dark-mode` 追加灰色图标 `filter: brightness(1.5)` 规则
- 逐页检查 PNG 图标可见性
- 验证过渡动画无白屏闪烁

### STEP-24: 文档更新 + 全面验收

按开发工作流第三阶段规范，更新 6 个文档：
1. `architecture.md` — 新增 ThemeManager 模块
2. `ui-design-system.md` — 新增"暗色模式色板"节
3. `coding-conventions.md` — 新增"主题适配规范"节
4. `component-library.md` — 所有组件新增 `darkMode` property
5. `service-api.md` — 新增 ThemeManager API
6. `data-model.md` — settings 缓存键新增 `app_theme_mode`

**全面验收**: iOS + Android 双端逐页走查 18 页面 + 19 弹窗

---

## 依赖关系与并行策略

```
STEP-1 ──→ STEP-2 ──→ STEP-3 ──→ STEP-4
                                    │
              ┌─────────────────────┤
              ▼                     ▼
    Phase 2 (STEP 5-8)    Phase 3 (STEP 9-15)
    【可并行执行】          【按批次串行】
              │                     │
              └──────────┬──────────┘
                         ▼
              Phase 4 (STEP 16-21)
              【P0→P1→P2 串行】
                         │
                         ▼
              Phase 5 (STEP 22-24)
              【串行收尾】
```

**关键并行窗口**：Phase 2（JS 迁移）和 Phase 3（WXSS 变量化）完全独立，可同时进行。

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|:-----:|:----:|----------|
| WXSS 变量化引入亮色视觉回归 | 中 | 高 | 每步对比截图，使用完全一致的亮色默认值 |
| switch 组件 CSS 覆盖跨版本失效 | 低 | 中 | iOS/Android 双端测试，准备 fallback |
| `theme.json` 在旧版微信不支持 | 低 | 低 | 导航栏保持原色，CSS 变量覆盖不受影响 |
| report-popup 38 处变量化出错 | 中 | 中 | 逐行替换，每替换 5 处保存并截图对比 |

---

*文档版本: v1.0 | 创建日期: 2026-04-08*
