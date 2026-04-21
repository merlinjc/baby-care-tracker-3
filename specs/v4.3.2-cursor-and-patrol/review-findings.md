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

---

# 附录 A：第二轮深度 Review 补充发现（2026-04-21）

> 基于全量服务层 + 全量云函数 + 全量页面/组件/工具类的三路深度扫描，以下是第一轮未覆盖的新发现。

## 🚨 P0 追加（本轮新增 7 条，生产事故级）

### P0-A-1. growth-popup 把实例方法当静态方法调用 → 首页"上次生长数据"完全不工作
- **位置**：`miniprogram/components/growth-popup/growth-popup.js:89`
- **代码**：`await RecordService.getRecords(babyId, {...})` —— `getRecords` 是**实例方法**，类上没有同名静态方法
- **根因**：FR-9 首页生长快捷入口开弹窗时，`_loadLastGrowthData` 首行就抛 `TypeError: RecordService.getRecords is not a function`；虽有 try/catch 兜底但功能静默失败（"上次数据"展示区永远空）
- **修复**：改为 `RecordService.getInstance().getRecords(...)`

### P0-A-2. 4 个弹窗组件 WXML 绑定 onTouchStart/Move/End 但 JS 未接入 swipe-close behavior
- **位置**：`feeding-popup` / `sleep-popup` / `diaper-popup` / `temperature-popup` 的 wxml + js（`baby-edit-popup` / `growth-popup` 已修）
- **根因**：v4.3.1 只修了 `baby-edit-popup` 一个样本，4 个同构漏修。用户上下滑动会触发微信"找不到事件处理函数"warning，**下滑关闭能力完全失效**（只能点遮罩/关闭按钮）
- **修复**：4 个组件各自 `require('../../behaviors/swipe-close')` 并 `behaviors: [swipeCloseBehavior]`；同步从 data 中删除 `popupTranslateY/touchStartY` 重复字段

### P0-A-3. family-join 持久化的 familyInfo 不完整，后续所有基于 familyInfo._id 的判断都会炸
- **位置**：`miniprogram/packageSocial/pages/family-join/family-join.js:64-67`
- **根因**：`familyService.joinFamily()` 返回 `{ success: true, familyId, familyName }`，随后 `StorageUtil.saveFamilyInfo(family)` 把它当作家庭详情写入 → `familyInfo._id`、`memberDetails`、`members`、`babies` **全部 undefined**
- **影响**：加入家庭后刷新页面前，`FamilyContext.resolve()` fallback 回 `userInfo.familyId` 还能工作；但任何基于 `familyInfo._id` 或 `family.members` 的调用（`PermissionUtil.getUserRole` 等）全部异常 → **默认 viewer**（v4.3.1 FR-6 最小权限原则），导致新加入用户**无法创建记录**直到下次 `app.ensureUserReady` 触发 fresh fetch
- **修复**：加入成功后应 `familyService.getFamilyDetail(data.familyId)` 再 `saveFamilyInfo`

### P0-A-4. record.js 页面 action sheet 删除单条记录未做归属校验
- **位置**：`miniprogram/pages/record/record.js:761-797`
- **根因**：`batchDelete` 已用 `PermissionGuard.checkCanDelete(rec)` 校验归属（line 1015），但点击单条记录 → action sheet "删除" 直接 `recordService.deleteRecord(selectedRecord._id)`，**完全没校验 `selectedRecord` 是否自己创建**
- **影响**：editor 能删他人记录（本地缓存已删但云端被规则拒 → 和 P0-2 同根因但路径不同）
- **修复**：`deleteRecord()` 开头加 `PermissionGuard.checkCanDelete(selectedRecord)` 校验

### P0-A-5. record.js createRecord 云端成功后本地缓存异常会产生"双写"
- **位置**：`miniprogram/services/record.js:153-351`
- **根因**：外层 try 包裹 `recordCollection.add()` + `saveToLocalCache()`；若 add 成功后 saveToLocalCache 抛错（storage 满 / JSON 异常），外层 catch 会不加区分地生成 `temp_id` 写入离线队列 → 下次 sync 再 add 一次 → **同条记录产生两份云端文档（一个真 _id、一个 sync 后的新 _id）**
- **修复**：在 `add()` 成功后独立 try/catch 包裹 `saveToLocalCache`；仅网络边界失败才走离线队列

