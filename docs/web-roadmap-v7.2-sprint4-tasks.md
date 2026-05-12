# Web v7.2 · Sprint 4 任务清单

> 范围：v7.2 Sprint 4（建议档期 2026-06-22 → 2026-07-03，10 工作日）
> 设计文档：[`docs/web-roadmap-v7.2-sprint4-design.md`](./web-roadmap-v7.2-sprint4-design.md)
> 总入口：[`docs/web-roadmap-v7.2.md`](./web-roadmap-v7.2.md)
> 前置：Sprint 1/2/3 已交付 — auth 现状、`OperationLog`、`persistentRateLimit` 等基础设施完备

---

## 0. 任务编号约定

- ID 格式：`T-S4-{FX}-{NN}`，FX ∈ { `INF` | `AUTO` | `FP` | `DOC` | `REL` }
- 每个任务 = 一个 PR，单 PR 变更 ≤ 400 行；超出请拆分
- 状态：⬜ 未开始 / 🔵 进行中 / ✅ 已完成 / ⚠️ 阻塞 / ⏸️ 暂缓

---

## 1. 依赖关系总览

```
T-S4-INF-00  hotfix（cookie-parser + 删 JWT_REFRESH_SECRET）  ← 最先合，所有 task 必须 rebase 到此后
   │
   ▼
T-S4-INF-01  tokenVersion 字段 + JWT payload 嵌入
   │
   ├──► T-S4-AUTO-01  Refresh 滑动续期 + jwtRefreshExpiresIn 30d
   │      │
   │      └──► T-S4-AUTO-02  rememberMe 入参 + 动态 cookie maxAge
   │             │
   │             └──► T-S4-AUTO-04  AuthBootGate + BootSplash
   │
   ├──► T-S4-AUTO-03  改密成功后重签 token + 自增 tokenVersion
   │
   └──► T-S4-FP-04   重置密码事务（含 tokenVersion++）
                       ▲
T-S4-INF-02  邮件服务封装 + 503 降级
   │
   └──► T-S4-FP-01  PasswordResetToken schema
            │
            └──► T-S4-FP-02  forgot-password 端点 + 限流
                  │
                  └──► T-S4-FP-03  reset-password/verify 端点
                          │
                          └──► T-S4-FP-04  reset-password 端点
                                  │
                                  ├──► T-S4-FP-05  ForgotPasswordPage
                                  ├──► T-S4-FP-06  ResetPasswordPage
                                  └──► T-S4-FP-07  Login 页加入口

T-S4-DOC-01..03  文档同步（跟随各功能 PR）
T-S4-REL-01      Sprint 4 验收 + tag v7.2.0-rc.4 灰度 → v7.2.0 GA
```

---

## 2. 按"开发日"建议执行顺序

| Day | 主线 A（自动登录） | 主线 B（密码找回） | 主线 C（DevOps + 文档） |
|-----|---|---|---|
| D1 (6/22) | **T-S4-INF-00 hotfix（cookie-parser + 删 JWT_REFRESH_SECRET）** → T-S4-INF-01 tokenVersion 嵌入与校验 | — | DevOps：CAM 子账号关联 `QcloudSESFullAccess` 策略（含模板管理）；注入 `SES_TEMPLATE_ID_PASSWORD_RESET=178066` 与 `WEB_BASE_URL` |
| D2 (6/23) | T-S4-AUTO-01 滑动续期 + 30d | T-S4-INF-02 EmailService（mock 跑通流程） | T-S4-DOC-01 起草 web-api-spec §13 |
| D3 (6/24) | T-S4-AUTO-02 rememberMe 入参 + cookie maxAge + 文案改 30 天免登 | T-S4-FP-01 PasswordResetToken schema + types | — |
| D4 (6/25) | T-S4-AUTO-03 改密重签 token + 自增（保留本机登录） | T-S4-FP-02 forgot-password 端点 + 限流 | DevOps：联调真实邮件到 `neo-chang@163.com` + `26494513@qq.com`（验 DKIM / SPF / 收件箱） |
| D5 (6/26) | T-S4-AUTO-04 AuthBootGate + BootSplash | T-S4-FP-03 reset-password/verify | T-S4-DOC-02 architecture §5.x 链路图 |
| D6 (6/29) | T-S4-AUTO-05 拦截器加 REVOKED_TOKEN 分支 | T-S4-FP-04 reset-password 端点 + 事务 | — |
| D7 (6/30) | T-S4-AUTO-06 集成测试 | T-S4-FP-05 ForgotPasswordPage | — |
| D8 (7/1)  | — | T-S4-FP-06 ResetPasswordPage（verify 预检） | T-S4-DOC-03 devops-workflow + .env.example |
| D9 (7/2)  | — | T-S4-FP-07 Login 加入口 + T-S4-FP-08 E2E 找回闭环 | 文档收口 |
| D10 (7/3) | T-S4-REL-01 验收 + tag rc.4 灰度 → 通过后打 v7.2.0 GA + Release Notes | — | — |

