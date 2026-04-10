# 需求文档 - 宝宝成长彩蛋（Easter Eggs）

> 版本：v1.0 | 日期：2026-04-07 | 状态：待确认

---

## 概述

在首页增加宝宝成长过程中的惊喜彩蛋功能，通过时间节点、行为里程碑、节日和数据洞察等维度，在适当时机弹出庆祝/鼓励弹窗，增强产品的情感温度和用户粘性。彩蛋系统遵循"不打扰、有惊喜、可回顾"的设计原则，融入项目现有的**美拉德色系**视觉规范。

### 设计原则

1. **不打扰**：每个彩蛋每个宝宝只弹出一次（通过 `StorageUtil` 标记），关闭后不再重复
2. **有惊喜**：动画精美、文案温暖，增强父母的成就感和仪式感
3. **可回顾**：彩蛋触发后保存记录，未来可在"成长回忆"中回顾（P3 远期）
4. **不阻塞**：彩蛋检测在 `loadData()` 完成后异步执行，不影响首页主渲染流程
5. **美拉德色系**：所有彩蛋视觉严格使用项目已有 CSS 变量（`--primary-color`、`--primary-light`、`--primary-dark` 等），不引入新色调

---

## 用户角色

- **主要照护者**：父母/监护人，彩蛋的核心受众，通过彩蛋获得育儿成就感
- **协同照护者**：祖父母/其他家庭成员，可能看到彩蛋但不是主要触发者
- **多宝家庭用户**：每个宝宝独立维护彩蛋状态，互不影响

---

## 功能需求

### 🏆 P0 级彩蛋（核心体验，必须实现）

---

### EE-1：30天满月彩蛋

**用户故事：** 作为新手父母，我想要在宝宝满月时收到一个温馨的庆祝弹窗，以便感受到"第一个月坚持下来了"的成就感。

**触发条件：**
- `birthDayCount === 30`（使用首页已有的 `birthDayCount` 字段）
- 本地标记 `egg_30day_{babyId}` 不存在（未展示过）

**验收标准：**
1. When `birthDayCount === 30` 且彩蛋未展示过，the system shall 在 `loadData()` 完成后 500ms 延迟弹出满月庆祝弹窗
2. When 弹窗展示时，the system shall 显示以下内容：
   - **顶部**：月亮图标（使用项目图标体系，SVG/PNG，不使用 emoji）
   - **主标题**：「满月快乐！🌙」，字号 `title-large`（48rpx/600），带 scale + fadeIn 组合动画
   - **副标题**：「{宝宝昵称}已经满月啦！恭喜新手爸妈度过了最辛苦的第一个月」，字号 `body-large`（30rpx），颜色 `--text-secondary`
   - **数据回顾区**：横向滚动展示 3 张迷你数据卡片：
     - 「累计喂养 XX 次」（从 `RecordService` 查询 30 天内 feeding 记录总数）
     - 「总睡眠 XX 小时」（从 `RecordService` 查询 30 天内 sleep 记录总时长）
     - 「换了 XX 片尿布」（从 `RecordService` 查询 30 天内 diaper 记录总数）
   - **底部按钮**：「我知道了」主按钮（`btn-primary` 样式）
3. When 弹窗背景，the system shall 使用美拉德暖色渐变：`linear-gradient(135deg, #FFFFFF 0%, #F5F1EB 50%, #E8DCC8 100%)`
4. When 用户点击「我知道了」或点击遮罩层，the system shall 关闭弹窗并写入 `StorageUtil.set('egg_30day_{babyId}', { shown: true, shownAt: Date.now() })`
5. When 用户错过满月当天（如第 31 天才打开），the system shall 仍然触发彩蛋（条件放宽为 `birthDayCount >= 30 && birthDayCount <= 33`），确保不错过
6. While 弹窗遮罩显示，the system shall 使用 `--mask-color`（`rgba(139, 123, 107, 0.4)`），与项目统一

---

### EE-2：100天百日彩蛋

