---
name: flat-design-ui-optimization
overview: 保持美拉德色系，将当前 UI 从拟物/立体风格优化为现代扁平风格：去除渐变、减少阴影、简化边框、统一使用纯色填充，打造更清爽、更现代的视觉体验。
design:
  architecture:
    framework: react
  styleKeywords:
    - Flat Design
    - Maillard
    - Minimal Shadow
    - Pure Color
    - Border-Based Hierarchy
  fontSystem:
    fontFamily: PingFang-SC
    heading:
      size: 24px
      weight: 700
    subheading:
      size: 17px
      weight: 600
    body:
      size: 15px
      weight: 400
  colorSystem:
    primary:
      - "#D4B896"
      - "#8B7B6B"
      - "#B8D4B8"
    background:
      - "#F5F1EB"
      - "#FFFFFF"
      - "#FAFAF8"
    text:
      - "#3D3D3D"
      - "#666666"
      - "#999999"
    functional:
      - "#A8D4A8"
      - "#B8A8D4"
      - "#D4C8A8"
      - "#D4A8A8"
      - "#7BA9C9"
todos:
  - id: update-globals-css
    content: 修改 globals.css：按钮去渐变、卡片去阴影、交互反馈扁平化
    status: completed
  - id: update-home-profile
    content: 优化首页统计卡片和个人页：去渐变、顶部色条、纯色头像圆
    status: completed
    dependencies:
      - update-globals-css
  - id: update-layouts-chat
    content: 优化侧边栏、认证布局和 AI 助手页：去渐变、纯色气泡
    status: completed
    dependencies:
      - update-globals-css
  - id: unify-auth-settings-family
    content: 统一登录/注册/设置/家庭页样式：迁移到全局组件类
    status: completed
    dependencies:
      - update-globals-css
  - id: update-design-doc
    content: 同步更新 ui-design-system.md 文档
    status: completed
    dependencies:
      - update-home-profile
      - update-layouts-chat
      - unify-auth-settings-family
---

## 产品概述

对 Baby Care Tracker Web 端进行扁平化 UI 风格优化，保持美拉德色系不变，去除渐变、阴影、悬浮效果等拟物化元素，统一视觉语言。

## 核心功能

- 按钮系统去渐变化：主按钮从 `linear-gradient` 改为纯色填充
- 卡片系统简化：去除阴影，仅保留轻量边框和背景色差区分层级
- 去除悬浮/缩放动效：移除 `translateY(-1px)`、`scale(0.98)` 等立体交互反馈
- 交互反馈扁平化：hover 改为 border-color / opacity 变化，而非 shadow + 位移
- 登录/注册页样式统一：从 Tailwind 原子类迁移到全局 CSS 变量组件类
- 所有内联渐变替换为纯色：头像圆、Logo、聊天气泡、主题选择器等
- 同步更新设计系统文档

## 技术栈

- 前端框架：React + TypeScript + Vite
- 样式方案：Tailwind CSS v4 + CSS 变量 + 全局组件类（globals.css）
- 图标：Lucide React

## 实现方案

### 核心策略

将现有的「微拟物 + 渐变」视觉体系，系统性地转为「纯色 + 边框 + 色差」的扁平风格。具体做法：

1. **CSS 层**：修改 globals.css 中的组件类定义（btn-primary/card/card-interactive 等）
2. **页面层**：替换所有内联 style 中的 `linear-gradient` 为纯色，替换 shadow 引用
3. **统一化**：登录/注册页迁移到全局组件类，消除样式不一致

### 关键技术决策

**按钮系统**：`btn-primary` 从渐变改为 `background: var(--primary)`，hover 从 `translateY + shadow` 改为 `opacity: 0.85`，active 从 `scale(0.98)` 改为 `opacity: 0.75`。保留 disabled 态不变。

**卡片系统**：三级卡片（card / card-base / card-interactive）全部去除 `box-shadow`，仅通过 `border` 和 `background` 色差区分层级。`card-interactive` 的 hover 从 `translateY + shadow` 改为 `border-color: var(--primary)`。

**阴影保留策略**：仅 popup/modal 弹窗级别保留阴影（`shadow-popup`），卡片级别完全去除。这符合扁平设计「仅浮层用阴影」的惯例。

**阴影变量不删除**：保留 `--shadow-card` / `--shadow-soft` 等变量定义，但在组件类中不再引用，避免破坏 dark mode 变量体系。

### 实现注意事项

- globals.css 修改需同步检查 dark mode 的 `.dark` 选择器下是否有关联变化
- 登录/注册页迁移时需验证 `var(--xxx)` 在 Tailwind v4 `@theme inline` 下的解析是否正确
- 保留所有 CSS 变量定义，仅修改引用方的使用方式
- 设置页同时使用了 `var(--color-xxx)` 和 `var(--xxx)` 两种前缀，需统一为 `var(--xxx)`

## 目录结构

```
client/src/
├── styles/
│   └── globals.css                  # [MODIFY] 核心：按钮去渐变、卡片去阴影、交互反馈扁平化
├── pages/
│   ├── home/index.tsx               # [MODIFY] 统计卡片去除 borderLeft 改为顶部色条
│   ├── profile/index.tsx            # [MODIFY] 头像圆去渐变、主题选择器去渐变
│   ├── ai-assistant/index.tsx       # [MODIFY] 用户消息气泡去渐变、shadow-soft 替换
│   ├── family/index.tsx             # [MODIFY] 创建/加入家庭 icon-circle 去渐变
│   ├── settings/index.tsx           # [MODIFY] 按钮去渐变、统一 var(--xxx) 命名
│   └── auth/
│       ├── login.tsx                # [MODIFY] 迁移到全局组件类（btn-primary/input-base/label-base）
│       └── register.tsx             # [MODIFY] 同上
├── app/layout/
│   ├── main-layout.tsx              # [MODIFY] Logo icon-circle 去渐变
│   └── auth-layout.tsx              # [MODIFY] Logo 去渐变、统一样式
ui-design-system.md                   # [MODIFY] 更新设计系统文档，标注扁平化变更
```

## 设计风格

在保持美拉德色系（暖杏 #D4B896、深棕 #8B7B6B、薄荷绿 #B8D4B8）的基础上，将整体视觉从微拟物风格转为现代扁平风格。

### 扁平化改造要点

**按钮**：纯色填充（`var(--primary)`），hover 态仅降低透明度，无位移无阴影。次要按钮保持边框样式不变。

**卡片**：纯边框层级（`border: 1px solid var(--border-light)`），无阴影。通过背景色差（card 白 vs 页面 #F5F1EB）区分层级。交互卡片 hover 仅变色边框。

**图标圆**：保持半透明背景色（`color-mix`），去除任何渐变填充。

**统计卡片**：左侧 borderLeft 改为顶部 3px 色条，更符合扁平设计的水平节奏感。

**聊天气泡**：用户消息纯色 `var(--primary)` 背景，AI 消息纯色 `var(--bg-secondary)` 背景，无阴影。

**统一反馈语言**：所有可交互元素 hover 统一为 border-color 或 opacity 变化，active 统一为 opacity 降低，无 scale/translateY。

## Skill

- **ui-design**: 用于获取专业 UI 设计指南，确保扁平化改造符合设计规范
- Purpose: 参考扁平设计的最佳实践，验证色彩对比度和层级区分方案
- Expected outcome: 获得扁平风格的设计参数建议，确保改造后视觉质量不降级

- **lucide-icons**: 用于下载可能需要的补充图标
- Purpose: 如扁平化过程中需要替换或新增图标
- Expected outcome: 获得 SVG/React 格式的一致风格图标