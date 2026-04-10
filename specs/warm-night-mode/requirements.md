# 需求文档 - 暖夜模式（深色模式）

## 概述

为 Baby Care Tracker 小程序实现"暖夜模式"——一种保留美拉德暖色基因的深色主题。目标是在深夜照顾宝宝时减少屏幕光线刺激，同时维持品牌识别度和温暖感。

当前状态：设置页已有"深色模式"开关（`settings.darkMode`），但仅保存值到 StorageUtil，**无任何样式响应逻辑**。

---

## 用户角色

- **宝爸/宝妈**：深夜喂奶、换尿裤时使用，需要低亮度、护眼的界面
- **家庭成员（viewer）**：查看宝宝数据时同样享受暖夜模式

---

## 代码现状审计

### 项目规模

| 维度 | 数量 |
|------|------|
| 页面总数 | 18（主包 8 + packageGrowth 4 + packageSocial 6） |
| 组件总数 | 16 |
| 自定义弹窗组件 | 10（feeding/sleep/diaper/temperature/growth/report/baby-edit/export/easter-egg-popup/easter-egg-toast） |
| 页面内嵌弹窗 | 9（auth×2, vaccine×2, growth×2, discover×1, record×2） |
| wx.showModal 调用 | 34 处 |
| wx.showToast 调用 | 135+ 处 |
| 全局 CSS 变量 | ~50 个（`app.wxss` 的 `page {}` 中） |
| WXSS 文件总数 | 38 |

### 硬编码颜色清单（需前置治理）

#### A. `app.json` 配置颜色（7 处，无法用 CSS 变量）

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| `window.navigationBarBackgroundColor` | `#D4B896` | 导航栏背景 |
| `window.navigationBarTextStyle` | `white` | 导航栏文字 |
| `window.backgroundTextStyle` | `light` | 下拉背景文字 |
| `tabBar.color` | `#8B7B6B` | TabBar 默认文字 |
| `tabBar.selectedColor` | `#D4B896` | TabBar 选中文字 |
| `tabBar.backgroundColor` | `#FFFFFF` | TabBar 背景 |
| `tabBar.borderStyle` | `white` | TabBar 上边框 |

#### B. WXSS 中纯硬编码 `#hex` 颜色（非 var() fallback）

| 文件 | 硬编码处数 | 高危项 |
|------|:----------:|--------|
| `report-popup.wxss` | **38** | 评分5级颜色、状态标签、密度色块、百分位、疫苗进度 |
| `temperature-popup.wxss` | **7** | 发热等级 6 种颜色 |
| `record.wxss` | 13 | FAB 按钮、筛选项、批量模式 header |
| `home.wxss` | ~8 | 快捷入口功能色渐变 |
| `discover.wxss` | 6 | WHO/CDC/中国标准图标 |
| `growth.wxss`（packageGrowth） | 17 | 百分位颜色、数据卡片、图表元素 |
| `icon/icon.wxss` | 7 | `--icon-color` 自定义属性 |
| `vaccine.wxss` | 2 | 主色调引用 |
| `profile.wxss` | 2 | 角色 badge、退出按钮 |
| `app.wxss` | 2 | 禁用按钮 |
| `feeding-popup.wxss` | 2 | 渐变终止色 |
| `sleep-popup.wxss` | 3 | 渐变终止色 |
| `diaper-popup.wxss` | 1 | 渐变终止色 |
| `growth-popup.wxss` | 1 | :active 状态 |
| `baby-edit-popup.wxss` | 1 | disabled 按钮 |
| `easter-egg-popup.wxss` | 1 | 渐变起始 #FFFFFF |
| `easter-egg-toast.wxss` | 1 | 文字 #FFFFFF |
| `family.wxss` | 2 | 角色颜色 |
| **合计** | **~112** | |

#### C. WXSS 中硬编码 `rgba()` 颜色

| 文件类别 | rgba 总数 |
|---------|:---------:|
| 页面 wxss（8 个主包 + 分包页面） | ~190 |
| 组件 wxss（16 个组件） | ~160 |
| 公共样式（styles/\*.wxss） | ~9 |
| **合计** | **~359** |

