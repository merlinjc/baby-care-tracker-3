# Phase 4 详细设计：测试与文档

> **版本**: v1.0 | **日期**: 2026-05-08 | **状态**: 详细设计
> **范围**: 视觉回归测试、交互测试、文档更新、完成标准验收

---

## 1. 视觉回归测试计划

### 1.1 测试矩阵

| 页面 | 亮色模式 | 暖夜模式 | 字体:小 | 字体:标准 | 字体:大 | 字体:特大 | 375px | 768px | 1024px+ |
|------|---------|---------|---------|---------|---------|---------|-------|-------|----------|
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/register` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/` (首页) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/records` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/discover` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/ai-assistant` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/report` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/growth` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/vaccine` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/milestone` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/jaundice` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/baby/*` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/family/*` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/export` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**总计**: 16 个页面 × 4 模式（亮色/暖夜 × 4 档字体） × 3 断点 = **384 个检查点**

### 1.2 检查清单（每页通用）

#### 亮色模式 + 标准字体（基准）
- [ ] 主色 `#D4B896` 渲染正确（按钮、选中态、链接）
- [ ] 功能色渲染正确（feeding/sleep/diaper/temperature/growth）
- [ ] 背景色 `var(--bg-primary)` = `#F5F1EB`
- [ ] 卡片背景 `var(--bg-card)` = `#FFFFFF`
- [ ] 文字色阶正确（primary/secondary/hint）
- [ ] 阴影效果正确（棕色调，非黑色）
- [ ] 渐变背景渲染正确（135deg，无 banding）
- [ ] 玻璃态效果正确（backdrop-filter: blur 支持）
- [ ] 所有图标可见（lucide-react，非 emoji）

#### 暖夜模式切换
- [ ] 根元素 `class="dark-mode"` 正确添加
- [ ] 背景色变为 `#1E1A16`（非纯黑）
- [ ] 卡片背景变为 `#2A2420`
- [ ] 文字主色变为 `#E8E0D8`
- [ ] AI 气泡使用 `color-mix(--primary 6%, --bg-card)`（非 `--bg-secondary`）
- [ ] 功能色降饱和（不刺眼）
- [ ] 阴影切换为深色黑阴影

#### 字体 4 档
- [ ] **小档**：整体 ~0.9x，按钮 padding 自动调整
- [ ] **标准档**：默认，基准尺寸
- [ ] **大档**：整体 ~1.15x，老年友好
- [ ] **特大档**：整体 ~1.35x，Badge xs 自动放大到 12px

#### 响应式（3 断点）
- [ ] **375px**（移动端）：底部 TabBar 可见，内容区全宽，弹窗底部弹出
- [ ] **768px**（平板）：侧边栏 64px 仅图标，内容区 `calc(100% - 64px)`
- [ ] **1024px+**（桌面）：侧边栏 220px 图标+文字，内容区 max-width 1200px 居中

---

## 2. 交互测试计划

### 2.1 动效触发条件与预期行为

| 动效 | 触发条件 | 预期行为 | 备注 |
|------|---------|---------|------|
| `fadeInUp` 页面入场 | 页面首次加载 / 路由切换 | 页面内容从下方 16px 处 fade in（0.4s, ease-spring） | 所有页面 |
| `card-stagger` 卡片交错 | 列表/宫格渲染 | 第 n 个子元素延迟 `n × 50ms` 入场 | records、discover、profile |
| `numberRoll` 数字滚动 | TodaySummary 数字 / ReportMetrics 数字渲染 | 数字从 `translateY(0.5em)` 滚入，opacity 0→1 | 首页、报告页 |
| `breatheGlow` 呼吸灯 | 睡眠进行中状态 | box-shadow 在 8px ↔ 16px 之间脉冲（1.5s infinite） | 首页状态横幅、TodaySummary 睡眠卡 |
| `progressGrow` 进度条 | InsightSection 范围条 / TodaySummary 进度条 | 宽度从 0 增长到目标值（0.6s） | 首页、记录页 |
| `capsuleTransition` 胶囊切换 | 状态横幅状态变化（无→睡觉→无） | 旧胶囊 scale 收缩消失，新胶囊 scale 放大出现（0.3s） | 首页状态横幅 |
| `timingBreathe` 计时呼吸 | 睡眠计时器激活 | 计时数字伴随微弱 pulse 动画 | TodaySummary 睡眠卡 |
| `eggScaleBounce` 彩蛋弹跳 | 彩蛋触发条件满足 | 彩蛋图标 scale 弹跳入场（0.6s, ease-spring） | 全局 |
| Button loading 旋转 | 表单提交中 | spinner 旋转（1s linear infinite），按钮文字替换为"保存中..." | 所有 Dialog 提交 |
| TypingDots 波浪 | AI 助手流式响应中 | 3 个点依次上下浮动（stagger 150ms） | AI 助手页 |
| Dialog slideUp | 移动端打开弹窗 | 弹窗从底部 100% 滑入（0.3s, ease-out） | 所有 Dialog |
| Dialog scaleIn | 桌面端打开弹窗 | 弹窗从 scale(0.95) 放大到 scale(1)（0.2s, ease-spring） | 所有 Dialog |

### 2.2 `prefers-reduced-motion` 实现方案

```css
/* 全局禁用动画 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* 保留必要的 opacity 变化（不引起眩晕）*/
  .fade-in {
    animation: none;
    opacity: 1;
  }
}
```

**实施步骤：**
1. 在 `globals.css` 顶部添加上述媒体查询
2. 所有 `@keyframes` 动画自动被 `!important` 覆盖
3. 测试：Safari → 设置 → 辅助功能 → 动效 → 减弱动效，验证无动画

---

## 3. 文档更新清单

### 3.1 `docs/web-ui-spec.md` 更新章节

| 章节 | 更新内容 | 优先级 |
|--------|---------|---------|
| §1 页面结构与导航 | 若有新页面（如 `/jaundice`）需补充路由表 | P0 |
| §4.1 CSS 变量定义 | 新增：渐变 Token（--gradient-*）、玻璃态 Token（--glass-*）、增强阴影（--shadow-card-elevated 等）、动画时长（--duration-spring, --ease-spring） | P0 |
| §4.3 动效规范 | 新增：numberRoll、breatheGlow、card-stagger、progressGrow 关键帧定义 | P0 |
| §6 shadcn/ui 组件映射总表 | 更新：新增 variant（gradient-*/glass）的 Primitive 组件 | P1 |
| §7 无障碍设计规范 | 新增：`prefers-reduced-motion` 适配说明 | P1 |

### 3.2 `docs/web-component-library.md` 更新章节

| 章节 | 更新内容 | 优先级 |
|--------|---------|---------|
| §1.A shadcn 风格 Primitives | 新增：`<Button variant="gradient-*">`、`<Button variant="glass">`、`<Card variant="glass">`、`<Card variant="gradient-header">`、`<Badge variant="gradient-*">`、`<Badge variant="glass">` | P0 |
| §1.5 v5.1.0 设计优化 | 如未记录 `tone` prop（soft/solid/outline），需补充 | P1 |
| §2 新增业务组件 | 新增：`<ReportCover>`、`<ReportMetricsGrid>`、`<ReportDailyRhythm>`、`<ReportGrowthSection>`、`<ReportAchievements>`、`<ReportAiSummary>` | P1 |

### 3.3 `docs/web-architecture.md` 更新检查

| 检查项 | 说明 | 是否需要更新 |
|--------|------|----------------|
| 技术栈 | 若新增依赖（如 lucide-react 版本升级）需更新 | 视情况 |
| 目录结构 | 若新增组件文件需更新 | 视情况 |
| 路由配置 | 若新增页面需更新路由表 | 视情况 |
| 状态管理 | 若新增 store（如 font-scale-store）需更新 | 已存在，可能不需 |

**结论**：Phase 4 完成后，`web-architecture.md` 大概率不需要大幅更新，但需做一轮确认。

### 3.4 `docs/web-ui-refactor-v6-plan.md` 归档

**归档路径**：`docs/archived/`（需新建此目录）

**归档格式**：
```
docs/archived/web-ui-refactor-v6-plan-completed-2026-05-XX.md
```

**归档内容**：
- 完整 v6-plan.md 内容
- 在顶部添加归档元数据：
  ```
  > **归档日期**: 2026-05-XX
  > **完成状态**: 已完成
  > **各 Phase 完成日期**:
  > - Phase 0: 2026-05-XX
  > - Phase 1: 2026-05-XX
  > - Phase 2: 2026-05-XX
  > - Phase 3: 2026-05-XX
  > - Phase 4: 2026-05-XX
  ```

**原文件处理**：
- 归档后，原 `web-ui-refactor-v6-plan.md` 可以保留并标记为「已归档，见 archived/ 目录」，或直接删除。

---

## 4. 完成标准验收清单

### 4.1 功能完成标准

| # | 验收项 | 验收方法 | 通过标准 |
|---|--------|---------|---------|
| 1 | 所有页面使用 Primitive 组件 | `grep -rn "btn-primary\|btn-secondary\|card-base" client/src/` 返回 0 结果 | 无遗留 CSS 类 |
| 2 | 所有页面有入场动画 | 手动验证每页加载时有 fadeInUp 动画 | 16/16 页面通过 |
| 3 | 所有关键数字有 numberRoll 动画 | 首页 TodaySummary、报告页 ReportMetricsGrid | 数字渲染时有滚动效果 |
| 4 | 所有卡片有 hover 动效 | hover 时 translateY(-2px) + shadow 增强 | 所有 interactive 卡片 |
| 5 | 亮色/暖夜双模式视觉一致 | 手动对比双模式截图 | 无遗漏的硬编码色值 |
| 6 | 字体 4 档显示正常 | 在 Profile 页切换 4 档字体，检查所有页面 | 无布局断裂 |
| 7 | 空态设计情感化 | 检查所有列表页空态（records、vaccine、milestone 等） | 有插画 + 引导按钮 |
| 8 | 文档更新完成 | 对照 §3 清单逐项检查 | docs/web-ui-spec.md、web-component-library.md 均已更新 |

### 4.2 性能验收标准

| # | 验收项 | 工具 | 通过标准 |
|---|--------|------|---------|
| 1 | 玻璃态渲染性能 | Chrome DevTools → Performance | 帧率 ≥ 50fps（M1 Mac） |
| 2 | 渐变背景 GPU 使用 | Chrome DevTools → Performance | GPU 进程 < 30% |
| 3 | 动画数量控制 | 同一页面同时运行的 animation < 10 个 | 通过代码审查 |
| 4 | `prefers-reduced-motion` 生效 | Safari 减弱动效设置 | 所有 animation/transition 被禁用 |

### 4.3 无障碍验收标准

| # | 验收项 | 工具 | 通过标准 |
|---|--------|------|---------|
| 1 | 渐变背景文字对比度 | WebAIM Contrast Checker | ≥ 4.5:1（WCAG AA） |
| 2 | 键盘导航完整 | Tab 键走查 | 所有交互元素可聚焦 |
| 3 | 焦点指示可见 | 视觉检查 | 2px primary 外框 |
| 4 | 屏幕阅读器 | VoiceOver（Mac）| 所有图标有 aria-label |

---

## 5. 测试执行顺序

### 5.1 推荐执行顺序（提高效率）

```
Day 1 上午：视觉回归测试（亮色模式 + 标准字体 + 375px）
  ├── 按 §1.2 基准清单逐页检查
  └── 记录所有 deviation（偏离）

Day 1 下午：视觉回归测试（暖夜模式 + 字体 4 档）
  ├── 切换暖夜模式，逐页检查
  └── 切换 4 档字体，逐页检查

Day 2 上午：交互测试
  ├── 按 §2.1 动效清单逐条验证
  └── 特别注意 sleep 计时器和 AI 流式响应

Day 2 下午：文档更新 + 完成标准验收
  ├── 按 §3 清单更新文档
  ├── 按 §4 清单逐项验收
  └── 归档 v6-plan.md
```

---

*文档维护：Phase 4 完成后更新此文档的完成状态。*
