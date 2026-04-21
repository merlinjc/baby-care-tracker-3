# 需求文档 - 云函数网关 & 安全规则治理（Cloud Function Gateway & Security Rule Governance）

> 版本：v1.2 | 更新日期：2026-04-17 | 状态：✅ 已完成（2026-04-17）
> 来源：v4.1/v4.1.1 三轮代码 Review 发现的 P0 级安全规则与跨用户操作问题
> 选定方案：云函数网关 + 基于 familyId 精确读控制（方案 B）

---

## 一、背景

v4.1（Share Auth Hardening）完成后，对前后端代码进行了三轮深度 Review，发现以下核心问题：

### 1.1 问题清单

| # | 问题 | 严重程度 | 影响 |
|---|------|---------|------|
| 1 | **安全规则与业务需求矛盾**：6 个集合的实际安全规则与文档声明不一致，无法确定家庭协作是否真正工作 | 🔴 P0 | 家庭成员可能看不到彼此的记录 |
| 2 | **`users` 集合跨用户写被安全规则拒绝**：`removeMember`/`dissolveFamily`/`updateMemberRole`/`transferAdmin` 中的 `doc(targetUserId).update()` 均包裹在 try-catch 中静默失败 | 🔴 P0 | 被移除成员 `familyId` 未清除，产生幽灵数据 |
| 3 | **`records` 集合 PRIVATE 规则阻止家庭协作**：`records.where({ babyId })` 只返回当前用户自己创建的记录 | 🔴 P0 | 家庭成员 B 看不到成员 A 的记录，协作名存实亡 |
| 4 | **`families` 集合查询权限不足**：`where({ inviteCode })` 和非创建者 `doc(familyId).get()` 可能被安全规则拒绝 | 🟡 P1 | 邀请码加入失败、ensureUserReady 的 familyInfo 刷新失败 |
| 5 | **records 缺少 `familyId` 字段**：数据隔离链仅通过 babyId 间接关联，缺少租户级纵深防御 | 🟡 P1 | 架构上无法做 familyId 级别的安全规则校验 |
| 6 | **邀请码无服务端限流**：6 位字符空间约 7.29 亿，客户端无暴力破解防护 | 🟡 P2 | 理论上可被暴力枚举 |
| 7 | **所有权限校验仅在客户端**：`PermissionUtil.isAdmin()` 等检查可被恶意用户绕过 | 🟡 P2 | 客户端校验无法保证安全性 |

### 1.2 根因分析

```
客户端 SDK 操作数据库 ←──→ CloudBase 安全规则
        │                        │
        │  跨用户写操作            │  PRIVATE 规则 = 只能操作自己的文档
        │  （更新他人 users 文档）  │  _openid 匹配失败 → 静默拒绝
        │                        │
        └── 矛盾 ────────────────┘
```

**核心矛盾**：家庭协作场景天然需要跨用户读写，但 CloudBase 客户端 SDK 安全规则基于 `_openid` 隔离，无法满足。

### 1.3 方案选型

经过五方案比较（详见对话记录），选定 **方案一：云函数网关模式**：

| 维度 | 评分 | 说明 |
|------|:---:|------|
| 安全性 | ⭐⭐⭐⭐⭐ | 身份校验在服务端通过 `getWXContext().OPENID` 完成，不可伪造 |
| 改动量 | ⭐⭐⭐⭐ | 仅需新增一个云函数 + 修改 `family.js` 中的调用方式 |
| 性能 | ⭐⭐⭐ | 跨用户操作多一跳（~200-500ms），但该类操作频率极低 |
| 解决彻底度 | ⭐⭐⭐⭐⭐ | 所有跨用户操作统一收口，安全规则可收紧到最小权限 |

---

## 二、页面结构总览

```
┌───────────────────────────────────────────────────────────┐
│  分享链接进入 → App.onLaunch → initUser()                   │
│                                                            │
│  ★ ensureUserReady() 已有 5 步校验（v4.1 已实现）            │
│     ├─ 1. await initPromise                                │
│     ├─ 2. userInfo 存在 + nickname 非空                     │
│     ├─ 3. familyId 存在                                    │
│     ├─ 4. familyInfo 获取（5 分钟缓存穿透）                  │
│     └─ 5. members.includes(userId)                         │
│                                                            │
│  ★ 本次新增：跨用户操作迁移到云函数（无 UI 变更）              │
│     ├─ joinFamily → callFunction('familyOperation')        │
│     ├─ removeMember → callFunction('familyOperation')      │
│     ├─ dissolveFamily → callFunction('familyOperation')    │
│     ├─ updateMemberRole → callFunction('familyOperation')  │
│     ├─ transferAdmin → callFunction('familyOperation')     │
│     └─ leaveFamily → callFunction('familyOperation')       │
│                                                            │
│  ★ 本次新增：安全规则统一配置                                │
│     ├─ users: PRIVATE（仅自己读写）                          │
│     ├─ families: CUSTOM（成员可读，写走云函数）               │
│     ├─ babies: CUSTOM（familyId 关联读）                    │
│     ├─ records: CUSTOM（认证用户可读，创建者可改删）           │
│     ├─ vaccine_records: CUSTOM（同 records）                │
│     └─ milestone_records: CUSTOM（同 records）              │
└───────────────────────────────────────────────────────────┘
```

---

## 三、用户角色

