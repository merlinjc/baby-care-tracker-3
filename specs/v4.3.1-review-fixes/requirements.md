# 需求文档 - v4.3.1 Review 修复（Review Fixes）

> 版本：v1.0 | 更新日期：2026-04-20 | 状态：进行中

## 概述

本迭代源于对 v4.3.0 分支的全量代码 review（对齐 architecture/data-model/service-api/component-library 4 份核心文档），发现 26 个不同严重度的问题。v4.3.1 为 PATCH 级别发布，聚焦于修复 v4.3.0 遗留的严重 bug（生产级别影响）、权限绕过风险、以及文档与实现偏差。

不新增任何用户可感知的功能。

## 用户角色

- **Admin**（管理员）：v4.3.1 后 `deleteBaby` / `createBaby` / `dissolveFamily` 的权限边界恢复正确
- **Editor**（成员）：`record.batchDelete` 后 UI 不会因云端失败而闪烁丢记录
- **Viewer**（仅查看）：不再能绕过客户端创建/删除宝宝
- **新注册用户**：创建宝宝后能继续更新宝宝信息（v4.3.0 的生产 blocker）

## 功能需求

### FR-1：`createBaby` 写入 `_openid`（P0 Blocker）

**用户故事**：作为新注册用户，我想要创建宝宝后还能修改宝宝姓名/出生日期/头像，以便录入错误时能订正。

**验收标准**：
1. When 用户通过 `familyOperation.createBaby` action 创建宝宝，the system shall 写入 `_openid = ctx.openid`
2. When 创建者后续调用 `babyService.updateBaby()` 修改宝宝信息，the system shall 通过安全规则 `doc._openid == auth.openid` 校验
3. 存量宝宝（无 `_openid` 字段）仍能被 admin 通过 `familyOperation` 云函数修改

> **技术说明**：`createBaby.js` 的 `babyData` 对象显式设置 `_openid: ctx.openid`；admin SDK 允许显式赋值。

---

### FR-2：`createBaby` / `deleteBaby` 权限收紧为 admin（P0 Blocker）

**用户故事**：作为家庭管理员，我不希望普通成员（尤其是 viewer）能未经授权添加/删除宝宝档案。

**验收标准**：
1. When viewer 或 editor 调用 `createBaby`，the system shall 返回 `PERMISSION_DENIED`
2. When viewer 或 editor 调用 `deleteBaby`，the system shall 返回 `PERMISSION_DENIED`
3. When admin 调用上述 action，行为与 v4.3.0 一致

> **技术说明**：把 `isMember(userId, family)` 替换为 `isAdmin(userId, family)`，错误码复用 `PERMISSION_DENIED`。

---

### FR-3：`deleteBaby` 级联删除记录（P0 Blocker）

**用户故事**：作为管理员，我删除宝宝时希望相关的喂养/疫苗/里程碑记录也被清理，避免孤儿数据。

**验收标准**：
1. When 调用 `deleteBaby`，the system shall 先执行 `clearBabyData` 的 records/vaccine/milestone 删除阶段
2. When 删除量超过单次时间预算（15s），the system shall 返回 `in_progress` 状态 + cursor 供客户端续调
3. When 删除成功，the system shall 返回 `{ status: 'succeeded', records, vaccine, milestone }` 统计

> **技术说明**：复用 `clearBabyData` 的 phase state + chunkedDelete 逻辑，或者 `deleteBaby` 内部转调 `clearBabyData` 但跳过"删家庭"的收尾阶段。

---

### FR-4：`settings.clearAllCloudData` 循环处理 `in_progress`（P0 Blocker）

**用户故事**：作为管理员，在设置页点"清除所有数据"时，我希望大数据量场景下能完整清除，不会只删第一批就提示成功。

**验收标准**：
1. When 云函数返回 `{ status: 'in_progress', cursor }`，the system shall 携带 cursor 循环调用直到 succeeded
2. When 循环进行时，the system shall 通过 `wx.showLoading` 提示"清除中... 已清除 N 条"
3. When 累计循环超过 5 次仍未完成，the system shall 提示用户"数据量较大，请稍后重试"并保留 cursor

