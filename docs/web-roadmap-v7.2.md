# Web 端 v7.2 Roadmap

> 版本：v7.2（继 v7.1 之后）
> 日期：2026-05-11
> 分支：`feature/v7.2-roadmap`
> 状态：规划中 / 待开发
> 配套盘点：[`docs/web-miniprogram-parity-gap.md`](./web-miniprogram-parity-gap.md)

---

## 0. 版本目标

v7.0 完成「iOS Health × 美拉德暖色系」视觉重构，v7.1 完成视觉系统精修与里程碑打卡改造。**v7.2 主题是「内容沉淀 + 个性化 + 可访问性 + 工程基础」**，围绕三条主线：

1. **内容沉淀**：让用户的"育儿过程"在 Web 端形成可回顾、可分享、可导出的资产（每日打卡照片、AI 总结、报告分享、生长曲线对照、独立导出页）。
2. **个性化与协作**：补齐用户头像、多宝快捷切换持久化、AI 助手多会话历史，让产品在多宝家庭与重度用户场景下手感更顺。
3. **可访问性 + 工程基础**：首次使用引导、a11y 全量 audit、i18n 框架预埋、路由级代码分割。这些是 v7.x 阶段必须夯实的基础设施，否则后续国际化 / 信息无障碍合规 / 性能优化都会被拖住。

> 数据库会新增 4 张表（`DailyCheckin` / `Conversation` / `ConversationMessage` / `JaundiceRecord`）、`User.avatar` 改为云端化、`User.preferences` 收口个性化设置。详情见 §13。

---

## 1. 功能清单（共 12 项）

| #  | 项 | 类型 | 优先级 | 预估 | 主线 |
|----|---|------|--------|------|------|
| F1 | 首次使用引导 / Onboarding | 体验 | P0 | 1.5d | 可访问性 |
| F2 | 黄疸记录持久化（localStorage → 云端） | 业务 | P0 | 2d | 内容沉淀 |
| F3 | 导出独立页 `/export` | 业务 | P1 | 1.5d | 内容沉淀 |
| F4 | 报告分享卡片 + 下载 | 业务 | P1 | 1d | 内容沉淀 |
| F5 | AI 助手对话历史持久化 + 多会话 | 业务 | P1 | 3d | 个性化 |
| F6 | 多宝快捷切换持久化 + URL 参数 | 体验 | P1 | 0.5d | 个性化 |
| F7 | a11y 全量 audit | 工程 | P1 | 2d | 可访问性 |
| F8 | i18n 框架预埋 | 工程 | P2 | 1.5d | 工程基础 |
| F9 | 路由级代码分割 | 工程 | P1 | 0.5d | 工程基础 |
| F10 | 生长曲线对照 WHO 百分位线 | 业务 | P1 | 2d | 内容沉淀 |
| F11 | 宝宝每日打卡照片 + 每日 AI 总结 + 成长日历 | 业务 | P0 | 6d | 内容沉淀（核心亮点） |
| F12 | 用户头像设置 | 体验 | P1 | 1d | 个性化 |

**总工作量预估**：约 **22.5 人天**（含 0.5-1d buffer 后约 25 人天）。

---

## 2. F1 · 首次使用引导 / Onboarding

### 2.1 目标
首次登录用户（或新加入家庭的用户）进入主应用时，给一条 3-4 步的「最短可达」体验路径，让用户在 60 秒内看到第一条记录。

### 2.2 触发条件
- 登录成功后判断 `user.preferences.onboardingCompleted !== true`
- 或路由跳到 `/?onboarding=1`（用于测试和"重新观看"）

### 2.3 步骤设计

| 步骤 | 目标页 | 关键动作 | 跳过策略 |
|------|--------|---------|---------|
| 1 | `/baby/new` | 创建第一个宝宝 | 若家庭已有宝宝则跳过 |
| 2 | `/family` | 邀请家人（展示邀请码 + 跳过按钮） | 可跳过 |
| 3 | `/record` | 高亮 FAB / 加号，引导记一条 | 可跳过 |
| 4 | `/ai-assistant` | 提示"遇到问题可以问 AI" | 完成 |

### 2.4 实现

