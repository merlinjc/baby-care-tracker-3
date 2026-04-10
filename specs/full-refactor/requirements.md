# 需求文档 - 宝宝成长记录小程序全面重构

## 概述

基于对小程序项目全部代码（18个页面、14个组件、11个服务、4个工具模块）的全面审查，本文档汇总了三大重构方向的需求：架构与UI统一、交互逻辑优化、Bug修复。在保留现有美拉德色彩风格和图标体系的前提下进行重构。

---

## 一、Bug排查清单（35项）

### 【致命级】必须立即修复（5项）

#### BUG-1: `settings.js` 调用了不存在的 `StorageUtil.save()` 方法
- **文件**: `pages/settings/settings.js` 第41行
- **问题**: `StorageUtil.save('settings', ...)` 但 `StorageUtil` 只有 `set` 方法，无 `save` 方法。导致设置页面所有设置项无法持久化保存，切换开关后离开页面即丢失。
- **修复**: 将 `StorageUtil.save` 改为 `StorageUtil.set`

#### BUG-2: `family-join.js` 和 `family-create.js` 未检查 `userInfo` 为 null
- **文件**: `pages/family-join/family-join.js` 第39-41行；`pages/family-create/family-create.js` 第39-44行
- **问题**: `StorageUtil.getUserInfo()` 返回 `null` 时直接访问 `userInfo._id` 导致 `TypeError` 崩溃
- **修复**: 添加 `if (!userInfo || !userInfo._id)` 防御性检查

#### BUG-3: `export.js` 数据导出 `.limit(1000)` 实际最多返回20条
- **文件**: `pages/export/export.js` 第120-121行
- **问题**: 微信云数据库小程序端 `.get()` 的 `limit` 最大值为20，设置1000无效。用户以为数据全部导出，实际严重缺失。
- **修复**: 使用分页循环获取所有数据，或调用云函数（服务端 limit 最大100）

#### BUG-4: `record.js` 编辑记录使用错误的字段名 `selectedRecord.type`
- **文件**: `pages/record/record.js` 第562行
- **问题**: 应为 `selectedRecord.recordType`，但使用了 `selectedRecord.type`，导致 `type` 为 `undefined`，编辑功能完全不工作
- **修复**: 改为 `const type = selectedRecord.recordType || selectedRecord.type;`

#### BUG-5: `settings.js` 删除云端数据时 `.get()` 最多返回20条
- **文件**: `pages/settings/settings.js` 第124-139行
- **问题**: 超过20条记录时删除不完整，用户以为已全部清除但实际数据残留
- **修复**: 使用循环删除直到没有数据返回

### 【严重级】可能导致崩溃或功能异常（10项）

#### BUG-6: `auth.js` `loadCurrentBaby` 未检查 `userInfo.familyId`
- **文件**: `pages/auth/auth.js` 第158-163行
- **问题**: `userInfo` 可能为 null 或 `familyId` 为 undefined，导致数据库查询异常
- **修复**: 增加 `if (!userInfo || !userInfo.familyId) return;`

#### BUG-7: `export.js` `doExport` 中 `baby` 可能为 null
- **文件**: `pages/export/export.js` 第107-115行
- **问题**: `baby._id` 在 baby 为 null 时崩溃
- **修复**: 增加 `if (!baby)` 空值检查

#### BUG-8: `export.js` CSV 导出未转义特殊字符
- **文件**: `pages/export/export.js` 第204-212行
- **问题**: note 字段含逗号/换行时 CSV 格式错乱
- **修复**: 对每个字段做 CSV 转义处理（双引号包裹含特殊字符的字段）

#### BUG-9: `export.js` `getRecordDetail` 中 `data` 可能为 undefined
- **文件**: `pages/export/export.js` 第248-264行
- **问题**: 解构 `data` 后访问 `data.feedingType` 时空指针异常
- **修复**: 增加默认值 `const data = record.data || {};`

#### BUG-10: `ai-assistant.js` `calculateDailyStats` 空指针
- **文件**: `pages/ai-assistant/ai-assistant.js` 第163行
- **问题**: `r.data.duration` 当 `r.data` 为 undefined 时崩溃
- **修复**: 改为 `r.data && r.data.duration`

#### BUG-11: `home.js` `goToBabyDetail` 中 `currentBaby` 可能为 null
- **文件**: `pages/home/home.js` 第251-253行
- **修复**: 增加 `if (!this.data.currentBaby) return;`