### P0-A-6. record.js updateRecord / deleteRecord 网络抖动时重复写云端
- **位置**：`services/record.js:491-549`
- **根因**：云端 `update()` / `remove()` 已落地但响应丢包时，catch 无脑入队 → 网络恢复后重复执行
- **影响**：
  - update 重复：`updatedAt` 被覆盖为同步时刻，`mergeRecords` 按 `updatedAtTs` 误判"云端较新"，反向覆盖其他设备的正在编辑缓存
  - delete 重复：在已删除文档上再 `.remove()` → catch 再次入队 → 循环
- **修复**：catch 内识别 "请求已送达但响应丢失" 类错误码，避免二次入队；本地缓存回滚

### P0-A-7. RecordService 离线 sync 后未清理队列中残留的 update/delete 操作 → 用户最新编辑丢失
- **位置**：`services/sync.js:352-369` (`updateRecordId`)
- **根因**：离线连续 create → update → sync 时：
  1. create 成功，`tempId` 翻新为 `realId`（本地缓存）
  2. 队列里还有 `{ type: 'update', recordId: 'temp_123' }` 指向旧 tempId
  3. `db.collection('records').doc('temp_123').update()` → **INVALID_DOC_ID**，重试 3 次后丢弃
  4. **用户离线期间做的编辑全部丢失，只剩云端最初 create 的原始数据**
- **修复**：`updateRecordId` 完成后同步翻新 offline_queue 里同 `tempId` 的 update/delete

## 🚨 P0 追加（安全与原子性）

### P0-A-8. joinFamily 旧家庭 pull 成功但新家庭 push 失败 → 用户变孤儿
- **位置**：`cloudfunctions/familyOperation/actions/joinFamily.js:65-115`
- **根因**：幽灵成员防护分支执行顺序：
  1. 旧家庭 pull + users 清 familyId
  2. 新家庭 push + users 写新 familyId
  
  若第 2 步中途失败（新家庭 dissolveFamily 并发 / 网络抖动），用户：
  - 已从旧家庭 `members` 被 pull（旧家庭回不去）
  - `users.familyId` 已被 `_.remove()`
  - 新家庭 push 失败
  - **最终：用户成为无家可归的孤儿，但旧家庭已经没法回去**
- **修复**：
  - 改为"先 push 新家庭 → 再 pull 旧家庭"的顺序，保证中途失败用户至少留在旧家庭
  - 接入 `logger.start` 使 patrol 可扫 failed 状态做补偿
  - 考虑引入两阶段提交的 pending 状态字段

### P0-A-9. families.doc.get() 容错缺失导致启动静默失败（families.read 规则已放松前的旧代码）
- **位置**：`miniprogram/services/family.js:128-146` (`getFamilyDetail`)
- **现状**：已在 families.read 规则放松为 `auth != null` 后能工作，但代码里仍保留 -502003 兜底返回 null → 跟 P0-1 的规则收紧方案强耦合
- **影响**：当按 P0-1 将 `families.read` 改回 `memberOpenids` 后，**启动流程中任何 `ensureUserReady` 调用 `getFamilyDetail` 都可能返回 null**，用户被直接 kick 回 auth 页面。代码里的 null 降级本意是"网络容错"，但实际会掩盖权限错误
- **修复**：随 P0-1 整体重构，`getFamilyDetail` 走云函数 `familyOperation/getFamilyDetail` action

## 🟠 P1 追加（本轮新增 8 条）

### P1-A-1. updateMemberRole 乐观锁重试语义空转
- **位置**：`cloudfunctions/familyOperation/actions/updateMemberRole.js:70-72`
- **根因**：`result.stats.updated === 0` 对无条件 `doc().update()` 几乎永不触发（除非文档被删）；更糟的是 2 次重试后**不返回 BUSY，直接继续执行 users.update**，吞掉了"本次写入其实没落库"的事实
- **修复**：重试 2 次仍 `updated === 0` 应 `return errors.BUSY()`；或真正走乐观并发（`where({_id, updatedAtTs: lastTs})`）

### P1-A-2. transferAdmin 未使用 isMember 交叉校验 newAdminId
- **位置**：`cloudfunctions/familyOperation/actions/transferAdmin.js:20`
- **根因**：仅 `memberDetails.find` 判断，若 memberDetails 与 members 不一致（历史漂移），新 admin 可能是 memberDetails 存在但 members 中没有的"幽灵"
- **修复**：追加 `if (!isMember(newAdminId, family)) return errors.NOT_MEMBER();`

