# Web v7.2 · Sprint 2 整体设计文档

> 范围：v7.2 Sprint 2（2026-05-25 → 2026-06-05，10 工作日）
> 主线：**内容沉淀核心 + 个性化 + 可访问性收尾**
> 分支：`feature/v7.2-roadmap`（继续 Sprint 1 分支，不开新分支）
> 上游：[`docs/web-roadmap-v7.2.md`](./web-roadmap-v7.2.md)
> 前置：[`docs/web-roadmap-v7.2-sprint1-design.md`](./web-roadmap-v7.2-sprint1-design.md)（已交付 F9 / INF-01 / INF-02 / F8 / F12-01）
> 任务清单：[`docs/web-roadmap-v7.2-sprint2-tasks.md`](./web-roadmap-v7.2-sprint2-tasks.md)

---

## 1. Sprint 2 范围与目标

### 1.1 从 Sprint 1 顺延的未完成任务

Sprint 1 已完成 11/29 个 task（38%），**按开发节奏把以下低价值/重依赖项推迟**：

| 推迟项 | 原因 | 新归属 |
|---|---|---|
| F12-02/03 头像上传 UI | 基础设施（INF-02 + F12-01）已就位，Sprint 1 收尾内两天内完成即可，不影响 S2 主线 | **Sprint 1 收尾**（5/22 前） |
| F2 黄疸云端化（5 task） | 独立业务闭环，数据资产迁移关键 | **Sprint 1 收尾**（5/22 前） |
| F6 多宝 URL 参数（2 task） | 依赖 F11 页面都需要 URL babyId 载体，提前到 S2 做正好 | **Sprint 2 前置**（见 §2） |
| F3 导出独立页（3 task） | 依赖 F2（黄疸数据纳入导出），S1 结束后并入 | **Sprint 2**（F3-01..03） |
| F1 Onboarding（4 task） | 依赖 i18n ✅ + preferences ✅，可在 S2 中后期并行 | **Sprint 2**（F1-01..04） |

> **假设**：用户 2026-05-22 前完成 Sprint 1 剩余 F12-02/03 + F2 + F6。如届时 F2 未完，本 Sprint F3-03（黄疸纳入导出）应降级或推后。

### 1.2 Sprint 2 本体功能（3 项主功能 + 2 项顺延）

| 编号 | 功能 | 工期 | 优先级 | 主线 | 关键依赖 |
|------|------|------|--------|------|---------|
| **F11** | 每日打卡照片 + AI 小记 + 成长日历 | 6d | **P0** | 内容沉淀（核心亮点） | INF-02 ✅ / AIService ✅ |
| **F10** | WHO 百分位线（0-60 月 + 百分位标注 + 异常提示 + AI 咨询入口） | 2d | P1 | 内容沉淀 | — |
| **F4** | 报告分享弹窗 + PDF 导出（报告图 + 日历页） | 1d | P1 | 内容沉淀 | F11（日历页） |
| F3 | 导出独立页 | 1.5d | P1 | 内容沉淀 | F2 (S1) / F9 ✅ |
| F1 | Onboarding（4 步） | 1.5d | P0 | 可访问性 | INF-01 ✅ / i18n ✅ |
| — | Buffer + 文档 + Bug 修 + 灰度反馈 | 1d | — | — | — |

**总工期**：6 + 2 + 1 + 1.5 + 1.5 + 1 = **13d > Sprint 2 的 10d**

### 1.3 工期硬抉择（推迟到 Sprint 3）

为保住 P0 的 F11 不赶工，**F3 导出独立页整体推迟到 Sprint 3**（Sprint 3 原排期是 F5 AI 多会话 3d + F7 a11y 2d + 灰度修 2d + 上线 1d = 8d，可容纳 F3 1.5d）。

> **Sprint 3 新排期**：F5 + F7 + **F3** + 灰度修 + 上线 = 8.5d + buffer = 可行。
> 需要在 roadmap 更新里同步这个决策。

**Sprint 2 最终工期**：6 + 2 + 1 + 1.5 + 1 = **11.5d**（超 10d 的 1.5d 靠并行吸收，见 §1.5）

### 1.4 Sprint 2 包含的功能

| 编号 | 功能 | 工期 | 关键依赖 |
|------|------|------|---------|
| F11 | 每日打卡 + AI 小记 + 成长日历 | 6d | 共享基础设施 §3 |
| F10 | WHO 百分位线增强 | 2d | — |
| F4 | 报告分享 + PDF | 1d | F11-日历页（PDF 附带日历） |
| F1 | Onboarding | 1.5d | INF-01 ✅ / i18n ✅ |
| Buffer | 文档 + Bug 修 | 1d | — |

### 1.5 并行策略

