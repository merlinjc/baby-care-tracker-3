# Web v7.2 · Sprint 2 任务清单

> 范围：v7.2 Sprint 2（2026-05-25 → 2026-06-05，10 工作日）
> 设计文档：[`docs/web-roadmap-v7.2-sprint2-design.md`](./web-roadmap-v7.2-sprint2-design.md)
> 总入口：[`docs/web-roadmap-v7.2.md`](./web-roadmap-v7.2.md)
> 前置：Sprint 1 已完成 F9 / INF-01 / INF-02 / F8 / F12-01（收尾 F12-02/03 + F2 + F6 于 5/22 前）

---

## 0. 任务编号约定

- 任务 ID 格式：`T-S2-{FX}-{NN}` 或 `T-S2-{FX}-{BE|FE}-{NN}`（F11 前后端分离）
- 每个任务对应一个 PR（小到中等粒度，单 PR 变更 ≤ 400 行）
- 状态：⬜ 未开始 / 🔵 进行中 / ✅ 已完成 / ⚠️ 阻塞 / ⏸️ 暂缓

---

## 1. 依赖关系总览

```
前置 S1 收尾（5/22 前必须完成）
  T-S1-F12-02/03（头像上传）
  T-S1-F2-01..05（黄疸云端化）
  T-S1-F6-01/02（多宝 URL）
       │
       ▼
S2 开工（5/25）
  T-S2-F11-BE-01..04（DailyCheckin 后端 + AI 小记）
       │
       └──► T-S2-F11-FE-01..06（前端：PhotoUploader / Card / Calendar / Detail / Export）
               │
               ├──► T-S2-F11-INT-01（patrol 清理 + 验收）
               │
               └──► T-S2-F4-01..02（报告分享 Dialog + PDF 含日历）

T-S2-F10-01..02（WHO 百分位增强，独立可并行）

T-S2-F1-01..04（Onboarding，独立可并行）

T-S2-DOC-01..03（文档同步，跟随各功能）
T-S2-REL-01    Sprint 2 验收 + tag v7.2.0-rc.2
```

---

## 2. 按"开发日"建议执行顺序

| Day | 主线 A（F11 + F4） | 主线 B（F10） | 主线 C（F1 + DOC） |
|-----|--------------------|--------------|-------------------|
| D1 (5/25) | T-S2-F11-BE-01 schema + migration | — | T-S2-F1-01 Overlay 组件 |
| D2 (5/26) | T-S2-F11-BE-02 CRUD 路由 + service + 集成测试 | — | T-S2-F1-02 App 触发 + preferences 写入 |
| D3 (5/27) | T-S2-F11-BE-03 AI 小记 service + prompt | T-S2-F10-01 WHO 数据扩至 0-60 月 + percentile lib | T-S2-F1-03 目标元素锚点 |
| D4 (5/28) | T-S2-F11-FE-01 service + hooks + PhotoUploader | T-S2-F10-02 Growth 页叠加参考线 + AI 咨询 | — |
| D5 (5/29) | T-S2-F11-FE-02 DailyCheckinCard（首页） + AiSummaryPanel | — | T-S2-F1-04 a11y + 跨设备验证 |
| D6 (6/1) | T-S2-F11-FE-03 GrowthCalendar 月视图 + cell 三态 | — | T-S2-DOC-01 architecture / conventions |
| D7 (6/2) | T-S2-F11-FE-04 详情抽屉 + AI 小记编辑 | — | T-S2-F4-01 ReportShareDialog |
| D8 (6/3) | T-S2-F11-FE-05 月视图导出（PNG + PDF）+ pdf-lib | — | T-S2-F4-02 PDF 含日历 + lib/pdf-export |
| D9 (6/4) | T-S2-F11-INT-01 patrol 清理 + 7 天窗口 + E2E | — | T-S2-DOC-02/03 api-spec / component / devops |
| D10 (6/5) | T-S2-REL-01 Sprint 2 验收 + tag v7.2.0-rc.2 + 灰度发布 | — | — |

