# Baby Care Tracker

> **一站式婴幼儿养护追踪微信小程序** — 面向 0-36 个月婴幼儿父母，提供喂养、睡眠、排便、体温、生长发育全方位记录与 AI 智能分析。

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发，通过 AI 提示词和 MCP 协议 + 云开发，让开发更智能、更高效。

---

## 1. 项目概述

| 属性 | 值 |
|------|-----|
| **产品名称** | Baby Care Tracker（宝宝成长记录） |
| **产品版本** | v4.2.1 Milo |
| **项目类型** | 微信小程序（原生开发） |
| **AppID** | `wx1f1bc8e6ff2be61d` |
| **CloudBase 环境** | `neo3-7gtg0bdtc9fcc672` |
| **基础库版本** | ≥ 2.7.3 |
| **目标用户** | 0-36 个月婴幼儿的父母及家庭成员 |

### 核心能力

- **五类日常记录**：喂养（母乳/配方奶/辅食）、睡眠、排便、体温、生长测量
- **AI 智能助手**：基于腾讯混元大模型的每日洞察、喂养/睡眠建议、育儿问答
- **家庭协作**：邀请码加入家庭、admin/editor/viewer 三级权限、多人共同记录
- **科学追踪**：WHO 生长曲线、国家免疫规划疫苗计划、发育里程碑追踪
- **离线优先**：断网自动进入离线队列，网络恢复后批量同步
- **暗色模式**：支持 light/dark/跟随系统三种主题模式
- **趣味彩蛋**：节日/纪念日/特殊时刻自动触发彩蛋互动

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | 微信小程序原生（WXML + WXSS + JavaScript） |
| 后端服务 | CloudBase 云开发（NoSQL 数据库 + 云函数 + 云存储） |
| AI 服务 | 腾讯混元 `hunyuan-2.0-instruct-20251111`（通过 `wx.cloud.extend.AI`） |
| 本地缓存 | 三层缓存：globalData 内存 → wx.localStorage → 服务层 TTL 缓存 |
| 实时通信 | CloudBase watch API（预留接口） |
| 构建工具 | 微信开发者工具（ES6 转译 + PostCSS + 代码压缩） |
| 图标处理 | Node.js 脚本（sharp + axios） |

---

## 3. 目录结构

