# Baby Care Tracker — 小程序端

> 小程序前端应用，包含 18 个页面、15 个组件、11 个服务、12 个工具类，采用五层架构实现离线优先的婴幼儿养护记录系统。

---

## 1. 应用概述

| 属性 | 值 |
|------|-----|
| **应用类型** | 微信小程序（原生开发） |
| **入口文件** | `app.js` |
| **路由配置** | `app.json` |
| **全局样式** | `app.wxss`（美拉德色系设计系统） |
| **主题配置** | `theme.json`（light/dark 双主题） |
| **代码规模** | ~351 个文件（JS/WXML/WXSS/JSON/PNG） |
| **页面总数** | 18 个（主包 8 + packageGrowth 4 + packageSocial 6） |
| **组件总数** | 15 个自定义组件 |

### 核心设计决策

1. **离线优先（Offline-First）**：写操作先写本地缓存立即生效，后台异步同步云端；离线时进入队列，网络恢复后自动批量同步（最大 3 次重试）
2. **双时间戳**：所有时间字段同时写入 `serverDate()`（云端可靠）和数值时间戳 `Ts`（客户端可查询比较）
3. **三层缓存**：globalData 内存 → wx.localStorage → 服务层 TTL 缓存（15-30s）
4. **三级权限**：admin（管理员）/ editor（成员）/ viewer（仅查看）
5. **单例服务**：所有 Service 类通过 `getInstance()` 获取单例实例

---

## 2. 目录结构

```
miniprogram/
├── app.js                                # 应用入口
├── app.json                              # 路由 + TabBar + 分包 + 预加载
├── app.wxss                              # 全局样式（CSS 变量 + 美拉德色系）
├── theme.json                            # 亮色/暗色主题变量
├── sitemap.json                          # 微信索引配置
│
├── models/
│   └── index.js                          # 数据模型（JSDoc 类型 + 工厂函数）
│
├── config/
│   └── who-standards.js                  # WHO 生长标准数据
│
├── behaviors/
│   ├── swipe-close.js                    # 弹窗下滑关闭手势 Behavior
│   └── share-behavior.js                 # 全局分享 Behavior
│
├── services/                             # ★ 服务层（业务逻辑核心）
│   ├── auth.js                           # AuthService       - 用户认证
│   ├── record.js                         # RecordService      - 记录 CRUD
│   ├── baby.js                           # BabyService        - 宝宝管理
│   ├── family.js                         # FamilyService      - 家庭组管理
│   ├── ai.js                             # AIService          - AI 对话
│   ├── quota.js                          # QuotaService       - AI 配额
│   ├── sync.js                           # SyncService        - 离线同步
│   ├── todo.js                           # TodoService        - 待办统计
│   ├── trendService.js                   # TrendService       - 趋势分析
│   ├── reportDataHelper.js               # ReportDataHelper   - 报告计算
│   └── share-canvas.js                   # ShareCanvasService - 分享图绘制
│
├── utils/                                # ★ 工具层（基础设施）
│   ├── storage.js                        # StorageUtil         - 本地存储
│   ├── network.js                        # NetworkUtil         - 网络监测
│   ├── permission.js                     # PermissionUtil      - 权限检查
│   ├── theme.js                          # ThemeManager        - 主题管理
│   ├── date.js                           # DateUtil            - 日期/月龄
│   ├── debounce.js                       # debounce/throttle   - 防抖节流
│   ├── deduplication.js                  # DeduplicationUtil   - 操作去重
│   ├── batch.js                          # batchExecute        - 分批并发
│   ├── db-helper.js                      # fetchAll            - 分页查询
│   ├── icon-config.js                    # ICON_CONFIG         - 图标配置
│   ├── easter-egg.js                     # EasterEggDetector   - 彩蛋检测
│   └── format.wxs                        # WXS 格式化函数
│
├── styles/                               # 共享样式
├── components/                           # 自定义组件（15 个）
├── pages/                                # 主包页面（8 个）
├── packageGrowth/                        # 分包：生长健康
├── packageSocial/                        # 分包：社交协作
└── images/                               # 图片资源
```

---

## 3. 接口列表（Service API）

### 3.1 AuthService（`services/auth.js`）

