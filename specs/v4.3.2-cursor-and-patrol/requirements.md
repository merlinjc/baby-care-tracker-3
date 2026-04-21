# 需求文档 - v4.3.2 Cursor 云端续传 + Patrol 自修复 + 两轮 Review 修复

> 版本：v1.0 | 更新日期：2026-04-21 | 状态：🚧 规划中

## 概述

本迭代源于 v4.3.1 发布后对全项目（服务层 / 云函数 / 页面 / 组件 / 工具类 / 安全规则 / 文档）的两轮深度 review（产出 `review-findings.md`，共 36 条问题）。v4.3.2 为 PATCH 级别发布，聚焦于：

1. **原 v4.3.1 backlog 延续**：`clearBabyData` cursor 云端续传、`patrolMemberOpenids` 反向漂移自动修复
2. **P0 生产事故级修复**（两轮 review 合计 10 条）：同构组件漏修（swipe-close）、服务层 API 误用、离线队列数据丢失、云函数原子性缺陷、安全规则退化
3. **P1 工程质量加固**（14 条）：单例统一、日志全覆盖、限流扩面、logout 缓存清理、乐观锁语义修正
4. **P2 可维护性改进**（10 条）：storage 上限、fetchAll 保护、弹窗 null 守卫统一、E2E rule-simulator 对齐真实规则

不新增任何用户可感知的功能。

**分阶段上线**：本迭代按 Phase 1 → Phase 2 → Phase 3 → Phase 4 的顺序分 4 个子里程碑实施，每个 Phase 形成独立的可部署快照，以降低风险。

---

## 用户角色

| 角色 | 在本迭代中的核心影响 |
|------|---------------------|
| **Admin**（管理员） | `refreshInviteCode` 并发安全、`transferAdmin` 接收方校验、`updateMemberRole` 语义修正 |
| **Editor**（成员） | `record.deleteRecord` 单条删除加归属校验、不能删他人记录；加入家庭后立即拥有 editor 权限（修复默认 viewer 问题） |
| **Viewer**（仅查看） | 安全规则收紧后无法通过 `doc().get()` 直接读取非所在家庭的 `families` 文档；`getFamilyDetail` 改走云函数 |
| **新加入家庭用户** | 修复加入家庭后本地 `familyInfo` 残缺导致的默认降级为 viewer 问题 |
| **离线场景用户** | 离线期间 create → update → update 同步后不再丢失编辑；网络抖动不再造成云端双写 |
| **多账号切换用户** | `logout` 时清理 service 单例内存缓存，不再跨账号泄漏今日统计等数据 |

---

## 分阶段交付

### Phase 1（最快回报，1-2 天）— 页面层 4 个明显漏修
FR-A1 / FR-A2 / FR-A3 / FR-A4

### Phase 2（数据完整性，2-3 天）— 服务层 & 云函数原子性
FR-A5 / FR-A6 / FR-A7 / FR-A8

### Phase 3（安全规则重构，3-5 天）— 最高风险变更
FR-1 / FR-2 / FR-3

### Phase 4（P1 P2 按节奏补齐）
FR-4 ~ FR-8 / FR-A9 ~ FR-A17 / P2 清单

每个 Phase 结束都要：
- E2E 全绿
- 灰度部署 + 观察 operation_logs
- CHANGELOG.md 追加 Phase 小节

---

## 功能需求

> 命名约定：`FR-1 ~ FR-8` 为第一轮 review 发现的项；`FR-A1 ~ FR-A17` 为第二轮深度 review 追加的项。本迭代合并实施。

## Phase 1：页面层漏修（Must-Have P0）

### FR-A1：`growth-popup` 把实例方法当静态方法调用（P0 Blocker）

**用户故事**：作为家长，在首页点"生长"快捷入口打开弹窗时，我希望能看到"上次生长数据"展示区正确回填上次测量值。

**验收标准**：
1. When 用户打开 `growth-popup`，the system shall 调用 `RecordService.getInstance().getRecords(...)` 获取历史数据（不再调用不存在的类静态方法）
2. When 有历史 growth 记录，the system shall 把上次记录的身高/体重/头围作为默认值填充到输入框 placeholder
3. When 无历史记录，the system shall 不抛异常、静默跳过（保持空输入框）

**技术说明**：`miniprogram/components/growth-popup/growth-popup.js:89` 的 `RecordService.getRecords(...)` 改为 `RecordService.getInstance().getRecords(...)`。

