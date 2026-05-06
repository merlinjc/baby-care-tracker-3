# 设计文档 - Web 版功能对齐与未完成需求落地

> 版本：v1.6 | 日期：2026-05-06 | 状态：✅ 已完成（2026-05-06，v5.0.0-alpha）
>
> 范围：基于 21 份历史 specs（小程序版 v1 → v4.3.2）的设计沉淀，结合 `REFACTORING_PLAN.md` 提出的 Web 版重构方案，对**仍未在 Web 端落地的能力**给出统一实施设计。
>
> 本文档不重复历史 specs 的设计推导过程，仅承接其结论；同时严格区分「已完成」「需补齐」「Web 版替代方案」三类工作，避免重复劳动。
>
> **版本历史**：
> - v1.0（初稿）：完成 0.1~0.4 盘点 + FR-A~G 7 个 FR 域设计
> - v1.1（迭代 1）：修正 `getTodayStats` 跨午夜睡眠丢失问题 + 字段命名一致性（`*Time` ↔ `*TimeTs`）
> - v1.2（迭代 2）：把"进行中睡眠"提升为云端会话（`endTime: null` 的 Record），解决跨设备一致性
> - v1.3（迭代 3）：`family-store.family` 升级为 `FamilyDetail` + `LeaveFamilyResult` 共享类型化
> - v1.4（迭代 4）：patrol 任务接入分布式锁（基于 RateLimit 表）+ 幂等保障
> - v1.5（迭代 5）：AIQuota 数据增长治理（60 天 TTL）+ 配额回滚 + 流式扣费边界
> - v1.6（与 requirements 交叉迭代，5 处修正）：
>   - C1 副标题文案格式与 requirements §2.4 一致（分项使用 2 个全角空格分隔）
>   - C2 进行中睡眠多入口策略明确（HomePage 快捷按钮在已计时态改为打开补录 Dialog）
>   - C3 trend 路由从 vaccines.ts 修正到 babies.ts
>   - C4 deleteBaby cursor 续传改为云端 OperationLog 恢复，不依赖 localStorage（跨设备一致）
>   - C5 客户端权限闸双层防护（UI 层 + hook 层）+ 决策 13

---

## 0. 全局摘要

### 0.1 历史 specs 完成度盘点

| 编号 | spec | 小程序 | Web 端 | Gap |
|------|------|:----:|:----:|------|
| S1 | full-refactor（35 Bug + 配置抽离） | ✅ | ✅（重构后无对应概念） | 无 |
| S2 | home-redesign（首页 14 FR + 多宝/睡眠计时） | ✅ | 🟡 部分 | 多宝头像组、状态胶囊、AI 洞察折叠、骨架屏 |
| S3 | family-collaboration（权限矩阵 + 邀请码） | ✅ | 🟡 后端✅，前端缺 UI | 角色编辑、转让管理员、移除成员、退出家庭 UI |
| S4 | feeding-quick-amounts-update | ✅ | ❌ | quickAmounts 数组 [10, 30…210] |
| S5 | performance-optimization（48 FR） | ✅ | ⚠️ Web 体系无对应 | 改为 React Query + 虚拟化（已部分） |
| S6 | record-header-redesign（today 摘要副标题） | ✅ | ❌ | 记录页 page-header + 副标题 |
| S7 | share-image-optimization（V1） | ✅ | ❌ | Web 分享方案未落地 |
| S8 | share-image-v2（10 模块成绩单） | ✅ | ❌ | Web 分享方案未落地 |
| S9 | ui-redesign-v4（v4.0 全局视觉） | ✅ | 🟡 基础完成 | 状态胶囊/进度条摘要/聚焦卡片/时间轴线 |
| S10 | v4.1-ai-shield-and-share-auth | ✅ | ⚠️ 不适用（JWT 不存在 openid 漂移） | 仅 ensureUserReady 思想可复用 |
| S11 | v4.1.1-data-fix-and-polish | ✅ | ⚠️ 不适用 | — |
| S12 | v4.2-cloud-function-gateway（13 action 网关） | ✅ | ⚠️ 重构为 Express middleware | 已实现，无 Gap |
| S13 | v4.2-e2e-security-tests（126 用例） | ✅ | ❌ | Web 端未建立 E2E |
| S14 | v4.2.2-docs-alignment-and-hotfix | ✅ | ⚠️ 部分文档对齐 | — |
| S15 | v4.3.0-stability-and-observability | ✅ | 🟡 基础完成 | operation_logs / rate_limits / patrol 未启用 |
| S16 | v4.3.1-review-fixes | ✅ | 🟡 部分 | 默认角色 viewer / leaveFamily 状态机已对齐，patrol 未启用 |
| S17 | v4.3.2-cursor-and-patrol | ✅ | ❌ | clearBabyData cursor 续传、patrol 自修复 |
| S18 | easter-eggs（成长彩蛋） | ✅ | ❌ | 8 类彩蛋检测引擎 |
| S19 | warm-night-mode（暖夜模式） | ✅ | 🟡 仅 theme-store 框架 | 完整 CSS 变量覆盖 + 三态切换 UI |
| S20 | insight-trend-enhancement（趋势 + 范围条） | ✅ | ❌ | 趋势分析 + 提示语 + 范围条 |
| S21 | v4.3.0 三层缓存 + PermissionGuard 客户端闸 | ✅ | ❌ | usePermission hook 已存在但闸功能薄弱 |

### 0.2 Web 端现状

```
client/src/
├── app/                    React Router + 双 Layout（Auth/Main）
├── components/             7 个核心 Dialog + Timeline + BabyCard
├── components/ui/          仅 dialog + segmented-control（缺 toast/popover/sheet/tabs/skeleton）
├── pages/                  13 个页面骨架（home/record/discover/profile/auth×2/baby/family/growth/vaccine/milestone/ai-assistant/settings）
├── services/               api / auth / baby / record / family / ai / baby-extra
├── stores/                 auth / baby / family / theme（4 个 Zustand store）
├── hooks/                  use-auth / use-dialog / use-permission / use-theme
├── lib/                    date / record / utils / who-standards / vaccine-plans / milestone-defs
└── types/index.ts          仅 re-export shared/

server/src/
├── app.ts                  Express + helmet + cors + rate-limit + morgan
├── routes/                 8 个路由模块（auth/records/families/babies/vaccines/ai/export + index）
├── services/               8 个 Service（auth/baby/family/record/vaccine/milestone/trend/export）
├── middleware/             auth(JWT) / cors / error-handler / rate-limit / validate
├── schemas/                Zod 校验（auth/baby/family/record/common）
├── utils/                  date / invite-code / permission / logger / async-handler
└── prisma/schema.prisma    SQLite (dev) / 完整 ER 模型 + OperationLog + RateLimit
```

### 0.3 已完成的核心能力（不再讨论）

后端：
- ✅ JWT auth（register/login/refresh/me/profile/changePassword）
- ✅ Family 完整 CRUD（含 leaveFamily 状态机 `ok | dissolved | need_transfer | family_not_found | not_member`）
- ✅ Baby CRUD（含 cursor 分批 deleteBaby）
- ✅ Record CRUD（含 5 种子表 + 权限矩阵 + getTodayStats）
- ✅ Vaccine / Milestone / Trend / Export
- ✅ 权限工具（hasPermission / isAdmin / isFamilyMember / getUserFamilyRole）
- ✅ Zod 参数校验 + 全局错误处理 + 速率限制（auth/family/ai/export）

前端：
- ✅ Zustand 4 store（auth/baby/family/theme）
- ✅ React Query 全局配置（staleTime 15s + retry 1）
- ✅ React Router + 双 Layout
- ✅ 5 种记录的 Dialog 组件（feeding/sleep/diaper/temperature/growth）
- ✅ Timeline 组件 + BabyCard 组件
- ✅ axios 拦截器 + 自动刷新 token

### 0.4 未完成需求（本次设计目标）

按价值与依赖关系排序，分为 7 个 FR 域：

| FR 域 | 需求点 | 来源 spec | 优先级 |
|------|--------|---------|------|
| **FR-A** 首页对齐 v4.0 | 多宝切换、状态胶囊、进度条摘要、AI 洞察折叠、骨架屏 | S2 + S9 | P0 |
| **FR-B** 趋势洞察 | 范围条、智能状态、环比、提示语、骨架屏 | S20 | P0 |
| **FR-C** 家庭协作 UI | 角色编辑、移除、转让、退出（后端已就绪） | S3 + S10 | P0 |
| **FR-D** 记录页对齐 | page-header + 今日速览副标题 + 筛选吸顶 + 日期分组 | S6 + S9 | P1 |
| **FR-E** 可观测性 | OperationLog 接入 + RateLimit 持久化 + patrol 任务 | S15 + S17 | P1 |
| **FR-F** AI 接入 + 配额 | 混元 API 直调 + 每日洞察 + 配额管理 | S2.FR-14 + REFACTORING_PLAN §11 | P1 |
| **FR-G** 暖夜模式 + 彩蛋 + 分享图 | 暖夜三态、8 类彩蛋、报告分享 PNG | S18 + S19 + S7/S8 | P2 |

---

## 1. 架构设计

### 1.1 分层架构（沿用 REFACTORING_PLAN）