> **Buffer**：每天预留 20-30% 给 code review / 修复 / 冲突解决。按净开发 7d 计，接近设计 §1.5 的并行容量。

---

## 3. F11 · 每日打卡 + AI 小记 + 成长日历（6d）

### 3.1 后端（~2d）

#### T-S2-F11-BE-01 ⬜ DailyCheckin schema + 共享类型 + 日期 lib
**类型**：feat (DB + shared)
**预估**：0.5d
**依赖**：—
**输出**：
- `server/prisma/schema.prisma`：新增 `DailyCheckin` 模型（设计 §4.1），`@@unique([babyId, checkinDate])` + `@@index([babyId, familyId, checkinDate])`
- `shared/types/index.ts`：新增 `DailyCheckin / DailyCheckinListQuery / DailyCheckinCreate / DailyCheckinPatch`
- `server/src/types/index.ts` + `client/src/types/index.ts` re-export
- `server/src/types/errors.ts`：新增 `CHECKIN_NOT_FOUND / CHECKIN_DUPLICATE / CHECKIN_WINDOW_EXPIRED / CHECKIN_PHOTO_MISSING`
- `client/src/lib/daily-checkin-date.ts`：`todayLocalYmd / isPast / isFuture / isWithinCheckinWindow / getMonthGrid`（纯函数，含单元测试 10+ 用例）
- `prisma db push` 同步 dev 库

**验收**：
- ✅ `pnpm --filter server test` 原有测试全绿
- ✅ `daily-checkin-date` 单元测试通过（今/昨/7 天前/8 天前/未来/跨月/跨年）
- ✅ shared 类型在 server / client 两端可 import

**PR 标题**：`feat(db): DailyCheckin schema + 日期 lib（T-S2-F11-BE-01）`

---

#### T-S2-F11-BE-02 ⬜ DailyCheckinService CRUD + 路由 + 集成测试
**类型**：feat (API)
**预估**：0.8d
**依赖**：T-S2-F11-BE-01
**输出**：
- `server/src/services/daily-checkin.service.ts`：
  - `list(userId, babyId, { startDate?, endDate? })` 默认本月
  - `getByDate(userId, babyId, date)` 未找到 404
  - `create(userId, babyId, data)` 校验 `isWithinCheckinWindow`（7d）+ `checkinDate >= baby.birthDate` + 唯一约束 409
  - `update(userId, babyId, date, patch)` editor 仅自己 / admin 全部
  - `remove(userId, babyId, date)` editor 仅自己 / admin 全部
- `server/src/schemas/daily-checkin.schema.ts`：Zod（ymd 正则 / photoKey 长度限制 / caption ≤ 200 字）
- `server/src/routes/checkins.ts`：5 个端点（不含 AI 小记，后者单独 task）
- `server/src/routes/index.ts`：挂载 `/babies/:babyId/checkins`
- `server/tests/unit/daily-checkin-service.test.ts`：15+ 用例（窗口 / 跨家庭 403 / editor 权限 / 唯一约束）
- `server/tests/integration/checkin-crud.test.ts`：8+ 用例（HTTP 全流程）

**验收**：
- ✅ server 测试 112 → ~135 通过
- ✅ 跨家庭调用返回 403；editor 无法删别人创建的返回 403
- ✅ 7 天窗口校验（今/昨/7 天前 OK，8 天前 400）

**PR 标题**：`feat(api): /babies/:id/checkins CRUD（T-S2-F11-BE-02）`

---

#### T-S2-F11-BE-03 ⬜ AI 小记生成接口 + prompt
**类型**：feat (AI)
**预估**：0.5d
**依赖**：T-S2-F11-BE-02
**输出**：
- `server/src/services/daily-checkin.service.ts`：`generateAiSummary(userId, babyId, date, role?)`
  - 查询当天 records（feeding/sleep/diaper/temperature/growth）+ 里程碑 + 黄疸（如 S1 F2 已上线）
  - 组装温柔感性 prompt：`buildCheckinPrompt(babyName, day, records, role)`
  - `aiService.consumeQuota` → `aiService.callOpenAI` → DB update + `aiSummaryAt = now()`
  - 失败 `refundQuota`
