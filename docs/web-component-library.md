# Web 版组件库（v5.0.0 alpha 新增组件）

> 版本：v1.0 | 日期：2026-05-06
>
> 本文档列出 Web 版本期新增的组件、hooks、lib 和 service 方法。
> 小程序版组件库请参考根目录 [`component-library.md`](../component-library.md)。

---

## 1. 新增 UI 通用组件（client/src/components/ui/）

| 组件 | 文件 | 说明 |
|------|------|------|
| `<Dialog>` + `<DialogFooter>` | `ui/dialog.tsx` | 响应式弹窗（基于 `@radix-ui/react-dialog`）：移动底部 sheet / 桌面居中；可选 sticky footer 和 size；内置 focus trap / inert 背景 / ESC / return focus |
| `<ConfirmHost>` + `useConfirm()` | `ui/confirm-dialog.tsx` | 全局 Promise 式确认弹窗，替代 `window.confirm` |
| `<Skeleton>` | `ui/skeleton.tsx` | 占位骨架（FR-A5） |
| `<ListSkeleton>` | `ui/list-skeleton.tsx` | 列表卡片骨架（首次加载列表型页面用） |
| `<ChartSkeleton>` | `ui/chart-skeleton.tsx` | 图表区骨架（生长曲线等） |
| `toast` + `<Toaster>` | `ui/toast.tsx` | 极简 Toast 实现（不依赖 sonner / radix） |
| `<SegmentedControl>` | `ui/segmented-control.tsx` | 通用分段控制（替代 tab / 单选 chip 组合） |

### 1.0 公共原子样式类（globals.css，2026-05-06 收敛新增）

为避免 ad-hoc Tailwind 拼装重复散落，以下类必须直接复用：

| 类名 | 用途 | 等价废弃写法 |
|------|------|------|
| `icon-btn` | 列表行内编辑按钮（hover → primary） | `p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--primary)] hover:bg-[color-mix(in_srgb,_var(--primary)_12%,_transparent)]` |
| `icon-btn icon-btn--danger` | 列表行内删除按钮（hover → danger） | 同上但 danger 色 |
| `badge-mini` | 10px 圆角徽章（pill）；`inline-flex / gap / 等宽数字 / 单行`默认；颜色由 `style.backgroundColor` + `style.color` 覆盖 | `text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 number-display` 等 |
| `notice-info` | 内联提示条（viewer 提示 / 离线状态 / 引导） | `flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs bg-[var(--bg-elevated)]` |

**强制约定**：
- 列表行的编辑/删除等小图标按钮**必须**用 `icon-btn` / `icon-btn--danger`，不允许再写散装 hover 链。
- 10px 角标（如「自费」「当前」「2 项逾期」「喂养·3」等）**必须**用 `badge-mini`，外加 inline `style` 覆盖上色，禁止再写 `text-[10px] px-1.5 py-0.5 rounded-full`。
- 页面内"viewer / 离线 / 引导"等内联提示条**必须**用 `notice-info`，文案统一 `var(--text-hint)`。

### 1.1 toast 用法

```typescript
import { toast } from '@/components/ui/toast'

toast.success('已添加记录')
toast.error('请求失败', 5000) // 自定义时长
toast.info('操作已取消')
toast.warning('您没有此操作的权限')
```

`<Toaster />` 全局挂载点已在 `app/App.tsx`，无需重复挂。

### 1.2 Dialog 用法

```tsx
import { Dialog, DialogFooter } from '@/components/ui/dialog'

<Dialog
  open={open}
  onClose={onClose}
  title="喂养记录"
  icon={<Baby className="h-4 w-4" />}
  accentColor="var(--feeding)"
  size="md"              // 'sm' | 'md' | 'lg'，默认 'md'
  footer={                // 可选 sticky 底栏
    <DialogFooter
      onCancel={onClose}
      confirmText="保存"
      loading={isSubmitting}
      confirmType="submit"
      confirmFormId="my-form"
      variant="primary"   // 或 'danger'
    />
  }
>
  <form id="my-form" onSubmit={handleSubmit}>...</form>
</Dialog>
```