```
┌─────────────────────────────────────────────────────────┐
│                  Browser / Mobile Web                    │
│                                                          │
│  React 18 + TS + Vite + Tailwind + shadcn/ui            │
│  ├── stores/(Zustand)  ├── hooks/(React Query)          │
│  ├── components/       ├── pages/                        │
│  └── services/(API 调用层)                                │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / Bearer Token
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Node.js / Express :3000                   │
│                                                          │
│  Middleware: helmet / CORS / morgan / JWT auth /         │
│              rate-limit / Zod validate / error-handler   │
│  ├── routes/    业务路由（8 模块）                         │
│  ├── services/  业务逻辑（含权限校验）                      │
│  ├── utils/     date / permission / invite-code / logger │
│  └── prisma/    Prisma ORM + MySQL/SQLite                │
└──────────────────────────┬──────────────────────────────┘
                           │ Prisma
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       MySQL 8.0                          │
│  users / families / family_members / babies / records    │
│  vaccine_records / milestone_records                     │
│  + operation_logs（v4.3 引入）                             │
│  + rate_limits（v4.3 引入）                                │
└─────────────────────────────────────────────────────────┘
```

### 1.2 与小程序架构的映射对照

| 维度 | 小程序版 | Web 版（已对齐） | 说明 |
|------|---------|----------------|------|
| 身份识别 | wx.cloud OPENID | JWT userId | userId = users.id（cuid） |
| 家庭隔离 | memberOpenids 数组 | family_members 关联表 | Web 不需要冗余字段 |
| 跨用户写 | familyOperation 网关 | Express 中间件 + service | Express 直接走 service |
| 安全规则 | NoSQL ACL + get() 校验 | service 层 isFamilyMember/isAdmin | 应用层显式校验 |
| 离线队列 | wx.storage + sync.js | IndexedDB + Service Worker | **本设计落地** |
| AI 服务 | wx.cloud.extend.AI | 混元 HTTP API | **本设计落地** |
| 操作日志 | operation_logs 集合 | OperationLog 表（已有 schema） | **本设计接入** |
| 限流 | rate_limits 集合 | RateLimit 表（已有 schema）+ rate-limiter-flexible | **本设计补齐** |
| 巡检 | patrolMemberOpenids 定时云函数 | node-cron + 一致性检查 | **本设计落地** |

### 1.3 灰度策略

本批改造按 FR 域独立灰度，**所有 FR 改动满足以下原则**：

1. **向后兼容** — 后端任何字段新增使用 `optional`；前端任何 store 字段新增使用默认值
2. **降级路径** — AI/分享/彩蛋这类高度可选能力，主链路失败时降级为静态文案/隐藏入口
3. **可观测** — 所有写操作通过 OperationLogger 落库；前端所有 API 调用通过 axios 拦截器自动追踪
4. **可回滚** — 每个 FR 的客户端代码与服务端代码独立部署，灰度 24h 无异常再合并主分支

---

## 2. FR-A：首页对齐 v4.0

### 2.1 数据模型扩展

#### 2.1.1 后端 `getTodayStats` 字段补齐

**问题**：当前返回的 `lastTime` 仅有 ISO 字符串，前端需要 `lastTimeTs`（毫秒时间戳）做距离计算；缺少 `latestValue`（最新体温值，已有但需统一名称）。

**逻辑陷阱**：`record.service.ts` 当前 `findMany` 是按 `startTime desc` 排序的，因此 `feedingRecords[0]` 是**当日最近一次开始**喂养——这正是「上次喂养 1h32m 前」想要的语义。但「最近一次结束」语义不同：一段从昨晚 23:00 开始、今晨 06:30 结束的睡眠，其 `startTime`（23:00）按"今日"过滤会被排除，而 `endTime`（06:30）才属于今日。当前 `whereBase` 只筛 `startTime` 范围，会丢掉"跨午夜结束"的睡眠。

**方案**：服务端 `record.service.ts#getTodayStats` 双区间扫描 + 显式排序选最值：

```typescript
// server/src/services/record.service.ts#getTodayStats 返回结构调整
// ① 喂养：当日 startTime 区间内最新一条
const feedingRecords = await prisma.record.findMany({
  where: { ...whereBase, recordType: 'feeding' },
  include: { feedingData: true },
  orderBy: { startTime: 'desc' },
});
const lastFeeding = feedingRecords[0];

// ② 睡眠：拓宽到「endTime 落在今日」或「startTime 落在今日」
const sleepRecords = await prisma.record.findMany({
  where: {
    babyId, familyId: baby.familyId, recordType: 'sleep',
    OR: [
      { startTime: { gte: dayStart, lte: dayEnd } },
      { endTime:   { gte: dayStart, lte: dayEnd } },
    ],
  },
  include: { sleepData: true },
  orderBy: { startTime: 'desc' },
});
// 最新结束时间（用于「上次醒来 X 前」）：从所有有 endTime 的记录中找最大值
const lastSleepEnd = sleepRecords
  .filter(r => r.endTime)
  .reduce<Date | null>((max, r) => !max || r.endTime! > max ? r.endTime! : max, null);

return {
  feeding: {
    count: feedingRecords.length,
    totalAmount: feedingRecords.reduce((s, r) => s + (r.feedingData?.amount ?? 0), 0),
    lastTime: lastFeeding?.startTime.toISOString() ?? null,
    lastTimeTs: lastFeeding?.startTime.getTime() ?? null,  // ★ 新增
  },
  sleep: {
    count: sleepRecords.length,
    totalDuration: sleepRecords.reduce((s, r) => s + (r.sleepData?.duration ?? 0), 0),
    lastTime: sleepRecords[0]?.startTime.toISOString() ?? null,
    lastEndTime: lastSleepEnd?.toISOString() ?? null,
    lastEndTimeTs: lastSleepEnd?.getTime() ?? null,
  },
  diaper: { count, peeCount, poopCount, lastTime, lastTimeTs },
  temperature: {
    count,
    latestValue: tempRecords[0]?.temperatureData?.temperature ?? null,  // 重命名（覆盖旧 lastValue）
    lastTime, lastTimeTs,
  },
};
```

**字段命名一致性约定**：所有 `*Time` 字段配套 `*TimeTs`（毫秒数）；前端优先用 `*TimeTs` 做差值计算，避免反复 `parseISO`。

**Shared 类型同步**（`shared/types/index.ts`，**注意 breaking**：`temperature.lastValue` → `temperature.latestValue`，需在 CHANGELOG 记录前端 ProfilePage/HomePage 等取值点的迁移）：

```typescript
export interface TodayStats {
  feeding: { count: number; totalAmount: number; lastTime: string | null; lastTimeTs: number | null };
  sleep:   { count: number; totalDuration: number; lastTime: string | null; lastTimeTs: number | null; lastEndTime: string | null; lastEndTimeTs: number | null };
  diaper:  { count: number; peeCount: number; poopCount: number; lastTime: string | null; lastTimeTs: number | null };
  temperature: { count: number; latestValue: number | null; lastTime: string | null; lastTimeTs: number | null };
}
```

### 2.2 多宝切换（FR-A1）

**前置**：`baby-store.ts` 已支持 `babies / currentBaby / setCurrentBaby`。

**前端实现**（`client/src/pages/home/index.tsx` 顶部 GreetingBar 区）：

```tsx
// client/src/components/baby-switcher.tsx（新建）
export function BabySwitcher() {
  const { babies, currentBaby, setCurrentBaby } = useBabyStore();
  if (babies.length <= 1) return null;
  const others = babies.filter(b => b.id !== currentBaby?.id).slice(0, 3);
  const more = babies.length - 1 - others.length;
  return (
    <div className="flex items-center -space-x-2">
      {others.map(b => (
        <button key={b.id} onClick={() => setCurrentBaby(b)} className="h-10 w-10 rounded-full ring-2 ring-background overflow-hidden">
          <BabyAvatar baby={b} />
        </button>
      ))}
      {more > 0 && (
        <span className="h-10 w-10 rounded-full bg-muted text-xs flex items-center justify-center ring-2 ring-background">+{more}</span>
      )}
    </div>
  );
}
```

切换交互：点击头像 → `setCurrentBaby(baby)` → React Query `invalidate(['records', babyId])` 自动重拉今日数据。

### 2.3 状态胶囊（FR-A2）

**承接** S2.FR-1/FR-10 + S9 §2.3。胶囊承载 4 种态：

```tsx
// client/src/components/status-capsule.tsx（新建）
type CapsuleState = 'none' | 'sleeping' | 'feeding_ago' | 'sleep_abnormal';
export function StatusCapsule({ baby, stats, activeSleep, onEndSleep, onCancelAbnormal }: Props) {
  const state = computeCapsuleState(stats, activeSleep);  // 算法见 S2 §3.2
  return (
    <div className={cn('flex items-center gap-3 px-4 h-14 rounded-2xl transition-colors', stateBgClass[state])}>
      <CapsuleIcon state={state} />
      <span className="flex-1 text-sm">{capsuleText(state, stats, activeSleep)}</span>
      {state === 'sleeping' && <RecIndicator />}
      {state === 'sleeping' && <Button size="sm" variant="primary" onClick={onEndSleep}>结束</Button>}
      {state === 'sleep_abnormal' && <Button size="sm" variant="destructive" onClick={onCancelAbnormal}>取消计时</Button>}
    </div>
  );
}
```

#### 2.3.1 跨设备一致的睡眠会话（重要修订）

