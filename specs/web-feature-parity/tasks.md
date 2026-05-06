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

---

## 附录 A：v5.0.0 GA 端到端测试任务（增量，2026-05-06 追加）

> 配套：[`e2e-scenarios.md`](./e2e-scenarios.md)（35 个场景） + `server/tests/`（Vitest API 测试） + `e2e/`（Playwright 浏览器测试）
>
> 共同密码：`Test1234!` — 账号 U1..U6 详见 `server/prisma/seed-e2e.ts`

### A.0 测试基础设施（已完成）

- [x] **T-A.0.1** ✅ E2E 种子脚本 `server/prisma/seed-e2e.ts`
  - 6 账号 / 双家庭 / 3 宝宝 / 跨午夜睡眠 + 高温 + 异常颜色样本
  - 支持 `--reset` 仅清 e2e 数据、`--bulk=N` 灌注 N 条记录、`--json` 输出供测试 fixture 消费
  - 顶层脚本：`pnpm test:e2e:seed` / `pnpm test:e2e:bulk` / `pnpm --filter server db:seed:e2e:json`
- [x] **T-A.0.2** ✅ 后端 Vitest 配置 + API 客户端 helper
  - `server/vitest.config.ts` 串行执行
  - `server/tests/helpers/api-client.ts` 基于 fetch 的 ApiResponse 封装
  - `server/tests/helpers/seed.ts` 调 seed-e2e 并 parse JSON
- [x] **T-A.0.3** ✅ Playwright 配置 + fixture
  - `playwright.config.ts` chromium 单 worker、baseURL 5173
  - `e2e/fixtures/seed.ts` 共享 seed + `loginViaUI` 工具
  - 顶层脚本：`pnpm test:e2e` / `pnpm test:e2e:ui` / `pnpm test:e2e:report`

### A.1 P0 冒烟（已完成）

后端 API 层（`server/tests/e2e/p0-smoke.test.ts` — 10 passed）：

- [x] **T-A.1.1** ✅ S01 注册 → 创建家庭 → admin 角色
- [x] **T-A.1.2** ✅ S03 邀请码加入（默认 editor）+ 错误码校验
- [x] **T-A.1.3** ✅ S10 admin 创建宝宝 + 非法 birthDate 字符串拒绝
- [x] **T-A.1.4** ✅ S10b 未来生日拒绝（修复 BUG-S10-FUTURE-BIRTH 后启用）
- [x] **T-A.1.5** ✅ S10c 早于 1900-01-01 拒绝
- [x] **T-A.1.6** ✅ S11 editor 创建宝宝 403
- [x] **T-A.1.7** ✅ S16 editor 创建喂养 + todayStats 不退步
- [x] **T-A.1.8** ✅ S25 跨家庭隔离（baby/family/records）
- [x] **T-A.1.9** ✅ viewer 创建被拒 + 可读

浏览器 UI 层（`e2e/p0-smoke.spec.ts` — 3 passed）：

- [x] **T-A.1.10** ✅ S01-UI 注册 + 创建家庭 + 管理员徽章
- [x] **T-A.1.11** ✅ S01b U2 登录 + 家庭文案 + 角色徽章 + 首页今日记录
- [x] **T-A.1.12** ✅ S12+S16 直接访问 /record + /baby 子路由（修复 BUG-LAYOUT-BABIES-RELOAD 后启用）

### A.2 P1 权限/状态机（待办）

后端 API 测试：

- [ ] **T-A.2.1** S04 邀请码过期/格式错误三子用例
- [ ] **T-A.2.2** S05 加入限流 → `RATE_LIMITED` + `Retry-After`
- [ ] **T-A.2.3** S06 升级 editor → admin（双 admin）
- [ ] **T-A.2.4** S07 last-admin guard（拒绝降级唯一 admin）
- [ ] **T-A.2.5** S08 admin 移除 viewer，被移除者 records 保留
- [ ] **T-A.2.6** S09 退出家庭三状态机 ok/need_transfer/dissolved
- [ ] **T-A.2.7** S17 编辑他人记录归属校验（admin 任意 / editor own / viewer 403）
- [ ] **T-A.2.8** S15 editor delete baby 403 + UI 隐藏

### A.3 P2 复杂场景（待办，需要 bulk seed 或 多 page）

后端 / 浏览器混合：

- [ ] **T-A.3.1** S14 大数据量删除 cursor 续传（依赖 `--bulk=5000`）
- [ ] **T-A.3.2** S14b 中断后恢复（kill server 后重启 + OperationLogger.findOngoing）
- [ ] **T-A.3.3** S18 跨设备进行中睡眠 4 子用例（Playwright `browser.newContext` 双窗口）
- [ ] **T-A.3.4** S19 跨午夜睡眠 today 双区间统计（种子已含样本）
- [ ] **T-A.3.5** S31 家庭解散 + 级联清理 + patrol 续跑

