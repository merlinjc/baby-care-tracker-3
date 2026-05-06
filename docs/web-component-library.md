# Web 版组件库（v5.0.0 alpha 新增组件）

> 版本：v1.0 | 日期：2026-05-06
>
> 本文档列出 Web 版本期新增的组件、hooks、lib 和 service 方法。
> 小程序版组件库请参考根目录 [`component-library.md`](../component-library.md)。

---

## 1. 新增 UI 通用组件（client/src/components/ui/）

| 组件 | 文件 | 说明 |
|------|------|------|
| `<Skeleton>` | `ui/skeleton.tsx` | 占位骨架（FR-A5） |
| `toast` + `<Toaster>` | `ui/toast.tsx` | 极简 Toast 实现（不依赖 sonner / radix） |

### 1.1 toast 用法

```typescript
import { toast } from '@/components/ui/toast'

toast.success('已添加记录')
toast.error('请求失败', 5000) // 自定义时长
toast.info('操作已取消')
toast.warning('您没有此操作的权限')
```

`<Toaster />` 全局挂载点已在 `app/App.tsx`，无需重复挂。

## 2. 新增业务组件

| 组件 | 文件 | 涉及 FR |
|------|------|--------|
| `<StatusCapsule>` | `status-capsule.tsx` | FR-A1（4 态：none/sleeping/feeding_ago/sleep_abnormal） |
| `<BabySwitcher>` | `baby-switcher.tsx` | FR-A2（多宝头像组） |
| `<TodaySummary>` | `today-summary.tsx` | FR-A3（4 列大数字 + 进度条） |
| `<HomeSkeleton>` | `home-skeleton.tsx` | FR-A5（首页骨架屏） |
| `<InsightSection>` | `insight-section.tsx` | FR-B（趋势 4 卡片） |
| `<RangeBar>` | `range-bar.tsx` | FR-B3（迷你范围条） |
| `<PageHeader>` | `page-header.tsx` | FR-D1（通用页头） |
| `<EasterEggDisplay>` | `easter-egg-display.tsx` | FR-G2（彩蛋三态渲染） |
| `<QuotaBar>` | `quota-bar.tsx` | FR-F3（AI 配额条） |
| `<ThemeSelector>` | `theme-selector.tsx` | FR-G1（三态主题选择器） |

## 3. 家庭协作组件（client/src/components/family/）

| 组件 | 文件 | 说明 |
|------|------|------|
| `<MembersSection>` | `family/members-section.tsx` | 成员列表 + 三点菜单（admin 可见） |
| `<InviteSection>` | `family/invite-section.tsx` | 邀请码 + 倒计时 + 复制/分享/刷新 |
| `<RoleEditDialog>` | `family/role-edit-dialog.tsx` | 修改成员权限（RadioGroup 三选一） |
| `<TransferAdminDialog>` | `family/transfer-admin-dialog.tsx` | 转让管理员（含 leaveFamily 状态机分支） |
| `<RemoveMemberConfirm>` | `family/remove-member-confirm.tsx` | 移除成员（输入「确认移除」字样） |

## 4. 新增 Hooks（client/src/hooks/）

| Hook | 文件 | 用途 |
|------|------|------|
| `useActiveSleep(babyId)` | `use-active-sleep.ts` | 进行中睡眠 React Query 包装；start/end/cancel 三动作均经 PermissionGuard |
| `useWeeklyTrend(babyId)` | `use-weekly-trend.ts` | 本周趋势 React Query 包装（60s staleTime） |
| `useLocalStorageState(key, default)` | `use-local-storage-state.ts` | localStorage 持久化的 React state；跨 tab 同步 |

## 5. 新增 Lib（client/src/lib/）

| 模块 | 文件 | 说明 |
|------|------|------|
| `permissionGuard` / `PermissionError` | `permission-guard.ts` | 写操作前置权限校验 |
| `mapAxiosError` / `ApiError` 子类 | `api-error.ts` | 后端错误映射 |
| `computeCapsuleState` / `buildCapsuleText` | `capsule-state.ts` | 状态胶囊状态机 |
| `computeDailyGoals` / `computeAgeMonths` | `age-goals.ts` | 月龄目标计算 |
| `buildFallbackInsight` | `insight-fallback.ts` | AI 降级规则引擎 |
| `buildTodaySummaryText` | `today-summary.ts` | 记录页副标题构建 |
| `detectAll` / `markEggShown` / `EggResult` | `easter-egg.ts` | 彩蛋检测引擎 |
| `renderShareImage` / `downloadShareImage` / `shareImage` | `share-canvas.ts` | 分享图 V1 |

## 6. 新增 Service 方法

### 6.1 record.ts

```typescript
recordService.getActiveSleep(babyId): Promise<CareRecord | null>
// FR-A1：查询当前 baby 的进行中睡眠（最多 1 条）
// 通过 endTimeIsNull=true 参数传给后端

// 升级：getRecords 接受 ExtendedRecordQueryParams
recordService.getRecords({ ...standardParams, endTimeIsNull?: 'true' | 'false' })
```

### 6.2 ai.ts

```typescript
// FR-F1：同步对话
aiService.chat(messages, babyId?): Promise<{ content: string; usage? }>

// FR-F4：流式对话（返回 Response，由 consumeStream 处理）
aiService.chatStream(messages, babyId?): Promise<Response>

// FR-F4：解析 SSE 事件流
aiService.consumeStream(response, { onChunk, onDone, onError })

// FR-F2：每日洞察
aiService.getDailyInsight(babyId): Promise<{ insight: DailyInsight; date }>

// FR-F3：配额查询
aiService.getQuota(): Promise<AIQuotaStatus>
```

