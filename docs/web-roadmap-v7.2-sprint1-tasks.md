# Web v7.2 · Sprint 1 任务清单

> 范围：v7.2 Sprint 1（2026-05-11 → 2026-05-22，10 工作日）
> 设计文档：[`docs/web-roadmap-v7.2-sprint1-design.md`](./web-roadmap-v7.2-sprint1-design.md)
> 总入口：[`docs/web-roadmap-v7.2.md`](./web-roadmap-v7.2.md)

---

## 0. 任务编号约定

- 任务 ID 格式：`T-S1-{FX}-{NN}`，其中 FX 是功能编号（F1/F2/.../F12），NN 是该功能内序号。
- 每个任务对应**一个 PR**（小到中等粒度，便于 review）；超过 400 行变更的任务必须拆分为多个 PR。
- 状态标记：⬜ 未开始 / 🔵 进行中 / ✅ 已完成 / ⚠️ 阻塞 / ⏸️ 暂缓

---

## 1. 依赖关系总览

```
T-S1-F9-01 路由代码分割（最优先）
   │
   ├─→ T-S1-F8-01..03 i18n 框架
   │     │
   │     └─→ T-S1-F8-04..06 5 页面文案抽离（可与其他并行）
   │
   ├─→ T-S1-INF-01 共享：User.preferences migration
   │     │
   │     ├─→ T-S1-F12-01..03 用户头像
   │     │     │
   │     │     └─ 依赖 T-S1-INF-02 COS 上传链路
   │     │
   │     └─→ T-S1-F1-01..04 首次使用引导
   │
   ├─→ T-S1-INF-02 共享：COS 上传链路
   │     │
   │     └─→ T-S1-F12-* / 为 Sprint 2 F11 铺路
   │
   ├─→ T-S1-F2-01..05 黄疸云端化（独立可并行）
   │
   ├─→ T-S1-F3-01..03 导出独立页（依赖 i18n + F2 完成后补 jaundice 类型）
   │
   └─→ T-S1-F6-01..02 多宝 URL 参数（独立可并行）

T-S1-DOC-01..03 文档同步（跟随各功能完成时）
T-S1-REL-01    Sprint 1 验收与打 tag
```

---

## 2. 按"开发日"建议执行顺序

| Day | 任务（建议） |
|-----|-----|
| D1 (5/11) | T-S1-F9-01 路由代码分割（半天）+ T-S1-INF-01 preferences migration |
| D2 (5/12) | T-S1-F8-01..03 i18n 框架 + T-S1-F8-04 main-layout 抽离 |
| D3 (5/13) | T-S1-F8-05/06 4 高频页面文案抽离 + T-S1-INF-02 COS 链路（后端） |
| D4 (5/14) | T-S1-INF-02 续（前端 ImageUploader）+ T-S1-F12-01/02 用户头像后/前端 |
| D5 (5/15) | T-S1-F12-03 默认头像 + Baby 头像入口；T-S1-F6-01/02 多宝 URL |
| D6 (5/16) | T-S1-F2-01/02 黄疸后端（schema + CRUD） |
| D7 (5/19) | T-S1-F2-03/04 黄疸前端（service + page 改造） |
| D8 (5/20) | T-S1-F2-05 黄疸迁移脚本；T-S1-F3-01 导出页骨架 |
| D9 (5/21) | T-S1-F3-02/03 导出页交互 + 历史列表；T-S1-F1-01/02 引导组件 + 触发 |
| D10 (5/22) | T-S1-F1-03/04 引导接入 + a11y；T-S1-DOC-01..03 文档；T-S1-REL-01 验收 |

> **Buffer**：每天预留 ~30% 时间用于 review / 修复 / 文档同步，按 Sprint 总量 10d × 0.7 ≈ 7d 净开发，与设计文档 §1.1 工期匹配。

---

## 3. F9 · 路由级代码分割（0.5d）