> **Buffer**：每天预留 30% 给 review / 修复 / 邮件投递验证 / 跨设备测试。

---

## 3. INF · 共享基础设施（1.2d）

> ⚠️ **T-S4-INF-00 是 Sprint 4 任何 task 开工前必须先合的 hotfix**，独立 PR、独立合并，不阻塞其他 task 的 review，但其他 task 必须 rebase 到 INF-00 之后再开发，否则 refresh 链路本地都跑不通。

### T-S4-INF-00 ⬜ hotfix：挂载 cookie-parser + 删除 JWT_REFRESH_SECRET
**类型**：fix
**预估**：0.2d
**依赖**：—（最先合并）
**背景**：详见设计 §3.5。当前线上 `req.cookies` 永远 undefined，自动续期一直没工作；同时 `JWT_REFRESH_SECRET` 在代码里被忽略但被 `docker-compose.yml` 强制要求，给 DevOps 维护制造混淆。

**输出（cookie-parser 修复）**：
- `server/package.json`：`pnpm --filter server add cookie-parser` + `pnpm --filter server add -D @types/cookie-parser`
- `server/src/app.ts`：在 `corsMiddleware` 之后、`express.json` 之前 `app.use(cookieParser())`
- 集成测试：新增 1 个用例验证「过期 access token → /refresh 200 → 重发原请求成功」整链路

**输出（JWT_REFRESH_SECRET 清理）**：
- `docker/docker-compose.yml`：删除 `JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?...}` 这一行
- `docker/.env.example`：删除 `JWT_REFRESH_SECRET=...` 行 + 上方"两份密钥"的注释
- `docs/devops-workflow.md`：必填表与部署示例移除 `JWT_REFRESH_SECRET`；新增升级须知段「v7.2 Sprint 4 起统一单密钥，旧 `JWT_REFRESH_SECRET` 可移除」
- 不动 `server/src/config/env.ts`（本来就没有这个字段）
- 不 rotate `JWT_SECRET`，避免全员被踢线下

**验收**：
- `pnpm --filter server test` 全绿，新增用例通过
- 本地 `pnpm dev` 登录后等 access token 过期，下一次 API 请求 Network 面板看到 401 + TOKEN_EXPIRED → /refresh 200 → 业务请求 200，无需重登
- `docker compose up` 不再要求 `JWT_REFRESH_SECRET`
- DevOps 在 staging 验证 deploy 仍能正常启动

**PR 标题**：`fix(auth): 挂载 cookie-parser 修复 refresh 链路 + 移除冗余 JWT_REFRESH_SECRET（T-S4-INF-00）`

---

### T-S4-INF-01 ⬜ User.tokenVersion 字段 + JWT payload 嵌入与校验
**类型**：feat (DB + auth core)
**预估**：0.5d
**依赖**：—
**输出**：
- `server/prisma/schema.prisma`：`User` 增 `tokenVersion Int @default(0)`
- `server/src/services/auth.service.ts`：
  - `generateAccessToken(userId, version)` / `generateTokens(userId, version, opts?)` 两参形态
  - `register / login / refreshToken` 入口都先读最新 `tokenVersion` 再签发
  - access / refresh payload 增字段 `v: number`
  - refresh payload 同时增 `rm: boolean`（rememberMe，配合 AUTO-02）
- `server/src/middleware/auth.ts`：
  - `authenticate` 解码后查 `user.tokenVersion`，比对失败抛 `UnauthorizedError(REVOKED_TOKEN)`
  - 缺省 `payload.v` 视为 `0`（兼容 Sprint 4 之前的旧 token）
- `server/src/types/errors.ts`：`ErrorCodes.REVOKED_TOKEN`
- `prisma db push` 同步
- 单元/集成测试：旧 token + 新 schema、tokenVersion 不匹配 401、rotate 后续续期逻辑

**验收**：
- 后端 baseline 测试全绿
- 旧 access token 仍可验证（兼容 v=0）
- `tokenVersion++` 后老 token 立即失效

**PR 标题**：`feat(auth): User.tokenVersion 字段 + JWT payload v 校验（T-S4-INF-01）`

---

