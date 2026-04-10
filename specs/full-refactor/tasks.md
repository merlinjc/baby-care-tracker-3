# 实施计划 - 宝宝成长记录小程序全面重构

## 实施概览

- **总任务数**：6个阶段，48项子任务
- **策略**：渐进式重构，每阶段可独立验证
- **原则**：先基础设施（不改页面行为）→ 按优先级修Bug → UI统一 → 功能优化 → 性能优化

---

## Phase 1: 基础设施搭建（不改页面行为）

> 目标：创建公共模块，为后续阶段做准备。本阶段不修改任何现有页面的行为。

- [ ] 1.1 创建 `utils/date.js` — 统一日期/月龄工具
  - 实现 `parseDate(date)` — 安全解析日期，兼容 Date/string/云数据库 `{$date}` 格式
  - 实现 `formatDate(date)` — 格式化为 YYYY-MM-DD
  - 实现 `calculateAgeMonths(birthDate, maxMonths?)` — 计算月龄，可选上限
  - 实现 `calculateAgeInDays(birthDate)` — 计算天龄
  - 实现 `formatAge(birthDate)` — 格式化年龄显示（X天/X个月/X岁X个月）
  - 导出所有函数：`module.exports = { formatDate, parseDate, calculateAgeMonths, formatAge, calculateAgeInDays }`
  - _需求：FR-1, BUG-34_

- [ ] 1.2 修复 `utils/storage.js` — 添加 `save` 别名
  - 在 StorageUtil 类中添加 `static save(key, data) { return this.set(key, data); }`
  - 确保向后兼容，不改变现有 `set` 方法行为
  - _需求：BUG-1_

- [ ] 1.3 创建 `config/vaccine-plans.js` — 疫苗接种计划配置
  - 从 `vaccine.js`（~400行）提取疫苗接种计划数据
  - 从 `discover.js`（~80行）提取疫苗相关配置
  - 导出为 `module.exports = { VACCINE_PLANS, VACCINE_CATEGORIES }`
  - _需求：FR-1, BUG-31, NFR-3_

- [ ] 1.4 创建 `config/milestone-defs.js` — 里程碑定义配置
  - 从 `milestone.js`（~270行）提取里程碑定义数据
  - 从 `discover.js`（~40行）提取里程碑相关配置
  - 导出为 `module.exports = { MILESTONE_DEFINITIONS, MILESTONE_CATEGORIES }`
  - _需求：FR-1, BUG-31, NFR-3_

- [ ] 1.5 创建 `config/who-standards.js` — WHO生长标准配置
  - 从 `growth.js`（~130行）提取 WHO 生长标准数据
  - 包含：体重/身高/头围，男/女各4组百分位数据
  - 导出为 `module.exports = { WHO_WEIGHT, WHO_HEIGHT, WHO_HEAD }`
  - _需求：FR-1, BUG-31, NFR-3_

- [ ] 1.6 创建 `styles/popup.wxss` — 统一弹窗样式
  - 从 record/growth/vaccine/milestone/discover 5个页面提取公共弹窗样式
  - 包含：`.popup-mask`, `.popup-container`, `.popup-header`, `.popup-title`, `.popup-close`, `.popup-content`, `.popup-footer`, `.btn-action.primary/.secondary/.danger`
  - _需求：FR-4_

- [ ] 1.7 创建 `styles/loading.wxss` — 统一加载/空/错误状态样式
  - 从 home/record/growth/vaccine/milestone/auth 6个页面提取公共状态样式
  - 包含：`.loading-container`, `.loading-spinner`, `.loading-text`, `.empty-state`, `.empty-icon`, `.empty-text`, `.empty-hint`
  - _需求：FR-3, FR-4_

- [ ] 1.8 创建 `styles/form.wxss` — 统一表单样式
  - 从 baby-create/family-create/family-join 3个页面提取公共表单样式
  - 包含：`.form-section`, `.form-item`, `.form-label`, `.form-input`, `.input-placeholder`, `.page-header`, `.header-icon`, `.header-title`, `.header-subtitle`, `.tip-section`
  - _需求：FR-4_