### T-S1-F9-01 ✅ 路由 lazy 化 + vite manualChunks + visualizer + RouteFallback
**类型**：feat
**预估**：0.5d
**实际**：0.4d
**依赖**：—
**完成日期**：2026-05-11
**输出**：
- `client/vite.config.ts`：函数式 manualChunks 拆 6 组 vendor + 可选 visualizer
- `client/package.json`：+ `rollup-plugin-visualizer` devDep + `build:analyze` script
- `client/src/app/routes.tsx`：14 个 page 全部 `React.lazy` + `lazyEl()` 通用包装
- `client/src/app/layout/route-fallback.tsx`：200ms 延迟动画点阵 + a11y role/aria
- `docs/web-roadmap-v7.2-sprint1-design.md` §4.5：已填入基线数据

**实际收益**：
- 应用入口 chunk gzip：289.11 KB → **15.68 KB（↓ 94.6%）**
- 首屏首页加载 gzip：289.11 KB → **231.21 KB（↓ 20.0%）**
- chunk 数：1 → 49（长缓存命中率显著提升）
- build 警告：消除

**PR 标题**：`feat(web): 路由级代码分割 + vendor manualChunks（F9）`

---

## 4. 共享基础设施（必须先于 F1 / F12 / F2 落地）

### T-S1-INF-01 ✅ User.preferences 字段 + PATCH /profile 深合并
**类型**：feat (DB schema)
**预估**：0.5d
**实际**：0.4d
**依赖**：—
**完成日期**：2026-05-11
**输出**：
- `server/prisma/schema.prisma`：`User.preferences  String?`（SQLite TEXT 存 JSON）
- `server/src/schemas/auth.schema.ts`：新增 `userPreferencesPatchSchema`（已知键严格校验 + `.passthrough()` 透传未知键），`updateProfileSchema` 接入 `preferences` 可选字段
- `server/src/services/auth.service.ts`：新增 `parsePreferences` / `mergePreferences` 工具；`updateProfile` 走顶层 key 级深合并；`sanitizeUser` 输出反序列化对象
- `server/src/types/index.ts`：re-export `UserPreferences`
- `shared/types/index.ts`：新增 `UserPreferences` 接口（6 个已知键），`User` 加 `preferences?: UserPreferences | null`
- `client/src/types/index.ts`：re-export `UserPreferences`
- `client/src/services/auth.ts`：`updateProfile` 接受 `preferences` 入参；新增便捷方法 `updatePreferences(patch)`
- `client/src/stores/auth-store.ts`：新增 `updatePreferences(patch)` action
- `server/tests/integration/auth-update-profile.test.ts`：新增 10 个用例覆盖深合并 / 部分字段 / 未知键透传 / 脏 JSON 兜底

**沿用既有命名**：API 仍为 `PATCH /api/auth/profile`（不引入新端点 `/me`），与现有路由 / 文档一致；设计文档中描述的 `/me` 仅为示意。

**实际收益**：
- 后端：85/85 测试全绿（baseline 75 + 新增 10）
- 前端：build 通过，体积无变化（仅类型扩展，无 runtime 新依赖）
- 客户端获得一行 API 即可写偏好：`useAuthStore().updatePreferences({ key: value })`
- 为 F1 / F8 / F12 / 未来主题字体跨设备同步提供统一写入口

**PR 标题**：`feat(api): User.preferences 字段 + PATCH /profile 顶层 key 深合并（T-S1-INF-01）`

---

### T-S1-INF-02 ✅ COS 预签名上传链路（后端 + 前端通用组件）
**类型**：feat
**预估**：1d
**实际**：0.6d
**依赖**：—（DevOps 配桶可与开发并行）
**完成日期**：2026-05-11
**输出**：

后端：
- `server/src/services/upload.service.ts`：`createPresignedUpload(userId, kind, ext, ctx)` + 内部纯函数 helper（normalizeExt / validateContext / buildKey / buildPublicUrl）
- `server/src/routes/uploads.ts`：`POST /api/uploads/presign`（authenticate + presignRateLimit + zod validate）
- `server/src/schemas/upload.schema.ts`：Zod schema 含 ext 格式 + date YYYY-MM-DD 校验
- `server/src/middleware/rate-limit-persistent.ts`：新增 `presignRateLimit`（20 次/分钟/用户）
- `server/src/routes/index.ts`：挂载 `/uploads`
- `server/src/config/env.ts`：新增 `COS_SECRET_ID/KEY/BUCKET/REGION/PUBLIC_BASE_URL/PRESIGN_EXPIRES`
- `server/src/types/errors.ts`：新增 `UPLOAD_NOT_CONFIGURED / UPLOAD_INVALID_EXT / UPLOAD_MISSING_CONTEXT` 错误码
- `server/.env.example` + `docker/.env.example`：补 COS 配置段
- `server/package.json`：+ `cos-nodejs-sdk-v5`
- `tests/unit/upload-service.test.ts`：22 个用例覆盖 isConfigured / normalizeExt 白名单 / validateContext / buildKey / buildPublicUrl / createPresignedUpload mock COS