> **技术说明**：Promise 循环；cursor 透传；保持 `wx.showLoading` 不断更新 title。

---

### FR-5：`joinFamily/removeMember` 的 openid 兜底（P0 Blocker）

**用户故事**：作为管理员，移除一个已注销账号（无 _openid）的成员时，我不希望该成员的 openid 残留在 `memberOpenids` 里。

**验收标准**：
1. When `removeMember` 的 targetOpenid 为空，the system shall 保留原 `memberOpenids`（不做 `_.pull('')` 的破坏性 no-op），并写入 operation_logs 告警
2. When `patrolMemberOpenids` 定期巡检，the system shall 对此类 family 重新计算 memberOpenids 并修复
3. When 上述场景发生，不能导致被移除用户仍有 openid 留在数组中

> **技术说明**：`memberOpenids: targetOpenid ? _.pull(targetOpenid) : family.memberOpenids` + `logger.step('missing_target_openid', 'skip', { targetUserId })`。

---

### FR-6：`permission.getUserRole` 默认返回 viewer（P0 Blocker）

**用户故事**：作为一个刚被踢出家庭的用户，我不希望本地缓存过期期间还能创建新记录产生脏写。

**验收标准**：
1. When userId 不在 `family.memberDetails` 中 且 不是 `family.creatorId`，the system shall 返回 `'viewer'`（最小权限原则）
2. When 相关页面 UI 按钮依据 `PermissionGuard.check()` 渲染，viewer 默认对写操作按钮隐藏/禁用
3. 向后兼容：历史无 `memberDetails` 数据（已通过迁移补齐），此分支不会被触发

> **技术说明**：把 `return 'editor'` 改为 `return 'viewer'`；同时留一行 comment 解释历史。

---

### FR-7：`records.updateRecord` / `sync` 缺 `updatedAtTs`（P0 Blocker）

**用户故事**：作为多设备协作的用户，我希望"离线 update 恢复后先同步"的本地修改不会被云端旧版本覆盖。

**验收标准**：
1. When 客户端调用 `RecordService.updateRecord`，the system shall 在写云端时同时写入 `updatedAtTs: Date.now()`
2. When 离线队列 `sync.js executeOperation(update)` 执行时，the system shall 同样写入 `updatedAtTs`
3. When `mergeRecords` 按 `updatedAtTs` 比较两端时效性，the system shall 正确识别新旧版本（v4.3.0 FR-6 的完整闭环）

> **技术说明**：`data.updatedAt = serverDate()` 旁边补 `data.updatedAtTs = Date.now()`。

---

### FR-8：`updateMemberRole` role 白名单 + 禁止 admin 多头（P1）

**用户故事**：作为管理员，我希望 role 参数只能是预定义的 3 个值，避免写入脏角色。

**验收标准**：
1. When role 不在 `['admin', 'editor', 'viewer']` 中，the system shall 返回 `INVALID_ROLE`
2. When 管理员把自己降级为 editor 而家庭无其他 admin，the system shall 返回 `SOLE_ADMIN`
3. When 管理员给他人设为 admin，当前 admin 的 role 自动降为 editor（保持唯一 admin 不变）

> **技术说明**：在 `updateMemberRole.js` 入口加白名单 + `hasOtherAdmin` 守卫。

---

### FR-9：`dissolveFamily` 权限判定改用 `isAdmin`（P1）

**用户故事**：作为因 transferAdmin 被变更的新管理员，我希望能解散家庭（不应依赖陈旧的 creatorId）。

**验收标准**：
1. When 调用 `dissolveFamily`，the system shall 以 `isAdmin(userId, family)` 判定，替换原 `creatorId === userId`
2. 未来若允许多 admin，任一 admin 可解散
3. 兼容旧数据：`creatorId === userId` 时 `isAdmin` 也必然返回 true（见 `lib/auth.isAdmin`）

---

### FR-10：`createFamily` 防重复创建（P1）

**用户故事**：作为一个已经在某家庭里的用户，我不希望绕过客户端直接创建新家庭导致双宿。

**验收标准**：
1. When `ctx.user.familyId` 非空 且 该 family 存在 且 用户仍在 members 中，the system shall 返回 `ALREADY_IN_FAMILY`
2. When `ctx.user.familyId` 指向一个已不存在的 family（幽灵引用），the system shall 允许创建新家庭（修复 + 创建）