| 角色 | 描述 | 本次变更影响 |
|------|------|-------------|
| 管理员（admin） | 家庭创建者或被授权的管理员 | 跨用户操作（移除成员、解散家庭、权限变更、管理员转让）迁移到云函数 |
| 成员（editor） | 通过邀请码加入的家庭成员 | 加入家庭操作迁移到云函数；可以看到其他成员创建的记录 |
| 仅查看（viewer） | 被设置为只读的成员 | 可以看到所有家庭成员的记录（安全规则放开） |
| 陌生人 | 通过分享链接进入的非家庭成员 | ensureUserReady() 已有保护，无变更 |

---

## 四、功能需求

### FR-1：云函数 `familyOperation` — 跨用户操作统一网关

**用户故事：** 作为系统架构师，我需要将所有跨用户数据库写操作迁移到云函数执行，以便安全规则可以收紧到最小权限，且跨用户操作不再被静默拒绝。

**验收标准：**
1. 云函数通过 `cloud.getWXContext().OPENID` 获取调用者身份，**不信任客户端传入的任何 userId**
2. 云函数内部通过 `OPENID` 查找 `users` 集合获取 `userId`（`_id`），所有后续操作使用此 `userId`
3. 云函数支持 13 个 action：`createFamily`、`joinFamily`、`removeMember`、`dissolveFamily`、`updateMemberRole`、`transferAdmin`、`leaveFamily`、`refreshInviteCode`、`validateInviteCode`、`getFamilyByUserId`、`createBaby`、`deleteBaby`、`clearBabyData`
4. 每个 action 在服务端执行**完整的权限校验**（与当前 `family.js` 中客户端校验逻辑一致）
5. 操作成功后返回标准格式：`{ success: true, data: {...} }`
6. 操作失败时返回标准格式：`{ success: false, error: { code: 'FAMILY_xxx', message: '...' } }`
7. 云函数使用 admin SDK（自动绕过安全规则），可以读写任何集合的任何文档
8. 云函数超时设置为 **20s**（默认值足够，单次操作不超过 5 次数据库读写）

> **技术说明**：云函数中 `cloud.getWXContext().OPENID` 是微信服务端自动注入的，客户端无法伪造。所有权限校验（`isAdmin`、`hasOtherAdmin`、成员归属检查等）在云函数内部完成，客户端仅保留 UI 层面的权限控制（控制按钮显示/隐藏），不再承担安全职责。

---

### FR-2：`joinFamily` action — 通过邀请码加入家庭

**用户故事：** 作为新成员，通过邀请码加入家庭时，云函数应完成所有跨用户写操作并返回结果。

**验收标准：**
1. 接收参数：`{ inviteCode, userName, relation }`
2. 服务端校验邀请码有效性（查询 families、检查过期时间）
3. 服务端检查用户是否已是目标家庭成员
4. **[v4.1 FR-9] 幽灵成员防护**：检查用户是否已属于其他家庭，如果是唯一管理员则拒绝
5. 如有旧家庭，服务端执行 `_removeSelfFromFamily`（从旧家庭 members/memberDetails 中 pull 自己 + 清除自己的 familyId）
6. 向目标家庭 `members[]` 和 `memberDetails[]` push 新成员
7. 更新用户的 `familyId` 和 `familyRole`
8. 返回 `{ success: true, data: { familyId, familyName } }`
9. **邀请码限流**：同一用户 60 秒内最多验证 5 次邀请码（防暴力枚举）

> **技术说明**：当前 `joinByInviteCode` 的完整业务逻辑（family.js 第 81-152 行）平移到云函数，但所有 `doc().update()` 操作使用 admin SDK 执行，不受安全规则限制。

---

### FR-3：`removeMember` action — 管理员移除成员

**用户故事：** 作为管理员，移除家庭成员时，被移除用户的 `familyId` 应被可靠清除。

**验收标准：**
1. 接收参数：`{ familyId, targetUserId }`
2. 服务端校验操作者是 admin
3. 禁止移除自己、禁止移除其他 admin
4. 使用原子操作 `pull` 从 `members[]` 和 `memberDetails[]` 中移除
5. **可靠地**清除被移除用户的 `familyId` 和 `familyRole`（不再是 try-catch 静默失败）
6. 如果清除被移除用户信息失败，整体操作回滚（或至少返回部分成功状态并记录日志）
7. 返回 `{ success: true, data: { removedUserId } }`

> **技术说明**：当前 `removeMember` 的 `doc(targetUserId).update()` 在客户端执行时被安全规则拒绝（`_openid` 不匹配），包裹在 try-catch 中标记为「非致命」。迁移到云函数后，admin SDK 可直接更新任何文档。

---

### FR-4：`dissolveFamily` action — 解散家庭

**用户故事：** 作为创建者，解散家庭时所有成员的 `familyId` 应被批量清除。

**验收标准：**
1. 接收参数：`{ familyId }`
2. 服务端校验操作者是 `family.creatorId`
3. 批量清除所有成员的 `familyId` 和 `familyRole`
4. 删除家庭文档
5. 清除失败的成员记录日志但不阻断（与当前行为一致）
6. 返回 `{ success: true, data: { dissolvedFamilyId, membersCleared, membersFailed } }`

> **技术说明**：当前 `dissolveFamily` 遍历 `family.members`，逐个 `doc(memberId).update()` 在客户端执行时全部被安全规则拒绝。迁移到云函数后可可靠执行。

---

### FR-5：`updateMemberRole` action — 修改成员权限

**用户故事：** 作为创建者，修改成员权限时，`users.familyRole` 应被可靠同步。

**验收标准：**
1. 接收参数：`{ familyId, targetUserId, role }`
2. 服务端校验操作者是 `family.creatorId`
3. 更新 `family.memberDetails` 中目标用户的 role
4. 同步更新 `users` 集合中目标用户的 `familyRole`
5. **[v4.1 FR-11] 乐观锁重试**：写入后检查 `stats.updated`，并发冲突时最多重试 2 次
6. 返回 `{ success: true, data: { targetUserId, newRole } }`

