# 实施计划 - v4.2.2 文档对齐 & 热修复（Docs Alignment & Hotfix）

> 版本：v1.0 | 日期：2026-04-20 | 状态：进行中

---

## 实施概览

预计总工时：约 5 小时
关键里程碑：
- **M1（工时 1-2h）**：代码热修复（4 个 FR，每个 < 30min）
- **M2（工时 2-4h）**：文档对齐（4 份核心文档）
- **M3（工时 4-5h）**：spec 状态回溯 + 版本号全量同步 + 合并发版

并行策略：M1 与 M2 彼此无依赖，可按个人习惯交替执行；M3 必须在 M1+M2 全部完成后进行。

---

## 任务列表

### 阶段一：M1 代码热修复

- [ ] **T-1.1** FR-6 删除 `AuthService.getOpenId()` 死代码
  - 编辑 `miniprogram/services/auth.js`，删除第 25-35 行 `getOpenId()` 方法
  - 在文件头部追加架构说明注释（PRIVATE ACL / traceUser / openid 注入机制）
  - `grep -r "getOpenId" miniprogram/services` 验证无残留
  - 提交：`chore(services): 删除 AuthService.getOpenId 死代码 FR-6`
  - 验收：编译通过，`tryAutoLogin` 等流程不受影响
  - _依赖：无 | 涉及：FR-6_

- [ ] **T-1.2** FR-7 修正 `AIService` 模型名
  - 编辑 `miniprogram/services/ai.js` 第 12 行，`'hunyuan-exp'` → `'hunyuan'`
  - 同步更新 `miniprogram/README.md` 第 498-501 行代码片段
  - 提交：`refactor(services): 修正 AIService createModel provider 名 FR-7`
  - 验收：AI 对话功能手动测试通过（调用路径不变，只改构造参数）
  - _依赖：无 | 涉及：FR-7_

- [ ] **T-1.3** FR-8 `family.js` 页面层改用 `familyService.getFamilyDetail`
  - 编辑 `miniprogram/packageSocial/pages/family/family.js` 第 78-106 行
  - 删除裸 `const db = wx.cloud.database()` 与 try-catch 拆分的错误处理
  - 替换为 `const fresh = await this.familyService.getFamilyDetail(familyInfo._id)`
  - 空值分支统一到 null check，复用已有清理 setData 逻辑
  - 提交：`refactor(pages): family.js loadFamilyInfo 改走服务层 FR-8`
  - 验收：家庭详情正常加载；文档不存在时正确清理本地；权限拒绝时不崩溃
  - _依赖：无 | 涉及：FR-8_

- [ ] **T-1.4** FR-9 `pages/auth/auth.js` 单例规范化
  - 在 Page 对象顶部声明 `authService: null, familyService: null`
  - 在 `onLoad` 开头初始化：`this.authService = AuthService.getInstance()` / `this.familyService = FamilyService.getInstance()`
  - 替换全文件内 `const authService = new AuthService()` / `const familyService = new FamilyService()` → `this.authService` / `this.familyService`（约 9 处）
  - 提交：`style(pages): auth.js 统一使用 getInstance 单例 FR-9`
  - 验收：
    - 自动登录流程正常（已注册/未注册分支）
    - 分享邀请码进入并加入家庭流程正常
    - 创建家庭流程正常
  - _依赖：无 | 涉及：FR-9_

---

### 阶段二：M2 文档对齐

- [ ] **T-2.1** FR-1 更新 `architecture.md`
  - **§2 目录结构**：云函数清单从 1 个改为 7 个（`getOpenId` / `familyOperation` / `migrateFamilyOpenids` / `migrateRecordFamilyId` / `migrateRecordUserId` / `cleanGhostMembers` / `e2eSecurityTest`），各注明职责
  - **§3 分层架构图**：在"服务层"和"数据层"之间插入"云函数网关层"，展示 `familyOperation` 的 13 个 action 作用与 admin SDK 路径
  - **§6.5 安全模型**：重写为云函数网关 + 安全规则交叉校验双层防护的完整说明（参考 design.md §2.1）
  - **§7 性能优化策略**：追加"跨用户写 | 通过 familyOperation 云函数 | 加一跳 200-500ms"行
  - 更新文档头：`> 版本: v4.2.2 | 更新日期: 2026-04-20`
  - 提交：`docs(architecture): 同步 v4.2 云函数网关与安全模型 FR-1`
  - 验收：`grep -n "仅 1 个云函数" architecture.md` 零匹配；§2 可查到 7 个云函数
  - _依赖：无 | 涉及：FR-1_

