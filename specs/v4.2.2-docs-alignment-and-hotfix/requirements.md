# 需求文档 - v4.2.2 文档对齐 & 热修复（Docs Alignment & Hotfix）

> 版本：v1.0 | 更新日期：2026-04-20 | 状态：✅ 已完成（2026-04-20）
> 来源：v4.2.1 完成后的四轮代码 Review（前后端交互 / 性能与数据一致性 / 云函数与安全规则 / 文档与可维护性）
> 定位：**PATCH 版本**，仅做文档对齐和低风险代码热修复，不涉及业务逻辑或架构变更

---

## 一、背景

v4.2.0 完成云函数网关迁移、v4.2.1 补齐 E2E 安全测试套件后，对项目进行了四轮深度 Review，暴露出以下**必须优先解决**的问题：

### 1.1 文档与代码严重不同步

| 文档 | 当前版本 | 问题 |
|------|----------|------|
| `architecture.md` | v4.2.1 | §2/§3/§6.5 仍描述"仅 1 个云函数 getOpenId"，与实际 7 个云函数严重不符 |
| `service-api.md` | v4.1 | 未反映 v4.2 `family.js` / `baby.js` 的云函数适配器模式 |
| `data-model.md` | v4.1 | 未记录 v4.2 新增的关键字段 `families.memberOpenids` 和 `records/vaccine_records/milestone_records.familyId` |
| `coding-conventions.md` | v4.2.1 | 缺少"读操作直连、写操作走云函数"的核心约定，后续开发者容易违规 |
| `specs/v4.2-cloud-function-gateway/` | 待确认 | 代码已上线但 spec 状态未更新为"✅ 已完成" |
| `specs/v4.2-e2e-security-tests/` | 进行中 | 同上 |

### 1.2 代码层面低风险但明显的问题

| # | 问题 | 位置 | 类型 |
|---|------|------|------|
| 1 | `AuthService.getOpenId()` 全项目零调用方 | `services/auth.js:25-35` | 死代码 |
| 2 | `AIService` 构造时 `createModel('hunyuan-exp')` 与实际调用 `model: 'hunyuan-2.0-instruct-20251111'` 名称不一致 | `services/ai.js:12` | 歧义代码 |
| 3 | `pages/family/family.js:80-106` 页面层裸 `wx.cloud.database()` 调用，绕过已有的 `familyService.getFamilyDetail()` | `family.js:loadFamilyInfo` | 违反分层架构 |
| 4 | `pages/auth/auth.js` 多处 `new AuthService()` / `new FamilyService()`（各 4-5 次），与规范"默认使用 `getInstance()`"不符 | `auth.js` | 规范偏差 |

### 1.3 本迭代不处理的问题

以下 Review 发现的问题**留给 v4.3.0**（MINOR 级）处理，本版本不涉及：

- ❌ 离线队列 `create` 数据缺 `createdBy` 对象（涉及数据格式改造）
- ❌ `records.familyId` 三种来源漂移（需要新建 `family-context` 工具）
- ❌ 服务层缺前置权限检查（需要装饰器模式重构）
- ❌ 单例模式统一（涉及 `TodoService` / `DeduplicationUtil` / `NetworkUtil` 三处重构，所有引用方都需调整）
- ❌ 云函数可观测性、错误码、事务补偿（v4.3.1 专项迭代）

---

## 二、变更目标

**一句话描述**：把 v4.2 升级后的实际架构如实写入 6 份核心文档，并清理 4 个低风险代码偏差，为 v4.3 大版本铺路。

---

## 三、功能需求

### FR-1：更新 `architecture.md` 反映 v4.2 实际架构

**用户故事**：作为后续开发者，我希望通过 `architecture.md` 一眼看到当前项目有多少云函数、分层边界如何划分，以便准确判断"该新增页面应当走哪条数据通路"。

