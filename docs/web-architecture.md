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

### 2.6.1 AI 按角色差异化（CareRole）

`chat` / `chatStream` / `dailyInsight` 新增可选参数 `role: CareRole`，取值：

```
'mom' | 'dad' | 'grandma_m' | 'grandma_p'
      | 'grandpa_m' | 'grandpa_p' | 'nanny' | 'other'
```

- **System prompt** 通过 `buildRoleSystemPrompt(role, ctx)` 产出不同的"你是谁 / 你关注什么 / 用什么称呼"人设；不同角色 AI 会给出口吻与侧重不同的回答（妈妈 → 兼顾自身；爸爸 → 分担行动；祖辈 → 科学育儿温和提示；月嫂 → 专业观察 + 交接要点）。
- **缓存 key** 扩展为 `daily_insight:${babyId}:${today}:${role ?? 'default'}`，不同角色共存不串味。
- **Role 来源（v5.0.0+ 单一数据源）**：前端仅通过 `lib/care-role.ts#relationToCareRole` 从当前家庭成员的 `FamilyMember.relation` 字段推导；未命中时回落到 `'other'`。**不再保留** `baby_care_preferred_care_role` 的 localStorage 覆盖层（旧键由 `App` 启动时的 `cleanupLegacyPreferredCareRole()` 一次性清理）。
- **relation 字段语义（v5.0.0+）**：用户在「创建家庭 / 加入家庭」表单中通过 `<CareRoleSelector>` 直接选定 CareRole（`'mom' / 'dad' / 'grandma_m' / 'grandma_p' / 'grandpa_m' / 'grandpa_p' / 'nanny' / 'other'`），该值作为 `FamilyMember.relation` 提交到后端（`POST /families` / `POST /families/join` 已有 relation 入参），首页可直接精确命中。`relationToCareRole` 保留对老数据中文自由文本（"妈妈 / 外婆 / 月嫂"等）的关键字降级，保证历史数据兼容。
- **UI（v5.0.0+）**：
  - 创建 / 加入家庭表单：`<CareRoleSelector>` 网格选择（必填），选中后若昵称为空会自动填入身份默认名（可覆盖）。这是**当前版本唯一的身份设置入口**。
  - 家庭成员列表：每个成员行在昵称后展示身份 chip（emoji + 名称），让用户直观感知 AI 洞察依据的身份视角。
  - 首页 AI 每日洞察：**移除了**早期版本的 `<CareRoleBadge>` 手动切换入口；角色自动跟随当前用户在家庭中的 relation，如需变更请在家庭页（未来迭代）或重新加入家庭时调整。

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

### 5.1 字体大小适配（FR-G1.2）

为老年人 / 低视力用户和紧凑信息场景提供统一的 4 档字体缩放：

```
<html data-font-scale="sm"> → 小（0.9x，信息密集）
<html data-font-scale="md"> → 标准（1.0x，默认）
<html data-font-scale="lg"> → 大（~1.15x，更易阅读）
<html data-font-scale="xl"> → 特大（~1.35x，适合老年人；额外放宽行高与点击目标）
```

实现位于：
- `client/src/stores/font-scale-store.ts`：zustand + persist（key `baby_care_font_scale`）
- `client/src/styles/globals.css`：4 套 `:root[data-font-scale='…']` 覆盖 `--text-xs / sm / base / lg / xl / 2xl / 3xl`
- `client/src/components/font-scale-selector.tsx`：4 档切换 UI，v5.0.0+ 内嵌在"我的"页面的"字体大小"卡中（与"主题外观"卡并列，两者共同取代 Settings 曾经的"外观"Tab）

**关键约束**：业务组件必须消费语义类（`.heading-*` / `.body-*` / `.caption`）或 CSS 变量 `var(--text-*)`，**禁止**写死 `text-[14px]` 等任意值样式，否则字体缩放会失效。特大档位同时放宽 `btn-*` / `chip` / `input-base` 的 padding，以满足触屏目标 ≥ 48px 的无障碍要求。

### 5.2 黄疸记录（v5 本地 MVP → v7.2 云端化）

发现页新增"黄疸记录"子入口（`/jaundice`）。

**v5.0.0 MVP（已退役）**：在 `client/src/lib/jaundice.ts` 用 `localStorage[baby_care_jaundice:${babyId}]` 落地，快速验证产品价值。

**v7.2 T-S1-F2 云端化**：

