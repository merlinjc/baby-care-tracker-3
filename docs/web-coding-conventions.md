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

### 6.7 成员三点菜单的权限分档（客户端）

`<MembersSection>` 里每条非自身成员行右侧的"⋮"菜单，三项操作的客户端显隐规则（服务端仍是最终裁判）：

| 操作 | 客户端条件 | 服务端兜底 |
|------|------|------|
| 修改权限 | 总是显示（对 admin 也显示，允许降级） | `SOLE_ADMIN`（最后一个 admin 不能被降级） |
| 转让管理员 | 目标 `role !== 'admin'` | `INVALID_PARAMS`（目标已是 admin 不可"再转让"） |
| 移除成员 | 目标 `role !== 'admin'` | `CANNOT_REMOVE_ADMIN` |

**反例**（v5.0.0 前的 BUG）：三项操作全部加了 `m.role !== 'admin'` 守卫，导致"管理员 A 想把管理员 B 降级 / 移除"时点开"⋮"菜单是空的，UI 表现像"被遮挡 / 没反应"。修复时仅保留"移除成员"的 admin 守卫，其余两项交给服务端。

**另外**：打开菜单时务必给承载它的 `.card` 动态加 `z-index: 30`，否则相邻 card 的阴影 / 边框会盖在菜单上，看起来也像"被遮挡"。

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

- **v5.0.0+ 约定（外层 padding 只在 MainLayout 一处）**：`MainLayout` 的内容容器统一给出 `max-w-3xl mx-auto w-full px-5 sm:px-6 py-7 lg:py-8`，并通过 `pb-20 lg:pb-0` 给移动端 TabBar 留白；**所有业务页根容器不得再写 `p-4 md:p-6 max-w-3xl mx-auto`**，只保留 `space-y-*` + `animate-*`。
- Tab 主页（home / discover / profile）：`space-y-6`
- 子页（record / baby / family / vaccine / milestone / growth / settings / jaundice 等）：`space-y-5`
- 不再出现 `space-y-3 / space-y-4 / space-y-7`。

**历史变迁**：v4.3.x 曾约定"Tab 主页 `space-y-5`、子页 `space-y-4`"并在每个页面自己写 `p-4 md:p-6 max-w-3xl mx-auto`，结果与 MainLayout 内层的 `px-4 py-6` 双层叠加，视觉上仍显拥挤（尤其移动端卡片紧贴屏幕左右）。v5.0.0+ 一次性把 padding 统一到 MainLayout、`space-y` 各升一档，解决此问题。

**⚠️ CSS Cascade Layers 陷阱（2026-05 修复记录）**：Tailwind v4 的所有工具类都位于 `@layer utilities` 中。按 CSS Cascade Layers 规则，**任何裸（unlayered）CSS 规则的优先级都高于所有 `@layer` 内的规则，不看特异性**。因此 `globals.css` 里**严禁出现**如下裸通配规则：

```css
/* ❌ 禁止：会让全站所有 Tailwind 的 .px-*/.py-*/.m-* 工具类失效 */
* { margin: 0; padding: 0; }
```

Tailwind v4 的 preflight 已在 `@layer base` 里做了完整的 `*` reset（`margin: 0; padding: 0; border: 0 solid`），不需要也不应该再写一遍。

历史教训：v7 改版时在 `globals.css` 顶部保留了 v6 遗留的 `* { padding: 0 }`，导致 `ListRow padding="none" className="px-5 py-3.5"` 这类"Card 自己不加 padding、由 ListRow 负责"的布局全站失效——列表图标贴 Card 左边、行高被压扁，表现为"账户与数据/里程碑/疫苗列表持续贴边"。排查时表面现象是 `className` 里明明有 `px-5`，`@layer utilities` 里也确实生成了 `.px-5` 规则，但 `getComputedStyle(.paddingLeft) = "0px"`。诊断需要从 `document.styleSheets` 手动 matchMedia 所有层级规则，定位到那条 unlayered `*` 规则。

