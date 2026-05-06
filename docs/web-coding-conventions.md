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
| 首页 `<TodaySummary>` 睡眠卡片右上角按钮 | 无进行中睡眠 → 显示「开始」（调用 `useActiveSleep().start('nap')`）；有进行中 → 显示「结束」（调用 `useActiveSleep().end`）。viewer 自动禁用，不响应点击。 |
| 点击睡眠卡片本体 | 打开 `SleepDialog` 补录一条已结束的睡眠（与是否有进行中无关） |
| `SleepDialog` 标准提交 | 创建一条**已完成（强制写 endTime）**的 sleep，**不会**影响进行中态。`SleepDialog` 内部会在 submit 时自动计算 `endTime = startTime + duration*1000`，并通过 `RecordDialogMeta.endTime` 传给父组件转发到 `recordService.createRecord/updateRecord`。**禁止**让 `SleepDialog` 创建 `endTime=null` 的记录，否则会被服务端 `endTimeIsNull=true` 误判为进行中睡眠，导致首页状态胶囊错误显示「正在睡觉 · 已 0m」。 |

### 2.3 跨设备一致

不要把 active sleep 存 localStorage。所有写操作都过云端，`useActiveSleep` 通过 React Query 拉到云端唯一来源。

### 2.4 RecordDialogMeta.endTime 约定

`feeding-dialog.tsx` 导出的 `RecordDialogMeta` 结构：

```typescript
export interface RecordDialogMeta {
  recordTime: string       // 必填：用户在 dialog 中选择的开始时间
  editingId?: string       // 可选：编辑模式下的记录 id
  endTime?: string         // 可选：当前仅 SleepDialog 使用，用于把 dialog 录入的睡眠强制保存为「已结束」
}
```

父组件（`pages/home/index.tsx` 与 `pages/record/index.tsx`）的 `createRecord` 必须把 `meta.endTime` 转发到 `recordService.createRecord` / `updateRecord` 的顶级 `endTime` 字段；其余 dialog 不传 endTime 时，行为与原来完全一致。

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

## 6. 家庭/成员管理后端约定（FR-F）

> 适用范围：`server/src/services/family.service.ts` 与配套 utils。

### 6.1 邀请码生成

- 必须使用 `generateUniqueInviteCode()`（`server/src/utils/invite-code.ts`），它内部做"随机 → 查 DB → 命中重生成"，最多 5 次重试。
- **禁止**直接使用 `generateInviteCode()` 后写入 DB；`Family.inviteCode` 是 `@unique`，原始函数会偶发 P2002 报错。
- 字符集：`A-HJ-NP-Z2-9`（去除 I/O/0/1）；HTTP schema 层会自动 `trim().toUpperCase()`。

### 6.2 退出/解散三态机的事务边界

- `leaveFamily` 必须把"删除 membership + 判断是否解散 + 删 family"放进同一个 `prisma.$transaction`，避免事务外二次查询导致的并发竞态（如另一管理员同时把当前用户踢出）。
- 删除 membership 用 `deleteMany`，根据 `count===0` 幂等返回 `not_member` 而不是抛 P2025。
- 解散场景统一调 `cascadeDissolveFamily(tx, familyId)` 私有方法，按 records → vaccine → milestone → babies → members → family 顺序删除（schema 已配 `onDelete: Cascade`，业务层显式删除以兼容存量库 + 留可观测性）。

### 6.3 真乐观锁约定

- `FamilyMember.version Int @default(0)` 是版本字段；任何 role 写操作必须 `where: { id, version: oldVersion }, data: { ..., version: { increment: 1 } }`，并捕获 P2025 后**重读 version 后再次重试**（最多 3 次）。
- **不要**写"假乐观锁"（catch 任何错误都重试），那会吞掉真正的业务错误。

### 6.4 角色降级防护

- 修改 `FamilyMember.role` 时必须额外校验"不能降级最后一个 admin"：当目标当前是 admin 且新 role 不是 admin 时，先 `count where role='admin'`，<=1 直接抛 `SOLE_ADMIN`。
- 同理，`transferAdmin` 必须校验：目标 != 自己；目标当前不是 admin。