**验收标准**：
1. When 打开 `architecture.md` §2 目录结构，the system shall 列出 7 个云函数（`getOpenId` / `familyOperation` / `migrateFamilyOpenids` / `migrateRecordFamilyId` / `migrateRecordUserId` / `cleanGhostMembers` / `e2eSecurityTest`）及各自职责
2. When 阅读 §3 分层架构图，the system shall 展示 "客户端读（直连 DB）" 与 "跨用户写（→ familyOperation 云函数）" 两条数据流
3. When 阅读 §6.5 安全模型，the system shall 明确说明基于 `memberOpenids` 交叉校验的安全规则、`familyOperation` 云函数网关的作用、6 个集合的 ACL 配置摘要
4. When 阅读 §7 性能优化策略，the system shall 列出 v4.2 新增条目（如"跨用户写走云函数"的成本权衡 200-500ms/call）

> **技术说明**：版本头从 `v4.2.1` 升级到 `v4.2.2`，更新日期同步为 `2026-04-20`。

---

### FR-2：更新 `service-api.md` 反映 v4.2 适配器模式

**用户故事**：作为调用 `FamilyService` / `BabyService` 的页面开发者，我希望文档清楚标出哪些方法是"本地直连"、哪些是"云函数代理"，以便我正确处理异常和加载态。

**验收标准**：
1. When 查阅 `FamilyService` 章节，the system shall 在每个方法签名后追加标记 `[cloud]`（走 `familyOperation`）或 `[direct]`（客户端直连）
2. When 查阅 `_callFamilyOperation(action, params)` 私有方法契约，the system shall 说明返回值格式 `{ success, data, error }` 与错误抛出时机
3. When 查阅 `leaveFamily` 方法，the system shall 单独注明其**不走通用 `_callFamilyOperation`**，以及 `{ success:false, data:{ needTransfer:true } }` 的特殊返回值语义
4. When 查阅 `BabyService` 章节，the system shall 标注 `createBaby` / `deleteBaby` 为 `[cloud]`，其他方法为 `[direct]`

> **技术说明**：版本头从 `v4.1` 升级到 `v4.2.2`，服务总览表新增"走云函数"列。

---

### FR-3：更新 `data-model.md` 补充 v4.2 新字段

**用户故事**：作为数据库 schema 维护者，我需要文档记录所有在生产环境中实际存在的字段，避免后续开发者误以为"文档里没有就是不存在"而忽略安全规则校验需要的字段。

**验收标准**：
1. When 查阅 `families` 集合字段表，the system shall 包含 `memberOpenids: string[]`（安全规则校验用）和 `_openidsMigratedAt: Date`（迁移标记）
2. When 查阅 `records` / `vaccine_records` / `milestone_records` 集合字段表，the system shall 包含 `familyId: string`（租户隔离必须）和 `_familyIdMigratedAt: Date`（迁移标记）
3. When 查阅新增章节 §5 "安全规则配置"，the system shall 列出 6 个集合的 ACL 模式（PRIVATE / CUSTOM）及 CUSTOM 规则的 JSON 简写
4. When 查阅 `families.creatorId` / `memberDetails[].userId` 字段说明，the system shall 将原描述"创建者 openid"、"成员 openid"更正为 `users._id`（v4.1 统一后的实际情况）

> **技术说明**：版本头从 `v4.1` 升级到 `v4.2.2`。

---

### FR-4：`coding-conventions.md` 新增 §8 "数据库操作约束"

**用户故事**：作为新加入的开发者，我希望在规范里找到清晰的铁律："什么情况下可以直接写 `db.collection().add/update/remove`？什么情况下必须走云函数？" 避免误操作导致生产安全规则拒绝。

**验收标准**：
1. When 阅读 `coding-conventions.md` §8，the system shall 提供如下三条铁律：
   - **读操作**：服务层可直连 `wx.cloud.database()`，但 `where` 条件必须附加 `familyId` 以满足 `get('database.families.' + doc.familyId)` 规则
   - **跨用户写**：对 `families` / `babies` / 他人 `records` 等集合的写操作，必须通过 `familyOperation` 云函数
   - **自有写**：`users` 自己的文档（匹配 `_openid`）、`records` 自己创建的记录（匹配 `doc._openid == auth.openid`）可直连
2. When 阅读 §8.2 "查询 familyId 附加模板"，the system shall 提供最小代码示例
3. When 阅读 §8.3 "调用 familyOperation 模板"，the system shall 提供 `_callFamilyOperation(action, params)` 适配器调用示例
4. When 阅读 §8.4 "违规检查清单"，the system shall 提供一个可供 code review 时勾选的核对表

