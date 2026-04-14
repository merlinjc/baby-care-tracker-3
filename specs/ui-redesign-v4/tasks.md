# 实施计划 - UI 重设计 v4.0（UI Redesign v4）

> 版本：v2.0 | 日期：2026-04-13 | 状态：待开发
> **更新说明**：v2.0 基于 10 轮 review 补充 8 个遗漏任务，覆盖弹窗组件内部样式、分包页面视觉升级

## 实施概览

预计总工时：约 50-70 小时（7-10 个工作日）
关键里程碑：
- M1（0.5 天）：基础层 + 全局样式 + 图标资源
- M2（2-3 天）：首页重构（核心工作量）
- M3（1.5-2 天）：记录页 + 发现页优化
- M4（1 天）：我的页 + 弹窗统一
- M5（1-2 天）：弹窗内部样式 + 分包页面视觉升级 + 细节打磨
- M6（0.5-1 天）：暗色 QA + 文档同步

---

## 任务列表

### 阶段一：基础层改造（M1）

- [x] **T-1.1** 新增全局 CSS 变量 + 暗色覆盖 ✅
  - `app.wxss` `page {}` 末尾追加 6 个新变量
  - `app.wxss` `.dark-mode` 末尾追加 4 个暗色覆盖（`--radius-pill`/`--radius-xl` 无需暗色覆盖）
  - 验收：编译通过，不影响现有页面视觉
  - _依赖：无 | 涉及：FR-1_

- [x] **T-1.2** 新增全局动画定义 ✅
  - `app.wxss` 新增 3 个 `@keyframes`（progressGrow/recPulse/capsuleTransition）
  - `app.wxss` 新增 `@media (prefers-reduced-motion: reduce)` 声明
  - 验收：动画在开发者工具中可预览
  - _依赖：T-1.1 | 涉及：FR-14_

