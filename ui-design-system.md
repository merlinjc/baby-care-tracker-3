# Baby Care Tracker UI 设计系统

> **版本**: v4.0 | **更新日期**: 2026-04-13 | **设计风格**: 美拉德色系 (Maillard)

---

## 1. 色彩体系

### 1.1 主色调

| 变量 | 色值 | 用途 |
|------|------|------|
| `--primary-color` | `#D4B896` | 暖杏色 - 品牌主色 |
| `--primary-light` | `#E8DCC8` | 米白 |
| `--primary-dark` | `#8B7B6B` | 深棕 |
| `--accent-color` | `#B8D4B8` | 薄荷绿 |

### 1.2 功能色（按业务域）

| 功能域 | 变量 | 色值 | 渐变背景 |
|--------|------|------|---------|
| 喂养 | `--feeding-color` | `#A8D4A8` | `#E8F4E8 → #D4E8D4` |
| 睡眠 | `--sleep-color` | `#B8A8D4` | `#E8E4F4 → #D4D0E8` |
| 排便 | `--diaper-color` | `#D4C8A8` | `#F4F0E8 → #E8E4D4` |
| 体温 | `--temperature-color` | `#D4A8A8` | `#F4E8E8 → #E8D4D4` |

### 1.3 语义色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--success-color` | `#7BC950` | 成功/完成 |
| `--danger-color` | `#E85454` | 危险/逾期 |
| `--warning-color` | `#D4883D` | 警告/待处理 |
| `--info-color` | `#7BA3C9` | 信息/提示 |

### 1.4 文字色阶

| 变量 | 色值 | 用途 |
|------|------|------|
| `--text-primary` | `#3D3D3D` | 主要文字 |
| `--text-secondary` | `#666666` | 次要文字 |
| `--text-hint` | `#999999` | 辅助文字 |

### 1.5 背景色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-primary` | `#F5F1EB` | 主背景（温暖米色） |
| `--bg-secondary` | `#FFFFFF` | 卡片背景 |
| `--bg-card` | `#FFFFFF` | 卡片背景（纯色，v3.2 去除渐变） |

### 1.6 阴影用棕色调

阴影统一使用 `rgba(139, 123, 107, ...)` 而非纯黑色，保持美拉德色系一致性。

---

## 2. 字体排版

**字体族**: `'PingFang SC', 'Source Han Sans CN', sans-serif`

### 标题层级

| 类名 | 字号 | 字重 | 行高 |
|------|------|------|------|
| `.title-hero` | 56rpx | 600 | 1.3 |
| `.title-large` | 48rpx | 600 | 1.4 |
| `.title-medium` | 36rpx | 600 | 1.4 |
| `.title-small` | 32rpx | 500 | 1.5 |
| `.body-large` | 30rpx | 400 | 1.6 |
| `.body-medium` | 28rpx | 400 | 1.6 |
| `.body-small` | 24rpx | 400 | 1.5 |
| `.caption` | 20rpx | 400 | 1.4 |

---

## 3. 间距系统（8rpx 网格）

| 变量 | 值 | 等效 |
|------|-----|------|
| `--spacing-xs` | 8rpx | 1x |
| `--spacing-sm` | 16rpx | 2x |
| `--spacing-md` | 24rpx | 3x |
| `--spacing-lg` | 32rpx | 4x |
| `--spacing-xl` | 48rpx | 6x |
| `--spacing-xxl` | 64rpx | 8x |

---

## 4. 圆角与阴影

### 圆角

| 变量 | 值 | 用途 |
|------|-----|------|
| `--radius-sm` | 12rpx | 小元素/标签 |
| `--radius-md` | 24rpx | 中等卡片 |
| `--radius-lg` | 32rpx | 大卡片/弹窗 |
| `--radius-pill` | 999rpx | 胶囊/标签（v4.0 新增） |
| `--radius-xl` | 40rpx | 弹窗大圆角（v4.0 新增） |

#### v4.0 新增变量（6 个）

