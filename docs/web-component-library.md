# Web 版组件库（v5.0.0 alpha 新增组件）

> 版本：v7.1 | 日期：2026-05-09
>
> 本文档列出 Web 版本期新增的组件、hooks、lib 和 service 方法。
> 小程序版组件库请参考根目录 [`component-library.md`](../component-library.md)。

---

## 🆕 v7.1 增量（2026-05-09）

Profile 页紧凑布局修复 + RadioGroupCard 能力增强：

- **`<RadioGroupCard>` 新增 `hideIndicator` / `orientation` 两个 prop**：
  - `hideIndicator`：隐藏右侧/底部圆点，选中态改用左上角 ✓ 角标，解决紧凑网格下圆点贴边/溢出问题
  - `orientation='vertical'`：卡片纵向布局（icon 上、文案下、整体居中），适合"大 icon 预览 + 短 label"场景
  - 同时给 `label` 加 `truncate`、`description` 加 `line-clamp-2`（横向）/ `line-clamp-1`（纵向），防止文案撑爆主轴
- **`<ThemeSelector>` 启用 `hideIndicator`**：3 列布局下不再有右侧贴边圆点；gap 由 2 升级为 sm:2.5
- **`<FontScaleSelector>` 改为纵向卡片 + `hideIndicator`**：A 字号预览居中显示，label/desc 在下方，4 列布局舒展无溢出
- **`ProfilePage`「账户与数据」icon 容器加 `shrink-0`**：修复 `value` 长（如 `testfamily`）时 32×32 图标盒被 squeeze 变成横向椭圆的问题

---

## 🆕 v7.0 新增（2026-05-08）

iOS Health × 美拉德 大重构带来的新原子组件、新动画 lib：

### 新原子组件

| 组件 | 文件 | 用途 | 关键 Props |
|------|------|------|-----------|
| `<LargeTitleHeader>` | `ui/large-title-header.tsx` | 页面顶部 iOS 大标题（替代 PageHeader） | `title / subtitle / variant: large \| nav / backTo: string \| 'back' / rightAction` |
| `<HeaderLink>` | 同文件子组件 | nav header 内的链接按钮 | `to / children` |
| `<SectionHeader>` | `ui/section-header.tsx` | 段标题 | `title / subtitle / action / variant: default \| prominent \| grouped` |
| `<ListRow>` | `ui/list-row.tsx` | iOS Settings 风列表项 | `leading / title / subtitle / value / trailing / accentColor / interactive / onClick` |

### 新增动画预设（`lib/motion.ts`）

```ts
import {
  spring, springSoft, springPop,        // 三档 spring 强度
  pageTransition,                        // 页面切换
  staggerContainer, staggerItem, staggerCompact, // 列表 stagger
  cardEnter,                            // 卡片入场
  sheetMobile, sheetDesktop, overlayFade, // Dialog/Sheet 动画
  pressable, pressableSubtle,           // 按压
  easeIOS,                              // iOS 标准缓动 cubic-bezier
} from '@/lib/motion'
```

### v7 升级的 UI Primitive

| 组件 | 新 variants | 兼容旧 variants |
|------|-------------|----------------|
| `<Button>` | `filled / tinted / plain / secondary / destructive / destructive-plain` + 自带 `whileTap={scale:0.96}` | `primary` → 映射到 `filled`；`danger` → `destructive`（继续可用） |
| `<Card>` | `plain / elevated / interactive / hero / tinted / cta` | `glass / gradient-header / accent` 已**废弃**（不要在新代码中使用） |
| `<Badge>` | 全部走 `--*-bg` + `--*-fg`（暖调），新增 `tone: tinted \| filled \| filled-solid \| outline` | 兼容 |
| `<Input>` | iOS 风：浅灰底 + focus 变白底 + 外阴影（不再有左色条） | 兼容 |
| `<Dialog>` | 动画由 framer-motion 接管（spring slide-up / scale） | 兼容 |
| `<SegmentedControl>` | `layoutId` spring 滑动指示器 | 兼容 |

### v7 重写的业务组件

`today-summary.tsx`（2×2 tinted 卡片 + metric-lg 大数字）、`status-capsule.tsx`（Hero radius-xl + tinted bg + 呼吸 icon）、`timeline.tsx`（ListRow 风 + 左色条）、`focus-card.tsx`（tinted Hero）、`quick-record-bar.tsx`（**新增**，5 个彩色圆按钮快捷条）。

### v7 全部页面落地

✅ Pilot home + Batch A（login/register/auth-layout/record/discover/profile）+ Batch B（ai-assistant/report/growth/settings）+ Batch C（vaccine/milestone/jaundice/baby/family）

详细设计语言、Token 速查、骨架模板见 [`web-ui-spec.md`](./web-ui-spec.md) 顶部 v7 章节，以及 [`web-ui-refactor-v7-cheatsheet.md`](./web-ui-refactor-v7-cheatsheet.md)。

---

## 1. 新增 UI 通用组件（client/src/components/ui/）

### 1.A shadcn 风格 Primitives（v5.0.1 新增）

> **背景**：旧版组件库里 `.btn-primary / .input-base / .card / .badge-mini / .icon-btn` 等样式定义在 `globals.css`，但**组件层没有抽象**，导致 JSX 中充满散装 Tailwind 字符串（`inline-flex items-center gap-1.5 rounded-md h-8 px-3 text-xs text-white` 在 7 处重复）。v5.0.1 引入 **shadcn 设计模式 + 自研实现 + CVA** 方案，建立 16 个 Primitive 组件作为整个 UI 层的原子。
>
> **硬性规则**：新代码**必须**使用以下 Primitive 组件；旧的 CSS 类（`.btn-primary` 等）进入过渡期并标记 `@deprecated`，计划在 Batch 4 收尾阶段从 JSX 中清除。