---

### FR-A2：4 个弹窗组件接入 swipe-close behavior（P0 Blocker）

**用户故事**：作为家长，我希望在 `feeding / sleep / diaper / temperature` 4 个记录弹窗上能通过下滑手势关闭弹窗（与 `baby-edit-popup` 一致）。

**验收标准**：
1. When 用户在这 4 个弹窗组件上下滑超过阈值，the system shall 关闭弹窗
2. When 下滑手势触发，微信 console 中不再出现"找不到事件处理函数 onTouchStart/Move/End"的 warning
3. 4 个组件的 `js` 文件显式 `require('../../behaviors/swipe-close')` 并注册到 `behaviors: [swipeCloseBehavior]`
4. 从 4 个组件的 `data` 中删除重复定义的 `popupTranslateY` / `touchStartY` 字段（behavior 会统一维护）

**技术说明**：严格复用 v4.3.1 `baby-edit-popup` 的改动模式。涉及文件：
- `miniprogram/components/feeding-popup/feeding-popup.js`
- `miniprogram/components/sleep-popup/sleep-popup.js`
- `miniprogram/components/diaper-popup/diaper-popup.js`
- `miniprogram/components/temperature-popup/temperature-popup.js`

---

### FR-A3：`family-join` 加入家庭后持久化完整 familyInfo（P0 Blocker）

**用户故事**：作为新加入某个家庭的用户，我希望加入后立即就能创建记录，不需要重启小程序或等待缓存刷新。

**验收标准**：
1. When `familyService.joinFamily()` 返回 `{ success: true, familyId, familyName }`，the system shall 随后调用 `familyService.getFamilyDetail(familyId)` 拉取完整家庭文档
2. When 拉取成功，the system shall 以完整 `family` 对象调用 `StorageUtil.saveFamilyInfo(family)`（包含 `_id / memberDetails / memberOpenids / babies`）
3. When 完整 `familyInfo` 已写入缓存，the system shall 调用 `FamilyContext.refresh()` 使上下文立即可用
4. When `getFamilyDetail` 失败（网络/规则），the system shall toast "加入成功，部分信息加载失败，请下拉刷新" 但保持加入结果（不回滚）

**技术说明**：
- 位置：`miniprogram/packageSocial/pages/family-join/family-join.js:64-67`
- 依赖：`getFamilyDetail` 的实现将在 Phase 3 FR-1 中改为走云函数；Phase 1 先基于当前直连实现修复，Phase 3 时再联动更新调用点

---

### FR-A4：`record.js` 单条删除加归属校验（P0 Blocker）

**用户故事**：作为 editor 角色的家庭成员，我不应该能删除其他成员创建的记录（与批量删除行为一致）。

**验收标准**：
1. When 用户在记录列表点击某条记录并选 "删除"，the system shall 首先调用 `PermissionGuard.checkCanDelete(selectedRecord)` 进行归属校验
2. When 校验不通过，the system shall toast "无权删除他人记录" 并终止删除
3. When admin 角色删除他人记录，the system shall 依赖 Phase 2 FR-2 云函数路径（本 FR 只管 editor/viewer）
4. 不允许绕过（不通过修改 action sheet 顺序或快速点击绕过）

**技术说明**：位置 `miniprogram/pages/record/record.js:761-797` 的 `deleteRecord()` 方法开头加校验。

---

## Phase 2：数据完整性与云函数原子性（Must-Have P0）

### FR-A5：`RecordService.createRecord` 区分云端与本地错误边界（P0 Blocker）

**用户故事**：作为家长，我不希望因本地存储写入异常导致云端产生重复记录（双写）。

**验收标准**：
1. When `recordCollection.add()` 成功，the system shall 把"云端已落库"作为不可逆成功标记
2. When 后续 `saveToLocalCache(recordWithId)` 抛错（storage 满 / JSON 异常），the system shall 仅记录 error log、toast "本地缓存失败"，但**不再把这条记录加入离线队列**
3. When `recordCollection.add()` 本身失败（网络/权限），the system shall 保持现有离线队列入队逻辑不变
4. 回归 E2E：模拟 "add 成功 + saveToLocalCache 抛错" 场景，验证云端只产生 1 条记录

