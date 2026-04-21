# v4.3.2 Pre-Dev Review — 逻辑与安全问题清单

> **审查时间**: 2026-04-21
> **审查范围**: 全量云函数 + 客户端 services/pages + 安全规则 + 相关文档
> **基线**: v4.3.1 已上线（本地 + origin，tag v4.3.0 / v4.3.1）
> **输出**: 本次列入 v4.3.2 backlog 的问题清单（按严重级排序）

---

## 🚨 P0 — 必须在 v4.3.2 解决

### P0-1. `families.read = auth != null` — 任意登录用户可读所有家庭

**位置**：
- 规则：`cloudfunctions/e2eSecurityTest/lib/rule-simulator.js:25`
- 文档误导：`data-model.md:226`、`architecture.md:253`、`service-api.md`
- E2E 固化误设：`modules/m01-05-securityRules.js:104-109` 的 `F-04` 用例显式断言"Dave(非成员) 读 Family-A → 允许"

**风险**：
任意持有 `familyId` 的登录用户可 `db.collection('families').doc(familyId).get()` 读到：
- `inviteCode` 明文 + `inviteCodeExpiry`（7 天内可绕过邀请流程加入任意家庭）
- `memberOpenids`（全家微信 openid，用于跨端追踪）
- `memberDetails` / `members`（所有成员昵称 + 角色 + `users._id`）
- `creatorId` / `creatorName` / 家庭名

**攻击路径**：
只要 familyId 泄露（URL 分享、日志截图、朋友圈），攻击者即可：
1. 读 `inviteCode` → 调 `familyOperation.joinFamily` 加入他人家庭 → 读他人 babies/records
2. 收集 openid 做跨端关联

**根因**：
历史注释写"doc().get() 不生效"就直接放宽为 `auth != null`，但 **`doc().get()` 规则校验时同样能访问 `doc.memberOpenids`**。这是**误解规则行为**导致的退化。

**修复方向（两选一）**：
- **Option A（推荐）**：恢复 `"read": "auth.openid in doc.memberOpenids"`，`getFamilyDetail` 客户端直连同步改走云函数 `getFamilyDetail` action（admin SDK + `isMember` 校验）
- **Option B**：保留规则，但把 `inviteCode` / `memberOpenids` 剥离到独立集合 `family_secrets`（PRIVATE）

---

### P0-2. `records.update/delete` 规则 vs admin 删他人记录 产品承诺不兼容

**位置**：
- 规则：`rule-simulator.js:40`（`doc._openid == auth.openid`）
- 权限矩阵声明：`utils/permission.js:30` `'record.delete.other': ['admin']`
- UI 允许调用：`pages/home/home.js:1210` `PermissionUtil.canDeleteRecord` 对 admin 返 true
- Service 无绕过：`services/record.js:530` 直连 `recordCollection.doc(id).remove()`

**风险**：
admin 角色尝试删他人记录：
- 客户端 `canDeleteRecord` 放行 → UI 显示"删除"按钮
- PermissionGuard `requireCanDelete` 通过
- `record.js:530` 直接 `doc().remove()` → 安全规则拒绝（`doc._openid != auth.openid`）→ -502003
- 云端报错但**本地缓存已先删**（`deleteRecordFromCache` 在 try 之前）→ 刷新后记录回来
- `vaccine_records` / `milestone_records` 同构问题（`packageGrowth/pages/vaccine/vaccine.js:509`、`milestone.js:394`）

**修复方向**：
新增 `familyOperation.deleteRecord` action，admin SDK + 业务层 `canDeleteRecord` 校验；`RecordService.deleteRecord` / `vaccine.js` / `milestone.js` 的他人删除走云函数路径。本机删自己记录可保留直连。

---

### P0-3. deleteBaby 未同步清理 `users.familyId`（当家庭只剩该 baby 时）

**位置**：`cloudfunctions/familyOperation/actions/deleteBaby.js:142-148`

**风险**：
`deleteBaby` 与 `clearBabyData` 语义差异：
- `clearBabyData`（`actions/clearBabyData.js:139-166`）：删完最后一个 baby 时**解散家庭 + 清 users.familyId**
- `deleteBaby`：只删 baby + pull family.babies，**不做任何家庭收尾**

当 admin 用 `deleteBaby` 把最后一个 baby 删完，家庭还在，但内容已空。用户体验可接受，但若产品约定"家庭必须有 baby 才有意义"，则存在空家庭堆积（E2E 中也没覆盖这个 edge case）。