> **技术说明**：当前 `updateMemberRole` 的 `doc(targetUserId).update()` 同步 familyRole 在客户端被安全规则拒绝。迁移后可可靠同步。

---

### FR-6：`transferAdmin` action — 转让管理员

**用户故事：** 作为管理员，转让管理权限时，双方的 `familyRole` 应被可靠同步。

**验收标准：**
1. 接收参数：`{ familyId, newAdminId }`
2. 服务端校验操作者是 admin
3. 验证 `newAdminId` 是家庭成员
4. 更新 `family.memberDetails` 中双方的 role
5. 更新 `family.creatorId` 为 `newAdminId`
6. 同步更新双方 `users.familyRole`
7. 返回 `{ success: true, data: { oldAdminId, newAdminId } }`

> **技术说明**：v4.1.1 FR-1.2 已修复 `transferAdmin` 中的 `_openid` Bug（改为 `doc(userId)`），但客户端仍无法写其他用户文档。迁移到云函数后彻底解决。

---

### FR-7：`leaveFamily` action — 主动退出家庭

**用户故事：** 作为成员，退出家庭时应正确处理各种边界情况（唯一管理员、最后成员等）。

**验收标准：**
1. 接收参数：`{ familyId }`
2. 服务端执行完整的退出逻辑：
   - 家庭不存在 → 返回 `{ success: true, familyNotFound: true }`
   - 不是成员 → 返回 `{ success: true, notMember: true }`
   - 是唯一 admin 且还有其他成员 → 返回 `{ success: false, needTransfer: true, otherMembers: [...] }`
   - 是唯一 admin 且无其他成员 → 删除家庭 + 清除自己信息
   - 非 admin 或有其他 admin → pull 自己 + 清除自己信息
3. 返回结果与当前 `leaveFamily` 一致

> **技术说明**：`leaveFamily` 中的 `_removeSelfFromFamily` 更新的是他人创建的家庭文档，客户端可能被安全规则拒绝。迁移到云函数后可靠执行。

---

### FR-8：`family.js` 客户端改造 — 调用方式迁移

**用户故事：** 作为开发者，`family.js` 中的 10 个方法应改为调用云函数，`baby.js` 中的 2 个方法也需改为调用云函数，保持对外接口不变。

**验收标准：**
1. `joinByInviteCode(inviteCode, memberInfo)` → 内部调用 `wx.cloud.callFunction({ name: 'familyOperation', data: { action: 'joinFamily', params: {...} } })`
2. `removeMember(familyId, userId, targetUserId)` → 同上，action: `'removeMember'`
3. `dissolveFamily(familyId, userId)` → 同上，action: `'dissolveFamily'`
4. `updateMemberRole(familyId, userId, targetUserId, role)` → 同上，action: `'updateMemberRole'`
5. `transferAdmin(familyId, currentAdminId, newAdminId)` → 同上，action: `'transferAdmin'`
6. `leaveFamily(familyId, userId)` → 同上，action: `'leaveFamily'`
7. `createFamily(options)` → 同上，action: `'createFamily'`（FR-11 要求写入 memberOpenids）
8. `refreshInviteCode(familyId, userId)` → 同上，action: `'refreshInviteCode'`（安全规则禁止客户端 update families）
9. **对外接口签名不变**：调用方（auth.js、family.js 页面等）无需修改
10. 云函数返回的错误码映射到现有的 throw new Error() 行为，保持错误处理一致
11. 客户端权限校验（PermissionUtil）**保留用于 UI 控制**（按钮显隐），但不再承担安全职责

> **技术说明**：改造模式为「适配器模式」——`family.js` 的方法签名和返回值不变，内部实现从直接操作数据库改为调用云函数。这样 `auth.js`、`family.js`（页面）、`settings.js` 等调用方完全不需要改动。

---

### FR-9：安全规则统一配置（基于 familyId 精确读控制）

**用户故事：** 作为系统架构师，我需要为 6 个集合配置严格的安全规则，确保对应 baby 的数据只有属于同一个 family 的用户可以读写，非家庭成员即使猜到 babyId 也无法读取数据。

**前置条件：** `families` 集合需新增 `memberOpenids` 字段（FR-11），记录类集合需有 `familyId` 字段（FR-10）。

**验收标准：**

1. **`users` 集合**：PRIVATE（`doc._openid == auth.openid`）
   - 每个用户仅能读写自己的文档
   - 跨用户写操作已迁移到云函数

2. **`families` 集合**：CUSTOM
   ```json
   {
     "read": "auth.openid in doc.memberOpenids",
     "create": "auth != null",
     "update": false,
     "delete": false
   }
   ```
   - **仅家庭成员可读**（通过 `memberOpenids` 数组校验）
   - 所有认证用户可创建家庭
   - 写操作（update/delete）仅通过云函数
   - 邀请码查询 `where({ inviteCode })` 需迁移到云函数（安全规则不允许非成员读取）

3. **`babies` 集合**：CUSTOM
   ```json
   {
     "read": "auth.openid in get('database.families.' + doc.familyId).memberOpenids",
     "create": "auth != null",
     "update": "doc._openid == auth.openid",
     "delete": false
   }
   ```
   - **仅同家庭成员可读**（通过 `get()` 函数交叉校验 `families.memberOpenids`）
   - 创建者可更新自己创建的 baby
   - 删除走云函数