**新增全局样式的强制约定**：
1. 纯 reset 类规则**一律**写在 `@layer base { ... }` 里，不要写在 unlayered 区域。
2. 业务语义类（如 `.ios-list`、`.headline`、`.footnote`）可以保持 unlayered（方便覆盖 Tailwind），但**不能**用 `*` / `html` / `body` 这种全局选择器对 padding/margin 做无条件重置。
3. 如果某个组件在浏览器里发现"Tailwind padding 类没生效"，第一步先检查 `globals.css` 是否有裸 `*` reset，而不是到处加兜底 CSS。

**死代码清理记录（2026-05）**：在 Cascade Layers 修复后，对 `globals.css` 做了一轮死代码清理，从 1259 行降到 1131 行（净减 128 行，CSS bundle 82.79kB → 79.51kB / gzip 14.85kB → 14.41kB）。清理内容：
- 重复定义的 `.empty-state` / `.empty-state__icon` / `.empty-state__title` / `.empty-state__desc`（合并为一份）
- 0 引用的 utility：`.border-hairline`、`.pressable`、`.section-header*`、`.stagger-children > *`（被 framer-motion `staggerContainer/staggerItem` 完全取代）
- 0 引用的 typography 类：`.title-1`、`.metric-xl`、`.metric-sm`、`.heading-xl`、`.display-md`、`.display-lg`、`.body-lg`
- 0 引用的 animate 工具类：`.animate-number-roll`、`.animate-breathe-ios`、`.animate-pulse-soft`（保留对应 `@keyframes`，按需重启用时直接加工具类即可）
- 0 引用的 data 钩子：`[data-quick-record-bar]`、`[data-drawer-grabber]`、`[data-bubble-meta]`、`[data-ai-header/-footer/-messages/-bubble-row]`

**保留**（虽然引用次数低但仍在用）：
- v6→v7 兼容 token alias（`--text-primary/-secondary/-hint`、`--bg-card/-elevated`、`--border-light` 等仍有 14-47 处引用）
- `[data-ai-page]`（AI 助手页负 margin 全屏布局唯一钩子）
- 大部分 `data-*` 钩子（仍在被各页面用作布局兜底）

**判定 0 引用的方法**：
```bash
# 单个类
grep -rE 'className=("|\{)[^"}]*\bsome-class\b' --include='*.tsx' client/src
# CSS 变量
grep -r 'var(--some-token)' --include='*.tsx' --include='*.ts' --include='*.css' client/src
```

**🛡️ Tailwind 4 JIT 兜底钩子（不得删除）**：由于 `@tailwindcss/vite` 在某些环境下对新增 class 的扫描会滞后或漏掉，导致 `px-5 / py-7 / pb-20` 等 utility 失效（Computed 全为 0），项目里关键结构元素额外挂了一组 `data-*` 属性钩子，在 `globals.css` 的 "Layout Fallback" 段用真·CSS 写死对应 padding / 间距 / 高度。**任何人改这些组件都不得移除这些 data 属性**；若要调整间距，同时改 Tailwind class（保证主干）和兜底 CSS（保证故障模式下也正常）。

| Data 钩子 | 所属组件 | 兜底内容 |
|------|------|------|
| `data-app-main` / `data-app-content` | `MainLayout` | `px-5 sm:px-6 py-7 lg:py-8`、`pb-20 lg:pb-0` |
| `data-app-tabbar` / `data-app-tabbar-inner` | `MainLayout` 移动 TabBar | `h-16` = 64px |
| `data-profile-stack` | `ProfilePage` 根容器 | `space-y-6` = 24px；外观两张卡之间 28px |
| `data-dialog-form` | 6 个记录 Dialog 的 `<form>` | `space-y-5` = 20px（字段组间距） |
| `data-form-field` | `<FormField>` 壳组件 | `space-y-2` = 8px（label ↔ 控件间距） |
| `data-note-tag-picker` | `<NoteTagPicker>` 根 | `space-y-3` = 12px（内部各区块间距） |