### P1-A-3. refreshInviteCode 并发覆盖 + 无 rate limit + 无冲突检测
- **位置**：`actions/refreshInviteCode.js`
- **问题**：
  - 两个 admin 并发刷新，后者覆盖前者生成的 inviteCode（前者分享链接失效无通知）
  - 新 inviteCode 未做唯一性检查（32^6 虽 10 亿级，理论上会冲突）
  - 无限流 → DoS 家庭邀请功能
- **修复**：生成前 `where({inviteCode}).count()` 冲突检测 + 接入 `rateLimiter.check('refresh_invite_' + openid)`

### P1-A-4. transferAdmin / refreshInviteCode / createFamily / joinFamily / leaveFamily 未接入 logger.start
- **位置**：这 5 个 action 失败后**没有 operation_logs 可追溯**
- **根因**：多个 update/remove 操作失败时，patrol 找不到 `status=failed` 的日志可补偿
- **修复**：统一在多步操作 action 首行 `logger.start()`

### P1-A-5. RecordService.getTodayStats 15s 缓存在登出后不清除 → 可能泄漏他人数据
- **位置**：`services/record.js:25, 564-568`；`pages/profile/profile.js:324` 的 `StorageUtil.clear()`
- **根因**：`logout` 时 `StorageUtil.clear()` 清本地，但**单例 `RecordService._todayStatsCache` 是内存状态**，未清。若用户登出后同设备用新账号登录（小程序重启前），15s 内访问首页可能拿到**前一个用户的今日统计数据**
- **修复**：`logout` 时同步 `RecordService.getInstance()._todayStatsCache = null` + `TodoService.clearCache()` + `TrendService._cache / _periodCache = null`

### P1-A-6. 4 处 `new RecordService()` / `new FamilyService()` / `new BabyService()` 破坏单例模式
- **位置**：
  - `home.js:376` `const recordService = new RecordService()`
  - `home.js:498` `this._recordService` 初始化正确，但 `loadData` 每次 `new RecordService()`
  - `feeding-popup/sleep-popup/diaper-popup/temperature-popup` 提交时 `new RecordService()`
  - `baby-detail.js` 多处 `new BabyService()`
- **影响**：单例模式靠闭包保证多次 `new` 返回同一实例（constructor 里 `if (instance) return instance`），技术上能工作，但**绕过了 `getInstance()` 的初始化保护**，且代码风格不一致违背 v4.3.0 FR-2 单例统一约定
- **修复**：全量替换为 `XxxService.getInstance()`

### P1-A-7. patrolMemberOpenids 阶段 1 expectedOpenids 的集合比较没考虑重复
- **位置**：`cloudfunctions/patrolMemberOpenids/index.js:87-89`
- **根因**：`expectedOpenids.length === current.length && expectedOpenids.every(o => current.includes(o))` —— 若 memberOpenids 中有重复 openid（旧数据 bug），会被误判为一致不修复
- **修复**：用 Set 比较 `new Set(expectedOpenids).size === new Set(current).size && ...`

### P1-A-8. data-model.md `families.inviteCodeExpiry` 类型与代码不一致
- **位置**：`data-model.md:58` 写 `string(ISO)`，但云函数 `createFamily.js:31` 写入的是 `new Date()` 对象
- **影响**：文档虚假承诺，将来迭代误以为是字符串会写成 `toISOString()`，破坏存量 Date 比较

## 🟠 P1 追加（测试覆盖盲区）

### P1-A-9. e2e m21 v431Fixes 未使用 openid 与真实 auth 绑定
- **位置**：`cloudfunctions/e2eSecurityTest/modules/m21-v431Fixes.js:40-48` (`buildCtx`)
- **根因**：`buildCtx` 手工构造 `user._id/openid`，但真实云函数入口是 `getUserFromOpenid(openid)` → 所以测试**没覆盖入口层 openid 为空、openid 查不到用户的防御分支**；GE-04 在 m17 覆盖了，但 m21 没覆盖 v4.3.1 新 action（`getBabyById`/`updateBaby`）的这条路径

### P1-A-10. e2e rule-simulator 与真实规则偏离（families.read）
- **位置**：`rule-simulator.js:25` 写死 `'auth != null'`；但 P0-1 说明真实规则应是 `memberOpenids contains auth.openid`
- **影响**：E2E 通过率 100% 但生产规则实际已经退化（两个独立错误在测试中互相遮蔽）

## 🟡 P2 追加（本轮新增 5 条）