**技术说明**：位置 `miniprogram/services/record.js:153-351`。需把 `add()` 成功后对 `saveToLocalCache` 的调用独立 try/catch 包裹；外层 catch 只处理 `add()` 本身失败。

---

### FR-A6：`updateRecord` / `deleteRecord` 网络抖动去重（P0 Blocker）

**用户故事**：作为多设备用户，我希望在弱网下修改/删除记录不会因响应丢包而被当作失败重复写入云端。

**验收标准**：
1. When `update()` / `remove()` 的 catch 捕获的错误是"已送达但响应丢失"（如 `-402003` / `REQUEST_FAIL` 超时），the system shall 先查询云端实际状态再决定是否入队
2. When 确认云端已生效（文档 `updatedAtTs` 已更新 / 文档已不存在），the system shall 跳过入队，仅更新本地缓存
3. When 确认未生效，the system shall 入队重试
4. When 无法判定（查询本身失败），the system shall 保留现行入队逻辑（保底一致性优先于避免重复）
5. 回归 E2E：构造"update 响应丢失但云端已写入"场景，验证不重复入队

**技术说明**：位置 `services/record.js:491-549`。引入新的 helper `queryRecordState(recordId)` 做侦测；错误码 pattern 走白名单（避免误判）。

---

### FR-A7：`sync.js.updateRecordId` 同步翻新离线队列残留操作（P0 Blocker）

**用户故事**：作为离线场景用户，我希望离线期间做的 create → update → update 序列，在网络恢复后**全部**同步到云端，不会丢失后续编辑。

**验收标准**：
1. When `syncCreate` 成功后调用 `updateRecordId(tempId, realId)`，the system shall 遍历 `offline_queue`，将所有 `recordId === tempId` 的 `update` / `delete` 操作的 `recordId` 替换为 `realId`
2. When 替换完成，the system shall 立即持久化队列到 Storage
3. When 后续队列执行这些已翻新的操作，the system shall 作用于真实云端文档（不再出现 `INVALID_DOC_ID`）
4. 回归 E2E：离线 create → offline update × 2 → online sync，验证云端最终状态 = 本地 2 次 update 累积结果

**技术说明**：位置 `miniprogram/services/sync.js:352-369`。在 `updateRecordId` 末尾新增队列遍历逻辑；需注意并发安全（`syncInProgress` 标志应已覆盖）。

---

### FR-A8：`joinFamily` 幽灵成员切换顺序改为"先加新家再退旧家"（P0 Blocker）

**用户故事**：作为一个已在某家庭但通过邀请码切换到新家庭的用户，我希望切换过程中途失败不会让我变成"无家可归的孤儿"。

**验收标准**：
1. When 执行幽灵成员切换路径（`existingFamily` 存在且 `!== family._id`），the system shall 先执行"push 新家庭 members/memberOpenids + users.familyId 写新值"
2. When 上一步成功，the system shall 再执行"旧家庭 pull members/memberOpenids"
3. When 第一步失败，the system shall 直接返回错误，用户仍在旧家庭（无副作用）
4. When 第二步失败，the system shall logger.partial 并返回 `{ success: true, warning: 'STALE_OLD_FAMILY_MEMBERSHIP' }`，由 patrol 后续清理（FR-A15 / FR-10 的 patrol 反向漂移）
5. action 首行 `logger.start('joinFamily')` 使失败分支可被 patrol 扫到补偿

**技术说明**：位置 `cloudfunctions/familyOperation/actions/joinFamily.js:65-115`。同时需同步 e2e m15/m21 模块覆盖该分支。

---

## Phase 3：安全规则重构与核心读写路径云函数化（Must-Have P0）

### FR-1：`families.read` 安全规则收紧 + `getFamilyDetail` 云函数化（P0 安全漏洞）

**用户故事**：作为 CloudBase 数据库安全规则的维护者，我不希望任何登录用户都能通过 `doc('<familyId>').get()` 读到别人家庭的 `inviteCode` / `memberOpenids`。

