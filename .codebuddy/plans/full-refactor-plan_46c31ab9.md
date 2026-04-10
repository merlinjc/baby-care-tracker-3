---
name: full-refactor-plan
overview: 宝宝成长记录微信小程序全面重构：6阶段48项子任务渐进式重构，修复35个Bug、10个功能增强、3个性能优化，保留美拉德色彩风格
todos:
  - id: phase1-infrastructure
    content: "Phase 1: 基础设施搭建(9项) - 创建utils/date.js、修复storage.js添加save别名、创建config/三个配置文件(vaccine-plans/milestone-defs/who-standards)、创建styles/四个公共样式文件(popup/loading/form/page-header)"
    status: completed
  - id: phase2-p0-bugs
    content: "Phase 2: P0致命级Bug修复(5项) - BUG-1验证save别名生效、BUG-2空指针防御检查、BUG-3分页循环导出、BUG-4字段名recordType修复、BUG-5循环分页删除"
    status: completed
    dependencies:
      - phase1-infrastructure
  - id: phase3-p1-bugs
    content: "Phase 3: P1严重级Bug修复(10项) - BUG-6~15：auth/export/home/settings/baby-list/family/record空指针检查、CSV转义、状态恢复、数据库同步、弹窗展示"
    status: completed
    dependencies:
      - phase2-p0-bugs
  - id: phase4-ui-lifecycle
    content: "Phase 4: UI统一+生命周期规范(5项) - 补充app.wxss CSS变量、各页面引入公共样式、统一生命周期模式(_initialized+30秒节流)、补充缺失状态、修复settings.wxml Switch color"
    status: completed
    dependencies:
      - phase3-p1-bugs
  - id: phase5-p2-bugs-features
    content: "Phase 5: P2中等级Bug+功能优化(9项) - BUG-16~24：profile弹窗编辑、BMI返回值修复、WHO范围扩展、筛选计数缓存、搜索功能优化"
    status: completed
    dependencies:
      - phase4-ui-lifecycle
  - id: phase6-performance-cleanup
    content: "Phase 6: P3低等级Bug+性能优化+代码清理(7项) - BUG-32~35：睡眠时长单位、变量遮蔽、formatDate替换、Tab节流缓存、配置数据消除、组件声明清理"
    status: completed
    dependencies:
      - phase5-p2-bugs-features
---

## 产品概述

宝宝成长记录微信小程序全面重构项目。基于代码审查结果（307个文件），涵盖35个Bug修复、10个功能增强和3个性能优化。在保留现有美拉德色彩风格和图标体系的前提下，通过渐进式6阶段重构提升代码质量、用户体验和系统稳定性。

## 核心功能

### Bug修复（35项，按优先级分4级）

**P0致命级（5项）**：StorageUtil.save方法不存在、family-join/create空指针崩溃、数据导出limit限制导致数据缺失、记录编辑字段名错误、批量删除云端数据残留

**P1严重级（10项）**：auth/export/home/settings/baby-list/family/record等多页面空指针崩溃、CSV导出未转义、清缓存后状态不一致、leaveFamily只清本地未更新数据库、record跳转不存在页面

**P2中等级（15项）**：profile编辑跳转不存在页面、growth计算/数据范围问题、多页面onLoad+onShow双重调用、搜索限制20条、筛选计数基于已筛选数据

**P3低等级（5项）**：空目录config/styles、睡眠时长单位错误、变量遮蔽、formatDate重复定义、Tab切换频繁查询

### 架构重构

- 统一日期工具函数提取到utils/date.js（消除6处formatDate重复）
- 配置数据抽离到config/目录（疫苗计划400行、里程碑270行、WHO标准130行）
- 公共样式提取到styles/目录（弹窗/加载状态/表单/页面头部）
- 补充CSS语义扩展变量到app.wxss

### 交互优化

- 数据导出分页循环获取全量数据，CSV正确转义
- 记录编辑字段名修复 + 详情改为弹窗展示
- 搜索功能精确匹配 + 突破20条限制
- 批量删除并行化 + 进度提示
- 家庭退出同步数据库
- 个人资料编辑改为弹窗方式

### 性能优化