- **新增 `JaundiceRecord` 表**（`server/prisma/schema.prisma`）：`recordDate` / `dayAge` / `kramerZone` / `scleralIcterus` / `tcb` / `tsb` / `category` / `symptoms[JSON]` / `treatments[JSON]` / `note` / `createdBy`；索引 `[babyId, familyId, recordDate]`。
- **5 个端点**：`GET / POST / GET-id / PATCH / DELETE` 挂在 `/api/babies/:id/jaundice/*`，权限矩阵与 milestone 一致（admin 任意，editor 仅自己，viewer 拒绝）。
- **客户端仍用 client 字段名**：`services/jaundice.ts` 内部双向映射 `date↔recordDate / ageDays↔dayAge / scleraYellow↔scleralIcterus / jaundiceType↔category / actions↔treatments`，UI 层（`pages/jaundice/index.tsx`、`components/jaundice-dialog.tsx`）保持不变。
- **React Query 集成**：`hooks/use-jaundice.ts` 提供 `useJaundiceRecords / useCreateJaundice / useUpdateJaundice / useDeleteJaundice`，query key `['jaundice', babyId]`。
- **一次性迁移**：`lib/migrations/jaundice-to-cloud.ts` 在 `MainLayout` `isAuthenticated && babies.length > 0` 后 1.5s 触发（动态 import，不污染入口 chunk）；幂等（标记 `baby_care_jaundice_migrated === 'v1'`）；失败保留 localStorage 下次重试；migrated > 0 时 toast。
- **lib/jaundice.ts 收敛**：保留类型 / 常量 / `computeAgeDays / classifyTsb`；删除 `saveJaundiceRecord / deleteJaundiceRecord`；`listJaundiceRecords` 重命名 `readLocalJaundiceRecords` 仅供迁移用。

字段覆盖医学上常用维度：日龄、Kramer 分区（Ⅰ-Ⅴ）、巩膜黄染、经皮胆红素 TcB、血清胆红素 TSB、主观分类（生理性 / 病理性 / 母乳性）、伴随表现（多选）、处置（多选）、备注。子页交互保持 v5 设计（教育提示条 + 迷你 SVG 趋势图 + 时间线卡片列表）。

### 5.3 成长报告（v5.0.0+）

发现页新增「成长报告」入口（`/report`），提供周报 / 月报两档切换的结构化数据回顾 + 一键分享。设计决策：

- **不新增后端接口 / 表**：报告是既有数据的"纵向汇总视图"，完全基于现有 `/records?startDate&endDate` / `/babies/:id/vaccines` / `/babies/:id/milestones` / `/babies/:id/trend/weekly` 四个端点在前端聚合。避免"每个报告加一个后端接口"造成面条。
- **数据聚合 Hook**：`client/src/hooks/use-report-data.ts` 把四类并行 query 封装为 `ReportData`，提供 `metrics / daily / milestones / vaccines / growth / weeklyTrend / range` 七个字段；时间窗 `computeReportRange(period, birthDate)` 受 `baby.birthDate` 限制（向后裁剪到出生当日 00:00）。
- **页面组织**：`pages/report/index.tsx` 作为容器，7 个分区各自对应一个子组件（`components/report/*`），互相独立，空态粒度到"每个分区"。封面、Tab 切换、头部分享按钮在容器层；`ListSkeleton` 仅覆盖数据区，封面与 Tab 立即可见。
- **AI 总结不自动触发**：为避免"每次打开报告页都扣配额"，`<ReportAiSummary>` 默认渲染"生成 AI 总结"按钮，用户显式点击才调一次 `aiService.chat`；session 内缓存（不持久化到 localStorage，跨页面失效是可接受的）。失败降级为「去 AI 助手详聊」，复用 `autoPrompt` 路由协议（见 §2.9）。
- **分享图**：扩展 `lib/share-canvas.ts` 新增 `renderReportImage`，与既有 `renderShareImage` 共享调色板与 `drawRoundedRect` / `drawCard` / `wrapText` 基础设施；总高度按"AI 总结行数"动态计算，超长文案不会被裁切。
- **与其他页面的信息层次对齐**（关键）：
  - 首页 `<TodaySummary>`：**今天** 当下的仪表盘
  - 记录页 `<InsightSection>`：**本周** 精细趋势（4 张卡 + 范围条 + 建议）
  - 发现页：已移除 `<WeeklyTrendOverview>`，仅保留 FocusCard + 功能入口 + 报告入口
  - 报告页 `/report`：**周 / 月** 结构化回顾（关键指标 + 上周vs本周<仅周报> + 每日节律 + 成就 + AI 总结）
  - 各页面视角互补，避免"三页都看同一份趋势"。

### 5.4 里程碑：打卡（check-in）模式

里程碑（`/milestone`）从"自由添加记录"改为"打卡"模式，对齐小程序端心智：

- **数据约束**：`MilestoneRecord` 在 `(babyId, name)` 上加复合唯一索引（一个里程碑只能有一条记录）；同时新增 `updatedAt` 字段。
- **后端 API 形态**：
  - `POST /api/babies/:id/milestones` 改为 **幂等 upsert**——已存在的同名记录直接返回，不覆盖 `achievedDate` / `note`，避免重复点击产生副本或丢失原始时间。
  - 新增 `PATCH /api/babies/:id/milestones/:milestoneId`（仅允许改 `achievedDate` / `note`，`name` / `category` 由前端的 `MILESTONE_DEFINITIONS` 锚定，禁止修改）。
  - 新增 `DELETE /api/babies/:id/milestones/:milestoneId`（取消打卡 = 删记录）。
  - 鉴权矩阵复用 record：`record:create / record:update:own|any / record:delete:own|any`。