- [ ] 1.9 创建 `styles/page-header.wxss` — 统一页面头部样式
  - 从 baby-create/family-create/family-join/discover 4个页面提取公共头部样式
  - _需求：FR-4（design.md 1.2 目标架构中列出）_

---

## Phase 2: P0 致命级 Bug 修复（5项）

> 目标：修复5个致命级Bug，确保核心功能可用。

- [ ] 2.1 BUG-1: `settings.js` StorageUtil.save 不存在
  - 文件：`pages/settings/settings.js` 第41行
  - Phase 1 已在 storage.js 添加 save 别名，此处验证修复生效
  - 验证：设置页面切换开关后离开再返回，设置仍保持
  - _需求：BUG-1_

- [ ] 2.2 BUG-2: `family-join.js` / `family-create.js` userInfo 空指针
  - 文件：`pages/family-join/family-join.js` 第39行 + `pages/family-create/family-create.js` 第39行
  - 方案：在访问 `userInfo._id` 前添加防御性检查：`if (!userInfo || !userInfo._id) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }`
  - _需求：BUG-2_

- [ ] 2.3 BUG-3: `export.js` 数据导出 limit(1000) 实际最多20条
  - 文件：`pages/export/export.js` 第113-121行
  - 方案：实现分页循环获取全量数据：`do { batch = await query.skip(all.length).limit(20).get(); } while (batch.data.length === 20);`
  - 验证：超过20条记录时能完整导出
  - _需求：BUG-3, FR-5_

- [ ] 2.4 BUG-4: `record.js` editRecord 字段名错误
  - 文件：`pages/record/record.js` 第562行
  - 方案：`const type = selectedRecord.recordType || selectedRecord.type;`
  - 验证：点击编辑能正确打开对应类型弹窗
  - _需求：BUG-4, FR-6_

- [ ] 2.5 BUG-5: `settings.js` 批量删除最多删除20条
  - 文件：`pages/settings/settings.js` 第124-139行
  - 方案：循环分页删除 + Promise.all 并行 + 进度提示
  - 验证：超过20条记录时全部删除干净
  - _需求：BUG-5, FR-8_

---

## Phase 3: P1 严重级 Bug 修复（10项）

> 目标：修复10个严重级Bug，消除崩溃和功能异常。

- [ ] 3.1 BUG-6: `auth.js` loadCurrentBaby 未检查 userInfo.familyId
  - 文件：`pages/auth/auth.js` 第158-163行
  - 方案：添加 `if (!userInfo || !userInfo.familyId) return;`
  - _需求：BUG-6_

- [ ] 3.2 BUG-7: `export.js` doExport 中 baby 可能为 null
  - 文件：`pages/export/export.js` 第107-115行
  - 方案：添加 `if (!baby) { wx.hideLoading(); wx.showToast({ title: '请先选择宝宝', icon: 'none' }); return; }`
  - _需求：BUG-7_

- [ ] 3.3 BUG-8: `export.js` CSV 导出未转义特殊字符
  - 文件：`pages/export/export.js` 第204-212行
  - 方案：实现 `escapeCsv(value)` 函数 — 含逗号/换行/双引号时用双引号包裹，内部双引号转义为两个双引号
  - _需求：BUG-8, FR-5_

- [ ] 3.4 BUG-9: `export.js` getRecordDetail 中 data 可能为 undefined
  - 文件：`pages/export/export.js` 第248-264行
  - 方案：改为 `const data = record.data || {};`
  - _需求：BUG-9_

- [ ] 3.5 BUG-10: `ai-assistant.js` calculateDailyStats 空指针
  - 文件：`pages/ai-assistant/ai-assistant.js` 第163行
  - 方案：改为 `r.data && r.data.duration`
  - _需求：BUG-10_

