# 需求文档 - v4.3.0 稳定性加固与云函数可观测性（Stability Hardening & Cloud Function Observability）

> 版本：v1.0 | 更新日期：2026-04-20 | 状态：待确认
> 定位：**MINOR 版本**，合并原规划的 v4.3.0（客户端稳定性）与 v4.3.1（云函数运维可观测性），一次迭代收敛 Review 中全部 P0/P1 遗留问题
> 依赖：本版本基于 `v4.2.2` 分支开发，合并前需确保 v4.2.2 已先合入 develop

---

## 一、背景

v4.2.2（文档对齐 & 热修复）完成后，四轮代码 Review 的 P0/P1 问题中仍有 **14 项**未处理。为避免分散多个 PATCH 版本造成的上下文切换成本，本次将两批遗留问题合并为一个 MINOR 版本 **v4.3.0** 一次性处理。

### 1.1 客户端稳定性遗留问题（原 v4.3.0 范围）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | 离线队列 `create` 数据缺 `createdBy` 对象 | `record.js:248-265` / `sync.js:executeOperation` | 离线记录同步后头像昵称丢失，其他成员看到"未知用户" |
| 2 | `records.familyId` 有 3 种来源（`familyInfo._id` / `userInfo.familyId` / `baby.familyId`）存在漂移风险 | 全项目 14 处 | 换家庭瞬时写入 B 但查询 A，记录看似丢失 |
| 3 | 服务层缺前置权限预检 | `RecordService.createRecord/updateRecord/deleteRecord` | Viewer 绕过 UI 即可写入（虽安全规则兜底，但缺第一道闸） |
| 4 | `TodoService` / `DeduplicationUtil` / `NetworkUtil` 单例导出方式与规范不一致 | 3 个文件末尾 `module.exports = new Xxx()` | 与其他 8 个 Service 规范不统一，新人困惑 |
| 5 | `leaveFamily` 契约歧义（`success: false` 但 `data.needTransfer=true` 非错误） | `family.js:249-277` / 云函数 `leaveFamily` | 不能用通用 `_callFamilyOperation`，代码歧义大 |
| 6 | `_todayStatsCache` 失效点不全（`deleteRecordFromCache`/`saveToLocalCache` 未清） | `record.js` | 删除或新增后 15s 内统计可能显示旧数据 |
| 7 | `cleanOrphanedCache` 在 `onLaunch + 5s` 触发，可能早于 `initUser` 完成 | `app.js:36` | 误删正在使用的宝宝缓存 |
| 8 | `mergeRecords` 完全用云端覆盖本地，未按 `updatedAtTs` 比较 | `record.js:808-827` | 离线 update 未同步上去时会被云端旧版本覆盖 |

### 1.2 云函数运维可观测性遗留问题（原 v4.3.1 范围）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 9 | 云函数业务异常一律吞为 `INTERNAL_ERROR` | `familyOperation/index.js:83-89` | 用户只看到"服务器内部错误"，无法定位 |
| 10 | `dissolveFamily` / `clearBabyData` 无事务/补偿机制 | 云函数侧 | 中间失败留下孤儿数据（家庭已删但 records 还在） |
| 11 | `clearBabyData` 逐条 `for await` 删除，超时风险 | 云函数 `clearBabyData` | 3000+ 条记录时必超 20s 云函数 timeout |
| 12 | `joinFamily` 限流用实例级内存 Map，多实例冷启动可绕过 | `familyOperation/index.js:29` | 限流失效，存在暴力破解窗口 |
| 13 | 云函数 ISO 字符串 vs 客户端 Date 不一致 | 云函数 16 处 `new Date().toISOString()` | 时间范围查询结果与预期不符 |
| 14 | `memberOpenids` 与 `members` 无一致性巡检 | 无 | 迁移/异常时静默 drift，安全规则直接拒访 |
| 15 | `familyOperation/index.js` 单文件 1000 行 switch 分发 | `familyOperation/index.js` | 协作 diff 冲突概率高，维护成本递增 |