**问题**：小程序版用 `wx.storage` 单端存 `active_sleep`，因为微信账号天然单端。Web 端家长可能在「手机 Web」开始计时、「平板 Web」结束，localStorage 不能跨设备同步。

**方案**：把"进行中的睡眠"作为一条**未完成的 Record**直接落库（`endTime: null`），而不是仅存 localStorage。

**数据约定**：
- `Record.recordType === 'sleep' && Record.endTime === null` ⇒ "进行中"
- 同一 baby 同一时刻最多一条「进行中睡眠」（service 层在创建时校验）
- 「结束睡眠」实质上是 `PATCH /records/:id` 把 `endTime` 与 `sleepData.duration` 写入

**后端约束**（`record.service.ts#createRecord` 增量）：

```typescript
// server/src/services/record.service.ts#createRecord 顶部追加
if (data.recordType === 'sleep' && !data.endTime) {
  // 进行中睡眠校验：同一 baby 不能并发
  const ongoing = await prisma.record.findFirst({
    where: { babyId: data.babyId, recordType: 'sleep', endTime: null },
  });
  if (ongoing) {
    throw new ConflictError(
      '已有进行中的睡眠记录，请先结束当前计时',
      ErrorCodes.SLEEP_ALREADY_ACTIVE,
    );
  }
}
```

**前端 hook**（替换原方案）：

```typescript
// client/src/hooks/use-active-sleep.ts（新建）
export function useActiveSleep(babyId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: activeSleep } = useQuery({
    queryKey: ['activeSleep', babyId],
    queryFn: async () => {
      if (!babyId) return null;
      const result = await recordService.getRecords({
        babyId,
        recordType: 'sleep',
        // 后端透传 endTimeIsNull=true
        // 由路由 layer 翻译为 Prisma where { endTime: null }
        page: 1, pageSize: 1,
        // ↓ 见 §2.3.2 路由扩展
        endTimeIsNull: 'true' as any,
      });
      return result.items[0] ?? null;
    },
    enabled: !!babyId,
    staleTime: 30 * 1000,
  });

  const start = useCallback(async (sleepType: 'night' | 'nap') => {
    if (!babyId) return;
    permissionGuard.require('record.create');  // ★ 双层防护：hook 层校验
    const record = await recordService.createRecord({
      babyId,
      recordType: 'sleep',
      startTime: new Date().toISOString(),
      sleepData: { sleepType, duration: 0 },  // 进行中时 duration=0
    });
    queryClient.setQueryData(['activeSleep', babyId], record);
    return record;
  }, [babyId, queryClient]);

  const end = useCallback(async () => {
    if (!activeSleep) return;
    permissionGuard.require('record.edit');  // ★
    const startTs = new Date(activeSleep.startTime).getTime();
    const duration = Math.round((Date.now() - startTs) / 1000);
    const updated = await recordService.updateRecord(activeSleep.id, {
      endTime: new Date().toISOString(),
      sleepData: { ...activeSleep.sleepData, duration },
    });
    queryClient.setQueryData(['activeSleep', babyId], null);
    queryClient.invalidateQueries({ queryKey: ['todayStats', babyId] });
    queryClient.invalidateQueries({ queryKey: ['records', babyId] });
    return updated;
  }, [activeSleep, babyId, queryClient]);

  const cancel = useCallback(async () => {
    if (!activeSleep) return;
    permissionGuard.requireCanDelete(activeSleep);  // ★ 含归属校验（仅创建者或 admin）
    await recordService.deleteRecord(activeSleep.id);
    queryClient.setQueryData(['activeSleep', babyId], null);
  }, [activeSleep, babyId, queryClient]);

  return { activeSleep, start, end, cancel };
}
```

#### 2.3.2 路由层支持 `endTime IS NULL` 过滤

`server/src/schemas/record.schema.ts` 的 `getRecordsQuerySchema` 增加可选字段：

```typescript
endTimeIsNull: z.enum(['true', 'false']).optional(),
```

`record.service.ts#getRecords` 在 where 构造时：

```typescript
const where: Prisma.RecordWhereInput = {
  babyId,
  familyId: baby.familyId,
  ...(recordType && { recordType }),
  ...(query.endTimeIsNull === 'true' && { endTime: null }),
  ...(query.endTimeIsNull === 'false' && { endTime: { not: null } }),
  ...(startDate && !query.endTimeIsNull && { startTime: { gte: new Date(startDate) } }),
  ...(endDate   && !query.endTimeIsNull && { startTime: { lte: new Date(endDate) } }),
};
```

注意：`endTimeIsNull` 与日期范围互斥（仅"进行中"语义），避免逻辑组合。

#### 2.3.3 异常态判定

`sleep_abnormal` ⇔ 进行中睡眠且 `Date.now() - startTimeTs > 24h`。前端定时器（每 60s）检查并切换胶囊态；用户「取消计时」走 `cancel()`，删除该未完成记录。

#### 2.3.4 多入口策略（对齐 requirements FR-A1.AC9~AC11）

进行中睡眠的入口和补录历史睡眠的入口需明确区分，避免数据双写：

| 入口 | 触发条件 | 行为 |
|------|---------|------|
| 状态胶囊「开始」按钮（未来扩展） | 当前无进行中睡眠 | 调 `useActiveSleep().start('nap')` 创建 `endTime: null` 记录 |
| 状态胶囊「结束」按钮 | 当前有进行中睡眠 | 调 `useActiveSleep().end()` 写 endTime + duration |
| 状态胶囊「取消计时」按钮 | 进行中睡眠且 >24h 异常态 | 调 `useActiveSleep().cancel()` 删除该 record |
| 快捷按钮区「睡眠」按钮（HomePage） | 当前无进行中睡眠 | 同状态胶囊「开始」（调 `start()`） |
| 快捷按钮区「睡眠」按钮（HomePage） | 当前已有进行中睡眠 | **改为打开 `<SleepDialog>`** 用于补录历史睡眠（含 startTime+endTime），不创建 `endTime: null` 记录 |
| `<SleepDialog>` 标准提交 | 用户填完整 startTime + endTime + duration | 调 `recordService.createRecord` 标准路径，不影响进行中睡眠 |

`HomePage` 的 SleepQuickButton 行为伪代码：

```tsx
const { activeSleep, start } = useActiveSleep(currentBaby?.id);
const handleSleepQuickClick = () => {
  if (activeSleep) {
    // 已在计时 → 改为打开补录对话框
    sleepDialog.open({ mode: 'create' });
  } else {
    // 直接开始计时
    start('nap').catch(err => toast(err.message));
  }
};
```

### 2.4 进度条摘要（FR-A3）

**承接** S9 §2.4。4 列网格，48px 大字号 + 4px 进度条：

```tsx
// client/src/components/today-summary.tsx（新建）
const goals = (ageMonths: number) => ({
  feeding: 8,
  sleep: ageMonths <= 3 ? 14*3600 : ageMonths <= 11 ? 13*3600 : 12*3600,
  diaper: 6,
});
```

进度条颜色取对应功能色（feeding/sleep/diaper），体温列无进度条（保留语义色：正常/低烧/发烧）。

点击任一列 → `dialogMap[type].openDialog()`（直接打开对应弹窗，符合 v4.0 「一次点击」原则）。

### 2.5 AI 洞察折叠态（FR-A4，与 FR-F 联动）

**已存在**：`HomePage` 内已有 `dailyInsight` state；缺折叠/展开切换。

**改造**：

```tsx
// 顶部新增 collapsed state（持久化到 localStorage）
const [insightCollapsed, setInsightCollapsed] = useLocalStorageState('ai_insight_collapsed', false);

// 一行式收起态：emoji 灯泡 + 摘要前 30 字 + chevron
// 展开态：完整摘要 + suggestions[] + alerts[] + 「更多建议」link
```

降级文案（AI 服务不可用时）由前端规则引擎产出，逻辑参考 S2 §3.10 `buildFallbackInsight`，复刻为 `client/src/lib/insight-fallback.ts`。

### 2.6 骨架屏（FR-A5）

**前置**：需要补 `client/src/components/ui/skeleton.tsx`（标准 shadcn/ui 组件）。

**应用**：HomePage 在 `currentBaby === null || stats === defaultStats` 时显示骨架；TodaySummary、Timeline、InsightSection 各自有骨架占位。

---

## 3. FR-B：趋势洞察

### 3.1 后端 `trend.service` 扩展

**问题**：当前 `trend.service.ts` 仅返回原始 trend 数据，缺范围条所需的 `referenceRange`、智能状态判定。

**方案**：将小程序 S20 §3 的常量与算法移植到服务端：

