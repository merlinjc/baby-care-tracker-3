# 需求文档 - UI 重设计 v4.0（UI Redesign v4）

> 版本：v1.0 | 更新日期：2026-04-13 | 状态：已确认

## 概述

本次迭代对全部 18 个页面 + 15 个组件进行视觉统一升级，核心聚焦首页布局精简和交互提效。设计原则：**少即是多 —— 一次点击完成记录，一眼看清宝宝状态**。整体变更程度「低」，保留现有架构、服务层和数据模型不变，仅涉及 UI 层（WXML + WXSS）和少量 JS 交互逻辑。

**配套设计规格**：
- `design-spec.md` — 设计总纲 + 4 个 Tab 页核心重设计
- `detailed-spec.md` — 全部 18 页面 + 15 组件的逐一细化规格

## 用户角色

- **主要照护者**：父母/监护人，每日高频使用（3-8 次记录），需要凌晨暗光环境下快速操作
- **协同照护者**：祖父母/其他家庭成员，偶发使用，查看为主
- **多宝家庭用户**：2+ 宝宝，需在不同宝宝间快速切换

## 目标用户场景

| 场景 | 频率 | 痛点 | v4.0 解法 |
|------|------|------|-----------|
| 凌晨喂奶后记录 | 3-8 次/天 | 步骤多、亮度刺眼 | 首页一键弹窗 + 暖夜模式 |
| 查看今天喂了几次 | 5+ 次/天 | 需要数数/计算 | 摘要卡片 48rpx 大字号 |
| 睡眠开始/结束 | 2-4 次/天 | 需开弹窗操作 | 状态胶囊一键操作 + 自动记录 |
| 疫苗到期提醒 | 2-3 次/月 | 容易遗忘 | 首页待办条 + 红点强提醒 |

---

## 功能需求

### FR-1：全局样式基础升级

**用户故事：** 作为照护者，我想要更柔和的视觉体验，以便在不同光线下都能舒适使用。

**验收标准：**
1. When `app.wxss` 加载，the system shall 包含 6 个新增 CSS 变量：`--growth-color`、`--surface-elevated`、`--elevation-1`、`--elevation-2`、`--radius-pill`、`--radius-xl`
2. When 暗色模式激活，the system shall 使用对应暗色变量覆盖（`--growth-color: #5C8CA8` 等）
3. When 任何数据大数字展示，the system shall 使用 48rpx/700 字号（从 40rpx 提升）
4. When 微型标签展示，the system shall 使用 22rpx/500（从 20rpx/400 提升）

> **技术说明**：仅在 `app.wxss` 的 `page {}` 和 `.dark-mode` 中追加 6 个变量，不修改现有变量。

---

### FR-2：首页布局精简（核心变更）

**用户故事：** 作为照护者，我想要首页信息更紧凑，减少滚动，以便凌晨半睁眼也能一眼获取宝宝状态。

**验收标准：**
1. When 首页加载完成，the system shall 展示 7 个区域（问候区 / 状态胶囊 / 今日摘要 / 快捷记录 / 今日待办 / AI 洞察 / 时间线），从原有 10+ 区域精简
2. When 首页渲染，the system shall 不再引用 `baby-card` 组件，宝宝信息合并到问候区
3. When 首页渲染，the system shall 多宝切换头像组显示在问候区右侧（48rpx 圆形，重叠排列）
4. When 问候区展示，the system shall 问候语+昵称用 40rpx/700 显示，昵称用 `--primary-color` 着色
5. When 摘要卡片渲染，the system shall 四列数字使用 48rpx/700，图标容器改为 64rpx 圆形
6. When 摘要卡片渲染，the system shall 每列底部新增 4rpx 进度条（功能色填充，`--radius-pill` 圆角）
7. When 用户点击摘要卡片任意一列，the system shall 直接打开对应记录弹窗（喂养/睡眠/排便/体温），而非跳转筛选
8. When 快捷入口渲染，the system shall 按钮宽度 128rpx、图标 36rpx、文字 24rpx、gap 16rpx（更紧凑）

> **技术说明**：首页问候区去掉 `<baby-card>` 引用，将多宝切换 `.baby-switch` 并入 `.greeting-bar`。摘要卡片 `onStatTap` 改为直接弹窗而非 `wx.switchTab`。

---

### FR-3：状态胶囊交互升级

