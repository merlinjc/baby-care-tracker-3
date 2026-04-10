# 设计文档 - 宝宝成长记录小程序全面重构

## 概述

基于需求文档中识别的 35 个 Bug、10 个功能需求和 3 个性能优化需求，本设计文档制定具体的技术实现方案。重构在保留现有美拉德色彩风格和图标体系的前提下进行，采用渐进式重构策略，确保每一步都可独立验证。

---

## 一、架构设计

### 1.1 当前架构问题

```
当前问题：
├── 工具函数重复 → formatDate 在 6 个页面重复定义
├── 配置数据分散 → 疫苗计划/里程碑定义内嵌在页面 JS 中
├── 生命周期不规范 → onLoad+onShow 双重调用导致重复请求
├── 弹窗样式重复 → popup-mask/popup-header 等在 5+ 页面重复定义
├── 状态组件重复 → loading/empty/error 状态在每个页面独立实现
├── 空目录未利用 → config/ 和 styles/ 为空
└── 服务层 API 不一致 → StorageUtil.save vs StorageUtil.set
```

### 1.2 目标架构

```
miniprogram/
├── app.js / app.json / app.wxss          # 全局入口（保持现有设计系统不变）
├── config/                                # 【新增】配置常量
│   ├── vaccine-plans.js                   # 疫苗接种计划数据
│   ├── milestone-defs.js                  # 里程碑定义数据
│   └── who-standards.js                   # WHO生长标准数据
├── styles/                                # 【新增】公共样式
│   ├── popup.wxss                         # 统一弹窗样式
│   ├── loading.wxss                       # 统一加载/空/错误状态样式
│   ├── form.wxss                          # 统一表单样式
│   └── page-header.wxss                   # 统一页面头部样式
├── utils/
│   ├── date.js                            # 【新增】统一日期/月龄工具
│   ├── storage.js                         # 修复 save→set 别名
│   ├── icon-config.js                     # 保持不变
│   ├── network.js                         # 保持不变
│   └── deduplication.js                   # 保持不变
├── models/                                # 保持不变
├── services/                              # 修复已知 Bug
├── components/                            # 保持不变 + 增强
├── pages/                                 # 修复 Bug + 统一生命周期
└── images/                                # 保持不变
```

### 1.3 技术方案选型

| 改动项 | 方案 | 理由 |
|-------|------|------|
| 工具函数提取 | 新建 `utils/date.js` | 消除 6 处重复，统一逻辑 |
| 配置数据抽离 | 新建 `config/` 下的 JS 模块 | 从页面 JS 中抽离 600+ 行配置数据 |
| 公共样式 | 新建 `styles/` 下的 WXSS 文件，页面通过 `@import` 引用 | 消除 5+ 页面的弹窗/加载样式重复 |
| 生命周期规范 | 统一采用 `_initialized` 标志位 + 节流缓存 | 最小改动，兼容现有逻辑 |
| StorageUtil 兼容 | 添加 `save` 别名指向 `set` | 不改现有调用方，向后兼容 |

---

## 二、详细设计

### 2.1 新增 `utils/date.js` — 统一日期工具

```javascript
/**
 * 统一日期/月龄工具函数
 * 替代 6 个页面中重复的 formatDate / calculateAgeMonths / formatAge
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string|Object} date - 支持 Date/string/云数据库格式
 * @returns {string}
 */
function formatDate(date) {
  const d = parseDate(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 安全解析日期（兼容云数据库多种格式）
 */
function parseDate(date) {
  if (!date) return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === 'object' && date.$date) return new Date(date.$date);
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 计算月龄
 * @param {Date|string} birthDate
 * @param {number} [maxMonths] - 可选上限
 * @returns {number}
 */
function calculateAgeMonths(birthDate, maxMonths) {
  const birth = parseDate(birthDate);
  if (!birth) return 0;
  const today = new Date();
  const months = (today.getFullYear() - birth.getFullYear()) * 12 +
                 (today.getMonth() - birth.getMonth());
  const result = Math.max(0, months);
  return maxMonths ? Math.min(maxMonths, result) : result;
}

/**
 * 格式化年龄显示
 */
function formatAge(birthDate) {
  const months = calculateAgeMonths(birthDate);
  if (months < 1) {
    const days = calculateAgeInDays(birthDate);
    return `${days}天`;
  } else if (months < 12) {
    return `${months}个月`;
  } else {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}岁${rem}个月` : `${years}岁`;
  }
}