### T-S4-INF-02 ⬜ EmailService 封装 + 503 降级 + OperationLog
**类型**：feat (email infra)
**预估**：0.5d
**依赖**：—
**输出**：
- `server/package.json`：`tencentcloud-sdk-nodejs-ses`
- `server/src/config/env.ts`：补 `SES_REGION / SES_FROM_ADDRESS / SES_FROM_NAME / SES_TEMPLATE_ID_PASSWORD_RESET / WEB_BASE_URL`（均 optional，缺失时 `isConfigured()=false`）
- `server/src/services/email.service.ts`：
  - `isConfigured()` / `sendPasswordReset()` / `sendPasswordChangedNotification()`
  - 复用 `COS_SECRET_ID/KEY` 作为 SES 凭证（CAM 子账号已关联 `QcloudSESFullAccess`，含模板管理）
  - 调用腾讯云 SES `SendEmail`（模板模式）；FromEmailAddress 拼装为 `${SES_FROM_NAME} <${SES_FROM_ADDRESS}>`，固定值 `Password_Reset <password@support.neo3.cn>`
  - 失败抛 `ServiceUnavailableError(EMAIL_NOT_CONFIGURED)` 或 `BadGatewayError(EMAIL_SEND_FAILED)`
- `server/src/types/errors.ts`：`EMAIL_NOT_CONFIGURED / EMAIL_SEND_FAILED`
- 复用现有 `server/src/utils/operation-logger.ts`（**不新建 service**）：`new OperationLogger('email.send', userId, { kind, toMasked }).start()` → `succeed()` / `fail()`
- `server/.env.example` + `docker/.env.example` 同步（值见下方"环境变量参考"）
- 单元测试（mock SES SDK）：`isConfigured` 5 个边界 / 模板字段拼装 / 失败兜底

**环境变量参考**（与 DevOps 已确认，2026-05-11）：

```dotenv
SES_REGION=ap-guangzhou
SES_FROM_ADDRESS=password@support.neo3.cn
SES_FROM_NAME=Password_Reset
SES_TEMPLATE_ID_PASSWORD_RESET=178066
WEB_BASE_URL=<DevOps 注入，本机开发回退 http://localhost:5173>
```

**验收**：
- 配置缺失：`isConfigured()=false`，所有 send 抛 `EMAIL_NOT_CONFIGURED`
- 配置齐全：在测试环境可发出真实邮件（DevOps D4 已联调一封真实邮件到测试邮箱）
- 邮箱日志脱敏：`a***@xx.com`
- 重置链接拼装：`${WEB_BASE_URL}/reset-password?token=xxx`，缺 `WEB_BASE_URL` 时 fallback `http://localhost:5173`

**PR 标题**：`feat(email): 腾讯云 SES EmailService 封装（T-S4-INF-02）`

---

## 4. F-AUTO · 自动登录（2.0d）

### T-S4-AUTO-01 ⬜ Refresh token 滑动续期 + jwtRefreshExpiresIn 30d
**类型**：feat
**预估**：0.3d
**依赖**：T-S4-INF-01
**输出**：
- `server/src/config/auth.ts`：`jwtRefreshExpiresIn: '30d'`；`refreshTokenCookieOptions` 移除写死的 `maxAge`（改为路由层动态注入）
- `server/src/services/auth.service.ts`：`refreshToken` 返回 `{ accessToken, refreshToken }`
- `server/src/routes/auth.ts` `/refresh` 端点：成功后 `set-cookie` 重签 refresh + 按 payload `rm` 决定是否带 `maxAge`
- 集成测试：连续 5 次 refresh，每次都拿到新 cookie；30d 边界

**验收**：
- 每次 refresh 都重置 30d 滑窗
- session cookie 模式（rm=false）下 cookie 不带 `Max-Age`

**PR 标题**：`feat(auth): refresh token 滑动续期 + 30d 长免登（T-S4-AUTO-01）`

---

### T-S4-AUTO-02 ⬜ rememberMe 入参 + 动态 cookie maxAge
**类型**：feat
**预估**：0.3d
**依赖**：T-S4-AUTO-01
**输出**：
- `server/src/schemas/auth.schema.ts`：`loginSchema` 加 `rememberMe: z.boolean().optional().default(true)`
- `server/src/routes/auth.ts` `/login` `/wechat`：根据 `rememberMe` 决定 cookie maxAge；refresh payload 同时写入 `rm`
- `server/src/services/auth.service.ts`：`login(...)` 返回值增 `rememberMe`，`generateTokens(userId, version, { rememberMe })`
- `shared/types/index.ts`：`LoginRequest` 加 `rememberMe?: boolean`
- `client/src/services/auth.ts` + `auth-store.ts`：`login` 透传 `rememberMe`
- `client/src/pages/auth/login.tsx`：
  - 把现有 `rememberMe` state 传给 `login()`，**保持默认勾选**（`useState(true)` 不变）
  - 文案从「记住我（保留账号 7 天，下次自动登录）」改为「**记住我（30 天免登）**」