**用户故事：** 作为照护者，我想要直接在首页状态条上结束睡眠计时，以便不需要额外操作。

**验收标准：**
1. When 无活动睡眠，the system shall 显示默认胶囊（72rpx 高，`--radius-md` 圆角），文案「上次喂养 Xh Xm 前」
2. When 有活动睡眠，the system shall 胶囊背景切换为睡眠功能色，显示「正在睡觉 · XhXm」+ 右侧「结束」按钮 + 左下录制指示灯（12rpx 红色圆点 + 呼吸动画）
3. When 睡眠超过 24h，the system shall 胶囊变为异常状态（红色调），显示「睡眠时间异常」+ 「取消计时」按钮
4. When 用户点击「结束」按钮，the system shall 写入睡眠记录、刷新统计，胶囊动画过渡回默认态
5. When 用户点击「取消计时」，the system shall 弹出 wx.showModal 二次确认后清除缓存，不写入记录

> **技术说明**：新增 `rec-dot.png`（16x16 红色录制指示灯图标），新增 `@keyframes recPulse` 呼吸动画。胶囊从 v3.x 的矩形 `status-banner` 改为圆角胶囊样式。

---

### FR-4：今日待办竖向化

**用户故事：** 作为照护者，我想要待办事项以条目形式展示而非横向滚动卡片，以便内容少时不浪费空间。

**验收标准：**
1. When 有待办事项，the system shall 以竖向列表展示（每条 80rpx 高，左侧 4rpx 色条）
2. When 待办超过 3 条，the system shall 仅展示 3 条 + 底部「查看全部 X 项 >」链接
3. When 待办项为逾期疫苗，the system shall 左侧色条为 `--danger-color`，状态标签「已逾期」红色
4. When 待办项为即将到期疫苗，the system shall 左侧色条为 `--warning-color`，标签「即将」橙色
5. When 无待办事项，the system shall 不渲染待办区域

> **技术说明**：替换首页 `todo-section` 中的横向 `scroll-view` 为竖向 `.todo-list`。

---

### FR-5：AI 洞察一行式

**用户故事：** 作为照护者，我想要 AI 洞察默认折叠为一行摘要，以便不占用过多首页空间。

**验收标准：**
1. When AI 洞察有内容且折叠态，the system shall 显示一行（64rpx 高），格式「[图标] 摘要文字...  [展开箭头]」
2. When 用户点击展开，the system shall 过渡动画展开完整 AI 文案 + 「更多建议 >」链接
3. When 折叠态，the system shall 背景为 `--surface-elevated`，圆角 `--radius-md`
4. When 展开态，the system shall 背景为 `--bg-secondary`，阴影 `--shadow-card`

> **技术说明**：修改 `insight-section` 组件新增 `compact` 属性供首页使用，或直接改造首页内联的 `.insight-card` 区块。

---

### FR-6：记录页优化

**用户故事：** 作为照护者，我想要在滚动记录列表时筛选栏固定在顶部，以便随时切换筛选类型。

**验收标准：**
1. When 用户向下滚动记录列表，the system shall 筛选标签栏吸顶固定（`position: sticky; top: 0;`）
2. When 选中某筛选标签，the system shall 底部显示 4rpx 品牌色指示条
3. When 记录列表展示，the system shall 页头去掉 `.header-icon` 图标，仅保留标题+副标题
4. When timeline 组件渲染，the system shall 左侧 56rpx 处新增 2rpx 竖线 + 功能色圆点节点（10rpx）

> **技术说明**：`record.wxml` 删除 `.header-icon` 区块。`.filter-toolbar` 添加 `sticky` 样式。`timeline` 组件新增时间轴线 CSS。

---

### FR-7：发现页优化

**用户故事：** 作为照护者，我想要发现页突出最紧急的待办事项，以便不遗漏重要节点。

**验收标准：**
1. When 有逾期/即将到期事项，the system shall 显示「此刻关注」聚焦卡片（单张，突出最紧急项）
2. When 无待办事项，the system shall 聚焦卡片显示品牌色鼓励语「宝宝各项指标正常」
3. When 功能入口展示，the system shall 从列表式改为 2x2 网格（疫苗追踪/生长曲线/发育里程碑/AI 助手）
4. When 专业参考标准展示，the system shall 精简为列表行（去掉描述文字，仅标题 + 来源标签 + 箭头）
5. When 专业参考弹窗打开，the system shall 从居中弹出改为底部弹出，复用 `popup.wxss` 规范

