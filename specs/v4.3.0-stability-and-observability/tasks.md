# 实施计划 - v4.3.0 稳定性加固与云函数可观测性

> 版本：v1.0 | 日期：2026-04-20 | 状态：✅ 已完成（2026-04-20）

---

## 实施概览

预计总工时：**约 4.5 天**
关键里程碑：
- **M1（Day 1）**：客户端基础设施 — FamilyContext / 单例统一 / PermissionGuard
- **M2（Day 2）**：客户端稳定性 — 离线队列 / familyId 改造 / 缓存修正 / PermissionGuard 接入
- **M3（Day 3）**：云函数模块化 — actions 拆分 / errors.js / leaveFamily 契约
- **M4（Day 4）**：云函数可观测性 — logger / 限流持久化 / 断点续传 / 巡检
- **M5（Day 4.5）**：回归验证 + 文档同步 + 版本发版

---

## 任务列表

### 阶段一：M1 客户端基础设施

- [x] **T-1.1** 新建 `miniprogram/utils/family-context.js`
  - 实现 `resolve() / resolveForBaby(baby) / getUserId() / getCurrentRole() / getCurrentBabyId() / getFamily() / getCurrentMemberDetail()` 7 个静态方法
  - 单元自检：在 app.js 中临时加 log 验证 `FamilyContext.resolve()` 返回值
  - 提交：`feat(utils): 新建 FamilyContext 统一上下文读取 FR-1`
  - 验收：`grep -rn "FamilyContext" miniprogram/utils/family-context.js` 至少 10 处，与 design.md §3.1 代码一致
  - _依赖：无 | 涉及：FR-1_

- [x] **T-1.2** 新建 `miniprogram/services/permission-guard.js`
  - 实现 `PermissionError` class（含 `code='PERMISSION_DENIED'`）
  - 实现 `PermissionGuard.require(permission) / requireCanDelete(record) / check(permission)`
  - 提交：`feat(services): 新建 PermissionGuard 权限预检 FR-3`
  - 验收：PermissionError 类继承 Error 且含 code 字段；require 抛错行为符合 design §3.2
  - _依赖：T-1.1 | 涉及：FR-3_

- [x] **T-1.3** 单例模式统一重构
  - `miniprogram/services/todo.js`：`module.exports = new TodoService()` → `module.exports = TodoService`
  - `miniprogram/utils/deduplication.js`：同上
  - `miniprogram/utils/network.js`：同上
  - 调用方批量改造：
    - `home.js` / `discover.js` / `report-popup.js`：`require('.../todo')` → `require('.../todo').getInstance()`
    - `record.js` 内的 `this.deduplicationUtil` / `this.networkUtil` 初始化改为 `getInstance()`
  - 提交：`refactor(services,utils): 单例模式统一 TodoService/DeduplicationUtil/NetworkUtil FR-2`
  - 验收：`grep -rn "= new TodoService\|= new DeduplicationUtil\|= new NetworkUtil" miniprogram/` 零匹配
  - _依赖：无 | 涉及：FR-2_

---

### 阶段二：M2 客户端稳定性

- [x] **T-2.1** `RecordService.createRecord` 离线路径补 `createdBy`
  - 第 248-265 行（离线路径）的 `StorageUtil.addToOfflineQueue` data 字段补完整 `createdBy: { userId, nickName, avatar }`
  - 第 301-318 行（降级路径）同样处理
  - 提交：`fix(services): 离线队列 create 补齐 createdBy 对象 FR-4`
  - 验收：断网测试 → 记录创建 → 重连同步 → 其他家庭成员能看到创建者昵称头像
  - _依赖：无 | 涉及：FR-4_

- [x] **T-2.2** `SyncService.executeOperation` 时间戳规整
  - `case 'create'` 执行 `db.collection().add({ data })` 前：
    - `data.startTime` 若为字符串 → `new Date(data.startTime)`
    - `data.createdAt` / `updatedAt` 同理
    - `data.updatedAt = this.db.serverDate()` 覆盖（保持双时间戳）
  - 提交：`fix(services): sync 执行前规整离线 data 时间戳格式 FR-4`
  - 验收：离线队列同步上云后，`startTime` 在控制台显示为 Date 类型而非字符串
  - _依赖：T-2.1 | 涉及：FR-4_

