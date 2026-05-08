# Baby Care Tracker Web 端 UI 大重构方案（v6.0）

> **版本**: v1.0 | **日期**: 2026-05-08 | **状态**: 规划中
> **范围**: client/ 所有页面与组件 | **设计借鉴**: shadcn/ui Dashboard、TailAdmin、Horizon UI

---

## 1. 当前状态分析

### 1.1 已有基础（保留）

| 优势 | 说明 |
|------|------|
| 美拉德色系 | 主色 `#D4B896` + 米白 `#F5F1EB` 有辨识度 |
| shadcn/ui 底座 | Radix UI + CVA，组件基础扎实 |
| 多档字体 | 小/标准/大/特大四档，无障碍友好 |
| 亮色+暖夜双模式 | 已支持主题切换 |

### 1.2 待改进点

| 问题 | 表现 | 影响页面 |
|------|------|------|
| 视觉层次感不足 | 卡片扁平化后缺少层次，信息密度低 | 所有页面 |
| 图表展示弱 | 生长曲线 SVG 基础，无交互 | growth/index |
| 动效偏少 | 页面切换、卡片交互动效不够流畅 | 全局 |
| 品牌感弱 | 缺少独特的视觉符号和氛围感 | 登录页、首页 |
| 空态千篇一律 | 空状态设计简单，缺少情感化设计 | 所有列表页 |
| 数据展示不直观 | 数字和趋势展示不够突出 | home、report |
| 间距节奏单一 | 缺少呼吸感，页面偏挤 | 所有页面 |

---

## 2. 重构目标

### 2.1 设计目标

1. **保留美拉德色系** — 主色 `#D4B896` 不变，功能色作为图表和数据展示的配色板
2. **增强视觉层次** — 通过阴影、渐变、玻璃态等效果提升质感
3. **丰富动效** — 页面切换、卡片交互、加载状态使用 spring 缓动
4. **提升品牌感** — 登录页、首页、报告页增加独特的视觉符号
5. **优化空态** — 情感化空态设计，引导用户操作

### 2.2 技术目标

1. 所有新代码使用 Primitive 组件（Button、Input、Card 等）
2. 删除 `globals.css` 中的遗留 CSS 类（`.btn-primary` 等）
3. 统一动画语言（spring 缓动 + stagger 子元素）
4. 增强 Chart 组件（生长曲线增加交互能力）

---

## 3. 设计系统升级方案

### 3.1 新增设计 Token

```css
:root {
  /* === 渐变 === */
  --gradient-primary: linear-gradient(135deg, #D4B896 0%, #B8D4B8 100%);
  --gradient-feeding: linear-gradient(135deg, #A8D4A8 0%, #8BC48B 100%);
  --gradient-sleep: linear-gradient(135deg, #B8A8D4 0%, #9488B4 100%);
  --gradient-diaper: linear-gradient(135deg, #D4C8A8 0%, #B09068 100%);
  --gradient-temperature: linear-gradient(135deg, #D4A8A8 0%, #B48888 100%);
  --gradient-growth: linear-gradient(135deg, #7BA9C9 0%, #5B8FAF 100%);

  /* === 玻璃态 === */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-bg-dark: rgba(42, 36, 32, 0.7);
  --glass-blur: blur(12px);

  /* === 增强阴影 === */
  --shadow-card-elevated: 0 4px 24px rgba(139, 123, 107, 0.12);
  --shadow-float: 0 8px 32px rgba(139, 123, 107, 0.16);
  --shadow-glow-primary: 0 0 20px -4px var(--primary), 0 0 8px -4px var(--primary);

  /* === 动画时长（升级）=== */
  --duration-spring: 0.4s;
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 3.2 卡片层级系统（新增）

| 层级 | shadow | 使用场景 |
|------|--------|---------|
| 基础卡片 | `var(--shadow-card)` | 列表项、设置项 |
| 悬浮卡片 | `var(--shadow-card-elevated)` | 首页 TodaySummary、功能入口 |
| 浮层 | `var(--shadow-float)` | Dropdown、Popover |
| 活跃态 | `var(--shadow-glow-primary)` | 当前选中项、进行中状态 |

### 3.3 动效规范（新增）

```css
/* 页面入场 */
.page-enter {
  animation: fadeInUp 0.4s var(--ease-spring);
}