- Tab页面30秒节流缓存
- 页面生命周期规范化（_initialized标志位 + Promise化init）
- 代码体积优化（清理未使用代码/变量/组件声明）

## 技术栈

- **框架**: 微信小程序原生框架（WXML + WXSS + JavaScript）
- **云服务**: 微信云开发（wx.cloud）
- **数据库**: 微信云数据库（NoSQL，小程序端limit最大20条）
- **存储**: wx.setStorageSync / wx.getStorageSync

## 实现方案

### 整体策略

采用6阶段渐进式重构，每阶段可独立验证。先搭建基础设施（不改页面行为），再按优先级修复Bug，然后统一UI和生命周期，最后做性能优化。

### 关键技术决策

**1. StorageUtil兼容方案**：添加`save`别名指向`set`方法，而非全局替换调用方。理由：最小改动，向后兼容，避免遗漏调用点。

**2. 分页数据获取**：微信小程序端云数据库limit最大20条，所有需要全量数据的场景统一采用循环分页模式：

```javascript
async getAllByQuery(collection, where) {
  let all = [], batch;
  do {
    batch = await collection.where(where).skip(all.length).limit(20).get();
    all = all.concat(batch.data);
  } while (batch.data.length === 20);
  return all;
}
```

**3. 生命周期规范化**：使用`_initialized`标志位 + Promise化init，解决onLoad异步未完成时onShow已执行的问题：

```javascript
onLoad(options) {
  this._initPromise = this.init(options);
},
onShow() {
  if (!this._initPromise) return;
  this._initPromise.then(() => {
    const now = Date.now();
    if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
    this._lastLoadTime = now;
    this.refreshData();
  });
}
```

**4. utils/date.js设计**：包含parseDate、formatDate、calculateAgeMonths、formatAge、calculateAgeInDays五个核心函数，兼容Date/string/云数据库{$date}格式。

**5. FR-10个人资料编辑**：采用弹窗方式实现（复用现有popup组件模式），而非创建新页面。理由：功能简单、减少代码量、保持交互一致性。

## 目录结构

```
miniprogram/
├── app.js / app.json / app.wxss
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
│   ├── storage.js                         # 【修改】添加save别名
│   └── ...
├── services/                              # 修复trendService.js BUG-32
├── pages/                                 # 修复Bug + 统一生命周期
└── images/
```

### 文件变更清单

**新增文件（8个）**：

- miniprogram/utils/date.js - 统一日期工具
- miniprogram/config/vaccine-plans.js - 疫苗计划配置
- miniprogram/config/milestone-defs.js - 里程碑定义配置
- miniprogram/config/who-standards.js - WHO生长标准配置
- miniprogram/styles/popup.wxss - 弹窗公共样式
- miniprogram/styles/loading.wxss - 加载状态公共样式
- miniprogram/styles/form.wxss - 表单公共样式
- miniprogram/styles/page-header.wxss - 页面头部公共样式

**修改文件（20+个）**：

- miniprogram/utils/storage.js - 添加save别名
- miniprogram/app.wxss - 补充CSS语义变量
- miniprogram/pages/settings/settings.js, settings.wxml - BUG-1,5,12,30
- miniprogram/pages/family-join/family-join.js - BUG-2
- miniprogram/pages/family-create/family-create.js - BUG-2
- miniprogram/pages/export/export.js - BUG-3,7,8,9
- miniprogram/pages/record/record.js, record.json - BUG-4,15,20,23
- miniprogram/pages/auth/auth.js - BUG-6,19
- miniprogram/pages/ai-assistant/ai-assistant.js - BUG-10,25
- miniprogram/pages/home/home.js - BUG-11
- miniprogram/pages/baby-list/baby-list.js - BUG-13,28
- miniprogram/pages/family/family.js - BUG-14,29
- miniprogram/pages/profile/profile.js - BUG-16
- miniprogram/pages/growth/growth.js - BUG-17,18,24,26
- miniprogram/pages/baby-detail/baby-detail.js - BUG-21
- miniprogram/pages/discover/discover.js - BUG-22,35
- miniprogram/pages/milestone/milestone.js - BUG-27
- miniprogram/pages/vaccine/vaccine.js - BUG-27
- miniprogram/services/trendService.js - BUG-32
- miniprogram/services/record.js - BUG-33