**修复方向（两选一）**：
- A. `deleteBaby` 追加与 `clearBabyData` 一致的 post-condition（`remaining === 0 → dissolve`）
- B. 产品明确"删光最后一个 baby 后允许空家庭保留"，在 UI 中加提示并记入 docs

---

## 🟠 P1 — 强烈建议在 v4.3.2 处理

### P1-1. `PermissionGuard.require('record.delete.own')` 语义不严格

**位置**：`miniprogram/services/record.js:513`

**问题**：
```js
PermissionGuard.require('record.delete.own');  // 只看角色 editor/admin
```
但 `record.delete.own` 含义是"删自己创建的记录"—— editor 应该只能删自己的。当前预检**只校验角色**，没校验 record 归属，editor 直接调 `deleteRecord(otherUserRecordId)` 时：
- 客户端预检通过（editor 拥有 `record.delete.own`）
- 客户端缓存已删
- 云端规则拒（`doc._openid != editor.openid`）
- 数据不一致

**修复方向**：
`deleteRecord` 改为 `requireCanDelete(record)` 必须先 lookup record 再判断归属；调用方（home.js / record.js）已有这层，但 service 应该做冗余校验。

---

### P1-2. `baby-list` / `auth` / `baby-create` 等页面仍存在 `creatorId: userInfo._id` 不写 `_openid` 的直连写法

**位置**：
- `miniprogram/pages/baby-create/baby-create.js:81-85`
- `miniprogram/pages/auth/auth.js:392-396`
- `miniprogram/packageSocial/pages/family-create/family-create.js:56-60`

**问题**：
这三处直接调 `familyService.createFamily({ name, creatorId, creatorName })`，在 v4.2 后 `createFamily` 已全量走云函数（`creatorId` 由云函数从 `getWXContext().OPENID → users._id` 派生，**入参被忽略**）。当前不是 bug，但**传参具有误导性**，读者会误以为 `creatorId` 可由客户端指定。

**修复方向**：
清理三处调用方的冗余入参；`FamilyService.createFamily` 文档注释明确"仅 `name` 参数生效"。

---

### P1-3. baby-list / auth / record / export / growth / report-popup 等 6 处页面裸 `db.collection(...).where({ familyId, babyId })` 直连

**位置汇总**（subagent 扫描结果）：
```
pages/baby-list/baby-list.js:58        db.collection('babies').where({ familyId })
pages/auth/auth.js:210                 db.collection('babies').where({ familyId })
pages/record/record.js:497             db.collection('records').where(baseWhere).count()
packageGrowth/pages/growth/growth.js:187  db.collection('records').where(...)
packageGrowth/pages/vaccine/vaccine.js:320/443/455/509  .add/.update/.remove
packageGrowth/pages/milestone/milestone.js:394/433  .add/.remove
packageSocial/pages/export/export.js:64/141  db.collection('records').where(...)
components/report-popup/report-popup.js:372/380/386  .where()
services/todo.js:144/205               .where(...)
services/sync.js:289/301/312           离线队列执行
```

**问题**：
- 读：依赖规则"通过 familyId 交叉校验 memberOpenids"，当 memberOpenids 污染/缺失（P0-1 之外的场景）时一样被拒。
- 写（vaccine/milestone）：`.add()` 时未显式写 `_openid`，系统自动注入 = 当前 openid；但一旦规则改为更严（例如 CUSTOM create 规则要求字段白名单），这批直连会脆。

**修复方向**：
不是紧急，v4.3.2 可以**只加一层 fallback**：读直连失败时降级到对应云函数 action。长期方向是**所有写操作都走云函数网关**。暂不强制。

---

### P1-4. `rate_limits` 只限流 `joinFamily`，其它高危 action（`refreshInviteCode` / `createFamily` / `transferAdmin` / `updateMemberRole`）无限流

**位置**：
- 使用：`actions/joinFamily.js:13-18`
- 未使用：`actions/refreshInviteCode.js` / `createFamily.js` / `transferAdmin.js` / `updateMemberRole.js`

**风险**：
- `refreshInviteCode` 被滥用可导致家庭邀请码频繁失效（DoS 家庭）
- `createFamily` 可无限创建僵尸家庭

**修复方向**：
统一在 `index.js` 的 `ctx` 注入后，对白名单 action 自动 `rateLimiter.check(action + '_' + openid)`。

---

