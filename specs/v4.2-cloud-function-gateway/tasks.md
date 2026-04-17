# 实施计划 - 云函数网关 & 安全规则治理（Cloud Function Gateway & Security Rule Governance）

> 版本：v1.0 | 日期：2026-04-17 | 状态：待开发
> 关联需求：requirements.md v1.2 | 关联设计：design.md v1.1

## 实施概览

预计总工时：约 11h
关键里程碑：
- M1（6h）：云函数开发 + 数据迁移脚本
- M2（0.5h）：执行数据迁移（⚠️ 阻塞点）
- M3（3.5h）：客户端改造 + 安全规则配置
- M4（1h）：集成测试

---

## Phase 1：云函数开发 + 数据迁移脚本（M1）

### T-1.1 云函数基础框架（FR-1）
- **目录**: `cloudfunctions/familyOperation/`
- **新增文件**:
  - `index.js`：入口 + 13 action switch 分发 + 工具函数（`getFamily`/`isAdmin`/`clearUserFamily`/`familyNotFound`/`permissionDenied`/`generateInviteCode`）
  - `package.json`：`wx-server-sdk: ~2.6.3`
  - `config.json`：`timeout: 20`
- **验收**:
  - `cloud.getWXContext().OPENID` 获取调用者身份
  - 通过 OPENID 查找 `users` 获取 userId
  - 返回标准格式 `{ success, data/error }`
  - 未知 action 返回 `INVALID_ACTION`
- **工时**: 0.5h
- **依赖**: 无
- _涉及：FR-1_

---