```
baby-care-tracker-3/
│
├── miniprogram/                          # 📱 小程序主代码（核心应用）
│   ├── app.js                            #   应用入口（CloudBase 初始化、用户认证、同步服务）
│   ├── app.json                          #   路由配置、TabBar、分包策略、预加载规则
│   ├── app.wxss                          #   全局样式（美拉德色系设计系统 + CSS 变量）
│   ├── theme.json                        #   亮色/暗色主题变量
│   ├── sitemap.json                      #   微信索引配置
│   │
│   ├── models/index.js                   #   JSDoc 类型定义 + 数据工厂函数
│   ├── config/who-standards.js           #   WHO 生长标准数据
│   │
│   ├── behaviors/                        #   复用行为（2 个）
│   │   ├── swipe-close.js                #     弹窗下滑关闭手势
│   │   └── share-behavior.js             #     全局分享配置
│   │
│   ├── services/                         #   服务层（11 个，业务逻辑核心）
│   │   ├── auth.js                       #     认证服务（获取/创建用户）
│   │   ├── record.js                     #     记录 CRUD（云端优先 + 离线降级，28KB）
│   │   ├── baby.js                       #     宝宝档案管理
│   │   ├── family.js                     #     家庭组管理（邀请/加入/权限，17KB）
│   │   ├── ai.js                         #     AI 对话服务（混元大模型）
│   │   ├── quota.js                      #     AI 配额管理（每日 100 次）
│   │   ├── sync.js                       #     离线同步服务（队列/重试/网络监听）
│   │   ├── todo.js                       #     待办统计（疫苗+里程碑）
│   │   ├── trendService.js               #     趋势分析（周环比/参考范围/状态评估）
│   │   ├── reportDataHelper.js           #     成长报告数据计算
│   │   └── share-canvas.js               #     分享图 Canvas 绘制（44KB）
│   │
│   ├── utils/                            #   工具层（12 个，基础设施）
│   │   ├── storage.js                    #     本地存储封装
│   │   ├── network.js                    #     网络状态监测
│   │   ├── permission.js                 #     权限检查（三级 RBAC）
│   │   ├── theme.js                      #     主题管理器（亮色/暗色/系统）
│   │   ├── date.js                       #     日期/月龄工具
│   │   ├── debounce.js                   #     防抖/节流
│   │   ├── deduplication.js              #     操作去重（3s 窗口）
│   │   ├── batch.js                      #     分批并发控制
│   │   ├── db-helper.js                  #     数据库分页查询（突破 20 条限制）
│   │   ├── icon-config.js                #     图标配置中心
│   │   ├── easter-egg.js                 #     彩蛋检测系统
│   │   └── format.wxs                    #     WXS 格式化（模板内调用）
│   │
│   ├── styles/                           #   共享样式（4 个）
│   │   ├── form.wxss                     #     表单样式
│   │   ├── loading.wxss                  #     加载动画
│   │   ├── page-header.wxss              #     页头样式
│   │   └── popup.wxss                    #     弹窗基础样式
│   │
│   ├── components/                       #   自定义组件（15 个）
│   │   ├── feeding-popup/                #     喂养记录弹窗
│   │   ├── sleep-popup/                  #     睡眠记录弹窗
│   │   ├── diaper-popup/                 #     排便记录弹窗
│   │   ├── temperature-popup/            #     体温记录弹窗
│   │   ├── growth-popup/                 #     生长记录弹窗
│   │   ├── timeline/                     #     时间线组件
│   │   ├── insight-section/              #     AI 洞察区
│   │   ├── report-popup/                 #     成长报告弹窗（34KB）
│   │   ├── export-popup/                 #     数据导出弹窗
│   │   ├── baby-card/                    #     宝宝信息卡片
│   │   ├── baby-edit-popup/              #     宝宝编辑弹窗
│   │   ├── icon/                         #     图标组件
│   │   ├── error-state/                  #     错误状态组件（全局注册）
│   │   ├── easter-egg-popup/             #     彩蛋弹窗
│   │   └── easter-egg-toast/             #     彩蛋提示
│   │
│   ├── pages/                            #   主包页面（8 个）
│   │   ├── home/                         #     🏠 首页 Tab（36KB，最复杂页面）
│   │   ├── record/                       #     📋 记录列表 Tab（26KB）
│   │   ├── discover/                     #     🔍 发现页 Tab
│   │   ├── profile/                      #     👤 我的 Tab
│   │   ├── auth/                         #     🔐 登录/引导页（15KB）
│   │   ├── baby-create/                  #     ➕ 创建宝宝
│   │   ├── baby-list/                    #     📑 宝宝列表
│   │   └── guide/                        #     📖 使用指南
│   │
│   ├── packageGrowth/                    #   分包：生长健康（4 个页面）
│   │   ├── config/                       #     里程碑定义 + 疫苗计划 + WHO 标准
│   │   └── pages/
│   │       ├── growth/                   #     📈 生长曲线（30KB，Canvas 绘图）
│   │       ├── vaccine/                  #     💉 疫苗追踪
│   │       ├── milestone/                #     🏆 发育里程碑
│   │       └── baby-detail/              #     👶 宝宝详情
│   │
│   ├── packageSocial/                    #   分包：社交协作（6 个页面）
│   │   ├── services/content-filter.js    #     内容安全过滤（AI 问答防注入）
│   │   └── pages/
│   │       ├── ai-assistant/             #     🤖 AI 育儿助手
│   │       ├── family/                   #     👨‍👩‍👧 家庭组管理
│   │       ├── family-create/            #     🏠 创建家庭
│   │       ├── family-join/              #     🔗 加入家庭
│   │       ├── export/                   #     📤 数据导出
│   │       └── settings/                 #     ⚙️ 设置
│   │
│   └── images/                           #   图片资源
│       ├── tab-*.png                     #     TabBar 图标（8 个）
│       ├── icons/                        #     功能图标（93+ 个 PNG）
│       ├── icons/popup/                  #     弹窗图标（11 个）
│       └── icons/easter-egg/             #     彩蛋图标（10 个）
│
├── cloudfunctions/                       # ☁️ 云函数（1 个）
│   └── getOpenId/                        #   获取用户 openid/appid/unionid
│       ├── index.js
│       └── package.json
│
├── scripts/                              # 🔧 构建脚本（6 个）
│   ├── generate-icons.js                 #   批量生成图标（从 SVG 到 PNG）
│   ├── generate-easter-egg-icons.js      #   生成彩蛋图标
│   ├── prepare-icon-resources.js         #   准备图标资源
│   ├── process-manual-icons.js           #   手动图标处理
│   ├── supplement-missing-icons.js       #   补充缺失图标
│   └── migrate-family-roles.js           #   家庭角色数据迁移
│
├── specs/                                # 📐 需求规格文档（11 个迭代方向）
│   ├── home-redesign/                    #   首页重设计
│   ├── family-collaboration/             #   家庭协作
│   ├── full-refactor/                    #   全面重构
│   ├── performance-optimization/         #   性能优化
│   ├── easter-eggs/                      #   彩蛋功能
│   ├── insight-trend-enhancement/        #   洞察趋势增强
│   ├── share-image-v2/                   #   分享图 v2
│   ├── share-image-optimization/         #   分享图优化
│   ├── record-header-redesign/           #   记录页头重设计
│   └── warm-night-mode/                  #   暖色夜间模式
│
├── docs/                                 # 📚 辅助文档
├── rules/                                # 🤖 AI 开发规则（22 个模块）
│
├── architecture.md                       # 项目架构文档
├── data-model.md                         # 数据模型文档
├── coding-conventions.md                 # 编码规范
├── ui-design-system.md                   # UI 设计系统
├── component-library.md                  # 组件库文档
├── service-api.md                        # 服务层 API 文档
├── PRD.md                                # 产品需求文档
│
├── package.json                          # 项目依赖
├── project.config.json                   # 小程序项目配置
└── project.private.config.json           # 私有配置
```