- 新组件 `components/onboarding/onboarding-overlay.tsx`：用 Radix Dialog 全屏蒙层 + 步骤化 Stepper + 高亮目标元素的 `data-onboarding-target` 锚点。
- 新 store `stores/onboarding-store.ts`（zustand persist，key `baby_care_onboarding`）：`{ step: number; completed: boolean; skipped: boolean }`。
- API：在 `PATCH /api/auth/me` 入参里新增 `preferences.onboardingCompleted: boolean`（依赖 §13 `User.preferences`）；完成或跳过都落到后端，避免跨设备重复弹。
- 文案与高亮锚点抽到 `lib/onboarding-steps.ts`，便于 i18n 接入（见 F8）。

### 2.5 验收
- ✅ 新账号 / 新家庭成员首次进入会触发；
- ✅ 跳过 / 完成后跨设备不重复触发；
- ✅ `/?onboarding=1` 强制触发用于演示；
- ✅ a11y：Tab 键可在步骤间切换，`Esc` 退出。

---

## 3. F2 · 黄疸记录持久化（localStorage → 云端）

### 3.1 背景
当前 `client/src/lib/jaundice.ts` 把数据存在 `localStorage`，**换设备 / 清缓存即丢，且家庭成员之间不可见**。这是 v5.0.0 alpha 的临时方案，v7.2 完成迁移。

### 3.2 数据模型（见 §13）

```prisma
model JaundiceRecord {
  id            String   @id @default(cuid())
  babyId        String
  familyId      String
  recordDate    DateTime              // 测量日期（不含时间）
  dayAge        Int?                  // 日龄
  kramerZone    Int?                  // 1-5
  scleralIcterus Boolean?             // 巩膜黄染
  tcb           Float?                // 经皮胆红素
  tsb           Float?                // 血清胆红素
  category      String?               // physiologic | pathologic | breastmilk
  symptoms      String?               // JSON array
  treatments    String?               // JSON array
  note          String?
  createdBy     String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  baby    Baby @relation(fields: [babyId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@index([babyId, familyId, recordDate])
}
```

### 3.3 API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/babies/:id/jaundice` | GET | 列表，`?startDate&endDate` 可选 |
| `/api/babies/:id/jaundice` | POST | 新建 |
| `/api/babies/:id/jaundice/:recordId` | PATCH | 更新 |
| `/api/babies/:id/jaundice/:recordId` | DELETE | 删除 |

鉴权矩阵复用现有 record 体系（`record:create / update:own|any / delete:own|any`）。

### 3.4 前端改造

- `services/jaundice.ts`：新增，替换 `lib/jaundice.ts` 的 localStorage 操作。
- `hooks/use-jaundice.ts`：React Query 包装。
- `pages/jaundice/index.tsx`：保留现有 UI，仅替换数据源。
- **数据迁移**：`App` 启动时检测 `localStorage.baby_care_jaundice:${babyId}`，存在则一次性 POST 到云端，成功后清理 key 并打 toast「已同步至云端」。提供 `lib/migrations/jaundice-to-cloud.ts` 封装。
- 类型同步到 `shared/types`。

### 3.5 验收
- ✅ 老用户首次登录看到 toast，本地黄疸记录全部上云；
- ✅ 家庭成员可见同一份黄疸记录；
- ✅ 权限矩阵正确（editor 只能改自己创建的）；
- ✅ 失败可重试，迁移幂等。

---

## 4. F3 · 导出独立页 `/export`

### 4.1 背景
当前导出入口在 `/settings`，缺少时间范围 / 分类筛选与历史导出列表。后端 `/api/export` 已存在（`server/src/routes/export.ts`）。

### 4.2 UI 设计

```
┌─ /export ─────────────────────────────────────┐
│ ◀ 返回            导出数据                     │
├───────────────────────────────────────────────┤
│ 宝宝：[小明 ▾]   时间范围：[最近 30 天 ▾]      │
│ 数据类型：☑ 喂养 ☑ 睡眠 ☑ 换尿布 ☑ 体温       │
│         ☑ 成长 ☑ 疫苗 ☑ 里程碑 ☑ 黄疸         │
│ 格式：[CSV / JSON / PDF (报告)]                │
│                                               │
│        [   开始导出   ]                        │
├───────────────────────────────────────────────┤
│ 历史导出（最近 10 次）                          │
│   • 2026-05-10 小明 最近 30 天.csv  ↓重新下载  │
│   • 2026-05-03 ...                             │
└───────────────────────────────────────────────┘
```

