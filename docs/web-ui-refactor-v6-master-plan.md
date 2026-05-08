# Baby Care Tracker Web v6.0 UI 重构 - 主计划文档

> 本文档整合了 3 个 Agent 的并行工作成果，包含详细任务拆分、并行执行策略、以及需要决策的关键问题。

## 📋 文档索引

| 文档 | 内容 | 路径 |
|------|------|------|
| **Phase 0-1 详细设计** | 设计系统升级 + 基础组件重构 | `docs/web-ui-refactor-v6-phase0-1-design.md` |
| **Phase 2-3 详细设计** | 14个页面重构 + 动效空态 | `docs/web-ui-refactor-v6-phase2-3-design.md` |
| **Phase 4 详细设计** | 测试计划 + 文档更新 | `docs/web-ui-refactor-v6-phase4-design.md` |
| **交叉 Review 报告** | 全局检查 + 风险识别 | `docs/web-ui-refactor-v6-review-report.md` |
| **原始重构方案** | 初版重构计划 | `docs/web-ui-refactor-v6-plan.md` |

---

## 🗺️ 完整任务拆分（按优先级）

### Phase 0：设计系统升级（7 个任务）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|----------|------|
| P0-T1 | 新增渐变 Token（7个）| 2h | 无 |
| P0-T2 | 新增玻璃态 Token（5个）| 2h | 无 |
| P0-T3 | 新增增强阴影 Token（3个）| 1h | 无 |
| P0-T4 | 新增动画 Token（2个）+ 关键帧（5个）| 3h | 无 |
| P0-T5 | 明暗模式适配（所有新 Token）| 2h | P0-T1~T4 |
| P0-T6 | `prefers-reduced-motion` 实现 | 1h | P0-T4 |
| P0-T7 | 更新 `docs/web-ui-spec.md` | 1h | P0-T1~T5 |

**Phase 0 总计：约 12h（1.5 天）**

### Phase 1：基础组件升级（6 个任务）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|----------|------|
| P1-T1 | `<Button>` 新增 gradient-*/glass 变体 | 2h | Phase 0 |
| P1-T2 | `<Card>` 新增 glass/gradient-header 变体 | 2h | Phase 0 |
| P1-T3 | `<Badge>` 新增 gradient/glass 变体 | 1.5h | Phase 0 |
| P1-T4 | `<Input>` focus 左侧色条动画 | 1.5h | Phase 0 |
| P1-T5 | `<Dialog>` 玻璃态变体 | 2h | Phase 0 |
| P1-T6 | 更新 `docs/web-component-library.md` | 1h | P1-T1~T5 |

**Phase 1 总计：约 10h（1.5 天）**

### Phase 2：页面重构（41 个任务）

#### P0 优先级（必须先完成）

| ID | 页面 | 任务数 | 预估工时 | 可并行 |
|----|------|--------|----------|--------|
| P2-P0-1 | 登录页 `/login` | 5 | 4h | ✅ 与首页并行 |
| P2-P0-2 | 首页 `/home` | 5 | 4h | ✅ 与登录页并行 |

#### P1 优先级（核心功能）

| ID | 页面 | 任务数 | 预估工时 | 可并行 |
|----|------|--------|----------|--------|
| P2-P1-1 | 记录页 `/records` | 4 | 3h | ✅ 三页并行 |
| P2-P1-2 | 发现页 `/discover` | 3 | 2h | ✅ 三页并行 |
| P2-P1-3 | 成长报告页 `/report` | 4 | 3h | ✅ 三页并行 |

#### P2 优先级（增强体验）

| ID | 页面 | 任务数 | 预估工时 | 可并行 |
|----|------|--------|----------|--------|
| P2-P2-1 | AI 助手页 `/ai-assistant` | 4 | 3h | ✅ 三页并行 |
| P2-P2-2 | 生长曲线页 `/growth` | 4 | 3h | ✅ 三页并行 |
| P2-P2-3 | 个人中心页 `/profile` | 3 | 2h | ✅ 三页并行 |

#### P3 优先级（完善细节）