**用户故事：** 作为父母，我想要在宝宝百日时收到庆祝弹窗，以便纪念这个中国传统的重要节点。

**触发条件：**
- `birthDayCount === 100`（放宽为 `>= 100 && <= 103`）
- 本地标记 `egg_100day_{babyId}` 不存在

**验收标准：**
1. When `birthDayCount` 在 100-103 范围且彩蛋未展示过，the system shall 弹出百日庆祝弹窗
2. When 弹窗展示时，the system shall 显示以下内容：
   - **顶部**：数字「100」以逐位翻转动画呈现（CSS transform rotateX），使用 `--primary-color` 金色
   - **主标题**：「百日快乐！」，字号 `title-large`，带 fadeInUp 动画
   - **副标题**：「{宝宝昵称}来到这个世界已经100天了，小家伙越来越棒了！」
   - **成长变化卡片**（如有生长记录）：
     - 出生体重 → 最新体重（如 `3.2kg → 5.8kg`）
     - 出生身长 → 最新身长（如 `50cm → 60cm`）
     - 如无生长记录，显示 100 天内的记录总数
   - **底部按钮**：「我知道了」
3. When 弹窗展示时，the system shall 卡片背景使用暖色渐变 + 微妙的祥云纹理图案（CSS background-image，使用 `--primary-light` 色调的 SVG 祥云）
4. When 关闭弹窗，the system shall 写入 `StorageUtil.set('egg_100day_{babyId}', { shown: true, shownAt: Date.now() })`

---

### 🥈 P1 级彩蛋（重要体验，优先实现）

---

### EE-3：365天周岁生日彩蛋

**用户故事：** 作为父母，我想要在宝宝周岁时收到隆重的庆祝弹窗，以便感受到一年养育的成就感。

**触发条件：**
- `birthDayCount` 在 365-368 范围
- 本地标记 `egg_365day_{babyId}` 不存在

**验收标准：**
1. When 触发条件满足，the system shall 弹出全屏级别的周岁庆典弹窗（区别于 P0 级的半屏弹窗）
2. When 弹窗展示时，the system shall 显示以下内容：
   - **全屏背景**：暖色粒子动画（CSS animation + 多层伪元素实现星星/纸屑飘落）
   - **主视觉**：蛋糕图标 + 数字「1」大字（80rpx），带弹跳动画
   - **主标题**：「周岁快乐！🎂」
   - **副标题**：「{宝宝昵称}一周岁了！感谢每一天的陪伴与付出」
   - **年度数据回顾面板**：
     - 总喂养次数
     - 总睡眠时长（小时）
     - 总换尿布次数
     - 总记录条数
   - **底部按钮**：「我知道了」
3. When 关闭弹窗，the system shall 写入标记 `egg_365day_{babyId}`

---

### EE-4：第一次记录彩蛋

**用户故事：** 作为新用户，我想要在第一次成功创建记录时收到鼓励，以便感受到"育儿旅程正式开始"的仪式感。

**触发条件：**
- 在任意弹窗（feeding/sleep/diaper/temperature/growth）的 `onRecordCreated` 回调中检查
- 本地标记 `egg_first_record_{babyId}` 不存在
- 当前宝宝的记录总数为 1（刚创建第一条）

**验收标准：**
1. When 用户成功创建第一条记录，the system shall 在弹窗关闭后 300ms 显示轻量 Toast 动画（非全屏弹窗）
2. When Toast 展示时，the system shall 显示：
   - 图标：火箭/星星图标
   - 文案：「第一次记录完成！育儿之旅正式开始 🚀」
   - 动画：从底部滑入 + 2 秒后自动消失（fadeOut）
3. When Toast 显示后，the system shall 写入标记 `egg_first_record_{babyId}`
4. If 用户通过离线模式创建的记录，then the system shall 同样触发（本地缓存的记录也算）

---

### 🥉 P2 级彩蛋（锦上添花，按迭代实现）

---