> **技术说明**：新增 errors.ALREADY_IN_FAMILY。

---

### FR-11：`clearBabyData` 查询附 familyId（P1）

**验收标准**：所有 phase 的 `.where({ babyId })` 改为 `.where({ babyId, familyId })`，符合全局约定。

---

### FR-12：`vaccine/milestone` 页 CRUD 加权限预检 + 补 `updatedAtTs` + 走 FamilyContext（P1）

**用户故事**：作为 viewer，我希望我的 UI 操作被客户端拦截，不依赖云端拒绝。

**验收标准**：
1. `vaccine.js` / `milestone.js` 的 add / update / delete 操作第一行：`PermissionGuard.require('record.create'|'record.edit'|'record.delete.own')`
2. add 时 familyId 使用 `FamilyContext.resolveForBaby(baby)`
3. update 时补 `updatedAt: serverDate()` + `updatedAtTs: Date.now()`

---

### FR-13：`record.batchDelete` 归属校验（P1）

**用户故事**：作为 editor，我批量删除包含他人记录时希望可删记录正常删除、不可删记录跳过并提示。

**验收标准**：
1. When editor 批量删除，the system shall 用 `PermissionGuard.checkCanDelete(record)` 过滤不可删记录
2. When 存在被跳过记录，the system shall 提示"已删除 N 条，M 条他人记录已跳过"
3. When admin 批量删除，行为无变化（全删）

---

### FR-14：`family.transferAndLeave` 检查返回值（P1）

**验收标准**：`leaveFamily` 返回 `status !== 'ok'` 且 `status !== 'dissolved'` 时不清空本地缓存，并 toast 错误。

---

### FR-15：`auth._handleInviteCodeForExistingUser` 迁 status 状态机（P1）

**验收标准**：所有 `!leaveResult.success && leaveResult.needTransfer` 改为 `leaveResult.status === 'need_transfer'`。

---

### FR-16：`app.initUser` 使用 `AuthService.getInstance()`（P1）

**验收标准**：`app.js:53` 的 `new AuthService()` 改为 `AuthService.getInstance()`，与全项目单例规范一致。

---

### FR-17：`data-model.md` 字段一致性修正（P1，文档对齐）

**验收标准**：
- operation_logs 的 `status` 枚举改为 `'started' | 'succeeded' | 'partial' | 'failed'`（对齐代码）
- rate_limits 的 `windowStart` 类型改为 `number`（数值时间戳），移除文档里的 `windowStartTs` 字段；或反向：代码加 `windowStartTs` 字段
- memberDetails[].joinedAt 类型改为 `Date | string(ISO)`（兼容现状）

> **技术说明**：选择"文档 → 对齐代码"更改动量小（已有生产数据写的是 number）。

---

### FR-18：`patrolMemberOpenids` 反向漂移巡检（P1）

**验收标准**：
1. 巡检阶段二：遍历 `users` 中 `familyId` 非空的用户，校验 `users[u].familyId` 指向的 family 的 `members` 是否包含 `u._id`
2. 不一致时写入 operation_logs（action: `patrolMemberOpenids:reverse_drift`）
3. 不自动修改用户数据（避免破坏用户视角），仅告警

---

### FR-19 ~ FR-22：P2 小问题

- FR-19：`record.js` catch 分支 offlineRecord 补齐 `createdBy` 对象
- FR-20：`auth._goToHome` 先判空再 `loadCurrentBaby`（已部分修复，确认完整性）
- FR-21：`familyOperation/index.js` action 白名单 + logger 懒构造（性能）
- FR-22：`dissolveFamily` operation_logs status 全链路可观测（已接入，确认）

---

## 非功能需求

### NFR-1：兼容性
- 所有修改必须向后兼容 v4.3.0 数据（已存在的 babies 无 `_openid` 由 admin 继续管理）
- 老调用方不读 `status` 字段也能正常工作（通过 legacy 字段）

### NFR-2：回归验证
- E2E 套件（含 m20 v4.3 模块）必须 100% 通过
- 新增至少 3 条 v4.3.1 专项 E2E 用例（P0 问题 1/2/6 覆盖）

