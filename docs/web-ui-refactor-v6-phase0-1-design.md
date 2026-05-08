# Baby Care Tracker Web v6.0 重构设计文档
## Phase 0：设计系统升级 & Phase 1：基础组件升级

> **版本**: v1.0 | **日期**: 2026-05-08 | **状态**: 设计中
> **作者**: design-system Agent | **审核**: team-lead
> **参考文档**: web-ui-refactor-v6-plan.md, web-ui-spec.md, globals.css, button.tsx, card.tsx, badge.tsx

---

## 1. 任务拆分表

### 1.1 Phase 0：设计系统升级

| ID | 任务名称 | 优先级 | 预估工时 | 依赖关系 | 状态 |
|-----|---------|---------|---------|---------|------|
| P0-01 | 新增渐变 Token（7个） | 高 | 0.5天 | 无 | 待开始 |
| P0-02 | 新增玻璃态 Token | 高 | 0.5天 | 无 | 待开始 |
| P0-03 | 新增增强阴影 Token | 高 | 0.5天 | 无 | 待开始 |
| P0-04 | 新增动画 Token | 中 | 0.5天 | 无 | 待开始 |
| P0-05 | 新增动效关键帧 | 中 | 1天 | P0-04 | 待开始 |
| P0-06 | 明暗模式适配验证 | 高 | 0.5天 | P0-01~P0-05 | 待开始 |
| P0-07 | 更新文档 (web-ui-spec.md) | 中 | 0.5天 | P0-01~P0-06 | 待开始 |

### 1.2 Phase 1：基础组件升级

| ID | 任务名称 | 优先级 | 预估工时 | 依赖关系 | 状态 |
|-----|---------|---------|---------|---------|------|
| P1-01 | `<Button>` 新增 gradient/glass 变体 | 高 | 1天 | P0-01, P0-02 | 待开始 |
| P1-02 | `<Card>` 新增 glass/gradient-header 变体 | 高 | 1天 | P0-01, P0-02 | 待开始 |
| P1-03 | `<Badge>` 新增 gradient/glass 变体 | 中 | 0.5天 | P0-01, P0-02 | 待开始 |
| P1-04 | `<Input>` focus 动画（左侧色条） | 中 | 0.5天 | P0-04 | 待开始 |
| P1-05 | `<Dialog>` 玻璃态变体 | 中 | 1天 | P0-02, P1-01 | 待开始 |
| P1-06 | 更新文档 (web-component-library.md) | 中 | 0.5天 | P1-01~P1-05 | 待开始 |

**总计预估工时**: Phase 0 (约3.5天) + Phase 1 (约4.5天) = **约8天**

---

## 2. 详细设计方案 — Phase 0：设计系统升级

### 2.1 P0-01：新增渐变 Token（7个）

#### 2.1.1 设计说明

为各功能色新增 135° 渐变背景，用于按钮、卡片头部、图标容器等强调区域。
渐变方向统一为 `135deg`（从左上到右下），与 TailAdmin/Horizon UI 风格一致。

#### 2.1.2 实现步骤

**文件**: `client/src/styles/globals.css`

在 `:root` 中新增以下 Token：

```css
:root {
  /* === 渐变背景（135deg 统一方向）=== */
  --gradient-primary: linear-gradient(135deg, #D4B896 0%, #B8D4B8 100%);
  --gradient-feeding: linear-gradient(135deg, #A8D4A8 0%, #8BC48B 100%);
  --gradient-sleep: linear-gradient(135deg, #B8A8D4 0%, #9488B4 100%);
  --gradient-diaper: linear-gradient(135deg, #D4C8A8 0%, #B09068 100%);
  --gradient-temperature: linear-gradient(135deg, #D4A8A8 0%, #B48888 100%);
  --gradient-growth: linear-gradient(135deg, #7BA9C9 0%, #5B8FAF 100%);
  --gradient-warning: linear-gradient(135deg, #D4883D 0%, #B06838 100%);
}
```

在 `.dark` 中新增暗色模式对应值：

```css
.dark {
  /* === 渐变背景（暗色模式降饱和）=== */
  --gradient-primary: linear-gradient(135deg, #C8A880 0%, #8CB88C 100%);
  --gradient-feeding: linear-gradient(135deg, #7CAF7C 0%, #5C8F5C 100%);
  --gradient-sleep: linear-gradient(135deg, #9488B4 0%, #7A6898 100%);
  --gradient-diaper: linear-gradient(135deg, #B4A888 0%, #907050 100%);
  --gradient-temperature: linear-gradient(135deg, #B48888 0%, #A07070 100%);
  --gradient-growth: linear-gradient(135deg, #5C8CA8 0%, #4A7A94 100%);
  --gradient-warning: linear-gradient(135deg, #C47830 0%, #A05820 100%);
}
```

