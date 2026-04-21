# 实施计划 - v4.3.2 Cursor 云端续传 + Patrol 自修复 + 两轮 Review 修复

> 版本：v1.1 | 日期：2026-04-21 | 状态：🚧 M4 代码完成，M5 待收尾
>
> 对应：`requirements.md`（30 FR + 5 P2）/ `design.md`（12 章节）

---

## 实施概览

**预计总工时**：约 11~16 小时（PATCH 级别，无新功能）

**里程碑按 Phase 对齐 design.md §1.2**：

| 里程碑 | 对应 design 章节 | 工时 | 主要内容 |
|--------|----------------|------|---------|
| **M1 Phase 1** | design §二（2.1~2.4） | 1.5~2h | 页面层 4 个漏修（FR-A1~A4）— 纯客户端 |
| **M2 Phase 2** | design §三（3.1~3.4） | 3~4h | 服务层 + 云函数原子性（FR-A5~A8） |
| **M3 Phase 3** | design §四（4.1~4.3） | 3~5h | 安全规则重构（FR-1~3）— 破坏性变更 |
| **M4 Phase 4** | design §五（5.1~5.16） | 3~4h | P1/P2 工程加固（FR-4~8 / A9~A18 / P2-1~5）✅ 已完成 |
| **M5 收尾** | design §十一、十二 | 1h | E2E 回归 + 文档同步 + CHANGELOG + 版本号 |

**发布节奏**：M1 / M2 / M3 / M4 各自独立出包，逐 Phase 灰度；M5 收尾在 M4 完成后统一。

---

## 任务列表

### 阶段一：开发前（进行中）

- [x] **T-0.1** 创建 `feature/v4.3.2-cursor-and-patrol` 分支（已从 develop 拉出）
- [x] **T-0.2** 深度 review 两轮，产出 `review-findings.md`（36 条）
- [x] **T-0.3** 编写 `requirements.md`（30 FR + 5 P2）
- [x] **T-0.4** 编写 `design.md`（12 章节 / 1412 行）
- [x] **T-0.5** 编写 `tasks.md`（本文件）
- [x] **T-0.6** 用户审核并确认 Scope 与 Phase 顺序

---

### 阶段二：M1 — Phase 1 页面层漏修（~1.5~2h）

> 纯客户端改动，不依赖任何云函数部署；独立可出包，可优先灰度发现问题。

#### FR-A1：growth-popup 实例方法修复

- [x] **T-1.1** `components/growth-popup/growth-popup.js:89` 改 `RecordService.getRecords` → `RecordService.getInstance().getRecords`
  - 验收：真机打开首页 → 点"生长" → console 不抛 `TypeError`
  - 验收：若有 growth 历史记录，弹窗内"上次生长数据"展示区正确回填
  - _涉及：FR-A1_
  - _对应 design：§2.1_

#### FR-A2：4 个弹窗接入 swipe-close behavior

- [x] **T-1.2** `components/feeding-popup/feeding-popup.js` 接入 behavior
  - 引入 `const swipeCloseBehavior = require('../../behaviors/swipe-close')`
  - 添加 `behaviors: [swipeCloseBehavior]`
  - 删除 `data` 中 `popupTranslateY / touchStartY`
  - 删除 `methods` 中 `onTouchStart / onTouchMove / onTouchEnd`
  - 验收：真机下滑可关闭弹窗；console 无 "Component method not found" warning
  - _对应 design：§2.2_

- [x] **T-1.3** `components/sleep-popup/sleep-popup.js` 同 T-1.2 改法
- [x] **T-1.4** `components/diaper-popup/diaper-popup.js` 同 T-1.2 改法
- [x] **T-1.5** `components/temperature-popup/temperature-popup.js` 同 T-1.2 改法

#### FR-A3：family-join 加入后持久化完整 familyInfo

- [x] **T-1.6** `packageSocial/pages/family-join/family-join.js` `handleJoin` 改造
  - `joinResult.success` 后调用 `familyService.getFamilyDetail(joinResult.familyId)`
  - 成功：`StorageUtil.saveFamilyInfo(family)`（完整对象）
  - 失败降级：保留最小 `{ _id, name }` + toast "加入成功，部分信息需刷新"
  - 末尾调用 `FamilyContext.refresh()` + `AuthService.getInstance().refreshUserInfo()`
  - 验收：新用户加入家庭后立即能创建记录（默认 editor 权限生效）
  - 验收：`StorageUtil.getFamilyInfo()._id` 非空、`memberDetails` 为数组
  - _对应 design：§2.3_
  - _跨 Phase 说明：实现方式与 Phase 3 FR-1 向后兼容（Phase 3 getFamilyDetail 切云函数后无需改本处调用点）_