| Day | 主线 1（F11 前后端） | 主线 2（并行） |
|-----|---|---|
| D1 (5/25) | F11-BE-01 DailyCheckin schema + migration | F1-01 OnboardingOverlay 组件 |
| D2 (5/26) | F11-BE-02 CRUD 路由 + 测试 | F1-02 App 触发 + preferences 写入 |
| D3 (5/27) | F11-BE-03 AI 小记 generateDailyCheckinSummary + 缓存 | F10-01 WHO 数据扩至 0-60 月 |
| D4 (5/28) | F11-FE-01 PhotoUploader 组件 + service + hook | F10-02 百分位标注 + 异常 AI 咨询 |
| D5 (5/29) | F11-FE-02 DailyCheckinCard（首页） | F1-03 目标元素锚点 + 高亮 |
| D6 (6/1)  | F11-FE-03 GrowthCalendar 月视图 | F1-04 a11y + 跨设备验证 |
| D7 (6/2)  | F11-FE-04 日历详情抽屉 + AI 小记编辑 | F4-01 ReportShareDialog（预览 + 下载 + 分享） |
| D8 (6/3)  | F11-FE-05 月视图导出 PNG/PDF（pdf-lib） | F4-02 报告 PDF 附带日历（联动 F11） |
| D9 (6/4)  | F11 收尾：隐私（EXIF）/ 7 天补打卡 / patrol 清理 | F4 收尾 + 验收 |
| D10 (6/5) | Sprint 2 验收 + 灰度发布 + tag `v7.2.0-rc.2` | — |

**并行主要靠**：F11 后端（~2d）期间 F1 + F10 前端独立推进；F11 前端（~4d）期间 F4 + F1 收尾。

### 1.6 Sprint 2 结束态

- ✅ 用户可在首页看到"今日打卡"卡片；选图 → 上传 → AI 小记 60 秒内到位
- ✅ `/growth/calendar` 月视图渲染；日期点击抽屉显示照片 + AI 小记 + 当日记录
- ✅ 日历一键导出 PNG（长截图）与 PDF（每月一页）
- ✅ 成长曲线叠加 WHO P3/P15/P50/P85/P97 参考线；数据点显示"当前位于 P75"；异常值（<P3 或 >P97）提示"向 AI 咨询建议"
- ✅ 报告页一键分享（桌面 Modal / 移动 `navigator.share`），PDF 含报告 + 成长日历
- ✅ 新账号首次登录触发 4 步 Onboarding；跳过 / 完成跨设备生效
- ✅ 文档（web-architecture §5.9/§5.10 / web-api-spec §12 / web-component-library / web-ui-spec / devops-workflow §4.5）同步
- ✅ 标记 `v7.2.0-rc.2`，**全量灰度**

---

## 2. 现状盘点（开发前必读）

### 2.1 Sprint 1 交付的可复用基础设施

| 设施 | 文件 | 用于 |
|---|---|---|
| `ImageUploader` render-prop 组件 | `client/src/components/ui/image-uploader.tsx` | F11 PhotoUploader 直接用 `kind="daily-checkin"` |
| `uploadService.upload` + `buildImageUrl` | `client/src/services/upload.ts` + `client/src/lib/image-url.ts` | F11 照片上传与展示统一走代理 |
| `putObject` + `getObjectStream` | `server/src/services/upload.service.ts` | F11 后端照片存储 + 读取 |
| `User.preferences` + `updatePreferences()` | `shared/types` + `client/stores/auth-store` | F1 Onboarding 状态跨设备 |
| i18n `common` / `nav` + 新增 NS 机制 | `client/src/i18n/` | F11 / F1 / F4 / F10 UI 文案 |
| `AIService.chat / chatStream / dailyInsight + 配额` | `server/src/services/ai.service.ts` | F11 AI 小记复用 `consumeQuota / refundQuota` 与缓存模式 |
| `renderReportImage` / `renderShareImage` | `client/src/lib/share-canvas.ts` | F4 报告分享图 |
| `lib/who-standards.ts` (0-24 月) | 同名 | F10 扩展到 0-60 月 |

### 2.2 数据库现状

- **SQLite dev + MySQL prod**（参考 schema comment）
- 无 `server/prisma/migrations/` 目录 → 当前项目用 `prisma db push` 直接同步 schema。
- **Sprint 2 新表**只通过 `schema.prisma` 扩展 + `prisma db push` 生效，**不生成 migration 文件**，与现有流程一致。
- Prod 部署通过 `scripts/deploy.sh` 的 `prisma db push` 步骤应用（与已有 INF-01 `User.preferences` 同路径）。

### 2.3 AI 服务现状

- 端点：TokenHub `/v1/chat/completions`，模型 `hy3-preview`
- 已有方法：`chat(userId, messages, babyId?, role?)` / `chatStream` / `dailyInsight(userId, babyId)`
- **F11 新增**：`generateDailyCheckinSummary(userId, babyId, date, role?)`，与 `dailyInsight` 区别：
  - **语气**：小记（温柔感性）vs 洞察（客观数据向）
  - **缓存 key**：`daily_checkin_summary:${babyId}:${date}:${role}`
  - **持久化**：写入 `DailyCheckin.aiSummary + aiSummaryAt`（区别于 `dailyInsight` 的 24h 内存 LRU）
  - **配额**：沿用 `consumeQuota / refundQuota` 链

### 2.4 COS 桶现状（方案 B）

