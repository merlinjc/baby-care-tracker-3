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
| v5.x | **Saplings**（树苗） | 跨越平台：Web 端全栈落地（client+server+shared monorepo），与小程序双形态并存 |

---

## [v7.2.0] Saplings — 计划中（开发分支：`feature/v7.2-roadmap`）

> Roadmap：[`docs/web-roadmap-v7.2.md`](./docs/web-roadmap-v7.2.md)（v1.0，2026-05-11）
> 主题：**内容沉淀 + 个性化 + 可访问性 + 工程基础**
> 排期：3 个 sprint（约 6 周），目标 v7.2.0 GA。

### Planned（按 Sprint）

#### Sprint 1（2026-05-11 → 2026-05-22）— 工程基础 + 个性化基础
- **F9** 路由级代码分割（`React.lazy` + Vite manualChunks + bundle 阈值 CI 卡控）
- **F8** i18n 框架预埋（`react-i18next`，5 个高频页面接入，仅 zh-CN 完整）
- **F12** 用户头像设置（COS 预签名上传 + 默认 SVG 头像 + Baby 头像复用）
- **F2** 黄疸记录持久化（新增 `JaundiceRecord` 表 + 4 端点 + localStorage → 云端迁移脚本）
- **F3** 导出独立页 `/export`（按宝宝/范围/类型/格式组合导出 + 历史下载列表）
- **F6** 多宝快捷切换持久化 + URL 参数（`?babyId=` 三层数据源优先级）
- **F1** 首次使用引导 / Onboarding（4 步 Stepper + `User.preferences.onboardingCompleted`）

#### Sprint 2（2026-05-25 → 2026-06-05）— 内容沉淀核心
- **F11** 宝宝每日打卡照片 + 每日 AI 总结 + 成长日历（核心亮点）
  - 新增 `DailyCheckin` 表（`(babyId, checkinDate)` 唯一）
  - COS 预签名上传 + EXIF GPS 剥离 + 1080px 压缩
  - 异步 AI 小记生成（与 dailyInsight 独立的"小记"基调）
  - 月/周日历视图 + 长截图 / PDF 导出
  - patrol 新增 `checkinPhotoCleanup`（每周日 04:00）
- **F10** 生长曲线对照 WHO 百分位线（P3/P15/P50/P85/P97 LMS Z-score 计算 + 异常值 autoPrompt 跳 AI）
- **F4** 报告分享卡片 + 下载（接通现有 `renderReportImage` + `pdf-lib` 多页 PDF 含日历）

#### Sprint 3（2026-06-08 → 2026-06-19）— 高级体验 + 收尾
- **F5** AI 助手对话历史持久化 + 多会话（新增 `Conversation` / `ConversationMessage` 表 + 6 端点 + autoPrompt 自动新建会话）
- **F7** a11y 全量 audit（`eslint-plugin-jsx-a11y` + `@axe-core/react` + Playwright a11y 断言 + 5-7 个修复 PR + `docs/web-a11y-audit-2026-05.md`）
- 灰度反馈修复 + 性能优化 + Release Notes

### Schema 变更（汇总）

```prisma
// 新增
model JaundiceRecord { ... }
model Conversation { ... }
model ConversationMessage { ... }
model DailyCheckin { ... }   // (babyId, checkinDate) 唯一

// 字段调整
model User {
  avatar      String?    // 复用，迁移到 COS URL
  preferences String?    // 新增，JSON: { onboardingCompleted, fontScale, lang, ... }
}
```

Migration 顺序：`add_user_preferences` → `add_jaundice_records` → `add_conversations` → `add_daily_checkins`，每个独立 PR。

### 文档同步计划
- `docs/web-architecture.md` 新增 §5.5 / §5.6 / §5.7 / §5.8
- `docs/web-api-spec.md` 新增 8 类路由
- `docs/web-coding-conventions.md` 新增「文件上传 / i18n / a11y checklist」
- `docs/web-component-library.md` 新增 8+ 组件
- `docs/web-ui-spec.md` 补日历视图色彩约定
- `docs/devops-workflow.md` 补 COS 桶配置 + patrol 新任务

---

