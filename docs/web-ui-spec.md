# Baby Care Tracker Web 版 UI 交互规范

> **版本**: v7.0 | **日期**: 2026-05-08 | **状态**: ✅ 已落地
> **设计系统**: iOS Health 信息架构 × 美拉德（Maillard）暖色系
> **UI 框架**: React 19 + 自研 UI 层（CVA + Radix）+ Tailwind CSS 4 + framer-motion 12

---

## 🆕 v7.0 大重构总览（2026-05-08 落地）

v7 是项目史上最深入的一次 UI 重构，**14 个页面全部重写**（不是贴皮），完整资料：

- **完整方案**：[`web-ui-refactor-v7-plan.md`](./web-ui-refactor-v7-plan.md)
- **执行速查**：[`web-ui-refactor-v7-cheatsheet.md`](./web-ui-refactor-v7-cheatsheet.md)（必读）

### 核心变化（与 v6 的区别）

| 维度 | v6（贴皮） | v7（真重构）|
|------|---|---|
| 设计语言 | 美拉德扁平 + 渐变 + 玻璃态叠加 | **iOS Health 信息架构 × 美拉德暖色** |
| 信息架构 | PageHeader（H1+icon）+ Card 列表 | **LargeTitleHeader + SectionHeader + ListRow + 2×2 Metrics 卡** |
| 业务色 | iOS systemColors（亮绿/电光紫/亮橙/亮红/亮蓝）| **抹茶绿/焦糖紫/奶油橙/蜜桃/暮蓝**（全部莫兰迪暖调）|
| 页面底色 | `#F2F2F7` 冷灰 | `#F5EFE4` 奶茶白 + 顶部品牌色光晕 |
| 文字 | `#1C1C1E` 冷黑 | `#2C2520` 深咖黑 |
| 阴影 | 冷黑透明度 | 暖棕 hairline + 暖棕投影 |
| 动效 | 纯 CSS keyframes | **framer-motion spring + stagger + whileTap** |
| Button variant | `primary/secondary/ghost/danger-outline` | **`filled/tinted/plain/secondary/destructive/destructive-plain`**（兼容 alias 保留） |
| Card variant | `glass/gradient-header/accent/interactive` | **`plain/elevated/interactive/hero/tinted/cta`** |
| 玻璃态 | 大量 backdrop-filter | **完全废弃** |
| Tabs/chip | 自定义 chip + ghost button + active | **统一 SegmentedControl**（spring 滑动指示器） |

### v7.0 新增 UI 原子（必须用，不要手写）

```ts
import { LargeTitleHeader, HeaderLink } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { ListRow } from '@/components/ui/list-row'
```

### v7.0 落地清单（所有 13 个剩余页面 + Pilot 首页 = 全部）

- ✅ Pilot：`pages/home/index.tsx`
- ✅ Batch A：login / register / auth-layout / record / discover / profile（含 focus-card 重写）
- ✅ Batch B：ai-assistant / report / growth / settings
- ✅ Batch C：vaccine / milestone / jaundice / baby / family

### Token 速查表

```css
/* 业务色（全部美拉德兄弟色，bg+fg+solid 三层） */
--feeding:      #9BBF7F  --feeding-bg:      #EEF4E4  --feeding-fg:      #4F6B3A
--sleep:        #A898B8  --sleep-bg:        #EFEAF0  --sleep-fg:        #5E4E72
--diaper:       #D4A87A  --diaper-bg:       #F7EBD9  --diaper-fg:       #8A5E2B
--temperature:  #D48E7A  --temperature-bg:  #F7E5DD  --temperature-fg:  #8A4A3A
--growth:       #7A9CB8  --growth-bg:       #E4EDF4  --growth-fg:       #3A5875

/* 语义色 */
--success: 同 feeding   --warning: 同 diaper
--danger: #C86464 (暖玫红, 不是 systemRed)
--info: 同 growth

/* 表面 */
--surface-0: #F5EFE4 (页面底·奶茶白)
--surface-1: #FFFDF8 (卡片底·象牙白)
--surface-2: #F0EADF (嵌套层)

/* 文字（暖色层级） */
--label: #2C2520 (深咖黑)
--label-secondary: 72%   --label-tertiary: 48%   --label-quaternary: 28%

/* 圆角 */
--radius-md: 14px (按钮、输入)
--radius-lg: 20px (标准卡片)
--radius-xl: 28px (Hero)

/* 字阶（语义类） */
.large-title (34px)  .title-1 (28px)  .title-2 (22px)  .title-3 (20px)
.headline (17px semibold)  .body (17px)  .callout (16px)
.subheadline (15px)  .footnote (13px)  .caption-1 (12px)  .caption-2 (11px)
.metric-xl (48px)  .metric-lg (34px)  .metric-md (28px)
```

### v7 禁止清单（新代码必须避开）

❌ `uppercase` / `tracking-wider` 作用于中文（视觉无意义且引发字形 bug）
❌ 写死 `#FFFFFF` / `#F2F2F7` / `#1C1C1E` / iOS systemColors hex（破坏美拉德统一）
❌ `var(--gradient-*)` 做整卡背景（只能用于按钮或极少数 Hero）
❌ `var(--glass-bg)` + `backdrop-filter` 玻璃态（已全部移除）
❌ Card `variant="glass" / "gradient-header" / "accent"`（已废弃）
❌ Button `variant="primary"` 新代码请用 `"filled"`（兼容 alias 保留可继续用）
❌ emoji 当 UI icon（🍼 😴 🌡），统一用 `lucide-react`（v5.1.1 起，已移除自制 Solar Linear/Bold 图标）

### v7 页面骨架模板

每个页面根容器都遵循：

```tsx
<motion.div
  className="space-y-5"
  data-page-stack
  variants={staggerContainer}
  initial="initial"
  animate="animate"
>
  <motion.div variants={staggerItem}>
    <LargeTitleHeader title="..." backTo="..." rightAction={...} />
  </motion.div>

  <motion.div variants={staggerItem}>
    <SectionHeader title="..." variant="grouped|prominent|default" />
    <Card padding="none">
      <div className="ios-list">
        <ListRow leading={...} title="..." value="..." accentColor={...} interactive />
      </div>
    </Card>
  </motion.div>
</motion.div>
```

### Tailwind 4 JIT 漏扫防御（重要）

项目有偶发 JIT 漏扫问题，**关键布局必须加 `data-*` 钩子**，并在 `globals.css` 的"v7 真·CSS 兜底"段写真 CSS：

```
[data-page-stack] [data-home-stack] [data-profile-stack]
[data-today-summary] [data-today-card]
[data-section-header] [data-large-title-header]
[data-status-capsule] [data-quick-record-bar]
[data-timeline] [data-timeline-row]
[data-discover-grid] [data-discover-card]
```

---

## 0. 设计系统补丁记录（v6 老补丁，保留供参考）

### 2026-05-08：卡片阴影 + Hairline 双层方案

**背景**：原 `--shadow-xs ~ --shadow-xl` 单层弱阴影（透明度 0.06~0.20）在暖米背景 `--surface-0 (#F5EFE4)` 上几乎不可见，导致卡片视觉边界丢失，元素扁平堆砌。

**方案**：所有 shadow token 改为 **hairline 内描边 + 投影** 双层结构，确保卡片在任何亮度下都有清晰边界（iOS Health 风）：

```css
--shadow-xs: 0 0 0 0.5px rgba(139,123,107,0.10), 0 1px 2px rgba(139,123,107,0.06);
--shadow-sm: 0 0 0 0.5px rgba(139,123,107,0.10), 0 4px 12px rgba(139,123,107,0.10);
--shadow-md: 0 0 0 0.5px rgba(139,123,107,0.10), 0 12px 28px rgba(139,123,107,0.14);
/* ... lg / xl 同步加强 */
```

**适用**：所有 `<Card>`、`<Dialog>`、`<Sheet>`、`<Popover>` 自动受益，无需逐组件改 className。

**InsightSection 卡片布局微调**：原"日均/参考/环比"三列 `justify-between` 漂浮排列，改为：
- 第 2 行：日均（22px 大字数字）+ 单位 + 环比（右对齐）
- 第 3 行：WeeklyRangeBar 进度条 + 右侧"参考 X-Y"小字（合并避免悬空）
- 第 4 行：智能提示语（line-clamp-2）

---

## 1. 页面结构与导航

### 1.1 导航架构

#### 移动端 (<640px)：底部 TabBar

```
┌─────────────────────────────────────┐
│              页面内容区               │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  🏠首页  📋记录  🔍发现  👤我的      │
└─────────────────────────────────────┘
```

- 固定在视口底部，高度 56px + safe-area-inset-bottom
- 当前 Tab 图标填充色 + 文字高亮 `var(--primary-color)`
- 未选中态：`var(--text-hint)` 图标轮廓 + 文字
- 切换无动画，即时切换
- 中间无 FAB 按钮（快捷记录入口在首页内部）

#### 平板端 (640-1024px)：侧边栏紧凑模式

```
┌──────┬──────────────────────────────┐
│  🏠  │                              │
│  📋  │         页面内容区             │
│  🔍  │                              │
│  👤  │                              │
│      │                              │
│ ⚙️   │                              │
└──────┴──────────────────────────────┘
```

- 侧边栏宽度 64px，仅显示图标
- 当前项：左侧 3px `var(--primary-color)` 色条 + 图标填充
- 底部固定设置图标
- 悬浮时显示 tooltip 文字标签

#### 桌面端 (>1024px)：侧边栏展开模式

```
┌────────────┬────────────────────────────────────────┐
│  🏠 首页    │                                        │
│  📋 记录    │            页面内容区                    │
│  🔍 发现    │         (max-width: 1200px 居中)        │
│  👤 我的    │                                        │
│            │                                        │
│ ─────────  │                                        │
│  👶 宝宝    │                                        │
│  👨‍👩‍👧 家庭    │                                        │
│  ⚙️ 设置    │                                        │
└────────────┴────────────────────────────────────────┘
```

- 侧边栏宽度 220px，图标 + 文字
- 上方主 Tab 区（首页/记录/发现/我的）
- 分隔线下方快捷入口（宝宝/家庭/设置）
- 当前项：左侧 3px 色条 + 背景 `var(--surface-elevated)` + 文字加粗
- 内容区水平居中，max-width: 1200px

### 1.2 页面路由表

| 路由路径 | 页面组件 | 页面名称 | 对应小程序页面 | 导航位置 |
|---------|---------|---------|--------------|---------|
| `/login` | `LoginPage` | 登录 | `pages/auth/auth` | 无（独立布局） |
| `/register` | `RegisterPage` | 注册 | `pages/auth/auth` | 无（独立布局） |
| `/` | `HomePage` | 首页 | `pages/home/home` | TabBar |
| `/records` | `RecordPage` | 记录列表 | `pages/record/record` | TabBar |
| `/discover` | `DiscoverPage` | 发现 | `pages/discover/discover` | TabBar |
| `/profile` | `ProfilePage` | 个人中心 | `pages/profile/profile` | TabBar |
| `/vaccine` | `VaccinePage` | 疫苗追踪 | `packageGrowth/pages/vaccine/vaccine` | 发现页入口 |
| `/growth` | `GrowthPage` | 生长曲线 | `packageGrowth/pages/growth/growth` | 发现页入口 |
| `/milestone` | `MilestonePage` | 里程碑 | `packageGrowth/pages/milestone/milestone` | 发现页入口 |
| `/ai-assistant` | `AIAssistantPage` | AI 助手 | `packageSocial/pages/ai-assistant/ai-assistant` | 发现页入口 |
| `/jaundice` | `JaundicePage` | 黄疸记录（Web 端独有） | — | 发现页入口（本地存储 MVP） |
| `/report` | `ReportPage` | 成长报告（周报 / 月报） | — | 发现页入口（v5.0.0+） |
| `/baby/create` | `BabyCreatePage` | 创建宝宝 | `pages/baby-create/baby-create` | 个人中心入口 |
| `/baby/:id` | `BabyDetailPage` | 宝宝详情 | `packageGrowth/pages/baby-detail/baby-detail` | 个人中心入口 |
| `/babies` | `BabyListPage` | 宝宝列表 | `pages/baby-list/baby-list` | 个人中心入口 |
| `/family` | `FamilyPage` | 家庭管理 | `packageSocial/pages/family/family` | 个人中心入口 |
| `/family/create` | `FamilyCreatePage` | 创建家庭 | `packageSocial/pages/family-create/family-create` | 引导流程 |
| `/family/join` | `FamilyJoinPage` | 加入家庭 | `packageSocial/pages/family-join/family-join` | 引导流程 |
| `/export` | `ExportPage` | 数据导出 | `packageSocial/pages/export/export` | 个人中心入口 |
| `/settings` | `SettingsPage` | 设置 | `packageSocial/pages/settings/settings` | 侧边栏/个人中心 |
| `/guide` | `GuidePage` | 新手引导 | `pages/guide/guide` | 首次登录 |

