---
name: performance-optimization
overview: 基于 specs/performance-optimization/ 下的 requirements.md（48 个 FR）、design.md（v1.1 技术方案）和 tasks.md（37 个任务、6 个 Phase）创建完整实施计划，覆盖小程序全面性能优化的所有编码任务。
todos:
  - id: phase1-tools
    content: "Phase 1.1-1.2: 创建 miniprogram/utils/debounce.js（debounce/throttle 含 .cancel()）和 miniprogram/utils/db-helper.js（fetchAll 分页查询），按 design.md 3.1/5.4 的代码实现"
    status: completed
  - id: phase1-singleton
    content: "Phase 1.3: 使用 [subagent:code-explorer] 定位所有 Service 文件和页面中的 new XxxService() 调用，为 8 个 Service 添加单例守卫，record.js 6 处和 home.js 3 处改为页面级缓存"
    status: completed
    dependencies:
      - phase1-tools
  - id: phase1-unify
    content: "Phase 1.4-1.5: 将 parseTimestamp 提取到 utils/date.js 并替换 3 处引用；统一 8 处 calculateAgeMonths；home.js WEEK_DAYS 常量提升；content-filter.js 关键词常量提升和 .some() 短路优化"
    status: completed
    dependencies:
      - phase1-singleton
  - id: phase2-setdata
    content: "Phase 2.1-2.3: home.js loadData/onShow setData 合并为 patch 模式；ai-assistant.js messages 改用路径更新语法；feeding/sleep/temperature/diaper/baby-list 弹窗 setData 合并"
    status: completed
    dependencies:
      - phase1-unify
  - id: phase2-behavior
    content: "Phase 2.4-2.5: 新建 behaviors/swipe-close.js（touchStartY 实例属性 + 16ms 节流），6 个弹窗引入 behavior 并删除原触摸代码；vaccine.js setData 合并；sleep-popup 计时器降频到 5s"
    status: completed
    dependencies:
      - phase2-setdata
  - id: phase2-hidden
    content: "Phase 2.6: home.wxml/record.wxml/growth.wxml/baby-detail.wxml 中弹窗组件从 wx:if 改为 hidden，检查各弹窗 show observer 确保 show=false 时不执行后台逻辑"
    status: completed
    dependencies:
      - phase2-behavior
  - id: phase3-throttle
    content: "Phase 3.1: growth.js/ai-assistant.js/baby-list.js/family.js 的 onShow 添加 30s 节流；record.js onSearch 添加 300ms debounce + 本地筛选 + 关键词长度限制"
    status: completed
    dependencies:
      - phase1-unify
  - id: phase3-cache
    content: "Phase 3.2: record.js 筛选计数仅 refresh 时计算 + 30s 缓存；app.js onLaunch 缓存 systemInfo；growth.js drawChart months 数组和辅助函数提升为实例属性"
    status: completed
    dependencies:
      - phase3-throttle
  - id: phase3-p0fix
    content: "Phase 3.3（P0 修复）: vaccine.js/milestone.js 改用 fetchAll 修复数据截断；todo.js 改用 fetchAll + Set 索引优化；todo.js/subscribe.js 配置引用统一为 require config 文件"
    status: completed
    dependencies:
      - phase3-cache
  - id: phase3-service
    content: "Phase 3.4-3.5: RecordService#getTodayStats 添加 15s 缓存；trendService 一次遍历分桶 + 30s 缓存；record.js 缓存 slice(0,200) 限制 + updateRecordInCache 扩展 babyId 参数 + app.js 孤立缓存清理"
    status: completed
    dependencies:
      - phase3-p0fix
  - id: phase3-growth
    content: "Phase 3.6-3.7: home.js AI 洞察 7 天过期清理；diaper-popup 改用 RecordService + 30s 缓存；growth.js/growth-popup.js 写操作改用 RecordService（确保 recordType:'growth'）"
    status: completed
    dependencies:
      - phase3-service
  - id: phase4-render
    content: "Phase 4.1-4.2: 全项目 image 标签添加 lazy-load（排除首屏关键图标）；timeline 组件：data-record 精简为 data-record-id、图标 src 预计算、observers 拆分、formatDate 缓存、排序改字符串比较"
    status: completed
    dependencies:
      - phase1-unify
  - id: phase4-wxml
    content: "Phase 4.3-4.4: record.wxml insight-section/搜索/筛选改 hidden；vaccine.wxml 筛选移到 JS 预计算 displayGroups；home/record/report-popup/milestone/timeline 中复杂表达式统一预计算"
    status: completed
    dependencies:
      - phase4-render
  - id: phase4-css-wxs
    content: "Phase 4.5: 全项目 transition:all 替换为具体属性；record.wxss backdrop-filter 改纯色半透明；新建 utils/format.wxs 实现 formatDuration，timeline.wxml 引入 WXS"
    status: completed
    dependencies:
      - phase4-wxml
  - id: phase5-subpackage
    content: "Phase 5.1-5.2: 使用 [subagent:code-explorer] 全局搜索所有路由跳转路径；创建 packageGrowth/packageSocial 目录并移动页面；更新 app.json subpackages/preloadRule；修改 10 处路由路径；提升基础库版本到 2.7.3"
    status: completed
    dependencies:
      - phase3-growth
      - phase4-css-wxs
  - id: phase5-config
    content: "Phase 5.3-5.4: who-standards.js 移入 packageGrowth/config/；分包内 require 路径全部更新；error-state 改局部注册；删除 popup/cloudbase-badge 目录和 subscribe.js；sync.js 死代码标注"
    status: completed
    dependencies:
      - phase5-subpackage
  - id: phase5-style
    content: "Phase 5.5-5.6: 6 个弹窗 WXSS 添加 @import popup.wxss 并删除重复规则；表单/页头样式引用；图标 CDN 迁移评估记录到文档（本次不实施代码改动）"
    status: completed
    dependencies:
      - phase5-config
  - id: phase6-quality
    content: "Phase 6.1-6.3: milestone.js quickAchieve/toggleAchieved 合并；新建 utils/batch.js；settings.js/record.js 批量删除改 batchExecute；growth.js WHO 数据预缓存；3 个组件移除重复 attached 调用；7 个组件补全 detached 生命周期"
    status: completed
    dependencies:
      - phase5-style
  - id: phase6-cleanup
    content: "Phase 6.4-6.6: baby.js N+1 改 db.command.in()；ai-assistant.js 改用 RecordService；删除 filterService.js 和 record.js 死方法；全项目 console.log 清理；sync.js 离线队列改 batchExecute + try-finally；各页面定时器清理补全"
    status: completed
    dependencies:
      - phase6-quality