**特殊页面**：
- `AIAssistantPage` 是全屏对话布局，用负 margin `-mx-5 -my-7 sm:-mx-6 lg:-my-8` 抵消 MainLayout 外层 padding，让顶栏 / 输入框能贴到视口边缘；高度由 `h-[calc(100vh-4rem)]` 计算（对齐 TabBar `h-16`）。
- `AuthLayout`（/login, /register, /auth/wechat/callback）不走 MainLayout，自己用 `px-5 py-10` + `max-w-md`。

### 11.8 卡片内边距基线

`.card` / `.card-interactive` padding = **20px**，`.card-base` padding = **18px**。原 v4.3.x 的 `16px` 在移动端视觉偏挤，v5.0.0+ 统一提升；字号特大档会通过 `:root[data-font-scale='xl']` 再叠加放宽按钮 / 输入框 / chip padding，卡片内边距保持不变（避免特大档位下卡片显得"空"）。

**禁止**：
- 在卡片上用 `py-3` / `py-4` 等 Tailwind 自定义 padding 覆盖 `.card` 默认 padding（特殊需求除外，并在代码注释里说明）。
- 为了"省空间"把 `.card` 改为 `.card-base`；二者语义不同：`.card` 是一级分组容器，`.card-base` 是嵌套在分组里的子卡。

### 11.9 原子组件优先级（v5.0.1 起生效 · 硬性规则）

v5.0.1 分 4 批引入 shadcn 风格 Primitive 组件（**全部 4 个 Batch 已完成，合计 22 个 Primitive**，详见 `docs/web-component-library.md §1.A`）。所有**新写/改动的 JSX** 必须优先使用组件，而不是 `globals.css` 的语义类：