### EE-5：月龄提示条

**用户故事：** 作为父母，我想要在每个月龄整日看到轻量提示，以便持续感受到宝宝在成长。

**触发条件：**
- `birthDayCount` 是 30 的倍数（即 60、90、120、150...天）
- 排除已有独立彩蛋的天数（30、100、365）
- 当日标记 `egg_month_{N}_{babyId}` 不存在（N 为月龄数）

**验收标准：**
1. When 触发条件满足，the system shall 在问候语区域下方显示一条轻量提示条（非弹窗），高度 72rpx
2. When 提示条展示时，the system shall 显示：
   - 背景：`rgba(212, 184, 150, 0.1)` 半透明暖色
   - 左侧：蛋糕/气球小图标（24rpx）
   - 文案：「{宝宝昵称}今天 {N} 个月啦 🎈」，字号 `body-medium`（28rpx）
   - 右侧：关闭按钮（×）
3. When 用户点击关闭或页面切走再回来，the system shall 写入当日标记并隐藏
4. While 提示条显示，the system shall 使用 slideDown 进入动画（300ms）

---

### EE-6：连续记录成就

**用户故事：** 作为父母，我想要在连续多天坚持记录时收到鼓励，以便保持记录习惯。

**触发条件：**
- 连续 7 天每天至少有 1 条记录（任何类型）
- 连续 30 天每天至少有 1 条记录
- 分别对应标记 `egg_streak_7_{babyId}` 和 `egg_streak_30_{babyId}`

**验收标准：**
1. When 用户达成连续 7 天记录，the system shall 显示轻量 Toast 动画：
   - 文案：「连续打卡 7 天！你是最棒的爸/妈 💪」
   - 样式：与 EE-4 一致的 Toast 样式
2. When 用户达成连续 30 天记录，the system shall 显示半屏弹窗（升级版）：
   - 主标题：「坚持30天！」
   - 副标题：「连续记录30天，你的坚持是给{宝宝昵称}最好的礼物」
   - 数据：「这30天你记录了 XX 条数据」
3. When 检测连续记录时，the system shall 基于本地缓存的记录进行检查（避免频繁云端查询），在 `loadData()` 完成后异步计算
4. If 某天没有记录但次日恢复记录，then the system shall 连续天数重置为 1

**连续天数计算逻辑：**
```
从今天开始，往前逐天检查是否有记录：
  - 有记录 → streakDays++，继续检查前一天
  - 无记录 → 停止
返回 streakDays
```

---

### 🎨 P3 级彩蛋（远期优化，按季节迭代）

---

### EE-7：节日彩蛋

**用户故事：** 作为用户，我想要在特殊节日打开首页时看到应景的装饰和祝福，以便感受到产品的用心。

**触发条件：**
- 检测当前日期是否匹配预置的节日列表
- 每个节日当年只展示一次：`egg_holiday_{holidayId}_{year}_{babyId}`

**节日清单（v1.0）：**

| 节日 | 日期计算 | 展示形式 | 文案 |
|------|---------|---------|------|
| 儿童节 | 6月1日 | 提示条 + 彩色气球图标 | 「{宝宝昵称}的第 {N} 个儿童节 🎈」 |
| 母亲节 | 5月第二个周日 | 提示条 + 康乃馨图标 | 「妈妈辛苦了，{宝宝昵称}最爱你 ❤️」 |
| 父亲节 | 6月第三个周日 | 提示条 + 领带图标 | 「爸爸辛苦了，{宝宝昵称}最爱你 💪」 |
| 春节 | 农历正月初一（需日期库或硬编码） | 提示条 + 红色主题 | 「新年好！祝{宝宝昵称}健康成长 🧧」 |
| 中秋节 | 农历八月十五（需日期库或硬编码） | 提示条 + 月饼图标 | 「中秋快乐！一家人团团圆圆 🥮」 |