- 移动端（<640px）：底部 sheet，`slide-up` 动画，带拖拽条。
- 桌面端（≥640px）：居中，`scale-in` 动画，四角全圆角，`sm:mx-4` 留边距。
- 内置 ESC 关闭、背景点击关闭（`dismissOnBackdrop` 可关）、焦点陷阱、body 滚动锁、首元素自动 focus。
- 底层基于 `@radix-ui/react-dialog`：自动 `aria-labelledby` / 可选 `aria-describedby`、inert 背景（屏幕阅读器只感知 Dialog）、关闭时 return-focus 回触发元素、Portal 渲染避开 z-index / overflow 问题。

### 1.3 ConfirmDialog 用法

```typescript
import { useConfirm } from '@/components/ui/confirm-dialog'

const confirm = useConfirm()

const ok = await confirm({
  title: '删除这条记录？',
  description: '删除后不可恢复。',   // 可选，支持 string | ReactNode
  confirmText: '删除',              // 默认「确认」
  cancelText: '取消',               // 默认「取消」
  variant: 'danger',                // 'primary'（默认）| 'danger'
  // icon: 可选自定义；默认 danger 时显示 AlertTriangle
})
if (!ok) return
// 执行业务
```

`<ConfirmHost />` 全局挂载点已在 `app/App.tsx`（紧邻 `<Toaster />`），无需重复挂。

**硬性规则**：项目中不允许使用 `window.confirm` / `alert` / `prompt`（详见 `docs/web-coding-conventions.md §9`）。

### 1.4 ListSkeleton 用法

```tsx
import { ListSkeleton } from '@/components/ui/list-skeleton'

{isLoading ? <ListSkeleton count={5} /> : <YourList />}
```

Props：`count`（默认 5）、`showActions`（默认 true，是否渲染右侧操作位）、`withAccent`（默认 true，左侧 3px 色条占位）。

**约定（loading 策略）**：
- **首次加载列表型页面** → `<ListSkeleton>`（模拟最终 DOM 形状，避免布局跳动）
- **图表型页面（生长曲线等）首次加载** → `<ChartSkeleton>`
- **分页加载、局部刷新** → `<div className="spinner"/>` + 「加载更多...」
- **禁止**使用纯文字「加载中...」作为唯一 loading 提示。

### 1.5 ChartSkeleton 用法

```tsx
import { ChartSkeleton } from '@/components/ui/chart-skeleton'

{isLoading ? <ChartSkeleton chartHeight={200} rows={4} /> : <Chart />}
```

## 2. 新增业务组件

| 组件 | 文件 | 涉及 FR / 说明 |
|------|------|--------|
| `<StatusCapsule>` | `status-capsule.tsx` | FR-A1（4 态：none/sleeping/feeding_ago/sleep_abnormal） |
| `<BabySwitcher>` | `baby-switcher.tsx` | FR-A2（多宝头像组） |
| `<TodaySummary>` | `today-summary.tsx` | FR-A3（4 列大数字 + 进度条；睡眠卡片右上角支持嵌入「开始/结束」实时计时按钮，配合 `useActiveSleep` 使用） |
| `<HomeSkeleton>` | `home-skeleton.tsx` | FR-A5（首页骨架屏） |
| `<InsightSection>` | `insight-section.tsx` | FR-B（记录页精细趋势：4 张卡含范围条/参考/环比/建议） |
| `<WeeklyTrendOverview>` | `weekly-trend-overview.tsx` | 发现页「上周 vs 本周」趋势对比：单卡 4 行（指标 / 上周日均 / 本周日均 / 对比箭头），异常行整行高亮；头部含偏离徽章 + 「详情 →」跳记录页；底部「向 AI 咨询建议」按钮，会把趋势摘要拼为预填问题，通过 `navigate('/ai-assistant', { state: { autoPrompt } })` 跳转，AI 助手页自动发送一次 |
| `<RangeBar>` | `range-bar.tsx` | FR-B3（迷你范围条） |
| `<FocusCard>` | `focus-card.tsx` | 发现页「最紧急事项」卡：3 级 urgency（overdue / upcoming / normal），左侧 3px 色条 + icon + title + desc |
| `<PageHeader>` | `page-header.tsx` | 通用页面头部，支持 `variant: 'sub' / 'tab'`、`showBack` / `backTo`、`icon` / `accentColor` / `action` |
| `<HeaderAction>` | `header-action.tsx` | 配合 `PageHeader.action` 使用，三种 variant（primary / secondary / ghost），统一右上角操作按钮样式 |
| `<AddRecordMenu>` | `add-record-menu.tsx` | 记录页右上角「添加」下拉菜单：5 种记录类型（喂养/睡眠/排便/体温/生长）独立入口；点击外部 / Esc 自动关闭；通过 `onPick(type)` 回调通知父组件打开对应 Dialog |
| `<EasterEggDisplay>` | `easter-egg-display.tsx` | FR-G2（彩蛋三态渲染） |
| `<QuotaBar>` | `quota-bar.tsx` | FR-F3（AI 配额）双形态：`variant='bar'`（完整条带）/ `variant='badge'`（紧凑徽章，嵌入 header） |
| `<ThemeSelector>` | `theme-selector.tsx` | FR-G1（三态主题选择器） |
| `<Timeline>` | `timeline.tsx` | 首页「今日时间线」记录展示（结构化摘要 + 关键指标徽章 + 辅助行） |