### 6.5 自愈式 family 归属查询

- `getFamilyIdForUser(userId)` 会同时校验 `User.familyId` 与 `FamilyMember` 的一致性，发现脏数据（残留 `User.familyId` 但 `FamilyMember` 已删）会自愈：清空 `User.familyId` 并返回 null，避免用户被永久卡死。
- 业务代码统一通过该函数读取"用户的家庭 ID"，**不要**直接 `prisma.user.findUnique` 取 `familyId`。

### 6.6 displayName 字段

- `FamilyMember.displayName String?` 是用户在该家庭中的展示昵称，由 `createFamily` / `joinByInviteCode` 入参 `nickname` 落库。
- 前端展示家庭成员时优先 `displayName`，回退到 `user.nickname`。

## 7. 错误码使用

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

## 8. React Query 键名约定

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

## 9. 路由层规则

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

## 10. 弹窗交互约定（v4.3.x）

### 9.1 禁止使用浏览器原生确认/提示

**硬性规则**：项目中禁止出现 `window.confirm` / `window.alert` / `window.prompt`。
原生弹窗样式与 Maillard 色系、暖夜模式完全不匹配，且无法统一交互。

所有"需要用户二次确认"的场景统一使用 `useConfirm()`：

```tsx
import { useConfirm } from '@/components/ui/confirm-dialog'

function MyPage() {
  const confirm = useConfirm()

  const handleDelete = async () => {
    const ok = await confirm({
      title: '删除这条记录？',
      description: '删除后不可恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
    // ... 执行删除
  }
}
```

危险操作（删除 / 解散 / 清除 / 退出等）使用 `variant: 'danger'`，非危险确认使用默认的 `primary`。

### 9.2 标准 Dialog 结构

所有自建业务弹窗基于 `<Dialog>` + `<DialogFooter>`：

```tsx
<Dialog
  open={open}
  onClose={onClose}
  title="喂养记录"
  icon={<Baby className="h-4 w-4" />}
  accentColor="var(--feeding)"
  footer={
    <DialogFooter
      onCancel={onClose}
      confirmText="保存"
      loading={isSubmitting}
      confirmType="submit"
      confirmFormId="feeding-dialog-form"
    />
  }
>
  <form id="feeding-dialog-form" onSubmit={handleSubmit}>...</form>
</Dialog>
```

**约定**：
- 底部操作统一 `[取消] [主操作]` 双按钮，等宽 `flex-1`。
- 主按钮底色统一 `var(--primary)`；**禁止**按记录类型给主按钮换底色。
- 类型色（feeding/sleep/diaper/temperature/growth）只用于：
  1. Dialog 顶部图标圆圈（`accentColor` prop）
  2. 表单内部 `SegmentedControl` 的 `accentColor` prop
- `form` 与 footer 的"保存"按钮通过 `confirmFormId` 关联，表单 `onSubmit` 负责业务逻辑。

### 9.3 记录 Dialog 的时间与编辑模式

所有记录类 Dialog（`FeedingDialog` / `SleepDialog` / `DiaperDialog` / `TemperatureDialog` / `GrowthDialog`）共享：

1. **时间字段**：内部使用 `<input type="datetime-local">` + `toDateTimeLocalValue` / `fromDateTimeLocalValue`（`@/lib/date`）转换；默认值 = 当前时间。
2. **编辑模式**：通过 `editRecord?: CareRecord` prop 进入；有值时：
   - `useEffect` 里根据 `recordType` 反序列化对应 `*Data` 字段 + `startTime`；
   - 标题自动变为「编辑X记录」；
   - footer 主按钮文案变为「保存修改」。
3. **回调签名**：`onSubmit(data, meta)`，其中 `meta: { recordTime: string; editingId?: string }`；父组件据 `editingId` 分流 `createRecord` / `updateRecord`。

父组件打开 Dialog 时通过 `useDialog<CareRecord>()` 的 `openDialog(record?)` 传入 `editRecord`：

