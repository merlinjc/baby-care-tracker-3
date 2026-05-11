# Web v7.2 · Sprint 1 整体设计文档

> 范围：v7.2 Sprint 1（2026-05-11 → 2026-05-22，10 工作日）
> 主线：工程基础 + 个性化基础 + 内容沉淀第一波
> 分支：`feature/v7.2-roadmap`（feature branch 内部按 task 切 PR 合并）
> 上游：[`docs/web-roadmap-v7.2.md`](./web-roadmap-v7.2.md)
> 任务清单：[`docs/web-roadmap-v7.2-sprint1-tasks.md`](./web-roadmap-v7.2-sprint1-tasks.md)

---

## 1. Sprint 1 范围与目标

### 1.1 包含的 7 项功能

| 编号 | 功能 | 工期 | 主线 | 关键依赖 |
|------|------|------|------|---------|
| F9 | 路由级代码分割 | 0.5d | 工程基础 | — |
| F8 | i18n 框架预埋 | 1.5d | 工程基础 | F9（lazy 路由要兼容 Suspense） |
| F12 | 用户头像设置 | 1d | 个性化基础 | 共享基础设施 §3.1（COS 预签名上传） |
| F2 | 黄疸记录持久化 | 2d | 内容沉淀 | 共享基础设施 §3.2（轻量 REST 模式） |
| F3 | 导出独立页 `/export` | 1.5d | 内容沉淀 | F9（lazy 路由） |
| F6 | 多宝快捷切换持久化 + URL 参数 | 0.5d | 个性化基础 | — |
| F1 | 首次使用引导 / Onboarding | 1.5d | 可访问性 | 共享基础设施 §3.3（`User.preferences`） |
| Buffer | 文档同步 + Bug 修 | 1.5d | — | — |

**总计**：10 工作日。

### 1.2 不在 Sprint 1 范围
- F11 每日打卡 + AI 小记 + 成长日历（Sprint 2，但 §3.1 的 COS 上传基础设施在 F12 提前落地，F11 直接复用）
- F10 WHO 百分位线（Sprint 2）
- F4 报告分享 PDF（Sprint 2）
- F5 AI 多会话（Sprint 3）
- F7 a11y 全量 audit（Sprint 3）

### 1.3 Sprint 1 结束态

- ✅ 首屏入口 JS chunk gzip 体积 ≤ 基线 70%
- ✅ 5 个高频页面（首页 / 记录 / 报告 / AI / 设置）全部走 `t()`，可通过 `localStorage.i18nextLng = 'en-US'` 验证 fallback
- ✅ 用户头像可上传 / 编辑 / 显示，宝宝头像同理
- ✅ 黄疸记录全部上云，老用户登录后看到一次性迁移 toast，本地数据清空
- ✅ `/export` 独立页可用，按宝宝 / 范围 / 类型 / 格式组合下载
- ✅ 多宝切换刷新保持，URL 带 `?babyId=`，分享链接对方看到同一胎
- ✅ 新账号 / 新成员首次登录看到 4 步引导，跳过 / 完成跨设备生效
- ✅ 文档（web-architecture / web-api-spec / web-component-library / web-coding-conventions / devops-workflow）同步到位
- ✅ 标记 `v7.2.0-rc.1`，可灰度

---

## 2. 现状盘点（开发前必读）

### 2.1 路由结构（F9 改造对象）

```
client/src/
├── main.tsx                     # createRoot + StrictMode
├── app/
│   ├── App.tsx                  # QueryClient + Tooltip + RouterProvider + Toaster + ConfirmHost
│   ├── routes.tsx               # createBrowserRouter — 当前全部 eager import 14 个 page
│   └── layout/
│       ├── main-layout.tsx      # 桌面 Sidebar + 移动 TabBar + Outlet
│       └── auth-layout.tsx
└── pages/                       # 14 个 page (home / record / discover / profile / baby /
                                 # family / growth / vaccine / milestone / ai-assistant /
                                 # jaundice / report / settings / auth/*)
```

**现状**：`routes.tsx` 顶部 18 行全部 `import { XxxPage } from '@/pages/xxx'`，导致首屏需下载所有页面 JS。

### 2.2 状态管理（F6 / F12 / F1 改造点）

```
client/src/stores/
├── auth-store.ts                # zustand + persist (baby_care_token)
├── baby-store.ts                # zustand + persist (baby_care_current_baby, partialize currentBabyId)
├── family-store.ts              # zustand
├── font-scale-store.ts          # zustand + persist (baby_care_font_scale)
└── theme-store.ts               # zustand + persist (baby_care_theme)
```

- **`baby-store`** 已经把 `currentBabyId` persist 到 localStorage，F6 只需补 URL ↔ store 双向同步层（不动 store 本身）。
- **`auth-store`** 持有 `user` 字段，F1 / F12 都需要它，但目前 `user.preferences` / `user.avatar` 都需要补充类型与 API。

### 2.3 后端结构

```
server/src/
├── app.ts
├── routes/   auth / babies / records / vaccines / families / ai / export / index
├── services/ auth / baby / record / vaccine / family / ai / trend / milestone / wechat-auth / export
├── middleware/
├── schemas/  Zod
├── utils/    permission / operation-logger / patrol / patrol-lock / rate-limit-persistent
└── prisma/   schema.prisma (SQLite dev / MySQL prod)
```

**Sprint 1 需要新增**：
- `routes/uploads.ts` + `services/upload.service.ts`（F12 / 共享给 F11）
- `routes/jaundice.ts` + `services/jaundice.service.ts`（F2）
- `schemas/jaundice.schema.ts`（F2）
- `routes/auth.ts` 扩展 `PATCH /api/auth/me` 支持 `preferences` 部分更新（F1 / F12 复用）

### 2.4 现有依赖