### 2.1 PageHeader 用法

```tsx
import { PageHeader } from '@/components/page-header'
import { HeaderAction } from '@/components/header-action'
import { Plus, Calendar, ClipboardList } from 'lucide-react'

// Tab 主页（record / discover）
<PageHeader
  title="记录"
  variant="tab"
  icon={<ClipboardList className="h-6 w-6" />}
  accentColor="var(--primary)"
  subtitle={subtitle}
  action={
    <div className="flex items-center gap-2">
      <HeaderAction variant="ghost" icon={<Calendar className="h-3.5 w-3.5" />} label="筛选" active={showFilter} onClick={...} />
      <HeaderAction variant="primary" icon={<Plus className="h-3.5 w-3.5" />} label="添加" onClick={...} />
    </div>
  }
/>

// 子页（vaccine / milestone / settings / baby / family / growth）
<PageHeader title="疫苗计划" backTo="/discover" action={...} />
```

**Variant 选择**：
- `variant="sub"`（默认）：返回键 + 标题，子页统一使用。
- `variant="tab"`：无返回键，可携带 48px 渐变图标，Tab 主页使用。

**约定**：
- 首页保持自定义头部（问候语 + BabySwitcher），不替换为 PageHeader。
- Profile 页用户卡本身即为头部，不再额外渲染 PageHeader。
- AI 助手页因全屏对话特殊布局保留 sticky 顶栏，不替换为 PageHeader。

### 2.1.1 FocusCard 用法（发现页聚焦卡）

```tsx
import { FocusCard } from '@/components/focus-card'
import { AlertTriangle, Clock, Sparkles } from 'lucide-react'

<FocusCard
  urgency="overdue"            // 'overdue' | 'upcoming' | 'normal'
  title="疫苗有逾期"
  description="2 项疫苗已逾期，请尽快安排接种"
  icon={<AlertTriangle className="h-5 w-5" />}
  targetUrl="/vaccine"
  badge="2 项逾期"              // 可选，覆盖默认 urgency 标签
/>
```

左侧 3px 色条 = urgency 色：`overdue` 为 `var(--danger)`，`upcoming` 为 `var(--warning)`，`normal` 为 `var(--success)`。

**发现页约定**：页面顶部渲染 1 张 FocusCard（根据疫苗/里程碑状态自动决策），下方是统一 4 入口 Grid（移动 2 列 / 桌面 4 列），最底部嵌入本周趋势（`<InsightSection>`）。

### 2.2 TodaySummary 用法

```tsx
import { TodaySummary } from '@/components/today-summary'
import { useActiveSleep } from '@/hooks/use-active-sleep'
import { usePermission } from '@/hooks/use-permission'

const { activeSleep, start, end } = useActiveSleep(currentBaby?.id)
const { canEdit } = usePermission()

<TodaySummary
  stats={stats}
  birthDateIso={currentBaby.birthDate}
  onSelect={(key) => openDialog(key)}            // 点卡片本体 → 打开对应 dialog
  sleepActive={!!activeSleep}                    // 决定睡眠卡片右上角按钮形态
  canControlSleep={canEdit}                      // viewer 时按钮自动禁用
  onStartSleep={() => start('nap')}              // 无进行中睡眠时点击「开始」
  onEndSleep={() => end()}                       // 有进行中睡眠时点击「结束」
/>
```

