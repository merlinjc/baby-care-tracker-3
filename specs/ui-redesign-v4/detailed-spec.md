# Baby Care Tracker 4.0 全页面/组件细化规格

> **版本**: v4.0-r2 | **日期**: 2026-04-10
> **主文档**: `design-spec.md`（设计总纲 + 4 个 Tab 页核心重设计）
> **本文档**: 覆盖全部 18 个页面 + 15 个组件 + 所有弹窗的逐一细化规格

---

## 一、全局统一规范

### 1.1 页头样式统一（page-header）

所有非 Tab 页的页头样式升级（基于 `styles/page-header.wxss`）：

| 元素 | v3.x 实际值 | v4.0 |
|------|------------|------|
| 图标容器 | 72rpx（共享） / 80rpx（record/discover 覆盖） | **去掉装饰图标**，仅保留标题+副标题 |
| 标题 | 36rpx/600（共享） / 40rpx（record/discover 覆盖） | 统一 36rpx/600 |
| 副标题 | 24rpx/400/`--text-secondary` | 不变 |

**去掉页头图标的页面**（WXML 中删除 `.header-icon` 区块）:
baby-create, baby-list, guide, family-create, family-join, growth, vaccine, milestone, baby-detail, ai-assistant, family, export, settings, record

**保留页头图标的页面**:
- discover -- 保留 `compass.png`（品牌辨识度，发现页标志性元素）

**注意**: `styles/page-header.wxss` 中 `.header-icon` 样式保留不删，因为 discover 仍在使用。其他页面在 WXML 中移除图标区块即可。

### 1.2 弹窗统一规范

所有底部弹出弹窗（popup-container）统一升级：

| 元素 | v3.x 实际值 | v4.0 | 说明 |
|------|------------|------|------|
| 顶部圆角 | `var(--radius-lg)` (32rpx) | `var(--radius-xl)` (40rpx) | 更柔和 |
| 下滑指示条 | 80rpx / 8rpx / 4rpx圆角 | 48rpx / 4rpx / `var(--radius-pill)` | 更精致 |
| 标题行 | 图标容器(64rpx) + 标题(36rpx/600) + 叉号(文字48rpx) | 图标容器(56rpx) + 标题(32rpx/600) + `x-mark.png`(24rpx) | 整体缩小，叉号改图标 |
| 内容区 | `scroll-y` / `max-height: 80vh` | `max-height: 85vh` | 更多内容空间 |
| 底部按钮 | 88rpx（弹窗内） / 96rpx（表单页） | 统一 92rpx / `var(--radius-md)` | 统一高度 |
| 安全区 | `env(safe-area-inset-bottom)` | 不变 | |
| 遮罩 | `var(--mask-color)` | 不变 | |

**适用组件**: feeding-popup, sleep-popup, diaper-popup, temperature-popup, growth-popup, baby-edit-popup, export-popup

**report-popup 例外**: 全屏弹窗，仅修改标题行和周期选择器样式，不改容器结构。

**需同步修改的共享样式文件**: `styles/popup.wxss` -- 所有弹窗组件通过 `@import` 引入此文件，修改此文件即可批量生效。

### 1.2.1 居中弹窗改为底部弹出

以下现有居中弹窗统一改为底部弹出式，复用 `styles/popup.wxss` 的基础结构：