**验收标准：**
1. When 当前日期匹配节日且当年未展示过，the system shall 在问候语区域下方显示节日提示条
2. When 提示条展示时，the system shall 使用节日对应的图标和文案
3. When 春节/中秋等农历节日，the system shall 通过硬编码近 3 年日期实现（避免引入农历计算库增加包体积），格式：`const LUNAR_HOLIDAYS = { '2026-02-17': 'spring_festival', '2027-02-06': 'spring_festival', ... }`
4. When 节日提示条与 EE-5 月龄提示条冲突时，the system shall 优先展示节日提示条（节日优先级更高）

---

### EE-8：数据洞察彩蛋

**用户故事：** 作为父母，我想要在宝宝的数据出现有趣突破时收到有趣的提示，以便增加记录的趣味性。

**触发条件：**
- 在 `loadData()` 完成后，对今日数据进行洞察分析
- 每种洞察类型每天只触发一次

**洞察类型（v1.0）：**

| 洞察类型 | 触发条件 | Toast 文案 |
|---------|---------|-----------|
| 喂养冠军 | 今日喂养次数 > 历史 7 天日均的 1.5 倍 | 「今天喂了 {X} 次，创下新纪录！大胃王宝宝 🍼」 |
| 睡神降临 | 今日单次最长睡眠 > 4 小时 | 「这觉睡了 {X} 小时，睡神附体 💤」 |
| 完美一天 | 今日喂养 ≥ 3 次 + 睡眠 ≥ 2 次 + 排便 ≥ 1 次 | 「今天是完美的一天！所有类型都有记录 ⭐」 |

**验收标准：**
1. When 洞察条件满足且当日该类型未触发过，the system shall 显示 Toast 动画（与 EE-4 样式一致）
2. When 多个洞察同时满足，the system shall 只显示优先级最高的一个（完美一天 > 喂养冠军 > 睡神降临）
3. When 检测洞察条件时，the system shall 仅使用 `todayStats` 已有数据，不额外发起查询（历史 7 天均值使用简单的本地缓存估算）
4. When 洞察 Toast 显示后，the system shall 写入标记 `egg_insight_{type}_{YYYY-MM-DD}_{babyId}`

---

## 通用技术设计

### 彩蛋组件架构

```
components/
  easter-egg/
    easter-egg.js        # 彩蛋弹窗组件（支持多种 type）
    easter-egg.wxml      # 弹窗模板（条件渲染不同内容）
    easter-egg.wxss      # 彩蛋专属样式 + 动画
    easter-egg.json      # { "component": true }
  easter-egg-toast/
    easter-egg-toast.js   # 轻量 Toast 组件（EE-4/6/8）
    easter-egg-toast.wxml
    easter-egg-toast.wxss
    easter-egg-toast.json
```

### 彩蛋检测流程

```
home.js loadData() 完成
    │
    ├─ setData({ todayStats, recentRecords, ... })  ← 主渲染
    │
    └─ [异步延迟 500ms] checkEasterEggs()
          │
          ├─ 检查时间节点彩蛋（EE-1/2/3/5）
          │   └─ 读取 birthDayCount → 匹配规则 → 检查 StorageUtil 标记
          │
          ├─ 检查行为彩蛋（EE-4/6）
          │   └─ 查询记录数/连续天数 → 匹配规则 → 检查标记
          │
          ├─ 检查节日彩蛋（EE-7）
          │   └─ 匹配日期 → 检查标记
          │
          └─ 检查数据洞察彩蛋（EE-8）
              └─ 分析 todayStats → 匹配条件 → 检查标记
          │
          └─ 按优先级决定展示（弹窗类互斥，Toast 类队列）
```

### Storage Key 命名规范