#### BUG-12: `settings.js` 清除缓存后应用状态不一致
- **文件**: `pages/settings/settings.js` 第67-68行
- **问题**: `wx.clearStorageSync()` 清除了所有存储（含用户/家庭/宝宝信息），其他页面读取后连锁崩溃
- **修复**: 只清除非核心缓存，或清除后重新加载用户/家庭/宝宝信息

#### BUG-13: `baby-list.js` 删除当前宝宝后未清理本地存储
- **文件**: `pages/baby-list/baby-list.js` 第122-143行
- **问题**: 被删除的宝宝仍是当前选中宝宝，其他页面读取后异常
- **修复**: 删除成功后检查并清理 `current_baby` 存储

#### BUG-14: `family.js` `leaveFamily` 只清除本地存储未更新数据库
- **文件**: `pages/family/family.js` 第211-228行
- **问题**: 服务端数据库中用户仍在家庭成员列表中
- **修复**: 调用 `FamilyService.leaveFamily()` 更新数据库后再清除本地

#### BUG-15: `record.js` `viewRecordDetail` 跳转到不存在的页面
- **文件**: `pages/record/record.js` 第549-552行
- **问题**: 跳转到 `/pages/record-detail/record-detail`，该页面不存在
- **修复**: 移除该功能或改为弹窗展示详情

### 【中等级】影响用户体验（12项）

#### BUG-16: `profile.js` `editProfile` 跳转到不存在的页面
- **文件**: `pages/profile/profile.js` 第100-103行
- **问题**: 跳转到 `/pages/edit-profile/edit-profile`，该页面不存在

#### BUG-17: `growth.js` `calculateBMI` 返回字符串而非数字
- **文件**: `pages/growth/growth.js` 第654行
- **问题**: `.toFixed(1)` 返回字符串，后续与数字比较有隐患

#### BUG-18: `growth.js` WHO 参考数据范围限制在12月龄
- **文件**: `pages/growth/growth.js` 第221行
- **问题**: 数据中有15/18/21/24月龄数据但代码限制 `ageMonths > 12` 返回 null

#### BUG-19: `auth.js` `joinFamily` 成功但 `result.success` 未定义时处理缺失
- **文件**: `pages/auth/auth.js` 第453-488行
- **问题**: `joiningFamily` 状态不会被重置，按钮一直显示加载

#### BUG-20: `record.js` `calculateFilterCounts` 基于已筛选数据计算
- **文件**: `pages/record/record.js` 第343-371行
- **问题**: 选择"喂养"筛选后其他类别计数全为0

#### BUG-21: `baby-detail.js` `onLoad` 缺少 `id` 参数时无提示
- **文件**: `pages/baby-detail/baby-detail.js` 第17-20行

#### BUG-22: `discover.js` 无宝宝信息时直接 redirect 无提示
- **文件**: `pages/discover/discover.js` 第75-79行

#### BUG-23: `record.js` 搜索功能用 `JSON.stringify` 且最多20条结果
- **文件**: `pages/record/record.js` 第498-516行

#### BUG-24: `growth.js` 弹窗残留变量 `popupTranslateY` / `touchStartY` 未使用
- **文件**: `pages/growth/growth.js` 第152-153行

#### BUG-25-29: 多页面 `onLoad` + `onShow` 重复调用问题
- **涉及**: `ai-assistant.js`、`milestone.js`、`vaccine.js`、`baby-list.js`、`family.js`
- **问题**: 首次加载时方法执行两次，造成重复数据库查询

#### BUG-30: `settings.js` 批量删除逐条串行执行
- **文件**: `pages/settings/settings.js` 第124-139行
- **问题**: 大量记录时极慢

### 【低等级】代码质量问题（5项）

#### BUG-31: `config/` 和 `styles/` 目录为空
- **问题**: 空目录占位，无实际用途

#### BUG-32: `trendService.js` 睡眠时长单位计算不一致
- **问题**: `duration / 60` 注释为"转换为小时"但实际应该是 `duration / 3600`

#### BUG-33: `record.js` 中 `createRecord` catch 块重复获取 `userInfo` 变量
- **文件**: `services/record.js` 第252行
- **问题**: 与外层第144行的 `userInfo` 同名变量遮蔽

#### BUG-34: 多处 `formatDate` 工具函数重复定义
- **涉及**: `discover.js`、`family.js`、`growth.js`、`milestone.js`、`vaccine.js`、`export.js`
- **问题**: 6处重复实现相同逻辑

#### BUG-35: `discover.js` Tab 页频繁切换时数据库压力大
- **问题**: 每次 `onShow` 都执行多次数据库查询，无节流缓存

---