| 变量 | 亮色值 | 暗色值 | 用途 |
|------|--------|--------|------|
| `--growth-color` | `#7BA9C9` | `#5C8CA8` | 生长独立色 |
| `--surface-elevated` | `rgba(212,184,150,0.06)` | `rgba(212,184,150,0.04)` | 表面层次 |
| `--elevation-1` | `0 2rpx 8rpx rgba(139,123,107,0.04)` | `0 2rpx 8rpx rgba(0,0,0,0.15)` | 层级阴影 L1 |
| `--elevation-2` | `0 4rpx 16rpx rgba(139,123,107,0.06)` | `0 4rpx 16rpx rgba(0,0,0,0.2)` | 层级阴影 L2 |

### 阴影

| 变量 | 值 |
|------|-----|
| `--shadow-card` | `0 4rpx 24rpx rgba(139,123,107,0.08)` |
| `--shadow-soft` | `0 4rpx 16rpx rgba(139,123,107,0.06)` |
| `--shadow-popup` | `0 8rpx 48rpx rgba(139,123,107,0.12)` |

### 遮罩

| 变量 | 值 | 用途 |
|------|-----|------|
| `--mask-color` | `rgba(139,123,107,0.4)` | 浅遮罩 |
| `--mask-color-dark` | `rgba(61,52,39,0.6)` | 深遮罩（弹窗背景） |

---

## 5. 动画系统

| 动画名 | 时长 | 用途 |
|--------|------|------|
| `fadeInUp` | 0.6s | 页面入场 |
| `slideUp/slideDown` | 0.3s | 弹窗出/入 |
| `buttonPress` | - | 按钮按下 `scale(0.95)` |
| `sleepPulse` | 2s | 睡眠计时脉冲 |
| `timingBreathe` | 1.5s | 计时呼吸灯 |
| `shimmer` | 1.5s | 骨架屏微光 |
| `dotPulse` | 1.2s | 加载点动画 |
| `progressGrow` | 0.6s | 进度条增长（v4.0 新增） |
| `recPulse` | 1.5s | 录制指示灯呼吸（v4.0 新增） |
| `capsuleTransition` | 0.3s | 胶囊状态切换（v4.0 新增） |
| `eggScaleBounce` | 0.6s | 彩蛋弹跳入场 |
| 卡片交错 | 0-0.4s | `.card-stagger:nth-child(n)` |

### 过渡变量

- `--transition-fast`: 0.2s ease
- `--transition-normal`: 0.3s ease

---

## 6. 组件样式约定

### 6.1 卡片

```css
background: var(--bg-secondary);
border-radius: var(--radius-lg);
padding: var(--spacing-lg);
box-shadow: var(--shadow-card);
border: 1rpx solid var(--border-color);
```

> **v3.2 规范**：卡片背景统一使用 `var(--bg-secondary)` 纯色，不再使用 `var(--white) → var(--bg-primary)` 渐变。渐变在暖夜模式下产生大色差，文字不可读。

### 6.2 按钮

- **主按钮**: 渐变 `primary-color → primary-dark`，白字
- **次要按钮**: 白底 + 边框
- **禁用态**: `#E5E6EB` 背景
- **点击反馈**: `transform: scale(0.98) + opacity: 0.9`

### 6.3 弹窗

- 遮罩: `var(--mask-color-dark)`（禁止硬编码 rgba）
- 容器: `background: var(--bg-secondary)`，底部弹出，顶部圆角 `32rpx 32rpx 0 0`
- 按钮高度: 统一 88rpx
- **dark-mode 传递**: 宿主页面必须传 `dark-mode="{{darkMode}}"` 给所有弹窗组件

---

## 7. 图标系统

### 组织结构

```
/images/icons/          # ~100+ PNG 图标（扁平目录）
/images/icons/popup/    # 弹窗专用图标
/images/icons/easter-egg/ # 彩蛋图标
```

### 管理方式