- `client/src/lib/remember-credentials.ts` 顶部注释升级（语义说明：现在控制 cookie maxAge）
- 集成测试：rm=true → cookie 带 30d Max-Age；rm=false → 不带 Max-Age

**PR 标题**：`feat(auth): rememberMe 控制 cookie 时长与滑动续期（T-S4-AUTO-02）`

---

### T-S4-AUTO-03 ⬜ 改密成功后重签 token + 自增 tokenVersion
**类型**：feat
**预估**：0.3d
**依赖**：T-S4-INF-01
**决策**：改密**保留当前设备登录态**（用户已确认 2026-05-11），不在改密页加「同时登出本设备」checkbox；其他设备通过 `tokenVersion++` 强制下线。
**输出**：
- `server/src/services/auth.service.ts` `changePassword`：
  - 事务：`update passwordHash + tokenVersion++`
  - 重签 access + refresh，按当前请求的"当前会话 rememberMe"延续 cookie 策略
  - 返回 `{ accessToken, refreshToken, message }`
- `server/src/routes/auth.ts` `/change-password`：`set-cookie` 新 refresh，response body 带新 `accessToken`；**不再 `clearCookie`**（与 v7.2 之前行为相反）
- `client/src/services/auth.ts` `changePassword`：返回 `{ accessToken }`
- `client/src/stores/auth-store.ts`：`changePassword` 完成后 `setToken(newAccessToken)`
- `client/src/pages/profile/...` 改密页（如有）：成功后 toast「密码已修改，其他设备已自动下线」
- 集成测试：当前设备保留登录 / 另一台 mock 设备 401 REVOKED_TOKEN

**PR 标题**：`feat(auth): 改密自增 tokenVersion + 当前设备无感保留（T-S4-AUTO-03）`

---

### T-S4-AUTO-04 ⬜ AuthBootGate + BootSplash
**类型**：feat
**预估**：0.4d
**依赖**：T-S4-AUTO-01..03（避免边写边改）
**输出**：
- `client/src/app/layout/auth-boot-gate.tsx`：详见设计 §3.4
- `client/src/components/boot-splash.tsx`：复用 `<AuthLayout>` 移动端 hero 视觉 + spinner；200ms 延迟显示
- `client/src/app/App.tsx`：`<AuthBootGate>` 包住 `<RouterProvider>`
- 单元测试（jsdom + RTL）：有 token → loadUser 调用 → ready；无 token → 立即 ready；loadUser 抛错 → ready（已自行清状态）

**验收**：
- 已登录刷新页面：100ms 内进入首页（无登录页闪屏）
- refresh cookie 失效后刷新：splash → 跳 `/login`

**PR 标题**：`feat(boot): AuthBootGate 启动闸门消除登录页闪屏（T-S4-AUTO-04）`

---

### T-S4-AUTO-05 ⬜ axios 拦截器加 REVOKED_TOKEN 分支
**类型**：feat
**预估**：0.2d
**依赖**：T-S4-INF-01
**输出**：
- `client/src/services/api.ts`：401 + `REVOKED_TOKEN` → 跳过 refresh 直接 `useAuthStore.logout() + window.location.href = '/login?reason=revoked'`
- `client/src/pages/auth/login.tsx`：识别 `?reason=revoked` 显示 toast「账号已在其他设备改密码，请重新登录」
- 单元测试（mock axios）：REVOKED_TOKEN 路径不调用 refresh

**PR 标题**：`feat(api): REVOKED_TOKEN 跳过 refresh 直接重登（T-S4-AUTO-05）`

---

### T-S4-AUTO-06 ⬜ 集成测试：自动登录 + tokenVersion 全链路
**类型**：test
**预估**：0.3d
**依赖**：T-S4-AUTO-01..05
**输出**：
- `server/tests/integration/auth-token-version.test.ts`：tokenVersion 不匹配 401 + `REVOKED_TOKEN`
- `server/tests/integration/auth-remember-me.test.ts`：rm=true / false / 滑动续期 cookie 行为
- `e2e/auth-auto-login.spec.ts`（Playwright）：勾记住我 → 关浏览器再开 → 进首页
- `e2e/auth-revoke.spec.ts`：登录 → 改密 → 老设备调 API 失败

**PR 标题**：`test(auth): 自动登录与 tokenVersion 全链路集成测试（T-S4-AUTO-06）`

---

## 5. F-FP · 密码找回（3.5d）