### 6.3 family.ts

```typescript
// FR-C5：返回完整 LeaveFamilyResult 状态机
familyService.leave(familyId): Promise<LeaveFamilyResult>
// status: 'ok' | 'dissolved' | 'need_transfer' | 'family_not_found' | 'not_member'

// FR-C3：返回更新后的 member（用于 store 局部更新）
familyService.updateMemberRole(familyId, userId, role): Promise<FamilyMember>
```

## 7. 后端新增 service 方法

### 7.1 record.service.ts

```typescript
// FR-A1：跨午夜睡眠 + 进行中睡眠并发校验
recordService.createRecord(userId, data)
  // 当 recordType='sleep' && !endTime 时，校验同 babyId 不可并发

// FR-A1：endTimeIsNull 过滤
recordService.getRecords(userId, { ...query, endTimeIsNull?: 'true' | 'false' })

// FR-A：双区间扫描 + 全字段补 lastTimeTs
recordService.getTodayStats(userId, babyId): Promise<TodayStats>
```

### 7.2 trend.service.ts

```typescript
// FR-B：增强本周趋势
trendService.getEnhancedWeeklyTrend(userId, babyId): Promise<WeeklyTrendData>
```

### 7.3 ai.service.ts（新建）

```typescript
aiService.chat(userId, messages, babyId?): Promise<{ content }>
aiService.dailyInsight(userId, babyId): Promise<DailyInsight>
aiService.consumeQuota(userId): Promise<void>     // 抛 QUOTA_EXCEEDED
aiService.refundQuota(userId): Promise<void>      // 失败回滚
aiService.getQuotaStatus(userId): Promise<AIQuotaStatus>
```

### 7.4 baby.service.ts

```typescript
// FR-E5：cursor 续传 + OperationLog 跨设备恢复
babyService.deleteBaby(userId, babyId, familyId, cursor?):
  Promise<{ status: 'in_progress'; cursor; deleted; total }
        | { status: 'succeeded'; deletedBabyId; records; vaccine; milestone }>
```

### 7.5 family.service.ts

8 个写操作签名不变，但全部接入 OperationLogger：
- `createFamily / joinByInviteCode / leaveFamily / dissolveFamily / transferAdmin / updateMemberRole / removeMember / refreshInviteCode`

`leaveFamily` 返回类型升级为 `LeaveFamilyResult`（共享类型）。

## 8. 后端新增工具类

### 8.1 OperationLogger（utils/operation-logger.ts）

```typescript
const logger = await new OperationLogger(action, userId?, context?).start();
logger.step(name, 'ok' | 'skip' | 'fail', data?);
await logger.succeed(result?);
await logger.partial(reason, result?);
await logger.fail(reason, error?);
await logger.flushSteps();   // 中间持久化（cursor 续传）

// cursor 续传支持
const existing = await OperationLogger.findOngoing('deleteBaby', babyId);
const logger = await OperationLogger.resume(logId);
logger.currentSteps   // 只读 getter
logger.reduceStepData(prefix, key, init)  // 累计计数
```

### 8.2 patrol-lock.ts

```typescript
acquirePatrolLock(name): Promise<boolean>
releasePatrolLock(name): Promise<void>
```

### 8.3 patrol.ts

```typescript
runFamilyConsistencyPatrol(): Promise<{ scanned, drift, autoRepaired, warnings }>
runAIQuotaCleanup(): Promise<{ deleted }>
registerPatrolTasks(): void
stopPatrolTasks(): void
```

## 9. 新增中间件

### 9.1 rate-limit-persistent.ts

```typescript
persistentRateLimit({ windowMs, max, scope, keyGenerator })
// 预设：inviteJoinRateLimit / persistentAuthRateLimit / persistentAIRateLimit
```

## 10. 新增数据模型（Prisma）

```prisma
model AIQuota {
  id        String   @id @default(cuid())
  userId    String
  date      String   // YYYY-MM-DD
  count     Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId, date])
  @@index([date])
}
```

OperationLog 与 RateLimit 模型本期未变更，复用既有 schema。

## 11. 新增类型（shared/types/）

```typescript
// FR-A
export interface TodayStats {
  feeding: { ..., lastTimeTs: number | null };  // 全字段加 lastTimeTs
  sleep:   { ..., lastEndTime, lastEndTimeTs };  // 增 endTime 字段
  temperature: { latestValue: number | null, ... };  // BREAKING: lastValue 重命名
}

// FR-C
export type LeaveFamilyStatus = 'ok' | 'dissolved' | 'need_transfer' | 'family_not_found' | 'not_member'
export interface LeaveFamilyResult { status, message, otherMembers? }

// FR-B
export interface WeeklyTrendData { feeding/sleep/diaper/temperature: WeeklyTrendDimension; period; ageMonths }
export interface WeeklyTrendDimension { thisWeekAvg, lastWeekAvg, range, status, tip, changePercent }

// FR-F
export interface AIQuotaStatus { dailyLimit, used, remaining, resetAt }
export type ChatStreamEvent = { type: 'chunk' | 'done' | 'error', ... }
export interface DailyInsight { summary, suggestions, alerts, source?: 'ai' | 'fallback' }
```