```typescript
// server/src/services/trend.service.ts（增量）
const REFERENCE_RANGES = {
  feeding: { 0: { min: 8, max: 12 }, 1: { min: 6, max: 10 }, 3: { min: 5, max: 8 }, 6: { min: 4, max: 6 }, 12: { min: 3, max: 5 }, 24: { min: 3, max: 5 } },
  sleep:   { 0: { min: 14, max: 17 }, 1: { min: 14, max: 17 }, 3: { min: 12, max: 16 }, 6: { min: 12, max: 15 }, 12: { min: 11, max: 14 }, 24: { min: 10, max: 13 } },
  diaper:  { 0: { min: 3, max: 8 }, 1: { min: 2, max: 5 }, 3: { min: 1, max: 4 }, 6: { min: 1, max: 3 }, 12: { min: 1, max: 3 } },
};

// 新增方法 getEnhancedWeeklyTrend(userId, babyId)
async getEnhancedWeeklyTrend(userId: string, babyId: string) {
  const baby = await this.assertAccess(userId, babyId);
  const ageMonths = computeAgeMonths(baby.birthDate);
  const [thisWeek, lastWeek] = await Promise.all([
    this.aggregateWeek(babyId, 0),
    this.aggregateWeek(babyId, -1),
  ]);
  
  const enhance = (dim: string, thisAvg: number, lastAvg: number) => {
    const range = REFERENCE_RANGES[dim]?.[findMatchedKey(ageMonths)];
    const status = calculateStatus(thisAvg, range);
    return { thisWeekAvg: thisAvg, lastWeekAvg: lastAvg, range, status, tip: TIP_MESSAGES[dim][status], changePercent: pctChange(thisAvg, lastAvg) };
  };
  
  return {
    feeding:     enhance('feeding', thisWeek.feedingAvg, lastWeek.feedingAvg),
    sleep:       enhance('sleep',   thisWeek.sleepHoursAvg, lastWeek.sleepHoursAvg),
    diaper:      enhance('diaper',  thisWeek.diaperAvg, lastWeek.diaperAvg),
    temperature: enhanceTemp(thisWeek.tempAbnormal),
    period: { start, end },
  };
}
```

### 3.2 路由

新增端点应挂在 **`server/src/routes/babies.ts`**（与 baby 资源关联），而非 `vaccines.ts`（vaccines.ts 仅服务 vaccine_records 资源）：

```typescript
// server/src/routes/babies.ts 增量
router.get(
  '/:id/trend/weekly',
  validateParams(babyIdParamSchema),
  asyncHandler(async (req, res) => {
    const result = await trendService.getEnhancedWeeklyTrend(req.userId!, req.params.id);
    res.json({ success: true, data: { trend: result } });
  })
);
```

**当前现状**：`babies.ts` 已挂在 `/api/babies` 前缀下；新端点最终路径 = `GET /api/babies/:id/trend/weekly`，与 requirements §5.1 一致。

### 3.3 前端 InsightSection 组件

**新建** `client/src/components/insight-section.tsx`，结构对齐小程序 S20 §5：

- 标题栏：图标 + 「本周趋势」 + period text + 折叠箭头
- 4 张卡片：每张 4 行（图标行 / 范围条行 / 数据行 / 提示行）
- 范围条：60% 中央正常区（绿色 30% 透明）+ 定位点（normal/left/right 三色）
- 骨架屏：4 张卡片均使用 skeleton.tsx

封装 `useWeeklyTrend(babyId)` hook（基于 React Query，staleTime: 30s）。

---

## 4. FR-C：家庭协作 UI

### 4.1 现状

后端 8 个 family endpoint 已就绪（list/detail/members/join/leave/dissolve/refresh-invite/role/remove/transfer-admin）。

前端 `family-store.ts` 仅 `family / loadFamily`，缺：
- ❌ 角色编辑
- ❌ 移除成员
- ❌ 转让管理员
- ❌ 退出家庭（仅入口未对接 `leaveFamily` 状态机）

### 4.2 store 扩展

**类型对齐**：当前 `family-store.ts` 仅持 `Family`，但所有家庭协作 UI 都需要 `members`/`babies`，必须升级为 `FamilyDetail`。

```typescript
// shared/types/index.ts 补齐 LeaveFamilyResult
export type LeaveFamilyStatus = 'ok' | 'dissolved' | 'need_transfer' | 'family_not_found' | 'not_member';
export interface LeaveFamilyResult {
  status: LeaveFamilyStatus;
  message: string;
  otherMembers?: Array<Pick<User, 'id' | 'nickname' | 'avatar'>>;
}

// client/src/stores/family-store.ts 全量替换
interface FamilyStore {
  family: FamilyDetail | null;            // ← 升级为 Detail
  loading: boolean;
  error: string | null;
  loadFamily: () => Promise<void>;
  refreshInviteCode: () => Promise<void>;
  updateMemberRole: (userId: string, role: FamilyRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  transferAdmin: (newAdminId: string) => Promise<void>;
  leaveFamily: () => Promise<LeaveFamilyResult>;
  dissolveFamily: () => Promise<void>;
  // 选择子（避免组件直接访问 family.members 触发 null guard）
  isCurrentUserAdmin: (currentUserId: string) => boolean;
}
```

**升级影响面**：
- `useFamilyStore(s => s.family)` 当前在 `home/index.tsx` 等处仅读 `family.id/name`；升级后向后兼容（FamilyDetail extends Family）
- 新增 `members/babies` 字段在原读取路径不会破坏
- **breaking**：原本 `useFamilyStore` 的 `family` 类型从 `Family | null` 变为 `FamilyDetail | null`，组件中如果有 `family as Family` 强转需要改为 `family.members ?? []` 这类容错读取

**store 实现细节**：

```typescript
loadFamily: async () => {
  set({ loading: true, error: null });
  try {
    const family = await familyService.getCurrent();  // 后端返回 FamilyDetail
    set({ family, loading: false });
  } catch (err: any) {
    set({ family: null, loading: false, error: err?.message ?? '加载失败' });
  }
},

leaveFamily: async () => {
  const family = get().family;
  if (!family) return { status: 'family_not_found', message: '当前未加入家庭' };
  const result = await familyService.leaveFamily(family.id);
  if (result.status === 'ok' || result.status === 'dissolved') {
    set({ family: null });  // 清空本地家庭态
  }
  return result;
},

updateMemberRole: async (userId, role) => {
  const family = get().family;
  if (!family) throw new Error('当前未加入家庭');
  await familyService.updateMemberRole(family.id, userId, role);
  // 局部更新而非 reload（响应更快）
  set({
    family: {
      ...family,
      members: family.members.map(m => m.userId === userId ? { ...m, role } : m),
    },
  });
},
```

### 4.3 family/index.tsx 改造

**结构对齐** S3 §4.1 + S9 §10.9：

```tsx
<FamilyHeader family />              {/* 卡片：家庭名 + 创建日期 + 成员数 */}
<MembersSection
  members
  currentUserId
  isCurrentUserAdmin
  onEditRole={openRoleDialog}
  onRemove={confirmRemove}
  onTransferAdmin={openTransferDialog}
/>
<InviteSection
  inviteCode
  expiry
  onCopy onShare onRefresh
/>
<DangerZone>
  <Button variant="ghost" onClick={confirmLeave}>退出家庭</Button>
  {isCurrentUserAdmin && <Button variant="destructive" onClick={confirmDissolve}>解散家庭</Button>}
</DangerZone>
```

**RoleEditDialog**：复用 shadcn/ui `<Dialog>` + RadioGroup（admin/editor/viewer 三选一），底部 "确认 / 取消"；提交校验「最后一个 admin 不能降级」（沿用后端 `INVALID_ROLE` / `SOLE_ADMIN` 错误码）。

**LeaveResult 处理**（沿用 v4.3.1 状态机）：

```tsx
const handleLeave = async () => {
  const result = await leaveFamily();
  switch (result.status) {
    case 'ok':
    case 'dissolved': navigate('/auth/login'); break;
    case 'need_transfer': openTransferDialog({ candidates: result.otherMembers }); break;
    case 'family_not_found':
    case 'not_member': toast('家庭已不存在'); navigate('/'); break;
  }
};
```

---

## 5. FR-D：记录页对齐

### 5.1 page-header（承接 S6）

**目标**：把记录页的简易标题改为「图标 + 标题 + 今日速览副标题 + 管理按钮」。

**前端实现**：

```tsx
// client/src/components/page-header.tsx（新建，可复用）
export function PageHeader({ icon, title, subtitle, action }: Props) {
  return (
    <header className="flex items-center gap-3 px-6 py-6">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
```

**RecordPage 副标题逻辑**（纯前端计算，不发额外请求）：

```tsx
const todayRecords = useMemo(() => records.filter(r => isSameDay(parseISO(r.startTime), new Date())), [records]);
const subtitle = buildTodaySummaryText(todayRecords);  // 复刻 S6 §3.2 算法
```

**buildTodaySummaryText 输出格式**（对齐 requirements §2.4 FR-D1.AC2）：

- 主结构：`今日 {总数} 条 · {分项序列}`
- 分项顺序固定：feeding → sleep → diaper → temperature
- 仅渲染 `count > 0`（temperature 改为 `latestValue !== null`）的分项
- 分项之间用 **2 个全角空格**分隔；总数与分项之间用 **半角空格 + · + 半角空格** 分隔
- 例：`今日 5 条 · 喂养 3　　睡眠 4h20m　　排便 2`

边界处理：
- 日期筛选范围不含今日 → 静态文案「宝宝的日常养护记录」
- `todayRecords.length === 0` → 「尚未添加今日记录」
- 否则 → `今日 N 条 · 喂养 X  睡眠 Y  ...`

### 5.2 筛选栏吸顶（承接 S9 §4.1）

```tsx
<div className="sticky top-14 z-10 bg-background border-b">  {/* top-14 = 主导航高度 */}
  <FilterTabs ... />
</div>
```

记录列表使用 react-window / @tanstack/virtual 做虚拟化（承接 REFACTORING_PLAN §8.2）—— 可选，超过 100 条记录时启用。

