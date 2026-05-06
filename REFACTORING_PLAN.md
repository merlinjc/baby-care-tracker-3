# Baby Care Tracker Web 版重构方案

> **版本**: v1.0 | **日期**: 2026-04-30 | **状态**: 规划中

---

## 1. 重构概述

### 1.1 目标

将现有微信小程序版 Baby Care Tracker 重构为 **Web 应用**，采用**前后端单体架构**，统一部署在腾讯云 Lighthouse 服务器上。

### 1.2 核心变更

| 维度 | 小程序版 (现有) | Web 版 (目标) |
|------|----------------|--------------|
| 前端框架 | 微信小程序原生 (WXML+WXSS+JS) | React 18 + TypeScript + Vite |
| UI 库 | 自定义组件 + Behavior | shadcn/ui + Radix UI + Tailwind CSS |
| 后端服务 | CloudBase 云函数 | Node.js (Express/Koa) 单体服务 |
| 数据库 | CloudBase NoSQL | MySQL 8.0 (Lighthouse 自建) |
| 认证 | 微信登录 + openid | 邮箱/手机号 + JWT |
| 存储 | CloudBase 云存储 | Lighthouse 本地 + COS (可选) |
| AI 服务 | wx.cloud.extend.AI | 混元 API (HTTP 直调) |
| 部署 | 微信开发者工具上传 | Docker + Nginx (Lighthouse) |
| 离线策略 | wx.localStorage + 离线队列 | IndexedDB + Service Worker |

### 1.3 阶段规划

