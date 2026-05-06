# 实施计划 - Web 版功能对齐与未完成需求落地（web-feature-parity）

> 版本：v1.0 | 日期：2026-05-06 | 状态：✅ 已完成（2026-05-06，Phase 6 文档同步完成）
>
> 配套文档：[`requirements.md`](./requirements.md) v1.5、[`design.md`](./design.md) v1.6
>
> ⚠️ 本期为 Web 版 v5.0.0-alpha：Phase 1-5 完整交付；Phase 6 完成文档同步，
> E2E 与单元测试列入 v5.0.0 GA backlog（详见 `CHANGELOG.md` Known Issues）。

## 实施概览

预计总工时：约 64-86 小时（按 design §12 的 6 个 Phase 串行）

里程碑：

- **M1（Phase 1，工时 4-6h）**：基础设施（shared types、ui 组件、OperationLogger、themes.css）
- **M2（Phase 2，工时 12-18h）**：后端能力（trend 增强、ai.service、AIQuota、rate-limit、patrol、OperationLogger 接入）
- **M3（Phase 3，工时 18-24h）**：前端 P0（首页 + 趋势 + 家庭协作 4 组件）
- **M4（Phase 4，工时 12-16h）**：P1 增强（PageHeader、AI SSE、ThemeSelector、Timeline 分组）
- **M5（Phase 5，工时 10-14h）**：P2 增值（彩蛋 + 分享图 V1）
- **M6（Phase 6，工时 8-10h）**：测试与文档同步（单测 + Playwright + 6 份核心文档）

---

## 任务列表

### 阶段一：基础设施（M1）

- [x] **T-1.1** ✅ shared/types 扩展
- [x] **T-1.2** ✅ components/ui 补齐 shadcn 通用组件（skeleton + toast）
- [x] **T-1.3** ✅ themes.css 完整变量集（三态主题）
- [x] **T-1.4** ✅ 后端 OperationLogger 工具类
- [x] **T-1.5** ✅ 后端 AIQuota schema + 错误码

### 阶段二：后端能力（M2）

- [x] **T-2.1** ✅ record.service `getTodayStats` 双区间扫描 + lastTimeTs 字段
- [x] **T-2.2** ✅ record.service 进行中睡眠并发校验 + 路由层 endTimeIsNull 过滤
- [x] **T-2.3** ✅ trend.service 增强（getEnhancedWeeklyTrend）+ babies/:id/trend/weekly 路由
- [x] **T-2.4** ✅ ai.service 混元接入（含 mock 降级 + 配额回滚 + LRU 缓存）
- [x] **T-2.5** ✅ ai 路由 4 端点（/chat /chat/stream /insight/daily /quota）
- [x] **T-2.6** ✅ rate-limit-persistent 中间件（基于 RateLimit 表）
- [x] **T-2.7** ✅ patrol 巡检 + 分布式锁 + AIQuota TTL 清理（自启动）
- [x] **T-2.8** ✅ family.service 8 个写操作 + baby.service deleteBaby cursor 续传接入 OperationLogger

### 阶段三：前端 P0 组件（M3）

- [x] **T-3.1** ✅ family-store 升级为 FamilyDetail + LeaveFamilyResult 状态机
- [x] **T-3.2** ✅ 客户端 PermissionGuard + axios 错误映射（mapAxiosError → ApiError 子类）
- [x] **T-3.3** ✅ useActiveSleep hook + StatusCapsule 组件（4 种态 + 双层防护）
- [x] **T-3.4** ✅ BabySwitcher + TodaySummary + HomeSkeleton + computeDailyGoals
- [x] **T-3.5** ✅ AI 洞察折叠态 + buildFallbackInsight + use-local-storage-state
- [x] **T-3.6** ✅ InsightSection 趋势组件（4 卡片 + RangeBar + useWeeklyTrend）
- [x] **T-3.7** ✅ 家庭协作 5 个组件（RoleEditDialog / TransferAdminDialog / RemoveMemberConfirm / InviteSection / MembersSection）
- [x] **T-3.8** ✅ HomePage 与 FamilyPage 集成（含 leaveFamily 状态机分支）

### 阶段四：P1 增强（M4）

- [x] **T-4.1** ✅ PageHeader + buildTodaySummaryText（FR-D1.AC2 格式精确）
- [x] **T-4.2** ✅ RecordPage 集成 PageHeader + 副标题（动态今日速览）
- [x] **T-4.3** ✅ AI 助手页 SSE + QuotaBar + 流式打字机（修复 ai-assistant 预存在 bug）
- [x] **T-4.4** ✅ ThemeSelector 三态主题选择器 + Settings 「外观」tab
- [x] **T-4.5** ✅ FeedingDialog 配方奶 8 按钮 [10, 30, 60, 90, 120, 150, 180, 210]