- [ ] 3.6 BUG-11: `home.js` goToBabyDetail 中 currentBaby 可能为 null
  - 文件：`pages/home/home.js` 第251-253行
  - 方案：添加 `if (!this.data.currentBaby) return;`
  - _需求：BUG-11_

- [ ] 3.7 BUG-12: `settings.js` 清除缓存后应用状态不一致
  - 文件：`pages/settings/settings.js` 第67-68行
  - 方案：清缓存前保存核心用户/家庭/宝宝信息，clearStorageSync 后恢复
  - _需求：BUG-12, FR-8_

- [ ] 3.8 BUG-13: `baby-list.js` 删除当前宝宝后未清理本地存储
  - 文件：`pages/baby-list/baby-list.js` 第122-143行
  - 方案：删除成功后检查是否为 current_baby，是则清理并切换到列表第一个宝宝
  - _需求：BUG-13_

- [ ] 3.9 BUG-14: `family.js` leaveFamily 只清本地未更新数据库
  - 文件：`pages/family/family.js` 第211-228行
  - 方案：先调用 `FamilyService.leaveFamily()` 更新数据库成员列表，成功后再清除本地存储
  - _需求：BUG-14, FR-9_

- [ ] 3.10 BUG-15: `record.js` viewRecordDetail 跳转不存在的页面
  - 文件：`pages/record/record.js` 第549-552行
  - 方案：改为弹窗展示记录详情，移除不存在的 record-detail 页面跳转
  - _需求：BUG-15, FR-6_

---

## Phase 4: UI 统一 + 生命周期规范化

> 目标：引入公共样式、补充CSS变量、统一生命周期模式、补充缺失状态、修复 Switch color 属性。

- [ ] 4.1 补充 `app.wxss` CSS 语义扩展变量
  - 在 `page {}` 选择器中补充：`--text-warm-brown`, `--accent-warm`, `--bg-hover`, `--border-warm`, `--percentile-normal-bg/text`, `--percentile-abnormal-bg/text`
  - _需求：FR-4, design.md 4.2_

- [ ] 4.2 各页面引入公共样式（@import）
  - 弹窗页面（record/growth/vaccine/milestone/discover）引入 `styles/popup.wxss`，移除页面内重复弹窗样式
  - 状态页面（home/record/growth/vaccine/milestone/auth）引入 `styles/loading.wxss`，移除重复状态样式
  - 表单页面（baby-create/family-create/family-join）引入 `styles/form.wxss`，移除重复表单样式
  - _需求：FR-4_

- [ ] 4.3 统一生命周期模式（_initialized + 节流）
  - 涉及页面：ai-assistant, milestone, vaccine, baby-list, family, discover
  - 模式：onLoad 设 `_initialized=true`，onShow 检查 `_initialized` + 30秒节流
  - _需求：FR-2, BUG-25~29_

- [ ] 4.4 补充缺失的加载/空/错误状态
  - profile：添加 loading 和 error-state
  - discover：添加 loading spinner
  - settings：添加 loading 状态
  - export：添加无记录提示
  - baby-detail：添加 loading 和参数缺失提示
  - ai-assistant：添加无宝宝信息提示
  - baby-create/family-create/family-join：添加 error-state
  - _需求：FR-3, design.md 4.4_

- [ ] 4.5 修复 `settings.wxml` Switch 组件 color 属性
  - 文件：`pages/settings/settings.wxml` 第11/26/36/46/56/71行
  - 问题：`color="{{var(--primary-color, '#D4B896')}}"` — var() 是 CSS 函数，不能用在 WXML `{{}}` 中
  - 方案：改为 `color="#D4B896"`
  - _需求：design.md 3.4_

---

## Phase 5: P2 中等级 Bug 修复 + 功能优化

> 目标：修复15个中等级Bug，实现搜索优化、记录详情弹窗、家庭退出完善、个人资料编辑。