#### Batch 1（基础原子 · 9 个）

| 组件 | 文件 | 对标 shadcn | 关键 Variants |
|------|------|-------------|---------------|
| `<Button>` | `ui/button.tsx` | `button` | `variant: primary / secondary / ghost / outline / danger / danger-outline / link / gradient-primary / gradient-feeding / gradient-sleep / gradient-diaper / gradient-temperature / gradient-growth / glass` × `size: xs / sm / md / lg / icon` + `loading / leftIcon / rightIcon / block / active / accentColor` |
| `<IconButton>` | `ui/icon-button.tsx` | `button size=icon` | `variant: ghost / danger-ghost / primary-ghost` × `size: xs / sm / md` |
| `<Input>` | `ui/input.tsx` | `input` | `variant: default / warning / danger` × `size: sm / md / lg` + `leftIcon / rightIcon / wrapperClassName / accentColor`（v6.0：focus 时左侧 3px 色条，spring 缓动动画） |
| `<Textarea>` | `ui/textarea.tsx` | `textarea` | `variant × size` + `autoResize?: boolean` |
| `<Label>` | `ui/label.tsx` | `label` | `required?: boolean`（自动加红 `*`） |
| `<FormField>` | `ui/form-field.tsx` | form 组合 | `label / htmlFor / required / error / hint`；`<Label> + control + <message>` 三段布局 |
| `<Card>` + `<CardHeader/Title/Description/Content/Footer>` | `ui/card.tsx` | `card` | `variant: default / interactive / ghost / accent / glass / gradient-header` × `padding: none / sm / md / lg` + `accentColor`（accent 左侧 3px 色条）+ `gradientColor`（v6.0：gradient-header 顶部 3px 渐变色条，值如 `var(--gradient-primary)`） |
| `<Badge>` | `ui/badge.tsx` | `badge` | `variant: default / primary / feeding / sleep / diaper / temperature / growth / success / warning / danger / info / outline / ghost / gradient-primary / gradient-feeding / gradient-sleep / gradient-diaper / gradient-temperature / gradient-growth / glass` × `size: xs(10px) / sm(12px) / md` + `interactive / icon / accentColor` |
| `<Separator>` | `ui/separator.tsx` | `separator` (radix) | `orientation: horizontal / vertical` × `variant: solid / dashed / light` + `label?: ReactNode`（水平分隔线中间文字） |

#### Batch 2（表单 & 菜单 · 7 个）

| 组件 | 文件 | 对标 shadcn | 关键 Variants / API |
|------|------|-------------|--------------------|
| `<Switch>` | `ui/switch.tsx` | `switch` (radix) | `size: sm / md`；受控 `checked` + `onCheckedChange` |
| `<RadioGroup>` + `<RadioGroupItem>` / `<RadioGroupCard>` | `ui/radio-group.tsx` | `radio-group` (radix) | `RadioGroupItem` 原始圆点；`RadioGroupCard` 卡片式（`label / description / icon / accentColor / checkedAdornment / hideIndicator / orientation`），用于 RoleEditDialog / TransferAdminDialog / ThemeSelector / FontScaleSelector |
| `<Slider>` | `ui/slider.tsx` | `slider` (radix) | `min / max / step / value / onValueChange`；`accentColor`；`showLabels: { left, center, right }` 三段刻度 |
| `<Progress>` + `<RangeIndicator>` + `<WeeklyRangeBar>` | `ui/progress.tsx` | `progress` (radix) | `<Progress>` 条形；`<RangeIndicator>` 均匀区间点位；`<WeeklyRangeBar>` 非均匀参考范围条（中央 60% 绿色正常区 + 低/高 0~20% 和 80~100% 映射，Batch 3 合并原 `<RangeBar>`） |
| `<Alert>` + `<AlertTitle>` + `<AlertDescription>` | `ui/alert.tsx` | `alert` | `variant: info / primary / success / warning / danger` × `size: compact / md` + `icon?: ReactNode` |
| `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>` | `ui/popover.tsx` | `popover` (radix) | `PopoverContent.padding: none / sm / md` + `side / align / sideOffset`；自带 Portal / ESC / 外部点击关闭 / focus trap |
| `<DropdownMenu>` + 子组件 | `ui/dropdown-menu.tsx` | `dropdown-menu` (radix) | `<DropdownMenuContent align sideOffset>` + `<DropdownMenuItem variant="default \| danger">` + `<DropdownMenuItemIcon accentColor>` + `<DropdownMenuItemText title description>` + `<DropdownMenuSeparator>` + `<DropdownMenuLabel>` |

#### Batch 3（数据展示 · 3 个）

| 组件 | 文件 | 对标 shadcn | 关键 Variants / API |
|------|------|-------------|--------------------|
| `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` | `ui/tabs.tsx` | `tabs` (radix) | `variant: underline（默认）/ pill`；radix 自带 ← → 键盘导航、自动 `role="tab/tabpanel"` |
| `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` + **`<BabyAvatar>`** + **`<UserAvatar>`** | `ui/avatar.tsx` | `avatar` (radix) | `size: xs(24) / sm(32) / md(40) / lg(48) / xl(64)` × `bordered`；**快捷封装** `<BabyAvatar baby>` 按 gender 自动配色 + 名字首字 fallback；`<UserAvatar user>` 昵称 + avatar 组合 |
| `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` + `<TooltipProvider>` | `ui/tooltip.tsx` | `tooltip` (radix) | Provider 挂在 App 根部；默认 300ms 延迟；键盘 focus 时也显示 |

#### Batch 4（收尾 · 3 个）