module.exports = { formatDate, parseDate, calculateAgeMonths, formatAge, calculateAgeInDays };
```

### 2.2 修复 `utils/storage.js` — 添加方法别名

```javascript
// 在现有 StorageUtil 类末尾添加：
static save(key, data) {
  return this.set(key, data);  // 别名，兼容 settings.js 等调用
}
```

### 2.3 新增 `styles/popup.wxss` — 统一弹窗样式

提取 5 个页面中重复的弹窗遮罩、头部、内容、底部样式，页面通过 `@import '/styles/popup.wxss';` 引用。

包含样式类：`.popup-mask`, `.popup-container`, `.popup-header`, `.popup-title`, `.popup-close`, `.popup-content`, `.popup-footer`, `.btn-action.primary`, `.btn-action.secondary`, `.btn-action.danger`

### 2.4 新增 `styles/loading.wxss` — 统一状态样式

提取 6 个页面中重复的加载/空/错误状态样式。

包含样式类：`.loading-container`, `.loading-spinner`, `.loading-text`, `.empty-state`, `.empty-icon`, `.empty-text`, `.empty-hint`

### 2.5 新增 `styles/form.wxss` — 统一表单样式

提取 `baby-create`, `family-create`, `family-join` 三个页面中重复的表单样式。

包含样式类：`.form-section`, `.form-item`, `.form-label`, `.form-input`, `.input-placeholder`, `.page-header`, `.header-icon`, `.header-title`, `.header-subtitle`, `.tip-section`

### 2.6 配置数据抽离到 `config/`

#### `config/vaccine-plans.js`
从 `vaccine.js`（400行）和 `discover.js`（80行）中抽离疫苗接种计划数据。

#### `config/milestone-defs.js`
从 `milestone.js`（270行）和 `discover.js`（40行）中抽离里程碑定义数据。

#### `config/who-standards.js`
从 `growth.js`（130行）中抽离 WHO 生长标准数据（体重/身高/头围，男/女各4组）。

---

## 三、Bug 修复方案

### 3.1 P0 致命级修复（5项）

#### BUG-1: `settings.js` StorageUtil.save 不存在
```
文件: utils/storage.js
方案: 添加 static save(key, data) { return this.set(key, data); }
影响范围: settings.js 第41行
```

#### BUG-2: `family-join.js` / `family-create.js` 空指针
```
文件: pages/family-join/family-join.js 第39行
      pages/family-create/family-create.js 第39行
方案: 在访问 userInfo._id 前添加:
      if (!userInfo || !userInfo._id) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
```

#### BUG-3: `export.js` limit(1000) 实际最多20条
```
文件: pages/export/export.js 第113-121行
方案: 实现分页循环获取:
      async getAllRecords(query) {
        let all = [], batch;
        do {
          batch = await query.skip(all.length).limit(20).get();
          all = all.concat(batch.data);
        } while (batch.data.length === 20);
        return all;
      }
```

#### BUG-4: `record.js` editRecord 字段名错误
```
文件: pages/record/record.js 第562行
方案: const type = selectedRecord.recordType || selectedRecord.type;
```

#### BUG-5: `settings.js` 批量删除最多20条
```
文件: pages/settings/settings.js 第124-139行
方案: 使用循环删除 + 并行优化:
      async deleteAllByQuery(collection, where) {
        let hasMore = true;
        while (hasMore) {
          const res = await db.collection(collection).where(where).limit(20).get();
          if (res.data.length === 0) { hasMore = false; break; }
          await Promise.all(res.data.map(r => 
            db.collection(collection).doc(r._id).remove()
          ));
        }
      }