| 库 | 用途 | Sprint 1 是否新增 |
|---|---|---|
| react / react-dom / react-router-dom 7 | — | 不变 |
| @tanstack/react-query 5 | data fetching | 不变 |
| zustand 5 | 全局态 | 不变 |
| @radix-ui/* + framer-motion + lucide-react | UI | 不变 |
| axios | HTTP | 不变 |
| **`react-i18next` + `i18next` + `i18next-browser-languagedetector`** | i18n | **新增**（F8） |
| **`browser-image-compression`** | 图片压缩 | **新增**（F12 / F11 共用） |
| **`rollup-plugin-visualizer`** | bundle 分析 | **新增**（F9） |

服务端：
| 库 | 用途 | 新增 |
|---|---|---|
| **`cos-nodejs-sdk-v5`** | 腾讯云 COS 预签名 | **新增**（F12） |
| 现有 Prisma 6 + Zod | — | 不变 |

---

## 3. 共享基础设施（多个功能复用）

### 3.1 COS 预签名上传链路（F12 实现 → F11 复用）

#### 3.1.1 后端

**新增 `server/src/services/upload.service.ts`**：

```typescript
import COS from 'cos-nodejs-sdk-v5'
import { config } from '@/config'

type UploadKind = 'avatar' | 'baby-avatar' | 'daily-checkin'

interface PresignResult {
  uploadUrl: string      // PUT 直传 URL，5 分钟过期
  publicUrl: string      // 完成后用于落库与展示
  key: string            // 桶内对象 key
  expiresAt: string      // ISO
}

class UploadService {
  private cos: COS

  constructor() {
    this.cos = new COS({
      SecretId: config.cos.secretId,
      SecretKey: config.cos.secretKey,
    })
  }

  /**
   * 生成预签名 PUT URL
   * - kind=avatar:        avatars/{userId}/{cuid}.{ext}
   * - kind=baby-avatar:   babies/{familyId}/{babyId}/{cuid}.{ext}
   * - kind=daily-checkin: checkins/{familyId}/{babyId}/{date}-{cuid}.{ext}
   */
  async createPresignedUpload(
    userId: string,
    kind: UploadKind,
    ext: string,
    ctx?: { familyId?: string; babyId?: string; date?: string },
  ): Promise<PresignResult> {
    // 1. 校验 ext 白名单：jpg/jpeg/png/webp
    // 2. 校验 ctx 必填字段
    // 3. 拼接 key
    // 4. cos.getObjectUrl({ Sign: true, Method: 'PUT', Expires: 300 })
    // 5. publicUrl = `https://${bucket}.cos.${region}.myqcloud.com/${key}`
  }
}

