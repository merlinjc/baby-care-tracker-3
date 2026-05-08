# Baby Care Tracker Web v6.0 页面重构详细设计（Phase 2 & Phase 3）

> **版本**: v1.0 | **日期**: 2026-05-08 | **状态**: 设计中
> **负责人**: page-refactor Agent | **参考**: web-ui-refactor-v6-plan.md、web-ui-spec.md

---

## 1. 任务拆分表（按优先级 P0-P3）

### 1.1 P0 任务（必须先做）

| 任务ID | 所属页面 | 任务名称 | 预估工时 | 依赖关系 | 验收标准 |
|---------|---------|---------|---------|---------|---------|
| P0-1 | `/login` | 登录页左右分栏布局 | 4h | 无 | 左侧品牌区+右侧表单，背景渐变 mesh |
| P0-2 | `/login` | 登录卡片玻璃态效果 | 2h | P0-1 | backdrop-filter: blur(12px) |
| P0-3 | `/login` | 输入框 focus 左侧色条动画 | 2h | P0-1 | 3px → 0px → 3px 动画 |
| P0-4 | `/login` | 按钮渐变背景 | 1h | P0-1 | var(--gradient-primary) |
| P0-5 | `/login` | 微信登录按钮样式升级 | 2h | P0-1 | 微信绿 #07C160 + 图标动画 |
| P0-6 | `/home` | 问候语区域升级 | 2h | 无 | tracking-wide + 渐变边框头像 |
| P0-7 | `/home` | TodaySummary 数字 numberRoll 动画 | 3h | 无 | 数字滚动入场 |
| P0-8 | `/home` | TodaySummary 卡片 hover 动效 | 2h | P0-7 | scale: 1.02 + 阴影增强 |
| P0-9 | `/home` | 进度条渐变色 | 1h | P0-7 | 对应功能色渐变 |
| P0-10 | `/home` | 睡眠进行中呼吸灯效果 | 2h | P0-7 | breatheGlow 动画 |

### 1.2 P1 任务（核心功能）

| 任务ID | 所属页面 | 任务名称 | 预估工时 | 依赖关系 | 验收标准 |
|---------|---------|---------|---------|---------|---------|
| P1-1 | `/records` | 类型筛选标签 Pill 形状 | 2h | 无 | border-radius: 9999px |
| P1-2 | `/records` | 筛选标签选中态渐变背景 | 1h | P1-1 | 对应功能色渐变 |
| P1-3 | `/records` | 记录列表项顶部色条 | 2h | 无 | 3px 全宽 + hover 放大 |
| P1-4 | `/records` | 图标圆底渐变 | 1h | P1-3 | gradient + border-radius |
| P1-5 | `/records` | 日期分组 header 样式 | 2h | 无 | 美拉德浅色背景 + pill 计数 |
| P1-6 | `/discover` | 功能入口玻璃态效果 | 3h | 无 | backdrop-blur + 渐变图标容器 |
| P1-7 | `/discover` | 卡片 hover 动效 | 2h | P1-6 | 图标旋转10° + 卡片上移4px |
| P1-8 | `/discover` | FocusCard 紧急色条加宽 | 1h | 无 | 3px → 5px |
| P1-9 | `/report` | 封面渐变背景 + 装饰字 | 3h | 无 | var(--gradient-primary) + 大号 W/M |
| P1-10 | `/report` | 关键指标数字动画 | 2h | 无 | display-number + numberRoll |
| P1-11 | `/report` | 每日节律图 hover 高亮 | 3h | 无 | 双色柱图 hover 效果 |

### 1.3 P2 任务（增强体验）

| 任务ID | 所属页面 | 任务名称 | 预估工时 | 依赖关系 | 验收标准 |
|---------|---------|---------|---------|---------|---------|
| P2-1 | `/ai-assistant` | 用户气泡渐变背景 | 2h | 无 | var(--gradient-primary) + 白色文字 |
| P2-2 | `/ai-assistant` | AI 气泡左侧色条 | 1h | P2-1 | 4px primary 色条 |
| P2-3 | `/ai-assistant` | 推荐问题 Pill 形状 | 1h | 无 | rounded-full + ghost hover |
| P2-4 | `/ai-assistant` | 输入区玻璃态 | 2h | 无 | backdrop-blur 背景 |
| P2-5 | `/growth` | SVG 图表 tooltip | 4h | 无 | hover 显示数值 + 日期 |
| P2-6 | `/growth` | 数据点 hover 放大 | 2h | P2-5 | r: 3 → r: 6 |
| P2-7 | `/growth` | WHO 参考线标签 | 2h | P2-5 | P3/P15/P50/P85/P97 标注 |
| P2-8 | `/growth` | 数据表格斑马纹 | 1h | 无 | odd/even 行背景不同 |
| P2-9 | `/profile` | 用户卡片头像渐变边框 | 2h | 无 | 3px 渐变边框 + 阴影 |
| P2-10 | `/profile` | 快捷入口 hover 动效 | 2h | 无 | 左侧色条 + 背景变化 |

### 1.4 P3 任务（完善细节）