## [v5.0.0-alpha] Saplings — 2026-05-06（Web 版功能对齐 alpha）

> 范围：Web 版（`client/` + `server/` + `shared/`）功能对齐与未完成需求落地。
> 配套 spec：`specs/web-feature-parity/`（requirements.md v1.5 / design.md v1.6 / tasks.md）。
> 状态：**alpha**。Phase 1-5 已完成，Phase 6 仅完成文档同步；E2E 与单元测试列入 v5.0.0 GA backlog。

### Added

#### 后端能力（server/）

- **FR-A1 进行中睡眠云端会话**：`record.service.createRecord` 校验同 babyId 不可并发；`getRecords` 增加 `endTimeIsNull` 过滤；`record.schema` 互斥校验
- **FR-A 跨午夜睡眠 + 双时间戳**：`getTodayStats` 用 `OR: [{startTime}, {endTime}]` 扩展过滤；4 维度全部新增 `lastTimeTs` 字段；sleep 增 `lastEndTime` / `lastEndTimeTs`；temperature `lastValue → latestValue`
- **FR-B 趋势增强**：`trend.service.getEnhancedWeeklyTrend` + `REFERENCE_RANGES` 月龄分档（AAP / NSF / CDC 数据来源）；新增 `GET /api/babies/:id/trend/weekly`
- **FR-F AI 接入**：`ai.service` 直调腾讯云混元 ChatCompletions（自实现 TC3-HMAC-SHA256 签名，不引入 SDK）；缺凭证 / 5xx / 超时降级为 mock 或本地 fallback；4 个端点 `/ai/chat` `/ai/chat/stream` `/ai/insight/daily` `/ai/quota`；24h LRU 缓存
- **FR-F3 AI 配额**：Prisma 新增 `AIQuota` model（`@@unique([userId, date])` + `@@index([date])`）；`consumeQuota` 原子自增 + 超限回滚；`refundQuota` 用于失败回滚
- **FR-E1 OperationLogger**：8 个 family 写操作 + `deleteBaby` 接入完整生命周期日志（start / step / succeed / partial / fail / resume / findOngoing）
- **FR-E2 持久化限流**：`rate-limit-persistent.ts` 基于 RateLimit 表，多实例共享计数；预设 inviteJoin / auth / ai 三类限流器
- **FR-E3 Patrol 巡检**：`patrol.ts` familyConsistency（每天）+ aiQuotaCleanup（每周）；分布式锁基于 RateLimit 表（`patrol-lock.ts` 乐观锁式领导选举）；默认 dry-run，规则 B 在 `PATROL_DRY_RUN=false` 时自动修复
- **FR-E5 deleteBaby cursor 续传**：`baby.service.deleteBaby` 单批 500 条 + 10s 软超时；中断后跨设备从 `OperationLogger.findOngoing` 恢复

#### 前端组件与 hook（client/）

- **FR-A1/2/3/5** 首页 v4.0：`StatusCapsule`（4 态：none/sleeping/feeding_ago/sleep_abnormal）/ `BabySwitcher`（多宝头像组）/ `TodaySummary`（4 列大数字 + 进度条 + 体温警示）/ `HomeSkeleton`
- **FR-A4** AI 洞察折叠态：`use-local-storage-state` + `buildFallbackInsight` 规则引擎；折叠/展开切换 + 来源标识
- **FR-A6** 配方奶 8 按钮：[10, 30, 60, 90, 120, 150, 180, 210]
- **FR-B** 趋势 4 卡片：`InsightSection` + `RangeBar`（60% 中央正常区 + 定位点）+ `useWeeklyTrend`
- **FR-C1-C5** 家庭协作：`InviteSection`（倒计时 + 复制 + 分享 + 刷新）/ `MembersSection`（三点菜单）/ `RoleEditDialog` / `TransferAdminDialog`（含 leaveFamily 状态机分支）/ `RemoveMemberConfirm`
- **FR-C6** 双层权限闸：`lib/permission-guard.ts` + `lib/api-error.ts`（PermissionError/QuotaExceededError/SleepActiveError）
- **FR-D** 记录页对齐：`PageHeader` + `buildTodaySummaryText`（按 §2.4 FR-D1.AC2 精确格式）
- **FR-F** AI 流式：`aiService.chatStream` + `consumeStream`；`QuotaBar` 配额条
- **FR-G1** 三态主题：`ThemeSelector`（亮色/暖夜/跟随系统）+ `theme-store` 升级；`themes.css` 用 `[data-theme]` 选择器
- **FR-G2** 8 类彩蛋：`lib/easter-egg.ts` detectAll 引擎 + `EasterEggDisplay` 三态（popup/toast/banner）
- **FR-G3** 分享图 V1：`lib/share-canvas.ts` 4 卡片 750×1280 jpeg；DPR 限制 2；`navigator.share` 优先 + 下载降级