- `server/src/routes/checkins.ts`：`POST /api/babies/:babyId/checkins/:date/ai-summary`（authenticate + canEdit + ai rate limit）
- `server/tests/unit/daily-checkin-ai.test.ts`：mock aiService 的 prompt 字符串断言 + 成功 / 失败路径
- 错误码 `AI_SERVICE_ERROR / QUOTA_EXCEEDED` 沿用 ai 既有

**验收**：
- ✅ 生成成功 aiSummary + aiSummaryAt 双写
- ✅ AI 5xx 时 DB 不变；配额回滚
- ✅ 配额耗尽返回 429

**PR 标题**：`feat(api): DailyCheckin AI 小记生成（T-S2-F11-BE-03）`

---

#### T-S2-F11-BE-04 ⬜ patrol 任务：dailyCheckinOrphanCleanup
**类型**：feat (patrol)
**预估**：0.2d
**依赖**：T-S2-F11-BE-02
**输出**：
- `server/src/utils/patrol.ts`：新增 `runDailyCheckinOrphanCleanup()`
  - 周日 04:00 执行
  - 列 COS `checkins/**` 前缀对象（分页）
  - 对比 DB `DailyCheckin.photoKey`，找 30 天前无对应 DB 记录的 key
  - 批量删 COS 对象；logger 记录
- 注册到 `registerPatrolTasks()`
- `server/tests/unit/patrol.test.ts`：新增 3 用例覆盖（匹配 / 不匹配 / 30d 阈值）

**PR 标题**：`feat(patrol): DailyCheckin COS 孤儿清理任务（T-S2-F11-BE-04）`

---

### 3.2 前端（~4d）

#### T-S2-F11-FE-01 ⬜ service + hooks + PhotoUploader 业务封装
**类型**：feat
**预估**：0.5d
**依赖**：T-S2-F11-BE-02（API 已上线）
**输出**：
- `client/src/services/daily-checkin.ts`：5 个方法（list / getByDate / create / update / remove）+ `generateAiSummary`
- `client/src/hooks/use-daily-checkins.ts`：`useDailyCheckins(babyId, month)` （React Query，60s staleTime）
- `client/src/hooks/use-daily-checkin.ts`：单日详情
- `client/src/hooks/use-generate-ai-summary.ts`：mutation + invalidate
- `client/src/components/daily-checkin/photo-uploader.tsx`：
  - 薄封装 `<ImageUploader kind="daily-checkin" ctx={{ familyId, babyId, date }}>`
  - onChange(key) → 调 `createDailyCheckin` POST → 自动调 `generateAiSummary`（非阻塞）
  - 业务视觉：方形预览 + 上传进度 overlay

**验收**：
- ✅ 上传主流程：选图 → FormData POST → 返回 key → create checkin 落库 → 异步拉起 AI 小记
- ✅ 失败时 toast；AI 失败不阻塞打卡

**PR 标题**：`feat(web): daily-checkin service/hooks/PhotoUploader（T-S2-F11-FE-01）`

---

#### T-S2-F11-FE-02 ⬜ 首页 DailyCheckinCard + AiSummaryPanel
**类型**：feat
**预估**：0.4d
**依赖**：T-S2-F11-FE-01
**输出**：
- `client/src/components/daily-checkin/daily-checkin-card.tsx`：三态（未打卡 / 打卡中 / 已打卡）
- `client/src/components/daily-checkin/ai-summary-panel.tsx`：展示 / 编辑 / 重新生成（dialog + confirm "会扣除一次 AI 配额"）
- `client/src/pages/home/index.tsx`：`<TodaySummary>` 下方插入 `<DailyCheckinCard>`
- i18n 新 NS `daily-checkin.json`（今日文案 + 三态提示 + 时间格式）

