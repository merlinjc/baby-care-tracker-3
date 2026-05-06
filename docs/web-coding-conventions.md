# Web 版编码规范（v5.0.0 alpha 增量）

> 版本：v1.0 | 日期：2026-05-06
>
> 本文档承载 Web 版（client + server + shared）的关键编码约定。
> 小程序版规范请参考根目录 [`coding-conventions.md`](../coding-conventions.md)。

---

## 1. 双时间戳约定（FR-A）

所有 `*Time` 字段必须配套 `*TimeTs`（毫秒数）：

```typescript
// shared/types/index.ts
export interface TodayStats {
  feeding: {
    count: number;
    totalAmount: number;
    lastTime: string | null;       // ISO 字符串
    lastTimeTs: number | null;     // ★ 毫秒时间戳
  };
  // ...
}
```

**前端使用规则**：
- 显示给用户：用 `lastTime`（ISO）
- 计算时间差（"X 时 Y 分前"）：用 `lastTimeTs`，`Date.now() - lastTimeTs`
- **不要**反复 `parseISO(lastTime).getTime()`，浪费 CPU

## 2. 进行中睡眠（FR-A1）

### 2.1 数据约定

`Record.recordType === 'sleep' && Record.endTime === null` ⇒ 进行中。

后端 `createRecord` 必须校验同 baby 不能并发（抛 `SLEEP_ALREADY_ACTIVE`）。

### 2.2 入口策略

| 入口 | 触发 |
|------|------|
| 状态胶囊「结束」按钮 | 当前有进行中睡眠（`useActiveSleep().end`） |
| 状态胶囊「取消计时」按钮 | 进行中睡眠 >24h 异常态（`useActiveSleep().cancel`） |
| HomePage SleepQuickButton | 无进行中睡眠 → `start()`；有 → 打开 `SleepDialog` 补录 |
| `SleepDialog` 标准提交 | 创建一条已完成（含 endTime）的 sleep，**不**影响进行中态 |

### 2.3 跨设备一致

不要把 active sleep 存 localStorage。所有写操作都过云端，`useActiveSleep` 通过 React Query 拉到云端唯一来源。

## 3. PermissionGuard 双层防护（FR-C6）

### 3.1 UI 层：usePermission（视觉）

```tsx
const { hasPermission, isAdmin, canEdit } = usePermission()

{canEdit && <button onClick={...}>添加记录</button>}
{isAdmin && <button onClick={refresh}>刷新邀请码</button>}
```

### 3.2 Hook 层：permissionGuard（拦截）

所有写操作 hook / service 在执行前必须调用：

```typescript
import { permissionGuard } from '@/lib/permission-guard'
import { Permission } from '@/types'

// 创建记录
permissionGuard.require(Permission.RECORD_CREATE)
await recordService.createRecord({...})

// 删除记录（含归属判定）
permissionGuard.requireCanDelete(record)
await recordService.deleteRecord(record.id)
```

失败抛 `PermissionError`（继承自 `ApiError`，code = `PERMISSION_DENIED`）。

### 3.3 Axios 错误映射

所有后端错误经 `mapAxiosError`（在 `services/api.ts` 拦截器中）映射为 `ApiError` 子类：

```typescript
try {
  await recordService.createRecord(...)
} catch (err) {
  const e = err as ApiError
  if (e.code === 'PERMISSION_DENIED') toast.error('您没有此操作的权限')
  else if (e.code === 'SLEEP_ALREADY_ACTIVE') toast.warning(e.message)
  else if (e.code === 'QUOTA_EXCEEDED') toast.warning(e.message)
  else toast.error(e.message ?? '操作失败')
}
```

## 4. OperationLogger 接入清单（FR-E1）

后端关键写操作必须接入 `OperationLogger`：

