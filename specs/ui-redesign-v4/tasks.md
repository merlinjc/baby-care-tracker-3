# 实施计划 - UI 重设计 v4.0（UI Redesign v4）

> 版本：v1.0 | 日期：2026-04-13 | 状态：待开发

## 实施概览

预计总工时：约 40-56 小时（5-8 个工作日）
关键里程碑：
- M1（0.5 天）：基础层 + 全局样式 + 图标资源
- M2（2-3 天）：首页重构（核心工作量）
- M3（1.5-2 天）：记录页 + 发现页优化
- M4（1-2 天）：我的页 + 弹窗统一 + 细节打磨 + 暗色 QA

---

## 任务列表

### 阶段一：基础层改造（M1）

- [ ] **T-1.1** 新增全局 CSS 变量 + 暗色模式对应
  - `app.wxss` `page {}` 末尾追加 6 个新变量
  - `app.wxss` `.dark-mode` 末尾追加 4 个暗色覆盖
  - 验收：编译通过，不影响现有页面视觉
  - _依赖：无 | 涉及：FR-1_

- [ ] **T-1.2** 新增全局动画定义
  - `app.wxss` 新增 `@keyframes progressGrow`、`recPulse`、`capsuleTransition`
  - `app.wxss` 新增 `@media (prefers-reduced-motion: reduce)` 声明
  - 验收：动画在开发者工具中可预览
  - _依赖：T-1.1 | 涉及：FR-14_