- Bucket `babycare-1300015547`（ap-beijing，私有）
- Key 前缀：`avatars/{userId}/...` / `babies/{familyId}/{babyId}/...` / `checkins/{familyId}/{babyId}/{date}-{cuid}.{ext}`
- F11 直接复用 `kind='daily-checkin'`，上下文必填 `ctx: { familyId, babyId, date }`（已在 INF-02 `validateContext` 校验）

---

## 3. 共享基础设施（Sprint 2 内两个功能复用）

### 3.1 每日日期上下文（F11 + 未来成长日历复用）

**为何抽离**：打卡是"每天一次"语义，需要统一处理：
1. 今日判断（用户本地时区）
2. 补打卡窗口（当前日期往前数 7 天，产品规定）
3. 日历单元格的"已打卡 / 未打卡 / 未来"三态

**新增 lib**：`client/src/lib/daily-checkin-date.ts`

```ts
export function todayLocalYmd(): string          // '2026-05-25'（本地时区）
export function isPast(date: string): boolean    // 是否在今天之前
export function isFuture(date: string): boolean  // 是否在今天之后
export function isWithinCheckinWindow(date: string, now?: Date): boolean
  // date 是否在"今天 - 7 天 ~ 今天"范围内（含端点）。用于判断能否补打卡
export function getMonthGrid(year: number, month: number): DateCell[]
  // 返回指定月的日历网格（首行含上月尾、末行含下月首），每个 cell 含 { ymd, inCurrentMonth }
```

**消费方**：
- F11 PhotoUploader 创建时校验 `isWithinCheckinWindow`
- F11 GrowthCalendar 月视图使用 `getMonthGrid`
- F11 DailyCheckinCard 首页判断 `todayLocalYmd()` 是否已有打卡
- 纯函数，单元测试覆盖跨月 / 跨年 / 闰月（与后端时区无关，前端本地即可）

### 3.2 PDF 生成能力（F4 + F11 共用）

**选型**：`pdf-lib`（~100KB gzip，纯前端，无 DOM → canvas 链）

**为何不选其他**：
- `jsPDF + html2canvas`：体积 ~500KB，DOM → canvas 精度问题（色差、字体）
- `pdfmake`：仅支持结构化表格，不支持自定义图片布局
- `pdf-lib`：图片拼接 + 文字绘制 + 多页处理，满足"把 canvas 输出的 PNG 按页塞入"场景

**新增 lib**：`client/src/lib/pdf-export.ts`

```ts
// 把多张 PNG Blob 按单页拼成 PDF；每页 A4 比例（2480×3508 px 或自适应）
export async function renderPagesToPdf(pages: Blob[]): Promise<Blob>

// F4 场景：第一页报告 + 后续页日历
export async function renderReportWithCalendarPdf(opts: {
  reportImage: Blob                    // F4 renderReportImage 产物
  calendarImages: Blob[]               // F11 月视图 PNG 列表
  metadata?: { title?: string; author?: string }
}): Promise<Blob>
```

- **性能边界**：pdf-lib 按 streamlined 模式生成，避免把所有图片 base64 进内存；大于 8MB 时回退为"分别下载"
- **manualChunks 规划**：`pdf-lib` 独立成 `vendor-pdf` chunk，只在 `/export` / `/report` / `/growth/calendar` 路由加载

### 3.3 Canvas 长截图能力（F11 日历月视图导出）

**复用**：沿用 `share-canvas.ts` 的 2DPR + 色彩管理模式。

**新增**：`client/src/lib/calendar-canvas.ts`

```ts
export interface RenderCalendarImageOptions {
  baby: Baby
  year: number
  month: number              // 1-12
  checkins: DailyCheckin[]   // 当月打卡数据（含 photoUrl + aiSummary 前 40 字）
  theme?: 'warm' | 'night'
}
export async function renderCalendarImage(opts: RenderCalendarImageOptions): Promise<Blob>
```

- 网格 7×5 或 7×6，每 cell 圆角方形 + 照片（圆角裁切）+ 数字 + AI 小记首行
- 缩略图从 `/api/uploads/{key}` 拉 Blob → `createImageBitmap`
- 2DPR，A4 宽度比（1240×1754）便于直接填 PDF

---

## 4. F11 · 每日打卡 + AI 小记 + 成长日历 — 详细设计

### 4.1 数据模型

```prisma
model DailyCheckin {
  id          String   @id @default(cuid())
  babyId      String
  familyId    String
  checkinDate String                   // YYYY-MM-DD（本地时区）
  photoKey    String                   // ⚠️ COS 桶内 key（非 URL！与 INF-02 方案 B 对齐）
  photoWidth  Int?
  photoHeight Int?
  caption     String?                  // 用户手写说明（≤200 字）
  aiSummary   String?                  // markdown
  aiSummaryAt DateTime?                // AI 生成时间；null = 未生成 / 用户已编辑
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  baby    Baby @relation(fields: [babyId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@unique([babyId, checkinDate])      // 一天一张
  @@index([babyId, familyId, checkinDate])
}
```