| Key 格式 | 用途 | 值格式 |
|---------|------|--------|
| `egg_30day_{babyId}` | 满月彩蛋标记 | `{ shown: true, shownAt: timestamp }` |
| `egg_100day_{babyId}` | 百日彩蛋标记 | 同上 |
| `egg_365day_{babyId}` | 周岁彩蛋标记 | 同上 |
| `egg_first_record_{babyId}` | 第一次记录标记 | 同上 |
| `egg_month_{N}_{babyId}` | N月龄提示标记 | 同上 |
| `egg_streak_{N}_{babyId}` | 连续N天成就标记 | 同上 |
| `egg_holiday_{holidayId}_{year}_{babyId}` | 节日彩蛋标记 | 同上 |
| `egg_insight_{type}_{YYYY-MM-DD}_{babyId}` | 数据洞察标记 | 同上 |

### 弹窗优先级规则

当同时触发多个彩蛋时，按以下优先级只展示一个弹窗类彩蛋：

1. **P0 弹窗**：EE-1（满月）> EE-2（百日）
2. **P1 弹窗**：EE-3（周岁）> EE-6-30（连续30天）
3. **Toast 类**：可排队展示，间隔 1 秒

弹窗类彩蛋互斥（同一次 `loadData` 只弹一个），Toast 类不与弹窗冲突。

### 数据查询策略

| 彩蛋 | 数据来源 | 查询开销 |
|------|---------|---------|
| EE-1/2/3 时间节点 | `birthDayCount`（已有字段，零开销） | 无额外查询 |
| EE-1/2 数据回顾 | `RecordService.getRecords(babyId, { dateRange })` | 仅弹窗展示时查询一次 |
| EE-3 年度回顾 | `RecordService.getRecords(babyId, { dateRange })` | 仅弹窗展示时查询一次 |
| EE-4 第一次记录 | `recentRecords.length`（已有数据） | 无额外查询 |
| EE-5 月龄 | `birthDayCount`（已有字段） | 无额外查询 |
| EE-6 连续记录 | 本地缓存 + 简单遍历 | 轻量计算 |
| EE-7 节日 | 日期字面量匹配 | 无查询 |
| EE-8 数据洞察 | `todayStats`（已有数据） | 无额外查询 |

### 弹窗视觉规范（基于美拉德色系）

| 元素 | 样式值 | 来源 |
|------|-------|------|
| 弹窗遮罩 | `var(--mask-color)` = `rgba(139, 123, 107, 0.4)` | app.wxss |
| 弹窗容器背景 | `linear-gradient(135deg, #FFFFFF 0%, var(--bg-primary) 100%)` | 美拉德渐变 |
| 弹窗圆角 | `var(--radius-lg)` = `32rpx` | app.wxss |
| 弹窗阴影 | `var(--shadow-popup)` = `0 8rpx 48rpx rgba(139, 123, 107, 0.12)` | app.wxss |
| 主标题色 | `var(--text-primary)` = `#3D3D3D` | app.wxss |
| 副标题色 | `var(--text-secondary)` = `#666666` | app.wxss |
| 数据卡片背景 | `var(--bg-primary)` = `#F5F1EB` | app.wxss |
| 主按钮 | `linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)` | app.wxss |
| 强调色数字 | `var(--primary-color)` = `#D4B896` | app.wxss |
| 关闭动画 | `var(--transition-normal)` = `0.3s ease` | app.wxss |

---

## 非功能需求

### NFR-1：性能要求
- 彩蛋检测逻辑执行时间 ≤ 50ms（纯本地计算 + StorageUtil 读取）
- 弹窗动画使用纯 CSS animation，不使用 JS 定时器
- EE-1/2/3 的数据回顾查询仅在弹窗实际展示时才触发（lazy load），不在检测阶段查询
- 粒子动画（EE-3 周岁）使用 CSS 伪元素实现，限制粒子数 ≤ 20 个，避免低端机卡顿

### NFR-2：包体积
- 新增组件总代码量 ≤ 15KB（WXML + WXSS + JS 压缩后）
- 彩蛋图标复用项目已有的图标体系，不新增大尺寸图片资源
- 节日彩蛋的农历日期使用硬编码（近3年），不引入第三方农历计算库

