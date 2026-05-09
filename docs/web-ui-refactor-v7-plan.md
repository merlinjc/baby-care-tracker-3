# v7.0 UI 大重构方案（真正的大重构）

> **版本**: v1.0 | **日期**: 2026-05-08 | **状态**: 进行中
> **前身**: v6 方案（被判定为"贴皮重构"）已废弃，本方案取代之
> **设计语言**: **Apple Health / iOS 风**（Cupertino-inspired）
> **技术基调**: 保留自研 `ui/*` + Radix 底座，引入 `framer-motion`
> **交付方式**: **Phase 0 + Pilot 首页** 先行 → 用户确认 → 铺开其余 13 个页面

---

## 0. 为什么要推倒重来（而不是再叠一层变体）

v6 方案的本质问题：

| 问题 | 表现 |
|------|------|
| 贴皮而非重塑 | 只加了 `--gradient-*` / `--glass-*` / 几个关键帧，页面/组件结构完全未动 |
| 设计语言摇摆 | 美拉德 + 渐变 + 玻璃态 + 扁平化卡片混在一起，缺乏一以贯之的气质 |
| 信息架构未重排 | 每个页面仍保留小程序时代的线框，没有按 Web/桌面场景重新组织信息 |
| 没有动效系统 | 纯 CSS keyframe 散落在各处，缺少编排与节奏 |
| 覆盖率 87.5% | export / guide 页未纳入，jaundice 方案简略 |

**v7 的诉求**：选定一种**单一、鲜明、工业级成熟**的设计语言（iOS Health），按该语言**重写设计系统、UI 原子、页面信息架构**，业务逻辑（hooks/services/stores）保持不动。

---

## 1. 设计语言基调：iOS Health / Cupertino

### 1.1 为什么选 iOS Health

Baby Care Tracker 本质是「健康追踪 + 育儿日志」——和 Apple Health 品类完全对齐。借鉴 Health 的好处：

1. **数据卡气质**：分段彩色大圆角卡 × 单屏 1–2 关键指标 × 突出数字 × 次要信息灰 —— 天然契合"今日喂养/睡眠/尿布/体温"四大指标
2. **层级清晰**：Section Header（小写加粗 + 更多）→ 卡片 → 列表项 三层节奏，和我们的"今日时间线 / 本周趋势 / AI 洞察"映射良好
3. **成熟且易接受**：用户学习成本低，跨端切换（小程序↔Web）时无认知负担
4. **与美拉德色系兼容**：iOS Health 本身就是彩色分段，我们把系统色（systemBlue/systemOrange/...）映射到美拉德色板即可，不破坏品牌

### 1.2 iOS 风的关键视觉元素（我们全部落地）

| 元素 | iOS Health | v7 映射 |
|------|------------|---------|
| **大标题** | Large Title（34pt SF Pro Display Bold） | `display-md` (38px) + `font-display` + `tracking-tight` |
| **分段色卡** | systemTeal/Pink/Orange/... | `--feeding/--sleep/--diaper/--temperature/--growth` 五色 + 新增 `--chip-{type}-bg/fg` |
| **数据大字** | 48pt SF Pro Rounded Bold | `display-number` (SF Mono) + 新增 `display-metric` 变体 |
| **大圆角** | 16–20pt | 统一到 `--radius-xl` = 20px（卡片）/ `--radius-2xl` = 28px（Hero 块） |
| **分段控件** | segmented pill | `<SegmentedControl>` 重写为 iOS 风：背景 `--bg-elevated`，选中项白底 + 微阴影 |
| **Section Header** | "HIGHLIGHTS" 小写小字 + "Show All >" | 左：`text-xs tracking-wide uppercase text-hint` 右：`primary` 色 chevron |
| **List Row** | 左图标 + 标题副标题 + 右值 + chevron | 新 `<ListRow>` 原子组件 |
| **FAB（仅记录）** | 右下浮标 + 高斯模糊底 | 新 `<FloatingActionBar>` 组件（移动端底部 TabBar 之上） |
| **过渡** | spring physics | `framer-motion` 的 `spring(stiffness: 300, damping: 30)` |
| **卡片气质** | 白/深灰底 + 细边 0.5px + 微阴影 | `--border` 从 `#E8E0D8` 改为 `#F0EAE2`（更细），`--shadow-card` 保留 |

### 1.3 明确的**去除**清单（避免设计冲突）