### 1.3 路由布局

```
App
├── AuthLayout (登录/注册)
│   ├── /login
│   └── /register
├── MainLayout (主框架：含导航)
│   ├── TabBarLayout (移动端底部导航)
│   │   ├── / → HomePage
│   │   ├── /records → RecordPage
│   │   ├── /discover → DiscoverPage
│   │   └── /profile → ProfilePage
│   └── 子页面 (覆盖式导航)
│       ├── /vaccine → VaccinePage
│       ├── /growth → GrowthPage
│       ├── /milestone → MilestonePage
│       ├── /ai-assistant → AIAssistantPage
│       ├── /baby/* → BabyPages
│       ├── /family/* → FamilyPages
│       ├── /export → ExportPage
│       ├── /settings → SettingsPage
│       └── /guide → GuidePage
└── DialogLayer (弹窗层，覆盖在页面上)
    ├── FeedingDialog
    ├── SleepDialog
    ├── DiaperDialog
    ├── TemperatureDialog
    ├── GrowthDialog
    ├── ReportDialog
    ├── ExportDialog
    └── BabyEditDialog
```

### 1.4 页面头部统一规范（v4.3.x 起）

所有页面的"标题 + 返回 + 右上角操作"区域统一使用 `<PageHeader>` + `<HeaderAction>` 组合。

**variant 选择**：

| 页面 | variant | 备注 |
|------|---------|------|
| `record` / `discover` | `tab` | 无返回键，可带 48px 渐变图标，标题 `heading-lg` |
| `vaccine` / `milestone` / `growth` / `baby` / `family` / `settings` | `sub`（默认） | 渲染返回键 + 标题 `heading-lg` |
| `home` | — | 自定义问候语 + `<BabySwitcher>`（不使用 PageHeader） |
| `profile` | — | 用户卡本身即头部 |
| `ai-assistant` | — | 全屏对话页，sticky 顶栏 |
| `auth/login` / `auth/register` | — | AuthLayout 内置 brand 头部 |

**右上角操作按钮**（`PageHeader.action`）：

| variant | 用途 |
|---------|------|
| `primary` | 主操作（添加 / 记录） |
| `secondary` | 次要操作 |
| `ghost` | 低调/可切换状态（筛选 / 标准计划 / 标准推荐） |

```tsx
<PageHeader
  title="疫苗计划"
  backTo="/discover"
  action={
    <div className="flex items-center gap-2">
      <HeaderAction variant="ghost" icon={<ListChecks/>} label="标准计划" onClick={...} />
      <HeaderAction variant="primary" icon={<Plus/>} label="添加" onClick={...} />
    </div>
  }
/>
```

### 1.5 Loading 策略统一（v4.3.x 起）

| 场景 | 实现 |
|------|------|
| 首次加载列表型页面（record / vaccine / milestone / 家庭成员等） | `<ListSkeleton count={n}/>` |
| 首次加载图表型页面（growth 生长曲线 / 趋势卡片） | `<ChartSkeleton/>` 或 `<InsightSection isLoading/>` |
| 首页首次加载 | `<HomeSkeleton/>` |
| 分页加载、局部刷新 | `<div className="spinner"/>` + 文字提示 |
| 表单提交中 | 按钮内 loading 文案 |

**禁止**：
- 纯文字「加载中...」作为唯一 loading 反馈。
- 内联 `<div>{success/error message}</div>` 反馈：成功/失败一律走 toast。

### 1.6 MainLayout 补充（v4.3.x P2 起）

**桌面 Sidebar 结构**（宽 240px，左侧 fixed）：

```
┌──────────────┐
│  Baby Care   │ ← 品牌栏
├──────────────┤
│  🏠 首页      │
│  📋 记录      │ ← 主 Nav
│  🔍 发现      │
│  👤 我的      │
├──────────────┤
│              │
│  (flex 空间)  │
│              │
├──────────────┤
│  👶 宝宝名    │ ← SidebarBabyCard（P2 新增）
│     3 月龄    │    点击展开切换下拉
│  ────────    │
│    v4.3       │ ← 版本号
└──────────────┘
```

- `SidebarBabyCard`：当前宝宝头像 + 昵称 + 年龄；点击弹出列表切换，切换后自动 invalidate React Query 数据。
- 无宝宝时：显示 `选择宝宝`（灰色占位）；`babies.length === 0` 时整卡不渲染。

**内容区 Footer**（v4.3.x P2 起）：
- 所有使用 `MainLayout` 的页面底部统一渲染 `<Footer>`（ICP 备案 + 公安备案链接 + 署名）。
- 移动端：Footer 位于 TabBar 之上（`main` 的 `pb-16` 为 TabBar 留空间）。
- 桌面端：Footer 在内容区最底部，与主内容同宽（`max-w-3xl`）。


---

## 2. 页面交互设计

### 2.1 登录页

**路由**: `/login` | **组件**: `LoginPage` | **小程序映射**: `pages/auth/auth`

#### 布局线框

```
┌─────────────────────────────────────┐
│                                     │
│          [品牌 Logo]                 │
│       Baby Care Tracker             │
│       "科学育儿，安心记录"             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📧  邮箱/手机号              │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  🔒  密码           [👁]    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │          登  录              │    │
│  └─────────────────────────────┘    │
│                                     │
│  还没有账号？立即注册                 │
│                                     │
│  ─────── 或 ───────                 │
│                                     │
│  [微信图标] 微信登录 (Phase 3)       │
│                                     │
└─────────────────────────────────────┘
```

#### 交互流程

1. 页面加载 → 检查本地 JWT → 有效则自动跳转首页
2. 输入邮箱/手机号 → 实时格式校验 → 错误提示在输入框下方
3. 输入密码 → 密码可见性切换（右侧眼睛图标）
4. 点击登录 → 按钮显示 loading 旋转 → 成功跳转首页 / 失败显示 toast
5. "立即注册" → 跳转 `/register`

#### 状态设计

| 状态 | 表现 |
|------|------|
| 初始 | 表单空白，登录按钮禁用 |
| 输入中 | 实时校验，错误即时反馈 |
| 提交中 | 按钮变为 loading spinner，表单禁用 |
| 错误 | 输入框红色边框 + 错误文字提示 |
| 成功 | 跳转首页（带 fadeInUp 动画） |

---

### 2.2 注册页

**路由**: `/register` | **组件**: `RegisterPage` | **小程序映射**: `pages/auth/auth`

#### 布局线框

```
┌─────────────────────────────────────┐
│  ← 返回                             │
│                                     │
│       创建账号                       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📧  邮箱                    │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  📱  手机号（选填）           │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  🔒  密码（≥8位）   [👁]    │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  🔒  确认密码       [👁]    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ☑ 我已阅读并同意《用户协议》《隐私政策》│
│                                     │
│  ┌─────────────────────────────┐    │
│  │          注  册              │    │
│  └─────────────────────────────┘    │
│                                     │
│  已有账号？立即登录                   │
│                                     │
└─────────────────────────────────────┘
```

#### 交互流程

1. 填写邮箱（必填）→ 格式校验
2. 填写手机号（选填）→ 11位数字校验
3. 填写密码 → 强度指示条（弱/中/强，颜色变化）
4. 确认密码 → 实时比对
5. 勾选协议 → 按钮可用
6. 注册成功 → 自动登录 → 检查是否已有家庭
   - 无家庭 → 引导创建家庭 `/family/create`
   - 有家庭 → 跳转首页 `/`

#### 状态设计

| 状态 | 表现 |
|------|------|
| 初始 | 表单空白，注册按钮禁用 |
| 密码输入 | 密码强度条动态变化 |
| 协议未勾选 | 注册按钮禁用，点击提示"请先同意协议" |
| 提交中 | 按钮 loading + 表单禁用 |
| 邮箱已存在 | 输入框下方提示"该邮箱已注册" |

---

### 2.3 首页

**路由**: `/` | **组件**: `HomePage` | **小程序映射**: `pages/home/home`

#### 布局线框（移动端）

```
┌─────────────────────────────────────┐
│ ☰         早安，妈妈        👤小宝 ▼ │  ← 顶栏
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🌙 正在睡觉 · 已2小时30分       │ │  ← 状态横幅
│ │           [结束睡眠]             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌────────┐┌────────┐┌────────┐     │
│ │🍼 喂养  ││😴 睡眠  ││🧷 排便  │     │  ← 今日概览
│ │3次 240ml││2次 4.5h││4次     │     │     横向滑动
│ │2小时前  ││达标 ✓  ││湿2脏2  │     │
│ └────────┘└────────┘└────────┘     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🤖 AI 每日洞察              ▼  │ │  ← AI 洞察区
│ │ 今天宝宝喂养规律，睡眠达标...    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 今日时间线                           │
│ ┌─────────────────────────────────┐ │
│ │ 09:30 🍼 配方奶 120ml           │ │  ← 时间线组件
│ │ 08:00 😴 午睡 1.5小时            │ │
│ │ 07:00 🍼 母乳 左侧 15min        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

> 注：原首页底部「快捷记录栏（5 彩色圆按钮）」已移除（v7.x），其功能与「今日概览」卡片点击入口重复，统一由今日概览承接。

#### 布局线框（桌面端）

```
┌────────────┬────────────────────────────────────────┐
│  🏠 首页    │  早安，妈妈              👤小宝 ▼      │
│  📋 记录    ├────────────────────────────────────────┤
│  🔍 发现    │  ┌──────────────────────────────────┐  │
│  👤 我的    │  │  🌙 正在睡觉 · 已2小时30分        │  │
│            │  └──────────────────────────────────┘  │
│ ─────────  │                                        │
│  👶 宝宝    │  ┌──────────┐┌──────────┐┌─────────┐ │
│  👨‍👩‍👧 家庭    │  │ 🍼 喂养   ││ 😴 睡眠   ││ 🧷 排便  │ │
│  ⚙️ 设置    │  │ 3次 240ml││ 2次 4.5h ││ 4次     │ │
│            │  └──────────┘└──────────┘└─────────┘ │
│            │                                        │
│            │  ┌──────────────────────────────────┐  │
│            │  │  🤖 AI 每日洞察                   │  │
│            │  │  今天宝宝喂养规律，睡眠达标...     │  │
│            │  └──────────────────────────────────┘  │
│            │                                        │
│            │  今日时间线                              │
│            │  ┌──────────────────────────────────┐  │
│            │  │  09:30 🍼 配方奶 120ml            │  │
│            │  │  08:00 😴 午睡 1.5小时             │  │
│            │  └──────────────────────────────────┘  │
└────────────┴────────────────────────────────────────┘
```

#### 交互流程

1. **页面加载** → 并行请求今日统计 + 时间线 + AI 洞察 → 骨架屏 → 数据到达后渲染
2. **宝宝切换** → 点击顶栏头像/下拉 → 切换宝宝 → 刷新所有数据
3. **状态横幅** → 睡眠中：显示"结束睡眠"按钮 → 点击结束睡眠弹窗
4. **今日概览** → 横向滑动卡片 → 点击卡片直接打开对应记录弹窗（同时承接快捷记录入口）
5. **AI 洞察** → 默认折叠 → 点击展开 → 底部"查看更多"跳转 AI 助手
6. **时间线** → 左滑编辑/删除 → 点击展开详情弹窗

#### 状态设计

| 状态 | 表现 |
|------|------|
| 加载中 | 全页骨架屏（shimmer 动画），概览卡片灰色块 |
| 空态（无宝宝） | 引导卡片："添加宝宝开始记录" + 按钮 |
| 空态（无记录） | 时间线区域显示空态插图 + "点击下方添加首条记录" |
| 错误 | ErrorState 组件 + 重试按钮 |
| 正常 | 完整渲染，数据实时更新 |

---

### 2.4 记录页

**路由**: `/records` | **组件**: `RecordPage` | **小程序映射**: `pages/record/record`

#### 布局线框

```
┌─────────────────────────────────────┐
│  记录                    🔍  ☰     │  ← 顶栏：搜索 + 管理模式
├─────────────────────────────────────┤
│  [全部] [喂养] [睡眠] [排便] [体温] [生长] │  ← 筛选标签
│  ──────────────────────────         │
│  [全部时间 ▼]                       │  ← 时间范围下拉
├─────────────────────────────────────┤
│                                     │
│  ── 今天 ──                         │
│  ┌─────────────────────────────┐    │
│  │ 🍼 配方奶 120ml   09:30    │    │  ← 记录卡片
│  │    备注：宝宝吃得好         │    │     左滑编辑/删除
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 😴 午睡 1.5小时    08:00   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── 昨天 ──                         │
│  ┌─────────────────────────────┐    │
│  │ 🌡️ 体温 36.8°C    20:30    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ... 加载更多 ...                   │
│                                     │
├─────────────────────────────────────┤
│  + 添加记录                         │  ← FAB 按钮
└─────────────────────────────────────┘
```

#### 交互流程

1. **筛选** → 点击类型标签 → 切换高亮 + 列表即时筛选（无需请求）
2. **搜索** → 点击搜索图标 → 顶栏变为搜索输入框 → 实时搜索备注/类型/数值
3. **时间范围** → 下拉选择（今天/7天/30天/全部）→ 重新请求
4. **左滑操作** → 桌面端 hover 显示操作按钮 → 移动端左滑显示编辑/删除
5. **批量管理** → 点击 ☰ → 进入多选模式 → 底部操作栏（全选/删除）
6. **无限滚动** → 滚动到底部 → 自动加载下一页（loading 指示器）
7. **添加记录** → 点击 FAB → 类型选择 → 打开对应弹窗

#### 状态设计

| 状态 | 表现 |
|------|------|
| 加载中 | 骨架屏卡片列表 |
| 空态 | 居中插图 + "还没有记录" + 添加按钮 |
| 筛选无结果 | "没有找到匹配的记录" |
| 加载更多 | 底部 spinner |
| 全部加载完 | 底部 "没有更多了" 文字 |

---

### 2.5 发现页

**路由**: `/discover` | **组件**: `DiscoverPage` | **小程序映射**: `pages/discover/discover`

#### 布局线框

```
┌─────────────────────────────────────┐
│  发现                               │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔔 疫苗待办                  │    │  ← FocusCard
│  │ 百白破第2剂已逾期，请尽快接种  │    │     紧急度色条
│  │                    查看详情 → │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌──────┐  ┌──────┐               │
│  │ 💉    │  │ 📊    │               │  ← 功能入口网格
│  │疫苗追踪│  │生长曲线│               │     2×2 网格
│  │ 2项待办│  │       │               │
│  └──────┘  └──────┘               │
│  ┌──────┐  ┌──────┐               │
│  │ 🎯    │  │ 🤖    │               │
│  │里程碑  │  │AI助手 │               │
│  │ 1项逾期│  │       │               │
│  └──────┘  └──────┘               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  本周趋势                    │    │  ← InsightSection
│  │  🍼 喂养 5.2次/天 ▬▬▬▬      │    │
│  │  😴 睡眠 13.5h   ▬▬▬▬▬     │    │
│  │  🧷 排便 4.1次/天 ▬▬▬       │    │
│  │           [查看完整报告 →]    │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