**验收**：
- ✅ 首页三态切换流畅
- ✅ 「查看完整」跳 `/growth/calendar?date=YYYY-MM-DD` 自动打开详情抽屉

**PR 标题**：`feat(home): DailyCheckinCard + AiSummaryPanel（T-S2-F11-FE-02）`

---

#### T-S2-F11-FE-03 ⬜ GrowthCalendar 月视图 + CalendarCell 四态
**类型**：feat
**预估**：0.8d
**依赖**：T-S2-F11-FE-01
**输出**：
- `client/src/pages/growth/calendar/index.tsx`：`GrowthCalendarPage`（LargeTitleHeader + 月切换 + 网格 + 导出菜单占位）
- `client/src/app/routes.tsx`：新增 lazy 路由 `/growth/calendar`
- `client/src/components/growth-calendar/growth-calendar.tsx`：`grid-cols-7` + `getMonthGrid` + `useDailyCheckins({ month })`
- `client/src/components/growth-calendar/calendar-cell.tsx`：
  - 未来 → 灰 + 不可点
  - 过去未打卡 & 在窗口内 → 数字 + hover 显 + 号 → 点击触发 PhotoUploader（date 预填）
  - 过去未打卡 & 超窗口 → 灰 + 气泡"超过 7 天"
  - 已打卡 → 圆角照片 + 数字角标 + hover AI 小记首行
- `client/src/components/growth-calendar/calendar-month-switcher.tsx`：◀ ▶ + 当前月标题
- i18n `daily-checkin.json` 补充 calendar 相关 key

**验收**：
- ✅ 切月流畅；URL `?year=2026&month=5` 同步
- ✅ 四态视觉准确；照片 `<img loading="lazy">` 分帧挂载，31 张图不卡顿

**PR 标题**：`feat(growth): GrowthCalendar 月视图（T-S2-F11-FE-03）`

---

#### T-S2-F11-FE-04 ⬜ 日历详情抽屉 + 编辑 + 删除 + 替换
**类型**：feat
**预估**：0.6d
**依赖**：T-S2-F11-FE-03
**输出**：
- `client/src/components/daily-checkin/daily-checkin-detail.tsx`：
  - Sheet（移动）/ Drawer（桌面）
  - 照片全图 + 日期 + AI 小记（`<AiSummaryPanel>` 复用）+ caption 可编辑 + 当天 records 只读列表
  - 底部 action：替换照片（editor 仅自己）/ 删除
- 深链支持：`?date=YYYY-MM-DD` 自动打开对应 cell 的抽屉
- `useConfirm` 接入删除

**验收**：
- ✅ 编辑 caption 保存后 invalidate `daily-checkins` query
- ✅ AI 小记编辑后 `aiSummaryAt = null`；右上显"已人工修改"pill
- ✅ 删除后 cell 回到未打卡态，可再次打卡

**PR 标题**：`feat(calendar): 日历详情抽屉 + 编辑 + 删除（T-S2-F11-FE-04）`

---

#### T-S2-F11-FE-05 ⬜ 月视图导出（PNG + PDF）+ pdf-lib
**类型**：feat
**预估**：0.7d
**依赖**：T-S2-F11-FE-03
**输出**：
- `client/package.json`：+ `pdf-lib ^1.17.1`（gzip ~35KB）
- `client/vite.config.ts`：`manualChunks` 新增 `vendor-pdf: ['pdf-lib']`
- `client/src/lib/calendar-canvas.ts`：`renderCalendarImage({ baby, year, month, checkins })` → Blob（2DPR，A4 宽比）
- `client/src/lib/pdf-export.ts`：
  - `renderPagesToPdf(pages: Blob[])`
  - `renderReportWithCalendarPdf({ reportImage, calendarImages, metadata? })`
- `client/src/components/growth-calendar/calendar-export-menu.tsx`：
  - DropdownMenu：「导出图片」/「导出 PDF」/「分享」（navigator.share）
  - 进度 toast：`渲染中 {i}/{total}` → `完成`