为了让 iOS 风不打架，以下 v6 引入的元素要**撤掉**：

- ❌ **玻璃态（`--glass-*`）**：iOS 18 已大幅减少玻璃态使用；且 `backdrop-filter` 在低端设备有性能问题
- ❌ **135° 品牌渐变背景**（`--gradient-primary` 等覆盖整卡）：iOS Health 几乎不用大面积渐变，改为"纯色底 + accent icon 小渐变"
- ❌ **散落的 `.card-interactive` / `.card-gradient-header` 等 variant**：Card 只保留 4 个清晰变体：`plain / elevated / interactive / hero`
- ❌ **emoji 图标**（Timeline 里 🍼 😴 🌡️ 等）：全部替换为 lucide + Solar Icons 线性图标，符合 iOS SF Symbols 的视觉体系
- ❌ **原生 `confirm()` 回退**（已经禁了但仍有死角）：全走 `useConfirm()`

---

## 2. 设计系统重构（Phase 0）

### 2.1 Token 体系的 iOS 化重组

**`globals.css` 将被完整重写**（约 900 行 → 600 行）。关键 Token 改动：

#### 2.1.1 色板：引入"系统色 / 分组色 / 表面 / 文字"四层

```css
:root {
  /* ── 1. 品牌与系统色 ── */
  --brand: #D4B896;          /* 美拉德主色（保留） */
  --brand-ink: #8B7B6B;      /* 品牌深色，用于 Hero 标题 */
  --accent: #B8D4B8;

  /* iOS 风语义色（高对比，AAA 级） */
  --sys-blue: #0A84FF;
  --sys-green: #30D158;
  --sys-orange: #FF9F0A;
  --sys-red: #FF453A;
  --sys-purple: #BF5AF2;
  --sys-teal: #64D2FF;
  --sys-gray: #8E8E93;

  /* ── 2. 业务分组色（iOS Health 风的分段色）── */
  /* 每个域提供 bg（柔和底，10%）+ fg（深色前景）+ solid（主色）三层 */
  --feeding: #34C759;
  --feeding-bg: #E8F7EB;
  --feeding-fg: #1F7A3A;

  --sleep: #5E5CE6;
  --sleep-bg: #ECECF9;
  --sleep-fg: #3A39A8;

  --diaper: #FF9F0A;
  --diaper-bg: #FFF4E0;
  --diaper-fg: #B36A00;

  --temperature: #FF453A;
  --temperature-bg: #FFE7E4;
  --temperature-fg: #B03229;

  --growth: #0A84FF;
  --growth-bg: #E3F0FF;
  --growth-fg: #0058B0;

  /* ── 3. 表面层（iOS 三层灰）── */
  --surface-0: #F2F2F7;      /* 页面底（iOS systemGroupedBackground） */
  --surface-1: #FFFFFF;      /* 卡片底 */
  --surface-2: #F9F9FB;      /* 嵌套卡片 / 分段控件底 */
  --surface-hover: #F7F7FA;  /* 列表项 hover */

  /* ── 4. 文字色（iOS Dynamic Text Color）── */
  --label: #1C1C1E;
  --label-secondary: rgba(60, 60, 67, 0.78);  /* iOS secondaryLabel */
  --label-tertiary: rgba(60, 60, 67, 0.52);
  --label-quaternary: rgba(60, 60, 67, 0.30);

  /* ── 5. 边界 & 分隔 ── */
  --separator: rgba(60, 60, 67, 0.12);   /* 0.5pt 效果：用 rgba 模拟 */
  --separator-opaque: #E5E5EA;
  --border-subtle: #F0EAE2;

  /* ── 6. 圆角（iOS 梯度）── */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;      /* 标准卡片 */
  --radius-xl: 28px;      /* Hero 卡片 */
  --radius-pill: 9999px;

  /* ── 7. 阴影（iOS 风：极其微弱）── */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.12);

  /* ── 8. Motion（framer-motion 使用的 spring 参数以常量暴露）── */
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS 标准缓动 */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* ── 9. 字体（保持 SF 回落到 PingFang SC） ── */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC',
               'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC',
                  'Hiragino Sans GB', sans-serif;
  --font-rounded: -apple-system, 'SF Pro Rounded', 'PingFang SC', sans-serif;
  --font-mono: 'SF Mono', ui-monospace, 'Menlo', monospace;

  /* ── 10. 字阶（iOS Dynamic Type 对齐）── */
  --text-caption-2: 11px;
  --text-caption-1: 12px;
  --text-footnote: 13px;
  --text-subheadline: 15px;
  --text-callout: 16px;
  --text-body: 17px;          /* iOS Body 标准 */
  --text-headline: 17px;
  --text-title-3: 20px;
  --text-title-2: 22px;
  --text-title-1: 28px;
  --text-large-title: 34px;
  --text-display: 48px;        /* 用于数据大字 */
}

/* Dark Mode（iOS 风暗色：深灰 #000→#1C1C1E→#2C2C2E 三层）*/
.dark {
  --surface-0: #000000;
  --surface-1: #1C1C1E;
  --surface-2: #2C2C2E;
  --surface-hover: #242426;

  --label: #FFFFFF;
  --label-secondary: rgba(235, 235, 245, 0.70);
  --label-tertiary: rgba(235, 235, 245, 0.40);
  --label-quaternary: rgba(235, 235, 245, 0.18);

  --separator: rgba(84, 84, 88, 0.55);
  --separator-opaque: #38383A;
  --border-subtle: #2C2C2E;

  --brand: #E8DCC8;
  --feeding: #30D158; --feeding-bg: #1D3A24; --feeding-fg: #58E77C;
  --sleep: #7D7AFF; --sleep-bg: #282850; --sleep-fg: #A5A3FF;
  --diaper: #FFB340; --diaper-bg: #3A2B10; --diaper-fg: #FFCB66;
  --temperature: #FF6961; --temperature-bg: #3A1F1E; --temperature-fg: #FF938B;
  --growth: #409CFF; --growth-bg: #15304D; --growth-fg: #70B8FF;
}
```