- [ ] **T-2.2** FR-2 更新 `service-api.md`
  - 服务总览表新增"走云函数"列，`FamilyService=Y(10/13)`、`BabyService=Y(createBaby/deleteBaby)`、其他 `=N`
  - `FamilyService` 方法表每个方法后追加 `[cloud]` / `[direct]` 标签
  - `leaveFamily` 行特别注明"**特殊**：不走 `_callFamilyOperation`，唯一管理员返回 `{success:false, needTransfer:true}`"
  - 新增 `FamilyService 私有适配器` 小节，描述 `_callFamilyOperation(action, params)` 契约
  - 新增 `BabyService 走云函数方法` 章节
  - 更新文档头：`> 版本: v4.2.2 | 更新日期: 2026-04-20`
  - 提交：`docs(service-api): 标注服务方法云函数/直连路径 FR-2`
  - 验收：每个方法签名后都有 `[cloud]`/`[direct]` 标签；`_callFamilyOperation` 契约清晰
  - _依赖：无 | 涉及：FR-2_

- [ ] **T-2.3** FR-3 更新 `data-model.md`
  - `families` 表追加 `memberOpenids` 和 `_openidsMigratedAt` 字段
  - `families.creatorId` 和 `memberDetails[].userId` 的说明从"openid"更正为"users._id（v4.1 统一后）"
  - `records` / `vaccine_records` / `milestone_records` 三个集合各追加 `familyId` 和 `_familyIdMigratedAt` 字段
  - 新增 §5 安全规则配置章节（6 集合 ACL 表 + 读查询注意事项）
  - 更新文档头：`> 版本: v4.2.2 | 更新日期: 2026-04-20`
  - 提交：`docs(data-model): 补充 memberOpenids/familyId 字段与安全规则 FR-3`
  - 验收：3 个带 `familyId` 的集合文档都能检索到该字段；§5 包含 6 行 ACL 表
  - _依赖：无 | 涉及：FR-3_

- [ ] **T-2.4** FR-4 `coding-conventions.md` 新增 §8 数据库操作约束
  - 在现有 §7 权限体系之后插入 §8
  - §8.1 三条铁律表（读操作 / 跨用户写 / 自有写）
  - §8.2 查询 familyId 附加模板（正例 + 反例代码片段）
  - §8.3 调用 familyOperation 模板（`_callFamilyOperation` 标准写法）
  - §8.4 违规检查清单（5 条可勾选项）
  - 更新文档头：`> 版本: v4.2.2 | 更新日期: 2026-04-20`
  - 提交：`docs(conventions): 新增 §8 数据库操作约束 FR-4`
  - 验收：`grep -n "^## 8" coding-conventions.md` 命中；铁律表三行完整
  - _依赖：无 | 涉及：FR-4_

---

### 阶段三：M3 spec 状态 & 版本同步

- [ ] **T-3.1** FR-5 回溯标记 v4.2 两个 spec 为已完成
  - `specs/v4.2-cloud-function-gateway/tasks.md` 头部状态 → `✅ 已完成（2026-04-17）`
  - `specs/v4.2-cloud-function-gateway/tasks.md` 所有 `- [ ]` → `- [x]`
  - `specs/v4.2-cloud-function-gateway/requirements.md` / `design.md` 头部状态 → `✅ 已完成`
  - `specs/v4.2-e2e-security-tests/tasks.md` 头部状态 → `✅ 已完成（2026-04-17）`
  - `specs/v4.2-e2e-security-tests/tasks.md` 所有 `- [ ]` → `- [x]`
  - `specs/v4.2-e2e-security-tests/requirements.md` / `design.md` 头部状态 → `✅ 已完成`
  - 提交：`docs(specs): 回溯标记 v4.2 两个 spec 为已完成 FR-5`
  - 验收：`grep -rn "状态：进行中\|状态：待确认" specs/v4.2-*` 零匹配
  - _依赖：无 | 涉及：FR-5_

- [ ] **T-3.2** 更新 `CHANGELOG.md` 新增 v4.2.2 区块
  - 在代号注册表之后、`## [v4.2.1]` 之前插入 `## [v4.2.2] Milo — 2026-04-20` 区块
  - `### Added`：`coding-conventions.md` §8 数据库操作约束；`service-api.md` 服务方法标注 `[cloud]`/`[direct]`
  - `### Changed`：`architecture.md` §2/§3/§6.5/§7 同步 v4.2 实际架构；`service-api.md` 升级到 v4.2.2；`data-model.md` 补充 memberOpenids/familyId 字段与安全规则章节；`pages/auth/auth.js` 单例规范化；`pages/family/family.js loadFamilyInfo` 改走服务层；`services/ai.js createModel` provider 名修正
  - `### Fixed`：v4.2 spec 状态回溯
  - `### Removed`：`AuthService.getOpenId()` 死代码
  - 提交：`docs(changelog): 新增 v4.2.2 区块`
  - 验收：`grep -n "\[v4.2.2\]" CHANGELOG.md` 命中；区块含 Added/Changed/Fixed/Removed 四类
  - _依赖：T-1.1~T-2.4 全部完成 | 涉及：版本同步_

