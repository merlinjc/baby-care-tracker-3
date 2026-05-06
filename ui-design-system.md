# Baby Care Tracker UI 设计系统

> **版本**: v4.4 | **更新日期**: 2026-05-06 | **设计风格**: 美拉德色系 (Maillard) · 扁平化 · Web 端深度审视

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

| 功能域 | 变量 | 色值 | 用途 |
|--------|------|------|------|
| 喂养 | `--feeding` | `#A8D4A8` | 按钮纯色填充、badge 背景 |
| 睡眠 | `--sleep` | `#B8A8D4` | 按钮纯色填充、badge 背景 |
| 排便 | `--diaper` | `#D4C8A8` | 按钮纯色填充、badge 背景 |
| 体温 | `--temperature` | `#D4A8A8` | 按钮纯色填充、badge 背景 |
| 生长 | `--growth` | `#7BA9C9` | 按钮纯色填充、badge 背景 |

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

> **v4.3 扁平化**：卡片级别不再使用 `box-shadow`，仅保留 popup/elevated 层级的阴影用于弹窗和浮层。

| 变量 | 值 | 用途 |
|------|-----|------|
| `--shadow-card` | `0 2px 12px rgba(139,123,107,0.08)` | 保留变量，卡片不再引用 |
| `--shadow-soft` | `0 2px 8px rgba(139,123,107,0.06)` | 保留变量，卡片不再引用 |
| `--shadow-popup` | `0 4px 24px rgba(139,123,107,0.12)` | 弹窗/浮层专用 |
| `--shadow-elevated` | `0 8px 32px rgba(139,123,107,0.16)` | 高层级浮层 |

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
background: var(--bg-card);
border-radius: var(--radius-lg);
padding: var(--spacing-md);
border: 1px solid var(--border-light);
/* v4.3 扁平化：去除 box-shadow，仅靠 border 和背景色差区分层级 */
```

> **v4.3 扁平化规范**：卡片不使用 `box-shadow`，通过 `border` 和背景色差（card 白 vs 页面 `#F5F1EB`）区分层级。交互卡片 hover 仅变色边框 `border-color: var(--primary)`，不再 `translateY` + `shadow`。

### 6.2 按钮

- **主按钮**: 纯色 `var(--primary)` 填充，白字（v4.3 扁平化：去除渐变 `linear-gradient(135deg, ...)`）
- **次要按钮**: 白底 + 边框
- **禁用态**: `opacity: 0.5`
- **点击反馈**: `opacity: 0.75`（v4.3 扁平化：去除 `scale(0.98)` 和 `translateY(-1px)`）
- **hover 反馈**: `opacity: 0.85`（v4.3 扁平化：去除 `box-shadow`）

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

1. ~~全局 `135deg` 渐变方向~~ → **v4.3 扁平化**：去除所有 `linear-gradient`，统一使用纯色 `var(--primary)` 填充
2. 棕色调阴影（仅用于 popup/elevated 层级）——**v4.3 扁平化**：卡片级别不再使用 `box-shadow`
3. 功能色四色贯穿（绿/紫/棕/红），按钮使用对应纯色 `var(--feeding)` 等填充
4. 扁平交互反馈：hover 用 `border-color` / `opacity` 变化，active 用 `opacity` 降低——去除 `scale` / `translateY` 动效
5. 100+ CSS 变量驱动
6. **卡片纯色化 + 无阴影**：`var(--bg-card)` + `border: 1px solid var(--border-light)`，仅靠边框和背景色差区分层级
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

### 10.3 功能按钮样式对照（v4.3 扁平化）

> **v4.3 变更**：所有按钮去除 `linear-gradient` 渐变，改为纯色 `var(--xxx)` 填充。hover 仅 `opacity: 0.85`，active 仅 `opacity: 0.75`。

| 按钮类型 | 背景色 | 暗色值 | 文字色 |
|----------|--------|--------|--------|
| 喂养按钮 | `var(--feeding)` | `#7CAF7C` | 白色 |
| 睡眠按钮 | `var(--sleep)` | `#9488B4` | 白色 |
| 排便按钮 | `var(--diaper)` | `#B4A888` | 白色 |
| 体温按钮 | `var(--temperature)` | `#B48888` | 白色 |
| 生长按钮 | `var(--growth)` | `#6B99B9` | 白色 |
| 主按钮 | `var(--primary)` | `#C8A880` | 白色 |

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
7. **卡片纯色化 + 无阴影**（v4.3 更新）：所有卡片使用 `var(--bg-card)` + `border: 1px solid var(--border-light)`，去除 `box-shadow`，仅靠边框和背景色差区分层级

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

---

## 11. Web 端 v4.4 优化（深度审视）

> 本章针对 `client/` 下的 React Web 应用，对每个页面与 popup 进行的体系化审视与优化。

