specs/ui-redesign-v4/
├── design-spec.md      # 设计总纲（原始设计规格）
├── detailed-spec.md    # 逐页细化规格（原始设计规格）
├── requirements.md     # 需求文档（spec 三件套）
├── design.md           # 实施设计（spec 三件套）v2.0
├── tasks.md            # 任务拆解（spec 三件套）v2.0
└── plan.md             # 执行计划 ⭐ 新增
# 执行计划 - UI 重设计 v4.0（UI Redesign v4）

> **版本**: v1.0 | **日期**: 2026-04-13 | **状态**: 待执行
> **分支**: `feature/ui-redesign-v4`
> **关联**: `tasks.md` v2.0（30 个任务）| `design.md` v2.0 | `design-spec.md` + `detailed-spec.md`

---

## 开发前检查清单 ✅

- [x] 已阅读 `architecture.md` — 五层架构、分包策略、15 个组件
- [x] 已阅读 `data-model.md` — 6 个集合、缓存策略（本次不涉及数据模型变更）
- [x] 已阅读 `service-api.md` — 11 个服务（本次仅涉及 RecordService.getRecords 查询，无服务层变更）
- [x] 已阅读 `coding-conventions.md` — 命名约定、CSS 变量规范、暗色模式接入模式
- [x] 已阅读 `ui-design-system.md` — 美拉德色系、间距网格、动画定义
- [x] 已阅读 `component-library.md` — 15 个组件属性/事件（timeline/insight-section 需增量改造）
- [x] 已创建 `specs/ui-redesign-v4/requirements.md` v1.0
- [x] 已创建 `specs/ui-redesign-v4/design.md` v2.0
- [x] 已创建 `specs/ui-redesign-v4/tasks.md` v2.0
- [x] 已创建 `feature/ui-redesign-v4` 分支并推送远程

---

## 每日执行计划

### Day 1 — 基础层改造（M1）

**目标**: 完成全部基础设施，确保后续任务不被阻塞

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-1.1 全局 CSS 变量 | `feat(app): 新增 6 个 v4.0 CSS 变量 + 暗色覆盖 FR-1` | 1h |
| 上午 | T-1.2 全局动画定义 | `feat(app): 新增 progressGrow/recPulse/capsuleTransition 动画 FR-14` | 0.5h |
| 上午 | T-1.3 下载补充图标 | `chore: 通过 Iconify 下载 sun/moon/rec-dot 3 个图标 FR-12` | 0.5h |
| 下午 | T-1.4 popup.wxss 升级 | `style(popup): 弹窗统一升级 — 圆角/指示条/标题行/按钮 FR-9` | 1.5h |
| 下午 | T-1.5 form.wxss 按钮高度 | `style(form): submit-btn 高度统一 92rpx FR-9` | 0.5h |

**Day 1 验收节点**:
- [ ] `app.wxss` 新变量编译通过，现有页面视觉无变化
- [ ] 任意记录弹窗（如喂养弹窗）打开后圆角/指示条/按钮高度正确
- [ ] baby-create 页面表单按钮高度正确
- [ ] 3 个新图标文件存在且 icon-config.js 可引用

---

### Day 2 — 首页重构上半场（M2 前半）

**目标**: 完成首页布局精简核心 — 问候区 + 胶囊 + 摘要卡片

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-2.1 问候区精简 | `feat(home): 去掉 baby-card，合并多宝切换到问候区 FR-2` | 2h |
| 下午 | T-2.2 状态胶囊 | `feat(home): 状态横幅改为胶囊样式 + 录制指示灯 FR-3` | 4h |

**Day 2 验收节点**:
- [ ] 首页无 baby-card 独立区块，问候区显示昵称(品牌色) + 多宝头像
- [ ] 胶囊默认态显示「上次喂养 Xh Xm 前」
- [ ] 胶囊睡眠态显示计时 + REC 呼吸灯 + 结束按钮
- [ ] 胶囊异常态显示警告 + 取消计时按钮
- [ ] 暗色模式下胶囊三态背景色正确

---

### Day 3 — 首页重构下半场（M2 后半）

**目标**: 完成首页剩余 5 个区域 + timeline 时间轴线

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-2.3 摘要卡片升级 | `feat(home): 摘要卡片 48rpx 大数字 + 进度条 + 点击弹窗 FR-2` | 3h |
| 上午 | T-2.4 快捷入口尺寸 | `style(home): 快捷入口按钮尺寸优化 128rpx FR-2` | 0.5h |
| 下午 | T-2.5 待办竖向化 | `feat(home): 今日待办从横滚改为竖向条列表 FR-4` | 2h |
| 下午 | T-2.6 AI 洞察一行式 | `feat(home): AI 洞察改为折叠一行式 + 展开动画 FR-5` | 1.5h |
| 下午 | T-2.7 时间线轴线 | `feat(components): timeline 新增左侧时间轴线 + 功能色节点 FR-6` | 1.5h |