- **前端 UI**：`pages/milestone/index.tsx` 主体 = 28 项标准里程碑列表，每行右侧一个圆形 toggle；点击 toggle 直接打卡 / 取消打卡（取消需二次确认）；点击行打开详情弹窗，已达成态可编辑达成日期 / 备注。删除了"自由添加"表单和"标准推荐"抽屉（与主列表重复）。
- **既有调用方影响**：`milestoneService.list` 返回结构不变，`discover` / `report` / `share-canvas` 等读侧无需调整；语义上"已达成里程碑数"始终是"截至今天累计打卡数"，跟报告周期无强绑定（报告页的 `本期里程碑 N 项` 仍按 `achievedDate` 过滤，因此打卡日 = 当天即落入"本期"）。
- **数据迁移**：dev/prod 库历史可能存在 `(babyId, name)` 重复行；提供一次性脚本 `server/prisma/scripts/dedupe-milestones.ts` 先做去重（保留 `createdAt` 最早的一条），再 `prisma db push` 让 unique 索引生效。

### 5.5 路由级代码分割（v7.2 F9）

为消除 v7.1 之前的"单 chunk 930KB"问题，v7.2 引入路由级 + vendor 级双重代码分割：

```
client/src/app/routes.tsx
  ├─ 14 个 page 全部 React.lazy + 动态 import()
  ├─ 命名导出 → default：.then(m => ({ default: m.XxxPage }))
  └─ lazyEl(El) 通用 Suspense 包装，fallback = <RouteFallback>

client/src/app/layout/route-fallback.tsx
  ├─ 200ms 延迟出现，快速切换近乎无感
  ├─ role="status" / aria-live / aria-label，a11y 完备
  └─ surface-0 背景与 MainLayout 一致，无颜色撕裂

client/vite.config.ts > build.rollupOptions.output.manualChunks
  函数式（Vite 8 / Rolldown 仅支持函数形式），按依赖目录归组：
  ├─ vendor-react   (react / react-dom / react-router-dom / scheduler)
  ├─ vendor-query   (@tanstack/react-query)
  ├─ vendor-radix   (@radix-ui/*，13 个子包)
  ├─ vendor-motion  (framer-motion)
  ├─ vendor-icons   (lucide-react)
  └─ vendor-utils   (axios / clsx / tailwind-merge / cva / zustand)
```

**Bundle 分析**：`pnpm build:analyze` 通过 `ANALYZE=true` 环境变量启用 `rollup-plugin-visualizer`，产出 `client/dist/stats.html`（treemap，含 gzip + brotli）。普通 `pnpm build` 不引入该插件。

**收益（v7.2 F9 实测，2026-05-11）**：
- 应用入口 chunk gzip：289 KB → **15.68 KB**（↓ 94.6%）
- 首屏首页加载 gzip（vendor + entry + home）：289 KB → **231 KB**（↓ 20.0%）
- chunk 数：1 → **49**（长缓存命中率显著提升，更新业务代码不会让用户重新下载 React / Radix / framer-motion）
- 切换 page 增量：仅 2-11 KB gzip（如打开 settings 仅多 2.37 KB，milestone 8.62 KB）
- `>500KB chunks` build 警告：消除

### 5.6 用户偏好 `User.preferences`（v7.2 T-S1-INF-01）

为支持「首次引导是否完成」「语言」「字体档 / 主题跨设备种子」等跨端、跨会话的个性化设置，v7.2 在 `User` 上新增 `preferences` 字段：

```
User.preferences  TEXT (SQLite) / TEXT (MySQL)   ← JSON 字符串
```

**为什么是 JSON 字符串而非独立表 / JSONB**：
- 偏好键稀疏 + 不需要按键索引查询
- 单条用户只有一行偏好，写竞争不存在
- SQLite/MySQL/Postgres 跨数据库通用，零迁移成本
- 前后端跨版本演进时未知键可透传保留

**写入语义（关键）**：
- 写口收敛到 `PATCH /api/auth/profile` 的 `preferences` 入参，服务端 `auth.service.updateProfile` 走"**顶层 key 级深合并**"：
  - 先读旧 preferences，反序列化为对象（脏数据时 fallback 为 null）
  - 用 `mergePreferences(base, patch)` 把 patch 中非 `undefined` 的 key 覆盖到 base
  - 写回 JSON 字符串
- 客户端只需传"想修改的子集"，无需 `先 fetch → 合 → 整段 PUT` 这种竞态模式
- 显式传 `null` 视为"设为 null"，不删除；要"清空"请用合理默认值（`onboardingCompleted: false` 等）
- 未知键透传保留：便于灰度发布、跨小程序/Web 端版本不一致

**类型契约**：
- 共享类型 `shared/types/index.ts#UserPreferences`（已知键带严格类型）
- Zod 校验 `server/src/schemas/auth.schema.ts#userPreferencesPatchSchema`（已知键校验 + `.passthrough()` 允许未知键）
- 前端 store action `useAuthStore().updatePreferences(patch)` 调一次 API 后同步 `user.preferences`，UI 立即生效

**读侧**：
- `sanitizeUser()` 把 `preferences` 字段反序列化为对象输出（旧用户从未写过 → `null`）
- `getMe` / `login` / `register` / `updateProfile` 返回的 `AuthUser` 均带 `preferences: UserPreferences | null`