```tsx
const feedingDialog = useDialog<CareRecord>()

// 新建：
feedingDialog.openDialog()
// 编辑：
feedingDialog.openDialog(existingRecord)

// JSX：
<FeedingDialog
  open={feedingDialog.open}
  onClose={feedingDialog.closeDialog}
  editRecord={feedingDialog.payload}
  onSubmit={(data, meta) => createRecord('feeding', { feedingData: data }, meta)}
/>
```

## 11. 页面头部与操作按钮（v4.3.x P1）

### 11.1 PageHeader 唯一入口

所有页面的"标题 + 返回 + 操作"区域统一使用 `<PageHeader>`，禁止手写 `<ChevronLeft>` + `<h1>` 组合。

| 页面类型 | variant | 备注 |
|---------|---------|------|
| Tab 主页（record / discover） | `tab` | 无返回键，可带 48px 渐变图标 |
| 子页（vaccine / milestone / settings / baby / family / growth 等） | `sub`（默认） | 自动渲染返回键，`backTo` 默认 `/profile` |
| 首页（home） | — | 自定义问候语 + BabySwitcher，**不**使用 PageHeader |
| Profile 页 | — | 用户卡本身即头部，**不**使用 PageHeader |
| AI 助手页 | — | 全屏对话特殊布局，保留 sticky 顶栏 |

### 11.2 HeaderAction 唯一入口

页面右上角操作按钮统一使用 `<HeaderAction>`：

| variant | 用途 | 视觉 |
|---------|------|------|
| `primary` | 突出主操作（添加/记录） | 实心 `--primary` 背景，可通过 `accentColor` 自定义 |
| `secondary` | 次要操作 | 描边 + `var(--bg-card)` |
| `ghost` | 低调/可切换状态（筛选 / 标准计划 / 标准推荐） | 默认 chip 样式，`active` 时填充 |

```tsx
<HeaderAction
  variant="primary"
  icon={<Plus className="h-3.5 w-3.5" />}
  label="添加"
  onClick={...}
/>
```

**禁止**直接用 `btn-primary text-xs px-3 py-1.5` 等 ad-hoc 样式拼装页面右上角按钮；统一从 `HeaderAction` 走。

**多类型创建场景**：当一个页面需要在右上角支持「同时新建多种类型」（如记录页支持喂养 / 睡眠 / 排便 / 体温 / 生长 5 类），不要使用单一 `HeaderAction(primary, label='添加')` 然后凭借当前 tab 推断类型；应使用 `<AddRecordMenu onPick={...} />`，下拉展开 5 个独立入口，避免「全部 tab + 添加」这种隐式行为带来的歧义。`AddRecordMenu` 内部样式与 `HeaderAction(primary)` 对齐（高度、字号、主色），保证视觉一致。

### 11.3 Loading 策略

- 首次加载列表型页面 → `<ListSkeleton count={n}/>`
- 首次加载图表型页面（生长曲线等）→ `<ChartSkeleton/>`
- 分页加载、局部刷新 → `<div className="spinner"/>` + 「加载更多...」
- **禁止**使用纯文字「加载中...」作为唯一 loading 提示；spinner 必须搭配文字或上下文明确的容器。

### 11.4 inline message 禁用

页面内"操作成功 / 失败"反馈一律走 `toast.success` / `toast.error`，禁止内联渲染 `<div>{message.text}</div>` 占位行（Settings 页 v4.3.x 已迁移；Login / Register 页 v4.3.2 已迁移）。

### 11.5 公共原子样式类（2026-05-06 收敛新增）

为避免 ad-hoc Tailwind 拼装重复散落，列表行图标按钮、10px 角标、内联提示条必须使用 `globals.css` 中提供的公共类：

| 类名 | 用途 |
|------|------|
| `icon-btn` / `icon-btn--danger` | 列表行内的小图标按钮（编辑 / 删除 / 清除聊天等） |
| `badge-mini` | 10px 圆角徽章（"当前 / 自费 / 2 项逾期 / 喂养·3"等） |
| `notice-info` | 内联提示条（viewer 提示 / 引导 / 离线状态等） |