4. **`records` 集合**：CUSTOM
   ```json
   {
     "read": "auth.openid in get('database.families.' + doc.familyId).memberOpenids",
     "create": "auth != null",
     "update": "doc._openid == auth.openid",
     "delete": "doc._openid == auth.openid"
   }
   ```
   - **仅同家庭成员可读**（核心变更：家庭成员可互看记录，但非成员无法读取）
   - 创建者可更新/删除自己的记录
   - admin 删除他人记录需通过云函数（后续需求）
   - **要求**：所有 records 文档必须有 `familyId` 字段（FR-10）

5. **`vaccine_records` 集合**：同 `records`
   ```json
   {
     "read": "auth.openid in get('database.families.' + doc.familyId).memberOpenids",
     "create": "auth != null",
     "update": "doc._openid == auth.openid",
     "delete": "doc._openid == auth.openid"
   }
   ```
   - vaccine_records 已有 `familyId` 字段（vaccine.js 第 312 行已写入）

6. **`milestone_records` 集合**：同 `records`
   ```json
   {
     "read": "auth.openid in get('database.families.' + doc.familyId).memberOpenids",
     "create": "auth != null",
     "update": "doc._openid == auth.openid",
     "delete": "doc._openid == auth.openid"
   }
   ```
   - milestone_records 已有 `familyId` 字段（milestone.js 第 418 行已写入）

> **技术说明**：
> - `get('database.families.' + doc.familyId)` 会在安全规则校验时额外产生一次数据库读操作（计费）。但记录读取频率适中且有本地缓存，实际增加的费用可控。
> - CloudBase `get()` 函数限制：每条表达式最多 3 个 `get()`，嵌套最多 2 层。当前方案每条规则仅 1 个 `get()`，在限制范围内。
> - **客户端查询必须包含 `familyId` 条件**（安全规则要求查询条件是规则的子集）。需要修改 `getRecords()`、`calculateFilterCounts()` 等查询，在 `where` 中附加 `familyId` 字段。
> - `families` 集合的邀请码查询 `where({ inviteCode })` 原本由客户端直接执行，现在非成员无法读取 families，需迁移到云函数 `familyOperation` 的 `joinFamily` action 中（FR-2 已包含）。
> - `families` 集合的 `validateInviteCode()` 和 `getFamilyByUserId()` 查询也需迁移到云函数（新增 FR-12）。

---

### FR-10：记录类集合全面补充 `familyId` 字段

**用户故事：** 作为系统架构师，我需要确保 `records`、`vaccine_records`、`milestone_records` 的所有文档都有 `familyId` 字段，使安全规则的 `get()` 交叉校验能正确工作。

**验收标准：**

1. **`records` 集合 — 新记录**：
   - `record.js#createRecord()` 新增 `familyId` 字段写入：从 `StorageUtil.getUserInfo().familyId` 获取
   - 离线队列中的 create 操作也包含 `familyId`
   - 离线降级创建的记录也包含 `familyId`

2. **`records` 集合 — 存量迁移**：
   - 编写云函数 `migrateRecordFamilyId` 为存量 records 补充 `familyId`
   - 迁移逻辑：通过 `babyId` 查找对应 `babies` 文档获取 `familyId`，批量写入
   - 迁移后标记 `_familyIdMigratedAt`，支持幂等重复执行

3. **`vaccine_records` 集合**：已有 `familyId`（vaccine.js 第 312 行），无需改动

4. **`milestone_records` 集合**：已有 `familyId`（milestone.js 第 418 行），无需改动

5. **查询改造**：所有 `where({ babyId })` 查询需附加 `familyId` 条件（安全规则要求，共 12 处）：
   - `RecordService.getRecords()` — 附加 `familyId`
   - `record.js > calculateFilterCounts()` — 附加 `familyId`
   - `growth.js > loadGrowthRecords()` — 附加 `familyId`
   - `report-popup.js` 的 records/vaccine/milestone 查询 — 附加 `familyId`
   - `export.js` 的分页查询 — 附加 `familyId`
   - `todo.js` 的 vaccine_records/milestone_records 查询 — 附加 `familyId`
   - `vaccine.js > loadVaccineList()` — 附加 `familyId`
   - `milestone.js > loadMilestones()` — 附加 `familyId`
   - `settings.js` 批量删除查询 — 附加 `familyId`

> **技术说明**：
> - `familyId` 从 `StorageUtil.getUserInfo().familyId` 或 `StorageUtil.getFamilyInfo()._id` 获取，两者等价。
> - 安全规则的 `get()` 函数校验的是 `doc.familyId`（文档中的字段），查询条件中也必须包含 `familyId`（否则安全规则校验不通过——查询条件必须是规则的子集）。
> - 存量迁移云函数使用 admin SDK，超时设置 60s。

---

### FR-11：`families` 集合新增 `memberOpenids` 字段

**用户故事：** 作为系统架构师，我需要在 `families` 集合中维护 `memberOpenids` 数组，使安全规则能通过 `auth.openid in doc.memberOpenids` 校验成员身份。

**验收标准：**

1. **数据结构**：`families` 集合新增 `memberOpenids: string[]` 字段，存储所有成员的 `_openid`

2. **云函数维护**：所有涉及成员变更的云函数 action 同步维护 `memberOpenids`：
   - `joinFamily`：push 新成员的 openid
   - `removeMember`：pull 被移除成员的 openid
   - `dissolveFamily`：无需维护（家庭文档被删除）
   - `leaveFamily`：pull 退出成员的 openid
   - `createFamily`：初始化时写入创建者的 openid

3. **openid 获取方式**：
   - 云函数中通过 `cloud.getWXContext().OPENID` 获取当前操作者的 openid
   - 对于 `removeMember`（移除他人），需通过 `users.doc(targetUserId).get()` 获取目标用户的 `_openid` 字段