| 阶段 | 内容 | 预估工期 |
|------|------|---------|
| **Phase 1** | 项目初始化 + 后端 API + 认证 + 核心记录 CRUD | 2-3 周 |
| **Phase 2** | 前端页面完整实现（首页/记录/发现/我的） | 2-3 周 |
| **Phase 3** | 家庭协作 + AI 助手 + 高级功能 | 1-2 周 |
| **Phase 4** | 数据库迁移 + Lighthouse 部署 + 上线 | 1 周 |

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                   腾讯云 Lighthouse 服务器                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Nginx (反向代理)                     │  │
│  │   /api/* → Node.js :3000  │  /* → 静态文件 (dist/)    │  │
│  └──────────────┬───────────────────────────┬───────────┘  │
│                 │                           │              │
│  ┌──────────────▼────────────────┐  ┌──────▼──────────┐  │
│  │    Node.js 单体后端 (:3000)    │  │  前端静态文件     │  │
│  │                               │  │  (Vite build)   │  │
│  │  ┌─────────┐  ┌───────────┐  │  └─────────────────┘  │
│  │  │ Express  │  │ Middleware │  │                      │
│  │  │ Router   │  │ (auth/err)│  │                      │
│  │  └────┬─────┘  └─────┬─────┘  │                      │
│  │       │              │        │                      │
│  │  ┌────▼──────────────▼─────┐  │                      │
│  │  │      Service Layer      │  │                      │
│  │  │ Record / Family / Baby  │  │                      │
│  │  │ Auth / AI / Todo / Sync │  │                      │
│  │  └───────────┬─────────────┘  │                      │
│  │              │                │                      │
│  │  ┌───────────▼─────────────┐  │                      │
│  │  │   Data Access Layer     │  │                      │
│  │  │ MySQL (Sequelize/Prisma)│  │                      │
│  │  └───────────┬─────────────┘  │                      │
│  └──────────────┼────────────────┘                      │
│                 │                                        │
│  ┌──────────────▼────────────────┐                      │
│  │      MySQL 8.0 (:3306)        │                      │
│  └───────────────────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 单体架构目录结构

```
baby-care-tracker-web/
├── client/                          # 前端 (React SPA)
│   ├── public/
│   ├── src/
│   │   ├── app/                     # 路由 + 页面布局
│   │   │   ├── App.tsx
│   │   │   ├── routes.tsx
│   │   │   └── layout/
│   │   ├── pages/                   # 页面 (对应小程序 pages/)
│   │   │   ├── home/
│   │   │   ├── record/
│   │   │   ├── discover/
│   │   │   ├── profile/
│   │   │   ├── auth/
│   │   │   ├── baby/
│   │   │   ├── family/
│   │   │   ├── growth/
│   │   │   ├── vaccine/
│   │   │   ├── milestone/
│   │   │   ├── ai-assistant/
│   │   │   └── settings/
│   │   ├── components/              # 共享组件 (对应小程序 components/)
│   │   │   ├── ui/                  # shadcn/ui 基础组件
│   │   │   ├── feeding-dialog.tsx
│   │   │   ├── sleep-dialog.tsx
│   │   │   ├── diaper-dialog.tsx
│   │   │   ├── temperature-dialog.tsx
│   │   │   ├── growth-dialog.tsx
│   │   │   ├── timeline.tsx
│   │   │   ├── insight-section.tsx
│   │   │   ├── report-dialog.tsx
│   │   │   ├── export-dialog.tsx
│   │   │   ├── baby-card.tsx
│   │   │   ├── focus-card.tsx
│   │   │   └── error-state.tsx
│   │   ├── services/                # 前端服务层 (API 调用封装)
│   │   │   ├── api.ts               # Axios 实例 + 拦截器
│   │   │   ├── auth.ts
│   │   │   ├── record.ts
│   │   │   ├── family.ts
│   │   │   ├── baby.ts
│   │   │   ├── todo.ts
│   │   │   ├── trend.ts
│   │   │   └── ai.ts
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-family.ts
│   │   │   ├── use-baby.ts
│   │   │   ├── use-records.ts
│   │   │   ├── use-theme.ts
│   │   │   └── use-permission.ts
│   │   ├── stores/                  # 状态管理 (Zustand)
│   │   │   ├── auth-store.ts
│   │   │   ├── family-store.ts
│   │   │   ├── baby-store.ts
│   │   │   └── theme-store.ts
│   │   ├── lib/                     # 工具函数
│   │   │   ├── date.ts
│   │   │   ├── permission.ts
│   │   │   ├── storage.ts           # localStorage + IndexedDB
│   │   │   ├── debounce.ts
│   │   │   ├── format.ts
│   │   │   └── theme.ts
│   │   ├── config/                  # 静态配置
│   │   │   ├── who-standards.ts
│   │   │   ├── vaccine-plan.ts
│   │   │   ├── milestone-config.ts
│   │   │   └── icon-config.tsx
│   │   ├── styles/                  # 全局样式
│   │   │   ├── globals.css          # CSS 变量 + Tailwind
│   │   │   └── themes.css           # 亮色/暖夜/暗色主题
│   │   └── types/                   # TypeScript 类型定义
│   │       ├── record.ts
│   │       ├── baby.ts
│   │       ├── family.ts
│   │       └── user.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── server/                          # 后端 (Node.js)
│   ├── src/
│   │   ├── app.ts                   # Express 应用入口
│   │   ├── config/
│   │   │   ├── database.ts          # 数据库连接配置
│   │   │   ├── auth.ts              # JWT / 认证配置
│   │   │   └── ai.ts                # 混元 API 配置
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT 认证中间件
│   │   │   ├── error-handler.ts     # 全局错误处理
│   │   │   ├── rate-limit.ts        # 限流中间件
│   │   │   ├── validate.ts          # 参数校验 (Zod)
│   │   │   └── cors.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── records.ts
│   │   │   ├── families.ts
│   │   │   ├── babies.ts
│   │   │   ├── vaccines.ts
│   │   │   ├── milestones.ts
│   │   │   ├── ai.ts
│   │   │   ├── export.ts
│   │   │   └── index.ts
│   │   ├── services/                # 业务逻辑层
│   │   │   ├── auth.service.ts
│   │   │   ├── record.service.ts
│   │   │   ├── family.service.ts
│   │   │   ├── baby.service.ts
│   │   │   ├── vaccine.service.ts
│   │   │   ├── milestone.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── trend.service.ts
│   │   │   └── export.service.ts
│   │   ├── models/                  # 数据模型 (Prisma Schema)
│   │   │   └── schema.prisma
│   │   ├── utils/
│   │   │   ├── date.ts
│   │   │   ├── permission.ts
│   │   │   ├── invite-code.ts
│   │   │   └── logger.ts
│   │   └── types/
│   │       └── index.ts
│   ├── prisma/
│   │   └── migrations/
│   ├── tsconfig.json
│   └── package.json
│
├── docker/                          # Docker 配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── scripts/                         # 构建/部署脚本
│   ├── deploy.sh
│   └── migrate-data.ts             # 小程序数据迁移脚本
│
├── shared/                          # 前后端共享类型
│   └── types/
│       ├── record.ts
│       ├── baby.ts
│       ├── family.ts
│       └── user.ts
│
├── package.json                     # Monorepo 根配置
├── pnpm-workspace.yaml
└── README.md
```

---

## 3. 数据库设计 (MySQL)

### 3.1 从 NoSQL 到 MySQL 的映射策略

小程序版使用 CloudBase NoSQL（6 个集合 + 2 个系统集合），Web 版迁移到 MySQL 关系型数据库。

**核心变更**：
- `records` 集合的 `data` 多态子结构 → 拆分为 5 张子表 (feeding_records / sleep_records / diaper_records / temperature_records / growth_records)
- `families.memberOpenids` → 关联表 `family_members`
- 双时间戳（serverDate + Ts）→ 单一时间戳 + MySQL 自动更新
- `createdBy` 对象 → 外键关联 `users.id`

### 3.2 ER 图

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│    users     │     │  family_members  │     │   families   │
├──────────────┤     ├──────────────────┤     ├──────────────┤
│ id (PK)      │────→│ id (PK)          │←────│ id (PK)      │
│ email        │     │ family_id (FK)   │     │ name         │
│ phone        │     │ user_id (FK)     │     │ creator_id   │
│ password_hash│     │ role             │     │ invite_code  │
│ nickname     │     │ relation         │     │ invite_expiry│
│ avatar       │     │ joined_at        │     │ created_at   │
│ created_at   │     └──────────────────┘     │ updated_at   │
│ updated_at   │                               └──────┬───────┘
└──────┬───────┘                                      │
       │                                              │
       │         ┌────────────────────────────────────┘
       │         │
       │         ▼
       │   ┌──────────────┐
       │   │    babies    │
       │   ├──────────────┤
       │   │ id (PK)      │
       │   │ family_id(FK)│
       │   │ name         │
       │   │ gender       │
       │   │ birth_date   │
       │   │ avatar       │
       │   │ created_at   │
       │   └──────┬───────┘
       │          │
       │    ┌─────┴──────────────────────────────┐
       │    │                                     │
       │    ▼                                     ▼
       │  ┌──────────────┐              ┌──────────────────┐
       │  │   records    │              │ vaccine_records  │
       │  ├──────────────┤              ├──────────────────┤
       │  │ id (PK)      │              │ id (PK)          │
       │  │ baby_id (FK) │              │ baby_id (FK)     │
       │  │ family_id(FK)│              │ family_id (FK)   │
       │  │ record_type  │              │ name             │
       │  │ start_time   │              │ dose             │
       │  │ end_time     │              │ vaccinated_date  │
       │  │ note         │              │ note             │
       │  │ created_by   │              │ created_by (FK)  │
       │  │ created_at   │              │ created_at       │
       │  └──────┬───────┘              └──────────────────┘
       │         │
       │    ┌────┴──────────────────────────────────┐
       │    │         (record_type 区分)              │
       │    ▼         ▼         ▼         ▼         ▼
       │  ┌────────┐┌────────┐┌────────┐┌─────────┐┌────────┐
       │  │feeding ││ sleep  ││ diaper ││  temp   ││ growth │
       │  │_records││_records││_records││_records ││_records│
       │  └────────┘└────────┘└────────┘└─────────┘└────────┘
       │
       │   ┌──────────────────┐
       └──→│milestone_records │
           ├──────────────────┤
           │ id (PK)          │
           │ baby_id (FK)     │
           │ family_id (FK)   │
           │ name             │
           │ category         │
           │ achieved_date    │
           │ note             │
           │ created_by (FK)  │
           │ created_at       │
           └──────────────────┘
```

### 3.3 Prisma Schema（核心表）

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(cuid())
  email        String?  @unique
  phone        String?  @unique
  passwordHash String?
  nickname     String
  avatar       String?
  familyId     String?
  family       Family?  @relation(fields: [familyId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  records        Record[]
  vaccineRecords VaccineRecord[]
  milestoneRecords MilestoneRecord[]
  familyMemberships FamilyMember[]

  @@index([familyId])
}

model Family {
  id              String   @id @default(cuid())
  name            String
  creatorId       String
  inviteCode      String   @unique
  inviteCodeExpiry DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  creator    User          @relation(fields: [creatorId], references: [id])
  members    FamilyMember[]
  babies     Baby[]
}

model FamilyMember {
  id        String   @id @default(cuid())
  familyId  String
  userId    String
  role      String   @default("editor") // admin | editor | viewer
  relation  String?
  joinedAt  DateTime @default(now())

  family    Family   @relation(fields: [familyId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@unique([familyId, userId])
  @@index([familyId])
  @@index([userId])
}

model Baby {
  id        String   @id @default(cuid())
  familyId  String
  name      String
  gender    String   // male | female
  birthDate DateTime
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  family          Family           @relation(fields: [familyId], references: [id])
  records         Record[]
  vaccineRecords  VaccineRecord[]
  milestoneRecords MilestoneRecord[]

  @@index([familyId])
}

model Record {
  id         String   @id @default(cuid())
  babyId     String
  familyId   String
  recordType String   // feeding | sleep | diaper | temperature | growth
  startTime  DateTime
  endTime    DateTime?
  note       String?
  createdBy  String
  creator    User     @relation(fields: [createdBy], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  baby          Baby    @relation(fields: [babyId], references: [id])
  family        Family  @relation(fields: [familyId], references: [id])
  feedingData   FeedingRecord?
  sleepData     SleepRecord?
  diaperData    DiaperRecord?
  temperatureData TemperatureRecord?
  growthData    GrowthRecord?

  @@index([babyId, familyId, recordType])
  @@index([babyId, startTime])
  @@index([familyId])
}

model FeedingRecord {
  id          String @id @default(cuid())
  recordId    String @unique
  feedingType String // breast | formula | solid
  amount      Float?
  duration    Int?
  breastSide  String? // left | right | both

  record      Record @relation(fields: [recordId], references: [id])
}

model SleepRecord {
  id        String @id @default(cuid())
  recordId  String @unique
  sleepType String // night | nap
  duration  Int
  location  String?

  record    Record @relation(fields: [recordId], references: [id])
}

model DiaperRecord {
  id          String @id @default(cuid())
  recordId    String @unique
  diaperType  String // pee | poop | both
  consistency String? // watery | soft | formed | hard
  color       String? // normal | yellow | green | black | red

  record      Record @relation(fields: [recordId], references: [id])
}

model TemperatureRecord {
  id           String @id @default(cuid())
  recordId     String @unique
  temperature  Float
  method       String? // oral | axillary | rectal | ear

  record       Record @relation(fields: [recordId], references: [id])
}

model GrowthRecord {
  id               String @id @default(cuid())
  recordId         String @unique
  height           Float?
  weight           Float?
  headCircumference Float?

  record           Record @relation(fields: [recordId], references: [id])
}

model VaccineRecord {
  id             String   @id @default(cuid())
  babyId         String
  familyId       String
  name           String
  dose           String
  vaccinatedDate DateTime
  note           String?
  createdBy      String
  createdAt      DateTime @default(now())

  baby           Baby     @relation(fields: [babyId], references: [id])

  @@index([babyId, familyId])
}

model MilestoneRecord {
  id            String   @id @default(cuid())
  babyId        String
  familyId      String
  name          String
  category      String
  achievedDate  DateTime
  note          String?
  createdBy     String
  createdAt     DateTime @default(now())

  baby          Baby     @relation(fields: [babyId], references: [id])

  @@index([babyId, familyId])
}

model OperationLog {
  id          String   @id @default(cuid())
  action      String
  userId      String?
  openid      String?
  context     Json?
  status      String   // started | succeeded | partial | failed
  steps       Json?
  result      Json?
  reason      String?
  error       Json?
  startedAt   DateTime
  finishedAt  DateTime?

  @@index([action, startedAt(sort: Desc)])
  @@index([status])
}

model RateLimit {
  id          String   @id @default(cuid())
  key         String
  count       Int      @default(1)
  windowStart DateTime
  expireAt    DateTime

  @@unique([key])
  @@index([windowStart])
}
```

### 3.4 NoSQL → MySQL 迁移对照

| 小程序集合 | MySQL 表 | 说明 |
|-----------|---------|------|
| `users` | `users` | `_openid` → JWT userId；新增 email/phone/passwordHash |
| `families` | `families` + `family_members` | `members[]` / `memberDetails[]` → 关联表 |
| `babies` | `babies` | 结构基本不变 |
| `records` (多态 data) | `records` + 5 张子表 | `recordType` 区分子表，1:1 关联 |
| `vaccine_records` | `vaccine_records` | 结构基本不变 |
| `milestone_records` | `milestone_records` | 结构基本不变 |
| `operation_logs` | `operation_logs` | 结构基本不变 |
| `rate_limits` | `rate_limits` | 改为服务端内存限流 (rate-limiter-flexible) |

---

## 4. 认证方案

### 4.1 认证流程

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端     │     │  后端     │     │  数据库   │
└─────┬────┘     └─────┬────┘     └─────┬────┘
      │                │                │
      │  POST /auth/register            │
      │ (email/phone + password)        │
      │───────────────→│                │
      │                │ INSERT user    │
      │                │───────────────→│
      │                │                │
      │  POST /auth/login               │
      │───────────────→│                │
      │                │ SELECT user    │
      │                │───────────────→│
      │                │ verify password│
      │                │                │
      │  ← JWT (access + refresh)       │
      │←───────────────│                │
      │                │                │
      │  GET /api/records               │
      │  Authorization: Bearer <token>  │
      │───────────────→│                │
      │                │ verify JWT     │
      │                │ SELECT data    │
      │                │───────────────→│
      │  ← records data                │
      │←───────────────│                │
```

### 4.2 Token 策略

| Token | 有效期 | 存储 |
|-------|--------|------|
| Access Token | 15 分钟 | 内存 (Zustand store) |
| Refresh Token | 7 天 | httpOnly cookie |

### 4.3 注册/登录方式

| 方式 | Phase | 说明 |
|------|-------|------|
| 邮箱 + 密码 | Phase 1 | 基础认证 |
| 手机号 + 验证码 | Phase 2 | 短信服务接入 |
| 微信扫码登录 | Phase 3 | 微信开放平台 OAuth |

---

## 5. API 设计

### 5.1 RESTful API 总览

| 方法 | 路径 | 说明 | 对应小程序服务 |
|------|------|------|--------------|
| **认证** | | | |
| POST | `/api/auth/register` | 注册 | AuthService |
| POST | `/api/auth/login` | 登录 | AuthService |
| POST | `/api/auth/refresh` | 刷新 Token | AuthService |
| GET | `/api/auth/me` | 获取当前用户 | AuthService |
| PATCH | `/api/auth/profile` | 更新用户信息 | AuthService |
| **记录** | | | |
| GET | `/api/records` | 查询记录列表 | RecordService.getRecords |
| POST | `/api/records` | 创建记录 | RecordService.createRecord |
| GET | `/api/records/:id` | 获取记录详情 | RecordService |
| PATCH | `/api/records/:id` | 更新记录 | RecordService.updateRecord |
| DELETE | `/api/records/:id` | 删除记录 | RecordService.deleteRecord |
| GET | `/api/records/today-stats` | 今日统计 | RecordService.getTodayStats |
| **家庭** | | | |
| POST | `/api/families` | 创建家庭 | FamilyService.createFamily |
| GET | `/api/families/current` | 获取当前家庭 | FamilyService.getFamilyByUserId |
| GET | `/api/families/:id` | 获取家庭详情 | FamilyService.getFamilyDetail |
| GET | `/api/families/:id/members` | 获取成员列表 | FamilyService.getFamilyMembers |
| POST | `/api/families/join` | 加入家庭 | FamilyService.joinByInviteCode |
| POST | `/api/families/:id/leave` | 退出家庭 | FamilyService.leaveFamily |
| DELETE | `/api/families/:id` | 解散家庭 | FamilyService.dissolveFamily |
| POST | `/api/families/:id/refresh-invite` | 刷新邀请码 | FamilyService.refreshInviteCode |
| PATCH | `/api/families/:id/members/:userId/role` | 更新成员角色 | FamilyService.updateMemberRole |
| DELETE | `/api/families/:id/members/:userId` | 移除成员 | FamilyService.removeMember |
| POST | `/api/families/:id/transfer-admin` | 转让管理员 | FamilyService.transferAdmin |
| **宝宝** | | | |
| POST | `/api/babies` | 创建宝宝 | BabyService.createBaby |
| GET | `/api/babies` | 获取宝宝列表 | BabyService.getBabiesByFamilyId |
| GET | `/api/babies/:id` | 获取宝宝详情 | BabyService.getBabyById |
| PATCH | `/api/babies/:id` | 更新宝宝信息 | BabyService.updateBaby |
| DELETE | `/api/babies/:id` | 删除宝宝 | BabyService.deleteBaby |
| POST | `/api/babies/:id/avatar` | 上传头像 | BabyService.uploadAvatar |
| **疫苗** | | | |
| GET | `/api/babies/:id/vaccines` | 疫苗列表 | TodoService |
| POST | `/api/babies/:id/vaccines` | 记录接种 | TodoService |
| GET | `/api/babies/:id/vaccine-stats` | 疫苗统计 | TodoService |
| **里程碑** | | | |
| GET | `/api/babies/:id/milestones` | 里程碑列表 | TodoService |
| POST | `/api/babies/:id/milestones` | 记录达成 | TodoService |
| **趋势** | | | |
| GET | `/api/babies/:id/trends` | 趋势数据 | TrendService |
| **AI** | | | |
| POST | `/api/ai/chat` | AI 对话 | AIService |
| POST | `/api/ai/daily-insight` | 每日洞察 | AIService |
| GET | `/api/ai/quota` | 配额查询 | QuotaService |
| **导出** | | | |
| GET | `/api/export` | 数据导出 | ExportService |

### 5.2 权限校验中间件

对应小程序版的 `PermissionGuard` + 云函数 `isAdmin/isMember`，Web 版统一在后端中间件实现：

```typescript
// 权限枚举
enum Permission {
  RECORD_CREATE = 'record:create',
  RECORD_UPDATE_OWN = 'record:update:own',
  RECORD_UPDATE_ANY = 'record:update:any',
  RECORD_DELETE_OWN = 'record:delete:own',
  RECORD_DELETE_ANY = 'record:delete:any',
  FAMILY_MANAGE = 'family:manage',
  FAMILY_DISSOLVE = 'family:dissolve',
  BABY_CREATE = 'baby:create',
  BABY_DELETE = 'baby:delete',
  MEMBER_MANAGE = 'member:manage',
}

// 角色权限矩阵（同小程序版）
const ROLE_PERMISSIONS = {
  admin: ['*'],  // 全部权限
  editor: [Permission.RECORD_CREATE, Permission.RECORD_UPDATE_OWN, Permission.RECORD_DELETE_OWN],
  viewer: [],    // 只读
};
```

---

## 6. 前端设计系统迁移

### 6.1 CSS 变量映射

小程序版 rpx 单位 → Web 版 rem/px，保留美拉德色系核心设计：

```css
:root {
  /* 主色调 */
  --primary-color: #D4B896;
  --primary-light: #E8DCC8;
  --primary-dark: #8B7B6B;
  --accent-color: #B8D4B8;

  /* 功能色 */
  --feeding-color: #A8D4A8;
  --sleep-color: #B8A8D4;
  --diaper-color: #D4C8A8;
  --temperature-color: #D4A8A8;
  --growth-color: #7BA9C9;

  /* 语义色 */
  --success-color: #7BC950;
  --danger-color: #E85454;
  --warning-color: #D4883D;
  --info-color: #7BA3C9;

  /* 文字色阶 */
  --text-primary: #3D3D3D;
  --text-secondary: #666666;
  --text-hint: #999999;

  /* 背景色 */
  --bg-primary: #F5F1EB;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;

  /* 间距 (8px 基础网格，取代 8rpx) */
  --spacing-xs: 4px;   /* 0.25rem */
  --spacing-sm: 8px;   /* 0.5rem */
  --spacing-md: 16px;  /* 1rem */
  --spacing-lg: 24px;  /* 1.5rem */
  --spacing-xl: 32px;  /* 2rem */
  --spacing-xxl: 48px; /* 3rem */

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 9999px;

  /* 阴影 (棕色调) */
  --shadow-card: 0 2px 12px rgba(139, 123, 107, 0.08);
  --shadow-soft: 0 2px 8px rgba(139, 123, 107, 0.06);
  --shadow-popup: 0 4px 24px rgba(139, 123, 107, 0.12);

  /* 遮罩 */
  --mask-color: rgba(139, 123, 107, 0.4);
  --mask-color-dark: rgba(61, 52, 39, 0.6);

  /* 过渡 */
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
}