**与本地 zustand persist 的关系**：
- `font-scale-store` / `theme-store` 仍保留本地 zustand persist，作为运行时副本（保证首屏渲染时立即应用，无网络等待）
- `User.preferences.fontScale / themeMode` 仅作为**跨设备同步种子**：
  - 用户首次登录时，如本地无值 → 用 preferences 的值初始化本地 store
  - 用户切换后写一次 preferences（best-effort，失败不阻塞 UI）
- 这是有意为之的"双写不一致容忍"设计：跨设备最终一致即可，运行时优先本地以保证 0 延迟

### 5.7 文件上传 / 下载链路（v7.2 T-S1-INF-02 方案 B 服务端代理）

为支持头像 / 宝宝头像 / 每日打卡照片等图片上传，v7.2 采用「**客户端 multipart 提交 + 服务端代理 COS putObject/getObjectStream**」架构。**密钥仅在服务端持有**，客户端永远拿不到 COS URL。

```
─────────── 上传链路 ───────────

┌─ Browser ──────────────────────────────────────────────────────┐
│  ImageUploader (component)                                      │
│   ↓ 1. 选图 → uploadService.upload()                             │
│  browser-image-compression                                       │
│   ↓ 2. 压缩 + EXIF 剥离                                           │
│      - avatar / baby-avatar: 长边 512px / JPEG 0.85 / ≤1MB        │
│      - daily-checkin:        长边 1080px / JPEG 0.85 / ≤1MB       │
│      - preserveExif: false（剥 GPS 防泄露）                       │
│   ↓ 3. FormData → POST /api/uploads (multipart/form-data)       │
└──┬──────────────────────────────────────────────────────────────┘
   │ Bearer JWT + presignRateLimit（20 次/分钟/用户）
   ▼
┌─ Express :3000 ────────────────────────────────────────────────┐
│  routes/uploads.ts                                              │
│   ↓ authenticate + multer.single('file')                        │
│   ↓ multer 限制：fileSize=COS_MAX_UPLOAD_BYTES (默认 2MB)        │
│   ↓                + mimetype 白名单 (jpeg/png/webp)             │
│   ↓ validateBody(uploadFieldsSchema) zod 校验 form fields        │
│  upload.service.putObject(userId, kind, ext, buffer, ctx)       │
│   ↓ 1. isConfigured() → 缺 COS_* 任一 → 503                      │
│   ↓ 2. normalizeExt() + validateContext()                       │
│   ↓ 3. buildKey() → avatars/{userId}/{cuid}.{ext} 等             │
│   ↓ 4. cos.putObject({ Bucket, Region, Key, Body, ContentType })│
│  返回 { key, size, contentType }                                 │
└──┬──────────────────────────────────────────────────────────────┘
   │  201 Created
   ▼
┌─ Browser ──────────────────────────────────────────────────────┐
│  业务层落库 key（不是 URL！）                                     │
│   PATCH /auth/profile { avatar: key }                           │
│   POST  /babies/:id/checkins { photoUrl: key, ... }             │
└─────────────────────────────────────────────────────────────────┘


─────────── 下载链路 ───────────

┌─ Browser ──────────────────────────────────────────────────────┐
│  <img src={buildImageUrl(user.avatar)} />                       │
│   等价于 <img src="/api/uploads/avatars/u1/abc.jpg" />           │
└──┬──────────────────────────────────────────────────────────────┘
   │ 同源 cookie（含 JWT）
   ▼
┌─ Express :3000 ────────────────────────────────────────────────┐
│  GET /api/uploads/* → routes/uploads.ts                          │
│   ↓ authenticate                                                 │
│   ↓ isValidKey() 防 path traversal（前缀白名单 / 拒 .. \）         │
│  upload.service.getObjectStream(key)                             │
│   ↓ cos.getObjectStream({ Bucket, Region, Key })                 │
│   ↓ 拿到 Stream + headers                                         │
│  res.setHeader('Cache-Control': public,max-age=86400,immutable)  │
│  stream.pipe(res)  ← 流式转发，零内存累积                         │
└──┬──────────────────────────────────────────────────────────────┘
   │
   ▼
┌─ Tencent Cloud COS（私有读私有写）─────────────────────────────┐
│  仅 SecretId/Key 持有方（我方 server）可读写                     │
└─────────────────────────────────────────────────────────────────┘
```

**关键设计要点**：