#### 共享类型（shared/）

- 新增 `LeaveFamilyResult` / `WeeklyTrendData` / `WeeklyTrendDimension` / `ReferenceRange` / `AIQuotaStatus` / `ChatStreamEvent` / `DailyInsight.source`
- BREAKING：`TodayStats.temperature.lastValue` → `latestValue`；4 维度全部增 `lastTimeTs`

### Changed

- 后端 `tsconfig.json` 升级：`rootDir` 上提到仓库根，建立 `@shared/*` 路径别名（不再生成 .d.ts）
- 前端主题机制：`'light' | 'dark' | 'system'` → `'light' | 'warm-night' | 'system'`；`profile.tsx` 选项标签同步
- `family-store` 类型升级为 `FamilyDetail`；`leaveFamily` 返回完整状态机；`updateMemberRole` / `removeMember` / `transferAdmin` 改为局部更新
- AI 路由 `/daily-insight` POST → `/insight/daily` GET（保留旧端点向后兼容）

### Fixed

- 修复 ai-assistant 页 4 处编译错误（旧代码用了不存在的 `chat(messages, babyId, true)` 第 3 参数）
- 修复 milestone 页 `MilestoneItem` 导入路径（从 `@/lib/milestone-defs` 而非 `@/types`）
- 修复 `optionalAuth` 中间件返回类型缺 `Promise<void>` 编译错误
- 修复 `ErrorCodes` 缺 `UNAUTHORIZED` 字段编译错误
- 修复 `record.service.ts` 升级时引入的 `BadRequestError` 未使用导入

### Migration

> Web 版当前为 alpha，不需要从生产数据迁移。SQLite dev.db 通过 `prisma db push` 直接对齐 schema。

### Known Issues

- AI 链路在缺 `TENCENT_SECRET_ID/KEY` 时返回 mock 回复（仅开发环境可见）
- T-4.2 RecordPage 筛选吸顶 + Timeline 日期分组延后到 v5.0.0 GA（当前已能通过副标题完成 80% 体验）
- T-6.1-6.3 单元测试 / Playwright E2E 列入 v5.0.0 GA backlog

---

## [v4.3.2] Milo — 2026-04-21

### Security

- **FR-1 families.read 云函数化**：`getFamilyDetail` 改走云函数 + `directReadFamilyFallback` 开关（T-7→T+14 灰度后收紧规则）
- **FR-2 records update/delete 云函数化**：admin 可跨归属操作他人记录（`updateRecord` / `deleteRecord` 云函数 + 客户端智能判定直连/云函数路径）
- **FR-4 `PermissionGuard.checkCanDelete` 归属字段防御**：无 `_openid` / `createdBy` / `creatorId` 的记录一律拒绝删除
- **FR-A4 record 单条删除归属校验**：editor 删除他人记录被拦截

### Fixed

- **FR-A1 growth-popup 实例方法修复**：`RecordService.getRecords` → `RecordService.getInstance().getRecords`
- **FR-A2 4 个弹窗接入 swipe-close behavior**：feeding / sleep / diaper / temperature 弹窗下滑关闭
- **FR-A3 family-join 加入后持久化完整 familyInfo**：新用户加入后立即可创建记录
- **FR-A5 createRecord 错误边界隔离**：本地缓存失败不影响云端写入
- **FR-A6 update/delete 网络抖动去重**：探测云端状态决定是否入队，避免重复操作
- **FR-A7 sync 队列翻新**：离线 create→update→sync 后队列 tempId 替换为 realId
- **FR-A8 joinFamily 顺序反转**：先 push 新家 → 更新 users → pull 旧家，减少中间态不一致