**与 roadmap v7.2 §12.2 的差异**：
- `photoUrl` → **`photoKey`**（遵循 INF-02 方案 B：DB 存 key，展示时 `buildImageUrl` 拼代理 URL）
- 其余字段保持

### 4.2 后端 API

| 路由 | 方法 | 鉴权 | 说明 |
|---|---|---|---|
| `/api/babies/:babyId/checkins` | GET | authenticate + familyBabyCheck | 列表 `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`，默认本月 |
| `/api/babies/:babyId/checkins` | POST | authenticate + canEdit | 创建（含 photoKey / checkinDate / caption?），一天重复报 409 |
| `/api/babies/:babyId/checkins/:date` | GET | authenticate | 单日详情；未打卡返回 404 |
| `/api/babies/:babyId/checkins/:date` | PATCH | authenticate + canEdit(自己/admin) | 更新 photoKey / caption / aiSummary（aiSummary 编辑后 `aiSummaryAt = null`） |
| `/api/babies/:babyId/checkins/:date` | DELETE | authenticate + canEdit(自己/admin) | 删除（仅 DB 记录；photoKey 入 patrol 清理队列） |
| `/api/babies/:babyId/checkins/:date/ai-summary` | POST | authenticate + canEdit | 生成或重新生成 AI 小记（扣配额；失败不删已有 aiSummary） |

**Key 权限矩阵**（写操作）：
- `admin` → 全部
- `editor` → 创建 / 编辑自己创建的
- `viewer` → 只读

**校验补充**：
- `checkinDate` 必须是 `YYYY-MM-DD`，且在 `baby.birthDate ~ today` 范围（不允许未来 / 早于出生）
- POST 校验 `isWithinCheckinWindow`：仅允许 **今天 + 过去 7 天**（产品规则）；超出返回 400 `CHECKIN_WINDOW_EXPIRED`

### 4.3 后端服务分层

```
server/src/services/daily-checkin.service.ts
├── list(userId, babyId, query)
├── getByDate(userId, babyId, date)
├── create(userId, babyId, { photoKey, checkinDate, caption? })
├── update(userId, babyId, date, patch)
├── remove(userId, babyId, date)
└── generateAiSummary(userId, babyId, date, role?)
      │
      ├── 查询当天所有 record + 里程碑 + 黄疸（如果 S1 F2 已上线）
      ├── 组装 prompt（温柔感性基调，区别于 dailyInsight）
      ├── aiService.consumeQuota(userId)
      ├── aiService.callOpenAI(messages) ← 复用底层
      ├── DB update: aiSummary + aiSummaryAt = now()
      └── 失败：aiService.refundQuota(userId)
```

**错误码新增**：`CHECKIN_NOT_FOUND / CHECKIN_DUPLICATE / CHECKIN_WINDOW_EXPIRED / CHECKIN_PHOTO_MISSING`

### 4.4 前端分层

```
services/daily-checkin.ts         ← service 层，axios 封装
hooks/use-daily-checkins.ts       ← React Query（按月列表）
hooks/use-daily-checkin.ts        ← React Query（单日详情）
hooks/use-generate-ai-summary.ts  ← mutation

components/daily-checkin/
├── photo-uploader.tsx            ← ImageUploader 的业务封装（kind=daily-checkin）
├── daily-checkin-card.tsx        ← 首页"今日打卡"卡片
├── daily-checkin-detail.tsx      ← 抽屉里的"单日详情"（照片 + AI 小记 + records + 编辑）
└── ai-summary-panel.tsx          ← AI 小记展示 / 编辑 / 重新生成

components/growth-calendar/
├── growth-calendar.tsx           ← 月视图主组件（网格 + cell）
├── calendar-cell.tsx             ← 单日单元格（已打卡 / 未打卡 / 未来 三态）
├── calendar-month-switcher.tsx   ← 月份切换 header
└── calendar-export-menu.tsx      ← 导出 PNG / PDF / 分享

pages/growth/calendar/index.tsx   ← 独立路由 /growth/calendar
```

**路由新增**（F9 lazy 体系下）：
```ts
{
  path: '/growth/calendar',
  element: lazyEl(() => import('@/pages/growth/calendar').then(m => ({ default: m.GrowthCalendarPage }))),
}
```

### 4.5 UI 交互细节

#### 4.5.1 首页「今日打卡」卡片

**位置**：`<TodaySummary>` 下方

**三态**：

| 状态 | 渲染 |
|---|---|
| 未打卡（今天） | Card `variant="cta"` + Camera icon + 文案「今天给宝宝拍一张吧 · 快门捕捉的温柔」+ 点击触发 PhotoUploader |
| 打卡中 | 压缩中 → 显示压缩进度；上传中 → 显示 uploadProgress；AI 小记生成中 → 显示 typing 动画 |
| 已打卡 | 圆角方形缩略图 + AI 小记前 2 行 + 时间（x:xx 已记） + 「查看完整」跳日历详情 |

#### 4.5.2 成长日历页 `/growth/calendar`