4. **`createFamily` 客户端改造**：
   - 当前 `createFamily` 在客户端 `family.js` 中执行 `familyCollection.add()`
   - 需迁移到云函数（或在客户端 add 时写入 `memberOpenids: [当前用户openid]`）
   - **推荐**：也迁移到 `familyOperation` 云函数，统一入口

5. **存量迁移**：
   - 编写云函数 `migrateFamilyOpenids` 为存量 families 补充 `memberOpenids`
   - 迁移逻辑：遍历 `family.members[]`，逐个查 `users.doc(memberId)` 获取 `_openid`，组装数组写入
   - 迁移后标记 `_openidsMigratedAt`

6. **数据一致性**：`memberOpenids` 与 `members[]` 一一对应，索引位置不要求一致但元素数量必须一致

> **技术说明**：
> - CloudBase 安全规则中 `auth.openid` 是微信自动注入的当前用户 openid，不可伪造。
> - `memberOpenids` 与 `members`（存储 `_id`）是两套平行的成员标识。`members` 用于业务逻辑（权限校验等），`memberOpenids` 专用于安全规则校验。
> - 云函数中 `getWXContext().OPENID` 获取的是**调用者**的 openid，removeMember 等操作需额外查询目标用户的 openid。

---

### FR-12：`validateInviteCode` 和 `getFamilyByUserId` 迁移到云函数

**用户故事：** 由于 `families` 集合的 read 规则改为成员可读，非成员无法通过客户端 SDK 查询 `where({ inviteCode })` 和 `where({ members: userId })`，这两个查询需迁移到云函数。

**验收标准：**

1. **`familyOperation` 云函数新增 2 个 action**：
   - `validateInviteCode`：接收 `{ inviteCode }`，返回 `{ valid, familyId, familyName, memberCount }`
   - `getFamilyByUserId`：接收无参数（使用 OPENID 自动识别），返回家庭信息或 null

2. **`family.js` 客户端改造**：
   - `validateInviteCode(inviteCode)` → 内部改为 callFunction
   - `getFamilyByUserId(userId)` → 内部改为 callFunction
   - 对外接口签名不变

3. **`getFamilyDetail(familyId)` 保留客户端直连**：
   - 此方法由 `ensureUserReady()` 调用，调用者已经是家庭成员
   - 安全规则 `auth.openid in doc.memberOpenids` 允许成员读取
   - 无需迁移

> **技术说明**：
> - `validateInviteCode` 在加入家庭前调用，此时用户还不是目标家庭成员，无法通过 `memberOpenids` 校验
> - `getFamilyByUserId` 查询条件是 `where({ members: userId })`，安全规则 `auth.openid in doc.memberOpenids` 要求查询条件包含 openid 信息，`members` 存的是 `_id` 不是 openid，规则校验会失败
> - 迁移后这两个方法通过云函数 admin SDK 执行，绕过安全规则

---

### FR-13：`baby` 相关操作迁移到云函数

**用户故事：** 由于 `families` 集合安全规则 `"update": false`，`baby.js` 中涉及 `families.doc().update()` 的操作（创建宝宝时 push babyId、删除宝宝时 pull babyId）以及 `babies.doc().remove()` 操作都会被阻止，需迁移到云函数。

**验收标准：**

1. **`familyOperation` 云函数新增 2 个 action**：
   - `createBaby`：接收 `{ familyId, name, gender, birthDate, avatar }`，在云函数中执行 `babies.add()` + `families.doc().update({ babies: push(babyId) })`
   - `deleteBaby`：接收 `{ babyId, familyId }`，在云函数中执行 `families.doc().update({ babies: pull(babyId) })` + `babies.doc().remove()`

2. **`baby.js` 客户端改造**：
   - `createBaby()` → 内部改为 callFunction
   - `deleteBaby()` → 内部改为 callFunction
   - 对外接口签名不变

3. **`baby-list.js` 修复**：
   - 第 152 行直接 `db.collection('babies').doc(id).remove()` 改为调用 `babyService.deleteBaby(id, familyId)`
   - 确保从 families.babies 数组中同步 pull

4. **`babies` 安全规则调整**：
   - `"update"` 改为 `"auth.openid in get('database.families.' + doc.familyId).memberOpenids"`（允许同家庭成员更新宝宝信息）
   - 或保持 `"doc._openid == auth.openid"` 但需接受非创建者无法编辑宝宝档案的限制

> **技术说明**：
> - `baby-list.js` 当前直接操作 `db.collection('babies').doc(id).remove()` 绕过了 `babyService`，且未从 `families.babies` 数组中 pull，产生脏数据
> - `babies` 安全规则 `"update": "doc._openid == auth.openid"` 意味着只有创建宝宝的成员能编辑宝宝信息，其他家庭成员无法修改——需确认是否为期望行为

---

### FR-14：`clearBabyData` 清除数据操作迁移到云函数

**用户故事：** `settings.js` 的「清除云端数据」功能涉及删除 `babies`、`families`、`records`、`vaccine_records`、`milestone_records` 多个集合的数据，安全规则会阻止部分操作（`babies.delete: false`、`families.delete: false`、records 中非自己创建的记录无法删除），需迁移到云函数。

**验收标准：**

1. **`familyOperation` 云函数新增 1 个 action**：
   - `clearBabyData`：接收 `{ babyId, familyId }`，在云函数中使用 admin SDK 执行：
     - 批量删除 `records`（`where({ babyId })`，包括其他成员创建的记录）
     - 批量删除 `vaccine_records`（`where({ babyId })`）
     - 批量删除 `milestone_records`（`where({ babyId })`）
     - 删除 `babies.doc(babyId).remove()`
     - 从 `families.babies` 数组中 pull babyId
     - 如果家庭无剩余宝宝，删除 families 文档 + 清除所有成员的 familyId