### 4.3 实现
- 新页面 `pages/export/index.tsx`、新组件 `components/export/export-form.tsx`。
- "历史导出"v7.2 阶段先用 localStorage 缓存最近 10 次下载链接（不入库），降低后端改动；后续若需多设备同步再加 `ExportHistory` 表。
- `/settings` 原入口改为「跳转到导出页」的链接。
- 路由层接入 §11 代码分割（lazy chunk）。

### 4.4 验收
- ✅ 可按宝宝 / 范围 / 类型组合导出；
- ✅ 导出进行中显示骨架 + 进度（如果是大数据量，复用现有 cursor 续传思路）；
- ✅ 失败有明确错误码；
- ✅ 历史列表可重新下载（链接 7 天有效，需提示）。

---

## 5. F4 · 报告分享卡片 + 下载

### 5.1 背景
`lib/share-canvas.ts` 已有 `renderReportImage`，但报告页 UI 上**没有显眼的分享入口**。本期把它接通到产品入口。

### 5.2 实现
- 报告页 (`pages/report/index.tsx`) 顶部头部右侧新增 `ShareButton`：
  - 桌面端：弹出预览 Modal → 下载 PNG / 复制图片 / 复制链接（带 watermark）。
  - 移动端：若 `navigator.share` 支持，直接拉起系统分享盘。
- 抽出 `components/report/report-share-dialog.tsx`，复用 v7.0 的 share-canvas DPR 处理。
- 关联 F11 的"成长日历"：报告下方提供「连同成长日历一起导出 PDF」按钮（生成多页 PDF，第一页为报告图、后续页面为日历）。**PDF 渲染选用 `pdf-lib`（轻量、纯前端）**，避免引入 jsPDF + html2canvas 的大体积组合。
- 文案预留 i18n key。

### 5.3 验收
- ✅ 报告页一键分享，图片质量在 2DPR 屏幕清晰；
- ✅ 长 AI 总结不被裁切；
- ✅ PDF 导出含报告 + 日历，文件大小 < 5MB。

---

## 6. F5 · AI 助手对话历史持久化 + 多会话

### 6.1 背景
当前 AI 助手只有当前会话，刷新即丢；重度用户痛点。

### 6.2 数据模型（见 §13）

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String
  familyId  String
  babyId    String?              // 关联宝宝（可空：通用对话）
  title     String                // 首条消息前 30 字自动生成，可重命名
  archived  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ConversationMessage[]

  @@index([userId, updatedAt])
  @@index([familyId])
}

model ConversationMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user | assistant | system
  content        String   // markdown 文本
  tokenIn        Int?
  tokenOut       Int?
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}
```

### 6.3 API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/ai/conversations` | GET | 列表（分页，按 `updatedAt desc`） |
| `/api/ai/conversations` | POST | 新建会话（返回 id） |
| `/api/ai/conversations/:id` | GET | 详情 + 消息列表 |
| `/api/ai/conversations/:id` | PATCH | 重命名 / 归档 |
| `/api/ai/conversations/:id` | DELETE | 删除 |
| `/api/ai/conversations/:id/messages` | POST (SSE) | 在会话内发消息（流式，沿用现有 `chatStream`） |

旧 `/api/ai/chat-stream` 保留 30 天，标记 deprecated，避免破坏小程序端 / 旧 Web 客户端。

### 6.4 前端改造

- `pages/ai-assistant/index.tsx`：左侧抽屉（移动端 Sheet）显示会话列表 + 「新建」按钮；右侧消息区接入会话上下文。
- `hooks/use-conversations.ts` + `use-conversation-messages.ts`。
- 流式消息发送沿用现有 SSE 协议，仅在请求体加 `conversationId`。服务端在 `chatStream` 完成时同步落 `ConversationMessage`（user + assistant 两条），失败不阻断（best-effort）。
- **autoPrompt 协议升级**：当 `state.autoPrompt` 触发时，自动创建新会话（标题来自首条 prompt 前 30 字），避免跨场景污染同一会话。
- 配额 / 失败回滚链不变（见 architecture.md §2.6）。

### 6.5 验收
- ✅ 刷新后历史会话仍在；
- ✅ 跨设备同步；
- ✅ 同一家庭其他成员**看不到**其他人的对话（按 `userId` 过滤，非 familyId）；
- ✅ 删除会话级联清理消息；
- ✅ autoPrompt 每次开新会话，不污染历史。