| 场景 | ✅ 必须使用 | ❌ 禁止（新代码） | Batch |
|------|-----------|------------------|-------|
| 任意按钮 | `<Button variant size>` / `<IconButton>` | `<button className="btn-primary">`、`inline-flex items-center gap-1.5 rounded-md h-8 px-3 text-xs` 散装拼装 | 1 |
| 表单输入 | `<FormField><Label><Input>...</FormField>` | 裸 `<input className="input-base">`；error 状态自己 inline style `borderColor` | 1 |
| 多行输入 | `<Textarea>` | 裸 `<textarea className="input-base">` | 1 |
| 列表/内容容器 | `<Card>` + `<CardHeader><CardTitle>...</CardHeader>...` | `<div className="card">` 新代码 | 1 |
| 小角标（10-12px） | `<Badge size="xs">` | `<span className="badge-mini">` / `text-[10px] rounded-full px-1.5` | 1 |
| 分类标签 | `<Badge variant="feeding/sleep/..." size="sm">` | `<span className="type-badge type-badge--feeding">` | 1 |
| 水平分隔线 | `<Separator />` / `<Separator label="或" />` | `<div className="h-px bg-[var(--border)]">` | 1 |
| 开关 | `<Switch>` | `<input type="checkbox" style={{accentColor:...}}>` | 2 |
| 单选 / 卡片式单选 | `<RadioGroup>` + `<RadioGroupCard>` | `<label><input type="radio">...` 手写 + hover/selected 边框切换 | 2 |
| 滑块 | `<Slider>` | `<input type="range" style={{accentColor:...}}>` | 2 |
| 进度条 / 范围点位 | `<Progress>` / `<RangeIndicator>` / `<WeeklyRangeBar>` | `<div className="progress-bar">` 手写 fill div；老 `<RangeBar>` 已删除 | 2/3 |
| 内联提示条 | `<Alert variant size icon>` | `<div className="notice-info">` / `style={{background:'color-mix(...)', color:'var(--danger)'}}` 散装 | 2 |
| 下拉菜单 | `<DropdownMenu>` + 子组件 | 自己写 `useRef + useEffect(mousedown)` 手势监听；手写 `role="menu/listbox"` + 选项按钮 | 2 |
| 可切换标签 / chip | `<Badge interactive aria-pressed>` | 手写 `<button>` + 选中态边框/底色切换（JaundiceDialog 的 MultiBadge、NoteTagPicker 是标准示例） | 2 |
| 多 Tab 切换 | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` | 手写 `role="tablist/tab"` + state + 下划线 / pill 切换 | 3 |
| 头像（宝宝 / 用户） | `<BabyAvatar>` / `<UserAvatar>`；自由组合用 `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` | `<img className="rounded-full">` / 裸 `<div>` 做首字 fallback / 手写 gender 配色 | 3 |
| Tooltip（hover 提示） | `<Tooltip>` + `<TooltipTrigger asChild>` + `<TooltipContent>` | 裸 `title="..."` 属性作为唯一提示（不可键盘聚焦时显示） | 3 |
| 类型色切换 chip（带类型色填充） | `<Button variant="ghost" active accentColor>` | `.chip + .chip--active/inactive` + inline style 散装（record 页已迁移） | 3 |
| 复选框 | `<Checkbox>` | 裸 `<input type="checkbox">` | 4 |
| 侧边 / 底部抽屉 | `<Sheet>` + `<SheetContent>` + `<SheetHeader>` + `<SheetBody>` + `<SheetFooter>` | 自己写 `fixed right-0 inset-y-0` + overlay 组合 | 4 |
| 内容滚动区 | `<ScrollArea>` | 直接 `overflow-y-auto` + 无美化滚动条的原生样式（滚动条与暖夜/亮色主题不匹配） | 4 |

**过渡期约定（Batch 4 后）**：
- 以下 CSS 类已在 `globals.css` 标记 `@deprecated`：
  `.btn-primary / .btn-secondary / .btn-danger-outline / .input-base / .card / .card-base / .card-interactive / .badge-mini / .type-badge / .chip / .chip--active / .chip--inactive / .tab-button / .icon-btn / .icon-btn--danger / .notice-info / .progress-bar`
- **仍然保留以兼容"未改动的业务页面"**（如 `baby / vaccine / milestone / jaundice / home / ai-assistant / discover` 等页面的部分复杂 JSX 仍在用 `.card-base` 做内部布局）；视觉与新组件 1:1 等价，不影响功能。
- **新代码**一律按上表走 Primitive；每次接触旧代码时顺手迁移。
- 物理删除时点：业务页面全部迁移到新组件后（预期下一个次版本 v5.1.x）。

**Dialog 内部豁免**：~~已解除~~。v5.1.0 起 `<DialogFooter>` 内部已迁移到 `<Button>`。现在 `globals.css` 已物理删除所有废弃 CSS 类，业务层与 Primitive 内部均不应再使用。

**v5.1.0 物理清除日志**：删除了 `.card / .card-base / .card-interactive / .type-badge* / .input-base / .btn-primary / .btn-secondary / .btn-danger-outline / .icon-btn* / .badge-mini / .notice-info / .chip* / .tab-button* / .progress-bar*`。

**v7.1 二次清理**（2026-05）：进一步删除已 0 引用的语义类与 data 钩子，详见上方"死代码清理记录（2026-05）"小节。当前剩余的 `globals.css` 视觉基础设施（仍在使用）：`.label-base / .heading-lg/md/sm / .body / .body-md/sm / .caption / .caption-1/2 / .icon-circle* / .number-display / .display-number / .display-sm / .footnote / .subheadline / .callout / .headline / .title-2/3 / .large-title / .metric-lg/md / .empty-state* / .spinner / .ios-list / .typing-dot / .page-enter / .animate-fade-in/-up / .animate-shimmer / .animate-slide-up/-scale-in / .animate-slide-in/out-(left|right|top)`。

### 11.9.1 v5.1.0 设计优化规范（在 4 批 Primitive 之上）

| 设计细节 | ✅ 约定 |
|---------|---------|
| 图标尺寸 | Primitive 自动推导；**不要**在组件内部手写 `<Icon className="h-4 w-4" />` 指定尺寸（特殊场景除外）。绕过推导用 `<Button iconSize="lg">` |
| 叙事性大字 | `<h1 className="display-sm">` / `display-md` / `display-lg`；**不要**用 `heading-xl` + 手写 `fontSize` 模拟大号 |
| 数字仪表盘 | `className="display-number"`（mono + tabular + 负字距）；**不要**用 `number-display font-bold leading-none` 手写 |
| Badge 强调 | `<Badge tone="solid">` 用于高优先级未读数 / 严重警示；`tone="outline"` 用于 meta；默认 `tone="soft"` |
| 引导空态 | `<Card variant="cta">` 代替手写 dashed border + center 组合 |
| Focus 指示 | 优先使用组件内置 `focus-visible:ring-*`；全局双层 ring 仅作兜底 |

### 11.10 variant / size 命名一致性

所有 Primitive 与其衍生组件（`HeaderAction` / `AddRecordMenu` / `Dialog` 等）**必须**遵守统一的命名字典：

| Variant | 语义 | 色值来源 |
|---------|------|---------|
| `default / primary` | 主操作 / 品牌 | `var(--primary)` |
| `secondary` | 次要操作 | `var(--bg-card)` + border |
| `ghost` | 低调 / 可切换（`active` 时填充） | 透明 + hover 填充 |
| `outline` | 纯描边 | 透明 + `var(--border)` |
| `danger` | 危险 / 删除 / 高烧 | `var(--danger)` |
| `danger-outline` | 危险描边 | border: `var(--danger)` alpha 25% |
| `warning` | 警告 / 低烧 / 异常 | `var(--warning)` |
| `success` | 成功 / 达标 | `var(--success)` |
| `info` | 普通提示 | `var(--info)` |
| `feeding / sleep / diaper / temperature / growth` | 记录类型色 | 对应 `var(--*)` |
| `link` | 文字链接 | `var(--primary-dark)` + underline |

**Size 统一 4 档 + icon 特例**：

| Size | 按钮高度 | 字号 | 适用场景 |
|------|---------|------|---------|
| `xs` | 28px | `text-xs` | 列表行内按钮、Badge 内嵌、快捷用量 chip |
| `sm` | 32px | `text-xs` | 页面右上角 action、紧凑场景 |
| `md` | 40px | `text-sm` | 默认；表单提交、对话框底部 |
| `lg` | 48px | `text-base` | 首屏 CTA、字号 xl 档无障碍场景 |
| `icon` | 36×36 | — | 纯图标按钮 |

**禁止**：
- 在业务 JSX 中使用 `size="md"` 的 Button 自行加 `className="h-8"` 覆盖高度——应该改用 `size="sm"`。
- 新增非以上枚举的 variant 名（如 `variant="special"`）；需求不覆盖时通过 `accentColor` prop 传入具体颜色 token。

### 11.11 CVA 新增组件约定

在 `ui/` 新增任意 Primitive 时：

1. **使用 `class-variance-authority`** 定义所有 variant × size 组合；禁止 `if/else` 渲染分支。
2. **导出 `{组件, 组件Variants}`**：下游业务组件可通过 `buttonVariants({ variant, size })` 复用同款 class（例如在 `cn(buttonVariants(...), className)` 里）。
3. **必用 `forwardRef`**：未来可能被 Popover / Tooltip / DropdownMenu 当 anchor 使用，必须可以 attach ref。
4. **A11y 默认齐备**：所有交互组件自动带 `focus-visible:ring-[var(--primary)]/40`；`aria-*` 不靠业务侧补。
5. **`defaultVariants`** 必须显式列出，以便 tsc 正确推断可选 prop。
6. **tsc -b + vite build 零错误**是 PR 合入的硬门槛。

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
- **双按钮 footer 布局**：`DialogFooter` 内部采用 `grid grid-cols-2 gap-2` 容器（而非 `flex gap-2`）。原因：`<Button>` primitive 带 `shrink-0`（防止图标按钮被压扁），与 `block: w-full` 组合后在 flex 容器中会让两个按钮各自坚持 100% 宽度并溢出 Dialog。grid 两列等宽格子可以严格将宽度约束在 `(container - gap) / 2`，即使未来 Button 样式再调整也不会破坏底栏布局。

### 11.3 分页请求硬上限 pageSize ≤ 100（v5.x 2026-05-09 新增）

> 教训来自 BUG-REPORT-PAGESIZE-422（`pageSize:500/200` 直接 422 `Number must be less than or equal to 100`）

**后端契约**（`server/src/schemas/common.schema.ts` 的 `paginationSchema`）：`pageSize` 默认 20、**硬上限 100**。所有列表端点（`GET /records`、`GET /babies/:id/vaccines`、`GET /babies/:id/milestones` 等）共用这条约束。

**前端规范**：

- 任何业务场景请求 `pageSize` 上限 = 100，**禁止写 200 / 500 / `Number.MAX_SAFE_INTEGER`**。
- 需要"一次拉完"时（聚合报告、首屏标准列表等），用**循环分页**直到 `hasMore === false`，并带一个 `MAX_PAGES` 兜底（推荐 10；记录类最多 20）防失控：

  ```ts
  const all: T[] = []
  const PAGE_SIZE = 100
  const MAX_PAGES = 10
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await xxxService.list(id, { page, pageSize: PAGE_SIZE })
    all.push(...res.items)
    if (!res.hasMore) break
  }
  ```

- 分页列表页（`record/index.tsx` 等）继续用 `useInfiniteQuery` + 按需加载，**不做**循环。
- 后端如确有放宽需求，改 `paginationSchema.max(...)` 同时同步更新 `docs/web-api-spec.md` §1.3 与本节。

### 11.4 日期入参必须是完整 ISO 8601（v5.x 2026-05-09 新增）

> 教训来自 BUG-VACCINE-DATE-422、BUG-RECORDS-DATE-FILTER-422

**后端契约**：所有日期/时间字段（`startTime` / `endTime` / `startDate` / `endDate` / `vaccinatedDate` / `achievedDate`）使用 `z.string().datetime()`，**只接受完整 ISO 8601**（`YYYY-MM-DDTHH:mm:ss[.sss]Z`）。

**前端规范**：

- `<input type="date">` 的原生值是 `YYYY-MM-DD`，**不能直接作为请求体 / query 参数**，必须显式转换：

  ```ts
  // 起始（0 点）
  const startIso = ymd ? new Date(`${ymd}T00:00:00`).toISOString() : undefined
  // 结束（包含当天：23:59:59.999）
  const endIso = ymd ? new Date(`${ymd}T23:59:59.999`).toISOString() : undefined
  ```

- 页面状态里可以保持 `YYYY-MM-DD`（便于 `<input type="date" value={ymd}>` 双向绑定），但送出请求的那一刻必须转全量 ISO。
- 已达成 / 已接种这类"当前时刻"字段直接 `new Date().toISOString()`。

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
| 成长报告页（周报模式） | `<WeeklyTrendOverview>` | 上周 vs 本周对比 + 异常行高亮 + 「向 AI 咨询建议」按钮；v5.0.0+ 由发现页迁入 `/report` |

> **v5.0.0+ 历史变迁**：`<WeeklyTrendOverview>` 原本挂在发现页底部（v4.3.2）。为避免"首页仪表盘 / 记录页精细趋势 / 发现页对比 / 报告页汇总"四处同质内容，v5.0.0+ 把发现页的趋势对比卡移除，并在"周报"页内复用同一组件；发现页改为纯导航（FocusCard + 功能入口 Grid + 成长报告入口卡）。

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

## 15. 记录备注「标签 + 自由文本」协议（v5.0.0+）

为提升备注输入效率并支持常用标签的快速勾选 / 自定义，所有记录类型（喂养 / 睡眠 / 换尿布 / 体温 / 生长）的 `record.note` 统一采用如下内联协议：

```
"#吃得多 #打嗝多 今晚多喝了 30ml"
 └─ 标签 ─┘ └───── 自由文本 ──────┘