---

## 用户需求

根据已完成的三份规范文档（requirements.md、design.md、tasks.md），创建可执行的实施计划（plan），用于对微信小程序进行全面性能优化。

## 产品概述

对"宝宝护理追踪器"微信小程序进行系统性性能优化，涵盖 18 个页面、15 个组件、13 个服务的全面改造。在不改变功能和 UI 的前提下，减少不必要的 setData/DB 查询/重复计算，优化包体积和分包策略，修复 P0 数据截断 bug，提升页面加载速度、流畅度和内存效率。

## 核心特性

- 创建公共工具层（debounce/throttle、分页查询、批量执行），统一 Service 单例模式和重复工具函数
- 合并连续 setData 调用，优化弹窗高频触摸交互，提取公共 Behavior
- 修复 vaccine/milestone 数据截断 P0 bug，治理缓存膨胀，增加 onShow 节流和搜索优化
- 减少 WXML 视图层计算，引入 WXS 格式化函数，添加 image lazy-load
- 拆分主包为 2 个分包（packageGrowth/packageSocial），删除未使用组件/服务，统一公共样式
- 消除重复代码、补全组件 detached 生命周期、清理死代码和 console.log

## 技术栈

- 平台：微信小程序（WeChat Mini Program）
- 基础库：2.7.3+（Phase 5 分包需提升）
- 云开发：wx.cloud（NoSQL 数据库、云函数）
- 构建：微信开发者工具
- 语言：JavaScript (ES6)、WXML、WXSS、WXS

## 实现方案

### 总体策略

采用 6 个 Phase 渐进式交付，每个 Phase 可独立验证。Phase 1 构建基础工具层，Phase 2-4 可部分并行优化不同维度（setData/DB/渲染），Phase 5 在页面改动稳定后实施分包，Phase 6 与 Phase 5 并行做代码质量清理。

### 关键技术决策