| 页面 | 弹窗 | v3.x 形式 | v4.0 |
|------|------|----------|------|
| discover | 专业参考弹窗 `.info-popup` | 居中(640rpx) | 底部弹出 |
| record | 日期选择弹窗 `.date-picker-popup` | 底部弹出 | 不变（已是底部） |
| record | 操作菜单 `.action-sheet` | 底部弹出 | 不变（已是底部） |
| growth | WHO 标准弹窗 | 居中 | 底部弹出 |
| growth | 记录详情弹窗 | 居中 | 底部弹出 |
| vaccine | 疫苗详情弹窗 | 居中 | 底部弹出 |
| vaccine | 日期选择弹窗 | 居中 | 底部弹出 |
| milestone | 里程碑详情弹窗 | 居中 | 底部弹出 |
| milestone | 标准说明弹窗 | 居中 | 底部弹出 |
| family | 权限编辑弹窗 `.modal-content` | 居中模态 | 底部弹出 |
| family | 转让弹窗 | 居中模态 | 底部弹出 |
| family | 成员操作菜单 `.action-sheet` | 底部 | 不变（统一圆角） |
| auth | 邀请码输入弹窗 | 居中 | 底部弹出 |
| auth | 创建成功弹窗 | 居中 | 不变（保留居中，带庆祝动画） |
| profile | 编辑个人资料弹窗 `.edit-popup` | 居中(580rpx) | 底部弹出 |

### 1.2.2 共享样式文件影响范围

| 共享样式文件 | 影响组件/页面 | 4.0 修改内容 |
|-------------|-------------|-------------|
| `styles/popup.wxss` | 5 个记录弹窗 + baby-edit-popup + growth-popup | 圆角/指示条/标题行/按钮高度 |
| `styles/page-header.wxss` | baby-create, family-create, family-join 等 | 无变更（4.0 在页面级去掉图标引用） |
| `styles/form.wxss` | baby-create, family-create, family-join | 按钮高度统一 92rpx |
| `styles/loading.wxss` | 全局 | 不变 |

### 1.3 表单统一规范

| 元素 | v3.x 实际值 | v4.0 |
|------|------------|------|
| form-label | 图标(32rpx) + 28rpx/500 文字 | 不变 |
| form-input | 88rpx 高 / 32rpx 字 / 2rpx 透明边框 / focus 品牌色 | 不变（已经很好） |
| picker 箭头 | 文字 `>` | 改用 `chevron-right.png` 16rpx |
| 提交按钮 | 96rpx（form.wxss） / 88rpx（popup.wxss） | 统一 92rpx / `var(--radius-md)` |

**适用页面**: baby-create, family-create, family-join, export

**需同步修改**: `styles/form.wxss` 中 `.submit-btn` 高度从 96rpx 改为 92rpx。

### 1.4 空状态统一规范

| 元素 | 规格 |
|------|------|
| 图标 | 80rpx / 对应功能色图标 / `opacity: 0.5` |
| 主文字 | 28rpx / 500 / `--text-secondary` / margin-top: 24rpx |
| 辅文字 | 24rpx / 400 / `--text-hint` / margin-top: 8rpx |
| 操作按钮 | `btn-primary` 样式 / margin-top: 32rpx |

---

## 二、主包页面规格（8 个）

### 2.1 home（首页）

详见主文档 `design-spec.md` 第 2 章。

### 2.2 record（记录列表）

详见主文档 `design-spec.md` 第 3 章。补充：

**FAB 悬浮按钮**:

| 元素 | v3.x | v4.0 |
|------|------|------|
| 尺寸 | 不统一 | 96rpx 圆形 |
| 背景 | `--fab-start` → `--fab-end` 渐变 | 不变 |
| 图标 | `plus.png` / `x-mark.png` | 不变 |
| 位置 | 右下角 | 右下角 / bottom: 32rpx + safe-area / right: 32rpx |
| 展开菜单 | 向上展开 5 个选项 | 不变，保持竖向展开 |
| 菜单项 | 功能色圆形 + 白色图标 + 功能名 | 不变 |

### 2.3 discover（发现页）

详见主文档 `design-spec.md` 第 4 章。

### 2.4 profile（我的）

详见主文档 `design-spec.md` 第 5 章。补充：

**编辑个人资料弹窗**（profile 页面内联弹窗，非组件）:

| 区域 | v3.x | v4.0 |
|------|------|------|
| 弹窗形式 | 居中模态(580rpx) | **改为底部弹出** / 统一弹窗规范(1.2) |
| 头像编辑 | 140rpx | 100rpx（与用户信息区头像一致） |
| 昵称输入 | 88rpx / 30rpx | 统一表单规范(1.3) |
| 操作按钮 | 取消 + 保存 | 统一 92rpx |

### 2.5 auth（登录/引导）

**3 步引导保留现有结构**，仅做视觉微调：

| 区域 | v3.x | v4.0 |
|------|------|------|
| 装饰背景圆 | 3 个渐变圆 | 不变 |
| Logo | 居中 logo-icon | 不变 |
| 品牌标语 | 30rpx/500 | 不变 |
| 功能特点 | 4 格功能图标 | 图标容器改圆形 56rpx / 功能色背景 10% |
| 「开始使用」按钮 | `start-btn` | 高度 96rpx / `--radius-pill` / 品牌色渐变 |
| 步骤指示器 | 圆点 + 线 | 圆点 10rpx / 活动态品牌色 / 线 `--border-color` |
| 关系选择网格 | 4x2 图标网格 | 每格 padding 增到 20rpx / 选中态边框色 `--primary-color` 2rpx |
| 家庭选项卡片 | 图标 + 标题 + 描述 + 箭头 | 圆角改 `--radius-lg` / 卡片间距改 20rpx |
| 邀请码输入弹窗 | 居中弹出 | 改为底部弹出 / 圆角 `--radius-xl` |
| 成功弹窗 | 居中弹出 | 不变，增加 `check-circle.png` 动画入场 |

### 2.6 baby-create（创建宝宝）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 页头 | 默认头像图标 + 标题 | 去掉图标，仅标题+副标题 |
| 性别选择 | radio-group 横排 | 改为两个等宽卡片按钮 / 选中态边框 `--primary-color` + 背景 `--surface-elevated` |
| 日期选择 | picker 文字 + 箭头 `>` | 箭头改 `chevron-right.png` |
| 创建按钮 | `create-btn` | 高度 92rpx / `--radius-md` |

### 2.7 baby-list（宝宝列表）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 卡片 | 头像 + 信息 + 当前标记 | 不变 |
| 操作按钮 | 文字按钮(详情/删除) | 改为图标按钮：`arrow-right.png`(详情) / `trash-red.png`(删除)，各 36rpx |
| 「当前」标记 | 文字 badge | `--radius-pill` / `--primary-color` 背景 12% / 品牌色文字 |
| 底部添加 | `+` 文字 + 添加宝宝 | 改用 `plus.png` 24rpx + 文字 |

### 2.8 guide（使用指南）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 整体 | 循环渲染指南列表 | 不变 |
| 指南圆点 | 纯色圆点 | 改为功能色小圆点 8rpx |
| 「返回首页」按钮 | 文字按钮 | `btn-primary` 样式 / 92rpx |

---

## 三、packageGrowth 分包页面规格（4 个）

### 3.1 growth（生长曲线）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 类型选择器 | 横滚 tab + 图标 | tab 改为吸顶 / 选中态底部指示条 4rpx |
| Canvas 图表 | 保持 | 不变（Canvas 2D） |
| 图例 | 两行排列 | 不变 |
| 数据卡片 | 体重/身高/头围/BMI 四列 | 改为 2x2 网格 / gap: 16rpx |
| 百分位标签 | 文字 tag | `--radius-pill` / 正常绿色、偏低/偏高黄色、异常红色 背景 10% |
| 历史记录列表 | 列表项 + 箭头 `>` | 箭头改 `chevron-right.png` |
| 添加弹窗 | 底部弹出 | 统一弹窗规范(1.2) |
| WHO 标准弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |
| 记录详情弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |
| 浮动添加按钮 | 右下角圆形 | 统一 FAB 规格(2.2) |