#### D. JS 中硬编码颜色值

| 文件 | 处数 | 说明 |
|------|:----:|------|
| `reportDataHelper.js` | ~15 | 状态色映射（normal/low/high/alert） |
| `wx.showModal` confirmColor | ~12 | 确认按钮颜色 |
| `diaper-popup.js` | 5 | 大便颜色选择器 |
| `growth.js` | 5 | 百分位线颜色 |
| `timeline.js` | 6 | 记录类型圆点颜色 |
| `discover.js` | 4 | 功能菜单 iconBg |
| **合计** | **~47** |

#### E. 原生组件

| 组件 | 数量 | 暗色影响 |
|------|:----:|----------|
| `<switch>` | 6 | `color="#D4B896"` 硬编码，未选中轨道色需覆盖 |
| `<input>` | 14 | 背景/文字色可通过 CSS 变量控制 |
| `<textarea>` | 2 | 同 input |
| `<picker>` / `<picker-view>` | 5 | picker 弹窗为系统原生，需微信 DarkMode 支持 |

#### F. 分享 Canvas

| 文件 | 说明 |
|------|------|
| `services/share-canvas.js` | 颜色常量 `COLORS` 对象，约 30+ 硬编码色值 |

---

## 功能需求

### FR-1: 主题切换基础架构

**用户故事：** 作为开发者，我需要一套可靠的主题切换机制，以便所有页面和组件能响应暗色模式设置。

**验收标准：**
1. When 用户在设置页切换主题开关，the system shall 使当前活跃页面在 300ms 内完成视觉切换
2. When TabBar 缓存页面重新 `onShow` 时，the system shall 自动应用当前主题
3. When 用户关闭小程序并重新打开，the system shall 恢复上次选择的主题模式
4. While 暖夜模式启用，the system shall 在所有新打开的页面（含分包页面）自动应用暗色主题
5. If 切换主题时页面正在加载数据，then the system shall 不中断数据加载流程

### FR-2: CSS 变量暗色覆盖

**用户故事：** 作为开发者，我需要一套完整的暗色 CSS 变量映射，以便通过变量覆盖实现大部分 UI 适配。

**验收标准：**
1. When 暖夜模式启用，the system shall 覆盖 `app.wxss` 中全部 ~50 个颜色类 CSS 变量
2. When 暖夜模式启用，the system shall 覆盖各页面的局部 CSS 变量（如 `home.wxss` 的 13 个扩展变量）
3. While 暗色变量生效，the system shall 保持 `--primary-color: #D4B896` 品牌主色不变
4. While 暗色变量生效，the system shall 使用深棕暖色调背景（`#1E1A16`/`#2A2420`），非纯黑
5. When 功能四色在暗色模式下显示，the system shall 使用指定的暗色版色值（喂养 `#7CAF7C`、睡眠 `#9488B4`、排便 `#B0A480`、体温 `#B48888`），具体色值在设计文档中定义

### FR-3: 导航栏与 TabBar 适配

**用户故事：** 作为用户，我希望导航栏和底部 TabBar 也能跟随暗色主题。

**验收标准：**
1. When 暖夜模式启用，the system shall 将导航栏背景从 `#D4B896` 切换为深棕色（如 `#2A2420`）
2. When 暖夜模式启用，the system shall 将 TabBar 背景从 `#FFFFFF` 切换为深色（如 `#1E1A16`）
3. When 暖夜模式启用，the system shall 将 TabBar 未选中文字色从 `#8B7B6B` 调整为暗色可读色
4. When 暖夜模式启用，the system shall 提供暗色版 TabBar 图标（或使用 CSS filter 处理）

### FR-4: 页面级适配（18 个页面）

**用户故事：** 作为用户，我希望所有页面在暖夜模式下视觉统一、可读性好。

**按优先级分组验收：**

