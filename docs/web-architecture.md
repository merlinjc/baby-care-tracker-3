# Web 版架构总览（v5.0.0 alpha — Saplings）

> 版本：v1.0 | 日期：2026-05-06 | 状态：进行中
>
> 配套 spec：[`specs/web-feature-parity/design.md`](../specs/web-feature-parity/design.md) v1.6
>
> 本文档承载 Web 版（client + server + shared monorepo）的当前架构约定。
> 小程序版架构请参考根目录 [`architecture.md`](../architecture.md)。

---

## 1. 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    Browser / Mobile Web                   │
│                                                           │
│   React 19 + TS 6 + Vite + Tailwind 4 + 自实现 ui/        │
│   ├── stores/         Zustand 4 个全局态                   │
│   ├── hooks/          React Query 5 包装                   │
│   ├── components/     12+ 组件（含 family/ + ui/）          │
│   ├── pages/          14 个页面                            │
│   ├── services/       axios 拦截器层 + ApiError 体系        │
│   └── lib/            permission-guard / capsule-state /   │
│                       insight-fallback / today-summary /    │
│                       easter-egg / share-canvas             │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS / Bearer JWT + SSE
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Node.js / Express :3000                      │
│                                                           │
│   Middleware: helmet / cors / morgan / JWT auth /         │
│               persistentRateLimit / Zod validate /         │
│               error-handler                                │
│   ├── routes/    8 模块（auth/records/families/babies/    │
│   │              vaccines/ai/export + index）              │
│   ├── services/  9 个 service（含 ai/trend）              │
│   ├── utils/     date / permission / invite-code /         │
│   │              operation-logger / patrol / patrol-lock   │
│   ├── schemas/   Zod 校验                                  │
│   └── prisma/    Prisma 6 + SQLite(dev) / MySQL(prod)     │
└──────────────────────────┬───────────────────────────────┘
                           │ Prisma
                           ▼
┌──────────────────────────────────────────────────────────┐
│                       MySQL 8 / SQLite                    │
│   users / families / family_members / babies / records    │
│   feeding/sleep/diaper/temperature/growth_records         │
│   vaccine_records / milestone_records                     │
│   operation_logs / rate_limits / ai_quotas (FR-E/F 新增)   │
└──────────────────────────────────────────────────────────┘
```

## 2. 关键决策

### 2.1 不引入小程序"云函数网关"

Web 端 JWT 是可信的 userId，Express service 层 + Zod 校验 + 权限工具已足够；引入网关只会增加复杂度。所有"跨用户写"操作直接通过 service 层 `isFamilyMember` / `isAdmin` 校验。

### 2.2 进行中睡眠的云端会话

`Record.recordType === 'sleep' && Record.endTime === null` ⇒ 进行中。
- 同 baby 同时刻最多一条进行中睡眠（service 层并发校验 → `SLEEP_ALREADY_ACTIVE`）
- "结束睡眠" = `PATCH /records/:id` 写入 endTime + duration
- "取消计时" = `DELETE /records/:id`
- 跨设备一致：`useActiveSleep(babyId)` 通过云端拉取，无需 localStorage

### 2.3 OperationLog 同步落库

8 个 family 写操作 + `deleteBaby` 全部接入 `OperationLogger`。设计为同步落库（< 5ms 开销），不引入消息队列。失败不阻断主流程（catch + console.warn）。

### 2.4 RateLimit 持久化

`rate-limit-persistent.ts` 替代 `express-rate-limit` 内存存储，使用 Prisma `RateLimit` 表。多实例下计数共享。DB 异常时 fail-open（放行）。

### 2.5 Patrol 任务

`utils/patrol.ts` 不引入 `node-cron`，使用 `setInterval` + 启动校时。
- `familyConsistency`：每天 00:00（每小时 tick 检查）
- `aiQuotaCleanup`：每周日 03:00（每天 tick 检查）

分布式锁：`patrol-lock.ts` 基于 RateLimit 表的乐观锁，10 分钟 TTL。

启动守卫：`process.env.NODE_ENV !== 'test' && process.env.PATROL_ENABLED !== 'false'`。

### 2.6 AI 服务降级链

```
chat / chatStream / dailyInsight 调用
    ↓
consumeQuota（原子自增 + 超限抛 QUOTA_EXCEEDED）
    ↓
callOpenAI / callOpenAIStream
  端点：${OPENAI_BASE_URL}/chat/completions（默认 TokenHub · hy3-preview）
  鉴权：Authorization: Bearer ${OPENAI_API_KEY}
  超时：AI_FETCH_TIMEOUT_MS（默认 30s）
  缺 API Key → mock；5xx/超时 → throw
    ↓ 成功                 ↓ 失败（非 QUOTA_EXCEEDED）