| 组件 | 文件 | 对标 shadcn | 关键 Variants / API |
|------|------|-------------|--------------------|
| `<Checkbox>` | `ui/checkbox.tsx` | `checkbox` (radix) | `size: sm / md`；支持 `indeterminate` 三态；键盘 Space 切换 |
| `<Sheet>` + `<SheetContent>` + `<SheetHeader/Title/Description>` + `<SheetBody>` + `<SheetFooter>` + `<SheetTrigger>` + `<SheetClose>` | `ui/sheet.tsx` | `sheet` (radix-dialog 底座) | `side: right(默认) / left / top / bottom` × `size: sm / md / lg`；**与 Dialog 区别**：Sheet 在所有断点都是侧滑/底部滑出，用于桌面端右侧抽屉 / 左侧导航抽屉 |
| `<ScrollArea>` | `ui/scroll-area.tsx` | `scroll-area` (radix) | 把原生 scrollbar 统一为美拉德细滚动条；A11y 友好；必须外层有固定高度 |

### 1.A.7 v6.0 UI 重构新增

#### NumberRoll 数字滚动组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `<NumberRoll>` | `components/number-roll.tsx` | 数字从 0 滚动到目标值的动画组件，使用 `requestAnimationFrame` + `easeOutCubic` 缓动 |

```tsx
import { NumberRoll } from '@/components/number-roll'

// 基础用法（默认 800ms 动画时长）
<NumberRoll value={42} />

// 自定义时长
<NumberRoll value={stats.achieved} duration={1200} />
```

**Props**：
| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `number` | 必填 | 目标数字 |
| `duration` | `number` | `800` | 动画时长（ms） |
| `className` | `string?` | — | 外层容器类名 |

**使用场景**：TodaySummary 4 格大数字、ReportMetricsGrid 关键指标、MilestonePage 统计卡片。

**实现原理**：组件首次渲染时从 0 开始，通过 `requestAnimationFrame` 逐帧递增到 `value`，缓动函数 `easeOutCubic(t) = 1 - (1-t)^3` 使动画末尾减速，视觉更自然。后续 `value` 变化时不重新触发动画（仅首次挂载时执行）。

#### Card gradient-header / glass 变体（v6.0）

```tsx
// gradient-header：顶部 3px 渐变色条（borderImage 实现）
<Card variant="gradient-header" gradientColor="var(--gradient-feeding)" padding="md">
  ...
</Card>

// glass：玻璃态（半透明背景 + backdrop-filter 模糊 + 毛玻璃边框）
<Card variant="glass" padding="md">
  ...
</Card>

// 自定义色条宽度（默认 3px）
<Card variant="gradient-header" gradientColor="var(--gradient-primary)" accentWidth={5} padding="md">
  ...
</Card>
```

**新增 Props**（Card 组件）：
| 名称 | 类型 | 说明 |
|------|------|------|
| `gradientColor` | `string?` | 渐变色值（如 `var(--gradient-primary)`），仅 `variant="gradient-header"` 时生效 |
| `accentWidth` | `number \| string?` | 色条宽度（默认 3px），对 accent 和 gradient-header 变体均生效 |

#### Button gradient-* / glass 变体（v6.0）

```tsx
// 渐变按钮（6 种语义渐变 + primary）
<Button variant="gradient-primary" size="sm">保存</Button>
<Button variant="gradient-feeding" size="xs">喂养</Button>
<Button variant="gradient-sleep">睡眠</Button>
<Button variant="gradient-growth">生长</Button>

// 玻璃态按钮
<Button variant="glass">取消</Button>
```

**渐变 Variant 列表**：`gradient-primary` / `gradient-feeding` / `gradient-sleep` / `gradient-diaper` / `gradient-temperature` / `gradient-growth`

**Glass Variant**：`background: var(--glass-bg)` + `backdrop-filter: var(--glass-blur)` + `border: 1px solid var(--glass-border)`

#### Badge gradient-* / glass 变体（v6.0）

与 Button 渐变变体一致，Badge 也新增了 6 种 `gradient-*` 变体和 `glass` 变体。

```tsx
<Badge variant="gradient-feeding" size="xs">喂养·3</Badge>
<Badge variant="glass" size="sm">标签</Badge>
```

#### Dialog glass prop（v6.0）

```tsx
<Dialog open={open} onClose={onClose} title="AI 总结" glass>
  ...
</Dialog>
```

启用 `glass` prop 后，Dialog 内容区域采用玻璃态效果：`backdrop-filter: var(--glass-blur)` + `background: var(--glass-bg)` + `border: 1px solid var(--glass-border)`。

#### Input accentColor prop 增强（v6.0）

Input 的 `accentColor` prop 新增左侧 3px 色条 + spring 缓动动画效果。focus 时色条以 spring 缓动从 0 宽度展开到 3px。

### 1.A.1 用法示例（Batch 1）

#### Button

```tsx
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

// 等价于旧 HeaderAction variant="primary"
<Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={...}>
  添加
</Button>

// Loading + block
<Button loading={isSubmitting} block size="md">保存</Button>

// Ghost + active（等价旧 HeaderAction variant="ghost" active）
<Button variant="ghost" size="sm" active={showFilter} leftIcon={<Calendar />}>
  筛选
</Button>

// 自定义 accentColor（例如生长页使用 var(--growth) 主色）
<Button variant="primary" accentColor="var(--growth)" leftIcon={<Plus />}>
  记录
</Button>
```

#### FormField + Input

```tsx
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Mail } from 'lucide-react'

<FormField label="邮箱" htmlFor="email" required error={errors.email}>
  <Input
    id="email"
    type="email"
    leftIcon={<Mail className="h-4 w-4" />}
    autoComplete="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</FormField>

// 体温 Dialog 中"发烧预警"场景：
<Input
  type="number"
  step="0.1"
  variant={isHighFever ? 'danger' : isFever ? 'warning' : 'default'}
  rightIcon={<span className="text-xs">°C</span>}
  value={temperature}
  onChange={...}
/>
```

#### Card 组合

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

