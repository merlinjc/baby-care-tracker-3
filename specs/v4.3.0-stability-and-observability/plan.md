# 每日执行计划 - v4.3.0 稳定性加固与云函数可观测性

> 版本：v1.0 | 日期：2026-04-20 | 状态：✅ 已完成（2026-04-20）
> 本文档提供按天排期的执行节奏，每日有明确验收节点；tasks.md 维护任务粒度清单，本文档维护时间粒度。

---

## 关键时间点

- **Day 0 (2026-04-20)**：已完成 spec 文档 + feature 分支创建
- **Day 1-4 (2026-04-21 ~ 2026-04-24)**：编码
- **Day 4.5 (2026-04-24 下午)**：回归 + 文档 + 发版
- **Day 5 (2026-04-25)**：Buffer + PR 合并

---

## Day 1 — 客户端基础设施（M1）

### 目标
落地三个基础模块，为后续 M2~M4 改造奠基。

### 任务（对应 tasks.md）
- **上午**：T-1.1 FamilyContext（新建 + 单元自检） ≈ 2h
- **中午前**：T-1.2 PermissionGuard（新建 + PermissionError class） ≈ 1.5h
- **下午**：T-1.3 单例模式统一三处（todo/deduplication/network + 所有调用方批量改造） ≈ 3h

### 当日产出
- 新文件 2 个：`utils/family-context.js` / `services/permission-guard.js`
- 改造 3 个文件：`services/todo.js` / `utils/deduplication.js` / `utils/network.js`
- 改造 5+ 个调用方文件

### 当日验收
- [ ] 开发者工具编译通过
- [ ] `grep -rn "= new TodoService\|= new DeduplicationUtil\|= new NetworkUtil" miniprogram/` 零匹配
- [ ] 临时 log 验证 `FamilyContext.resolve()` 返回非空
- [ ] 临时测试 Viewer 角色调用 PermissionGuard.require('record.create') 抛 PermissionError

### 风险关注
- 单例统一涉及 5+ 个调用方，任一遗漏会导致编译失败 → 使用 grep 严格核查
- FamilyContext 的 globalData 访问时机要稳（如 `getApp()` 可能返回 null 在某些页面冷启动时）

### 当日 commit 目标
≥ 3 个（T-1.1 / T-1.2 / T-1.3 各一）

---

## Day 2 — 客户端稳定性（M2）

### 目标
收敛所有客户端侧 Review 问题，让数据流与上下文来源统一。

### 任务
- **上午**：T-2.1 + T-2.2 离线队列 createdBy + sync 时间戳 ≈ 2h
- **中午前**：T-2.3 record.js familyId 改造 ≈ 1.5h
- **下午**：T-2.4 其他模块 familyId 改造 ≈ 1h
- **傍晚**：T-2.5 + T-2.6 缓存失效点 + cleanOrphanedCache ≈ 1.5h
- **晚**：T-2.7 PermissionGuard 接入 RecordService ≈ 1h

### 当日产出
- 改造 10+ 个文件，其中 `services/record.js` 是大改

### 当日验收
- [ ] `grep -rn "userInfo?.familyId \|\| ''\|baby\.familyId \|\| ''" miniprogram/` 仅剩 `family-context.js` 自身
- [ ] 断网手动测试：创建记录 → 重连 → 云端可见，createdBy 完整
- [ ] 多宝切换测试：连续切 2 次，创建记录立即能查到（familyId 单源验证）
- [ ] Viewer 角色创建记录立即抛 PermissionError（不发网络请求）

### 风险关注
- record.js 是 28KB 大文件，改动点多，容易遗漏某处 familyId 获取 → 严格跑 grep 校验
- mergeRecords 策略调整可能影响既有测试 → 保留 _offline=true 强制本地优先的兜底

### 当日 commit 目标
≥ 5 个（T-2.1 ~ T-2.7 分别独立提交）

---

## Day 3 — 云函数模块化（M3）

### 目标
把 1000 行单文件拆分为 23 个结构化文件，为 M4 的 logger / 断点续传 / 限流准备承载结构。

### 任务
- **上午**：T-3.1 errors.js + lib/ 5 个工具模块 ≈ 2h
- **中午前**：T-3.2 13 个 actions 拆分（机械搬运） ≈ 2.5h
- **下午前**：T-3.3 重写 index.js dispatch ≈ 1h
- **下午**：T-3.4 + T-3.5 leaveFamily 契约双端重构 ≈ 2h

### 当日产出
- 云函数侧 23 个新文件 + 1 个重构
- 客户端 3 个文件改造（family.js 服务层 + 2 个调用方页面）

### 当日验收
- [ ] 云函数部署成功（`tcb functions:deploy familyOperation`）
- [ ] `e2eSecurityTest` 部分模块跑通（joinFamily / leaveFamily / createBaby 等）
- [ ] 手动测试：唯一管理员退出 → 返回 `need_transfer` → 弹窗选转让对象
- [ ] 手动测试：普通成员退出 → 返回 `ok`