1. **KDD-1 节流方式**：自定义 throttle（leading-edge）而非 wx.nextTick，可精确控制 30s/16ms 间隔
2. **KDD-2 弹窗 hidden 内存权衡**：高频弹窗用 hidden（常驻约 50KB 内存），消除组件重建开销
3. **KDD-3 分包粒度**：2 个分包（growth + social），降低路由管理复杂度
4. **KDD-4 配置数据处理**：混合策略 -- who-standards.js 移入分包，vaccine-plans/milestone-defs 保留主包（避免跨分包 require 风险）
5. **KDD-5 WXS 范围**：仅用于简单格式化函数，不用于复杂业务逻辑
6. **KDD-6 数据截断修复**：先用 fetchAll 工具快速修复 P0 bug，Service 封装延后
7. **KDD-7 AI 缓存清理**：写入时触发过期清理，而非 onLaunch 统一清理（代码内聚性更好）
8. **KDD-8 路由管理**：直接修改硬编码路径（仅 10 处），不引入路由映射工具

## 实现注意事项

- **向后兼容**：所有页面路由路径在分包后需全局搜索验证，不遗漏任何 navigateTo/redirectTo
- **缓存降级**：所有缓存逻辑需有 try-catch 降级到实时查询
- **debounce 生命周期**：组件 detached / 页面 onUnload 中必须调用 .cancel() 清理
- **hidden 组件**：需确保 show=false 时不执行网络请求和定时器
- **分包 require**：主包不能 require 分包文件，仅 who-standards.js 移入分包
- **WXS 一致性**：format.wxs 中的函数需与 JS 层同名函数输入输出完全一致

## 架构设计

### 当前架构

```
miniprogram/
├── app.js / app.json       # 入口，18 页面全在主包
├── pages/ (18)              # 首页/记录/发现/我的(TabBar) + 14 功能页
├── components/ (15)         # 6 弹窗 + 9 功能组件
├── services/ (13)           # RecordService/SyncService 有单例，其余 8 个无
├── utils/ (6)               # date/storage/network/deduplication 等
├── config/ (3)              # vaccine-plans/milestone-defs/who-standards (31.48KB)
├── styles/ (4)              # 4 个公共样式（全项目无 @import）
└── images/ (113 PNG)        # 全部 < 2.18KB
```

### 优化后架构

```
miniprogram/
├── app.js / app.json        # 主包 8 页面 + subpackages 配置
├── pages/ (8)               # home/record/discover/profile/auth/baby-create/baby-list/guide
├── packageGrowth/           # 分包 A -- growth/vaccine/milestone/baby-detail
│   ├── pages/ (4)
│   └── config/who-standards.js (10.03KB)
├── packageSocial/           # 分包 B -- ai-assistant/family/family-create/family-join/export/settings
│   └── pages/ (6)
├── components/ (13)         # 删除 popup/ 和 cloudbase-badge/
├── services/ (11)           # 删除 subscribe.js 和 filterService.js，全部单例化
├── utils/ (9)               # +debounce.js +db-helper.js +batch.js
├── behaviors/               # +swipe-close.js
├── config/ (2)              # vaccine-plans/milestone-defs 保留主包
└── styles/ (4)              # 通过 @import 被 13+ 文件引用
```

## 目录结构