**Props**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `stats` | `TodayStats` | 必填，今日 4 项统计 |
| `birthDateIso` | `string?` | 用于 `computeDailyGoals` 计算月龄目标 |
| `onSelect` | `(key) => void` | 点击 4 个卡片本体的回调；建议打开对应 dialog |
| `sleepActive` | `boolean?` | 是否存在进行中睡眠；为 true 时睡眠卡按钮显示「结束」（红底白字），否则显示「开始」 |
| `canControlSleep` | `boolean?` | 默认 `true`；为 false 时按钮 `disabled`（viewer 角色场景） |
| `onStartSleep` | `() => void` | 点击「开始」按钮回调 |
| `onEndSleep` | `() => void` | 点击「结束」按钮回调 |

**约定**：
- 仅当传入 `onStartSleep` 或 `onEndSleep` 任一回调时，睡眠卡片右上角才会渲染按钮（替代原 `Moon` 图标）；其他卡片始终保持图标显示。
- 按钮内部已 `e.stopPropagation()`，点击不会触发 `onSelect('sleep')`，不会误打开 dialog。
- 「开始」会通过 `useActiveSleep().start('nap')` 创建一条 `endTime=null` 的进行中睡眠；并发冲突时服务端抛 `SLEEP_ALREADY_ACTIVE`，hook 内部自动 toast 并刷新缓存。

### 2.3 Timeline 用法

```tsx
import { Timeline } from '@/components/timeline'

<Timeline records={todayRecords.slice(0, 5)} />
```

**Props**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `records` | `CareRecord[]` | 需展示的记录列表，已按时间倒序排好 |
| `className` | `string?` | 自定义容器类名 |

**单条记录的信息分层**（v4.3.2 起丰富）：

1. **第一行（主标签行）**：
   - 类型名（喂养/睡眠/换尿布/体温/生长）
   - 关键指标徽章（pill，`color-mix 12%` 底色 + 类型色文字 + `number-display` 等宽数字）
     - 喂养：`120ml` / `左侧 · 15分` / `辅食`
     - 睡眠：`1小时30分` 或 `夜间`/`午睡`（无时长时）
     - 换尿布：`尿` / `便` / `尿+便`
     - 体温：`37.2°C`（≥38 使用 `--danger`，≥37.5 使用 `--warning`，其他 `--temperature`）
     - 生长：`9.2kg` / `72.5cm` / `头围45cm`
   - 体温告警副标签：`低烧` / `发烧`（仅 ≥37.5 时出现）
   - 右侧时间（`HH:mm`，等宽数字）
2. **第二行（摘要）**：复用 `getRecordSummary(record)`，与记录页保持一致。
3. **第三行（辅助信息，条件出现）**：
   - ⏱ `持续 1小时30分`：仅当记录有 `endTime` 时展示（调用 `formatDuration`）
   - 👤 创建者昵称：仅当 `creator.id !== currentUserId` 时展示（家庭协作场景突出"由谁记录"）
   - 💬 备注：若有 `note` 则截断显示

**颜色规范**：徽章与图标严格复用类型色 CSS 变量（`--feeding / --sleep / --diaper / --temperature / --growth`），禁止使用硬编码色值；异常状态仅使用 `--danger` / `--warning`。

**使用范围**：目前仅首页「今日时间线」使用（展示最近 5 条）。记录页（`/record`）有独立的分组 + 可操作卡片布局，不共用此组件。

### 2.7 布局级改动（P2）

**MainLayout（`app/layout/main-layout.tsx`）**：
- 桌面 Sidebar 底部新增内联 `SidebarBabyCard`（当前宝宝头像 + 昵称 + 年龄 + 切换下拉），点击切换后自动 invalidate `todayStats / records / activeSleep` 查询。
- 内容区底部统一渲染 `<Footer>`（ICP / 公安备案链接），桌面端和移动端都显示；移动端依靠 `pb-16` 留出 TabBar 空间。