### 3.2 vaccine（疫苗追踪）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 待办卡片 | 横滚卡片 | 改为竖向条（同首页 2.6 待办条规格） |
| 统计概览 | 4 列数字 + 分隔线 | 不变 |
| 筛选 tab | 4 个文字 tab | 增加底部指示条，选中态 `--primary-color` |
| 参考来源提示 | `info.png` + 文字 + 箭头 | 不变 |
| 疫苗列表 | 按月龄分组 / 状态图标用文字(checkmark/!/circle) | 状态图标改用 PNG: `check-circle.png`(已接种) / `warning.png`(逾期) / 空心圆(CSS实现) |
| 疫苗详情弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |
| 日期选择弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |

### 3.3 milestone（发育里程碑）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 关注区域 | 逾期+当前阶段卡片组 | 不变 |
| 月龄选择器 | 横滚月份按钮 | 不变 |
| 进度条 | 纯色填充 | 填充色改为品牌色渐变 |
| 里程碑列表 | 状态文字图标(checkmark/!/circle) | 同 vaccine，改用 PNG 图标 |
| 「已逾期」/「当前阶段」标签 | 文字 | `--radius-xs` / 对应色背景 10% |
| 详情弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |
| 标准说明弹窗 | 居中弹出 | 改为底部弹出 / 统一弹窗规范 |

### 3.4 baby-detail（宝宝详情）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 头像 | 居中大头像 + 相机编辑覆盖 | 头像 120rpx / `--primary-color` 3rpx 边框 |
| 信息卡片 | 图标 + 标签 + 值 | 不变 |
| 操作按钮 | 3 个全宽按钮(切换/编辑/分享) | 改为 1 主按钮(`btn-primary`) + 2 次要按钮(`btn-secondary`) |
| baby-edit-popup | 底部弹出 | 统一弹窗规范 |

---

## 四、packageSocial 分包页面规格（6 个）

### 4.1 ai-assistant（AI 育儿助手）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 配额条 | 数字 + 进度条 | 进度条改用品牌色渐变 / 容器 `--radius-md` |
| 评估卡片 | 标题 + 分数 + 进度条 + 分析列表 | 分数字号加大到 48rpx/700 |
| 快捷问题 | 3 个文字按钮 | `--radius-pill` / `--surface-elevated` 背景 / padding: 16rpx 24rpx |
| 对话气泡 | 头像 + 内容 | 不变 |
| AI 思考动画 | spinner + 文字 + 三个点 | 不变 |
| 输入区 | input + 发送按钮 | 输入框 `--radius-pill` / 发送按钮 `--radius-pill` |
| 相关性提示 | info 图标 + 文字 | 不变 |

### 4.2 family（家庭管理）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 家庭卡片 | icon组件 + 名称 + 成员数 + 角色标签 | 不变 |
| 成员列表 | 头像 + 名称 + 角色 + 时间 + 操作三点 | 角色标签改 `--radius-pill` |
| 邀请码 | 文字 + 复制/分享/重新生成 | 邀请码字号加大到 40rpx / 600 / 字符间距 8rpx |
| 权限弹窗 | 居中模态 | 改为底部弹出 / 统一弹窗规范 |
| 转让弹窗 | 居中模态 | 改为底部弹出 / 统一弹窗规范 |
| 成员操作菜单 | 居中 action-sheet | 改为底部 action-sheet / `--radius-xl` 顶部圆角 |

### 4.3 family-create（创建家庭）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 页头 | `family-gray.png` + 标题 | 去掉图标 |
| 表单 | 名称输入 + 创建按钮 | 统一表单规范(1.3) |
| 提示 | `info.png` + 文字 | 不变 |

### 4.4 family-join（加入家庭）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 页头 | `add-family.png` + 标题 | 去掉图标 |
| 邀请码输入 | 普通 input | 改为居中大字输入 / 每位字符间 12rpx / 字号 40rpx |
| 提示 | `info.png` + 文字 | 不变 |