#### FR-A4：record 单条删除归属校验

- [x] **T-1.7** `pages/record/record.js` 单条删除入口加 `PermissionGuard.checkCanDelete`
  - 删除 action sheet 点击后、`showModal` 确认前加校验
  - 校验失败 toast "无权删除他人记录" 并 return
  - 验收：editor 账号下点他人记录 → 选"删除" → 被拦截不进入确认弹窗
  - 验收：admin 暂与 editor 一致被拦截（Phase 2 FR-2 后 admin 走云函数）
  - _对应 design：§2.4_

#### M1 收尾

- [x] **T-1.8** `grep -rn "bindtouchstart=" miniprogram/components/` 确认 5 个弹窗（baby-edit + 4 个新）WXML 未受影响
- [ ] **T-1.9** 真机冒烟：首页→生长弹窗 / 4 个记录弹窗下滑关闭 / 加入家庭流程 / record 单条删除（需用户在微信开发者工具/真机操作）
- [x] **T-1.10** M1 commit（b22a5e8）+ 独立出包（版本号 v4.3.2-m1，临时标识；出包在微信开发者工具操作）

---

### 阶段二：M2 — Phase 2 服务层/云函数原子性（~3~4h）

> 客户端 + 云函数联合改动，需先部署云函数再发客户端。

#### FR-A5：createRecord 错误边界隔离

- [x] **T-2.1** `services/record.js.createRecord` try 结构重构
  - `recordCollection.add()` 成功后，`saveToLocalCache(createdRecord)` 用独立 try/catch 包裹
  - 本地缓存失败：`console.error` + `_reportCacheFailure('create', res._id, err)`；不入队、不抛错
  - 外层 catch 仅处理 `add()` 失败的降级入队
  - 新增辅助 `_reportCacheFailure(action, recordId, err)` 方法，内部封装 `wx.reportAnalytics`
  - 验收：mock `saveToLocalCache` 抛错 → 云端只产生 1 条 records 文档（非 2 条）
  - _对应 design：§3.1_

#### FR-A6：update/delete 网络抖动去重

- [x] **T-2.2** `services/record.js` 新增 `_shouldRequeueAfterFailure(recordId, op, expectedTs, error)` 辅助
  - UNSENT_CODES 匹配 `REQUEST_FAIL / TIMEOUT / NETWORK_ERROR` → return true
  - 探测 `recordCollection.doc(recordId).get()`：
    - `op === 'delete'`：文档存在 return true（需入队），不存在 return false
    - `op === 'update'`：云端 `updatedAtTs >= expectedTs` return false（已生效），否则 true
  - 探测失败 errCode===-1 / not exist：return false（update）或交保底
  - 其他探测失败：return true（保底入队）
  - _对应 design：§3.2_

- [x] **T-2.3** `services/record.js.updateRecord` catch 分支改用 `_shouldRequeueAfterFailure` 判定
  - `shouldRequeue=false` 时跳过入队，仅更新本地缓存

- [x] **T-2.4** `services/record.js.deleteRecord` catch 分支对称改造
  - 参考 T-2.3，op='delete'

- [x] **T-2.5** 验证三种场景（静态验证 — 代码注释覆盖三种分支；端到端验证靠 T-2.10 E2E）
  - 抖动响应丢失 + 云端已写 → 不重复入队 ✓
  - 真网络挂 + 未发送 → 入队 ✓
  - 探测本身失败 → 入队（保底一致性）✓

#### FR-A7：sync 队列翻新

- [x] **T-2.6** `services/sync.js.updateRecordId` 末尾追加队列翻新
  - `StorageUtil.getOfflineQueue()` → 遍历 → 将 `op.recordId === tempId` 替换为 `realId`
  - 变更后 `StorageUtil.set('offline_queue', newQueue)`
  - 打 log `[sync] 翻新队列：tempId=... → realId=...`
  - 验收：离线 create → update × 2 → online sync → 云端 `records.updatedAtTs` 为最后一次 update 的时间戳
  - _对应 design：§3.3_

#### FR-A8：joinFamily 顺序反转