- `pages/growth/calendar/index.tsx`：头部右上集成

**验收**：
- ✅ PNG 单月 ≤ 400KB；PDF ≤ 8MB
- ✅ 大图渲染不阻塞主线程 > 200ms（分帧 + createImageBitmap）
- ✅ `vendor-pdf` 独立 chunk，不污染首屏

**PR 标题**：`feat(calendar): 月视图 PNG / PDF 导出（T-S2-F11-FE-05）`

---

#### T-S2-F11-INT-01 ⬜ 集成验收 + 隐私审计 + E2E
**类型**：test / verify
**预估**：0.3d
**依赖**：T-S2-F11-FE-05
**输出**：
- 手工走一遍设计 §11 清单 1-5 条
- E2E（Playwright）：`e2e/daily-checkin.spec.ts` 新增 3 条用例（创建 / 补打卡窗口 / 删除）
- 验证 EXIF 已剥离（实拍照片上传后 `exiftool` 无 GPS）
- 确认 COS 对象 key 命名符合 `checkins/{familyId}/{babyId}/{date}-{cuid}.jpg`

**PR 标题**：`test(checkin): 集成验收 + E2E（T-S2-F11-INT-01）`

---

## 4. F10 · WHO 百分位线增强（2d）

### T-S2-F10-01 ⬜ WHO 数据扩至 0-60 月 + percentile lib
**类型**：feat
**预估**：1d
**依赖**：—
**输出**：
- `client/src/lib/who-standards.ts`：扩展 `WHO_WEIGHT_BOY/GIRL / HEIGHT_* / HEAD_*` 到 60 月（24-60 月按 3 月粒度）
- `client/src/lib/who-percentile.ts`：
  - `getPercentile(value, ageInMonths, gender, metric)`（分段线性插值 + 边界 ≤3 / ≥97）
  - `getPercentileLabel(p)`：中文映射（"P50（标准水平）"等 5 档）
  - `isOutOfRange(p)`
  - `getReferenceLinePoints(gender, metric, range)` 返回 5 条线的点位
- **单元测试**：`client/src/lib/__tests__/who-percentile.test.ts`（vitest；如 client 无测试基建则跟 F10-02 一并跳过）或放 server 侧共享测试

> 注：client 目前无 vitest 基建；本 task 内启用轻量 vitest（仅为 lib 加测试，不引入 DOM 测试）。`pnpm add -D vitest @vitest/coverage-v8`，单独一个 `client/vitest.config.ts`。

**验收**：
- ✅ 10 个典型样本与 WHO 官方表对比误差 < 0.1 百分位
- ✅ 月龄 > 60 返回 null；`isOutOfRange(null) === true`

**PR 标题**：`feat(growth): WHO 0-60 月 + 百分位 lib（T-S2-F10-01）`

---

### T-S2-F10-02 ⬜ Growth 页叠加参考线 + 异常 AI 咨询
**类型**：feat
**预估**：1d
**依赖**：T-S2-F10-01
**输出**：
- `client/src/pages/growth/index.tsx`：
  - SVG 曲线图下叠加 5 条参考线（复用 `getReferenceLinePoints`；`opacity: 0.35`；颜色区分 P3/P97 暖警，P50 中性）
  - 数据点 tooltip 增加 `{value} {unit} · {getPercentileLabel(p)}`
  - 历史列表行尾增加小 Badge：`P75` / `<P3 ⚠`
- `client/src/components/growth/out-of-range-alert.tsx`（新）：异常值告警行 + 「向 AI 咨询」按钮（navigate `/ai-assistant` + `autoPrompt`）
- `client/src/components/report/report-growth-section.tsx`：生长报告子组件同步显示 delta + 百分位
- i18n `record.json` 补充百分位相关 key（`percentile.label.*` / `out_of_range.tip`）