- [ ] 5.1 BUG-16: `profile.js` editProfile 跳转不存在页面
  - 文件：`pages/profile/profile.js` 第100-103行
  - 方案：改为弹窗编辑（复用现有popup模式），支持修改昵称、头像、身份关系
  - _需求：BUG-16, FR-10_

- [ ] 5.2 BUG-17: `growth.js` calculateBMI 返回字符串而非数字
  - 文件：`pages/growth/growth.js` 第654行
  - 方案：`return parseFloat(bmi.toFixed(1));`
  - _需求：BUG-17_

- [ ] 5.3 BUG-18: `growth.js` WHO 参考数据范围限制在12月龄
  - 文件：`pages/growth/growth.js` 第221行
  - 方案：改为 `if (ageMonths > 24) return null;`（数据中有15/18/21/24月龄）
  - _需求：BUG-18_

- [ ] 5.4 BUG-19: `auth.js` joinFamily result.success 未定义时处理缺失
  - 文件：`pages/auth/auth.js` 第453-488行
  - 方案：添加 `else { this.setData({ joiningFamily: false }); wx.showToast({ title: '加入失败', icon: 'none' }); }`
  - _需求：BUG-19_

- [ ] 5.5 BUG-20: `record.js` calculateFilterCounts 基于已筛选数据
  - 文件：`pages/record/record.js` 第343-371行
  - 方案：首次加载"全部"时缓存 `_allFilterCounts`，后续筛选时使用缓存值
  - _需求：BUG-20, NFR-1_

- [ ] 5.6 BUG-21: `baby-detail.js` onLoad 缺少 id 参数时无提示
  - 文件：`pages/baby-detail/baby-detail.js` 第17-20行
  - 方案：无 id 时 `wx.showToast({ title: '参数缺失', icon: 'none' })` + `wx.navigateBack()`
  - _需求：BUG-21_

- [ ] 5.7 BUG-22: `discover.js` 无宝宝信息时直接 redirect 无提示
  - 文件：`pages/discover/discover.js` 第75-79行
  - 方案：redirect 前先 `wx.showToast({ title: '请先添加宝宝', icon: 'none' })`
  - _需求：BUG-22_

- [ ] 5.8 BUG-23: `record.js` 搜索功能优化
  - 文件：`pages/record/record.js` 第498-516行
  - 方案：改用 FilterService 精确匹配 note/recordType/creatorName，突破20条限制
  - _需求：BUG-23, FR-7_

- [ ] 5.9 BUG-24: `growth.js` 弹窗残留未使用变量
  - 文件：`pages/growth/growth.js` 第152-153行
  - 方案：清理 `popupTranslateY`、`touchStartY` 等未使用的 data 字段
  - _需求：BUG-24, NFR-3_

---

## Phase 6: P3 低等级 Bug 修复 + 性能优化 + 代码清理

> 目标：修复代码质量问题，完成性能优化，清理冗余代码。

- [ ] 6.1 BUG-32: `trendService.js` 睡眠时长单位错误
  - 文件：`services/trendService.js`
  - 方案：`duration / 60` 改为 `duration / 3600`（秒→小时）
  - _需求：BUG-32_

- [ ] 6.2 BUG-33: `services/record.js` catch 块变量遮蔽
  - 文件：`services/record.js` 第252行
  - 方案：重命名 catch 块内的 `userInfo` 为 `cachedUserInfo` 或移除重复获取
  - _需求：BUG-33_

- [ ] 6.3 BUG-34: 各页面 formatDate 替换为 utils/date.js
  - 涉及：discover.js, family.js, growth.js, milestone.js, vaccine.js, export.js
  - 方案：`const { formatDate } = require('../../utils/date');` 替换页面内定义
  - _需求：BUG-34, FR-1_

- [ ] 6.4 BUG-35 + NFR-1: Tab 页面30秒节流缓存
  - 涉及：home/record/discover/profile 4个 Tab 页面
  - 方案：`onShow` 中检查 `_lastLoadTime`，30秒内不重复请求
  - _需求：BUG-35, NFR-1_