- [x] **T-2.7** `cloudfunctions/familyOperation/actions/joinFamily.js` 顺序反转
  - 入口首行 `await logger.start('joinFamily', { inviteCode, userId })`
  - 反转为：5. 先 push 新家 → 6. 更新 users.familyId → 7. pull 旧家
  - 步骤 5 失败：`logger.fail` + 返回 `INTERNAL_ERROR`（无副作用，用户仍在旧家）
  - 步骤 6 失败：`logger.partial` + 返回 `ok({ warning: 'STALE_USER_POINTER' })`
  - 步骤 7 失败：`logger.partial` + 返回 `ok({ warning: 'STALE_OLD_FAMILY_MEMBERSHIP' })`
  - 正常路径：`logger.succeed`
  - _对应 design：§3.4_

- [x] **T-2.8** `services/family.js.joinFamily` 客户端侧识别 warning 字段
  - 有 warning 时仍返回 success，额外 console.warn 记录
  - （无需 UI 变化，patrol 会后续补偿）

#### M2 收尾

- [x] **T-2.9** 云函数部署：`familyOperation`（joinFamily 改动）
  - 用 MCP `manageFunctions(action='updateFunctionCode')` 部署（需 CloudBase 登录授权）
  - 冒烟：调用 joinFamily 新账号加入有效家庭 → 正常路径 succeed
  - 冒烟：伪造 STALE_USER_POINTER / STALE_OLD_FAMILY_MEMBERSHIP 分支走到（可选）

- [x] **T-2.10** e2e m15/m21 回归确认 joinFamily 无破坏

- [x] **T-2.11** M2 commit + 独立出包（v4.3.2-m2，临时标识）
  - 代码 commit 已完成：d428258（feat(v4.3.2-M2): Phase 2 服务层/云函数原子性）
  - 出包在微信开发者工具操作

---

### 阶段二：M3 — Phase 3 安全规则重构（~3~5h）

> **破坏性变更**：families.read 规则收紧会影响全站启动路径。严格按 design §4.1 的 T-7 → T+14 灰度时间线执行。

#### FR-1：families.read 收紧 + getFamilyDetail 云函数化

**T-7（部署 + 客户端发版，不收紧规则）**

- [x] **T-3.1** 新建 `cloudfunctions/familyOperation/actions/getFamilyDetail.js`
  - 入参：`{ familyId }`
  - 鉴权：`isMember(userId, family) || family.creatorId === userId`，失败 PERMISSION_DENIED
  - 返回：`errors.ok({ ...family })`，过滤 `_openid`
  - 错误码：FAMILY_NOT_FOUND / PERMISSION_DENIED / INTERNAL_ERROR
  - _对应 design：§4.1_

- [x] **T-3.2** `familyOperation/index.js` action 路由注册 `getFamilyDetail`

- [x] **T-3.3** `services/family.js.getFamilyDetail` 改造
  - 主路径：`wx.cloud.callFunction('familyOperation', { action: 'getFamilyDetail', params: { familyId }})`
  - catch 分支保留 `_allowDirectReadFallback()` 判定
  - 辅助方法 `_allowDirectReadFallback()` 读 `getApp().globalData.featureFlags.directReadFamilyFallback`（默认 true）
  - FAMILY_NOT_FOUND / PERMISSION_DENIED 返回 null（不抛）

- [x] **T-3.4** `app.js` onLaunch 读取 featureFlags（从 version-config 集合或本地 hardcode `{ directReadFamilyFallback: true }`）

- [x] **T-3.5** 部署云函数 + 发版客户端
  - 云函数 MCP 部署
  - 客户端版本：`v4.3.2-m3-T-7`
  - 监控：operation_logs 中 getFamilyDetail 调用量 & 错误率 < 0.5%

**T-3（灰度 10%）**

- [ ] **T-3.6** 灰度策略：`app.js` 启动时按 `openid` 模 10 运算，落入 0~0 走云函数（~10%）
  - 临时 feature flag `forceCloudGetFamily`
  - 监控：getFamilyDetail_latency P99 < 800ms

**T0（CloudBase 控制台收紧规则）**

- [ ] **T-3.7** CloudBase 控制台更新 `families` 集合 read 规则
  - 原：`auth != null`
  - 新：`auth.openid in resource.memberOpenids || auth.openid == resource.creatorOpenid`
  - **操作前确认**：所有客户端已切云函数（灰度窗口观察无异常）
  - **回滚预案**：若 5 分钟内错误率 > 5%，恢复 `auth != null`（秒级生效）

**T+7 → T+14（移除 fallback）**