---

## 7. F6 · 多宝快捷切换持久化 + URL 参数

### 7.1 背景
`BabySwitcher` 切换后刷新可能跳第一胎；分享 URL 看不到当前是哪一胎。

### 7.2 实现
- 当前选中 babyId 双向同步到：
  1. URL search params `?babyId=xxx`（首选数据源）
  2. `localStorage.baby_care_active_baby:${familyId}`（兜底）
  3. zustand `useActiveBabyStore`（运行时）
- 优先级：URL > localStorage > 家庭第一胎。
- 离开页面 / 切宝宝时 `replaceState` 更新 URL，不污染 history。
- 关键页面（首页 / 记录 / 报告 / 黄疸 / 里程碑 / 疫苗 / 成长）统一接入。
- 抽 hook `hooks/use-active-baby.ts` 收口。

### 7.3 验收
- ✅ 分享 `?babyId=xxx` 链接对方打开看到同一胎；
- ✅ 刷新后保持；
- ✅ 删除当前选中宝宝后自动回退到家庭第一胎，不报错。

---

## 8. F7 · a11y 全量 audit

### 8.1 范围
- 全站 14 个页面 + 31 个 ui/ 组件 + 业务组件。
- 重点：键盘可达性、ARIA 标签、对比度（夜间老人记录场景刚需）、屏幕阅读器朗读顺序。

### 8.2 执行
1. **工具接入**：
   - 安装 `eslint-plugin-jsx-a11y` 并接入到 `eslint.config.js`；
   - 在 dev 环境引入 `@axe-core/react`（仅 dev / 通过 `import.meta.env.DEV` gating），实时打印 a11y 警告；
   - Playwright 用 `@axe-core/playwright` 给 P0 用例加 a11y 断言。
2. **手动 audit 清单**（产出 `docs/web-a11y-audit-2026-05.md`）：
   - 所有 button / a 必须有可见或 aria 文本；
   - Dialog 有 `aria-labelledby` / `aria-describedby`；
   - 表单 input 有 `<label>` 关联；
   - 颜色对比度 WCAG AA（4.5:1），美拉德色系暗色文本需要复核；
   - 焦点 ring 在所有交互元素可见，键盘 Tab 顺序合理；
   - `prefers-reduced-motion` 关闭动画。
3. **修复 PR 拆分**：按页面分 5-7 个小 PR，避免一个巨 PR。

### 8.3 验收
- ✅ `pnpm lint` 0 a11y warning；
- ✅ axe 扫描首页 / 记录页 / AI 助手 / 报告页 0 critical issue；
- ✅ 键盘可完成"新建宝宝 → 记录一条 → 看报告"全流程；
- ✅ 文档归档到 `docs/web-a11y-audit-2026-05.md`。

---

## 9. F8 · i18n 框架预埋

### 9.1 范围
**只做框架预埋，不翻译**，留出后续 ＂繁中 / 英文＂的接入口子。

### 9.2 实现
- 引入 `react-i18next` + `i18next`（共约 35KB gzip）；
- 目录结构：
  ```
  client/src/i18n/
    ├── index.ts             # 初始化（默认 zh-CN，fallback zh-CN）
    ├── resources/
    │   ├── zh-CN/
    │   │   ├── common.json
    │   │   ├── record.json
    │   │   ├── report.json
    │   │   └── ai.json
    │   └── en-US/           # 仅留空骨架
    └── README.md            # 接入指南
  ```
- 抽离规则：**只抽离用户可见的中文文案**，先抽 5 个高频页面（首页 / 记录 / 报告 / AI / 设置）；其他页面在 v7.3+ 渐进迁移。
- ESLint 自定义规则 `no-hardcoded-chinese`（仅在 `src/i18n/migrated/` 内白名单生效），防止反向回退。
- 增加 `<LanguageSwitcher>` 占位组件（暂时只显示"中文"，禁用切换），落地到 `/settings` 个性化卡。
- 错误码 / 后端文案：后端不做 i18n，由前端在 ApiError mapper 里查表。

### 9.3 验收
- ✅ 5 个高频页面所有可见中文走 `t()`；
- ✅ 切换 `localStorage.i18nextLng = 'en-US'` 可看到缺失 key（fallback 到 zh-CN）；
- ✅ 不影响 SSR / 首屏（暂未做 SSR，但为未来留口）；
- ✅ 文档 `docs/web-i18n-guide.md` 产出，写明如何新增 key、如何接新语言。