- [ ] **T-3.3** 全量版本号同步（8 处）
  - `README.md` §1 产品版本 → `v4.2.2 Milo`
  - `README.md` §12 版本历史追加一行（v4.2.2 / Milo / 2026-04-20 / 文档对齐与热修复 / tag 链接）
  - `architecture.md` / `coding-conventions.md` / `service-api.md` / `data-model.md` 版本头已在 T-2.x 更新，此处再核查
  - `specs/workflow/git-flow.md` §5 版本线表追加一行
  - `miniprogram/pages/profile/profile.wxml` 版本号 `Baby Care Tracker v4.2.2`
  - `miniprogram/app.js` `globalData.version = 'v4.2.2'`
  - 提交：`chore: bump version to v4.2.2`
  - 验收：
    - `grep -rn "v4.2.1" architecture.md coding-conventions.md README.md` 仅在 CHANGELOG 区块中合法保留
    - `grep "version" miniprogram/app.js` 显示 `v4.2.2`
  - _依赖：T-3.2 完成 | 涉及：版本同步_

- [ ] **T-3.4** 更新 tasks.md 状态 + 合并准备
  - 本文件头部状态 → `✅ 已完成（2026-04-20）`
  - 本文件所有 `- [ ]` → `- [x]`
  - 在 `feature/v4.2.2-docs-alignment-and-hotfix` 分支上核查 commits 与 tasks 对应关系
  - 提交：`docs(specs): 标记 v4.2.2 spec 为已完成`
  - 验收：本 tasks.md 所有 checkbox 已勾选；状态字段为 ✅ 已完成
  - _依赖：T-3.3 完成 | 涉及：全部_

---

## 任务依赖关系

```
M1 并行:
  T-1.1 ──┐
  T-1.2 ──┤
  T-1.3 ──┼─────────┐
  T-1.4 ──┘         │
                    │
M2 并行（与 M1 可交替）:
  T-2.1 ──┐         │
  T-2.2 ──┤         │
  T-2.3 ──┼─────────┤
  T-2.4 ──┘         │
                    ▼
M3 串行:          T-3.1 ─→ T-3.2 ─→ T-3.3 ─→ T-3.4
```

---

## 工时估算

| 阶段 | 任务 | 估时 |
|------|------|------|
| M1 代码热修复 | T-1.1~T-1.4 | 4 × 15-30 min ≈ 1-2h |
| M2 文档对齐 | T-2.1~T-2.4 | 2h（T-2.1 最大约 40min，其余 20-30min） |
| M3 状态与版本同步 | T-3.1~T-3.4 | 1h |
| **总计** | **12 个任务** | **~5h** |

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| `family.js` 改造时 `this.familyService` 在 `loadFamilyInfo` 调用时未初始化 | 低 | 中 | 核查文件顶部 `onLoad` 中已初始化 `this.familyService = new FamilyService()`（当前代码第 61 行已存在） |
| `ai.js createModel('hunyuan')` 在 provider 名格式上仍不正确 | 低 | 中 | 若 AI 对话失败，立即回滚 FR-7，单独排查 SDK 文档 |
| 文档更新引入 Markdown 渲染破坏（表格对齐、代码块闭合） | 中 | 低 | 每份文档更新后在 VSCode 预览模式快速过一遍 |
| v4.2 spec 的 tasks 清单过长，逐条勾选耗时 | 中 | 低 | 使用编辑器多光标批量替换 `- [ ]` → `- [x]` |
| 提交粒度过细导致分支 commit 过多 | 低 | 低 | 允许合并相邻 FR（如 T-1.1+T-1.2 为 M1 前半部分一起提）但原则上每 FR 独立 commit |

---

## 不在本次范围

以下 Review 问题**留到 v4.3.0**（MINOR）或 **v4.3.1**（PATCH，云函数专项）：

- 离线队列 `create` 缺 `createdBy` 对象
- `records.familyId` 三源漂移 → 新建 `family-context` 工具
- 服务层权限预检装饰器
- `TodoService` / `DeduplicationUtil` / `NetworkUtil` 单例模式统一
- `leaveFamily` 契约重构（客户端 + 云函数）
- 云函数错误码、事务补偿、限流持久化、actions 模块化
- `cleanOrphanedCache` 时机修正
- `mergeRecords` 使用 `updatedAtTs` 比较

以上问题在 v4.2.2 发版后单独立项。

---

*文档维护：执行过程中标记任务完成状态；若发现预期外变更，更新 design.md 的「文件变更清单」保持同步。*