通过 `utils/icon-config.js` 作为唯一真实来源：
- `ICONS` — 页面级快捷引用
- `IconConfig` — 分类配置（functional/milestone/status/navigation）
- `PopupIcons` — 弹窗专用
- 工具函数：`getStatusIcon()`, `getMilestoneIcon()`, `getRecordIcon()`

---

## 8. 响应式设计

- **单位**: 全部使用 rpx（750rpx = 屏幕宽度）
- **安全区**: 底部使用 `calc(Xrpx + env(safe-area-inset-bottom))`
- **布局**: CSS Grid (`repeat(3/4, 1fr)`) + Flexbox
- **溢出**: scroll-view 横向滚动

---

## 9. 核心设计特征

1. 全局 `135deg` 渐变方向（仅用于按钮等小面积元素）
2. 棕色调阴影（非黑色），暗色下自动切换为黑色阴影
3. 功能色四色贯穿（绿/紫/棕/红）
4. 微交互丰富（scale/pulse/shimmer/弹性曲线）
5. 100+ CSS 变量驱动
6. **卡片背景纯色化**：统一 `var(--bg-secondary)`，禁止 `var(--white) → var(--bg-primary)` 跨色系渐变
7. **暖夜模式已实装**：亮色/暖夜/跟随系统三态切换

---

*文档维护：修改设计变量或新增 UI 模式时同步更新此文档。*

---

## 10. 暖夜模式色板

> 暖夜模式（深色模式）保留美拉德暖色基因，使用深棕暖色调取代冷黑色。

### 10.1 核心色板对照

| 变量 | 亮色值 | 暗色值 | 说明 |
|------|--------|--------|------|
| `--bg-primary` | `#F5F1EB` | `#1E1A16` | 主背景：深巧克力 |
| `--bg-secondary` | `#FFFFFF` | `#2A2420` | 卡片背景：深可可 |
| `--bg-card` | `#FFFFFF` | `#2A2420` | 卡片背景（纯色） |
| `--text-primary` | `#3D3D3D` | `#E8E0D8` | 主文字：暖白 |
| `--text-secondary` | `#666666` | `#B0A898` | 次要文字 |
| `--text-hint` | `#999999` | `#7A7068` | 辅助文字 |
| `--primary-color` | `#D4B896` | `#D4B896` | **品牌色不变** |
| `--feeding-color` | `#A8D4A8` | `#7CAF7C` | 喂养（降饱和15%） |
| `--sleep-color` | `#B8A8D4` | `#9488B4` | 睡眠 |
| `--diaper-color` | `#D4C8A8` | `#B0A480` | 排便 |
| `--temperature-color` | `#D4A8A8` | `#B48888` | 体温 |
| `--white` | `#FFFFFF` | `#E8E0D8` | 暖白（仅用于文字色，禁止用作背景） |
| `--border-color` | `rgba(139,123,107,0.1)` | `rgba(212,184,150,0.08)` | 边框色 |

### 10.2 阴影与遮罩对照

| 变量 | 亮色值 | 暗色值 |
|------|--------|--------|
| `--shadow-card` | `0 4rpx 24rpx rgba(139,123,107,0.08)` | `0 4rpx 24rpx rgba(0,0,0,0.3)` |
| `--shadow-soft` | `0 4rpx 16rpx rgba(139,123,107,0.06)` | `0 4rpx 16rpx rgba(0,0,0,0.2)` |
| `--shadow-popup` | `0 8rpx 48rpx rgba(139,123,107,0.12)` | `0 8rpx 48rpx rgba(0,0,0,0.5)` |
| `--mask-color` | `rgba(139,123,107,0.4)` | `rgba(0,0,0,0.6)` |
| `--mask-color-dark` | `rgba(61,52,39,0.6)` | `rgba(0,0,0,0.75)` |

### 10.3 功能按钮渐变对照