/* 暖夜模式 */
.dark-mode {
  --bg-primary: #1E1A16;
  --bg-secondary: #2A2420;
  --text-primary: #E8E0D8;
  --text-secondary: #B0A898;
  --text-hint: #7A7068;
  --feeding-color: #7CAF7C;
  --sleep-color: #9488B4;
  --shadow-card: 0 2px 12px rgba(0, 0, 0, 0.3);
  --mask-color: rgba(0, 0, 0, 0.6);
  --mask-color-dark: rgba(0, 0, 0, 0.75);
}
```

### 6.2 组件映射表

| 小程序组件 | Web 组件 | 实现方式 |
|-----------|---------|---------|
| `feeding-popup` | `FeedingDialog` | shadcn/ui Dialog + 自定义表单 |
| `sleep-popup` | `SleepDialog` | shadcn/ui Dialog + 计时器 Hook |
| `diaper-popup` | `DiaperDialog` | shadcn/ui Dialog + 选项卡 |
| `temperature-popup` | `TemperatureDialog` | shadcn/ui Dialog + 数字输入 |
| `growth-popup` | `GrowthDialog` | shadcn/ui Dialog + 日期选择器 |
| `timeline` | `Timeline` | 自定义组件 (虚拟列表) |
| `insight-section` | `InsightSection` | shadcn/ui Card + 骨架屏 |
| `report-popup` | `ReportDialog` | shadcn/ui Dialog + 图表 |
| `export-popup` | `ExportDialog` | shadcn/ui Dialog + 下载 |
| `baby-card` | `BabyCard` | shadcn/ui Card |
| `focus-card` | `FocusCard` | shadcn/ui Card (左侧色条) |
| `error-state` | `ErrorState` | 自定义组件 |
| `swipe-close` Behavior | `useSwipeToDismiss` Hook | 自定义 Hook |
| `icon` 组件 | `LucideIcon` | lucide-react |
| `ThemeManager` | `useTheme` Hook | zustand + CSS 变量 |

### 6.3 响应式策略

Web 版需要同时支持桌面和移动端，采用 **移动优先** 策略：

| 断点 | 宽度 | 布局 |
|------|------|------|
| mobile | < 640px | 单列，底部 TabBar |
| tablet | 640-1024px | 两列，侧边导航 |
| desktop | > 1024px | 三列/多列，侧边栏 |

---

## 7. 状态管理

### 7.1 Zustand Store 设计

```typescript
// 认证状态
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials) => Promise<void>;
  register: (data) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// 家庭状态