### P1-5. 离线队列 `sync.js` 不走 PermissionGuard

**位置**：`miniprogram/services/sync.js:278-318`

**问题**：
离线时创建的记录进入队列，网络恢复后 `executeOperation` 直接 `db.collection(collection).add({ data })` / update / delete，**没做任何权限预检**。场景：
- 用户创建 record 时是 editor；离线期间被 admin 改为 viewer；网络恢复队列同步 → viewer 的记录被同步上去（安全规则允许 create，但业务上不应该）

**影响有限**（create 本身安全规则允许 `auth != null`），但若 P0-2 改后 editor 删他人记录走云函数，该路径也需要类似保护。

---

### P1-6. 双时间戳 `updatedAtTs` 部分写入遗漏

**位置**：
- `vaccine_records` / `milestone_records` 直连 `.add()` / `.update()` 已补（v4.3.1 FR-12）
- 但 `users` 集合的 `AuthService.updateUserInfo:78` **只写 updatedAt 不写 updatedAtTs**

**风险**：
小，但与 "双时间戳全集合一致" 约定（`coding-conventions.md`）违背；将来按 `updatedAtTs` 排序会漏掉 users 数据。

---

## 🟡 P2 — 可按时间节奏处理（原 backlog）

### P2-1. `clearBabyData` cursor 仅存 localStorage，跨设备/清缓存会丢
（原 v4.3.2 backlog 第 1 项）

### P2-2. `patrolMemberOpenids` 阶段 2 反向漂移只告警不修复
（原 v4.3.2 backlog 第 2 项）

### P2-3. 文档 vs 实际规则偏离
- `data-model.md:226` 写 `auth.openid in doc.memberOpenids`，实际是 `auth != null`（与 P0-1 同源）
- 修 P0-1 后文档自动对齐

### P2-4. `operation_logs` / `rate_limits` 无 TTL 自动清理
数据体积长期增长，需接 CloudBase TTL 索引（`expireAt` 字段已有）

### P2-5. `AuthService.deleteUser` 未级联清理
`users.doc(id).remove()` 不会触发 family.memberOpenids / memberDetails 的清理，会产生幽灵引用（虽然 patrol 阶段 2 告警能发现）

---

## 🎯 v4.3.2 建议的 Scope

### Must-Have（P0 + 核心 P1）
- [ ] **FR-1**：`families.read` 收紧为 `memberOpenids` + `getFamilyDetail` 云函数化
- [ ] **FR-2**：`familyOperation.deleteRecord` / `updateRecord` 云函数化（解决 admin 删他人）
- [ ] **FR-3**：`deleteBaby` 追加"最后一个 baby 删光后解散家庭"的 post-condition
- [ ] **FR-4**：`RecordService.deleteRecord` 改用 `requireCanDelete(record)` 而非仅 `require('record.delete.own')`

### Should-Have（P1）
- [ ] **FR-5**：清理 3 处 `createFamily` 调用的冗余 `creatorId/creatorName` 入参
- [ ] **FR-6**：关键 action 统一接入 rate limiter（`refreshInviteCode` / `createFamily` / `updateMemberRole`）
- [ ] **FR-7**：`AuthService.updateUserInfo` 补 `updatedAtTs`
- [ ] **FR-8**：文档同步（`data-model.md` / `architecture.md` 规则描述 + 客户端查询模式）

### Nice-to-Have（P2，原 backlog）
- [ ] **FR-9**：`clearBabyData` cursor 云端续传（`operation_logs` 里已有 cursor，改为按 action + userId + babyId 复原）
- [ ] **FR-10**：`patrolMemberOpenids` 反向漂移自动修复（dryRun / 人工确认模式可选）
- [ ] **FR-11**：`operation_logs` / `rate_limits` TTL 索引 + 定时清理
- [ ] **FR-12**：`AuthService.deleteUser` 级联清理

---

## ⚠️ 破坏性变更风险提示

| 变更 | 影响面 | 破坏性 |
|------|--------|--------|
| `families.read` 收紧 | `getFamilyDetail` 全站读路径 —— `app.js` 启动 / home / record / family 管理 | 中（需逐一切换到云函数） |
| `deleteRecord` 云函数化 | RecordService + home/record 页 + 离线队列 sync | 中 |
| `updateRecord` 云函数化 | RecordService + 离线队列 sync（高频操作） | 高（性能 +1 RTT） |

建议 **FR-1/FR-2 分两次迭代上线**，避免一次性变动过大。