```

**核心约定**：
- 标签以 `#` 前缀开头，空白分隔（半角空格 / 全角空格 / 换行）
- 标签与自由文本混写，顺序不敏感（但保存时标签统一靠前）
- **不改 `note` 字段类型**，后端、shared 类型、DB schema 零改动；纯前端语义约定
- 老数据（纯文本 note）完全向后兼容：`parseNote` 返回 `{ tags: [], freeText: 原文 }`

**解析 / 构造 API**（位于 `client/src/lib/note-tags.ts`）：

| 函数 | 用途 |
|------|------|
| `parseNote(note)` | 把 note 字符串解析为 `{ tags, freeText }` |
| `buildNote(tags, freeText)` | 构造回 note 字符串；空值自动合并 |
| `getPresetNoteTags(recordType)` | 返回某类型的预设标签（类型细分 + 通用） |
| `readCustomNoteTags / writeCustomNoteTags / addCustomNoteTag / removeCustomNoteTag` | 自定义标签 `localStorage` CRUD；key `baby_care_custom_tags:${recordType}`；每类型上限 30 个；每标签 ≤ 10 字符 |

**输入侧约定**：
- 5 个记录 Dialog（`FeedingDialog` / `SleepDialog` / `DiaperDialog` / `TemperatureDialog` / `GrowthDialog`）的备注字段**必须**使用 `<NoteTagPicker>`，禁止直接写 `<input type="text">`。
- `<NoteTagPicker>.onChange` 返回的就是已拼好的 note 字符串，直接透传到 `onSubmit` 的 `note` 字段。
- 不同 `recordType` 对应不同 `accentColor`，与 Dialog 头部图标色一致。