| 设计 | 选择 | 理由 |
|------|------|------|
| 服务端代理 | 客户端 → Express → COS（双向） | **密钥不暴露给客户端**；可加业务级权限 / 日志 / 审计 |
| 桶 ACL | 私有读私有写 | 所有访问必经我方服务，绕过 Express 无法拿到任何对象 |
| 上传内存模式 | multer memoryStorage（限 2MB）| 单图场景，写入 Buffer 直接 putObject，无 disk 临时文件 |
| 下载流式 | `getObjectStream + pipe(res)` | 大文件零内存累积；保留 Content-Length / Content-Type |
| 客户端压缩 | 长边 512/1080px + JPEG 0.85 + 目标 ≤1MB | 减小服务端存储开销与下游加载时间 |
| EXIF GPS 剥离 | 客户端 `preserveExif: false` | 避免泄露宝宝家庭地址 |
| key 不可枚举 | randomUUID 32 字符 hex 后缀 | 即使被遍历端点也无法猜出他人 key |
| 路径校验 | isValidKey 前缀白名单 + 拒 `..` `\` 控制字符 | 防 path traversal 攻击 |
| 缓存策略 | `Cache-Control: public, max-age=86400, immutable` | 32 字符 hex key 不会复用，激进缓存安全 |
| 鉴权方式 | 业务 + 上传 + 下载全部 JWT | 同源 cookie 支撑 `<img src>` 自动鉴权 |
| ext 白名单 | jpg / jpeg / png / webp | 阻止上传可执行文件；jpeg 归一化为 jpg |
| 限流 | 20 次/分钟/用户（仅上传） | 防恶意刷写 COS；下载读不限流（依赖浏览器/CDN 缓存） |
| 缺配置降级 | 503 UPLOAD_NOT_CONFIGURED + 前端 toast | 业务主流程不阻塞 |

**DB 字段语义变更（关键）**：

v7.2 起以下字段**统一存桶内 key**，不再存完整 URL：

| 字段 | v7.1 及之前 | v7.2 起 |
|------|------------|---------|
| `User.avatar` | URL 或 null | key（如 `avatars/u1/abc.jpg`） |
| `Baby.avatar` | URL 或 null | key（如 `babies/f1/b1/abc.jpg`） |
| `DailyCheckin.photoUrl`（Sprint 2 F11）| — | key（如 `checkins/f1/b1/2026-05-11-abc.jpg`） |

**展示**：前端用 `buildImageUrl(key)` 拼成 `/api/uploads/{key}` 作为 `<img src>`。
**写入**：上传 API 返回的 `key` 直接作为字段值落库。

> **历史数据兼容**：`buildImageUrl` 对已是 `http(s)://` 开头的字符串原样返回，避免破坏老数据 / 第三方头像（如微信扫码登录拿到的 unionid 头像 URL）。

**与 prisma 落库的解耦**：
- upload.service 只负责把对象写入 COS / 流式读出，**不写业务库**
- 业务接口（`PATCH /auth/profile`、`POST /babies/:id/checkins` 等）拿到 `key` 后自行落库
- 已被覆盖的旧文件（用户换头像后的老 key）依靠 patrol 任务异步清理（v7.2 Sprint 2 F11 时落地 `checkinPhotoCleanup`）

**前端组件**：
- `client/src/services/upload.ts`：核心 service，导出 `uploadService.upload()` + `buildImageUrl(key)`
- `client/src/components/ui/image-uploader.tsx`：通用 render-prop UI 组件
- onChange 回调收到的是 **key**（而非 URL），与 DB 字段语义一致

**复用方**：
- v7.2 Sprint 1 F12：用户头像 + Baby 头像
- v7.2 Sprint 2 F11：每日打卡照片

---

### 5.8 i18n 框架（v7.2 T-S1-F8）

**目录与依赖**：

```
client/src/i18n/
├── index.ts                          # i18next 初始化（同步 import 资源）
├── README.md                         # 使用指南
└── resources/zh-CN/
    ├── common.json                   # actions / states / time / errors / units
    └── nav.json                      # tabs / sidebar / page_titles
```

依赖：`i18next` + `react-i18next` + `i18next-browser-languagedetector`，单独打入 `vendor-i18n` chunk（gzip ~16KB）。

**初始化时序**：

```
main.tsx
  ├── import '@/i18n'                 ← 同步副作用 import，必须在 App 之前
  │   └── i18n.use(LanguageDetector).use(initReactI18next).init({...})
  │       检测顺序：localStorage('baby_care_lang') → navigator.language
  │       fallbackLng: 'zh-CN'
  │       supportedLngs: ['zh-CN']    ← v7.2 仅 zh-CN，其他 locale 走 fallback
  └── createRoot(...).render(<App />)
```

**与 React.lazy 路由的兼容**：

显式 `react.useSuspense: false`，避免 i18n 资源 hydration 与路由 Suspense fallback 重复触发 loading；资源同步 import 后第一次 render 即可读到。

**接入边界（Sprint 1）**：

| 模块 | 命名空间 | 接入任务 |
|---|---|---|
| `app/layout/main-layout` | `nav` | T-S1-F8-02 |
| `pages/home` | `home` | T-S1-F8-03 |
| `pages/record` | `record` | T-S1-F8-03 |
| `pages/report` | `report` | T-S1-F8-04 |
| `pages/ai-assistant` | `ai` | T-S1-F8-04 |
| `pages/settings` | `settings` | T-S1-F8-04 |

未接入页面（discover / profile / baby / family / growth / vaccine / milestone / jaundice / auth）保持原样硬编码中文，v7.3+ 渐进迁移。

**跨设备语言种子**（与 INF-01 联动）：

`User.preferences.lang` 字段在登录后由 `auth-store.user` 注入；F8-05 LanguageSwitcher 切换时同时写 `localStorage('baby_care_lang')` 与 `updatePreferences({ lang })`，下次跨设备登录时能继承用户选择。v7.2 仅写入；UI 暂不读取（因仅 zh-CN 可用）。

**复用方**：