- [ ] 6.5 配置数据内嵌消除
  - vaccine.js：引用 `config/vaccine-plans.js`，删除内嵌的 ~400 行数据
  - milestone.js：引用 `config/milestone-defs.js`，删除内嵌的 ~270 行数据
  - growth.js：引用 `config/who-standards.js`，删除内嵌的 ~130 行数据
  - discover.js：引用 config/ 下的配置，删除内嵌的 ~120 行数据
  - _需求：FR-1, NFR-3_

- [ ] 6.6 清理 `record.json` 未使用组件声明
  - 移除 `"export-popup": "/components/export-popup/export-popup"` 声明
  - _需求：NFR-3, design.md 4.5_

- [ ] 6.7 最终代码清理
  - 清理各页面未使用的变量和函数
  - 确保所有 async 函数有 try-catch 覆盖
  - 验证所有页面的 @import 路径正确
  - _需求：NFR-3, FR-3_

---

## 需求覆盖矩阵

| 需求ID | 任务编号 | 状态 |
|--------|---------|------|
| BUG-1 | 1.2, 2.1 | Phase 1+2 |
| BUG-2 | 2.2 | Phase 2 |
| BUG-3 | 2.3 | Phase 2 |
| BUG-4 | 2.4 | Phase 2 |
| BUG-5 | 2.5 | Phase 2 |
| BUG-6 | 3.1 | Phase 3 |
| BUG-7 | 3.2 | Phase 3 |
| BUG-8 | 3.3 | Phase 3 |
| BUG-9 | 3.4 | Phase 3 |
| BUG-10 | 3.5 | Phase 3 |
| BUG-11 | 3.6 | Phase 3 |
| BUG-12 | 3.7 | Phase 3 |
| BUG-13 | 3.8 | Phase 3 |
| BUG-14 | 3.9 | Phase 3 |
| BUG-15 | 3.10 | Phase 3 |
| BUG-16 | 5.1 | Phase 5 |
| BUG-17 | 5.2 | Phase 5 |
| BUG-18 | 5.3 | Phase 5 |
| BUG-19 | 5.4 | Phase 5 |
| BUG-20 | 5.5 | Phase 5 |
| BUG-21 | 5.6 | Phase 5 |
| BUG-22 | 5.7 | Phase 5 |
| BUG-23 | 5.8 | Phase 5 |
| BUG-24 | 5.9 | Phase 5 |
| BUG-25~29 | 4.3 | Phase 4 |
| BUG-30 | 2.5 (合并) | Phase 2 |
| BUG-31 | 1.3~1.9 | Phase 1 |
| BUG-32 | 6.1 | Phase 6 |
| BUG-33 | 6.2 | Phase 6 |
| BUG-34 | 6.3 | Phase 6 |
| BUG-35 | 6.4 | Phase 6 |
| FR-1 | 1.1, 1.3~1.5, 6.3, 6.5 | Phase 1+6 |
| FR-2 | 4.3, 6.4 | Phase 4+6 |
| FR-3 | 1.7, 4.4, 6.7 | Phase 1+4+6 |
| FR-4 | 1.6~1.9, 4.1, 4.2 | Phase 1+4 |
| FR-5 | 2.3, 3.3 | Phase 2+3 |
| FR-6 | 2.4, 3.10 | Phase 2+3 |
| FR-7 | 5.8 | Phase 5 |
| FR-8 | 2.5, 3.7 | Phase 2+3 |
| FR-9 | 3.9 | Phase 3 |
| FR-10 | 5.1 | Phase 5 |
| NFR-1 | 5.5, 6.4 | Phase 5+6 |
| NFR-2 | 2.5 | Phase 2 |
| NFR-3 | 1.3~1.5, 5.9, 6.5, 6.6, 6.7 | Phase 1+5+6 |

---

*本任务清单基于 requirements.md（35个Bug + 10个功能需求 + 3个性能需求）和 design.md（6阶段实施方案）生成，确保每个需求都有对应的实施任务。*
