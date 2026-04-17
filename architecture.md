# Baby Care Tracker 项目架构文档

> **版本**: v4.2.1 | **更新日期**: 2026-04-17

---

## 1. 项目概述

**Baby Care Tracker** 是一款面向 0-36 个月婴幼儿父母的微信小程序，基于 CloudBase AI ToolKit 开发。

- **AppID**: `wx1f1bc8e6ff2be61d`
- **CloudBase 环境 ID**: `neo3-7gtg0bdtc9fcc672`
- **基础库版本**: 2.7.3 (配置) / 3.15.0 (私有)

### 技术栈

| 层级 | 技术选型 |
|-----|---------|
| 前端框架 | 微信小程序原生（WXML + WXSS + JS） |
| 后端服务 | CloudBase 云开发 |
| 数据库 | CloudBase NoSQL |
| AI 服务 | Hunyuan AI (`hunyuan-2.0-instruct-20251111`) |
| 存储 | 微信本地存储 + 云存储 |
| 实时通信 | 云开发实时数据推送（watch，预留接口） |

---

## 2. 目录结构

```
baby-care-tracker-3/
├── package.json                          # 开发依赖 (axios, sharp)
├── project.config.json                   # 小程序项目配置
├── PRD.md                                # 产品需求文档 (v3.1)
├── README.md                             # 项目说明
│
├── cloudfunctions/                       # 云函数（仅 1 个）
│   └── getOpenId/                        # 获取用户 openid
│
├── miniprogram/                          # 小程序主代码
│   ├── app.js                            # 应用入口
│   ├── app.json                          # 应用配置（路由、TabBar、分包）
│   ├── app.wxss                          # 全局样式（美拉德色系设计系统）
│   │
│   ├── models/index.js                   # JSDoc 类型定义 + 工厂函数
│   ├── behaviors/swipe-close.js          # 弹窗下滑关闭手势 Behavior
│   ├── behaviors/share-behavior.js       # 全局分享 Behavior（onShareAppMessage + onShareTimeline）
│   ├── config/who-standards.js           # WHO 生长标准数据
│   │
│   ├── services/                         # 服务层 (11个文件)
│   │   ├── ai.js                         # AI 服务 (Hunyuan)
│   │   ├── auth.js                       # 认证服务
│   │   ├── baby.js                       # 宝宝管理
│   │   ├── family.js                     # 家庭组服务 (17KB)
│   │   ├── record.js                     # 记录服务（核心，28KB）
│   │   ├── sync.js                       # 离线同步服务
│   │   ├── todo.js                       # 待办统计服务
│   │   ├── quota.js                      # AI 配额管理
│   │   ├── trendService.js               # 趋势分析 (21KB)
│   │   ├── reportDataHelper.js           # 报告数据辅助 (15KB)
│   │   └── share-canvas.js              # 分享图 Canvas 绘制 (44KB)
│   │
│   ├── utils/                            # 工具库 (11个文件)
│   │   ├── storage.js                    # 本地存储封装
│   │   ├── date.js                       # 日期/月龄工具
│   │   ├── permission.js                 # 权限管理
│   │   ├── network.js                    # 网络状态监测
│   │   ├── debounce.js                   # 防抖/节流
│   │   ├── deduplication.js              # 去重工具
│   │   ├── batch.js                      # 分批并发控制
│   │   ├── db-helper.js                  # 数据库分页查询
│   │   ├── icon-config.js                # 图标配置中心
│   │   ├── easter-egg.js                 # 彩蛋检测系统
│   │   └── format.wxs                    # WXS 格式化
│   │
│   ├── styles/                           # 共享样式
│   │   ├── form.wxss / loading.wxss / page-header.wxss / popup.wxss
│   │
│   ├── components/                       # 自定义组件 (15个)
│   │   ├── feeding-popup/                # 喂养记录弹窗
│   │   ├── sleep-popup/                  # 睡眠记录弹窗
│   │   ├── diaper-popup/                 # 排便记录弹窗
│   │   ├── temperature-popup/            # 体温记录弹窗
│   │   ├── growth-popup/                 # 生长记录弹窗
│   │   ├── timeline/                     # 时间线组件
│   │   ├── insight-section/              # 洞察区组件
│   │   ├── report-popup/                 # 成长报告弹窗
│   │   ├── export-popup/                 # 导出弹窗
│   │   ├── baby-card/                    # 宝宝信息卡片
│   │   ├── baby-edit-popup/              # 宝宝编辑弹窗
│   │   ├── error-state/                  # 错误状态组件（全局注册）
│   │   ├── icon/                         # 图标组件
│   │   ├── focus-card/                   # 聚焦卡片（v4.0 新增）
│   │   ├── easter-egg-popup/             # 彩蛋弹窗
│   │   └── easter-egg-toast/             # 彩蛋 Toast
│   │
│   ├── pages/                            # 主包页面 (8个)
│   │   ├── home/                         # 首页（Tab）
│   │   ├── record/                       # 记录列表（Tab）
│   │   ├── discover/                     # 发现页（Tab）
│   │   ├── profile/                      # 我的（Tab）
│   │   ├── auth/                         # 登录/引导
│   │   ├── baby-create/                  # 创建宝宝
│   │   ├── baby-list/                    # 宝宝列表
│   │   └── guide/                        # 使用指南
│   │
│   ├── packageGrowth/                    # 分包：生长健康
│   │   ├── config/                       # 里程碑定义、疫苗计划、WHO标准
│   │   └── pages/                        # growth/vaccine/milestone/baby-detail
│   │
│   └── packageSocial/                    # 分包：社交协作
│       ├── services/content-filter.js    # 内容安全过滤
│       └── pages/                        # ai-assistant/family/export/settings
│
├── scripts/                              # 构建/工具脚本 (6个)
├── specs/                                # 需求规格文档 (9个子目录)
├── docs/                                 # 项目文档
└── rules/                                # AI 开发规则
```