- [ ] **T-3.8** 观察 24h 无异常 → 关闭 directReadFamilyFallback（远程开关或下版本默认 false）
- [x] **T-3.9** 下一迭代（v4.3.3）移除 fallback 代码 — **列入 backlog，本迭代不做**

#### FR-2：records update/delete 云函数化（admin 跨归属）

- [x] **T-3.10** 新建 `cloudfunctions/familyOperation/actions/updateRecord.js`
  - 入参：`{ recordId, familyId, data }`
  - 步骤：校验 record.familyId 匹配 → 校验 isMember → getUserRole 判定（viewer 拒，editor 仅自己）→ 白名单过滤 patch → `safePatch.updatedAt/updatedAtTs` → `update()`
  - ALLOWED_FIELDS：`['data', 'startTime', 'endTime', 'startTimeTs', 'endTimeTs', 'note', 'recordType']`
  - logger：start/succeed/fail
  - _对应 design：§4.2_

- [x] **T-3.11** 新建 `cloudfunctions/familyOperation/actions/deleteRecord.js`
  - 入参：`{ recordId, familyId }`
  - 步骤：校验 record.familyId → isMember → `isOwnRecord || role === 'admin'` → `remove()`
  - 边界：文档不存在 → 返回 RECORD_NOT_FOUND（客户端视为幂等成功）
  - logger：start/succeed/fail

- [x] **T-3.12** `familyOperation/errors.js` 新增 `RECORD_NOT_FOUND`

- [x] **T-3.13** `familyOperation/index.js` 注册 updateRecord / deleteRecord 路由

- [x] **T-3.14** `services/record.js` 新增 `_shouldUseCloudFn(record)` 辅助
  - 判定：`myOpenid === recOpenid` → false（直连）；否则 true（云函数）
  - `_getRecordFromCache(recordId)` 辅助从本地缓存取 record

- [x] **T-3.15** `services/record.js.updateRecord` 入口判定
  - `_shouldUseCloudFn(record)` 为 true → 走 `_updateRecordViaCloudFn`
  - 否则保持原直连路径
  - 云函数路径异常交由 FR-A6 `_shouldRequeueAfterFailure`

- [x] **T-3.16** `services/record.js.deleteRecord` 对称改造

- [x] **T-3.17** `services/sync.js.executeOperation` update/delete 分支同样智能判定
  - 取 record 缓存 → `_shouldUseCloudFn` → 分别走云函数或直连

- [x] **T-3.18** 部署云函数（updateRecord / deleteRecord）+ 发版客户端

#### FR-3：deleteBaby 自动解散

- [x] **T-3.19** 新建 `cloudfunctions/familyOperation/lib/family-dissolve.js`
  - 导出 `dissolveFamilyCore(ctx, family, logger)`
  - 逻辑：清所有 `family.members` 的 `users.familyId/familyRole` → `families.doc.remove()` → logger.step
  - _对应 design：§4.3_

- [x] **T-3.20** `actions/deleteBaby.js` phase='finalize' 末尾加自动解散判定
  - 重新 `db.collection('families').doc(familyId).get()` 拉最新
  - 条件：`(f.babies || []).length === 0 && (f.members || []).length === 1` → 调用 `dissolveFamilyCore`
  - 返回中增加 `autoDissolved: true/false`

- [ ] **T-3.21** `actions/dissolveFamily.js` 重构复用 `dissolveFamilyCore`（消除重复代码）
  - 确认权限校验仍在 action 入口（isAdmin）

- [x] **T-3.22** 客户端对齐：`baby-detail.js` / `baby-list.js` / `baby-edit-popup` 删除成功回调
  - `result.autoDissolved === true`：弹 Modal "家庭已自动解散" → `StorageUtil.clear()` → `getApp().resetAllServices()` → `wx.reLaunch('/pages/auth/auth')`
  - 否则正常 toast "已删除"

- [x] **T-3.23** 部署 deleteBaby + dissolveFamily 云函数 + 发版客户端

#### M3 收尾

- [x] **T-3.24** 全量 E2E 回归（m21 + 新建 m22 中 FR-1/2/3 相关用例预跑）
- [x] **T-3.25** M3 commit + 出包（v4.3.2-m3）

---

### 阶段二：M4 — Phase 4 P1/P2 工程加固（~3~4h）

> 各 FR 独立，可拆成多个 PR 滚动发布。

#### FR-4：PermissionGuard.checkCanDelete 防御