### Changed

- **FR-3 deleteBaby 自动解散**：删除最后一个宝宝时自动解散家庭（复用 `dissolveFamilyCore`）
- **FR-5 createFamily 去冗余入参**：忽略客户端传入的 creatorId/creatorName/creatorOpenid，全部从 ctx 构造
- **FR-7 updateUserInfo 补 updatedAtTs**：双时间戳与其他集合对齐
- **FR-A14 单例规范**：全量 `new XxxService()` → `getInstance()`（23 处）
- **FR-A13 logout 清缓存**：10 个 Service 加 `resetInstance()` + `app.resetAllServices()`（5 处调用点）
- **FR-A12 全量 action 接入 logger**：createFamily / dissolveFamily / leaveFamily / removeMember / transferAdmin / refreshInviteCode

### Added

- **FR-6 限流扩面**：新增 refresh_invite / transfer_admin / dissolve_family / remove_member / update_role / leave 限流 key
- **FR-A9 updateMemberRole 乐观锁重试**：冲突时重试 2 次 + 返回 BUSY 错误码
- **FR-A10 transferAdmin isMember 交叉校验**：新管理员必须已是家庭成员
- **FR-A11 refreshInviteCode 冲突检测**：循环 5 次生成唯一码 + 乐观锁更新
- **FR-A15 patrol 反向漂移自修复**：3 规则（family 不存在→清 user / 7天内→修复 / 超期→告警）+ dryRun 模式
- **FR-A16 patrol Set 去重**：比较 memberOpenids 时使用双向子集
- **FR-A17 rule-simulator 对齐**：families.update = memberOpenids contains / babies.delete = false
- **FR-A18 clearBabyData BABY_NOT_FOUND**：续传恢复时检查 baby 是否仍存在 + 自动解散
- **E2E m22 模块**：13 条 v4.3.2 专项用例，全量 202/202 通过

---

## [v4.3.1] Milo — 2026-04-20

### Changed

**云函数权限模型对齐（FR-2 / FR-9）**：
- `cloudfunctions/familyOperation/actions/createBaby.js`：权限收紧为 `isAdmin`（原 `isMember` 允许 viewer 创建宝宝，违反权限矩阵）
- `cloudfunctions/familyOperation/actions/deleteBaby.js`：权限收紧为 `isAdmin`；同时大改为级联删除 records / vaccine_records / milestone_records，支持 cursor 断点续传
- `cloudfunctions/familyOperation/actions/dissolveFamily.js`：判定从 `creatorId === userId` 改为 `isAdmin`（兼容 transferAdmin 后的新 admin 解散家庭）
- `cloudfunctions/familyOperation/actions/updateMemberRole.js`：判定改 `isAdmin`；新增 role 白名单（admin/editor/viewer）、SOLE_ADMIN 守卫（唯一 admin 不能自降级）、单一 admin 约束（转让 admin 时原 admin 自动降级为 editor + 同步 creatorId）

**客户端权限纵深防御（FR-6 / FR-12 / FR-13 / FR-14 / FR-15）**：
- `miniprogram/utils/permission.js`：`getUserRole` 默认值从 `editor` 改为 `viewer`（最小权限原则），消除被踢缓存过期窗口内的脏写风险
- `miniprogram/packageGrowth/pages/vaccine/vaccine.js` / `milestone/milestone.js`：add / update / delete 全部接入 `PermissionGuard` 前置校验；familyId 统一走 `FamilyContext.resolveForBaby(baby)`；补齐双时间戳
- `miniprogram/pages/record/record.js`：`batchDelete` 增加 `PermissionGuard.checkCanDelete(record)` 归属预分桶，避免 editor 批量删他人记录时 UI 闪烁丢记录
- `miniprogram/packageSocial/pages/family/family.js`：`transferAndLeave` 分状态处理 `leaveFamily` 返回（`ok`/`dissolved` 清本地，`need_transfer` 提示不清，其他 toast）
- `miniprogram/pages/auth/auth.js`：`_handleInviteCodeForExistingUser` 判定迁到 `status === 'need_transfer'` 状态机