用户认证服务，微信小程序天然免登录。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getOpenId()` | — | `Promise<string>` | 通过云函数获取 openid |
| `getUserInfo()` | — | `Promise<User>` | 获取或自动创建用户记录 |
| `updateUserInfo(userId, data)` | userId: string, data: Object | `Promise<void>` | 更新用户信息 |
| `deleteUser(userId)` | userId: string | `Promise<void>` | 删除用户 |

### 3.2 RecordService（`services/record.js`）— 核心

记录 CRUD 服务，实现云端优先 + 离线降级。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createRecord(babyId, recordData)` | babyId, recordData | `Promise<Record>` | 创建记录（含双时间戳、去重检查） |
| `updateRecord(recordId, data)` | recordId, data | `Promise<void>` | 更新记录 |
| `deleteRecord(recordId, babyId)` | recordId, babyId | `Promise<void>` | 删除记录（含缓存同步） |
| `batchDeleteRecords(recordIds, babyId)` | recordIds[], babyId | `Promise<Object>` | 批量删除（分批并发，每批 10 条） |
| `getRecords(babyId, options)` | babyId, { type, startDate, endDate, limit } | `Promise<Record[]>` | 查询记录（带筛选） |
| `getTodayStats(babyId)` | babyId | `Promise<TodayStats>` | 今日统计（15s 缓存） |
| `getLatestRecord(babyId, type)` | babyId, type | `Promise<Record\|null>` | 获取最新一条指定类型记录 |
| `getActiveSleep(babyId)` | babyId | `Promise<Record\|null>` | 获取进行中的睡眠记录 |
| `processCloudRecord(record)` | record | `Record` | 处理云端记录时间格式 |
| `static normalizeCreatedBy(record)` | record | `CreatedBy` | 统一创建者信息格式 |

### 3.3 BabyService（`services/baby.js`）

宝宝档案管理。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createBaby(familyId, name, gender, birthDate, avatar?)` | — | `Promise<Baby>` | 创建宝宝并关联到家庭 |
| `getBabiesByFamilyId(familyId)` | familyId | `Promise<Baby[]>` | 获取家庭宝宝列表 |
| `getBabyById(babyId)` | babyId | `Promise<Baby>` | 获取宝宝详情 |
| `updateBaby(babyId, data)` | babyId, data | `Promise<void>` | 更新宝宝信息 |
| `uploadAvatar(babyId, filePath)` | babyId, filePath | `Promise<string>` | 上传头像到云存储 |
| `deleteBaby(babyId, familyId)` | babyId, familyId | `Promise<void>` | 删除宝宝（原子操作 pull） |
| `calculateAgeInMonths(birthDate)` | birthDate | `number` | 计算月龄 |
| `calculateAgeInDays(birthDate)` | birthDate | `number` | 计算天数 |
| `formatAge(birthDate)` | birthDate | `string` | 格式化年龄显示 |

### 3.4 FamilyService（`services/family.js`）

家庭组管理，含邀请码、成员权限。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createFamily({ name, creatorId, creatorName })` | options | `Promise<Family>` | 创建家庭（生成 6 位邀请码） |
| `joinFamily(inviteCode, memberInfo)` | inviteCode, { userId, userName, relation } | `Promise<Family>` | 通过邀请码加入家庭 |
| `leaveFamily(familyId, userId)` | familyId, userId | `Promise<void>` | 离开家庭 |
| `dissolveFamily(familyId)` | familyId | `Promise<void>` | 解散家庭（仅 admin） |
| `getFamilyInfo(familyId)` | familyId | `Promise<Family>` | 获取家庭详情 |
| `refreshInviteCode(familyId)` | familyId | `Promise<string>` | 刷新邀请码（7 天有效） |
| `updateMemberRole(familyId, userId, newRole)` | — | `Promise<void>` | 修改成员角色 |
| `removeMember(familyId, userId)` | — | `Promise<void>` | 移除成员（仅 admin） |
| `linkBabyToFamily(familyId, babyId)` | — | `Promise<void>` | 关联宝宝到家庭 |

### 3.5 AIService（`services/ai.js`）

AI 对话服务，基于腾讯混元大模型。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `generateText(prompt, context?)` | prompt, context | `Promise<string>` | 文本生成（非流式） |
| `streamText(prompt, context?, callbacks?)` | prompt, context, { onText, onEvent, onFinish } | `Promise<void>` | 流式文本生成 |
| `generateFeedingAdvice(babyAge, records, babyInfo)` | — | `Promise<string>` | 生成喂养建议 |
| `generateSleepAdvice(babyAge, records, babyInfo)` | — | `Promise<string>` | 生成睡眠建议 |

### 3.6 QuotaService（`services/quota.js`）