- [x] **T-2.3** `RecordService` 全量 familyId 改造 + FamilyContext 接入
  - 第 153 / 221 / 253 / 283 / 306 / 368 行的 `familyInfo?._id || userInfo?.familyId || ''` 全部改为 `FamilyContext.resolve()`
  - `createRecord` 内的 `userInfo._id` 获取改为 `FamilyContext.getUserId()`
  - `familyMember` 查找改为 `FamilyContext.getCurrentMemberDetail()`
  - 提交：`refactor(services): RecordService 改走 FamilyContext 统一上下文 FR-15`
  - 验收：`grep -n "userInfo?.familyId \|\| ''" miniprogram/services/record.js` 零匹配
  - _依赖：T-1.1 | 涉及：FR-15_

- [x] **T-2.4** 其他模块 familyId 改走 FamilyContext
  - `todo.js:141/202`：`baby.familyId || ''` → `FamilyContext.resolveForBaby(baby)`
  - `vaccine.js:122` / `milestone.js:114` / `growth.js:189` / `report-popup.js:366` / `export.js:66/143` 同上
  - 提交：`refactor(pages,components): familyId 改走 FamilyContext.resolveForBaby FR-15`
  - 验收：`grep -rn "baby\.familyId \|\| ''" miniprogram/` 零匹配
  - _依赖：T-1.1 | 涉及：FR-15_

- [x] **T-2.5** 缓存失效点补齐 + 合并策略修正
  - `RecordService.saveToLocalCache`：末尾加 `this._todayStatsCache = null;`
  - `RecordService.deleteRecordFromCache`：末尾同上
  - `RecordService.mergeRecords`：遇 _id 相同时对比 `updatedAtTs`，保留较大者（local `_offline=true` 时强制保留本地）
  - 提交：`fix(services): 补齐 todayStatsCache 失效点 + mergeRecords 按 updatedAtTs 比较 FR-6`
  - 验收：创建记录后首页"今日统计"立即刷新；离线修改未同步时不会被云端版本覆盖
  - _依赖：无 | 涉及：FR-6_

- [x] **T-2.6** `cleanOrphanedCache` 时机修正
  - `app.js`：删除 `setTimeout(() => this.cleanOrphanedCache(), 5000)`
  - 改为 `this.globalData.initPromise.then(() => this.cleanOrphanedCache()).catch(() => {})`
  - 提交：`fix(app): cleanOrphanedCache 改为 initPromise.then 触发 FR-6`
  - 验收：慢网络场景下不会误删正在使用的宝宝缓存
  - _依赖：无 | 涉及：FR-6_

- [x] **T-2.7** `RecordService` CRUD 接入 PermissionGuard
  - `createRecord` 第一行：`PermissionGuard.require('record.create')`
  - `updateRecord` 第一行：`PermissionGuard.require('record.edit')`
  - `deleteRecord` 第一行：先查记录 → `PermissionGuard.requireCanDelete(record)`
  - 提交：`feat(services): RecordService CRUD 接入 PermissionGuard 前置预检 FR-14`
  - 验收：Viewer 角色调用 createRecord 立即抛 PermissionError，不发起网络请求
  - _依赖：T-1.2 + T-1.1 | 涉及：FR-14_

---

### 阶段三：M3 云函数模块化

- [x] **T-3.1** 建立 `cloudfunctions/familyOperation/` 新目录结构
  - 创建 `errors.js` 错误码注册表（参考 design §3.5，共 15 个错误码）
  - 创建 `lib/auth.js`：`getUserFromOpenid(db, openid)` / `isAdmin(userId, family)` / `isMember(userId, family)`
  - 创建 `lib/family.js`：`getFamily(db, id)` / `clearUserFamily(db, _, userId)` / `familyNotFound()` / `permissionDenied(msg)`
  - 创建 `lib/db-helper.js`：`getAllDocs(query, batchSize)` / `chunkedDelete(db, collection, ids, concurrency)`
  - 提交：`refactor(cloud): familyOperation 目录结构与工具函数模块化 FR-7`
  - 验收：目录结构与 design §3.4 一致
  - _依赖：无 | 涉及：FR-7_

- [x] **T-3.2** 拆分 13 个 actions 到独立文件
  - 按原 index.js 各 action 函数平移到 `actions/<name>.js`
  - 每个 action 函数签名统一为 `async (ctx, params) => { ... }`
  - 工具函数调用改为 `require('../lib/xxx')`
  - 提交：`refactor(cloud): 拆分 13 个 actions 到独立文件 FR-7`
  - 验收：`ls cloudfunctions/familyOperation/actions/*.js | wc -l` = 13
  - _依赖：T-3.1 | 涉及：FR-7_