export const uploadService = new UploadService()
```

**新增 `server/src/routes/uploads.ts`**：

```typescript
POST /api/uploads/presign
Body: { kind: 'avatar' | 'baby-avatar' | 'daily-checkin', ext: string, babyId?: string, date?: string }
Resp: { uploadUrl, publicUrl, key, expiresAt }
RateLimit: presign（10/min/user）
```

#### 3.1.2 前端

**新增 `client/src/services/upload.ts`**：

```typescript
export const uploadService = {
  async upload(file: File, kind: UploadKind, ctx?): Promise<{ publicUrl: string }> {
    // 1. 压缩（browser-image-compression）：长边 1080（checkin）/ 512（avatar），JPEG 0.85
    // 2. 剥 EXIF GPS（同压缩库可配置 exifOrientation + preserveExif: false）
    // 3. POST /api/uploads/presign 拿到 uploadUrl
    // 4. fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } })
    // 5. 返回 publicUrl
  }
}
```

**新增 `client/src/components/ui/image-uploader.tsx`**：

通用单图上传组件，props：
```typescript
interface ImageUploaderProps {
  value?: string          // 当前 URL
  onChange: (url: string) => void
  kind: UploadKind        // avatar / baby-avatar / daily-checkin
  ctx?: { babyId?: string; date?: string }
  shape?: 'circle' | 'square'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
```

#### 3.1.3 配置与降级

- 环境变量：`COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION`
- 缺失任一 → `/api/uploads/presign` 返回 503 `UPLOAD_NOT_CONFIGURED`
- 前端兜底：显示「头像上传未配置，请联系管理员」+ 默认 SVG 头像继续可用

### 3.2 轻量 REST CRUD 模式（F2 + 未来 F11 复用）

黄疸记录、未来打卡记录都属于「单 baby 关联的子集合」，统一模式：

```
GET    /api/babies/:id/{collection}              # 列表，支持 ?startDate&endDate
POST   /api/babies/:id/{collection}              # 创建
GET    /api/babies/:id/{collection}/:recordId    # 详情
PATCH  /api/babies/:id/{collection}/:recordId    # 更新
DELETE /api/babies/:id/{collection}/:recordId    # 删除
```

**统一约束**（在所有此类路由中复用）：
1. 通过 `asyncHandler` 包装（防 service 抛错请求挂死）
2. 通过 `authenticate` 中间件 → `ctx.userId`
3. service 层强制 `baby.familyId === ctx.user.familyId` 校验（跨家庭隔离）
4. 写操作走 `OperationLogger`（start / succeed / fail 三态）
5. 创建者字段固定为 `createdBy`，权限矩阵复用 record：admin 跨人编辑 / editor 仅自己 / viewer 只读
6. 列表查询有 `take` 上限（200），超过用 cursor 分页

> **F11 的 daily-checkin 也按此模板，加 `(babyId, checkinDate)` 唯一约束**

### 3.3 `User.preferences` JSON 字段（F1 / F12 / F8 共用）

**Migration**：`server/prisma/migrations/xxx_add_user_preferences/migration.sql`

```sql
ALTER TABLE "User" ADD COLUMN "preferences" TEXT; -- JSON string (SQLite)
```

**Schema 类型（落 `shared/types/user.ts`）**：

```typescript
export interface UserPreferences {
  /** F1：首次使用引导是否完成 */
  onboardingCompleted?: boolean
  /** F1：引导中跳过的步骤（用于"重新观看"逻辑） */
  onboardingSkippedSteps?: string[]
  /** F8：当前语言，默认 zh-CN */
  lang?: string
  /** F8：是否曾手动切换过语言（用于决定是否再尊重浏览器 locale） */
  langManuallySet?: boolean
  /** v7.1 字体档：和 font-scale-store 持久化同步用（仅作为跨设备种子） */
  fontScale?: 'sm' | 'md' | 'lg' | 'xl'
  /** v7.1 主题：和 theme-store 持久化同步用 */
  themeMode?: 'light' | 'warm-night' | 'system'
}
```

**API**：

```
PATCH /api/auth/me
Body: { nickname?, avatar?, preferences?: Partial<UserPreferences> }
说明：preferences 走「深合并」（顶层 key 级别），不是全量替换；
     前端传哪个 key 就只更新哪个 key。
```

**前端 store 接入**：
- `auth-store` 的 `user` 类型加 `preferences?: UserPreferences`
- 新增 `updatePreferences(patch)` action，内部调 `PATCH /api/auth/me`

### 3.4 上传 / 头像 / 引导 / 黄疸 / 导出 / 多宝 / i18n 之间的依赖

```
┌──────────────────────────────────────────────────┐
│ F9 路由代码分割（独立，最先做）                    │
│  └─ 不依赖其他                                     │
└──────────────────────────────────────────────────┘
                  │
                  ▼ （F8 的 lazy resources 需要 Suspense 兼容）
┌──────────────────────────────────────────────────┐
│ F8 i18n 框架                                       │
│  └─ 不依赖业务功能，但要在所有新页面（F3 / F1）落地 │
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ §3.1 COS 上传链路（F12 实现，F11 / 未来 daily-    │
│      checkin 复用）                               │
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ §3.3 User.preferences（F1 / F8 / F12 共用）       │
└──────────────────────────────────────────────────┘
                  │
        ┌─────────┴─────────────────────┐
        ▼                               ▼
┌────────────────────┐         ┌──────────────────┐
│ F12 用户头像        │         │ F1 首次引导       │
│ - 复用上传组件      │         │ - 读 preferences  │
│ - 写 user.avatar    │         │ - 写 preferences  │
└────────────────────┘         └──────────────────┘

┌──────────────────────────────────────────────────┐
│ F2 黄疸云端化（独立 CRUD，§3.2 模式）              │
│  └─ localStorage 一次性迁移到 POST                │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ F3 导出独立页                                      │
│  └─ 仅前端 + 文案 i18n                            │
│  └─ 后端复用现有 /api/export                       │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ F6 多宝 URL 参数                                   │
│  └─ 独立，hook + 各页面接入                        │
└──────────────────────────────────────────────────┘
```

**关键时序约束**：
- F9 必须最先做（之后所有新页都按 lazy 模式落）
- F8 紧随其后（F3 / F1 的新文案直接走 t()，避免回头改）
- §3.1 必须先于 F12 落地（一次性把上传基础设施抽好）
- §3.3 必须先于 F1 / F12 落地（schema 改一次）

---

## 4. F9 · 路由级代码分割 — 详细设计

### 4.1 改造目标

- 14 个 page 全部从 eager import 改为 `React.lazy`
- 配统一的 `<RouteSuspense fallback>` 包装（不在 `routes.tsx` 各 element 重复写 Suspense）
- Vite manualChunks 拆 vendor，避免 page chunk 反复抓 React / Radix
- 引入 `rollup-plugin-visualizer`，产出 `dist/stats.html`
- CI 加入 bundle 体积阈值脚本：首屏入口 chunk gzip > 250KB 时 fail

### 4.2 实现方案

#### 4.2.1 `client/src/app/routes.tsx` 重写

```tsx
import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { MainLayout } from '@/app/layout/main-layout'
import { AuthLayout } from '@/app/layout/auth-layout'
import { RouteFallback } from '@/app/layout/route-fallback'

// Lazy pages —— 命名导出包一层默认导出供 React.lazy 用
const HomePage         = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })))
const RecordPage       = lazy(() => import('@/pages/record').then(m => ({ default: m.RecordPage })))
const DiscoverPage     = lazy(() => import('@/pages/discover').then(m => ({ default: m.DiscoverPage })))
const ProfilePage      = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })))
const BabyPage         = lazy(() => import('@/pages/baby').then(m => ({ default: m.BabyPage })))
const FamilyPage       = lazy(() => import('@/pages/family').then(m => ({ default: m.FamilyPage })))
const GrowthPage       = lazy(() => import('@/pages/growth').then(m => ({ default: m.GrowthPage })))
const VaccinePage      = lazy(() => import('@/pages/vaccine').then(m => ({ default: m.VaccinePage })))
const MilestonePage    = lazy(() => import('@/pages/milestone').then(m => ({ default: m.MilestonePage })))
const AiAssistantPage  = lazy(() => import('@/pages/ai-assistant').then(m => ({ default: m.AiAssistantPage })))
const JaundicePage     = lazy(() => import('@/pages/jaundice').then(m => ({ default: m.JaundicePage })))
const ReportPage       = lazy(() => import('@/pages/report').then(m => ({ default: m.ReportPage })))
const SettingsPage     = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))

const LoginPage          = lazy(() => import('@/pages/auth/login').then(m => ({ default: m.LoginPage })))
const RegisterPage       = lazy(() => import('@/pages/auth/register').then(m => ({ default: m.RegisterPage })))
const WechatCallbackPage = lazy(() => import('@/pages/auth/wechat-callback').then(m => ({ default: m.WechatCallbackPage })))