```
miniprogram/
├── utils/
│   └── debounce.js          # [NEW] debounce/throttle 工具函数，附带 .cancel() 方法。Phase 1 基础设施，供后续 Phase 全部使用。
│   └── db-helper.js         # [NEW] fetchAll 分页查询工具，突破小程序端 20 条 limit 限制。用于 vaccine/milestone/todo 数据截断修复。
│   └── batch.js             # [NEW] batchExecute 通用分批并发工具，用于批量删除和离线队列并行。
│   └── format.wxs           # [NEW] WXS 格式化函数（formatDuration 等），在视图层直接执行避免逻辑层通信。
│   └── date.js              # [MODIFY] 追加 parseTimestamp 函数，统一 3 处重复实现。
├── behaviors/
│   └── swipe-close.js       # [NEW] 弹窗下滑关闭公共 Behavior，touchStartY 改实例属性 + 16ms 节流 setData。6 个弹窗复用。
├── services/
│   └── family.js            # [MODIFY] 添加单例守卫
│   └── ai.js                # [MODIFY] 添加单例守卫
│   └── content-filter.js    # [MODIFY] 添加单例守卫 + 关键词常量提升 + .some() 短路
│   └── auth.js              # [MODIFY] 添加单例守卫
│   └── quota.js             # [MODIFY] 添加单例守卫
│   └── trendService.js      # [MODIFY] 添加单例守卫 + 一次遍历分桶 + 30s 缓存
│   └── record.js            # [MODIFY] getTodayStats 15s 缓存 + updateRecordInCache 扩展 babyId + .slice(0,200) + parseTimestamp 提取
│   └── todo.js              # [MODIFY] fetchAll 替换 .get() + Set 索引优化 + 配置引用统一
│   └── baby.js              # [MODIFY] N+1 改 db.command.in() + 删除冗余方法
│   └── subscribe.js         # [DELETE] 全项目零引用死代码
│   └── filterService.js     # [DELETE] 全项目零引用死代码
│   └── sync.js              # [MODIFY] 离线队列改 batchExecute + try-finally + 死代码标注 + console.log 清理
├── pages/
│   └── home/home.js         # [MODIFY] setData 合并 + WEEK_DAYS 常量 + AI 缓存清理 + 定时器清理
│   └── record/record.js     # [MODIFY] debounce 搜索 + 筛选计数缓存 + setData 合并
│   └── record/record.wxml   # [MODIFY] wx:if 改 hidden + lazy-load
│   └── growth/growth.js     # [MODIFY] onShow 节流 + drawChart 优化 + 写操作改 RecordService + WHO 缓存
│   └── vaccine/vaccine.js   # [MODIFY] fetchAll 修复截断 + setData 合并 + 筛选预计算
│   └── milestone/milestone.js # [MODIFY] fetchAll 修复截断 + 重复代码合并
│   └── ai-assistant/ai-assistant.js # [MODIFY] setData 路径更新 + onShow 节流 + 改用 RecordService
│   └── baby-list/baby-list.js # [MODIFY] onShow 节流 + setData 合并
│   └── family/family.js     # [MODIFY] onShow 节流
│   └── settings/settings.js # [MODIFY] 批量删除改 batchExecute
├── components/
│   └── feeding-popup/       # [MODIFY] setData 合并 + swipe-close behavior + detached 补全
│   └── sleep-popup/         # [MODIFY] setData 合并 + behavior + 计时器降频
│   └── diaper-popup/        # [MODIFY] setData 合并 + behavior + 改用 RecordService
│   └── temperature-popup/   # [MODIFY] setData 合并 + behavior + 空 observer 删除
│   └── baby-edit-popup/     # [MODIFY] behavior
│   └── growth-popup/        # [MODIFY] behavior + 写操作改 RecordService
│   └── report-popup/        # [MODIFY] preloadImages 延迟 + detached 补全 + 表达式预计算
│   └── export-popup/        # [MODIFY] 移除重复 attached 调用 + detached 补全
│   └── timeline/            # [MODIFY] data-record 精简 + observers 拆分 + 排序优化 + 预计算
│   └── icon/icon.js         # [MODIFY] 移除重复 attached 调用 + 死代码清理
│   └── insight-section/     # [MODIFY] 移除重复 attached 调用
│   └── common/popup/        # [DELETE] 全项目无引用
│   └── cloudbase-badge/     # [DELETE] 仅自引用无页面使用
├── app.js                   # [MODIFY] systemInfo 全局缓存 + 孤立缓存清理 + 全局缓存监控
├── app.json                 # [MODIFY] subpackages + preloadRule 配置
├── project.config.json      # [MODIFY] 最低基础库版本提升到 2.7.3
├── packageGrowth/           # [NEW] 分包 A 目录，含 growth/vaccine/milestone/baby-detail 页面
│   └── config/who-standards.js # [MOVE] 从 config/ 移入分包
└── packageSocial/           # [NEW] 分包 B 目录，含 ai-assistant/family/family-create/family-join/export/settings 页面
```

## Agent 扩展

### SubAgent

- **code-explorer**
- 用途：在每个 Phase 实施前，对涉及的多个文件进行批量搜索和验证（如全局搜索 navigateTo 路径、确认死代码引用、校验 require 路径等）
- 预期结果：准确定位所有需要修改的代码位置，避免遗漏

### Skill

- **spec-workflow**
- 用途：在实施过程中遵循规范化工程流程，确保每个 Phase 的验收标准得到满足
- 预期结果：每个 Phase 完成后可独立验证，符合 NFR 指标