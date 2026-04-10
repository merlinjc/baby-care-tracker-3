# 开发工作流三阶段规范

> **版本**: v1.0 | **更新日期**: 2026-04-10 | **状态**: 生效中

---

## 概述

每一次 feature 迭代必须严格遵循 **开发前 → 开发中 → 开发后** 三阶段工作流。本文档定义了每个阶段的必做步骤、产出物和检查清单，确保代码质量和文档一致性。

---

## 阶段一：开发前（需求理解 & 规划）

### 1.1 阅读项目文档

开始任何开发之前，必须阅读以下文档以了解全局上下文：

| 顺序 | 文档 | 目的 | 必读/按需 |
|------|------|------|-----------|
| 1 | `architecture.md` | 理解五层架构、分包策略、服务依赖图 | **必读** |
| 2 | `data-model.md` | 理解 6 个集合的字段定义、缓存策略 | **必读** |
| 3 | `service-api.md` | 查看 11 个服务的方法签名和返回结构 | **必读** |
| 4 | `component-library.md` | 查看 15 个组件的属性/事件 | **按需**（涉及 UI 时） |
| 5 | `coding-conventions.md` | 理解命名约定、架构模式、错误处理规范 | **必读** |
| 6 | `ui-design-system.md` | 理解美拉德色系、间距、字体、动画 | **按需**（涉及 UI 时） |

### 1.2 编写 Spec 文档

在 `specs/` 下创建以 feature 命名的目录，包含三个标准文件：

```
specs/<feature-name>/
├── requirements.md    # 需求文档
├── design.md          # 设计文档
└── tasks.md           # 实施计划
```

#### requirements.md 模板

```markdown
# 需求文档 - <功能中文名>（<Feature Name>）

> 版本：v1.0 | 更新日期：YYYY-MM-DD | 状态：待确认

## 概述
<!-- 改动目标、范围、背景，100 字以内 -->

## 页面结构总览
<!-- ASCII 框图展示模块布局 -->

## 用户角色
<!-- 列出目标用户群 -->

## 功能需求

### FR-1：<需求名称>

**用户故事：** 作为<角色>，我想要<目标>，以便<价值>。

**验收标准：**
1. When <条件>, the system shall <行为>
2. ...

> **技术说明**：<关键实现提示>

---

## 非功能需求

### NFR-1：性能要求
### NFR-2：兼容性要求
### NFR-3：数据一致性
### NFR-4：用户体验

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| ... | ... |

## 模块依赖关系与新增接口

## 变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| ... | 新建/大改/小改/增量 | FR-x |
```

#### design.md 模板

```markdown
# 设计文档 - <功能中文名>（<Feature Name>）

> 版本：v1.0 | 日期：YYYY-MM-DD | 状态：待确认

## 一、架构概览
### 1.1 整体架构图（Mermaid flowchart）
### 1.2 技术栈表

## 二、数据流设计
### 2.1 加载流程图
### 2.2 页面 data 结构设计（完整 JS 注释）
### 2.3 关键计算函数组织

## 三、各模块详细设计
### 3.x FR-x <模块名>
<!-- 每个模块包含：JS 核心逻辑 + WXML 结构 + WXSS 样式 -->

## 四、CSS 变量规范
### 4.1 现有可复用变量
### 4.2 新增变量
### 4.3 颜色使用规则

## 五、文件变更清单

| 文件路径 | 改动类型 | 主要变更说明 |
|----------|----------|-------------|
| ... | 新建/大改/小改/增量 | ... |

## 六、关键设计决策
### 决策 1：<决策名>
- 方案A（选定）：...
- 方案B（弃用）：...
- 理由：...
```

#### tasks.md 模板

```markdown
# 实施计划 - <功能中文名>（<Feature Name>）

> 版本：v1.0 | 日期：YYYY-MM-DD | 状态：进行中

## 实施概览

预计总工时：约 X 小时
关键里程碑：
- M1（工时 1-Xh）：<阶段描述>
- M2（工时 X-Yh）：<阶段描述>

---

## 任务列表

### 阶段一：<阶段名>（M1）

- [ ] **T-1.1** <任务标题>
  - <具体步骤 1>
  - <具体步骤 2>
  - 验收：<如何验证>
  - _依赖：T-x.x | 涉及：FR-x_

- [ ] **T-1.2** ...

---

## 任务依赖关系

```
T-1.1 ─┐
T-1.2 ─┼─→ T-2.1 → T-2.2
T-1.3 ─┘
```

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| ... | 高/中/低 | 高/中/低 | ... |
```