const lazyEl = (El: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<RouteFallback />}>
    <El />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/',             element: lazyEl(HomePage) },
      { path: '/record',       element: lazyEl(RecordPage) },
      { path: '/discover',     element: lazyEl(DiscoverPage) },
      { path: '/profile',      element: lazyEl(ProfilePage) },
      { path: '/baby',         element: lazyEl(BabyPage) },
      { path: '/family',       element: lazyEl(FamilyPage) },
      { path: '/growth',       element: lazyEl(GrowthPage) },
      { path: '/vaccine',      element: lazyEl(VaccinePage) },
      { path: '/milestone',    element: lazyEl(MilestonePage) },
      { path: '/ai-assistant', element: lazyEl(AiAssistantPage) },
      { path: '/jaundice',     element: lazyEl(JaundicePage) },
      { path: '/report',       element: lazyEl(ReportPage) },
      { path: '/settings',     element: lazyEl(SettingsPage) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',                element: lazyEl(LoginPage) },
      { path: '/register',             element: lazyEl(RegisterPage) },
      { path: '/auth/wechat/callback', element: lazyEl(WechatCallbackPage) },
    ],
  },
])
```

#### 4.2.2 `client/src/app/layout/route-fallback.tsx`（新增）

```tsx
/**
 * 路由切换时的占位骨架。
 * - 复用 surface-0 底，避免与 MainLayout 颜色撕裂
 * - 占满整个 content 高度，避免布局抖动
 * - 200ms 后才显示骨架点阵（避免快速切换闪烁）
 */
import { useEffect, useState } from 'react'

export function RouteFallback() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="正在加载"
      className="min-h-[60vh] flex items-center justify-center"
    >
      {visible && (
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse [animation-delay:120ms]" />
          <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse [animation-delay:240ms]" />
        </div>
      )}
    </div>
  )
}
```

#### 4.2.3 `client/vite.config.ts` 增强

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    isAnalyze &&
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
        open: false,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@baby-care-tracker/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':  ['@tanstack/react-query'],
          'vendor-radix':  [
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-icons':  ['lucide-react'],
          'vendor-utils':  ['axios', 'clsx', 'tailwind-merge', 'class-variance-authority', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
```

#### 4.2.4 package.json scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:analyze": "ANALYZE=true vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

#### 4.2.5 CI 阈值脚本（轻量）

新增 `scripts/check-bundle-size.js`（项目根目录）：

```javascript
#!/usr/bin/env node
// 读 client/dist/assets/*.js，计算入口（entry-* / index-*）gzip 大小
// > THRESHOLD_KB（默认 250）时 process.exit(1)
```

Sprint 1 暂不强制接到 CI，仅在本地与 `pnpm build:analyze` 后人工跑一次。Sprint 2 启动前再决定是否接 GitHub Actions。

### 4.3 风险与回滚

| 风险 | 缓解 |
|------|------|
| Lazy 化后页面切换闪烁 | RouteFallback 加 200ms 延迟出现 + Suspense fallback；预热关键页（首页）通过 `<link rel="modulepreload">` 即可（Vite 已默认） |
| Suspense 与 React Query SSR boundary 冲突 | 当前不做 SSR，无影响 |
| 命名导出包默认导出的样板代码冗长 | 接受（一次性），未来如全部页都改默认导出可省略 |
| manualChunks 把 radix 拆太大导致下载阻塞 | Radix 整包 gzip ≈ 60KB，合理；后续若超 100KB 再二次拆 |
| `rollup-plugin-visualizer` 增加 dev 依赖 | 只在 ANALYZE=true 时启用，不影响生产构建 |

### 4.4 验收

| 验收项 | 验证方式 |
|--------|---------|
| 14 个 page 全部 lazy | grep `routes.tsx`，无 `import { XxxPage }` |
| 首屏 chunk 体积下降 ≥ 30% | `pnpm build` 前后对比 `dist/assets/index-*.js` gzip 大小，记录到本文档 §4.5 |
| 切换路由有平滑骨架 | 手工切 5 个 page，无白屏 |
| `pnpm build:analyze` 产出 `dist/stats.html` | 浏览器打开可见 treemap |
| 无 TS / ESLint 报错 | `pnpm build` 0 error |

### 4.5 基线数据（开发后填）

| 指标 | master baseline | F9 完成后 | 变化 |
|------|---------|---------|------|
| 入口 chunk gzip | _ KB | _ KB | _ |
| vendor-react chunk gzip | — | _ KB | — |
| vendor-radix chunk gzip | — | _ KB | — |
| 首页路由 chunk gzip | — | _ KB | — |
| 报告页路由 chunk gzip | — | _ KB | — |
| 总产物大小 | _ MB | _ MB | _ |

---

## 5. F8 · i18n 框架预埋 — 详细设计

### 5.1 目录结构

```
client/src/i18n/
├── index.ts                  # i18next 初始化
├── resources/
│   ├── zh-CN/
│   │   ├── common.json       # 按钮、提示、错误码
│   │   ├── nav.json          # 导航 / TabBar
│   │   ├── home.json
│   │   ├── record.json
│   │   ├── report.json
│   │   ├── ai.json
│   │   └── settings.json
│   └── en-US/                # 仅留同名空文件作为 fallback 演示
└── README.md                 # 使用指南
```

### 5.2 初始化

`client/src/i18n/index.ts`：

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zhCommon from './resources/zh-CN/common.json'
import zhNav from './resources/zh-CN/nav.json'
// ... 其他 zh-CN 资源

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh-CN',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'baby_care_lang',
    },
    resources: {
      'zh-CN': {
        common: zhCommon,
        nav: zhNav,
        // ...
      },
    },
  })