```typescript
async createFamily(userId: string, data: ...) {
  const logger = await new OperationLogger('createFamily', userId, { name: data.name }).start();
  try {
    // ... 业务操作 ...
    logger.step('create_family_doc', 'ok', { familyId });
    logger.step('add_admin_member', 'ok', { userId });
    await logger.succeed({ familyId });
    return result;
  } catch (err) {
    if (!isExpectedBusinessError(err)) {
      await logger.fail((err as Error).message, err as Error);
    }
    throw err;
  }
}
```

**已接入的 9 个写操作**：
- `family.createFamily / joinByInviteCode / leaveFamily / dissolveFamily / transferAdmin / updateMemberRole / removeMember / refreshInviteCode`
- `baby.deleteBaby`（含 cursor 续传）

## 5. 主题样式约定（FR-G1）

### 5.1 不硬编码颜色

```tsx
// ❌ 不要
<div style={{ color: '#3D3D3D' }} />

// ✅ 应使用 CSS 变量
<div style={{ color: 'var(--text-primary)' }} />
```

### 5.2 三态主题选择器

`useThemeStore.setMode('light' | 'warm-night' | 'system')` 自动设置：
- `document.documentElement.dataset.theme = mode`
- 暖夜或系统暗色时同时挂 `.dark` class（兼容旧组件）

### 5.3 函数色（feeding/sleep/diaper/temperature）

亮色与暖夜分别定义，自动随主题切换：
- 喂养绿：`#A8D4A8`（亮）/ `#7CAF7C`（暗）
- 睡眠紫：`#B8A8D4`（亮）/ `#9488B4`（暗）
- 排便米：`#D4C8A8`（亮）/ `#B4A888`（暗）
- 体温桃：`#D4A8A8`（亮）/ `#B48888`（暗）

## 6. 错误码使用

后端 `ErrorCodes` 常量定义在 `server/src/types/errors.ts`：

```typescript
export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS, EMAIL_ALREADY_EXISTS, ..., UNAUTHORIZED,
  // Family
  FAMILY_NOT_FOUND, USER_NOT_FOUND, INVALID_CODE, CODE_EXPIRED,
  ALREADY_MEMBER, ALREADY_IN_FAMILY, SOLE_ADMIN,
  CANNOT_REMOVE_SELF, CANNOT_REMOVE_ADMIN, NOT_MEMBER, INVALID_ROLE,
  // Records / Babies
  RECORD_NOT_FOUND, BABY_NOT_FOUND, SLEEP_ALREADY_ACTIVE,
  // AI
  QUOTA_EXCEEDED, AI_SERVICE_UNAVAILABLE,
  // General
  PERMISSION_DENIED, INTERNAL_ERROR, RATE_LIMITED, VALIDATION_ERROR, INVALID_PARAMS,
}
```

抛出错误模式：

```typescript
throw new ConflictError('已有进行中的睡眠记录', ErrorCodes.SLEEP_ALREADY_ACTIVE);
throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
```

## 7. React Query 键名约定

```typescript
['todayStats', babyId]
['records', babyId]
['records', babyId, 'today']
['activeSleep', babyId]
['weeklyTrend', babyId]
['family']                    // store 自管，不必走 React Query
['quota']                     // 同上
```

切换 baby 时统一 invalidate：

```typescript
queryClient.invalidateQueries({ queryKey: ['todayStats', newBabyId] })
queryClient.invalidateQueries({ queryKey: ['records', newBabyId] })
queryClient.invalidateQueries({ queryKey: ['activeSleep', newBabyId] })
```

## 8. 路由层规则

后端路由文件归属：

| 端点 | 路由文件 |
|------|----------|
| 家庭操作 | `routes/families.ts` |
| 宝宝档案 + **趋势** | `routes/babies.ts` |
| 记录 CRUD | `routes/records.ts` |
| 疫苗记录 | `routes/vaccines.ts`（**仅 vaccine_records 资源**） |
| AI（含 SSE） | `routes/ai.ts` |
| 数据导出 | `routes/export.ts` |

> 注意：`/api/babies/:id/trend/weekly` 挂在 `babies.ts`，**不要**挂在 `vaccines.ts`（设计修订 C3）。