```

### 3.2 P1 严重级修复（10项）

| Bug | 文件 | 修复方案 |
|-----|------|---------|
| BUG-6 | auth.js:158 | 添加 `if (!userInfo \|\| !userInfo.familyId) return;` |
| BUG-7 | export.js:107 | 添加 `if (!baby) { wx.hideLoading(); return; }` |
| BUG-8 | export.js:204 | 实现 `escapeCsv()` 函数处理逗号/换行/双引号 |
| BUG-9 | export.js:248 | 改为 `const data = record.data \|\| {};` |
| BUG-10 | ai-assistant.js:163 | 改为 `r.data && r.data.duration` |
| BUG-11 | home.js:251 | 添加 `if (!this.data.currentBaby) return;` |
| BUG-12 | settings.js:67 | 清缓存前保存核心信息，清后恢复 |
| BUG-13 | baby-list.js:130 | 删除后检查清理 `current_baby` |
| BUG-14 | family.js:219 | 调用 `FamilyService.leaveFamily()` 后再清本地 |
| BUG-15 | record.js:549 | 改为弹窗展示详情，移除不存在页面跳转 |

### 3.3 P2 中等级修复（15项）

| Bug | 文件 | 修复方案 |
|-----|------|---------|
| BUG-16 | profile.js:100 | 改为弹窗编辑或创建 edit-profile 页面 |
| BUG-17 | growth.js:654 | 返回 `parseFloat(...)` 而非字符串 |
| BUG-18 | growth.js:221 | 改为 `if (ageMonths > 24) return null;` |
| BUG-19 | auth.js:453 | 添加 `else { setData({ joiningFamily: false }); }` |
| BUG-20 | record.js:343 | 基于全量未筛选数据计算各类别数 |
| BUG-21 | baby-detail.js:17 | 无 id 时 showToast + navigateBack |
| BUG-22 | discover.js:75 | redirect 前 showToast 提示 |
| BUG-23 | record.js:498 | 改用 FilterService 精确匹配 |
| BUG-24 | growth.js:152 | 清理未使用的 data 字段 |
| BUG-25~29 | 多页面 | 统一使用 `_initialized` 标志位 |
| BUG-30 | settings.js:124 | 改为 Promise.all 并行删除 |

### 3.4 settings.wxml Switch 组件 color 属性问题
```
文件: pages/settings/settings.wxml 第11/26/36/46/56/71行
问题: color="{{var(--primary-color, '#D4B896')}}" — var() 是 CSS 函数，
      不能用在 WXML 属性的 {{}} 插值表达式中