**验收**：
- ✅ 3 指标 × 2 性别切换参考线正常
- ✅ 异常值红色高亮 + AI 咨询跳转后自动发送 prompt
- ✅ 小屏 375px 可读
- ✅ 暖夜模式对比度达标

**PR 标题**：`feat(growth): WHO 百分位参考线 + 异常 AI 咨询（T-S2-F10-02）`

---

## 5. F4 · 报告分享 Dialog + PDF（1d）

### T-S2-F4-01 ⬜ ReportShareDialog 组件
**类型**：feat
**预估**：0.4d
**依赖**：—（不强依赖 F11，但 "附带日历" 需 F11-FE-05 完成后才可勾选；可先做成 disabled 占位 checkbox）
**输出**：
- `client/src/components/report/report-share-dialog.tsx`：Dialog + 预览（reuse `renderReportImage`）+ 3 action
- `client/src/pages/report/index.tsx`：分享按钮 onClick 从直接 share → 打开 Dialog
- i18n `report.json` 新 key：`share_dialog.title / save_png / export_pdf / native_share / include_calendar`

**验收**：
- ✅ 移动端 / 桌面端 Dialog 自适应
- ✅ `navigator.share` 不支持时隐藏该按钮，只保留 PNG / PDF 下载
- ✅ 预览图 2DPR 清晰

**PR 标题**：`feat(report): ReportShareDialog 组件（T-S2-F4-01）`

---

### T-S2-F4-02 ⬜ PDF 含日历 + renderReportWithCalendarPdf
**类型**：feat
**预估**：0.6d
**依赖**：T-S2-F11-FE-05（lib/pdf-export 已就位） + T-S2-F4-01
**输出**：
- `client/src/lib/pdf-export.ts`：`renderReportWithCalendarPdf` 实现（复用 pdf-lib）
- `report-share-dialog.tsx`：勾选"附带成长日历"时，自动取周/月报时间窗内的 checkins → `renderCalendarImage` × N → PDF
- 报告页的 `ReportData.range` 传入 Dialog；日历页数由时间窗天数决定（周报 1 页 / 月报 1 页）
- 进度 toast：`生成封面... → 渲染 5 月日历... → 完成`

**验收**：
- ✅ PDF 文件大小：仅报告 < 1.5MB；含 1 个月日历 < 8MB
- ✅ macOS Preview / iOS 文件 / Chrome PDF viewer 三端可打开
- ✅ 长 AI 总结不被裁切

**PR 标题**：`feat(report): PDF 含成长日历页（T-S2-F4-02）`

---

## 6. F1 · Onboarding（1.5d）

### T-S2-F1-01 ⬜ OnboardingStep 数据 + Overlay 组件
**类型**：feat
**预估**：0.5d
**依赖**：T-S1-F8-01（i18n 已就位 ✅）
**输出**：
- `client/src/lib/onboarding-steps.ts`：4 步定义数组 + `isAlreadySatisfied(step, context)`
- `client/src/components/onboarding/onboarding-overlay.tsx`：Radix Dialog + Stepper + Tab/Esc a11y + focus trap
- 高亮蒙层：SVG `<path>` 挖空矩形实现
- i18n 新 NS `onboarding.json`（4 步标题/描述/CTA + 跳过/跳过全部 + aria 提示）

**验收**：
- ✅ 独立使用：`<OnboardingOverlay open steps={DEMO_STEPS} />` 能跑
- ✅ 键盘 Tab / Shift+Tab / Esc 完备
- ✅ 目标元素不在视口时自动 scrollIntoView

**PR 标题**：`feat(onboarding): Overlay 组件 + 步骤数据（T-S2-F1-01）`

---

