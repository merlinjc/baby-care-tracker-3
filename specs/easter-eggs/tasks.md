# 实施计划 - 宝宝成长彩蛋（Easter Eggs）

> 版本：v1.0 | 日期：2026-04-07 | 状态：✅ 已完成（2026-04-07）
> 前置文档：`specs/easter-eggs/requirements.md` v1.0（已批准）、`specs/easter-eggs/design.md` v1.1（已批准）

---

## 实施概览

**预计总工时**：~20 小时（8 个任务）  
**实施策略**：自底向上，先核心引擎 → 再展示组件 → 最后首页集成  
**增量交付**：每完成一个任务即可验证，不依赖后续任务

### 关键里程碑

| 里程碑 | 完成任务 | 可验证结果 |
|--------|---------|-----------|
| M1：引擎可用 | Task 1 | `detectAll()` 纯函数可独立调用并返回正确结果 |
| M2：弹窗可用 | Task 1 + 2 | `easter-egg-popup` 组件可通过手动传入数据展示 |
| M3：Toast 可用 | Task 1 + 3 | `easter-egg-toast` 组件可展示并自动关闭 |
| M4：P0 上线 | Task 1 + 2 + 3 + 4 | 满月/百日彩蛋端到端可触发 |
| M5：P1 上线 | + Task 5 | 周岁 + 首次记录可触发 |
| M6：P2 上线 | + Task 6 | 月龄提示条 + 连续记录成就可触发 |
| M7：全量上线 | + Task 7 | 节日 + 数据洞察可触发 |
| M8：验收完成 | + Task 8 | 全场景手动验证通过，NFR 指标达标 |

### 任务依赖关系

```
Task 1（检测引擎）
  ├── Task 2（弹窗组件）  ← 依赖 Task 1
  ├── Task 3（Toast 组件） ← 依赖 Task 1
  │
  └── Task 4（首页集成 - P0）← 依赖 Task 1 + 2 + 3
        │
        ├── Task 5（P1：周岁 + 首次记录）← 依赖 Task 4
        ├── Task 6（P2：月龄 + 连续记录）← 依赖 Task 4
        └── Task 7（P3：节日 + 数据洞察）← 依赖 Task 4
              │
              └── Task 8（全场景验证 + NFR）← 依赖全部
```

---

## 任务列表

### Task 1：彩蛋检测引擎 (`utils/easter-egg.js`)

**工时**：3h  
**前置依赖**：无  
**产出文件**：`miniprogram/utils/easter-egg.js`

- [ ] 1.1 创建 `utils/easter-egg.js` 文件，引入 `StorageUtil`
  - 定义 `MILESTONE_RULES` 配置数组（EE-1 满月、EE-2 百日、EE-3 周岁）
  - 定义 `HOLIDAY_MAP`（儿童节 + 动态注释）
  - 定义 `LUNAR_HOLIDAYS`（2026-2028 三年春节/中秋硬编码）
  - _需求：EE-1 ~ EE-3、EE-7_

- [ ] 1.2 实现 `detectAll(ctx)` 主入口函数
  - 参数校验（`babyId` / `birthDayCount` 前置防护）
  - 遍历 `MILESTONE_RULES` 匹配 `birthDayCount` 范围
  - 调用 `detectHoliday()`、`detectInsight()`、`detectStreak()`
  - 月龄提示条检测（EE-5：`birthDayCount % 30 === 0`，排除 30/100/365）
  - 优先级裁决：弹窗取最高优先级一个、Toast 全量排序、Banner 取最高一个
  - 返回 `{ popup, toasts, banner }` 结构
  - _需求：全部 EE，设计文档 §1.3_

- [ ] 1.3 实现 `detectStreak(ctx)` 连续记录检测
  - 从 `StorageUtil.get('records_{babyId}')` 获取本地缓存记录
  - 构建日期集合（`YYYY-MM-DD` 格式）
  - 从今天开始往前逐天检查（最多 60 天），计算 `streakDays`
  - 7天成就返回 Toast 类型，30天成就返回 Popup 类型
  - _需求：EE-6，设计文档 §1.4_

- [ ] 1.4 实现 `detectHoliday(ctx)` 节日检测
  - 固定日期节日匹配（`HOLIDAY_MAP`）
  - 母亲节动态计算（5月第二个周日）
  - 父亲节动态计算（6月第三个周日）
  - 农历节日硬编码匹配（`LUNAR_HOLIDAYS`）
  - 辅助函数 `getNthWeekday(year, month, weekday, nth)`
  - 各节日使用对应专属图标（flower/necktie/lantern/mooncake/balloon）
  - 儿童节文案含「第 N 个」计数
  - _需求：EE-7，设计文档 §1.5_