**Day 3 验收节点**:
- [ ] 首页 7 个区域全部完成，整体布局紧凑
- [ ] 摘要卡片数字 48rpx，进度条从 0 动画增长
- [ ] 点击摘要列直接打开对应弹窗（非跳转）
- [ ] 待办竖向展示，逾期红色色条，最多 3 条
- [ ] AI 洞察默认折叠一行，点击展开
- [ ] 时间线左侧有连续竖线 + 功能色圆点
- [ ] **首页整体在亮色/暗色模式下视觉正确**

---

### Day 4 — 记录页 + 发现页（M3）

**目标**: 完成记录页筛选栏吸顶 + 发现页全面重构

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-3.1 记录页优化 | `feat(record): 筛选栏吸顶 + 选中指示条 + 去页头图标 FR-6/11` | 1.5h |
| 上午 | T-3.2 focus-card 组件 | `feat(components): 新建 focus-card 聚焦卡片组件 FR-13` | 2h |
| 下午 | T-3.3 发现页重构 | `feat(discover): 聚焦卡片 + 2x2 工具网格 + 参考精简 FR-7` | 3h |
| 下午 | T-3.4 发现页弹窗底部化 | `refactor(discover): 专业参考弹窗从居中改为底部弹出 FR-10` | 1h |

**Day 4 验收节点**:
- [ ] 记录页滚动时筛选栏固定在顶部，选中标签有品牌色下划线
- [ ] 发现页「此刻关注」卡片突出最紧急待办
- [ ] 2x2 育儿工具网格正常展示，待办数徽章正确
- [ ] 专业参考弹窗从底部弹出
- [ ] focus-card 暗色模式色条可见

---

### Day 5 — 我的页 + 弹窗统一（M4）

**目标**: 完成我的页重构 + 全局弹窗统一改造

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-4.1 我的页重构 | `feat(profile): 居中头像 + 菜单精简 + pill 标签 FR-8` | 2h |
| 上午 | T-4.2 编辑弹窗底部化 | `refactor(profile): 编辑资料弹窗从居中改为底部弹出 FR-10` | 1h |
| 下午 | T-4.3 页头图标清理 | `refactor: 14 个页面去掉页头装饰图标 FR-11` | 1h |
| 下午 | T-4.4 居中弹窗批量底部化 | `refactor: growth/vaccine/milestone/family/auth 9 个弹窗底部化 FR-10` | 3h |
| 下午 | T-4.5 弹窗关闭按钮改造 | `style(components): 7 个弹窗关闭按钮改为 x-mark.png FR-9` | 0.5h |

**Day 5 验收节点**:
- [ ] 我的页头像居中 100rpx，菜单无描述文字
- [ ] 14 个页面页头仅标题+副标题（discover 保留图标）
- [ ] 9 个原居中弹窗全部从底部弹出
- [ ] 7 个弹窗组件关闭按钮为 x-mark.png 图标
- [ ] auth 创建成功弹窗仍为居中

---

### Day 6 — 弹窗内部样式升级（M5 前半）

**目标**: 完成所有弹窗组件内部视觉升级

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-5.1 feeding-popup 升级 | `feat(feeding-popup): 三栏等宽 + 母乳胶囊 + 常用量功能 FR-12` | 3h |
| 下午 | T-5.2 sleep/diaper/temperature 升级 | `style(components): 睡眠/排便/体温弹窗视觉升级 FR-12` | 2.5h |
| 下午 | T-5.3 growth-popup 上次对比 | `feat(growth-popup): 新增输入框上次对比显示 FR-12` | 1.5h |
| 下午 | T-5.4 report/export/baby-edit/error-state | `style(components): report/export/baby-edit/error-state 视觉升级 FR-12` | 1.5h |

**Day 6 验收节点**:
- [ ] 喂养弹窗常用量功能可读取历史用量并点击填入
- [ ] 睡眠弹窗追踪时间 56rpx/700
- [ ] 排便弹窗质地选择为描述卡片式
- [ ] 体温弹窗输入 48rpx 居中
- [ ] 生长弹窗显示上次数值对比
- [ ] report-popup 评分 48rpx + pill tab

---

### Day 7 — 分包页面视觉升级（M5 后半）

**目标**: 完成 12 个分包/辅助页面的视觉统一

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-5.5 packageGrowth 4 页面 | `style(packageGrowth): growth/vaccine/milestone/baby-detail 视觉升级 FR-12` | 3h |
| 上午 | T-5.6 packageSocial 4 页面 | `style(packageSocial): ai-assistant/family/family-join/export 视觉升级 FR-12` | 2h |
| 下午 | T-5.7 auth 页面 | `style(auth): 功能特点/步骤指示器/关系网格视觉微调 FR-12` | 1.5h |
| 下午 | T-5.8 baby-create/baby-list/guide | `style: baby-create/baby-list/guide 视觉微调 FR-12` | 1.5h |
| 下午 | T-5.9 跨页面细节打磨 | `style: 全局 picker 箭头/settings 主题图标/危险色条统一 FR-12` | 1h |