---

## 4. 应用列表

本项目包含 **两个应用**（小程序端 + 云函数端），关系如下：

| 应用 | 路径 | 说明 | 运行环境 |
|------|------|------|---------|
| **小程序端** | `miniprogram/` | 前端 UI + 业务逻辑 + 离线缓存 | 微信客户端 |
| **云函数端** | `cloudfunctions/` | 服务端获取 openid | CloudBase Node.js |

### 4.1 小程序端

前端主应用，18 个页面 + 15 个组件 + 11 个服务 + 12 个工具类，采用**五层架构**：

```
┌────────────────────────────────────────────────────────────┐
│                     页面层 (Page)                            │
│   home / record / discover / profile / auth / ...           │
│   - 管理 UI 状态（setData）、调用服务层、事件处理              │
├────────────────────────────────────────────────────────────┤
│                   组件层 (Component)                         │
│   feeding-popup / timeline / insight-section / ...          │
│   - 封装可复用 UI 逻辑，triggerEvent 与页面通信              │
├────────────────────────────────────────────────────────────┤
│                    服务层 (Service)                          │
│   RecordService / FamilyService / AIService / ...           │
│   - 单例模式、云端优先 + 离线降级、数据格式归一化              │
├────────────────────────────────────────────────────────────┤
│                     工具层 (Util)                            │
│   StorageUtil / NetworkUtil / PermissionUtil / ThemeManager  │
│   - 基础设施能力，无业务耦合                                  │
├────────────────────────────────────────────────────────────┤
│                   数据层 (CloudBase)                         │
│   NoSQL: users / families / babies / records /               │
│          vaccine_records / milestone_records                  │
│   云函数: getOpenId                                          │
└────────────────────────────────────────────────────────────┘
```

### 4.2 云函数端

极简后端，仅 1 个云函数：

| 云函数 | 入口 | 功能 | 依赖 |
|-------|------|------|------|
| `getOpenId` | `index.js` | 获取微信用户 openid/appid/unionid | `wx-server-sdk` |

---

## 5. 依赖调用关系

### 5.1 服务层依赖图