### T-S4-FP-01 ⬜ PasswordResetToken schema + 共享类型 + 错误码
**类型**：feat (DB + types)
**预估**：0.3d
**依赖**：T-S4-INF-01（共用 tokenVersion 升级）
**输出**：
- `server/prisma/schema.prisma`：新增 `PasswordResetToken` + `User.passwordResetTokens` 关系
- `server/src/types/errors.ts`：`RESET_TOKEN_INVALID / RESET_TOKEN_CONSUMED / RESET_TOKEN_EXPIRED`
- `server/src/utils/sha256.ts`（如无）：`sha256Hex(s)`
- `shared/types/index.ts` + 双端 re-export：`ForgotPasswordRequest / ResetPasswordRequest / ResetPasswordVerifyResponse`
- `prisma db push`

**PR 标题**：`feat(auth): PasswordResetToken schema + 错误码（T-S4-FP-01）`

---

### T-S4-FP-02 ⬜ POST /forgot-password 端点 + 限流 + 防枚举
**类型**：feat (API)
**预估**：0.6d
**依赖**：T-S4-FP-01 + T-S4-INF-02
**输出**：
- `server/src/services/password-reset.service.ts`：
  - `requestReset(email, ctx)` 详见设计 §5.2.1
  - sha256 后 email 用作 RateLimit key（不存明文）
  - 失败 token 立即过期 + 写入新 token + 发邮件
  - 主分支耗时人为对齐 250ms（防 timing attack）
- `server/src/middleware/rate-limit-persistent.ts`：新增 `forgotPasswordIpRateLimit`（IP，5/min）+ `forgotPasswordEmailRateLimit`（email-hash，3/h）
- `server/src/schemas/auth.schema.ts`：`forgotPasswordSchema`
- `server/src/routes/auth.ts`：`POST /forgot-password`，统一返回 200 success
- 集成测试：未注册邮箱仍 200 / 已注册收 OperationLog / IP 维度限流 / email 维度限流 / 邮件失败仍返回 200

**PR 标题**：`feat(auth): /forgot-password 端点 + 防枚举限流（T-S4-FP-02）`

---

### T-S4-FP-03 ⬜ GET /reset-password/verify 端点
**类型**：feat (API)
**预估**：0.3d
**依赖**：T-S4-FP-01
**输出**：
- `server/src/services/password-reset.service.ts`：`verifyToken(rawToken)` 返回 `{ valid: true, emailMasked }` 或对应业务错误
- `server/src/routes/auth.ts`：`GET /reset-password/verify`，统一 200 + `success/error` 业务壳
- `client/src/services/auth.ts`：`verifyResetToken(token)`
- 集成测试：4 种状态（valid / invalid / consumed / expired）+ 邮箱 mask

**PR 标题**：`feat(auth): /reset-password/verify 预检端点（T-S4-FP-03）`

---

### T-S4-FP-04 ⬜ POST /reset-password 端点 + 事务 + tokenVersion++ + 通知邮件
**类型**：feat (API)
**预估**：0.5d
**依赖**：T-S4-FP-01 + T-S4-FP-03 + T-S4-INF-01 + T-S4-INF-02
**输出**：
- `server/src/services/password-reset.service.ts`：`consumeReset(rawToken, newPassword, ctx)` 详见设计 §5.2.3
- `server/src/middleware/rate-limit.ts`：`resetPasswordRateLimit`（IP，10/min）
- `server/src/schemas/auth.schema.ts`：`resetPasswordSchema`（强密码规则与 register/changePassword 对齐）
- `server/src/routes/auth.ts`：`POST /reset-password`，成功清 refresh cookie，不返回 token
- 集成测试：成功路径 / 弱密码 / 已使用 / 已过期 / 同时失效该用户其他 token / 通知邮件失败不影响主流程 / OperationLog `password-reset.success`

**PR 标题**：`feat(auth): /reset-password 端点 + 事务化重置（T-S4-FP-04）`

---

### T-S4-FP-05 ⬜ 前端 service + ForgotPasswordPage
**类型**：feat (web)
**预估**：0.4d
**依赖**：T-S4-FP-02
**输出**：
- `client/src/services/auth.ts`：`forgotPassword(email)` / `verifyResetToken(token)` / `resetPassword(token, newPassword)`
- `client/src/pages/auth/forgot-password.tsx`：详见设计 §5.5.2（email 输入 + 60s 倒计时重发 + 成功态提示）
- `client/src/app/routes.tsx`：lazy 路由 `/forgot-password`（挂在 `<AuthLayout>` 下）
- `client/src/pages/auth/login.tsx`：在「记住我」一行右侧加 `<Link to="/forgot-password">忘记密码？</Link>`（即 T-S4-FP-07，建议合并到本 PR）