#### 交互流程

1. **FocusCard** → 点击跳转对应详情页（疫苗/里程碑）
2. **功能入口** → 点击跳转子页面，带 badge 数字角标
3. **趋势区** → 展开/收起 → "查看完整报告"打开 ReportDialog
4. **待办刷新** → 下拉刷新 → 更新 badge 和 FocusCard

#### 状态设计

| 状态 | 表现 |
|------|------|
| 加载中 | FocusCard 骨架屏 + 网格占位 + 趋势骨架屏 |
| 无待办 | FocusCard 隐藏，显示鼓励卡片 |
| 错误 | 网格正常显示，趋势区 ErrorState |

#### v4.3.x P2 实现约定

- **FocusCard**：3 级 urgency —— `overdue`（有疫苗逾期）→ `upcoming`（有疫苗即将到期）→ `normal`（一切顺利）；按此优先级从后端数据自动决策。
- **功能入口 Grid**：移动端 2 列、桌面端 4 列，右上角 badge 显示完成百分比（仅疫苗 / 里程碑有 badge）。4 个入口：疫苗 / 里程碑 / 生长曲线 / AI 助手。
- **黄疸记录入口（v5.0.0+ 新增）**：在上述 4 入口基础上新增"黄疸记录"一项（入口图标为 `Sun`，accent 色 `var(--warning)`），链接到 `/jaundice`。黄疸记录本期为纯前端 MVP，数据存 `localStorage`（key 前缀 `baby_care_jaundice:${babyId}`），不走后端。
- **成长报告并入功能 Grid（v5.0.0+ 修订）**：原本独占一张大卡（品牌色渐变 + W/M 装饰字）的"成长报告"入口，收敛进功能 Grid 作为第 4 个入口（图标 `BookOpen`，accent 色 `var(--primary)`），与其他入口在视觉上平权，发现页去掉"三层信息分区"带来的视觉噪音。最终 Grid 为 **6 个入口**，栅格调整为 **移动 2 列 / 平板及以上 3 列**（两行布局；不再有桌面 5 列一行的形态，避免图标尺寸与标签过于分散）。
- **成长报告入口（v5.0.0+ 新增）**：在 FocusCard 和功能 Grid **之间**插入一张醒目的「成长报告」入口卡（渐变背景 + 大号装饰字 `W/M` + `BookOpen` 图标 + "周报/月报"pill），点击跳 `/report`。与功能 Grid 中的 5 入口视觉差异化，避免"再加一格"导致信息同质。
- **历史变迁**：v4.3.2 曾在发现页最底部放 `<WeeklyTrendOverview>`（上周 vs 本周对比）；v5.0.0+ 把该能力**整合进成长报告页**（仅"周报"模式展示），发现页自身不再渲染趋势对比卡，避免与记录页的 `<InsightSection>` 三页信息重叠。记录页仍保留 `<InsightSection>`（本周精细视角），作为"数据细节"入口。

#### v7.1 视觉层次 & 间距重构

发现页之前用统一 `space-y-5`（20px）把"标题 / Focus 卡 / 功能 Grid"三块串成一条等距纵列，导致信息分组不清晰。v7.1 把页面拆成两个明确的 `<section>` 信息组并重新分级间距：

```
┌─ <section data-discover-overview> 概览顶部（同组紧凑 16px）
│   LargeTitleHeader "发现 · 照护功能与智能工具"
│   ↓ 16px
│   FocusCard（一切顺利 / 疫苗逾期 / 即将到期）
└─
   ↓ 28px（明确换段）
┌─ <section data-discover-features> 功能入口
│   SectionHeader "功能"（prominent 17px）
│   ↓ 12px
│   Grid: 移动 2 列 / sm+ 3 列
│     ├─ gap mobile 12px / sm+ 16px
│     └─ 卡内：icon(44×44) → 14px → headline → 4px → footnote
└─
```

**间距规范（落于 `globals.css` 真·CSS 兜底，避开 Tailwind 4 JIT 漏扫）**：

| 钩子 | 规则 | 值 |
|------|------|----|
| `[data-discover-page] > section + section` | 区段间换段 | 28px |
| `[data-discover-overview] > * + *` | 概览段内（标题→Focus 卡） | 16px |
| `[data-discover-grid]` | Grid gap | mobile 12px / `@media (min-width: 640px)` 16px |
| `[data-discover-card-icon] + [data-discover-card-title]` | 卡内 icon → 标题 | 14px |
| `[data-discover-card-title] + [data-discover-card-desc]` | 卡内 标题 → 描述 | 4px |

**FocusCard（v7.1）调整**：

- 内边距：原 `padding="md"`（20px）→ `padding="none"` + 自定义 `px-4 py-3.5 sm:px-5 sm:py-4`，移动端少 4-6px、桌面端持平，更适合"单条状态横幅"的 hierarchy。
- icon 与文字：`gap-3`（12px）→ `gap-3.5`（14px），呼吸感更好。
- 标题与描述：`mt-0.5`（2px）→ `mt-1`（4px）+ `truncate` → `line-clamp:2`，长文案（如"测测 的成长进展良好，继续保持"）不再被截断。

**功能 Grid 卡片（v7.1）调整**：

- 内边距：原固定 `padding="md"`（20px 全断点）→ 移动 `p-4`（16px）/ 桌面 `sm:p-5`（20px），移动端更紧凑、桌面端维持。
- 卡内三层间距由 className 改为 `data-discover-card-icon` / `data-discover-card-title` / `data-discover-card-desc` 钩子，间距值在 `globals.css` 真·CSS 段写死（14px / 4px），避免 Tailwind JIT 漏扫造成跑动。
- 描述去掉 `truncate`：双列窄幅下"身高体重头围"等文案不再被裁切；同时 opacity 0.72 → 0.78 提升阅读对比度。
- Badge 位置：`top-2.5 right-2.5` → `top-3 right-3`，留出更多透气空间。

---

### 2.6 个人中心

**路由**: `/profile` | **组件**: `ProfilePage` | **小程序映射**: `pages/profile/profile`

#### 布局线框