| 变量 | 亮色值 | 暗色值 | 说明 |
|------|--------|--------|------|
| `--feeding-btn-end` | `#8BC48B` | `#5C8F5C` | 喂养按钮渐变终止 |
| `--sleep-btn-end` | `#9B8BC4` | `#7A6898` | 睡眠按钮渐变终止 |
| `--diaper-btn-end` | `#A09068` | `#A09068` | 排便按钮渐变终止 |
| `--temperature-btn-end` | `#C48B8B` | `#A07070` | 体温按钮渐变终止 |
| `--growth-btn-start` | `#7BA9C9` | `#5A8CA8` | 生长按钮渐变起始 |
| `--growth-btn-end` | `#5B8FAF` | `#4A7A94` | 生长按钮渐变终止 |
| `--fab-start` | `#D4A574` | `#B08858` | FAB 按钮渐变起始 |
| `--fab-end` | `#A67C52` | `#886438` | FAB 按钮渐变终止 |

### 10.4 密度块色对照

| 变量 | 亮色值 | 暗色值 | 说明 |
|------|--------|--------|------|
| `--density-level-0` | `#F5F1EB` | `#3D3428` | 无记录 |
| `--density-level-2` | `#D4B896` | `#A08050` | 中等密度 |
| `--density-level-3` | `#B89868` | `#886840` | 较高密度 |
| `--density-level-4` | `#8B7348` | `#705838` | 高密度 |

### 10.5 设计决策

1. **暖色暗底**：主背景 `#1E1A16`（带红棕色调），非纯黑 `#000`
2. **品牌色不变**：`#D4B896` 在暗底上对比度 6.4:1，更清晰
3. **功能色降饱和**：四色降 15% 饱和度，暗底上不刺眼但可辨
4. **阴影策略切换**：亮色棕阴影 → 暗色黑阴影（暗底上棕阴影不可见）
5. **发热等级色不变**：语义色保持认知一致性
6. **分享图始终亮色**：社交分享场景需要亮色背景
7. **卡片纯色化**（v3.2 新增）：所有卡片背景统一使用 `var(--bg-secondary)` 纯色，消除 `var(--white) → var(--bg-primary)` 跨色系渐变导致的暗色模式文字不可读问题

### 10.6 技术实现

- CSS 变量覆盖：通过 `.dark-mode {}` 选择器，加在每页根 `<view>` 上
- 导航栏/TabBar：`theme.json` + `app.json` 变量引用
- JS 颜色：`ThemeManager.getColor(key)` 获取主题感知色值
- 三态开关：亮色/暖夜/跟随系统
- **组件 dark-mode 传递**：所有自定义组件需通过 `properties.darkMode` 接收暗色状态，宿主页面 WXML 中必须传 `dark-mode="{{darkMode}}"`

### 10.7 `var(--white)` 使用规范

| 场景 | 是否可用 | 替代方案 |
|------|---------|---------|
| 卡片/容器背景 | **禁止** | `var(--bg-secondary)` |
| 弹窗/弹窗内卡片背景 | **禁止** | `var(--bg-secondary)` |
| 文字颜色（暗底白字） | 可用 | — |
| 小型装饰元素（图标圈、checkbox） | 可用 | — |
| 遮罩背景 | **禁止** | `var(--mask-color-dark)` |
| box-shadow rgba | **禁止** | `var(--shadow-card)` / `var(--shadow-soft)` |

### 10.8 暗色模式编码清单（Checklist）

新增/修改页面或组件时，必须检查：

- [ ] 所有 `background` 使用 CSS 变量，无硬编码 `#hex` 或 `rgba()`
- [ ] 卡片背景使用 `var(--bg-secondary)`，非 `var(--white)` 或渐变
- [ ] 弹窗遮罩使用 `var(--mask-color-dark)`
- [ ] box-shadow 使用 `var(--shadow-card)` / `var(--shadow-soft)`，非硬编码 rgba
- [ ] 组件 WXML 根元素绑定 `{{darkMode ? 'dark-mode' : ''}}`
- [ ] 宿主页面 WXML 传递 `dark-mode="{{darkMode}}"` 给所有子组件
- [ ] 文字颜色使用 `var(--text-primary)` / `var(--text-secondary)` / `var(--text-hint)`