---

## 10. F9 · 路由级代码分割

### 10.1 现状
`client/src/App.tsx`（或路由文件）目前全量 import 14 个 page，首屏 JS 偏大。

### 10.2 实现
- 把所有 page 改为 `React.lazy(() => import('./pages/xxx'))`；
- 配 `Suspense fallback={<RouteSkeleton />}`（统一空骨架，可复用 `<HomeSkeleton>` 简化版）；
- 报告 / 成长 / AI 这几个重图表 / markdown 渲染的页面单独拆 chunk；
- Vite manualChunks 调优：
  ```ts
  // vite.config.ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'], // 或 echarts
          'vendor-radix':  [/^@radix-ui/],
          'vendor-i18n':   ['react-i18next', 'i18next'],
        }
      }
    }
  }
  ```
- 加 `rollup-plugin-visualizer` 输出 `dist/stats.html`，CI 卡阈值：首屏入口 chunk gzip ≤ 250KB。

### 10.3 验收
- ✅ 首屏 chunk 体积下降 ≥ 30%（基线先测一遍记到本文档 §15）；
- ✅ 切路由有平滑骨架，无白屏；
- ✅ `dist/stats.html` 入 CI artifact。

---

## 11. F10 · 生长曲线对照 WHO 百分位线

### 11.1 范围
在成长页 `pages/growth/index.tsx` 的身高 / 体重 / 头围曲线上叠加 WHO 标准百分位线（P3 / P15 / P50 / P85 / P97），并在数据点上标注「当前位于 P75（中上水平）」之类的描述。

### 11.2 数据来源
- WHO 0-5 岁标准（Length-for-age、Weight-for-age、Weight-for-length、HCFA）；
- 数据离线打包到 `client/src/data/who-standards/*.json`，分性别 / 指标 / 月龄；
- 总大小约 100-150KB（gzip 后 ~30-40KB），不影响首屏（按需 import）。

### 11.3 实现
- 新模块 `lib/who-percentile.ts`：
  - `getPercentile(value, ageInMonths, gender, metric): number`
  - `getZScore(...)`：用 LMS 方法（L、M、S 三参数），WHO 官方公式：
    \[ Z = \frac{(value / M)^L - 1}{L \cdot S}, \quad L \neq 0 \]
- 图表（recharts 或现有）叠加 5 条参考线（P3 / P15 / P50 / P85 / P97），半透明虚线；
- 数据点 hover 显示 `P75（中上水平）`；
- 异常值（< P3 或 > P97）整行红色提示，并提供「向 AI 咨询建议」按钮（autoPrompt 协议，§5.5）；
- 成长报告子组件 `components/report/report-growth.tsx` 同步显示百分位。

### 11.4 验收
- ✅ 5 条曲线渲染正确，色阶清晰；
- ✅ 月龄超出 0-60 月范围时优雅降级（不渲染参考线 + 提示「超出 WHO 标准范围」）；
- ✅ 在小屏（375px）依然可读；
- ✅ 单元测试覆盖典型百分位计算（与 WHO 官方表对比误差 < 0.1）。

---

## 12. F11 · 宝宝每日打卡照片 + 每日 AI 总结 + 成长日历（核心亮点）

### 12.1 产品愿景
让用户每天为宝宝拍一张照片，配上当天 AI 基于所有记录生成的"成长小记"，沉淀为可回顾的"成长相册"。在周报 / 月报中导出成日历形态的成长表，作为产品最强的情感卖点和分享传播载体。

### 12.2 数据模型（见 §13）

> **v7.2 Sprint 2 修正（T-S2-F11-BE-01）**：原设计字段名 `photoUrl`（绝对 URL）已改为 `photoKey`（COS 桶内 key），与 INF-02 方案 B 一致。展示时由前端 `buildImageUrl(key)` 拼成 `/api/uploads/{key}` 走代理。

```prisma
model DailyCheckin {
  id          String   @id @default(cuid())
  babyId      String
  familyId    String
  checkinDate String                // YYYY-MM-DD（本地时区，按家庭设置）
  photoKey    String                // COS 桶内 key（v7.2 Sprint 2 修正：原 photoUrl）
  photoWidth  Int?
  photoHeight Int?
  caption     String?               // 用户手写说明（可选）
  aiSummary   String?               // AI 生成的"今日小记"，markdown
  aiSummaryAt DateTime?             // AI 总结生成时间
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  baby    Baby @relation(fields: [babyId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@unique([babyId, checkinDate])   // 每天每个宝宝一张
  @@index([babyId, familyId, checkinDate])
}
```