```
┌─────────────────────────────────────┐
│  我的                               │
├─────────────────────────────────────┤
│                                     │
│     [头像]                          │
│     昵称                            │
│     家庭：XX的家庭                   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  👶 宝宝管理              → │    │
│  ├─────────────────────────────┤    │
│  │  👨‍👩‍👧 家庭管理              → │    │
│  ├─────────────────────────────┤    │
│  │  📊 成长报告              → │    │
│  ├─────────────────────────────┤    │
│  │  📤 数据导出              → │    │
│  ├─────────────────────────────┤    │
│  │  ⚙️ 设置                  → │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         退出登录             │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

#### 交互流程

1. **头像/昵称** → 点击编辑 → 弹出编辑弹窗
2. **宝宝管理** → 跳转 `/babies`
3. **家庭管理** → 跳转 `/family`
4. **成长报告** → 打开 ReportDialog
5. **数据导出** → 跳转 `/export`
6. **设置** → 跳转 `/settings`
7. **退出登录** → 确认弹窗 → 清除 token → 跳转 `/login`

#### v4.3.x P2 实现约定

- 用户卡头像放大到 64px，副标题行以 pill 标签形式展示"当前宝宝 + 家庭名"。
- 4 个快捷入口合并为单张分组 Cell 卡（iOS 设置风格），减少视觉噪声；每行右侧显示可选 detail 文案（如家庭名 / 宝宝数量）。

#### v5.0.0+ 约定：外观（主题 + 字体）直接内嵌于"我的"页面

历史：v4.3.x P2 曾把主题从"我的"收敛到 Settings → 外观。v5.0.0+ 新增"字体大小 4 档"无障碍特性后，为了让老年人 / 低视力用户一步就能调整，外观被**整体移回"我的"页面**，并拆成两张独立卡：

1. 「主题外观」卡：内嵌 `<ThemeSelector>`（亮色 / 暖夜 / 跟随系统 三档）
2. 「字体大小」卡：内嵌 `<FontScaleSelector>`（小 / 标准 / 大 / 特大 四档）

两张卡紧贴快捷入口下方渲染，不再需要跳转到 Settings。`Settings` 页相应去掉"外观"Tab，仅保留「资料 / 密码 / 导出」三 Tab；老链接 `?tab=appearance` 会兜底回「资料」Tab。

#### v5.0.0+ 修订：快捷入口行高 + 外观卡间距

- **快捷入口每行 padding** 从 `py-3 gap-3`（12px / 12px）→ `py-3.5 gap-3.5`（14px / 14px），字号"大 / 特大"档位下不再挤手。
- **外观两张卡之间额外 +4px 间距**：`[data-profile-stack] > section.card + section.card { margin-top: 28px }`（vs. 其他模块之间 24px），视觉上把「主题」和「字体」拉开一点，避免两张重量级卡片粘连。
- 兼容 Tailwind 4 JIT 漏扫：Profile 页根容器挂 `data-profile-stack` 钩子，`globals.css` 的 "Layout Fallback" 段用真·CSS 写死 24/28px 间距，不依赖 Tailwind。

#### v7.1 修订：Profile 页视觉层次重梳理

历史问题：v5 之前 `[data-profile-stack]` 仅有"行间 20px / 卡卡间 24px"两条规则，导致：
1. SectionHeader 与下方卡片间距与"卡片之间"几乎等距，无法形成"组标题紧贴组内容"的视觉关系；
2. 「账户与数据」和「外观」两组之间的 break 不明显；
3. 「字体大小」卡内"实时预览"卡用 `bg-[var(--bg-elevated)]!`（在 v7 token 下未必生效），与上方 RadioGroup 网格几乎融为一体。

v7.1 重新定义 Profile 页的"组内紧凑、组间 break"节奏：

| 关系 | 间距 | 实现 |
|------|------|------|
| 大标题 → Hero 卡 | 24px | `[data-profile-row='title'] + [data-profile-row='hero']` |
| Hero 卡 → 第一个组标题 | 32px | `[data-profile-row='hero'] + [data-profile-row='group-header']` |
| 组标题 → 该组内容 | 6px | `[data-profile-row='group-header'] + [data-profile-row='group-content']` |
| 同组内容卡之间 | 16px | `[data-profile-row='group-content'] + [data-profile-row='group-content']` |
| 一组最后内容 → 下一个组标题 | 32px | `[data-profile-row='group-content'] + [data-profile-row='group-header']` |
| 字体卡 → 退出登录按钮 | 40px | `[data-profile-logout]` 显式覆盖 |
| 兜底（任意未分类相邻行） | 20px | `[data-profile-stack] > * + *` |

- **Hero 卡**：从 `padding="md"` 升到 `padding="lg"`（24px 内边距），头像-内容 `gap-4 → gap-5`，徽章组与昵称之间 `mt-1.5 → mt-1`（让昵称、邮箱、徽章三段更连贯）；邮箱为空时不再渲染空 `<p>`，避免昵称 + 空白行 + 徽章的破碎感。
- **「账户与数据」/「外观」组标题**：v7.1 里 `<SectionHeader variant="grouped">` **从所属 Card 中拆出来作为独立 stack 行**（`data-profile-row="group-header"`），让"标题与组内容贴合"和"组与组之间 break"两种关系由全局 CSS 统一控制，避免组件内 `mb-2` 在不同上下文下表现不一致。
- **主题卡 / 字体卡**：内部 header 的 icon 圆底从 32×32 升到 36×36（`w-9 h-9 rounded-[10px]`），icon 从 16px 升到 18px，header `mb-3 → mb-4`，与下方控件留出更明显的"区块感"。
- **「实时预览」卡**：从 `bg-[var(--bg-elevated)]!` 改为 `<Card variant="tinted" tintColor="var(--brand)">`，自动获得 brand 10% 柔色底；标题用 `caption-2 uppercase tracking-wide` + `headline` + `body-md` + `caption-1` 四级排版节奏；外层 wrapper `space-y-3 → space-y-4`，避免预览卡与 RadioGroup 网格粘连。
- **退出登录按钮**：标记 `data-profile-logout`，与上一张卡间距强制 40px，强化"破坏性操作"的视觉断裂。

实现入口：`client/src/pages/profile/index.tsx`（DOM 结构调整 + data 标签），间距规则集中在 `client/src/styles/globals.css` 的 "Profile 页节奏" 段。

---

### 2.7 记录弹窗（5个）

所有记录弹窗共享以下交互规范：

#### 2.7.0 实现约定（v4.3.x 起）

- **Dialog 组件**：统一使用 `<Dialog>` + `<DialogFooter>`（`@/components/ui/dialog`），不再直接 `fixed inset-0` 手写。
- **footer slot**：主按钮颜色固定 `var(--primary)`；**禁止**按记录类型给主按钮换底色（类型色只保留在顶部 icon / `SegmentedControl` 内）。
- **尺寸**：默认 `size="md"`（桌面端 max-w-md ≈ 460px）；ConfirmDialog 用 `size="sm"`（max-w-sm）。
- **动画**：移动端 `animate-slide-up`；桌面端 `sm:animate-scale-in`（spring 缓动，0.2s）。
- **四角圆角**：移动端仅顶部两角圆角；桌面端 `sm:rounded-[20px]` 全圆角 + `sm:mx-4` 留边距。
- **内置能力**：ESC 关闭 / 背景点击关闭（可关）/ 焦点陷阱 / body 滚动锁 / 首元素自动 focus。
- **底层**：v4.3.x P3 起基于 `@radix-ui/react-dialog`，自动获得 `aria-labelledby` / 可选 `aria-describedby` / inert 背景 / return-focus / Portal 渲染；对外 API 与旧版 100% 兼容。
- **内边距（v5.0.0+ 调整）**：Header `px-6 pt-5 pb-3`、Body `px-6 pt-2 pb-5`、Footer `px-6 py-4`；移动端拖拽条 `pt-3 pb-1.5`。相比 v4.3.x 的紧凑版本，上下留白各加 4-8px，保存按钮不再贴下边缘。
- **表单字段纵向间距（v5.0.0+ 修订）**：
  - Dialog 里的 `<form>` 统一 `space-y-5`（20px）+ `data-dialog-form` 钩子；**不再使用** `space-y-3 / space-y-4`。
  - `<FormField>` 内部 label ↔ 控件间距统一 `space-y-2`（8px）+ `data-form-field` 钩子；旧版 `space-y-1`（4px）废弃（label 几乎贴着控件）。
  - `<NoteTagPicker>` 内部各区块（预设标签 / 自定义标签 / 新增输入 / 自由文本）`space-y-3`（12px）+ `data-note-tag-picker` 钩子；内嵌输入框 / 按钮 padding 由 `6px 10px` 升到 `8px 12px`。
  - 兼容 Tailwind 4 JIT 漏扫：上述 3 个 `space-y-*` 都通过 `globals.css` "Layout Fallback" 段的 `[data-*] > * + * { margin-top: Npx }` 真·CSS 规则做兜底。

#### 通用弹窗结构

```
┌─────────────────────────────────────┐
│  ─── 下拉指示条 ──                   │  ← 移动端：底部弹出
│  记录类型                 ✕          │  ← 标题栏
├─────────────────────────────────────┤
│                                     │
│          表单内容区                   │  ← 可滚动
│                                     │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │  ← 固定底栏
└─────────────────────────────────────┘
```

- **移动端**：底部弹出，顶部 4px 拖拽条，下滑可关闭
- **桌面端**：居中 Dialog，宽度 480px
- 遮罩：`var(--mask-color-dark)`
- 弹出动画：移动端 `slideUp 0.3s` / 桌面端 `fadeIn + scaleUp 0.2s`

#### FeedingDialog（喂养弹窗）

**组件**: `FeedingDialog` | **小程序映射**: `feeding-popup`

```
┌─────────────────────────────────────┐
│  ─── 喂养记录 ──            ✕       │
├─────────────────────────────────────┤
│                                     │
│  类型选择                           │
│  [母乳] [配方奶] [辅食]             │  ← Tab 切换
│                                     │
│  ── 母乳模式 ──                     │
│  [左侧] [右侧] [双侧]              │  ← 3选1
│  持续时长: [  15  ] 分钟            │
│                                     │
│  ── 配方奶模式 ──                   │
│  用量: [-] 120 [+]  ml              │  ← 快捷累加
│  快捷: 30 60 90 120 150 180 210     │
│                                     │
│  时间: 2026-04-30 09:30             │  ← 日期时间选择
│  备注: [                          ]  │
│                                     │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │
└─────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface FeedingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  editRecord?: Record<FeedingData>;  // 编辑模式
  onCreated?: (record: Record) => void;
}
```

**交互行为**:
- 类型 Tab 切换：`capsuleTransition 0.3s` 动画
- 配方奶快捷累加：点击数字直接设置值，+/- 按钮步进 30ml
- 时间默认当前时间，可修改
- 保存 → 调用 API → 成功 toast + 关闭弹窗 + 刷新列表

#### SleepDialog（睡眠弹窗）

**组件**: `SleepDialog` | **小程序映射**: `sleep-popup`

```
┌─────────────────────────────────────┐
│  ─── 睡眠记录 ──            ✕       │
├─────────────────────────────────────┤
│  类型: [夜间] [午睡]                │
│                                     │
│  ── 已结束 ──                       │
│  开始时间: [2026-04-30 08:00]       │
│  结束时间: [2026-04-30 09:30]       │
│  时长: 1小时30分                     │
│                                     │
│  ── 正在计时 ──                     │
│  🌙 正在睡觉...                     │
│  00:02:30                           │  ← sleepPulse 动画
│  [结束睡眠]                          │
│                                     │
│  地点: [                          ]  │
│  备注: [                          ]  │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │
└─────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface SleepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  editRecord?: Record<SleepData>;
  onCreated?: (record: Record) => void;
  isTimerMode?: boolean;  // 计时模式
}
```

**交互行为**:
- 两种模式：记录已完成睡眠 / 开始计时
- 计时模式：实时计时显示，`sleepPulse` 呼吸动画
- 结束时间自动计算时长
- 计时模式下 "结束睡眠" → 自动填入结束时间

#### DiaperDialog（排便弹窗）

**组件**: `DiaperDialog` | **小程序映射**: `diaper-popup`

```
┌─────────────────────────────────────┐
│  ─── 排便记录 ──            ✕       │
├─────────────────────────────────────┤
│  类型: [小便] [大便] [混合]         │
│                                     │
│  ── 大便详情（大便/混合时显示）──    │
│  质地: [水样] [软] [成形] [硬]      │
│  颜色: [正常] [黄色] [绿色] [黑色] [红色]│
│                                     │
│  时间: [2026-04-30 09:30]          │
│  备注: [                          ]  │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │
└─────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface DiaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  editRecord?: Record<DiaperData>;
  onCreated?: (record: Record) => void;
}
```

#### TemperatureDialog（体温弹窗）

**组件**: `TemperatureDialog` | **小程序映射**: `temperature-popup`

```
┌─────────────────────────────────────┐
│  ─── 体温记录 ──            ✕       │
├─────────────────────────────────────┤
│  体温: [ 36.8 ] °C                  │
│        ━━━━━━━━━━━●━━━━━            │  ← 滑动条 35.0-42.0
│        35.0              42.0       │
│                                     │
│  ⚠️ 37.5-38.0°C 低烧（黄色提示）     │
│  🔴 >38.0°C 发烧（红色警告）         │
│                                     │
│  测量方式:                           │
│  [口腔] [腋下] [直肠] [耳温]        │
│                                     │
│  时间: [2026-04-30 09:30]          │
│  备注: [                          ]  │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │
└─────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface TemperatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  editRecord?: Record<TemperatureData>;
  onCreated?: (record: Record) => void;
}
```

**交互行为**:
- 滑动条 + 数字输入双模式
- 发热预警实时显示：≥37.5 黄色 / ≥38.0 红色
- 体温色条：36-37.2 绿色 / 37.3-38 黄色 / >38 红色

#### GrowthDialog（生长弹窗）

**组件**: `GrowthDialog` | **小程序映射**: `growth-popup`

```
┌─────────────────────────────────────┐
│  ─── 生长记录 ──            ✕       │
├─────────────────────────────────────┤
│  日期: [2026-04-30]                │
│                                     │
│  身高: [  72.5  ] cm               │
│        P50 ━━━━●━━━━ P85           │  ← WHO 百分位指示
│                                     │
│  体重: [   9.2  ] kg               │
│        P50 ━━━━●━━━━ P85           │
│                                     │
│  头围: [  45.0  ] cm（选填）        │
│        P50 ━━━━●━━━━ P85           │
│                                     │
│  备注: [                          ]  │
├─────────────────────────────────────┤
│  [  取消  ]          [  保存  ]     │
└─────────────────────────────────────┘
```

**Props 接口**:
```typescript
interface GrowthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  editRecord?: Record<GrowthData>;
  onSaved?: (record: Record) => void;
}
```

**交互行为**:
- 输入值后实时计算 WHO 百分位，显示百分位条
- 百分位 < P3 或 > P97 显示黄色提示
- 日期选择器：默认今天

#### 2.7.X 记录 Dialog 的时间字段与编辑模式（v4.3.x 起）

5 个记录 Dialog 均新增：

1. **时间字段**：每个 Dialog 内含一个 `<input type="datetime-local">`
   - 字段名：喂养 = "记录时间" / 睡眠 = "开始时间" / 换尿布 = "记录时间" / 体温 = "测量时间" / 生长 = "测量时间"
   - 默认值：当前时间
   - 提交时转换为 ISO 字符串，作为 `startTime` 写入后端
2. **编辑模式**：通过 `editRecord?: CareRecord` prop 进入
   - 打开时根据 `editRecord.startTime` + 对应 `*Data` 字段反序列化所有表单状态
   - Dialog 标题自动变为「编辑X记录」
   - footer 主按钮文案变为「保存修改」
   - 成功 toast 为「已更新」（非编辑模式为「记录已添加」）
3. **回调签名**：`onSubmit(data, meta)`，其中 `meta: { recordTime: string; editingId?: string }`
   - 父组件 `editingId` 有值 → 调用 `recordService.updateRecord(editingId, ...)` ；无值 → `createRecord(...)`

#### 2.7.Y 确认弹窗 ConfirmDialog

所有"二次确认"场景统一走全局 `useConfirm()`（基于 `<Dialog size="sm">` + `<DialogFooter>`）：

```
┌─────────────────────────────────────┐
│  ⚠  解散当前家庭？          ✕        │
├─────────────────────────────────────┤
│                                     │
│  解散后所有成员都将被移除，所有宝宝    │
│  与记录也将一并清理。此操作不可撤销。  │
│                                     │
├─────────────────────────────────────┤
│  [  取消  ]      [ 解散家庭 ]       │  ← variant='danger' 主按钮为 --danger
└─────────────────────────────────────┘
```

- **variant='primary'**（默认）：主按钮 `var(--primary)`，无默认图标。
- **variant='danger'**：主按钮 `var(--danger)`，默认头部图标 `AlertTriangle`。
- **禁用浏览器原生 `window.confirm` / `alert` / `prompt`**（详见 `docs/web-coding-conventions.md §9.1`）。

典型使用场景（v4.3.x 已全部接入）：删除记录 / 删除宝宝 / 删除疫苗 / 删除里程碑 / 退出家庭 / 解散家庭 / 取消进行中睡眠 / 清除 AI 聊天记录 / 退出登录。

#### 2.7.Z 单 Dialog 增强（P1）

- **TemperatureDialog 滑块**：除数字输入外，新增 `<input type="range" min=35 max=42 step=0.1>` 滑块；滑块与数字双向绑定；轨道色（accent-color）随发烧等级切换：
  - `< 37.5°C` → `var(--temperature)`（正常）
  - `37.5–38.5°C` → `var(--warning)`（低烧）
  - `≥ 38.5°C` → `var(--danger)`（高烧）
  - 滑块下方显示三段标签：`35.0` / 「正常 36.0–37.2」/ `42.0`
- **FeedingDialog 快捷用量双模式**：配方奶 8 个快捷按钮（10/30/60/90/120/150/180/210）顶部新增 mini Tab「设值 / 累加」：
  - `设值`（默认）：点击直接覆盖 amount。
  - `累加`：点击叠加（保留旧行为）。
  - 按钮文案随模式切换（`120` vs `+120`）。

---

### 2.8 家庭管理页

**路由**: `/family` | **组件**: `FamilyPage` | **小程序映射**: `packageSocial/pages/family/family`

#### 布局线框

```
┌─────────────────────────────────────┐
│  ← 家庭管理                         │
├─────────────────────────────────────┤
│                                     │
│  家庭名称: XX的家庭                  │
│  邀请码: ABC123                     │
│  有效期至: 2026-05-07               │
│  [复制邀请码]  [刷新邀请码]          │
│                                     │
│  ── 成员列表 ──                     │
│  ┌─────────────────────────────┐    │
│  │ [头像] 妈妈  管理员    ⋮    │    │  ← 更多操作
│  ├─────────────────────────────┤    │
│  │ [头像] 爸爸  编辑者    ⋮    │    │
│  ├─────────────────────────────┤    │
│  │ [头像] 奶奶  查看者    ⋮    │    │
│  └─────────────────────────────┘    │
│                                     │
│  [邀请新成员]                       │
│  [退出家庭]                         │
│  [解散家庭]（仅管理员可见）           │
│                                     │
└─────────────────────────────────────┘
```

#### 交互流程

1. **复制邀请码** → 点击复制到剪贴板 → toast "已复制"
2. **刷新邀请码** → 确认弹窗 → 刷新 + 新有效期
3. **成员操作** → 点击 ⋮ → 下拉菜单（更改角色/移除成员）
4. **退出家庭** → 确认弹窗（二次确认）→ 退出 → 跳转引导页
5. **解散家庭** → 确认弹窗（输入家庭名确认）→ 解散 → 跳转引导页

---

### 2.9 AI 助手对话页

**路由**: `/ai-assistant` | **组件**: `AIAssistantPage` | **小程序映射**: `packageSocial/pages/ai-assistant/ai-assistant`

#### 布局线框

```
┌─────────────────────────────────────┐
│  ← AI 育儿助手          今日 42/100 │  ← 配额指示
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🤖 今天宝宝喂养3次，睡眠   │    │  ← AI 消息气泡
│  │ 达标，整体表现良好。        │    │     左对齐
│  └─────────────────────────────┘    │
│                                     │
│         ┌─────────────────────────┐ │
│         │ 宝宝睡眠时间够吗？     │ │  ← 用户消息气泡
│         └─────────────────────────┘ │     右对齐
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🤖 根据记录，宝宝今天...   │    │  ← 流式打字效果
│  │ ▌                            │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  💬 [输入问题...        ]  [发送]   │  ← 输入栏
└─────────────────────────────────────┘
```

#### 交互流程

1. **页面加载** → 自动生成今日概览（AI 每日洞察）
2. **发送消息** → 用户输入 → 发送 → AI 流式响应（逐字打字效果）
3. **配额耗尽** → 输入框禁用 + 提示"今日配额已用完"
4. **快捷问题** → 预设问题卡片（"喂养建议"/"睡眠分析"/"发育评估"）
5. **上下文** → 自动携带宝宝基本信息和近期记录

#### v4.3.x P2 实现约定

- **气泡样式**：`border-radius: 18px 18px 4px 18px`（用户，尖角指向右下）/ `18px 18px 18px 4px`（AI，尖角指向左下）。
- **暖夜模式适配**：AI 气泡底色改为 `color-mix(in srgb, var(--primary) 6%, var(--bg-card))`，原 `var(--bg-secondary)` 在暖夜模式下对比度不足。
- **时间戳**：每条消息下方显示小号灰色时间戳（同日 `HH:mm`，跨日 `M月D日 HH:mm`），消息 VM 结构扩展 `ts?: number`，发送给后端时剥离。
- **配额位置**：`<QuotaBar variant="badge"/>` 融入 sticky 顶栏右侧（`Trash2` 按钮左侧），不再独占一行。
- **本地历史上限**：`localStorage` 历史从 100 条降到 50 条，控制 `localStorage` 占用。

---

### 2.10 成长报告（v5.0.0+）

**路由**: `/report` | **组件**: `ReportPage` | **小程序映射**: —（Web 独有）

#### 线框

```
┌─────────────────────────────────────┐
│  ← 成长报告           [分享]         │  ← PageHeader(sub) + HeaderAction(secondary)
├─────────────────────────────────────┤
│  ⦿ 本周报告 | 本月报告               │  ← Tab 切换
├─────────────────────────────────────┤
│ ┌─ 封面 ────────────────────────  W │ │  ← ReportCover
│ │  📖 本周报告                     │ │     渐变背景 + 大号装饰字
│ │  小宝                            │ │
│ │  3 月龄 · 5.1 – 5.7（共 7 天）    │ │
│ └──────────────────────────────────┘ │
│                                     │
│  本期关键指标                        │
│  ┌────┐┌────┐┌────┐┌────┐          │  ← ReportMetricsGrid
│  │喂养 ││睡眠 ││尿布 ││体温 │          │     移动 2x2 / 桌面 4 列
│  │ 32次││45h ││ 28次││ 3次 │          │
│  └────┘└────┘└────┘└────┘          │
│                                     │
│  上周 vs 本周（仅周报）              │  ← 复用 WeeklyTrendOverview
│  [单卡 4 行对比 + AI 入口]          │
│                                     │
│  每日节律                            │
│  [双色柱图：喂养(左) / 睡眠(右)]    │  ← ReportDailyRhythm
│                                     │
│  生长情况                            │
│  体重 9.2kg (+0.3kg)                │  ← ReportGrowthSection
│  身高 72.5cm (+1.2cm)               │
│  头围 45cm  (持平)                   │
│                                     │
│  里程碑 & 疫苗                       │
│  [左右双卡：新达成的 / 已接种的]    │  ← ReportAchievements
│                                     │
│  AI 总结                             │
│  [点按生成 → 文案 + 跳 AI 详聊]     │  ← ReportAiSummary
│                                     │
│  [       分享这份报告       ]        │
└─────────────────────────────────────┘
```

#### 交互流程

1. **入口**：发现页「成长报告」入口卡 → 默认进入本周报告
2. **周/月切换**：顶部 Tab Pill 切换，`useReportData` 按新周期重新聚合
3. **数据加载**：首次渲染显示 `<ListSkeleton count={4} />`；所有小卡独立加载，不相互阻塞
4. **空态**：无 currentBaby → 整页空态；本期无数据 → 每个模块各自显示温和空态（"本期还没有 XX 记录"）
5. **AI 总结**：默认**不自动请求**，用户点"生成"按钮才触发一次 `aiService.chat`；session 内缓存，重复点击不再消耗配额。失败不阻塞整页，降级为「去 AI 助手详聊」
6. **分享**：`renderReportImage` 生成 JPEG → 优先 `navigator.share`（移动端）→ 降级 `download` 到本地；成功 toast

#### 数据聚合策略

- **不新增后端接口**，完全基于既有：
  - `GET /records?babyId&startDate&endDate&pageSize=500` → 本期所有记录，前端聚合关键指标 / 每日节律 / 生长快照
  - `GET /babies/:id/vaccines` → 拉全量后按本期 `vaccinatedDate` 过滤
  - `GET /babies/:id/milestones` → 拉全量后按本期 `achievedDate` 过滤
  - `GET /babies/:id/trend/weekly` → 仅周报模式展示
  - `POST /ai/chat` → AI 总结，复用 `autoPrompt` 协议
- 时间窗口：
  - 周报：本周一 00:00 → 今天 23:59:59（受 birthDate 限制）
  - 月报：本月 1 号 00:00 → 今天 23:59:59（受 birthDate 限制）

#### 状态设计

| 状态 | 表现 |
|------|------|
| 加载中 | 封面与 Tab 立即渲染，下方 ListSkeleton |
| 无宝宝 | 整页空态插图 + 提示 |
| 本期无数据 | 各模块独立空态，不影响其他模块渲染 |
| AI 生成中 | 按钮内 Loader2 spin + "正在生成…" |
| AI 生成失败 | toast.error，按钮恢复可点击 |
| 分享生成中 | "分享"按钮禁用 + 文案变"生成中" |

---

## 3. 组件交互规范

### 3.1 记录弹窗组件

详见 §2.7，以下为通用规范：

| 属性 | 说明 |
|------|------|
| `open` | 控制弹窗显隐 |
| `onOpenChange` | 弹窗关闭回调 |
| `babyId` | 当前宝宝 ID |
| `editRecord` | 编辑模式的记录数据 |
| `onCreated`/`onSaved` | 保存成功回调 |

**通用交互**:
- 打开：遮罩 fade in 0.2s → 弹窗 slideUp 0.3s
- 关闭：弹窗 slideDown 0.2s → 遮罩 fade out 0.15s
- 移动端下滑关闭：`useSwipeToDismiss` Hook，阈值 100px
- 保存中：按钮 loading + 表单禁用
- 保存成功：toast 提示 + 弹窗关闭 + 列表刷新

### 3.2 Timeline 时间线组件

**组件**: `Timeline` | **小程序映射**: `timeline` | **基础组件**: 自定义

```typescript
interface TimelineProps {
  records: CareRecord[]
  className?: string
}
```

**当前实现范围（v4.3.2）**：首页「今日时间线」使用，仅展示，不承载左滑/长按/管理模式等交互（记录页用独立卡片列表实现编辑/删除）。规划中的 `swipeEnabled / manageMode / onSwipe*` 等 props 暂未实现。

**单条记录的内容分层**：
1. **第一行**：类型名 + 关键指标徽章（pill）+ 体温告警副标签 + 时间（右对齐，等宽数字）
   - 关键指标按类型选取最具识别度的一个值：配方奶 = `120ml`；母乳 = `左侧 · 15分`；睡眠 = `1小时30分`；换尿布 = `尿 / 便 / 尿+便`；体温 = `37.2°C`（≥38=danger / ≥37.5=warning）；生长 = 体重/身高/头围优先。
   - 体温告警副标签：≥38 显示 `发烧`（danger），≥37.5 显示 `低烧`（warning）。
2. **第二行**：结构化摘要，复用 `getRecordSummary(record)`（来自 `lib/record.ts`），与记录页描述完全一致。
3. **第三行（条件出现）**：
   - ⏱ `持续 X小时X分`：当记录存在 `endTime`（例如结束后的睡眠）
   - 👤 创建者昵称：仅当 `creator.id !== currentUserId`（家庭协作场景凸显"由谁记录"）
   - 💬 备注：若有 `note`，单行截断

**样式约定**：
- 图标圆点：30×30，类型色 `color-mix 15%` 底 + 类型色图标。
- 徽章：`caption` + `px-1.5 py-0.5 rounded-full` + `color-mix 12%` 底 + 类型色文字 + `number-display`。
- 异常颜色仅来自 `--danger` / `--warning`，不引入硬编码色值。
- 连接线 `left-[15px]` 对齐圆点中心，最后一条不渲染。

### 3.3 InsightSection 数据洞察区

**组件**: `InsightSection` | **小程序映射**: `insight-section` | **基础组件**: `shadcn/ui Card`

```typescript
interface InsightSectionProps {
  babyId: string;
  onShowReport?: () => void;
}
```

**交互行为**:
- 骨架屏 → 数据加载 → 渐显
- 范围条：`progressGrow 0.6s` 动画
- 状态标签：达标(绿)/偏高(橙)/偏低(红) + 文字
- 智能提示：条件触发，`fadeInUp 0.3s`
- "查看报告" → 触发 `onShowReport`

### 3.4 FocusCard 聚焦卡片

**组件**: `FocusCard` | **小程序映射**: `focus-card` | **基础组件**: `shadcn/ui Card`

```typescript
interface FocusCardProps {
  type: 'vaccine' | 'milestone' | 'encouragement';
  title: string;
  description: string;
  icon?: React.ReactNode;
  urgency: 'overdue' | 'upcoming' | 'normal';
  targetUrl?: string;
  onClick?: () => void;
}
```

**样式特性**:
- 左侧 3px 色条：overdue=`var(--danger-color)` / upcoming=`var(--warning-color)` / normal=`var(--success-color)`
- urgency 标签：pill 形状，`var(--radius-pill)`
- hover：`translateY(-2px)` + `shadow` 增强

### 3.5 BabyCard 宝宝卡片

**组件**: `BabyCard` | **小程序映射**: `baby-card` | **基础组件**: `shadcn/ui Card`

```typescript
interface BabyCardProps {
  baby: Baby;
  onClick?: (baby: Baby) => void;
  selected?: boolean;
}
```

**交互行为**:
- 选中态：`border: 2px solid var(--primary-color)` + 微缩放
- hover：`translateY(-1px)` + `var(--shadow-soft)`
- 头像 + 姓名 + 年龄（出生天数/月龄）

### 3.6 ReportDialog 成长报告

**组件**: `ReportDialog` | **小程序映射**: `report-popup` | **基础组件**: `shadcn/ui Dialog`

```typescript
interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babyId: string;
  onShareReady?: (imageUrl: string) => void;
}
```

**交互行为**:
- Tab 切换：周报/月报
- 图表区域：加载动画 → 渐显
- 分享：生成 Canvas 图片 → 下载/复制
- 桌面端：宽度 640px 居中弹窗

### 3.7 ExportDialog 导出弹窗

**组件**: `ExportDialog` | **小程序映射**: `export-popup` | **基础组件**: `shadcn/ui Dialog`

```typescript
interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**交互行为**:
- 选择导出范围 → 点击导出 → 生成 JSON → 下载