### T-S2-F1-02 ⬜ App 触发 + preferences 写入
**类型**：feat
**预估**：0.4d
**依赖**：T-S2-F1-01 + T-S1-INF-01（preferences ✅）
**输出**：
- `client/src/app/App.tsx`：登录 + loadUser 完成后判断 `preferences.onboardingCompleted !== true` → 挂 `<OnboardingOverlay>`
- `?onboarding=1` 强制触发（忽略 preferences）
- 完成 → `updatePreferences({ onboardingCompleted: true, onboardingSkippedSteps: [] })`
- 跳过 → `updatePreferences({ onboardingCompleted: true, onboardingSkippedSteps: [1,2,3,4].filter(未完成) })`
- StrictMode 双触发防御：`useRef(false)` flag

**验收**：
- ✅ 新账号首次登录触发
- ✅ 完成后刷新不重弹；另一台设备登录也不弹
- ✅ `/?onboarding=1` 强制触发，跳过/完成不写 preferences（仅演示用）

**PR 标题**：`feat(onboarding): App 触发 + 状态保存（T-S2-F1-02）`

---

### T-S2-F1-03 ⬜ 目标元素锚点 + 高亮
**类型**：feat
**预估**：0.3d
**依赖**：T-S2-F1-01
**输出**：
- 在以下元素加 `data-onboarding-target`：
  - `pages/record/index.tsx`：加号按钮 → `add-record-fab`
  - `pages/baby/new.tsx` / 创建按钮
  - `pages/family/index.tsx` 邀请码区
  - `pages/ai-assistant/index.tsx` 输入框
- Overlay 内部 querySelector + ResizeObserver（窗口尺寸变化重算）
- "目标元素不存在" 的优雅降级：仍显示文字引导，但不画高亮

**PR 标题**：`feat(onboarding): 目标元素锚点 + 动态高亮（T-S2-F1-03）`

---

### T-S2-F1-04 ⬜ a11y 校验 + 跨设备验证
**类型**：test
**预估**：0.3d
**依赖**：T-S2-F1-01..03
**输出**：
- 键盘走一遍 4 步流程
- 第二台浏览器 / 隐私模式验证跨设备保持
- 已有数据账号不重复弹
- axe-core（`@axe-core/react` dev-only）扫描 Overlay 0 critical

**PR 标题**：`test(onboarding): 跨设备 + a11y 验证（T-S2-F1-04）`

---

## 7. 文档同步（贯穿 Sprint）

### T-S2-DOC-01 ⬜ architecture + coding-conventions 更新
**预估**：0.3d
**输出**：
- `docs/web-architecture.md` §5.9（每日打卡链路图）/ §5.10（百分位计算）/ §5.11（Onboarding 数据流）
- `docs/web-coding-conventions.md` §21（日历 + 图片 + AI 小记约定）/ §22（Onboarding + preferences 联动）

---

### T-S2-DOC-02 ⬜ api-spec + component-library + ui-spec 更新
**预估**：0.3d
**输出**：
- `docs/web-api-spec.md` §12（Checkin 6 端点 + 错误码）
- `docs/web-component-library.md`：PhotoUploader / DailyCheckinCard / GrowthCalendar / CalendarCell / AiSummaryPanel / WhoPercentileLines / ReportShareDialog / OnboardingOverlay
- `docs/web-ui-spec.md`：日历色彩 + cell 状态 + 百分位参考线色彩 + Stepper 规范

---

### T-S2-DOC-03 ⬜ devops + roadmap 修正
**预估**：0.3d
**输出**：
- `docs/devops-workflow.md` §4.5：patrol `dailyCheckinOrphanCleanup` 配置 + cron 表达式
- `docs/web-roadmap-v7.2.md`：
  - §12.2 字段修正 `photoUrl` → `photoKey`
  - §15 Sprint 2 / Sprint 3 排期调整（F3 推迟到 S3）

---

## 8. Sprint 结束验收

### T-S2-REL-01 ⬜ Sprint 2 验收 + 标记 v7.2.0-rc.2
**预估**：0.5d
**依赖**：所有 T-S2 任务
**步骤**：
1. 手工跑一遍设计 §11 十条 user flow
2. `pnpm build` 0 error；`pnpm test`（server 全套 + client lib 测试）全绿
3. 检查 chunk 体积达标（入口 ≤ 22KB，vendor-pdf ≤ 35KB）
4. 更新 CHANGELOG.md：v7.2.0-rc.2 段，列出 Sprint 2 Added/Changed
5. `git tag v7.2.0-rc.2`，推送
6. 发 Release Notes 给全量灰度用户