// default
<Card>
  <CardHeader>
    <div>
      <CardTitle>本周喂养</CardTitle>
      <CardDescription>基于最近 7 天记录</CardDescription>
    </div>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// accent（替代旧 .card-base--accent-left）
<Card variant="accent" accentColor="var(--feeding)" padding="md">
  ...
</Card>

// interactive（替代旧 .card-interactive）
<Card variant="interactive" as="article" onClick={...}>
  ...
</Card>
```

#### Badge

```tsx
import { Badge } from '@/components/ui/badge'

// xs 等价旧 .badge-mini
<Badge variant="feeding" size="xs">喂养·3</Badge>
<Badge variant="danger" size="xs">2 项逾期</Badge>
<Badge variant="outline" size="xs">自费</Badge>

// interactive（用于 NoteTagPicker 标签 toggle）
<Badge variant="primary" size="sm" interactive aria-pressed={selected} onClick={toggle}>
  #吃得多
</Badge>

// 自定义 accentColor（不在枚举 variant 里）
<Badge accentColor="#7BC950" size="xs">新记录</Badge>
```

### 1.A.2 用法示例（Batch 2）

#### Switch

```tsx
import { Switch } from '@/components/ui/switch'

<Switch size="sm" checked={rememberMe} onCheckedChange={setRememberMe} aria-label="记住我" />

// 搭配 Label 组合成完整开关行
<label className="flex items-center gap-2.5 text-sm cursor-pointer">
  <Switch checked={enabled} onCheckedChange={setEnabled} />
  <span>启用通知</span>
</label>
```

#### RadioGroup + RadioGroupCard（卡片式单选）

```tsx
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Shield, Edit, Eye } from 'lucide-react'

<RadioGroup value={role} onValueChange={setRole}>
  <RadioGroupCard
    value="admin"
    label="管理员"
    description="所有权限：管理成员、记录、宝宝档案"
    icon={<Shield className="h-4 w-4" />}
    accentColor="var(--primary)"
  />
  <RadioGroupCard
    value="editor"
    label="成员"
    description="可添加 / 编辑 / 删除自己创建的记录"
    icon={<Edit className="h-4 w-4" />}
    accentColor="var(--primary)"
  />
  <RadioGroupCard
    value="viewer"
    label="仅查看"
    description="只能查看记录，不能修改任何数据"
    icon={<Eye className="h-4 w-4" />}
    accentColor="var(--primary)"
  />
</RadioGroup>

// 原始圆点（非卡片）用 <RadioGroupItem>：
<RadioGroup value={value} onValueChange={setValue}>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="a" id="a" />
    <label htmlFor="a">选项 A</label>
  </div>
</RadioGroup>
```

**Props 速查（v7.1）**：

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `ReactNode` | — | 主标题；窄列下自动 `truncate` |
| `description` | `ReactNode?` | — | 副描述；横向布局自动 `line-clamp-2`，纵向布局 `line-clamp-1` |
| `icon` | `ReactNode?` | — | 左侧（横向）/ 上方（纵向）图标 |
| `accentColor` | `string?` | `var(--primary)` | 选中态强调色；同时贯穿 ✓ 角标背景与圆点指示器 |
| `checkedAdornment` | `ReactNode?` | — | 替代右侧圆点的自定义指示器（仅 checked 时显示） |
| `hideIndicator` | `boolean?` | `false` | **v7.1 新增**：隐藏右侧/底部圆点指示器，选中态改用左上角 ✓ 角标。适合**紧凑网格**（3/4 列窄列）场景，避免圆点贴边/溢出 |
| `orientation` | `'horizontal' \| 'vertical'?` | `'horizontal'` | **v7.1 新增**：卡片内布局方向。`'vertical'` = icon 上 / label 中 / desc 下，整体居中。适合"短 label + 大 icon 预览"场景（如字体档位 A 字号预览） |

**典型场景对照**：

```tsx
// 1) 对话框 / 舒展宽度（默认横向 + 圆点）
<RadioGroupCard label="管理员" description="..." icon={<Shield />} />

// 2) 3 列紧凑网格（如 ThemeSelector 亮色/暖夜/跟随系统）
<RadioGroupCard
  label="跟随系统"
  description="根据系统外观自动切换"
  icon={<Monitor className="h-5 w-5" />}
  hideIndicator   // ← 隐藏圆点，避免在窄列下贴边
/>

// 3) 4 列纵向卡片（如 FontScaleSelector 字号档位）
<RadioGroupCard
  label="特大"
  description="适合老年人"
  orientation="vertical"     // ← icon 居中、label/desc 在下
  hideIndicator              // ← 选中态用左上角 ✓ 角标
  icon={<span style={{ fontSize: 30 }}>A</span>}
/>
```

**视觉规则**：
- `hideIndicator=false`（默认）：右侧渲染 16×16 圆点指示器（未选时空心 border、选中时实心 accentColor）
- `hideIndicator=true`：圆点完全消失，左上角出现 16×16 圆形 ✓ 角标（accentColor 背景 + 白色 ✓），叠加卡片底色 + 边框双重视觉，**未选 → 选中过渡有 150ms scale + opacity 动画**
- 卡片整体永远有 `border + bg-primary` 兜底，选中态切换为 `border-accentColor + bg(accent 8%)`

#### Slider（带三段刻度）

```tsx
import { Slider } from '@/components/ui/slider'

<Slider
  min={35}
  max={42}
  step={0.1}
  value={[temperature]}
  onValueChange={([v]) => setTemperature(v)}
  accentColor={isFever ? 'var(--warning)' : 'var(--temperature)'}
  showLabels={{ left: '35.0', center: '正常 36-37.2', right: '42.0' }}
/>
```

#### Progress + RangeIndicator

```tsx
import { Progress, RangeIndicator } from '@/components/ui/progress'

