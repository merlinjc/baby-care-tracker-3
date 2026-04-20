# 版本更新日志（CHANGELOG）

> 格式遵循 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循[语义化版本](https://semver.org/)。
> MAJOR 版本赋予正式代号，MINOR/PATCH 沿用所属 MAJOR 代号。

---

## 代号注册表

| MAJOR 版本 | 代号 | 含义 |
|-----------|------|------|
| v1.x | **Sprout**（萌芽） | 项目破土而出，核心记录功能诞生 |
| v2.x | **Cradle**（摇篮） | 全面重构奠定架构基座，如摇篮承托成长 |
| v3.x | **Lullaby**（摇篮曲） | 家庭协作、彩蛋、夜间模式，陪伴宝宝入眠 |
| v4.x | **Milo**（米洛） | 美拉德暖色 UI 重设计，如营养麦芽饮品滋养成长 |

---

## [v4.3.0] Milo — 2026-04-20

### Added

**客户端基础设施**：
- `miniprogram/utils/family-context.js`：新建 `FamilyContext` 工具类（7 个静态方法 `resolve` / `resolveForBaby` / `getUserId` / `getCurrentRole` / `getCurrentBabyId` / `getFamily` / `getCurrentMemberDetail`），统一 familyId 单一来源，解决 v4.2 三源漂移问题（FR-1/FR-15）
- `miniprogram/services/permission-guard.js`：新建 `PermissionGuard` 权限预检器（`require` / `requireCanDelete` / `check` / `checkCanDelete` + `PermissionError` 类），服务层写方法第一道闸（FR-3/FR-14）

**云函数模块化（`cloudfunctions/familyOperation/`）**：
- `errors.js`：15 个统一错误码注册表 + `ok()` 构造器（FR-8）
- `lib/auth.js`：`getUserFromOpenid` / `isAdmin` / `isMember` 工具
- `lib/family.js`：`getFamily` / `clearUserFamily` 工具
- `lib/db-helper.js`：`getAllDocs` / `chunkedDelete`（并发 10 批量删除）
- `lib/logger.js`：`OperationLogger`（落盘 `operation_logs` 集合）
- `lib/rate-limit.js`：`RateLimiter`（持久化限流，写 `rate_limits` 集合）
- `lib/invite-code.js`：邀请码生成器
- `actions/` 目录：13 个 action 各自独立文件，替代 1000 行单文件 switch

**云函数新增**：
- `cloudfunctions/patrolMemberOpenids/`：每日 0 点巡检 memberOpenids 一致性云函数（含 dryRun 参数、断点续传 cursor、操作日志落盘）（FR-12）

**云端资源**：
- CloudBase NoSQL 集合 `operation_logs`（action+startedAt 复合索引 + status 索引 + PRIVATE ACL）
- CloudBase NoSQL 集合 `rate_limits`（key 唯一索引 + windowStart 索引 + PRIVATE ACL）
- 定时触发器 `patrolMemberOpenids.dailyPatrol`（cron `0 0 0 * * * *`）

**文档**：
- `data-model.md` §2.7 `operation_logs` 集合 + §2.8 `rate_limits` 集合
- `coding-conventions.md` §8.4 云函数结构规范（actions/ + lib/ 目录约定 + action 签名 + 接入检查清单）
- `coding-conventions.md` §9 权限体系重写为客户端 PermissionGuard + 服务端纵深防御双重校验
- `service-api.md` 新增 FamilyContext / PermissionGuard 工具表
- `specs/v4.3.0-stability-and-observability/` 四件套 spec 文档（requirements / design / tasks / plan）

### Changed

**客户端稳定性**：
- `miniprogram/services/todo.js` / `utils/deduplication.js` / `utils/network.js`：单例模式统一，导出类，新增 `getInstance()` 静态方法（FR-2）
- `miniprogram/services/record.js` + 6 个页面/组件：全部 `baby.familyId || ''` / `userInfo.familyId || ''` / `familyInfo?._id || userInfo?.familyId` 替换为 `FamilyContext.resolve()` / `resolveForBaby()`（FR-15）
- `miniprogram/services/record.js`：`saveToLocalCache` / `deleteRecordFromCache` 补充 `_todayStatsCache` 失效；`mergeRecords` 按 `updatedAtTs` 比较，保留本地较新或 `_offline=true` 的版本（FR-6）
- `miniprogram/services/record.js`：`createRecord` / `updateRecord` / `deleteRecord` 第一行接入 `PermissionGuard.require(...)`（FR-14）
- `miniprogram/services/sync.js`：新增 `_normalizeTimestamps` 私有方法，离线队列 `create` 时字符串 → Date 规整，`createdAt`/`updatedAt` 改用 `serverDate` 获取权威时间（FR-4）
- `miniprogram/services/family.js`：`leaveFamily` 重构为使用通用 `_callFamilyOperation`，返回 `status` 状态机 + legacy 兼容字段（FR-5）
- `miniprogram/app.js`：`cleanOrphanedCache` 从 `setTimeout(5000)` 改为 `initPromise.then()`，避免慢网络下误删（FR-6）

**云函数架构**：
- `cloudfunctions/familyOperation/index.js`：从 1000 行巨型 switch 重构为 72 行 dispatch 入口（净削减 706 行）（FR-7）
- `cloudfunctions/familyOperation` 所有写操作接入 `OperationLogger`，写入 `operation_logs` 集合（FR-9）
- `clearBabyData` action 实现断点续传（phase state + cursor，`chunkedDelete` 并发 10），彻底解决大数据超时问题（FR-10）
- `joinFamily` 限流从内存 Map 迁移到 `rate_limits` 集合（跨实例有效，冷启动不重置）（FR-11）
- 云函数写操作时间戳统一使用 Date 对象 + 双时间戳 `updatedAtTs`，与客户端对齐（FR-13）
- `leaveFamily` 云函数返回 `data.status` 状态机（`ok` / `dissolved` / `need_transfer` / `family_not_found` / `not_member`），`success=false` 仅用于 `need_transfer` 业务分支（FR-5）

**文档**：
- `architecture.md` §2 云函数清单 7 → 8；§3 分层架构补充 PermissionGuard / FamilyContext；§6.5 新增第三层可观测性与巡检小节

### Fixed

- `cloudfunctions/familyOperation/lib/auth.js`：`getUserFromOpenid` 加入空 openid 防御（MCP/后台直接调用云函数时不再抛 "查询参数对象值不能均为 undefined"）
- v4.2 遗留：离线队列 `create` 未带 `createdBy` 对象导致同步后其他家庭成员看到"未知用户"的问题（FR-4）
- v4.2 遗留：`records.familyId` 三源漂移导致的"写入成功但列表里没有"的短时数据不可见问题（FR-15）
- v4.2 遗留：`_todayStatsCache` 删除记录后未失效，15s 窗口内首页显示过时数据（FR-6）
- v4.2 遗留：`mergeRecords` 简单合并导致离线 `update` 未同步时被云端旧版本覆盖（FR-6）

### Security

- `RecordService` CRUD 接入前置 `PermissionGuard.require()`，Viewer 直接抛 `PermissionError`，不发起网络请求（纵深防御第一道闸）
- `familyOperation` 每个写 action 内部再次调用 `isAdmin` / `isMember` 校验，不信任客户端（纵深防御第二道闸）

### Migration Notes

**升级部署顺序**（强制）：
1. 云端资源先行：创建 `operation_logs` / `rate_limits` 集合 + 索引 + PRIVATE ACL（已通过 MCP 完成）
2. 云函数部署：`familyOperation` 代码更新 + `patrolMemberOpenids` 新建（已通过 MCP 完成）
3. 定时触发器：`patrolMemberOpenids.dailyPatrol` 配置（已通过 MCP 完成）
4. 客户端小程序发布（需你手动上传审核）

**调用方迁移**：
- `leaveFamily` legacy 字段（`needTransfer` / `familyNotFound` / `notMember` / `familyDissolved`）保留，建议新代码改用 `result.status` 分支判断

---

## [v4.2.2] Milo — 2026-04-20

### Added
- `coding-conventions.md` 新增 §8 数据库操作约束（三条铁律 / 查询附 familyId 模板 / 调用 familyOperation 模板 / 违规检查清单）
- `service-api.md` 服务方法追加 `[cloud]` / `[direct]` 路径标签，新增 `_callFamilyOperation` 适配器契约说明和 `leaveFamily` 特殊契约章节
- `data-model.md` 新增 §5 安全规则配置章节（6 集合 ACL 表 + 跨用户写说明 + 客户端查询约束）
- 新建 `specs/v4.2.2-docs-alignment-and-hotfix/` 三份 spec 文档（requirements / design / tasks）

### Changed
- `architecture.md` 升级到 v4.2.2：§2 云函数清单从 1 个扩展为 7 个；§3 分层架构新增"云函数网关层"；§6.5 安全模型重写为云函数网关 + 安全规则双层防护；§7 追加跨用户写成本说明
- `data-model.md` 升级到 v4.2.2：`families` 表新增 `memberOpenids` / `_openidsMigratedAt`，`creatorId` / `members` / `memberDetails[].userId` 说明更正为 `users._id`（v4.1 后统一）；`records` / `vaccine_records` / `milestone_records` 三集合新增 `familyId` / `_familyIdMigratedAt`
- `service-api.md` 升级到 v4.2.2：`FamilyService` 13 个方法全部加 `[cloud]` / `[direct]` 标签；`BabyService` 补充完整方法表
- `coding-conventions.md` 升级到 v4.2.2：原 §8 权限体系调整为 §9，补充服务端/客户端双重校验说明
- `miniprogram/pages/auth/auth.js` 单例规范化：10 处 `new AuthService()` / `new FamilyService()` 改为 `XxxService.getInstance()`
- `miniprogram/packageSocial/pages/family/family.js loadFamilyInfo` 改走服务层 `familyService.getFamilyDetail()`，删除页面层裸 `db.collection` 调用
- `miniprogram/services/ai.js` `createModel('hunyuan-exp')` 修正为 `createModel('hunyuan')`，消除 provider 名与实际调用模型名 `hunyuan-2.0-instruct-20251111` 的歧义

### Fixed
- `specs/v4.2-cloud-function-gateway/` 三份 spec 状态字段从"待确认"回溯为 "✅ 已完成（2026-04-17）"
- `specs/v4.2-e2e-security-tests/` 三份 spec 状态字段与 26 个 tasks checkbox 回溯为已完成

### Removed
- `miniprogram/services/auth.js` 的 `getOpenId()` 方法（全项目零调用方，`cloudfunctions/getOpenId` 云函数仍保留用于 `traceUser` 依赖）

---

## [v4.2.1] Milo — 2026-04-17

### Added
- 新增 `e2eSecurityTest` 云函数 — 163 条 E2E 安全测试用例（159 自动化 + 4 手动验证）
- 15 个测试模块：安全规则(54) + 云函数权限(createFamily/joinFamily/removeMember/dissolveFamily/updateMemberRole/transferAdmin/leaveFamily/refreshInviteCode/validateInviteCode/babyOperations/clearBabyData) + 错误处理 + 跨家庭隔离 + 状态变更验证
- RuleSimulator 引擎：模拟 CloudBase 安全规则 `get()` 交叉校验判定（覆盖 122 条规则场景）
- 完整 spec 文档：requirements.md（126 条用例矩阵）+ design.md（1546 行架构设计）+ tasks.md

### Fixed
- `family-operations.js` `getFamily()` 错误匹配增加 `'does not exist'` 格式（CloudBase `doc(id).get()` 非存在文档的实际错误格式）
- `index.js` teardown 中 `_.regex()` 改为 `db.RegExp()`（wx-server-sdk 不支持 `_.regex`）
- `m16-clearBabyData.js` CD-01 验证查询移除不兼容的 `_.regex` 调用

---

## [v4.2.0] Milo — 2026-04-17

### Added
- 新增 `familyOperation` 云函数网关（13 个 action：createFamily/joinFamily/removeMember/dissolveFamily/updateMemberRole/transferAdmin/leaveFamily/refreshInviteCode/validateInviteCode/getFamilyByUserId/createBaby/deleteBaby/clearBabyData）
- 新增 `migrateFamilyOpenids` 数据迁移云函数（families 集合补充 memberOpenids 字段）
- 新增 `migrateRecordFamilyId` 数据迁移云函数（records 集合补充 familyId 字段）
- `createRecord()` 全部 4 条路径（在线/离线/降级记录/降级队列）写入 `familyId` 字段
- 12 处 `where` 查询附加 `familyId` 条件（record/growth/vaccine/milestone/report-popup/todo/export）
- 6 个集合配置 CUSTOM 安全规则（users=PRIVATE，families/babies/records/vaccine_records/milestone_records 基于 memberOpenids 交叉校验）

### Changed
- `family.js` 服务层 10 个方法改为 `callFunction` 适配器模式（createFamily/joinByInviteCode/getFamilyByUserId/refreshInviteCode/removeMember/dissolveFamily/updateMemberRole/leaveFamily/transferAdmin/validateInviteCode）
- `baby.js` 服务层 createBaby/deleteBaby 改为 `callFunction` 调用
- `baby-list.js` deleteBaby 改为 `BabyService.deleteBaby()` 调用
- `settings.js` `clearAllCloudData()` 从逐条客户端删除改为 `callFunction` → `familyOperation/clearBabyData`
- `family.js` 页面层邀请码自动生成和重新生成改为 `familyService.refreshInviteCode()` 调用，删除客户端 `generateInviteCode()` 方法

### Security
- 所有跨用户写操作统一收口到 `familyOperation` 云函数，通过 `getWXContext().OPENID` 服务端鉴权
- 邀请码验证增加实例级速率限制（60 秒窗口，最多 5 次尝试）
- `updateMemberRole` 增加乐观锁重试（最多 2 次）
- 安全规则从 READONLY 升级为基于 `familyId` + `memberOpenids` 的精确家庭成员校验

---

## [v4.1.1] Milo — 2026-04-15

### Fixed
- `family.js` `transferAdmin()` 使用 `doc(userId)` 替代 `where({ _openid })` 同步 users.familyRole（修复管理员转让时角色同步可能失败的问题）

### Added
- 发现页 2x2 网格新增「更多功能」占位引导卡片（虚线边框 + 半透明 + "敬请期待"副标题），填补 AI 助手移除后的空位
- 云函数 `migrateRecordUserId`：一次性迁移存量 records 的 `createdBy.userId` / `creatorId` 从 openid 格式更新为 `_id`（支持 dryRun、断点续传、超时保护）
- 云函数 `cleanGhostMembers`：一次性扫描清理 families 中的幽灵成员（支持 dryRun、安全约束不清理 admin、不清空家庭）
- `icon-config.js` `ICONS.discover` 新增 `more` 图标路径（复用 `plus.png`）

---

## [v4.1.0] Milo — 2026-04-15

### Added
- `app.js` 新增 `ensureUserReady()` 统一用户就绪检查（含 5 分钟缓存穿透机制）
- `app.js` 新增 `checkFamilyStale()` 轻量 onShow 校验（纯本地，不发网络请求）
- `app.js` 新增 `_clearFamilyData()` 家庭数据清理辅助方法
- `family.js` 新增 `joinByInviteCode` 旧家庭检查逻辑（防止幽灵成员）
- `family.js` `dissolveFamily` 新增批量清除所有成员 familyId/familyRole
- `family.js` `updateMemberRole` 新增乐观锁重试（最多 2 次）+ users.familyRole 同步
- `auth.js` 新增 `_handleInviteCodeForExistingUser()` 老用户邀请码处理流程
- 16 个页面统一增加 `ensureUserReady()` 登录守卫（4 TabBar + 3 主包 + 9 分包）

### Changed
- `record.js` `createRecord()` userId 从 `userInfo.openid` 统一为 `userInfo._id`
- `record.js` `createRecord()` familyMember 查找从 `members` 改为 `memberDetails`
- `family.js` `_clearUserFamilyInfo()` 从 `where({ _openid })` 改为 `doc(userId).update()`
- `family.js` `removeMember()` 清除用户信息也改为 `doc(targetUserId).update()`
- `family.js` 页面 `currentUserId` 和 `leaveFamily` 移除 openid fallback

### Removed
- 首页 AI 洞察区块（`home.wxml` insight-v4 整个 view + `home.js` loadAiInsight 调用）
- 发现页 AI 助手入口（`discover.js` toolItems 减为 3 项）
- 成长报告 AI 建议卡片（`report-popup.wxml` + `share-canvas.js` AI 绘制）
- 引导页 AI 介绍（`guide.js` 移除 AI 对象 + `ai-assistant.js` 功能关闭提示）

---

## [v4.0.1] Milo — 2026-04-13

### Changed
- 配方奶快捷用量从 `[30-240ml]` 调整为 `[10-210ml]`，新增 10ml 细粒度选项

---

## [v4.0.0] Milo — 2026-04-13

> **代号含义**：Milo 是一种营养麦芽饮品，寓意「滋养成长」——本版本全面重设计 UI，采用美拉德暖色系。

### Added
- 全新美拉德色系 UI 设计系统（8rpx 网格、三级圆角、三级阴影）
- 6 个新增 CSS 变量 + 4 个暗色覆盖变量
- 3 个新增动画（`cardStagger`、`shimmer`、`focusPulse`）
- focus-card 新组件（聚焦卡片）
- 常用奶量快捷填入（feeding-popup v4.0 增强）
- 弹窗统一底部弹出式布局 + swipe-close 手势关闭
- 页头统一清理（去重复标题栏，3 页）
- 弹窗关闭按钮统一添加（13 处）

### Changed
- 首页问候区精简（移除 baby-card，合并多宝切换）
- 状态胶囊改造
- 摘要进度条 + 快捷入口重设计
- 待办区域改为竖向布局
- AI 洞察改为一行式
- 时间线轴线视觉升级
- 记录页吸顶筛选栏
- 发现页网格重构
- 我的页布局重构
- packageGrowth / packageSocial / auth / baby-create 视觉统一升级
- 暗色模式 28 项 QA 验收通过

---

## [v3.2.0] Lullaby — 2026-04-10

> **里程碑**：首个 Git 管理版本，建立 Git Flow + 三阶段开发工作流规范。

### Added
- `specs/workflow/development-workflow.md` — 开发工作流三阶段规范
- `specs/workflow/git-flow.md` — Git Flow 分支模型、Commit 规范、Release 流程
- `specs/ai-coding-methodology.md` — Spec-Driven Development 方法论总结

### Changed
- 记录页顶部导航栏重设计（方案 B：吸顶标题 + 副标题统计）

---

## [v3.1.0] Lullaby — 2026-04-08

### Added
- 暖色夜间模式（light / dark / 跟随系统三种主题切换）
- `theme.json` 亮色/暗色主题变量配置
- ThemeManager 主题管理器工具类
- 成长报告分享图 V2（成绩单式设计）
- 本周趋势智能增强（周环比、参考范围、状态评估、智能提示语）
- 彩蛋系统（节日/纪念日/特殊时刻自动触发彩蛋互动）
- easter-egg-popup / easter-egg-toast 组件
- 彩蛋检测系统工具类

### Changed
- 全面性能优化（30s 节流、3s 去重、batchExecute 限流、分页 fetchAll）
- 分享图 Canvas 绘制优化（超时降级、防重复点击）
- 所有 Service 统一闭包单例模式

---

## [v3.0.0] Lullaby — 2026-04-03

> **代号含义**：Lullaby（摇篮曲）——家庭协作功能上线，多人共同守护宝宝。

### Added
- 首页完全重设计（问候区、状态横幅、今日概览、快捷记录、待办、AI 洞察、时间线）
- 家庭协作功能（邀请码加入、admin/editor/viewer 三级权限）
- family / family-create / family-join 三个社交页面
- FamilyService 家庭组服务（17KB）
- PermissionUtil 权限管理工具
- AI 每日洞察（基于腾讯混元大模型）
- 睡眠实时计时状态
- 成长报告分享图（初版 Canvas 绘制）
- report-popup / export-popup 组件

### Changed
- 分享图优化（图片加载超时降级、综合评分绘制）

---

## [v2.0.0] Cradle — 2026-03-27

> **代号含义**：Cradle（摇篮）——全面重构奠定五层架构基座。

### Added
- 五层架构体系（页面层→组件层→服务层→工具层→数据层）
- 11 个服务层模块（RecordService、AuthService、BabyService 等）
- 12 个工具类（StorageUtil、NetworkUtil、DateUtil 等）
- 洞察趋势增强（trendService、reportDataHelper）
- 离线同步服务（SyncService，队列/重试/网络监听）
- 分包策略（packageGrowth + packageSocial）

### Changed
- 从单文件架构重构为五层分离架构
- 数据库操作从页面内联改为服务层封装
- 记录页头重设计

---

## [v1.0.0] Sprout — 2026-03-25

> **代号含义**：Sprout（萌芽）——Baby Care Tracker 的第一个版本。

### Added
- 五类日常记录：喂养（母乳/配方奶/辅食）、睡眠、排便、体温、生长测量
- 4 个 TabBar 页面：首页、记录、发现、我的
- CloudBase 云开发集成（NoSQL 数据库 + 云函数）
- 6 个数据库集合（users、families、babies、records、vaccine_records、milestone_records）
- WHO 生长曲线、国家免疫规划疫苗计划
- 发育里程碑追踪
- 基础记录弹窗组件（feeding/sleep/diaper/temperature/growth）

---

*文档维护：每次版本发布后，在对应版本区块追加变更条目。*