### 5.3 日期分组头（承接 S9 §4.2）

`Timeline` 组件按 `format(startTime, 'yyyy-MM-dd')` 分组，每组前显示渐变分隔线 + 居中日期文案：

```tsx
{groups.map(g => (
  <Fragment key={g.date}>
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border" />
      <span className="text-xs text-muted-foreground">{formatGroupDate(g.date)}</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-border" />
    </div>
    {g.records.map(r => <TimelineItem key={r.id} record={r} />)}
  </Fragment>
))}
```

---

## 6. FR-E：可观测性

### 6.1 OperationLogger 中间件

**Schema 已就绪**（`OperationLog` 表）。新建 `server/src/utils/operation-logger.ts`：

```typescript
// server/src/utils/operation-logger.ts（新建）
export class OperationLogger {
  private id?: string;
  private startedAt = new Date();
  private steps: { step: string; status: string; data?: any; ts: number }[] = [];
  
  constructor(public action: string, public userId?: string, public context?: any) {}
  
  async start() {
    const log = await prisma.operationLog.create({
      data: {
        action: this.action,
        userId: this.userId,
        status: 'started',
        startedAt: this.startedAt,
        context: this.context ? JSON.stringify(this.context) : null,
      },
    });
    this.id = log.id;
    return this;
  }
  
  step(name: string, status: 'ok' | 'skip' | 'fail', data?: any) {
    this.steps.push({ step: name, status, data, ts: Date.now() });
  }
  
  async succeed(result?: any) {
    if (!this.id) return;
    await prisma.operationLog.update({
      where: { id: this.id },
      data: { status: 'succeeded', finishedAt: new Date(), steps: JSON.stringify(this.steps), result: result ? JSON.stringify(result) : null },
    });
  }
  
  async fail(reason: string, error?: any) {
    if (!this.id) return;
    await prisma.operationLog.update({
      where: { id: this.id },
      data: { status: 'failed', finishedAt: new Date(), steps: JSON.stringify(this.steps), reason, error: error ? JSON.stringify({ message: error.message, stack: error.stack }) : null },
    });
  }
  
  async partial(reason: string, result?: any) {
    if (!this.id) return;
    await prisma.operationLog.update({
      where: { id: this.id },
      data: { status: 'partial', finishedAt: new Date(), steps: JSON.stringify(this.steps), reason, result: result ? JSON.stringify(result) : null },
    });
  }
}
```

**接入点**（写操作）：

| Service 方法 | OperationLogger.action |
|-------------|----------------------|
| `family.createFamily` | `createFamily` |
| `family.joinByInviteCode` | `joinFamily` |
| `family.leaveFamily` | `leaveFamily` |
| `family.dissolveFamily` | `dissolveFamily` |
| `family.transferAdmin` | `transferAdmin` |
| `family.updateMemberRole` | `updateMemberRole` |
| `family.removeMember` | `removeMember` |
| `family.refreshInviteCode` | `refreshInviteCode` |
| `baby.deleteBaby` | `deleteBaby`（含 cursor 续传） |

#### 6.1.1 deleteBaby cursor 续传与云端恢复（对齐 requirements FR-E5）

**后端 service 实现要点**（`baby.service.ts#deleteBaby`）：

```typescript
async deleteBaby(userId: string, babyId: string, cursor?: string): Promise<DeleteBabyResult> {
  // 复用或新建 OperationLog（同 babyId 已存在 status='started' 时复用）
  const existing = await prisma.operationLog.findFirst({
    where: { action: 'deleteBaby', status: 'started', context: { contains: `"babyId":"${babyId}"` } },
    orderBy: { startedAt: 'desc' },
  });
  const logger = existing
    ? OperationLogger.resume(existing.id)  // 复用已有 logger
    : await new OperationLogger('deleteBaby', userId, { babyId }).start();

  // ...校验权限 + 计算 total（首次）
  const total = existing?.context?.total ?? await prisma.record.count({ where: { babyId } });

  // 单批最多 500 条 + 10s 限时
  const startTs = Date.now();
  let deleted = existing?.steps?.reduce((s, step) => s + (step.data?.deleted ?? 0), 0) ?? 0;
  let nextCursor = cursor;
  let chunkIdx = existing?.steps?.length ?? 0;

  while (Date.now() - startTs < 10_000) {
    const batch = await prisma.record.findMany({
      where: { babyId, ...(nextCursor && { id: { gt: nextCursor } }) },
      orderBy: { id: 'asc' }, take: 500,
    });
    if (batch.length === 0) break;

    await prisma.record.deleteMany({ where: { id: { in: batch.map(r => r.id) } } });
    deleted += batch.length;
    nextCursor = batch[batch.length - 1].id;

    // 每批写 step 持久化 cursor（关键：跨设备恢复点）
    logger.step(`chunk_${chunkIdx++}`, 'ok', { cursor: nextCursor, deleted: batch.length, total });
  }

  if (deleted < total) {
    // 未完成 → 持久化 partial 状态但保持 status='started'，便于下次续传
    await logger.flushSteps();  // 仅刷新 steps，不关闭 log
    return { status: 'in_progress', cursor: nextCursor!, deleted, total };
  }

  // 全部完成
  await prisma.baby.delete({ where: { id: babyId } });
  await logger.succeed({ totalDeleted: deleted });
  return { status: 'succeeded', cursor: null, deleted, total };
}
```

**前端续传逻辑**（`client/src/services/baby.ts`）：

```typescript
export async function deleteBabyWithProgress(
  babyId: string,
  onProgress?: (deleted: number, total: number) => void
): Promise<void> {
  let cursor: string | undefined;
  let loops = 0;
  while (loops++ < 20) {
    const { data } = await api.delete(`/babies/${babyId}`, { params: { cursor } });
    onProgress?.(data.deleted, data.total);
    if (data.status === 'succeeded') return;
    cursor = data.cursor;
  }
  throw new Error('删除任务超时，请稍后重试');
}
```

**关键约定**：客户端**不**主动持久化 cursor 到 localStorage——下次进入页面时，从云端 OperationLog 自动恢复（避免多设备 cursor 漂移）。`OperationLogger.resume(id)` 是 §6.1 工具类需新增的方法，将历史 steps 还原到内存中。

### 6.2 RateLimit 持久化

**当前**：`server/src/middleware/rate-limit.ts` 使用 `express-rate-limit`（内存）。

**改造**：`auth/family/ai/export` 这 4 类高敏感操作改用 `rate-limiter-flexible` + Prisma RateLimit 表，确保多实例部署有效。

```typescript
// server/src/middleware/rate-limit-persistent.ts（新建）
import { RateLimiterPrisma } from 'rate-limiter-flexible';

export const persistentLimiter = (key: string, points: number, duration: number) =>
  new RateLimiterPrisma({
    storeClient: prisma,
    tableName: 'RateLimit',
    keyPrefix: key,
    points,
    duration,
  });

export const inviteJoinLimiter = persistentLimiter('invite_join', 5, 60);  // 5 次/分钟

export async function inviteJoinRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    await inviteJoinLimiter.consume(req.userId!);
    next();
  } catch (rejRes) {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试', retryAfter: rejRes.msBeforeNext } });
  }
}
```

### 6.3 patrol 巡检任务

**目标**：定时检查 `users.familyId` 与 `family_members` 的一致性（承接 v4.3 patrolMemberOpenids 思想）。

**多实例并发问题**：本期 Web 版按 `REFACTORING_PLAN` 设计是 Lighthouse 单机部署，**当前阶段不存在多实例**，因此使用 `node-cron` 即可。但为应对未来横向扩展，需要**幂等 + 分布式锁**双重保障，否则两个实例同时扫描会重复修复或日志双写。

**方案**：使用 Prisma 一行 SQL 实现的「乐观锁式领导选举」：

```typescript
// server/src/utils/patrol-lock.ts（新建）
const LOCK_TTL_MS = 10 * 60 * 1000;  // 10 分钟，超过自动释放

/**
 * 申请 patrol 锁，成功返回 true。
 * 实现思路：唯一 key 'patrol:familyConsistency' 在 RateLimit 表中复用
 *  - 若 expireAt < now → 用 update + 乐观条件抢锁
 *  - 若锁已被其他实例持有 → 返回 false
 */
export async function acquirePatrolLock(name: string): Promise<boolean> {
  const key = `patrol:${name}`;
  const now = new Date();
  const newExpire = new Date(now.getTime() + LOCK_TTL_MS);

  // 尝试 upsert：如果 key 不存在 → 创建（成功）；如果存在但过期 → 抢占
  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing) {
      await prisma.rateLimit.create({
        data: { key, count: 1, windowStart: now, expireAt: newExpire },
      });
      return true;
    }
    if (existing.expireAt > now) {
      // 锁未过期，被其他实例持有
      return false;
    }
    // 过期锁：用乐观条件 update（updatedAt 校验）
    const result = await prisma.rateLimit.updateMany({
      where: { key, expireAt: { lt: now } },
      data: { count: existing.count + 1, windowStart: now, expireAt: newExpire },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

export async function releasePatrolLock(name: string) {
  await prisma.rateLimit.update({
    where: { key: `patrol:${name}` },
    data: { expireAt: new Date(0) },
  }).catch(() => {});
}
```

**改造后的 cron 调度**：