> **技术说明**：版本头从 `v4.2.1` 升级到 `v4.2.2`。新章节位于现有 §7 权限体系之后。

---

### FR-5：标记 v4.2 两个 spec 为"✅ 已完成"

**用户故事**：作为项目 PM / 未来的 code review 参与者，我希望 `specs/` 目录下所有已上线的 feature 都处于"已完成"状态，便于区分历史记录和未来计划。

**验收标准**：
1. When 查阅 `specs/v4.2-cloud-function-gateway/tasks.md` 头部状态字段，the system shall 显示 `状态：✅ 已完成（2026-04-17）`
2. When 查阅 `specs/v4.2-cloud-function-gateway/requirements.md` / `design.md` 头部状态字段，the system shall 同步更新为 `状态：✅ 已完成`
3. When 查阅 `specs/v4.2-e2e-security-tests/tasks.md` 头部状态字段，the system shall 显示 `状态：✅ 已完成（2026-04-17）`
4. When 查阅上述两个 spec 的 `tasks.md`，the system shall 所有 `- [ ]` 均改为 `- [x]`（基于代码实际已合入状态推定）

> **技术说明**：本项任务不改动 spec 内容主体，仅更新状态字段和 checkbox。

---

### FR-6：删除 `AuthService.getOpenId()` 死代码

**用户故事**：作为维护者，我希望代码库不保留已无调用方的方法，减少未来误用和误删的风险。

**验收标准**：
1. When `grep -r "authService.getOpenId\|AuthService.getOpenId"` 全项目，the system shall 返回零匹配
2. When 打开 `miniprogram/services/auth.js`，the system shall 不再有 `getOpenId()` 方法定义
3. When 检查云函数 `getOpenId` 目录，the system shall 保留（`traceUser: true` 机制可能仍隐式使用）

> **技术说明**：`getOpenId` 云函数本身是否保留的决策**留到 v4.3.0**，本迭代仅清理客户端未使用的包装方法。

---

### FR-7：修正 `AIService` 模型名歧义

**用户故事**：作为未来接入新 AI 模型的开发者，我希望 `createModel` 参数语义清晰、与实际调用一致，避免"创建的是 A、调用的是 B"的困惑。

**验收标准**：
1. When 查看 `miniprogram/services/ai.js` 第 12 行，the system shall 不再硬编码 `'hunyuan-exp'`
2. When 修改后不影响 `generateText` / `streamText` 调用（仍通过 `{ model: 'hunyuan-2.0-instruct-20251111' }` 传入具体模型名）
3. When `wx.cloud.extend.AI.createModel` 的参数为 provider 名时，the system shall 使用 `'hunyuan'` 作为 provider
4. When `miniprogram/README.md` 的 AI 调用说明涉及此行，the system shall 同步更新

> **技术说明**：该改动影响极小，只是消除维护者困惑，不改变运行时行为。

---

### FR-8：`family.js` 页面层改用 FamilyService

**用户故事**：作为维护 `packageSocial/pages/family/family.js` 的开发者，我希望页面层不直接裸调 `wx.cloud.database()`，保持"页面 → 服务层 → 数据层"的分层架构。

**验收标准**：
1. When 检查 `miniprogram/packageSocial/pages/family/family.js:loadFamilyInfo`，the system shall 不再出现 `wx.cloud.database()`、`db.collection('families').doc(...).get()` 直连调用
2. When `loadFamilyInfo` 需要获取家庭详情时，the system shall 调用 `this.familyService.getFamilyDetail(familyId)`
3. When `familyService.getFamilyDetail` 返回 `null`（文档不存在或权限拒绝），the system shall 执行已有的"清理本地数据 + setData 空状态"逻辑
4. When 运行测试，the system shall 与改造前行为等价（家庭文档存在→正常显示、不存在→清理跳转、权限拒绝→降级）

> **技术说明**：`familyService.getFamilyDetail` 内部已实现 `cannot find document` 和权限拒绝的降级逻辑，只需改造调用方。

---

### FR-9：`auth.js` 统一使用 `getInstance()`

