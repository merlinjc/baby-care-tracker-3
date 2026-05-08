# v7.0 重构速查手册（Agent 执行参考）

> 本文档是 **Phase 2/3 页面重构时给每个 agent 的核心参考**。
> 完整方案见 [`web-ui-refactor-v7-plan.md`](./web-ui-refactor-v7-plan.md)。
> 已交付的 Pilot（首页）代码见：`pages/home/index.tsx`、`components/today-summary.tsx`、`components/status-capsule.tsx`、`components/timeline.tsx`、`components/quick-record-bar.tsx`。

---

## 1. 设计语言一句话定义

**iOS Health 信息架构 × 美拉德（Maillard）暖色系**

- 结构：Large Title + Section Header + 2×2 指标卡 + List Row 三层节奏
- 色彩：品牌 `#D4B896` 暖棕 + 抹茶绿/焦糖紫/奶油橙/蜜桃/暮蓝五业务色（全部莫兰迪暖调）
- 动效：framer-motion spring + stagger + whileTap
- 明确的**去除**清单：不用 `uppercase`（中文无效反而引发怪 bug）、不用冷灰 `#F2F2F7`、不用玻璃态 `backdrop-filter`、不用 iOS systemRed/Blue 等高饱和冷色、不用 gradient-header variant

## 2. Token 速查（直接使用，不要自己硬编码）

### 2.1 业务色（用 var(--*-bg) + var(--*-fg)）

```css
feeding   (抹茶绿): --feeding #9BBF7F / --feeding-bg #EEF4E4 / --feeding-fg #4F6B3A
sleep     (焦糖紫): --sleep   #A898B8 / --sleep-bg   #EFEAF0 / --sleep-fg   #5E4E72
diaper    (奶油橙): --diaper  #D4A87A / --diaper-bg  #F7EBD9 / --diaper-fg  #8A5E2B
temperature (蜜桃): --temperature #D48E7A / --temperature-bg #F7E5DD / --temperature-fg #8A4A3A
growth    (暮蓝):  --growth  #7A9CB8 / --growth-bg  #E4EDF4 / --growth-fg  #3A5875
```

### 2.2 语义色

```css
success:  同 feeding
warning:  同 diaper
danger:   #C86464 (暖玫红) / --danger-bg #F5E0E0 / --danger-fg #7A3A3A
info:     同 growth
```

### 2.3 表面

```css
--surface-0: #F5EFE4  (页面底，奶茶白)
--surface-1: #FFFDF8  (卡片底，象牙白)
--surface-2: #F0EADF  (嵌套层)
--surface-hover: #EDE6D8
```

### 2.4 文字

```css
--label: #2C2520            (主文字, 深咖黑)
--label-secondary: 72%      (副文字)
--label-tertiary: 48%       (提示/灰)
--label-quaternary: 28%     (极弱)
```

### 2.5 圆角 / 阴影

```css
--radius-md: 14px    (按钮、输入)
--radius-lg: 20px    (标准卡片)
--radius-xl: 28px    (Hero)
--shadow-xs / --shadow-sm / --shadow-md / --shadow-lg  (都是暖棕阴影)
```

### 2.6 字体类（优先用语义类）

```
.large-title (34px bold display)  — 页面大标题
.title-1 (28px) / .title-2 (22px) / .title-3 (20px)
.headline (17px semibold)         — 卡标题
.body (17px)                      — 正文
.callout (16px) / .subheadline (15px)
.footnote (13px secondary)        — 辅助
.caption-1 (12px tertiary)

.metric-xl (48px SF Rounded)      — 仪表盘大数字
.metric-lg (34px SF Rounded)      — 指标数字
.metric-md (28px)
```

## 3. 新原子（直接用，不要手写布局）

```ts
import { LargeTitleHeader, HeaderLink } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { ListRow } from '@/components/ui/list-row'
```

- **LargeTitleHeader**：页面顶部；`variant="large"`（带大标题）/ `variant="nav"`（常规导航栏）；`backTo="/xxx"` 或 `backTo="back"`；`rightAction={...}`
- **SectionHeader**：段标题；`variant="default"`（13px 次色）/ `prominent`（17px 加粗）/ `grouped`（13px 灰）
- **ListRow**：iOS 列表项；`leading` + `title` + `subtitle` + `value` + `trailing` + `accentColor`（左侧 3px 色条）；`interactive={true}` 启用 hover + whileTap

## 4. UI Primitive 变更速查

### 4.1 Button v7

```tsx
<Button variant="filled">主操作</Button>       // 品牌色实底白字
<Button variant="tinted">次操作</Button>       // 品牌柔和底 + 深字
<Button variant="plain">纯文字</Button>        // 透明底 + 品牌字
<Button variant="secondary">次要</Button>      // surface-2 灰底
<Button variant="destructive">删除</Button>    // 暖玫红实底
<Button variant="destructive-plain">取消</Button>

// 兼容：primary → filled, danger → destructive（可继续用）
```

自动带 `whileTap={scale:0.96}`，不用手写 spring。

### 4.2 Card v7