- [x] **T-3.3** 重写 `index.js` 为 dispatch 入口
  - 仅保留 main + actions dispatch + 全局异常捕获
  - 控制在 < 80 行
  - 提交：`refactor(cloud): index.js 缩减为 dispatch 入口 FR-7`
  - 验收：`wc -l cloudfunctions/familyOperation/index.js` < 80
  - _依赖：T-3.2 | 涉及：FR-7_

- [x] **T-3.4** `leaveFamily` 契约重构（云函数侧）
  - `actions/leaveFamily.js` 按 design §3.3 实现 `{ status: ... }` 状态机
  - 兼容返回（过渡 3 周）：同时返回 legacy `needTransfer` / `familyDissolved` / `familyNotFound` / `notMember` 字段供老版客户端读取
  - 提交：`feat(cloud): leaveFamily action 契约改为 data.status 状态机（兼容 legacy） FR-5`
  - 验收：返回体同时含 `status` 枚举 + legacy 字段
  - _依赖：T-3.2 | 涉及：FR-5_

- [x] **T-3.5** `leaveFamily` 契约重构（客户端侧）
  - `family.js.leaveFamily` 内部改用通用 `_callFamilyOperation('leaveFamily', ...)`
  - 返回结构化对象 `{ status, otherMembers?, message }`
  - 更新调用方：
    - `packageSocial/pages/family/family.js`（退出家庭按钮处理）
    - `pages/auth/auth.js._handleInviteCodeForExistingUser`（替换旧家庭流程）
  - 提交：`refactor(services,pages): leaveFamily 客户端契约统一为 status 状态机 FR-5`
  - 验收：
    - 唯一管理员尝试退出 → 弹窗让用户选转让对象
    - 最后成员退出 → 显示"家庭已解散"并跳转
    - 正常成员退出 → 正常跳转
  - _依赖：T-3.4 | 涉及：FR-5_

---

### 阶段四：M4 云函数可观测性

- [x] **T-4.1** `operation_logs` 集合与 `lib/logger.js`
  - 在 CloudBase 控制台创建 `operation_logs` 集合，ACL 设为 PRIVATE
  - 实现 `lib/logger.js` 的 `OperationLogger` 类（`start / step / succeed / partial / fail`）
  - 所有 logger 方法 `.catch(() => {})`，日志失败不阻断业务
  - 提交：`feat(cloud): 新增 operation_logs 集合与 OperationLogger 类 FR-9`
  - 验收：手动调一次 `dissolveFamily`，`operation_logs` 集合有对应记录
  - _依赖：T-3.1 | 涉及：FR-9_

- [x] **T-4.2** `dissolveFamily` / `removeMember` / `clearBabyData` 接入 OperationLogger
  - 每个 action 开头 `logger.start({ context })`
  - 关键步骤 `logger.step(name, status, extra)`
  - 成功 `logger.succeed(result)`；部分失败 `logger.partial(reason)`
  - 提交：`feat(cloud): 关键 actions 接入 OperationLogger 补偿日志 FR-9`
  - 验收：`operation_logs` 集合有 dissolve 和 clearBabyData 的 steps 数组记录
  - _依赖：T-4.1 | 涉及：FR-9_

- [x] **T-4.3** `clearBabyData` 断点续传 + 分批并发
  - 按 design §3.7 实现 cursor 参数 + phase 状态机 + `chunkedDelete(ids, 10)` 并发
  - `settings.js` 客户端循环调用直至 `status='succeeded'`
  - 客户端 cursor 持久化到 `wx.setStorageSync('_clear_baby_cursor_{babyId}', cursor)` 供断网恢复
  - 提交：`feat(cloud,pages): clearBabyData 断点续传 + 分批并发 FR-10`
  - 验收：制造 3000+ 条 records → 触发清除 → 自动多次调用直至完成
  - _依赖：T-3.2 + T-4.2 | 涉及：FR-10_

- [x] **T-4.4** `rate_limits` 集合与 `lib/rate-limit.js`
  - 在 CloudBase 控制台创建 `rate_limits` 集合，ACL 设为 PRIVATE，配置 `expireAt` 字段 TTL 索引
  - 实现 `lib/rate-limit.js` 的 `RateLimiter.check(key)` 方法（参考 design §3.8）
  - `joinFamily` action 改用 `ctx.rateLimiter.check(\`invite_${openid}\`)` 替代内存 Map
  - 提交：`feat(cloud): 持久化限流 rate_limits + joinFamily 接入 FR-11`
  - 验收：快速连续调用 `joinFamily` 6 次，第 6 次返回 `RATE_LIMITED`；1 分钟后恢复
  - _依赖：T-3.1 | 涉及：FR-11_