### NFR-3：数据一致性
- 每个彩蛋标记按 `babyId` 隔离，多宝宝互不影响
- 切换宝宝后，彩蛋检测使用新宝宝的 `babyId` 重新计算
- 彩蛋标记使用 `StorageUtil.set/get`，与项目其他缓存策略一致

### NFR-4：兼容性
- 兼容微信小程序基础库 ≥ 2.20.0
- CSS 动画在低端 Android 机型降级为简单 fadeIn（无粒子、无翻转）
- 弹窗底部适配安全区域：`padding-bottom: calc(32rpx + env(safe-area-inset-bottom))`

### NFR-5：可扩展性
- 彩蛋配置采用数组驱动，新增彩蛋只需在配置数组中追加条目
- 检测逻辑与展示逻辑分离：`checkEasterEggs()` 返回触发结果，由调用方决定展示方式
- 预留 `type` 字段支持未来更多彩蛋类型（如半岁 182 天、200 天等）

---

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 用户错过满月当天（第31天才打开） | 条件放宽为 30-33 天范围内触发 |
| 同一天满足多个弹窗彩蛋（理论上不会） | 按优先级只弹一个，其他延后到下次 loadData |
| 宝宝出生日期未设置 | `birthDayCount === 0` 时跳过所有时间节点彩蛋 |
| StorageUtil 存储空间不足 | 彩蛋标记写入失败时静默降级，下次仍可能触发（可接受重复） |
| 首页 loadData 失败（error 状态） | 不执行彩蛋检测（依赖 loadData 成功完成） |
| 家庭协作 viewer 角色 | 彩蛋正常展示（彩蛋是阅读性质，不涉及写入操作） |
| 连续记录天数计算中，某天只有离线记录 | 离线记录也计入连续天数（本地缓存有记录即可） |
| 节日日期硬编码过期（超过3年） | 静默不触发，不影响功能，定期更新即可 |
| 弹窗展示中用户切换 Tab 又切回 | 弹窗状态通过 data 控制，切换 Tab 后 onShow 不重新弹出（标记已写入） |

---

## 变更影响范围

| 文件 | 改动类型 | 涉及 EE |
|------|----------|---------|
| `components/easter-egg/` | **新建** | EE-1/2/3/6(30天) |
| `components/easter-egg-toast/` | **新建** | EE-4/6(7天)/8 |
| `pages/home/home.js` | **增量**（新增 `checkEasterEggs()` 方法） | 全部 |
| `pages/home/home.wxml` | **增量**（引用 easter-egg 和 toast 组件 + 提示条） | 全部 |
| `pages/home/home.wxss` | **增量**（提示条样式） | EE-5/7 |
| `pages/home/home.json` | **增量**（注册新组件） | 全部 |
| `services/record.js` | **无改动**（复用已有 `getRecords` 的 `dateRange` 参数） | EE-1/2/3 |
| `utils/storage.js` | **无改动**（复用已有 `set/get` 方法） | 全部 |

---

## 实施优先级总结

| 优先级 | 彩蛋 | 工时估算 | 理由 |
|-------|------|---------|------|
| **P0** | EE-1 满月（30天） | 4h | 第一个大节点，情感价值最高 |
| **P0** | EE-2 百日（100天） | 3h | 中国传统文化重要节点，复用 EE-1 组件 |
| **P1** | EE-3 周岁（365天） | 4h | 超级大庆典，视觉更丰富 |
| **P1** | EE-4 第一次记录 | 2h | 新用户激励，提升留存 |
| **P2** | EE-5 月龄提示条 | 2h | 低成本、每月触发，持续陪伴感 |
| **P2** | EE-6 连续记录成就 | 3h | 鼓励打卡习惯 |
| **P3** | EE-7 节日彩蛋 | 3h | 锦上添花，按季节迭代 |
| **P3** | EE-8 数据洞察彩蛋 | 2h | 有趣但非必需 |

**总工时预估：约 23 小时**

---

*文档版本：v1.0*
*创建日期：2026-04-07*
*状态：待确认*