#### 2.1.3 验收标准

- [ ] 所有 7 个渐变 Token 在 `:root` 中定义
- [ ] 所有 7 个渐变 Token 在 `.dark` 中有对应值（降饱和处理）
- [ ] 使用 `var(--gradient-*)` 的组件在明暗模式下视觉一致
- [ ] 渐变方向统一为 `135deg`

---

### 2.2 P0-02：新增玻璃态 Token

#### 2.2.1 设计说明

玻璃态（Glassmorphism）效果用于登录页卡片、AI 洞察区、功能入口卡片等需要层次感的场景。
核心参数：`backdrop-filter: blur()` + 半透明背景 + 1px 边框。

#### 2.2.2 实现步骤

**文件**: `client/src/styles/globals.css`

在 `:root` 中新增：

```css
:root {
  /* === 玻璃态（Glassmorphism）=== */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-bg-dark: rgba(42, 36, 32, 0.72);
  --glass-blur: blur(12px);
  --glass-border: 1px solid rgba(212, 184, 150, 0.18);
  --glass-shadow: 0 8px 32px rgba(139, 123, 107, 0.12);
}
```

在 `.dark` 中新增：

```css
.dark {
  /* === 玻璃态（暗色模式更深透）=== */
  --glass-bg: rgba(42, 36, 32, 0.72);
  --glass-bg-dark: rgba(30, 26, 22, 0.72);
  --glass-blur: blur(12px);
  --glass-border: 1px solid rgba(212, 184, 150, 0.12);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

新增玻璃态工具类：

```css
/* ============ Glassmorphism Utility ============ */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.glass--dark {
  background: var(--glass-bg-dark);
}
```

#### 2.2.3 验收标准

- [ ] `--glass-bg`、`--glass-blur` 等 5 个 Token 在明暗模式下都有定义
- [ ] `.glass` 工具类可复用
- [ ] 玻璃态效果在低端设备有 fallback（纯色背景）

---

### 2.3 P0-03：新增增强阴影 Token

#### 2.3.1 设计说明

当前阴影偏平，需要增强层次感。新增 3 个阴影 Token 用于不同层级的悬浮效果。

#### 2.3.2 实现步骤

**文件**: `client/src/styles/globals.css`

在 `:root` 中修改/新增：

```css
:root {
  /* 修改现有 shadow-card（增强）*/
  --shadow-card: 0 2px 16px rgba(139, 123, 107, 0.10);
  
  /* 新增增强阴影 */
  --shadow-card-elevated: 0 4px 24px rgba(139, 123, 107, 0.14);
  --shadow-float: 0 8px 32px rgba(139, 123, 107, 0.18);
  --shadow-glow-primary: 0 0 20px -4px var(--primary), 0 0 8px -4px var(--primary);
}
```

在 `.dark` 中新增：

```css
.dark {
  --shadow-card: 0 2px 16px rgba(0, 0, 0, 0.35);
  --shadow-card-elevated: 0 4px 24px rgba(0, 0, 0, 0.40);
  --shadow-float: 0 8px 32px rgba(0, 0, 0, 0.50);
  --shadow-glow-primary: 0 0 20px -4px var(--primary), 0 0 8px -4px var(--primary);
}
```

#### 2.3.3 验收标准

- [ ] `--shadow-card-elevated`、`--shadow-float`、`--shadow-glow-primary` 在明暗模式都定义
- [ ] 现有 `--shadow-card` 微调后保持向后兼容

---

### 2.4 P0-04：新增动画 Token

#### 2.4.1 设计说明

统一动画语言和缓动函数，新增 spring 缓动用于微交互。

#### 2.4.2 实现步骤

**文件**: `client/src/styles/globals.css`

在 `:root` 中新增：

```css
:root {
  /* === 动画时长（升级）=== */
  --duration-instant: 0.1s;
  --duration-fast: 0.2s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;
  --duration-spring: 0.4s;
  
  /* === 缓动函数（升级）=== */
  --ease-default: ease;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

#### 2.4.3 验收标准

- [ ] `--duration-spring` 和 `--ease-spring` 定义
- [ ] 现有动画使用新 Token 重构（可选）

---

### 2.5 P0-05：新增动效关键帧

#### 2.5.1 设计说明

新增 5 个关键帧动画用于数字滚动、呼吸灯、卡片交错入场、页面转场等场景。

#### 2.5.2 实现步骤

**文件**: `client/src/styles/globals.css`

在动画区域新增：

```css
/* ============ New Keyframes (v6.0) ============ */

/* 数字滚动（用于 TodaySummary 大数字）*/
@keyframes numberRoll {
  0% {
    opacity: 0;
    transform: translateY(0.5em);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 呼吸灯（用于进行中睡眠状态）*/
@keyframes breatheGlow {
  0%, 100% {
    box-shadow: 0 0 8px -2px var(--primary), 0 0 16px -4px rgba(212, 184, 150, 0.3);
  }
  50% {
    box-shadow: 0 0 16px -2px var(--primary), 0 0 32px -4px rgba(212, 184, 150, 0.4);
  }
}

/* 卡片 stagger 入场（父容器加 .stagger-children）*/
.stagger-children > * {
  animation: fadeInUp 0.4s var(--ease-out) both;
}
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
.stagger-children > *:nth-child(4) { animation-delay: 150ms; }
.stagger-children > *:nth-child(5) { animation-delay: 200ms; }
.stagger-children > *:nth-child(6) { animation-delay: 250ms; }

/* 页面入场 */
.page-enter {
  animation: fadeInUp 0.4s var(--ease-spring) both;
}

/* 浮动动画（用于装饰元素）*/
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* 应用工具类 */
.animate-number-roll {
  animation: numberRoll 0.4s var(--ease-out) both;
}

.animate-breathe-glow {
  animation: breatheGlow 2s ease-in-out infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
```

#### 2.5.3 验收标准

- [ ] `numberRoll` 关键帧定义
- [ ] `breatheGlow` 关键帧定义
- [ ] `.stagger-children` 工具类定义（支持 6 个子元素）
- [ ] `.page-enter` 类定义
- [ ] `float` 关键帧定义
- [ ] `prefers-reduced-motion` 媒体查询中禁用这些动画

**prefers-reduced-motion 处理**：

```css
@media (prefers-reduced-motion: reduce) {
  .stagger-children > *,
  .page-enter,
  .animate-number-roll,
  .animate-breathe-glow,
  .animate-float {
    animation: none !important;
  }
}
```

---

### 2.6 P0-06：明暗模式适配验证

#### 2.6.1 设计说明

确保所有新增 Token 在暗色模式下都有对应的值，并且对比度满足 WCAG AA 标准（≥4.5:1）。

#### 2.6.2 实现步骤

1. 检查 `:root` 和 `.dark` 中新增 Token 的完整性
2. 使用浏览器 DevTools 验证颜色对比度
3. 在 Tailwind 的 `@theme inline` 中注册新 Token（用于 Tailwind 类）

```css
@theme inline {
  /* 新增渐变 */
  --color-gradient-primary: linear-gradient(135deg, #D4B896 0%, #B8D4B8 100%);
  /* ... 其他渐变 */
  
  /* 新增阴影 */
  --shadow-card-elevated: var(--shadow-card-elevated);
  --shadow-float: var(--shadow-float);
  --shadow-glow-primary: var(--shadow-glow-primary);
}
```

#### 2.6.3 验收标准

- [ ] 所有新增 Token 在 `.dark` 中都有对应值
- [ ] 颜色对比度 ≥ 4.5:1（使用 WebAIM 工具验证）
- [ ] 新增 Token 在 `@theme inline` 中注册（如需用 Tailwind 类）

---

### 2.7 P0-07：更新文档

#### 2.7.1 设计说明

更新 `docs/web-ui-spec.md` 的 §4.1 CSS 变量定义，记录新增的 Token。

#### 2.7.2 实现步骤

1. 在 `web-ui-spec.md` 的 `### 4.1 CSS 变量完整定义` 中新增：
   - 渐变 Token（7 个）
   - 玻璃态 Token（5 个）
   - 增强阴影 Token（3 个）
   - 动画 Token（2 个）

2. 在 `### 4.3 动效规范` 中新增：
   - `numberRoll` 关键帧
   - `breatheGlow` 关键帧
   - `cardStagger` 工具类
   - `page-enter` 类
   - `float` 关键帧

#### 2.7.3 验收标准

- [ ] `web-ui-spec.md` 已更新，包含所有新增 Token 和动效

---

## 3. 详细设计方案 — Phase 1：基础组件升级

### 3.1 P1-01：`<Button>` 新增 gradient/glass 变体

#### 3.1.1 设计说明

当前 `<Button>` 有 7 个 variant（primary, secondary, ghost, outline, danger, danger-outline, link）。
需要新增：
- `gradient-primary`、`gradient-feeding`、`gradient-sleep`、`gradient-diaper`、`gradient-temperature`、`gradient-growth`：渐变背景 + 白色文字
- `glass`：玻璃态背景

#### 3.1.2 实现步骤

**文件**: `client/src/components/ui/button.tsx`

修改 `buttonVariants` 的 `variants.variant`：

```typescript
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium',
    'transition-all shrink-0 whitespace-nowrap',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
    'focus-visible:ring-[var(--primary)]/40',
  ].join(' '),
  {
    variants: {
      variant: {
        // ... 保留现有 variant
        
        // 新增：渐变变体（白色文字 + 渐变背景）
        'gradient-primary':
          'text-white bg-[var(--gradient-primary)] hover:opacity-85 active:opacity-75 shadow-[var(--shadow-glow-primary)]',
        'gradient-feeding':
          'text-white bg-[var(--gradient-feeding)] hover:opacity-85 active:opacity-75',
        'gradient-sleep':
          'text-white bg-[var(--gradient-sleep)] hover:opacity-85 active:opacity-75',
        'gradient-diaper':
          'text-white bg-[var(--gradient-diaper)] hover:opacity-85 active:opacity-75',
        'gradient-temperature':
          'text-white bg-[var(--gradient-temperature)] hover:opacity-85 active:opacity-75',
        'gradient-growth':
          'text-white bg-[var(--gradient-growth)] hover:opacity-85 active:opacity-75',
        
        // 新增：玻璃态变体
        'glass':
          'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] ' +
          'border-[var(--glass-border)] text-[var(--text-primary)] ' +
          'hover:bg-[var(--bg-elevated)] hover:border-[var(--primary)]',
      },
      // ... 保留现有 size 和 block
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
)
```

#### 3.1.3 组件 API 设计

```typescript
// 现有接口不变，新增 variant 选项
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  accentColor?: string
  active?: boolean
  iconSize?: IconSize
  // variant 新增选项：
  // 'gradient-primary' | 'gradient-feeding' | 'gradient-sleep' | 
  // 'gradient-diaper' | 'gradient-temperature' | 'gradient-growth' | 'glass'
}
```

#### 3.1.4 验收标准

- [ ] 6 个渐变 variant 可用（gradient-primary 等）
- [ ] 1 个玻璃态 variant 可用（glass）
- [ ] 渐变按钮文字为白色，hover 时 opacity-85
- [ ] 玻璃态按钮有 backdrop-blur 效果
- [ ] 所有新增 variant 在暗色模式下视觉正常

---

### 3.2 P1-02：`<Card>` 新增 glass/gradient-header 变体

#### 3.2.1 设计说明

当前 `<Card>` 有 5 个 variant（default, interactive, ghost, accent, cta）。
需要新增：
- `glass`：玻璃态卡片（用于登录页、AI 洞察区）
- `gradient-header`：顶部渐变条的卡片（用于报告封面、功能入口）

#### 3.2.2 实现步骤

**文件**: `client/src/components/ui/card.tsx`

修改 `cardVariants` 的 `variants.variant`：

```typescript
const cardVariants = cva(
  [
    'rounded-[var(--radius-lg)]',
    'border transition-[border-color,background-color,box-shadow] duration-200',
  ].join(' '),
  {
    variants: {
      variant: {
        // ... 保留现有 variant
        
        // 新增：玻璃态变体
        glass: [
          'bg-[var(--glass-bg)]',
          'backdrop-blur-[var(--glass-blur)]',
          'border-[var(--glass-border)]',
          'shadow-[var(--glass-shadow)]',
          'hover:border-[var(--primary)]/30',
        ].join(' '),
        
        // 新增：渐变头部变体（需配合 gradientColor prop）
        'gradient-header': [
          'relative overflow-hidden',
          'bg-[var(--bg-card)] border-[var(--border-light)]',
          'hover:shadow-[var(--shadow-card-elevated)]',
        ].join(' '),
      },
      // ... 保留现有 padding
    },
    defaultVariants: { variant: 'default', padding: 'md' },
  },
)
```

新增 `gradientColor` prop 用于 `gradient-header`：

```typescript
export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  accentColor?: string
  /** 仅 variant=gradient-header 生效，顶部渐变条颜色 */
  gradientColor?: string
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant, padding, accentColor, gradientColor, as: Comp = 'div', style, children, ...props },
    ref,
  ) => {
    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(cardVariants({ variant, padding }), className)}
        style={style}
        {...props}
      >
        {/* gradient-header 变体时，渲染顶部渐变条 */}
        {variant === 'gradient-header' && (
          <div
            className="h-2 rounded-t-[var(--radius-lg)]"
            style={{
              background: gradientColor
                ? `linear-gradient(135deg, ${gradientColor}00 0%, ${gradientColor} 100%)`
                : 'var(--gradient-primary)',
            }}
          />
        )}
        {children}
      </Comp>
    )
  },
)
```

#### 3.2.3 组件 API 设计

```typescript
interface CardProps {
  variant?: 'default' | 'interactive' | 'ghost' | 'accent' | 'cta' | 'glass' | 'gradient-header'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  accentColor?: string       // variant=accent 时生效
  gradientColor?: string    // variant=gradient-header 时生效
  as?: 'div' | 'article' | 'section'
}
```

#### 3.2.4 验收标准

- [ ] `glass` variant 可用，有 backdrop-blur 效果
- [ ] `gradient-header` variant 可用，渲染顶部渐变条
- [ ] `gradient-header` 的渐变颜色可通过 `gradientColor` prop 自定义
- [ ] 暗色模式下玻璃态效果正常

---

### 3.3 P1-03：`<Badge>` 新增 gradient/glass 变体

#### 3.3.1 设计说明

当前 `<Badge>` 有 10 个 variant（default, primary, feeding, sleep, diaper, temperature, growth, success, danger, warning, info, outline, ghost）。
需要新增：
- `gradient-primary` 等：渐变背景 + 白色文字
- `glass`：玻璃态背景

#### 3.3.2 实现步骤

**文件**: `client/src/components/ui/badge.tsx`

修改 `badgeVariants` 的 `variants.variant`：

```typescript
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded-full whitespace-nowrap',
    'font-medium leading-tight',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        // ... 保留现有 variant
        
        // 新增：渐变变体（白色文字 + 渐变背景）
        'gradient-primary':
          'text-white bg-[var(--gradient-primary)] border-transparent',
        'gradient-feeding':
          'text-white bg-[var(--gradient-feeding)] border-transparent',
        'gradient-sleep':
          'text-white bg-[var(--gradient-sleep)] border-transparent',
        'gradient-diaper':
          'text-white bg-[var(--gradient-diaper)] border-transparent',
        'gradient-temperature':
          'text-white bg-[var(--gradient-temperature)] border-transparent',
        'gradient-growth':
          'text-white bg-[var(--gradient-growth)] border-transparent',
        
        // 新增：玻璃态变体
        'glass':
          'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] ' +
          'border-[var(--glass-border)] text-[var(--text-primary)]',
      },
      // ... 保留现有 size 和 interactive
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      interactive: false,
    },
  },
)
```

#### 3.3.3 组件 API 设计

```typescript
// 现有接口不变，新增 variant 选项
type BadgeTone = 'soft' | 'solid' | 'outline'

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: ReactNode
  accentColor?: string
  tone?: BadgeTone
  'aria-pressed'?: boolean
  // variant 新增选项：
  // 'gradient-primary' | 'gradient-feeding' | 'gradient-sleep' |
  // 'gradient-diaper' | 'gradient-temperature' | 'gradient-growth' | 'glass'
}
```

#### 3.3.4 验收标准

- [ ] 6 个渐变 variant 可用
- [ ] 1 个玻璃态 variant 可用
- [ ] 渐变 Badge 文字为白色
- [ ] 玻璃态 Badge 有 backdrop-blur 效果

---

### 3.4 P1-04：`<Input>` focus 动画（左侧色条）

#### 3.4.1 设计说明

当前 `<Input>` 在 focus 时只有 ring 效果。需要新增左侧色条动画，增强视觉反馈。

#### 3.4.2 实现步骤

**文件**: `client/src/components/ui/input.tsx`

1. 新增 `accentColor` prop 用于自定义 focus 色条颜色
2. 使用 `::before` 伪元素实现左侧色条动画

```typescript
export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  variant?: 'default' | 'warning' | 'danger'
  accentColor?: string  // focus 时左侧色条颜色
}
```

修改 `input.tsx` 的样式部分，新增：

```css
/* ============ Input Focus Color Bar ============ */
.input-wrapper {
  position: relative;
  transition: all var(--transition-fast);
}

.input-wrapper:focus-within::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0%;
  background: var(--accent-color, var(--primary));
  border-radius: 0 2px 2px 0;
  transition: height var(--duration-spring) var(--ease-spring);
}

.input-wrapper:focus-within::before {
  height: 60%;
}
```

修改 `<Input>` 组件，支持 `accentColor` prop：

```typescript
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, leftIcon, rightIcon, accentColor, style, ...props }, ref) => {
    const customStyle: React.CSSProperties = accentColor
      ? { '--accent-color': accentColor, ...style }
      : style

    return (
      <div className={cn('input-wrapper', leftIcon && 'has-left-icon', rightIcon && 'has-right-icon')}>
        {leftIcon && <span className="input-icon input-icon--left">{leftIcon}</span>}
        <input
          ref={ref}
          className={cn(inputVariants({ variant }), className)}
          style={customStyle}
          {...props}
        />
        {rightIcon && <span className="input-icon input-icon--right">{rightIcon}</span>}
      </div>
    )
  },
)
```

#### 3.4.3 组件 API 设计

```typescript
interface InputProps {
  variant?: 'default' | 'warning' | 'danger'
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  accentColor?: string  // focus 时左侧色条颜色，默认 var(--primary)
}
```

#### 3.4.4 验收标准

- [ ] Input focus 时左侧出现 3px 色条动画
- [ ] 色条高度从 0% 动画到 60%（spring 缓动）
- [ ] 可通过 `accentColor` prop 自定义色条颜色
- [ ] 动画时长使用 `--duration-spring`（0.4s）

---

### 3.5 P1-05：`<Dialog>` 玻璃态变体

#### 3.5.1 设计说明

当前 `<Dialog>` 使用 `bg-[var(--bg-card)]`。需要新增玻璃态变体，用于登录页、AI 对话页等需要层次感的场景。

#### 3.5.2 实现步骤

**文件**: `client/src/components/ui/dialog.tsx`

1. 新增 `glass` prop 控制是否使用玻璃态
2. 修改 DialogContent 组件，根据 `glass` prop 应用不同样式

```typescript
export interface DialogContentProps extends DialogContentHTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  glass?: boolean  // 是否使用玻璃态效果
}
```

修改 `DialogContent` 组件：

```typescript
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size = 'md', glass = false, ...props }, ref) => {
    return (
      <DialogPortal>
        <DialogOverlay />
        <div
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'w-full gap-4 border p-6 shadow-lg duration-200',
            'data-[state=open]:animate-scale-in',
            'data-[state=closed]:animate-fade-out',
            // 玻璃态样式
            glass
              ? 'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-[var(--glass-border)] shadow-[var(--glass-shadow)]'
              : 'bg-[var(--bg-card)] border-[var(--border-light)]',
            // 响应式尺寸
            size === 'sm' && 'max-w-sm',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </DialogPortal>
    )
  },
)
```

#### 3.5.3 组件 API 设计

```typescript
interface DialogContentProps {
  size?: 'sm' | 'md' | 'lg'
  glass?: boolean  // 是否使用玻璃态效果，默认 false
}
```

#### 3.5.4 验收标准

- [ ] `glass=true` 时 Dialog 有玻璃态效果
- [ ] 玻璃态 Dialog 有 `backdrop-filter: blur(12px)`
- [ ] 玻璃态 Dialog 在暗色模式下视觉正常
- [ ] 默认 `glass=false` 保持原有样式

---

### 3.6 P1-06：更新文档

#### 3.6.1 设计说明

更新 `docs/web-component-library.md`，记录新增的组件 variant 和 API 变化。

#### 3.6.2 实现步骤

1. 在 `web-component-library.md` 中更新：
   - `<Button>` 新增 7 个 variant（6 渐变 + 1 玻璃态）
   - `<Card>` 新增 2 个 variant（glass + gradient-header）
   - `<Badge>` 新增 7 个 variant（6 渐变 + 1 玻璃态）
   - `<Input>` 新增 `accentColor` prop
   - `<Dialog>` 新增 `glass` prop

2. 为每个新增 variant 添加使用示例代码

#### 3.6.3 验收标准

- [ ] `web-component-library.md` 已更新
- [ ] 所有新增 API 都有示例代码
- [ ] 文档与代码实现一致

---

## 4. CSS Token 清单汇总

### 4.1 新增渐变 Token（7 个）

| Token 名称 | 亮色模式值 | 暗色模式值 |
|-----------|-------------|-------------|
| `--gradient-primary` | `linear-gradient(135deg, #D4B896 0%, #B8D4B8 100%)` | `linear-gradient(135deg, #C8A880 0%, #8CB88C 100%)` |
| `--gradient-feeding` | `linear-gradient(135deg, #A8D4A8 0%, #8BC48B 100%)` | `linear-gradient(135deg, #7CAF7C 0%, #5C8F5C 100%)` |
| `--gradient-sleep` | `linear-gradient(135deg, #B8A8D4 0%, #9488B4 100%)` | `linear-gradient(135deg, #9488B4 0%, #7A6898 100%)` |
| `--gradient-diaper` | `linear-gradient(135deg, #D4C8A8 0%, #B09068 100%)` | `linear-gradient(135deg, #B4A888 0%, #907050 100%)` |
| `--gradient-temperature` | `linear-gradient(135deg, #D4A8A8 0%, #B48888 100%)` | `linear-gradient(135deg, #B48888 0%, #A07070 100%)` |
| `--gradient-growth` | `linear-gradient(135deg, #7BA9C9 0%, #5B8FAF 100%)` | `linear-gradient(135deg, #5C8CA8 0%, #4A7A94 100%)` |
| `--gradient-warning` | `linear-gradient(135deg, #D4883D 0%, #B06838 100%)` | `linear-gradient(135deg, #C47830 0%, #A05820 100%)` |

### 4.2 新增玻璃态 Token（5 个）

| Token 名称 | 亮色模式值 | 暗色模式值 |
|-----------|-------------|-------------|
| `--glass-bg` | `rgba(255, 255, 255, 0.72)` | `rgba(42, 36, 32, 0.72)` |
| `--glass-bg-dark` | `rgba(42, 36, 32, 0.72)` | `rgba(30, 26, 22, 0.72)` |
| `--glass-blur` | `blur(12px)` | `blur(12px)` |
| `--glass-border` | `1px solid rgba(212, 184, 150, 0.18)` | `1px solid rgba(212, 184, 150, 0.12)` |
| `--glass-shadow` | `0 8px 32px rgba(139, 123, 107, 0.12)` | `0 8px 32px rgba(0, 0, 0, 0.3)` |

### 4.3 新增增强阴影 Token（3 个）

| Token 名称 | 亮色模式值 | 暗色模式值 |
|-----------|-------------|-------------|
| `--shadow-card-elevated` | `0 4px 24px rgba(139, 123, 107, 0.14)` | `0 4px 24px rgba(0, 0, 0, 0.40)` |
| `--shadow-float` | `0 8px 32px rgba(139, 123, 107, 0.18)` | `0 8px 32px rgba(0, 0, 0, 0.50)` |
| `--shadow-glow-primary` | `0 0 20px -4px var(--primary), 0 0 8px -4px var(--primary)` | 同亮色模式 |

### 4.4 新增动画 Token（2 个）

| Token 名称 | 值 |
|-----------|-----|
| `--duration-spring` | `0.4s` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

---

## 5. 组件 API 设计汇总

### 5.1 `<Button>` 升级后的 API

```typescript
interface ButtonProps {
  // 现有 props
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  accentColor?: string
  active?: boolean
  iconSize?: IconSize
  
  // 新增 variant 选项
  variant?:
    | 'primary' | 'secondary' | 'ghost' | 'outline'
    | 'danger' | 'danger-outline' | 'link'
    | 'gradient-primary' | 'gradient-feeding' | 'gradient-sleep'
    | 'gradient-diaper' | 'gradient-temperature' | 'gradient-growth'
    | 'glass'
  
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
  block?: boolean
}
```

### 5.2 `<Card>` 升级后的 API

```typescript
interface CardProps {
  // 现有 props
  accentColor?: string
  as?: 'div' | 'article' | 'section'
  
  // 新增 variant 选项
  variant?:
    | 'default' | 'interactive' | 'ghost' | 'accent' | 'cta'
    | 'glass' | 'gradient-header'
  
  padding?: 'none' | 'sm' | 'md' | 'lg'
  
  // 新增 prop
  gradientColor?: string  // variant=gradient-header 时生效
}
```

### 5.3 `<Badge>` 升级后的 API

```typescript
interface BadgeProps {
  // 现有 props
  icon?: ReactNode
  accentColor?: string
  tone?: 'soft' | 'solid' | 'outline'
  'aria-pressed'?: boolean
  interactive?: boolean
  
  // 新增 variant 选项
  variant?:
    | 'default' | 'primary' | 'feeding' | 'sleep' | 'diaper'
    | 'temperature' | 'growth' | 'success' | 'danger' | 'warning'
    | 'info' | 'outline' | 'ghost'
    | 'gradient-primary' | 'gradient-feeding' | 'gradient-sleep'
    | 'gradient-diaper' | 'gradient-temperature' | 'gradient-growth'
    | 'glass'
  
  size?: 'xs' | 'sm' | 'md'
}
```

### 5.4 `<Input>` 升级后的 API

```typescript
interface InputProps {
  // 现有 props
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  variant?: 'default' | 'warning' | 'danger'
  
  // 新增 prop
  accentColor?: string  // focus 时左侧色条颜色
}
```

### 5.5 `<Dialog>` 升级后的 API

```typescript
interface DialogContentProps {
  // 现有 props
  size?: 'sm' | 'md' | 'lg'
  
  // 新增 prop
  glass?: boolean  // 是否使用玻璃态效果
}
```

---

## 6. 实施优先级与依赖关系图

```
Phase 0（设计系统升级）
├── P0-01: 新增渐变 Token（无依赖）
├── P0-02: 新增玻璃态 Token（无依赖）
├── P0-03: 新增增强阴影 Token（无依赖）
├── P0-04: 新增动画 Token（无依赖）
├── P0-05: 新增动效关键帧（依赖 P0-04）
├── P0-06: 明暗模式适配验证（依赖 P0-01~P0-05）
└── P0-07: 更新文档（依赖 P0-01~P0-06）

Phase 1（基础组件升级）
├── P1-01: <Button> 升级（依赖 P0-01, P0-02）
├── P1-02: <Card> 升级（依赖 P0-01, P0-02）
├── P1-03: <Badge> 升级（依赖 P0-01, P0-02）
├── P1-04: <Input> 升级（依赖 P0-04）
├── P1-05: <Dialog> 升级（依赖 P0-02, P1-01）
└── P1-06: 更新文档（依赖 P1-01~P1-05）
```

**关键路径**:
1. **优先完成 Phase 0 的 P0-01~P0-04**（无依赖，可并行）
2. **然后完成 P0-05~P0-07**（依赖前面的任务）
3. **最后完成 Phase 1 的所有任务**（依赖 Phase 0）

---

## 7. 风险与应对措施

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 渐变背景增加 GPU 负担 | 低端设备卡顿 | 限制渐变使用范围（仅关键按钮/卡片头部），提供纯色 fallback |
| 玻璃态在 Safari 兼容性 | backdrop-filter 不支持 | 检测支持性，不支持时使用纯色背景 |
| 动画过多导致性能问题 | 帧率下降 | 使用 `prefers-reduced-motion` 媒体查询禁用动画 |
| 新增 variant 导致 bundle 体积增加 | 加载时间变长 | 使用 dynamic import 按需加载（可选优化） |

---

## 8. 完成标准

### 8.1 Phase 0 完成标准

- [ ] 所有 7 个渐变 Token 在明暗模式下都有定义
- [ ] 所有 5 个玻璃态 Token 在明暗模式下都有定义
- [ ] 所有 3 个增强阴影 Token 在明暗模式下都有定义
- [ ] 所有 5 个新增动效关键帧都定义并可复用
- [ ] `prefers-reduced-motion` 媒体查询中禁用新增动画
- [ ] `web-ui-spec.md` 已更新

### 8.2 Phase 1 完成标准

- [ ] `<Button>` 新增 7 个 variant（6 渐变 + 1 玻璃态）
- [ ] `<Card>` 新增 2 个 variant（glass + gradient-header）
- [ ] `<Badge>` 新增 7 个 variant（6 渐变 + 1 玻璃态）
- [ ] `<Input>` 新增 focus 左侧色条动画
- [ ] `<Dialog>` 新增 glass 变体
- [ ] 所有新增 variant 在明暗模式下视觉正常
- [ ] `web-component-library.md` 已更新

---

## 9. 附录：参考资源

### 9.1 设计参考

- **TailAdmin React**: https://tailadmin.com/react（登录/注册页、玻璃态）
- **Horizon UI**: https://horizon-ui.com/（功能卡片、AI 对话界面）
- **shadcn/ui Dashboard**: https://ui.shadcn.com/examples/dashboard（指标卡片、表格布局）

### 9.2 技术参考

- **Glassmorphism**: https://css-tricks.com/how-to-create-a-glassmorphism-effect-in-css/
- **Spring Easing**: https://cubic-bezier.com/（0.34, 1.56, 0.64, 1）
- **WCAG Contrast Checker**: https://webaim.org/resources/contrastchecker/

---

*文档维护：每完成一个任务，更新本文档对应章节的状态。*