- [x] **T-1.3** 下载补充图标（3 个） ✅
  - Iconify 下载 `sun.png`(36x36, #D4883D)、`moon.png`(36x36, #B8A8D4)、`rec-dot.png`(16x16, #E85454)
  - 存放 `/images/icons/`，更新 `utils/icon-config.js`
  - 验收：图标正常引用
  - _依赖：无 | 涉及：FR-3/12_

- [x] **T-1.4** 修改 `styles/popup.wxss` 弹窗统一升级 ✅
  - 10 处 CSS 属性修改（见 design.md §2.3 完整清单）
  - 新增 `.popup-close image` 样式定义
  - 验收：打开喂养弹窗确认圆角/指示条/标题/按钮高度生效
  - _依赖：T-1.1 | 涉及：FR-9_

- [x] **T-1.5** 修改 `styles/form.wxss` 按钮高度 ✅
  - `.submit-btn` 高度 96rpx → 92rpx
  - 验收：baby-create 按钮高度正确
  - _依赖：无 | 涉及：FR-9_

---

### 阶段二：首页重构（M2）

- [x] **T-2.1** 问候区精简 — 去 baby-card、合并多宝切换 ✅
  - `home.wxml` 删除 `<baby-card>` 引用，将多宝头像组并入 `.greeting-bar`
  - 问候语昵称用 `--primary-color` 着色，40rpx/700
  - 多宝头像 48rpx 圆形重叠排列
  - 验收：问候区紧凑显示，无独立 baby-card
  - _依赖：T-1.1 | 涉及：FR-2_

- [x] **T-2.2** 状态胶囊改造 ✅
  - `.status-banner` → `.status-capsule`（72rpx/`--radius-md`）
  - 新增 rec-dot 录制指示灯 + REC 标签 + 呼吸动画
  - 三态样式：默认/睡眠中/异常 + 暗色模式覆盖
  - 复用现有 `endSleepFromBanner` / `cancelAbnormalSleep`
  - 验收：三种状态视觉正确；结束睡眠后刷新；暗色模式背景正确
  - _依赖：T-1.1/T-1.2/T-1.3 | 涉及：FR-3_

- [ ] **T-2.3** 摘要卡片升级 — 48rpx 大数字 + 进度条
  - 图标容器 72rpx 方形 → 64rpx 圆形
  - `.stat-value` 40rpx → 48rpx/700
  - 辅助行从 2 行精简为 1 行
  - 每列底部新增 4rpx 进度条（功能色填充 + `progressGrow` 动画）
  - `onStatTap` 改为直接打开弹窗
  - `computeDisplayFields()` 新增进度条百分比计算
  - 验收：数字 48rpx；进度条动画增长；点击列弹窗打开
  - _依赖：T-1.1/T-1.2 | 涉及：FR-2_

- [ ] **T-2.4** 快捷入口尺寸优化
  - 按钮 140→128rpx / 图标 40→36rpx / 文字 26→24rpx / gap 20→16rpx
  - 验收：5 格在各尺寸手机正常显示
  - _依赖：无 | 涉及：FR-2_

- [ ] **T-2.5** 今日待办竖向化
  - 横向 `scroll-view` → 竖向 `.todo-list`
  - 每条 80rpx / 左侧 4rpx 色条 / 最多 3 条 + 查看全部
  - 验收：无待办不渲染；逾期红色；即将橙色
  - _依赖：T-1.1 | 涉及：FR-4_

- [ ] **T-2.6** AI 洞察一行式改造
  - `.insight-card` 改为折叠/展开双态（64rpx 收起 / 自适应展开）
  - `max-height` + opacity 过渡动画
  - 验收：默认折叠一行；展开完整内容；暗色正确
  - _依赖：T-1.1 | 涉及：FR-5_

- [ ] **T-2.7** 时间线时间轴线
  - `timeline.wxml` 新增竖线 + 功能色圆点
  - `timeline.wxss` 轴线样式（56rpx/2rpx/`--border-color`）
  - 验收：左侧连续竖线 + 颜色节点；暗色自适应
  - _依赖：无 | 涉及：FR-6_

---

### 阶段三：记录页 + 发现页（M3）

- [x] **T-3.1** 记录页筛选栏吸顶 + 页头精简 ✅
  - 去页头 `.header-icon`
  - `.filter-toolbar` sticky + 选中标签 4rpx 指示条
  - 验收：滚动时筛选栏固定；选中标签有下划线
  - _依赖：无 | 涉及：FR-6/11_

- [x] **T-3.2** 新建 focus-card 组件 ✅
  - `focus-card.js/.wxml/.wxss/.json`
  - Properties: type/title/description/icon/urgency/targetUrl/darkMode
  - 验收：不同 urgency 显示对应色调；暗色正确
  - _依赖：T-1.1 | 涉及：FR-13_

- [x] **T-3.3** 发现页重构 ✅
  - 待办区 → `<focus-card>`（取最紧急一项）
  - 功能入口 → 2x2 网格 `.tool-grid`
  - 参考标准 → 精简列表行
  - 页头副标题改为「科学育儿，温暖陪伴」
  - 新增聚焦卡片优先级计算、`toolItems` 数据
  - 验收：聚焦卡片突出最紧急事项；2x2 网格正确
  - _依赖：T-3.2 | 涉及：FR-7_

- [x] **T-3.4** 发现页弹窗底部化 ✅
  - `.info-popup` → `popup-mask + popup-container` 结构
  - 验收：参考标准弹窗从底部弹出
  - _依赖：T-1.4 | 涉及：FR-10_

---

### 阶段四：我的页 + 弹窗统一（M4）

- [x] **T-4.1** 我的页重构 ✅
  - 用户信息居中（头像 100rpx / 品牌色 3rpx 边框 / `--elevation-2`）
  - 菜单去描述文字 + 角色标签 pill 化
  - 验收：头像居中；菜单仅图标+标题+箭头
  - _依赖：T-1.1 | 涉及：FR-8_

- [x] **T-4.2** 我的页编辑弹窗底部化 ✅
  - `.edit-popup` → 底部弹出结构，复用 popup.wxss
  - 验收：编辑资料从底部弹出
  - _依赖：T-1.4 | 涉及：FR-10_

- [x] **T-4.3** 批量页头图标清理（3 页实际涉及） ✅
  - baby-create / family-create / family-join 去 `.header-icon`
  - record 已在 T-3.1 清理；discover 保留 `compass.png`
  - 验收：页头仅标题+副标题
  - _依赖：无 | 涉及：FR-11_

- [x] **T-4.4** 弹窗关闭按钮批量改造（13 处） ✅
  - 6 个弹窗组件：feeding/sleep/diaper/temperature/growth/baby-edit-popup
  - 7 个分包内联弹窗：vaccine(2)/growth(3)/milestone(2)
  - `<text>×</text>` → `<image src="/images/icons/x-mark.png" />`
  - 验收：所有弹窗关闭按钮显示 x-mark 图标
  - _依赖：T-1.4 | 涉及：FR-9_

- [x] **T-4.5** 居中弹窗底部化（profile） ✅
  - profile 编辑弹窗从居中(580rpx)改为底部弹出
  - discover 已在 T-3.4 完成
  - 验收：编辑资料弹窗从底部弹出
  - _依赖：T-1.4 | 涉及：FR-10_

---

### 阶段五：弹窗内部样式 + 分包页面升级（M5）⭐ 新增

- [x] **T-5.1** feeding-popup 内部样式升级 ✅
  - 母乳侧选择 → `--radius-pill` 胶囊
  - 总奶量数字 40rpx/700 / `--feeding-color`
  - **新增常用量功能**：读取最近 3 次配方奶用量，点击快捷填入
  - 验收：类型选中态正确；常用量显示且可点击填入
  - _依赖：T-1.4 | 涉及：FR-12（design-spec §6.2）_

- [x] **T-5.2** sleep/diaper/temperature-popup 内部样式升级 ✅
  - sleep: 模式切换 pill + 追踪时间 56rpx/700 + 地点选择 pill + 结束按钮 primary 渐变
  - diaper: 质地选择改为描述卡片式 + 选中态 `--diaper-color` 边框
  - temperature: 发热等级 pill 标签
  - 验收：各弹窗视觉升级正确
  - _依赖：T-1.4 | 涉及：FR-12（detailed-spec §5.2-5.4）_

- [x] **T-5.3** growth-popup 上次对比功能 ✅
  - 打开弹窗时查询最近一条生长记录
  - 体重/身高输入框下方显示「上次: X.Xkg」/ 22rpx / `--text-hint`
  - 验收：有历史数据时显示对比；无历史数据时不显示
  - _依赖：T-1.4 | 涉及：FR-12（design-spec §6.2）_

- [x] **T-5.4** baby-edit-popup 头像缩小 ✅
  - baby-edit: 头像 160→100rpx
  - 验收：编辑宝宝弹窗头像更精致
  - _依赖：T-1.4 | 涉及：FR-12（detailed-spec §5.9）_

- [x] **T-5.5** 分包页面视觉升级 — packageGrowth ✅
  - growth: 类型选择器吸顶 + 选中态底部白色指示条
  - vaccine: 状态徽章 pill 化
  - milestone: 进度条 4rpx / surface-elevated 底色 / pill 圆角
  - 验收：各页面视觉符合 detailed-spec §3.x 规格
  - _依赖：T-1.1/T-1.3 | 涉及：FR-12_

- [x] **T-5.6** 分包页面视觉升级 — packageSocial ✅
  - ai-assistant: 配额条 pill 圆角
  - family: 角色标签 pill
  - family-join: 邀请码 40rpx/letter-spacing:12rpx + 按钮 92rpx/radius-md
  - 验收：各页面视觉符合 detailed-spec §4.x 规格
  - _依赖：T-1.1 | 涉及：FR-12_

- [x] **T-5.7** auth 页面视觉微调 ✅
  - 功能特点图标容器 96→56rpx 圆形
  - 开始使用按钮 100→96rpx / pill 圆角
  - 步骤指示器 20→10rpx / 活动态品牌色纯色
  - 验收：auth 三步引导视觉升级正确
  - _依赖：T-1.1 | 涉及：FR-12（detailed-spec §2.5）_

- [x] **T-5.8** baby-create 视觉微调 ✅
  - 性别选择选中态改用 --surface-elevated 背景
  - 验收：性别卡片选中态更统一
  - _依赖：T-1.1 | 涉及：FR-12_

- [ ] **T-5.9** 细节打磨（跨页面）
  - 所有 picker 箭头文字 `>` / `›` → `chevron-right.png`(16rpx)
  - settings 主题 Unicode/emoji → PNG
  - settings 危险操作 + 左侧 4rpx `--danger-color` 色条
  - 验收：全部 emoji/Unicode 替换为 PNG
  - _依赖：T-1.3 | 涉及：FR-12_

---

### 阶段六：暗色 QA + 文档同步（M6）

- [x] **T-6.1** 全局暗色模式 QA ✅
  - 逐页检查 detailed-spec §7 暗色模式矩阵 28 项
  - 全部通过 CSS 变量自适应，无额外暗色覆盖需要
  - 验收：所有页面暗色模式对比度达标
  - _依赖：T-1.x ~ T-5.x 全部 | 涉及：全部 FR_

- [x] **T-6.2** 文档同步更新 ✅
  - `architecture.md`：版本 v4.0 / 组件数 15→16 / 新增 focus-card
  - `ui-design-system.md`：版本 v4.0 / +6 变量 / +3 动画 / +2 圆角
  - `component-library.md`：版本 v4.0 / 新增 focus-card 完整文档
  - `README.md`：产品版本 v4.0
  - `profile.wxml`：版本号 v4.0.0（Day 5 已完成）
  - 验收：文档与代码一致
  - _依赖：T-6.1 | 涉及：文档同步_

---

## 任务依赖关系

```
T-1.1 ─┬─→ T-1.2 ──→ T-2.2
        ├─→ T-1.4 ──→ T-3.4 / T-4.2 / T-4.4 / T-4.5
        │              T-5.1 / T-5.2 / T-5.3 / T-5.4
        ├─→ T-2.1
        ├─→ T-2.3
        ├─→ T-2.5
        ├─→ T-2.6
        ├─→ T-3.2 ──→ T-3.3
        ├─→ T-4.1
        ├─→ T-5.5 / T-5.6 / T-5.7 / T-5.8
        │
T-1.3 ──→ T-2.2 / T-5.5 / T-5.8 / T-5.9
        │
T-1.5 ─── 独立
T-2.4 ─── 独立
T-2.7 ─── 独立
T-3.1 ─── 独立
T-4.3 ─── 独立
        │
T-6.1 ── 依赖全部
T-6.2 ── 依赖 T-6.1
```

**可并行任务组**：
- M1: T-1.1 ~ T-1.5 全部可并行
- M2: T-2.4 / T-2.7 可与其他 M2 任务并行
- M3: T-3.1 与 T-3.2 可并行
- M4: T-4.3 与 T-4.1/T-4.2 可并行
- M5: T-5.5~T-5.9 可并行（均仅依赖 T-1.x）

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| popup.wxss 修改影响现有弹窗 | 中 | 高 | T-1.4 后逐个弹窗回归 |
| 首页去 baby-card 影响其他页 | 低 | 低 | 仅去 home 引用，不删组件 |
| 居中弹窗改底部后内容溢出 | 中 | 中 | 85vh max-height + scroll-y 兜底 |
| 暗色模式新增元素对比度不足 | 中 | 中 | T-6.1 专门 QA 逐项检查 |
| 筛选栏 sticky 低版本基础库 | 低 | 低 | 基础库 ≥ 2.20.0 已支持 |
| 时间轴线与左滑操作冲突 | 中 | 中 | 轴线 z-index 低于记录项 |
| 喂养常用量 StorageUtil 数据增长 | 低 | 低 | 最多存 10 条，自动截断 |
| growth-popup 上次对比查询延迟 | 低 | 低 | 异步加载，不阻塞弹窗打开 |

---

*文档版本：v2.0*
*创建日期：2026-04-13*
*状态：待开发*