**P0 核心路径（首页 + 记录 + 设置）：**
1. When 暖夜模式启用，the system shall 确保首页（home）的问候语、概览统计、快捷入口、时间线、AI 洞察卡片正确切换
2. When 暖夜模式启用，the system shall 确保首页骨架屏（shimmer 动画）使用暗色版 `--skeleton-base` / `--skeleton-highlight`
3. When 暖夜模式启用，the system shall 确保记录页（record）的筛选工具栏、FAB 按钮、日期选择器、Action Sheet 正确切换
4. When 暖夜模式启用，the system shall 确保设置页（settings）的 section 卡片、switch 组件、危险操作项正确切换

**P1 高频页面（发现 + 我的 + 弹窗宿主页面）：**
5. When 暗色模式下查看发现页（discover），the system shall 保持待办卡片、功能菜单图标背景、参考标准图标可见
6. When 暗色模式下查看个人中心（profile），the system shall 保持用户卡片、家庭卡片、菜单卡片层次清晰
7. When 暗色模式下查看登录页（auth），the system shall 适配全屏渐变背景、选项卡片、邀请码弹窗和成功弹窗

**P2 分包页面：**
8. When 暗色模式下查看生长曲线（growth），the system shall 确保百分位线、数据卡片、WHO 弹窗可读
9. When 暗色模式下查看疫苗管理（vaccine），the system shall 确保疫苗卡片状态色、详情弹窗、日期选择弹窗正确显示
10. When 暗色模式下查看发育里程碑（milestone），the system shall 确保月份选择器、进度条、焦点卡片可读
11. When 暗色模式下查看家庭管理（family）、AI 助手、数据导出等页面，the system shall 保持基本可读性

### FR-5: 弹窗组件适配（10 个自定义弹窗 + 9 个内嵌弹窗）

**用户故事：** 作为用户，我希望所有弹窗在暖夜模式下也保持美观可用。

**验收标准：**
1. When 暖夜模式启用，the system shall 将弹窗遮罩加深（从 `rgba(139,123,107,0.4)` 到 `rgba(0,0,0,0.7)`）
2. When 暖夜模式启用，the system shall 将弹窗容器背景切换为深色（如 `#2A2420`）
3. When 暖夜模式下打开体温弹窗，the system shall 正确显示 6 级发热状态颜色（需暗色适配版）
4. When 暖夜模式下打开报告弹窗，the system shall 正确显示 5 级评分颜色和密度色块
5. When 暗色模式下使用 input/textarea 组件，the system shall 保持输入区域与背景的对比度 ≥ 4.5:1

### FR-6: 卡片与列表适配（75+ 卡片样式类）

**用户故事：** 作为用户，我希望所有卡片在暗色背景上有清晰的层次感。

**验收标准：**
1. When 暖夜模式启用，the system shall 将卡片背景从白色系切换为深可可色系（`#2A2420`）
2. When 暖夜模式启用，the system shall 将卡片阴影从棕色调改为黑色调（暗底上棕色阴影不可见）
3. When 暗色模式下卡片有 selected/active 状态，the system shall 通过亮度差异（而非色相差异）表达选中态

### FR-7: JS 动态颜色适配

**用户故事：** 作为开发者，我需要一个统一的颜色配置模块，让 JS 中的硬编码颜色也能响应主题切换。

**验收标准：**
1. When JS 代码需要使用颜色值（如 `reportDataHelper.js` 的状态色映射），the system shall 从统一的主题配置模块获取
2. When 调用 `wx.showModal` 时，the system shall 使用主题感知的 `confirmColor`
3. When 大便颜色选择器（`diaper-popup.js`）显示颜色圆圈，the system shall 在暗色模式下保持颜色准确性（这是实际颜色，不应变化）

### FR-8: 微信原生组件适配

**用户故事：** 作为用户，我希望系统原生弹窗（如 picker、showModal）也能跟随暗色主题。

**验收标准：**
1. When 用户系统设置为深色模式且小程序设为"跟随系统"，the system shall 自动适配原生组件样式（picker、showModal 等）
2. When 系统 picker 弹出时（如日期选择），the system shall 跟随小程序的暗色配置
3. When `<switch>` 组件在暗色背景上显示，the system shall 确保未选中态轨道与背景有足够对比度
4. When 分包页面的 `page.json` 中有 `backgroundTextStyle` 配置，the system shall 在暗色模式下自动适配为 `"dark"`