```typescript
// server/src/utils/patrol.ts
import cron from 'node-cron';
import { prisma } from '../config/database';
import { OperationLogger } from './operation-logger';
import { acquirePatrolLock, releasePatrolLock } from './patrol-lock';

const PATROL_NAME = 'familyConsistency';

cron.schedule('0 0 * * *', async () => {  // 每天 0 点
  const acquired = await acquirePatrolLock(PATROL_NAME);
  if (!acquired) {
    console.log('[patrol] 锁未获取，其他实例正在执行，跳过');
    return;
  }
  
  const logger = new OperationLogger('patrolFamilyConsistency');
  await logger.start();
  let stats = { scanned: 0, drift: 0, autoRepaired: 0, warnings: 0 };
  const dryRun = process.env.PATROL_DRY_RUN !== 'false';
  
  try {
    const users = await prisma.user.findMany({ where: { familyId: { not: null } } });
    for (const user of users) {
      stats.scanned++;
      const member = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: user.familyId!, userId: user.id } },
      });
      if (!member) {
        stats.drift++;
        const family = await prisma.family.findUnique({ where: { id: user.familyId! } });
        if (!family) {
          // 规则 B：family 已不存在 → 清 user.familyId（无副作用，安全自动修）
          if (!dryRun) {
            await prisma.user.update({ where: { id: user.id }, data: { familyId: null } });
          }
          stats.autoRepaired++;
          logger.step('repair_dangling_familyId', dryRun ? 'skip' : 'ok', { userId: user.id, familyId: user.familyId });
        } else {
          // 规则 C：family 存在但 user 不在 members 中 → 仅告警
          stats.warnings++;
          logger.step('user_not_in_members', 'skip', { userId: user.id, familyId: user.familyId });
        }
      }
    }
    await logger.succeed(stats);
  } catch (err: any) {
    await logger.fail(err.message ?? 'patrol failed', err);
  } finally {
    await releasePatrolLock(PATROL_NAME);
  }
});
```

**幂等保障**：即使锁机制故障导致两个实例同时进入循环，规则 B 的 `update familyId=null` 是幂等的（多次执行结果一致），仅日志可能重复——OperationLog 通过 `(action, startedAt)` 二元检索去重即可。

**启动入口**：在 `server/src/app.ts` 末尾 `import './utils/patrol';`，注意 `patrol.ts` 文件加载即注册 cron——为避免 Jest 测试环境误触发，包一层 env 检查：

```typescript
// patrol.ts 顶部
if (process.env.NODE_ENV !== 'test' && process.env.PATROL_ENABLED !== 'false') {
  cron.schedule(/* ... */);
}
```

---

## 7. FR-F：AI 接入 + 配额

### 7.1 混元 API 直调

**承接** REFACTORING_PLAN §11。`server/src/services/ai.service.ts`（新建，目前 ai.ts 只是 placeholder）：

```typescript
import { Common, hunyuan } from 'tencentcloud-sdk-nodejs';
const HunyuanClient = hunyuan.v20230901.Client;

class AIService {
  private client: InstanceType<typeof HunyuanClient>;
  
  constructor() {
    if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
      throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置');
    }
    this.client = new HunyuanClient({
      credential: { secretId: process.env.TENCENT_SECRET_ID, secretKey: process.env.TENCENT_SECRET_KEY },
      region: 'ap-guangzhou',
    });
  }
  
  async chat(userId: string, messages: ChatMessage[], babyId?: string) {
    await this.consumeQuota(userId);
    const baby = babyId ? await this.getBabyContext(userId, babyId) : null;
    const systemPrompt = baby ? buildSystemPrompt(baby) : '你是一位专业育儿顾问';
    const response = await this.client.ChatCompletions({
      Model: 'hunyuan-2.0-instruct-20251111',
      Messages: [{ Role: 'system', Content: systemPrompt }, ...messages.map(m => ({ Role: m.role, Content: m.content }))],
      Temperature: 0.7,
    });
    return { content: response.Choices[0].Message.Content };
  }
  
  async dailyInsight(userId: string, babyId: string) {
    const cacheKey = `daily_insight:${babyId}:${formatDate(new Date())}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;
    
    const baby = await this.getBabyContext(userId, babyId);
    const stats = await recordService.getTodayStats(userId, babyId);
    const prompt = buildInsightPrompt(baby, stats);
    
    try {
      await this.consumeQuota(userId);
      const result = await this.client.ChatCompletions({ /* 8s 超时 */ });
      const insight = parseInsight(result.Choices[0].Message.Content);  // → { summary, suggestions[], alerts[] }
      await this.setCache(cacheKey, insight, 24 * 3600);
      return insight;
    } catch (e) {
      // 降级：本地规则引擎
      return buildFallbackInsight(stats);
    }
  }
}
```

### 7.2 配额管理

**新增表**：`server/prisma/schema.prisma` 追加 `model AIQuota`：

```prisma
model AIQuota {
  id        String   @id @default(cuid())
  userId    String
  date      String   // YYYY-MM-DD
  count     Int      @default(0)
  updatedAt DateTime @updatedAt
  
  @@unique([userId, date])
  @@index([userId, date])
  @@index([date])             // ★ 新增：用于 TTL 清理
}
```

**`@@unique([userId, date])` 的意义**：每个用户每天最多一行，所以单日存量 = 当日活跃用户数；不会出现同 user 同 date 多行。

**数据增长治理**：

- AIQuota 每个活跃用户每天写一行；按 1 万 DAU 计 365 天 ≈ 365 万行（`(userId, date)` 复合索引下 ≈ 100MB）。需要清理：
- 每周清理超过 60 天的 quota 记录（保留最近 60 天用于审计）

```typescript
// server/src/utils/patrol.ts 追加
cron.schedule('0 3 * * 0', async () => {  // 每周日凌晨 3 点
  const cutoff = format(addDays(new Date(), -60), 'yyyy-MM-dd');
  const result = await prisma.aIQuota.deleteMany({
    where: { date: { lt: cutoff } },
  });
  console.log(`[patrol] AIQuota 清理: 删除 ${result.count} 条 60 天前记录`);
});
```

**AIService.consumeQuota 实现**：

```typescript
// server/src/services/ai.service.ts 追加
async consumeQuota(userId: string): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const DAILY_LIMIT = parseInt(process.env.AI_DAILY_QUOTA ?? '20', 10);

  // 原子 upsert + 计数（依赖 Prisma 复合 unique）
  const quota = await prisma.aIQuota.upsert({
    where: { userId_date: { userId, date: today } },
    update: { count: { increment: 1 } },
    create: { userId, date: today, count: 1 },
  });

  if (quota.count > DAILY_LIMIT) {
    // 回滚此次自增，避免计数虚高
    await prisma.aIQuota.update({
      where: { userId_date: { userId, date: today } },
      data: { count: { decrement: 1 } },
    });
    throw new ForbiddenError('今日 AI 配额已用尽，请明天再试', ErrorCodes.QUOTA_EXCEEDED);
  }
}

async getQuotaStatus(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const DAILY_LIMIT = parseInt(process.env.AI_DAILY_QUOTA ?? '20', 10);
  const quota = await prisma.aIQuota.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  const used = quota?.count ?? 0;
  return {
    dailyLimit: DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    resetAt: endOfDay(new Date()).toISOString(),
  };
}
```

**SSE 流式响应配额扣减**：流式响应在第一个 chunk 到达前扣配额（即 `consumeQuota` 在 `ChatCompletions` 调用前），失败回滚。如果中途连接断开，配额不返还（成本已发生）。

**幂等性边界**：用户网络不稳定连续点击「发送」会导致连续扣配额——前端在 `ai.service.ts` 加 1.5s 节流（与小程序 `debounce.js` 一致）。

**降级时**（混元 8s 超时 → 走规则引擎）：**不扣配额**，因为没有发生外部 API 成本。逻辑：

```typescript
async dailyInsight(userId: string, babyId: string) {
  const cacheKey = `daily_insight:${babyId}:${formatDate(new Date())}`;
  const cached = await this.getCache(cacheKey);
  if (cached) return cached;
  
  const baby = await this.getBabyContext(userId, babyId);
  const stats = await recordService.getTodayStats(userId, babyId);
  
  try {
    await this.consumeQuota(userId);             // 先扣配额
    const result = await Promise.race([
      this.client.ChatCompletions(/* ... */),
      timeout(8000),
    ]);
    const insight = parseInsight(result);
    await this.setCache(cacheKey, insight, 24 * 3600);
    return insight;
  } catch (e) {
    // 配额耗尽 → 不降级，直接抛出（让前端引导用户明天再试）
    if (e.code === ErrorCodes.QUOTA_EXCEEDED) throw e;
    // 网络/超时/混元 5xx → 静默降级 + 配额回滚
    await this.refundQuota(userId);
    return buildFallbackInsight(stats);          // 不缓存（保证下次重试）
  }
}