前端：
- `client/src/services/upload.ts`：`uploadService.upload(file, kind, ctx, options)`，含 browser-image-compression 压缩 + EXIF 剥离 + XHR 直传 COS（含 onProgress）
- `client/src/components/ui/image-uploader.tsx`：通用 render-prop 单图上传组件 + 默认按钮 fallback
- `client/package.json`：+ `browser-image-compression`
- 类型：`shared/types/index.ts` 新增 `UploadKind / UploadContext / PresignResult / PresignRequest`
- `server/src/types/index.ts` + `client/src/types/index.ts` re-export

**关键设计决策**：
- **直传模式**：前端 → COS（PUT），后端不接收文件 → 零内存压力
- **缺配置降级**：任一 COS_* 字段缺失返回 503 `UPLOAD_NOT_CONFIGURED`，前端 toast 提示且保留原 value 不阻塞主流程
- **EXIF GPS 剥离**：客户端压缩前 `preserveExif: false`，避免照片元数据泄露宝宝家庭地址
- **Key 不可枚举**：randomUUID 32 字符 hex 后缀
- **ext 白名单**：jpg / jpeg / png / webp，jpeg 归一化为 jpg
- **限流**：20 次/分钟/用户

**测试结果**：
- 后端单元 22/22 通过；server 全套 107/107（baseline 85 + INF-02 22）
- 前端 build 通过；现有 chunk 体积无变化（F12 接入前 service / component 都未被使用）

**为后续铺路**：
- F12 用户/Baby 头像直接复用 `<ImageUploader kind="avatar|baby-avatar">`
- Sprint 2 F11 每日打卡照片复用 `<ImageUploader kind="daily-checkin">`，无需再造轮子

**PR 标题**：`feat(uploads): COS 预签名上传链路 + ImageUploader 通用组件（T-S1-INF-02）`

---

## 5. F8 · i18n 框架预埋（1.5d）