- [x] **T-4.1** `services/permission-guard.js.checkCanDelete` 开头加 `hasAuthor` 守卫
  - `!record._openid && !record.createdBy?.userId && !record.creatorId` → 拒绝
  - _对应 design：§5.1_

#### FR-5：createFamily 去冗余入参

- [x] **T-4.2** `services/family.js.createFamily` 调用只传 `{ familyName }`
- [x] **T-4.3** `cloudfunctions/.../createFamily.js` 忽略 creatorId/creatorName/creatorOpenid 入参（silent drop），全部从 ctx 构造
  - _对应 design：§5.2_

#### FR-6：限流扩面

- [x] **T-4.4** `cloudfunctions/familyOperation/lib/rate-limiter.js` 扩展 RATE_LIMITS 配置
  - 新增 refresh_invite / transfer_admin / dissolve_family / remove_member / update_role 五个 key
  - _对应 design：§5.3_

- [x] **T-4.5** 各 action 入口接入 `rateLimiter.check(<key>, openid)`
  - `refreshInviteCode` / `transferAdmin` / `dissolveFamily` / `removeMember` / `updateMemberRole` / `leaveFamily`
  - 触发限流返回 `RATE_LIMITED(retryAfter)`

#### FR-7：AuthService.updateUserInfo 补 updatedAtTs

- [x] **T-4.6** `services/auth.js.updateUserInfo` 写入数据加 `updatedAtTs: Date.now()`
  - _对应 design：§5.4_

#### FR-A9：updateMemberRole 乐观锁重试返回 BUSY

- [x] **T-4.7** `actions/updateMemberRole.js` 重试路径
  - 重试 2 次后 `result.stats.updated === 0` → `logger.partial` + `return errors.BUSY('UPDATE_ROLE_BUSY')`
  - 重试前重拉最新 family 文档（避免陈旧数据）
  - _对应 design：§5.6_

- [x] **T-4.8** `cloudfunctions/familyOperation/errors.js` 新增 `BUSY(code)` 和 `NOT_MEMBER(msg)`

#### FR-A10：transferAdmin isMember 校验

- [x] **T-4.9** `actions/transferAdmin.js` 入口加 `isMember(newAdminId, family)` 校验
  - 失败返回 `NOT_MEMBER('新管理员不在家庭中')`
  - _对应 design：§5.7_

#### FR-A11：refreshInviteCode 冲突检测 + logger

- [x] **T-4.10** `actions/refreshInviteCode.js` 大改
  - 接入限流（T-4.5 覆盖）
  - `logger.start` / `succeed` / `partial` / `fail`
  - 生成 inviteCode 循环 5 次冲突检测（`where({inviteCode}).count()`）
  - 乐观锁更新 `where({_id, inviteCode: oldCode}).update()`；失败返回 BUSY('REFRESH_CONFLICT')
  - _对应 design：§5.8_

#### FR-A12：5 个 action 接入 logger.start

- [x] **T-4.11** `createFamily.js` 首行 `logger.start` + 结尾 succeed/fail
- [x] **T-4.12** `leaveFamily.js` 首行 `logger.start` + 各 status 分支 succeed
- [x] **T-4.13** `transferAdmin.js` logger.start（T-4.9 合并处理）
- [x] joinFamily / refreshInviteCode 已在 T-2.7 / T-4.10 中覆盖
- [x] **T-4.14** ~~logger 统一模式写入 `coding-conventions.md`~~ → 移至 M5 T-5.8

#### FR-A13：logout 清理 service 单例

- [x] **T-4.15** `app.js` 新增 `resetAllServices()` 方法
  - 10 个 Service 加 `static resetInstance()` + app.js 内统一调用
  - 清 globalData（userInfo/familyInfo/familyRole/currentBaby/syncService）
  - 用 try/catch 包裹，单个失败不影响其他
  - _对应 design：§5.10_

- [ ] **T-4.16** 调用点接入 `getApp().resetAllServices()`
  - `pages/profile/profile.js.logout`（StorageUtil.clear 之后）
  - `dissolveFamily` 成功回调（family/settings 页面）
  - `leaveFamily` 成功回调
  - 被踢出场景（被 removeMember 触发）

#### FR-A14：new XxxService() → getInstance()

- [x] **T-4.17** 全项目替换 `new XxxService()` 为 `getInstance()`
  - 已替换 23 处，覆盖 13 个文件（含 ContentFilterService）
  - grep 确认结果为空 ✓
  - _对应 design：§5.11_

#### FR-A15：patrol 反向漂移自动修复