> 关键约束：`(babyId, checkinDate)` 唯一，**一天一张**。重新上传则 PATCH 覆盖（旧图清理由 patrol 任务异步做）。

### 12.3 图片存储方案

v7.2 选用 **腾讯云 COS + 服务端签发预签名 URL** 方案，原因：
- 项目已有 CloudBase 生态（小程序端用 CloudBase 存储），COS 是同一体系；
- 不引入文件上 Express → 文件 → DB 的中转，减小后端内存压力；
- 后续小程序端打通时可共享同一桶。

后端：
- 新 service `server/src/services/upload.service.ts`：`createPresignedUpload(userId, kind, ext): { uploadUrl, publicUrl, key }`；
- 路由 `POST /api/uploads/presign`，入参 `{ kind: 'daily-checkin' | 'avatar' | 'baby-avatar', ext }`；
- 桶策略：`daily-checkin/{familyId}/{babyId}/{date}-{cuid}.jpg`，公网可读但 URL 不可枚举（cuid 随机）；
- 服务端落 DB 时只存 `photoUrl`，不缓存图片本身。

前端：
- 客户端上传前 **压缩 + 旋转修正**（用 `browser-image-compression`），目标 1080px 长边、JPEG 0.85，单图约 200-400KB；
- 上传组件 `components/daily-checkin/photo-uploader.tsx`：拖拽 + 相册 + 摄像头（移动端 `<input capture>`）；
- 上传过程显示进度条（XHR 监听 progress）。

### 12.4 每日 AI 总结

- 触发时机：
  - 用户上传照片时**异步触发**生成（不阻塞上传完成）；
  - 或用户在日历点"生成 AI 小记"按钮触发；
- 数据上下文：当天该宝宝所有 records + 里程碑达成 + 体温异常等，组装成 prompt；
- 沿用 `ai.service.ts` 的 `consumeQuota / fallback` 链；
- 后端新方法 `aiService.generateDailyCheckinSummary(babyId, date, role)`，与现有 `dailyInsight` 区分（前者是"小记"基调更温柔感性，后者是"洞察"基调更客观）；
- 缓存 key：`daily_checkin_summary:${babyId}:${date}:${role}`；
- 写入 `DailyCheckin.aiSummary + aiSummaryAt`；
- 用户可编辑 AI 总结（编辑后清空 `aiSummaryAt`，标识"已人工修改"）。

### 12.5 UI 设计

#### 12.5.1 每日打卡入口
- 首页 `<TodaySummary>` 下方新增「今日打卡」卡片：
  - 已打卡 → 显示缩略图 + AI 小记前 2 行 + 「查看完整」；
  - 未打卡 → 显示 + 号 + 文案"今天给宝宝拍一张吧"。

#### 12.5.2 成长日历页 `/growth/calendar`
```
┌─ 小明的成长日历 · 2026 年 5 月 ───┐
│ 一  二  三  四  五  六  日       │
│ -   -   -   -   1📷  2📷  3       │
│ 4📷 5📷 6📷 7📷 8📷  9📷  10📷    │
│ 11📷 ...                          │
└──────────────────────────────────┘
点击单元格 → 抽屉显示当日照片 + AI 小记 + 全部记录
```
- 月视图 / 周视图切换；
- 缺失日期显示灰色 +（可补打卡，但日期不可改 = 当天才能打卡，**逾期补打卡仅允许 7 天内**，超出灰显）；
- 月视图整体可"长截图导出 PNG" 或"导出 PDF（每月一页）"；
- 报告页 F4 PDF 导出可一并附带"本期成长日历"。

### 12.6 API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/uploads/presign` | POST | 申请上传链接 |
| `/api/babies/:id/checkins` | GET | 列表，`?startDate&endDate` |
| `/api/babies/:id/checkins` | POST | 新建 / 上传完成回调 |
| `/api/babies/:id/checkins/:date` | GET | 单日详情 |
| `/api/babies/:id/checkins/:date` | PATCH | 更新（图 / caption / AI 总结） |
| `/api/babies/:id/checkins/:date` | DELETE | 删除（仅 admin / 自己创建的 editor） |
| `/api/babies/:id/checkins/:date/ai-summary` | POST | 重新生成 AI 总结（扣配额） |