### 4.5 export（数据导出）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 统计卡片 | 数字 + 标签 | 数字加大到 48rpx/700 |
| 类型选择 | checkbox grid(文字) | 改为多选卡片按钮 / 选中态 `--primary-color` 边框 + `check.png` 角标 |
| 日期范围 | 3 个 tab | `--radius-pill` 胶囊 tab |
| 格式选择 | 2 个 tab | `--radius-pill` 胶囊 tab |
| 导出按钮 | 全宽按钮 | `btn-primary` / 92rpx |
| 说明 | 列表文字 | 不变 |

### 4.6 settings（设置）

| 区域 | v3.x | v4.0 |
|------|------|------|
| section-title | 文字 | 不变 |
| switch 开关 | 原生 switch / `color="#D4B896"` | 不变 |
| 主题选择 | 3 个方块(Unicode文字/emoji) | 改为 3 个等宽卡片 / 使用 PNG 图标替代文字字符 |
| 亮色图标 | Unicode `☀` (U+2600, 文字符号) | 新增 `sun.png`（通过 Iconify 下载） |
| 暖夜图标 | emoji `🌙` (U+1F319, 真正的emoji) | 新增 `moon.png`（通过 Iconify 下载） |
| 系统图标 | Unicode `⚙` (U+2699, 文字符号) | 复用 `settings.png` |
| 菜单项箭头 | 文字 `›` (右尖括号) | 改用 `chevron-right.png` 16rpx |
| 危险操作 | 红色文字 | 增加 `--danger-color` 左侧 4rpx 色条 |

---

## 五、组件规格（15 个）

### 5.1 feeding-popup（喂养记录弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 统一规范 | 全部适用 |
| 喂养类型 3 按钮 | 图标(32rpx) + 文字 | 改为等宽三栏 / 选中态 `--feeding-color` 边框 2rpx + 背景 8% |
| 母乳侧选择 | 3 按钮(左/右/双) | `--radius-pill` 胶囊按钮 |
| 快捷用量 | 数值按钮 grid | 不变 |
| 总奶量显示 | 数字 + 清零 | 数字加大到 40rpx/700 / `--feeding-color` |
| **新增: 常用量** | 无 | 快捷用量上方显示「最近: 120ml 150ml 180ml」可点击填入 |
| 快捷时长 | 同上 | 不变 |
| 提交按钮 | `submit-btn` | 统一 92rpx / `--radius-md` / 品牌色渐变 |

### 5.2 sleep-popup（睡眠记录弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 | 全部适用 |
| 模式切换 | 2 tab(记录/开始) | `--radius-pill` 胶囊切换 |
| 睡眠类型 | 图标 + 文字 2 按钮 | 不变 |
| 快捷时长 | 数值按钮 | 不变 |
| 追踪时间显示 | 大字时间 | 字号 56rpx / 700 / `--sleep-color` |
| 追踪按钮 | 开始/结束/取消 | 「开始」`--sleep-color` 渐变 / 「结束」`--primary-color` 渐变 / 「取消」`--text-secondary` 文字按钮 |
| 地点选择 | 横排按钮 | `--radius-pill` 胶囊按钮 |

### 5.3 diaper-popup（排便记录弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 | 全部适用 |
| 排便类型 | 3 图标按钮 | 不变 |
| 质地选择 | 文字按钮 grid | 改为描述卡片式 / 选中态边框 `--diaper-color` |
| 颜色选择 | 色圆 + 文字 | 不变（已经用了色圆，很好） |
| 预警 banner | 功能色背景 | 不变 |

### 5.4 temperature-popup（体温记录弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 | 全部适用 |
| 体温输入 | digit input | 字号加大到 48rpx / 居中 |
| 发热等级 | 文字标签 | `--radius-pill` / 对应发热色 背景 10% + 文字色 |
| 测量方式 | 图标 + 文字按钮 | 不变 |