export default i18n
```

`main.tsx`：
```typescript
import '@/i18n'                  // 必须在 App 之前 import
```

### 5.3 接入策略

**Sprint 1 强制接入的 5 个页面 + 2 个公共区**：
1. `pages/home`
2. `pages/record`
3. `pages/report`
4. `pages/ai-assistant`
5. `pages/settings`
6. `app/layout/main-layout`（导航 / TabBar）
7. `lib/api-error.ts`（错误码 → 用户文案）

**抽取约定**：
- 所有可见中文走 `const { t } = useTranslation('home')` + `t('hero.title')`
- 占位符：`t('quota.left', { count: 5 })` → `"剩余 {{count}} 次"`
- 复数：用 i18next 自带 `_one` / `_other` 复数后缀

**未抽取的页面**（v7.3+ 渐进迁移）：discover / profile / baby / family / growth / vaccine / milestone / jaundice / auth/*

### 5.4 LanguageSwitcher 占位组件

`components/language-switcher.tsx`：
- v7.2 只显示「简体中文」+ disabled 状态
- 落到 `/settings` 「偏好设置」卡片
- 注释中写明：「下一版上线英文 / 繁中后启用切换」

### 5.5 ESLint 防回退（可选，Sprint 1 末做）

自定义规则 `no-hardcoded-chinese`，仅对 `src/pages/{home,record,report,ai-assistant,settings}/**` 和 `src/app/layout/main-layout.tsx` 生效。检测 `/[\u4e00-\u9fff]/` 直接出现在 JSX text / 字符串字面量。

> Sprint 1 不强制接入，先在 README 写明约定，Sprint 3 a11y 阶段顺手做。

### 5.6 验收

| 验收项 | 验证方式 |
|--------|---------|
| 5 高频页面 + main-layout 全部走 `t()` | grep `useTranslation` 应出现 ≥ 6 处 |
| 切 `localStorage.baby_care_lang = 'en-US'` 后刷新 | 看到 key 直显（fallback 到 zh-CN） |
| `t()` 占位符 / 复数语法正常 | 检查 quota / records 复数行 |
| 不影响首屏（i18n bundle gzip < 50KB） | `dist/stats.html` 查 vendor-i18n |
| `docs/web-i18n-guide.md` 产出 | 文档存在 |

---

## 6. F12 · 用户头像设置 — 详细设计

### 6.1 数据流

```
ProfilePage / SettingsPage
     │
     │ user.avatar
     ▼
┌──────────────────────┐
│ <ImageUploader        │
│   kind="avatar"       │   选图 → 压缩 512px → presign → PUT COS → publicUrl
│   value={user.avatar} │
│   onChange={save}     │
│ />                    │
└──────────────────────┘
     │
     │ save(publicUrl)
     ▼
┌──────────────────────┐
│ PATCH /api/auth/me    │
│ { avatar: publicUrl } │
└──────────────────────┘
     │
     │ res.data.user
     ▼
useAuthStore.setUser(res)
     │
     ▼
React Query invalidate ['me', 'family/members']  →  全站头像刷新
```

### 6.2 默认头像

`client/src/lib/default-avatar.ts`：

```typescript
/**
 * 基于昵称首字 + 字符串 hash 生成可识别 SVG dataURI
 * - 字色：白色
 * - 底色：从美拉德色板 8 色 中按 hash 取
 * - 字号：48px，居中
 */
export function getDefaultAvatarDataUri(name: string): string { ... }
```

`<Avatar>` 组件升级：
```tsx
<Avatar>
  <AvatarImage src={user.avatar || getDefaultAvatarDataUri(user.nickname)} />
  <AvatarFallback>{user.nickname.charAt(0)}</AvatarFallback>