interface FamilyStore {
  family: Family | null;
  members: FamilyMember[];
  currentRole: 'admin' | 'editor' | 'viewer';
  loadFamily: () => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
}

// 宝宝状态
interface BabyStore {
  babies: Baby[];
  currentBaby: Baby | null;
  currentBabyId: string | null;
  loadBabies: () => Promise<void>;
  selectBaby: (id: string) => void;
  createBaby: (data) => Promise<void>;
  deleteBaby: (id: string) => Promise<void>;
}

// 主题状态
interface ThemeStore {
  mode: 'light' | 'dark' | 'system';
  isDark: boolean;
  setMode: (mode) => void;
}
```

---

## 8. 离线与性能策略

### 8.1 离线支持

| 策略 | 实现 | 说明 |
|------|------|------|
| 离线缓存 | Service Worker + Workbox | 静态资源预缓存 |
| 数据本地化 | IndexedDB (Dexie.js) | 记录离线写入 |
| 离线队列 | IndexedDB + 同步队列 | 网络恢复后批量同步 |
| 乐观更新 | React Query + 本地状态 | 写操作立即反映 UI |

### 8.2 性能优化

| 策略 | 实现 | 对应小程序版 |
|------|------|-------------|
| 请求缓存 | React Query (staleTime) | 15s/30s 内存缓存 |
| 列表虚拟化 | @tanstack/virtual | — |
| 代码分割 | React.lazy + Suspense | 分包预加载 |
| 图片懒加载 | loading="lazy" + IntersectionObserver | `<image lazy-load>` |
| 防抖节流 | lodash.throttle/debounce | debounce.js |

---

## 9. 部署方案

### 9.1 Lighthouse 服务器配置

| 资源 | 规格 | 用途 |
|------|------|------|
| CPU | 2 核 | Node.js + MySQL |
| 内存 | 4 GB | 应用 + 数据库缓存 |
| 磁盘 | 60 GB SSD | 系统 + 数据 + 静态文件 |
| 带宽 | 4 Mbps | 用户访问 |
| 系统 | Ubuntu 22.04 | Docker 运行环境 |

### 9.2 Docker Compose

```yaml
version: '3.8'
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://root:${DB_PASSWORD}@db:3306/baby_care
      - JWT_SECRET=${JWT_SECRET}
      - HUNYUAN_API_KEY=${HUNYUAN_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=baby_care
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password --character-set=utf8mb4
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../docker/nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl  # HTTPS 证书
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mysql_data:
```

### 9.3 Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 前端静态文件
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 文件上传限制
        client_max_body_size 10M;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

### 9.4 部署流程

```bash
# 1. 本地构建
pnpm build

# 2. 上传到 Lighthouse
scp -r docker/ dist/ docker-compose.yml user@lighthouse-ip:/opt/baby-care/

# 3. SSH 登录 Lighthouse
ssh user@lighthouse-ip

# 4. 启动服务
cd /opt/baby-care
docker compose up -d

# 5. 初始化数据库
docker compose exec app npx prisma migrate deploy

# 6. 验证
curl https://your-domain.com/api/health
```

---

## 10. 数据迁移方案

### 10.1 从 CloudBase NoSQL 迁移到 MySQL

**迁移脚本** `scripts/migrate-data.ts`：

1. **导出**：通过 CloudBase HTTP API / SDK 批量导出 6 个集合数据
2. **转换**：NoSQL 文档 → MySQL 行
   - `records.data` 多态字段 → 按 `recordType` 分发到 5 张子表
   - `families.members[]` + `memberDetails[]` → `family_members` 关联表
   - `_openid` → `users.id`（需建立映射表）
   - `serverDate` → `DateTime`（MySQL datetime）
   - 双时间戳 → 单一时间戳
3. **导入**：通过 Prisma seed 或批量 INSERT 导入 MySQL
4. **验证**：比对记录数、抽查数据一致性

### 10.2 迁移优先级

| 阶段 | 数据 | 说明 |
|------|------|------|
| Phase 1 | users + families + babies | 基础数据，先行迁移 |
| Phase 2 | records + 子表 | 核心数据，量大需分批 |
| Phase 3 | vaccine_records + milestone_records | 辅助数据 |
| Phase 4 | operation_logs | 历史日志，可选 |

---

## 11. AI 服务迁移

### 11.1 混元 API 调用

从小程序 `wx.cloud.extend.AI` 迁移到 HTTP API 直调：

```typescript
// server/src/services/ai.service.ts
import TencentCloudSDK from 'tencentcloud-sdk-nodejs';

const HunyuanClient = TencentCloudSDK.hunyuan.v20230901.Client;

class AIService {
  private client: HunyuanClient;

  constructor() {
    this.client = new HunyuanClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
    });
  }

  async generateText(prompt: string, context: RecordContext): Promise<string> {
    const response = await this.client.ChatCompletions({
      Model: 'hunyuan-2.0-instruct-20251111',
      Messages: [
        { Role: 'system', Content: this.buildSystemPrompt(context) },
        { Role: 'user', Content: prompt },
      ],
    });
    return response.Choices[0].Message.Content;
  }

  async streamText(prompt: string, context: RecordContext): AsyncGenerator<string> {
    // SSE 流式响应
    // ...
  }
}
```

---

## 12. 开发规范延续

### 12.1 保留的核心规范

| 规范 | 小程序版 | Web 版 |
|------|---------|--------|
| 服务层单例 | JS 闭包单例 | TypeScript class + DI |
| 权限矩阵 | PermissionUtil + PermissionGuard | middleware + usePermission Hook |
| 离线优先 | SyncService + 离线队列 | React Query + IndexedDB |
| 缓存策略 | 15s/30s 内存缓存 | React Query staleTime |
| 错误处理 | 三模式（向上抛出/静默降级/离线降级） | React Query + ErrorBoundary |
| 设计系统 | CSS 变量 + ThemeManager | CSS 变量 + useTheme Hook |
| 命名约定 | camelCase / kebab-case / snake_case | 保持一致 |
| 统计字段子集关系 | 注释标注 | TypeScript 类型 + 注释 |

### 12.2 新增规范

| 规范 | 说明 |
|------|------|
| API 版本化 | `/api/v1/...` 路径前缀 |
| CORS 策略 | 生产环境限制域名 |
| CSRF 防护 | SameSite cookie + CSRF token |
| 请求限流 | rate-limiter-flexible |
| SQL 注入防护 | Prisma 参数化查询 |
| XSS 防护 | DOMPurify + CSP 策略 |

---

## 13. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 数据迁移丢失 | 高 | 分批迁移 + 校验脚本 + 回滚方案 |
| NoSQL → MySQL 多态查询性能 | 中 | records 拆子表 + 联合索引 + 查询优化 |
| 离线体验降级 | 中 | Service Worker + IndexedDB 渐进增强 |
| Lighthouse 资源不足 | 中 | 监控 + 垂直扩展 + CDN 分流 |
| AI API 限流 | 低 | 本地配额 + 降级到规则引擎 |
| 微信用户绑定 | 低 | 首次登录引导创建新账号 + 数据关联 |

---

## 14. 里程碑

| 里程碑 | 交付物 | 完成标准 |
|--------|--------|---------|
| M1 | 项目脚手架 + 数据库 Schema + 认证 | 用户可注册/登录 |
| M2 | 记录 CRUD + 首页 | 可创建/查看/编辑/删除记录 |
| M3 | 宝宝管理 + 家庭协作 | 多用户可协作记录 |
| M4 | 发现页 + AI 助手 + 趋势 | 全功能可用 |
| M5 | Lighthouse 部署 + 数据迁移 | 生产环境上线 |

---

*文档维护：架构变更时同步更新此文档。*
