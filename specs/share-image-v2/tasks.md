# 实施计划 - 成长报告分享图 V2（成绩单式）

> 版本：v1.0 | 日期：2026-04-07
> 需求文档：`specs/share-image-v2/requirements.md` v1.0
> 设计文档：`specs/share-image-v2/design.md` v1.1

---

## 实施概览

- **预计总工时**：8-10 小时
- **涉及文件**：3 个核心文件（`share-canvas.js`、`report-popup.js`、新建测试辅助）
- **新增/重构代码量**：约 1200 行（`share-canvas.js` 从 ~650 行重构至 ~1200 行）
- **风险等级**：中（重构核心绘制逻辑，需确保 V1 功能不回退）

### 关键里程碑

| 里程碑 | 完成标志 | 预计时间 |
|--------|----------|----------|
| M1：配置 + 工具方法就绪 | CANVAS_CONFIG_V2 扩展 + 新增工具方法可运行 | 1h |
| M2：数据层就绪 | report-popup 新增查询 + V2 数据包构建完成 | 2h |
| M3：核心指标模块就绪 | 标题区 + 宝宝信息卡 + 四维指标卡绘制完成 | 2.5h |
| M4：扩展模块就绪 | 密度条 + 生长 + 疫苗 + 里程碑 + 成就绘制完成 | 2h |
| M5：组装 + 底部就绪 | AI 建议 + 底部 + 动态高度 + draw() 主流程完成 | 1h |
| M6：验收通过 | 全部 14 个测试场景通过 + 边界条件无异常 | 1h |

### 实施依赖关系

```
任务 1（CANVAS_CONFIG_V2 + 工具方法）
  │
  ├──→ 任务 2（report-popup 数据查询扩展）
  │       │
  │       └──→ 任务 5（draw() 主流程 + 动态高度 + generateShareImage 更新）
  │
  ├──→ 任务 3（核心绘制模块: 标题 + 信息卡 + 指标卡）
  │       │
  │       └──→ 任务 4（扩展绘制模块: 密度条 + 生长 + 疫苗 + 里程碑 + 成就 + AI建议 + 底部）
  │               │
  │               └──→ 任务 5
  │
  └──→ 任务 6（全场景验证 + 边界条件）
```

### 实施策略

**采用就地重构方式**：在现有 `share-canvas.js` 文件上直接修改，不新建 V2 文件。原因：
1. V1 和 V2 不需要共存运行
2. 保持文件引用路径不变，降低其他模块的改动
3. 新增模块方法可逐步添加，便于分步验证

---

## 任务列表

### 任务 1：CANVAS_CONFIG_V2 扩展 + 工具方法

**预计耗时**：1 小时  
**文件**：`miniprogram/services/share-canvas.js`  
**改动类型**：增量扩展（在 CANVAS_CONFIG 末尾追加 V2 配置，新增工具方法）

- [ ] **1.1** 在 `CANVAS_CONFIG` 对象中扩展 V2 配置
  - 新增 `COLORS` 字段：评分等级色（5 级）、状态标签色（4 组 text+bg）、范围条色、密度条色、成就背景色
  - 新增 `FONTS` 字段：`statusTag`、`tipText`、`densityLabel`、`percentileTag`、`achievementText`、`sectionIcon`
  - 新增 `LAYOUT_V2` 字段：各模块高度/间距/内边距配置
  - _设计文档：§1 CANVAS_CONFIG V2 配置扩展_
  - _需求：NFR-3 可维护性_

- [ ] **1.2** 新增工具方法
  - `_getScoreColor(score)` — 评分颜色映射（5 级）
  - `_getScoreLabel(score)` — 评分等级文案映射
  - `_getStatusColors(status)` — 状态标签颜色映射（8 种状态 → {text, color, bgColor}）
  - `_getZoneDotColor(zone)` — 范围条定位点颜色
  - `_getPercentileDisplay(percentile)` — WHO 百分位显示配置
  - `_getDensityColor(intensity)` — 密度条渐变色
  - `_truncateAIAdvice(aiComment, data)` — AI 建议精简
  - `_calculateDailyCounts(reportData)` — 每日记录计数（含体温）
  - `_countRecordDays(reportData, days)` — 有记录天数统计
  - `_calculateAchievements(data)` — 本周成就计算（含 emoji 前缀 + 疫苗成就）
  - _设计文档：§4, §5, §6, §9, §10_