- [ ] **T-1.3** 下载补充图标（3 个）
  - 通过 Iconify 下载 `sun.png`(36x36, #D4883D)、`moon.png`(36x36, #B8A8D4)、`rec-dot.png`(16x16, #E85454)
  - 存放到 `/images/icons/`
  - 更新 `utils/icon-config.js` 注册新图标
  - 验收：`icon-config.js` 中可正确引用三个新图标路径
  - _依赖：无 | 涉及：FR-3/12_

- [ ] **T-1.4** 修改 `styles/popup.wxss` 弹窗统一升级
  - 圆角 `--radius-lg` → `--radius-xl`
  - `max-height` 80vh → 85vh
  - `.popup-content height` 同步调整
  - `.swipe-indicator` 尺寸 80rpx/8rpx → 48rpx/4rpx/`--radius-pill`
  - `.popup-icon` 64rpx → 56rpx
  - `.popup-title` 36rpx → 32rpx
  - `.submit-btn` 88rpx → 92rpx / `--radius-lg` → `--radius-md`
  - 验收：打开任意记录弹窗（如喂养弹窗），确认新样式生效
  - _依赖：T-1.1 | 涉及：FR-9_

- [ ] **T-1.5** 修改 `styles/form.wxss` 按钮高度统一
  - `.submit-btn` 高度 96rpx → 92rpx
  - 验收：baby-create 页面提交按钮高度正确
  - _依赖：无 | 涉及：FR-9_

---

### 阶段二：首页重构（M2）

- [ ] **T-2.1** 首页问候区精简 — 去掉 baby-card、合并多宝切换
  - `home.wxml` 删除 `<baby-card>` 引用（L47-50）
  - `home.wxml` 将 `.baby-switch`(L74-92) 头像组移入 `.greeting-bar` 右侧
  - `home.wxml` 问候语昵称用 `--primary-color` 着色
  - `home.wxss` 新增问候区改版样式（40rpx/700 问候语、48rpx 多宝头像、重叠排列）
  - `home.json` 中可保留 `baby-card` 注册（其他页面可能仍用），或标注废弃
  - 验收：首页问候区显示问候+昵称+日期+多宝头像，无 baby-card 独立区块
  - _依赖：T-1.1 | 涉及：FR-2_

- [ ] **T-2.2** 状态胶囊改造（核心交互）
  - `home.wxml` 将 `.status-banner`(L53-72) 改为 `.status-capsule` 胶囊结构
  - 新增录制指示灯 `rec-dot.png` + `REC` 标签
  - 新增「结束」/「取消计时」胶囊形按钮
  - `home.wxss` 新增胶囊三态样式（默认/睡眠中/异常）+ `recPulse` 动画引用
  - `home.wxss` 新增暗色模式胶囊背景色覆盖
  - `home.js` 胶囊点击逻辑复用现有 `endSleepFromBanner` / `cancelAbnormalSleep`
  - 验收：三种状态正确展示；结束睡眠后统计刷新；暗色模式背景色正确
  - _依赖：T-1.1/T-1.2/T-1.3 | 涉及：FR-3_

- [ ] **T-2.3** 今日摘要卡片升级 — 大数字 + 进度条
  - `home.wxml` 摘要卡片数字区图标容器改 64rpx 圆形
  - `home.wxml` 每列底部新增 `.progress-bar`（4rpx 高，功能色填充）
  - `home.wxss` `.stat-value` 字号 40rpx → 48rpx/700
  - `home.wxss` 新增 `.progress-bar` 样式 + `progressGrow` 动画
  - `home.wxss` 辅助行从 2 行精简为 1 行
  - `home.js` `computeDisplayFields()` 新增进度条百分比计算（feeding/8, sleep/goal, diaper/6）
  - `home.js` `onStatTap` 从跳转筛选改为直接打开弹窗
  - 验收：数字 48rpx 显示；进度条从 0 动画增长；点击列打开对应弹窗
  - _依赖：T-1.1/T-1.2 | 涉及：FR-2_

- [ ] **T-2.4** 快捷入口尺寸优化
  - `home.wxss` 按钮宽度 140rpx → 128rpx / 图标 40rpx → 36rpx / 文字 26rpx → 24rpx / gap 20rpx → 16rpx / padding 调整
  - 验收：5 格在 iPhone SE 到 Pro Max 屏幕上正常显示，不需要滚动（或仅微量滚动）
  - _依赖：无 | 涉及：FR-2_

- [ ] **T-2.5** 今日待办竖向化
  - `home.wxml` `.todo-section` 从横向 `scroll-view` 改为竖向 `.todo-list`
  - 每条：80rpx 高 / 左侧 4rpx 色条 / 32rpx 图标 / 标题·副信息 / 状态标签
  - 最多 3 条 + 「查看全部 X 项 >」底部链接
  - `home.wxss` 新增竖向待办样式
  - 验收：无待办不渲染；逾期红色色条+标签；即将到期橙色
  - _依赖：T-1.1 | 涉及：FR-4_

- [ ] **T-2.6** AI 洞察一行式改造
  - `home.wxml` `.insight-card` 改为折叠/展开双态
  - 折叠态：64rpx 高，单行文字溢出省略 + 展开箭头
  - 展开态：完整文案 + 「更多建议 >」
  - `home.wxss` 新增折叠/展开过渡样式（`max-height` + opacity 过渡）
  - 验收：默认折叠显示一行摘要；点击展开完整内容；暗色模式背景正确
  - _依赖：T-1.1 | 涉及：FR-5_

- [ ] **T-2.7** 时间线组件时间轴线增强
  - `components/timeline/timeline.wxml` 新增 `.timeline-line` 竖线 + `.timeline-node` 功能色圆点
  - `components/timeline/timeline.wxss` 新增轴线样式（左侧 56rpx / 2rpx / `--border-color`）
  - 圆点 10rpx / 功能色填充 / `--bg-secondary` 2rpx 边框
  - 验收：记录列表左侧出现连续竖线 + 颜色节点；暗色模式轴线颜色自适应
  - _依赖：无 | 涉及：FR-6_

---

### 阶段三：记录页 + 发现页（M3）

- [ ] **T-3.1** 记录页筛选栏吸顶 + 页头精简
  - `record.wxml` 删除 `.header-icon` 区块（L4-6）
  - `record.wxss` `.filter-toolbar` 添加 `position: sticky; top: 0; z-index: 10;`
  - `record.wxss` 选中标签新增底部 4rpx 品牌色指示条 `.filter-item.active::after`
  - 验收：向下滚动时筛选栏固定在顶部；选中标签有品牌色下划线
  - _依赖：无 | 涉及：FR-6/11_

- [ ] **T-3.2** 新建 focus-card 组件
  - 创建 `components/focus-card/focus-card.js/.wxml/.wxss/.json`
  - Properties: `type`、`title`、`description`、`icon`、`urgency`、`darkMode`
  - 优先级算法：逾期→红色 / 即将→橙色 / 正常→品牌色鼓励
  - 验收：传入不同 urgency 显示对应色调；暗色模式正确
  - _依赖：T-1.1 | 涉及：FR-13_

- [ ] **T-3.3** 发现页重构 — 聚焦卡片 + 2x2 网格
  - `discover.wxml` 待办区从横滚卡片改为 `<focus-card>`（取最紧急一项）
  - `discover.wxml` 功能入口从列表改为 `.tool-grid`（2x2 网格）
  - `discover.wxml` 参考标准从卡片改为精简列表行
  - `discover.wxss` 全部新结构样式
  - `discover.js` 新增聚焦卡片优先级计算、`toolItems` 数据定义
  - `discover.json` 注册 `focus-card` 组件
  - 验收：聚焦卡片突出最紧急事项；2x2 网格正常展示；暗色模式正确
  - _依赖：T-3.2 | 涉及：FR-7_

- [ ] **T-3.4** 发现页专业参考弹窗底部化
  - `discover.wxml` 将 `.info-popup-mask` + `.info-popup` 改为 `popup-mask` + `popup-container` 结构
  - `discover.wxss` 添加 `@import '../../styles/popup.wxss';`（如果尚未引入）
  - 删除原有居中弹窗样式
  - 验收：点击参考标准后弹窗从底部弹出；关闭按钮为 x-mark.png
  - _依赖：T-1.4 | 涉及：FR-10_

---

### 阶段四：我的页 + 弹窗统一 + 打磨（M4）

- [ ] **T-4.1** 我的页重构 — 居中头像 + 菜单精简
  - `profile.wxml` `.user-card` 改为居中布局（头像 100rpx / 品牌色 3rpx 边框 / `--elevation-2`）
  - `profile.wxml` `.menu-item` 去掉 `.menu-desc` 描述文字
  - `profile.wxml` 角色标签改用 `--radius-pill` 胶囊样式
  - `profile.wxss` 新增居中布局 + 精简菜单样式
  - 验收：头像居中显示；菜单只有图标+标题+箭头；暗色模式正确
  - _依赖：T-1.1 | 涉及：FR-8_

- [ ] **T-4.2** 我的页编辑弹窗底部化
  - `profile.wxml` `.edit-mask` + `.edit-popup` 改为 `popup-mask` + `popup-container` 结构
  - `profile.wxss` 删除原有居中弹窗样式，添加 `@import` popup.wxss
  - 验收：点击编辑资料后弹窗从底部弹出
  - _依赖：T-1.4 | 涉及：FR-10_

- [ ] **T-4.3** 批量页头图标清理（14 个页面）
  - 在以下页面 WXML 中删除 `.header-icon` 区块：baby-create, baby-list, guide, family-create, family-join, growth, vaccine, milestone, baby-detail, ai-assistant, family, export, settings, record
  - 保留 discover 页面的 `compass.png` 图标
  - 验收：上述页面页头仅显示标题+副标题；discover 保留图标
  - _依赖：无 | 涉及：FR-11_

- [ ] **T-4.4** 居中弹窗批量改为底部弹出（剩余页面）
  - growth: WHO 标准弹窗 + 记录详情弹窗
  - vaccine: 疫苗详情弹窗 + 日期选择弹窗
  - milestone: 里程碑详情弹窗 + 标准说明弹窗
  - family: 权限编辑弹窗 + 转让弹窗
  - auth: 邀请码输入弹窗（保留创建成功居中弹窗不变）
  - 验收：所有目标弹窗从底部弹出；auth 创建成功弹窗仍居中
  - _依赖：T-1.4 | 涉及：FR-10_

- [ ] **T-4.5** 细节打磨
  - picker 箭头文字 `>` → `chevron-right.png`(16rpx)：baby-create, growth 等
  - settings 主题图标 Unicode/emoji → PNG（`sun.png`/`moon.png`/`settings.png`）
  - settings 危险操作增加左侧 4rpx `--danger-color` 色条
  - vaccine/milestone 状态图标文字 → PNG（`check-circle.png`/`warning.png`/空心圆 CSS）
  - `easter-egg-popup` 关闭按钮改用 `x-mark.png`(24rpx)
  - 验收：全部 emoji/Unicode 图标已替换为 PNG
  - _依赖：T-1.3 | 涉及：FR-12_

- [ ] **T-4.6** 全局暗色模式 QA
  - 逐页检查 `detailed-spec.md` 第七节暗色模式矩阵中的 28 个检查项
  - 重点验证：状态胶囊三态 / 进度条底色 / 聚焦卡片色条 / 时间轴线 / 弹窗背景
  - 验收：所有页面在暗色模式下视觉正确，对比度达标
  - _依赖：T-1.x ~ T-4.5 全部 | 涉及：全部 FR_

- [ ] **T-4.7** 文档同步更新
  - `architecture.md`：新增 focus-card 组件、更新组件数量
  - `ui-design-system.md`：新增 6 个 CSS 变量、3 个动画、`--radius-pill`/`--radius-xl` 说明
  - `component-library.md`：新增 focus-card 组件文档、更新 timeline/insight-section 变更
  - `service-api.md`：无变更（本次不涉及服务层）
  - `coding-conventions.md`：无变更
  - `README.md`：版本历史追加 v4.0
  - `profile.wxml`：版本号 v3.2.0 → v4.0.0
  - 验收：所有文档与代码一致
  - _依赖：T-4.6 | 涉及：文档同步_

---

## 任务依赖关系

```
T-1.1 ─┬─→ T-1.2 ─┐
        ├─→ T-1.4 ─┼─→ T-3.4 / T-4.2 / T-4.4
        ├─→ T-2.1  │
        ├─→ T-2.3  │
        ├─→ T-2.5  │
        ├─→ T-2.6  │
        ├─→ T-3.2 ─┼─→ T-3.3
        └─→ T-4.1  │
                    │
T-1.3 ─────→ T-2.2 │
             T-4.5  │
                    │
T-1.5 ─── 独立      │
T-2.4 ─── 独立      │
T-2.7 ─── 独立      │
T-3.1 ─── 独立      │
T-4.3 ─── 独立      │
                    │
T-4.6 ── 依赖全部 ──┘
T-4.7 ── 依赖 T-4.6
```

**可并行任务组：**
- T-1.1 ~ T-1.5（基础层，全部可并行）
- T-2.4 / T-2.7 / T-3.1 / T-4.3（无依赖，可与其他任务并行）
- T-3.2 + T-3.4（发现页两个独立改造）
- T-4.1 + T-4.2（我的页两个改造）

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| popup.wxss 修改影响现有弹窗样式 | 中 | 高 | T-1.4 完成后逐个弹窗回归验证 |
| 首页去掉 baby-card 后其他页面受影响 | 低 | 低 | 仅去掉 home 的引用，不删组件本身 |
| 居中弹窗改底部弹出后内容溢出 | 中 | 中 | 使用 85vh max-height + scroll-y 兜底 |
| 暗色模式下新增元素对比度不足 | 中 | 中 | T-4.6 专门 QA 环节逐项检查 |
| 筛选栏 sticky 在低版本基础库不支持 | 低 | 低 | 基础库 ≥ 2.20.0 已支持 sticky |
| 时间轴线 absolute 定位与左滑操作冲突 | 中 | 中 | 轴线 z-index 低于记录项，测试左滑兼容性 |

---

*文档版本：v1.0*
*创建日期：2026-04-13*
*状态：待开发*