**禁止**：
- 在页面/组件中再写 `p-1.5 rounded-lg ... hover:bg-[color-mix(...)]` 这种重复的图标按钮拼装。
- 在页面/组件中再写 `text-[10px] px-1.5 py-0.5 rounded-full` 拼接角标。
- 用 `text-[var(--text-xs)]` 这种把 CSS var 错放到 Tailwind 任意值的写法（无效），统一用 `caption` 或 `body-sm` 语义类。

### 11.6 Dialog 与 confirm 的合规性（硬性规则）

所有自建业务弹窗**必须**通过 `<Dialog footer={<DialogFooter ... />}>` 渲染按钮区，**禁止**：
- 在 Dialog 内部手写 `<div className="mt-5 flex gap-2">` + `btn-secondary`/`btn-primary` 组合（已发生于 family/role-edit-dialog / family/transfer-admin-dialog / family/remove-member-confirm，2026-05-06 已统一）。
- 用 `style.backgroundColor: var(--warning)` 给主按钮强行染色作为"危险"提示（应使用 `<DialogFooter variant="danger">` → `var(--danger)`）。
- 类型色（feeding/sleep/diaper/temperature/growth）只允许出现在 Dialog 的 `accentColor`（顶部图标圆）与表单内 `<SegmentedControl accentColor>` 上，禁止染主按钮。

### 11.7 页面 wrapper 间距统一

- Tab 主页（home / record / discover / profile）：`space-y-5`
- 子页（baby / family / vaccine / milestone / growth / settings 等）：`space-y-4`
- 不再出现 `space-y-6`（已于 home / family 引导页废弃）。

## 13. 自动化测试规范（FR-T）

> 适用范围：`server/tests/**`。前端测试沿用现有 Playwright/Vitest 体系，本节仅规约后端单元/集成测试。

### 12.1 工具栈