// 条形进度（TodaySummary 4 格 / QuotaBar）
<Progress value={42} max={100} accentColor="var(--feeding)" size="sm" />

// 范围指示器（WHO 百分位 / 生长趋势）
<RangeIndicator
  min={0} max={100} value={65}
  normalRange={[25, 75]}
  accentColor="var(--growth)"
  label="体重百分位"
/>
```

#### Alert

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Info } from 'lucide-react'

// 单行紧凑（替代旧 .notice-info）
<Alert variant="info" size="compact" icon={<Info className="h-3.5 w-3.5" />}>
  仅您本人可见的观察记录
</Alert>

// 多行带标题
<Alert variant="danger" size="md" icon={<AlertTriangle className="h-4 w-4" />}>
  <AlertTitle>删除后不可恢复</AlertTitle>
  <AlertDescription>此操作将移除该成员及其创建的所有记录。</AlertDescription>
</Alert>
```

#### DropdownMenu

```tsx
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemText,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="primary" size="sm" leftIcon={<Plus />}>添加</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => onPick('feeding')}>
      <DropdownMenuItemIcon accentColor="var(--feeding)">
        <Baby className="h-3.5 w-3.5" />
      </DropdownMenuItemIcon>
      <DropdownMenuItemText title="喂养" description="母乳 / 配方奶 / 辅食" />
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="danger" onSelect={handleDelete}>
      <Trash2 className="h-3.5 w-3.5" />
      <span>删除</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**约定**：
- Trigger 必须 `asChild` 包裹目标 Button / IconButton，不要让 DropdownMenuTrigger 渲染 `<button>` 外层 DOM。
- `onSelect` 不带事件对象；若需要阻止默认关闭行为（例如打开另一个 Dialog），调用 `e.preventDefault()`（radix 会把事件对象传入）。
- 菜单项带 icon + 主/副文字时使用 `<DropdownMenuItemIcon>` + `<DropdownMenuItemText>` 标准组合。

### 1.A.3 用法示例（Batch 3）

#### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// underline 默认（记录页类型筛选、设置 Tab 切换）
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="profile">资料</TabsTrigger>
    <TabsTrigger value="password">密码</TabsTrigger>
    <TabsTrigger value="export">导出</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">…</TabsContent>
  <TabsContent value="password">…</TabsContent>
</Tabs>

// pill（次级 Tab，如报告页周/月切换）
<Tabs value={period} onValueChange={v => setPeriod(v as 'week' | 'month')}>
  <TabsList variant="pill">
    <TabsTrigger variant="pill" value="week">本周报告</TabsTrigger>
    <TabsTrigger variant="pill" value="month">本月报告</TabsTrigger>
  </TabsList>
</Tabs>
```

#### Avatar / BabyAvatar / UserAvatar

```tsx
import { Avatar, AvatarImage, AvatarFallback, BabyAvatar, UserAvatar } from '@/components/ui/avatar'

// 组合式（灵活）
<Avatar size="lg" bordered>
  <AvatarImage src={user.avatar} alt={user.nickname} />
  <AvatarFallback bgColor="var(--primary)">W</AvatarFallback>
</Avatar>

// 快捷式：宝宝（自动按 gender 着色：女=temperature / 男=growth）
<BabyAvatar baby={currentBaby} size="md" bordered />

// 快捷式：家庭成员 / 用户
<UserAvatar user={{ nickname: '妈妈', avatar: '...' }} size="lg" />
```

#### Tooltip

```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

<Tooltip>
  <TooltipTrigger asChild>
    <IconButton variant="ghost" icon={<Trash2 className="h-4 w-4" />} aria-label="删除" />
  </TooltipTrigger>
  <TooltipContent>删除记录</TooltipContent>
</Tooltip>
```

**前提**：`<TooltipProvider>` 已在 `app/App.tsx` 根部挂载，业务组件只需直接使用 `<Tooltip>`。

### 1.A.4 用法示例（Batch 4）

#### Checkbox

```tsx
import { Checkbox } from '@/components/ui/checkbox'

<label className="flex items-center gap-2">
  <Checkbox checked={agreed} onCheckedChange={setAgreed} />
  <span className="text-sm">我已阅读并同意用户协议</span>
</label>

// 三态
<Checkbox
  checked={someChecked ? (allChecked ? true : 'indeterminate') : false}
  onCheckedChange={handleToggleAll}
/>
```

#### Sheet（侧边/底部抽屉）

```tsx
import {
  Sheet, SheetTrigger, SheetContent,
  SheetHeader, SheetTitle, SheetBody, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" size="md">
    <SheetHeader>
      <SheetTitle>高级筛选</SheetTitle>
    </SheetHeader>
    <SheetBody>
      {/* 长表单 */}
    </SheetBody>
    <SheetFooter>
      <Button variant="secondary" block onClick={() => setOpen(false)}>取消</Button>
      <Button block onClick={onApply}>应用</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**与 `<Dialog>` 的区别**：Dialog 桌面端居中弹窗（移动端退化 bottom sheet）；Sheet 在**所有断点都是侧滑/底部滑出**，适合桌面端右侧抽屉、左侧导航。

#### ScrollArea

```tsx
import { ScrollArea } from '@/components/ui/scroll-area'

<ScrollArea className="h-72 w-full">
  <div className="p-4 space-y-2">
    {items.map(item => <div key={item.id}>{item.title}</div>)}
  </div>