- [ ] **1.3** 验证点
  - `_getScoreColor(95)` → `'#7BC950'` ✓
  - `_getScoreColor(55)` → `'#E85454'` ✓
  - `_getStatusColors('normal')` → `{ text: '正常', color: '#7BC950', bgColor: 'rgba(123,201,80,0.15)' }` ✓
  - `_getStatusColors('attention')` → `{ text: '需关注', color: '#D4883D', ... }` ✓
  - `_getDensityColor(0.8)` → `'#8B6B4E'` ✓

---

### 任务 2：report-popup 数据查询扩展

**预计耗时**：2 小时  
**文件**：`miniprogram/components/report-popup/report-popup.js`  
**改动类型**：增量扩展（在 loadReport() 中新增并行查询，新增 _calcPercentile 方法）

- [ ] **2.1** 在 `loadReport()` 中新增并行数据查询
  - 查询最近一条 `recordType: 'growth'` 记录
  - 查询 `vaccine_records` 集合所有已接种记录
  - 查询 `milestone_records` 集合所有已达成记录
  - 调用 `TodoService.getTodoStats(baby)` 获取疫苗/里程碑统计
  - 使用 `Promise.all` 并行执行，每个查询附 `.catch()` 防止单点失败
  - _设计文档：§15 report-popup 数据查询扩展_
  - _需求：NFR-1 性能（并行查询）_

- [ ] **2.2** 处理生长数据 `growthData`
  - 从查询结果提取 `weight`、`height`
  - 计算 `daysSinceRecord`（距今天数）
  - 调用 `_calcPercentile()` 计算 WHO 百分位评价
  - _设计文档：§15 处理生长数据_
  - _需求：FR-4_

- [ ] **2.3** 新增 `_calcPercentile(type, value, baby)` 方法
  - 引用 `config/who-standards.js` 的 `WHO_WEIGHT`/`WHO_HEIGHT`
  - 引用 `utils/date.js` 的 `calculateAgeMonths`
  - 性别映射：`baby.gender === 'male' ? 'Boy' : 'Girl'`
  - 百分位判断：`< p3` → 'low', `< p15` → 'lowNormal', `≤ p85` → 'normal', `≤ p97` → 'highNormal', `> p97` → 'high'
  - _设计文档：§15 WHO 百分位计算_
  - _需求：FR-4.2_

- [ ] **2.4** 处理疫苗数据 `vaccineData`
  - 使用 `calculateAgeMonths` 判断月龄≥1
  - 已接种数 = `vaccineResult.data.length`
  - 总数 = 已接种 + `todoStats.vaccine`（待接种数）
  - 逾期数 = `todoStats.overdue`
  - 当月龄≥1 时始终构建 vaccineData（即使从未接种也显示 0/X）
  - **不调用** `TodoService._getVaccinePlans()`（私有方法）
  - _设计文档：§15 处理疫苗数据_
  - _需求：FR-5, 边界条件"从未接种过疫苗"_

- [ ] **2.5** 处理里程碑数据 `milestoneData` + 趋势数据 `trendData`
  - 里程碑：已达成名称列表 + 下一个待解锁
  - 趋势数据：通过 `TrendService.getInstance().getTrendData(babyId)` 获取
  - _设计文档：§15 处理里程碑数据 / 获取趋势数据_
  - _需求：FR-6, FR-3.4_

- [ ] **2.6** 将新数据通过 `setData()` 存储
  - 新增字段：`growthData`、`vaccineData`、`milestoneData`、`trendData`、`currentPeriod`
  - _设计文档：§12 V2 数据接口定义_

- [ ] **2.7** 验证点
  - 有生长记录 → `growthData.weight` 不为 null ✓
  - 无生长记录 → `growthData` 为 null ✓
  - 月龄≥1 且从未接种 → `vaccineData = { done: 0, total: X, overdue: 0 }` ✓
  - 月龄<1 → `vaccineData` 为 null ✓
  - TodoService 异常 → 不影响其他查询 ✓
  - gender='male' → WHO 标准用 'Boy' ✓

---

### 任务 3：核心绘制模块 — 标题区 + 信息卡 + 指标卡

**预计耗时**：2.5 小时  
**文件**：`miniprogram/services/share-canvas.js`  
**改动类型**：重构（替换 V1 的 `_drawHeader` + `_drawStatCards`）

- [ ] **3.1** 实现 `_drawTitleSection(ctx, data, startY)` — 模块 ①
  - 温情化标题：`{宝宝名}的一周成绩单` / `月度成绩单`
  - 名字超过 4 字截断 + "…"
  - 副标题：日期范围
  - 出生第 N 天标记（基于 `babyInfo.birthDate`）
  - 白色文字绘制在头部色块之上
  - 返回 `startY + 120`
  - _设计文档：§2 模块 ①_
  - _需求：FR-1.1, FR-1.2, FR-1.3_