- [ ] 1.5 实现 `detectInsight(ctx)` 数据洞察检测
  - 完美一天检测（feeding ≥ 3 + sleep ≥ 2 + diaper ≥ 1）
  - 喂养冠军检测（feeding > 7）
  - 睡神降临检测（平均单次睡眠 > 4h）
  - **互斥规则**：命中第一个即返回，不再检查后续
  - _需求：EE-8，设计文档 §1.6_

- [ ] 1.6 实现 `markShown(storageKey)` 标记函数 + `module.exports` 导出
  - 导出：`detectAll`、`markShown`、`MILESTONE_RULES`、`HOLIDAY_MAP`、`LUNAR_HOLIDAYS`
  - _设计文档 §1.7_

**验证方式**：在微信开发者工具 Console 中手动调用：
```javascript
const EasterEgg = require('../../utils/easter-egg');
const result = EasterEgg.detectAll({ babyId: 'test', babyName: '小宝', birthDayCount: 30, todayStats: { feeding: { count: 5 }, sleep: { count: 2, totalDuration: 36000 }, diaper: { count: 3 } }, totalTodayCount: 10 });
console.log(result);
```

---

### Task 2：弹窗组件 (`easter-egg-popup`)

**工时**：3.5h  
**前置依赖**：Task 1（需要 `EasterEgg.markShown`）  
**产出文件**：`miniprogram/components/easter-egg-popup/` 四件套

- [ ] 2.1 创建组件骨架文件
  - `easter-egg-popup.json`：`{ "component": true }`
  - `easter-egg-popup.js`：定义 Properties（`show`、`type`、`eggData`、`storageKey`、`babyId`）、Data（`animState`、`retrospect`、`retrospectLoading`）
  - Observer 监听 `show` 属性变化，触发 `onOpen()`
  - _设计文档 §2.1_

- [ ] 2.2 实现弹窗生命周期方法
  - `onOpen()`：设置 `animState` 为 `entering` → 200ms 后切 `visible`；触发 `loadRetrospect()`
  - `close()`：设置 `animState` 为 `leaving` → 调用 `markShown()` → 300ms 后切 `idle` + 触发 `close` 事件
  - `onMaskTap()` / `stopPropagation()`
  - _设计文档 §2.1_

- [ ] 2.3 实现 `loadRetrospect()` 数据回顾懒加载
  - 根据 `dataQueryType` 决定查询天数（30/100/365）
  - 调用 `RecordService.getRecords()` 按时间范围查询
  - 聚合统计：feedingCount / sleepHours / diaperCount / totalCount
  - **EE-2 百日特殊逻辑**：若 `showGrowthComparison` 为 true，额外查询 growth 记录对比
  - 设置 `retrospect` 数据
  - _需求：EE-1 AC2、EE-2 AC2、EE-3 AC2，设计文档 §2.1 loadRetrospect_

- [ ] 2.4 编写 WXML 模板
  - 遮罩层（`egg-mask`，`hidden` + CSS transition 控制显隐）
  - 弹窗容器（`egg-popup`，带 `animState` 和 `type` 双 class）
  - 条件渲染图标区：30day 月亮 / 100day 数字翻转 + 祥云背景 / 365day 蛋糕+粒子 / streak_30 火焰
  - 标题区：主标题 + 副标题
  - **EE-2 生长数据对比区**：体重/身长 from → to
  - 通用数据回顾卡片区（横向 scroll-view，3~4 张卡片）
  - **EE-3 周岁第4张卡片**：总记录数
  - streak_30 连续天数展示
  - 底部「我知道了」按钮
  - _设计文档 §2.2_

- [ ] 2.5 编写 WXSS 样式
  - 遮罩层样式（fixed，z-index 2000，美拉德 mask 颜色）
  - 弹窗容器（居中，渐变背景，入场/退场 transition）
  - 365day 粒子动画（`@keyframes particleFall`，16 个粒子）
  - 100day 祥云纹理（`.egg-cloud-bg`，`radial-gradient` 实现）
  - 100day 数字翻转（`@keyframes digitFlipIn`，`rotateX` 变换）
  - 365day 蛋糕弹跳（`@keyframes eggBounceIn`）
  - 图标缩放弹跳（`@keyframes eggScaleBounce`）
  - 标题渐入（`@keyframes eggFadeInUp`，分层延迟）
  - 数据回顾卡片样式
  - 生长数据对比行样式
  - 加载中三点脉冲动画
  - 底部按钮样式（美拉德渐变）
  - _设计文档 §2.3_