### T-S1-F8-01 ⬜ i18next 初始化 + zh-CN 资源骨架
**类型**：feat
**预估**：0.3d
**依赖**：T-S1-F9-01
**输出**：
- `client/package.json`：+ `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- `client/src/i18n/index.ts`
- `client/src/i18n/README.md`
- `client/src/i18n/resources/zh-CN/{common,nav}.json`（先建 common + nav）
- `client/src/main.tsx`：`import '@/i18n'`

**验收**：
- `pnpm dev` 无报错
- 任意组件 `useTranslation('common')` 可工作

**PR 标题**：`feat(i18n): 引入 react-i18next 框架与 zh-CN 资源骨架（F8-1）`

---

### T-S1-F8-02 ⬜ main-layout 文案抽离
**类型**：refactor
**预估**：0.3d
**依赖**：T-S1-F8-01
**输出**：
- `client/src/i18n/resources/zh-CN/nav.json`：导航 4 项 / 选择宝宝 等
- `client/src/app/layout/main-layout.tsx`：所有可见中文走 `t()`

**验收**：
- 切 `localStorage.baby_care_lang = 'en-US'` 看到 nav key 直显
- 切回 zh-CN 恢复正常

**PR 标题**：`refactor(layout): main-layout 文案接入 i18n（F8-2）`

---

### T-S1-F8-03 ⬜ home + record 文案抽离
**类型**：refactor
**预估**：0.4d
**依赖**：T-S1-F8-01
**输出**：
- `client/src/i18n/resources/zh-CN/{home,record}.json`
- `pages/home/**`：抽离
- `pages/record/**`：抽离

**PR 标题**：`refactor(pages): home + record 文案接入 i18n（F8-3）`

---

### T-S1-F8-04 ⬜ report + ai-assistant + settings 文案抽离
**类型**：refactor
**预估**：0.4d
**依赖**：T-S1-F8-01
**输出**：
- `client/src/i18n/resources/zh-CN/{report,ai,settings}.json`
- 三个 page 抽离

**PR 标题**：`refactor(pages): report + ai + settings 文案接入 i18n（F8-4）`

---

### T-S1-F8-05 ⬜ LanguageSwitcher 占位 + i18n 使用文档
**类型**：feat / docs
**预估**：0.1d
**依赖**：T-S1-F8-01..04
**输出**：
- `client/src/components/language-switcher.tsx`：v7.2 仅显示「简体中文」+ disabled
- `pages/settings/index.tsx`：「偏好设置」卡片加入
- `docs/web-i18n-guide.md`：新增，写明 key 规则 / 新增语言步骤

**PR 标题**：`feat(settings): LanguageSwitcher 占位 + i18n 使用指南（F8-5）`

---

## 6. F12 · 用户头像设置（1d）

### T-S1-F12-01 ⬜ 默认头像 lib + Avatar 组件升级
**类型**：feat
**预估**：0.3d
**依赖**：—
**输出**：
- `client/src/lib/default-avatar.ts`：基于昵称首字 + hash 生成 SVG dataURI
- `client/src/components/ui/avatar.tsx`：fallback 改为默认头像
- 单元测试：相同输入产出相同 dataURI（确定性）

**PR 标题**：`feat(avatar): 昵称首字默认头像生成（F12-1）`

---

### T-S1-F12-02 ⬜ 用户头像上传 UI + 落库
**类型**：feat
**预估**：0.4d
**依赖**：T-S1-INF-02 / T-S1-F12-01
**输出**：
- `client/src/components/avatar-uploader.tsx`：薄封装 ImageUploader（kind=avatar，圆形，size=lg）
- `pages/profile/index.tsx`：Hero 卡左侧头像区改为可点击上传
- `pages/settings/index.tsx`（如有 me 卡）同步入口

**验收**：
- 全链路上传成功 + React Query invalidate `me`
- 家庭成员列表自动看到新头像
- 取消选择不报错

**PR 标题**：`feat(profile): 用户头像上传与编辑（F12-2）`

---

### T-S1-F12-03 ⬜ Baby 头像上传入口
**类型**：feat
**预估**：0.3d
**依赖**：T-S1-INF-02 / T-S1-F12-01
**输出**：
- `pages/baby/index.tsx` 创建 / 编辑表单顶部加 BabyAvatar 上传（kind=baby-avatar）
- `BabyAvatar` 组件升级：未设置时显示默认头像
- 首页 BabyCard / Switcher 立即可见

**PR 标题**：`feat(baby): Baby 头像上传 + 默认头像渲染（F12-3）`

---

## 7. F2 · 黄疸记录持久化（2d）

### T-S1-F2-01 ⬜ JaundiceRecord schema + migration + service 单元测试
**类型**：feat (DB)
**预估**：0.5d
**依赖**：—
**输出**：
- `server/prisma/migrations/xxx_add_jaundice_records/`
- `server/prisma/schema.prisma`：+ JaundiceRecord
- `server/src/services/jaundice.service.ts`：list / create / getById / update / delete
- `server/src/schemas/jaundice.schema.ts`：Zod
- `shared/types/jaundice.ts`
- 单元测试：跨家庭隔离 / 权限矩阵 / symptoms-treatments JSON 编解码

**PR 标题**：`feat(api): JaundiceRecord schema + service（F2-1）`

---

### T-S1-F2-02 ⬜ Jaundice CRUD 路由 + 集成测试
**类型**：feat (API)
**预估**：0.5d
**依赖**：T-S1-F2-01
**输出**：
- `server/src/routes/jaundice.ts`：5 端点
- `server/src/routes/index.ts`：挂载
- E2E API 测试（vitest e2e）：CRUD 全套 + 跨家庭 403 + editor 删别人 403

**PR 标题**：`feat(api): /babies/:id/jaundice CRUD 端点（F2-2）`

---

### T-S1-F2-03 ⬜ 前端 service + React Query hook
**类型**：feat
**预估**：0.3d
**依赖**：T-S1-F2-02
**输出**：
- `client/src/services/jaundice.ts`
- `client/src/hooks/use-jaundice.ts`：`useJaundiceRecords` / `useCreateJaundice` / `useUpdateJaundice` / `useDeleteJaundice`

**PR 标题**：`feat(web): jaundice service + hooks（F2-3）`

---

### T-S1-F2-04 ⬜ JaundicePage 改造为云端数据源
**类型**：refactor
**预估**：0.4d
**依赖**：T-S1-F2-03
**输出**：
- `pages/jaundice/index.tsx`：数据源从 localStorage 改为 hook，UI 不动
- `lib/jaundice.ts`：删除 localStorage IO，保留常量与类型

**验收**：
- 同家庭多账号可见同一份数据
- 趋势图 / 列表渲染正常
- 离线时 UI 报错友好（依赖 React Query 默认行为）

**PR 标题**：`refactor(jaundice): 数据源迁移到云端 API（F2-4）`

---

### T-S1-F2-05 ⬜ localStorage → 云端迁移脚本 + 一次性触发
**类型**：feat (migration)
**预估**：0.3d
**依赖**：T-S1-F2-04
**输出**：
- `client/src/lib/migrations/jaundice-to-cloud.ts`
- `client/src/app/App.tsx`：登录后 1.5s 延迟触发；幂等
- toast 提示「已同步 N 条黄疸记录」
- 完成后 set `baby_care_jaundice_migrated_v1`

**验收**：
- 手动制造 localStorage 数据验证一次性迁移
- 重复登录不重复创建
- 部分失败保留未迁移项，下次重试

**PR 标题**：`feat(jaundice): 本地数据一次性迁移到云端（F2-5）`

---

## 8. F3 · 导出独立页（1.5d）

### T-S1-F3-01 ⬜ 路由 + 页面骨架 + i18n 文案
**类型**：feat
**预估**：0.5d
**依赖**：T-S1-F9-01 / T-S1-F8-01
**输出**：
- `client/src/pages/export/index.tsx`：骨架 + 4 张卡片（宝宝/范围/类型/格式）+ 按钮
- `client/src/app/routes.tsx`：+ `/export` lazy 路由
- `client/src/i18n/resources/zh-CN/export.json`
- `pages/settings/index.tsx`：原导出入口改为跳 `/export`

**PR 标题**：`feat(export): 导出独立页骨架（F3-1）`

---

### T-S1-F3-02 ⬜ 导出交互 + 历史列表
**类型**：feat
**预估**：0.6d
**依赖**：T-S1-F3-01
**输出**：
- 调用现有 `/api/export`，blob 下载
- `localStorage.baby_care_export_history` FIFO 10 条
- 历史列表 ListRow + 重新下载按钮（链接 7d 有效提示）
- 大数据量进度条（fetch progress event）

**验收**：
- 4 组组合验证：单宝/全宝 × 7d/自定义 × CSV/JSON × 全选/部分类型
- 历史 ≤ 10 条
- 失败有明确错误码

**PR 标题**：`feat(export): 导出交互 + 历史下载列表（F3-2）`

---

### T-S1-F3-03 ⬜ 黄疸数据类型纳入导出
**类型**：feat
**预估**：0.4d
**依赖**：T-S1-F3-02 + T-S1-F2-02
**输出**：
- `server/src/routes/export.ts` + `services/export.service.ts`：枚举加 `jaundice`，service 层支持
- 前端 Checkbox 矩阵勾上「黄疸」选项

**PR 标题**：`feat(export): 黄疸数据纳入导出（F3-3）`

---

## 9. F6 · 多宝快捷切换持久化 + URL 参数（0.5d）

### T-S1-F6-01 ⬜ useActiveBaby hook
**类型**：feat
**预估**：0.2d
**依赖**：—
**输出**：
- `client/src/hooks/use-active-baby.ts`：URL ↔ store 双向同步 + 优雅降级
- 单元测试（jsdom）：URL 优先 / babies[0] 兜底 / 不存在 babyId 清除

**PR 标题**：`feat(baby): useActiveBaby hook（F6-1）`

---

### T-S1-F6-02 ⬜ MainLayout + BabySwitcher 接入
**类型**：refactor
**预估**：0.3d
**依赖**：T-S1-F6-01
**输出**：
- `client/src/app/layout/main-layout.tsx`：顶部挂 `useActiveBaby()`
- `client/src/components/baby-switcher.tsx`：`switchBaby` 替换 `selectBaby`
- Sidebar `SidebarBabyCard` 同步替换
- 验证：home / report / growth / jaundice / record / milestone / vaccine 七个页面 URL 表现

**验收**：
- 分享 `?babyId=xxx` 链接给另一台机器，看到同一胎
- 切换宝宝后 URL `replaceState` 不污染 history
- 不存在的 babyId 优雅降级

**PR 标题**：`refactor(layout): MainLayout / BabySwitcher 接入 useActiveBaby（F6-2）`

---

## 10. F1 · 首次使用引导（1.5d）

### T-S1-F1-01 ⬜ OnboardingStep 数据 + Overlay 组件
**类型**：feat
**预估**：0.5d
**依赖**：T-S1-F8-01
**输出**：
- `client/src/lib/onboarding-steps.ts`：4 步定义 + `isAlreadySatisfied`
- `client/src/components/onboarding/onboarding-overlay.tsx`：Radix Dialog + Stepper + 按钮
- `client/src/i18n/resources/zh-CN/onboarding.json`
- a11y：Tab / Esc / aria 完备

**PR 标题**：`feat(onboarding): Overlay 组件 + 步骤数据（F1-1）`

---

### T-S1-F1-02 ⬜ App.tsx 触发逻辑 + preferences 写入
**类型**：feat
**预估**：0.4d
**依赖**：T-S1-F1-01 + T-S1-INF-01
**输出**：
- `client/src/app/App.tsx`：登录后判断 `preferences.onboardingCompleted` + 自动跳过已满足步骤
- 完成 / 跳过 → `updatePreferences({ onboardingCompleted: true, onboardingSkippedSteps })`
- `?onboarding=1` 强制触发
- StrictMode 双触发防御

**PR 标题**：`feat(onboarding): App 触发与状态保存（F1-2）`

---

### T-S1-F1-03 ⬜ 目标元素 onboarding-target 锚点 + 高亮
**类型**：feat
**预估**：0.3d
**依赖**：T-S1-F1-01
**输出**：
- `pages/record/index.tsx` 加号按钮加 `data-onboarding-target="add-record-fab"`
- Overlay 内部 querySelector 找到目标 → 计算 boundingRect → 蒙层裁切高亮区
- 目标不在视口时自动 scrollIntoView

**PR 标题**：`feat(onboarding): 目标元素高亮（F1-3）`

---

### T-S1-F1-04 ⬜ a11y 校验 + 跨设备验证
**类型**：test
**预估**：0.3d
**依赖**：T-S1-F1-01..03
**输出**：
- 键盘走一遍 4 步流程
- 第二台浏览器 / 隐私模式验证跨设备保持
- 已有数据账号不重复弹

**PR 标题**：`test(onboarding): 跨设备 + a11y 验证（F1-4）`

---

## 11. 文档同步（贯穿 Sprint）

### T-S1-DOC-01 ⬜ web-architecture / web-coding-conventions 更新
**预估**：0.3d
**依赖**：跟随各功能 PR
**输出**：
- 设计文档 §13 列出的所有章节按里程碑同步
- 每个功能 PR 必须附带相关文档 diff

---

### T-S1-DOC-02 ⬜ web-api-spec / web-component-library 更新
**预估**：0.3d
**依赖**：跟随各功能 PR

---

### T-S1-DOC-03 ⬜ devops-workflow + i18n-guide + 新增 README
**预估**：0.3d
**依赖**：跟随各功能 PR
**输出**：
- `docs/devops-workflow.md`：补 COS 桶配置 + `build:analyze` 用法
- `docs/web-i18n-guide.md`：新增
- `client/src/i18n/README.md`：新增

---

## 12. Sprint 结束验收

### T-S1-REL-01 ⬜ Sprint 1 验收 + 标记 v7.2.0-rc.1
**预估**：0.5d
**依赖**：所有任务
**步骤**：
1. 检查所有 ✅ 验收项打勾
2. `pnpm build` 0 error + 入口 chunk 体积达标
3. `pnpm test` 单元 / 集成 / E2E 全绿
4. 手工跑一遍 Sprint 1 关键 user flow（设计文档 §1.3 验收清单）
5. 更新 CHANGELOG.md：v7.2.0-rc.1 段，列出本 Sprint Added/Changed
6. `git tag v7.2.0-rc.1`，推送
7. 发 Release Notes 给灰度用户

---

## 13. 任务汇总表

| ID | 功能 | 标题 | 工期 | 状态 |
|----|------|------|------|------|
| T-S1-F9-01 | F9 | 路由代码分割 + manualChunks + visualizer + RouteFallback | 0.5d | ✅ |
| T-S1-INF-01 | 共享 | User.preferences + PATCH /profile 深合并 | 0.5d | ✅ |
| T-S1-INF-02 | 共享 | COS 预签名上传链路 + ImageUploader | 1d | ✅ |
| T-S1-F8-01 | F8 | i18next 初始化 + zh-CN 骨架 | 0.3d | ⬜ |
| T-S1-F8-02 | F8 | main-layout 抽离 | 0.3d | ⬜ |
| T-S1-F8-03 | F8 | home + record 抽离 | 0.4d | ⬜ |
| T-S1-F8-04 | F8 | report + ai + settings 抽离 | 0.4d | ⬜ |
| T-S1-F8-05 | F8 | LanguageSwitcher + i18n 文档 | 0.1d | ⬜ |
| T-S1-F12-01 | F12 | 默认头像 lib + Avatar 升级 | 0.3d | ⬜ |
| T-S1-F12-02 | F12 | 用户头像上传 | 0.4d | ⬜ |
| T-S1-F12-03 | F12 | Baby 头像上传 | 0.3d | ⬜ |
| T-S1-F2-01 | F2 | JaundiceRecord schema + service | 0.5d | ⬜ |
| T-S1-F2-02 | F2 | Jaundice CRUD 路由 + 集成测试 | 0.5d | ⬜ |
| T-S1-F2-03 | F2 | 前端 service + hooks | 0.3d | ⬜ |
| T-S1-F2-04 | F2 | JaundicePage 数据源迁移 | 0.4d | ⬜ |
| T-S1-F2-05 | F2 | localStorage 一次性迁移 | 0.3d | ⬜ |
| T-S1-F3-01 | F3 | 导出页骨架 + 路由 + i18n | 0.5d | ⬜ |
| T-S1-F3-02 | F3 | 导出交互 + 历史列表 | 0.6d | ⬜ |
| T-S1-F3-03 | F3 | 黄疸数据纳入导出 | 0.4d | ⬜ |
| T-S1-F6-01 | F6 | useActiveBaby hook | 0.2d | ⬜ |
| T-S1-F6-02 | F6 | MainLayout / BabySwitcher 接入 | 0.3d | ⬜ |
| T-S1-F1-01 | F1 | OnboardingOverlay 组件 | 0.5d | ⬜ |
| T-S1-F1-02 | F1 | App 触发 + preferences 写入 | 0.4d | ⬜ |
| T-S1-F1-03 | F1 | 目标元素锚点 + 高亮 | 0.3d | ⬜ |
| T-S1-F1-04 | F1 | 跨设备 + a11y 验证 | 0.3d | ⬜ |
| T-S1-DOC-01 | DOC | architecture / coding-conventions | 0.3d | ⬜ |
| T-S1-DOC-02 | DOC | api-spec / component-library | 0.3d | ⬜ |
| T-S1-DOC-03 | DOC | devops + i18n-guide + README | 0.3d | ⬜ |
| T-S1-REL-01 | REL | Sprint 验收 + tag v7.2.0-rc.1 | 0.5d | ⬜ |
| **合计** | | | **11.3d**（含 buffer） | |

> 工期 11.3d > Sprint 10d，预计 0.5d 通过并行（F8 抽离与 F2 CRUD 后端并行 / F12 与 F6 并行）压缩；文档与本任务 PR 顺手做也能省 0.5d。如仍超期，**T-S1-F8-04（report/ai/settings 抽离）可延后到 Sprint 2 头 1 天**作为弹性项。

---

## 14. 任务模板（执行某任务时复制使用）

```
## 当前任务：T-S1-FX-NN xxx

### 已读文档
- docs/web-roadmap-v7.2-sprint1-design.md §X
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

## 15. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-11 | Sprint 1 任务 v1.0 | 初版，29 个 task（@唐瀚） |