AI 每日使用配额管理（100 次/天）。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getQuotaInfo()` | — | `{ used, remaining, date }` | 获取今日配额 |
| `hasQuota()` | — | `boolean` | 是否还有配额 |
| `useQuota()` | — | `boolean` | 使用一次配额 |

### 3.7 SyncService（`services/sync.js`）

离线同步服务，含队列管理和网络监听。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `syncOfflineQueue()` | — | `Promise<SyncResult>` | 同步离线队列（最大 3 次重试） |
| `getSyncStatus()` | — | `SyncStatus` | 获取同步状态 |
| `subscribeRecords(babyId, onChange)` | — | `Watcher` | ⚠️ 预留接口，当前无调用 |
| `subscribeFamily(familyId, onChange)` | — | `Watcher` | ⚠️ 预留接口，当前无调用 |

### 3.8 TodoService（`services/todo.js`）

疫苗 + 里程碑待办统计（30s 缓存）。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getTodoStats(baby)` | baby: { _id, birthDate } | `Promise<TodoStats>` | 获取待办统计（带缓存） |
| `forceRefresh(baby)` | baby | `Promise<TodoStats>` | 强制刷新（跳过缓存） |
| `clearCache()` | — | `void` | 清除缓存 |

### 3.9 TrendService（`services/trendService.js`）

周环比趋势分析，含 NSF/AAP/CDC 参考范围。

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getTrend(babyId, type, ageMonths)` | `Promise<TrendData>` | 获取指定类型的趋势数据 |
| `getAllTrends(babyId, ageMonths)` | `Promise<AllTrends>` | 获取所有类型趋势 |
| `getDailyBreakdown(babyId, type, days)` | `Promise<DailyData[]>` | 获取每日明细 |

### 3.10 ReportDataHelper（`services/reportDataHelper.js`）

成长报告数据计算，供 report-popup 和 share-canvas 共用。

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getScoreLabel(score)` | `string` | 评分等级文本 |
| `getScoreColor(score)` | `string` | 评分等级颜色 |
| `buildMetricCards(trends)` | `MetricCard[]` | 构建指标卡数据 |

### 3.11 ShareCanvasService（`services/share-canvas.js`）

分享图 Canvas 绘制服务（DPR 限制为 2，JPG 导出质量 0.85）。

---

## 4. 业务流程图

### 4.1 应用初始化流程

```
App.onLaunch()
    │
    ├─► wx.cloud.init({ env: 'neo3-7gtg0bdtc9fcc672' })
    │
    ├─► 缓存 systemInfo（getDeviceInfo + getWindowInfo + getAppBaseInfo）
    │
    ├─► initUser() ──────────────────────────────────────────────┐
    │   │                                                         │
    │   ├─► AuthService.getUserInfo()                            │
    │   │   ├─► users.where({}).limit(1).get()                   │
    │   │   │   ├─ 已有记录 → 返回用户信息                        │
    │   │   │   └─ 无记录 → users.add(newUser) → 返回            │
    │   │   └─► 保存到 globalData + StorageUtil                  │
    │   └─► 返回 Promise → globalData.initPromise                │
    │                                                             │
    ├─► initSync() ──────────────────────────────────────────────┤
    │   ├─► SyncService.getInstance()                            │
    │   ├─► 检查离线队列                                          │
    │   │   └─ 有待同步 + 在线 → syncOfflineQueue()              │
    │   └─► 保存到 globalData.syncService                        │
    │                                                             │
    ├─► setTimeout(5s) → cleanOrphanedCache()                    │
    │                                                             │
    └─► ThemeManager.init()（读取持久化主题偏好）                   │
                                                                  │
Page.onLoad()                                                     │
    └─► await app.globalData.initPromise ◄────────────────────────┘
        └─► 从缓存/云端加载数据 → setData() 渲染
```

### 4.2 记录创建流程（离线优先）