**Profile 页**：
- 移除原「主题模式」卡片（主题设置收敛到 Settings → Appearance）。
- 用户卡头像放大到 64px，增加"当前宝宝 + 家庭"双 pill 标签。
- 快捷入口由 4 张独立 `card-interactive` 改为单张分组 Cell 卡片（iOS 设置风格），减少视觉噪声。

**TodaySummary 字号基线统一**：
- 4 列数字统一 `text-2xl` + `font-bold`，外层容器 `min-height: 32px` 保证基线对齐。
- 移除原 `isText ? text-2xl : text-3xl` 的分支切换（该字段仍在 items 对象中保留但未使用，后续清理）。

**AI 助手气泡**：
- 气泡圆角加大到 18px，仅保留指向对话方向的 4px 尖角。
- 暖夜模式下 AI 气泡改用 `color-mix(--primary 6%, --bg-card)` 提升对比度（原 `--bg-secondary` 几乎不可见）。
- 每条消息下方显示时间戳（同日 `HH:mm`，跨日 `M月D日 HH:mm`）；消息 VM 新增 `ts?: number` 字段，但发送给后端时会剥离（只保留 `role/content`）。
- `localStorage` 历史上限由 100 → 50 条。

### 2.8 P3 改动

**发现页趋势差异化**：
- 发现页 `<InsightSection>` 替换为 `<WeeklyTrendOverview>`。前者是"细节视角"（每维度独立卡 + 范围条 + 环比 + 提示），后者是"总览视角"（单卡 4 列 + 异常高亮 + 跳详情）。记录页保留 `<InsightSection>`。
- 设计意图：避免发现页与记录页信息重复，给用户清晰的层次（发现 = 全局概览，记录 = 数据细节）。

**Dialog 底层迁移到 radix-ui**：
- 依赖新增 `@radix-ui/react-dialog`；自建 `<Dialog>` 内部完全基于 `DialogPrimitive.Root/Portal/Overlay/Content/Title/Close/Description`。
- 对外 API 100% 向后兼容（open / onClose / title / icon / accentColor / size / footer / showDragIndicator / dismissOnBackdrop / children），业务代码零改动。
- 新增能力：自动 `aria-labelledby` / `aria-describedby`、inert 背景、return-focus、Portal 渲染、更稳健的 escape/outside-click 管理。

**记录列表无限滚动**：
- `pages/record/index.tsx` 从手写 `useState(page, records, hasMore) + IntersectionObserver + loadRecords(pageNum, append)` 迁移到 `useInfiniteQuery`。
- 删除走 `queryClient.setQueryData` 乐观更新；create/update 走 `refetch()` 重拉第一页。
- `hasNextPage` 来源改为后端 `PaginatedResponse.hasMore`，解决"正好一满页临界触发空请求"的旧 bug。
- 列表末尾新增"— 没有更多了 —"静止尾巴。

**生长页 SVG 文本字号修复**：
- `<text className="text-[8px]">` / `text-[7px]` 在 SVG 元素上 Tailwind class 不生效，改为 SVG 原生 `fontSize="9"` / `"8"` 属性，图表刻度与百分位 label 实际渲染与设计值一致。

**Milestone 推荐抽屉 category 文案**：
- `<span>{m.category}</span>` 渲染的是中文全称（如"大运动 Gross Motor"），在 10px 小 pill 里会截断。改为 `getCategoryLabel(m.categoryKey)` 返回的精简中文。

## 3. 家庭协作组件（client/src/components/family/）

| 组件 | 文件 | 说明 |
|------|------|------|
| `<MembersSection>` | `family/members-section.tsx` | 成员列表 + 三点菜单（admin 可见） |
| `<InviteSection>` | `family/invite-section.tsx` | 邀请码 + 倒计时 + 复制/分享/刷新 |
| `<RoleEditDialog>` | `family/role-edit-dialog.tsx` | 修改成员权限（RadioGroup 三选一） |
| `<TransferAdminDialog>` | `family/transfer-admin-dialog.tsx` | 转让管理员（含 leaveFamily 状态机分支） |
| `<RemoveMemberConfirm>` | `family/remove-member-confirm.tsx` | 移除成员（输入「确认移除」字样） |