**验证方式**：在测试页面中直接引用组件，手动传入不同 `type` 和 `eggData` 验证四种弹窗视觉效果。

---

### Task 3：Toast 组件 (`easter-egg-toast`)

**工时**：1.5h  
**前置依赖**：Task 1（需要 `EasterEgg.markShown`）  
**产出文件**：`miniprogram/components/easter-egg-toast/` 四件套

- [ ] 3.1 创建组件骨架文件
  - `easter-egg-toast.json`：`{ "component": true }`
  - `easter-egg-toast.js`：Properties（`show`、`text`、`icon`、`storageKey`、`duration`=2500ms）
  - Observer 监听 `show` 变化，触发 `showToast()`
  - _设计文档 §3.1_

- [ ] 3.2 实现 Toast 生命周期方法
  - `showToast()`：设置 `animState` entering → 300ms 后 visible → duration 后自动 `dismiss()`
  - `dismiss()`：清除自动关闭 timer → leaving → 调用 `markShown()` → 300ms 后 idle + 触发 `close` 事件
  - _设计文档 §3.1_

- [ ] 3.3 编写 WXML + WXSS
  - WXML：fixed 定位容器 + 图标 + 文案
  - WXSS：bottom 定位，暗色半透明背景，圆角胶囊，z-index 3000
  - entering/visible 滑入动画，leaving 滑出动画
  - 适配安全区域（`safe-area-inset-bottom`）
  - _设计文档 §3.2 + §3.3_

**验证方式**：测试页面中手动触发 Toast，验证滑入、自动消失、点击关闭三种场景。

---

### Task 4：首页集成 — P0 核心（满月 + 百日）

**工时**：3h  
**前置依赖**：Task 1 + 2 + 3  
**产出文件**：`pages/home/home.js`（增量）、`home.wxml`（增量）、`home.wxss`（增量）、`home.json`（增量）

- [ ] 4.1 `home.json` 注册两个新组件
  - 添加 `"easter-egg-popup"` 和 `"easter-egg-toast"` 组件引用
  - _设计文档 §4.1_

- [ ] 4.2 `home.js` 新增 data 字段
  - `easterEggPopup: { show, type, eggData, storageKey }`
  - `easterEggToast: { show, text, icon, storageKey }`
  - `easterEggBanner: { show, text, icon, storageKey }`
  - 在 `this` 上挂载 `_eggToastQueue` 数组
  - 顶部引入 `const EasterEgg = require('../../utils/easter-egg');`
  - _设计文档 §4.2_

- [ ] 4.3 `home.js` 实现 `checkEasterEggs()` 方法
  - 构建 `EasterEggContext`（babyId, babyName, birthDayCount, todayStats, totalTodayCount, recentRecords）
  - 调用 `EasterEgg.detectAll(ctx)`
  - 根据返回结果设置弹窗/Toast 队列/Banner 的 data
  - 在 `loadData()` 成功完成后 `setTimeout(500ms)` 调用
  - _需求：全部 EE 检测流程，设计文档 §4.2_

- [ ] 4.4 `home.js` 实现队列管理方法
  - `_showNextToast()`：从 `_eggToastQueue` 取出下一个 → setData
  - `onEasterEggPopupClose()`：隐藏弹窗 → 500ms 后开始 Toast 队列
  - `onEasterEggToastClose()`：隐藏 Toast → 1s 后显示下一个
  - `closeEasterEggBanner()`：关闭 Banner + markShown
  - _需求：弹窗优先级规则、Toast 队列化，设计文档 §4.2_

- [ ] 4.5 `home.wxml` 插入组件引用
  - greeting-bar 之后插入 `egg-banner`（EE-5/EE-7 提示条）
  - growth-popup 之后插入 `<easter-egg-popup>` 和 `<easter-egg-toast>`
  - Banner 含关闭按钮和 slideDown 进入动画
  - _设计文档 §4.3_

- [ ] 4.6 `home.wxss` 新增 Banner 样式
  - `.egg-banner` 容器样式（flex、暖色背景、圆角）
  - `.egg-banner-icon` / `.egg-banner-text` / `.egg-banner-close`
  - `@keyframes eggSlideDown` 进入动画
  - _设计文档 §4.4_

**验证方式**：
1. 修改测试宝宝的 `birthDate` 为 30 天前 → 刷新首页 → 满月弹窗应弹出
2. 关闭弹窗后再次刷新 → 不再弹出（Storage 标记生效）
3. 修改为 100 天前 → 百日弹窗展示 + 数字翻转动画 + 祥云背景

---

### Task 5：P1 彩蛋（周岁 + 首次记录）