- [x] **T-4.18** `cloudfunctions/patrolMemberOpenids/index.js` 阶段 2 重写
  - 新增常量 `DRY_RUN = process.env.PATROL_DRY_RUN !== 'false'`（默认 true）/ `MAX_REPAIR_PER_RUN = 100`
  - 规则 B：family 不存在 → 清 users.familyId/familyRole
  - 规则 A：joinedAt < 7 天 → push user._id 到 family.members + memberOpenids
  - 规则 C：超期 → 人工告警
  - 修复 step 写 operation_logs
  - _对应 design：§5.12_

#### FR-A16：patrol Set 去重比较

- [x] **T-4.19** `patrolMemberOpenids/index.js` 阶段 1 比较逻辑
  - 改为 `Set(expectedOpenids)` vs `Set(current)` 的双向子集
  - _对应 design：§5.13_

#### FR-A17：E2E rule-simulator 对齐

- [x] **T-4.20** `cloudfunctions/e2eSecurityTest/lib/rule-simulator.js` 对齐线上规则
  - `families.update`: 新增 `'auth.openid in doc.memberOpenids'`
  - `babies.delete`: 改为 `false`（禁止客户端直接删除）
  - _对应 design：§5.14_

- [ ] **T-4.21** ~~`modules/m22-v432Fixes.js` 新增模拟器 vs 真实规则一致性用例~~ → 移至 M5 T-5.1

#### FR-A18：clearBabyData cursor 云端续传

- [x] **T-4.22** `actions/clearBabyData.js` 续传 + 幂等改造
  - 续传恢复时检查 baby 是否仍存在（BABY_NOT_FOUND 幂等处理）
  - finalize 阶段 `babies.doc(babyId).remove()` 幂等：已删除时 logger.step('skip')
  - 自动解散逻辑：与 deleteBaby 一致（使用 dissolveFamilyCore）
  - _对应 design：§5.15_

- [ ] **T-4.23** `packageSocial/pages/settings/settings.js.clearAllCloudData` 循环上限放宽到 20

#### P2 改进项

- [x] **T-4.24** ~~`deleteBaby.js` phase 4 logger 状态准确~~ → 已在 M3/T-3.20 中完成
- [ ] **T-4.25** `utils/storage.js` 增加 `_checkStorageQuota()` 8MB/10MB 阈值保护（FR-P2-2）— 未实施，列入 backlog
- [x] **T-4.26** `utils/db-helper.js.fetchAll` 加 MAX_PAGES=100 默认 + 超限告警（FR-P2-3）
- [ ] **T-4.27**（可选）新建 `miniprogram/behaviors/safe-popup-observer.js`（FR-P2-4）— 跳过
- [ ] **T-4.28** 清理 `services/sync.js` deprecated 的 4 个方法（~120 行，FR-P2-5）— 未实施，列入 backlog

#### M4 收尾

- [x] **T-4.29** 云函数部署：familyOperation + patrolMemberOpenids — 均已部署成功
- [x] **T-4.30** M4 commit（`7801ea3`）+ 出包（v4.3.2-m4）+ E2E 189/189 全绿 + 合并 develop `b7a3979`

---

### 阶段三：M5 — E2E 回归 + 文档同步 + 发版（~1h）

#### E2E 扩展

- [ ] **T-5.1** `cloudfunctions/e2eSecurityTest/modules/m22-v432Fixes.js` 新建
  - 至少 13 条用例，覆盖 FR-A1~A8 / FR-1~3 / FR-A15 / FR-A17（详见 design §11.1）
  - 每条用例独立，含 setup / test / teardown

- [ ] **T-5.2** `cloudfunctions/e2eSecurityTest/index.js` 注册 m22 模块

- [ ] **T-5.3** 跑全量 E2E（含 m20/m21/m22）
  - 目标：189 + 13 = 202/202 通过

- [ ] **T-5.4** 同步 `cloudfunctions/e2eSecurityTest/v43-prod/*` 镜像 actions（若该机制仍保留）

#### 文档同步（FR-8）

- [ ] **T-5.5** `architecture.md` §6.3 更新
  - families.read 规则表达式（collapse `auth != null` → 成员判定）
  - 新增 FR-1/2 云函数化路径说明
  - 新增 §6.5 单例规范 "禁用 new XxxService()" 规则
  - _涉及：FR-8_