| 任务ID | 所属页面 | 任务名称 | 预估工时 | 依赖关系 | 验收标准 |
|---------|---------|---------|---------|---------|---------|
| P3-1 | `/vaccine` | 状态筛选标签动画优化 | 2h | 无 | 平滑过渡动画 |
| P3-2 | `/vaccine` | 列表项色条加宽 | 1h | P3-1 | 3px → 4px |
| P3-3 | `/milestone` | 同疫苗页 | 2h | P3-1, P3-2 | 保持一致 |
| P3-4 | `/jaundice` | 迷你折线图样式优化 | 2h | 无 | 线条粗细 + 数据点 |
| P3-5 | `/jaundice` | 教育提示条渐变背景 | 1h | P3-4 | var(--gradient-temperature) |
| P3-6 | `/settings` | Tabs 滑动指示器 | 2h | 无 | pill 形状 + 滑动动画 |
| P3-7 | `/baby` | 宝宝卡片选中态渐变边框 | 2h | 无 | 3px 渐变边框 |
| P3-8 | `/baby` | 表单玻璃态卡片 | 2h | P3-7 | backdrop-blur |
| P3-9 | `/family` | 成员列表项 hover 优化 | 2h | 无 | variant="interactive" 增强 |
| P3-10 | `/family` | 邀请码玻璃态展示 | 1h | P3-9 | glassmorphism |

### 1.5 Phase 3 任务（动效与空态）

| 任务ID | 类型 | 任务名称 | 预估工时 | 依赖关系 | 验收标准 |
|---------|------|---------|---------|---------|---------|
| P3-11 | 动效 | 所有页面 page-enter 动画 | 3h | 无 | fadeInUp 0.4s spring |
| P3-12 | 动效 | 所有列表 card-stagger 动画 | 4h | P3-11 | nth-child 延迟 |
| P3-13 | 空态 | 首页空态插画 | 3h | 无 | lucide-react 组合 |
| P3-14 | 空态 | 记录页空态插画 | 2h | 无 | ClipboardList + 动画 |
| P3-15 | 空态 | 其他页面空态设计 | 4h | P3-13, P3-14 | 统一风格 |
| P3-16 | 动效 | 加载状态动效优化 | 3h | 无 | spinner + skeleton 增强 |

---

## 2. 逐页详细设计方案

### 2.1 登录页（`/login`）

#### 当前状态分析
- 文件位置：`client/src/pages/login/index.tsx`（需新建，当前不存在）
- 参考设计：TailAdmin React Auth 页面

#### 具体改动点

**布局结构**：
```
┌──────────────────┬──────────────────┐
│                  │                  │
│   品牌展示区      │   登录表单区      │
│                  │                  │
│  [大号 Logo]    │  [卡片 - 玻璃态] │
│                  │                  │
│  Baby Care       │  📧 邮箱/手机   │
│  Tracker         │                  │
│                  │  🔒 密码         │
│  "科学育儿，     │                  │
│   安心记录"       │  [登录按钮 - 渐变]│
│                  │                  │
│                  │  ── 或 ──       │
│                  │                  │
│                  │  [微信登录按钮]   │
│                  │                  │
└──────────────────┴──────────────────┘
```

**设计 Token 使用**：
- 背景：`background: linear-gradient(135deg, #D4B896 0%, #B8D4B8 50%, #D4C8A8 100%)`（mesh 渐变）
- 玻璃态卡片：`--glass-bg` + `--glass-blur`
- 按钮渐变：`--gradient-primary`
- 微信按钮：`background: #07C160` + 微信图标动画

**动效描述**：
1. 页面加载：左侧品牌区 fadeInLeft 0.6s，右侧表单 fadeInRight 0.6s
2. 输入框 focus：左侧 3px 色条 width 动画（0 → 3px → 0 → 3px）
3. 按钮 hover：scale(1.02) + shadow 增强
4. 微信图标：hover 时旋转 10°

**验收标准**：
- [ ] 左右分栏布局在桌面端显示，移动端堆叠
- [ ] 背景渐变 mesh 效果明显
- [ ] 登录卡片有玻璃态效果（backdrop-filter: blur）
- [ ] 输入框 focus 动画流畅
- [ ] 按钮渐变背景正确显示
- [ ] 微信登录按钮样式符合要求

---

### 2.2 首页（`/home`）

#### 当前状态分析
- 文件位置：`client/src/pages/home/index.tsx`
- 当前实现：已有基础布局，但需要增强视觉层次和动效

#### 具体改动点

**问候语区域升级**：
```tsx
// 当前代码（第 308-310 行）
<h1 className="display-sm text-[var(--text-primary)] truncate">
  {getGreeting()}，{user?.nickname || '用户'}
</h1>

// 升级后
<h1 
  className="display-sm text-[var(--text-primary)] truncate tracking-wide"
  style={{ letterSpacing: '0.02em' }}
>
  {getGreeting()}，{user?.nickname || '用户'}
</h1>

// 头像渐变边框（需修改 BabySwitcher 组件）
<div className="p-[3px] rounded-full" style={{ background: 'var(--gradient-primary)' }}>
  <BabyAvatar />
</div>
```

**TodaySummary 数字动画**：
```tsx
// 新增 numberRoll 动画组件
function NumberRoll({ value, duration = 400 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  
  useEffect(() => {
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplay(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    animate()
  }, [value, duration])
  
  return <span className="display-number">{display}</span>
}
```