### 3.8 ErrorState 错误状态

**组件**: `ErrorState` | **小程序映射**: `error-state` | **基础组件**: 自定义

```typescript
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}
```

**交互行为**:
- 居中显示错误插图 + 消息 + 重试按钮
- 重试按钮：`var(--primary-color)` 主按钮样式

### 3.9 BabyEditDialog 宝宝编辑弹窗

**组件**: `BabyEditDialog` | **小程序映射**: `baby-edit-popup` | **基础组件**: `shadcn/ui Dialog`

```typescript
interface BabyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baby?: Baby;
  onSaved?: (baby: Baby) => void;
}
```

**交互行为**:
- 创建/编辑模式复用同一组件
- 头像上传：点击头像区域 → 选择文件 → 上传
- 表单字段：姓名、昵称、性别、出生日期
- 删除宝宝：二次确认（输入宝宝姓名）

### 3.10 通用 Hooks

#### useSwipeToDismiss

替代小程序 `swipe-close` Behavior：

```typescript
interface UseSwipeToDismissOptions {
  threshold?: number;      // 默认 100px
  resistance?: number;     // 默认 0.5
  maxSlide?: number;       // 默认 300px
  onDismiss: () => void;
}

function useSwipeToDismiss(options: UseSwipeToDismissOptions): {
  translateY: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}
```