### 12.7 验收
- ✅ 一天一张约束有效，重复上传走 PATCH；
- ✅ AI 小记异步生成，失败有 fallback 文案；
- ✅ 成长日历月 / 周视图切换流畅；
- ✅ 月视图整月导出图片 / PDF（含 AI 小记）；
- ✅ 报告 PDF 可附带日历页；
- ✅ 文件大小：单张 ≤ 500KB，月度 PDF ≤ 8MB；
- ✅ 全家可见，删除权限正确；
- ✅ 离开/删除宝宝级联清理 DB 记录（**对象存储中的文件由 patrol 异步清理**，新增 patrol 任务 `checkinPhotoCleanup`，每周日 04:00）。

### 12.8 风险与降级
- COS 配置缺失：上传时报 503 + 引导管理员配置 `COS_*` 环境变量；
- 大文件 / 网络弱：上传失败保留本地 blob 在 IndexedDB，下次自动重传（与未来离线队列复用）；
- AI 配额耗尽：图照常存，AI 小记显示「明日再试」+ 手动补生成入口；
- 隐私敏感：导出图片不带 EXIF GPS（上传前剥离）。

---

## 13. F12 · 用户头像设置

### 13.1 实现
- 复用 §F11 的 `POST /api/uploads/presign`（kind=`avatar`）；
- 旧 `User.avatar` 字段含义升级：以前可能存空，现在存 COS URL；
- 上传流程：选图 → 压缩到 512px → presign → PUT → 落库；
- 默认头像：基于昵称首字生成 SVG（与小程序端的算法一致，留 `lib/default-avatar.ts`）；
- 入口位置：`/profile` 顶部 + `/settings` "账号"卡；
- 同步家庭成员列表显示新头像；
- 同理给 `Baby.avatar` 也补一个上传组件（复用 `<AvatarUploader>`），首页 BabyCard / Switcher 立刻可见。

### 13.2 验收
- ✅ 头像上传 + 裁切 + 预览；
- ✅ 旧用户（avatar 为空）首次进入显示默认 SVG，不报错；
- ✅ 头像变更全站立即生效（React Query invalidate `me` + `family/members`）。

---

## 14. 数据模型变更汇总

### 14.1 新增表

```prisma
model JaundiceRecord { ... }     // F2
model Conversation { ... }       // F5
model ConversationMessage { ... } // F5
model DailyCheckin { ... }       // F11
```

### 14.2 字段调整

```prisma
model User {
  // ...
  avatar      String?            // 复用，迁移到 COS URL
  preferences String?            // 新增 JSON 字段，存 { onboardingCompleted, fontScale, lang, ... }
}
```

### 14.3 Migration 顺序
1. `add_user_preferences`
2. `add_jaundice_records`
3. `add_conversations`
4. `add_daily_checkins`

每个 migration 独立 PR，便于回滚。

### 14.4 同步文档
- `docs/web-architecture.md`：新增 §5.5 黄疸云端化、§5.6 AI 多会话、§5.7 每日打卡、§5.8 用户头像；
- `docs/web-api-spec.md`：新增 8 类路由；
- `docs/web-coding-conventions.md`：新增「文件上传」「i18n 使用」「a11y checklist」；
- `docs/web-component-library.md`：新增 `OnboardingOverlay` / `PhotoUploader` / `AvatarUploader` / `GrowthCalendar` / `ConversationSidebar` / `LanguageSwitcher` / `ReportShareDialog` / `WhoPercentileLines` 等组件条目；
- `docs/web-ui-spec.md`：补充日历视图色彩约定与照片占位样式；
- `docs/devops-workflow.md`：新增 COS 桶配置与 patrol `checkinPhotoCleanup` 章节。

---

## 15. 排期建议（按 sprint 拆 2 周一迭代）

### Sprint 1（2026-05-11 → 2026-05-22，10 工作日）
| 任务 | 工期 | 备注 |
|------|------|------|
| F9 路由级代码分割 | 0.5d | 工程基础先行 |
| F8 i18n 框架预埋 | 1.5d | 之后开发新页面默认走 i18n |
| F12 用户头像 | 1d | 验证上传链路 |
| F2 黄疸云端化 | 2d | DB / API 第一波 |
| F3 导出独立页 | 1.5d | |
| F6 多宝快捷切换持久化 | 0.5d | |
| F1 首次使用引导 | 1.5d | 收尾 |
| 文档同步 + Bug 修 | 1.5d | |