- [ ] **T-5.6** `data-model.md`
  - `families.inviteCodeExpiry` 类型改为 `Date`（原 `string(ISO)`）
  - `operation_logs.meta` 新增 `cursor?: string` 字段
  - _涉及：FR-8, FR-A18_

- [ ] **T-5.7** `service-api.md`
  - FamilyService 新增 `getFamilyDetail` 签名
  - RecordService `updateRecord` / `deleteRecord` 标注"智能判定"
  - `familyOperation.updateRecord` / `deleteRecord` / `getFamilyDetail` 3 个 action 签名
  - _涉及：FR-8, FR-1, FR-2_

- [ ] **T-5.8** `coding-conventions.md`
  - 单例规范：强制 `getInstance()` + 代码示例
  - logout checklist 新增"清内存缓存"条目
  - operation_logs action 统一模式（design §5.9 logger 模板）
  - _涉及：FR-8, FR-A13, FR-A14, FR-A12_

- [ ] **T-5.9** `component-library.md`
  - swipe-close behavior 覆盖清单：`baby-edit-popup / feeding-popup / sleep-popup / diaper-popup / temperature-popup / growth-popup` 共 6 个
  - _涉及：FR-8, FR-A2_

- [ ] **T-5.10** `CHANGELOG.md` 新增 v4.3.2 区块
  - 按 Phase 分小节（M1/M2/M3/M4）
  - Security（FR-1 规则收紧 / FR-A4 归属校验）
  - Fixed（FR-A1/A2/A3/A5/A6/A7/A8）
  - Changed（FR-A14 单例 / FR-A13 logout 清缓存）
  - Added（FR-A15 patrol 自修复 / FR-A18 cursor 云端续传）

#### 版本号同步

- [ ] **T-5.11** 版本号同步至 `v4.3.2`
  - `miniprogram/app.js globalData.version`
  - `architecture.md` 版本戳
  - `coding-conventions.md` 版本戳
  - `README.md` 版本表
  - `component-library.md` / `service-api.md` / `data-model.md` 版本戳
  - `project.config.json` 若有版本字段

#### 收尾

- [ ] **T-5.12** `specs/v4.3.2-cursor-and-patrol/` 四件套状态标记
  - requirements.md → ✅ 已完成
  - design.md → ✅ 已完成
  - tasks.md → ✅ 已完成
  - review-findings.md → 保留作为历史归档

- [ ] **T-5.13** 最终 commit 推送
  - 本地合并/等待 PR 按 git-flow：feature → develop → release/v4.3.2 → master，打 tag

- [ ] **T-5.14** 部署 Release 后观察灰度（design §10.2 / §11.2 监控指标 48h）

---

## 任务依赖关系