## 3A. 记录类 Dialog（client/src/components/）

5 个记录 Dialog 共享统一的 props 形状与 `<Dialog>` + `<DialogFooter>` 结构：

| 组件 | 文件 | 记录类型 |
|------|------|---------|
| `<FeedingDialog>` | `feeding-dialog.tsx` | `feeding` |
| `<SleepDialog>` | `sleep-dialog.tsx` | `sleep` |
| `<DiaperDialog>` | `diaper-dialog.tsx` | `diaper` |
| `<TemperatureDialog>` | `temperature-dialog.tsx` | `temperature` |
| `<GrowthDialog>` | `growth-dialog.tsx` | `growth` |

**公共 Props 形状**：

```typescript
interface RecordDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (
    data: DialogSpecificData,
    meta: { recordTime: string; editingId?: string },
  ) => void | Promise<void>
  /** 传入已有记录时进入编辑模式 */
  editRecord?: CareRecord
}
```

**行为约定**：
- 所有 Dialog 内部维护 `recordTime` 状态（`<input type="datetime-local">`），默认当前时间；编辑模式用 `editRecord.startTime` 回填。
- 父组件通过 `useDialog<CareRecord>()` 的 `openDialog(record?)` 传入 `editRecord`；新建时不传参。
- 父组件在 `onSubmit` 内部根据 `meta.editingId` 分流 `recordService.createRecord` / `updateRecord`。
- 主按钮颜色统一 `var(--primary)`；Dialog 顶部图标与表单内 SegmentedControl 通过 `accentColor` 承载类型色。

**单 Dialog 增强**（v4.3.x P1）：

- `TemperatureDialog`：除数字输入外，新增 `<input type="range" min=35 max=42 step=0.1>` 滑块，数字与滑块双向绑定；`accentColor` 随发烧等级（正常/低烧/高烧）切换。
- `FeedingDialog` 配方奶快捷用量：新增「设值 / 累加」双模式（顶部 mini Tab 切换，默认「设值」）。「设值」点击即覆盖、「累加」点击叠加，解决"无法直接设 100ml"的痛点。
- `SleepDialog` **强制写 endTime**（v4.3.2 fix）：dialog 提交永远视为"已结束的睡眠"，内部自动计算 `endTime = startTime + duration*1000`，并通过 `RecordDialogMeta.endTime` 传给父组件转发到顶级 `endTime` 字段。这样可避免被服务端 `endTimeIsNull=true` 误判为"进行中睡眠"。"开始/结束实时计时"请使用 `<TodaySummary>` 睡眠卡片或 `<StatusCapsule>`，而不是 `SleepDialog`。

## 4. 新增 Hooks（client/src/hooks/）

| Hook | 文件 | 用途 |
|------|------|------|
| `useActiveSleep(babyId)` | `use-active-sleep.ts` | 进行中睡眠 React Query 包装；start/end/cancel 三动作均经 PermissionGuard |
| `useWeeklyTrend(babyId)` | `use-weekly-trend.ts` | 本周趋势 React Query 包装（60s staleTime） |
| `useLocalStorageState(key, default)` | `use-local-storage-state.ts` | localStorage 持久化的 React state；跨 tab 同步 |
| `useDialog<T>()` | `use-dialog.ts` | 弹窗开关；`openDialog(payload?)` 可携带 payload（编辑模式下的 CareRecord），`closeDialog` 自动清空 |
| `useConfirm()` | `components/ui/confirm-dialog.tsx` | 全局 Promise 式确认弹窗；`confirm(options): Promise<boolean>` |

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
| `getRecordSummary(record)` / `getRecordDetails(record)` / `getRecordTypeLabel(type)` | `record.ts` | 记录展示工具：`getRecordSummary` 返回单行摘要文本；`getRecordDetails` 返回结构化的 `{ key, value }[]`，记录页卡片用其渲染详情标签组（地点 / 部位 / 性状 / 颜色 / 体温分级等） |

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