## 二、架构与UI重构需求

### FR-1: 统一工具函数提取
**用户故事**: 作为开发者，我希望消除重复代码，提高可维护性
**验收标准**:
1. 将 `formatDate`、`calculateAgeMonths`、`formatAge` 等6处重复的日期/月龄计算函数提取到 `utils/date.js`
2. 将 `config/` 目录用于存放应用常量（疫苗计划、里程碑定义等），从页面中抽离
3. 清理空目录 `config/`、`styles/`

### FR-2: 页面生命周期规范化
**用户故事**: 作为用户，我希望页面加载更快，不做重复请求
**验收标准**:
1. 所有页面统一 `onLoad` 做一次性初始化，`onShow` 做增量刷新
2. Tab 页面（home/record/discover/profile）增加30秒节流缓存
3. 消除所有 `onLoad` + `onShow` 双重调用问题

### FR-3: 统一错误处理与空状态
**用户故事**: 作为用户，我希望在数据为空或加载失败时看到友好提示
**验收标准**:
1. 所有页面的 `onLoad` 对缺失参数有明确提示和回退
2. 统一空状态组件（无数据、加载中、加载失败三种状态）
3. 所有 `async` 函数有 `try-catch` 覆盖

### FR-4: 组件化与样式统一
**用户故事**: 作为用户，我希望每个页面风格统一
**验收标准**:
1. 所有页面严格使用 `app.wxss` 中定义的 CSS 变量，不使用硬编码颜色
2. 抽取公共样式到 `styles/` 目录（列表项、卡片、表单、弹窗等通用样式）
3. 统一按钮/输入框/标题等组件的间距和字号层次

---

## 三、交互逻辑优化需求

### FR-5: 数据导出功能修复
**用户故事**: 作为用户，我希望能导出所有记录数据
**验收标准**:
1. 使用分页循环或云函数获取全量数据
2. CSV 导出正确处理特殊字符
3. 导出前显示准确的记录数量

### FR-6: 记录编辑功能修复
**用户故事**: 作为用户，我希望能编辑已有记录
**验收标准**:
1. 修复 `recordType` 字段名错误
2. 记录详情改为弹窗展示（移除不存在的 `record-detail` 页面跳转）
3. 编辑弹窗正确回显现有数据

### FR-7: 搜索功能优化
**用户故事**: 作为用户，我希望能快速搜索历史记录
**验收标准**:
1. 搜索支持匹配备注、记录类型中文名、记录者名称
2. 搜索结果不受20条限制
3. 增加搜索关键词高亮

### FR-8: 数据删除安全性
**用户故事**: 作为用户，我希望清除数据时能完整删除
**验收标准**:
1. 批量删除改为循环分页删除直到没有数据
2. 增加删除进度提示
3. 清除缓存时保留核心用户信息

### FR-9: 家庭退出功能完善
**用户故事**: 作为用户，我希望退出家庭后数据库同步更新
**验收标准**:
1. 退出家庭时调用服务端接口移除成员
2. 退出前检查是否有关联宝宝
3. 退出后清理本地相关缓存

### FR-10: 个人资料编辑功能
**用户故事**: 作为用户，我希望能修改昵称和头像
**验收标准**:
1. 创建 `edit-profile` 页面或改为弹窗编辑
2. 支持修改昵称、头像、身份关系

---

## 四、性能优化需求

### NFR-1: Tab 页面数据缓存
- discover 页面增加30秒节流
- record 页面筛选计数基于全量数据
- home 页面避免 onShow 重复查询

### NFR-2: 批量操作优化
- 批量删除改为并行+分批处理
- 数据导出使用流式写入

### NFR-3: 代码体积优化
- 清理未使用的代码和变量
- 疫苗/里程碑定义数据抽离到配置文件

---

## 五、优先级排序

| 优先级 | 范围 | 数量 | 说明 |
|-------|------|------|------|
| P0 - 立即修复 | BUG-1~5 | 5项 | 致命级Bug，影响核心功能 |
| P1 - 高优先级 | BUG-6~15, FR-5~6 | 12项 | 严重Bug + 核心功能修复 |
| P2 - 中优先级 | BUG-16~30, FR-1~4, FR-7~10 | 21项 | 体验优化 + 架构重构 |
| P3 - 低优先级 | BUG-31~35, NFR-1~3 | 8项 | 代码质量 + 性能优化 |

---

*本文档基于对 miniprogram 目录下所有代码文件的全量审查生成，共审查 307 个文件，发现 35 个 Bug、10 个功能需求、3 个性能优化需求。*