**进度条渐变色**：
```tsx
// 当前进度条使用单一颜色，需改为渐变
<div 
  className="h-1.5 rounded-full overflow-hidden"
  style={{ background: 'var(--bg-elevated)' }}
>
  <div 
    className="h-full rounded-full transition-all duration-500"
    style={{ 
      width: `${percent}%`,
      background: 'var(--gradient-feeding)' // 根据类型动态切换
    }}
  />
</div>
```

**睡眠呼吸灯效果**：
```tsx
// 在 StatusCapsule 组件中新增
<div 
  className={`status-indicator ${activeSleep ? 'animate-breathe' : ''}`}
  style={{
    boxShadow: activeSleep ? '0 0 8px -2px var(--primary)' : 'none'
  }}
/>
```

**AI 洞察区玻璃态**：
```tsx
// 第 382-452 行，折叠态和展开态都需要升级
<Card
  {...}
  className="... backdrop-blur-md bg-white/70 dark:bg-[var(--bg-secondary)]/70"
  style={{ borderTop: '3px solid var(--sleep)' }}
>
```

**时间线 hover 动效**：
```tsx
// Timeline 组件升级
<div 
  className="timeline-item transition-all duration-200 hover:translate-x-1"
  style={{ borderLeft: `3px solid ${config.color}` }}
/>
```

**首页空态插画**：
```tsx
// 当 currentBaby 为 null 时显示
<div className="empty-state">
  <div className="empty-state__illustration">
    {/* lucide-react 图标组合 */}
    <Baby className="h-24 w-24 text-[var(--text-hint)]" />
    <Plus className="h-8 w-8 text-[var(--primary)] animate-bounce" />
  </div>
  <p className="empty-state__title">添加宝宝开始使用</p>
  <p className="empty-state__desc">记录宝宝的成长点滴</p>
  <Button variant="primary" onClick={() => navigate('/baby/create')}>
    添加宝宝
  </Button>
</div>
```

**设计 Token 使用**：
- 数字动画：`--duration-spring: 0.4s` + `--ease-spring`
- 呼吸灯：`--animate-breathe`
- 玻璃态：`--glass-bg` + `--glass-blur`

**动效描述**：
1. 页面加载：page-enter 动画（fadeInUp 0.4s）
2. TodaySummary 数字：numberRoll 动画（0.4s easeOutCubic）
3. 卡片 hover：scale(1.02) + shadow 增强（0.2s ease）
4. 睡眠呼吸灯：breathe 动画（1.5s infinite）
5. 时间线 hover：translateX(4px)（0.2s ease）

**验收标准**：
- [ ] 问候语有字间距优化
- [ ] 头像有渐变边框
- [ ] TodaySummary 数字有滚动动画
- [ ] 卡片 hover 有微放大效果
- [ ] 进度条使用渐变色
- [ ] 睡眠进行中有呼吸灯效果
- [ ] AI 洞察区有玻璃态效果
- [ ] 时间线 hover 有动效
- [ ] 首页空态插画美观

---

### 2.3 记录页（`/records`）

#### 当前状态分析
- 文件位置：`client/src/pages/record/index.tsx`
- 当前实现：已有筛选标签、列表项，但需要样式升级

#### 具体改动点

**类型筛选标签 Pill 形状**：
```tsx
// 第 341-364 行，按钮样式升级
<Button
  variant="ghost"
  size="sm"
  active={activeType === type}
  onClick={() => setActiveType(type)}
  accentColor={recordTypeConfig[type].color}
  className="rounded-full px-4"  // Pill 形状
  style={activeType === type ? { 
    background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}CC 100%)`,
    color: 'white'
  } : undefined}
>
  {recordTypeConfig[type].label}
</Button>
```

**记录列表项顶部色条**：
```tsx
// 第 394-495 行，Card 组件升级
<Card
  key={record.id}
  padding="md"
  className="flex items-start gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
  style={{ 
    borderTop: `3px solid ${config.color}`,
    borderLeft: 'none'  // 从左侧色条改为顶部色条
  }}
>
```

**图标圆底渐变**：
```tsx
// 第 400-405 行，图标容器升级
<div
  className="icon-circle icon-circle--sm shrink-0 mt-0.5"
  style={{ 
    background: `linear-gradient(135deg, ${config.color}20 0%, ${config.color}40 100%)`,
    borderRadius: 'var(--radius-md)'
  }}
>
  <Icon className="h-4 w-4" style={{ color: config.color }} />
</div>
```

**日期分组 header 样式**：
```tsx
// 第 379-387 行，分组标题升级
<div className="flex items-center gap-2 px-1">
  <span 
    className="caption font-semibold"
    style={{ 
      backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)'
    }}
  >
    {group.label}
  </span>
  <Badge 
    size="xs" 
    variant="soft" 
    accentColor="var(--primary)"
  >
    {group.items.length}
  </Badge>
  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-light)' }} />
</div>
```

**空态插画设计**：
```tsx
// 第 370-374 行，空态升级
<div className="empty-state">
  <div className="relative">
    <ClipboardListLinear className="h-16 w-16 text-[var(--text-hint)]" />
    <Plus className="absolute -bottom-1 -right-1 h-6 w-6 text-[var(--primary)] animate-pulse" />
  </div>
  <p className="empty-state__title">暂无记录</p>
  <p className="empty-state__desc">点击下方按钮创建第一条记录</p>
  <Button variant="primary" onClick={() => openRecordDialog('feeding')}>
    添加记录
  </Button>