</ScrollArea>
```

**注意**：外层 ScrollArea 必须有固定高度，否则不会出现滚动条。

### 1.A.5 v5.1.0 设计优化增补

#### 图标尺寸 5 档自动推导（lib/icon-size.ts）

所有 Primitive（`<Button>` / `<IconButton>` / `<Badge>` / `<Alert>`）自动根据组件 size 推导图标尺寸：

| Size token | 像素 | Tailwind | 对齐文本 |
|-----------|-----|----------|---------|
| `xs` | 12 | `h-3 w-3` | caption (11px) |
| `sm` | 14 | `h-3.5 w-3.5` | body-sm (13px) |
| `md` | 16 | `h-4 w-4` | body-md (15px) |
| `lg` | 20 | `h-5 w-5` | heading-md (17px) |
| `xl` | 24 | `h-6 w-6` | heading-lg+ (20px+) |

```tsx
// 用户不传尺寸 className → 自动注入
<Button size="md" leftIcon={<Plus />}>添加</Button>
// 等价于：<Button size="md" leftIcon={<Plus className="h-4 w-4" />}>

// 用户自己写了 className → 被尊重，不覆盖
<Button size="md" leftIcon={<Plus className="h-5 w-5" />}>大图标</Button>

// 显式 override（绕过推导）
<Button size="md" iconSize="lg" leftIcon={<Plus />}>特大图标</Button>
```

实现：`withIconSize(icon, size)` 只给"根元素没有 h-/w- className"的 icon 注入；lucide-react 所有图标符合此约定。

#### 字体 display-sm/md/lg + display-number（globals.css）

v5.1.0 引入"叙事 vs 数据 vs 交互"三级字体节奏：

| 类别 | 用途 | 类名 | 字号（md 档） |
|------|------|------|-------------|
| display-sm | 首页问候 / 报告封面 / 空态主标题 | `.display-sm` | 30px |
| display-md | 大型 CTA 卡 | `.display-md` | 38px |
| display-lg | 启动屏 / 巨型数据 | `.display-lg` | 48px |
| display-number | TodaySummary 4 格 / ReportMetricsGrid 大数字 | `.display-number` | 继承外层 + 负字距 + tabular-nums + slashed-zero |

4 档 font-scale 均已补齐 display token；切换字号档位自动生效。

#### Badge `tone` prop（soft / solid / outline）

```tsx
<Badge variant="danger" tone="soft">警告</Badge>      // 默认，14% 底色 + 类型色文字
<Badge variant="danger" tone="solid">3 项逾期</Badge> // 纯色底 + 白字 + 暖夜自动发光
<Badge variant="warning" tone="outline">低烧</Badge>  // 透明 + 1px 类型色边 + 类型色文字
```

- tone 仅对"类型色/语义色 variant"或 `accentColor` 场景生效
- `default / outline / ghost` variant 有固定视觉，tone 不作用
- 暖夜模式下 `tone="solid"` 自动获得 `box-shadow: 0 0 12px -4px currentColor` 微光

#### Badge xs 可读性（xl 档自动放大）

`:root[data-font-scale='xl'] .badge-xs` 自动从 10px → 12px，保证老年人场景可读。

#### Card `cta` variant

```tsx
<Card variant="cta" onClick={onAdd}>
  <Plus /> 添加宝宝开始记录