**云函数数据完整性（FR-1 / FR-5 / FR-7 / FR-10 / FR-11）**：
- `cloudfunctions/familyOperation/actions/createBaby.js`：显式写入 `_openid = ctx.openid`，修复客户端直连 `updateBaby` 被安全规则 `doc._openid == auth.openid` 拒绝的生产 blocker
- `cloudfunctions/familyOperation/actions/createFamily.js`：新增防重复校验，用户已在有效家庭中返回 `ALREADY_IN_FAMILY`（幽灵引用允许继续，避免双宿幽灵成员）
- `cloudfunctions/familyOperation/actions/removeMember.js`：`targetOpenid` 为空时跳过 `memberOpenids` 更新并写告警日志（替代 v4.3.0 `_.pull('')` 的破坏性 no-op），由 `patrolMemberOpenids` 后续修复
- `cloudfunctions/familyOperation/actions/clearBabyData.js`：3 个 phase 的 `where` 查询补 `familyId`
- `miniprogram/services/record.js` `updateRecord` / `miniprogram/services/sync.js` `executeOperation(update)`：补齐 `updatedAtTs` 双时间戳，修复 `mergeRecords` 按 `updatedAtTs` 比较失效的完整闭环

**可观测性（FR-18）**：
- `cloudfunctions/patrolMemberOpenids/index.js`：新增阶段 2 反向漂移检查（遍历 users.familyId 非空用户校验是否仍在 families.members 中）；cursor 结构升级为 `{ stage, skip }` 两阶段断点续传；反向漂移仅告警不自动修

**客户端分批操作（FR-4）**：
- `miniprogram/packageSocial/pages/settings/settings.js` `clearAllCloudData`：循环处理云函数 `in_progress` 状态，携带 cursor 续传直至 `succeeded`；loading 提示实时更新进度；超过迭代上限时保留 cursor 到本地

**文档对齐（FR-17）**：
- `data-model.md` §2.7 `operation_logs.status` 枚举对齐代码实现（`started`/`succeeded`/`partial`/`failed`/`in_progress`）
- `data-model.md` §2.8 `rate_limits.windowStart` 类型修正为 number（实际代码）；移除误传的 `windowStartTs`
- `service-api.md` BabyService.createBaby/deleteBaby 契约说明 + FamilyService 错误码补充 `ALREADY_IN_FAMILY` / `INVALID_ROLE`
- `coding-conventions.md` §9.4 新增"默认角色与最小权限原则"；§9.5 新增"creatorId vs isAdmin 的选择"
- `architecture.md` §6.5 权限纵深防御升级为三道闸模型；巡检任务补充阶段 2 说明

**其他（FR-16 / FR-19）**：
- `miniprogram/app.js` `initUser`：统一使用 `AuthService.getInstance()`，消除 v4.2.2 FR-9 残留的 `new AuthService()`
- `miniprogram/services/record.js` `createRecord` catch 分支 `offlineRecord` 补齐 `createdBy` 对象（与 try 分支对齐）

### Fixed