</Avatar>
```

### 6.3 BabyAvatar 同步

`<BabyAvatar>` 同理用 `getDefaultAvatarDataUri(baby.name)`。

`<ImageUploader kind="baby-avatar">` 在 baby 创建 / 编辑表单中使用，落到 `Baby.avatar` 字段（已存在）。

### 6.4 后端

`PATCH /api/auth/me` 已存在，仅需：
- Zod schema 加 `avatar: z.string().url().optional()`
- service 层把 `avatar` 字段一并 set

### 6.5 验收

| 验收项 | 验证方式 |
|--------|---------|
| 选图 → 压缩 → 上传 → 落库 全链路 | 浏览器 Network 看 3 个请求（presign / PUT COS / PATCH me） |
| 旧用户 avatar=null 显示默认 SVG | 创建无头像账号验证 |
| 头像变更后家庭成员列表立即更新 | React Query invalidate 验证 |
| EXIF GPS 被剥离 | 用带 GPS 的照片上传，下载后用 `exiftool` 验证 |
| COS 未配置时优雅降级 | 临时清空 `COS_BUCKET` env，上传返回 503，UI 提示「未配置」，不崩溃 |

---

## 7. F2 · 黄疸记录持久化 — 详细设计

### 7.1 Prisma Schema

```prisma
model JaundiceRecord {
  id             String   @id @default(cuid())
  babyId         String
  familyId       String
  recordDate     DateTime              // 测量日期，存 UTC 当日 00:00
  dayAge         Int?
  kramerZone     Int?                  // 1-5
  scleralIcterus Boolean?
  tcb            Float?
  tsb            Float?
  category       String?               // 'physiologic' | 'pathologic' | 'breast_milk'
  symptoms       String?               // JSON string
  treatments     String?               // JSON string
  note           String?
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  baby    Baby @relation(fields: [babyId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@index([babyId, familyId, recordDate])
}
```

> 注意：SQLite dev 用 String 存 JSON；MySQL prod 后续可改 `Json` 类型。
> Migration 命名：`add_jaundice_records`。

### 7.2 API

按 §3.2 模板：

| 路由 | Body / Query | 备注 |
|------|--------------|------|
| `GET /api/babies/:id/jaundice?startDate&endDate` | — | 默认返回最近 100 条；按 recordDate desc |
| `POST /api/babies/:id/jaundice` | 全字段 | 创建 |
| `GET /api/babies/:id/jaundice/:recordId` | — | 详情 |
| `PATCH /api/babies/:id/jaundice/:recordId` | 部分字段 | 更新；归属校验 |
| `DELETE /api/babies/:id/jaundice/:recordId` | — | 删除；归属校验 |

### 7.3 前端改造

`client/src/lib/jaundice.ts`：
- **保留**：`KRAMER_ZONE_OPTIONS` / `SYMPTOM_OPTIONS` / `ACTION_OPTIONS` / `JaundiceRecord` 类型
- **删除**：localStorage 读写函数（`loadJaundice` / `saveJaundice`）
- **抽出迁移函数**：`client/src/lib/migrations/jaundice-to-cloud.ts`

`client/src/services/jaundice.ts`（新增）：
```typescript
export const jaundiceService = {
  list(babyId: string, params?): Promise<JaundiceRecord[]>,
  create(babyId: string, data): Promise<JaundiceRecord>,
  update(babyId: string, id: string, data): Promise<JaundiceRecord>,
  remove(babyId: string, id: string): Promise<void>,
}
```

`client/src/hooks/use-jaundice.ts`（新增）：React Query 包装，提供 `useJaundiceRecords(babyId)` / `useCreateJaundice()` / 等。

`client/src/pages/jaundice/index.tsx`：仅替换数据源（localStorage → React Query），UI 与交互保持不变。

### 7.4 数据迁移

`client/src/lib/migrations/jaundice-to-cloud.ts`：

```typescript
/**
 * 一次性把 localStorage 的黄疸记录迁移到云端
 * - key 模式：`baby_care_jaundice:${babyId}`
 * - 完成后清理 key，set `baby_care_jaundice_migrated_v1` 标记
 * - 失败不抛错，记录到 console.warn，下次启动重试
 */
export async function migrateJaundiceToCloud(): Promise<{ migrated: number; failed: number }>
```

触发时机：`App.tsx` 在 `isAuthenticated && babies.length > 0` 后 `setTimeout(..., 1500)`（避免阻塞首屏），完成后 toast「已同步 N 条黄疸记录到云端」。

幂等：标记 key 存在则跳过。

### 7.5 验收

| 验收项 | 验证方式 |
|--------|---------|
| CRUD 四个 API 跨家庭隔离正确 | Vitest 集成测试覆盖 |
| 老用户登录后看到迁移 toast | 手动制造 localStorage 数据验证 |
| 家庭成员可见同一份数据 | 双账号验证 |
| editor 不能删别人创建的记录 | 权限矩阵测试 |
| 迁移幂等 | 重复登录不重复创建 |

---

## 8. F3 · 导出独立页 `/export` — 详细设计

### 8.1 路由

`/export` 由 MainLayout 承载，加入 lazy 路由列表（F9）。

### 8.2 页面布局

```
┌─ /export ─────────────────────────────────────┐
│ <PageHeader title="导出数据" backTo="/profile">│
│                                                │
│ <Card 选择宝宝>                                │
│   <SegmentedControl> 单选当前家庭所有宝宝       │
│                                                │
│ <Card 时间范围>                                │
│   <SegmentedControl> 最近 7 天 / 30 天 / 90 天 │
│                       / 自定义                  │
│   （自定义展开 DateRangePicker）                │
│                                                │
│ <Card 数据类型>                                │
│   <Checkbox 矩阵> 喂养 / 睡眠 / 换尿布 / 体温  │
│                  / 成长 / 疫苗 / 里程碑 / 黄疸 │
│                                                │
│ <Card 导出格式>                                │
│   <RadioGroup> CSV / JSON                      │
│                                                │
│ <Button primary> 开始导出                      │
│                                                │
│ <SectionHeader>历史导出</SectionHeader>         │
│   <ListRow> 时间 / 范围 / 文件名 / 重新下载    │
└───────────────────────────────────────────────┘
```

### 8.3 复用后端

`/api/export` 已存在，前端只需：
1. 组装查询参数（babyId / startDate / endDate / types[] / format）
2. fetch + blob → `URL.createObjectURL` → `<a download>`
3. 把下载链接 + 元数据存入 `localStorage.baby_care_export_history`（最多 10 条）

后端 zod schema 是否需要扩展数据类型枚举：扫一下 `server/src/routes/export.ts` 决定是否补 `jaundice` 类型（依赖 F2）。

### 8.4 文案 i18n

全部走 `t()`（resources/zh-CN/export.json，新增到 i18n namespace 列表）。

### 8.5 验收

| 验收项 | 验证方式 |
|--------|---------|
| 各参数组合可导出，文件正确 | 手工 4 组组合验证 |
| 历史列表 ≤ 10 条 FIFO | 模拟超 10 条验证 |
| 大数据量（>5000 条）导出不卡死 | 用 seed 灌注后验证 |
| 旧 `/settings` 导出入口跳新页 | UI 验证 |
| 黄疸类型可选（依赖 F2） | F2 完成后再勾上 |

---

## 9. F6 · 多宝快捷切换持久化 + URL 参数 — 详细设计

### 9.1 优先级

```
URL search param ?babyId=  ✓ 最高
     │ 无
     ▼
zustand baby-store.currentBabyId（已 persist 到 localStorage） ✓
     │ 无 / 已删
     ▼
babies[0]（家庭第一胎） ✓ 兜底
```

### 9.2 新 hook `client/src/hooks/use-active-baby.ts`

```typescript
export function useActiveBaby() {
  const [search, setSearch] = useSearchParams()
  const babies = useBabyStore(s => s.babies)
  const currentBaby = useBabyStore(s => s.currentBaby)
  const selectBaby = useBabyStore(s => s.selectBaby)
  const queryClient = useQueryClient()

  const urlBabyId = search.get('babyId')

  // 1. URL → store 同步（URL 优先）
  useEffect(() => {
    if (urlBabyId && urlBabyId !== currentBaby?.id) {
      const exists = babies.some(b => b.id === urlBabyId)
      if (exists) {
        selectBaby(urlBabyId)
      } else {
        // URL 里的 babyId 不存在，清掉 URL
        setSearch(prev => { prev.delete('babyId'); return prev }, { replace: true })
      }
    }
  }, [urlBabyId, babies])

  // 2. store → URL 同步（用户在 BabySwitcher 切换时）
  const switchBaby = useCallback((id: string) => {
    selectBaby(id)
    queryClient.invalidateQueries({ queryKey: ['todayStats', id] })
    queryClient.invalidateQueries({ queryKey: ['records', id] })
    queryClient.invalidateQueries({ queryKey: ['activeSleep', id] })
    setSearch(prev => { prev.set('babyId', id); return prev }, { replace: true })
  }, [])

  return { currentBaby, babies, switchBaby }
}
```

### 9.3 接入点

替换以下 5 个地方的 `selectBaby`：
- `app/layout/main-layout.tsx` SidebarBabyCard
- `components/baby-switcher.tsx`
- `pages/home/index.tsx`
- `pages/report/index.tsx`
- `pages/growth/index.tsx`（如有）

> `pages/jaundice/index.tsx`、`pages/milestone/index.tsx`、`pages/vaccine/index.tsx`、`pages/record/index.tsx` 用 `useBabyStore(s => s.currentBaby)` 即可，无须接入 switch；URL 同步 hook 只需挂在用户能切换宝宝的页面或 layout（MainLayout 顶部统一挂一次）。

**最佳实践**：把 `useActiveBaby()` 挂在 `MainLayout` 顶部一次，所有子页只读 `currentBaby`。

### 9.4 验收

| 验收项 | 验证方式 |
|--------|---------|
| 分享 `?babyId=xxx` 给另一台机器，看到同一胎 | 手动验证 |
| 切换宝宝后刷新依然是当前胎 | 手动验证 |
| URL 中 babyId 不存在时优雅降级 | 手工拼 fake id 验证 |
| 删除当前选中宝宝后回退到第一胎 | 手工删除验证 |

---

## 10. F1 · 首次使用引导 / Onboarding — 详细设计

### 10.1 步骤定义

`client/src/lib/onboarding-steps.ts`：

```typescript
export interface OnboardingStep {
  id: 'create-baby' | 'invite-family' | 'first-record' | 'try-ai'
  title: string
  description: string
  /** 目标元素：DOM data 锚点 */
  target?: string
  /** 完成跳转 */
  targetPath?: string
  /** 可跳过 */
  skippable: boolean
  /** 已满足条件即视为已完成（避免对已建宝宝用户重复引导） */
  isAlreadySatisfied?: (ctx: { babiesCount: number; familyMemberCount: number; hasAnyRecord: boolean }) => boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'create-baby',
    title: '添加你的宝宝',
    description: '先创建一位宝宝，开始记录他/她的成长',
    targetPath: '/baby',
    skippable: false,
    isAlreadySatisfied: (ctx) => ctx.babiesCount > 0,
  },
  {
    id: 'invite-family',
    title: '邀请家人一起记录',
    description: '把邀请码发给爱人或长辈，多人协作更轻松',
    targetPath: '/family',
    skippable: true,
    isAlreadySatisfied: (ctx) => ctx.familyMemberCount > 1,
  },
  {
    id: 'first-record',
    title: '记录第一条',
    description: '试着记下今天的喂养 / 睡眠 / 换尿布',
    target: 'data-onboarding-target="add-record-fab"',
    targetPath: '/record',
    skippable: true,
    isAlreadySatisfied: (ctx) => ctx.hasAnyRecord,
  },
  {
    id: 'try-ai',
    title: '问问 AI 育儿小助手',
    description: '科学育儿建议、参考范围、异常提示都能问',
    targetPath: '/ai-assistant',
    skippable: true,
  },
]
```

### 10.2 新组件

`components/onboarding/onboarding-overlay.tsx`：
- 基于 Radix Dialog
- 三段式：顶部步骤 indicator（4 个圆点）/ 中部 illustration（Lucide icon 大号）/ 底部 title + description + 按钮
- 按钮：`[跳过此步]` `[去试试 →]`（不可跳过的隐藏跳过按钮）
- `Esc` 退出整个引导（落到"已跳过"）

### 10.3 触发逻辑

`App.tsx`（或 MainLayout 顶部）：

```typescript
useEffect(() => {
  if (!isAuthenticated || !user) return
  if (user.preferences?.onboardingCompleted) return
  if (searchParams.get('onboarding') !== '1' && hasSeenInThisSession.current) return
  
  // 计算第一个未满足的步骤
  const ctx = { babiesCount: babies.length, familyMemberCount: family?.members.length ?? 1, hasAnyRecord }
  const firstStep = ONBOARDING_STEPS.findIndex(s => !s.isAlreadySatisfied?.(ctx))
  
  if (firstStep === -1) {
    // 所有步骤都已满足 → 直接标记完成
    updatePreferences({ onboardingCompleted: true })
    return
  }
  
  openOnboarding(firstStep)
}, [isAuthenticated, user])
```

### 10.4 状态保存

- 完成 / 跳过 → `PATCH /api/auth/me { preferences: { onboardingCompleted: true, onboardingSkippedSteps: [...] } }`
- localStorage 不另存，全部依赖 `user.preferences`（避免双向同步麻烦）
- session 内 `hasSeenInThisSession` ref 防止 React StrictMode 双触发

### 10.5 验收

| 验收项 | 验证方式 |
|--------|---------|
| 新账号首次登录看到引导 | 注册新账号验证 |
| 已有宝宝 / 记录的老账号不重复弹 | 复用已有账号验证 |
| 跳过 / 完成跨设备生效 | 换浏览器验证 |
| `/?onboarding=1` 可强制触发 | URL 验证 |
| `Esc` 退出整个流程并标记完成 | 键盘操作验证 |
| a11y：Tab / Esc 可达 | 键盘走一遍 |

---

## 11. 后端改动汇总

### 11.1 新增文件

```
server/src/
├── routes/
│   ├── uploads.ts            # POST /api/uploads/presign
│   └── jaundice.ts           # 5 端点
├── services/
│   ├── upload.service.ts     # COS 预签名
│   └── jaundice.service.ts   # CRUD + 跨家庭隔离
├── schemas/
│   └── jaundice.schema.ts    # Zod
└── config/                   # （扩展）加 cos 配置块
```

### 11.2 修改文件

| 文件 | 改动 |
|------|------|
| `server/prisma/schema.prisma` | + JaundiceRecord 表；User.preferences 字段 |
| `server/src/routes/auth.ts` | PATCH /me 支持 preferences 深合并 |
| `server/src/services/auth.service.ts` | updateMe 合并 preferences |
| `server/src/routes/index.ts` | 挂载 uploads / jaundice 路由 |
| `server/src/middleware/rate-limit-persistent.ts` | 新增 presign 限流器（10/min/user） |
| `server/src/routes/export.ts` | 数据类型枚举加入 `jaundice` |
| `server/src/services/export.service.ts` | 支持 jaundice 数据导出 |
| `shared/types/index.ts` | + JaundiceRecord / UserPreferences / UploadKind / PresignResult |

### 11.3 Migration 顺序

```
1. add_user_preferences              (F1 + F8 + F12 共用)
2. add_jaundice_records              (F2)
```

每个 migration 独立提交。

---

## 12. 前端改动汇总

### 12.1 新增文件

```
client/src/
├── i18n/                              # F8
│   ├── index.ts
│   ├── README.md
│   └── resources/
│       ├── zh-CN/{common,nav,home,record,report,ai,settings,export,onboarding}.json
│       └── en-US/                     # 空目录占位
├── components/
│   ├── ui/
│   │   └── image-uploader.tsx         # §3.1 通用上传组件
│   ├── onboarding/
│   │   ├── onboarding-overlay.tsx     # F1
│   │   └── onboarding-step.tsx
│   ├── avatar-uploader.tsx            # F12（薄封装 ImageUploader）
│   └── language-switcher.tsx          # F8 占位
├── pages/
│   └── export/
│       └── index.tsx                  # F3
├── hooks/
│   ├── use-active-baby.ts             # F6
│   └── use-jaundice.ts                # F2
├── services/
│   ├── upload.ts                      # §3.1
│   └── jaundice.ts                    # F2
├── lib/
│   ├── default-avatar.ts              # F12
│   └── migrations/
│       └── jaundice-to-cloud.ts       # F2
├── stores/
│   └── (无新增；扩展 auth-store 类型)
└── app/
    └── layout/
        └── route-fallback.tsx         # F9
```

### 12.2 修改文件

| 文件 | 改动 |
|------|------|
| `client/src/main.tsx` | + import '@/i18n' |
| `client/src/app/App.tsx` | + 黄疸迁移触发；+ Onboarding 触发 |
| `client/src/app/routes.tsx` | 全量 lazy 化 + RouteFallback |
| `client/src/app/layout/main-layout.tsx` | + useActiveBaby hook；+ 数据 onboarding-target |
| `client/vite.config.ts` | + manualChunks + visualizer + analyze script |
| `client/package.json` | + 5 个依赖；+ build:analyze script |
| `client/src/stores/auth-store.ts` | + user.preferences 类型；+ updatePreferences action |
| `client/src/services/auth.ts` | + updatePreferences API 调用 |
| `client/src/components/ui/avatar.tsx` | + 默认头像 fallback |
| `client/src/components/baby-switcher.tsx` | 用 useActiveBaby.switchBaby |
| `client/src/pages/profile/index.tsx` | + 头像上传入口 |
| `client/src/pages/settings/index.tsx` | + LanguageSwitcher + 导出页跳转入口 |
| `client/src/pages/baby/index.tsx` | + BabyAvatar 上传入口（baby-avatar kind） |
| `client/src/pages/jaundice/index.tsx` | localStorage → React Query |
| `client/src/lib/jaundice.ts` | 保留常量，删除 IO |
| `client/src/types/index.ts` | + UserPreferences / JaundiceRecord / etc. |

---

## 13. 文档同步计划

| 文档 | Sprint 1 新增/修改章节 |
|------|---------------------|
| `docs/web-architecture.md` | + §5.5 黄疸云端化；+ §5.9 路由代码分割；+ §5.10 i18n 框架；+ §5.11 文件上传链路 |
| `docs/web-api-spec.md` | + 黄疸 5 端点；+ uploads 1 端点；+ PATCH /me 扩展说明 |
| `docs/web-coding-conventions.md` | + 「i18n 使用」「图片上传」「Lazy 路由」三节 |
| `docs/web-component-library.md` | + ImageUploader / AvatarUploader / OnboardingOverlay / LanguageSwitcher / RouteFallback |
| `docs/web-ui-spec.md` | + 默认头像调色规则；+ 引导组件视觉规范 |
| `docs/devops-workflow.md` | + COS 桶配置 + 环境变量；+ build:analyze 用法 |
| `docs/web-i18n-guide.md` | 新文件，i18n 使用指南 |

每个任务完成时同步对应文档段落，作为 PR 必备一环。

---

## 14. 测试策略

### 14.1 单元测试（vitest）

- F2 jaundice.service：CRUD + 跨家庭隔离
- F2 jaundice-to-cloud migration：幂等 + 失败重试
- §3.1 upload.service：key 拼接 + ext 白名单 + ctx 校验
- §3.3 auth.service updateMe：preferences 深合并

### 14.2 E2E（Playwright，最小集）

- F9 切 5 个 page，无白屏
- F1 新账号引导走通全流程
- F6 `?babyId=xxx` 链接打开后选中正确

### 14.3 手工验收清单

逐功能验收清单见 §4-10 各节末尾，Sprint 1 结束打勾归档到 `docs/web-roadmap-v7.2-sprint1-tasks.md` 附录。

---

## 15. 风险登记

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| COS 配置缺失阻塞 F12 / F11 上线 | 中 | DevOps 提前 1d 配桶；缺配置 503 优雅降级 |
| i18n bundle 影响首屏 | 低 | 资源 JSON 按页面拆，初始只载 common + nav |
| Lazy 化导致 SEO / 首屏白屏 | 低 | 当前不做 SSR；RouteFallback 200ms 延迟出现 |
| jaundice 迁移失败导致数据丢失 | 中 | 迁移完成才清 localStorage；迁移失败保留 + 下次重试 |
| Onboarding 在 multi-tab 重复触发 | 低 | session ref + storage event 监听 onboardingCompleted 变更 |
| `User.preferences` JSON 字段在 SQLite/MySQL 兼容性 | 低 | 双侧都用 TEXT/String 存 JSON 字符串，service 层负责 parse/stringify |

---

## 16. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-11 | Sprint 1 设计 v1.0 | 初版（@唐瀚） |