</Card>
```

虚线 border + 中心对齐 + hover 填充 `primary 4%` + focus-visible ring，适合"引导性空态 / 大型 CTA"。

#### Focus ring 双层

全局 `:focus-visible` 升级为：内 2px（容器同色）+ 外 4px（primary 40%）双层 box-shadow；暖夜模式自动增强到 60% 饱和。
组件内部已自定义 ring 的元素（Button / Input 等）通过 `box-shadow: revert` 取消兜底，避免重叠。

### 1.A.6 CVA 设计约定

所有 Primitive 遵循以下 CVA 结构，后续新增 Primitive 请保持一致：

```typescript
const xxxVariants = cva(
  'base-classes',
  {
    variants: { variant: {...}, size: {...}, ... },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface XxxProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof xxxVariants> { ... }

export const Xxx = forwardRef<..., XxxProps>((props, ref) => ...)
Xxx.displayName = 'Xxx'
export { xxxVariants }
```

- **`variants` 枚举外的颜色**：通过额外 prop `accentColor?: string` 传入 CSS 变量或 hex，组件内部用 inline `style.backgroundColor/color` 覆盖。禁止为每个可能的颜色都新增 variant 枚举项。
- **尺寸统一 4 档**：`xs(28) / sm(32) / md(40) / lg(48)`；`icon` 作为特例（h-9 w-9 保持视觉与 `sm` 协调）。
- **组件一律 `forwardRef`**：下游组件可能做 Popover/Tooltip 等 anchor 绑定，必须能拿到 ref。
- **`focus-visible:ring` 默认带**：保证键盘导航有可见焦点；不要依赖业务层补。

### 1.B 已有 UI 组件（保持不变）

| 组件 | 文件 | 说明 |
|------|------|------|
| `<Dialog>` + `<DialogFooter>` | `ui/dialog.tsx` | 响应式弹窗（基于 `@radix-ui/react-dialog`）：移动底部 sheet / 桌面居中；可选 sticky footer 和 size；内置 focus trap / inert 背景 / ESC / return focus；v6.0 新增 `glass` prop（启用玻璃态效果：backdrop-blur + 半透明背景 + 毛玻璃边框） |
| `<ConfirmHost>` + `useConfirm()` | `ui/confirm-dialog.tsx` | 全局 Promise 式确认弹窗，替代 `window.confirm` |
| `<Skeleton>` | `ui/skeleton.tsx` | 占位骨架（FR-A5） |
| `<ListSkeleton>` | `ui/list-skeleton.tsx` | 列表卡片骨架（首次加载列表型页面用） |
| `<ChartSkeleton>` | `ui/chart-skeleton.tsx` | 图表区骨架（生长曲线等） |
| `toast` + `<Toaster>` | `ui/toast.tsx` | 极简 Toast 实现（不依赖 sonner / radix） |
| `<SegmentedControl>` | `ui/segmented-control.tsx` | 通用分段控制（替代 tab / 单选 chip 组合） |

#### `<SegmentedControl>` API（v7.3）

| Prop | 类型 | 说明 |
|------|------|------|
| `value` | `T \| null` | 当前选中值；`null` 表示未选（仅 `toggleable` 或 `wrap`/`grid` 模式适用） |
| `onChange` | `(v: T) => void` | 选中变化回调；空字符串表示在 `toggleable=true` 下点击已选项再次取消 |
| `options` | `SegmentedOption<T>[]` | 选项数组，详见下表 |
| `accentColor` | `string` | 主题色（支持 CSS 变量），grid 模式下自动派生为 14% 透明背景 + 1px 描边 |
| `toggleable` | `boolean` | 选中后再次点击是否取消（默认 `false`） |
| `layout` | `'flex' \| 'wrap' \| 'grid'` | 布局：iOS 等宽分段 / 自由折行 chip / 网格化卡片（默认 `flex`） |
| `columns` | `2 \| 3 \| 4 \| 5` | **仅 `grid` 布局生效**，列数（默认 `4`） |
| `size` | `'sm' \| 'md' \| 'lg'` | 尺寸（默认 `md`） |

**`SegmentedOption<T>`**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `value` | `T` | 选项值（必填） |
| `label` | `string` | 选项主文案（必填） |
| `description` | `string` | **仅 `grid` 布局**：第二行小字描述（如温度参考范围、性状提示） |
| `swatch` | `string` | **仅 `grid` 布局**：左侧色点 CSS 颜色值（如尿布颜色用真实色块） |

**布局选用建议**：
- `flex`：互斥的 2–4 个等价选项（如喂养类型 配方奶/母乳/辅食）
- `wrap`：多个无附加信息的紧凑标签（如哺乳侧 左/右/两侧）
- `grid`：选项数较多、需要附带含义提示或视觉色块（如尿布性状/颜色、体温测量方式）；建议配合 `<Alert size="compact">` 给到选择后的医学/状态提示

**示例（尿布颜色，带色块）**：

```tsx
<SegmentedControl<DiaperColor>
  value={color || null}
  onChange={(v) => setColor(v || '')}
  accentColor="var(--diaper)"
  toggleable
  layout="grid"
  columns={5}
  options={[
    { value: 'normal', label: '正常', swatch: '#B07A3D' },
    { value: 'yellow', label: '黄色', swatch: '#E9B95B' },
    { value: 'green',  label: '绿色', swatch: '#7BAE5C' },
    { value: 'black',  label: '黑色', swatch: '#2C2A28' },
    { value: 'red',    label: '红色', swatch: '#C84A3F' },
  ]}
/>
```

**示例（体温测量方式，带正常范围参考）**：

```tsx
<SegmentedControl<TempMethod>
  value={method || null}
  onChange={(v) => setMethod(v || '')}
  accentColor="var(--temperature)"
  toggleable
  layout="grid"
  columns={4}
  options={[
    { value: 'oral',     label: '口腔', description: '35.5–37.5°C' },
    { value: 'axillary', label: '腋下', description: '36.0–37.2°C' },
    { value: 'rectal',   label: '直肠', description: '36.6–38.0°C' },
    { value: 'ear',      label: '耳温', description: '35.8–38.0°C' },
  ]}
/>
```

> 当前业务用例：`diaper-dialog` 的"性状/颜色"、`temperature-dialog` 的"测量方式"。
> diaper-dialog 内置 `getDiaperAdvice(consistency, color)` 工具：根据组合返回 `{variant, text}`，配合 `<Alert size="compact">` 给到分级提示（红/黑色 → danger，水样/硬便 → warning，软便/成型 → success，绿色 → info）。

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
| `<TodaySummary>` | `today-summary.tsx` | FR-A3（4 列大数字 + 进度条；睡眠卡片右上角支持嵌入「开始/结束」实时计时按钮，配合 `useActiveSleep` 使用）v6.0：Card 升级为 `gradient-header` + `NumberRoll` 数字动画 |
| `<HomeSkeleton>` | `home-skeleton.tsx` | FR-A5（首页骨架屏） |
| `<InsightSection>` | `insight-section.tsx` | FR-B（记录页精细趋势：4 张卡含范围条/参考/环比/建议） |
| `<WeeklyTrendOverview>` | `weekly-trend-overview.tsx` | 发现页「上周 vs 本周」趋势对比：单卡 4 行（指标 / 上周日均 / 本周日均 / 对比箭头），异常行整行高亮；头部含偏离徽章 + 「详情 →」跳记录页；底部「向 AI 咨询建议」按钮，会把趋势摘要拼为预填问题，通过 `navigate('/ai-assistant', { state: { autoPrompt } })` 跳转，AI 助手页自动发送一次 |
| `<RangeBar>` | ~~`range-bar.tsx`~~ | **v5.0.1 Batch 3 已删除**：合并到 `<WeeklyRangeBar>`（位于 `ui/progress.tsx`）。`InsightSection` 内部已迁移。 |
| `<FocusCard>` | `focus-card.tsx` | 发现页「最紧急事项」卡：3 级 urgency（overdue / upcoming / normal），左侧 3px 色条 + icon + title + desc |
| `<PageHeader>` | `page-header.tsx` | 通用页面头部，支持 `variant: 'sub' / 'tab'`、`showBack` / `backTo`、`icon` / `accentColor` / `action` |
| ~~`<HeaderAction>`~~ | ~~`header-action.tsx`~~ | **v5.0.1 已删除**：使用 `<Button variant="primary/secondary/ghost" size="sm">` 替代。映射关系：`icon→leftIcon` / `label→children` / `active`/`disabled`/`accentColor` 同名保留。 |
| `<AddRecordMenu>` | `add-record-menu.tsx` | 记录页右上角「添加」下拉菜单：5 种记录类型（喂养/睡眠/排便/体温/生长）独立入口；点击外部 / Esc 自动关闭；通过 `onPick(type)` 回调通知父组件打开对应 Dialog |
| `<EasterEggDisplay>` | `easter-egg-display.tsx` | FR-G2（彩蛋三态渲染） |
| `<QuotaBar>` | `quota-bar.tsx` | FR-F3（AI 配额）双形态：`variant='bar'`（完整条带）/ `variant='badge'`（紧凑徽章，嵌入 header） |
| `<ThemeSelector>` | `theme-selector.tsx` | FR-G1（三态主题选择器，v5.0.0+ 内嵌于"我的"页面的"主题外观"卡；不再需要进 Settings） |
| `<FontScaleSelector>` | `font-scale-selector.tsx` | FR-G1.2（字体 4 档选择器：小 / 标准 / 大 / 特大，配合 `stores/font-scale-store.ts` 持久化；v5.0.0+ 内嵌于"我的"页面的"字体大小"卡） |
| `<NoteTagPicker>` | `note-tag-picker.tsx` | 记录备注标签化选择器（受控组件，用于 5 个记录 Dialog 的备注字段；内含预设标签 + 自定义标签 + 自由文本三层；详见 `web-coding-conventions.md §15`） |
| `<CareRoleSelector>` | `care-role-selector.tsx` | "我的身份"网格选择器（3/4 列 chip，emoji + 名称），用于创建家庭 / 加入家庭表单。选中结果作为 `FamilyMember.relation` 字段提交到后端，首页 AI 洞察直接命中无需中文关键字推断；是 v5.0.0+ 唯一的身份设置入口（旧 `<CareRoleBadge>` 手动切换徽章已移除）。详见 `web-architecture.md §2.6.1` |
| `<JaundiceDialog>` | `jaundice-dialog.tsx` | 黄疸观察记录新建 / 编辑弹窗（数据仅存 localStorage）：Kramer 分区 / 巩膜 / TcB / TSB / 伴随表现 / 处置 / 备注；与 `/jaundice` 子页和 `lib/jaundice.ts` 配合 |
| `<Timeline>` | `timeline.tsx` | 首页「今日时间线」记录展示（结构化摘要 + 关键指标徽章 + 辅助行） |
| `<ReportCover>` | `report/report-cover.tsx` | 成长报告封面卡（v5.0.0+）：渐变背景 + 大号装饰字 `W/M` + 宝宝名 + 周期副标题 |
| `<ReportMetricsGrid>` | `report/report-metrics-grid.tsx` | 本期关键指标 4 宫格（移动 2×2 / 桌面 4 列）：喂养 / 睡眠 / 换尿布 / 体温，每格大号数字 + 单位 + 明细副行，体温异常 ≥1 时强制切 `var(--danger)` |
| `<ReportDailyRhythm>` | `report/report-daily-rhythm.tsx` | 每日节律双色柱图：每天喂养次数（左柱，`var(--feeding)`）与睡眠小时（右柱，`var(--sleep)`）；x 轴稀疏标签（周报全显 / 月报首中末三点）；hover title 展示具体数值 |
| `<ReportGrowthSection>` | `report/report-growth-section.tsx` | 生长快照对比：期初 vs 期末最新 growth 记录；delta 绿涨橙跌，仅一条记录时显示"—"；底部跳 `/growth` |
| `<ReportAchievements>` | `report/report-achievements.tsx` | 本期里程碑 / 疫苗双卡：每卡最多 6 行（超出显示"还有 N 条未展示"），复用 `var(--diaper)` / `var(--feeding)` 类型色 |
| `<ReportAiSummary>` | `report/report-ai-summary.tsx` | AI 总结段：点按生成才请求 `aiService.chat`（避免无谓扣配额），session 内缓存；失败降级为「去 AI 助手详聊」按钮，通过 `autoPrompt` 带上下文跳 `/ai-assistant` |

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

**Milestone 打卡模式（v5.x）**：
- 当前 `MilestonePage` 是**打卡（check-in）页**，列表主体 = 28 项标准里程碑，行右侧圆形 toggle 直接 add / remove；点击行进入 detail，未达成态主按钮"标记达成"，已达成态可编辑 `achievedDate` / `note` 或"取消打卡"。
- 不再有"自由添加"表单与"标准推荐"抽屉。category 文案仍然遵循 `getCategoryLabel(m.categoryKey)` 返回的精简中文，避免在 10px 小 pill 内截断。
- 服务层 `milestoneService` 现包含 `list / create(upsert) / update / remove` 四个方法（`client/src/services/baby-extra.ts`），分别对应 GET / POST(upsert) / PATCH / DELETE。

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
| `useReportData(babyId, period, birthDate?)` | `use-report-data.ts` | 成长报告数据聚合（v5.0.0+）：基于 `GET /records?startDate&endDate`、疫苗 / 里程碑列表、`/trend/weekly`（仅周报）并行拉取并在前端聚合为 `{ metrics, daily, milestones, vaccines, growth, weeklyTrend }`；时间窗：`period='week'` = 本周一→今天，`period='month'` = 本月 1 号→今天，均受 `baby.birthDate` 限制 |

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
| `renderShareImage` / `downloadShareImage` / `shareImage` | `share-canvas.ts` | 分享图 V1（今日小结） + 成长报告分享（v5.0.0+ `renderReportImage`） |
| `renderReportImage(opts)` | `share-canvas.ts` | v5.0.0+：渲染成长报告分享图（周报 / 月报）。入参 `{ baby, data: ReportData, aiSummary? }`；返回 `Promise<Blob>` JPEG。布局：封面（渐变 + 大号 W/M）→ 4 宫格关键指标 → 成就摘要行 → 可选 AI 总结段 → Footer；总高度按 AI 总结行数动态计算（`wrapText` 按字符断行）。DPR 限制为 2，质量 0.85。|
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
export interface WeeklyT