2. **`settings.js` 客户端改造**：
   - `clearAllCloudData()` 改为调用 `wx.cloud.callFunction({ name: 'familyOperation', data: { action: 'clearBabyData', params: { babyId, familyId } } })`
   - 对外行为不变（仍需二次确认弹窗）

3. **权限校验**：云函数中校验操作者是家庭 admin

> **技术说明**：
> - 当前 `settings.js` 中 `records.doc(r._id).remove()` 只能删除 `doc._openid == auth.openid` 的记录。如果宝宝有多位家长的记录（家庭协作场景），当前用户只能删自己创建的部分，其他成员的记录残留
> - 迁移到云函数后，admin SDK 可批量删除该 babyId 下所有记录，包括其他成员创建的

---

### FR-15：`family.js` 页面层直接 DB 操作修正

**用户故事：** `packageSocial/pages/family/family.js` 第 142 行和第 266 行直接操作 `db.collection('families').doc().update()` 绕过了 `familyService`，安全规则 `"update": false` 会阻止这些操作。

**验收标准：**

1. **第 142 行**（自动生成邀请码）：改为调用 `familyService.refreshInviteCode(familyId, userId)`
2. **第 266 行**（手动重新生成邀请码）：改为调用 `familyService.refreshInviteCode(familyId, userId)`
3. 删除页面层的 `generateInviteCode()` 方法（第 302-309 行），统一由 familyService/云函数处理

---

## 五、非功能需求

### NFR-1：性能要求
- 云函数调用延迟控制在 **500ms 以内**（不含冷启动）
- 云函数首次冷启动延迟 **< 2s**
- 加入家庭、移除成员等操作频率极低（日均 < 10 次/家庭），不会产生调用量压力
- **读操作性能影响**：安全规则中的 `get()` 函数每次读操作额外产生 1 次数据库读（计费）。客户端已有 15s~30s 内存缓存和本地缓存机制，实际触发 `get()` 的频率可控
- `getRecords()`、`getBabiesByFamilyId()` 仍通过客户端 SDK 直连数据库，`getFamilyDetail()` 对成员保持客户端直连

### NFR-2：兼容性要求
- `family.js` 对外方法签名不变，调用方（auth.js、family 页面、settings 页面）无需修改
- 现有错误处理行为（try-catch + Toast）保持一致
- 离线场景下，跨用户操作本就不可能成功（需要网络），行为不变

### NFR-3：数据一致性
- 云函数中的多步操作（如 joinFamily：移除旧家庭 + 加入新家庭 + 更新 users）如果中途失败，记录日志并返回部分成功状态
- ensureUserReady() 已有的降级机制可处理中间状态（被踢出→重新引导到 auth）

### NFR-4：安全性
- 云函数通过 `getWXContext().OPENID` 识别身份，客户端**不传递** userId
- 权限校验（isAdmin、creatorId 检查等）在云函数内部完成
- 邀请码验证增加 60 秒 5 次限流（基于内存 Map，云函数实例间不共享但足以防御单实例暴力）
- 安全规则配置后需等待 **2-5 分钟** 缓存生效

---

## 六、边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 云函数冷启动超时 | 客户端 callFunction 有 20s 超时，降级显示网络错误 Toast |
| 云函数内部数据库操作失败 | 返回 `{ success: false, error: { code, message } }`，客户端显示 error.message |
| 用户在离线状态下触发跨用户操作 | `wx.cloud.callFunction` 自动报错，已有 try-catch 处理 |
| 安全规则配置后立即测试 | 等待 2-5 分钟缓存生效 |
| joinFamily 中途失败（已退出旧家庭但加入新家庭失败） | 用户变成无家庭状态，下次打开 ensureUserReady 引导到 auth 重新加入 |
| 多个管理员同时操作同一成员 | 乐观锁 + 重试（FR-5 已有），云函数内部同样实现 |
| 云函数并发调用（同时加入/移除） | CloudBase NoSQL 原子操作 push/pull 保证并发安全 |
| 云函数被恶意频繁调用 | 微信平台自带云函数调用频率限制；邀请码操作额外限流 |
| **存量 records 缺少 familyId（迁移前）** | 安全规则 `get()` 校验会失败，**必须在配安全规则前完成迁移** |
| **存量 families 缺少 memberOpenids（迁移前）** | 安全规则 `auth.openid in doc.memberOpenids` 校验会失败，**必须先迁移** |
| **客户端查询未附加 familyId** | 安全规则校验不通过，返回 PERMISSION_DENIED，需确保 9 处查询全部改造 |
| **`get()` 函数目标文档不存在（family 被删除）** | `get()` 返回 null，安全规则校验失败，查询被拒绝——符合预期（家庭已不存在） |
| **新用户注册后尚无 familyId** | 不影响——新用户走 auth 引导流程，没有 familyId 时不会查询任何记录集合 |

---

## 七、模块依赖关系与新增接口