- F1 Onboarding（步骤标题 / 跳过按钮文案）
- 后续所有新功能默认走 i18n（不再允许直接 JSX 中文字面量在新增的 5 高频页面）

---

### 5.9 多宝快捷切换 + URL 参数（v7.2 T-S1-F6）

为支持「分享带 babyId 的链接」「跨设备打开同一胎」，v7.2 引入 URL ↔ store 的双向同步层：

```
URL ?babyId=xxx        ← 用户分享 / 跨设备打开
     │ 命中
     ▼
zustand baby-store      ← persist 到 localStorage
     │ 命中
     ▼
babies[0]              ← 兜底
```

**核心实现**：`client/src/hooks/use-active-baby.ts`：

- 纯函数 `resolveActiveBabyId(urlBabyId, babies, currentBabyId)` 三级优先级解析；URL babyId 不在 babies 时返回 `shouldClearUrl: true` 优雅降级。
- `useActiveBaby()` 在 `MainLayout` 顶部挂一次：useEffect 同步 URL → store + 清除非法 URL；返回 `switchBaby(id)` 给 BabySwitcher / SidebarBabyCard / BabyPage 列表使用，切换时同时改 store + URL（router 的 `replace: true` 不污染 history）+ invalidate `['todayStats' | 'records' | 'activeSleep', babyId]` 三个 React Query。
- 子页面（home / report / growth / jaundice / record / milestone / vaccine 等）只读 `useBabyStore(s => s.currentBaby)`，不再调 `selectBaby`。

**接入点**：`MainLayout` 顶部、`BabySwitcher`、`SidebarBabyCard`、`BabyPage` 列表点击切换；查看者无切换权限不触发。

---

### 5.10 数据导出独立页（v7.2 T-S1-F3）

**演进**：v7.1 导出功能寄生在 `Settings → 资料 tab` 内，仅 2 个按钮（CSV / JSON），固定导出当前 baby 全部 5 类 Record 数据，不可选范围 / 不可选类型 / 没有历史。v7.2 拆出独立页 `/export`，配套后端多类型扩展。

**前端**：`client/src/pages/export/index.tsx`：

- 4 张选择卡片：宝宝 / 时间范围（7d/30d/90d/all/custom）/ 数据类型（8 个 Checkbox）/ 导出格式（CSV/JSON）
- 类型 8 选：feeding / sleep / diaper / temperature / growth / vaccine / milestone / jaundice
- 进度：`exportService.exportData(params, onProgress)` 接 axios `onDownloadProgress`，按钮文案显示百分比
- 历史：`lib/export-history.ts` localStorage FIFO 上限 10 条；只存"文件名 + 元数据 + types[]"，重新下载用相同 params 重发请求（**不依赖后端 7d 链接**）
- 旧 deep link `/settings?tab=export` 在 SettingsPage 挂载时检测并 `replace` 重定向到 `/export`

**后端**：`server/src/services/export.service.ts`：

- 新增 `types[]` 多选参数（zod schema 用 `.transform` 把逗号分隔字符串解析为 enum 数组）
- 保留 `recordType` 单选向后兼容（types 优先）
- 多类型聚合输出：
  - JSON：`{ records?, vaccines?, milestones?, jaundice? }`，未选中字段不出现，避免误用
  - CSV：多 section 输出，section 之间空行 + `# section: <type>` 注释行；jaundice 的 `symptoms / treatments` 数组在 CSV 中以 `|` 分隔
- 时间窗 `startDate / endDate` 同时作用于 4 张表（Record.startTime / Vaccine.vaccinatedDate / Milestone.achievedDate / Jaundice.recordDate）
- 跨家庭隔离：`getFamilyIdForUser` + `baby.familyId` 校验

---

### 5.11 首次使用引导（v7.2 T-S1-F1）

**目标**：新账号首次登录看到 4 步引导（添加宝宝 / 邀请家人 / 记录第一条 / 试问 AI），引导自动跳过老用户已满足的步骤；跳过 / 完成跨设备生效。

**步骤定义**：`client/src/lib/onboarding-steps.ts`：

```typescript
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'create-baby', targetPath: '/baby', skippable: false,
    isAlreadySatisfied: (ctx) => ctx.babiesCount > 0 },
  { id: 'invite-family', targetPath: '/family', skippable: true,
    isAlreadySatisfied: (ctx) => ctx.familyMemberCount > 1 },
  { id: 'first-record', target: '[data-onboarding-target="add-record-fab"]',
    targetPath: '/record', skippable: true,
    isAlreadySatisfied: (ctx) => ctx.hasAnyRecord },
  { id: 'try-ai', targetPath: '/ai-assistant', skippable: true },
]
```

**触发链路**：

```
MainLayout 挂载
  └→ <Suspense><OnboardingHostLazy /></Suspense>   ← 动态 import 不污染入口 chunk
       └→ OnboardingHost 决策（StrictMode 防御 useRef）
            ├→ user.preferences.onboardingCompleted ? 不弹
            ├→ 计算 ctx { babiesCount, familyMemberCount, hasAnyRecord }
            │     └→ hasAnyRecord 用 firstBabyId 查 1 条记录，React Query 缓存 30s
            ├→ findFirstPendingStep(ctx, skipped) === -1 ? 静默 PATCH onboardingCompleted=true
            └→ 找到 pending step i ? 打开 OnboardingOverlay（stepIndex=i）
```