| ID | 页面 | 任务数 | 预估工时 | 可并行 |
|----|------|--------|----------|--------|
| P2-P3-1 | 疫苗页 `/vaccine` | 2 | 1.5h | ✅ 六页并行 |
| P2-P3-2 | 里程碑页 `/milestone` | 2 | 1.5h | ✅ 六页并行 |
| P2-P3-3 | 黄疸页 `/jaundice` | 2 | 1h | ✅ 六页并行 |
| P2-P3-4 | 设置页 `/settings` | 2 | 1.5h | ✅ 六页并行 |
| P2-P3-5 | 宝宝管理页 `/baby` | 2 | 1.5h | ✅ 六页并行 |
| P2-P3-6 | 家庭页 `/family` | 2 | 1.5h | ✅ 六页并行 |

**Phase 2 总计：约 41 任务，34h（4-5 天，3 人并行）**

### Phase 3：动效与空态（4 个任务）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|----------|------|
| P3-T1 | 所有页面 page-enter 动画 | 2h | Phase 2 页面完成 |
| P3-T2 | 所有列表 card-stagger 动画 | 2h | Phase 2 页面完成 |
| P3-T3 | 所有空态情感化设计 | 3h | 无（可并行） |
| P3-T4 | 加载状态动效优化 | 1h | Phase 2 页面完成 |

**Phase 3 总计：约 8h（1 天）**

### Phase 4：测试与文档（5 个任务）

| ID | 任务 | 预估工时 | 依赖 |
|----|------|----------|------|
| P4-T1 | 视觉回归测试（384 检查点）| 4h | 所有 Phase 完成 |
| P4-T2 | 交互测试（11 种动效）| 2h | 所有 Phase 完成 |
| P4-T3 | 更新 `docs/web-ui-spec.md` | 2h | P4-T1 |
| P4-T4 | 更新 `docs/web-component-library.md` | 2h | P4-T1 |
| P4-T5 | 更新 `docs/web-architecture.md`（如需要）| 1h | P4-T1 |

**Phase 4 总计：约 11h（1.5 天）**

---

## ⚡ 并行执行策略（3 人团队配置）

```
时间线（工作日）          Day 1-2    Day 3-4    Day 5-7    Day 8    Day 9-10
                      │          │          │          │        │
Dev A (Lead)          │ Phase 0  │ P2-P0-1  │ P2-P2-3  │ Phase  │ Phase 4
                      │ Phase 1  │ (登录页)   │ (个人中心) │ 3 T1-T2 │ (测试)
                      │          │          │          │        │
Dev B                 │ 等待     │ P2-P0-2  │ P2-P1-*  │ Phase  │ Phase 4
                      │          │ (首页)    │ (记录/发现 │ 3 T3    │ (测试)
                      │          │          │ /报告)    │        │
Dev C                 │ 等待     │ P2-P3-*  │ P2-P2-*  │ Phase  │ Phase 4
                      │          │ (6页面并行)│ (AI/生长) │ 3 T4    │ (测试)
                      │          │          │          │        │
```

### 并行说明

1. **Phase 0-1 必须串行**（设计系统 → 基础组件）
2. **Phase 2 内部高度并行**：
   - P0：登录页 ∥ 首页（2 人并行）
   - P1：记录页 ∥ 发现页 ∥ 报告页（3 人并行）
   - P2：AI助手 ∥ 生长曲线 ∥ 个人中心（3 人并行）
   - P3：6 个页面可 2-3 人并行
3. **Phase 3 可与 Phase 2 后期并行**：空态设计（T3）可独立进行
4. **Phase 4 必须串行**：依赖所有前面 Phase 完成

---

## 🚨 关键发现与决策建议（Review 报告）

Review Lead Agent 发现了 **10 项关键问题**，需要你决策：

### 决策点 1：页面覆盖遗漏
**问题**：`/export`（导出页）、`/guide`（引导页）在 v6-plan.md 中无重构方案

**建议**：✅ **纳入 P3 优先级**
- `/export`：添加玻璃态效果 + 导出按钮渐变
- `/guide`：引导步骤添加 numberRoll 动画 + 进度条渐变色

---

### 决策点 2：黄疸页方案过于简略
**问题**：§4.11 只有 3 条，其他页面 4-8 条

**建议**：✅ **补充详细方案**
- 添加：图表区域毛玻璃效果
- 添加：趋势线 animation stroke-dashoffset
- 添加：危险值（>15）呼吸灯效果

---

### 决策点 3：Phase 2 并行关系未标注
**问题**：计划文档未明确标注哪些任务可并行