### P2-A-1. deleteBaby phase 4 失败时 logger 不明确
- **位置**：`actions/deleteBaby.js:127-140`
- 问题：`remove_baby` 或 `pull_family_baby` 失败时只 `logger.step('fail')` 但最后仍 `logger.succeed` —— 状态错误
- 修复：根据 phase 4 失败情况区分 `succeed / partial`

### P2-A-2. storage.js 无上限保护
- 问题：`wx.setStorageSync` 有 10MB 限制，大量 records 缓存满时静默失败只打 console.error
- 修复：添加 10MB 阈值监控 + 自动清理老旧 records_{babyId}

### P2-A-3. db-helper.js fetchAll 无最大条数上限
- 问题：某个宝宝上万条 vaccine_records（恶意构造）会一次性拉满内存
- 修复：默认 MAX_PAGES=50（即 5000 条），超限警告

### P2-A-4. 弹窗组件 properties `type: Object, value: null` 普遍存在，observer null 守卫零散
- 位置：6 个弹窗组件 properties 中的 baby/record/stats 等
- 建议：建立 behavior `safe-open-popup`，统一 null 守卫

### P2-A-5. sync.js `deprecated` 订阅接口保留但无调用方
- 位置：`sync.js:54-174` （`subscribeRecords` / `subscribeFamily` / `unsubscribeXxx`）
- 建议：标记 deprecated 注释已有，但代码占 120 行；考虑删除以减少分析成本

---

# 🎯 v4.3.2 最终 Scope 更新（合并两轮 review）

## Must-Have（P0 共 10 项，必改）

原 P0（3）+ 本轮 P0-A（7）+ P0-A-8/9（安全原子性 2）

- [x] **FR-1**：families.read 收紧 + getFamilyDetail 云函数化
- [x] **FR-2**：deleteRecord / updateRecord 云函数化
- [x] **FR-3**：deleteBaby 最后 baby 后解散家庭
- [ ] **FR-A1**：growth-popup `RecordService.getInstance()` 修复
- [ ] **FR-A2**：4 个弹窗组件接入 swipe-close behavior
- [ ] **FR-A3**：family-join 加入成功后拉取完整 familyInfo
- [ ] **FR-A4**：record.js 单条删除加归属校验
- [ ] **FR-A5**：record.js createRecord try/catch 区分云端/本地错误
- [ ] **FR-A6**：record.js update/delete 网络抖动去重
- [ ] **FR-A7**：sync.js updateRecordId 同步翻新队列里残留操作
- [ ] **FR-A8**：joinFamily 顺序改为先加新家再退旧家 + logger

## Should-Have（P1 共 14 项）

原 P1（6）+ 本轮 P1-A（8）

- [ ] FR-4 requireCanDelete record
- [ ] FR-5 createFamily 冗余入参
- [ ] FR-6 限流扩面
- [ ] FR-7 updateUserInfo updatedAtTs
- [ ] FR-8 文档同步
- [ ] **FR-A9**：updateMemberRole 乐观锁重试 returns BUSY
- [ ] **FR-A10**：transferAdmin isMember 校验
- [ ] **FR-A11**：refreshInviteCode 限流 + 冲突检测 + logger
- [ ] **FR-A12**：5 个 action 接入 logger.start
- [ ] **FR-A13**：logout 清理 service 单例内存缓存
- [ ] **FR-A14**：全量替换 `new XxxService()` → `getInstance()`
- [ ] **FR-A15**：patrol Set 去重比较
- [ ] **FR-A16**：data-model.md inviteCodeExpiry 类型修正
- [ ] **FR-A17**：e2e rule-simulator 修正 families.read 表达式

## Nice-to-Have（P2，共 10 项）

原 P2（5）+ 本轮 P2-A（5）

---

## 🔥 本次 review 核心教训

1. **同构组件修一个漏一批**：v4.3.1 修 baby-edit-popup 的 swipe-close 问题，4 个同构组件漏修。规范应该是"修一处→搜相同模式"
2. **单例模式未严格执行**：代码里 `new XxxService()` 和 `XxxService.getInstance()` 混用
3. **云函数多步操作缺失原子性保证**：joinFamily 等都有"中途失败用户变孤儿"的风险；patrol 也无法补偿（因为没 logger.start）
4. **E2E 测试与真实规则偏离**：families.read 规则生产退化了但测试没发现（两个 bug 互相遮蔽）
5. **离线队列与本地缓存的 ID 同步不完整**：tempId→realId 翻新只改了缓存，没改队列