```tsx
<Card variant="plain">          // 默认，微阴影
<Card variant="elevated">       // 加重阴影
<Card variant="interactive">    // hover 抬升 + active 缩放
<Card variant="hero">           // radius-xl 28px Hero 卡
<Card variant="tinted" tintColor="var(--feeding)">  // 柔和底色卡
<Card variant="cta">            // 空态/引导 dashed 边框
```

### 4.3 Badge v7

```tsx
<Badge variant="feeding">120ml</Badge>
<Badge variant="sleep" tone="filled-solid">紧急</Badge>
<Badge variant="danger" tone="outline">警告</Badge>
```

### 4.4 Input v7

iOS 风：浅灰底 + 聚焦变白底 + 外阴影。**不用自己加边框**。

### 4.5 Dialog v7

完全兼容旧 API。动画由 framer-motion 接管（spring）。

### 4.6 SegmentedControl v7

iOS 标准分段控件。传 `size="md"` 即可。

## 5. Framer Motion 预设（从 `@/lib/motion` 导入）

```ts
import {
  spring, springSoft, springPop,
  pageTransition, staggerContainer, staggerItem, staggerCompact,
  cardEnter, sheetMobile, sheetDesktop, overlayFade,
  pressable, pressableSubtle,
  easeIOS,
} from '@/lib/motion'
```

### 典型页面骨架

```tsx
<motion.div
  className="space-y-5"
  data-page-stack
  variants={staggerContainer}
  initial="initial"
  animate="animate"
>
  <motion.div variants={staggerItem}>
    <LargeTitleHeader title="..." />
  </motion.div>

  <motion.div variants={staggerItem}>
    <SectionHeader title="段标题" />
    <Card>...</Card>
  </motion.div>
</motion.div>
```

## 6. Tailwind 4 JIT 漏扫防御（重要！）

项目有 Tailwind 4 JIT 偶发漏扫的历史问题（见 CODEBUDDY.md）。**对关键布局必须加 `data-*` 钩子**，并在 `globals.css` 的"v7 真·CSS 兜底"段里写真 CSS。

### 已有的 data 钩子（不要重复）

```
[data-app-main] [data-app-content]    → MainLayout 内容区
[data-app-tabbar] [data-app-tabbar-inner] → 移动 TabBar
[data-today-summary] [data-today-card] → TodaySummary 2×2
[data-section-header]                  → SectionHeader
[data-status-capsule]                  → StatusCapsule
[data-quick-record-bar]                → QuickRecordBar
[data-large-title-header]              → LargeTitleHeader
[data-home-stack]                      → HomePage 根容器
[data-timeline] [data-timeline-row]    → Timeline
[data-dialog-*]                        → Dialog
[data-profile-stack] [data-dialog-form] [data-form-field] [data-note-tag-picker]
```

### 新页面建议新增的钩子

对每个 page 根容器加 `data-page-stack`，在 globals.css Fallback 段用：
```css
[data-page-stack] > * + * { margin-top: 20px; }
```
（如果你的页面需要特殊间距，另加专属钩子）

## 7. 禁止清单（agent 必须避开）

❌ 不要写 `uppercase` 处理中文标签（"今日概览" 不需要大写）
❌ 不要写 `tracking-wider` / `tracking-wide` 作用于中文（视觉无意义，且可能触发字形问题）
❌ 不要用 `var(--gradient-primary)` 这类渐变做整卡背景（只能用于按钮或极少数 Hero）
❌ 不要用 `var(--glass-bg)` + `backdrop-filter` 做玻璃态（已废弃）
❌ 不要用 emoji 当 UI icon（🍼 😴 🌡 等），全部用 `lucide-react`（v5.1.1 起回滚 Solar 图标，统一 lucide）
❌ 不要用纯白 `#FFFFFF` / 纯灰 `#F2F2F7` / iOS systemRed/Blue 直接 hex（破坏美拉德统一）
❌ 不要直接用旧变量名 `--primary` 而用 `--brand`（新代码写 `--brand`；旧变量保留 alias 不破坏老代码）

## 8. 信息架构五原则

1. **Large Title 定位**：每个页面顶部用 `<LargeTitleHeader>`；带返回的用 `variant="nav"` 或传 `backTo`
2. **Section 分组**：用 `<SectionHeader>` 承载小标题 + 右侧操作
3. **卡片唯一主角**：每屏最多 1 个 `variant="hero"`（Hero 卡），其余都 `plain`
4. **ListRow 原子性**：所有"图标 + 名称 + 值 + 跳转"列表都用 `<ListRow>`，不要手写
5. **空态**：用 `<Card variant="cta">` 做引导；插画可选 lucide 大 icon + `opacity-30`

## 9. Pilot 首页作为参考样板

重构任何页面前，先读这 5 个文件理解套路：

- `client/src/pages/home/index.tsx` —— 整体骨架、`motion.div variants` 用法
- `client/src/components/today-summary.tsx` —— 2×2 指标卡、metric-lg、tinted bg
- `client/src/components/status-capsule.tsx` —— Hero 状态卡、多态色映射
- `client/src/components/timeline.tsx` —— ListRow 风列表、stagger
- `client/src/components/quick-record-bar.tsx` —— 彩色圆按钮 grid

---

*Agent 执行任何页面重构前必读本文。遇到冲突以 `globals.css` 实际 Token 值为准。*