- **测试运行器**：[Vitest 4](https://vitest.dev)（与 server `tsconfig.json` 共用 paths alias）。
- **DB**：独立的 `prisma/test.db`，`globalSetup` 阶段 `prisma db push --force-reset` 自动建表。
- **隔离粒度**：`pool=forks` + `singleFork=true` + `fileParallelism=false`，串行运行避免共享 DB 写竞争；每个 `it` 前 `beforeEach` truncate 全部业务表。

### 12.2 目录约定

```
server/
  tests/
    global-setup.ts           # 一次性 prisma db push --force-reset
    setup.ts                  # 每个 fork 的 beforeEach 清空表
    helpers/
      factories.ts            # createUser / createFamilyWithMembers / createBaby ...
      api-client.ts           # E2E 专用：fetch 包装的 ApiResponse
      seed.ts                 # E2E 专用：调 prisma/seed-e2e.ts --json
    unit/                     # 单元测试：纯函数、schema、utils
      *.test.ts
    integration/              # 集成测试：service + 真实 SQLite test.db
      *.test.ts
    e2e/                      # E2E 测试：依赖外部 dev server + e2e 种子
      p0-smoke.test.ts
  vitest.config.ts            # 单元/集成（test.db + globalSetup）
  vitest.e2e.config.ts        # E2E（不重置 db / alias 配齐）
```

### 12.3 npm scripts

| 命令 | 用途 |
|---|---|
| `pnpm --filter server test` (= 根 `pnpm test:api`) | 跑 unit + integration（默认 CI 任务，使用 test.db） |
| `pnpm --filter server test:watch` | 本地开发 watch 模式 |
| `pnpm --filter server test:e2e` | 跑 `tests/e2e/**`（需先 `pnpm dev` 起 server + 自动 reset e2e seed） |
| 根 `pnpm test:e2e` | Playwright 浏览器测试（chromium，依赖 dev server） |
| 根 `pnpm test:e2e:seed` / `:bulk` | 手动 reset e2e 种子 / 灌注 5000 条 records |
| `pnpm --filter server test:setup` | 手动重建 test.db（global-setup 已自动做） |

### 12.4 编写规范

- **每个修复必须配测试**：参考 `family.service.ts` 的 P0/P1 修复 → `tests/integration/family-*.test.ts` 一一覆盖。
- **测试命名约定**：`it('A1: 全新用户创建家庭...')`，前缀编号对应 `web-api-spec.md` / 缺陷报告中的场景编号，便于双向追溯。
- **优先用工厂函数**：`createUser()` / `createFamilyWithMembers()` 屏蔽样板代码，返回值结构稳定。
- **断言 → 业务错误码而非 HTTP 状态码**：`expect(...).rejects.toMatchObject({ code: 'SOLE_ADMIN' })`，避免 service 与 route 解耦后断言失效。
- **真实 DB 优于 mock**：除非测纯函数，否则不要 mock prisma；通过 truncate 维持每用例的隔离。
- **断言写库副作用**：删除/角色修改类操作必须额外 `findUnique` 验证 DB 已生效，不要只看 service 返回值。

### 12.5 当前覆盖率（v4.3.2）

| 模块 | 测试文件 | 用例数 |
|---|---|---|
| invite-code utils | `tests/unit/invite-code.test.ts` | 8 |
| family schema | `tests/unit/family-schema.test.ts` | 10 |
| getFamilyIdForUser 自愈 | `tests/unit/permission.test.ts` | 4 |
| createFamily | `tests/integration/family-create.test.ts` | 6 |
| joinByInviteCode | `tests/integration/family-join.test.ts` | 9 |
| leaveFamily（三态机） | `tests/integration/family-leave.test.ts` | 9 |
| dissolveFamily（级联删除） | `tests/integration/family-dissolve.test.ts` | 5 |
| refreshInviteCode | `tests/integration/family-refresh-invite.test.ts` | 4 |
| updateMemberRole（乐观锁） | `tests/integration/family-update-role.test.ts` | 8 |
| removeMember | `tests/integration/family-remove-member.test.ts` | 6 |
| transferAdmin | `tests/integration/family-transfer-admin.test.ts` | 6 |
| **合计（unit + integration）** | **11 文件** | **75 用例** |
| E2E API（v5.0.0+） | `tests/e2e/p0-smoke.test.ts` | 10 |
| E2E API（跨家庭隔离） | `tests/e2e/cross-family-isolation.test.ts` | 33 |
| E2E API（同家庭可见性） | `tests/e2e/same-family-visibility.test.ts` | 23 |
| Playwright 浏览器（P0 冒烟） | `e2e/p0-smoke.spec.ts` | 3 |
| Playwright 浏览器（跨家庭） | `e2e/cross-family-isolation.spec.ts` | 5 |
| **总计** | **15 文件** | **149 用例** |

后续新增 service / 修复 bug 时，必须在对应文件追加场景编号化的 it。

### 12.6 useEffect deps 校验（前端）

> 教训来自 BUG-LAYOUT-BABIES-RELOAD（2026-05-06 修复）

凡是 effect 内**读了某个状态值**用于条件分支或依赖外部输入（store/props），**必须**把它列入 deps：

```tsx
// ❌ 错误：useEffect 读了 family?.id 但没在 deps 里
useEffect(() => {
  if (isAuthenticated) {
    loadFamily();
    if (family?.id) {     // ← 读了 family?.id
      loadBabies(family.id);
    }
  }
}, [isAuthenticated, loadFamily, loadBabies]); // ← 缺 family?.id
// 后果：family 异步加载完成后，effect 不重跑，babies 永远空

// ✅ 正确
}, [isAuthenticated, family?.id, loadFamily, loadBabies]);
```

工程实践：
- 启用 `eslint-plugin-react-hooks` 的 `react-hooks/exhaustive-deps` 规则（项目已用 `eslint-plugin-react-hooks`，但需检查 lint 配置是否启用 exhaustive-deps）
- E2E 测试覆盖"刷新非首页路由"场景（如 `/baby` `/record` 直接访问），暴露此类 bug

### 12.7 后端 schema refine 链（FR-T 补充）

> 教训来自 BUG-S10-FUTURE-BIRTH（2026-05-06 修复）

zod 字段校验时，**业务约束**应通过 `.refine` 链表达，**不能仅靠正则**：

```typescript
// ❌ 仅正则：能创建生日 = 2099-01-01 的宝宝
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}.../, '...');

// ✅ 正则 + refine 链：格式 + 业务约束
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}.../, '出生日期格式无效')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), '出生日期无法解析')
  .refine((s) => new Date(s).getTime() <= Date.now() + 86400_000, '不能晚于今天')
  .refine((s) => new Date(s).getTime() >= MIN_BIRTH_DATE_MS, '不能早于 1900-01-01');
```

工程实践：
- 凡是"日期 / 数字范围 / 枚举值依赖其他字段"的 schema，必须配 `.refine`
- 配套 e2e 测试覆盖**边界值**（未来一秒 / 1899-12-31 / 1900-01-01）

### 12.8 Express 路由层 asyncHandler 强制规范

> 教训来自 BUG-VACCINES-EXPORT-NO-ASYNC-HANDLER（2026-05-06 修复，跨家庭隔离测试发现）

**所有 async 路由处理器必须用 `asyncHandler(...)` 包装**，否则 service 抛错时请求会挂死，造成 DoS 风险：

```typescript
// ❌ 错误：service 抛 ForbiddenError 时，错误未冒泡，请求永远不返回
router.get('/:id/vaccines', validateParams(...), async (req, res) => {
  const result = await vaccineService.getVaccines(req.userId!, req.params.id, req.query);
  res.json({ success: true, data: result });
});

// ✅ 正确
import { asyncHandler } from '../utils/async-handler';

router.get('/:id/vaccines', validateParams(...), asyncHandler(async (req, res) => {
  const result = await vaccineService.getVaccines(req.userId!, req.params.id, req.query);
  res.json({ success: true, data: result });
}));
```

`asyncHandler` 的 4 行实现（`server/src/utils/async-handler.ts`）：

```typescript
export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**Code Review 强制条款**：
- 任何 PR 引入新的 `router.get/post/...(/* ... */, async (req, res) => {...})` 直接被拒
- E2E 测试 `tests/e2e/cross-family-isolation.test.ts` 包含跨家庭被拒路径，会自动覆盖该错误

### 12.9 跨家庭数据隔离规范（FR-Security）

> 教训来自 BUG-LEAVE-OTHERS-FAMILY-INFO-LEAK（2026-05-06 修复）

后端实现**双层防御**确保 FamilyA 用户无法访问 FamilyB 数据：

**Service 层（4 步隔离模式）**：

```typescript
async getRecords(userId, query) {
  // 1. 通过外键反查实体
  const baby = await prisma.baby.findUnique({ where: { id: query.babyId } });
  if (!baby) throw new NotFoundError('宝宝');

  // 2. 拿当前用户的 familyId
  const familyId = await getFamilyIdForUser(userId);

  // 3. 双重校验
  if (!familyId || baby.familyId !== familyId) {
    throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
  }

  // 4. 强制附加 familyId where 条件（防御 ORM 误用）
  return prisma.record.findMany({ where: { babyId, familyId: baby.familyId, ... } });
}
```

**Route 层补充防御**（HTTP 入口）：

某些"无须传 babyId 的家庭操作"（如 leave / dissolve）必须在 route 层先校验当前用户 familyId 是否匹配：

```typescript
// POST /api/families/:id/leave
router.post('/:id/leave', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const ownFamilyId = await getFamilyIdForUser(req.userId!);
  if (ownFamilyId !== req.params.id) {
    throw new ForbiddenError('无权操作该家庭', ErrorCodes.PERMISSION_DENIED);
  }
  const result = await familyService.leaveFamily(req.userId!, req.params.id);
  res.json({ success: true, data: result });
}));
```

**E2E 验证**：`tests/e2e/cross-family-isolation.test.ts` 穷尽 22 个接口的跨家庭拒绝路径 + 反向对称 + 自家可见性，必须全绿。新增 service / 接口时同步在该测试追加。

## 11. 分页列表 & Dialog 底层（v4.3.x P3 起）

### 11.1 分页列表统一走 useInfiniteQuery

- 记录页（`pages/record/index.tsx`）已迁移为 `useInfiniteQuery`；后续新增列表页（若支持分页）应优先使用。
- 必须依赖后端 `PaginatedResponse.hasMore` 决定 `getNextPageParam`，不能用 `items.length >= pageSize` 自行推断（会在"正好一满页但下一页为空"时产生空请求）。
- 删除条目使用 `queryClient.setQueryData<InfiniteData<...>>` 进行乐观更新，过滤所有分页页面里的对应 id：

  ```tsx
  queryClient.setQueryData<InfiniteData<PaginatedResponse<T>>>(queryKey, (old) => {
    if (!old) return old
    return {
      ...old,
      pages: old.pages.map((p) => ({
        ...p,
        items: p.items.filter((r) => r.id !== deletedId),
        total: Math.max(0, p.total - 1),
      })),
    }
  })
  ```
- 新建 / 更新后统一 `refetch()` 重拉第一页，避免"首页数据和余下分页不一致"。

### 11.2 Dialog 底层约定

- 所有业务弹窗一律走 `<Dialog>` / `<DialogFooter>` / `useConfirm()`。
- `<Dialog>` 内部基于 `@radix-ui/react-dialog`，业务层无需直接引用 `DialogPrimitive.*`。
- 需要自定义非标准 Dialog（例如带 Tab / 侧边栏的复杂场景）时，优先扩展现有 `<Dialog>` 增加 prop；非特殊情况不要直接使用 `DialogPrimitive`。
- 禁止在业务页面手写 `fixed inset-0 z-50` + overlay/内容双层结构来模拟 Dialog——请用官方组件。

## 12. 趋势数据约定（FR-B v4.3.2）

### 12.1 时间窗

- 后端 `trendService.getEnhancedWeeklyTrend` 返回的：
  - `period`：本周一 00:00 → 今天 23:59:59，受 `baby.birthDate` 限制（向后裁剪到出生日 00:00）
  - `lastWeekPeriod`：上周一 00:00 → 上周日 23:59:59，受 `baby.birthDate` 限制；当 `birthDate` 落在本周内或之后时为 `null`
- **禁止**前端再做"近 7 天 / 近 14 天"的时间换算；时间窗以后端返回的两个 period 为准。
- 日均 = 周内总量 / 实际天数（最少 1 天）；体温维度统计 `tempAbnormal`（≥ 37.5°C 的次数）。

### 12.2 展示差异

| 页面 | 组件 | 视角 |
|------|------|------|
| 记录页 | `<InsightSection>` | 仅展示本周（细节视角：4 张精细卡 + 范围条 + 月龄参考 + 环比 + 建议） |
| 发现页 | `<WeeklyTrendOverview>` | 上周 vs 本周对比 + 异常行高亮 + 「向 AI 咨询建议」按钮 |

## 13. AI 助手 autoPrompt 路由协议

跨页面让 AI 助手以一段「带上下文的预填问题」开场，统一通过 React Router 的 `state.autoPrompt` 传入：

```tsx
const navigate = useNavigate()