> **技术说明**：新建 `focus-card` 组件。`discover.wxml` 重构待办区和功能入口结构。

---

### FR-8：我的页优化

**用户故事：** 作为照护者，我想要更简洁的个人页面，以便快速找到常用功能。

**验收标准：**
1. When 我的页加载，the system shall 用户头像居中显示（100rpx，品牌色 3rpx 边框）
2. When 角色标签展示，the system shall 使用 `--radius-pill` 胶囊样式
3. When 菜单项展示，the system shall 去掉描述文字（`.menu-desc`），仅保留图标 + 标题 + 箭头
4. When 编辑个人资料弹窗打开，the system shall 从居中模态改为底部弹出，复用 `popup.wxss`

> **技术说明**：`profile.wxml` 重构 `.user-card` 为居中布局。`.edit-popup` 改为底部弹出结构。

---

### FR-9：弹窗统一升级

**用户故事：** 作为照护者，我想要所有弹窗风格一致，以便操作体验流畅统一。

**验收标准：**
1. When 任何底部弹窗打开，the system shall 顶部圆角为 `--radius-xl`(40rpx)
2. When 弹窗展示拖拽指示条，the system shall 尺寸为 48rpx 宽 / 4rpx 高 / `--radius-pill` 圆角
3. When 弹窗展示关闭按钮，the system shall 使用 `x-mark.png`(24rpx) 替代文字叉号
4. When 弹窗展示标题行，the system shall 图标容器 56rpx + 标题 32rpx/600
5. When 弹窗底部操作按钮展示，the system shall 统一高度 92rpx / `--radius-md` 圆角
6. When 弹窗内容区域展示，the system shall `max-height: 85vh`

> **技术说明**：修改 `styles/popup.wxss` 全局生效。`styles/form.wxss` 中 `.submit-btn` 高度从 96rpx 改为 92rpx。

---

### FR-10：居中弹窗改为底部弹出

**用户故事：** 作为照护者，我想要所有弹窗都从底部弹出，以便拇指操作区域统一。

**验收标准：**
1. When discover 专业参考弹窗打开，the system shall 从居中改为底部弹出
2. When profile 编辑个人资料弹窗打开，the system shall 从居中改为底部弹出
3. When growth WHO 标准/记录详情弹窗打开，the system shall 从居中改为底部弹出
4. When vaccine 疫苗详情/日期选择弹窗打开，the system shall 从居中改为底部弹出
5. When milestone 里程碑详情/标准说明弹窗打开，the system shall 从居中改为底部弹出
6. When family 权限编辑/转让弹窗打开，the system shall 从居中改为底部弹出
7. When auth 邀请码输入弹窗打开，the system shall 从居中改为底部弹出
8. If auth 创建成功弹窗，then the system shall 保留居中（带庆祝动画）

> **技术说明**：各页面内联弹窗统一改造为 `popup-mask` + `popup-container` 结构，复用 `popup.wxss`。

---

### FR-11：全页面页头图标清理

**用户故事：** 作为照护者，我想要页头更简洁，以便视觉更干净。

**验收标准：**
1. When 以下页面渲染，the system shall 去掉 `.header-icon` 区块：baby-create, baby-list, guide, family-create, family-join, growth, vaccine, milestone, baby-detail, ai-assistant, family, export, settings, record
2. When discover 页面渲染，the system shall 保留 `compass.png` 页头图标（品牌辨识度）
3. When `page-header.wxss` 加载，the system shall `.header-icon` 样式保留不删（discover 仍在使用）

---

### FR-12：细节打磨

**用户故事：** 作为照护者，我想要更精致的 UI 细节，以便整体体验更专业。

**验收标准：**
1. When picker 箭头展示，the system shall 使用 `chevron-right.png`(16rpx) 替代文字 `>`
2. When settings 主题选择展示，the system shall 使用 PNG 图标替代 Unicode/emoji 文字
3. When settings 危险操作展示，the system shall 增加 `--danger-color` 左侧 4rpx 色条
4. When vaccine/milestone 状态图标展示，the system shall 使用 PNG 图标替代文字（check-circle/warning/空心圆）
5. When easter-egg-popup 关闭按钮展示，the system shall 改用 `x-mark.png`(24rpx)

---