**展示侧约定**（timeline / record 页卡片 / 任何其它要展示备注的地方）：
- **必须**先用 `parseNote` 解析，再分别渲染：
  - 标签用 `.badge-mini` 或等价的小 pill，color/bg 复用 `config.color`（类型色）
  - 自由文本用 `📝` emoji 前缀 + caption 文字 + `line-clamp-2` 截断
- 禁止把 note 作为纯字符串一次性展示（会出现 `#` 前缀裸露的视觉污染）。

## 16. 里程碑打卡（check-in）协议（v5.x+）

里程碑（`/milestone`）是 Web 端唯一一个"按 name 做 toggle"的功能模块，与所有走 `Record` 表的记录类型不同：

**数据层约定**：
- `MilestoneRecord` 在 `(babyId, name)` 上有复合 unique 约束；`name` 必须取自 `client/src/lib/milestone-defs.ts` 的内置 28 项标准定义。**禁止**通过任何接口写入自定义 `name`（否则即使 schema 不阻拦，UI 也无法识别为"已打卡的标准项"）。
- `category` 必须使用类别 key（`motor / fine_motor / language / social / cognitive`），不要传中文名（中文名只用于显示，由 `getCategoryLabel(key)` 转换）。

**Service 层约定**（`server/src/services/milestone.service.ts`）：
- `createMilestone` 必须用 `prisma.milestoneRecord.upsert({ where: { babyId_name }, update: {} })` 形式，**不**做条件 `findFirst → create`。后者在并发打卡时会触发 `P2002`。
- `update` 仅允许修改 `achievedDate / note`；`name / category` 不开放。
- `delete` 即"取消打卡"，鉴权用 `RECORD_DELETE_OWN | RECORD_DELETE_ANY`，与 Record 一致。

**前端 Service 约定**（`client/src/services/baby-extra.ts`）：
- `milestoneService.create` 是幂等的：重复打卡同名里程碑会拿到原记录，**不要**重试式补偿。
- `milestoneService.remove` 之后必须立即把对应记录从本地 state 中移除，避免 toggle 视觉滞后；同时清理 `recordByName` 缓存依赖（在本项目里通过 `setMilestones((prev) => prev.filter(...))` 即可触发 `useMemo` 重算）。

**UI 约定**（`pages/milestone/index.tsx`）：
- 列表行末的圆形 toggle 是**主交互**，必须 `e.stopPropagation()` 避免触发整行的"打开详情"。
- 打卡（未达成 → 已达成）**不**做二次确认（轻量动作）；取消打卡（已达成 → 未达成）**必须** `confirm` 二次确认（破坏性动作）。
- 详情弹窗在已达成态展示"达成日期 + 备注"两栏，主按钮 = 保存修改、次按钮 = 取消打卡（红色 plain 按钮）；未达成态主按钮 = 标记达成。
- 不要在该页引入"自由添加里程碑"的 UI；如果未来要扩展自定义里程碑，需要在 schema 上加 `kind: 'standard' | 'custom'` 字段，再独立设计入口。