navigate('/ai-assistant', {
  state: {
    autoPrompt: '基于本周喂养偏少，给出 3 条具体建议',
  },
})
```

AI 助手页 (`pages/ai-assistant/index.tsx`) 通过：

1. `useLocation().state.autoPrompt` 读取
2. 立即 `navigate(pathname, { replace: true, state: null })` 清空 history state（避免刷新或后退后再次触发）
3. `setTimeout(() => handleSend(prompt), 0)` 推迟一次微任务后发送，确保首屏渲染完成
4. `autoPromptHandledRef.current` 防止 React StrictMode 双调用

**调用方约定**：

- 预填问题应**自包含上下文**（指标摘要、月龄、希望 AI 输出的格式），不要假设 AI 助手页能拿到来源页的数据。
- `<WeeklyTrendOverview>.askAI` 是该协议的标准实现示例：拼接「上周 vs 本周日均 + 月龄 + 让 AI 给 3 条建议」。
- **禁止**使用 query string 传递长 prompt（URL 长度限制 + 暴露在浏览器历史）；统一用 `state`。



## 14. 登录态与凭据存储约定（v4.3.2+）

### 14.1 严禁明文密码落 localStorage

- ❌ 禁止把 `password` 写入 `localStorage` / `sessionStorage` / `IndexedDB` / `cookie` 任何前端持久化层（XSS 注入即可被窃取）。
- ✅ 「保存密码 + 自动填充」交给浏览器原生密码管理器，前端只需正确标注：
  - 用户名输入框：`name="username"` + `autoComplete="username"`
  - 密码输入框：`name="password"` + `autoComplete="current-password"`（注册页用 `new-password`）
  - `<form>` 顶层：`autoComplete="on"`
- 用户名/邮箱/手机号可以保存（无敏感性）：通过 `lib/remember-credentials.ts` 提供的 `readRememberedIdentifier / writeRememberedIdentifier` 接口操作，存储 key 统一前缀 `baby_care_`。

### 14.2 「记住我 / 保持登录态」实现

实现分三层：

| 层 | 存储位置 | 生命周期 | 作用 |
|---|---|---|---|
| Access Token | `localStorage` (`baby_care_token`，由 `useAuthStore` 通过 zustand `persist` 自动写入) | JWT 自带 15min 过期；持久存盘到用户主动登出 | 关闭浏览器再打开仍保持登录态 |
| Refresh Token | `httpOnly` + `SameSite=Strict` cookie，path 限制到 `/api/auth/refresh` | 7 天（`JWT_REFRESH_EXPIRES_IN`，cookie maxAge 同步） | access token 过期时自动续期，期间用户无感 |
| 上次登录的标识符 | `localStorage` (`baby_care_last_login_identifier`) | 永久（直到用户取消「记住我」勾选） | 自动回填用户名输入框 |

页面再次打开时：
1. zustand `persist` 中间件 hydrate 出 `token + user + isAuthenticated`；
2. `MainLayout` 检查到已登录 → 直接渲染主页；
3. 后续任意请求若返回 `TOKEN_EXPIRED`，axios 拦截器（`services/api.ts`）调 `/api/auth/refresh` 自动续 access token，整个过程用户无感。

### 14.3 Login 表单约定

新登录页（`pages/auth/login.tsx`）核心约定：

- 用户名字段使用 `<input type="text" inputMode="email">` 而非 `type="email"`，以兼容手机号；通过 `detectIdentifierKind(input)` 自动判定走 `{ email }` 或 `{ phone }` 字段。
- `useAuthStore.login` 接收 `LoginCredentials`：`{ email?, phone?, password }`；其中 email/phone 二选一，password 仅停留在内存中（绝不持久化）。
- 「记住我」开关默认 **勾选**：登录成功时写入 `baby_care_last_login_identifier` + `baby_care_remember_me`；取消勾选时同步清空已存的标识符。
- **绝不**自己实现"密码自动填充"，永远依赖浏览器原生能力。

### 14.4 注销流程

1. 用户点 Profile 页「退出登录」→ `authService.logout()` → `POST /api/auth/logout`
2. 后端 `clearCookie` 清掉 `refreshToken`（端点对未认证开放，即使 access token 已过期也成功）
3. 前端再调 `useAuthStore.logout()` 清掉内存 + `localStorage` 中的 access token & user
4. 路由跳 `/login`

如果后端 `/api/auth/logout` 调用失败（网络问题等），前端依然完成本地登出（`services/auth.ts` 已 try/catch 处理）。

### 14.5 微信扫码登录（方案预留）

详见 `docs/web-api-spec.md §2.7` 与 `docs/web-architecture.md §微信登录扩展`。简要规则：

- **控制开关**：`VITE_WECHAT_LOGIN_ENABLED=true` + `VITE_WECHAT_APP_ID`（前端 .env）+ `WECHAT_WEB_APP_ID/_SECRET`（server .env）
- **当前状态**：仅前端入口 + 后端路由骨架；未配置时前端不渲染按钮、后端返回 503 `WECHAT_NOT_CONFIGURED`。
- **已知小程序 vs 网站应用区别**：本项目小程序 AppID 是 `wx1f1bc8e6ff2be61d`，但网站应用必须在「微信开放平台」（open.weixin.qq.com）单独注册（与小程序 AppID 不同），且需要主体认证 + ICP 备案域名。
- **二阶段启用步骤**详见 `server/src/services/wechat-auth.service.ts` 的 `TODO(wechat-login-phase-2)` 注释块（核心是补 `User.wechatUnionId` schema + migrate）。