**Sprint 1 末交付物**：v7.2-rc.1，可灰度。

### Sprint 2（2026-05-25 → 2026-06-05，10 工作日）
| 任务 | 工期 |
|------|------|
| F11 每日打卡 + AI 小记 + 成长日历 | 6d |
| F10 WHO 百分位线 | 2d |
| F4 报告分享 + PDF | 1d |
| 文档 + Bug 修 | 1d |

**Sprint 2 末交付物**：v7.2-rc.2，全量灰度。

### Sprint 3（2026-06-08 → 2026-06-19，10 工作日）
| 任务 | 工期 |
|------|------|
| F5 AI 多会话 | 3d |
| F7 a11y 全量 audit + 修复 | 2d |
| 灰度反馈修 + 性能优化 | 2d |
| 上线 / Release Notes | 1d |

**Sprint 3 末交付物**：v7.2.0 GA。

### Sprint 4（建议档期 2026-06-22 → 2026-07-03，10 工作日）
> 详见 [`docs/web-roadmap-v7.2-sprint4-design.md`](./web-roadmap-v7.2-sprint4-design.md) 与 [`docs/web-roadmap-v7.2-sprint4-tasks.md`](./web-roadmap-v7.2-sprint4-tasks.md)
> 主线：**账号体系打磨 —— 长期免登 + 密码找回**

| 任务 | 工期 | 优先级 |
|------|------|------|
| F-AUTO 自动登录（tokenVersion + rememberMe + 滑动续期 + AuthBootGate） | 2.0d | P0 |
| F-FP 密码找回（腾讯云 SES + PasswordResetToken + 3 端点 + 2 落地页） | 3.5d | P0 |
| F-INF 共享基础设施（EmailService + tokenVersion 嵌入 JWT） | 1.0d | P0 |
| 文档 + Bug 修 + 灰度反馈 | 1.0d | — |

**关键决策**：
- 找回渠道**仅邮箱**，短信留到 v7.3+
- 邮件服务用**腾讯云 SES**，**复用 INF-02 的 COS 子账号 AK/SK**（CAM 子账号补 `SendEmail` 权限即可）
- 重置形态：邮件链接 → 落地页输新密码（30 分钟有效、单次消费、token DB 仅存 sha256）
- 自动登录做完整版：`User.tokenVersion` 强制下线 + `rememberMe` 控制 cookie 30d / session

**Sprint 4 末交付物**：v7.2.0-rc.4，灰度发布。

---

## 16. 性能基线（开工前需采集）

在 `feature/v7.2-roadmap` 分支起步前先在 `master` 跑一次 baseline，记录到本文档：

| 指标 | 基线（待填） | v7.2 目标 |
|------|------|----------|
| 首屏入口 chunk gzip | _ KB | ≤ 入口降 30% |
| 首屏 TTI（4G） | _ ms | ≤ 2s |
| 报告页 LCP | _ ms | ≤ 2.5s |
| AI 流式首字延迟 | _ ms | 保持现状 |
| Lighthouse a11y 评分 | _ | ≥ 95 |

---

## 17. 后续 / 不在 v7.2 范围

- 离线队列 + PWA（已在 parity gap §5.2 列为 P1，v7.3 启动）
- 微信扫码登录（依赖企业资质，独立排期）
- 与小程序端数据互通（架构议题，单独评估）
- 疫苗下次提醒 + Web Push（v7.3）
- AI 周报邮件订阅（v7.3）
- 双端用户体系 `wechatUnionId` 接入
- 短信验证码找回（v7.3+，自动登录 + 邮箱找回已在 Sprint 4 落地）
- 多因子认证 / TOTP（v8 安全主题）
- 「最近活跃设备」面板 + 主动「全部设备登出」（依赖 Sprint 4 的 tokenVersion，v7.3+）

---

## 18. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-11 | v7.2 草案 v1.0 | 初版，12 项功能 + 3 sprint 排期（@唐瀚） |
| 2026-05-11 | v7.2 草案 v1.1 | 新增 Sprint 4：自动登录 + 密码找回（@唐瀚） |