### 1.3 创建 Feature 分支

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<spec-name>
git push -u origin feature/<spec-name>
```

### 1.4 开发前检查清单

- [ ] 已阅读 `architecture.md`、`data-model.md`、`service-api.md`
- [ ] 已阅读 `coding-conventions.md`
- [ ] 如涉及 UI：已阅读 `ui-design-system.md` 和 `component-library.md`
- [ ] 已创建 `specs/<feature-name>/requirements.md`
- [ ] 已创建 `specs/<feature-name>/design.md`
- [ ] 已创建 `specs/<feature-name>/tasks.md`
- [ ] 已创建 `feature/<spec-name>` 分支
- [ ] tasks.md 中的任务已完成工时评估和依赖分析

---

## 阶段二：开发中（编码 & 提交）

### 2.1 编码规范遵循

开发过程中必须严格遵循 `coding-conventions.md` 中的所有规范：

| 规范类别 | 关键要求 |
|----------|----------|
| **命名** | 文件 kebab-case、类名 PascalCase、方法 camelCase、CSS 变量 `--` 前缀 |
| **架构模式** | 服务层闭包单例、页面 `initUser()` 等待、TabBar 30s 节流 |
| **数据处理** | 双时间戳写入、创建者信息双格式、统一 `parseTimestamp()` 解析 |
| **错误处理** | 三模式（向上抛出 / 静默降级 / 离线降级） |
| **性能** | 30s 节流、3s 去重、`batchExecute` 限流、分页 `fetchAll` |
| **UI** | 禁止硬编码颜色、全部使用 CSS 变量、8rpx 间距网格 |
| **主题适配** | 页面/组件必须支持暗色模式（详见规范 6.5 节） |
| **权限** | 写操作前必须 `PermissionUtil.canEdit()` 检查 |

### 2.2 引用设计系统

所有 UI 开发必须引用 `ui-design-system.md` 中定义的：

- **色板**：美拉德色系主色/功能色/语义色
- **间距**：8rpx 网格（xs/sm/md/lg/xl/xxl）
- **字体**：排版层级（h1-h6、body、caption）
- **圆角**：sm(12rpx) / md(24rpx) / lg(32rpx)
- **阴影**：card / elevated / float 三级
- **动画**：已定义的 @keyframes（fadeIn / slideUp / pulse 等）

### 2.3 提交规范

每完成一个 Task（`tasks.md` 中的 `T-x.x`），立即提交：

```bash
# 提交格式
git commit -m "<type>(<scope>): <subject> <FR/BUG 编号>"

# 提交后更新 tasks.md 中对应任务的 checkbox
# - [ ] T-1.1  →  - [x] T-1.1 ✅
```

**阶段性 commit 节奏**（推荐）：

```
T-1.1 完成 → commit → push
T-1.2 完成 → commit → push
...
M1 完成 → 确认所有 M1 task checkbox 已勾选
M2 开始 → 继续 commit
```

### 2.4 开发中注意事项

1. **不引入破坏性变更** — 每个 commit 必须可编译运行
2. **不修改不相关代码** — 严格限制在 `design.md` 文件变更清单范围内
3. **新增 CSS 变量** — 在对应页面 wxss 的 `page {}` 中扩展，不修改 `app.wxss`（除非是全局语义变量）
4. **新增服务** — 遵循闭包单例模式，注册到 `service-api.md`
5. **新增组件** — 遵循 swipe-close Behavior 模式（弹窗类），注册到 `component-library.md`
6. **BUG 标记** — 发现但不在本次范围内的 bug，用 `// BUG-{number}: 描述` 标记

### 2.5 开发中检查清单

- [ ] 所有颜色使用 CSS 变量，未硬编码 `#hex` 或 `rgba()`
- [ ] 新增页面/组件支持暗色模式
- [ ] 新增服务使用闭包单例模式
- [ ] 写操作包含权限检查
- [ ] 数据库写入使用双时间戳
- [ ] 每个 Task 完成后有独立 commit
- [ ] commit message 遵循 Conventional Commits 格式
- [ ] tasks.md 中对应 checkbox 已更新

---

## 阶段三：开发后（文档同步 & 合并）

### 3.1 更新 Spec 状态

```markdown
# tasks.md 头部更新
> 状态：进行中  →  > 状态：✅ 已完成（YYYY-MM-DD）
```

所有 `tasks.md` 中的 `- [ ]` 改为 `- [x]` 并附 ✅。

### 3.2 文档同步更新（核心！）

**每次 feature 完成后，必须检查并更新以下 6 份文档：**