**兼容层**：旧 token（`--text-primary` / `--bg-card` / `--primary` 等）通过 alias 映射到新 token，组件层可以渐进迁移：
```css
:root {
  --primary: var(--brand);
  --text-primary: var(--label);
  --text-secondary: var(--label-secondary);
  --text-hint: var(--label-tertiary);
  --bg-primary: var(--surface-0);
  --bg-secondary: var(--surface-1);
  --bg-card: var(--surface-1);
  --bg-elevated: var(--surface-2);
  --border: var(--border-subtle);
}
```

#### 2.1.2 字体工具类：iOS 命名对齐

替换当前的 `heading-xl / heading-lg / body-lg / caption`，新增与 iOS 对齐的类名：

```css
.large-title { font: 700 34px/1.2 var(--font-display); letter-spacing: -0.02em; }
.title-1 { font: 700 28px/1.25 var(--font-display); letter-spacing: -0.02em; }
.title-2 { font: 600 22px/1.3 var(--font-display); letter-spacing: -0.02em; }
.title-3 { font: 600 20px/1.35 var(--font-display); letter-spacing: -0.01em; }
.headline { font: 600 17px/1.4 var(--font-sans); letter-spacing: -0.01em; }
.body { font: 400 17px/1.47 var(--font-sans); }
.callout { font: 400 16px/1.45 var(--font-sans); }
.subheadline { font: 400 15px/1.45 var(--font-sans); }
.footnote { font: 400 13px/1.4 var(--font-sans); }
.caption-1 { font: 400 12px/1.35 var(--font-sans); }
.caption-2 { font: 500 11px/1.3 var(--font-sans); letter-spacing: 0.02em; text-transform: uppercase; }

/* 数据大字（SF Pro Rounded + tabular-nums） */
.metric-xl { font: 700 48px/1 var(--font-rounded); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.metric-lg { font: 700 34px/1 var(--font-rounded); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.metric-md { font: 600 22px/1 var(--font-rounded); font-variant-numeric: tabular-nums; }
```

**兼容层**：`display-sm / heading-lg / body-md / caption` 保留，内部 alias 到新类。

### 2.2 动效系统：framer-motion 驱动

新增 `client/src/lib/motion.ts` 统一导出动效预设：