#### useTheme

替代小程序 `ThemeManager`：

```typescript
interface UseThemeReturn {
  mode: 'light' | 'dark' | 'system';
  isDark: boolean;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  toggleMode: () => void;
}
```

---

## 4. 设计变量

### 4.1 CSS 变量完整定义

#### 亮色模式 (`::root`)

```css
::root {
  /* === 主色调 === */
  --primary-color: #D4B896;
  --primary-light: #E8DCC8;
  --primary-dark: #8B7B6B;
  --accent-color: #B8D4B8;

  /* === 功能色（按业务域）=== */
  --feeding-color: #A8D4A8;
  --sleep-color: #B8A8D4;
  --diaper-color: #D4C8A8;
  --temperature-color: #D4A8A8;
  --growth-color: #7BA9C9;

  /* === 语义色 === */
  --success-color: #7BC950;
  --danger-color: #E85454;
  --warning-color: #D4883D;
  --info-color: #7BA3C9;

  /* === 文字色阶 === */
  --text-primary: #3D3D3D;
  --text-secondary: #666666;
  --text-hint: #999999;

  /* === 背景色 === */
  --bg-primary: #F5F1EB;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;

  /* === 表面层次 === */
  --surface-elevated: rgba(212, 184, 150, 0.06);

  /* === 边框 === */
  --border-color: rgba(139, 123, 107, 0.1);

  /* === 间距 (8px 基础网格) === */
  --spacing-xs: 4px;      /* 0.25rem */
  --spacing-sm: 8px;      /* 0.5rem */
  --spacing-md: 16px;     /* 1rem */
  --spacing-lg: 24px;     /* 1.5rem */
  --spacing-xl: 32px;     /* 2rem */
  --spacing-xxl: 48px;    /* 3rem */

  /* === 圆角 === */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 9999px;

  /* === 阴影 (棕色调) === */
  --shadow-card: 0 2px 16px rgba(139, 123, 107, 0.10);
  --shadow-card-elevated: 0 8px 32px rgba(139, 123, 107, 0.14);
  --shadow-soft: 0 2px 8px rgba(139, 123, 107, 0.06);
  --shadow-float: 0 16px 48px rgba(139, 123, 107, 0.16);
  --shadow-glow-primary: 0 0 24px color-mix(in srgb, var(--primary) 24%, transparent);
  --shadow-popup: 0 4px 24px rgba(139, 123, 107, 0.12);
  --elevation-1: 0 1px 4px rgba(139, 123, 107, 0.04);
  --elevation-2: 0 2px 8px rgba(139, 123, 107, 0.06);

  /* === 遮罩 === */
  --mask-color: rgba(139, 123, 107, 0.4);
  --mask-color-dark: rgba(61, 52, 39, 0.6);

  /* === 过渡 === */
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;

  /* === 功能按钮渐变 === */
  --feeding-btn-end: #8BC48B;
  --sleep-btn-end: #9B8BC4;
  --diaper-btn-end: #A09068;
  --temperature-btn-end: #C48B8B;
  --growth-btn-start: #7BA9C9;
  --growth-btn-end: #5B8FAF;
  --fab-start: #D4A574;
  --fab-end: #A67C52;

  /* === v6.0 渐变 Token === */
  --gradient-primary: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  --gradient-feeding: linear-gradient(135deg, #A8D4A8 0%, #8BC48B 100%);
  --gradient-sleep: linear-gradient(135deg, #B8A8D4 0%, #9B8BC4 100%);
  --gradient-diaper: linear-gradient(135deg, #D4C8A8 0%, #A09068 100%);
  --gradient-temperature: linear-gradient(135deg, #D4A8A8 0%, #C48B8B 100%);
  --gradient-growth: linear-gradient(135deg, #7BA9C9 0%, #5B8FAF 100%);
  --gradient-warning: linear-gradient(135deg, var(--warning) 0%, color-mix(in srgb, var(--warning) 70%, var(--danger)) 100%);

  /* === v6.0 玻璃态 Token === */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-bg-dark: rgba(30, 26, 22, 0.72);
  --glass-blur: 12px;
  --glass-border: rgba(139, 123, 107, 0.12);
  --glass-shadow: 0 4px 24px rgba(139, 123, 107, 0.08);

  /* === 密度块色 === */
  --density-level-0: #F5F1EB;
  --density-level-2: #D4B896;
  --density-level-3: #B89868;
  --density-level-4: #8B7348;
}
```

#### 暖夜模式 (`.dark-mode`)

```css
.dark-mode {
  /* === 背景色 === */
  --bg-primary: #1E1A16;
  --bg-secondary: #2A2420;
  --bg-card: #2A2420;

  /* === 表面层次 === */
  --surface-elevated: rgba(212, 184, 150, 0.04);

  /* === 文字色阶 === */
  --text-primary: #E8E0D8;
  --text-secondary: #B0A898;
  --text-hint: #7A7068;

  /* === 功能色降饱和 === */
  --feeding-color: #7CAF7C;
  --sleep-color: #9488B4;
  --diaper-color: #B0A480;
  --temperature-color: #B48888;
  --growth-color: #5C8CA8;

  /* === 边框 === */
  --border-color: rgba(212, 184, 150, 0.08);

  /* === 阴影 (暗色黑阴影) === */
  --shadow-card: 0 2px 16px rgba(0, 0, 0, 0.35);
  --shadow-card-elevated: 0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-float: 0 16px 48px rgba(0, 0, 0, 0.55);
  --shadow-glow-primary: 0 0 24px color-mix(in srgb, var(--primary) 16%, transparent);
  --shadow-popup: 0 4px 24px rgba(0, 0, 0, 0.5);
  --elevation-1: 0 1px 4px rgba(0, 0, 0, 0.15);
  --elevation-2: 0 2px 8px rgba(0, 0, 0, 0.2);

  /* === 遮罩 === */
  --mask-color: rgba(0, 0, 0, 0.6);
  --mask-color-dark: rgba(0, 0, 0, 0.75);

  /* === 功能按钮渐变 === */
  --feeding-btn-end: #5C8F5C;
  --sleep-btn-end: #7A6898;
  --diaper-btn-end: #A09068;
  --temperature-btn-end: #A07070;
  --growth-btn-start: #5A8CA8;
  --growth-btn-end: #4A7A94;
  --fab-start: #B08858;
  --fab-end: #886438;

  /* === v6.0 渐变 Token (暗色降饱和) === */
  --gradient-primary: linear-gradient(135deg, #B09878 0%, #7A6A58 100%);
  --gradient-feeding: linear-gradient(135deg, #7CAF7C 0%, #5C8F5C 100%);
  --gradient-sleep: linear-gradient(135deg, #9488B4 0%, #7A6898 100%);
  --gradient-diaper: linear-gradient(135deg, #B0A480 0%, #887858 100%);
  --gradient-temperature: linear-gradient(135deg, #B48888 0%, #A07070 100%);
  --gradient-growth: linear-gradient(135deg, #5C8CA8 0%, #4A7A94 100%);
  --gradient-warning: linear-gradient(135deg, #B07838 0%, color-mix(in srgb, #B07838 70%, #C05050) 100%);
  --gradient-danger: linear-gradient(135deg, #D44444 0%, #B03030 100%);

  /* === v6.0 玻璃态 Token (暗色更透明) === */
  --glass-bg: rgba(42, 36, 32, 0.72);
  --glass-bg-dark: rgba(30, 26, 22, 0.85);
  --glass-blur: 16px;
  --glass-border: rgba(212, 184, 150, 0.10);
  --glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);

  /* === 密度块色 === */
  --density-level-0: #3D3428;
  --density-level-2: #A08050;
  --density-level-3: #886840;
  --density-level-4: #705838;

  /* === 暖白 === */
  --white: #E8E0D8;
}
```