**Overlay 实现**：`components/onboarding/onboarding-overlay.tsx`：

- 基于 Radix Dialog（焦点陷阱 / Esc / aria-modal 全部交给 radix）
- 三段式：步骤 indicator（动态宽圆点） / Lucide icon + title + description / 按钮组
- 目标元素高亮：`querySelector(step.target)` + `getBoundingClientRect`，用 `box-shadow: 0 0 0 9999px <mask>` 在矩形外侧绘制半透蒙层，矩形内部留白 + brand 描边
- `MutationObserver` + `scrollIntoView`：目标元素未渲染时持续观察 DOM；视口外自动滚入；3s 兜底降级为居中卡（不影响主流程）
- 用户行为：「下一步」/「跳过此步」/「去试试」/「Esc / 关闭」/「完成」

**状态保存**：

- 完成 / 跳过整个流程 → `PATCH /api/auth/profile { preferences: { onboardingCompleted: true, onboardingSkippedSteps: [...] } }`
- 单步跳过 → 仅追加 `onboardingSkippedSteps`（不结束流程，下次启动按 skipped 过滤）
- localStorage 不另存任何引导状态（避免双向同步）；强制触发用 `?onboarding=1`

**强制触发 / 测试**：访问 `https://app/?onboarding=1` 即使 `onboardingCompleted=true` 也会重新弹；用户操作（go / skip-all / complete）后会自动 replace URL 清除该参数。

---

## 6. 文件依赖图

详见 [`specs/web-feature-parity/design.md` §9 文件变更清单](../specs/web-feature-parity/design.md)。

## 7. 性能要求

- 首页核心数据（`todayStats` + 5 条 records）4G 网络 ≤ 2s
- 骨架屏 100ms 内渲染
- React Query staleTime ≥ 15s（已配置）
- AI 调用 8s 超时 → 降级文案立即返回
- patrol 任务每天/每周一次，CPU 影响可忽略

## 7.5 登录态与微信登录扩展（v4.3.2+）

### 7.5.1 三层会话保持

```
┌────────────────────────────────────────────────────────────┐
│                       Browser                              │
│                                                            │
│  localStorage.baby_care_token                              │
│   └── { token, user, isAuthenticated }  ← zustand persist  │
│                                                            │
│  localStorage.baby_care_last_login_identifier              │
│   └── { identifier, kind: 'email'|'phone' } ← 自动回填用户名│
│                                                            │
│  localStorage.baby_care_remember_me                        │
│   └── 'true' | 'false'                                     │
│                                                            │
│  cookie: refreshToken (httpOnly, SameSite=Strict, 7d)      │
│   └── path=/api/auth/refresh，仅用于续 access token         │
│                                                            │
└────────────────────────┬───────────────────────────────────┘
                         │ axios interceptor
                         │   (TOKEN_EXPIRED → POST /refresh)
                         ▼
                  续 15min access token
```

**关键不变量**：
- ❌ **绝不**在前端持久化明文密码（XSS 风险）；密码自动填充必须依赖浏览器原生密码管理器（input `autoComplete="current-password"`）。
- ✅ "关闭页面再打开仍登录"由 access token 持久化 + httpOnly refresh token cookie 联合保证。
- ✅ 「记住我」开关只控制是否记忆**用户名**，不控制 access token 的持久化（access token 默认就持久化到主动登出）。

### 7.5.2 微信扫码登录（方案预留，未启用）

```
   /login → 点「微信扫码登录」按钮（仅当 VITE_WECHAT_LOGIN_ENABLED=true 时渲染）
        │
        │ window.location = open.weixin.qq.com/connect/qrconnect
        │   ?appid&redirect_uri&response_type=code&scope=snsapi_login&state=...
        ▼
   微信扫码 → 用户授权 → 跳回我方 redirect_uri?code=xxx&state=xxx
        │
        ▼
   /auth/wechat/callback (WechatCallbackPage)
     1) consumeWechatOauthState(state) ← 防 CSRF
     2) authApi.loginWithWechat({ code, state })
                │
                ▼
        POST /api/auth/wechat
        ├── wechatAuthService.loginByCode(code)
        │     ├─ 检查 WECHAT_WEB_APP_ID/_SECRET 配置 → 缺则 503 WECHAT_NOT_CONFIGURED
        │     ├─ fetchAccessToken: code → access_token + openid + unionid
        │     ├─ fetchUserInfo: access_token + openid → 昵称/头像
        │     └─ TODO: prisma.user.upsert by wechatUnionId（等 schema 落地）
        └── 返回 { user, accessToken } + Set-Cookie refreshToken
     3) 写入 useAuthStore + navigate('/', replace)
```

**未启用原因 & 启用步骤**：

1. **prisma schema 缺字段**：`User` 没有 `wechatUnionId` 唯一字段。启用前需加：
   ```prisma
   model User {
     ...
     wechatUnionId  String?  @unique
     wechatOpenId   String?
   }
   ```
   并 `prisma migrate dev --name add_wechat_union_id`。