**验收标准**：
1. When 收紧后的 `families.read` 规则为 `auth.openid in resource.data.memberOpenids || auth.openid == resource.data.creatorOpenid`，the system shall 拒绝非成员读取
2. When 客户端调用 `familyService.getFamilyDetail(familyId)`，the system shall 路由到新云函数 action `getFamilyDetail`（admin SDK 跨规则读取 + 云函数内鉴权）
3. When `getFamilyDetail` 鉴权失败（userId 不在 memberDetails 且 !== creatorId），the system shall 返回 `PERMISSION_DENIED`
4. When 鉴权成功，the system shall 返回完整 family 文档（但剔除 `_openid` 等敏感系统字段）
5. When `app.ensureUserReady` / `family-join` / `profile` 等页面调用 `getFamilyDetail`，the system shall 透明切换到云函数路径，无 UI 行为变化
6. 回归 E2E：构造非成员用户尝试直连 `doc('otherFamily').get()`，验证返回 `DATABASE_PERMISSION_DENIED`

**技术说明**：
- 新增 `cloudfunctions/familyOperation/actions/getFamilyDetail.js`
- 修改 `miniprogram/services/family.js:getFamilyDetail` → 走云函数
- 更新 `cloudbaserc.json` 或 CloudBase 控制台规则
- 文档同步：`architecture.md` / `data-model.md` / `service-api.md`
- **破坏性风险**：需确保所有读取 families 的路径都已改为云函数化，否则生产会出现 `DATABASE_PERMISSION_DENIED`

---

### FR-2：`records.update` / `records.remove` 云函数化 + admin 跨归属能力（P0 数据一致性）

**用户故事**：作为家庭 admin，我希望能删除/修改家庭内其他成员的记录；该操作必须同时在云端生效（避免 v4.3.1 遗留的 "本地已删但云端未删"假象）。

**验收标准**：
1. When 客户端调用 `RecordService.updateRecord(id, data)`，admin 跨归属场景下，the system shall 路由到新云函数 action `updateRecord`
2. When 客户端调用 `RecordService.deleteRecord(id)`，admin 跨归属场景下，the system shall 路由到新云函数 action `deleteRecord`
3. When 自己删自己的记录（editor/admin/viewer），the system shall 继续走直连路径（性能优先）；**自动判定**：`record._openid === auth.openid` 时直连，否则云函数
4. When 云函数内执行，the system shall 使用 admin SDK + `PermissionGuard.require('record.edit'|'record.delete.any')` 校验后 bypass 安全规则
5. When 云函数操作成功，the system shall 写 `updatedAtTs: Date.now()` + `updatedAt: serverDate()`
6. When `sync.js` 离线队列同步 update/delete，the system shall 走同样的判定逻辑
7. 回归 E2E：admin 删除 editor 的记录，验证云端 1 次查询返回 0 条（已彻底删除）

**技术说明**：
- 新增 actions：`updateRecord.js` / `deleteRecord.js`
- `services/record.js` 引入判定辅助 `_shouldUseCloudFn(record)`
- 字段白名单：只允许改 `data / babyId / startTime / endTime / remark` 等业务字段；拒绝改 `_openid / createdBy / _id`
- 性能成本：+1 RTT（仅 admin 跨归属场景，占比 < 5%）

---

### FR-3：`deleteBaby` 删除最后一个宝宝后自动解散家庭（P0 数据一致性）

**用户故事**：作为家庭 admin，我删除家里最后一个宝宝时，如果家庭已经没有其他用途（无其他成员、无其他 baby），希望自动解散家庭，与 `clearBabyData` 行为一致。

**验收标准**：
1. When `deleteBaby` 执行完成且 `family.babies.length === 0` 且 `family.members.length === 1`，the system shall 自动触发 `dissolveFamily` 流程
2. When 触发自动解散，the system shall 在返回结果中加 `autoDissolved: true` 标记
3. When 存在其他成员（`members.length > 1`），the system shall 不自动解散，仅删除 baby（避免误伤其他成员）
4. 回归 E2E：admin 单人家庭删除最后一个 baby → 验证 family 已从 `families` 集合删除 + `users[admin].familyId === ''`

**技术说明**：位置 `cloudfunctions/familyOperation/actions/deleteBaby.js`。复用 `dissolveFamily.js` 的核心逻辑（抽成 lib 方法 `lib/family-dissolve.js` 或 action 内部调用）。

---

## Phase 4：P1 工程质量加固（Should-Have）

### FR-4：`record.batchDelete` 使用 `PermissionGuard.requireCanDelete(record)`（P1）

**验收标准**：
1. `batchDelete` 对每条记录调用 `PermissionGuard.checkCanDelete(record)`（已实现），但需确保 FR-A4 的单条删除同样使用这个入口，保持接口统一
2. 不再允许调用方传入任意 `record`（`checkCanDelete` 内部应校验 record.createdBy.userId / _openid 字段是否来自可信源）