- 【生产 blocker】所有通过 `createBaby` 创建的宝宝无法被创建者后续 `updateBaby`（因 admin SDK 未写 `_openid`，安全规则 `doc._openid == auth.openid` 失败）
- 【运行时 crash，Hotfix】`baby-detail` 页访问时 `getBabyById` 报 -502003 —— 根因是 `babies.read` 规则要求 auth.openid 在 `families.memberOpenids` 中，当真实 memberOpenids 未同步时客户端直连必然失败。最终方案改走云函数 `familyOperation/getBabyById` action，由 admin SDK 读取后在业务层校验 `baby.familyId === user.familyId` + `isMember`
- 【运行时 crash，Hotfix3】`updateBaby` 同样被 `doc._openid == auth.openid` 规则拒绝（存量宝宝 _openid 不是当前 openid / 非创建者成员）。新增 `familyOperation/updateBaby` action，admin SDK 绕过规则 + 业务层校验（同家庭 + 非 viewer + 字段白名单 name/gender/birthDate/avatar）。BabyService.updateBaby 改走云函数，`uploadAvatar` 连锁自动修复
- 【运行时 crash，Hotfix】`baby-edit-popup.submit` 在父页加载失败时 `this.data.baby === null`，访问 `baby._id` 抛 TypeError — 新增 null 守卫 + observer 自动关闭空数据弹窗
- 【警告，Hotfix】`baby-edit-popup` WXML 绑定了 `onTouchStart/Move/End` 但组件未引入 `swipe-close` behavior，正式接入 behavior 消除 warning
- 【编译错误，Hotfix】`baby-edit-popup.wxss:303` 使用了组件 wxss 不允许的属性选择器 `.submit-btn[disabled]`，改为条件类 `.submit-btn.is-disabled`，WXML 通过 `{{loading ? 'is-disabled' : ''}}` 动态切换
- 【权限绕过】viewer 能通过直接调用 `familyOperation.createBaby` / `deleteBaby` 绕过 UI 限制增删宝宝
- 【数据一致性】`updateRecord` 写云端/离线同步两个路径都缺 `updatedAtTs`，导致 v4.3.0 FR-6 `mergeRecords` 按 `updatedAtTs` 比较失效，"离线 update 未同步时被云端旧版本覆盖"的修复实际没生效
- 【幽灵家庭】`removeMember` 目标用户文档已删除时 `_.pull('')` no-op，被移除成员 openid 残留在 `memberOpenids` 中仍能读取家庭数据
- 【批量删除闪烁】`record.js batchDelete` editor 选中他人记录时，本地缓存先删 → 云端拒绝 → UI 短暂丢记录
- 【权限提升漏洞】`permission.getUserRole` 默认 editor，刚被踢缓存窗口内允许写操作产生脏数据
- 【级联数据缺失】`deleteBaby` 不删关联 records/vaccine/milestone，宝宝删后留孤儿数据
- 【权限判定错位】`dissolveFamily` / `updateMemberRole` 用 `creatorId === userId`，transferAdmin 后新 admin 无法管理/解散
- 【清除数据假完成】`settings.clearAllCloudData` 不处理 `in_progress` 状态，大数据量时只删第一批就提示成功

### Security

- `createBaby` admin SDK 写入 `_openid` 显式等于调用者 openid（而非空），使客户端安全规则 `doc._openid == auth.openid` 能正确放行创建者的后续修改，不依赖管理员介入
- 云函数统一使用 `isAdmin(userId, family)` 判定（兼容 `memberDetails[].role === 'admin'` + `creatorId` 双路径），取代零散的 `creatorId === userId` 硬比较
- 客户端默认角色从 `editor` 降为 `viewer`，遵循最小权限原则

### Migration Notes

**存量数据影响**：
- v4.3.1 之前创建的 babies 文档缺 `_openid` 字段。创建者依然**无法通过客户端 `updateBaby`** 修改这些宝宝 —— 需通过 admin SDK 修复。建议后续开发一次性 `migrateBabyOpenids` 云函数为存量 babies 补 `_openid`（列入 v4.3.2 backlog）
- 老数据若 `users.familyId` 对应的 family 已不存在，`createFamily` 会视为幽灵引用允许创建新家庭（自动修复）

**部署顺序**（强制）：
1. 云函数部署：`familyOperation` + `patrolMemberOpenids`（用户需重新登录 CloudBase MCP 后执行）
2. 客户端小程序发布（依赖云函数已部署）

**调用方无需修改**：
- BabyService.createBaby / deleteBaby 签名不变
- FamilyService 错误码表扩展（新码 `ALREADY_IN_FAMILY` / `INVALID_ROLE`），调用方按需增加 error.code 分支

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
- `miniprogram/services/todo.js` `_compute()`：`total` 错误地 `+ overdue` 导致逾期疫苗被重复计数（首页实际 2 项疫苗待办却显示"查看全部 4 项"），修正为 `total = vaccine + milestone`；`overdue` 仅作 `vaccine` 的子集用于展示，不再计入总数

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