2. **企业资质**：微信开放平台「网站应用」要求开发者主体认证（个人开发者目前不支持），且回调域名需 ICP 备案。
3. **环境变量**：前端 `VITE_WECHAT_LOGIN_ENABLED / VITE_WECHAT_APP_ID / VITE_WECHAT_REDIRECT_URI`；后端 `WECHAT_WEB_APP_ID / WECHAT_WEB_APP_SECRET`。

**关于"已有小程序 AppID"的常见误解**：本项目已有微信小程序（AppID `wx1f1bc8e6ff2be61d`），但小程序 AppID **不能直接**用于网站应用 OAuth；网站应用必须在「微信开放平台」单独注册。两个 AppID 关联同一开放平台账号后才能拿到统一的 `unionid` 用于跨端用户体系。

**未来增量**（不在 v4.3.2 范围）：
- 微信小程序内嵌 H5 场景：用「公众号网页授权」(`snsapi_userinfo`) 替代扫码登录
- iOS/Android Native 场景：用「微信 SDK」`onResp` 拿 code 走同一个 `/api/auth/wechat`
- 与小程序端用户打通：`unionid` 关联后在 `User` 表补 `User.openid`（小程序）+ `wechatUnionId` 双索引

## 8. 测试体系（v5.0.0 GA backlog）

```
┌─ server/tests/         Vitest 4
│   ├─ unit/                          纯函数（permission / family-schema / invite-code）
│   ├─ integration/                   service 层 8 个家庭场景测试（共享 SQLite test.db）
│   ├─ helpers/api-client.ts          E2E 用：ApiResponse 封装（token + cookies）
│   ├─ helpers/seed.ts                E2E 用：调 seed-e2e.ts --json 拉 fixture
│   └─ e2e/                           E2E API（HTTP → dev server）
│       ├─ p0-smoke.test.ts                S01..S25 + viewer 主链路（10 用例）
│       ├─ cross-family-isolation.test.ts  跨家庭穷尽接口隔离 + 反向对称（33 用例）
│       └─ same-family-visibility.test.ts  同家庭三角色可见性 + 归属规则（23 用例）
│
├─ e2e/                  Playwright 1.59 — chromium 浏览器
│   ├─ global-setup.ts                启动前 reset seed + 预热 token（规避 authRateLimit）
│   ├─ fixtures/seed.ts               loginViaUI / loginViaAPI（含 ensureFreshToken 自动续期）
│   ├─ p0-smoke.spec.ts               S01-UI / S01b / S12+S16（3 用例）
│   └─ cross-family-isolation.spec.ts U6/U1/U2 视角 + 双 context 并行 + U5 引导态（5 用例）
│
├─ server/vitest.config.ts            单元/集成测试（test.db + globalSetup）
├─ server/vitest.e2e.config.ts        E2E 配置（不重置 db / 走 dev server）
├─ playwright.config.ts               Playwright 配置（globalSetup + 120s timeout）
└─ server/prisma/seed-e2e.ts          E2E 专用种子（独立于默认 seed.ts）
    ├─ 6 账号池（U1-U6） / 双家庭（A/B） / 3 宝宝
    ├─ 跨午夜睡眠 / 高温 / 异常颜色 样本
    ├─ FamilyB 完整种子（records/vaccines/milestones）支持隔离对照
    └─ --bulk=N 灌注大数据量（S14 cursor 续传）
```

**测试矩阵**：
- 后端 unit/integration：75 用例（test.db）
- 后端 E2E API：66 用例（共享 dev server）
- Playwright UI：8 用例（chromium）
- 累计 149 个 E2E/集成自动化测试

**测试场景对照**：见 [`specs/web-feature-parity/e2e-scenarios.md`](../specs/web-feature-parity/e2e-scenarios.md)（35 用例分 6 个优先级）；任务进度见 [`specs/web-feature-parity/tasks.md`](../specs/web-feature-parity/tasks.md) 附录 A。

**执行命令**：详见 [`devops-workflow.md` §6.5](./devops-workflow.md)。

### 8.1 跨家庭数据隔离原则（关键安全保障）

后端所有 service 层都遵循同一隔离模式：

```typescript
// 1. 通过 babyId/recordId 反查实体
const baby = await prisma.baby.findUnique({ where: { id: babyId } });
if (!baby) throw new NotFoundError('宝宝');

// 2. 拿当前用户的 familyId
const familyId = await getFamilyIdForUser(userId);

// 3. 双重校验：用户必有 familyId 且与实体 familyId 相等
if (!familyId || baby.familyId !== familyId) {
  throw new ForbiddenError('无权访问该宝宝数据');
}

// 4. 后续查询强制附加 familyId 条件（防御 ORM 误用）
const where = { babyId, familyId: baby.familyId, ... };
```

**route 层补充防御**（HTTP 入口）：
- `POST /api/families/:id/leave` —— 用户的 familyId !== :id 时直接 403，避免暴露家庭存在性

**所有路由必须用 `asyncHandler` 包装**（否则 service 抛错时请求挂死，造成 DoS 风险，详见 [`tasks.md` 附录 B BUG-VACCINES-EXPORT-NO-ASYNC-HANDLER](../specs/web-feature-parity/tasks.md)）。