```
用户点击"添加记录"
    │
    ├─► 打开对应弹窗组件（feeding-popup / sleep-popup / ...）
    │
    ├─► 用户填写数据 → 点击"保存"
    │
    ├─► PermissionUtil.canEdit() ─── 检查权限
    │   └─ viewer → 提示无权限，终止
    │
    ├─► DeduplicationUtil.check() ─── 3s 去重窗口
    │   └─ 重复操作 → 静默忽略
    │
    ├─► 构建记录数据
    │   ├─ startTime: db.serverDate()       ← 云端可靠时间
    │   ├─ startTimeTs: Date.now()          ← 客户端时间戳
    │   ├─ createdBy: { userId, nickName }  ← 新格式
    │   └─ creatorId: userId                ← 旧格式（兼容）
    │
    ├─► NetworkUtil.checkOnline()
    │   │
    │   ├─ 在线 ───────────────────────────────────┐
    │   │   ├─► records.add({ data })               │
    │   │   ├─► 更新本地缓存 records_{babyId}       │
    │   │   └─► triggerEvent('save', record)        │
    │   │                                            │
    │   └─ 离线 ───────────────────────────────────┐│
    │       ├─► 生成临时 ID (temp_xxx)              ││
    │       ├─► 写入本地缓存（标记 _offline:true）  ││
    │       ├─► StorageUtil.addToOfflineQueue()     ││
    │       └─► triggerEvent('save', record)        ││
    │                                               ││
    └─► 关闭弹窗，页面刷新统计  ◄──────────────────┘│
                                                     │
    网络恢复后：                                      │
    SyncService.syncOfflineQueue() ◄─────────────────┘
        ├─► 遍历队列逐条执行
        ├─► 成功：替换临时 ID 为真实 ID
        ├─► 失败：retryCount++
        │   ├─ < 3 → 保留队列等待下次
        │   └─ ≥ 3 → 移出队列，提示用户
        └─► 更新本地队列
```

### 4.3 AI 洞察生成流程

```
首页加载 / 手动刷新
    │
    ├─► 检查本地缓存 ai_insight_{babyId}_{date}
    │   └─ 命中 → 直接展示
    │
    ├─► QuotaService.hasQuota()
    │   └─ 超限 → 显示配额提示
    │
    ├─► 获取今日记录 → 构建提示词
    │
    ├─► AIService.generateText(prompt, systemContext)
    │   ├─ 模型: hunyuan-2.0-instruct-20251111
    │   └─ 超时: 8 秒
    │
    ├─► 成功 → 缓存结果 + QuotaService.useQuota()
    │
    └─► 失败 → 降级：本地规则生成简要摘要
```

### 4.4 家庭协作流程

```
用户 A（创建者）                         用户 B（加入者）
    │                                        │
    ├─► 创建家庭                              │
    │   ├─ 生成 6 位邀请码                    │
    │   ├─ 有效期 7 天                        │
    │   └─ 角色: admin                        │
    │                                        │
    ├─► 分享邀请码 ──────────────────────►    │
    │                                        │
    │                                 ├─► 输入邀请码
    │                                 │
    │                                 ├─► FamilyService.joinFamily()
    │                                 │   ├─ 校验邀请码有效性
    │                                 │   ├─ 检查是否已在家庭中
    │                                 │   ├─ 原子操作 push 到 members[]
    │                                 │   └─ 添加 memberDetails[]
    │                                 │
    │                                 └─► 角色: editor（默认）
    │                                        │
    ├─► 可修改 B 的角色:                      │
    │   admin / editor / viewer              │
    │                                        │
    └── 共享同一家庭的宝宝数据 ◄─────────────┘
        (通过 familyId 关联 babies → records)
```

### 4.5 生长曲线流程

```
发现页 → 生长曲线
    │
    ├─► 获取宝宝所有 growth 类型记录
    │
    ├─► 加载 WHO 生长标准数据
    │   ├─ 身高-年龄标准（男/女）
    │   ├─ 体重-年龄标准（男/女）
    │   └─ 头围-年龄标准（男/女）
    │
    ├─► 计算百分位线（P3/P15/P50/P85/P97）
    │
    ├─► Canvas 2D 绘制
    │   ├─ 背景百分位区间
    │   ├─ 宝宝实际数据点
    │   └─ 交互标注
    │
    └─► 支持身高/体重/头围/BMI 切换
```

---

## 5. 依赖关系

### 5.1 服务层内部依赖

```
AuthService ─────────────► users 集合
    ↑
    │ getUserInfo()
    │
BabyService ─────────────► babies 集合
    │                        families 集合
    │ createBaby/models
    ↓
models/index.js ◄──── FamilyService
                          │
                          ├──► families 集合
                          ├──► users 集合
                          └──► PermissionUtil

RecordService ───────────► records 集合
    │                        StorageUtil
    │                        NetworkUtil
    │                        DeduplicationUtil
    │                        date.js (parseTimestamp)
    ↓
TrendService ◄─── RecordService
    ↓
ReportDataHelper ◄─── TrendService + ThemeManager
    ↓
ShareCanvasService ◄─── ReportDataHelper

AIService ───────────────► wx.cloud.extend.AI (Hunyuan)

QuotaService ────────────► StorageUtil

SyncService ─────────────► StorageUtil + NetworkUtil

TodoService ─────────────► vaccine_records + milestone_records
                            date.js + db-helper.js
```