### 4.2 字体排版

```css
:root {
  --font-family: 'PingFang SC', 'Source Han Sans CN', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* 标题 */
  --text-hero: 2.25rem;      /* 36px, 原 56rpx */
  --text-title-lg: 1.5rem;   /* 24px, 原 48rpx */
  --text-title-md: 1.125rem; /* 18px, 原 36rpx */
  --text-title-sm: 1rem;     /* 16px, 原 32rpx */

  /* 正文 */
  --text-body-lg: 0.9375rem; /* 15px, 原 30rpx */
  --text-body-md: 0.875rem;  /* 14px, 原 28rpx */
  --text-body-sm: 0.75rem;   /* 12px, 原 24rpx */

  /* 辅助 */
  --text-caption: 0.625rem;  /* 10px, 原 20rpx */

  /* 行高 */
  --leading-tight: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  /* 字重 */
  --font-semibold: 600;
  --font-medium: 500;
  --font-regular: 400;
}
```

#### 4.2.1 字体大小 4 档无障碍适配（FR-G1.2）

用户可在「设置 → 外观」切换字体档位，应用全局立即生效：

| 档位 | `data-font-scale` | 倍率 | 适用场景 |
|------|------|------|------|
| 小 | `sm` | ~0.9x | 小屏、信息密度需求 |
| 标准 | `md` | 1.0x（默认） | 常规 |
| 大 | `lg` | ~1.15x | 长辈友好 / 阅读偏好 |
| 特大 | `xl` | ~1.35x | 老年人 / 低视力；额外放宽行高与按钮 padding |

实现：`<html data-font-scale="…">` + `globals.css` 内 `:root[data-font-scale='…']` 覆盖 `--text-xs` 到 `--text-3xl`；语义类 `.heading-* / .body-* / .caption` 自动响应。

**UI 规范**：
- 写页面时**必须**使用语义类（`heading-lg` / `body-md` / `caption` 等）或 `var(--text-*)`，**禁止**写死 `text-[14px]` / `font-size: 14px` 之类的绝对值。
- 特大档位下 `btn-primary` / `btn-secondary` / `chip` / `input-base` 的 padding 会自动放大，以保持触摸目标 ≥ 48×48px。
- 字体档位与主题（亮 / 暖夜 / 系统）**完全正交**，可任意组合。

### 4.3 动效规范

```css
:root {
  /* 动画时长 */
  --duration-instant: 0.1s;
  --duration-fast: 0.2s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;

  /* v6.0 新增动画时长 */
  --duration-slower: 0.7s;
  --duration-spring: 0.3s;

  /* 缓动函数 */
  --ease-default: ease;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* 动画定义 */
  --animate-fade-in: fadeIn 0.3s var(--ease-out);
  --animate-fade-in-up: fadeInUp 0.4s var(--ease-out);
  --animate-slide-up: slideUp 0.3s var(--ease-out);
  --animate-slide-down: slideDown 0.2s var(--ease-in);
  --animate-scale-in: scaleIn 0.2s var(--ease-spring);
  --animate-shimmer: shimmer 1.5s infinite;
  --animate-pulse: pulse 2s infinite;
  --animate-breathe: breathe 1.5s infinite;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes progressGrow { from { width: 0; } }

/* v6.0 新增关键帧 */
@keyframes numberRoll {
  0% { transform: translateY(8px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes breatheGlow {
  0%, 100% { opacity: 0.6; box-shadow: 0 0 8px color-mix(in srgb, var(--primary) 20%, transparent); }
  50% { opacity: 1; box-shadow: 0 0 20px color-mix(in srgb, var(--primary) 40%, transparent); }
}
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* v6.0 prefers-reduced-motion 无障碍 */
@media (prefers-reduced-motion: reduce) {
  .animate-number-roll,
  .animate-breathe-glow,
  .animate-float,
  .animate-breathe,
  .animate-pulse,
  .animate-shimmer { animation: none !important; }
  .page-enter { animation: none !important; }
}
```

### 4.4 响应式断点

```css
/* Tailwind 断点配置 */
/* sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */

/* 项目自定义断点 */
--breakpoint-mobile: 0;      /* < 640px  底部 TabBar */
--breakpoint-tablet: 640px;  /* 640-1024px  侧边栏紧凑 */
--breakpoint-desktop: 1024px; /* > 1024px  侧边栏展开 */
--breakpoint-wide: 1280px;   /* > 1280px  内容区限宽 1200px */
```

**布局规则**:

| 断点 | 导航 | 内容宽度 | 卡片列数 | 弹窗位置 |
|------|------|---------|---------|---------|
| < 640px | 底部 TabBar | 100% - padding | 1列 | 底部弹出 |
| 640-1024px | 侧边栏紧凑 (64px) | calc(100% - 64px) | 2列 | 底部弹出 |
| > 1024px | 侧边栏展开 (220px) | max 1200px 居中 | 3列 | 居中 Dialog |

**响应式设计要点**:
- 移动优先：默认移动端样式，通过 `md:` / `lg:` 前缀增强
- 内容区最大宽度 1200px，超出后居中
- 卡片网格：移动端 1列 → 平板 2列 → 桌面 3列
- 弹窗：移动端全宽底部弹出 → 桌面端居中固定宽度
- 触摸区域：最小 44×44px（移动端），按钮高度 48px
- 时间线列表始终单列

---

## 5. 关键交互流程图

### 5.1 新用户注册 → 创建家庭 → 添加宝宝 → 首条记录

```
用户访问应用
    │
    ▼
检查 JWT ──有效──→ 首页
    │ 无效
    ▼
登录页
    │ 点击"立即注册"
    ▼
注册页 ──填写邮箱+密码──→ 注册请求
    │                        │
    │                     成功/失败
    │                        │
    │                   自动登录成功
    ▼
检查家庭状态
    │
    ├── 已有家庭 ──→ 首页
    │
    └── 无家庭 ──→ 引导页
                     │
                     ▼
              ┌──────────────┐
              │ 创建家庭      │ ← 输入家庭名称
              │ 或加入家庭    │ ← 输入邀请码
              └──────┬───────┘
                     │
                     ▼
              添加宝宝
              (姓名/性别/出生日期)
                     │
                     ▼
              首页（空态引导）
              "点击下方添加首条记录"
                     │
                     ▼
              点击「今日概览」对应卡片
                     │
                     ▼
              选择记录类型
              (喂养/睡眠/排便/体温/生长)
                     │
                     ▼
              填写记录详情 → 保存
                     │
                     ▼
              时间线出现首条记录 ✓
```

### 5.2 邀请成员加入家庭

```
管理员操作
    │
    ▼
个人中心 → 家庭管理
    │
    ▼
查看邀请码 (ABC123)
    │
    ├── [复制邀请码] → 复制到剪贴板 → 分享给家人
    │
    └── [刷新邀请码] → 确认弹窗 → 生成新码
                              │
                              ▼
新成员收到邀请码
    │
    ▼
注册/登录 → 引导页 → 选择"加入家庭"
    │
    ▼
输入邀请码 (ABC123) → 提交
    │
    ├── 邀请码有效 → 加入成功 → 进入首页（同步家庭数据）
    │
    ├── 邀请码过期 → 提示"邀请码已过期，请联系管理员刷新"
    │
    └── 邀请码错误 → 提示"邀请码无效"
```

### 5.3 记录 CRUD 完整流程

```
=== 创建记录 ===

用户点击「今日概览」卡片 (首页) / FAB (记录页) / 时间线空白引导
    │
    ▼
选择记录类型 → 打开对应弹窗
    │
    ▼
填写表单
    │
    ├── 实时校验（必填项、数值范围）
    │
    ├── 时间默认当前（可修改）
    │
    └── 备注选填
    │
    ▼
点击 [保存]
    │
    ├── 乐观更新：列表即时显示新记录
    │
    ├── API 请求
    │   ├── 成功 → toast "记录已保存" + 关闭弹窗
    │   └── 失败 → 回滚乐观更新 + toast "保存失败"
    │
    └── 离线 → 写入 IndexedDB 离线队列 + 标记为待同步

=== 查看记录 ===

时间线中点击记录卡片
    │
    ▼
展开详情（弹窗只读模式）
    │
    └── 显示完整字段 + 编辑按钮

=== 编辑记录 ===

方式1：左滑 → 点击编辑 → 打开弹窗编辑模式
方式2：详情弹窗 → 点击编辑
    │
    ▼
表单预填现有数据 → 修改 → 保存
    │
    └── 乐观更新 + API 请求

=== 删除记录 ===

方式1：左滑 → 点击删除
方式2：详情弹窗 → 点击删除
方式3：批量管理模式 → 多选 → 批量删除
    │
    ▼
确认弹窗 "确定删除这条记录？"
    │
    ▼
确认删除
    │
    ├── 列表移除该记录（动画：高度收缩 + 淡出）
    ├── API 请求
    │   ├── 成功 → 完成
    │   └── 失败 → 恢复记录 + toast
    └── 离线 → 标记为待删除 + 离线队列
```

### 5.4 离线状态下的用户提示

```
应用检测到网络状态变化
    │
    ├── 在线 → 离线
    │   │
    │   ▼
    │   顶栏显示离线横幅（橙色条）
    │   "网络不可用，记录将保存到本地"
    │   │
    │   ▼
    │   用户继续操作
    │   │
    │   ├── 创建记录 → 写入 IndexedDB → 本地列表即时显示
    │   │                     │
    │   │                     └── 标记为 "待同步"（带同步图标）
    │   │
    │   ├── 编辑记录 → 本地更新 → 标记 "待同步"
    │   │
    │   └── 删除记录 → 本地删除 → 标记 "待删除"
    │
    └── 离线 → 在线
        │
        ▼
        自动触发同步
        │
        ▼
        顶栏显示同步进度条
        "正在同步 3 条记录..."
        │
        ├── 逐条同步
        │   ├── 成功 → 移除待同步标记
        │   └── 失败 → 重试（最多3次）
        │
        └── 全部完成
            │
            ▼
            隐藏进度条
            离线横幅消失
            Toast "所有记录已同步"
```

---

## 6. shadcn/ui 组件映射总表

> **v5.0.1 重构路线**：本项目不直接使用 `shadcn/ui` CLI 生成的代码（会与美拉德色系 + 字体 4 档体系冲突），改为 **"shadcn 设计模式 + 自研实现 + CVA"**：
> - 组件 API（子组件结构 / variant 命名 / props 形状）对标 shadcn/ui 官方
> - 样式底层全部走 `var(--*)` CSS 变量，与现有主题/字体档位零冲突
> - 需要 A11y 复杂度的组件（Dialog / DropdownMenu / Popover / Tooltip / Tabs / ...）以 `@radix-ui/*` 为底座，和 `shadcn/ui` 的底层一致
> - 所有 variant 通过 `class-variance-authority` 管理，避免 `if variant === 'x'` 分支渲染
>
> 下表新列 **"自研组件"** 指向 `client/src/components/ui/*` 的实际文件。