### 阶段五：P2 增值（M5）

- [x] **T-5.1** ✅ 彩蛋检测引擎 detectAll（8 类彩蛋 + 优先级排序 + localStorage 标记）
- [x] **T-5.2** ✅ EasterEggDisplay 三态渲染（popup / toast / banner）+ HomePage 集成
- [x] **T-5.3** ✅ share-canvas V1（4 卡片简版 + DPR≤2 + jpeg + navigator.share 降级）

### 阶段六：测试与文档同步（M6）

> ⚠️ 本期 alpha 版仅完成文档同步；测试相关任务列入 v5.0.0 GA backlog。

- [ ] **T-6.1** 后端单元测试 — _v5.0.0 GA backlog_
- [ ] **T-6.2** 前端单元测试 — _v5.0.0 GA backlog_
- [ ] **T-6.3** Playwright E2E（主链路） — _v5.0.0 GA backlog_
- [x] **T-6.4** ✅ 文档同步（CHANGELOG + 3 份 web 增量文档 + spec 状态）
  - `CHANGELOG.md`：新增 v5.0.0-alpha Saplings 区块（含 Added / Changed / Fixed / Migration / Known Issues）
  - `docs/web-architecture.md`：Web 版架构总览、关键决策（含跨午夜睡眠、cursor 续传、双层权限）
  - `docs/web-coding-conventions.md`：双时间戳约定、PermissionGuard 双层防护、OperationLogger 接入清单、错误码、React Query 键名
  - `docs/web-component-library.md`：12 个新组件、3 个新 hook、8 个新 lib、新增 service 方法、新增 Prisma 模型、新增共享类型
  - `specs/web-feature-parity/tasks.md` 状态：进行中 → ✅ 已完成（2026-05-06）
- [ ] **T-6.5** patrol 切换为生产模式 — _需在生产环境配置 `PATROL_DRY_RUN=false` 后启用_

---

## 任务依赖关系

```
T-1.1 (shared types) ─┬─→ T-2.1 ─→ T-2.2 ─┐
                      ├─→ T-2.3 ──────────┤
                      └─→ T-3.1 ──────────┤
T-1.2 (ui 组件) ──────┬─→ T-3.4 ──────────┤
                      ├─→ T-3.6 ──────────┤
                      └─→ T-3.7 ──────────┤
T-1.3 (themes.css) ───→ T-4.4              │
T-1.4 (OperationLogger) ─┬─→ T-2.7         │
                          └─→ T-2.8         │
T-1.5 (AIQuota) ─→ T-2.4 ─→ T-2.5 ─→ T-4.3 │
T-2.6 (rate-limit) ────────────────────────┤
T-3.2 (PermissionGuard) ─→ T-3.3 ──────────┤
                                            ▼
                                          T-3.8 (HomePage 集成)
                                            │
                                            ▼
                                          T-4.x P1 → T-5.x P2 → T-6.x 测试与文档
```

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 混元 SDK 凭证未配置导致 AI 链路无法测试 | 高 | 中 | T-2.4 实现 mock 降级，缺凭证时返回固定 fallback；CHANGELOG 标注「需在生产环境补 SECRET」 |
| 不引入 node-cron / rate-limiter-flexible 依赖，自建实现可能存在边界 bug | 中 | 中 | T-2.6/T-2.7 配套单元测试；patrol 默认 dry-run 兜底 |
| SQLite 在 dev 不支持某些 Prisma 特性（如 partial index） | 中 | 低 | AIQuota `@@index([date])` 是普通索引可用；上生产 MySQL 时统一切换 |
| 前端 SSE 在某些浏览器（旧 Edge）支持不全 | 低 | 低 | T-4.3 用 fetch ReadableStream 替代 EventSource，兼容性更好 |
| Canvas 跨 DPR 在 Safari 输出与 Chrome 不一致 | 中 | 低 | T-5.3 强制 DPR=2，单元测试在 Chromium 通过即可 |
| Phase 3 工时超出预期（前端组件密集） | 高 | 中 | 严格按 T-3.x 顺序提交，每个组件独立 commit |

---

*文档维护：每完成一个 Task，将 `- [ ]` 改为 `- [x] ✅`，并 commit。所有 Task 完成后，状态从「进行中」改为「✅ 已完成（YYYY-MM-DD）」。*