</div>
```

**设计 Token 使用**：
- Pill 形状：`--radius-pill: 9999px`
- 渐变色条：`--gradient-{type}`
- 图标容器：`--radius-md: 12px`

**动效描述**：
1. 筛选标签切换：平滑过渡（0.2s ease）
2. 列表项 hover：translateY(-2px) + shadow 增强（0.2s ease）
3. 空态图标：pulse 动画（2s infinite）

**验收标准**：
- [ ] 筛选标签为 Pill 形状
- [ ] 选中态有渐变背景
- [ ] 列表项有顶部色条
- [ ] 图标容器有渐变背景
- [ ] 日期分组 header 样式美观
- [ ] 空态插画友好

---

### 2.4 发现页（`/discover`）

#### 当前状态分析
- 文件位置：`client/src/pages/discover/index.tsx`
- 当前实现：功能入口 Grid 和基础 FocusCard

#### 具体改动点

**功能入口玻璃态效果**：
```tsx
// 第 178-211 行，Card 组件升级
<Card
  as="article"
  variant="interactive"
  padding="md"
  className="flex flex-col items-center text-center gap-2 relative h-full backdrop-blur-md bg-white/70 dark:bg-[var(--bg-secondary)]/70 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
>
```

**图标容器渐变背景**：
```tsx
// 第 194-202 行，图标容器升级
<div
  className="icon-circle icon-circle--lg transition-transform duration-300 group-hover:rotate-10"
  style={{
    background: `linear-gradient(135deg, ${feature.color}20 0%, ${feature.color}40 100%)`,
    borderRadius: 'var(--radius-md)'
  }}
>
  <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
</div>
```

**卡片 hover 动效**：
```tsx
// 新增 CSS
.card-enter {
  animation: fadeInUp 0.4s var(--ease-spring);
}

.stagger-children > *:nth-child(1) { animation-delay: 0s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.05s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.15s; }
```

**FocusCard 紧急色条加宽**：
```tsx
// FocusCard 组件升级
<div 
  className="focus-card"
  style={{ 
    borderLeft: `5px solid ${
      urgency === 'overdue' ? 'var(--danger)' : 
      urgency === 'upcoming' ? 'var(--warning)' : 
      'var(--success)'
    }`,
    backgroundColor: `color-mix(in srgb, ${
      urgency === 'overdue' ? 'var(--danger)' : 
      urgency === 'upcoming' ? 'var(--warning)' : 
      'var(--success)'
    } 6%, transparent)`
  }}
/>
```

**设计 Token 使用**：
- 玻璃态：`--glass-bg` + `--glass-blur`
- 卡片阴影：`--shadow-card-elevated`
- 色条宽度：`5px`（加宽）

**动效描述**：
1. 页面加载：card-stagger 动画（每个卡片延迟 0.05s）
2. 卡片 hover：图标旋转 10° + 卡片上移 4px（0.3s ease）
3. FocusCard：hover 时 translateY(-2px) + shadow 增强

**验收标准**：
- [ ] 功能入口有玻璃态效果
- [ ] 图标容器有渐变背景
- [ ] 卡片 hover 有旋转 + 上移动效
- [ ] FocusCard 色条加宽到 5px
- [ ] 背景色透明度正确

---

### 2.5 AI 助手页（`/ai-assistant`）

#### 当前状态分析
- 文件位置：`client/src/pages/ai-assistant/index.tsx`
- 当前实现：基础对话界面，需要气泡样式升级

#### 具体改动点

**用户气泡渐变背景**：
```tsx
// 第 85-101 行，bubbleStyle 函数升级
function bubbleStyle(role: 'user' | 'assistant'): React.CSSProperties {
  const isUser = role === 'user'
  return {
    background: isUser 
      ? 'linear-gradient(135deg, var(--primary) 0%, #B8D4B8 100%)'  // 渐变背景
      : 'color-mix(in srgb, var(--primary) 6%, var(--bg-card))',
    color: isUser ? 'white' : 'var(--text-primary)',  // 用户气泡白色文字
    border: isUser
      ? 'none'  // 渐变背景不需要边框
      : '1px solid var(--border-light)',
    borderRadius: isUser
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.6,
    padding: '10px 16px'
  }
}
```

**AI 气泡左侧色条**：
```tsx
// 第 282-309 行，AI 消息布局升级
<div className="flex gap-2 justify-start animate-fade-in">
  <AssistantAvatar />
  <div
    className="max-w-[80%] px-4 py-2.5 whitespace-pre-wrap break-words"
    style={{
      ...bubbleStyle('assistant'),
      borderLeft: '4px solid var(--sleep)'  // 新增左侧色条
    }}
  >
    {msg.content}
  </div>
</div>
```

**推荐问题 Pill 形状**：
```tsx
// 第 342-356 行，推荐问题按钮升级
<Button
  key={q}
  variant="ghost"
  size="sm"
  onClick={() => handleSend(q)}
  accentColor="var(--sleep)"
  className="rounded-full border border-[var(--sleep)]20 hover:bg-[var(--sleep)]10"
>
  {q}