```
                    ┌──────────────┐
                    │   app.js     │
                    └──────┬───────┘
                           │ 初始化
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        AuthService   SyncService   ThemeManager
              │            │
              ▼            ▼
           users集合   StorageUtil ◄──── NetworkUtil
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
        RecordService  FamilyService  BabyService
              │            │             │
              │            ▼             ▼
              │      PermissionUtil   babies集合
              │            │          families集合
              ▼            ▼
         records集合    families集合
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
AIService  TodoService  TrendService
    │         │             │
    ▼         ▼             ▼
 Hunyuan   vaccine_records  RecordService
  AI API   milestone_records

    ┌────────────────────┐
    │  ReportDataHelper  │◄──── TrendService + ThemeManager
    └────────┬───────────┘
             ▼
      ShareCanvasService ──── Canvas 2D API
```

### 5.2 页面 → 服务调用矩阵

| 页面 | AuthService | RecordService | BabyService | FamilyService | AIService | TodoService | TrendService | SyncService |
|------|:-----------:|:------------:|:-----------:|:------------:|:---------:|:-----------:|:------------:|:-----------:|
| home | ● | ● | ● | ● | ● | ● | ● | ● |
| record | | ● | ● | | | | | |
| discover | | | ● | | | ● | | |
| profile | ● | | ● | ● | | | | |
| auth | ● | | ● | ● | | | | |
| growth | | ● | ● | | | | | |
| vaccine | | | ● | | | ● | | |
| milestone | | | ● | | | ● | | |
| ai-assistant | | ● | ● | | ● | | | |
| family | ● | | | ● | | | | |
| settings | ● | | | ● | | | | |
| export | | ● | ● | | | | | |

### 5.3 外部依赖

| 依赖 | 版本 | 用途 | 使用范围 |
|------|------|------|---------|
| `wx-server-sdk` | latest | 云函数 SDK | `cloudfunctions/getOpenId` |
| `axios` | ^1.13.6 | HTTP 请求 | `scripts/`（仅开发时） |
| `sharp` | ^0.34.5 | 图片处理 | `scripts/`（仅开发时） |

> **注意**：小程序运行时无 npm 依赖，所有能力均来自微信原生 API 和 CloudBase SDK。

---

## 6. 数据库设计

6 个 CloudBase NoSQL 集合：

| 集合 | 用途 | 主要字段 | 安全规则 |
|------|------|---------|---------|
| `users` | 用户信息 | nickname, role, relation, familyId, familyRole | 基于 `_openid` 隔离 |
| `families` | 家庭组 | name, members[], memberDetails[], babies[], inviteCode | 创建者可读写 |
| `babies` | 宝宝档案 | familyId, name, gender, birthDate, avatar | 通过 familyId 关联 |
| `records` | 核心记录 | babyId, recordType, startTime/Ts, data{}, createdBy{} | 基于 `_openid` |
| `vaccine_records` | 疫苗记录 | babyId, name, dose, vaccinatedDate | 基于 `_openid` |
| `milestone_records` | 里程碑记录 | babyId, name, category, achievedDate | 基于 `_openid` |

> 详细字段定义参见 [data-model.md](./data-model.md)

---

## 7. 分包策略

| 分包 | 页面数 | 包含页面 | 预加载时机 |
|------|--------|---------|-----------|
| **主包** | 8 | home, record, discover, profile, auth, baby-create, baby-list, guide | — |
| **packageGrowth** | 4 | growth, vaccine, milestone, baby-detail | 首页加载时 |
| **packageSocial** | 6 | ai-assistant, family, family-create, family-join, export, settings | 发现页/我的页加载时 |

---

## 8. 构建与部署

### 8.1 前提条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（最新稳定版）
- 腾讯云开发账号（已开通 CloudBase 环境）
- Node.js ≥ 16（仅图标脚本需要）

### 8.2 本地开发

```bash
# 1. 克隆项目
git clone <repository-url>
cd baby-care-tracker-3

# 2. 安装开发依赖（仅图标脚本需要）
npm install

# 3. 打开微信开发者工具，导入项目
#    - 项目路径：baby-care-tracker-3/
#    - AppID：wx1f1bc8e6ff2be61d（或使用测试号）

# 4. 上传云函数
#    在开发者工具中右键 cloudfunctions/getOpenId → 上传并部署
```

### 8.3 云函数部署

| 云函数 | 运行环境 | 部署方式 |
|-------|---------|---------|
| `getOpenId` | Node.js | 微信开发者工具右键 → 上传并部署（云端安装依赖） |

### 8.4 数据库初始化