- [x] **T-4.5** 时间戳格式云函数侧统一
  - 全局替换所有 `new Date().toISOString()` 为 `new Date()`
  - 同步补 `updatedAtTs: Date.now()`
  - 提交：`refactor(cloud): 时间戳格式从 ISO 字符串改为 Date + 双时间戳 FR-13`
  - 验收：`grep -rn "toISOString()" cloudfunctions/familyOperation/` 零匹配
  - _依赖：T-3.2 | 涉及：FR-13_

- [x] **T-4.6** 新建 `patrolMemberOpenids` 云函数
  - 新建目录 `cloudfunctions/patrolMemberOpenids/`，含 index.js / package.json / config.json
  - config.json 配置每日 00:00 cron 定时触发
  - index.js 按 design §3.9 实现巡检逻辑 + 结果写入 `operation_logs`
  - 部署后手动触发一次（dryRun 模式）验证
  - 提交：`feat(cloud): 新增 patrolMemberOpenids 每日巡检云函数 FR-12`
  - 验收：手动触发返回 `{ scanned, consistent, fixed, failed, warnings }`；结果写入 operation_logs
  - _依赖：T-4.1 | 涉及：FR-12_

---

### 阶段五：M5 回归验证 & 文档 & 发版

- [x] **T-5.1** `e2eSecurityTest` 重跑 + 补 v4.3 新用例
  - 部署最新云函数
  - 跑完 v4.2.1 163 条用例确认 100% 通过
  - 新增 10+ 条 v4.3 用例（logger / rate-limit / cursor / permission-guard / leaveFamily 新契约）
  - 提交：`test(cloud): 补充 v4.3 新特性 E2E 用例`
  - 验收：173+ 条用例全通过
  - _依赖：T-4.6 | 涉及：NFR-1_

- [x] **T-5.2** 手动冒烟测试清单
  - [x] 首次登录 / 自动登录 / 邀请码加入家庭
  - [x] 创建家庭 / 解散家庭（看到 operation_logs 记录）
  - [x] 离线创建记录 → 重连 → 其他成员能看到昵称头像
  - [x] Viewer 账号尝试创建 → PermissionGuard 拦截（不发网络请求）
  - [x] 多宝切换 → 快速切回 → 记录不丢失（familyId 统一源）
  - [x] 管理员清除 3000+ 条记录 → 自动多次调用直至完成
  - [x] 暗色模式切换 / TabBar 30s 节流 / 分享链接 / 彩蛋等既有功能不受影响
  - 提交：`test: v4.3.0 手动冒烟测试通过`
  - 验收：所有冒烟项 check
  - _依赖：T-5.1 | 涉及：NFR-1_

- [x] **T-5.3** 文档同步（6 份）
  - `architecture.md`：§3 分层架构图补充云函数模块化层（actions/lib/errors）；§7 追加补偿日志 + 持久化限流 + 巡检机制
  - `coding-conventions.md`：§8 补充 FamilyContext / PermissionGuard 使用约定与代码模板
  - `service-api.md`：新增 FamilyContext / PermissionGuard API 章节；移除 leaveFamily ⚠️ 特殊契约章节；errors 错误码列表
  - `data-model.md`：§2 新增 `operation_logs` 和 `rate_limits` 集合；`families.updatedAt` 类型 ISO → Date（v4.3.0+）
  - `CHANGELOG.md`：新增 [v4.3.0] 区块（Added / Changed / Deprecated / Removed / Security）
  - `README.md` §1 产品版本 + §12 版本历史
  - 各 commit 按 `docs(xxx): ...` 粒度拆分
  - 验收：`grep -n "^> \*\*版本\*\*: v4.3.0" architecture.md coding-conventions.md service-api.md data-model.md` 四个匹配
  - _依赖：T-5.2 | 涉及：开发后_

- [x] **T-5.4** 版本号全量同步（workflow §3.3.4 MINOR 级 8 项）
  - `CHANGELOG.md` / `README.md` §1 / `README.md` §12 / `architecture.md` / `coding-conventions.md` / `git-flow.md` §5 / `profile.wxml`（via app.js） / `app.js` `globalData.version`
  - 提交：`chore: bump version to v4.3.0`
  - 验收：`grep -rn "v4.3.0" README.md architecture.md coding-conventions.md service-api.md data-model.md specs/workflow/git-flow.md miniprogram/app.js CHANGELOG.md` 全部命中
  - _依赖：T-5.3 | 涉及：开发后_