private async refundQuota(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  await prisma.aIQuota.update({
    where: { userId_date: { userId, date: today } },
    data: { count: { decrement: 1 } },
  }).catch(() => {});
}
```

### 7.3 前端 AI 助手页

**改造点**：
1. 替换占位符：从 `ai-service` 导入真实 chat API
2. 顶部显示配额条 `<QuotaBar used={used} limit={20} />`
3. 流式响应：使用 SSE（后端 `/api/ai/chat/stream` 返回 `text/event-stream`），前端 `EventSource`
4. 失败降级：toast「AI 服务暂不可用，请稍后重试」+ 切换到「快速模式」（本地规则）

---

## 8. FR-G：暖夜模式 + 彩蛋 + 分享图

### 8.1 暖夜模式（承接 S19）

**已就绪**：`theme-store.ts` + `use-theme.ts`。

**未就绪**：
- ❌ CSS 变量完整覆盖（仅基础 light/dark）
- ❌ 三态 UI（light / warm-night / system）
- ❌ Settings 页主题选择器

**改造**：

```css
/* client/src/styles/themes.css（新建） */
:root {
  --bg-primary: #F5F1EB;     /* 美拉德暖米 */
  --bg-secondary: #FFFFFF;
  --primary: #D4B896;
  --feeding: #A8D4A8;
  --sleep: #B8A8D4;
  --diaper: #D4C8A8;
  --temperature: #D4A8A8;
  --growth: #7BA9C9;
  /* ... 完整列表见 REFACTORING_PLAN §6.1 */
}

[data-theme="warm-night"] {
  --bg-primary: #1E1A16;
  --bg-secondary: #2A2420;
  --primary: #D4B896;
  --feeding: #7CAF7C;     /* 降饱和 */
  --sleep: #9488B4;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] { /* warm-night 变量同上 */ }
}
```

`use-theme.ts` 切换时设置 `document.documentElement.dataset.theme`，并写入 `localStorage`。

Settings 页面新增 ThemeSelector：

```tsx
<RadioGroup value={mode} onChange={setMode}>
  <Radio value="light"><Sun /> 亮色</Radio>
  <Radio value="warm-night"><Moon /> 暖夜</Radio>
  <Radio value="system"><Settings /> 跟随系统</Radio>