**Header**：
- 大标题：`{baby.name} 的成长日历`
- 副标题：`2026 年 5 月 · 共 12 天打卡`（根据该月 checkins 数统计）
- 右上：月份切换 IconButton ◀ ▶ + 「导出」DropdownMenu

**日历网格**（`grid-cols-7`）：
- 首行周标签 `一 二 三 四 五 六 日`
- 每 cell 42×42（移动）/ 56×56（桌面）
- 四种 cell 状态：
  1. **未来**：灰色数字 + 无背景
  2. **过去（未打卡 & 在补打卡窗口内）**：数字 + hover 时 + 号，点击弹 PhotoUploader，date 自动填
  3. **过去（未打卡 & 超窗口）**：灰色数字 + 不可点击 + 气泡提示「超过 7 天无法补打卡」
  4. **已打卡**：圆角方形照片背景 + 白色数字角标 + hover 时显示 AI 小记首行 + 点击打开详情抽屉

**详情抽屉**（桌面 Drawer / 移动 Sheet）：
- 顶部：照片全图 + 日期
- 中部：AI 小记（markdown 渲染，支持编辑；编辑后清 `aiSummaryAt`，右上显「已人工修改」pill）+ 「重新生成 AI 小记」按钮（扣配额 warn）
- 下部：caption 编辑 + 当天所有 records 只读列表
- 底部：删除按钮（editor 仅自己创建的）/ 替换照片按钮

#### 4.5.3 月视图导出

**两种格式**：
- **PNG 长图**：`renderCalendarImage` 产出 A4 宽比，约 200-400 KB → 触发 `<a download>` / `navigator.share`
- **PDF**：`renderPagesToPdf([calendarPng])` 单页 PDF；F4 的"报告 + 日历 PDF"复用同一 PNG

**性能**：
- 单月最多 31 张照片（约 300KB/张压缩后 ≈ 9MB）；导出前异步 `createImageBitmap` + 复用 cache
- 渲染过程中显示 progress toast（"渲染中 x/31"）
- 大屏 2DPR，小屏 1.5DPR 防止 OOM

### 4.6 隐私 / 权限细节（承接 roadmap §12.8）

- **EXIF 剥离**：已由 INF-02 `browser-image-compression { preserveExif: false }` 保障；F11 无需重复
- **COS 文件清理**：
  - DB 删 `DailyCheckin` 时**不立即删 COS 对象**（防误删）
  - 新增 patrol 任务 `dailyCheckinOrphanCleanup`（每周日 04:00）：扫 COS `checkins/**` 前缀，找不到对应 DB 记录 + `createdAt > 30 天前` 的 key 批量删除
  - 注册到 `server/src/utils/patrol.ts` 的 `registerPatrolTasks`
- **家庭删除 / Baby 删除级联**：
  - `prisma.daily_checkin` 的 `onDelete: Cascade` 自动清 DB
  - COS 对象由 patrol 异步兜底（允许 1 周延迟）

### 4.7 失败与降级

| 失败点 | 处理 |
|---|---|
| COS 未配置（503） | 上传按钮 disabled + toast 引导管理员；首页卡片显示"管理员暂未开启打卡功能" |
| AI 配额耗尽（429） | 照片正常保存，AI 小记显示「今日额度已用完，明天再试」+ 手动补生成按钮 |
| AI 5xx / 超时 | 走本地 fallback："记录整理好了，明天有更多洞察"（≤50 字） |
| 网络弱 / 上传中断 | 浏览器原生 `AbortController`；保留表单状态，用户可重试 |
| 并发创建同一日 | 后端 `@@unique([babyId, checkinDate])` 防重；前端收 409 时引导"去看已有的打卡" |

### 4.8 F11 单元测试

| 模块 | 用例 |
|---|---|
| `daily-checkin-date.ts` | today / isWithinCheckinWindow 边界 / getMonthGrid 跨月跨年 |
| `daily-checkin.service.ts` | create / 重复报 409 / 窗口过期报 400 / 跨家庭 403 / generateAiSummary 成功路径 + 回滚 |
| `/api/babies/:id/checkins` 集成 | CRUD 全套 + 跨家庭 403 + editor 删别人 403 |
| 前端：`buildCheckinPrompt` | AI prompt 组装（温柔基调字符串断言） |

**目标**：server 测试套 → 112 → **~130 通过**

### 4.9 F11 验收

- ✅ 每天每胎一张照片 + AI 小记 60s 内到位
- ✅ 补打卡仅限 7 天内；未来日期 + 超窗口灰显
- ✅ 月视图 PNG 导出 ≤ 400KB；月度 PDF ≤ 8MB
- ✅ 家庭成员可见同一份打卡；editor 仅能改自己创建
- ✅ 删除 baby / 家庭级联清理 DB；COS 由 patrol 兜底
- ✅ 文档 §12 / api-spec §12 / component-library / devops 同步

---

## 5. F10 · WHO 百分位线增强 — 详细设计

### 5.1 范围