**工时**：2.5h  
**前置依赖**：Task 4  
**产出文件**：`home.js`（增量）+ 弹窗组件已支持 365day type

- [ ] 5.1 验证周岁弹窗（EE-3）端到端
  - 修改测试宝宝 `birthDate` 为 365 天前
  - 验证弹窗展示：粒子动画、蛋糕 + 数字「1」、年度数据回顾（4 张卡片含总记录数）
  - 验证弹窗关闭 + Storage 标记写入
  - 如有视觉问题，调整粒子数量/动画参数
  - _需求：EE-3 AC1~AC3_

- [ ] 5.2 实现 EE-4 首次记录检测（`_checkFirstRecordEgg`）
  - 在 `home.js` 中实现 `_checkFirstRecordEgg()` 方法
  - 检查 `StorageUtil.get('egg_first_record_{babyId}')` 是否已标记
  - 300ms 延迟后设置 Toast 数据（图标复用 `/images/icons/rocket.png`）
  - _需求：EE-4 AC1~AC3，设计文档 §5_

- [ ] 5.3 修改 `onRecordCreated()` 回调
  - 在已有的 `onRecordCreated()` 方法顶部加入 `this._checkFirstRecordEgg()` 调用
  - 确保不影响原有 `loadData()` 刷新流程
  - _需求：EE-4 触发时机，设计文档 §5_

**验证方式**：
1. 创建新宝宝 → 首次创建一条喂养记录 → Toast 应滑入显示「育儿之旅正式开始」
2. 再次创建记录 → Toast 不再出现
3. 切换到另一个宝宝 → 首次记录 Toast 独立触发

---

### Task 6：P2 彩蛋（月龄提示条 + 连续记录成就）

**工时**：2.5h  
**前置依赖**：Task 4  
**产出文件**：无新文件（引擎和组件已支持，仅验证和微调）

- [ ] 6.1 验证月龄提示条（EE-5）
  - 修改测试宝宝 `birthDate` 为 60/90/120 天前
  - 验证提示条展示（Banner 样式、气球图标、「X 个月啦」文案）
  - 验证关闭按钮功能 + Storage 标记
  - 验证排除规则：30/100/365 天不触发提示条
  - _需求：EE-5 AC1~AC4_

- [ ] 6.2 验证连续 7 天记录 Toast（EE-6）
  - 在本地 Storage 中模拟连续 7 天有记录的缓存数据
  - 刷新首页 → Toast 应展示「连续打卡 7 天！」
  - _需求：EE-6 AC1_

- [ ] 6.3 验证连续 30 天记录弹窗（EE-6）
  - 模拟连续 30 天记录数据
  - 刷新首页 → 弹窗应展示（streak_30 type，火焰图标 + 连续天数）
  - 验证弹窗关闭 + Storage 标记
  - _需求：EE-6 AC2~AC4_

- [ ] 6.4 验证弹窗与 Toast 优先级冲突
  - 同时满足弹窗（如满月）和 Toast（如连续 7 天）条件
  - 验证：弹窗先展示，关闭后 500ms Toast 自动弹出
  - _需求：弹窗优先级规则、设计决策 4_

**验证方式**：通过修改本地 Storage 数据和宝宝 birthDate 模拟各种条件组合。

---

### Task 7：P3 彩蛋（节日 + 数据洞察）

**工时**：2.5h  
**前置依赖**：Task 4  
**产出文件**：无新文件（引擎已实现，仅验证和微调）

- [ ] 7.1 验证节日彩蛋（EE-7）
  - **方法**：临时修改 `detectHoliday()` 中的日期判断逻辑，或 mock `new Date()` 返回特定日期
  - 验证 5 个节日分别展示正确的图标和文案：
    - 儿童节（6/1）：balloon.png，「第 N 个儿童节」
    - 母亲节：flower.png，「妈妈辛苦了」
    - 父亲节：necktie.png，「爸爸辛苦了」
    - 春节：lantern.png，「新年好！」
    - 中秋：mooncake.png，「中秋快乐！」
  - 验证节日与月龄提示条冲突时节日优先
  - _需求：EE-7 AC1~AC4_

- [ ] 7.2 验证数据洞察彩蛋（EE-8）
  - 构造 todayStats 满足「完美一天」条件 → 验证 Toast
  - 构造 todayStats 满足「喂养冠军」条件（feeding > 7）→ 验证 Toast
  - 构造 todayStats 满足「睡神降临」条件（avgDuration > 4h）→ 验证 Toast
  - **验证互斥**：同时满足多个 → 只展示最高优先级的一个
  - _需求：EE-8 AC1~AC4_