**技术说明**：在 `permission-guard.js:checkCanDelete` 增加 defensive check：`record._openid` 必须存在；缺失时抛错而非放行。

---

### FR-5：`familyOperation.createFamily` 去除客户端冗余入参（P1）

**验收标准**：
1. When 客户端调用 `createFamily`，the system shall 仅接受 `familyName`；`creatorId` / `creatorName` / `creatorOpenid` 从云函数 ctx 构造
2. When 调用方传入了上述冗余字段，云函数 shall 忽略（silent drop）并记 debug log
3. `services/family.js:createFamily` 同步精简调用参数

---

### FR-6：限流扩面至核心写操作（P1）

**验收标准**：
1. `refreshInviteCode` / `transferAdmin` / `dissolveFamily` / `removeMember` / `updateMemberRole` 各自接入 `rateLimiter.check('<action>_' + openid, { maxPerMinute: 10 })`
2. 限流触发时返回 `RATE_LIMIT_EXCEEDED` + `retryAfter`
3. 客户端各调用方识别并 toast "操作过于频繁，请稍后再试"

---

### FR-7：`AuthService.updateUserInfo` 补写 `updatedAtTs`（P1）

**验收标准**：`updateUserInfo` 云端写入时同步 `updatedAtTs: Date.now()`，与 `data-model.md` 双时间戳约定一致。

---

### FR-8：文档一致性修正（P1）

**验收标准**：
1. `data-model.md:58` `families.inviteCodeExpiry` 类型改为 `Date`（对齐代码实际写入的 `new Date()` 对象）
2. 新增 `families.read` 规则说明
3. `service-api.md` 新增 `familyOperation.getFamilyDetail / updateRecord / deleteRecord` 签名
4. `architecture.md` 安全规则章节全量重写（对齐 FR-1）

---

### FR-A9：`updateMemberRole` 乐观锁重试返回 BUSY（P1）

**验收标准**：
1. When 重试 2 次后 `result.stats.updated === 0` 仍发生，the system shall `return errors.BUSY('UPDATE_ROLE_BUSY')`，不再继续执行 users.update
2. 日志 `logger.partial` 记录实际 updated 次数

---

### FR-A10：`transferAdmin` 使用 `isMember` 交叉校验（P1）

**验收标准**：
1. When `newAdminId` 不在 `family.members[]` 中，the system shall 返回 `NOT_MEMBER`，即使 `memberDetails.find` 能找到
2. 新增 e2e 用例：memberDetails 和 members 不一致时 transferAdmin 被拦截

---

### FR-A11：`refreshInviteCode` 冲突检测 + 接入 logger（P1）

**验收标准**：
1. 生成新 inviteCode 后先 `db.collection('families').where({ inviteCode: newCode }).count()`，若冲突则重新生成（最多重试 5 次）
2. 接入 `logger.start('refreshInviteCode')` + 限流（见 FR-6）
3. 并发保护：`updatedAtTs` 乐观锁 `where({ _id, inviteCode: oldCode }).update()`，确保两个 admin 并发刷新时后者能识别冲突

---

### FR-A12：5 个 action 接入 `logger.start`（P1）

**涉及 action**：`createFamily / joinFamily / leaveFamily / transferAdmin / refreshInviteCode`

**验收标准**：入口首行 `const logger = new OperationLogger(action, ctx)` + `logger.start()`；末尾 `logger.succeed/partial/fail`。保障 patrol 能扫到失败补偿窗口。

---

### FR-A13：`logout` 清理 service 单例内存缓存（P1）

**验收标准**：
1. `profile.js:logout` 的 `StorageUtil.clear()` 之后、登出跳转之前，逐个清理：
   - `RecordService.getInstance()._todayStatsCache = null`
   - `RecordService.getInstance()._offlineQueue = []`
   - `TodoService.getInstance().clearCache()`
   - `TrendService.getInstance()._cache = null; ._periodCache = null`
   - `FamilyContext.reset()`
2. 跨账号登录后，首页今日统计、待办清单、趋势数据不应出现前一个账号的数据

---

### FR-A14：全量替换 `new XxxService()` 为 `getInstance()`（P1）