- [ ] **3.2** 实现 `_drawBabyInfoCard(ctx, data, startY)` — 模块 ②
  - 白色圆角卡片背景
  - 左侧：头像（复用 V1 `_drawAvatar`） + 名字 + 月龄
  - 右侧：评分数字（颜色由 `_getScoreColor` 返回） + 等级文字 + 线性进度条
  - 进度条填充比例 = overallScore / 100
  - 返回 `cardY + 160 + 16`
  - _设计文档：§3 模块 ②_
  - _需求：FR-2.1, FR-2.2_

- [ ] **3.3** 实现 `_drawIndicatorCards(ctx, data, startY)` — 模块 ③ 框架
  - 引用 `TrendService` 静态方法
  - 计算月龄（使用 `calculateAgeMonths` 工具函数）
  - 依次调用 `_drawSingleIndicatorCard` 绘制 4 张卡片（喂养/睡眠/排便/体温）
  - 各维度调用 `getReferenceRange`、`calculateStatus`、`generateTip`
  - 体温特殊处理：无 range 参数，使用异常计数逻辑
  - **末尾将各维度 status 存入 data 对象**（`data._feedingStatus` 等）
  - _设计文档：§4 模块 ③_
  - _需求：FR-3.1 ~ FR-3.4_

- [ ] **3.4** 实现 `_drawSingleIndicatorCard(ctx, startY, cardData)` — 单张指标卡
  - **标题行**：左侧色条(6px) + 图标(24x24) + 标题文字 + 状态标签（彩色字+浅色背景） + 右对齐数值+单位 + 环比箭头
  - **范围条行**（可选）：三段式条（灰+绿+灰） + 圆形定位点 + 参考范围文字
  - **提示行**：智能提示语
  - 动态计算卡片高度（有/无范围条）
  - 环比条件修复：`changePercent > 0 && changeValue !== 0`
  - 状态标签：用 `_getStatusColors()` 返回颜色，不调用 `getStatusDisplay()`
  - 返回 `startY + cardHeight + 10`
  - _设计文档：§4 _drawSingleIndicatorCard_
  - _需求：FR-3.1, FR-3.2, FR-3.3, FR-3.4_

- [ ] **3.5** 验证点
  - 标题 "小宝的一周成绩单" ✓
  - 名字 "张三丰丰丰" → 截断为 "张三丰丰…" ✓
  - 评分 85 → 蓝绿色 + "状态良好" + 进度条 85% ✓
  - 喂养正常 → 绿色标签 "正常" + 绿色定位点在正常区 ✓
  - 睡眠偏少 → 橙色标签 "偏少" + 橙色定位点在左侧区 ✓
  - 体温无范围条，仅显示平均值和状态 ✓
  - 无出生日期 → 无范围条、无状态标签 ✓

---

### 任务 4：扩展绘制模块 — 密度条 + 生长 + 疫苗 + 里程碑 + 成就 + AI + 底部

**预计耗时**：2 小时  
**文件**：`miniprogram/services/share-canvas.js`  
**改动类型**：新增方法

- [ ] **4.1** 实现 `_drawDensityBar(ctx, data, startY)` — 模块 ④
  - 仅周报显示（月报返回 startY）
  - 7 个色块，深浅表示记录密度（使用 `_getDensityColor`）
  - 下方日期标签（一/二/三/.../日）
  - 卡片高度 90px（修复溢出）
  - `_calculateDailyCounts` 包含体温记录
  - _设计文档：§5 模块 ④_
  - _需求：FR-9_

- [ ] **4.2** 实现 `_drawGrowthSection(ctx, data, startY)` — 模块 ⑤
  - 无 `growthData` 时跳过
  - 展示体重 + 身高 + WHO 百分位标签
  - 超过 30 天标注 "(X天前测量)"
  - 百分位用 `_getPercentileDisplay` 渲染色块标签
  - _设计文档：§6 模块 ⑤_
  - _需求：FR-4.1 ~ FR-4.5_