**Day 7 验收节点**:
- [ ] growth 数据卡片 2x2 网格，百分位 pill 标签
- [ ] vaccine/milestone 状态图标全部为 PNG
- [ ] ai-assistant 快捷问题 pill 化，输入区 pill
- [ ] family 邀请码 40rpx/600
- [ ] auth 功能特点圆形图标 + 开始使用按钮 pill
- [ ] baby-create 性别选择为卡片按钮
- [ ] settings 主题图标全部 PNG，无 emoji/Unicode
- [ ] **全部 picker 箭头为 chevron-right.png**

---

### Day 8 — 暗色 QA + 文档同步（M6）

**目标**: 全局暗色模式验收 + 项目文档更新

| 时段 | 任务 | commit message | 预计耗时 |
|------|------|---------------|----------|
| 上午 | T-6.1 暗色 QA（28 项） | `fix: 暗色模式逐页 QA 修复` | 3h |
| 下午 | T-6.2 文档同步 | `docs: 同步更新文档 — ui-redesign-v4 迭代产出` | 2h |

**Day 8 验收节点**:
- [ ] `detailed-spec.md` §7 暗色矩阵 28 项全部通过
- [ ] 重点项：胶囊三态 / 进度条底色 / 聚焦卡片 / 时间轴线 / 头像边框
- [ ] `architecture.md` 已更新（focus-card 组件、组件数 16）
- [ ] `ui-design-system.md` 已更新（6 变量、3 动画、pill/xl 圆角）
- [ ] `component-library.md` 已更新（focus-card + timeline/insight-section 变更）
- [ ] `README.md` 版本历史追加 v4.0
- [ ] `profile.wxml` 版本号更新为 v4.0.0

---

## 开发中检查清单（每日执行）

- [ ] 所有颜色使用 CSS 变量，未硬编码 `#hex` 或 `rgba()`
- [ ] 新增样式引用 `ui-design-system.md` 定义的间距/圆角/阴影
- [ ] focus-card 组件支持 `darkMode` prop
- [ ] 不修改 `design.md` 文件变更清单之外的代码
- [ ] 每个 Task 完成后有独立 commit（`<type>(<scope>): <subject> FR-x`）
- [ ] tasks.md 中对应 checkbox 已勾选（`- [ ]` → `- [x] ✅`）
- [ ] 每日结束 push 到远程

---

## 开发后检查清单（Day 8 完成后执行）

- [ ] `tasks.md` 所有 30 个任务标记为 ✅
- [ ] `tasks.md` 状态更新为「✅ 已完成（日期）」
- [ ] 6 份核心文档同步完成
- [ ] 版本号 v4.0.0 已写入
- [ ] `git rebase develop` 无冲突
- [ ] 创建 PR（标题：`feat: UI Redesign v4.0 — 全页面视觉统一升级`）
- [ ] PR 描述引用 spec 三件套 + 变更清单
- [ ] PR 合并后清理 `feature/ui-redesign-v4` 分支

---

## Commit 总览（预计 30 个 commit）

```
Day 1 (M1):  5 commits — feat(app) x2, chore x1, style(popup) x1, style(form) x1
Day 2 (M2a): 2 commits — feat(home) x2
Day 3 (M2b): 5 commits — feat(home) x3, style(home) x1, feat(components) x1
Day 4 (M3):  4 commits — feat(record) x1, feat(components) x1, feat(discover) x1, refactor(discover) x1
Day 5 (M4):  5 commits — feat(profile) x1, refactor(profile) x1, refactor x2, style(components) x1
Day 6 (M5a): 4 commits — feat(feeding-popup) x1, style(components) x2, feat(growth-popup) x1
Day 7 (M5b): 5 commits — style(packageGrowth) x1, style(packageSocial) x1, style(auth) x1, style x2
Day 8 (M6):  2 commits — fix x1, docs x1
                         ─────────
                         32 commits total
```

---

## 风险应对计划

| 风险场景 | 触发信号 | 应对措施 |
|----------|----------|----------|
| popup.wxss 改动导致现有弹窗布局异常 | Day 1 T-1.4 后弹窗内容溢出/错位 | 立即回滚该属性，改为组件级覆盖 |
| 状态胶囊开发超时（预估最复杂） | Day 2 T-2.2 超过 6h | 简化 REC 指示灯（去掉呼吸动画，改为静态红点）|
| 居中弹窗改底部后内容不完整 | Day 5 T-4.4 某弹窗内容超出 | 该弹窗改为全屏弹出（同 report-popup 方案）|
| 暗色 QA 发现大量问题 | Day 8 T-6.1 修复超过 3h | 拆分为两轮：第一轮修复 4 个 Tab 页，剩余页面追加 Day 9 |

---

*文档版本：v1.0*
*创建日期：2026-04-13*
*状态：待执行*