---

## 3. 分层架构

```
┌────────────────────────────────────────────┐
│                 页面层 (Page)                │
│  home / record / discover / profile / ...   │
│  - 管理 UI 状态（setData）                    │
│  - 调用服务层获取数据                          │
│  - 用户交互事件处理                            │
├────────────────────────────────────────────┤
│               组件层 (Component)              │
│  feeding-popup / timeline / insight / ...    │
│  - 封装可复用 UI 逻辑                          │
│  - 通过 triggerEvent 与页面通信                │
│  - 共享 swipe-close Behavior                  │
├────────────────────────────────────────────┤
│               服务层 (Service)               │
│  RecordService / FamilyService / ...         │
│  - 业务逻辑封装（单例模式）                     │
│  - 云端优先 + 离线降级策略                      │
│  - 数据格式归一化和兼容处理                     │
├────────────────────────────────────────────┤
│               工具层 (Util)                   │
│  StorageUtil / NetworkUtil / PermissionUtil   │
│  ThemeManager (主题管理器)                      │
│  - 基础设施能力                                │
│  - 无业务耦合                                  │
├────────────────────────────────────────────┤
│               数据层 (CloudBase NoSQL)        │
│  users / families / babies / records /        │
│  vaccine_records / milestone_records          │
│  - 安全规则基于 _openid 隔离                   │
│  - 仅 1 个云函数 (getOpenId)                  │
└────────────────────────────────────────────┘
```

---

## 4. 分包策略

| 分包名 | 页面 | 首页预加载 |
|-------|------|----------|
| 主包 | home, record, discover, profile, auth, baby-create, baby-list, guide | - |
| packageGrowth | growth, vaccine, milestone, baby-detail | 首页预加载 |
| packageSocial | ai-assistant, family, family-create, family-join, export, settings | 发现页/我的页预加载 |

---

## 5. 全局初始化流程

```
App.onLaunch()
    ├── wx.cloud.init() → CloudBase 初始化
    ├── 缓存 systemInfo（新 API: getDeviceInfo + getWindowInfo + getAppBaseInfo）
    ├── initUser() → AuthService.getUserInfo()
    │               → 保存到 globalData + StorageUtil
    │               → 返回 Promise 存到 globalData.initPromise
    ├── initSync() → SyncService.getInstance()
    │              → 检查并同步离线队列
    └── 延迟 5s → cleanOrphanedCache()（清理孤立记录缓存）
    └── ThemeManager.init()（初始化主题管理器，读取持久化偏好）

页面加载（v4.1 统一模式）:
    Page.onLoad() / Page.init()
        → const check = await app.ensureUserReady()
        → if (!check.ready) → wx.reLaunch(check.redirectUrl)
        → check.userInfo / check.familyInfo 已就绪
        → 加载 familyBabies / currentBaby
        → setData() 渲染 UI

    TabBar Page.onShow()
        → if (app.checkFamilyStale()) → this.init()（强制重新校验）
        → 否则 30s 节流正常刷新
```

---

## 6. 核心设计决策

### 6.1 离线优先（Offline-First）
所有写操作先写本地缓存（立即生效），再同步到云端。离线时自动进入队列，网络恢复后批量同步（最大 3 次重试）。

### 6.2 双时间戳设计
所有时间字段同时写入 `serverDate()`（云端可靠）和数值时间戳 `Ts`（客户端可靠查询），解决微信云数据库 serverDate 在客户端不可直接比较的问题。

### 6.3 三层缓存体系
- `app.globalData`（应用级，内存）
- `wx.setStorageSync`（持久化，跨启动）
- 服务层内存缓存（15-30s TTL，如 RecordService._todayStatsCache）

### 6.4 向后兼容
- 创建者信息同时写入新对象格式和旧扁平格式
- 排便类型兼容新旧字段名
- 时间戳解析支持 6 种格式

### 6.5 安全模型
小程序端直接操作数据库，通过云开发安全规则基于 `_openid` 隔离数据权限。仅有 1 个云函数用于获取 openid。

---

## 7. 性能优化策略

| 策略 | 实现 | 应用点 |
|------|------|--------|
| 30s 节流 | `onShow` 中时间戳判断 | 所有 TabBar 页面 |
| 15s 内存缓存 | `_todayStatsCache` | RecordService.getTodayStats |
| 30s 内存缓存 | `TodoService._cache` | 待办统计 |
| 16ms 节流 | `throttle()` | 弹窗触摸移动 |
| 3s 去重窗口 | `DeduplicationUtil.check()` | 记录 CRUD |
| 分批并发 | `batchExecute(items, fn, 10)` | 批量删除 |
| 分页查询 | `db-helper.fetchAll()` | 突破 20 条限制 |
| 合并 setData | 多个计算结果合并一次调用 | 首页数据加载 |
| 延迟执行 | `setTimeout` | 彩蛋检测 500ms、缓存清理 5s |
| 懒加载 | `"lazyCodeLoading": "requiredComponents"` | app.json 全局配置 |
| 分包预加载 | `preloadRule` | 首页→Growth、发现→全部 |

---

*文档维护：每次产品迭代后，更新对应的架构变更部分。*