返回内容 + 缓存          refundQuota + buildFallbackInsight
```

### 2.7 双层权限闸（Web 客户端）

| 层 | 实现 | 防御对象 |
|----|------|---------|
| UI 层 | `usePermission()` hook 隐藏/禁用按钮 | 普通用户视觉一致性 |
| Hook 层 | `permissionGuard.require(perm)` | 缓存不一致 / URL 直跳 / 灰度漂移 |
| Service 层（后端） | `isFamilyMember` / `isAdmin` + service 内角色判定 | 任何客户端绕过 |

`PermissionGuard.requireCanDelete(record)` 含归属字段防御：admin 可删任意；editor 仅自己创建的。

### 2.8 本周/上周时间窗（FR-B v4.3.2 修订）

| 维度 | 起止 | 备注 |
|------|------|------|
| 本周 | 本周一 00:00（本地时区） → 今天 23:59:59 | 起始受 `baby.birthDate` 限制，向后裁剪到出生日 00:00 |
| 上周 | 上周一 00:00 → 上周日 23:59:59 | 完整 7 天；当 `birthDate` 落在本周或本周之后时返回 `null` |

`GET /api/babies/:id/trend/weekly` 返回的 `WeeklyTrendData` 同时包含 `period`（本周）和 `lastWeekPeriod`（上周）两个时间窗，前端依据两者展示对比。

- 记录页 `<InsightSection>`：仅展示本周日均 + 月龄参考 + 环比文案（细节视角）。
- 发现页 `<WeeklyTrendOverview>`：把上周日均与本周日均放在同一行对比 + 异常行整行高亮 + 一键「向 AI 咨询建议」（总览视角）。

### 2.9 跨页面 AI 预填问题（autoPrompt 协议）

任意页面若想让 AI 助手以一段「带上下文的预填问题」开场，应使用 React Router 的 `state.autoPrompt`：

```ts
navigate('/ai-assistant', { state: { autoPrompt: '...' } })
```

AI 助手页 (`pages/ai-assistant/index.tsx`) 通过 `useLocation().state.autoPrompt` 读取，自动调用一次 `handleSend(prompt)`，并立即 `navigate(pathname, { replace: true, state: null })` 清空 history state，避免刷新或后退后重复触发；同时使用 `autoPromptHandledRef` 防止 React StrictMode 双调用。

## 3. 跨午夜睡眠的 today 统计

```typescript
// record.service.ts#getTodayStats（FR-A 关键修订）
const sleepRecords = await prisma.record.findMany({
  where: {
    babyId, familyId, recordType: 'sleep',
    OR: [
      { startTime: { gte: dayStart, lte: dayEnd } },
      { endTime: { gte: dayStart, lte: dayEnd } },
    ],
  },
  // ...
});
```

返回字段：`lastTime` / `lastTimeTs`（最近一次开始）；`lastEndTime` / `lastEndTimeTs`（最近一次结束）。

## 4. cursor 续传（deleteBaby）

```
首次：DELETE /babies/:id
  ↓ status: 'in_progress', cursor='500'
  → 客户端循环
DELETE /babies/:id?cursor=500
  ↓ status: 'in_progress', cursor='1000'
  → 继续...
DELETE /babies/:id?cursor=2500
  ↓ status: 'succeeded', deletedBabyId, records, vaccine, milestone
```

云端续传：`OperationLogger.findOngoing('deleteBaby', babyId)` 找到未完成日志，从 `chunk_record_*` step 累计恢复进度。客户端不持久化 cursor 到 localStorage（跨设备一致）。

## 5. 主题系统（FR-G1）

```
:root          → 默认亮色（globals.css 已有）
.dark          → 兼容旧 .dark class（globals.css 已有）
[data-theme="warm-night"]  → 暖夜（themes.css 新增，等同 .dark 变量集）
[data-theme="system"] @media (prefers-color-scheme: dark) → 系统暗色映射
```

`useThemeStore.setMode(mode)` 同时设置 `document.documentElement.dataset.theme` 和 `.dark` class，旧组件不破坏。

## 6. 文件依赖图

详见 [`specs/web-feature-parity/design.md` §9 文件变更清单](../specs/web-feature-parity/design.md)。

## 7. 性能要求

- 首页核心数据（`todayStats` + 5 条 records）4G 网络 ≤ 2s
- 骨架屏 100ms 内渲染
- React Query staleTime ≥ 15s（已配置）
- AI 调用 8s 超时 → 降级文案立即返回
- patrol 任务每天/每周一次，CPU 影响可忽略

## 8. 测试体系（v5.0.0 GA backlog）

```
┌─ server/tests/         Vitest 4
│   ├─ unit/                     纯函数（permission / family-schema / invite-code）
│   ├─ integration/              service 层 8 个家庭场景测试（共享 SQLite test.db）
│   ├─ helpers/api-client.ts     E2E 用：ApiResponse 封装（token + cookies）
│   ├─ helpers/seed.ts           E2E 用：调 seed-e2e.ts --json 拉 fixture
│   └─ e2e/p0-smoke.test.ts      E2E API（HTTP）：S01/S03/S10/S10b/S10c/S11/S16/S25 + viewer
│
├─ e2e/                  Playwright 1.59 — chromium 浏览器
│   ├─ fixtures/seed.ts          共享 seed + loginViaUI
│   └─ p0-smoke.spec.ts          S01-UI / S01b 家庭+角色徽章 / S12+S16 子路由直访
│
├─ server/vitest.config.ts       单元/集成测试（test.db + globalSetup）
├─ server/vitest.e2e.config.ts   E2E 配置（不重置 db / 走 dev server）
└─ server/prisma/seed-e2e.ts     专用种子（独立于默认 seed.ts）
    ├─ 6 账号池（U1-U6） / 双家庭（A/B） / 3 宝宝
    ├─ 跨午夜睡眠 / 高温 / 异常颜色 样本
    └─ --bulk=N 灌注大数据量（S14 cursor 续传）
```

**测试场景对照**：见 [`specs/web-feature-parity/e2e-scenarios.md`](../specs/web-feature-parity/e2e-scenarios.md)（35 用例分 6 个优先级）；任务进度见 [`specs/web-feature-parity/tasks.md`](../specs/web-feature-parity/tasks.md) 附录 A。

**执行命令**：详见 [`devops-workflow.md` §6.5](./devops-workflow.md)。