**验收标准**：
1. 搜索全项目 `new (RecordService|FamilyService|BabyService|AuthService|TodoService|TrendService|SyncService|AIService)\(`
2. 全部替换为 `XxxService.getInstance()`
3. 具体已知位点（非穷举）：`home.js:376, 498` / `feeding-popup` / `sleep-popup` / `diaper-popup` / `temperature-popup` 提交分支 / `baby-detail.js`

---

### FR-A15：`patrolMemberOpenids` 反向漂移自动修复（原 backlog P2 → 本轮升级为 P1）

**用户故事**：作为运维/admin，我希望每天凌晨巡检时发现的 `users.familyId` 与 `families.members` 不一致问题能被自动纠正（而不只是告警）。

**验收标准**：
1. 阶段 2 反向漂移扫描发现不一致时，按规则自动修复：
   - **规则 A**：若 family 存在且 user 仍应在其中（joinedAt < 7 天），push user._id 进 `family.members` + `family.memberOpenids`
   - **规则 B**：若 family 不存在（已解散），清空 user.familyId 和 user.familyRole
   - **规则 C**：若用户声称在家庭但 joinedAt > 7 天且 members 不含，触发人工干预（写告警，不自动修复）
2. 每次修复写 `operation_logs` + `dryRun` 开关（默认 false，可通过环境变量 `PATROL_DRY_RUN=true` 改回仅告警）
3. 聚合使用 `Set` 比较（修复 FR-A16 同步问题）
4. 单次修复上限 100 条 family，超限告警

---

### FR-A16：`patrolMemberOpenids` expectedOpenids Set 去重比较（P1）

**验收标准**：`expectedOpenids` 和 `current` 比较改为 `new Set(expectedOpenids).size === new Set(current).size && expectedOpenids.every(o => current.includes(o))`，排除重复 openid 导致的误判。

---

### FR-A17：E2E `rule-simulator` 对齐真实规则表达式（P1）

**验收标准**：
1. `cloudfunctions/e2eSecurityTest/utils/rule-simulator.js:25` 的 `families.read` 改为 `auth.openid in resource.memberOpenids || auth.openid == resource.creatorOpenid`（与 FR-1 收紧后的生产规则一致）
2. 新增测试："非成员用户 doc().get() 应被拒绝"
3. CI 部署前自动对比真实 CloudBase 规则与 `rule-simulator` 定义（diff 为空方可通过）

---

## 原 backlog：`clearBabyData` cursor 云端续传（P2 → 本轮升级为 P1）

### FR-A18：`clearBabyData` cursor 持久化到云端 operation_logs（P1）

**用户故事**：作为 admin，在清除大量宝宝数据过程中如遇 Storage 被清、换设备、小程序重启，希望重新进入设置页能自动续传未完成的清除任务。

**验收标准**：
1. When 云函数返回 `{ status: 'in_progress', cursor }`，the system shall 同时把 cursor 持久化到 `operation_logs` 文档的 `cursor` 字段
2. When 客户端重新进入 settings 页并执行 `clearAllCloudData`，the system shall 先查询 `operation_logs` 是否存在同 `babyId` 的未完成任务（`status=started` 且 `cursor` 存在），若有则用该 cursor 续传
3. When 续传完成，the system shall `logger.succeed` 关闭该 operation_log
4. 向后兼容：旧数据（无 operation_logs cursor 记录的任务）仍走"从头开始"

**技术说明**：位置 `cloudfunctions/familyOperation/actions/clearBabyData.js`。在 phase 切换时把 `cursor` 写入 `operation_logs.meta.cursor`。

---

## P2 改进项（Nice-to-Have）

### FR-P2-1：`deleteBaby` phase 4 失败时 logger 状态准确
- 位置：`actions/deleteBaby.js:127-140`
- 改动：依据 phase 4 中 `remove_baby` 或 `pull_family_baby` 的实际成败，区分 `logger.succeed / partial / fail`

### FR-P2-2：`storage.js` 增加 10MB 阈值保护
- 监控 `wx.setStorageInfoSync().currentSize`，超 8MB 时主动清理最旧的 `records_<babyId>` 缓存
- 超 10MB 触发 `wx.showToast` 提示用户

### FR-P2-3：`db-helper.js.fetchAll` 默认 MAX_PAGES=50
- 单次 `.get()` 100 条 × 50 页 = 5000 条上限
- 超限打印 warning，调用方可显式传入 `{ maxPages: 200 }` 放宽