### 风险关注
- 模块化拆分是高风险环节，每个 action 都可能在 require 路径、ctx 参数上踩坑
- 建议每拆完一个 action 就部署一次云函数，跑对应的 e2eSecurityTest 模块

### 当日 commit 目标
≥ 5 个（按 T-3.1 ~ T-3.5 拆分）

---

## Day 4 — 云函数可观测性（M4）

### 目标
让所有关键操作都有补偿日志、持久化限流、断点续传，并新增定时巡检。

### 任务
- **上午**：T-4.1 + T-4.2 OperationLogger + dissolve/remove/clear 接入 ≈ 2h
- **中午前**：T-4.4 持久化限流 ≈ 1.5h
- **下午前**：T-4.5 时间戳格式统一（批量 sed） ≈ 0.5h
- **下午**：T-4.3 clearBabyData 断点续传（云端 + 客户端循环） ≈ 2h
- **傍晚**：T-4.6 patrolMemberOpenids 新云函数 ≈ 1.5h

### 当日产出
- 云函数侧 2 个集合创建 + 1 个新云函数 + 4 个 action 改造
- 客户端 `settings.js` 改造循环调用

### 当日验收
- [ ] 解散家庭 → `operation_logs` 有完整 steps 记录
- [ ] 快速连续 6 次 joinFamily → 第 6 次返回 RATE_LIMITED
- [ ] 测试环境 3000+ 条记录清理 → 自动多次调用完成
- [ ] 手动触发 patrolMemberOpenids → 返回 `{ scanned, consistent, fixed }` 统计
- [ ] `grep -rn "toISOString()" cloudfunctions/familyOperation/` 零匹配

### 风险关注
- TTL 索引需要在 CloudBase 控制台手动配置（`rate_limits.expireAt`）
- 断点续传的 cursor 格式需要严格校验（误读可能导致清理顺序错乱）
- 巡检函数启用定时触发前先手动跑一周 dryRun

### 当日 commit 目标
≥ 6 个（T-4.1 ~ T-4.6 各一）

---

## Day 4.5 — 回归 & 文档 & 发版（M5）

### 目标
完成 E2E 回归、手动冒烟、文档同步、版本号全量更新，并创建 PR。

### 任务
- **上午**：T-5.1 E2E 重跑 + 补 10+ 条 v4.3 用例 ≈ 2h
- **中午前**：T-5.2 手动冒烟 7 项 ≈ 1h
- **下午前**：T-5.3 文档同步 6 份（architecture / coding-conventions / service-api / data-model + CHANGELOG + README） ≈ 2h
- **下午**：T-5.4 版本号同步 8 处 ≈ 0.5h
- **傍晚**：T-5.5 spec 状态标记 ✅ + rebase develop + 推送 + 创建 PR ≈ 1h

### 当日产出
- 文档 6 份全量更新
- PR 已创建并链接 spec

### 当日验收
- [ ] `e2eSecurityTest` 173+ 条用例 100% 通过
- [ ] 所有冒烟项 check
- [ ] 8 处版本号 v4.3.0 一致
- [ ] feature 分支已推送 + PR 已创建

### 风险关注
- E2E 新用例编写可能暴露 M3/M4 遗漏的契约细节 → 预留时间回改
- rebase develop 时若 v4.2.2 先合入会有文档段的冲突 → 优先采纳 develop 版本再手动补 v4.3.0 增量

### 当日 commit 目标
≥ 10 个（文档分多次提交）

---

## Day 5 — Buffer

PR review 反馈修改 / 合并前最终冒烟 / 发版后观察。若无意外，可用作提前启动 v4.3.1 spec 设计。

---

## 总体里程碑回顾

| 里程碑 | 日期 | 验收关键指标 |
|--------|------|------------|
| M0 Spec 完成 | 2026-04-20 | requirements / design / tasks / plan 全部定稿 |
| M1 基础设施就绪 | 2026-04-21 | FamilyContext / PermissionGuard / 单例统一 3 处 |
| M2 客户端加固 | 2026-04-22 | record.js 28KB 大改验证通过；离线场景完整测试 |
| M3 云函数模块化 | 2026-04-23 | 23 个文件结构建立；leaveFamily 新契约双端联通 |
| M4 可观测性 | 2026-04-24 上午 | operation_logs / rate_limits / patrolMemberOpenids 就位 |
| M5 发版 | 2026-04-24 傍晚 | PR 创建 + 173+ E2E 用例全通过 |

---

## 执行原则

1. **严格按 tasks.md 粒度 commit**：每个 T-x.y 至少一个 commit，不合并；
2. **每日收盘前 push**：即使 feature 分支也每日 push 一次，便于协作和回溯；
3. **遇阻不扩范围**：若某 FR 实现中发现额外问题，登记到 v4.3.1 的 requirements.md 预案章节，不扩大本次；
4. **文档与代码同步**：改到哪里，文档注释对齐到哪里，避免事后补一堆 docs commit；
5. **E2E 贯穿**：M3 开始每天末跑一次 e2eSecurityTest，发现回归及时修复。

---

*文档维护：每日结束时在相应 Day 段追加实际产出与偏差记录，形成最终复盘依据。*