```
T-0.1 ~ T-0.6（开发前准备）
       │
       ▼
╭─── M1 Phase 1（1.5~2h）───────────────────╮
│  T-1.1 ~ T-1.10（纯客户端，可并行）         │ 独立出包，不依赖后续
╰─────────────┬───────────────────────────╯
              ▼
╭─── M2 Phase 2（3~4h）─────────────────────╮
│  T-2.1 ~ T-2.6（客户端）                   │
│     ↓                                     │
│  T-2.7 ~ T-2.10（云函数部署 + 冒烟）       │ 依赖云函数已部署
│     ↓                                     │
│  T-2.11 出包                              │
╰─────────────┬───────────────────────────╯
              ▼
╭─── M3 Phase 3（3~5h，严格灰度）─────────────╮
│  T-3.1 ~ T-3.5 T-7：部署云函数 + 发版       │
│  T-3.6       T-3：灰度 10%                │
│  T-3.7       T0 ：规则收紧                │
│  T-3.8       T+7：关 fallback             │
│  T-3.10 ~ T-3.18  FR-2 records 云函数化   │ 与 FR-1 灰度并行
│  T-3.19 ~ T-3.23  FR-3 deleteBaby 自动解散 │
│  T-3.24 ~ T-3.25  回归 + 出包              │
╰─────────────┬───────────────────────────╯
              ▼
╭─── M4 Phase 4（3~4h）─────────────────────╮
│  T-4.1 ~ T-4.28（各 FR 独立，可多线并行）   │ 独立 PR 滚动
│  T-4.29 ~ T-4.30 云函数部署 + 出包         │
╰─────────────┬───────────────────────────╯
              ▼
╭─── M5 收尾（1h）──────────────────────────╮
│  T-5.1 ~ T-5.4   E2E 扩展 + 全量回归       │
│  T-5.5 ~ T-5.10  文档同步                 │
│  T-5.11          版本号同步                │
│  T-5.12 ~ T-5.14 收尾 + 发版监控           │
╰───────────────────────────────────────────╯
```

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 | 对应 design |
|------|--------|------|----------|------------|
| FR-1 families.read 收紧后老客户端启动失败 | 高 | 极高 | directReadFallback 开关 + T-7 → T+14 严格灰度 + 秒级规则回滚 | §1.3 / §4.1 |
| FR-2 admin 判定错误导致自我记录走云函数 | 中 | 低 | 降级云函数路径性能 +1 RTT，正确性不受影响 | §9 决策 3 |
| FR-A15 patrol 自修复误伤"刚离开"用户 | 中 | 中 | joinedAt < 7 天阈值 + 单次上限 100 + DRY_RUN 观察模式 | §5.12 |
| FR-A7 队列翻新遇权限失效（用户切家） | 低 | 低 | 依赖 syncOfflineQueue 外层 MAX_RETRY_COUNT 丢弃 + toast 提示 | §3.3 边界 |
| FR-A8 新家 push 后 users.familyId 失败 | 低 | 中 | 返回 STALE_USER_POINTER warning + patrol 规则 A 补偿 | §3.4 |
| FR-3 autoDissolved 触发 UI 路径遗漏 | 中 | 高 | baby-detail / baby-list / baby-edit-popup 三处都加判定 | §4.3 |
| M3 规则收紧期间发现 bug 需回滚 | 中 | 高 | 控制台秒级恢复 `auth != null` + 客户端 fallback 接管 | §4.1 回滚预案 |
| 云函数部署节奏与客户端发版不同步 | 中 | 中 | 每个 M 内云函数先部署并 MCP 冒烟，再发客户端 | §1.2 分阶段依赖 |
| E2E m22 用例未覆盖到某个 FR | 低 | 低 | design §11.1 13 条用例清单 + 代码 review 阶段对照 | §11.1 |
| FR-A14 单例替换遗漏导致部分页面仍用旧实例 | 低 | 低 | 替换后 grep 双检；单例 constructor 内有 `if (instance) return instance` 兜底 | §5.11 |

---

## 质量门禁（每个 M 必过）

- **M1**：真机 5 个弹窗 + family-join + record 单条删除冒烟通过
- **M2**：E2E m20/m21 全绿；离线 create→update→update 端到端验证
- **M3**：T0 规则收紧后 24h 监控 getFamilyDetail 错误率 < 0.5%；admin 删他人记录云端验证成功
- **M4**：全量 E2E 202/202（含 m22 新用例 13 条）；patrol 自修复在 DRY_RUN=true 模式观察无误伤候选
- **M5**：六份核心文档版本号一致；CHANGELOG 按 Phase 完整记录；feature 分支可合并到 develop

---

## 后续迭代（v4.3.3+）Backlog

> 本迭代未做、列入后续：

- **T-R.1** FR-1 灰度稳定后移除客户端 `directReadFamilyFallback` 代码
- **T-R.2** 存量无 `_openid` babies 批量修复脚本（v4.3.1 遗留）
- **T-R.3** FR-P2-4 弹窗 null 守卫 behavior 体系化（本迭代最小可用）
- **T-R.4** `operation_logs` / `rate_limits` 集合 TTL 索引（需 CloudBase 能力）
- **T-R.5** 客户端"网络健康度"可视化（结合 NetworkUtil 监听数据）
- **T-R.6** FR-A8 路径 dry-run 模式（joinFamily 转换前模拟预演）
- **T-R.7** `db-helper.fetchAll` 流式迭代器 API（替代 maxPages 参数）
- **T-R.8** FR-P2-2 `utils/storage.js` 增加 `_checkStorageQuota()` 8MB/10MB 阈值保护（T-4.25 未实施）
- **T-R.9** FR-P2-5 `services/sync.js` 清理 deprecated 的 subscribeRecords 等 4 个方法（T-4.28 未实施）
- **T-R.10** T-3.21 `dissolveFamily.js` 重构复用 `dissolveFamilyCore`（消除重复代码）
- **T-R.11** T-4.16 `resetAllServices()` 调用点接入（logout/dissolve/leave/被踢出）
- **T-R.12** T-4.23 `settings.js.clearAllCloudData` 循环上限放宽到 20

---

*本计划 v1.1 产出于 2026-04-21；M1~M4 代码实施已完成，M5 收尾待执行。每完成一个 M 里程碑更新 tasks.md 标记为 ✅。*