### FR-P2-4：弹窗组件 null 守卫 behavior 统一
- 抽象 `behaviors/safe-popup-observer.js`，统一处理 `baby / record / stats` 等 Object 类型 properties 的 null/undefined 场景
- 所有 `_popup.js` 共享该 behavior

### FR-P2-5：清理 `sync.js` deprecated 的 `subscribeXxx` 方法（行 54-174, 120 行）
- 搜全项目确认无调用方
- 删除或注释为 `/** @deprecated removed in v4.3.2 */`

---

## 非功能需求

### NFR-1：兼容性
- 存量数据（v4.3.1 已部署）无需迁移
- `families.read` 规则收紧前，需先部署云函数 `getFamilyDetail` 并灰度一个迭代周期
- 客户端 FR-A2 / FR-A3 / FR-A4 可直接发布，不依赖云函数变更

### NFR-2：回归验证
- E2E 套件（含 m21 v431Fixes、新增 m22 v432Fixes）必须 100% 通过
- 新增至少 10 条 v4.3.2 专项 E2E 用例：
  - Phase 1：FR-A1 ~ FR-A4 各 1 条（共 4 条）
  - Phase 2：FR-A5 ~ FR-A8 各 1-2 条（共 6 条）
  - Phase 3：FR-1 `families.read` 拒绝 + `getFamilyDetail` 成功各 1 条（共 2 条）

### NFR-3：部署顺序（严格）

```
Phase 1（纯客户端，1-2 天）
  └─→ miniprogram 发布 → CDN 灰度 5%

Phase 2（客户端 + 云函数）
  ├─→ 云函数 updateRecord/deleteRecord 部署（灰度开关关闭）
  └─→ miniprogram 发布 + 灰度开关按 babyId 模 10% 开

Phase 3（破坏性变更）
  ├─→ T-7：部署 getFamilyDetail 云函数
  ├─→ T-3：灰度 10% 用户走云函数读 family
  ├─→ T-1：monitoring 验证无异常
  ├─→ T0 ：CloudBase 控制台收紧 families.read 规则
  └─→ T+1：观察 24h，无异常则全量

Phase 4（按 FR 细粒度滚动）
```

### NFR-4：性能
- FR-1 的 `getFamilyDetail` 云函数化 RTT < 800ms（P99）
- FR-2 的 admin 跨归属 update/delete 云函数化 RTT < 1000ms（P99）
- 首页统计数据（受 FR-A13 logout 清缓存影响）首屏渲染保持 < 300ms

### NFR-5：可观测性
- 所有新 action 接入 operation_logs
- Phase 3 部署后在 `operation_logs` 新增 `metric_type: 'getFamilyDetail_latency'` 埋点
- 每日巡检（FR-A15）结果写入 `operation_logs`，admin 可在后台查看

---

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|---------|
| FR-A3 中 `getFamilyDetail` 网络超时 | 保留加入成功状态；toast 提示 + 下拉刷新可重拉 |
| FR-A5 中 add 成功但 saveToLocalCache 异常 | 云端为准；本地下次 pullRecords 自动补齐 |
| FR-A7 中翻新队列遇到权限已失效（用户已切换家庭） | 整个队列跳过该条并 log warning |
| FR-A8 中新家庭 push 成功但 users.familyId 写入失败 | 返回 partial 结果 + patrol 下一轮修复 |
| FR-1 灰度期间规则已收紧但客户端未更新 | CDN 缓存清理 + 强制升级提示（`miniprogram.app.js` versionCheck） |
| FR-2 云函数化后 admin 操作中途 timeout | 云函数内幂等设计 + client 侧可重试，operation_logs 保证唯一性 |
| FR-A18 cursor 续传遇到 babyId 已被删除 | 返回 `BABY_NOT_FOUND`，operation_log 标 failed，不无限续传 |

---

## 模块依赖关系