```
FR-1 (云函数网关) ─── 基础，其他 FR 依赖此
   │
   ├── FR-2 (joinFamily action)
   ├── FR-3 (removeMember action)
   ├── FR-4 (dissolveFamily action)
   ├── FR-5 (updateMemberRole action)
   ├── FR-6 (transferAdmin action)
   ├── FR-7 (leaveFamily action)
   ├── FR-12 (validateInviteCode/getFamilyByUserId 迁移)
   ├── FR-13 (createBaby/deleteBaby 迁移)
   └── FR-14 (clearBabyData 迁移)
   
FR-8 (客户端改造) ─── 依赖 FR-1~FR-7, FR-12~FR-14 完成
FR-15 (family 页面修正) ─── 依赖 FR-8（refreshInviteCode 走云函数）

FR-11 (families memberOpenids) ─┐
FR-10 (records familyId 全量) ──┼── FR-9 (安全规则) 依赖这两项完成
                                 │
FR-9 (安全规则配置) ─────────── 需在 FR-8 测试前完成
```

**新增/修改接口：**

| 接口 | 类型 | 说明 |
|------|------|------|
| `cloudfunctions/familyOperation/index.js` | **新增** | 统一云函数网关，支持 13 个 action |
| `cloudfunctions/migrateRecordFamilyId/index.js` | **新增** | 存量 records familyId 迁移脚本 |
| `cloudfunctions/migrateFamilyOpenids/index.js` | **新增** | 存量 families memberOpenids 迁移脚本 |
| `family.js#joinByInviteCode()` | 修改 | 内部改为 callFunction |
| `family.js#removeMember()` | 修改 | 内部改为 callFunction |
| `family.js#dissolveFamily()` | 修改 | 内部改为 callFunction |
| `family.js#updateMemberRole()` | 修改 | 内部改为 callFunction |
| `family.js#transferAdmin()` | 修改 | 内部改为 callFunction |
| `family.js#leaveFamily()` | 修改 | 内部改为 callFunction |
| `family.js#validateInviteCode()` | 修改 | 内部改为 callFunction（FR-12） |
| `family.js#getFamilyByUserId()` | 修改 | 内部改为 callFunction（FR-12） |
| `family.js#createFamily()` | 修改 | 迁移到云函数以写入 memberOpenids（FR-11） |
| `record.js#createRecord()` | 小改 | 新增 familyId 字段写入 |
| `record.js#getRecords()` | 小改 | where 条件附加 familyId |
| `record.js > calculateFilterCounts()` | 小改 | where 条件附加 familyId |
| 多处直接 `db.collection().where()` 调用 | 小改 | 附加 familyId（共约 9 处） |

---

## 八、变更影响范围

### 代码变更

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `cloudfunctions/familyOperation/index.js` | **新增** | FR-1~FR-7, FR-11, FR-12 |
| `cloudfunctions/familyOperation/package.json` | **新增** | FR-1 |
| `cloudfunctions/familyOperation/config.json` | **新增** | FR-1（超时配置） |
| `cloudfunctions/migrateRecordFamilyId/index.js` | **新增** | FR-10（一次性迁移脚本） |
| `cloudfunctions/migrateFamilyOpenids/index.js` | **新增** | FR-11（一次性迁移脚本） |
| `miniprogram/services/family.js` | **大改** | FR-8, FR-12（10 个方法内部实现替换） |
| `miniprogram/services/baby.js` | **中改** | FR-13（createBaby/deleteBaby 改为 callFunction） |
| `miniprogram/services/record.js` | 中改 | FR-10（createRecord 加 familyId + getRecords 附加 familyId） |
| `miniprogram/pages/record/record.js` | 小改 | FR-10（calculateFilterCounts 附加 familyId） |
| `miniprogram/pages/baby-list/baby-list.js` | 小改 | FR-13（deleteBaby 改为调用 babyService） |
| `miniprogram/packageGrowth/pages/growth/growth.js` | 小改 | FR-10（loadGrowthRecords 附加 familyId） |
| `miniprogram/packageGrowth/pages/vaccine/vaccine.js` | 小改 | FR-10（loadVaccineList 附加 familyId） |
| `miniprogram/packageGrowth/pages/milestone/milestone.js` | 小改 | FR-10（loadMilestones 附加 familyId） |
| `miniprogram/components/report-popup/report-popup.js` | 小改 | FR-10（3 处 where 附加 familyId） |
| `miniprogram/services/todo.js` | 小改 | FR-10（2 处 where 附加 familyId） |
| `miniprogram/packageSocial/pages/export/export.js` | 小改 | FR-10（查询附加 familyId） |
| `miniprogram/packageSocial/pages/settings/settings.js` | **中改** | FR-10 + FR-14（查询附加 familyId + clearBabyData 改为云函数） |
| `miniprogram/packageSocial/pages/family/family.js` | 小改 | FR-15（直接 DB 操作改为 familyService 调用） |

### 安全规则变更

| 集合 | 当前规则 | 目标规则 | 涉及 FR |
|------|---------|---------|---------|
| `users` | 不明确 | PRIVATE | FR-9 |
| `families` | 不明确 | CUSTOM（`auth.openid in doc.memberOpenids`） | FR-9, FR-11 |
| `babies` | 不明确 | CUSTOM（`get()` 交叉校验 familyId→memberOpenids） | FR-9, FR-10 |
| `records` | 不明确 | CUSTOM（`get()` 交叉校验 familyId→memberOpenids） | FR-9, FR-10 |
| `vaccine_records` | 不明确 | CUSTOM（同 records） | FR-9 |
| `milestone_records` | 不明确 | CUSTOM（同 records） | FR-9 |

### 数据模型变更

| 集合 | 字段 | 变更 |
|------|------|------|
| `families` | `memberOpenids: string[]` | **新增**（FR-11：存储成员 openid 列表，安全规则校验用） |
| `records` | `familyId: string` | **新增**（FR-10：新记录写入 + 存量迁移） |

### 调用方无变更（适配器模式）