### 11.1 Token 命名约定（关键）

| 项 | 规则 |
|----|------|
| ✅ 在 `style={{}}` 中使用 | `var(--primary)` / `var(--feeding)` / `var(--text-primary)`（直接的 CSS 变量名） |
| ❌ 在 `style={{}}` 中**禁止** | `var(--color-primary)` / `var(--color-feeding)` 等 `--color-xxx` 前缀（这些仅在 Tailwind `@theme inline` 主题映射中使用，用于 `text-color-primary` 等 className，写在 inline style 是未定义行为，**暗色模式无法切换**） |
| ✅ 在 className 中使用 | `text-[var(--primary)]` / `bg-[var(--bg-card)]` 直接引用真实变量 |

**违规检测命令**：
```bash
grep -rn "var(--color-" client/src --include="*.tsx"
```

### 11.2 复用组件库（v4.4 新增）

#### `<Dialog>` 基础弹窗组件
路径：`client/src/components/ui/dialog.tsx`

特性：
- ESC 键关闭
- Tab 键 focus trap（键盘可达性）
- Body scroll lock（防止背景滚动）
- 移动端底部 sheet + 顶部拖动指示条
- 桌面端居中卡片（自动切换）
- 自动聚焦首个可交互元素
- 关闭后焦点自动归还

属性：
| 属性 | 类型 | 说明 |
|------|------|------|
| `open` | `boolean` | 是否显示 |
| `onClose` | `() => void` | 关闭回调 |
| `title` | `string` | 标题文字 |
| `icon` | `ReactNode` | 标题旁图标（可选） |
| `accentColor` | `string` | 图标圆背景主色（如 `var(--feeding)`） |
| `showDragIndicator` | `boolean` | 移动端拖动条（默认 true） |

#### `<SegmentedControl>` 分段控件
路径：`client/src/components/ui/segmented-control.tsx`

特性：
- 替代手写 inline style 的"喂养类型/性别/睡眠类型"等多选一控件
- 支持 `toggleable`（点击已选项可清除）
- 支持 `layout='flex' | 'wrap'`（等宽 / 自适应换行）
- 主色可定制（`accentColor`）

### 11.3 页面级优化清单

| 页面 | 主要变更 |
|------|---------|
| **home** | AI 洞察标题加刷新按钮（RefreshCw 旋转动画） |
| **record** | tabs 全量迁移到 `chip--active` + `style={{ backgroundColor }}`；列表加日期分组 header（今天/昨天/月日）；编辑/删除 hover 反馈 5% → 12% 加深 |
| **discover** | 功能列表改 2x3 grid（启动器风格）；进度卡右上角加百分比 chip |
| **profile** | 头像换为首字母（nickname[0]）；当前宝宝合并到用户卡；主题选择器选中/未选都保留 1px border（视觉稳定）；退出登录改弹窗确认 |
| **family** | 邀请码 `ABC 123` 空格分隔；角色用 lucide+badge（Crown/Pencil/Eye）；成员操作按钮 hover 才显示（减少视觉噪音） |
| **settings** | 抽取 `.tab-button` / `.tab-button--active` 全局类；JSON/CSV 导出改为 `card-interactive` 风格 + 描述文案 |
| **baby** | 选中态用 `outline: 2px solid` 替代 `borderLeft`（避免与 card-base 边框冲突）；性别用 `Mars/Venus` lucide 图标；今日 stats 改为 chip 化展示 |
| **vaccine** | 删除冗余的 4 状态统计卡（与 chip 重复）；标准计划改底部抽屉（drawer）；表单全量迁移到 input-base |
| **milestone** | 4 状态卡顶部 2px 色条；标准推荐改 2 列 grid + 详情居中 popup |
| **growth** | 全量替换 `var(--color-xxx)` token；tabs 用 `chip--active` |
| **ai-assistant** | 用户气泡改淡色（`color-mix 18% primary`）+ 边框；AI 气泡左侧加头像；思考态改 3 点波浪动画（typing-dots）；输入框改 textarea 自动伸高 + Shift+Enter 换行 |

### 11.4 Dialog 抽象前后对比

| 维度 | v4.3 | v4.4 |
|------|------|------|
| 5 个 dialog 重复代码 | ~600 行 | ~50 行（共享基础） |
| ESC 关闭 | ❌ | ✅ |
| Focus trap | ❌ | ✅ |
| Body scroll lock | ❌ | ✅ |
| 移动端拖动条 | ❌ | ✅ |
| Input 样式一致性 | ❌（手写） | ✅（input-base） |
| 保存按钮 loading | ❌ | ✅（disabled + "保存中..."） |

### 11.5 新增动画

```css
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.typing-dot { /* 6x6 圆 + stagger 150ms 延迟 */ }
```

应用场景：AI 助手"思考中"指示。