```ts
// 标准弹簧
export const spring = { type: 'spring', stiffness: 300, damping: 30 };
export const springStiff = { type: 'spring', stiffness: 500, damping: 35 };
export const easeIOS = [0.32, 0.72, 0, 1] as const;

// 页面入场
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: easeIOS },
};

// 列表 stagger
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};
export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeIOS } },
};

// 数字跳动
export const numberTransition = { duration: 0.4, ease: easeIOS };

// Dialog / Sheet（iOS 底部滑出 + spring）
export const sheetTransition = {
  initial: { y: '100%' },
  animate: { y: 0, transition: spring },
  exit: { y: '100%', transition: { duration: 0.25, ease: easeIOS } },
};

// 按钮按压
export const pressable = {
  whileTap: { scale: 0.96 },
  transition: spring,
};
```

### 2.3 原子组件视觉重写清单（Phase 0）

**Phase 0 重点重写这 8 个**（其余 21 个原子在 Phase 2/3 滚动升级）：

| 组件 | iOS 化改造重点 |
|------|---------------|
| `Button` | 新增 `filled / tinted / plain / destructive` 4 个 iOS 标准 variant；引入 `whileTap scale:0.96` |
| `Card` | 简化为 `plain / elevated / interactive / hero` 4 变体；圆角默认 20px；去除 gradient-header |
| `Badge` | 保留 13 个 variant，但重写配色为 `<color>-bg / <color>-fg` 方案；默认 tone 从 soft 改为 filled-light |
| `Input` | 圆角 14px；focus 改为 iOS 标准"背景色变化"而非 ring |
| `Dialog` | 桌面端居中改为 `scale + opacity` spring；移动端底部滑出改为 framer-motion 驱动 |
| `Sheet` | 同上；新增 `detents=[medium, large]` 模仿 iOS 半屏 Sheet |
| `SegmentedControl` | 完全重写为 iOS 风：外层 `surface-2` 灰底胶囊，选中项白底 + 微阴影 + spring 滑动 |
| `Tabs` | 新增 `pill-filled` variant（iOS Large Title 下的分段器样式） |

**新增 3 个 iOS 专属原子**（Phase 0 末尾交付）：

| 新原子 | 作用 |
|--------|------|
| `<ListRow>` | iOS 风列表项：左 icon + 标题/副标题 + 右值 + chevron；支持 `interactive / readonly` 两态 |
| `<SectionHeader>` | iOS 风分组头：左标题 + 可选右按钮 |
| `<LargeTitleHeader>` | iOS Large Title 页面头：大标题 + 小程序渐隐 + 右上角 IconButton |

### 2.4 文件清单（Phase 0 产出）

```
client/src/styles/globals.css                [重写]
client/src/styles/motion.css                 [新增 - 基础 keyframe + prefers-reduced-motion]
client/src/lib/motion.ts                     [新增 - framer-motion 预设]
client/src/components/ui/button.tsx          [重写 variants]
client/src/components/ui/card.tsx            [简化 variants]
client/src/components/ui/badge.tsx           [重写色系]
client/src/components/ui/input.tsx           [iOS 风聚焦]
client/src/components/ui/dialog.tsx          [framer-motion 驱动]
client/src/components/ui/sheet.tsx           [framer-motion + detents]（v7.1 已删除：无业务引用）
client/src/components/ui/segmented-control.tsx  [iOS 风重写]
client/src/components/ui/tabs.tsx            [新增 pill-filled]
client/src/components/ui/list-row.tsx        [新增]
client/src/components/ui/section-header.tsx  [新增]
client/src/components/ui/large-title-header.tsx [新增]
client/package.json                          [+ framer-motion]
```

---

## 3. 页面信息架构重写（Phase 1–3）

### 3.1 总原则

1. **每页定一个"主数据卡"**（Hero）—— 吸睛、一屏内看到
2. **Section Header + 卡片 + ListRow 三层节奏**，废弃旧的扁平一列
3. **iOS 移动端用底部 Sheet，桌面端用居中 Modal**，统一由 `<Dialog size>` 分发
4. **动效节奏**：页面入场（stagger 0.05s）→ 卡片入场（spring）→ 交互反馈（whileTap）

### 3.2 Pilot 首页（Phase 1 交付）

先重写首页作为风格样板，你看过满意后再铺开。新的首页信息架构：