---

## 9. 任务汇总表

| ID | 功能 | 标题 | 工期 | 状态 |
|----|------|------|------|------|
| T-S2-F11-BE-01 | F11 | DailyCheckin schema + 日期 lib | 0.5d | ⬜ |
| T-S2-F11-BE-02 | F11 | CRUD 路由 + service + 测试 | 0.8d | ⬜ |
| T-S2-F11-BE-03 | F11 | AI 小记生成接口 + prompt | 0.5d | ⬜ |
| T-S2-F11-BE-04 | F11 | patrol 孤儿清理 | 0.2d | ⬜ |
| T-S2-F11-FE-01 | F11 | service + hooks + PhotoUploader | 0.5d | ⬜ |
| T-S2-F11-FE-02 | F11 | 首页 DailyCheckinCard + AiSummaryPanel | 0.4d | ⬜ |
| T-S2-F11-FE-03 | F11 | GrowthCalendar 月视图 + 四态 cell | 0.8d | ⬜ |
| T-S2-F11-FE-04 | F11 | 日历详情抽屉 + 编辑删除 | 0.6d | ⬜ |
| T-S2-F11-FE-05 | F11 | 月视图 PNG / PDF 导出 | 0.7d | ⬜ |
| T-S2-F11-INT-01 | F11 | 集成验收 + E2E | 0.3d | ⬜ |
| T-S2-F10-01 | F10 | WHO 0-60 月 + percentile lib | 1d | ⬜ |
| T-S2-F10-02 | F10 | Growth 页参考线 + 异常 AI 咨询 | 1d | ⬜ |
| T-S2-F4-01 | F4 | ReportShareDialog 组件 | 0.4d | ⬜ |
| T-S2-F4-02 | F4 | PDF 含日历 + pdf-lib | 0.6d | ⬜ |
| T-S2-F1-01 | F1 | OnboardingOverlay 组件 | 0.5d | ⬜ |
| T-S2-F1-02 | F1 | App 触发 + preferences 写入 | 0.4d | ⬜ |
| T-S2-F1-03 | F1 | 目标元素锚点 + 高亮 | 0.3d | ⬜ |
| T-S2-F1-04 | F1 | a11y + 跨设备验证 | 0.3d | ⬜ |
| T-S2-DOC-01 | DOC | architecture + conventions | 0.3d | ⬜ |
| T-S2-DOC-02 | DOC | api-spec + component + ui-spec | 0.3d | ⬜ |
| T-S2-DOC-03 | DOC | devops + roadmap 修正 | 0.3d | ⬜ |
| T-S2-REL-01 | REL | 验收 + tag v7.2.0-rc.2 | 0.5d | ⬜ |
| **合计** | | | **11.3d** | |

> 工期 11.3d > Sprint 2 的 10d，预计通过并行（F10 + F1 与 F11 后端并行；DOC 跟随各 PR 顺手做）压缩到 10d 内。如仍超期，**T-S2-F4-02（PDF 含日历）可降级为"仅报告图 PDF"**（省 0.3d），或延至 Sprint 3。

---

## 10. 任务执行模板

```
## 当前任务：T-S2-FX-NN xxx

### 已读文档
- docs/web-roadmap-v7.2-sprint2-design.md §X
- 相关文件：xxx

### 实现步骤
1. ...
2. ...

### 提交
- [ ] 代码改动通过 `pnpm lint` + `pnpm build`
- [ ] 相关测试已加 / 已跑通
- [ ] 关联文档章节已同步
- [ ] PR 标题符合约定
```

---

## 11. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-11 | Sprint 2 任务 v1.0 | 初版，22 个 task（@唐瀚） |