**验收**：
- 提交后无论邮箱是否注册都看到一致提示
- 60s 倒计时
- 401 / 500 错误友好降级

**PR 标题**：`feat(web): ForgotPasswordPage + Login 加入口（T-S4-FP-05）`

---

### T-S4-FP-06 ⬜ ResetPasswordPage + verify 预检 + 强密码校验
**类型**：feat (web)
**预估**：0.5d
**依赖**：T-S4-FP-03 + T-S4-FP-04 + T-S4-FP-05
**输出**：
- `client/src/pages/auth/reset-password.tsx`：详见设计 §5.5.3
  - 加载时调 verify
  - valid 状态：标题 + 新密码 + 确认密码 + 提交
  - invalid / consumed / expired 状态：错误占位 + 「重新申请」CTA
  - 提交成功 → toast + 1s 后 navigate `/login`
- `client/src/lib/password-strength.ts`（如缺失）：`validateStrong(p) / strengthLevel(p)`，与注册页一致
- `client/src/app/routes.tsx`：lazy 路由 `/reset-password`
- 单元测试（RTL）：4 种状态渲染 / 弱密码本地校验 / 提交成功跳转

**PR 标题**：`feat(web): ResetPasswordPage 落地页（T-S4-FP-06）`

---

### T-S4-FP-07 ⬜ Login 页加「忘记密码？」入口
**预估**：合并入 T-S4-FP-05；保留 ID 仅作清单完整性参考。
**状态**：⏸️ 合并

---

### T-S4-FP-08 ⬜ E2E：完整找回闭环
**类型**：test
**预估**：0.4d
**依赖**：T-S4-FP-01..06 全部完成
**输出**：
- `e2e/password-reset.spec.ts`（Playwright）：
  - 用 mock 邮件服务（拦截 EmailService 调用，捕获 resetUrl）
  - 流程：注册 → 登出 → /login → 忘记密码 → 输邮箱 → 拿 resetUrl → 访问 → 输新密码 → 重定向 /login → 用新密码登录成功
  - 边界：旧密码登录失败、链接二次点击、过期链接

**PR 标题**：`test(e2e): 密码找回完整闭环（T-S4-FP-08）`

---

## 6. 文档同步（贯穿 Sprint）

### T-S4-DOC-01 ⬜ web-api-spec §13 + §2 Auth 改写
**预估**：0.3d
**输出**：
- 新增 §13 密码找回（3 个端点）
- §2 Auth：`/login` 入参 `rememberMe`、`/refresh` 滑动续期、`/change-password` 返回新 access token、`REVOKED_TOKEN` 错误码

### T-S4-DOC-02 ⬜ web-architecture §5.x 自动登录链路 + 邮件链路
**预估**：0.3d
**输出**：
- §5.x 自动登录：tokenVersion + rememberMe + AuthBootGate 时序图
- §5.x 邮件链路：前端 → API → SES → 邮箱 → 落地页流程图
- §5.x DB 字段对照表更新（User.tokenVersion + PasswordResetToken）

### T-S4-DOC-03 ⬜ devops-workflow + coding-conventions + .env.example
**预估**：0.3d
**输出**：
- `docs/devops-workflow.md`：新增「腾讯云 SES 配置」章节，落具体值：
  - 发件域名：`support.neo3.cn`（已认证 DKIM / SPF / MAIL FROM）
  - 发件人：`Password_Reset <password@support.neo3.cn>`
  - CAM 子账号：复用 COS 子账号，关联 `QcloudSESFullAccess` 策略（含模板管理，运维可在控制台直接维护模板）
  - 模板：`baby-care-password-reset`（**已审核通过，模板 ID = `178066`**），后续运维改文案在控制台直接保存即可，不需要发版
  - `WEB_BASE_URL` 注入位置（容器环境变量，由 DevOps 在 deploy 阶段写入）
  - 验证步骤：测试邮箱收到正常 → 检查垃圾邮件箱 → 监控 SES bounce 率