</Button>
```

**输入区玻璃态**：
```tsx
// 第 361-387 行，输入区升级
<div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/80 backdrop-blur-md">
  <div className="flex items-end gap-2 max-w-3xl mx-auto">
    <Textarea
      {...}
      className="flex-1 backdrop-blur-sm bg-[var(--bg-card)]/50"
      style={{ minHeight: '40px', maxHeight: '120px', overflowY: 'auto' }}
    />
    <Button {...}>发送</Button>
  </div>
</div>
```

**设计 Token 使用**：
- 渐变背景：`--gradient-primary`
- 玻璃态：`--glass-bg` + `--glass-blur`
- 色条：`4px solid var(--sleep)`

**动效描述**：
1. 消息出现：fade-in 动画（0.3s ease）
2. 打字指示器：TypingDots 波浪动画
3. 推荐问题：fade-in 延迟显示

**验收标准**：
- [ ] 用户气泡有渐变背景
- [ ] 用户气泡文字为白色
- [ ] AI 气泡有左侧色条
- [ ] 推荐问题为 Pill 形状
- [ ] 输入区有玻璃态效果

---

### 2.6 成长报告页（`/report`）

#### 当前状态分析
- 文件位置：`client/src/pages/report/index.tsx`
- 当前实现：已有报告结构，需要封面和指标升级

#### 具体改动点

**封面渐变背景 + 装饰字**：
```tsx
// ReportCover 组件升级
<div 
  className="relative overflow-hidden rounded-xl p-6"
  style={{
    background: 'linear-gradient(135deg, var(--primary) 0%, #B8D4B8 100%)',
    minHeight: '200px'
  }}
>
  {/* 大号装饰字 */}
  <div className="absolute top-4 right-6 opacity-20">
    <span className="text-[80px] font-bold text-white">W</span>
    <span className="text-[80px] font-bold text-white">M</span>
  </div>
  
  {/* 宝宝名 */}
  <h2 className="display-md text-white">{baby.name}</h2>
  <p className="body-md text-white/80">{period === 'week' ? '本周报告' : '本月报告'}</p>
</div>
```

**关键指标数字动画**：
```tsx
// ReportMetricsGrid 组件升级
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {metrics.map((metric, i) => (
    <Card 
      key={i}
      padding="md"
      className="text-center animate-fade-in-up"
      style={{ 
        animationDelay: `${i * 0.1}s`,
        backgroundColor: `color-mix(in srgb, ${metric.color} 6%, transparent)`
      }}
    >
      <div className="display-number text-2xl font-semibold">
        <NumberRoll value={metric.value} />
      </div>
      <div className="body-sm text-[var(--text-secondary)]">{metric.label}</div>
    </Card>
  ))}