**建议**：✅ **已在本文档中补充**（见上表"可并行"列）

---

### 决策点 4：响应式遗漏大屏手机（428px）
**问题**：未考虑 iPhone Pro Max 等大屏手机的专属适配

**建议**：✅ **补充响应式断点**
- 新增断点：`@media (min-width: 428px)` 
- 调整：卡片间距从 `gap-3` 改为 `gap-4`
- 调整：字体大小微调（`text-sm` → `text-base`）

---

### 决策点 5：`prefers-reduced-motion` 实现方案
**问题**：仅在风险表提及，无具体实现代码

**建议**：✅ **采用以下实现**
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  .motion-safe {
    animation: none !important;
    transition: none !important;
  }
}
```

---

### 决策点 6：新增 Token 无 dark 模式对应值
**问题**：渐变、阴影 Token 在 dark 模式下可能不可见

**建议**：✅ **已在 Phase 0 设计中补充 dark 模式值**
- 渐变 Token：dark 模式下降低亮度（`brightness(0.85)`）
- 阴影 Token：dark 模式下使用 `--shadow-color: 0 0 0 1px hsl(var(--border))`
- 玻璃态 Token：dark 模式下使用 `rgba(30, 30, 30, 0.7)`

---

### 决策点 7：渐变背景白色文字对比度未验证
**问题**：WCAG AA 要求对比度 ≥4.5:1，渐变背景上的白色文字可能不达标

**建议**：✅ **采用以下验证方案**
- 使用工具：WebAIM Contrast Checker
- 验证点：所有 gradient-* 变体的文字对比度
- 修复方案：若对比度 <4.5:1，改为 `--foreground` 颜色或添加文字阴影

---

### 决策点 8：Web 端设计与小程序端冲突
**问题**：Web 端新增渐变/玻璃态与小程序端设计语言冲突（小程序 v4.3 已扁平化）

**✅ 已决策：选项 C - 两端故意分化，各自发挥平台优势**
- 决策时间：2026-05-08
- 决策理由：v6.0 专注 Web 端重构，小程序端后续单独考虑；Web 端可充分发挥桌面端优势（更复杂动效、更大视觉冲击）
- 影响：**保留所有渐变/玻璃态效果**，工作量保持 85h（不减少）
- 维护策略：Web 端和小程序端使用独立的设计系统文档（`docs/web-ui-spec.md` vs `ui-design-system.md`）

---

### 决策点 9：动画关键帧定义不完整
**问题**：§3.3 引用了 `@keyframes numberRoll` 等，但未给出完整定义

**建议**：✅ **已在本文档补充完整关键帧定义**
```css
@keyframes numberRoll {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes breatheGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0); }
}

@keyframes cardStagger {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes pageEnter {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```

---

### 决策点 10：Phase 4 任务清单不够详细
**问题**：原计划的 Phase 4 任务描述过于简略

**建议**：✅ **已在本文档补充详细任务**（见 Phase 4 任务拆分表）

---

## 📊 工作量估算

**✅ 已决策：采用选项 C（两端分化），保持完整重构方案**

| Phase | 工时 | 3 人团队预估时间 |
|-------|------|-------------------|
| Phase 0 | 12h | 1.5 天 |
| Phase 1 | 10h | 1.5 天 |
| Phase 2 | 34h | 4-5 天 |
| Phase 3 | 8h | 1 天 |
| Phase 4 | 11h | 1.5 天 |
| **总计** | **85h** | **9-10 个工作日** |

---

## ✅ 下一步行动

1. **请决策**：选择决策点 8 的选项（A/B/C）
2. **确认后**：我将更新所有设计文档，移除渐变/玻璃态相关任务（若选 A）
3. **开始实施**：从 Phase 0（设计系统升级）开始，按照本计划的并行策略执行

---

## 📝 文档维护说明

- **主计划文档**：`docs/web-ui-refactor-v6-master-plan.md`（本文档）
- **详细设计文档**：4 个独立文档（Phase 0-1 / Phase 2-3 / Phase 4 / Review）
- **更新频率**：每完成一个 Phase，更新本文档的"进度追踪"章节
- **归档计划**：v6.0 发布后，将本文档归档至 `docs/archive/v6.0-ui-refactor/`

---

_生成时间：2026-05-08_
_生成方式：3 Agent 并行协作（design-system / page-refactor / review-lead）_
