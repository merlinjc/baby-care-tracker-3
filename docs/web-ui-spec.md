# Baby Care Tracker Web 版 UI 交互规范

> **版本**: v1.0 | **日期**: 2026-04-30 | **状态**: 规划中
> **设计系统**: 美拉德色系 (Maillard) | **UI 框架**: React 18 + shadcn/ui + Tailwind CSS

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
│                                     │
├─────────────────────────────────────┤
│ 🍼  😴  🧷  🌡️  📏               │  ← 快捷记录栏
└─────────────────────────────────────┘
```

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
4. **今日概览** → 横向滑动卡片 → 点击卡片展开详情
5. **AI 洞察** → 默认折叠 → 点击展开 → 底部"查看更多"跳转 AI 助手
6. **时间线** → 左滑编辑/删除 → 点击展开详情弹窗
7. **快捷记录** → 点击图标 → 打开对应记录弹窗

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
- **趋势对比**（v4.3.2 修订）：使用 `<WeeklyTrendOverview>`，单卡 4 行布局，每行展示「指标 / 上周日均 / 本周日均 / 对比箭头」，异常行整行高亮；头部含「X 项偏离」徽章 + 「详情 →」跳记录页；底部「向 AI 咨询建议」按钮把上周/本周趋势摘要拼成预填问题，调 `navigate('/ai-assistant', { state: { autoPrompt } })` 跳转，AI 助手页自动发送一次。数据来自 `useWeeklyTrend(babyId)` hook（后端返回的 `period` = 本周一→今天，`lastWeekPeriod` = 上周一→上周日）。
  - **与记录页差异**：记录页使用 `<InsightSection>`（4 张精细卡含范围条 / 环比 / 建议，仅本周）；发现页使用 `<WeeklyTrendOverview>`（上周 vs 本周对比 + AI 入口）。两页信息层次互补。

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
- **主题选择器从个人中心移除**，收敛到 `Settings → 外观` Tab。
- 4 个快捷入口合并为单张分组 Cell 卡（iOS 设置风格），减少视觉噪声；每行右侧显示可选 detail 文案（如家庭名 / 宝宝数量）。

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
  --shadow-card: 0 2px 12px rgba(139, 123, 107, 0.08);
  --shadow-soft: 0 2px 8px rgba(139, 123, 107, 0.06);
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
  --shadow-card: 0 2px 12px rgba(0, 0, 0, 0.3);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.2);
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

### 4.3 动效规范

```css
:root {
  /* 动画时长 */
  --duration-instant: 0.1s;
  --duration-fast: 0.2s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;

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
              点击快捷记录按钮
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

用户点击快捷记录按钮 (首页) / FAB (记录页) / 时间线空白引导
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

| Web 组件 | shadcn/ui 基础 | 说明 |
|---------|---------------|------|
| `FeedingDialog` | Dialog + Tabs + Select | 底部弹出/居中弹窗 |
| `SleepDialog` | Dialog + Tabs + Timer | 计时器自定义 |
| `DiaperDialog` | Dialog + ToggleGroup | 类型/质地/颜色选择 |
| `TemperatureDialog` | Dialog + Slider + Input | 体温滑块+数字输入 |
| `GrowthDialog` | Dialog + Input + Popover(Calendar) | WHO 百分位自定义组件 |
| `Timeline` | 自定义（虚拟列表） | 复杂手势交互 |
| `InsightSection` | Card + Skeleton | 骨架屏加载 |
| `FocusCard` | Card | 左侧色条自定义 |
| `BabyCard` | Card + Avatar | 宝宝信息卡片 |
| `ReportDialog` | Dialog + Tabs + Chart | 周报/月报切换 |
| `ExportDialog` | Dialog + Button | 导出功能 |
| `BabyEditDialog` | Dialog + Input + Select + Calendar | 宝宝编辑表单 |
| `ErrorState` | 自定义 | 错误提示+重试 |
| 导航 - TabBar | 自定义 | 底部导航栏 |
| 导航 - Sidebar | 自定义 | 侧边栏导航 |
| 筛选标签 | ToggleGroup | 记录类型筛选 |
| 搜索框 | Input + Command | 搜索+命令面板 |
| FAB 按钮 | Button | 浮动操作按钮 |
| Toast | Sonner (shadcn/ui 集成) | 全局通知 |
| 确认弹窗 | AlertDialog | 二次确认 |
| 日期选择 | Popover + Calendar | 日期/时间选择 |
| 百分位条 | Progress (自定义) | WHO 百分位可视化 |

---

## 7. 无障碍设计规范

| 项目 | 要求 |
|------|------|
| 颜色对比度 | 亮色模式 ≥ 4.5:1，暖夜模式 ≥ 4.5:1 |
| 触摸目标 | 最小 44×44px |
| 键盘导航 | 所有交互元素可 Tab 聚焦 + Enter 触发 |
| 焦点指示 | 2px `var(--primary-color)` 外框 |
| 屏幕阅读器 | 所有图标有 `aria-label`，弹窗有 `aria-describedby` |
| 动画偏好 | `prefers-reduced-motion` → 禁用所有动画 |

---

*文档维护：UI 交互变更时同步更新此文档。*