/* 卡片 stagger */
.card-stagger:nth-child(1) { animation-delay: 0s; }
.card-stagger:nth-child(2) { animation-delay: 0.05s; }
.card-stagger:nth-child(3) { animation-delay: 0.1s; }
.card-stagger:nth-child(4) { animation-delay: 0.15s; }

/* 数字滚动 */
@keyframes numberRoll {
  from { transform: translateY(0.5em); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 呼吸灯（进行中状态）*/
@keyframes breatheGlow {
  0%, 100% { box-shadow: 0 0 8px -2px var(--primary); }
  50% { box-shadow: 0 0 16px -2px var(--primary); }
}
```

---

## 4. 分页面重构方案

### 4.1 登录页（`/login`）

#### 当前问题
- 视觉平淡，缺少品牌感
- 表单卡片没有层次

#### 重构方案

```
参照：TailAdmin React 的 Auth 页设计
改动：
1. 页面背景使用渐变 mesh（美拉德色系）
2. 登录卡片增加玻璃态效果（backdrop-filter: blur）
3. 输入框 focus 时左侧色条动画（3px → 0px → 3px）
4. 按钮改用渐变背景（var(--gradient-primary)）
5. 微信登录按钮使用微信品牌绿 #07C160 并加图标动画
6. 记住我开关样式升级（使用 <Switch> 组件）
```

#### 具体任务
- [ ] 创建 `LoginPage` 新布局（左右分栏：左侧品牌展示，右侧登录表单）
- [ ] 新增品牌展示区（大号 Logo + 标语「科学育儿，安心记录」）
- [ ] 表单卡片增加玻璃态效果
- [ ] 输入框 focus 动画（左侧色条）
- [ ] 按钮渐变背景
- [ ] 微信登录按钮样式升级

---

### 4.2 注册页（`/register`）

#### 重构方案
```
参照：TailAdmin React 的 Register 页
改动：
1. 与登录页保持一致的品牌风格
2. 密码强度指示器（低/中/高）使用渐变条
3. 步骤指示器（可选，多步注册）
```

#### 具体任务
- [ ] 与登录页保持一致布局
- [ ] 密码强度指示器组件（使用 `<Progress>` + 渐变色）
- [ ] 密码确认输入框增加实时匹配动画（✓/✗ 图标动画）

---

### 4.3 首页（`/home`）

#### 当前问题
- 问候语不够突出
- TodaySummary 数字展示不够大
- 时间线卡片样式普通

#### 重构方案

```
参照：shadcn/ui Dashboard 的指标卡片设计
改动：
1. 问候语区域升级：
   - 大号字体（display-sm: 30px）→ 已有，但可增加字间距 tracking-wide
   - 头像使用渐变边框（3px 渐变）
   - 副标题使用暖色 italic

2. TodaySummary 4 宫格升级：
   - 数字使用 display-number（已有），增加 numberRoll 动画
   - 卡片 hover 时微放大（scale: 1.02）+ 阴影增强
   - 进度条使用渐变色（对应功能色）
   - 睡眠卡片（进行中）增加呼吸灯效果（breatheGlow）

3. AI 洞察区升级：
   - 折叠态使用玻璃态卡片
   - 展开态增加逐行渐显动画
   - 刷新按钮旋转动画（已有，优化缓动）

4. 时间线升级：
   - 卡片 hover 时左侧色条变粗（3px → 5px）
   - 新增空态插画（使用 lucide-react 图标组合）
```

#### 具体任务
- [ ] 问候语区域增加字间距和渐变边框头像
- [ ] TodaySummary 数字增加 numberRoll 动画
- [ ] TodaySummary 卡片 hover 动效
- [ ] 进度条改用渐变色
- [ ] 进行中睡眠呼吸灯效果
- [ ] AI 洞察区玻璃态
- [ ] 时间线 hover 动效
- [ ] 首页空态插画设计

---

### 4.4 记录页（`/records`）

#### 当前问题
- 列表项样式普通
- 筛选标签样式可优化
- 空态不够友好

#### 重构方案

```
参照：shadcn/ui Dashboard 的表格设计
改动：
1. 类型筛选标签升级：
   - 使用 Pill 形状（border-radius: 9999px）
   - 选中态使用渐变背景（对应功能色）
   - 未选中态使用左侧色条 + 透明背景

2. 记录列表项升级：
   - 左侧色条改为顶部色条（3px 全宽）+ hover 放大
   - 图标圆底改为渐变圆底
   - 备注标签使用圆角胶囊（已有，优化间距）

3. 日期分组 header 升级：
   - 使用美拉德色系的浅色背景
   - 分组标题加粗 + 彩色 pill 计数

4. 空态升级：
   - 大型插画（使用 lucide-react 的 ClipboardList + 动画）
   - 引导按钮使用渐变背景
```

#### 具体任务
- [ ] 类型筛选标签 Pill 形状 + 渐变选中态
- [ ] 记录列表项顶部色条 + hover 放大
- [ ] 图标圆底渐变
- [ ] 日期分组 header 样式升级
- [ ] 空态插画设计

---

### 4.5 发现页（`/discover`）

#### 当前问题
- 功能入口 Grid 卡片样式普通
- FocusCard 不够突出

#### 重构方案

```
参照：Horizon UI 的功能卡片设计
改动：
1. 功能入口 Grid 升级：
   - 卡片使用玻璃态效果（backdrop-blur）
   - 图标容器使用渐变背景（对应功能色）
   - 卡片 hover 时图标旋转 10° + 卡片上移 4px
   - badge 使用纯色背景 + 白色文字

2. FocusCard 升级：
   - 左侧紧急色条加宽（3px → 5px）
   - 卡片背景使用对应紧急色的 6% 透明度
   - overdue 使用 danger 渐变背景（60% 透明度）

3. 本周趋势区升级：
   - 使用 <InsightSection> 已有，但可增加柱状图动画
```

#### 具体任务
- [ ] 功能入口玻璃态效果
- [ ] 图标容器渐变背景
- [ ] 卡片 hover 动效（旋转 + 上移）
- [ ] badge 样式升级
- [ ] FocusCard 紧急色条加宽
- [ ] FocusCard 背景色优化

---

### 4.6 个人中心页（`/profile`）

#### 当前问题
- 用户卡片样式普通
- 快捷入口列表样式可优化

#### 重构方案

```
参照：shadcn/ui Dashboard 的用户 profile 设计
改动：
1. 用户卡片升级：
   - 头像使用渐变边框 + 阴影
   - 昵称使用 display-sm 字体
   - 宝宝/家庭 pill 标签使用渐变背景

2. 快捷入口列表升级：
   - 使用 iOS 设置风格（已有），但增加 hover 时左侧色条
   - 图标容器使用对应功能色的 12% 背景（已有，优化）

3. 主题/字体选择器升级：
   - 选项卡片使用玻璃态
   - 选中态使用 primary 渐变边框
```

#### 具体任务
- [ ] 用户卡片头像渐变边框
- [ ] 昵称字体放大
- [ ] 快捷入口 hover 动效
- [ ] 主题/字体选择器玻璃态

---

### 4.7 AI 助手页（`/ai-assistant`）

#### 当前问题
- 消息气泡样式可优化
- 推荐问题按钮样式普通

#### 重构方案

```
参照：Horizon UI 的 AI 对话界面
改动：
1. 消息气泡升级：
   - 用户气泡：渐变背景（var(--gradient-primary)）+ 白色文字
   - AI 气泡：使用 var(--bg-card) + 左侧 4px primary 色条
   - 气泡圆角优化（18px 统一）

2. 打字指示器升级：
   - TypingDots 使用 primary 色 + 波浪动画（已有，优化缓动）

3. 推荐问题按钮升级：
   - 使用 Pill 形状 + ghost 样式
   - hover 时填充对应功能色（sleep 色）

4. 输入区升级：
   - Textarea 使用玻璃态背景
   - 发送按钮使用 primary 渐变
```

#### 具体任务
- [ ] 用户气泡渐变背景
- [ ] AI 气泡左侧色条
- [ ] TypingDots 缓动优化
- [ ] 推荐问题 Pill 形状
- [ ] 输入区玻璃态

---

### 4.8 成长报告页（`/report`）

#### 当前问题
- 封面设计简单
- 关键指标展示可优化
- AI 总结区样式普通

#### 重构方案

```
参照：Horizon UI 的报告页面设计
改动：
1. 封面升级：
   - 使用大幅渐变背景（var(--gradient-primary)）
   - 大号装饰字 W/M 使用白色 + 阴影
   - 宝宝名使用 display-md 字体

2. 关键指标 4 宫格升级：
   - 数字使用 display-number + numberRoll 动画
   - 卡片使用对应功能色的 6% 背景
   - 图标使用渐变圆底

3. 每日节律图升级：
   - 双色柱图增加 hover 高亮
   - 增加数值标注（hover 时显示具体数值）

4. AI 总结区升级：
   - 使用玻璃态卡片
   - 生成按钮使用 gradient-primary
```

#### 具体任务
- [ ] 封面渐变背景 + 大号装饰字
- [ ] 关键指标数字动画
- [ ] 每日节律图 hover 高亮
- [ ] AI 总结区玻璃态

---

### 4.9 生长曲线页（`/growth`）

#### 当前问题
- SVG 图表交互能力不足
- 数据表格样式普通

#### 重构方案

```
参照：CoreUI React 的图表页面
改动：
1. SVG 图表升级：
   - 增加 tooltip（hover 时显示具体数值 + 日期）
   - 数据点增加 hover 放大效果（r: 3 → r: 6）
   - WHO 参考线增加标签显示（P3/P15/P50/P85/P97）

2. 数据表格升级：
   - 使用斑马纹（odd/even 行背景色不同）
   - 数字列使用 tabular-nums + 右对齐
```

#### 具体任务
- [ ] SVG 图表 tooltip
- [ ] 数据点 hover 效果
- [ ] WHO 参考线标签显示
- [ ] 数据表格斑马纹

---

### 4.10 疫苗/里程碑页（`/vaccine`、`/milestone`）

#### 重构方案
```
改动：
1. 状态筛选标签升级（已有，优化动画）
2. 列表项左侧色条加宽（3px → 4px）
3. 标准推荐抽屉升级：
   - 使用玻璃态背景
   - 标记已接种按钮使用渐变背景
```

#### 具体任务
- [ ] 状态筛选标签动画优化
- [ ] 列表项色条加宽
- [ ] 标准推荐抽屉玻璃态

---

### 4.11 黄疸记录页（`/jaundice`）

#### 重构方案
```
改动：
1. 迷你折线图升级（已有，优化样式）
2. 教育提示条使用 warning 渐变背景
3. 列表项左侧色条使用 warning 色
```

---

### 4.12 设置页（`/settings`）

#### 重构方案
```
改动：
1. Tabs 切换动画优化（已有 pill 形状，增加滑动指示器）
2. 导出卡片升级（已有，增加图标动画）
```

---

### 4.13 宝宝管理页（`/baby`）

#### 重构方案
```
改动：
1. 宝宝卡片选中态使用渐变边框
2. 添加/编辑表单使用玻璃态卡片
```

---

### 4.14 家庭页（`/family`）

#### 重构方案
```
改动：
1. 成员列表项使用 Card variant="interactive"（已有，优化 hover）
2. 邀请码展示使用 glassmorphism
```

---

## 5. 组件级重构方案

### 5.1 基础组件升级

#### `<Button>` 升级
```typescript
// 新增 gradient 变体
variant: 'gradient-primary' | 'gradient-feeding' | 'gradient-sleep' | ...

// 新增玻璃态变体
variant: 'glass'

// loading 状态增加 spinner 动画优化
```

#### `<Card>` 升级
```typescript
// 新增 glass 变体
variant: 'glass'  // backdrop-blur + 半透明背景

// 新增 gradient-header 变体
variant: 'gradient-header'  // 顶部渐变条
```

#### `<Badge>` 升级
```typescript
// 新增 gradient 变体
variant: 'gradient-primary' | ...

// 新增 glass 变体
variant: 'glass'
```

### 5.2 业务组件升级

#### `<TodaySummary>` 升级
- 数字使用 `display-number` + `numberRoll` 动画
- 进度条使用渐变色

#### `<Timeline>` 升级
- 卡片 hover 动效
- 左侧连接线动画

#### `<FocusCard>` 升级
- 紧急色条加宽
- 背景色优化

#### `<ReportCover>` 升级
- 大幅渐变背景
- 装饰字效果

---

## 6. 实施步骤（分阶段）

### Phase 0：设计系统升级（1-2 天）

- [ ] 在 `globals.css` 中新增设计 Token（渐变、玻璃态、增强阴影、动效）
- [ ] 在 `globals.css` 中新增动效关键帧（numberRoll、breatheGlow、cardStagger）
- [ ] 更新 `docs/web-ui-spec.md` 记录新增 Token

### Phase 1：基础组件升级（2-3 天）

- [ ] 升级 `<Button>` 组件（新增 gradient、glass 变体）
- [ ] 升级 `<Card>` 组件（新增 glass、gradient-header 变体）
- [ ] 升级 `<Badge>` 组件（新增 gradient、glass 变体）
- [ ] 升级 `<Input>` 组件（focus 动画）
- [ ] 确保所有页面使用 Primitive 组件（删除遗留 CSS 类）

### Phase 2：页面重构（按优先级，5-7 天）

#### P0（必须先做）
- [ ] 登录页重构（品牌感提升）
- [ ] 首页重构（TodaySummary 数字动画 + 问候语升级）

#### P1（核心功能）
- [ ] 记录页重构（列表项动效 + 筛选标签升级）
- [ ] 发现页重构（功能入口玻璃态 + hover 动效）
- [ ] 成长报告页重构（封面升级 + 指标动画）

#### P2（增强体验）
- [ ] AI 助手页重构（气泡样式升级）
- [ ] 生长曲线页重构（SVG 交互增强）
- [ ] 个人中心页重构（头像边框 + 卡片动效）

#### P3（完善细节）
- [ ] 疫苗/里程碑页重构
- [ ] 黄疸记录页重构
- [ ] 设置页重构
- [ ] 宝宝管理页重构
- [ ] 家庭页重构

### Phase 3：动效与空态（2-3 天）

- [ ] 所有页面增加 page-enter 动画
- [ ] 所有列表增加 card-stagger 动画
- [ ] 所有空态设计情感化插画
- [ ] 加载状态（spinner、skeleton）动效优化

### Phase 4：测试与文档（1-2 天）

- [ ] 所有页面视觉回归测试
- [ ] 亮色/暖夜双模式测试
- [ ] 字体四档测试
- [ ] 更新 `docs/web-ui-spec.md`
- [ ] 更新 `docs/web-component-library.md`
- [ ] 更新本文档（记录完成情况）

---

## 7. 设计资源与借鉴总结

### 7.1 直接可复用的开源项目

| 项目 | 地址 | 可借鉴点 | 如何复用 |
|------|------|---------|---------|
| shadcn/ui Dashboard | https://ui.shadcn.com/examples/dashboard | 指标卡片、表格布局 | 代码可直接复制 |
| TailAdmin React | https://tailadmin.com/react | 登录/注册页、玻璃态 | 改色后复用 |
| Horizon UI | https://horizon-ui.com/ | 功能卡片、AI 对话界面 | 设计参考 |
| CoreUI React | https://coreui.io/react/ | 图表页、数据表格 | 组件参考 |

### 7.2 美拉德色系保留方案

```
保留：
- 主色 #D4B896 → 用于品牌、主按钮、当前选中态
- 功能色（feeding/sleep/diaper/temperature/growth）→ 用于图表配色、类型标识
- 背景色 #F5F1EB → 页面背景
- 文字色 #3D3D3D → 主要文字

新增：
- 各功能色的渐变版本（135deg 渐变）
- 玻璃态效果（backdrop-blur + 半透明）
- 增强阴影（保留棕色调，增加强度）
```

---

## 8. 风险与应对

| 风险 | 应对措施 |
|------|---------|
| 动效过多导致性能问题 | 使用 `prefers-reduced-motion` 媒体查询禁用动画 |
| 玻璃态在低端设备渲染卡顿 | 提供 fallback（纯色背景）|
| 渐变背景增加 GPU 负担 | 限制渐变使用范围（仅关键区域）|
| 重构过程中引入新 bug | 每个 Phase 完成后进行视觉回归测试 |

---

## 9. 完成标准

- [ ] 所有页面使用 Primitive 组件（无遗留 CSS 类）
- [ ] 所有页面有入场动画
- [ ] 所有关键数字有 numberRoll 动画
- [ ] 所有卡片有 hover 动效
- [ ] 亮色/暖夜双模式视觉一致
- [ ] 字体四档显示正常
- [ ] 空态设计情感化
- [ ] 文档更新完成

---

*文档维护：每完成一个 Phase，更新本文档对应章节的状态。*