方案: 改为直接使用颜色值 color="#D4B896"
```

---

## 四、UI 统一方案

### 4.1 样式一致性审查结果

**硬编码颜色值统计：**

| 页面 | 硬编码颜色数 | 说明 |
|------|------------|------|
| home.wxss | 6处 | 快捷按钮渐变色（功能色，可接受） |
| record.wxss | 8处 | #6B6056, #EDE8E0 等灰棕色 |
| discover.wxss | 3处 | WHO/CDC/CN 参考标准图标背景色 |
| growth.wxss | 16处 | 最多，含数据卡片/百分位/图表颜色 |
| profile.wxss | 2处 | #6B8B6B, #D48B8B |
| vaccine.wxss | 2处 | #D4A574 |
| auth.wxss | 1处 | #B8D4B8 装饰圆 |
| milestone.wxss | 0处 | 全部使用 CSS 变量（最佳实践） |

**结论**: `milestone.wxss` 是样式一致性的标杆。大部分硬编码颜色属于美拉德色系内的语义扩展色（如 #6B6056 深灰棕、#B8966B 暖棕等），非破坏性。建议在 `app.wxss` 中补充这些语义扩展变量。

### 4.2 补充 CSS 变量

在 `app.wxss` 的 `page {}` 选择器中补充：

```css
/* 扩展语义色 */
--text-warm-brown: #6B6056;       /* 暖灰棕文字 */
--accent-warm: #D4A574;           /* 暖杏强调色 */
--bg-hover: #EDE8E0;              /* 悬停/按压背景 */
--border-warm: #E8E0D5;           /* 暖色分割线 */
--percentile-normal-bg: rgba(184, 212, 184, 0.2);
--percentile-normal-text: #6B9B6B;
--percentile-abnormal-bg: rgba(232, 160, 160, 0.2);
--percentile-abnormal-text: #C87878;
```

### 4.3 重复样式提取清单

| 样式模式 | 重复出现页面 | 提取目标 |
|---------|------------|---------|
| `.popup-mask` + `.popup-header` + `.popup-close` | record, growth, vaccine, milestone, discover | `styles/popup.wxss` |
| `.loading-container` + `.loading-spinner` | home, record, growth, vaccine, milestone, auth | `styles/loading.wxss` |
| `.empty-state` + `.empty-text` | home, record, vaccine, baby-list, family | `styles/loading.wxss` |
| `.page-header` + `.header-icon` + `.header-title` | baby-create, family-create, family-join, discover | `styles/form.wxss` |
| `.form-section` + `.form-item` + `.form-label` + `.form-input` | baby-create, family-create, family-join, growth | `styles/form.wxss` |

### 4.4 缺失状态处理

以下页面缺少加载/空/错误状态：

| 页面 | 缺失状态 | 修复方案 |
|------|---------|---------|
| profile | 加载/错误 | 添加 loading 和 error-state |
| discover | 加载/错误 | 添加 loading spinner |
| settings | 全部缺失 | 添加 loading 状态 |
| export | 空/错误 | 添加无记录提示 |
| baby-detail | 加载/错误 | 添加 loading 和参数缺失提示 |
| ai-assistant | 空/错误 | 添加无宝宝信息提示 |
| baby-create | 错误 | 添加 error-state |
| family-create | 错误 | 添加 error-state |
| family-join | 错误 | 添加 error-state |

### 4.5 record.json 声明但未使用的组件

```json
// record.json 中声明了 export-popup 但 record.wxml 中未使用
"export-popup": "/components/export-popup/export-popup"
```
方案：移除未使用的组件声明，减少包体积。

---

## 五、交互逻辑优化方案

### 5.1 页面生命周期统一模式

```javascript
// 统一模式：所有页面采用此模式
Page({
  _initialized: false,
  _lastLoadTime: 0,
  
  onLoad(options) {
    this._initialized = false;
    this.init(options);           // 一次性初始化
    this._initialized = true;
  },
  
  onShow() {
    if (!this._initialized) return;
    
    // Tab 页面节流：30秒内不重复请求
    const now = Date.now();
    if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
    this._lastLoadTime = now;
    
    this.refreshData();           // 增量刷新
  }
});
```

**涉及页面**：ai-assistant, milestone, vaccine, baby-list, family, discover

### 5.2 数据导出流程优化

```
当前流程: 查询 → limit(1000) → 实际20条 → 导出
优化流程: 查询总数 → 循环分页(每页20条) → 合并 → CSV转义 → 写文件 → 分享
```

### 5.3 记录编辑/查看详情优化

```
当前流程: 点击记录 → 操作菜单 → "查看详情" → 跳转不存在页面(失败)
                                → "编辑" → type字段错误(失败)
优化流程: 点击记录 → 操作菜单 → "查看详情" → 弹窗展示详情
                                → "编辑" → 正确打开对应类型弹窗
```

### 5.4 搜索功能优化

```
当前: getRecords(无limit) → JSON.stringify过滤 → 最多20条结果
优化: 使用 FilterService.filterByKeyword() → 精确匹配 note/recordType/creatorName
```

---

## 六、性能优化方案

### 6.1 Tab 页面数据缓存

```javascript
// Tab 页面（home/record/discover/profile）增加节流
const CACHE_DURATION = 30000; // 30秒