| Web 业务组件 | shadcn 对标 | 自研 Primitive（Batch 进度） | 说明 |
|---------|---------------|------------|------|
| `FeedingDialog` | Dialog + Tabs | ✅ `<Dialog>` + `<SegmentedControl>` + `<FormField>` + `<Input>` + `<Button>`（Batch 2 完成） | 底部弹出/居中弹窗；快捷用量 8 按钮使用 `<Button variant="outline" size="xs">` |
| `SleepDialog` | Dialog + Tabs + Timer | ✅ 同上（Batch 2 完成） | 计时器由 TodaySummary / StatusCapsule 承担 |
| `DiaperDialog` | Dialog + ToggleGroup | ✅ `<Dialog>` + `<FormField>` + `<SegmentedControl>`（Batch 2 完成） | 类型/质地/颜色均用 SegmentedControl |
| `TemperatureDialog` | Dialog + Slider + Input | ✅ `<Dialog>` + `<Slider>` + `<Input variant="warning/danger">` + `<Alert>`（Batch 2 完成） | 体温滑块+数字输入；发烧预警用 Alert |
| `GrowthDialog` | Dialog + Input | ✅ `<Dialog>` + `<FormField>` + `<Input rightIcon="cm/kg">`（Batch 2 完成） | WHO 百分位可视化（RangeIndicator 预留 Batch 3） |
| `JaundiceDialog` | Dialog + ToggleGroup | ✅ `<Dialog>` + `<FormField>` + `<Badge interactive>`（Batch 2 完成） | 多选标签使用 Badge interactive |
| `RoleEditDialog` | Dialog + RadioGroup | ✅ `<RadioGroup>` + `<RadioGroupCard>`（Batch 2 完成） | 三选一权限切换 |
| `TransferAdminDialog` | Dialog + RadioGroup | ✅ `<RadioGroup>` + `<RadioGroupCard>` + `<Alert>`（Batch 2 完成） | 候选成员卡片式选择 |
| `RemoveMemberConfirm` | Dialog + Input | ✅ `<Alert variant="danger">` + `<FormField>` + `<Input>`（Batch 2 完成） | 输入"确认移除"二次确认 |
| `AddRecordMenu` | DropdownMenu | ✅ `<Button>` + `<DropdownMenu>`（Batch 2 完成） | 替代手写 useRef + useEffect(mousedown) |
| 成员⋮菜单 | DropdownMenu | ✅ `<IconButton>` + `<DropdownMenu>`（Batch 2 完成） | 家庭成员操作 |
| SidebarBabyCard | DropdownMenu | ✅ `<DropdownMenu side="top">`（Batch 2 完成） | 桌面侧栏底部宝宝切换 |
| `Timeline` | 自定义 | ✅ 复用 `<Badge size="xs">`（Batch 3 完成） | 首页今日时间线；结构化摘要 |
| `InsightSection` | Card + Skeleton | ✅ 4×`<Card>` + `<WeeklyRangeBar>` + `<Badge>`（Batch 3 完成） | 记录页精细趋势；`<RangeBar>` 已合并到 `<WeeklyRangeBar>` |
| `FocusCard` | Card | ✅ `<Card variant="accent">` + `<Badge>`（Batch 3 完成） | 发现页聚焦卡 |
| `BabyCard` | Card + Avatar | ✅ `<Card variant="interactive">` + `<BabyAvatar>` + `<Badge>`（Batch 3 完成） | 宝宝信息卡 |
| `BabySwitcher` | Avatar + Tooltip | ✅ `<BabyAvatar bordered>` + `<Tooltip>`（Batch 3 完成） | 多宝头像切换 |
| `StatusCapsule` | Alert | ✅ `<Alert variant>` 底色 + `<Button size="xs">`（Batch 3 完成） | 首页状态胶囊 |
| `QuotaBar` | Progress + Badge | ✅ `<Badge>` + `<Progress>`（Batch 3 完成） | AI 配额条 |
| `WeeklyTrendOverview` | Card + Badge + Button | ✅ `<Card>` + `<Badge>` + `<Button>`（Batch 3 完成） | 发现页/报告页趋势对比 |
| `TodaySummary` | Card + Progress | ✅ 4×`<Card variant="accent">` + `<Progress>` + `<Alert>` 发烧提示（Batch 3 完成） | 首页今日四格 |
| `ReportDialog / ReportPage` | Tabs + Chart | ✅ `<Tabs variant="pill">` + `<Card>`（Batch 3 完成） | 周/月报告 |
| `BabyEditDialog` | Dialog + Input | ✅ `<FormField>` + `<Input>` + `<Button>`（Batch 4 完成，pages/baby/index.tsx 内嵌表单） | 宝宝编辑表单 |
| `ErrorState` | 自定义 | 保留为 spinner 形态；`<Alert>` 已覆盖列表空态场景 | 错误提示+重试 |
| 导航 - TabBar / Sidebar | 自定义 | ✅ NavLink + `<BabyAvatar>` + `<DropdownMenu>`（Batch 3 完成） | 导航栏 |
| 筛选标签 | ToggleGroup | ✅ `<Button variant="ghost" active accentColor>`（Batch 3 完成） | 记录类型筛选 |
| Toast | Sonner | 自建（保留） | 全局通知 |
| 确认弹窗 | AlertDialog | 自建 `useConfirm()`（保留） | 二次确认 |
| 主题/字体选择 | RadioGroup | ✅ `<RadioGroup>` + `<RadioGroupCard>`（Batch 4 完成） | 3/4 档切换 |
| `NoteTagPicker` 标签 | Badge + Input | ✅ `<Badge interactive>` + `<Input size="sm">` + `<Button>` + `<Separator>`（Batch 4 完成） | 备注标签化 |
| `CareRoleBadge` | DropdownMenu | ✅ `<DropdownMenu>` + 自定义 badge trigger（Batch 4 完成） | 视角切换 |
| `EasterEggDisplay` | Button | ✅ `<Button block>`（Batch 4 完成） | 彩蛋弹窗 |
| ~~HeaderAction~~ | Button | **已删除**，直接用 `<Button variant="primary/secondary/ghost" size="sm">` | 页面右上角操作 |

### 6.1 原子 Primitive 组件（Batch 1 + Batch 2 新增）

#### Batch 1

| Primitive | 文件 | 关键 Variants |
|-----------|------|---------------|
| `<Button>` | `ui/button.tsx` | `variant × size × block × loading` |
| `<IconButton>` | `ui/icon-button.tsx` | `variant: ghost / danger-ghost / primary-ghost` |
| `<Input>` | `ui/input.tsx` | `variant: default / warning / danger` + `leftIcon / rightIcon` |
| `<Textarea>` | `ui/textarea.tsx` | `variant × size` + `autoResize` |
| `<Label>` | `ui/label.tsx` | `required` 自动加红 `*` |
| `<FormField>` | `ui/form-field.tsx` | `<Label> + control + error` 组合壳 |
| `<Card>` 族 | `ui/card.tsx` | `default / interactive / ghost / accent` |
| `<Badge>` | `ui/badge.tsx` | `xs/sm/md × 13 个 variant + interactive` |
| `<Separator>` | `ui/separator.tsx` | `orientation × variant + label` |

#### Batch 2

| Primitive | 文件 | 关键 Variants / API |
|-----------|------|---------------------|
| `<Switch>` | `ui/switch.tsx` | `size: sm / md`；radix 驱动 |
| `<RadioGroup>` + `<RadioGroupCard>` | `ui/radio-group.tsx` | 卡片式单选（label / description / icon / checkedAdornment） |
| `<Slider>` | `ui/slider.tsx` | `accentColor` + `showLabels` 三段刻度 |
| `<Progress>` + `<RangeIndicator>` + `<WeeklyRangeBar>` | `ui/progress.tsx` | 条形 / 均匀范围点位 / 非均匀参考范围（Batch 3 增 WeeklyRangeBar） |
| `<Alert>` 族 | `ui/alert.tsx` | 5 variant × 2 size |
| `<Popover>` 族 | `ui/popover.tsx` | radix 驱动 |
| `<DropdownMenu>` 族 | `ui/dropdown-menu.tsx` | radix 驱动；内置 ItemIcon / ItemText / Separator |

#### Batch 3

| Primitive | 文件 | 关键 Variants / API |
|-----------|------|---------------------|
| `<Tabs>` 族 | `ui/tabs.tsx` | `variant: underline / pill`；radix 驱动（← → 导航） |
| `<Avatar>` + `<BabyAvatar>` + `<UserAvatar>` | `ui/avatar.tsx` | 5 档 size + bordered；快捷封装按 gender / nickname 配色 |
| `<Tooltip>` 族 | `ui/tooltip.tsx` | radix 驱动；`<TooltipProvider>` 已挂在 App 根部 |

#### Batch 4

| Primitive | 文件 | 关键 Variants / API |
|-----------|------|---------------------|
| `<Checkbox>` | `ui/checkbox.tsx` | radix 驱动；`size: sm / md`；三态（indeterminate） |
| `<Sheet>` 族 | `ui/sheet.tsx` | radix-dialog 底座；`side: right / left / top / bottom` × `size: sm / md / lg` |
| `<ScrollArea>` | `ui/scroll-area.tsx` | 美拉德色细滚动条；A11y 友好 |

### 6.2 已删除 / 合并的组件

| 原组件 | 去向 | 迁移时间 |
|--------|------|---------|
| ~~`HeaderAction`~~ | `<Button variant="primary/secondary/ghost" size="sm">` | Batch 1 |
| ~~`RangeBar`~~ | `<WeeklyRangeBar>`（合并到 `ui/progress.tsx`）| Batch 3 |

### 6.3 v5.1.0 设计优化（在 4 批 Primitive 之上）

1. **图标尺寸 5 档自动推导** — `Button / IconButton / Badge / Alert` 根据 size 自动注入 `h-* w-*`，业务层无需手写尺寸 className。用户显式指定尺寸 className 时被尊重不覆盖。
2. **字体 display 三档 + display-number** — 引入"叙事 / 数据 / 交互"三级节奏；首页问候、报告封面换 `display-sm`；TodaySummary / ReportMetricsGrid 大数字换 `display-number`（mono + tabular + 负字距）。4 档 font-scale 已补齐。
3. **Badge `tone` prop** — `soft`（默认）/ `solid` / `outline`；暖夜模式下 `solid` 自动发光提升对比度。
4. **Badge xs 档无障碍** — `[data-font-scale='xl']` 下自动放大到 12px。
5. **Card `cta` variant** — 虚线 border + 中心对齐，用于空态 / 大型引导。
6. **Focus ring 双层** — 内 2px 容器同色 + 外 4px primary 40%，暖夜增强到 60%。
7. **Card `interactive` hover 微抬升** — 新增 `hover:shadow-soft` + 200ms transition。

### 6.4 物理清除的旧 CSS 类（v5.1.0）

下列类曾作为 Primitive 的过渡期样式存在于 `globals.css`，v5.1.0 已物理删除：

`.card` / `.card-base` / `.card-interactive` / `.type-badge` 系列 / `.input-base` / `.btn-primary` / `.btn-secondary` / `.btn-danger-outline` / `.icon-btn` / `.icon-btn--danger` / `.badge-mini` / `.notice-info` / `.chip` / `.chip--active` / `.chip--inactive` / `.tab-button` / `.tab-button--active` / `.progress-bar` / `.progress-bar__fill`

保留：`.label-base`（Label 组件默认 className 内部复用）、`.heading-*` / `.body-*` / `.caption` 字体语义类、`.icon-circle / .icon-circle--*` 图标圆底、`.section-header` / `.empty-state` / `.spinner` / `.animate-*` / `.number-display` / `.display-number`（字体）。

详细用法见 [`docs/web-component-library.md §1.A`](./web-component-library.md#1a-shadcn-风格-primitives-v501-新增)。


---

## 7. 无障碍设计规范

| 项目 | 要求 |
|------|------|
| 颜色对比度 | 亮色模式 ≥ 4.5:1，暖夜模式 ≥ 4.5:1 |
| 触摸目标 | 最小 44×44px |
| 键盘导航 | 所有交互元素可 Tab 聚焦 + Enter 触发 |
| 焦点指示 | 2px `var(--primary-color)` 外框 |
| 屏幕阅读器 | 所有图标有 `aria-label`，弹窗有 `aria-describedby` |
| 动画偏好 | `prefers-reduced-motion` → 禁用所有动画（全局 `*, *::before, *::after` 覆盖 + 具名类 `.page-enter` / `.animate-*` 双重保险） |

---

*文档维护：UI 交互变更时同步更新此文档。*