</RadioGroup>
```

### 8.2 彩蛋系统（承接 S18）

**承接** 8 类彩蛋：满月 / 百日 / 周岁 / 首次记录 / 月龄 / 连续记录 / 节日 / 数据洞察。

**实现路径**：
1. `client/src/lib/easter-egg.ts`（纯函数引擎，复刻小程序 `utils/easter-egg.js`）
2. `client/src/components/easter-egg-popup.tsx` + `easter-egg-toast.tsx`（基于 shadcn/ui Dialog/Toast）
3. `client/src/components/easter-egg-banner.tsx`（首页顶部）
4. HomePage `useEffect` 触发 500ms 延迟检测：

```tsx
useEffect(() => {
  if (!currentBaby || !stats) return;
  const t = setTimeout(() => {
    const result = detectAll({ babyId: currentBaby.id, babyName: currentBaby.name, birthDayCount, todayStats: stats });
    setEasterEggState(result);
  }, 500);
  return () => clearTimeout(t);
}, [currentBaby, stats]);
```

去重 key 存 `localStorage`（与小程序键名一致，便于未来导入历史用户彩蛋记录）。

### 8.3 分享报告（承接 S7/S8）

**Web 版差异**：
- 无 Canvas 2D `wx.canvasToTempFilePath`，改用 `<canvas>` + `canvas.toBlob()`
- 无 `wx.saveImageToPhotosAlbum`，改用 `<a download>` 触发下载
- 无 `wx.shareAppMessage`，改用 `navigator.share()`（支持时）/ 复制链接降级

**实现**：
1. `client/src/lib/share-canvas.ts`（迁移自小程序 `share-canvas.js`，去掉 wx.* API）
2. 报告页 `<canvas ref={canvasRef} className="hidden" />` 离屏绘制
3. 「保存」按钮：
   ```tsx
   const blob = await new Promise<Blob>(resolve => canvasRef.current!.toBlob(b => resolve(b!), 'image/jpeg', 0.85));
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url; a.download = `${babyName}_报告_${date}.jpg`; a.click();
   URL.revokeObjectURL(url);
   ```
4. 「分享」按钮：
   ```tsx
   if (navigator.share && navigator.canShare?.({ files: [file] })) {
     await navigator.share({ files: [file], title, text });
   } else {
     copyToClipboard(`${title} - ${shareUrl}`);
     toast('已复制分享链接');
   }
   ```

V2 的 10 模块成绩单暂时保留为「Phase 2」内容，本批先实现 V1 核心 4 卡片版本。

---

## 9. 文件变更清单

### 9.1 后端（server/）

| 文件路径 | 改动类型 | FR | 说明 |
|---------|---------|----|------|
| `src/services/record.service.ts` | 中改 | FR-A | getTodayStats 双区间扫描（跨午夜睡眠）+ 补 `*TimeTs` 字段 + sleep 进行中并发校验 |
| `src/services/trend.service.ts` | 中改 | FR-B | 新增 getEnhancedWeeklyTrend + REFERENCE_RANGES 常量 |
| `src/services/ai.service.ts` | **新建** | FR-F | 混元 API 直调 + 配额管理（含回滚）+ 缓存 + 降级 |
| `src/routes/ai.ts` | 大改 | FR-F | 替换占位符，对接 ai.service + SSE 流式响应 |
| `src/routes/babies.ts` | 小改 | FR-B | 新增 GET /:id/trend/weekly |
| `src/schemas/record.schema.ts` | 小改 | FR-A | getRecordsQuerySchema 增加 `endTimeIsNull` 字段 |
| `src/utils/operation-logger.ts` | **新建** | FR-E | 操作日志工具类 |
| `src/utils/patrol.ts` | **新建** | FR-E/F | node-cron + 一致性巡检 + AIQuota TTL 清理 |
| `src/utils/patrol-lock.ts` | **新建** | FR-E | 基于 RateLimit 表的分布式锁 |
| `src/middleware/rate-limit-persistent.ts` | **新建** | FR-E | rate-limiter-flexible + Prisma store |
| `src/services/family.service.ts` | 小改 | FR-E | 关键写操作接入 OperationLogger |
| `src/services/baby.service.ts` | 小改 | FR-E | deleteBaby 接入 OperationLogger |
| `src/types/errors.ts` | 小改 | FR-A/F | 新增 `SLEEP_ALREADY_ACTIVE` / `QUOTA_EXCEEDED` 错误码 |
| `prisma/schema.prisma` | 小改 | FR-F | 新增 AIQuota 模型（含 `@@index([date])`） |
| `src/app.ts` | 小改 | FR-E | 末尾 import './utils/patrol' |

### 9.2 前端（client/）

| 文件路径 | 改动类型 | FR | 说明 |
|---------|---------|----|------|
| `src/components/ui/skeleton.tsx` | **新建** | FR-A | shadcn/ui Skeleton |
| `src/components/ui/toast.tsx` | **新建** | 通用 | shadcn/ui Toast（多处用） |
| `src/components/baby-switcher.tsx` | **新建** | FR-A | 多宝头像组 |
| `src/components/status-capsule.tsx` | **新建** | FR-A | 状态胶囊 |
| `src/components/today-summary.tsx` | **新建** | FR-A | 4 列进度条摘要 |
| `src/components/insight-section.tsx` | **新建** | FR-B | 趋势 4 卡片 |
| `src/components/page-header.tsx` | **新建** | FR-D | 页头组件（含图标 + 副标题 + action） |
| `src/components/easter-egg-popup.tsx` | **新建** | FR-G | 彩蛋弹窗 |
| `src/components/easter-egg-toast.tsx` | **新建** | FR-G | 彩蛋 Toast |
| `src/components/easter-egg-banner.tsx` | **新建** | FR-G | 月龄/节日提示条 |
| `src/components/quota-bar.tsx` | **新建** | FR-F | AI 配额条 |
| `src/components/family/role-edit-dialog.tsx` | **新建** | FR-C | 角色编辑弹窗 |
| `src/components/family/transfer-admin-dialog.tsx` | **新建** | FR-C | 转让管理员弹窗 |
| `src/components/family/invite-section.tsx` | **新建** | FR-C | 邀请码区 |
| `src/components/family/members-section.tsx` | **新建** | FR-C | 成员列表 + 操作 |
| `src/hooks/use-active-sleep.ts` | **新建** | FR-A | 进行中睡眠 React Query 包装（cloud-first） |
| `src/hooks/use-local-storage-state.ts` | **新建** | FR-A | localStorage state hook（用于 AI 折叠态等纯 UI 偏好） |
| `src/lib/permission-guard.ts` | **新建** | FR-C | 写操作前置权限校验（PermissionError 抛错） |
| `src/lib/api-error.ts` | **新建** | FR-C | axios 拦截器：将后端 403 映射为 PermissionError，统一处理路径 |
| `src/hooks/use-weekly-trend.ts` | **新建** | FR-B | React Query 包装 |
| `src/lib/easter-egg.ts` | **新建** | FR-G | 彩蛋检测引擎 |
| `src/lib/insight-fallback.ts` | **新建** | FR-A/F | 降级规则引擎 |
| `src/lib/share-canvas.ts` | **新建** | FR-G | Canvas 绘图（V1） |
| `src/lib/today-summary.ts` | **新建** | FR-D | 今日速览文案构建 |
| `src/services/ai.ts` | 小改 | FR-F | 对接 chat/dailyInsight/quota，支持 SSE |
| `src/services/family.ts` | 中改 | FR-C | 补 8 个方法 |
| `src/stores/family-store.ts` | 中改 | FR-C | 补 store 方法 |
| `src/pages/home/index.tsx` | 大改 | FR-A/G | 集成 4 个新组件 + 彩蛋 |
| `src/pages/record/index.tsx` | 中改 | FR-D | 接入 PageHeader + 副标题 + 吸顶 |
| `src/pages/family/index.tsx` | 大改 | FR-C | 接入家庭协作 UI |
| `src/pages/settings/index.tsx` | 中改 | FR-G | 主题选择器 |
| `src/pages/ai-assistant/index.tsx` | 中改 | FR-F | 配额条 + SSE |
| `src/styles/themes.css` | **新建** | FR-G | 完整变量集 |
| `src/components/timeline.tsx` | 中改 | FR-D | 日期分组头 + 时间轴线 |

### 9.3 共享类型（shared/）

| 文件路径 | 改动类型 | FR | 说明 |
|---------|---------|----|------|
| `types/index.ts` | 小改 | FR-A/B/C/F | TodayStats / TrendData / LeaveFamilyResult / AIQuota / ChatStreamEvent |

---

## 10. 关键设计决策

### 决策 1：Web 端是否复刻小程序「云函数网关」

- **选项 A（选定）**：直接通过 Express service 层处理，不引入网关概念
- **选项 B**：模拟 familyOperation 的 action 路由
- **理由**：Web 端 JWT 是可信的 userId，Express service 层 + Zod 校验 + 权限工具已足够；引入网关只会增加复杂度

### 决策 2：操作日志是同步还是异步落库

- **选项 A（选定）**：同步落库（关键写操作）
- **选项 B**：写入消息队列异步消费
- **理由**：Web 端单实例 MySQL 部署足够，OperationLog 写入开销 < 5ms；引入 MQ 是过度工程

### 决策 3：AI 服务降级策略

- **选项 A（选定）**：8s 超时 + 本地规则引擎降级
- **选项 B**：直接报错给用户
- **理由**：AI 是非关键路径，降级保证用户始终能看到「今日小结」，UX 优先

### 决策 4：彩蛋去重 key 命名

- **选项 A（选定）**：与小程序保持一致 `egg_${type}_${babyId}`
- **选项 B**：Web 独立命名空间
- **理由**：未来若有数据迁移工具（NoSQL → MySQL），保持 key 一致便于 localStorage 数据导入

### 决策 5：分享图 Canvas 渲染时机

- **选项 A（选定）**：用户点「生成分享图」时按需渲染
- **选项 B**：报告页打开时预渲染
- **理由**：大部分用户不会分享，预渲染浪费 100~300ms；按需渲染配合 Loading 体验已足够

### 决策 6：暖夜模式三态实现

- **选项 A（选定）**：`data-theme` 属性 + CSS 变量
- **选项 B**：Tailwind dark: 前缀
- **理由**：Tailwind dark: 仅支持 light/dark 二态，不支持暖夜独立色板；data-theme 灵活且 CSS 变量在所有组件自动生效

### 决策 7：patrol 巡检是否自动修复

- **选项 A（选定）**：默认 DRY_RUN=true，仅告警；规则 B（family 不存在）开启自动修复
- **选项 B**：完全手动
- **理由**：参考 v4.3.2 的渐进策略；规则 B 是无副作用的清理（user 已不属于任何家庭），可自动修

### 决策 8（v1.1 新增）：跨午夜睡眠的 today 统计语义

- **选项 A（选定）**：扩展 where 为 `OR: [{ startTime in today }, { endTime in today }]`
- **选项 B**：仅按 `startTime` 过滤
- **理由**：用户从昨晚 23:00 开始的小睡到今晨 06:30 结束，自然语言下"今天醒来"是今天的一次睡眠；选项 B 会丢失这条记录的"上次醒来 X 前"语义

### 决策 9（v1.2 新增）：进行中睡眠是否落库

- **选项 A（选定）**：`endTime: null` 的 Record 即"进行中"，跨设备一致
- **选项 B**：纯 localStorage 存 `active_sleep_${babyId}`
- **理由**：Web 用户经常多设备切换（手机 / 平板 / 桌面），localStorage 不可靠；落库会引入"未完成的脏数据"风险，但通过 `unique constraint(babyId, recordType='sleep', endTime=null)` 约束 + 异常态自动过期机制（>24h 提示用户处理），收益 > 风险

### 决策 10（v1.3 新增）：family-store 是否拆分细粒度 store

- **选项 A（选定）**：单一 family-store，持完整 `FamilyDetail`
- **选项 B**：拆分为 family-store + family-members-store
- **理由**：家庭数据量级小（成员通常 <10），整体加载性能足够；细粒度拆分增加维护成本与同步逻辑

### 决策 11（v1.4 新增）：分布式锁实现方式

- **选项 A（选定）**：复用现有 RateLimit 表 + 乐观锁式 update
- **选项 B**：引入 Redis
- **理由**：当前 Lighthouse 单机部署没有 Redis；用 RateLimit 表足够支撑「每天一次的 patrol 任务」并发保护；未来上 Redis 时可平滑替换为 redlock 算法

### 决策 12（v1.5 新增）：AI 配额回滚策略

- **选项 A（选定）**：网络/超时/降级时回滚配额；配额耗尽时不降级（拦截在 consumeQuota 内）
- **选项 B**：所有失败都不回滚（成本对应 API 调用）
- **理由**：选项 B 对用户不公平（混元 5xx 不是用户的错）；选项 A 在"配额已扣但 API 没成功响应"场景下避免无理由的扣费

### 决策 13（迭代 5 新增）：客户端权限闸的双层防护

- **选项 A（选定）**：UI 层 `usePermission` 隐藏按钮 + hook 层 `permissionGuard.require()` 在写动作执行前校验
- **选项 B**：仅 UI 层隐藏按钮，hook 层裸调 service
- **选项 C**：仅 hook 层校验，UI 层不区分角色
- **理由**：选项 A 是纵深防御。UI 层提供视觉反馈、避免用户混淆；hook 层兜住灰度期角色变更、缓存不一致、URL 直跳等绕过场景；二者互补且实现成本低（PermissionGuard 是纯函数封装，不引入额外状态）。后端 service 层的 `isFamilyMember`/`isAdmin` 是第三层兜底，三层一起构成完整防护链。

---

## 11. 测试策略

### 11.1 单元测试

| 模块 | 测试要点 |
|------|---------|
| `trend.service.getEnhancedWeeklyTrend` | 范围条计算 / 状态判定 / 月龄边界（0/3/6/12/24） |
| `ai.service.dailyInsight` | 缓存命中 / 配额限制 / 降级 |
| `lib/easter-egg.detectAll` | 8 类彩蛋触发条件 / 优先级裁决 / 去重 |
| `lib/today-summary.buildText` | 5 种类型组合 / 空记录 / 单类型 |
| `OperationLogger` | start/step/succeed/fail/partial 状态流转 |

### 11.2 E2E 测试

借鉴 v4.2 e2eSecurityTest 思想，但 Web 端用 Playwright 直接驱动 UI：

| 场景 | 验证点 |
|------|------|
| 注册 → 创建家庭 → 添加宝宝 → 创建记录 | 主链路通畅 |
| 邀请码加入 → 角色变更 → 移除成员 | 家庭协作 UI |
| Admin 转让 → 退出 → 自动解散 | leaveFamily 状态机 |
| 编辑他人记录 → 应被拒绝 | 权限矩阵 |
| AI 配额耗尽 → 降级文案 | 降级路径 |
| 暖夜模式切换 → 整页对比度通过 WCAG | 主题完整性 |

---

## 12. 实施顺序

```
Phase 1: 基础设施（不影响功能）
  ├── shared/types 扩展
  ├── components/ui 补齐（skeleton/toast）
  ├── OperationLogger 工具类
  └── themes.css 变量集

Phase 2: 后端能力（独立可测）
  ├── trend.service 增强
  ├── ai.service 接入
  ├── AIQuota 表 + 配额逻辑
  ├── rate-limit-persistent 中间件
  ├── patrol cron 任务（dry-run）
  └── 关键写操作接入 OperationLogger

Phase 3: 前端 P0 组件（首页 + 趋势 + 家庭）
  ├── BabySwitcher / StatusCapsule / TodaySummary（首页）
  ├── InsightSection（趋势）
  ├── family/* 4 个组件（家庭协作）
  └── HomePage / FamilyPage / RecordPage 集成

Phase 4: P1 增强（AI + 暖夜模式 + 记录页对齐）
  ├── PageHeader 组件 + RecordPage 改造
  ├── AI 助手页 SSE + 配额条
  ├── ThemeSelector + Settings 改造
  └── Timeline 日期分组 + 时间轴线

Phase 5: P2 增值（彩蛋 + 分享图）
  ├── easter-egg 引擎 + 3 个组件
  ├── share-canvas（V1 4 卡片）
  └── HomePage 彩蛋集成

Phase 6: 测试与上线
  ├── 单元测试覆盖（≥ 70% 关键路径）
  ├── Playwright E2E 主链路
  └── patrol 切换为 DRY_RUN=false
```

---

*文档维护：每完成一个 Phase 在 §0.4 表格更新对应 FR 域状态。所有 FR 域代码改动应保持向后兼容；若需 breaking change，在 CHANGELOG 中显式标注 BREAKING 并附迁移步骤。*