### FR-9: 分享图适配

**用户故事：** 作为用户，我希望在暖夜模式下生成的分享图仍然使用亮色方案（适合社交分享）。

**验收标准：**
1. When 暖夜模式下生成分享图（`share-canvas.js`），the system shall 始终使用亮色配色方案
2. If 用户希望生成暗色分享图，then the system shall 在后续版本中支持（P3 远期）

### FR-10: 过渡动画

**用户故事：** 作为用户，我希望主题切换有平滑的过渡效果。

**验收标准：**
1. When 用户切换主题时，the system shall 以 300ms 的 ease 缓动完成背景色和文字色过渡
2. When 过渡动画播放期间，the system shall 不出现白色/亮色背景的中间帧（白屏闪烁）

### FR-11: 三态主题选择

**用户故事：** 作为用户，我希望可以选择"亮色/暗色/跟随系统"三种模式，而不仅是简单的开关。

**验收标准：**
1. When 用户进入显示设置，the system shall 提供三个选项：亮色模式、暖夜模式、跟随系统
2. When 用户选择"跟随系统"，the system shall 根据微信/系统的 `prefers-color-scheme` 自动切换主题
3. When 用户选择"亮色"或"暖夜"，the system shall 强制使用指定主题，忽略系统设置
4. When 首次使用（无历史设置），the system shall 默认为"亮色模式"（保持现有行为）

### FR-12: 公共样式文件适配

**用户故事：** 作为开发者，我需要确保被多个组件 `@import` 的公共样式文件也能响应暗色主题。

**验收标准：**
1. When 暖夜模式启用，the system shall 确保 `styles/popup.wxss` 的遮罩、容器、头部、底部样式正确切换
2. When 暖夜模式启用，the system shall 确保 `styles/form.wxss` 的输入框、选择器、标签样式正确切换
3. When 暖夜模式启用，the system shall 确保 `styles/page-header.wxss` 的页面头部渐变背景正确切换
4. When 暖夜模式启用，the system shall 确保 `styles/loading.wxss` 的加载动画颜色正确切换

---

## 非功能需求

### NFR-1: 性能要求
- 主题切换响应时间 ≤ 300ms（从开关切换到视觉反馈）
- CSS 变量覆盖方案不增加首屏渲染时间 > 50ms
- 不引入额外的网络请求

### NFR-2: 可访问性
- 文字与背景的对比度 ≥ 4.5:1（WCAG AA 标准）
- 功能色与背景的对比度 ≥ 3:1
- 不依赖纯色彩差异传达信息

### NFR-3: 兼容性
- 支持微信 iOS/Android 双端
- 在不支持 DarkMode 的旧版微信上优雅降级（保持亮色）

### NFR-4: 可维护性
- 暗色变量集中管理，新增页面/组件无需额外适配（只要使用 CSS 变量）
- JS 颜色配置集中在一个 `theme.js` 模块中

---

## 前置工作（需在暖夜模式实现前完成）

> **原则**：先定架构，再治数据源，最后铺面积。

### PRE-1: 微信 DarkMode 架构选型与配置（最高优先级）

**为什么先做**：此步决定整体技术路线（`theme.json` 变量方案 vs 纯 class 切换 vs 混合），后续所有 WXSS/JS 工作都依赖此决策。

工作内容：
1. 在 `app.json` 中添加 `"darkmode": true`
2. 创建 `theme.json`，将 `app.json` 中 7 处颜色值替换为主题变量（`@navBgColor`、`@tabBarBg` 等）
3. 确认各分包 `page.json` 中 `backgroundTextStyle` 的适配方案
4. 决定 CSS 变量覆盖的技术方案（`page[data-theme="dark"]` class 覆盖 vs WXS 动态注入）
5. 验证在 iOS/Android 双端的基本效果

### PRE-2: JS 硬编码颜色集中化（次高优先级）