### 5.5 growth-popup（生长记录弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 | 全部适用 |
| 日期选择 | picker | 不变 |
| 体重/身高/头围输入 | digit input | 不变 |
| 范围提示 | form-hint 文字 | 不变 |
| **新增: 上次对比** | 无 | 输入框右侧显示「上次: 6.8kg (+0.3)」/ 22rpx / `--text-hint` |
| 底部按钮 | 取消 + 保存 | 统一 92rpx |

### 5.6 report-popup（成长报告弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 弹窗容器 | 全屏弹窗 | 不变（内容太多不适合 85vh） |
| 周期选择 | 周报/月报 + 本周/上周 | tab 改 `--radius-pill` 胶囊 |
| 综合评分 | 数字 + 进度条 | 评分数字 48rpx/700 |
| 四维指标卡 | 色条 + 标题 + 值 + 范围条 | 不变，已经很好 |
| 密度条 | 7 格 level 色块 | 不变 |
| 生长/疫苗/里程碑/亮点/AI 建议 | 各卡片 | 不变 |
| Canvas 分享图 | 离屏绘制 | 不变 |
| 底部操作 | 生成/保存/分享/重新生成 | 不变 |

### 5.7 export-popup（导出弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 格式选择 | 3 格(文字图标) | 改用对应 PNG 图标 / 圆角 `--radius-lg` |
| 时间范围 | 3 按钮 | `--radius-pill` 胶囊 |
| 操作按钮 | 取消 + 开始导出 | 统一 92rpx |
| 进度遮罩 | spinner + 文字 | 不变 |

### 5.8 baby-card（宝宝信息卡片）

| 状态 | v3.x | v4.0 |
|------|------|------|
| 首页引用 | 独立卡片组件 | **去掉**，信息合并到问候区 |
| 其他页引用 | 保留 | 保留，但减少使用场景 |
| 样式 | 头像 + 名称 + 年龄 + 性别图标 | 不变 |

### 5.9 baby-edit-popup（编辑宝宝弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 通用弹窗 | 见 1.2 | 全部适用 |
| 头像上传 | 圆形 + 相机覆盖层 | 头像 100rpx / 覆盖层半透明度 0.4 |
| 姓名输入 | 标准 input | 不变 |
| 日期选择 | picker | 不变 |

### 5.10 insight-section（数据洞察区）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 标题栏 | 图标 + 标题 + 周期 + 折叠箭头 | 不变 |
| 趋势卡片 4 张 | 类型图标 + 标签 + 状态 + 均值 + 变化% + 范围条 + 提示 | 不变，结构已经很好 |
| 骨架屏 | shimmer 动画 | 不变 |
| 「查看详细报告」 | 文字链接 | 不变 |
| **新增: 一行式摘要态** | 无 | 首页引用时新增 `compact` 属性，折叠时仅显示一行概要文字 |

### 5.11 timeline（时间线组件）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 空状态 | 图标 + 文字 | 不变 |
| 日期分组头 | 左右线 + 日期文字 | 不变（已有实现） |
| 记录项 | 头像 + 圆点图标 + 类型/时间/摘要/备注 | 不变 |
| 左滑操作 | 编辑(`edit.png`) + 删除(`trash-red.png`) | 不变 |
| 批量选择 | checkbox | 不变 |
| **新增: 时间轴线** | 无 | 左侧 56rpx 处增加 2rpx 竖线 + 功能色节点圆点 10rpx |

### 5.12 error-state（错误状态）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 图标 | `warning.png` / `wifi.png` / `error.png` | 不变 |
| 消息 | 文字 | 不变 |
| 重试按钮 | 按钮 + loading | `btn-secondary` 样式 / 92rpx |

### 5.13 icon（图标组件）

不变。已经是成熟的图标渲染方案。

### 5.14 easter-egg-popup（彩蛋弹窗）