- 现有 `lib/who-standards.ts` 已覆盖 0-24 月，三指标（体重 / 身高 / 头围 ×男女），粒度 1 月 / 3 月。
- **本次增强**：
  1. 数据扩至 **0-60 月**（5 年）
  2. 在 `pages/growth/index.tsx` 曲线图叠加 **P3 / P15 / P50 / P85 / P97** 5 条参考线
  3. 数据点 hover 显示"当前位于 P75（中上水平）"
  4. 异常值（< P3 或 > P97）整行红色 + 「向 AI 咨询建议」按钮（复用 `autoPrompt` 跳 AI 助手）
  5. 报告页 `<ReportGrowthSection>` 同步显示百分位

### 5.2 新增 lib

`client/src/lib/who-percentile.ts`：

```ts
export type Gender = 'male' | 'female'
export type WhoMetric = 'weight' | 'height' | 'headCircumference'

/**
 * 通过分段线性插值在 WHO 标准表中求某值的百分位位置。
 *
 * 算法：
 * 1. 根据 month 定位上下两档月龄样本点（1/3 月粒度）
 * 2. 分别对 P3/P15/P50/P85/P97 做线性插值求出 age=month 时的参考值
 * 3. 将目标 value 投影到 5 档参考值上做"分段线性百分位"估计
 * 4. 若 value ≤ 该月 P3 → 返回 ≤3；≥ P97 → 返回 ≥97；中间值用相邻两档做线性插值
 *
 * 不引入 LMS 官方 Z 分数算法（roadmap §11.2），精度够且零依赖。
 */
export function getPercentile(
  value: number,
  ageInMonths: number,
  gender: Gender,
  metric: WhoMetric,
): number | null   // null = 月龄超 0-60 范围

export function getPercentileLabel(p: number): string  // "P75（中上水平）"
export function isOutOfRange(p: number | null): boolean  // <3 或 >97

/** 图表横轴上每 1 月渲染一个百分位参考值点（给 recharts 或自渲染 SVG） */
export function getReferenceLinePoints(
  gender: Gender,
  metric: WhoMetric,
  range: { from: number; to: number },  // 月龄范围
): Record<'p3' | 'p15' | 'p50' | 'p85' | 'p97', { month: number; value: number }[]>
```

### 5.3 数据扩展策略

- **新表数据**：从 WHO 官方页面（https://www.who.int/tools/child-growth-standards/standards）手动整理 24-60 月粒度 3 月采样
- **数据文件组织**：保持现在的 TS 对象字面量，结构与 0-24 月一致；按需拆出 `who-standards-ext.ts`
- **体积影响**：0-24 月约 2KB；扩至 0-60 月约 4KB（gzip 1KB），不需要按需加载

### 5.4 UI 细节

**SVG 线渲染**：
- 已有 `growth/index.tsx` 使用 SVG 自渲染（见 Sprint 1 时看到的 `<text fontSize="8">`）
- 在曲线下方叠加 5 条虚线：P3（实线暖警色）/ P15（虚线浅灰）/ P50（粗实线中性）/ P85（虚线浅灰）/ P97（实线暖警色）
- 半透明 `opacity: 0.35`，不抢用户实际数据线

**百分位提示**：
- 数据点 hover tooltip：`体重 9.2 kg · P75（中上水平）`
- 列表行尾增加小 Badge：`P75` / `P50` / `<P3 ⚠`

**异常值联动 AI**：
- 列表行红色背景 + 右侧按钮「向 AI 咨询建议」
- 点击后：`navigate('/ai-assistant', { state: { autoPrompt: '${babyName} 最新体重 9.2 kg，P<3 偏低，请给出建议' } })`
- 复用现有 `autoPrompt` 协议（AI 助手页登录后自动发送一次）

### 5.5 验收

- ✅ 5 条参考线渲染正确；切换指标（体重/身高/头围）与性别自动更新
- ✅ 月龄 > 60 月或 < 0 月时降级："超出 WHO 标准范围（0-5 岁）"提示，不渲染参考线
- ✅ 单元测试：典型百分位计算与 WHO 官方表对比误差 < 0.1
- ✅ 小屏 375px 可读；深夜模式对比度达标
- ✅ 异常值 autoPrompt 按钮跳 AI 助手后自动发送

---

## 6. F4 · 报告分享弹窗 + PDF 导出 — 详细设计

### 6.1 范围

- 报告页 (`pages/report/index.tsx`) 当前"分享"按钮直接 `renderReportImage` → `navigator.share`
- **本次增强**：
  1. 点"分享"弹出 `<ReportShareDialog>` 预览
  2. Dialog 内三个 action：下载 PNG / 下载 PDF（含日历）/ 系统分享
  3. 移动端若支持 `navigator.share` 优先；桌面端两个下载按钮
- **与 F11 联动**：PDF 第一页是报告图，后续页是 Sprint 2 本期（周报 = 近 7 天，月报 = 近 30 天）的成长日历

### 6.2 新增 / 改动