### FR-13：新增组件 — focus-card

**用户故事：** 作为照护者，我想要发现页有一张聚焦卡片突出最紧急待办，以便第一时间注意到。

**验收标准：**
1. When 传入逾期事项，the system shall 卡片左侧色条为 `--danger-color`，图标为 `warning-color.png`
2. When 传入即将到期事项，the system shall 左侧色条为 `--warning-color`
3. When 无待办，the system shall 显示品牌色鼓励语
4. When 用户点击卡片，the system shall 跳转对应详情页
5. When 暗色模式，the system shall `darkMode` prop 控制色条背景可见度

---

### FR-14：新增动画

**验收标准：**
1. When 进度条渲染，the system shall 从 0 增长到目标值（`@keyframes progressGrow`，600ms ease-out）
2. When 录制指示灯显示，the system shall 呼吸闪烁（`@keyframes recPulse`，1.5s infinite）
3. When 胶囊状态切换，the system shall 过渡动画（`@keyframes capsuleTransition`，300ms ease）
4. When 用户开启减少动画偏好（`prefers-reduced-motion: reduce`），the system shall 禁用所有动画

---

## 非功能需求

### NFR-1：兼容性
- 兼容微信小程序基础库 ≥ 2.20.0
- 兼容 iOS 14+ 和 Android 8.0+
- 屏幕宽度支持 320px ~ 414px

### NFR-2：性能
- 新增 CSS 变量仅 6 个，不影响渲染性能
- 新增动画使用纯 CSS，不引入 JS 定时器
- 进度条动画使用 `will-change: width` 硬件加速

### NFR-3：暗色模式
- 全部 6 个新增变量都有 `.dark-mode` 对应
- 状态胶囊三态背景色在暗色下验证
- 聚焦卡片色条在暗色下可见

### NFR-4：可访问性
- 色彩对比度：正文 4.5:1 / 大字 3:1
- 触摸目标：最小 88rpx
- 所有纯图标按钮加 `aria-label`
- 状态胶囊录制指示灯 + 文字双通道

---

## 变更影响范围

### 共享样式文件

| 文件 | 改动类型 | 内容 |
|------|----------|------|
| `app.wxss` | 增量 | 新增 6 个 CSS 变量 + 暗色对应 + 3 个新动画 |
| `styles/popup.wxss` | 小改 | 圆角/指示条/标题行/按钮高度/max-height |
| `styles/form.wxss` | 小改 | `.submit-btn` 高度 96→92rpx |
| `styles/page-header.wxss` | 不变 | 保留 `.header-icon` 样式 |

### 页面

| 页面 | 改动类型 | 涉及 FR |
|------|----------|---------|
| home | **大改** | FR-2/3/4/5/14 |
| record | 中改 | FR-6/11 |
| discover | **大改** | FR-7/10/11/13 |
| profile | 中改 | FR-8/10/11 |
| auth | 小改 | FR-10/12 |
| baby-create | 小改 | FR-11/12 |
| baby-list | 小改 | FR-11/12 |
| guide | 小改 | FR-11 |
| growth | 小改 | FR-10/11 |
| vaccine | 小改 | FR-10/11/12 |
| milestone | 小改 | FR-10/11/12 |
| baby-detail | 小改 | FR-11 |
| ai-assistant | 小改 | FR-11 |
| family | 小改 | FR-10/11 |
| family-create | 小改 | FR-11 |
| family-join | 小改 | FR-11 |
| export | 小改 | FR-12 |
| settings | 小改 | FR-12 |

### 组件

| 组件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `focus-card`（新增） | 新建 | FR-13 |
| `timeline` | 增量 | FR-6 |
| `insight-section` | 增量 | FR-5 |
| 5 个记录弹窗 | 自动（popup.wxss 全局生效） | FR-9 |
| `easter-egg-popup` | 小改 | FR-12 |

### 图标资源

| 用途 | 文件 | 来源 |
|------|------|------|
| 亮色主题(太阳) | `/images/icons/sun.png` | Iconify `mdi:white-balance-sunny` |
| 暗夜主题(月亮) | `/images/icons/moon.png` | Iconify `mdi:weather-night` |
| 录制指示灯 | `/images/icons/rec-dot.png` | Iconify `mdi:record-circle` |

---

*文档版本：v1.0*
*创建日期：2026-04-13*
*状态：已确认*