### 5.2 工具层依赖

```
StorageUtil        ← 无依赖（基础层）
NetworkUtil        ← 无依赖（基础层）
PermissionUtil     ← 无依赖（基础层）
ThemeManager       ← StorageUtil
DateUtil           ← 无依赖
DeduplicationUtil  ← 无依赖
db-helper          ← 无依赖
EasterEggDetector  ← 无依赖
```

### 5.3 组件 → 服务依赖

| 组件 | 依赖的服务/工具 |
|------|----------------|
| feeding-popup | RecordService, StorageUtil, swipe-close Behavior |
| sleep-popup | RecordService, StorageUtil, swipe-close |
| diaper-popup | RecordService, StorageUtil, swipe-close |
| temperature-popup | RecordService, StorageUtil, swipe-close |
| growth-popup | RecordService, StorageUtil, swipe-close |
| timeline | RecordService, ThemeManager, DateUtil |
| insight-section | AIService, QuotaService, StorageUtil |
| report-popup | RecordService, TrendService, ReportDataHelper, ShareCanvasService |
| export-popup | RecordService, BabyService |
| baby-card | BabyService |
| baby-edit-popup | BabyService |
| easter-egg-popup | EasterEggDetector |

---

## 6. 页面详情

### 6.1 主包页面

| 页面 | 路径 | 大小 | 功能 | 关键组件 |
|------|------|------|------|---------|
| **首页** | `pages/home/home` | 36KB | 问候区 + 状态横幅 + 今日概览 + 喂养预测 + AI 洞察 + 时间线 + 快捷记录 | timeline, insight-section, feeding/sleep/diaper/temperature/growth-popup, report-popup, easter-egg-popup, easter-egg-toast |
| **记录** | `pages/record/record` | 26KB | 记录列表 + 筛选搜索 + 批量管理 + 左滑编辑删除 | feeding/sleep/diaper/temperature/growth-popup, export-popup |
| **发现** | `pages/discover/discover` | 6KB | 功能入口（疫苗/生长/里程碑/AI 助手） | — |
| **我的** | `pages/profile/profile` | 5KB | 宝宝管理 + 家庭 + 导出 + 设置入口 | — |
| **登录** | `pages/auth/auth` | 15KB | 引导注册 + 身份选择 + 创建宝宝 | — |
| **创建宝宝** | `pages/baby-create/baby-create` | 5KB | 宝宝信息表单 | — |
| **宝宝列表** | `pages/baby-list/baby-list` | 5KB | 宝宝管理列表 | baby-card, baby-edit-popup |
| **使用指南** | `pages/guide/guide` | 3KB | 功能引导页 | — |

### 6.2 packageGrowth 分包

| 页面 | 路径 | 大小 | 功能 |
|------|------|------|------|
| **生长曲线** | `packageGrowth/pages/growth/growth` | 30KB | WHO 标准对照 + Canvas 曲线图 + 身高/体重/头围/BMI |
| **疫苗追踪** | `packageGrowth/pages/vaccine/vaccine` | 13KB | 国家免疫规划 + 接种记录 + 提醒 |
| **里程碑** | `packageGrowth/pages/milestone/milestone` | 13KB | 发育里程碑追踪（大运动/精细/语言/社交） |
| **宝宝详情** | `packageGrowth/pages/baby-detail/baby-detail` | 5KB | 宝宝信息详情 + 编辑 |

### 6.3 packageSocial 分包

| 页面 | 路径 | 大小 | 功能 |
|------|------|------|------|
| **AI 助手** | `packageSocial/pages/ai-assistant/ai-assistant` | 12KB | 育儿问答 + 流式输出 + 内容安全过滤 |
| **家庭管理** | `packageSocial/pages/family/family` | 16KB | 成员列表 + 权限管理 + 邀请码 |
| **创建家庭** | `packageSocial/pages/family-create/family-create` | 2KB | 家庭创建表单 |
| **加入家庭** | `packageSocial/pages/family-join/family-join` | 2KB | 邀请码输入 |
| **数据导出** | `packageSocial/pages/export/export` | 8KB | 数据导出配置 |
| **设置** | `packageSocial/pages/settings/settings` | 12KB | 主题切换 + 缓存管理 + 关于 |