</div>
```

**每日节律图 hover 高亮**：
```tsx
// ReportDailyRhythm 组件升级
<div className="flex items-end gap-1 h-32">
  {dailyData.map((day, i) => (
    <div 
      key={i}
      className="flex-1 flex flex-col items-center gap-1 group"
    >
      {/* 喂养柱 */}
      <div 
        className="w-full rounded-t-md transition-all duration-200 group-hover:opacity-80"
        style={{ 
          height: `${day.feedingHeight}px`,
          background: 'var(--gradient-feeding)'
        }}
      />
      {/* 睡眠柱 */}
      <div 
        className="w-full rounded-t-md transition-all duration-200 group-hover:opacity-80"
        style={{ 
          height: `${day.sleepHeight}px`,
          background: 'var(--gradient-sleep)'
        }}
      />
      {/* hover 数值标注 */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity caption">
        {day.feeding}/{day.sleep}
      </div>
    </div>
  ))}
</div>
```

**AI 总结区玻璃态**：
```tsx
// ReportAiSummary 组件升级
<Card
  padding="md"
  className="backdrop-blur-md bg-white/70 dark:bg-[var(--bg-secondary)]/70"
>
  <div className="flex items-start gap-2">
    <MagicStickLinear className="h-5 w-5 shrink-0" style={{ color: 'var(--sleep)' }} />
    <div>
      <p className="body-md text-[var(--text-primary)]">{summary}</p>
      <Button variant="ghost" size="sm" className="mt-2">重新生成</Button>
    </div>
  </div>
</Card>
```

**设计 Token 使用**：
- 封面渐变：`--gradient-primary`
- 装饰字：`display-md: 1.125rem`（实际 80px 用 inline style）
- 指标背景：`color-mix(in srgb, {color} 6%, transparent)`

**动效描述**：
1. 封面加载：fadeIn 动画
2. 指标卡片：card-stagger 动画（每个延迟 0.1s）
3. 数字：numberRoll 动画
4. 节律图：hover 高亮 + 数值标注显示

**验收标准**：
- [ ] 封面有渐变背景和装饰字
- [ ] 关键指标数字有滚动动画
- [ ] 每日节律图 hover 有高亮效果
- [ ] AI 总结区有玻璃态效果

---

### 2.7 生长曲线页（`/growth`）

#### 当前状态分析
- 文件位置：`client/src/pages/growth/index.tsx`
- 当前实现：基础 SVG 图表，需要交互增强

#### 具体改动点

**SVG 图表 tooltip**：
```tsx
// 新增 tooltip 状态
const [tooltip, setTooltip] = useState<{
  x: number, y: number, 
  date: string, value: number, 
  percentile?: number
} | null>(null)

// SVG 中新增 tooltip 元素
{tooltip && (
  <div 
    className="absolute bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md p-2 shadow-md text-sm"
    style={{ left: tooltip.x, top: tooltip.y }}
  >
    <p className="font-medium">{tooltip.date}</p>
    <p>{trendLabels[trendType].label}: {tooltip.value} {trendLabels[trendType].unit}</p>
    {tooltip.percentile && <p>百分位: P{tooltip.percentile}</p>}
  </div>
)}
```

**数据点 hover 放大**：
```tsx
// 第 268-269 行，数据点升级
<circle 
  cx={toX(p.monthAge)} 
  cy={toY(p.value)} 
  r={hoveredPoint === i ? 6 : 3}
  fill={trendLabels[trendType].color}
  className="transition-all duration-200"
  onMouseEnter={() => setHoveredPoint(i)}
  onMouseLeave={() => setHoveredPoint(null)}
/>
```

**WHO 参考线标签**：
```tsx
// 第 226-252 行，参考线标签升级
<text
  x={toX(filteredRefs[filteredRefs.length - 1].month) + 3}
  y={toY(filteredRefs[filteredRefs.length - 1][pKey]) + 3}
  fontSize="8"
  fill={percentileColors[pKey]}
  className="font-medium"
>
  P{pKey.slice(1)}  {/* P3, P15, P50, P85, P97 */}
</text>
```

**数据表格斑马纹**：
```tsx
// 第 291-299 行，表格行升级
<div 
  key={i} 
  className={`flex items-center justify-between body-md py-1.5 border-b border-[var(--border-light)] ${
    i % 2 === 0 ? 'bg-[var(--bg-elevated)]' : ''
  }`}
>
  <span className="text-[var(--text-hint)]">
    {new Date(p.date).toLocaleDateString('zh-CN')} ({p.monthAge}月)
  </span>
  <span className="font-medium text-[var(--text-primary)] number-display">{p.value} {trendLabels[trendType].unit}</span>
</div>
```

**设计 Token 使用**：
- tooltip：`--shadow-card-elevated`
- 数据点：`r: 3 → 6`（hover 放大）
- 斑马纹：`--bg-elevated`

**动效描述**：
1. 数据点 hover：r 从 3 → 6（0.2s ease）
2. tooltip：fadeIn 动画（0.2s ease）
3. 参考线标签：静态显示

**验收标准**：
- [ ] 图表有 tooltip 显示详细信息
- [ ] 数据点 hover 有放大效果
- [ ] WHO 参考线有标签显示
- [ ] 数据表格有斑马纹

---

### 2.8 个人中心页（`/profile`）

#### 当前状态分析
- 文件位置：`client/src/pages/profile/index.tsx`（需要读取）
- 当前实现：基础用户卡片和快捷入口

#### 具体改动点

**用户卡片头像渐变边框**：
```tsx
// 头像容器升级
<div className="relative inline-block">
  <div 
    className="absolute inset-0 rounded-full p-[3px]"
    style={{ background: 'var(--gradient-primary)' }}
  >
    <UserAvatar className="w-full h-full rounded-full bg-[var(--bg-card)]" />
  </div>
</div>
```

**昵称字体放大**：
```tsx
<h2 className="heading-lg text-[var(--text-primary)]">{user.nickname}</h2>
```

**快捷入口 hover 动效**：
```tsx
// 第 470-525 行，快捷入口列表升级
<Card
  padding="md"
  variant="interactive"
  className="flex items-center gap-3 transition-all duration-200 hover:translate-x-1"
>
  <div 
    className="icon-circle icon-circle--sm"
    style={{ 
      backgroundColor: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
      transition: 'all 0.2s ease'
    }}
  >
    <Icon className="h-4 w-4" style={{ color: iconColor }} />
  </div>
  <span className="flex-1 body-md text-[var(--text-primary)]">{label}</span>
  <ChevronRight className="h-4 w-4 text-[var(--text-hint)]" />
</Card>
```

**主题/字体选择器玻璃态**：
```tsx
// ThemeSelector 和 FontScaleSelector 组件升级
<Card
  padding="md"
  className="backdrop-blur-md bg-white/70 dark:bg-[var(--bg-secondary)]/70"
>
  {/* 选择器内容 */}
</Card>
```

**设计 Token 使用**：
- 头像边框：`--gradient-primary`
- 卡片 hover：`--shadow-card-elevated` + `translateX(4px)`
- 玻璃态：`--glass-bg` + `--glass-blur`

**动效描述**：
1. 头像：渐变边框静态显示
2. 快捷入口 hover：translateX(4px)（0.2s ease）
3. 选择器：glassmorphism 效果

**验收标准**：
- [ ] 头像有渐变边框
- [ ] 昵称字体为 heading-lg
- [ ] 快捷入口 hover 有动效
- [ ] 主题/字体选择器有玻璃态效果

---

### 2.9 其他页面（P3）

#### 疫苗页（`/vaccine`）
- 状态筛选标签动画优化：平滑过渡（0.2s ease）
- 列表项色条加宽：3px → 4px
- 标准推荐抽屉玻璃态：backdrop-blur-md

#### 里程碑页（`/milestone`）
- 同疫苗页升级方案

#### 黄疸页（`/jaundice`）
- 迷你折线图样式优化：线条粗细 2px → 3px
- 教育提示条渐变背景：`--gradient-temperature`

#### 设置页（`/settings`）
- Tabs 滑动指示器：pill 形状 + 滑动动画（0.3s ease）

#### 宝宝管理页（`/baby`）
- 宝宝卡片选中态渐变边框：3px 渐变
- 表单玻璃态卡片：backdrop-blur-md

#### 家庭页（`/family`）
- 成员列表项 hover 优化：`variant="interactive"` + translateX(4px)
- 邀请码玻璃态展示：glassmorphism

---

## 3. 动效清单

### 3.1 新增动效

| 动效名称 | 使用场景 | 触发条件 | 动画参数 | 实现方式 |
|---------|---------|---------|---------|---------|
| `page-enter` | 所有页面 | 页面首次加载 | fadeInUp 0.4s var(--ease-spring) | CSS animation |
| `card-stagger` | 所有列表 | 列表首次渲染 | nth-child 延迟 0.05s-0.2s | CSS animation-delay |
| `number-roll` | TodaySummary、ReportMetrics | 数字首次显示 | 0 → value, 0.4s easeOutCubic | JS requestAnimationFrame |
| `breathe-glow` | 睡眠进行中 | 持续显示 | box-shadow 0.8s ease-in-out infinite | CSS animation |
| `hover-scale` | 所有卡片 | 鼠标 hover | scale(1.02), 0.2s ease | CSS transition |
| `hover-translate` | 列表项、快捷入口 | 鼠标 hover | translateX(4px), 0.2s ease | CSS transition |
| `icon-rotate` | 发现页功能入口 | 鼠标 hover | rotate(10deg), 0.3s ease | CSS transition |
| `pill-glow` | 筛选标签选中态 | 选中状态 | box-shadow 0.3s ease | CSS transition |
| `tooltip-fade` | 图表 tooltip | 鼠标 hover 数据点 | fadeIn 0.2s ease | CSS animation |
| `data-point-pop` | 图表数据点 | 鼠标 hover | r: 3 → 6, 0.2s ease | CSS transition |

### 3.2 动效实现代码

**page-enter**：
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**card-stagger**：
```css
.card-stagger:nth-child(1) { animation-delay: 0s; }
.card-stagger:nth-child(2) { animation-delay: 0.05s; }
.card-stagger:nth-child(3) { animation-delay: 0.1s; }
.card-stagger:nth-child(4) { animation-delay: 0.15s; }
.card-stagger:nth-child(5) { animation-delay: 0.2s; }
```

**number-roll**：
```typescript
function NumberRoll({ value, duration = 400 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  
  useEffect(() => {
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplay(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    animate()
  }, [value, duration])
  
  return <span className="display-number">{display}</span>
}
```

**breathe-glow**：
```css
@keyframes breatheGlow {
  0%, 100% {
    box-shadow: 0 0 8px -2px var(--primary);
  }
  50% {
    box-shadow: 0 0 16px -2px var(--primary);
  }
}

.animate-breathe {
  animation: breatheGlow 1.5s ease-in-out infinite;
}
```

### 3.3 动效性能优化

**prefers-reduced-motion 支持**：
```css
@media (prefers-reduced-motion: reduce) {
  .page-enter,
  .card-stagger,
  .animate-breathe,
  .animate-pulse,
  .animate-spin {
    animation: none !important;
  }
  
  .hover-scale,
  .hover-translate,
  .icon-rotate {
    transition: none !important;
  }
}
```

**GPU 加速**：
```css
.page-enter,
.card-stagger {
  will-change: transform, opacity;
  transform: translateZ(0);
}
```

---

## 4. 空态设计清单

### 4.1 空态页面列表

| 页面 | 插画方案 | 文案 | 操作按钮 |
|------|---------|------|---------|
| 首页（无宝宝） | Baby + Plus 图标组合 | "添加宝宝开始使用"<br/>"记录宝宝的成长点滴" | "添加宝宝" |
| 首页（无记录） | ClipboardList + Plus 图标 | "暂无记录"<br/>"点击添加按钮创建第一条记录" | "添加记录" |
| 记录页（无记录） | ClipboardList + Plus 图标组合 | "暂无记录"<br/>"点击下方按钮创建第一条记录" | "添加记录" |
| 发现页（无待办） | Trophy + Check 图标 | "一切顺利"<br/>"暂无待办事项" | 无 |
| 成长报告页（无宝宝） | BookOpen + Baby 图标 | "请先添加宝宝"<br/>"添加宝宝后可查看成长报告" | "添加宝宝" |
| 生长曲线页（无数据） | GraphUp + TrendUp 图标 | "暂无生长数据"<br/>"点击右上角「记录」添加生长数据" | "记录" |
| 疫苗页（无数据） | Syringe + ClipboardList 图标 | "暂无疫苗记录"<br/>"点击添加按钮创建第一条疫苗记录" | "添加疫苗" |
| 里程碑页（无数据） | Trophy + Star 图标 | "暂无里程碑"<br/>"记录宝宝的重要时刻" | "添加里程碑" |

### 4.2 空态插画实现

**统一空态组件**：
```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state min-h-[50vh] flex flex-col items-center justify-center p-8">
      {/* 插画 */}
      <div className="empty-state__illustration mb-6 relative">
        {icon}
      </div>
      
      {/* 标题 */}
      <p className="empty-state__title body-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </p>
      
      {/* 描述 */}
      <p className="empty-state__desc body-md text-[var(--text-hint)] mb-6 text-center max-w-md">
        {description}
      </p>
      
      {/* 操作按钮 */}
      {action && (
        <div className="empty-state__action">
          {action}
        </div>
      )}
    </div>
  )
}
```

**首页空态示例**：
```tsx
<EmptyState
  icon={
    <div className="relative">
      <Baby className="h-24 w-24 text-[var(--text-hint)]" />
      <Plus className="absolute -bottom-1 -right-1 h-8 w-8 text-[var(--primary)] animate-bounce" />
    </div>
  }
  title="添加宝宝开始使用"
  description="记录宝宝的成长点滴，科学育儿从今天开始"
  action={
    <Button variant="primary" onClick={() => navigate('/baby/create')}>
      添加宝宝
    </Button>
  }
/>
```

**记录页空态示例**：
```tsx
<EmptyState
  icon={
    <div className="relative">
      <ClipboardListLinear className="h-24 w-24 text-[var(--text-hint)]" />
      <Plus className="absolute -bottom-1 -right-1 h-8 w-8 text-[var(--primary)] animate-pulse" />
    </div>
  }
  title="暂无记录"
  description="点击添加按钮创建第一条记录"
  action={
    <Button variant="primary" onClick={() => openRecordDialog('feeding')}>
      添加记录
    </Button>
  }
/>
```

### 4.3 空态设计 Token

**布局**：
- 最小高度：`min-h-[50vh]`
- 间距：`space-y-6`（24px）
- 最大宽度：`max-w-md`（448px）

**图标**：
- 主图标尺寸：`h-24 w-24`（96px）
- 装饰图标尺寸：`h-8 w-8`（32px）
- 图标颜色：`var(--text-hint)`

**文字**：
- 标题：`body-lg font-semibold`
- 描述：`body-md` + `var(--text-hint)`

**动效**：
- 装饰图标：animate-bounce 或 animate-pulse

---

## 5. 实施计划

### 5.1 Phase 2 实施顺序

**第 1 周（P0）**：
- Day 1-2：登录页重构（P0-1 ~ P0-5）
- Day 3-4：首页重构（P0-6 ~ P0-10）
- Day 5：测试和修复

**第 2 周（P1）**：
- Day 1-2：记录页重构（P1-1 ~ P1-5）
- Day 3：发现页重构（P1-6 ~ P1-8）
- Day 4-5：成长报告页重构（P1-9 ~ P1-11）

**第 3 周（P2）**：
- Day 1-2：AI 助手页重构（P2-1 ~ P2-4）
- Day 3：生长曲线页重构（P2-5 ~ P2-8）
- Day 4-5：个人中心页重构（P2-9 ~ P2-10）

**第 4 周（P3）**：
- Day 1-2：疫苗/里程碑/黄疸页重构（P3-1 ~ P3-5）
- Day 3：设置/宝宝管理/家庭页重构（P3-6 ~ P3-10）
- Day 4-5：Phase 3 动效与空态（P3-11 ~ P3-16）

### 5.2 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 动效过多导致性能问题 | 中 | 高 | 使用 `prefers-reduced-motion` 禁用动画 |
| 玻璃态在低端设备渲染卡顿 | 低 | 中 | 提供 fallback（纯色背景） |
| 渐变背景增加 GPU 负担 | 中 | 中 | 限制渐变使用范围（仅关键区域） |
| 重构过程中引入新 bug | 高 | 高 | 每个 Phase 完成后进行视觉回归测试 |

---

## 6. 验收标准汇总

### 6.1 功能验收

- [ ] 所有页面使用 Primitive 组件（无遗留 CSS 类）
- [ ] 所有页面有入场动画（page-enter）
- [ ] 所有关键数字有 numberRoll 动画
- [ ] 所有卡片有 hover 动效
- [ ] 亮色/暖夜双模式视觉一致
- [ ] 字体四档显示正常
- [ ] 空态设计情感化

### 6.2 性能验收

- [ ] 所有动画在 `prefers-reduced-motion` 下禁用
- [ ] 页面加载时间 < 2s（首次加载）
- [ ] 动画帧率 ≥ 30fps（低端设备）
- [ ] GPU 内存占用 < 50MB（移动端）

### 6.3 兼容性验收

- [ ] Chrome/Edge（最新版）：完美显示
- [ ] Safari（最新版）：完美显示
- [ ] Firefox（最新版）：完美显示
- [ ] iOS Safari：完美显示
- [ ] Android Chrome：完美显示

---

## 7. 附录

### 7.1 设计资源链接

- shadcn/ui Dashboard：https://ui.shadcn.com/examples/dashboard
- TailAdmin React：https://tailadmin.com/react
- Horizon UI：https://horizon-ui.com/
- CoreUI React：https://coreui.io/react/

### 7.2 相关文档

- 完整重构方案：`docs/web-ui-refactor-v6-plan.md`
- Web UI 交互规范：`docs/web-ui-spec.md`
- Web 组件库：`docs/web-component-library.md`
- Web 端架构：`docs/web-architecture.md`

---

*文档维护：每完成一个 Phase，更新本文档对应章节的状态。*