```
云函数侧改动：
  errors.js（新增 RATE_LIMIT_EXCEEDED 通用 / BUSY 通用 / STALE_OLD_FAMILY_MEMBERSHIP）
  lib/operation-logger.js（确认 start/succeed/partial/fail 语义完整）
  lib/family-dissolve.js（新建，从 dissolveFamily 抽取核心逻辑供 deleteBaby 调用）
  lib/rate-limiter.js（扩容支持多 action）
  actions/getFamilyDetail.js（新建）FR-1
  actions/updateRecord.js（新建）FR-2
  actions/deleteRecord.js（新建）FR-2
  actions/deleteBaby.js（改）FR-3
  actions/joinFamily.js（改）FR-A8
  actions/updateMemberRole.js（改）FR-A9
  actions/transferAdmin.js（改）FR-A10
  actions/refreshInviteCode.js（改）FR-A11 + FR-6
  actions/createFamily.js（改）FR-5 + FR-A12
  actions/leaveFamily.js（改）FR-A12
  actions/clearBabyData.js（改）FR-A18
  patrolMemberOpenids/index.js（大改）FR-A15 + FR-A16

客户端改动：
  services/record.js（改）FR-A5, FR-A6, FR-2（updateRecord/deleteRecord 判定）
  services/sync.js（改）FR-A7, FR-2
  services/family.js（改）FR-1 getFamilyDetail 走云函数, FR-5 去冗余入参
  services/auth.js（改）FR-7 updatedAtTs
  utils/permission-guard.js（改）FR-4 defensive check
  utils/network.js / utils/deduplication.js（review 一致性）
  pages/record/record.js（改）FR-A4 单条删除归属
  pages/profile/profile.js（改）FR-A13 logout 清缓存
  pages/home/home.js（改）FR-A14 单例替换
  packageSocial/pages/family-join/family-join.js（改）FR-A3
  packageSocial/pages/settings/settings.js（改）FR-A18 cursor 续传
  packageGrowth/pages/baby-detail/baby-detail.js（改）FR-A14
  components/growth-popup/growth-popup.js（改）FR-A1
  components/feeding-popup/feeding-popup.js（改）FR-A2
  components/sleep-popup/sleep-popup.js（改）FR-A2
  components/diaper-popup/diaper-popup.js（改）FR-A2
  components/temperature-popup/temperature-popup.js（改）FR-A2
  behaviors/safe-popup-observer.js（新建，可选）FR-P2-4
  app.js（改）FR-A13 reset hooks

E2E 测试：
  cloudfunctions/e2eSecurityTest/modules/m22-v432Fixes.js（新建）
  cloudfunctions/e2eSecurityTest/utils/rule-simulator.js（改）FR-A17

文档同步（全量）：
  architecture.md（安全规则章节 / updateRecord/deleteRecord 路由说明）
  data-model.md（inviteCodeExpiry 类型 / operation_logs.meta.cursor 字段）
  service-api.md（新增 3 个 action 签名 / getFamilyDetail）
  coding-conventions.md（单例 getInstance 强制约定 / logout 清缓存 checklist）
  component-library.md（swipe-close behavior 覆盖清单）
  CHANGELOG.md（Phase 1-4 各自小节）
```

---

## 变更影响范围汇总

| 文件类别 | 文件数 | 涉及 FR |
|---------|-------|---------|
| 云函数 actions（新建） | 3 | FR-1, FR-2 |
| 云函数 actions（改） | 9 | FR-3, FR-5, FR-6, FR-A8 ~ A12, FR-A18 |
| 云函数 lib（新建） | 1 | FR-3（family-dissolve） |
| patrolMemberOpenids | 1 | FR-A15, FR-A16 |
| 客户端 services | 4 | FR-1, FR-2, FR-5, FR-7, FR-A5 ~ A7 |
| 客户端 pages | 6 | FR-A3, FR-A4, FR-A13, FR-A14, FR-A18 |
| 客户端 components | 5 | FR-A1, FR-A2 |
| E2E 测试 | 2 | NFR-2 |
| 文档 | 6 | FR-8 + 所有 |
| **总计** | **~37** | **30 条 FR + 5 条 P2** |

---

## 未来迭代（v4.3.3+）Backlog

以下问题已识别但不在本迭代范围，列入后续：

- 弹窗组件 null 守卫 behavior 体系化（FR-P2-4 只做最小可用版本）
- `db-helper.fetchAll` 流式迭代器 API（替代 `{ maxPages }` 参数）
- `operation_logs` / `rate_limits` 集合 TTL 索引（需 CloudBase 控制台能力）
- 客户端"网络健康度"可视化（结合 `NetworkUtil` 监听数据）
- 家庭成员切换的灰度发布（FR-A8 路径的反向 dry-run 模式）

---

> **本文档生成日期**：2026-04-21  
> **下一步**：编写 `design.md`（技术方案）→ `tasks.md`（工程任务拆解）→ 进入开发