### 1.3 合并为单一 MINOR 版本的理由

| 维度 | 分散 2 个 PATCH | 合并 1 个 MINOR |
|------|---------------|---------------|
| 上下文切换 | 两次 spec + 两次 review | 一次 |
| 文档同步 | 两次 CHANGELOG + 两套版本号 | 一次 |
| E2E 回归 | 两次 `e2eSecurityTest` 部署执行 | 一次 |
| `leaveFamily` 契约重构 | 跨两版完成（客户端 v4.3.0 / 云函数 v4.3.1）需兼容 | 一次双端同步 |
| 风险 | 两次发版都可能踩坑 | 改动量大但验收一次性 |

选定：**合并为 v4.3.0 MINOR**。

---

## 二、页面结构总览

本次迭代**不涉及 UI 变更**，仅数据流和基础设施层面的改造。调用链变化示意：

```
┌─────────────────────────────────────────────────────────────────────┐
│ 写入路径（新）                                                        │
│                                                                      │
│  Page → RecordService.createRecord()                                 │
│           ↓                                                          │
│         FamilyContext.resolve() ─→ 统一 familyId 源                   │
│           ↓                                                          │
│         PermissionGuard.check('record.create') ─→ 前置权限预检        │
│           ↓                                                          │
│         [在线] db.collection().add() + 双时间戳                       │
│         [离线] StorageUtil.addToOfflineQueue({ ...含 createdBy })     │
│           ↓                                                          │
│         SyncService.executeOperation() 时间戳规整（ISO→Date→serverDate）│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 跨用户写路径（新）                                                    │
│                                                                      │
│  Page → FamilyService._callFamilyOperation(action, params)           │
│           ↓                                                          │
│         云函数 index.js → dispatch → actions/<action>.js             │
│           ↓                                                          │
│         errors.js 统一错误码 + RateLimiter 持久化限流                  │
│           ↓                                                          │
│         admin SDK 写入 + OperationLogger 补偿日志                     │
│           ↓                                                          │
│         返回 { success: true, data: { status, payload } } 统一状态机  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 运维路径（新）                                                        │
│                                                                      │
│  定时触发器（每日 00:00） ─→ patrolMemberOpenids 云函数                │
│           ↓                                                          │
│         比对 families.members × users._openid vs families.memberOpenids│
│           ↓                                                          │
│         不一致则写 _operation_logs + 自动补齐                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、用户角色

- **终端用户**（家庭成员）：感知不到接口变化，但遇到离线记录、家庭协作场景时体验更稳定
- **开发者**：享受到统一的 `FamilyContext` / `PermissionGuard` / `errors` 等基础设施
- **运维人员**：通过 `_operation_logs` 和 `patrolMemberOpenids` 巡检实现白盒监控

---

## 四、功能需求

### FR-1：新建 `utils/family-context.js` 统一 familyId 来源

**用户故事**：作为 `record.js` / `todo.js` / 各页面开发者，我希望有一个唯一的函数读取"当前 familyId"，避免在 `familyInfo._id` / `userInfo.familyId` / `baby.familyId` 三源之间挑选。

**验收标准**：
1. When 调用 `FamilyContext.resolve()`，the system shall 按优先级 `globalData.familyInfo._id > StorageUtil.getFamilyInfo()._id > StorageUtil.getUserInfo().familyId > baby.familyId` 返回 `string`；无法获得时返回 `''`（**不抛错**，保持兼容）
2. When 调用 `FamilyContext.resolveForBaby(baby)`，the system shall 以 `baby.familyId` 优先，否则回退到 `resolve()`
3. When 调用 `FamilyContext.getUserId()` / `FamilyContext.getCurrentRole()` / `FamilyContext.getCurrentBabyId()`，the system shall 返回对应上下文字段，缺失时返回 `''`
4. When 全项目 14 处 `familyId` 获取点改造后，`grep -r "userInfo?.familyId || ''" miniprogram/services miniprogram/pages` 应零匹配（除 `family-context.js` 自身）

> **技术说明**：仅提供纯读取能力，不引入状态；设计为**无状态静态方法类**（类似 `PermissionUtil`），避免额外单例负担。

---

### FR-2：单例模式统一（3 处重构）

**用户故事**：作为接触过 10 个 Service 的开发者，我期望所有 service/util 的单例导出方式一致，避免因"有的 `module.exports = Xxx`、有的 `module.exports = new Xxx()`"产生误用。

**验收标准**：
1. When 查看 `services/todo.js` 末尾，the system shall `module.exports = TodoService`（导出类）
2. When 查看 `utils/deduplication.js` 末尾，the system shall `module.exports = DeduplicationUtil`
3. When 查看 `utils/network.js` 末尾，the system shall `module.exports = NetworkUtil`
4. When 所有 3 个模块的 `getInstance()` 静态方法存在并返回同一实例
5. When 所有调用方（`home.js` / `discover.js` / `report-popup.js` 等）改为 `TodoService.getInstance()`、`DeduplicationUtil.getInstance()`、`NetworkUtil.getInstance()`
6. When `grep -rn "= new TodoService()\|= new DeduplicationUtil()\|= new NetworkUtil()\|require.*todo.*\.getTodoStats" miniprogram/` 零匹配到旧用法

> **技术说明**：保留 `let instance = null;` 闭包单例模式，符合 `coding-conventions.md §2.1`。

---

### FR-3：新建 `services/permission-guard.js` 服务层权限预检

**用户故事**：作为对安全敏感的开发者，我希望 `RecordService` 的写方法能在第一行就挡掉 Viewer，不依赖"UI 隐藏按钮 + 安全规则兜底"两层间接防护。

**验收标准**：
1. When 调用 `PermissionGuard.require('record.create')`，若当前用户 role 不在 `PermissionUtil.PERMISSIONS['record.create']` 允许范围内，the system shall 抛出 `PermissionError`（继承 `Error`，含 `code='PERMISSION_DENIED'`）
2. When 调用 `PermissionGuard.requireOwnership(record)`，the system shall 检查 `record.createdBy?.userId === currentUserId || record.creatorId === currentUserId`，不匹配且非 admin 时抛错
3. When `RecordService.createRecord` 第一行调用 `PermissionGuard.require('record.create')`
4. When `RecordService.updateRecord` 第一行调用 `PermissionGuard.require('record.edit')` + 若是他人记录则 `require('record.delete.other')`（update 权限参考 delete）
5. When `RecordService.deleteRecord` 第一行调用 `PermissionGuard.requireCanDelete(record)`，其内部 delegate 到 `PermissionUtil.canDeleteRecord`
6. When 权限检查失败时，调用方能捕获 `error.code === 'PERMISSION_DENIED'` 并显示友好提示

> **技术说明**：PermissionGuard 仅封装"校验失败即抛错"的模式，不重复实现权限矩阵（仍由 `PermissionUtil` 提供）。

---

### FR-4：离线队列 `create` 数据完整性

**用户故事**：作为离线场景下的用户，我希望断网时创建的记录同步上云后，**完整保留创建者信息**，其他家庭成员能看到我的昵称和头像。

**验收标准**：
1. When `RecordService.createRecord` 离线路径构造 `StorageUtil.addToOfflineQueue` 的 `data` 时，the system shall 包含完整的 `createdBy: { userId, nickName, avatar }` 对象（与在线路径的 cloudRecord 字段完全一致）
2. When 降级路径（在线失败 fallback）构造离线队列 `data` 时，同样包含完整 `createdBy` 对象
3. When `SyncService.executeOperation` 的 `case 'create'` 执行前，the system shall 对 `data` 字段做时间戳规整：字符串 ISO 时间戳转 `new Date()`（避免云端 `startTime` 成为字符串）
4. When 离线记录同步后，云端记录结构与在线直接创建的记录**字段完全一致**（可通过 `e2eSecurityTest` 补测验证）
5. When 离线创建的记录同步上云后，其他家庭成员刷新列表能看到创建者昵称和头像

> **技术说明**：本改动是 v4.2.2 `离线队列缺字段` 问题的根治方案。

---

### FR-5：`leaveFamily` 契约重构（客户端 + 云函数双端）

**用户故事**：作为 `family.js` 维护者，我希望 `leaveFamily` 像其他云函数 action 一样使用 `_callFamilyOperation` 统一适配器，不再为"唯一管理员需转让"单独写一套错误处理。

**验收标准**：
1. When 云函数 `leaveFamily` action 在唯一管理员场景返回 `{ success: true, data: { status: 'need_transfer', otherMembers: [...] } }`（原 `success: false` 改为 `success: true`，业务状态由 `data.status` 表达）
2. When 正常退出返回 `{ success: true, data: { status: 'ok' } }`；最后成员解散返回 `{ status: 'dissolved' }`；家庭已不存在返回 `{ status: 'family_not_found' }`；非成员幂等返回 `{ status: 'not_member' }`
3. When 客户端 `FamilyService.leaveFamily` 内部使用通用 `_callFamilyOperation('leaveFamily', ...)`，根据 `data.status` 返回结构化对象给调用方
4. When 调用方（`family.js` 页面 / `auth.js` _handleInviteCodeForExistingUser）根据 `status` 字段分支处理，不再依赖 `result.success === false` 判断
5. When `service-api.md` 的 `leaveFamily` ⚠️ 特殊契约章节移除（变为普通 action 条目）

> **技术说明**：此契约变更不需要数据迁移，仅是接口语义对齐。

---

### FR-6：缓存失效点补齐 + 孤立缓存清理时机修正 + 合并策略修正

**用户故事**：作为刚创建或删除完记录的用户，我希望首页"今日统计"立即反映变更，而非等待 15s 缓存过期；同时希望切换宝宝时不会误删缓存。

**验收标准**：
1. When `RecordService.saveToLocalCache` 执行后，the system shall 清除 `this._todayStatsCache = null`
2. When `RecordService.deleteRecordFromCache` 执行后，the system shall 清除 `this._todayStatsCache = null`
3. When `App.onLaunch` 调度 `cleanOrphanedCache`，the system shall 改为 `this.globalData.initPromise.then(() => this.cleanOrphanedCache())`（等待 `initUser` 完成），不再使用固定 `setTimeout(5000)`
4. When `RecordService.mergeRecords` 遇到 `_id` 相同的本地与云端记录，the system shall 比较 `updatedAtTs`，保留更新的版本（云端版本默认胜出，但本地 `_offline=true || updatedAtTs > cloudUpdatedAtTs` 时保留本地版本）

> **技术说明**：FR-6.4 可能让少数场景下本地未同步修改不被覆盖；配合 FR-5 的 `leaveFamily` 修复，整体数据一致性更强。

---

### FR-7：云函数 `familyOperation` 模块化

**用户故事**：作为云函数维护者，我希望每个 action 有独立文件，定位修改范围时不需要在 1000 行 switch 里翻找。

**验收标准**：
1. When 查看 `cloudfunctions/familyOperation/` 目录结构，the system shall 呈现：
   ```
   familyOperation/
   ├── index.js          # 仅保留 main 入口 + dispatch + 全局异常捕获（< 80 行）
   ├── package.json
   ├── config.json
   ├── errors.js         # 错误码注册表 + 统一构造器
   ├── lib/
   │   ├── auth.js       # getUserFromOpenid + isAdmin + isMember
   │   ├── family.js     # getFamily + clearUserFamily + familyNotFound
   │   ├── rate-limit.js # 持久化限流（_rate_limits 集合）
   │   ├── logger.js     # OperationLogger（_operation_logs）
   │   └── db-helper.js  # getAllDocs + chunkedDelete 等通用工具
   └── actions/
       ├── createFamily.js
       ├── joinFamily.js
       ├── removeMember.js
       ├── dissolveFamily.js
       ├── updateMemberRole.js
       ├── transferAdmin.js
       ├── leaveFamily.js
       ├── refreshInviteCode.js
       ├── validateInviteCode.js
       ├── getFamilyByUserId.js
       ├── createBaby.js
       ├── deleteBaby.js
       └── clearBabyData.js
   ```
2. When 单个 action 文件导出签名 `module.exports = async (ctx, params) => { ... }`，其中 `ctx = { db, _, userId, openid, user, logger, rateLimiter }`
3. When 部署后所有 13 个 action 的行为与 v4.2.2 完全一致（E2E 163 用例全通过）

---

### FR-8：`errors.js` 错误码统一注册表

**用户故事**：作为客户端调用方，我希望通过 `error.code` 可靠地判断业务场景，而不是正则匹配 `error.message.includes('xxx')`。

**验收标准**：
1. When `cloudfunctions/familyOperation/errors.js` 定义以下错误码：
   ```
   USER_NOT_FOUND / FAMILY_NOT_FOUND / PERMISSION_DENIED /
   INVALID_CODE / CODE_EXPIRED / ALREADY_MEMBER / SOLE_ADMIN /
   CANNOT_REMOVE_SELF / CANNOT_REMOVE_ADMIN / NOT_MEMBER /
   NO_MEMBER_DATA / RATE_LIMITED / INVALID_ACTION /
   INTERNAL_ERROR / BUSY (重试中)
   ```
2. When 云函数任何 action 返回错误时使用 `errors.xxx(extraContext)` 构造：
   ```javascript
   module.exports.FAMILY_NOT_FOUND = (ctx) => ({
     success: false,
     error: { code: 'FAMILY_NOT_FOUND', message: '家庭不存在', context: ctx }
   });
   ```
3. When `index.js` 全局异常捕获时调用 `errors.INTERNAL_ERROR(error)`，日志记录 `error.stack` 到 `_operation_logs`
4. When `service-api.md` 文档的错误码章节列出完整 15 个码及触发场景

---

### FR-9：`_operation_logs` 补偿日志

**用户故事**：作为运维人员，我希望 `dissolveFamily` / `clearBabyData` 等多步操作中途失败时，能通过查询补偿日志定位是哪一步、哪条数据未清理。

**验收标准**：
1. When `_operation_logs` 集合创建（PRIVATE ACL，客户端不可访问）
2. When 字段定义：
   ```
   { _id, action, userId, openid, params, status: 'started'|'succeeded'|'partial'|'failed',
     steps: [{ name, status, error?, entityId? }], startedAt, finishedAt, error? }
   ```
3. When `dissolveFamily` 执行：先写 `status=started`，每清一个成员 push `steps`，全部完成后 `status=succeeded`；中间失败则 `status=partial` 保留已处理列表
4. When `clearBabyData` 执行同上，records/vaccine/milestone 各记一段 steps
5. When 云函数全局异常捕获时如有 ongoing log 则标记 `status=failed` + `error`

---

### FR-10：`clearBabyData` 断点续传 + 分批并发

**用户故事**：作为管理员，我希望清除一个宝宝的 3000+ 条历史数据时，操作不会因为云函数超时而中断导致"清了一半"。

**验收标准**：
1. When `clearBabyData` action 接受 `cursor?: string` 参数（默认 `undefined` 表示从头开始）
2. When 单次执行最多清理 `CHUNK_SIZE=500` 条记录 + 受限时间（15s）内，到达任一阈值即返回 `{ status: 'in_progress', cursor: '<下一批起点>' }`
3. When 客户端收到 `status='in_progress'` 时自动循环调用，每次传入 cursor，直到 `status='succeeded'`
4. When 单次清理内部使用 `Promise.all + chunk(10)` 并发删除（云函数侧实现 `chunkedDelete(collection, ids, concurrency=10)`）
5. When `_operation_logs` 记录每批 cursor 和清理量，便于事后审计

---

### FR-11：`_rate_limits` 持久化限流

**用户故事**：作为安全保障人员，我希望邀请码限流在云函数多实例/冷启动场景下仍有效。

**验收标准**：
1. When `_rate_limits` 集合创建（PRIVATE ACL，TTL 索引配置为 `expireAt` 字段，30 分钟自动清理过期记录）
2. When 字段定义：`{ _id (hash of key), key: 'invite_<openid>', count, windowStart, expireAt }`
3. When `joinFamily` action 执行限流检查（60s 内最多 5 次）：读取当前 key，若 `count >= 5 && now - windowStart < 60s` 返回 `RATE_LIMITED`
4. When 云函数多实例部署时，所有实例共享同一限流计数（通过数据库原子操作 `_.inc()` 保证并发安全）
5. When 实例冷启动不会重置计数

---

### FR-12：`patrolMemberOpenids` 巡检云函数

**用户故事**：作为数据一致性保障人员，我希望每日自动巡检 `families.memberOpenids` 与 `members` 是否同步，不一致时自动修复并记录告警。

**验收标准**：
1. When 新建 `cloudfunctions/patrolMemberOpenids/` 云函数（含 `config.json` 配置每日 00:00 定时触发）
2. When 执行流程：遍历所有 families → 对每个 family，查 `members` 中所有 userId 的 `users._openid` → 与 `memberOpenids` 比对 → 不一致则更新并写 `_operation_logs`
3. When 巡检报告字段：`{ scanned, consistent, fixed, failed, warnings }`
4. When 单次巡检超过 60s 未完成则从断点继续（下次触发时从 `lastScannedFamilyId` 续扫）
5. When 巡检结果写入 `_operation_logs` 供事后审计

---

### FR-13：时间戳格式云函数侧统一

**用户故事**：作为数据分析人员，我希望 `families.updatedAt` 与 `records.createdAt` 在数据库中类型一致，便于写统一的范围查询。

**验收标准**：
1. When 云函数中所有 `new Date().toISOString()` 改为 `new Date()`（Date 对象，与客户端 `this.db.serverDate()` 返回形态接近）
2. When 所有"写入 updatedAt"的地方同时写入 `updatedAtTs: Date.now()`（双时间戳对齐客户端约定）
3. When 现有 ISO 字符串存量数据**不强制迁移**（读取侧通过 `parseTimestamp` 兼容），但新写入的文档必须使用 Date
4. When `data-model.md` 的 `families.updatedAt` / `createdAt` 类型从 `string(ISO)` 改为 `Date`，并标注"v4.3.0 起"

> **技术说明**：与 v4.2 双时间戳约定保持一致性，避免继续积累格式债。

---

### FR-14：`RecordService` CRUD 接入 PermissionGuard（承接 FR-3）

**用户故事**：作为对写入安全有更高要求的开发者，我希望服务层写方法在进入业务逻辑前就完成权限校验，日志可追溯。

**验收标准**：
1. When `RecordService.createRecord` 第一步（去重检查之后、数据准备之前）调用 `PermissionGuard.require('record.create')`
2. When `RecordService.updateRecord` 第一步调用 `PermissionGuard.require('record.edit')`
3. When `RecordService.deleteRecord` 第一步调用 `PermissionGuard.requireCanDelete(record)` —— 需先查询 record 获取 `createdBy`
4. When 权限拒绝时抛 `PermissionError`，UI 层捕获后显示"您没有操作权限"
5. When 单元自检（手动）：Viewer 角色尝试创建记录 → 应立即失败，不发起网络请求

---

### FR-15：全项目 familyId 改造（承接 FR-1）

**用户故事**：所有 14 处 familyId 获取点统一改为 `FamilyContext.resolve()`。

**验收标准**：
1. When `record.js:153/221/253/283/306/368` 六处 familyId 获取改为 `FamilyContext.resolve()`
2. When `todo.js:141/202` 两处改为 `FamilyContext.resolveForBaby(baby)`
3. When `report-popup.js:366` / `vaccine.js:122` / `growth.js:189` / `milestone.js:114` 改为 `FamilyContext.resolveForBaby(baby)`
4. When `export.js:66/143` 改为 `FamilyContext.resolveForBaby(baby)`
5. When `grep -rn "baby\.familyId \|\| ''" miniprogram/` 零匹配

---

## 五、非功能需求

### NFR-1：回归完整性
- v4.2.1 新增的 `e2eSecurityTest` 163 条用例必须全部通过
- 新增至少 10 条 v4.3 专项 E2E 用例（补偿日志、持久化限流、断点续传、权限预检、contract 重构）

### NFR-2：性能要求
- `FamilyContext.resolve()` 单次调用 < 1ms（纯本地读取）
- `PermissionGuard.require()` 单次 < 5ms
- 离线队列 create 数据补齐不增加额外 I/O
- `clearBabyData` 3000 条记录场景下总耗时 ≤ 60s（跨多次调用）

### NFR-3：兼容性
- 存量 ISO 字符串时间戳可读（通过 `parseTimestamp` 兼容），不强制迁移
- `leaveFamily` 新契约**通过 v4.3.0 才启用**；客户端/云函数必须同版本发布（绑定在同一 PR）
- 单例重构后，老代码的 `new Xxx()` 仍能运行（闭包单例保证），但 lint 应告警

### NFR-4：可观测性
- 所有关键操作（dissolve / clearBaby / 权限拒绝 / 限流触发 / 巡检异常）写入 `_operation_logs`
- 管理员可通过 CloudBase 控制台查看日志

### NFR-5：安全加固
- 服务端限流替代客户端仅前端限流
- `_rate_limits` 和 `_operation_logs` 集合均为 PRIVATE ACL（客户端不可读写）

---

## 六、边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| `FamilyContext.resolve()` 无法取得 familyId | 返回 `''`（不抛错），调用方写入路径会被安全规则拒绝并触发降级 |
| PermissionGuard 抛错但调用方未 try-catch | 上浮到 Promise unhandled rejection → wx.onError 记录 |
| 离线记录同步时 `data` 缺字段（历史残留） | sync.js 做 best-effort 补齐（用 cached userInfo 兜底），补齐失败则丢弃并告警 |
| `clearBabyData` 客户端循环中网络断 | 用户再次进入时复用上次 cursor（持久化到 localStorage） |
| 限流集合因并发写冲突 | 使用 CAS（`_.eq(oldCount)` 条件更新），失败时回退到内存限流 |
| 巡检函数发现无法修复的异常（users._openid 也缺失） | 仅写 warning 日志，不删除成员，人工处理 |
| `leaveFamily` 新契约发布时老版本小程序仍在用 | 后端兼容：`success: false + needTransfer` 与 `success: true + status: need_transfer` 双写过渡 3 周 |

---

## 七、模块依赖关系与新增接口

### 新增模块（客户端）
- `miniprogram/utils/family-context.js`（静态方法类）
- `miniprogram/services/permission-guard.js`（单例 + PermissionError class）

### 新增模块（云函数）
- `cloudfunctions/familyOperation/errors.js`
- `cloudfunctions/familyOperation/lib/*` 5 个工具模块
- `cloudfunctions/familyOperation/actions/*` 13 个 action 模块
- `cloudfunctions/patrolMemberOpenids/`（独立云函数）

### 新增集合
- `_operation_logs`（PRIVATE ACL）
- `_rate_limits`（PRIVATE ACL + TTL 索引）

### 新增 API
- `FamilyContext.resolve() / resolveForBaby(baby) / getUserId() / getCurrentRole()`
- `PermissionGuard.require(permission) / requireCanDelete(record) / PermissionError`
- `familyOperation` action 统一契约变更（见 FR-5、FR-8）

---

## 八、变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `miniprogram/utils/family-context.js` | **新建** | FR-1 |
| `miniprogram/services/permission-guard.js` | **新建** | FR-3 |
| `miniprogram/services/todo.js` | 小改 | FR-2 |
| `miniprogram/utils/deduplication.js` | 小改 | FR-2 |
| `miniprogram/utils/network.js` | 小改 | FR-2 |
| `miniprogram/pages/home/home.js` / `discover/discover.js` / `report-popup/report-popup.js` | 小改 | FR-2 |
| `miniprogram/services/record.js` | **大改** | FR-4 / FR-6 / FR-14 / FR-15 |
| `miniprogram/services/sync.js` | 中改 | FR-4 |
| `miniprogram/services/todo.js` 查询段 | 小改 | FR-15 |
| `miniprogram/packageGrowth/pages/{growth,vaccine,milestone}/*.js` | 小改 × 3 | FR-15 |
| `miniprogram/packageSocial/pages/{export,family}/*.js` | 小改 × 2 | FR-15 |
| `miniprogram/components/report-popup/report-popup.js` | 小改 | FR-15 |
| `miniprogram/services/family.js` | 中改 | FR-5 |
| `miniprogram/packageSocial/pages/family/family.js` / `miniprogram/pages/auth/auth.js` | 小改 | FR-5（新契约调用方） |
| `miniprogram/app.js` | 小改 | FR-6（cleanOrphanedCache 时机） |
| `cloudfunctions/familyOperation/index.js` | **重构** | FR-7 / FR-8 |
| `cloudfunctions/familyOperation/errors.js` | **新建** | FR-8 |
| `cloudfunctions/familyOperation/lib/*` | **新建** × 5 | FR-7 / FR-9 / FR-11 |
| `cloudfunctions/familyOperation/actions/*` | **新建** × 13 | FR-7 |
| `cloudfunctions/familyOperation/actions/leaveFamily.js` | 契约变更 | FR-5 |
| `cloudfunctions/familyOperation/actions/dissolveFamily.js` | 加补偿日志 | FR-9 |
| `cloudfunctions/familyOperation/actions/clearBabyData.js` | 断点续传 + 并发 | FR-10 |
| `cloudfunctions/familyOperation/actions/joinFamily.js` | 持久化限流 | FR-11 |
| `cloudfunctions/patrolMemberOpenids/` | **新建云函数** | FR-12 |
| `cloudfunctions/familyOperation/**/*.js` | 批量 | FR-13（时间戳格式） |
| `cloudfunctions/e2eSecurityTest/` | 补用例 | NFR-1 |
| 6 份核心文档 + CHANGELOG + 版本号 | 同步 | 开发后 |

---

## 九、开发顺序建议（详见 tasks.md）

```
M1 基础设施（1d）  FamilyContext + 单例统一 + PermissionGuard
    │
    ▼
M2 客户端稳定性（1d）  离线队列 + familyId 改造 + 缓存修正 + PermissionGuard 接入
    │
    ▼
M3 云函数统一（1d）  模块化 + errors.js + leaveFamily 契约
    │
    ▼
M4 云函数可观测性（1d）  logger + 持久化限流 + 断点续传 + 巡检函数
    │
    ▼
M5 回归 & 文档（0.5d）  E2E 跑完 + 文档同步 + 版本号
```

总工时：约 **4.5 天**（超过 3 天门槛，故需要 `plan.md`）

---

*文档维护：本文档定稿后状态改为"已确认"；开发完成后改为"✅ 已完成"。若期间发现遗漏需求，优先追加到 v4.3.1 而非扩大本次范围。*