### A.4 P3 安全（待办）

- [ ] **T-A.4.1** S26 邀请码枚举攻击 + 错误信息不泄露
- [ ] **T-A.4.2** S27 被移除成员的旧 JWT 处理（401/403/empty 行为）
- [ ] **T-A.4.3** 跨家庭直接操作（PATCH/DELETE 别人家的 record）

### A.5 P4 业务完整（待办）

- [ ] **T-A.5.1** S20 排便（性状/颜色）+ AI 异常提示
- [ ] **T-A.5.2** S21 高温 ≥ 38°C 触发 insight-fallback
- [ ] **T-A.5.3** S22 生长曲线月增长卡
- [ ] **T-A.5.4** S23 records 分页/无限滚动
- [ ] **T-A.5.5** S28 疫苗记录 + 下次提醒
- [ ] **T-A.5.6** S29 里程碑达成动画
- [ ] **T-A.5.7** S30 AI 配额降级三路径（超限/缺凭据/超时）

### A.6 P5 非功能（待办）

- [ ] **T-A.6.1** S32 离线写入 toast（断网模拟 `route.abort()`）
- [ ] **T-A.6.2** S33 主题切换 + 刷新保留
- [ ] **T-A.6.3** S34 退出登录清空 store + localStorage
- [ ] **T-A.6.4** S35 并发编辑同记录（多 page）

---

## 附录 B：测试发现的真实 Bug

> 本节随测试用例发现的 product gap 同步更新，**修复后请把对应 skip 的测试改为 enable**。

### ✅ BUG-S10-FUTURE-BIRTH（已修复 2026-05-06）

| 项 | 内容 |
|----|------|
| 严重度 | P2 |
| 文件 | `server/src/schemas/baby.schema.ts` |
| 现象 | `dateStringSchema` 仅做正则格式校验，未拒绝未来日期，可创建生日 = 明天的宝宝 |
| 修复 | 在 `dateStringSchema` 上追加 3 个 `.refine`：①可解析；② ≤ now + 24h（容忍夏令时/客户端时钟）；③ ≥ 1900-01-01 |
| 验证 | `server/tests/e2e/p0-smoke.test.ts → S10b/S10c` 已 enable，10/10 通过 |

### ✅ BUG-LAYOUT-BABIES-RELOAD（已修复 2026-05-06）

| 项 | 内容 |
|----|------|
| 严重度 | P1（用户体验 —— 直接刷新非首页路由会丢 babies） |
| 文件 | `client/src/app/layout/main-layout.tsx:180` |
| 现象 | `useEffect` deps 缺 `family?.id`：首次执行时 `family` 为 null → 不调 `loadBabies`；后续 `loadFamily` 异步完成后 `family` 有值，但 effect 不会重跑，babies 永远为空数组。<br>触发条件：用户**直接访问** `/baby` 或 `/record` 等子路由（如刷新页面、扫码进入分享链接）。 |
| 修复 | effect deps 加 `family?.id`：`[isAuthenticated, family?.id, loadFamily, loadBabies]` |
| 验证 | `e2e/p0-smoke.spec.ts → S12+S16 切换宝宝 + 记录页` 已 enable，3/3 通过 |

---

## 附录 C：执行手册

### C.1 单次完整跑测

```bash
# Terminal 1: 启动前后端（前提：sqlite dev.db 已 prisma migrate）
pnpm dev

# Terminal 2: 后端 API 测试（自带 reset seed）
pnpm test:api

# Terminal 3: 浏览器测试（自带 reset seed）
pnpm test:e2e

# 看 HTML 报告
pnpm test:e2e:report
```

### C.2 跑大数据量测试

```bash
# 准备 5000 条 records 给 babyA2，专测 S14 cursor 续传
pnpm test:e2e:bulk

# 然后单独跑相关 spec（待补）
pnpm test:e2e e2e/cursor-pagination.spec.ts
```

### C.3 仅跑后端 API 子集

```bash
# 加 vitest 过滤
pnpm --filter server exec vitest run tests/p0-smoke.test.ts -t "S25"
```

### C.4 调试 Playwright

```bash
# 打开 UI 模式（点点鼠标）
pnpm test:e2e:ui

# 单测试 + 跟踪 + headed
pnpm exec playwright test e2e/p0-smoke.spec.ts --headed --debug
```