| 区域 | v3.x | v4.0 |
|------|------|------|
| 粒子背景 | CSS 粒子动画 | 不变 |
| 祥云纹理 | CSS 实现 | 不变 |
| 数字翻转 | CSS flip 动画 | 不变 |
| 生长对比 | 体重/身长 from → to | 不变 |
| 回顾卡片 | 横滚 4 卡片 | 不变 |
| 关闭按钮 | 文字 `x` | 改为 `x-mark.png` 24rpx |
| 「我知道了」 | 按钮 | `--radius-pill` / 92rpx |

### 5.15 easter-egg-toast（彩蛋提示）

不变。仅 5 行 WXML，结构极简。

---

## 六、需通过 Iconify 补充的图标（完整清单）

| 用途 | Iconify 建议名称 | 规格 | 色值 | 存放路径 |
|------|------------------|------|------|---------|
| 亮色主题(太阳) | `mdi:white-balance-sunny` | 36x36 PNG | `#D4883D` | `/images/icons/sun.png` |
| 暗夜主题(月亮) | `mdi:weather-night` | 36x36 PNG | `#B8A8D4` | `/images/icons/moon.png` |
| 录制指示灯 | `mdi:record-circle` | 16x16 PNG | `#E85454` | `/images/icons/rec-dot.png` |

> 共 3 个。其余全部复用已有图标。

---

## 七、暗色模式逐项检查矩阵

| 页面/组件 | dark-mode 根类 | 新增变量覆盖 | 需检查项 |
|-----------|---------------|-------------|---------|
| home | 已有 | 状态胶囊 3 态背景色 | 进度条底色、录制指示灯可见度 |
| record | 已有 | 无 | 吸顶栏背景色 |
| discover | 已有 | 无 | 聚焦卡片色条可见度、专业参考弹窗(改为底部后)背景色 |
| profile | 已有 | 无 | 头像边框在暗底下的对比度、编辑弹窗(改为底部后)背景色 |
| auth | 已有 | 无 | 装饰背景圆在暗底下不突兀 |
| baby-create | 已有 | 无 | 性别卡片选中态背景 |
| baby-list | 已有 | 无 | 「当前」标记背景 |
| guide | 已有 | 无 | 指南圆点可见度 |
| growth | 已有 | 无 | Canvas 图表已有暗色逻辑（ThemeManager.getColor） |
| vaccine | 已有 | 无 | 状态图标(checkmark)可见度 |
| milestone | 已有 | 无 | 同 vaccine |
| baby-detail | 已有 | 无 | 头像边框色 |
| ai-assistant | 已有 | 无 | 对话气泡背景 |
| family | 已有 | 无 | 角色标签背景 |
| family-create | 已有 | 无 | 标准检查 |
| family-join | 已有 | 无 | 标准检查 |
| export | 已有 | 无 | 选中卡片边框 |
| settings | 已有 | 无 | 主题选择卡片(当前主题高亮) |
| 5 个记录弹窗 | 已有(darkMode prop) | 无 | 统一弹窗规范已覆盖 |
| report-popup | 已有 | 无 | 四维卡片色条 |
| export-popup | 已有 | 无 | 格式选择卡片 |
| baby-edit-popup | 已有 | 无 | 头像覆盖层 |
| insight-section | 已有 | 无 | 范围条色块 |
| timeline | 父级传递 | 无 | 时间轴线用 `--border-color`(自动适配) |
| error-state | 全局注册 | 无 | 按钮样式 |
| icon | 无需 | 无 | 图标 `filter: brightness()` 已有 |
| easter-egg-popup | 已有 | 无 | 粒子/祥云在暗底下的效果 |
| easter-egg-toast | 已有 | 无 | Toast 背景 |
| baby-card | 父级传递 | 无 | 标准检查 |
| focus-card(新) | 需实现 | 色条背景 | 需在组件中声明 darkMode prop |

---

> **文档说明**: 本文档覆盖全部 18 个页面 + 15 个组件的逐一规格细化。每个条目都标注了 v3.x 现状和 v4.0 变更，确保实施时无遗漏。配合主文档 `design-spec.md` 中的核心重设计章节使用。