首次部署需在 [CloudBase 控制台](https://tcb.cloud.tencent.com/) 创建以下集合：

```
users, families, babies, records, vaccine_records, milestone_records
```

安全规则建议设置为"仅创建者可读写"（基于 `_openid`）。

### 8.5 图标资源生成

```bash
# 生成全部功能图标
node scripts/generate-icons.js

# 生成彩蛋图标
node scripts/generate-easter-egg-icons.js

# 补充缺失图标
node scripts/supplement-missing-icons.js
```

---

## 9. 性能优化策略

| 策略 | 实现 | 应用场景 |
|------|------|---------|
| 30s 节流 | onShow 时间戳判断 | 所有 TabBar 页面 |
| 15s 内存缓存 | `_todayStatsCache` | RecordService.getTodayStats |
| 30s 内存缓存 | `_cache` | TodoService / TrendService |
| 3s 去重窗口 | DeduplicationUtil | 记录 CRUD 防重复提交 |
| 分批并发 | `batchExecute(items, fn, 10)` | 批量删除 |
| 分页查询 | `fetchAll()` | 突破云数据库 20 条限制 |
| 合并 setData | 多计算结果一次调用 | 首页数据加载 |
| 懒加载 | `lazyCodeLoading: requiredComponents` | 全局配置 |
| 分包预加载 | `preloadRule` | 首页→Growth，发现→全部 |

---

## 10. 项目文档体系

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目 README | `README.md` | 本文件，项目概述与全局导航 |
| 小程序 README | `miniprogram/README.md` | 小程序应用详细文档 |
| 云函数 README | `cloudfunctions/README.md` | 云函数应用详细文档 |
| 产品需求 | `PRD.md` | 产品需求文档（v3.1） |
| 架构文档 | `architecture.md` | 五层架构、初始化流程、设计决策 |
| 数据模型 | `data-model.md` | 6 个集合字段定义、缓存策略 |
| 编码规范 | `coding-conventions.md` | 命名约定、代码模式、错误处理 |
| UI 设计系统 | `ui-design-system.md` | 美拉德色系、间距、字体、动画 |
| 组件库 | `component-library.md` | 15 个组件的属性/事件说明 |
| 服务层 API | `service-api.md` | 11 个服务的方法签名与返回结构 |

---

## 11. 开发规范

- **单例模式**：所有 Service 类使用单例，通过 `getInstance()` 获取
- **双时间戳**：所有时间字段同时写入 `serverDate()` 和数值时间戳 `Ts`
- **向后兼容**：创建者信息同时写入新对象格式和旧扁平格式
- **离线优先**：写操作先更新本地缓存，再同步云端
- **权限检查**：写操作前通过 `PermissionUtil.canEdit()` 检查
- **错误处理**：三模式（静默降级 / Toast 提示 / Modal 确认）

> 详细规范参见 [coding-conventions.md](./coding-conventions.md)

---

## 12. 版本历史

| 版本 | 代号 | 日期 | 主要变更 |
|------|------|------|---------|
| v4.2.0 | Milo | 2026-04-17 | 云函数网关（13 action 服务端鉴权）、安全规则治理、familyId 数据迁移 |
| v4.1.0 | Milo | 2026-04-15 | AI 能力屏蔽、分享认证加固、全页面登录守卫、Family 安全修复 |
| v4.0.1 | Milo | 2026-04-13 | 配方奶快捷用量调整 [10-210ml] |
| v4.0.0 | Milo | 2026-04-13 | 美拉德 UI 重设计、暗色模式 28 项 QA、focus-card 组件 |
| v3.2.0 | Lullaby | 2026-04-10 | Git Flow + 三阶段开发工作流规范（首个 Git 管理版本） |
| v3.1 | Lullaby | 2026-04-08 | 暖色夜间模式、分享图 v2、性能优化 |
| v3.0 | Lullaby | 2026-04-03 | 首页重设计、家庭协作增强、彩蛋系统 |
| v2.0 | Cradle | 2026-03-27 | 全面重构、洞察趋势增强、记录页头重设计 |
| v1.0 | Sprout | 2026-03-25 | 初始版本，核心记录功能 |

> 详细变更日志参见 [CHANGELOG.md](./CHANGELOG.md)

---

## License

Private Project — All Rights Reserved.