以下文件**不需要修改**：
- `miniprogram/pages/auth/auth.js` — 调用 `familyService.joinByInviteCode()`、`validateInviteCode()`，接口不变
- `miniprogram/packageSocial/pages/family/family.js` — 调用 `removeMember`/`updateMemberRole`/`dissolveFamily`/`transferAdmin`，接口不变
- `miniprogram/packageSocial/pages/settings/settings.js` — 调用 `leaveFamily`，接口不变

---

## 九、优先级排序

| 优先级 | 需求 | 理由 | 预计工时 |
|--------|------|------|---------|
| **P0** | FR-1 云函数基础框架 | 其他 FR 依赖 | 1h |
| **P0** | FR-2 joinFamily action | 新用户加入家庭的核心路径 | 1h |
| **P0** | FR-3 removeMember action | 被移除用户数据清理的关键修复 | 0.5h |
| **P0** | FR-4 dissolveFamily action | 家庭解散后成员清理的关键修复 | 0.5h |
| **P0** | FR-5 updateMemberRole action | 权限变更同步的关键修复 | 0.5h |
| **P0** | FR-6 transferAdmin action | 管理员转让的关键修复 | 0.5h |
| **P0** | FR-7 leaveFamily action | 退出家庭可靠性保障 | 0.5h |
| **P0** | FR-11 families memberOpenids | 安全规则前置依赖 | 1h（含存量迁移脚本） |
| **P0** | FR-10 records familyId 全量 | 安全规则前置依赖 | 1.5h（含存量迁移脚本 + 9 处查询改造） |
| **P0** | FR-12 validateInviteCode 迁移 | families 安全规则变更后的必要迁移 | 0.5h |
| **P0** | FR-13 baby 操作迁移云函数 | families `"update": false` 阻止 createBaby/deleteBaby | 1h |
| **P0** | FR-14 clearBabyData 迁移云函数 | settings 清除数据功能完全失效 | 0.5h |
| **P0** | FR-15 family 页面直接 DB 修正 | 邀请码生成功能失效 | 0.25h |
| **P0** | FR-9 安全规则配置 | 依赖 FR-10/FR-11 完成 | 0.5h |
| **P0** | FR-8 客户端改造 | 使云函数生效 | 1h |

**v4.2 总预计工时：约 11h**

---

## 十、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 云函数冷启动导致首次操作慢 | 中 | 低 | 加入/移除等操作本就有 loading 态，用户可感知但可接受 |
| 安全规则变更导致现有功能回归 | **中** | **高** | 严格按序执行：先迁移数据 → 再部署云函数 → 最后配安全规则；每步之间验证 |
| `get()` 函数增加数据库读次数和费用 | 中 | 低 | 每次 read 额外 1 次 get()，但有客户端缓存兜底，实际触发频率可控 |
| 存量 records 缺少 familyId 导致安全规则校验失败 | **高** | **高** | **必须先执行 `migrateRecordFamilyId` 迁移，确认全量覆盖后再配安全规则** |
| 存量 families 缺少 memberOpenids 导致成员无法读取 | **高** | **高** | **必须先执行 `migrateFamilyOpenids` 迁移，确认全量覆盖后再配安全规则** |
| 云函数与客户端逻辑不一致 | 低 | 中 | 云函数逻辑直接从 `family.js` 平移，保持 1:1 一致 |
| 客户端查询忘记附加 familyId | 中 | 高 | 安全规则配置后未附加 familyId 的查询会被拒绝，测试阶段可快速发现 |
| `get()` 函数达到 CloudBase 限制 | 极低 | 高 | 当前每条规则仅 1 个 get()，远低于 3 个上限 |

---

## 十一、实施阶段规划

### Phase 1：云函数开发 + 数据迁移脚本（M1，约 6h）
- FR-1：云函数基础框架（入口、身份解析、错误处理、日志）
- FR-2~FR-7：6 个 action 实现（从 family.js 平移业务逻辑）
- FR-11：createFamily action 维护 memberOpenids + `migrateFamilyOpenids` 迁移脚本
- FR-12：validateInviteCode + getFamilyByUserId action
- FR-13：createBaby + deleteBaby action
- FR-14：clearBabyData action
- FR-10：`migrateRecordFamilyId` 迁移脚本

### Phase 2：执行数据迁移（M2，约 0.5h）
- 部署并执行 `migrateFamilyOpenids` → 验证所有 families 有 memberOpenids
- 部署并执行 `migrateRecordFamilyId` → 验证所有 records 有 familyId
- **⚠️ 阻塞点：必须迁移完成后才能配安全规则**

### Phase 3：客户端改造 + 安全规则（M3，约 3.5h）
- FR-10 查询改造：12 处 where 条件附加 familyId
- FR-8：family.js 10 个方法改为 callFunction
- FR-13：baby.js 2 个方法改为 callFunction + baby-list.js 修复
- FR-14：settings.js clearAllCloudData 改为 callFunction
- FR-15：family.js 页面层 DB 操作修正
- FR-9：配置 6 个集合的安全规则（等缓存生效 2-5 分钟）
- FR-10：record.js createRecord 新增 familyId 写入

### Phase 4：集成测试（M4，约 1h）
- 验证所有 13 个云函数 action 的完整流程
- 验证安全规则下的读操作正常（同家庭可读，非家庭成员不可读）
- 回归测试：首页加载、记录查看、家庭成员互看记录、疫苗/里程碑页面
- 回归测试：创建宝宝、删除宝宝、清除云端数据功能
- **关键测试**：用另一个微信号（非家庭成员）尝试读取记录，确认被拒绝

---

*文档维护：本文档随开发进展同步更新。*