| # | 文档 | 更新条件 | 更新内容 |
|---|------|----------|----------|
| 1 | `architecture.md` | 新增页面/组件/服务/工具/分包变更 | 目录结构树、服务依赖图、页面→服务矩阵、分包策略表 |
| 2 | `data-model.md` | 新增/修改数据库集合字段、缓存策略变更 | 集合字段定义、data 子结构、缓存策略表、原子操作约定 |
| 3 | `coding-conventions.md` | 新增代码模式、规范变更 | 命名约定、架构模式、数据处理约定、性能规范、UI 规范 |
| 4 | `ui-design-system.md` | 新增 CSS 变量、色板/间距/动画变更 | 色板表、间距系统、动画定义、组件样式约定 |
| 5 | `component-library.md` | 新增/修改组件 | 组件属性/事件/功能说明、使用示例 |
| 6 | `service-api.md` | 新增/修改服务方法 | 方法签名、参数说明、返回结构、调用示例 |

**文档更新 commit 格式：**

```bash
git commit -m "docs: 同步更新文档 — <feature-name> 迭代产出"
```

### 3.3 版本号更新

在 `README.md` 版本历史表中追加新行：

```markdown
| v3.3 | YYYY-MM-DD | <主要功能简述> |
```

### 3.4 创建 Pull Request

```bash
# 1. 同步 develop
git checkout develop && git pull origin develop

# 2. Rebase feature 分支
git checkout feature/<spec-name>
git rebase develop

# 3. 推送
git push origin feature/<spec-name> --force-with-lease

# 4. 在 GitHub 创建 PR（参考 git-flow.md PR 模板）
```

### 3.5 PR 合并后清理

```bash
git checkout develop
git pull origin develop
git branch -d feature/<spec-name>
git push origin --delete feature/<spec-name>
```

### 3.6 开发后检查清单

- [ ] `tasks.md` 所有任务标记为 ✅ 已完成
- [ ] `tasks.md` 状态更新为「✅ 已完成（日期）」
- [ ] `architecture.md` 已同步更新（如有结构变更）
- [ ] `data-model.md` 已同步更新（如有数据模型变更）
- [ ] `coding-conventions.md` 已同步更新（如有新模式）
- [ ] `ui-design-system.md` 已同步更新（如有新 CSS 变量/样式）
- [ ] `component-library.md` 已同步更新（如有新组件）
- [ ] `service-api.md` 已同步更新（如有新服务/方法）
- [ ] `README.md` 版本历史已更新
- [ ] PR 已创建并包含完整描述
- [ ] Feature 分支已清理

---

## 完整迭代示例

以 **暖色夜间模式（warm-night-mode）** 为例：

```
📅 Day 1 — 开发前
  ├── 阅读 architecture.md / coding-conventions.md / ui-design-system.md
  ├── 创建 specs/warm-night-mode/requirements.md
  ├── 创建 specs/warm-night-mode/design.md
  ├── 创建 specs/warm-night-mode/tasks.md
  └── git checkout -b feature/warm-night-mode

📅 Day 2~4 — 开发中
  ├── T-1.1: feat(utils): 新建 ThemeManager 主题管理器
  ├── T-1.2: feat(app): 集成 theme.json 配色方案
  ├── T-2.1: feat(home): 首页暗色模式适配
  ├── T-2.2: feat(record): 记录页暗色模式适配
  ├── ...
  └── 每个 Task 完成后 commit + 更新 tasks.md checkbox

📅 Day 5 — 开发后
  ├── tasks.md 状态标记为 ✅ 已完成
  ├── docs: 更新 architecture.md（新增 ThemeManager 工具）
  ├── docs: 更新 ui-design-system.md（新增暗色模式色板）
  ├── docs: 更新 coding-conventions.md（新增主题适配规范 6.5 节）
  ├── docs: 更新 service-api.md（ThemeManager API）
  ├── docs: 更新 README.md 版本历史
  ├── git rebase develop
  ├── 创建 PR → Code Review → 合并到 develop
  └── 清理 feature 分支
```

---

## Spec 文档生命周期

```
新建（待确认）
    │
    ▼
评审通过（已确认）
    │
    ▼
开发中（进行中）— tasks.md 中逐步勾选
    │
    ▼
开发完成（✅ 已完成）— 文档同步完毕
    │
    ▼
归档 — 保留在 specs/ 中作为历史记录
```

**状态标记约定：**

| 状态 | 含义 |
|------|------|
| `待确认` | Spec 文档刚创建，等待评审 |
| `已确认` | 评审通过，可以开始开发 |
| `进行中` | Feature 分支已创建，正在编码 |
| `✅ 已完成（日期）` | 开发完毕，PR 已合并，文档已同步 |

---

*文档维护：新增工作流步骤或规范变更时同步更新此文档。*