- [ ] **4.3** 实现 `_drawVaccineProgress(ctx, data, startY)` — 模块 ⑥
  - 无出生日期或月龄<1 时跳过
  - 月龄≥1 时始终显示（即使 vaccineData 为 null 也用默认值 0/0/0）
  - 进度条 + 右侧 done/total 数字
  - 全部完成 → 绿色 "全部完成"
  - 有逾期 → 红色 "X剂逾期"
  - 使用 `calculateAgeMonths` 工具函数替代手动计算
  - _设计文档：§7 模块 ⑥_
  - _需求：FR-5.1 ~ FR-5.3, 边界条件"从未接种过疫苗"_

- [ ] **4.4** 实现 `_drawMilestoneSection(ctx, data, startY)` — 模块 ⑦
  - 无里程碑记录时跳过
  - 已达成（最近 3 个）：✓ + 名称，用 · 分隔
  - 待解锁（下一个）：虚线框样式
  - _设计文档：§8 模块 ⑦_
  - _需求：FR-6.1 ~ FR-6.3_

- [ ] **4.5** 实现 `_drawAchievementSection(ctx, data, startY)` — 模块 ⑧
  - 调用 `_calculateAchievements(data)` 获取成就列表（最多 3 条）
  - 每行文字含 emoji 前缀
  - 无成就时显示鼓励语 "每一天的记录都是对宝宝的爱 ❤️"
  - 注意：**必须在 `_drawIndicatorCards` 之后调用**（依赖 `data._feedingStatus` 等字段）
  - _设计文档：§9 模块 ⑧_
  - _需求：FR-7.1 ~ FR-7.3_

- [ ] **4.6** 实现 `_drawAIAdvice(ctx, data, startY)` — 模块 ⑨
  - 无 `aiComment` 时跳过
  - 精简为≤2 句（约 60 字）
  - 优先级：关注类 > 正面肯定类
  - 使用 `_drawWrappedText` 自动换行
  - _设计文档：§10 模块 ⑨_
  - _需求：FR-8.1 ~ FR-8.3_

- [ ] **4.7** 更新 `_drawFooter(ctx, totalHeight)` — 模块 ⑩
  - 副标题改为 "记录每一天的成长"
  - 其余保持 V1 逻辑
  - _设计文档：§11 模块 ⑩_
  - _需求：FR-10.1, FR-10.2_

- [ ] **4.8** 验证点
  - 月报 → 密度条不显示 ✓
  - 周报 → 密度条 7 个色块，有体温记录的天色块更深 ✓
  - 无生长数据 → 生长模块跳过，无空白 ✓
  - 从未接种 + 月龄≥1 → 疫苗显示 0/X ✓
  - 月龄<1 → 疫苗模块不显示 ✓
  - 无里程碑 → 里程碑模块跳过 ✓
  - 成就含 emoji 前缀 ✓
  - AI 建议≤60 字 ✓
  - 底部副标题 "记录每一天的成长" ✓

---

### 任务 5：draw() 主流程 + 动态高度 + generateShareImage 更新

**预计耗时**：1 小时  
**文件**：`miniprogram/services/share-canvas.js` + `miniprogram/components/report-popup/report-popup.js`  
**改动类型**：重构 draw()、calculateCanvasHeight()、generateShareImage()

- [ ] **5.1** 重构 `calculateCanvasHeight(data, ctx)`
  - **V2 签名**：`(data, ctx)`，替代 V1 的 `(reportData, aiComment, ctx)`
  - 遍历 10 个模块，累加高度
  - 密度条仅周报计入（90px）
  - 疫苗模块：有出生日期且月龄≥1 即计入
  - 成就模块：调用 `_calculateAchievements` 获取行数
  - AI 建议：调用 `_truncateAIAdvice` + `_calculateTextLines` 获取行数
  - 最小高度 1200px
  - _设计文档：§14 动态高度计算 V2_
  - _需求：FR-11.3_

- [ ] **5.2** 重构 `draw(ctx, data)` 主流程
  - V2 数据接口（见设计文档 §12）
  - 按模块顺序调用：background → title → babyInfo → indicatorCards → densityBar → growth → vaccine → milestone → achievement → aiAdvice → footer
  - 使用累加 Y 坐标，每个模块返回 endY
  - **指标卡必须在成就之前**（成就依赖 `data._feedingStatus` 等）
  - _设计文档：§12 V2 数据接口 + §14 draw 主流程_
  - _需求：FR-11.1, FR-11.2_

- [ ] **5.3** 更新 `generateShareImage()` 调用方式
  - 构建 V2 数据包（合并 V1 字段 + V2 新增字段）
  - 调用 `calculateCanvasHeight(v2Data, ctx)` （2 参数）
  - 调用 `draw(ctx, v2Data)`
  - _设计文档：§13 generateShareImage V2 调用更新_
  - _需求：FR-11_