- [ ] 7.3 验证所有 10 个图标的显示效果
  - 逐一检查 `images/icons/easter-egg/` 目录下 10 个 PNG 图标
  - 在弹窗/Toast/Banner 中确认图标颜色和尺寸正确
  - 确认 EE-4 复用的 `rocket.png` 显示正常
  - _设计文档：文件结构中的图标清单_

**验证方式**：通过临时修改检测逻辑或 mock 数据触发各节日/洞察场景。

---

### Task 8：全场景验证 + NFR 达标

**工时**：1.5h  
**前置依赖**：Task 5 + 6 + 7  
**产出文件**：无（测试验证任务）

- [ ] 8.1 执行完整测试矩阵
  - 按设计文档「手动测试矩阵」逐行验证 8 个场景
  - 记录测试结果，修复发现的问题

  | 场景 | 测试方法 | 预期 |
  |------|----------|------|
  | 30天满月弹窗 | 修改 birthDate 为 30 天前 | 弹窗展示 + 数据回顾 |
  | 100天百日弹窗 | 修改 birthDate 为 100 天前 | 翻转动画 + 祥云背景 + 生长对比 |
  | 365天周岁弹窗 | 修改 birthDate 为 365 天前 | 全屏弹窗 + 粒子 + 4张回顾卡片 |
  | 首次记录 Toast | 新宝宝首次创建记录 | Toast 滑入 + 2.5s 消失 |
  | 多彩蛋冲突 | 30天 + 首次记录 | 弹窗优先，Toast 队列 |
  | 重复展示拦截 | 关闭弹窗后刷新 | 不再弹出 |
  | 多宝宝隔离 | 切换宝宝 | 独立检测 |
  | 提示条关闭 | 点击 × | 消失 + 不再展示 |

- [ ] 8.2 NFR 性能指标验证
  - **检测耗时 ≤ 50ms**：在 `checkEasterEggs()` 前后加 `console.time()` 计时
  - **弹窗动画 60fps**：使用微信开发者工具 Performance 面板检查，确认纯 CSS 动画无 JS 阻塞
  - **包体积增量 ≤ 15KB**：对比新增文件压缩后体积（`easter-egg.js` + popup 四件套 + toast 四件套）
  - **数据回顾仅查询一次**：Network 面板观察，确认仅在弹窗展示时查询
  - **粒子数 = 16**：WXML 中 `wx:for="{{16}}"` 确认
  - _需求：NFR-1 ~ NFR-5_

- [ ] 8.3 边界条件回归
  - 宝宝出生日期未设置（`birthDayCount === 0`）→ 不触发任何彩蛋
  - `loadData()` 失败（error 状态）→ 不执行 `checkEasterEggs()`
  - 弹窗展示中切换 Tab 再切回 → 弹窗状态正确（不重复弹出）
  - Storage 清空后 → 彩蛋可再次触发（用于开发测试）
  - _需求：边界条件和异常处理表格_

- [ ] 8.4 代码清理
  - 移除所有临时测试代码和 `console.log`
  - 确保所有新增代码有恰当注释
  - 检查 CSS 选择器无全局污染
  - 确认图标路径全部正确（无 404）

---

## 注意事项

### 开发约定

1. **CSS 变量优先**：所有色值、圆角、阴影必须使用 `app.wxss` 中已有的 CSS 变量，禁止硬编码新色值
2. **动画约定**：所有 `@keyframes` 命名以 `egg` 前缀避免冲突（如 `eggFadeInUp`、`eggScaleBounce`）
3. **Storage Key 规范**：严格遵循 `egg_{type}_{babyId}` 格式，确保多宝宝隔离
4. **图标路径**：彩蛋专用图标在 `/images/icons/easter-egg/` 子目录，EE-4 复用 `/images/icons/rocket.png`
5. **增量修改**：`home.js` / `home.wxml` / `home.wxss` / `home.json` 仅做增量修改，不重构现有代码

### 可能的风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| `RecordService.getRecords()` 查询大量记录性能问题 | 低 | 弹窗数据回顾加载慢 | limit 1000 兜底，考虑 365 天场景可分页 |
| 低端机粒子动画卡顿 | 中 | 365天弹窗体验差 | 粒子限制 16 个，可通过 `wx.getSystemInfo` 判断降级 |
| Storage 空间不足导致标记写入失败 | 极低 | 彩蛋重复展示 | 静默降级，可接受偶尔重复 |
| 农历日期硬编码过期（2028年后） | 确定 | 春节/中秋不触发 | 2028年前更新配置即可 |

---

*文档版本：v1.0*  
*创建日期：2026-04-07*  
*状态：待确认*