### T-1.2 `joinFamily` action（FR-2）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `joinFamily()` 函数，从 `family.js` L81-152 平移逻辑
- **关键逻辑**:
  - 邀请码查询 + 过期检查
  - 已是成员检查
  - 幽灵成员防护（检查旧家庭 + 唯一管理员拒绝 + 旧家庭 pull + 清除旧 familyId）
  - push members/memberDetails/**memberOpenids**
  - 更新 users.familyId/familyRole
  - 限流：60s 内最多 5 次（内存 Map）
- **验收**: 邀请码加入成功，旧家庭自动退出，memberOpenids 同步维护
- **工时**: 1h
- **依赖**: T-1.1
- _涉及：FR-2, FR-11_

---

### T-1.3 `removeMember` action（FR-3）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `removeMember()` 函数，从 `family.js` L279-326 平移
- **关键逻辑**:
  - admin 权限校验
  - 禁止移除自己 / 禁止移除其他 admin
  - 查询目标用户 `_openid`
  - pull members/memberDetails/**memberOpenids**
  - **可靠地**清除被移除用户的 familyId/familyRole（admin SDK）
- **验收**: 被移除用户的 `users.familyId` 被可靠清除（不再是 try-catch 静默失败）
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-3, FR-11_

---

### T-1.4 `dissolveFamily` action（FR-4）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `dissolveFamily()` 函数，从 `family.js` L333-366 平移
- **关键逻辑**:
  - creatorId 校验
  - 删除家庭文档
  - 批量清除所有成员 familyId/familyRole（单个失败不阻断）
- **验收**: 所有成员的 familyId 被批量清除，返回 membersCleared/membersFailed 统计
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-4_

---

### T-1.5 `updateMemberRole` action（FR-5）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `updateMemberRole()` 函数，从 `family.js` L375-428 平移
- **关键逻辑**:
  - creatorId 校验
  - 构建新 memberDetails 数组
  - 乐观锁重试（`stats.updated === 0` 时最多重试 2 次）
  - 同步 users.familyRole
- **验收**: 权限变更后 `families.memberDetails` 和 `users.familyRole` 一致
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-5_

---

### T-1.6 `transferAdmin` action（FR-6）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `transferAdmin()` 函数，从 `family.js` L518-569 平移
- **关键逻辑**:
  - admin 校验 + 目标用户是成员校验
  - 更新 memberDetails 双方 role + creatorId
  - 同步双方 users.familyRole
- **验收**: 转让后双方角色正确，creatorId 更新
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-6_

---

### T-1.7 `leaveFamily` action（FR-7）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `leaveFamily()` 函数，从 `family.js` L436-509 平移
- **关键逻辑**:
  - 家庭不存在 → 返回 familyNotFound
  - 不是成员 → 返回 notMember
  - 唯一 admin + 有其他成员 → 返回 needTransfer + otherMembers
  - 唯一 admin + 无其他成员 → 删除家庭 + 清除自己信息
  - 正常退出 → pull members/memberDetails/**memberOpenids** + 清除自己信息
- **验收**: 5 种分支逻辑全部正确处理
- **工时**: 0.5h
- **依赖**: T-1.1
- _涉及：FR-7, FR-11_

---

### T-1.8 `createFamily` action（FR-11）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `createFamily()` 函数
- **关键逻辑**:
  - 构建 familyData：name, creatorId, creatorName, members, memberDetails, **memberOpenids: [openid]**, inviteCode, inviteCodeExpiry
  - `families.add()`
  - 返回 `{ _id, ...familyData }`
- **验收**: 新创建的家庭文档包含 `memberOpenids` 字段
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-11_

---

### T-1.9 `refreshInviteCode` action（FR-8 补充）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `refreshInviteCode()` 函数
- **关键逻辑**:
  - admin 校验
  - 生成新邀请码 + 7 天过期
  - `families.doc().update()`
- **验收**: 管理员可刷新邀请码，非管理员被拒绝
- **工时**: 0.1h
- **依赖**: T-1.1
- _涉及：FR-8_

---

### T-1.10 `validateInviteCode` + `getFamilyByUserId` actions（FR-12）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 2 个函数
- **关键逻辑**:
  - `validateInviteCode`：`where({ inviteCode })` + 过期检查，返回 `{ valid, familyId, familyName, memberCount }`
  - `getFamilyByUserId`：`where({ members: userId })`，返回家庭信息或 null
- **验收**: 非成员可通过云函数查询邀请码有效性；getFamilyByUserId 正确返回
- **工时**: 0.25h
- **依赖**: T-1.1
- _涉及：FR-12_

---

### T-1.11 `createBaby` + `deleteBaby` actions（FR-13）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 2 个函数
- **关键逻辑**:
  - `createBaby`：成员校验 → `babies.add()` → `families.doc().update({ babies: push(babyId) })`
  - `deleteBaby`：成员校验 → `families.doc().update({ babies: pull(babyId) })` → `babies.doc().remove()`
- **验收**: 创建/删除宝宝后 families.babies 数组同步更新
- **工时**: 0.5h
- **依赖**: T-1.1
- _涉及：FR-13_

---

### T-1.12 `clearBabyData` action（FR-14）
- **文件**: `cloudfunctions/familyOperation/index.js`
- **变更**: 新增 `clearBabyData()` 函数 + `getAllDocs()` 辅助函数
- **关键逻辑**:
  - admin 校验
  - 批量删除 records/vaccine_records/milestone_records（`where({ babyId })`，包括其他成员创建的）
  - 删除 babies 文档 + families.babies pull
  - 检查是否还有宝宝，无则解散家庭 + 清除所有成员 familyId
- **验收**: admin 可彻底清除该宝宝所有数据（包括其他成员创建的记录）
- **工时**: 0.5h
- **依赖**: T-1.1
- _涉及：FR-14_

---

### T-1.13 存量迁移脚本 `migrateFamilyOpenids`（FR-11）
- **目录**: `cloudfunctions/migrateFamilyOpenids/`
- **新增文件**: `index.js` + `package.json` + `config.json`（timeout: 60）
- **逻辑**: 遍历 families → 查 members 对应的 `users._openid` → 写入 `memberOpenids` + `_openidsMigratedAt`
- **验收**: 所有 families 文档有 memberOpenids 字段，幂等可重复执行
- **工时**: 0.5h
- **依赖**: 无
- _涉及：FR-11_

---

### T-1.14 存量迁移脚本 `migrateRecordFamilyId`（FR-10）
- **目录**: `cloudfunctions/migrateRecordFamilyId/`
- **新增文件**: `index.js` + `package.json` + `config.json`（timeout: 60）
- **逻辑**: 构建 `babyId → familyId` 映射 → 分批扫描 records → 写入 `familyId` + `_familyIdMigratedAt`
- **验收**: 所有 records 文档有 familyId 字段，幂等可重复执行
- **工时**: 0.5h
- **依赖**: 无
- _涉及：FR-10_

---

## Phase 2：执行数据迁移（M2）

### T-2.1 部署并执行 `migrateFamilyOpenids`
- **操作**: 微信开发者工具上传云函数 → 触发执行 → 验证结果
- **验证**: 检查所有 families 文档均有 `memberOpenids` 字段且数量与 `members` 一致
- **工时**: 0.15h
- **依赖**: T-1.13
- _涉及：FR-11_

---

### T-2.2 部署并执行 `migrateRecordFamilyId`
- **操作**: 微信开发者工具上传云函数 → 触发执行 → 验证结果
- **验证**: 检查所有 records 文档均有 `familyId` 字段
- **工时**: 0.15h
- **依赖**: T-1.14
- _涉及：FR-10_

---

### T-2.3 ⚠️ 迁移完成确认（阻塞点）
- **操作**: 确认 T-2.1 和 T-2.2 全部成功后，方可进入 Phase 3
- **风险**: 如果有文档未迁移成功，安全规则配置后这些文档将无法被读取
- **回退方案**: 重新执行迁移脚本（幂等设计）
- **工时**: 0.1h
- **依赖**: T-2.1, T-2.2

---

## Phase 3：客户端改造 + 安全规则（M3）

### T-3.1 `family.js` 10 个方法改为 callFunction（FR-8, FR-12）
- **文件**: `miniprogram/services/family.js`
- **变更**:
  - `createFamily()` → callFunction action `createFamily`
  - `joinByInviteCode()` → callFunction action `joinFamily`
  - `removeMember()` → callFunction action `removeMember`
  - `dissolveFamily()` → callFunction action `dissolveFamily`
  - `updateMemberRole()` → callFunction action `updateMemberRole`
  - `transferAdmin()` → callFunction action `transferAdmin`
  - `leaveFamily()` → callFunction action `leaveFamily`
  - `refreshInviteCode()` → callFunction action `refreshInviteCode`
  - `validateInviteCode()` → callFunction action `validateInviteCode`
  - `getFamilyByUserId()` → callFunction action `getFamilyByUserId`
- **保留不改**: `getFamilyDetail()`、`getFamilyMembers()`、`checkMembership()`
- **模式**: 适配器模式——方法签名不变，内部实现替换。错误码映射到 `throw new Error()`
- **验收**: 调用方（auth.js、family 页面、settings 页面）无需修改，功能不变
- **工时**: 1h
- **依赖**: T-1.2~T-1.10, T-2.3
- _涉及：FR-8, FR-12_

---

### T-3.2 `baby.js` 2 个方法改为 callFunction（FR-13）
- **文件**: `miniprogram/services/baby.js`
- **变更**:
  - `createBaby(familyId, name, gender, birthDate, avatar)` → callFunction action `createBaby`
  - `deleteBaby(babyId, familyId)` → callFunction action `deleteBaby`
- **保留不改**: `getBabiesByFamilyId()`、`getBabyById()`、`updateBaby()`、`uploadAvatar()`
- **验收**: baby-create.js、baby-list.js 调用不受影响
- **工时**: 0.25h
- **依赖**: T-1.11, T-2.3
- _涉及：FR-13_

---

### T-3.3 `baby-list.js` deleteBaby 修复（FR-13）
- **文件**: `miniprogram/pages/baby-list/baby-list.js`
- **变更**: 第 151-152 行 `db.collection('babies').doc(id).remove()` 改为 `babyService.deleteBaby(id, familyInfo._id)`
- **验收**: 删除宝宝后 families.babies 同步 pull，不产生脏数据
- **工时**: 0.1h
- **依赖**: T-3.2
- _涉及：FR-13_

---

### T-3.4 `settings.js` clearAllCloudData 改为云函数（FR-14）
- **文件**: `miniprogram/packageSocial/pages/settings/settings.js`
- **变更**: `clearAllCloudData()` 方法内部替换为 callFunction action `clearBabyData`
- **保留**: 二次确认弹窗、loading 态、清除本地缓存、跳转逻辑
- **验收**: admin 可彻底清除宝宝所有数据（包括其他成员记录），家庭无宝宝时自动解散
- **工时**: 0.25h
- **依赖**: T-1.12, T-2.3
- _涉及：FR-14_

---

### T-3.5 `family.js` 页面层直接 DB 操作修正（FR-15）
- **文件**: `miniprogram/packageSocial/pages/family/family.js`
- **变更**:
  - 第 136-157 行（自动生成邀请码）：`db.collection('families').doc().update()` 改为 `this.familyService.refreshInviteCode()`
  - 第 249-296 行（手动重新生成邀请码 `regenerateCode()`）：同上改为 `this.familyService.refreshInviteCode()`
  - 删除第 302-309 行 `generateInviteCode()` 方法（云函数内生成）
- **验收**: 邀请码自动/手动生成均通过云函数执行，不再直接操作 families 集合
- **工时**: 0.25h
- **依赖**: T-3.1（refreshInviteCode 已走云函数）
- _涉及：FR-15_

---

### T-3.6 `record.js` createRecord 新增 familyId + getRecords 附加 familyId（FR-10）
- **文件**: `miniprogram/services/record.js`
- **变更**:
  - `createRecord()`：cloudRecord 对象新增 `familyId: userInfo?.familyId || ''`（在线路径）
  - `createRecord()`：离线降级路径同样增加 `familyId`
  - `getRecords()`：where 条件附加 `familyId`（从 `StorageUtil.getUserInfo().familyId` 获取）
  - `getTodayStats()`：内部查询同样附加 `familyId`（如使用 where 查询的话）
- **验收**: 新记录包含 familyId，查询正确附加 familyId
- **工时**: 0.25h
- **依赖**: T-2.3
- _涉及：FR-10_

---

### T-3.7 12 处 where 查询附加 familyId（FR-10）
- **变更模式**: 每处 `where({ babyId })` → `where({ babyId, familyId: userInfo.familyId })`
- **改造清单**:

| # | 文件 | 方法/位置 | 集合 |
|---|------|----------|------|
| 1 | `record.js`（page） | `calculateFilterCounts()` L494 | records |
| 2 | `growth.js` | `loadGrowthRecords()` L185 | records |
| 3 | `report-popup.js` | records 查询 L368 | records |
| 4 | `report-popup.js` | vaccine_records 查询 L376 | vaccine_records |
| 5 | `report-popup.js` | milestone_records 查询 L382 | milestone_records |
| 6 | `todo.js` | `_computeVaccineStats()` L140 | vaccine_records |
| 7 | `todo.js` | `_computeMilestoneStats()` L200 | milestone_records |
| 8 | `vaccine.js` | `loadVaccineList()` L121 | vaccine_records |
| 9 | `milestone.js` | `loadMilestones()` L113 | milestone_records |
| 10 | `export.js` | 查询 L62 + L137 | records |
| 11 | `settings.js` | `_getAllDocuments` records L218 | records |
| 12 | `settings.js` | `_getAllDocuments` vaccine/milestone L223+L228 | vaccine/milestone |

- **familyId 获取**: 每处从 `StorageUtil.getUserInfo().familyId` 或页面已有的 `familyId` 变量获取
- **验收**: 所有查询在安全规则 `get()` 校验下能正常返回结果
- **工时**: 0.75h
- **依赖**: T-2.3
- _涉及：FR-10_

---

### T-3.8 安全规则配置（FR-9）
- **操作**: 通过 CloudBase 控制台或 MCP 工具 `writeSecurityRule` 配置 6 个集合

| 集合 | aclTag | rule |
|------|--------|------|
| `users` | `PRIVATE` | — |
| `families` | `CUSTOM` | `{"read":"auth.openid in doc.memberOpenids","create":"auth != null","update":false,"delete":false}` |
| `babies` | `CUSTOM` | `{"read":"auth.openid in get('database.families.' + doc.familyId).memberOpenids","create":"auth != null","update":"doc._openid == auth.openid","delete":false}` |
| `records` | `CUSTOM` | `{"read":"auth.openid in get('database.families.' + doc.familyId).memberOpenids","create":"auth != null","update":"doc._openid == auth.openid","delete":"doc._openid == auth.openid"}` |
| `vaccine_records` | `CUSTOM` | 同 `records` |
| `milestone_records` | `CUSTOM` | 同 `records` |

- **⚠️ 前置条件**: T-2.3 迁移确认完成 + T-3.1~T-3.7 客户端改造完成
- **⚠️ 配置后等待 2-5 分钟缓存生效**
- **验收**: 配置完成后验证成员读取正常，非成员读取被拒绝
- **工时**: 0.25h
- **依赖**: T-2.3, T-3.1~T-3.7
- _涉及：FR-9_

---

## Phase 4：集成测试（M4）

### T-4.1 云函数操作完整流程验证
- **测试场景**:

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | 创建家庭 | 返回家庭信息，families 包含 memberOpenids |
| 2 | 邀请码加入家庭 | 返回成功，members/memberOpenids 同步更新 |
| 3 | 旧家庭自动退出 | 加入新家庭前自动从旧家庭 pull |
| 4 | 唯一管理员加入其他家庭 | 返回 SOLE_ADMIN 错误 |
| 5 | 管理员移除成员 | 被移除用户 familyId 被可靠清除 |
| 6 | 非管理员移除成员 | 返回 PERMISSION_DENIED |
| 7 | 创建者解散家庭 | 所有成员 familyId 被批量清除 |
| 8 | 修改成员权限 | memberDetails + users.familyRole 同步 |
| 9 | 转让管理员 | 双方角色互换，creatorId 更新 |
| 10 | 唯一管理员退出 | 返回 needTransfer + otherMembers |
| 11 | 最后成员退出 | 家庭自动解散 |
| 12 | 刷新邀请码 | 新邀请码生成，旧码失效 |
| 13 | 创建宝宝 | babies 文档 + families.babies push |
| 14 | 删除宝宝 | babies 移除 + families.babies pull |
| 15 | 清除宝宝数据（admin） | 所有 records/vaccine/milestone 删除 |

- **工时**: 0.5h
- **依赖**: T-3.8
- _涉及：全部 FR_

---

### T-4.2 安全规则读写验证
- **测试场景**:

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | 家庭成员查询 `records.where({ babyId, familyId })` | 返回该 baby 的所有记录（包括其他成员创建的） |
| 2 | 家庭成员查询 `babies.where({ familyId })` | 返回该家庭所有宝宝 |
| 3 | 家庭成员 `families.doc(familyId).get()` | 返回家庭详情 |
| 4 | **非家庭成员** `records.where({ babyId, familyId })` | PERMISSION_DENIED |
| 5 | **非家庭成员** `families.doc(familyId).get()` | PERMISSION_DENIED |
| 6 | 创建者 `babies.doc(babyId).update()` | 成功 |
| 7 | 非创建者 `babies.doc(babyId).update()` | PERMISSION_DENIED |
| 8 | 创建者 `records.doc(recordId).remove()` | 成功 |
| 9 | 非创建者 `records.doc(recordId).remove()` | PERMISSION_DENIED |
| 10 | 查询缺少 familyId 条件的 records | PERMISSION_DENIED |

- **工时**: 0.3h
- **依赖**: T-3.8
- _涉及：FR-9, FR-10_

---

### T-4.3 回归测试
- **测试场景**:

| # | 页面/功能 | 验证点 |
|---|----------|--------|
| 1 | 首页 (`home.js`) | 正常加载今日统计、时间线、宝宝切换 |
| 2 | 记录页 (`record.js`) | 查看/添加/编辑/删除记录 |
| 3 | 成长曲线 (`growth.js`) | 加载生长记录数据 |
| 4 | 疫苗页 (`vaccine.js`) | 加载疫苗接种记录 |
| 5 | 里程碑页 (`milestone.js`) | 加载里程碑记录 |
| 6 | 家庭管理页 (`family.js`) | 成员列表、邀请码生成/复制 |
| 7 | 创建宝宝 (`baby-create.js`) | 创建宝宝 + 自动创建家庭 |
| 8 | 宝宝列表 (`baby-list.js`) | 查看/切换/删除宝宝 |
| 9 | 设置页 (`settings.js`) | 清除云端数据功能 |
| 10 | 分享进入 | ensureUserReady 拦截非成员 |
| 11 | 离线创建记录 | 离线记录包含 familyId，上线同步后可被读取 |

- **工时**: 0.2h
- **依赖**: T-4.1, T-4.2
- _涉及：所有 FR_

---

## 任务依赖关系

```
T-1.1 (基础框架) ─────┬── T-1.2 (joinFamily)
                       ├── T-1.3 (removeMember)
                       ├── T-1.4 (dissolveFamily)
                       ├── T-1.5 (updateMemberRole)
                       ├── T-1.6 (transferAdmin)
                       ├── T-1.7 (leaveFamily)
                       ├── T-1.8 (createFamily)
                       ├── T-1.9 (refreshInviteCode)
                       ├── T-1.10 (validate/getFamily)
                       ├── T-1.11 (createBaby/deleteBaby)
                       └── T-1.12 (clearBabyData)

T-1.13 (migrateFamilyOpenids) ──→ T-2.1 (执行迁移)
T-1.14 (migrateRecordFamilyId) ─→ T-2.2 (执行迁移)

T-2.1 + T-2.2 ──→ T-2.3 (⚠️ 迁移确认阻塞点)
                        │
                        ▼
              ┌─── T-3.1 (family.js 10方法)
              ├─── T-3.2 (baby.js 2方法) ──→ T-3.3 (baby-list 修复)
              ├─── T-3.4 (settings clearBabyData)
              ├─── T-3.5 (family页面修正) ← 依赖 T-3.1
              ├─── T-3.6 (record.js familyId)
              └─── T-3.7 (12处 where 附加 familyId)
                        │
                        ▼
                   T-3.8 (安全规则配置)
                        │
                        ▼
              T-4.1 (云函数验证) + T-4.2 (安全规则验证) + T-4.3 (回归测试)
```

---

## 风险检查表

| # | 风险 | 概率 | 影响 | 缓解措施 | 关联任务 |
|---|------|:---:|:---:|---------|---------|
| 1 | 存量迁移不完整导致数据"消失" | 高 | 高 | 迁移脚本幂等设计；T-2.3 严格验证后才配安全规则 | T-2.1~T-2.3 |
| 2 | 安全规则缓存未生效就开始测试 | 中 | 低 | 配置后等待 5 分钟再测试 | T-3.8 |
| 3 | 客户端查询遗漏 familyId | 中 | 高 | T-3.7 清单已列 12 处，安全规则配置后遗漏会立即报错 | T-3.7 |
| 4 | 云函数冷启动延迟 | 中 | 低 | 操作已有 loading 态，用户可接受 | T-1.x |
| 5 | `get()` 函数增加计费 | 中 | 低 | 客户端有缓存兜底，读频率可控 | T-3.8 |
| 6 | `createFamily` 返回值与客户端不兼容 | 低 | 中 | T-3.1 适配器层解包 `result.data`；已确认字段匹配 | T-3.1 |
| 7 | vaccine/milestone 只能删自己创建的记录 | — | 低 | 已知限制，安全规则 `"delete": "doc._openid == auth.openid"` | — |

---

## 预计总工时

| Phase | 工时 | 累计 |
|-------|:---:|:---:|
| Phase 1：云函数开发 + 迁移脚本 | 5.1h | 5.1h |
| Phase 2：执行数据迁移 | 0.4h | 5.5h |
| Phase 3：客户端改造 + 安全规则 | 3.1h | 8.6h |
| Phase 4：集成测试 | 1h | 9.6h |
| **缓冲时间（15%）** | 1.4h | **11h** |

---

*文档维护：本文档随开发进展同步更新，任务完成后勾选 checkbox。*