- [x] **T-5.5** 更新 tasks.md 状态 + 本 spec 目录标记 ✅
  - 本 tasks.md 头部状态 → `✅ 已完成（YYYY-MM-DD）`
  - 所有 checkbox 勾选
  - `requirements.md` / `design.md` / `plan.md` 同样标记为 ✅ 已完成
  - 提交：`docs(specs): 标记 v4.3.0 spec 为已完成`
  - 验收：本目录 `grep -rn "待确认\|待开发\|进行中" specs/v4.3.0-stability-and-observability/` 零匹配
  - _依赖：T-5.4 | 涉及：开发后_

---

## 任务依赖关系

```
M1 基础设施:
  T-1.1 (FamilyContext) ──┐
  T-1.2 (PermissionGuard) ┤ (依赖 T-1.1)
  T-1.3 (单例统一)        ┘ (可并行)
                          │
                          ▼
M2 客户端稳定性:
  T-2.1 (离线 createdBy)  ──┐
  T-2.2 (sync 时间戳)     ──┼── (依赖 T-2.1)
  T-2.3 (record FamilyContext)──┤ (依赖 T-1.1)
  T-2.4 (其他页 FamilyContext) ─┤ (依赖 T-1.1)
  T-2.5 (缓存失效点)       ──┤
  T-2.6 (cleanOrphanedCache) ─┤
  T-2.7 (Guard 接入)        ──┘ (依赖 T-1.2 + T-1.1)
                          │
                          ▼
M3 云函数模块化:
  T-3.1 (errors + lib/)    ──┐
  T-3.2 (actions 拆分)     ──┼── (依赖 T-3.1)
  T-3.3 (index 重写)       ──┤ (依赖 T-3.2)
  T-3.4 (leaveFamily 云端)  ─┤ (依赖 T-3.2)
  T-3.5 (leaveFamily 客户端)─┘ (依赖 T-3.4)
                          │
                          ▼
M4 云函数可观测性:
  T-4.1 (OperationLogger)  ──┐
  T-4.2 (actions 接入 logger)─┤ (依赖 T-4.1)
  T-4.3 (断点续传)          ──┤ (依赖 T-3.2 + T-4.2)
  T-4.4 (持久化限流)        ──┤ (依赖 T-3.1)
  T-4.5 (时间戳统一)        ──┤ (依赖 T-3.2)
  T-4.6 (patrolMemberOpenids)─┘ (依赖 T-4.1)
                          │
                          ▼
M5 回归 & 文档:
  T-5.1 (E2E 重跑) → T-5.2 (冒烟) → T-5.3 (文档) → T-5.4 (版本号) → T-5.5 (标记 ✅)
```

---

## 工时估算

| 阶段 | 任务数 | 估时 |
|------|-------|------|
| M1 客户端基础设施 | 3 | 1d |
| M2 客户端稳定性 | 7 | 1d |
| M3 云函数模块化 | 5 | 1d |
| M4 云函数可观测性 | 6 | 1d |
| M5 回归 & 文档 | 5 | 0.5d |
| **总计** | **26** | **4.5d** |

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 云函数模块化拆分误改逻辑 | 中 | 高 | 每拆一个 action 立即跑对应 e2eSecurityTest 模块 |
| `leaveFamily` 新契约发布时老版本客户端仍在用 | 高 | 中 | 云函数返回 legacy 字段兼容 3 周 |
| 持久化限流并发 CAS 冲突 | 低 | 中 | 失败时降级为允许（best-effort） |
| 断点续传 cursor 格式演进 | 低 | 低 | cursor 包含 schema 版本号，云函数优先识别最新 |
| 巡检函数误修复 | 低 | 高 | 前 1 周 dryRun 模式，确认无误才启用自动修复 |
| E2E 用例覆盖不全漏掉契约变更 | 中 | 中 | T-5.1 强制新增 10+ 条 v4.3 专项用例 |
| 多个文件改造同步不同步导致编译不通过 | 中 | 中 | 每个阶段末做编译验证；合入前开发者工具构建一次 |
| 工时超出 4.5 天 | 中 | 低 | 若 M4 提前发现云函数接口不稳定，可切分 T-4.3 / T-4.6 到 v4.3.1 |

---

## 不在本次范围

以下问题不在 v4.3.0 范围内，留到 **v4.3.1** 或更远：

- `getRecords` 写死 limit=20 的性能优化（第 4 轮 P2）
- `ai.js` 接入新模型（与稳定性无关）
- 清理根目录冗余文件（v4.3.1 可带过）
- 迁移云函数（`migrateRecordUserId` 等）的最终归档

---

*文档维护：执行过程中标记任务完成状态；发现预期外变更时更新 design.md「文件变更清单」保持同步。*