**为什么第二做**：工作量小（47 处），风险低，与 WXSS 重构互不干扰，可快速完成。

工作内容：
1. 创建 `utils/theme.js` 模块，定义亮色/暗色双套颜色映射
2. 迁移 `reportDataHelper.js` 的 15 处状态色映射
3. 迁移 `timeline.js` 的 6 处记录类型颜色
4. 迁移 `growth.js` 的 5 处百分位线颜色
5. 迁移 `discover.js` 的 4 处 iconBg 渐变
6. 统一各页面 `wx.showModal` 的 12 处 `confirmColor`
7. 保持 `diaper-popup.js` 的 5 处大便颜色**不变**（实际颜色，非主题色）

### PRE-3: WXSS 硬编码颜色变量化（最大工作量，按用户路径优先级分批）

**为什么最后做**：工作量最大（112 处 hex），需依赖 PRE-1 确定的技术方案，且可分批交付。

**批次 1 — P0 核心路径（用户每天看到的页面）：**
1. `styles/popup.wxss` + `styles/form.wxss` + `styles/page-header.wxss` + `styles/loading.wxss`（4 个公共样式，被大量 `@import`，治理性价比最高）
2. `home.wxss`（8 处）— 快捷入口渐变色变量化
3. `record.wxss`（13 处）— FAB 按钮、筛选项、批量模式 header

**批次 2 — P1 高频弹窗：**
4. `feeding-popup.wxss`（2 处）+ `sleep-popup.wxss`（3 处）+ `diaper-popup.wxss`（1 处）+ `temperature-popup.wxss`（7 处）

**批次 3 — P2 中频功能：**
5. `report-popup.wxss`（38 处）— 新增评分/状态/密度等 CSS 变量
6. `growth.wxss`（17 处）— 百分位颜色、数据卡片

**批次 4 — P3 低频页面和组件：**
7. `icon/icon.wxss`（7 处）、`discover.wxss`（6 处）、`profile.wxss`（2 处）、`vaccine.wxss`（2 处）
8. `auth.wxss`（无纯 hex 硬编码，但有 21 处 rgba 需关注）
9. `family.wxss`（2 处）、`baby-edit-popup.wxss`（1 处）、`growth-popup.wxss`（1 处）
10. `app.wxss`（2 处禁用按钮）、彩蛋组件（2 处）

---

## 边界条件和异常处理

- **跨页面同步**：切换主题时，已打开但未销毁的页面（如 TabBar 缓存页面）需通过事件广播同步更新，在 `onShow` 时应用最新主题
- **Canvas 绘图**：分享图 Canvas 不受 CSS 变量影响，始终使用亮色方案（FR-9 已覆盖）
- **原生组件限制**：`picker` / `picker-view` 的弹窗样式由微信控制，只能通过 `darkmode: true` 跟随系统
- **图标处理**：约 100+ PNG 图标中，灰色/浅色图标在深色背景上可能不清晰，需通过 CSS `filter: brightness(1.3)` 或准备 dark 版本
- **TabBar 图标**：使用 `theme.json` 的变量引用指向不同图标路径（`*-dark.png`），或在 `theme.json` 中配置 `iconPath@dark` / `selectedIconPath@dark`
- **三态开关与系统冲突**：当用户手动选择"亮色"或"暖夜"时，应忽略 `prefers-color-scheme` 媒体查询；仅"跟随系统"模式下才响应系统变化
- **auth 页面特殊视觉**：登录页有独立的全屏渐变背景和独特卡片风格（21 处 rgba），需要单独设计暗色方案而非简单覆盖变量
- **rgba 透明度在暗色下的差异**：亮色模式下 `rgba(212,184,150,0.1)` 的效果是淡暖色调，但在深色背景上同样的透明度可能几乎不可见，需要提高不透明度（如 0.1 → 0.15~0.2）

---

*文档版本: v1.1 | 更新日期: 2026-04-08 | 变更: 根据 review 调整前置工作优先级、细化 FR-1/4/8/10 验收标准、新增 FR-11/12、补充遗漏项*