```
┌─────────────────────────────────────────┐
│  早上好，妈妈                  [👶小宝▾] │  ← LargeTitleHeader
│  小宝 · 3个月18天                        │
├─────────────────────────────────────────┤
│                                          │
│  ╭──────────── 状态卡（条件渲染）─────╮  │  ← 仅 activeSleep 时出现
│  │  🌙 小宝正在小睡                    │  │    hero variant
│  │  已经 1 小时 23 分钟                │  │
│  │  [查看详情]           [结束]        │  │
│  ╰──────────────────────────────────╯  │
│                                          │
│  今日概览                       查看全部  │  ← SectionHeader
│  ┌─────────┬─────────┐                 │
│  │ 🍼 喂养 │ 😴 睡眠 │                  │  ← 2x2 iOS Health 风指标卡
│  │ 3 次    │ 2 次    │                  │     metric-lg + 底色 feeding-bg
│  │ 240 ml  │ 4h 32m  │                  │
│  ├─────────┼─────────┤                 │
│  │ 💧 尿布 │ 🌡 体温 │                  │
│  │ 4 次    │ 36.8°   │                  │
│  │ 尿2 便1 │ 正常    │                  │
│  └─────────┴─────────┘                 │
│                                          │
│  AI 每日洞察                    刷新 ⟳  │  ← SectionHeader
│  ╭──────────────────────────────────╮  │
│  │  💡 小宝今日喂养规律、睡眠达标   │  │  ← 单卡，去掉折叠
│  │  💡 建议延长午睡到 2h +           │  │    采用 AI chip 风
│  ╰──────────────────────────────────╯  │
│                                          │
│  今日时间线                    查看全部  │  ← SectionHeader
│  ╭──────────────────────────────────╮  │
│  │ ● 10:30  配方奶 120ml             │  │  ← ListRow × N
│  │ │                                  │  │    左侧色条 + 图标
│  │ ● 09:15  小睡 1h 30m               │  │
│  │ │                                  │  │
│  │ ● 08:00  尿 + 便                   │  │
│  │                                    │  │
│  │ 查看全部 12 条 ›                   │  │
│  ╰──────────────────────────────────╯  │
│                                          │
│  快捷记录                                │  ← 不再是 TabBar 上的 FAB，
│  ╭──────────────────────────────────╮  │    而是一排彩色按钮
│  │ [🍼] [😴] [💧] [🌡] [📏]         │  │
│  ╰──────────────────────────────────╯  │
│                                          │
└─────────────────────────────────────────┘
```

**关键变化（相对 v6/当前）**：

| v6/当前 | v7 |
|--------|-----|
| 问候语 + BabySwitcher 分两端 | 合并为 iOS LargeTitleHeader（大标题 + 右上角头像切换） |
| StatusCapsule = 整宽条幅 | 升级为 `Card hero` 变体，仅在有 activeSleep 时渲染 |
| TodaySummary = 4 列横排 | 重写为 2×2 iOS Health 彩色底卡，每格突出大数字（metric-lg） |
| AI 洞察有折叠/展开态 | 去掉折叠，直接单卡显示 2–3 条 chip 式建议；不展开全文（全文在 AI 助手页） |
| Timeline 卡片内嵌 | 保留卡片包裹，但 ListRow 全重写（线性图标 + 左色条 + 右值 + 时间） |
| 快捷记录散落在各页 | 首页底部独立"快捷记录"5 彩色圆按钮 + 移动端 FAB |

### 3.3 其余 13 个页面重写概要（Phase 2/3 铺开）

按优先级分三批：

#### Batch A（Phase 2 Week 1）- 核心路径
| 页面 | 主要变化 |
|------|---------|
| `/login` `/register` | iOS Onboarding 风：Hero 插画 + 极简表单 + 大号按钮；`framer-motion` 分步入场 |
| `/guide` | 新手引导卡片轮播（iOS Health Onboarding 风） |
| `/record` | Large Title + iOS `SegmentedControl` + 每日分组 + ListRow |
| `/discover` | 移除"功能 Grid 6 入口"，改为 iOS Health 的"分类卡片流"（生长 / 接种 / AI / 黄疸 / 报告）×  ListRow 式的"待办 FocusCard" |

#### Batch B（Phase 2 Week 2）
| 页面 | 主要变化 |
|------|---------|
| `/profile` | iOS Settings 风 ListRow 分组 + 头像 Hero |
| `/settings` | 同上，所有子项用 ListRow |
| `/ai-assistant` | iMessage 式气泡 + iOS sticky Title + Quota 嵌入 Title bar |
| `/report` | Large Title + Tab Pill + iOS Health 风 MetricsGrid + Trend 折线图 |