| 文件 | 类型 | 变更 |
|---|---|---|
| `components/report/report-share-dialog.tsx` | 新增 | Dialog + 预览 + 三个 action |
| `pages/report/index.tsx` | 改动 | 分享按钮 onClick 从直接 share → 打开 Dialog |
| `lib/pdf-export.ts` | 新增（§3.2） | `renderReportWithCalendarPdf` |
| `lib/share-canvas.ts` | 小改 | `renderReportImage` 已有，增加一个"无水印"开关参数（分享 vs 保存私用） |

### 6.3 Dialog UI

```
┌─ ReportShareDialog ─────────────────┐
│ 报告预览                            │
│ ┌─────────────────────────┐          │
│ │                         │ ← 1:1.4  │
│ │   [renderReportImage]    │ PNG    │
│ │                         │          │
│ └─────────────────────────┘          │
│                                     │
│ ☑ 附带成长日历（本期 N 张照片）      │
│                                     │
│ [保存图片]  [导出 PDF]  [系统分享]   │
└─────────────────────────────────────┘
```

- 桌面 `size="md"` Dialog；移动 Sheet
- "系统分享"仅在 `typeof navigator.share === 'function'` 时渲染
- "附带成长日历" 默认勾选，用户可取消以产出只含报告页的 PDF
- 进度条：PDF 生成阶段显示 `progress: {current}/{total}` 的 spinner

### 6.4 PDF 构造细节

```ts
// lib/pdf-export.ts
async function renderReportWithCalendarPdf({ reportImage, calendarImages }) {
  const pdf = await PDFDocument.create()
  // 第 1 页：报告（A4 纵向）
  const p1 = pdf.addPage([595, 842])   // A4 points
  const reportPng = await pdf.embedPng(await reportImage.arrayBuffer())
  p1.drawImage(reportPng, { x: 0, y: 0, width: 595, height: 842 })
  // 后续页：每张日历一页
  for (const imgBlob of calendarImages) {
    const page = pdf.addPage([595, 842])
    const png = await pdf.embedPng(await imgBlob.arrayBuffer())
    page.drawImage(png, { x: 0, y: 0, width: 595, height: 842 })
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' })
}
```

### 6.5 验收

- ✅ Dialog 预览图清晰（2 DPR 屏）
- ✅ PDF 文件大小：仅报告 < 1.5MB；含一个月日历 < 8MB
- ✅ PDF 在 macOS Preview / iOS 文件 / Chrome PDF viewer 均能打开
- ✅ 长 AI 总结在报告图底部不被裁切（复用现有 wrapText）
- ✅ 文案走 i18n `report` NS 新 key

---

## 7. F1 · Onboarding 首次使用引导 — 详细设计

### 7.1 4 步定义

| 步骤 | 触发条件 | 目标页 | 关键动作 | isAlreadySatisfied |
|---|---|---|---|---|
| 1 | `!preferences.onboardingCompleted` + 登录 | `/baby/new` | 创建第一个宝宝 | `babies.length > 0` → 跳过 |
| 2 | step 1 完成 | `/family` | 看邀请码 + 跳过按钮 | `family.members.length > 1` → 跳过 |
| 3 | step 2 完成 | `/record` | 高亮 `data-onboarding-target="add-record-fab"` | `records.length > 0` → 跳过 |
| 4 | step 3 完成 | `/ai-assistant` | 提示"遇到问题可以问我" | `localStorage.baby_care_chat_history` 存在 → 跳过 |

### 7.2 数据流

```
App.tsx
  └─ 登录 + loadUser 完成后
     └─ useEffect:
         const prefs = user.preferences
         if (prefs?.onboardingCompleted) return
         if (searchParams.onboarding === '1') forceShow()
         if (isNewUser) show()
         ──► <OnboardingOverlay steps={4步} onDone/onSkip={updatePreferences({...})} />
```

**写入偏好**：
- 完成 → `updatePreferences({ onboardingCompleted: true, onboardingSkippedSteps: [] })`
- 跳过 → `updatePreferences({ onboardingCompleted: true, onboardingSkippedSteps: [2,3,4] })`（记录哪几步被跳过，便于后续"重新观看"）

### 7.3 组件

`components/onboarding/onboarding-overlay.tsx`：
- Radix Dialog 全屏 `<DialogOverlay>` + 半透明黑底
- 内部：Stepper 头部 + 步骤标题 + 描述 + 主 CTA + 「跳过此步」/「跳过全部」
- **高亮目标元素**：
  1. `document.querySelector('[data-onboarding-target="xxx"]')` 取 bounding rect
  2. 蒙层 `<svg>` 用 `<path>` 做"四周黑 + 中间挖空圆角矩形"
  3. 目标不在视口 → `scrollIntoView({ behavior: 'smooth', block: 'center' })` 然后重算
- **a11y**：Tab / Shift+Tab / Esc；第一焦点在主 CTA；`aria-describedby` 指向步骤描述

### 7.4 i18n

新 NS `onboarding.json`：

```json
{
  "step1": { "title": "创建第一个宝宝", "desc": "...", "cta": "开始", "skip": "跳过" },
  "step2": { ... },
  "actions": { "next": "下一步", "skip_all": "跳过引导", "done": "开始使用" }
}
```