**用户故事**：作为维护者，我希望所有服务使用方式统一，阅读代码时不会因"有的用 `new`、有的用 `getInstance`"而分心。

**验收标准**：
1. When 检查 `miniprogram/pages/auth/auth.js`，the system shall 将页面顶部的 `const authService = new AuthService()` / `const familyService = new FamilyService()` 改为 `XxxService.getInstance()`
2. When 函数内部需要 service 实例时，the system shall 直接复用页面级 `this.authService` / `this.familyService`，不再重复 `new`
3. When 运行测试，the system shall 与改造前行为等价（闭包单例保证 `new` 和 `getInstance` 结果相同）

> **技术说明**：本改动是纯风格修复，功能零差异。改造范围限定 `pages/auth/auth.js` 一个文件。

---

## 四、非功能需求

### NFR-1：零行为变更

- 本迭代的代码变更全部是**等价重构**或**死代码清理**
- 不新增数据库字段、不修改 API 契约、不调整安全规则
- 不影响已完成的 E2E 安全测试套件（163 条用例）

### NFR-2：版本号全量同步

按 `development-workflow.md` §3.3.4 表格，PATCH 级至少更新 #1 / #3 / #6 / #7 / #8 五项位置，但本次由于同时更新了 `architecture.md` 和 `coding-conventions.md`，实际**推荐更新全部 8 项**，保持信息一致性。

### NFR-3：工时约束

- 预计总工时 ≤ 6 小时
- 单日完成，不需要 `plan.md`
- 所有 FR 可独立提交，不存在跨 FR 依赖

---

## 五、边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 文档更新中发现描述与代码还有更多不一致 | 作为 v4.3.0 预备问题登记到 `specs/v4.3.0-*/requirements.md` 背景章节，本迭代不扩大范围 |
| `family.js` 改造发现 `familyService.getFamilyDetail` 行为不满足 | 回退该文件改动，改到 v4.3.0 一并处理 |
| `ai.js` 修改后运行 AI 对话异常 | 立刻回滚此项（FR-7），单独 hotfix |
| spec 状态标记涉及对历史产出的判断 | 以 `CHANGELOG.md` v4.2.0 / v4.2.1 区块记录的合并日期 `2026-04-17` 为准 |

---

## 六、模块依赖关系与新增接口

- **零新增接口**
- **零新增组件**
- **零新增服务**
- **零数据库变更**

仅涉及：
- 6 份 Markdown 文档内容更新
- 2 个 spec 目录的状态字段 + tasks checkbox
- 4 个代码文件的小改（`auth.js` 死代码清理、`ai.js` 模型名、`family.js` 分层、`pages/auth/auth.js` 单例）

---

## 七、变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `architecture.md` | 大改 | FR-1 |
| `service-api.md` | 大改 | FR-2 |
| `data-model.md` | 中改 | FR-3 |
| `coding-conventions.md` | 增量（新增 §8） | FR-4 |
| `specs/v4.2-cloud-function-gateway/*.md` | 小改（状态字段） | FR-5 |
| `specs/v4.2-e2e-security-tests/*.md` | 小改（状态字段） | FR-5 |
| `miniprogram/services/auth.js` | 小改（删除方法） | FR-6 |
| `miniprogram/services/ai.js` | 小改（1 行） | FR-7 |
| `miniprogram/README.md` | 小改（对齐 FR-7） | FR-7 |
| `miniprogram/packageSocial/pages/family/family.js` | 小改（替换 1 处调用） | FR-8 |
| `miniprogram/pages/auth/auth.js` | 小改（`new` 改 `getInstance`） | FR-9 |
| `CHANGELOG.md` | 增量（新版本区块） | 版本同步 |
| `README.md` | 小改（版本号） | 版本同步 |
| `specs/workflow/git-flow.md` | 小改（版本线追加 1 行） | 版本同步 |
| `miniprogram/pages/profile/profile.wxml` | 小改（版本号） | 版本同步 |
| `miniprogram/app.js` | 小改（globalData.version） | 版本同步 |

---

*文档维护：若在 v4.2.2 开发中发现本文未列的遗漏项，应在 v4.3.0 的 `requirements.md` §1 背景章节登记，而非扩大本迭代范围。*