---

## 7. 配置说明

### 7.1 CloudBase 环境配置

```javascript
// app.js
wx.cloud.init({
  env: 'neo3-7gtg0bdtc9fcc672',  // CloudBase 环境 ID
  traceUser: true,                 // 开启用户追踪
});
```

### 7.2 AI 模型配置

```javascript
// services/ai.js
this.ai = wx.cloud.extend.AI;
this.model = this.ai.createModel('hunyuan-exp');
// 实际调用使用: 'hunyuan-2.0-instruct-20251111'
```

### 7.3 配额配置

```javascript
// services/quota.js
this.DAILY_LIMIT = 100;       // AI 每日调用上限
this.STORAGE_KEY = 'ai_quota'; // 本地存储键
```

### 7.4 缓存 TTL 配置

| 缓存 | 位置 | TTL | 键名 |
|------|------|-----|------|
| 今日统计 | RecordService 内存 | 15 秒 | `_todayStatsCache` |
| 待办统计 | TodoService 内存 | 30 秒 | `_cache` |
| 趋势数据 | TrendService 内存 | 30 秒 | `_cache` / `_periodCache` |
| 去重窗口 | DeduplicationUtil 内存 | 3 秒 | `pendingOperations` |
| 用户信息 | localStorage | 长期 | `user_info` |
| 当前宝宝 | localStorage | 长期 | `current_baby` |
| 家庭信息 | localStorage | 长期 | `family_info` |
| 记录缓存 | localStorage | 实时同步 | `records_{babyId}` |
| 离线队列 | localStorage | 持久 | `offline_queue` |
| AI 配额 | localStorage | 每日重置 | `ai_quota` |
| AI 洞察 | localStorage | 当日有效 | `ai_insight_{babyId}_{date}` |
| 主题偏好 | localStorage | 长期 | `app_theme_mode` |

### 7.5 权限矩阵

| 操作 | Admin | Editor | Viewer |
|------|:-----:|:------:|:------:|
| 查看记录 | ✅ | ✅ | ✅ |
| 添加记录 | ✅ | ✅ | ❌ |
| 编辑记录 | ✅ | ✅ | ❌ |
| 删除自己的记录 | ✅ | ✅ | ❌ |
| 删除他人记录 | ✅ | ❌ | ❌ |
| 生成邀请码 | ✅ | ❌ | ❌ |
| 修改成员权限 | ✅ | ❌ | ❌ |
| 移除成员 | ✅ | ❌ | ❌ |
| 解散家庭 | ✅ | ❌ | ❌ |

### 7.6 分包预加载规则

```json
{
  "pages/home/home": {
    "network": "all",
    "packages": ["packageGrowth"]
  },
  "pages/discover/discover": {
    "network": "all",
    "packages": ["packageGrowth", "packageSocial"]
  },
  "pages/profile/profile": {
    "network": "all",
    "packages": ["packageSocial"]
  }
}
```

### 7.7 主题配置

```json
// theme.json
{
  "light": {
    "navigationBarBackgroundColor": "#D4B896",
    "tabBarColor": "#8B7B6B",
    "tabBarSelectedColor": "#D4B896",
    "tabBarBackgroundColor": "#FFFFFF"
  },
  "dark": {
    "navigationBarBackgroundColor": "#2A2420",
    "tabBarColor": "#7A7068",
    "tabBarSelectedColor": "#D4B896",
    "tabBarBackgroundColor": "#1E1A16"
  }
}
```

ThemeManager 支持三种模式：`light` / `dark` / `system`（跟随系统），通过 `app_theme_mode` 持久化。

---

## 8. 全局注册组件

在 `app.json` 中全局注册的组件：

```json
{
  "usingComponents": {
    "error-state": "/components/error-state/error-state"
  }
}
```

其余组件在各页面的 `.json` 中按需引入。

---

## 9. Behavior 共享行为

| Behavior | 路径 | 功能 | 使用组件 |
|----------|------|------|---------|
| `swipe-close` | `behaviors/swipe-close.js` | 弹窗下滑关闭手势（触摸移动 > 150rpx 触发关闭，16ms 节流） | 所有 *-popup 组件 |
| `share-behavior` | `behaviors/share-behavior.js` | 全局分享配置（onShareAppMessage + onShareTimeline） | 所有页面 |