### NFR-3：部署顺序
- 云函数部署先行（FR-1~FR-5、FR-9~FR-11、FR-17 相关）
- 客户端版本发布依赖云函数已更新到位

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| `createBaby` 失败（如权限不足）后客户端处理 | `BabyService.createBaby` throw；调用方 toast |
| `deleteBaby` 进行中被用户退出页面 | cursor 落盘到 operation_logs，下次进入自动续传（v4.3.1 不做，列入 backlog） |
| viewer 本地绕过 UI 按钮调用 RecordService | `PermissionGuard.require` 抛 `PermissionError`，toast 提示 |
| `getUserRole` 返回 viewer 但用户实际是 admin（刚加入本地未同步） | 客户端下次 `ensureUserReady` 强制刷新 familyInfo；短暂受限 5 分钟缓存周期内可接受 |
| `clearAllCloudData` 循环中断电 | 下次重进重启循环（从 cursor 恢复），客户端需持久化 cursor 到 Storage（v4.3.1 做） |

## 模块依赖关系

```
云函数侧改动：
  errors.js（新增 ALREADY_IN_FAMILY / INVALID_ROLE）
  actions/createBaby.js, deleteBaby.js, createFamily.js,
  actions/removeMember.js, updateMemberRole.js, dissolveFamily.js,
  actions/clearBabyData.js
  lib/（无变更）
  patrolMemberOpenids/index.js（新增反向漂移检查）

客户端改动：
  app.js
  utils/permission.js
  services/record.js, sync.js, baby.js
  pages/auth/auth.js
  pages/record/record.js
  packageSocial/pages/family/family.js
  packageSocial/pages/settings/settings.js
  packageGrowth/pages/vaccine/vaccine.js
  packageGrowth/pages/milestone/milestone.js

E2E 测试：
  cloudfunctions/e2eSecurityTest/modules/m21-v431Fixes.js（新增）
  cloudfunctions/e2eSecurityTest/v43-prod/（同步最新 actions）

文档：
  architecture.md（权限模型说明）
  data-model.md（operation_logs / rate_limits 字段对齐）
  service-api.md（BabyService 级联删说明）
  coding-conventions.md（默认角色约定）
  CHANGELOG.md
```

## 变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| cloudfunctions/familyOperation/errors.js | 增量 | FR-8, FR-10 |
| cloudfunctions/familyOperation/actions/createBaby.js | 小改 | FR-1, FR-2 |
| cloudfunctions/familyOperation/actions/deleteBaby.js | 大改 | FR-2, FR-3 |
| cloudfunctions/familyOperation/actions/createFamily.js | 小改 | FR-10 |
| cloudfunctions/familyOperation/actions/removeMember.js | 小改 | FR-5 |
| cloudfunctions/familyOperation/actions/updateMemberRole.js | 小改 | FR-8 |
| cloudfunctions/familyOperation/actions/dissolveFamily.js | 小改 | FR-9 |
| cloudfunctions/familyOperation/actions/clearBabyData.js | 小改 | FR-11 |
| cloudfunctions/patrolMemberOpenids/index.js | 大改 | FR-18 |
| miniprogram/app.js | 小改 | FR-16 |
| miniprogram/utils/permission.js | 小改 | FR-6 |
| miniprogram/services/record.js | 小改 | FR-7, FR-19 |
| miniprogram/services/sync.js | 小改 | FR-7 |
| miniprogram/pages/auth/auth.js | 小改 | FR-15, FR-20 |
| miniprogram/pages/record/record.js | 小改 | FR-13 |
| miniprogram/packageSocial/pages/family/family.js | 小改 | FR-14 |
| miniprogram/packageSocial/pages/settings/settings.js | 大改 | FR-4 |
| miniprogram/packageGrowth/pages/vaccine/vaccine.js | 小改 | FR-12 |
| miniprogram/packageGrowth/pages/milestone/milestone.js | 小改 | FR-12 |
| data-model.md | 小改 | FR-17 |
| cloudfunctions/e2eSecurityTest/modules/m21-v431Fixes.js | 新建 | NFR-2 |
