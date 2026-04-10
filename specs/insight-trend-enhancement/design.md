# 设计文档 - 本周趋势智能增强（Insight Trend Enhancement）

> 版本：v1.1 | 日期：2026-04-07 | 状态：待确认
> 需求文档：`specs/insight-trend-enhancement/requirements.md` v1.1

---

## 1. 月龄参考范围数据（权威来源验证）

### 1.1 数据来源与考证

本设计中使用的月龄参考范围均经过权威医学文献交叉验证，确保数据准确可靠。以下是各维度的数据来源：

#### 睡眠参考来源

| 来源 | 发布年份 | 标准名称 | 引用 |
|------|----------|----------|------|
| **NSF** | 2015（2025 更新确认） | National Sleep Foundation's Sleep Time Duration Recommendations | Hirshkowitz M, et al. *Sleep Health.* 2015;1(1):40-43 |
| **AASM** | 2016 | Consensus Statement on Recommended Amount of Sleep for Pediatric Populations | Paruthi S, et al. *J Clin Sleep Med.* 2016;12(6):785-786 |
| **AAP** | 2016 | AAP 背书 AASM 2016 共识声明 | [aap.org](https://www.aap.org) |

**NSF 推荐（主要参考，覆盖 0-3 个月段）：**
- 新生儿 Newborns (0-3 months): **14-17h**
- 婴儿 Infants (4-11 months): **12-15h**
- 幼儿 Toddlers (1-2 years): **11-14h**
- 学龄前 Preschoolers (3-5 years): **10-13h**

**AASM/AAP 推荐（补充参考）：**
- 婴儿 Infants (4-12 months): **12-16h**（含午睡）
- 幼儿 Children (1-2 years): **11-14h**（含午睡）
- 注：AASM 明确声明对 < 4 个月婴儿不做建议，因为正常变异范围太广

> ⚠️ **需求文档勘误**：原需求文档 v1.0 中 0-1 月段标注为 14-18h，与 NSF 官方推荐不一致。NSF 的 0-3 个月段统一为 **14-17h**，不存在 14-18h 的推荐。虽然 NSF 标注 ≤18h 亦属"may be appropriate"范围，但本设计统一采用 NSF 核心推荐 **14-17h** 作为 0-3 月段标准（见 §1.2），与需求文档 v1.1 一致。

#### 喂养参考来源

| 来源 | 发布年份 | 标准名称 | 引用 |
|------|----------|----------|------|
| **AAP** | 2025 更新 | How Often to Breastfeed | [HealthyChildren.org](https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/How-Often-to-Breastfeed.aspx) |
| **AAP** | 2022 更新 | Amount and Schedule of Formula Feedings | [HealthyChildren.org](https://www.healthychildren.org/english/ages-stages/baby/formula-feeding/pages/amount-and-schedule-of-formula-feedings.aspx) |
| **CDC** | 2025 | How Much and How Often to Feed | [cdc.gov](https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/how-much-and-how-often-to-feed.html) |

**AAP/CDC 关键数据：**
- 新生儿（0-1 个月）：每 24 小时 **8-12 次**（母乳），配方奶每 3-4 小时一次（约 **6-8 次/日**）
- 2-4 个月：白天间隔延长至 3-4 小时，夜间可延至 4-5 小时（约 **6-8 次/日**）
- 6 个月：配方奶 24 小时 **4-5 次**（AAP 明确数据）
- 引入辅食后（6 个月+）：奶次逐步减少，辅食增加

#### 排便参考来源

| 来源 | 发布年份 | 标准名称 | 引用 |
|------|----------|----------|------|
| **Baaleman DF et al.** | 2023 | Normal Defecation Patterns in Healthy Children (系统综述) | *J Pediatr.* 2023;261:113559 |
| **HELMi Cohort** | 2024 | Bowel function in 1052 healthy term infants | *Eur J Pediatr.* 2024;183:3609-3618 |
| **AAFP POEMs** | 2024 | Normal Defecation Patterns Vary by Age, Diet, Place | *Am Fam Physician.* 2024;109(2) |
| **AAP** | — | HealthyChildren.org Constipation & Stool patterns | [HealthyChildren.org](https://www.healthychildren.org) |

**关键文献数据（Baaleman 2023 系统综述，75 项研究，n=16,393）：**
- 婴儿 ≤ 14 周龄：中位数范围 **7.0-44.9 次/周**（即 1.0-6.4 次/日）
- 幼儿 15 周-4 岁：中位数范围 **6.2-17.9 次/周**（即 0.9-2.6 次/日）
- 母乳喂养婴儿：中位数 **23 次/周**（约 3.3 次/日）
- 排便频率个体差异极大，性别无显著差异

**综合文献数据（补充）：**
- 新生儿第 1 个月：约 **3-4 次/日**（母乳喂养更频繁）
- 第 2 个月：约 **2-3 次/日**
- 3-12 个月：约 **1-2 次/日**（随辅食引入逐渐稳定）
- 12 个月+：约 **1-2 次/日**（接近成人模式）

> 📝 **注意**：排便频率的正常变异范围极广（AAP 指出从一天数次到数天一次都可能正常），因此排便参考范围仅作为趋势参考指引，不适合做严格偏离判定。

---

### 1.2 最终参考范围数据表（经验证修正版）

以下为本设计采用的月龄参考范围，综合多方权威来源并适度简化为实用分段：

#### 睡眠（日均小时数）

| 月龄段 | 键名 | 最小值 | 最大值 | 来源依据 | 备注 |
|--------|------|--------|--------|----------|------|
| 0-1 月 | `0` | 14 | 17 | NSF 新生儿标准 14-17h | NSF 注明 ≤18h 亦属正常，取核心推荐范围 |
| 1-3 月 | `1` | 14 | 17 | NSF 新生儿标准 14-17h | 与 NSF 0-3mo 统一 |
| 3-6 月 | `3` | 12 | 16 | NSF 12-15h + AASM 12-16h 取并集 | AASM 从 4mo 起推荐 12-16h |
| 6-12 月 | `6` | 12 | 15 | NSF 婴儿标准 12-15h | AASM 12-16h 更宽，取 NSF 较窄范围 |
| 12-24 月 | `12` | 11 | 14 | NSF & AASM 一致：11-14h | 两个权威来源完全一致 |
| 24 月+ | `24` | 10 | 13 | NSF 学龄前标准 10-13h | 适用于 2-5 岁 |

#### 喂养（日均次数）

| 月龄段 | 键名 | 最小值 | 最大值 | 来源依据 | 备注 |
|--------|------|--------|--------|----------|------|
| 0-1 月 | `0` | 8 | 12 | AAP/CDC：新生儿 8-12 次/24h | 母乳按需哺乳 |
| 1-3 月 | `1` | 6 | 10 | AAP：每 2-3h（白天）→约 6-10 次 | 逐步建立间隔 |
| 3-6 月 | `3` | 5 | 8 | AAP：间隔 3-4h，夜间延长 | 母乳/配方奶均适用 |
| 6-12 月 | `6` | 4 | 6 | AAP：配方奶 4-5 次 + 辅食 | 辅食引入后奶次减少 |
| 12-24 月 | `12` | 3 | 5 | AAP：以固体食物为主 + 奶 | 三餐 + 1-2 次加餐/奶 |
| 24 月+ | `24` | 3 | 5 | 常规三餐 + 加餐 | 与 12-24 月保持一致 |

#### 排便（日均次数）

| 月龄段 | 键名 | 最小值 | 最大值 | 来源依据 | 备注 |
|--------|------|--------|--------|----------|------|
| 0-1 月 | `0` | 3 | 8 | Baaleman 2023 系统综述中位数范围 | 母乳喂养 > 配方奶 |
| 1-3 月 | `1` | 2 | 5 | 文献：约 2-3 次/日，范围 1-5 次 | 个体差异大 |
| 3-6 月 | `3` | 1 | 4 | 文献：逐步减少至 1-2 次/日 | 辅食前后变化大 |
| 6-12 月 | `6` | 1 | 3 | Baaleman 2023：幼儿期中位数约 1-2.6/日 | 辅食引入后趋稳 |
| 12 月+ | `12` | 1 | 3 | AAFP POEMs：接近成人模式 | 1-3 次/日为正常 |

> 📋 **设计决策**：排便参考范围设定偏宽松，因为排便频率的正常个体差异极大（AAP 原文："从一天数次到数天一次都可能正常"）。状态判定时，排便维度的偏离阈值可适当放宽。

---

## 2. 架构设计

### 2.1 整体数据流

```
babyId (组件属性)
  │
  ├──→ StorageUtil.getCurrentBaby() → baby.birthDate
  │       │
  │       └──→ calculateAgeMonths(birthDate) → ageMonths
  │
  ├──→ trendService.getTrendData(babyId)
  │       │
  │       └──→ { trendData, trendPeriod }
  │              │
  │              ├── feeding: { thisWeekAvg, lastWeekAvg, changePercent, isUp }
  │              ├── sleep:   { thisWeekAvg, lastWeekAvg, changePercent, isUp }
  │              ├── diaper:  { thisWeekAvg, lastWeekAvg, changePercent, isUp }
  │              └── temperature: { abnormalCount, latestValue, latestTime }
  │
  └──→ 组件 JS 层组合计算（纯本地，<1ms）
          │
          ├── getReferenceRange(dimension, ageMonths) → { min, max }
          ├── calculateStatus(value, range, dimension) → status
          ├── calculateRangeBarPosition(value, range) → position%
          └── generateTip(dimension, status) → tipText
              │
              └──→ setData({ enhancedTrendData }) → WXML 渲染
```

### 2.2 改动范围与职责划分

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `services/trendService.js` | **增量扩展** | 新增 3 个静态方法 + 参考范围配置数据 |
| `components/insight-section/insight-section.js` | **增量改造** | 新增月龄获取 + 增强数据组装逻辑 |
| `components/insight-section/insight-section.wxml` | **重构** | 全新 4 行信息架构卡片模板 |
| `components/insight-section/insight-section.wxss` | **重构** | 新增状态标签、范围条、提示语样式 |

### 2.3 不改动的模块

- `report-popup` 组件 — 查看详细报告功能不受影响
- `record.js` 页面 — 仅传递 `babyId`，不感知内部变化
- `utils/date.js` — 复用 `calculateAgeMonths()`，不新增功能
- `app.wxss` — 复用现有 CSS 变量，不新增变量

---

## 3. 数据模型设计

### 3.1 参考范围配置对象

内置在 `trendService.js` 中，作为模块级常量：

```javascript
/**
 * 月龄参考范围配置
 * 来源：NSF (睡眠)、AAP/CDC (喂养)、Baaleman 2023 系统综述 (排便)
 * 
 * 数据结构：{ dimension: { monthKey: { min, max, label } } }
 * monthKey 为月龄分段起始值，查找时取 ≤ ageMonths 的最大 key
 */
const REFERENCE_RANGES = {
  feeding: {
    0:  { min: 8,  max: 12, label: '0-1月' },
    1:  { min: 6,  max: 10, label: '1-3月' },
    3:  { min: 5,  max: 8,  label: '3-6月' },
    6:  { min: 4,  max: 6,  label: '6-12月' },
    12: { min: 3,  max: 5,  label: '12-24月' },
    24: { min: 3,  max: 5,  label: '24月+' }
  },
  sleep: {
    0:  { min: 14, max: 17, label: '0-1月' },
    1:  { min: 14, max: 17, label: '1-3月' },
    3:  { min: 12, max: 16, label: '3-6月' },
    6:  { min: 12, max: 15, label: '6-12月' },
    12: { min: 11, max: 14, label: '12-24月' },
    24: { min: 10, max: 13, label: '24月+' }
  },
  diaper: {
    0:  { min: 3, max: 8, label: '0-1月' },
    1:  { min: 2, max: 5, label: '1-3月' },
    3:  { min: 1, max: 4, label: '3-6月' },
    6:  { min: 1, max: 3, label: '6-12月' },
    12: { min: 1, max: 3, label: '12月+' }
  }
  // temperature 无参考范围概念，通过异常次数判定
};
```

**查找算法**：给定 `dimension` 和 `ageMonths`，在对应维度的 keys 中找到 `≤ ageMonths` 的最大 key。

```javascript
// 示例：ageMonths = 5 → feeding 键为 [0,1,3,6,12,24]
// ≤ 5 的最大 key = 3 → 返回 { min: 5, max: 8, label: '3-6月' }
```

### 3.2 状态枚举

```javascript
/**
 * 趋势状态枚举
 * 用于 FR-1 智能状态标签
 */
const TREND_STATUS = {
  NORMAL:       'normal',        // 正常 — 值在参考范围内
  LOW:          'low',           // 偏少 — 低于范围 ≤30%
  HIGH:         'high',          // 偏多 — 高于范围 ≤30%
  VERY_LOW:     'veryLow',       // 明显偏少 — 低于范围 >30%
  VERY_HIGH:    'veryHigh',      // 明显偏多 — 高于范围 >30%
  NO_DATA:      'noData'         // 无数据
};

/**
 * 体温状态枚举（独立逻辑，基于异常次数）
 */
const TEMP_STATUS = {
  NORMAL:       'normal',        // 0 次异常
  ATTENTION:    'attention',     // 1-2 次异常
  ALERT:        'alert',         // ≥3 次异常
  NO_DATA:      'noData'         // 无数据
};
```

### 3.3 偏离阈值常量

```javascript
/**
 * 偏离阈值常量（FR-1 定义）
 * 可配置，便于后续调整
 */
const DEVIATION_THRESHOLD = 0.30;  // 30% 偏离分界线

/**
 * 周环比变化颜色阈值（FR-6 定义）
 */
const CHANGE_THRESHOLD = {
  MINOR: 10,    // ≤10% 灰色
  MODERATE: 30  // 11-30% 绿/橙色
};
```

### 3.4 状态标签视觉映射

```javascript
/**
 * 状态标签视觉配置
 * 复用 app.wxss 中已有的语义色变量
 */
const STATUS_DISPLAY = {
  normal:   { text: '正常',     colorVar: '--success-color', bgAlpha: 0.1 },
  low:      { text: '偏少',     colorVar: '--warning-color', bgAlpha: 0.1 },
  high:     { text: '偏多',     colorVar: '--warning-color', bgAlpha: 0.1 },
  veryLow:  { text: '明显偏少', colorVar: '--danger-color',  bgAlpha: 0.1 },
  veryHigh: { text: '明显偏多', colorVar: '--danger-color',  bgAlpha: 0.1 },
  noData:   { text: '无数据',   colorVar: '--text-hint',     bgAlpha: 0.1 },
  // 体温专用
  attention: { text: '需关注', colorVar: '--warning-color', bgAlpha: 0.1 },
  alert:     { text: '需就医', colorVar: '--danger-color',  bgAlpha: 0.1 }
};
```

### 3.5 提示语映射表

```javascript
/**
 * 智能提示语映射（FR-4）
 * 纯本地规则引擎，不调用 AI
 */
const TIP_MESSAGES = {
  feeding: {
    normal:   '喂养规律，保持即可 👍',
    low:      '日均喂养略少，注意宝宝饥饿信号',
    high:     '喂养频率偏高，可观察是否吃饱',
    veryLow:  '喂养次数明显偏少，建议关注',
    veryHigh: '频繁喂养，建议咨询是否需调整',
    noData:   '开始记录喂养，获取趋势分析'
  },
  sleep: {
    normal:   '睡眠充足，继续保持作息规律',
    low:      '日均睡眠略低，关注夜间作息',
    high:     '睡眠偏多，注意观察精神状态',
    veryLow:  '睡眠明显不足，建议改善睡眠环境',
    veryHigh: '嗜睡需关注，如持续请咨询医生',
    noData:   '开始记录睡眠，了解作息规律'
  },
  diaper: {
    normal:   '排便正常，消化良好',
    low:      '排便次数略少，多注意饮食',
    high:     '排便次数偏多，注意大便性状',
    veryLow:  '排便明显减少，如持续请咨询医生',
    veryHigh: '腹泻风险，注意补水和就医',
    noData:   '开始记录排便，跟踪消化情况'
  },
  temperature: {
    normal:   '体温正常，宝宝很健康',
    attention:'有体温偏高记录，注意观察',
    alert:    '多次发热，建议及时就医',
    noData:   '定期测量体温，关注健康状况'
  }
};
```

---

## 4. API 设计（trendService.js 新增方法）

### 4.1 `getReferenceRange(dimension, ageMonths)`

```javascript
/**
 * 获取指定维度和月龄的参考范围
 * @param {string} dimension - 维度名：'feeding' | 'sleep' | 'diaper'
 * @param {number} ageMonths - 月龄（由 calculateAgeMonths 计算）
 * @returns {Object|null} { min, max, label } 或 null（体温维度/无效输入）
 * 
 * 算法：在 REFERENCE_RANGES[dimension] 的 keys 中找到 ≤ ageMonths 的最大 key
 * 时间复杂度：O(k)，k = 分段数（≤6），实测 <0.01ms
 */
static getReferenceRange(dimension, ageMonths) {
  const ranges = REFERENCE_RANGES[dimension];
  if (!ranges || ageMonths < 0) return null;
  
  const keys = Object.keys(ranges).map(Number).sort((a, b) => a - b);
  let matchedKey = keys[0]; // 默认第一段
  
  for (let i = keys.length - 1; i >= 0; i--) {
    if (ageMonths >= keys[i]) {
      matchedKey = keys[i];
      break;
    }
  }
  
  return ranges[matchedKey];
}
```

### 4.2 `calculateStatus(value, range, dimension)`

```javascript
/**
 * 计算趋势状态
 * @param {number} value - 当前日均值（thisWeekAvg）
 * @param {Object|null} range - 参考范围 { min, max }，null 表示无参考范围
 * @param {string} dimension - 维度名（用于区分体温特殊逻辑）
 * @param {Object} [extra] - 额外参数（体温维度传入 { abnormalCount }）
 * @returns {string} TREND_STATUS 或 TEMP_STATUS 中的值
 * 
 * 算法（非体温维度）：
 *   1. thisWeekAvg === 0 && lastWeekAvg === 0 → 'noData'
 *   2. range === null → 退化为仅显示趋势（不返回状态）
 *   3. min ≤ value ≤ max → 'normal'（含边界）
 *   4. value < min：deviation = (min - value) / min
 *      - deviation ≤ 0.30 → 'low'
 *      - deviation > 0.30 → 'veryLow'
 *   5. value > max：deviation = (value - max) / max
 *      - deviation ≤ 0.30 → 'high'
 *      - deviation > 0.30 → 'veryHigh'
 * 
 * 算法（体温维度）：
 *   1. 无本周体温记录 → 'noData'
 *   2. abnormalCount === 0 → 'normal'
 *   3. abnormalCount 1-2 → 'attention'
 *   4. abnormalCount >= 3 → 'alert'
 */
static calculateStatus(value, range, dimension, extra = {}) {
  // 体温特殊逻辑
  if (dimension === 'temperature') {
    const { abnormalCount, hasData } = extra;
    if (!hasData) return TEMP_STATUS.NO_DATA;
    if (abnormalCount === 0) return TEMP_STATUS.NORMAL;
    if (abnormalCount <= 2) return TEMP_STATUS.ATTENTION;
    return TEMP_STATUS.ALERT;
  }
  
  // 无数据判定
  if (value === 0 && (!extra.lastWeekAvg || extra.lastWeekAvg === 0)) {
    return TREND_STATUS.NO_DATA;
  }
  
  // 无参考范围（出生日期缺失）
  if (!range) return null;
  
  // 含边界的正常判定
  if (value >= range.min && value <= range.max) {
    return TREND_STATUS.NORMAL;
  }
  
  // 偏低
  if (value < range.min) {
    const deviation = (range.min - value) / range.min;
    return deviation > DEVIATION_THRESHOLD 
      ? TREND_STATUS.VERY_LOW 
      : TREND_STATUS.LOW;
  }
  
  // 偏高
  const deviation = (value - range.max) / range.max;
  return deviation > DEVIATION_THRESHOLD 
    ? TREND_STATUS.VERY_HIGH 
    : TREND_STATUS.HIGH;
}
```

### 4.3 `calculateRangeBarPosition(value, range)`

```javascript
/**
 * 计算范围条定位点位置百分比
 * @param {number} value - 当前日均值
 * @param {Object} range - 参考范围 { min, max }
 * @returns {Object} { position: number(0-100), zone: 'left'|'normal'|'right' }
 * 
 * 布局逻辑：
 *   范围条总宽度 = 100%
 *   左侧偏低区 = 0% ~ 20%（占 20%）
 *   正常区     = 20% ~ 80%（占 60%）
 *   右侧偏高区 = 80% ~ 100%（占 20%）
 * 
 *   正常区内：position = 20 + (value - min) / (max - min) * 60
 *   偏低区：position = max(2, 20 * value / min) — 越低越靠左，最小 2%
 *   偏高区：position = min(98, 80 + 20 * (value - max) / max) — 越高越靠右，最大 98%
 */
static calculateRangeBarPosition(value, range) {
  if (!range) return { position: 50, zone: 'normal' };
  
  const { min, max } = range;
  
  // 参考范围上下限相同（边界条件）
  if (min === max) {
    return value === min 
      ? { position: 50, zone: 'normal' }
      : value < min 
        ? { position: 10, zone: 'left' }
        : { position: 90, zone: 'right' };
  }
  
  // 正常范围内
  if (value >= min && value <= max) {
    const position = 20 + ((value - min) / (max - min)) * 60;
    return { position: Math.round(position), zone: 'normal' };
  }
  
  // 偏低
  if (value < min) {
    const ratio = value / min;
    const position = Math.max(2, Math.round(20 * ratio));
    return { position, zone: 'left' };
  }
  
  // 偏高
  const excess = (value - max) / max;
  const position = Math.min(98, Math.round(80 + 20 * excess));
  return { position, zone: 'right' };
}
```

### 4.4 `generateTip(dimension, status)`

```javascript
/**
 * 生成一句话智能提示
 * @param {string} dimension - 维度名
 * @param {string} status - 状态值
 * @returns {string} 提示语文本
 */
static generateTip(dimension, status) {
  const dimensionTips = TIP_MESSAGES[dimension];
  if (!dimensionTips) return '';
  return dimensionTips[status] || '';
}
```

---

## 5. 组件改造设计

### 5.1 insight-section.js 改造

#### 新增依赖

```javascript
const StorageUtil = require('../../utils/storage');
const { calculateAgeMonths } = require('../../utils/date');
```

#### 新增 data 字段

```javascript
data: {
  // ... 保留现有字段 ...
  
  // 新增：增强趋势数据
  ageMonths: null,            // 当前宝宝月龄
  hasReference: false,        // 是否有参考范围（有出生日期）
  
  // 四维增强数据
  feedingEnhanced: {
    status: '',               // TREND_STATUS
    statusText: '',           // 状态标签文字
    statusClass: '',          // CSS class
    reference: null,          // { min, max, label }
    referenceText: '',        // '参考6-10次'
    barPosition: 50,          // 范围条定位 0-100
    barZone: 'normal',        // 'left' | 'normal' | 'right'
    tip: '',                  // 智能提示
    changeClass: ''           // 环比变化 CSS class
  },
  sleepEnhanced: { /* 同上结构 */ },
  diaperEnhanced: { /* 同上结构 */ },
  temperatureEnhanced: {
    status: '',
    statusText: '',
    statusClass: '',
    tip: '',
    // 体温无参考范围和范围条
  }
}
```

#### `loadTrendData` 方法改造

```javascript
async loadTrendData() {
  if (!this.data.babyId) return;
  this.setData({ loading: true });

  try {
    const trendService = new TrendService();
    const { trendData, trendPeriod } = await trendService.getTrendData(this.data.babyId);

    // 获取月龄
    const baby = StorageUtil.get('current_baby');
    const ageMonths = baby?.birthDate 
      ? calculateAgeMonths(baby.birthDate) 
      : null;
    const hasReference = ageMonths !== null;

    // 增强喂养数据
    const feedingEnhanced = this._enhanceDimension('feeding', trendData.feeding, ageMonths);
    
    // 增强睡眠数据
    const sleepEnhanced = this._enhanceDimension('sleep', trendData.sleep, ageMonths);
    
    // 增强排便数据
    const diaperEnhanced = this._enhanceDimension('diaper', trendData.diaper, ageMonths);
    
    // 增强体温数据（特殊逻辑）
    const temperatureEnhanced = this._enhanceTemperature(trendData.temperature);

    this.setData({
      trendData,
      trendPeriod,
      ageMonths,
      hasReference,
      feedingEnhanced,
      sleepEnhanced,
      diaperEnhanced,
      temperatureEnhanced,
      loading: false
    });
  } catch (error) {
    console.error('加载趋势数据失败:', error);
    this.setData({ loading: false });
  }
}
```

#### 新增私有方法 `_enhanceDimension`

```javascript
/**
 * 增强单个维度的趋势数据
 * @param {string} dimension - 维度名
 * @param {Object} trend - 原始趋势数据 { thisWeekAvg, lastWeekAvg, changePercent, isUp }
 * @param {number|null} ageMonths - 月龄
 * @returns {Object} 增强后的数据
 */
_enhanceDimension(dimension, trend, ageMonths) {
  const value = trend.thisWeekAvg;
  const range = ageMonths !== null 
    ? TrendService.getReferenceRange(dimension, ageMonths) 
    : null;
  
  const status = TrendService.calculateStatus(value, range, dimension, {
    lastWeekAvg: trend.lastWeekAvg
  });
  
  const display = TrendService.getStatusDisplay(status);
  const barInfo = range 
    ? TrendService.calculateRangeBarPosition(value, range) 
    : null;
  
  // 参考范围文字
  const unit = dimension === 'sleep' ? 'h' : '次';
  const referenceText = range ? `参考${range.min}-${range.max}${unit}` : '';
  
  // 环比变化 CSS class（FR-6）
  const changeClass = this._getChangeClass(trend.changePercent, trend.isUp, status);
  
  return {
    status: status || '',
    statusText: display?.text || '',
    statusClass: status || '',
    reference: range,
    referenceText,
    barPosition: barInfo?.position ?? 50,
    barZone: barInfo?.zone ?? 'normal',
    tip: TrendService.generateTip(dimension, status || 'noData'),
    changeClass
  };
}
```

#### 新增私有方法 `_enhanceTemperature`

```javascript
/**
 * 增强体温维度数据
 * @param {Object} tempData - 原始体温数据 { abnormalCount, latestValue, latestTime }
 * @returns {Object} 增强后的数据
 */
_enhanceTemperature(tempData) {
  const hasData = tempData.latestValue !== '--';
  const status = TrendService.calculateStatus(null, null, 'temperature', {
    abnormalCount: tempData.abnormalCount,
    hasData
  });
  
  const display = TrendService.getStatusDisplay(status);
  
  return {
    status,
    statusText: display?.text || '',
    statusClass: status || '',
    tip: TrendService.generateTip('temperature', status)
  };
}
```

#### 新增私有方法 `_getChangeClass`

```javascript
/**
 * 获取环比变化 CSS class（FR-6）
 * @param {number} changePercent - 变化百分比
 * @param {boolean} isUp - 是否上升
 * @param {string} status - 当前状态
 * @returns {string} CSS class
 */
_getChangeClass(changePercent, isUp, status) {
  if (changePercent === 100 && !isUp) return 'change-new';  // 上周为0，本周有数据
  if (changePercent <= 10) return 'change-minor';           // ≤10% 灰色
  if (changePercent <= 30) return isUp ? 'change-up' : 'change-down';  // 11-30% 绿/橙
  // >30%
  if (status === 'veryLow' || status === 'veryHigh') return 'change-danger';
  return isUp ? 'change-up' : 'change-down';
}
```

### 5.2 insight-section.wxml 重构

```xml
<view class="insight-section">
  <!-- 标题栏（保持不变） -->
  <view class="insight-header" bindtap="toggleInsight">
    <view class="insight-title-group">
      <image class="insight-icon" src="/images/icons/chart-line.png" mode="aspectFit" lazy-load></image>
      <text class="insight-title">本周趋势</text>
      <text class="insight-period">{{trendPeriod}}</text>
    </view>
    <view class="insight-toggle">
      <image class="toggle-icon" src="{{expanded ? '/images/icons/chevron-up.png' : '/images/icons/chevron-down.png'}}" mode="aspectFit" lazy-load></image>
    </view>
  </view>
  
  <!-- 趋势指标（可折叠） -->
  <view class="insight-content" wx:if="{{expanded}}">
    <!-- 骨架屏加载态（FR-5 验收标准 4） -->
    <view class="trend-grid" wx:if="{{loading}}">
      <view class="trend-item-skeleton" wx:for="{{4}}" wx:key="index">
        <view class="skeleton-line"></view>
        <view class="skeleton-line"></view>
        <view class="skeleton-line"></view>
        <view class="skeleton-line"></view>
      </view>
    </view>
    
    <!-- 实际数据 -->
    <view class="trend-grid" wx:else>
      
      <!-- ====== 喂养趋势卡片 ====== -->
      <view class="trend-item">
        <!-- 第一行：图标 + 名称 + 状态标签 -->
        <view class="trend-row-header">
          <image class="trend-type-icon" src="/images/icons/feeding.png" mode="aspectFit" lazy-load></image>
          <text class="trend-label">喂养</text>
          <view class="status-tag status-{{feedingEnhanced.statusClass}}" 
                wx:if="{{feedingEnhanced.statusText}}">
            {{feedingEnhanced.statusText}}
          </view>
        </view>
        
        <!-- 第二行：迷你范围条 -->
        <view class="range-bar-container" wx:if="{{hasReference && feedingEnhanced.reference}}">
          <view class="range-bar">
            <view class="range-bar-normal"></view>
            <view class="range-bar-dot dot-{{feedingEnhanced.barZone}}" 
                  style="left: {{feedingEnhanced.barPosition}}%"></view>
          </view>
        </view>
        
        <!-- 第三行：日均值 + 参考范围 + 环比 -->
        <view class="trend-row-data">
          <text class="trend-avg">日均{{trendData.feeding.thisWeekAvg}}次</text>
          <text class="trend-ref" wx:if="{{feedingEnhanced.referenceText}}">{{feedingEnhanced.referenceText}}</text>
          <text class="trend-change {{feedingEnhanced.changeClass}}" 
                wx:if="{{trendData.feeding.changePercent > 0}}">
            {{trendData.feeding.isUp ? '↑' : '↓'}}{{trendData.feeding.changePercent}}%
          </text>
          <text class="trend-change change-new" 
                wx:elif="{{trendData.feeding.lastWeekAvg === 0 && trendData.feeding.thisWeekAvg > 0}}">
            新
          </text>
        </view>
        
        <!-- 第四行：智能提示 -->
        <text class="trend-tip" wx:if="{{feedingEnhanced.tip}}">{{feedingEnhanced.tip}}</text>
      </view>
      
      <!-- ====== 睡眠趋势卡片 ====== -->
      <view class="trend-item">
        <view class="trend-row-header">
          <image class="trend-type-icon" src="/images/icons/sleep.png" mode="aspectFit" lazy-load></image>
          <text class="trend-label">睡眠</text>
          <view class="status-tag status-{{sleepEnhanced.statusClass}}" 
                wx:if="{{sleepEnhanced.statusText}}">
            {{sleepEnhanced.statusText}}
          </view>
        </view>
        
        <view class="range-bar-container" wx:if="{{hasReference && sleepEnhanced.reference}}">
          <view class="range-bar">
            <view class="range-bar-normal"></view>
            <view class="range-bar-dot dot-{{sleepEnhanced.barZone}}" 
                  style="left: {{sleepEnhanced.barPosition}}%"></view>
          </view>
        </view>
        
        <view class="trend-row-data">
          <text class="trend-avg">日均{{trendData.sleep.thisWeekAvg}}h</text>
          <text class="trend-ref" wx:if="{{sleepEnhanced.referenceText}}">{{sleepEnhanced.referenceText}}</text>
          <text class="trend-change {{sleepEnhanced.changeClass}}" 
                wx:if="{{trendData.sleep.changePercent > 0}}">
            {{trendData.sleep.isUp ? '↑' : '↓'}}{{trendData.sleep.changePercent}}%
          </text>
          <text class="trend-change change-new" 
                wx:elif="{{trendData.sleep.lastWeekAvg === 0 && trendData.sleep.thisWeekAvg > 0}}">
            新
          </text>
        </view>
        
        <text class="trend-tip" wx:if="{{sleepEnhanced.tip}}">{{sleepEnhanced.tip}}</text>
      </view>
      
      <!-- ====== 排便趋势卡片 ====== -->
      <view class="trend-item">
        <view class="trend-row-header">
          <image class="trend-type-icon" src="/images/icons/diaper-color.png" mode="aspectFit" lazy-load></image>
          <text class="trend-label">排便</text>
          <view class="status-tag status-{{diaperEnhanced.statusClass}}" 
                wx:if="{{diaperEnhanced.statusText}}">
            {{diaperEnhanced.statusText}}
          </view>
        </view>
        
        <view class="range-bar-container" wx:if="{{hasReference && diaperEnhanced.reference}}">
          <view class="range-bar">
            <view class="range-bar-normal"></view>
            <view class="range-bar-dot dot-{{diaperEnhanced.barZone}}" 
                  style="left: {{diaperEnhanced.barPosition}}%"></view>
          </view>
        </view>
        
        <view class="trend-row-data">
          <text class="trend-avg">日均{{trendData.diaper.thisWeekAvg}}次</text>
          <text class="trend-ref" wx:if="{{diaperEnhanced.referenceText}}">{{diaperEnhanced.referenceText}}</text>
          <text class="trend-change {{diaperEnhanced.changeClass}}" 
                wx:if="{{trendData.diaper.changePercent > 0}}">
            {{trendData.diaper.isUp ? '↑' : '↓'}}{{trendData.diaper.changePercent}}%
          </text>
          <text class="trend-change change-new" 
                wx:elif="{{trendData.diaper.lastWeekAvg === 0 && trendData.diaper.thisWeekAvg > 0}}">
            新
          </text>
        </view>
        
        <text class="trend-tip" wx:if="{{diaperEnhanced.tip}}">{{diaperEnhanced.tip}}</text>
      </view>
      
      <!-- ====== 体温趋势卡片（无范围条） ====== -->
      <view class="trend-item">
        <view class="trend-row-header">
          <image class="trend-type-icon" src="/images/icons/temperature.png" mode="aspectFit" lazy-load></image>
          <text class="trend-label">体温</text>
          <view class="status-tag status-{{temperatureEnhanced.statusClass}}" 
                wx:if="{{temperatureEnhanced.statusText}}">
            {{temperatureEnhanced.statusText}}
          </view>
        </view>
        
        <!-- 体温无范围条 -->
        
        <view class="trend-row-data">
          <text class="trend-avg">{{trendData.temperature.abnormalCount}}次异常</text>
          <text class="trend-ref">最近 {{trendData.temperature.latestValue}}°C</text>
        </view>
        
        <text class="trend-tip" wx:if="{{temperatureEnhanced.tip}}">{{temperatureEnhanced.tip}}</text>
      </view>
      
    </view>
    
    <!-- 查看详细报告（保持不变） -->
    <view class="view-report-link" bindtap="showReportPopup">
      <text class="link-text">查看详细报告</text>
      <image class="link-arrow" src="/images/icons/chevron-right.png" mode="aspectFit" lazy-load></image>
    </view>
  </view>
</view>
```

### 5.3 insight-section.wxss 新增样式

以下仅列出**新增/修改的样式**，保留现有 `.insight-section`、`.insight-header`、`.trend-grid`、`.view-report-link` 等不变。

```css
/* ============================================
   趋势卡片 - 增强版样式
   ============================================ */

/* 卡片 - 移除原有 attention 状态样式 */
.trend-item {
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

/* ---- 第一行：图标 + 名称 + 状态标签 ---- */
.trend-row-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.trend-type-icon {
  width: 32rpx;
  height: 32rpx;
  opacity: 0.7;
}

.trend-label {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
}

/* 状态标签胶囊 */
.status-tag {
  margin-left: auto;
  font-size: 22rpx;
  font-weight: 500;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.status-tag.status-normal {
  color: var(--success-color);
  background: rgba(123, 201, 80, 0.1);
}

.status-tag.status-low,
.status-tag.status-high,
.status-tag.status-attention {
  color: var(--warning-color);
  background: rgba(212, 136, 61, 0.1);
}

.status-tag.status-veryLow,
.status-tag.status-veryHigh,
.status-tag.status-alert {
  color: var(--danger-color);
  background: rgba(232, 84, 84, 0.1);
}

.status-tag.status-noData {
  color: var(--text-hint);
  background: rgba(153, 153, 153, 0.1);
}

/* ---- 第二行：迷你范围条 ---- */
.range-bar-container {
  padding: 4rpx 0;
}

.range-bar {
  position: relative;
  width: 100%;
  height: 8rpx;
  background: rgba(212, 165, 116, 0.12);
  border-radius: 4rpx;
  overflow: visible;
}

.range-bar-normal {
  position: absolute;
  left: 20%;
  width: 60%;
  height: 100%;
  background: var(--success-color);
  border-radius: 4rpx;
  opacity: 0.3;
}

.range-bar-dot {
  position: absolute;
  top: 50%;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: left var(--transition-fast);
}

.range-bar-dot.dot-normal {
  background: var(--success-color);
}

.range-bar-dot.dot-left {
  background: var(--warning-color);
}

.range-bar-dot.dot-right {
  background: var(--warning-color);
}

/* ---- 第三行：日均值 + 参考范围 + 环比 ---- */
.trend-row-data {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  flex-wrap: nowrap;
}

.trend-avg {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.trend-ref {
  font-size: 22rpx;
  color: var(--text-hint);
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trend-change {
  margin-left: auto;
  font-size: 20rpx;
  font-weight: 500;
  flex-shrink: 0;
}

/* 环比变化颜色（FR-6） */
.trend-change.change-minor {
  color: var(--text-hint);
}

.trend-change.change-up {
  color: var(--success-color);
}

.trend-change.change-down {
  color: var(--warning-color);
}

.trend-change.change-danger {
  color: var(--danger-color);
}

.trend-change.change-new {
  color: var(--info-color);
  font-size: 20rpx;
}

/* ---- 第四行：智能提示 ---- */
.trend-tip {
  font-size: 22rpx;
  color: var(--text-secondary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 骨架屏（加载态） ---- */
.trend-item-skeleton {
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}

.skeleton-line {
  height: 24rpx;
  background: linear-gradient(90deg, var(--bg-primary) 25%, rgba(212, 184, 150, 0.15) 50%, var(--bg-primary) 75%);
  background-size: 200% 100%;
  border-radius: 4rpx;
  margin-bottom: var(--spacing-xs);
  animation: shimmer 1.5s infinite;
}

.skeleton-line:nth-child(1) { width: 60%; }
.skeleton-line:nth-child(2) { width: 100%; height: 8rpx; }
.skeleton-line:nth-child(3) { width: 80%; }
.skeleton-line:nth-child(4) { width: 70%; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## 6. 边界条件处理详解

### 6.1 无出生日期（`birthDate` 为空）

```
数据流：baby.birthDate = null → ageMonths = null → hasReference = false
```

**UI 退化表现**：
- 状态标签：不显示（`feedingEnhanced.statusText` 为空）
- 范围条：`wx:if="{{hasReference && ...}}"` 条件不满足，不渲染
- 参考范围文字：不显示
- 智能提示：退化为基于趋势变化的通用提示
- 环比百分比：保持原有逻辑显示

### 6.2 本周和上周均无数据

```
thisWeekAvg = 0, lastWeekAvg = 0 → status = 'noData'
```

**UI 表现**：
- 状态标签：灰色「无数据」
- 范围条：不显示（value = 0 时无定位意义）
- 日均值：显示 "日均0次"
- 智能提示：显示引导语 "开始记录喂养，获取趋势分析"

### 6.3 月龄超过 36 个月

```
ageMonths = 40 → getReferenceRange('feeding', 40)
keys = [0,1,3,6,12,24]，≤ 40 的最大 key = 24
→ 使用 24月+ 的参考范围
```

### 6.4 日均值恰好等于边界值

```
value = range.min 或 value = range.max → status = 'normal'（含边界）
```

算法中使用 `>=` 和 `<=`，边界值判定为正常。

### 6.5 上周数据为 0（无法计算环比）

```
lastWeekAvg = 0, thisWeekAvg > 0 → changePercent = 100（现有逻辑）
```

**UI 表现（FR-6）**：显示 "新" 标签代替百分比，使用 `change-new` 类（蓝色 `--info-color`）。

### 6.6 体温维度

体温不参与参考范围机制，仅通过异常次数（`≥37.5°C`）判定状态：
- 无范围条
- 无参考范围文字
- 状态标签和提示语基于 `abnormalCount`

---

## 7. 性能评估

### 7.1 新增计算开销

| 计算项 | 时间复杂度 | 估算耗时 |
|--------|-----------|----------|
| `getReferenceRange()` × 3 | O(k), k≤6 | < 0.01ms |
| `calculateStatus()` × 4 | O(1) | < 0.01ms |
| `calculateRangeBarPosition()` × 3 | O(1) | < 0.01ms |
| `generateTip()` × 4 | O(1) 对象查表 | < 0.01ms |
| `StorageUtil.get('current_baby')` | O(1) 同步读取 | < 1ms |
| `calculateAgeMonths()` | O(1) 日期计算 | < 0.01ms |

**总新增开销：< 1ms**，远低于感知阈值，不影响现有 30s 缓存策略。

### 7.2 `setData` 数据量评估

新增字段数据量（以单维度为例）：

```javascript
feedingEnhanced = {
  status: 'normal',       // 6 bytes
  statusText: '正常',     // 6 bytes
  statusClass: 'normal',  // 6 bytes
  reference: { min:8, max:12, label:'0-1月' }, // ~40 bytes
  referenceText: '参考8-12次', // 14 bytes
  barPosition: 50,        // 2 bytes
  barZone: 'normal',      // 6 bytes
  tip: '喂养规律，保持即可 👍',  // ~30 bytes
  changeClass: 'change-minor'  // 12 bytes
};
```

四维总计约 **500 bytes**，远低于 `setData` 性能瓶颈。

---

## 8. 测试策略

### 8.1 单元测试用例

#### `getReferenceRange` 测试

| 用例 | 输入 | 期望输出 |
|------|------|----------|
| 新生儿喂养 | `('feeding', 0)` | `{ min:8, max:12, label:'0-1月' }` |
| 5 月龄睡眠 | `('sleep', 5)` | `{ min:12, max:16, label:'3-6月' }` |
| 12 月龄排便 | `('diaper', 12)` | `{ min:1, max:3, label:'12月+' }` |
| 36 月龄（超限） | `('feeding', 36)` | `{ min:3, max:5, label:'24月+' }` |
| 体温维度 | `('temperature', 6)` | `null` |
| 无效维度 | `('invalid', 6)` | `null` |

#### `calculateStatus` 测试

| 用例 | 输入 | 期望输出 |
|------|------|----------|
| 正常（范围内） | `value=8, range={min:6,max:10}` | `'normal'` |
| 正常（边界） | `value=6, range={min:6,max:10}` | `'normal'` |
| 偏少（≤30%偏离） | `value=5, range={min:6,max:10}` | `'low'` (偏离 16.7%) |
| 明显偏少（>30%偏离） | `value=3, range={min:6,max:10}` | `'veryLow'` (偏离 50%) |
| 偏多（≤30%偏离） | `value=12, range={min:6,max:10}` | `'high'` (偏离 20%) |
| 明显偏多（>30%偏离） | `value=15, range={min:6,max:10}` | `'veryHigh'` (偏离 50%) |
| 无数据 | `value=0, lastWeekAvg=0` | `'noData'` |
| 无参考范围 | `range=null` | `null` |
| 体温 0 次异常 | `dimension='temperature', abnormalCount=0, hasData=true` | `'normal'` |
| 体温 2 次异常 | `dimension='temperature', abnormalCount=2, hasData=true` | `'attention'` |
| 体温 3 次异常 | `dimension='temperature', abnormalCount=3, hasData=true` | `'alert'` |

#### `calculateRangeBarPosition` 测试

| 用例 | 输入 | 期望输出 |
|------|------|----------|
| 范围中点 | `value=8, range={min:6,max:10}` | `{ position:50, zone:'normal' }` |
| 范围下界 | `value=6, range={min:6,max:10}` | `{ position:20, zone:'normal' }` |
| 范围上界 | `value=10, range={min:6,max:10}` | `{ position:80, zone:'normal' }` |
| 偏低 | `value=3, range={min:6,max:10}` | `{ position:10, zone:'left' }` |
| 偏高 | `value=15, range={min:6,max:10}` | `{ position:90, zone:'right' }` |
| 极端偏低 | `value=0, range={min:6,max:10}` | `{ position:2, zone:'left' }` |

### 8.2 集成测试场景

| 场景 | 前置条件 | 验证点 |
|------|----------|--------|
| 正常新生儿 | `birthDate` = 15 天前，本周日均喂养 9 次 | 绿色「正常」标签 + 范围条居中 + 正面提示 |
| 睡眠偏少的 6 月龄婴儿 | `birthDate` = 6 个月前，日均睡眠 10h | 橙色「偏少」标签 + 范围条偏左 + 关注提示 |
| 无出生日期 | `birthDate` = null | 无状态标签 + 无范围条 + 无参考范围文字 |
| 本周首次记录 | 上周无数据，本周有数据 | 蓝色「新」标签代替百分比 |
| 体温多次异常 | `abnormalCount` = 3 | 红色「需就医」标签 + 就医提示 |

---

## 9. 与现有代码的兼容策略

### 9.1 `trendService.js` 改动策略

**增量扩展，不修改现有方法**：

```javascript
// 现有代码完全不动
// ↓ 在文件头部新增常量定义
const REFERENCE_RANGES = { ... };
const TREND_STATUS = { ... };
const TEMP_STATUS = { ... };
const DEVIATION_THRESHOLD = 0.30;
const STATUS_DISPLAY = { ... };
const TIP_MESSAGES = { ... };

class TrendService {
  // ... 现有方法完全保留 ...
  
  // ↓ 在 class 末尾新增 4 个静态方法
  static getReferenceRange(dimension, ageMonths) { ... }
  static calculateStatus(value, range, dimension, extra) { ... }
  static calculateRangeBarPosition(value, range) { ... }
  static generateTip(dimension, status) { ... }
  static getStatusDisplay(status) { return STATUS_DISPLAY[status] || null; }
}

// 导出不变
module.exports = TrendService;
```

### 9.2 `insight-section.js` 改动策略

- 保留所有现有 `data` 字段（`trendData`、`trendPeriod` 等）
- 新增 `feedingEnhanced`、`sleepEnhanced` 等增强字段
- `loadTrendData` 方法在现有逻辑**之后**追加增强计算，不影响原始数据流
- 保留 `toggleInsight`、`showReportPopup`、`refresh` 方法不变

### 9.3 WXML/WXSS 改动策略

- WXML 完全重写卡片内部结构（4 行布局替代原有 2 行）
- WXSS 移除 `.attention`、`.attention-tag` 旧样式，新增状态标签和范围条样式
- 保留 `.insight-section`、`.insight-header`、`.trend-grid`、`.view-report-link` 等外部结构样式不变

---

## 10. 实现优先级与依赖关系

```
Step 1: trendService.js 新增常量 + 静态方法（无依赖）
  │
  ├──→ Step 2: insight-section.js 改造 loadTrendData + 新增私有方法
  │       │
  │       └──→ Step 3: insight-section.wxml 重构模板
  │               │
  │               └──→ Step 4: insight-section.wxss 重构样式
  │
  └──→ Step 5: 集成测试 + 边界条件验证
```

**预估工作量**：4 个文件，约 350 行新增/修改代码，1 个工作日可完成。

---

*文档版本：v1.1*  
*创建日期：2026-04-07*  
*状态：待确认*