- `docs/web-coding-conventions.md` §13：补「密码找回安全清单」+「token revocation 模式」
- `docs/web-component-library.md`：`<AuthBootGate> / <BootSplash> / <ForgotPasswordPage> / <ResetPasswordPage>` 4 个条目
- `server/.env.example` + `docker/.env.example`：补 5 项环境变量

  ```dotenv
  # 腾讯云 SES（v7.2 Sprint 4 密码找回邮件）
  # 凭证复用 COS_SECRET_ID / COS_SECRET_KEY（同一 CAM 子账号，已关联 QcloudSESFullAccess）
  # 任一字段缺失时 /api/auth/forgot-password 返回 503 EMAIL_NOT_CONFIGURED，前端友好降级
  SES_REGION=ap-guangzhou
  SES_FROM_ADDRESS=password@support.neo3.cn
  SES_FROM_NAME=Password_Reset
  SES_TEMPLATE_ID_PASSWORD_RESET=178066

  # Web 基础 URL（用于拼接重置链接 ${WEB_BASE_URL}/reset-password?token=...）
  # 生产由 DevOps 在 deploy 阶段注入；本机开发不填则 fallback 到 http://localhost:5173
  WEB_BASE_URL=
  ```
- `docs/web-roadmap-v7.2.md` §15 + §17 同步（Sprint 4 加入排期、移除"后续"列表里的相关项）

---

## 7. Sprint 结束验收

### T-S4-REL-01 ⬜ Sprint 4 验收 + rc.4 灰度 → v7.2.0 GA
**预估**：1.5d（含 v7.2 roadmap §15 v1.2 从 Sprint 3 挪入的 1d「上线 / Release Notes」）
**依赖**：所有任务

**Phase 1：Sprint 4 内部验收（D10 上午，约 0.5d）**
1. 检查所有 ✅ 验收项打勾
2. `pnpm build` 0 error，入口 chunk 体积无明显回退（与 Sprint 1 baseline 比对）
3. `pnpm test` server / client / e2e 全绿
4. 跑一遍设计文档 §9 的 10 步人工验收脚本
5. 验证邮件能真实送达约定测试邮箱（DKIM / SPF / 收件箱而非垃圾邮件）：
   - **必测**：`neo-chang@163.com`（163）/ `26494513@qq.com`（QQ Mail）
   - **可选**：临时再补 1 个 Gmail 验海外可达
6. 更新 `CHANGELOG.md` **`v7.2.0-rc.4` 段**，列 Sprint 4 Added/Changed/Security
7. `git tag v7.2.0-rc.4` 并推送 → 灰度发布到生产环境
8. 灰度环境冒烟：自动登录闭环 + 找回闭环 + 已有功能（首页 / 记录 / 报告 / AI / 成长日历）回归

**Phase 2：v7.2.0 GA 收口（D10 下午 + 缓冲，约 1d）**
9. 灰度观察 24~48h（指标看 SES bounce 率 / 5xx / 用户重登异常 / 旧设备 401 突增）
10. 灰度通过后：
    - 更新 `CHANGELOG.md` 新增 **`v7.2.0` GA 段**：汇总 Sprint 1~4 全部新功能（路由分割 / 头像 / 黄疸云端化 / 多宝 URL / 导出页 / Onboarding / 每日打卡 / 成长日历 / WHO 百分位 / 报告分享 PDF / AI 多会话 / a11y / i18n / 自动登录 / 密码找回）
    - 更新 `docs/PRD.md` v7.2 章节，把"自动登录"与"密码找回"补入产品文档
    - 起草 **Release Notes（含中文 + 英文兜底版）**：
      - 标题：「Baby Care Tracker v7.2 — 内容沉淀 + 个性化 + 账号体系打磨」
      - 核心亮点 6 项（每日打卡 / WHO 百分位 / 多会话 AI / 30 天免登 / 找回密码 / 内容分享）
      - 升级须知：「升级后请重新登录一次以获得新会话」
11. `git tag v7.2.0` 并推送
12. 通知用户（站内信 / 邮件订阅 / 公告卡）
13. 通知 Sprint 5 / v7.3 排期会，标记 v7.2 关闭

> **回滚预案**：若灰度发现 P0 问题（自动登录链路异常 / 重置邮件全员未达 / 改密导致全员被踢），立即回退到 `v7.2.0-rc.3`（Sprint 3 末交付物），并在 24h 内 hotfix 后重打 `v7.2.0-rc.5`。

---

## 8. 任务汇总表