onShow() {
  const now = Date.now();
  if (this._lastLoadTime && now - this._lastLoadTime < CACHE_DURATION) {
    return; // 跳过重复加载
  }
  this._lastLoadTime = now;
  this.loadData();
}
```

### 6.2 批量删除并行化

```javascript
// settings.js clearAllCloudData
async deleteAllByQuery(collection, whereCondition) {
  const db = wx.cloud.database();
  let deleted = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await db.collection(collection).where(whereCondition).limit(20).get();
    if (res.data.length === 0) break;
    await Promise.all(res.data.map(r => db.collection(collection).doc(r._id).remove()));
    deleted += res.data.length;
    // 更新进度
    wx.showLoading({ title: `已删除 ${deleted} 条...` });
  }
  return deleted;
}
```

### 6.3 record.js 筛选计数优化

```javascript
// 首次加载"全部"数据时缓存各类别总数
async loadData(refresh) {
  // ...获取记录后
  if (refresh && !recordType) {
    // 当筛选为"全部"时，缓存各类别数
    this._allFilterCounts = this.calculateFilterCounts(records);
  }
}

calculateFilterCounts() {
  // 使用缓存的全量计数，不基于当前筛选结果
  return this._allFilterCounts || [0,0,0,0,0,0];
}
```

---

## 七、安全考虑

- 所有数据库查询依赖云开发安全规则，不存在 SQL 注入风险
- CSV 导出需对用户输入的 note 字段做转义处理，防止 CSV 注入
- 邀请码使用大写字母+数字（排除易混淆字符 I/O/1/0），6位长度，7天有效期
- 清除缓存操作有二次确认弹窗

---

## 八、测试策略

### 核心测试场景

| 场景 | 验证点 |
|------|--------|
| P0 Bug 修复 | settings 保存开关后刷新仍有效；family-join 未登录不崩溃；export 导出全量数据；record 编辑功能正常 |
| 生命周期优化 | Tab 切换不重复请求；首次 onLoad+onShow 只执行一次初始化 |
| 数据导出 | 超过20条记录能完整导出；CSV 含逗号的 note 字段格式正确 |
| 家庭退出 | 退出后数据库成员列表已更新；本地缓存已清理 |
| 清除数据 | 超过20条记录全部删除；清缓存后其他页面不崩溃 |

---

## 九、实施顺序

```
Phase 1: 基础设施（不改页面行为）
  ├── 创建 utils/date.js
  ├── 修复 utils/storage.js（添加 save 别名）
  ├── 创建 config/ 目录及配置文件
  └── 创建 styles/ 目录及公共样式

Phase 2: P0 Bug 修复（5项致命级）
  ├── BUG-1: settings.js StorageUtil.save
  ├── BUG-2: family-join/create 空指针
  ├── BUG-3: export.js 分页导出
  ├── BUG-4: record.js recordType 字段名
  └── BUG-5: settings.js 循环删除

Phase 3: P1 Bug 修复（10项严重级）
  └── BUG-6 ~ BUG-15

Phase 4: UI 统一 + 生命周期规范
  ├── 各页面引入公共样式
  ├── 补充 CSS 变量
  ├── 统一生命周期模式
  └── 补充缺失状态

Phase 5: P2 Bug 修复 + 功能优化
  ├── BUG-16 ~ BUG-30
  ├── 搜索功能优化
  ├── 记录详情弹窗化
  └── 家庭退出完善

Phase 6: 性能优化 + 代码清理
  ├── Tab 页面节流缓存
  ├── 批量删除并行化
  ├── 清理未使用代码/变量/组件声明
  └── 消除配置数据内嵌
```

---

*本设计文档基于对 307 个文件的全量审查结果，覆盖 35 个 Bug 修复方案、架构重构方案、UI 统一方案和性能优化方案。*