### 7.5 验收

- ✅ 新账号 / 新家庭成员首次进入触发
- ✅ 跳过 / 完成跨设备生效（依赖 INF-01 preferences）
- ✅ `/?onboarding=1` 强制触发用于演示 / QA
- ✅ 键盘 Tab 可在步骤间切换，Esc 退出
- ✅ 已有数据账号不重复弹（isAlreadySatisfied 分支覆盖）
- ✅ StrictMode 双触发防御（useRef flag）

---

## 8. 文档同步清单

每个 feature PR 必须附带相关文档 diff：

| 文档 | F11 | F10 | F4 | F1 |
|---|---|---|---|---|
| `web-architecture.md` | §5.9 每日打卡链路图 | §5.10 百分位计算 | — | §5.11 Onboarding 数据流 |
| `web-api-spec.md` | §12 Checkin 6 端点 | — | — | — |
| `web-coding-conventions.md` | §21 日历 + 图片 + AI 小记约定 | — | — | §22 Onboarding + preferences 联动 |
| `web-ui-spec.md` | 日历色彩 + cell 状态 | 参考线色彩 | Dialog 预览 | Stepper 规范 |
| `web-component-library.md` | PhotoUploader / GrowthCalendar / CalendarCell / AiSummaryPanel | WhoPercentileLines | ReportShareDialog | OnboardingOverlay |
| `devops-workflow.md` | §4.5 patrol dailyCheckinOrphanCleanup | — | — | — |
| `web-roadmap-v7.2.md` | §12.2 字段修正 photoUrl→photoKey | — | — | — |

---

## 9. 性能基线与目标

| 指标 | Sprint 1 末基线 | Sprint 2 末目标 |
|---|---|---|
| 入口 chunk gzip | 19.57 KB | ≤ 22 KB（+ F1/F4 轻量） |
| `vendor-i18n` chunk | 20.19 KB | 不变 |
| 新增 `vendor-pdf` chunk | — | ≤ 35 KB（仅报告/日历/导出页加载） |
| `/growth/calendar` 路由 chunk | — | ≤ 15 KB gzip |
| F11 单张照片压缩后 | — | ≤ 400 KB |
| F11 月度 PDF | — | ≤ 8 MB |
| 日历月视图首屏（10 张照片） | — | LCP ≤ 2.5s |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| COS 桶在生产环境配额 / 带宽问题 | F11 上传失败 | DevOps 提前压测；准备限流降级（单用户 100 张/日） |
| `pdf-lib` 单页图片过大导致内存峰值 | PDF 导出 OOM | 限制单图 ≤ 1.5 MB；总页数 ≤ 35（一月一页） |
| AI 小记内容不稳定 / 跑题 | 产品体验差 | Prompt 精心设计 + temperature 0.3；保留"重新生成"按钮；fallback 文案 |
| 日历月视图渲染 31 张照片卡顿 | UX | `<img loading="lazy">` + `IntersectionObserver` 分帧挂载；虚拟滚动仅在 >100 cell 时启用 |
| Onboarding 与已有数据账号冲突 | 老用户不该看到引导 | `isAlreadySatisfied` 按步检测；完全新账号外，老用户看不到 |
| F11 + F10 + F4 并发改动 growth / report 页 | 合并冲突 | F11 走独立路由 `/growth/calendar`；F10 / F4 串行或相隔 1d |

---

## 11. 验收清单（Sprint 2 末手工 user flow）

1. **新用户 onboarding**：注册 → 进入首页 → 看到 4 步引导 → 完成 → 刷新无重弹
2. **打卡主流程**：首页→ 未打卡卡片 → 选图 → 压缩 + 上传 → 60s 内看到 AI 小记 → 日历里看到今日 cell 有缩略图
3. **补打卡**：点昨日空 cell → 上传照片 → 日历更新；点 8 天前空 cell → 气泡"超过 7 天不可补"
4. **AI 小记编辑**：详情抽屉 → 修改 → 保存 → 再进详情显示"已人工修改"pill → 点"重新生成" → 显示 AI 版本覆盖
5. **日历导出**：切到 4 月 → 导出 PNG → 保存 → 导出 PDF → 在 Preview 打开含封面 + 网格
6. **报告分享**：报告页 → 分享 → 弹 Dialog → 勾选"附带日历" → 导出 PDF → 查看包含报告 + 本期日历页
7. **WHO 百分位**：成长页 → 切体重 → 叠加 5 条参考线 → 加一条异常值 (<P3) → 看到「向 AI 咨询」按钮 → 点击跳 AI 助手自动发送问题
8. **跨家庭隔离**：切换宝宝 → 日历只看到该宝宝的打卡
9. **a11y**：键盘走一遍 1+2+4 流程
10. **灰度回归**：Sprint 1 的所有功能（i18n / 头像 / 黄疸 / 路由分割）未被破坏

---

## 12. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-11 | Sprint 2 设计 v1.0 | 初版，3 主功能 + F1 顺延 + F3 推迟到 S3（@唐瀚） |