| ID | 类别 | 标题 | 工期 | 状态 |
|---|---|---|---|---|
| **T-S4-INF-00** | **INF** | **hotfix：cookie-parser + 删 JWT_REFRESH_SECRET（开工前必合）** | **0.2d** | **⬜** |
| T-S4-INF-01 | INF | tokenVersion 字段 + JWT payload 嵌入 | 0.5d | ⬜ |
| T-S4-INF-02 | INF | EmailService 封装 + 503 降级 | 0.5d | ⬜ |
| T-S4-AUTO-01 | AUTO | Refresh 滑动续期 + 30d | 0.3d | ⬜ |
| T-S4-AUTO-02 | AUTO | rememberMe + 动态 cookie maxAge + 文案改 30 天 | 0.3d | ⬜ |
| T-S4-AUTO-03 | AUTO | 改密重签 token + tokenVersion++（保留本机登录） | 0.3d | ⬜ |
| T-S4-AUTO-04 | AUTO | AuthBootGate + BootSplash | 0.4d | ⬜ |
| T-S4-AUTO-05 | AUTO | 拦截器 REVOKED_TOKEN 分支 | 0.2d | ⬜ |
| T-S4-AUTO-06 | AUTO | 自动登录集成测试 | 0.3d | ⬜ |
| T-S4-FP-01 | FP | PasswordResetToken schema + 错误码 | 0.3d | ⬜ |
| T-S4-FP-02 | FP | /forgot-password 端点 + 防枚举限流 | 0.6d | ⬜ |
| T-S4-FP-03 | FP | /reset-password/verify 端点 | 0.3d | ⬜ |
| T-S4-FP-04 | FP | /reset-password 端点 + 事务 | 0.5d | ⬜ |
| T-S4-FP-05 | FP | ForgotPasswordPage + Login 入口 | 0.4d | ⬜ |
| T-S4-FP-06 | FP | ResetPasswordPage + verify 预检 | 0.5d | ⬜ |
| T-S4-FP-07 | FP | Login 加忘记密码入口 | — | ⏸️ 合并入 FP-05 |
| T-S4-FP-08 | FP | E2E 找回闭环 | 0.4d | ⬜ |
| T-S4-DOC-01 | DOC | web-api-spec §13 + §2 改写 | 0.3d | ⬜ |
| T-S4-DOC-02 | DOC | web-architecture §5.x 链路图 | 0.3d | ⬜ |
| T-S4-DOC-03 | DOC | devops + conventions + .env.example | 0.3d | ⬜ |
| T-S4-REL-01 | REL | Sprint 4 验收 + rc.4 灰度 → v7.2.0 GA + Release Notes | 1.5d | ⬜ |
| **合计** | | | **8.7d**（含 v7.2 roadmap v1.2 从 Sprint 3 挪入的 1d 上线/Release Notes，仍落入 10d Sprint 容量） | |

---

## 9. 任务模板

```
## 当前任务：T-S4-XX-NN xxx

### 已读文档
- docs/web-roadmap-v7.2-sprint4-design.md §X
- 相关文件：xxx

### 实现步骤
1. ...
2. ...

### 提交
- [ ] 代码改动通过 `pnpm lint` + `pnpm build`
- [ ] 相关测试已加 / 已跑通（必要时 + e2e）
- [ ] 关联文档章节已同步
- [ ] PR 标题符合约定
```

---

## 10. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-05-11 | Sprint 4 任务 v1.0 | 初版，20 个 task（@唐瀚） |
| 2026-05-11 | Sprint 4 任务 v1.1 | 落具体配置：发件域名 `support.neo3.cn` / 发件人 `Password_Reset <password@support.neo3.cn>` / 模板已提交审核 / `WEB_BASE_URL` 由 DevOps 注入；D1 主线 C 改为权限补齐 + 模板状态确认；D4 加 DevOps 真实邮件联调（@唐瀚） |
| 2026-05-11 | Sprint 4 任务 v1.2 | CAM 权限策略由 `ses:SendEmail` 调整为 `QcloudSESFullAccess`（含模板管理）；DOC-03 / INF-02 文案同步（@唐瀚） |
| 2026-05-11 | Sprint 4 任务 v1.3 | 密码找回模板审核通过，模板 ID = `178066`，落到 D1 主线 C / INF-02 / DOC-03 三处（@唐瀚） |
| 2026-05-11 | Sprint 4 任务 v1.4 | 前置工作梳理：①新增 `T-S4-INF-00` hotfix（cookie-parser + 删 JWT_REFRESH_SECRET），D1 优先合并，工期 0.2d；②AUTO-02 明确「保持默认勾选 + 文案改 30 天免登」；③AUTO-03 明确「改密保留当前设备登录态」；④INF-02 / DOC-03 把 `operation-log.service.ts` 残留改为复用 `OperationLogger`；⑤REL-01 验证邮箱锁定 `neo-chang@163.com` + `26494513@qq.com`；⑥总工期 7.5d → 7.7d（@唐瀚） |
| 2026-05-11 | Sprint 4 任务 v1.5 | 「上线 / Release Notes」从 Sprint 3 挪入 Sprint 4：REL-01 拆为 Phase 1（rc.4 灰度）+ Phase 2（GA 收口）；新增回滚预案；REL-01 0.5d → 1.5d；总工期 7.7d → 8.7d（@唐瀚） |