- [ ] **5.4** 验证点
  - 全数据高度 > 1200px ✓
  - 最小数据（无生长/疫苗/里程碑）高度 ≥ 1200px ✓
  - calculateCanvasHeight 与实际绘制高度一致（Footer 在底部）✓
  - 月报无密度条，高度比周报少 106px (90+16) ✓

---

### 任务 6：全场景验证 + 边界条件

**预计耗时**：1 小时  
**改动类型**：测试验证

- [ ] **6.1** 核心场景验证

  | # | 场景 | 验证点 | 状态 |
  |---|------|--------|------|
  | T1 | 全数据完整 | 10 个模块全部绘制，高度正确 | ☐ |
  | T2 | 无生长数据 | 生长模块跳过，无空白 | ☐ |
  | T3 | 无疫苗记录（月龄>1月） | 疫苗进度显示 0/X，不跳过 | ☐ |
  | T4 | 无里程碑记录 | 里程碑模块跳过 | ☐ |
  | T5 | 宝宝无出生日期 | 无月龄→无范围条→无百分位→无疫苗 | ☐ |
  | T6 | 本周 0 条记录 | 四维卡片显示"--"，密度条全灰，成就显示鼓励语 | ☐ |
  | T7 | 月报模式 | 密度条不显示，其他模块正常 | ☐ |

- [ ] **6.2** 边界条件验证

  | # | 场景 | 验证点 | 状态 |
  |---|------|--------|------|
  | T8 | AI 评语极长 | 精简为≤2句，不超过 60 字 | ☐ |
  | T9 | 3x DPR 设备 | DPR 限制为 2，图片 < 800KB | ☐ |
  | T10 | 趋势数据获取失败 | 指标卡仅显示数值，无状态标签/范围条/环比 | ☐ |
  | T11 | 生长数据超过 30 天 | 标注"(X天前测量)" | ☐ |
  | T12 | 所有指标"正常" | 全部绿色标签，3 个成就亮点 | ☐ |
  | T13 | 多个指标"偏少/偏多" | 橙/红色标签，AI 建议优先关注类 | ☐ |
  | T14 | Canvas 内存不足 | 捕获异常，提示重试 | ☐ |

- [ ] **6.3** V1 → V2 回归验证
  - 确认旧的 report-popup 弹窗打开流程不受影响
  - 确认 Canvas 节点 ID 和离屏绘制方案保持不变
  - 确认图片导出路径和分享流程不变
  - 确认 DPR 2x 限制仍生效

---

## 文件变更清单

| 操作 | 文件 | 改动量 | 说明 |
|------|------|--------|------|
| **重构** | `miniprogram/services/share-canvas.js` | ~1200 行 | V1 → V2，扩展配置 + 10 个绘制模块 |
| **修改** | `miniprogram/components/report-popup/report-popup.js` | ~120 行新增 | 新增数据查询 + _calcPercentile + generateShareImage V2 调用 |
| **复用** | `miniprogram/services/trendService.js` | 不修改 | 调用静态方法 |
| **复用** | `miniprogram/services/todo.js` | 不修改 | 调用 getTodoStats() |
| **复用** | `miniprogram/config/who-standards.js` | 不修改 | 调用百分位数据 |
| **复用** | `miniprogram/utils/date.js` | 不修改 | 调用 calculateAgeMonths() |

---

## 风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Canvas 内存超限（模块过多导致 Canvas 过高） | 低 | 分享图生成失败 | 设置最大高度 3000px，超出时降级为核心模块 |
| emoji 在部分 Android 设备渲染异常 | 中 | 成就/提示语显示异常 | 降级方案：emoji 替换为纯文字符号 |
| TodoService.getTodoStats() 返回数据格式变化 | 低 | 疫苗数据构建失败 | 每个查询独立 catch，失败时对应模块不显示 |
| WHO 标准表中月龄不连续（如缺少 13、14 月龄） | 低 | 百分位计算返回 null | 使用最近月龄匹配策略（已在设计中处理） |
| V1 share-canvas.js 重构后其他调用方断裂 | 中 | 编译/运行时错误 | 确保 draw() 和 calculateCanvasHeight() 仍为主入口，内部兼容 |

---

*文档版本：v1.0*  
*创建日期：2026-04-07*  
*关联设计：specs/share-image-v2/design.md v1.1*  
*关联需求：specs/share-image-v2/requirements.md v1.0*