#### Batch C（Phase 3）
| 页面 | 主要变化 |
|------|---------|
| `/growth` | iOS Health 的"趋势详情"页：大折线图 + 分段期间 + ListRow |
| `/vaccine` `/milestone` | iOS 任务列表：已完成灰 / 待办高亮 + ListRow |
| `/jaundice` | Hero 值 + 迷你趋势卡 + ListRow |
| `/baby/*` `/family/*` | Settings 风 ListRow 分组 |
| `/export` | 单卡 + 大 CTA 按钮 |

### 3.4 导航骨架（Phase 1 一起改造）

- **移动端 TabBar**：保留 4 Tab，但样式 iOS 化（细边 hairline、激活色用 `--brand`、图标切换用 `framer-motion` spring 动效）
- **桌面端 Sidebar**：保留 240px，但 Brand logo 重新设计（圆角方块 + 磁铁字 "B"），导航项 hover 用 `--surface-hover`，激活态用 filled bg + `--brand` 文字
- **所有页面顶部**：统一改用 `<LargeTitleHeader>`（替代现有 `<PageHeader>`），根据路由自动切 back / collapsible

---

## 4. 实施步骤与 todos

### Phase 0：设计系统（立即执行）
- [ ] 重写 `globals.css`（新 Token 体系 + 字体类 + 兼容 alias）
- [ ] 新增 `motion.css` + `lib/motion.ts`
- [ ] 安装 `framer-motion`
- [ ] 重写 8 个核心原子（Button/Card/Badge/Input/Dialog/Sheet/SegmentedControl/Tabs）
- [ ] 新增 3 个 iOS 原子（ListRow/SectionHeader/LargeTitleHeader）

### Phase 1：Pilot 首页（Phase 0 后立即执行）
- [ ] 改造 `MainLayout`（TabBar + Sidebar 视觉升级）
- [ ] 重写 `pages/home/index.tsx`
- [ ] 重写 `components/today-summary.tsx`（2×2 iOS Health 卡）
- [ ] 重写 `components/status-capsule.tsx`（hero 卡）
- [ ] 重写 `components/timeline.tsx`（ListRow 风）
- [ ] 重写 `components/baby-switcher.tsx`（LargeTitleHeader 内嵌）
- [ ] 新增 `components/quick-record-bar.tsx`（底部 5 按钮）

### 🛑 检查点：**用户确认首页效果** 🛑

### Phase 2：Batch A + B（~ 8 页）
…（详见 §3.3）

### Phase 3：Batch C（~ 5 页）
…（详见 §3.3）

### Phase 4：清理 + 文档
- [ ] 删除废弃的 gradient / glass CSS 代码
- [ ] 删除废弃的 `card-gradient-header` 等 variant
- [ ] 更新 `docs/web-ui-spec.md / web-component-library.md / web-coding-conventions.md` 为 v7.0 基调
- [ ] 更新 `architecture.md` 的"主题系统"章节

---

## 5. 风险与应对

| 风险 | 应对 |
|------|------|
| iOS 风色板过于冷（系统蓝/橙）可能与美拉德温暖感冲突 | §2.1 已用 iOS 风映射品牌色：`--brand` 仍为 `#D4B896`；业务色用 iOS 体系但保留美拉德 `--brand` 作为 Header/强调 |
| framer-motion 包体增加 ~50kb | 只在必要页面（Home/Record/Discover）引入；非关键页用 pure CSS |
| 重构周期长，中间状态 UI 不一致 | 兼容 alias 保证旧页面仍能渲染；Phase 2/3 按页面独立提交，不卡脖子 |
| 原子组件变更影响业务 | Button/Card 新 variant 与旧 variant 并存；旧 variant 在 Phase 4 才删除 |

---

## 6. 与小程序端的关系

- 本重构**仅作用于 client/（Web 端）**。小程序端继续保持 `ui-design-system.md` 定义的美拉德扁平化风格，不受影响。
- 设计一致性：品牌主色 `#D4B896` 在两端保持一致；业务分组色在 Web 端借用 iOS systemColors 提高对比度（小程序不跟进）。
- 未来若要在小程序端也跟进 iOS 风（分段色 + List Row），应作为**独立的小程序重构项目**启动。

---

*v7.0 方案由 `docs/web-ui-refactor-v7-plan.md` 维护；实施过程中的细节调整直接在此文档更新。*
