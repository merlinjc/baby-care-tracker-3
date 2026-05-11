# Baby Care Tracker Web 版 API 接口规范

> **版本**: v1.0 | **日期**: 2026-04-30 | **状态**: 规划中
>
> 基于 REFACTORING_PLAN.md §5 API 设计，对齐小程序 service-api.md 的业务逻辑与 shared/types/index.ts 的类型定义。

---

## 目录

1. [通用规范](#1-通用规范)
2. [认证接口](#2-认证接口)
3. [记录接口](#3-记录接口)
4. [家庭接口](#4-家庭接口)
5. [宝宝接口](#5-宝宝接口)
6. [疫苗接口](#6-疫苗接口)
7. [里程碑接口](#7-里程碑接口)
8. [趋势接口](#8-趋势接口)
9. [AI 接口](#9-ai-接口)
10. [导出接口](#10-导出接口)
11. [数据结构定义](#11-数据结构定义)

---

## 1. 通用规范

### 1.1 Base URL

```
生产环境: https://{domain}/api
开发环境: http://localhost:3000/api
```

### 1.2 请求/响应包装格式

所有接口统一使用以下响应格式：

```typescript
// 成功响应
interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

// 失败响应
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;       // 业务错误码，如 PERMISSION_DENIED
    message: string;    // 人类可读的错误描述（中文）
  };
}
```

**设计说明**：与小程序云函数返回值契约 `{ success, data?, error? }` 保持一致，前端适配成本最低。

### 1.3 分页参数规范

所有列表接口统一使用以下分页参数：

```typescript
interface PaginationParams {
  page?: number;     // 页码，从 1 开始，默认 1
  pageSize?: number; // 每页条数，默认 20，最大 100
}
```

分页响应格式：

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;      // 总记录数
  page: number;       // 当前页码
  pageSize: number;   // 每页条数
  hasMore: boolean;   // 是否有下一页
}
```

**与小程序版的映射**：小程序使用 `skip/limit` 偏移量分页，Web 版使用 `page/pageSize` 页码分页，后端自动转换：`offset = (page - 1) * pageSize`。

### 1.4 认证方式

除认证接口外，所有接口需在请求头携带 JWT Access Token：

```
Authorization: Bearer <access_token>
```

Refresh Token 通过 `httpOnly` + `SameSite=Strict` cookie 自动携带。

### 1.5 权限校验规则

对应小程序版 `PermissionGuard` + `PermissionUtil`，Web 版在后端中间件统一校验。

#### 角色权限矩阵

| 权限 | admin | editor | viewer |
|------|-------|--------|--------|
| `record:create` | ✅ | ✅ | ❌ |
| `record:update:own` | ✅ | ✅ | ❌ |
| `record:update:any` | ✅ | ❌ | ❌ |
| `record:delete:own` | ✅ | ✅ | ❌ |
| `record:delete:any` | ✅ | ❌ | ❌ |
| `family:manage` | ✅ | ❌ | ❌ |
| `family:dissolve` | ✅ | ❌ | ❌ |
| `baby:create` | ✅ | ❌ | ❌ |
| `baby:delete` | ✅ | ❌ | ❌ |
| `member:manage` | ✅ | ❌ | ❌ |

**说明**：
- `admin` 拥有全部权限（对应小程序版 `isAdmin`）
- `editor` 可创建/修改/删除自己的记录（对应小程序版 `canEdit`）
- `viewer` 只能查看数据（对应小程序版 `!canEdit && !isAdmin`）
- `own` 指记录的 `createdBy === 当前用户ID`；`any` 指不限制创建者

### 1.6 错误码定义

基于小程序 `cloudfunctions/familyOperation/errors.js` 的错误码体系，Web 版扩展如下：

#### 通用错误码（4xx）

| HTTP 状态码 | 错误码 | 说明 | 对应小程序错误码 |
|------------|--------|------|----------------|
| 400 | `INVALID_PARAMS` | 请求参数无效 | `INVALID_PARAMS` |
| 401 | `UNAUTHORIZED` | 未认证（Token 缺失/过期） | — |
| 401 | `TOKEN_EXPIRED` | Access Token 已过期 | — |
| 403 | `PERMISSION_DENIED` | 权限不足 | `PERMISSION_DENIED` |
| 404 | `NOT_FOUND` | 资源不存在 | — |
| 409 | `CONFLICT` | 资源冲突（乐观锁等） | `BUSY` |
| 422 | `VALIDATION_ERROR` | 请求体校验失败 | `INVALID_PARAMS` |
| 429 | `RATE_LIMITED` | 请求过于频繁 | `RATE_LIMITED` |

#### 认证错误码

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | `INVALID_CREDENTIALS` | 邮箱/手机号或密码错误 |
| 400 | `EMAIL_ALREADY_EXISTS` | 邮箱已被注册 |
| 400 | `PHONE_ALREADY_EXISTS` | 手机号已被注册 |
| 400 | `WEAK_PASSWORD` | 密码强度不足 |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh Token 无效或已过期 |
| 401 | `WECHAT_AUTH_FAILED` | 微信授权失败（code 失效或 unionid 缺失） |
| 503 | `WECHAT_NOT_CONFIGURED` | 微信扫码登录尚未配置（详见 §2.8） |

#### 家庭错误码

| HTTP 状态码 | 错误码 | 说明 | 对应小程序错误码 |
|------------|--------|------|----------------|
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 | `FAMILY_NOT_FOUND` |
| 404 | `USER_NOT_FOUND` | 用户不存在 | `USER_NOT_FOUND` |
| 400 | `INVALID_CODE` | 邀请码无效 | `INVALID_CODE` |
| 400 | `CODE_EXPIRED` | 邀请码已过期 | `CODE_EXPIRED` |
| 409 | `ALREADY_MEMBER` | 已是家庭成员 | `ALREADY_MEMBER` |
| 409 | `ALREADY_IN_FAMILY` | 已属于其他家庭 | `ALREADY_IN_FAMILY` |
| 400 | `SOLE_ADMIN` | 唯一管理员不可直接退出 | `SOLE_ADMIN` |
| 400 | `CANNOT_REMOVE_SELF` | 不能移除自己 | `CANNOT_REMOVE_SELF` |
| 400 | `CANNOT_REMOVE_ADMIN` | 不能移除管理员 | `CANNOT_REMOVE_ADMIN` |
| 400 | `NOT_MEMBER` | 目标用户不是家庭成员 | `NOT_MEMBER` |
| 400 | `INVALID_ROLE` | 无效的角色值 | `INVALID_ROLE` |

#### 记录/宝宝错误码

| HTTP 状态码 | 错误码 | 说明 | 对应小程序错误码 |
|------------|--------|------|----------------|
| 404 | `RECORD_NOT_FOUND` | 记录不存在或已被删除 | `RECORD_NOT_FOUND` |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在或已被删除 | `BABY_NOT_FOUND` |

#### 服务端错误码（5xx）

| HTTP 状态码 | 错误码 | 说明 | 对应小程序错误码 |
|------------|--------|------|----------------|
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | `INTERNAL_ERROR` |

### 1.7 限流策略

| 接口分类 | 限流规则 | 说明 |
|---------|---------|------|
| 认证接口 | 10 次/分钟/IP | 防暴力破解 |
| 创建家庭/加入家庭 | 5 次/分钟/用户 | 对应小程序 60s/5次 |
| AI 接口 | 20 次/天/用户 | 对应小程序 QuotaService 每日配额 |
| 通用接口 | 100 次/分钟/用户 | 默认限流 |
| 数据导出 | 5 次/小时/用户 | 资源密集操作 |

实现方式：`rate-limiter-flexible` + Redis（生产）/ 内存（开发）。

---

## 2. 认证接口

### 2.1 POST /api/auth/register

注册新用户。

**请求体**：

```typescript
interface RegisterRequest {
  email?: string;     // 邮箱，与 phone 二选一
  phone?: string;     // 手机号，与 email 二选一
  password: string;   // 密码，8-32 位，需含字母和数字
  nickname: string;   // 昵称，1-20 字符
}
```

**成功响应** `201`：

```typescript
interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
```

> Refresh Token 通过 `Set-Cookie` 响应头设置（`httpOnly; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800`）。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `EMAIL_ALREADY_EXISTS` | 邮箱已被注册 |
| 400 | `PHONE_ALREADY_EXISTS` | 手机号已被注册 |
| 400 | `WEAK_PASSWORD` | 密码强度不足 |
| 422 | `VALIDATION_ERROR` | 字段校验失败 |

---

### 2.2 POST /api/auth/login

用户登录。

**请求体**：

```typescript
interface LoginRequest {
  email?: string;     // 邮箱，与 phone 二选一
  phone?: string;     // 手机号，与 email 二选一
  password: string;   // 密码
}
```

**成功响应** `200`：

```typescript
interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_CREDENTIALS` | 邮箱/手机号或密码错误 |
| 422 | `VALIDATION_ERROR` | 字段校验失败 |

---

### 2.3 POST /api/auth/refresh

使用 Refresh Token 刷新 Access Token。

**请求**：无需请求体，Refresh Token 通过 cookie 自动携带。

**成功响应** `200`：

```typescript
interface RefreshResponse {
  accessToken: string;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `INVALID_REFRESH_TOKEN` | Refresh Token 无效或已过期 |

---

### 2.4 GET /api/auth/me

获取当前登录用户信息。

**请求头**：`Authorization: Bearer <token>`

**成功响应** `200`：

```typescript
interface AuthUserResponse {
  user: AuthUser;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | Token 无效或过期 |

---

### 2.5 PATCH /api/auth/profile

更新当前用户信息。**v7.2+ 新增 `preferences` 字段**，用于增量更新用户个性化偏好。

**请求体**：

```typescript
interface UpdateProfileRequest {
  nickname?: string;              // 昵称，1-20 字符
  avatar?: string | null;         // 头像 URL；显式传 null 清空
  /** v7.2+：用户偏好（顶层 key 级深合并语义） */
  preferences?: Partial<UserPreferences>;
}

interface UserPreferences {
  onboardingCompleted?: boolean;          // F1：首次引导是否完成
  onboardingSkippedSteps?: string[];      // F1：已跳过的步骤 ID
  lang?: string;                          // F8：当前语言（如 'zh-CN'）
  langManuallySet?: boolean;              // F8：是否手动切换过
  fontScale?: 'sm' | 'md' | 'lg' | 'xl';  // v7.1 字体档跨设备种子
  themeMode?: 'light' | 'warm-night' | 'system';  // v7.1 主题模式跨设备种子
  // 未知键允许透传（前后端跨版本兼容）
}
```

**`preferences` 深合并语义**（关键）：

- 服务端按**顶层 key 级别**做部分更新，未传的 key 保留原值
- 客户端只需传想要修改的子集，无需先拉再合再写
- 显式传 `null` 视为"将该 key 设为 null"（不删除）；如需"清空"请用合理默认值
- 未知键透传保留（便于灰度发布、跨版本兼容）
- 库里实际持久化为 JSON 字符串（`User.preferences`）；脏数据解析失败时 `getMe` 返回 `preferences: null`，不抛错

**示例**：

```bash
# 标记首次引导完成
PATCH /api/auth/profile
{ "preferences": { "onboardingCompleted": true } }

# 切换语言（不影响 onboardingCompleted）
PATCH /api/auth/profile
{ "preferences": { "lang": "en-US", "langManuallySet": true } }

# 同时改昵称与字体档
PATCH /api/auth/profile
{
  "nickname": "Alice",
  "preferences": { "fontScale": "lg" }
}
```

**成功响应** `200`：

```typescript
interface AuthUserResponse {
  user: AuthUser;   // 完整 user 对象，含合并后的 preferences（已反序列化为对象）
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | Token 无效或过期 |
| 422 | `VALIDATION_ERROR` | 字段校验失败（如 fontScale 取值不在白名单） |

**前端调用约定**：

- 业务代码请优先使用 `useAuthStore().updatePreferences(patch)` 或 `authService.updatePreferences(patch)`，语义比直接调 `updateProfile` 更明确
- 该接口写后会同步 `auth-store.user.preferences`，UI 立即生效
- 不要绕过该接口在本地保存"用户偏好"（双写不一致）。本地缓存仅作为运行时副本（如 `font-scale-store` / `theme-store` 的 zustand persist），跨设备同步走该接口

---

### 2.6 POST /api/auth/change-password

修改密码。

**请求体**：

```typescript
interface ChangePasswordRequest {
  currentPassword: string;  // 当前密码
  newPassword: string;      // 新密码，8-32 位，需含字母和数字
}
```

**成功响应** `200`：

```typescript
interface ChangePasswordResponse {
  message: string;  // "密码修改成功"
}
```

> 密码修改成功后，所有已发放的 Refresh Token 失效，用户需重新登录。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_CREDENTIALS` | 当前密码错误 |
| 400 | `WEAK_PASSWORD` | 新密码强度不足 |
| 401 | `UNAUTHORIZED` | Token 无效或过期 |

---

### 2.7 POST /api/auth/logout

主动注销。清掉 httpOnly `refreshToken` cookie，使后端不能再续期；前端额外调 `useAuthStore.logout()` 清掉本地 access token & user。

**请求**：无需请求体；端点对未认证开放（即使 access token 已过期/缺失也允许调用）。

**成功响应** `200`：

```typescript
interface LogoutResponse {
  message: string;  // "已退出登录"
}
```

**错误响应**：无（即使没有 cookie 也成功，等价于 no-op，方便前端 idempotent 调用）。

---

### 2.8 POST /api/auth/wechat（方案预留）

微信开放平台「网站应用」OAuth2 扫码登录回调：前端拿到 `code` 后调本接口换取我方 JWT。

**请求体**：

```typescript
interface WechatLoginRequest {
  code: string;       // 必填，微信回调返回的 OAuth code
  state?: string;     // 可选，CSRF state（前端已在 sessionStorage 校验）
}
```

**成功响应** `200`：

```typescript
interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
```

> 与普通登录一致：Refresh Token 通过 `Set-Cookie` 设置。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_PARAMS` | code 缺失/格式错 |
| 401 | `WECHAT_AUTH_FAILED` | 微信平台回报 errcode（code 过期/已使用/无效）或 unionid 缺失 |
| 503 | `WECHAT_NOT_CONFIGURED` | 后端尚未配置 `WECHAT_WEB_APP_ID/_SECRET` 或 schema 未补 `wechatUnionId` 字段 |

**业务规则**：
- 限流：5 次/分钟/IP（沿用 `authRateLimit`）。
- 当前为「方案预留」：默认返回 `WECHAT_NOT_CONFIGURED`。
- 启用步骤详见 `server/src/services/wechat-auth.service.ts` 的 `TODO(wechat-login-phase-2)` 注释块；核心要点：
  1. 在「微信开放平台」(https://open.weixin.qq.com/) 注册「网站应用」，拿到 web 端专用 AppID（**与小程序 AppID 不同**）。
  2. 主体认证（个人开发者目前不支持网站应用）+ 配置 ICP 备案的回调域名。
  3. 后端 `.env` 配置 `WECHAT_WEB_APP_ID` + `WECHAT_WEB_APP_SECRET`；前端 `.env` 配置 `VITE_WECHAT_LOGIN_ENABLED=true` + `VITE_WECHAT_APP_ID` + `VITE_WECHAT_REDIRECT_URI`。
  4. 在 prisma schema 上为 `User` 加 `wechatUnionId String? @unique` + `wechatOpenId String?` 字段并 migrate。
  5. 替换 service 中的 TODO 块为真正的 `prisma.user.upsert` 实现。

**前端配套路由**：`/auth/wechat/callback` 页面（`pages/auth/wechat-callback.tsx`）负责接收 `code + state`、做 CSRF 校验、调本接口、写入 store、跳首页。

---

## 3. 记录接口

### 3.1 GET /api/records

查询记录列表（含分页和筛选）。

**对应小程序**：`RecordService.getRecords(babyId, options)`

**查询参数**：

```typescript
interface GetRecordsQuery extends PaginationParams {
  babyId: string;           // 必填，宝宝 ID
  recordType?: RecordType;  // 可选，记录类型筛选
  startDate?: string;       // 可选，开始日期（ISO 8601）
  endDate?: string;         // 可选，结束日期（ISO 8601）
  orderBy?: string;         // 可选，排序字段，默认 'startTime'
  order?: 'asc' | 'desc';  // 可选，排序方向，默认 'desc'
}
```

**成功响应** `200`：

```typescript
interface RecordsListResponse {
  items: Record[];     // 记录列表，每条 Record 含对应类型的 data
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**说明**：
- 每条 Record 根据 `recordType` 自动包含对应的子数据（`feedingData` / `sleepData` / `diaperData` / `temperatureData` / `growthData`）
- 后端自动校验 `babyId` 对应的宝宝属于当前用户所在家庭

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问该宝宝数据 |
| 422 | `VALIDATION_ERROR` | 参数校验失败（如缺少 babyId） |

---

### 3.2 POST /api/records

创建记录。

**对应小程序**：`RecordService.createRecord(data)`

**请求体**：

```typescript
interface CreateRecordRequest {
  babyId: string;               // 必填，宝宝 ID
  recordType: RecordType;       // 必填，记录类型
  startTime: string;            // 必填，开始时间（ISO 8601）
  endTime?: string | null;      // 可选，结束时间（睡眠等）
  note?: string | null;         // 可选，备注
  // 类型特定数据（根据 recordType 选择其一）
  feedingData?: FeedingData;    // recordType='feeding' 时必填
  sleepData?: SleepData;        // recordType='sleep' 时必填
  diaperData?: DiaperData;      // recordType='diaper' 时必填
  temperatureData?: TemperatureData; // recordType='temperature' 时必填
  growthData?: GrowthData;      // recordType='growth' 时必填
}
```

**成功响应** `201`：

```typescript
interface RecordResponse {
  record: Record;
}
```

**权限要求**：`record:create`（admin / editor）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | viewer 无创建权限 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败（如缺少类型数据） |

---

### 3.3 GET /api/records/:id

获取记录详情。

**对应小程序**：`RecordService`（通过 getRecords 获取单条）

**成功响应** `200`：

```typescript
interface RecordResponse {
  record: Record;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问该记录 |
| 404 | `RECORD_NOT_FOUND` | 记录不存在 |

---

### 3.4 PATCH /api/records/:id

更新记录。

**对应小程序**：`RecordService.updateRecord(recordId, data)`

**请求体**：

```typescript
interface UpdateRecordRequest {
  startTime?: string;            // 可选
  endTime?: string | null;       // 可选
  note?: string | null;          // 可选
  feedingData?: FeedingData;     // 可选，仅 recordType='feeding'
  sleepData?: SleepData;         // 可选，仅 recordType='sleep'
  diaperData?: DiaperData;       // 可选，仅 recordType='diaper'
  temperatureData?: TemperatureData; // 可选，仅 recordType='temperature'
  growthData?: GrowthData;       // 可选，仅 recordType='growth'
}
```

**成功响应** `200`：

```typescript
interface RecordResponse {
  record: Record;
}
```

**权限要求**：
- 更新自己的记录：`record:update:own`（admin / editor）
- 更新他人的记录：`record:update:any`（仅 admin）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权更新该记录 |
| 404 | `RECORD_NOT_FOUND` | 记录不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 3.5 DELETE /api/records/:id

删除记录。

**对应小程序**：`RecordService.deleteRecord(recordId)`

**成功响应** `200`：

```typescript
interface DeleteRecordResponse {
  message: string;  // "记录已删除"
}
```

**权限要求**：
- 删除自己的记录：`record:delete:own`（admin / editor）
- 删除他人的记录：`record:delete:any`（仅 admin）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权删除该记录 |
| 404 | `RECORD_NOT_FOUND` | 记录不存在 |

---

### 3.6 GET /api/records/today-stats

获取今日统计。

**对应小程序**：`RecordService.getTodayStats(babyId)`

**查询参数**：

```typescript
interface TodayStatsQuery {
  babyId: string;  // 必填，宝宝 ID
}
```

**成功响应** `200`：

```typescript
interface TodayStatsResponse {
  stats: TodayStats;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问该宝宝数据 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

## 4. 家庭接口

### 4.1 POST /api/families

创建家庭。

**对应小程序**：`FamilyService.createFamily(options)`

**请求体**：

```typescript
interface CreateFamilyRequest {
  name: string;           // 必填，家庭名称，1-30 字符
  nickname: string;       // 必填，用户在家庭中的昵称
  relation?: string;      // 可选，与宝宝的关系（mom/dad/grandma_m 等）
  relationText?: string;  // 可选，关系中文文本
}
```

**成功响应** `201`：

```typescript
interface FamilyResponse {
  family: FamilyDetail;
}
```

**业务规则**：
- 自动生成 6 位邀请码（去除 I/O/0/1），有效期 7 天
- 邀请码生成自带"碰撞检测 + 重试"，确保全局唯一（最多 5 次重试）
- 创建者自动成为 admin 角色
- 入参 `nickname` 会持久化到 `FamilyMember.displayName`，作为该用户在本家庭中的展示昵称
- `relation` / `relationText` 任一存在则写入 `FamilyMember.relation`
- 用户已属于有效家庭时返回 `ALREADY_IN_FAMILY`

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 409 | `ALREADY_IN_FAMILY` | 用户已属于其他家庭 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 4.2 GET /api/families/current

获取当前用户所在家庭。

**对应小程序**：`FamilyService.getFamilyByUserId(userId)`

**成功响应** `200`：

```typescript
interface FamilyResponse {
  family: FamilyDetail | null;  // null 表示未加入任何家庭
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |

---

### 4.3 GET /api/families/:id

获取家庭详情。

**对应小程序**：`FamilyService.getFamilyDetail(familyId)`

**成功响应** `200`：

```typescript
interface FamilyResponse {
  family: FamilyDetail;
}
```

**业务规则**：仅家庭成员可查看家庭详情。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非家庭成员 |
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 |

---

### 4.4 GET /api/families/:id/members

获取家庭成员列表。

**对应小程序**：`FamilyService.getFamilyMembers(familyId)`

**成功响应** `200`：

```typescript
interface FamilyMembersResponse {
  members: FamilyMember[];
}
```

**业务规则**：仅家庭成员可查看。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非家庭成员 |
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 |

---

### 4.5 POST /api/families/join

通过邀请码加入家庭。

**对应小程序**：`FamilyService.joinByInviteCode(code, memberInfo)`

**请求体**：

```typescript
interface JoinFamilyRequest {
  inviteCode: string;       // 必填，6 位邀请码
  nickname: string;         // 必填，在家庭中的昵称
  relation?: string;        // 可选，与宝宝的关系
  relationText?: string;    // 可选，关系中文文本
}
```

**成功响应** `200`：

```typescript
interface FamilyResponse {
  family: FamilyDetail;
}
```

**业务规则**：
- 限流：5 次/分钟/用户
- 邀请码大小写不敏感（请求阶段 schema 自动 `trim().toUpperCase()` 后再校验）
- 邀请码有效期 7 天
- 入参 `nickname` 会持久化到 `FamilyMember.displayName`
- 用户已属于其他家庭时返回 `ALREADY_IN_FAMILY`
- 已是家庭成员返回 `ALREADY_MEMBER`
- 唯一管理员试图加入其他家庭返回 `SOLE_ADMIN`

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_CODE` | 邀请码无效 |
| 400 | `CODE_EXPIRED` | 邀请码已过期 |
| 409 | `ALREADY_MEMBER` | 已是家庭成员 |
| 409 | `ALREADY_IN_FAMILY` | 已属于其他家庭 |
| 400 | `SOLE_ADMIN` | 唯一管理员需先转让或解散 |
| 429 | `RATE_LIMITED` | 操作过于频繁 |

---

### 4.6 POST /api/families/:id/leave

退出家庭。

**对应小程序**：`FamilyService.leaveFamily(familyId, userId)`（含状态机）

**成功响应** `200`：

```typescript
interface LeaveFamilyResponse {
  status: 'ok' | 'dissolved' | 'family_not_found' | 'not_member' | 'need_transfer';
  message: string;
  otherMembers?: Pick<User, 'id' | 'nickname' | 'avatar'>[];  // status='need_transfer' 时非空
}
```

**状态机说明**（对齐小程序 v4.3 状态机；该接口为幂等三态机，所有"非成员/家庭不存在"场景均通过 status 字段返回，**不抛 4xx**）：

| status | 含义 | 前端处理 |
|--------|------|---------|
| `ok` | 成功退出 | 清理本地数据，跳转首页 |
| `dissolved` | 退出后家庭自动解散（仅剩一人） | 清理本地数据，并清理本地 baby/records 缓存 |
| `family_not_found` | 家庭已不存在（幂等） | 清理本地数据 |
| `not_member` | 用户不是成员（幂等，含被并发踢出场景） | 清理本地数据 |
| `need_transfer` | 唯一管理员需先转让 | 弹窗选择接任者 |

**实现说明**：
- "解散判断" 与 "删除 membership" 在同一事务内完成，避免事务外二次查询导致的并发竞态
- 删除 membership 使用 `deleteMany`，并发已被踢出时基于 `count===0` 幂等返回 `not_member`
- 解散时会级联删除整个家庭关联资源（与 §4.7 一致）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |

---

### 4.7 DELETE /api/families/:id

解散家庭。

**对应小程序**：`FamilyService.dissolveFamily(familyId, userId)`

**成功响应** `200`：

```typescript
interface DissolveFamilyResponse {
  message: string;  // "家庭已解散"
}
```

**权限要求**：`family:dissolve`（仅 admin）

**业务规则**：
- 在同一事务内执行：批量清除所有成员的 `User.familyId` → 级联删除 babies / records / sub-records (feeding/sleep/diaper/temperature/growth) / vaccine_records / milestone_records / family_members → 删除 family 自身
- 关联表的 onDelete cascade 已在 Prisma schema 中配置，业务层显式删除以兼容存量数据并保留可观测性
- 操作日志（`OperationLog`）记录每一步状态

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 |

---

### 4.8 POST /api/families/:id/refresh-invite

刷新邀请码。

**对应小程序**：`FamilyService.refreshInviteCode(familyId, userId)`

**成功响应** `200`：

```typescript
interface RefreshInviteResponse {
  inviteCode: string;
  inviteCodeExpiry: string;  // ISO 8601
}
```

**权限要求**：`family:manage`（仅 admin）

**业务规则**：
- 邀请码生成自带"碰撞检测 + 重试"，确保全局唯一
- 新邀请码有效期 7 天

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 |

---

### 4.9 PATCH /api/families/:id/members/:userId/role

更新成员角色。

**对应小程序**：`FamilyService.updateMemberRole(familyId, userId, targetId, role)`

**路径参数**：
- `:id` — 家庭 ID
- `:userId` — 目标成员的用户 ID

**请求体**：

```typescript
interface UpdateMemberRoleRequest {
  role: FamilyRole;  // 必填，'admin' | 'editor' | 'viewer'
}
```

**成功响应** `200`：

```typescript
interface UpdateMemberRoleResponse {
  member: FamilyMember;
}
```

**权限要求**：`member:manage`（仅 admin）

**业务规则**：
- 角色白名单校验，非法值返回 `INVALID_ROLE`
- 不能修改自己的角色（返回 `INVALID_PARAMS`）
- 不能把"最后一个 admin"降级为 editor/viewer，否则返回 `SOLE_ADMIN`
- 等价更新（目标当前 role === 新 role）直接返回成功，不产生写
- 基于 `FamilyMember.version` 字段实现真乐观锁，最多重试 3 次；版本不匹配自动重读后再更新

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_ROLE` | 角色值不在白名单 |
| 400 | `INVALID_PARAMS` | 试图修改自己的角色 |
| 400 | `SOLE_ADMIN` | 试图降级最后一个管理员 |
| 400 | `NOT_MEMBER` | 目标用户不是家庭成员 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |
| 409 | `CONFLICT` | 乐观锁重试 3 次仍冲突 |

---

### 4.10 DELETE /api/families/:id/members/:userId

移除成员。

**对应小程序**：`FamilyService.removeMember(familyId, userId, targetId)`

**路径参数**：
- `:id` — 家庭 ID
- `:userId` — 被移除成员的用户 ID

**成功响应** `200`：

```typescript
interface RemoveMemberResponse {
  message: string;  // "成员已移除"
}
```

**权限要求**：`member:manage`（仅 admin）

**业务规则**：
- 不能移除自己（使用 `leave` 接口）
- 不能移除其他管理员
- 删除使用 `deleteMany` 幂等：若并发场景下目标已自行 leave，仍返回成功 `成员已移除`

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `CANNOT_REMOVE_SELF` | 试图移除自己 |
| 400 | `CANNOT_REMOVE_ADMIN` | 试图移除管理员 |
| 400 | `NOT_MEMBER` | 目标不是家庭成员 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |

---

### 4.11 POST /api/families/:id/transfer-admin

转让管理员。

**对应小程序**：`FamilyService.transferAdmin(familyId, currentId, newId)`

**请求体**：

```typescript
interface TransferAdminRequest {
  newAdminId: string;  // 必填，新管理员的用户 ID
}
```

**成功响应** `200`：

```typescript
interface TransferAdminResponse {
  message: string;      // "管理员已转让"
  newAdminId: string;
}
```

**权限要求**：`member:manage`（仅 admin）

**业务规则**：
- 转让后原 admin 降为 editor
- 新 admin 必须是当前家庭成员
- 不能转让给自己（返回 `INVALID_PARAMS`）
- 目标已经是 admin 时返回 `INVALID_PARAMS`，避免误把自己降级造成"无 admin 家庭"

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 400 | `INVALID_PARAMS` | 转让给自己 / 目标已是 admin |
| 400 | `NOT_MEMBER` | 目标不是家庭成员 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |

---

## 5. 宝宝接口

### 5.1 POST /api/babies

创建宝宝。

**对应小程序**：`BabyService.createBaby(familyId, name, gender, birthDate, avatar)`

**请求体**：

```typescript
interface CreateBabyRequest {
  familyId: string;       // 必填，所属家庭 ID
  name: string;           // 必填，姓名，1-20 字符
  gender: Gender;         // 必填，'male' | 'female'
  birthDate: string;      // 必填，出生日期（ISO 8601）
  avatar?: string;        // 可选，头像 URL
}
```

**成功响应** `201`：

```typescript
interface BabyResponse {
  baby: Baby;
}
```

**权限要求**：`baby:create`（仅 admin）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |
| 404 | `FAMILY_NOT_FOUND` | 家庭不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 5.2 GET /api/babies

获取宝宝列表。

**对应小程序**：`BabyService.getBabiesByFamilyId(familyId)`

**查询参数**：

```typescript
interface GetBabiesQuery {
  familyId: string;  // 必填，家庭 ID
}
```

**成功响应** `200`：

```typescript
interface BabiesListResponse {
  babies: Baby[];
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非家庭成员 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 5.3 GET /api/babies/:id

获取宝宝详情。

**对应小程序**：`BabyService.getBabyById(babyId)`

**成功响应** `200`：

```typescript
interface BabyResponse {
  baby: Baby;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

### 5.4 PATCH /api/babies/:id

更新宝宝信息。

**对应小程序**：`BabyService.updateBaby(babyId, data)`

**请求体**（字段白名单）：

```typescript
interface UpdateBabyRequest {
  name?: string;         // 可选
  gender?: Gender;       // 可选
  birthDate?: string;    // 可选（ISO 8601）
  avatar?: string;       // 可选
}
```

**成功响应** `200`：

```typescript
interface BabyResponse {
  baby: Baby;
}
```

**权限要求**：非 viewer 角色（admin / editor）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | viewer 无修改权限 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 5.5 DELETE /api/babies/:id

删除宝宝。

**对应小程序**：`BabyService.deleteBaby(babyId, familyId)`（含级联删除和断点续传）

**请求体**：

```typescript
interface DeleteBabyRequest {
  familyId: string;  // 必填，用于权限校验
}
```

**成功响应** `200`：

```typescript
interface DeleteBabyResponse {
  status: 'succeeded' | 'in_progress';
  deletedBabyId?: string;        // status='succeeded' 时
  records?: number;              // 删除的记录数
  vaccine?: number;              // 删除的疫苗记录数
  milestone?: number;            // 删除的里程碑记录数
  cursor?: string;               // status='in_progress' 时，断点续传游标
  progress?: {                   // status='in_progress' 时
    records: number;
    vaccine: number;
    milestone: number;
  };
}
```

**权限要求**：`baby:delete`（仅 admin）

**业务规则**：
- 级联删除关联的 records / vaccine_records / milestone_records
- 大数据量时支持断点续传（对齐小程序 v4.3.1 分批删除）
- 前端需循环调用直到 `status === 'succeeded'`

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非 admin |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

### 5.6 POST /api/babies/:id/avatar

上传宝宝头像。

**对应小程序**：`BabyService.uploadAvatar(babyId, filePath)`

**请求体**：`multipart/form-data`

```typescript
interface UploadAvatarRequest {
  file: File;  // 必填，图片文件，最大 5MB
}
```

**成功响应** `200`：

```typescript
interface UploadAvatarResponse {
  avatar: string;  // 头像 URL
}
```

**权限要求**：非 viewer 角色

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | viewer 无修改权限 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 文件格式/大小不合规 |

---

## 6. 疫苗接口

### 6.1 GET /api/babies/:id/vaccines

获取宝宝疫苗列表。

**对应小程序**：`TodoService.getTodoStats(baby)`

**查询参数**：

```typescript
interface GetVaccinesQuery extends PaginationParams {
  status?: 'pending' | 'completed' | 'overdue';  // 可选，按状态筛选
}
```

**成功响应** `200`：

```typescript
interface VaccinesListResponse {
  items: VaccineRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

### 6.2 POST /api/babies/:id/vaccines

记录疫苗接种。

**对应小程序**：TodoService 中疫苗记录创建

**请求体**：

```typescript
interface CreateVaccineRequest {
  name: string;               // 必填，疫苗名称
  dose: string;               // 必填，剂次（如 "第1剂"）
  vaccinatedDate: string;     // 必填，接种日期（ISO 8601）
  note?: string;              // 可选，备注
}
```

**成功响应** `201`：

```typescript
interface VaccineResponse {
  vaccine: VaccineRecord;
}
```

**权限要求**：`record:create`（admin / editor）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | viewer 无创建权限 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 6.3 GET /api/babies/:id/vaccine-stats

获取疫苗统计。

**对应小程序**：`TodoService.getTodoStats(baby)` 中的疫苗部分

**成功响应** `200`：

```typescript
interface VaccineStatsResponse {
  total: number;        // 待接种总数（含逾期）
  overdue: number;      // 逾期数（total 的子集，不重复累加）
  upcoming: number;     // 即将到期数
  items: VaccineTodoItem[];
}

interface VaccineTodoItem {
  id: string;
  name: string;
  dose: string;
  plannedDate: string;
  isOverdue: boolean;
  isUpcoming: boolean;
  monthAge: number;
  ageLabel: string;
}
```

> ⚠️ **计数口径约定**：`overdue` 是 `total` 的子集，仅用于展示"已逾期"标签，不能再累加到总数。对应小程序 TodoService 计数口径。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

## 7. 里程碑接口

> **v5.x 重要变更**：里程碑改为 **打卡（check-in）模式**——前端不再支持自由添加，仅对内置标准里程碑（28 项 WHO/CDC 定义，见 `client/src/lib/milestone-defs.ts`）做"打卡 / 取消打卡"。
>
> 数据模型层面：`MilestoneRecord` 在 `(babyId, name)` 上加了复合唯一约束，并新增 `updatedAt`。`POST` 改为 **upsert 幂等**（已存在则原样返回，不覆盖 `achievedDate` / `note`）；新增 `PATCH`（编辑达成日期 / 备注）和 `DELETE`（取消打卡）。

### 7.1 GET /api/babies/:id/milestones

获取宝宝里程碑列表（仅返回已打卡的标准项）。

**对应小程序**：`milestone_records` 集合按 `babyId + familyId` 查询

**查询参数**：

```typescript
interface GetMilestonesQuery extends PaginationParams {
  category?: string;    // 可选，分类筛选（大运动/精细动作/语言/社交/认知；前端枚举见 milestone-defs.ts）
  status?: 'pending' | 'achieved';  // 兼容字段（当前实现忽略，因为只存 achieved）
}
```

**成功响应** `200`：

```typescript
interface MilestonesListResponse {
  items: MilestoneRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

### 7.2 POST /api/babies/:id/milestones

打卡里程碑（按 `(babyId, name)` 幂等 upsert）。

**幂等语义**：若该里程碑已打卡，**不会覆盖** `achievedDate` / `note`，直接返回现有记录（HTTP 仍为 201）。要修改请走 PATCH。

**请求体**：

```typescript
interface CreateMilestoneRequest {
  name: string;               // 必填，标准里程碑名称（前端取自 MILESTONE_DEFINITIONS）
  category: string;           // 必填，类别 key（motor/fine_motor/language/social/cognitive）
  achievedDate: string;       // 必填，达成日期（ISO 8601；通常前端传 new Date().toISOString()）
  note?: string;              // 可选，备注（≤ 500 字）
}
```

**成功响应** `201`：

```typescript
interface MilestoneResponse {
  milestone: MilestoneRecord;
}
```

**权限要求**：`record:create`（admin / editor）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | viewer 无创建权限 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 7.3 PATCH /api/babies/:id/milestones/:milestoneId

编辑里程碑的达成日期或备注（**不允许** 修改 `name` / `category`，因为绑定到内置标准定义）。

**请求体**：

```typescript
interface UpdateMilestoneRequest {
  achievedDate?: string;      // 可选，ISO 8601；至少与 note 二选一
  note?: string | null;       // 可选，传 null 清空
}
```

**成功响应** `200`：

```typescript
interface MilestoneResponse {
  milestone: MilestoneRecord;
}
```

**权限要求**：
- 创建人本人：`record:update:own`（admin / editor）
- 他人创建：`record:update:any`（仅 admin）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 权限不足 / 无访问权 |
| 404 | `NOT_FOUND` | 里程碑或宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

---

### 7.4 DELETE /api/babies/:id/milestones/:milestoneId

取消打卡（删除该条里程碑记录）。

**成功响应** `200`：

```typescript
interface DeleteMilestoneResponse {
  message: string;            // '已取消打卡'
}
```

**权限要求**：
- 创建人本人：`record:delete:own`（admin / editor）
- 他人创建：`record:delete:any`（仅 admin）

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 权限不足 / 无访问权 |
| 404 | `NOT_FOUND` | 里程碑或宝宝不存在 |

---

## 7a. 黄疸记录接口（v7.2+ T-S1-F2）

> **背景**：v7.2 之前黄疸记录在前端 `localStorage` 落地。v7.2 起改为云端同步：多设备 / 家庭成员可见同一份数据，离线编辑能力交给前端 React Query 缓存。
>
> **字段映射**（client lib/jaundice ↔ server JaundiceRecord）：
> - `date` ↔ `recordDate`
> - `ageDays` ↔ `dayAge`
> - `scleraYellow` ↔ `scleralIcterus`
> - `jaundiceType` ↔ `category`
> - `actions` ↔ `treatments`
> - `symptoms` / `kramerZone` / `tcb` / `tsb` / `note` 同名透传
>
> 客户端 `services/jaundice.ts` 内部双向映射，UI 层继续使用 client 字段名。

### 7a.1 GET /api/babies/:id/jaundice

获取宝宝黄疸记录列表（按 `recordDate` 倒序，默认 100 条）。

**Query**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|-----|------|
| `startDate` | string (ISO) | 否 | 闭区间起 |
| `endDate` | string (ISO) | 否 | 闭区间止；与 startDate 二选一/同时使用，要求 start ≤ end |
| `limit` | number | 否 | 默认 100，上限 500 |

**Response 200**：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ckxxx",
        "babyId": "ckxxx",
        "familyId": "ckxxx",
        "recordDate": "2026-05-01T00:00:00.000Z",
        "dayAge": 5,
        "kramerZone": 3,
        "scleralIcterus": true,
        "tcb": 12.3,
        "tsb": null,
        "category": "physiologic",
        "symptoms": ["吃奶正常", "尿色清亮"],
        "treatments": ["加强喂养", "多晒太阳"],
        "note": "观察中",
        "createdBy": "ckxxx",
        "createdAt": "2026-05-01T03:00:00.000Z",
        "updatedAt": "2026-05-01T03:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

### 7a.2 POST /api/babies/:id/jaundice

创建一条黄疸记录。

**Body**：除 `recordDate` 必填，其余全部可选。详见 `server/src/schemas/jaundice.schema.ts`。

| 字段 | 类型 | 校验 |
|------|------|-----|
| `recordDate` | string (ISO) | 必填，可解析的日期 |
| `dayAge` | number | 1 ≤ x ≤ 3650 |
| `kramerZone` | 1-5 \| null | 5 分区，null 表示未见黄染 |
| `scleralIcterus` | boolean | — |
| `tcb` / `tsb` | number | 0 ≤ x ≤ 50 (mg/dL) |
| `category` | enum | physiologic \| pathologic \| breast_milk \| null |
| `symptoms` / `treatments` | string[] | 每项 ≤ 32 字符，最多 20 项 |
| `note` | string | ≤ 500 字符 |

**Response 201**：`{ success: true, data: { record: { ... } } }`，结构与 7a.1 单条一致。

**权限**：`RECORD_CREATE`（admin / editor）。

### 7a.3 GET /api/babies/:id/jaundice/:recordId

获取单条详情。**响应**：`{ success: true, data: { record: { ... } } }`。

### 7a.4 PATCH /api/babies/:id/jaundice/:recordId

部分更新（所有字段可选；至少传一个字段）。可显式传 `null` 清空（如 `note: null`、`kramerZone: null`、`tcb: null`）。

**权限矩阵**：

| 角色 | 改自己创建的 | 改他人创建的 |
|------|--------------|--------------|
| admin | ✅ | ✅ |
| editor | ✅ | ❌ 403 PERMISSION_DENIED |
| viewer | ❌ 403 | ❌ 403 |

### 7a.5 DELETE /api/babies/:id/jaundice/:recordId

删除一条记录。权限矩阵同 7a.4（admin 可删任意，editor 仅删自己）。

**Response 200**：`{ success: true, data: { message: "已删除" } }`。

### 7a.6 错误码

| HTTP | code | 说明 |
|------|------|-----|
| 400 | `INVALID_PARAMS` | recordDate 无法解析 / kramerZone 越界 / category 非法等 |
| 403 | `PERMISSION_DENIED` | 跨家庭访问 / viewer 创建 / editor 改他人 |
| 404 | `NOT_FOUND` | 记录不存在或不属于该 baby |

### 7a.7 客户端一次性迁移

老用户（v7.1 及之前）登录后，`MainLayout` 在 `isAuthenticated && babies.length > 0` 后 1.5s 内动态 import `lib/migrations/jaundice-to-cloud`，将 `localStorage["baby_care_jaundice:{babyId}"]` 全量上传，成功后清理对应 key 并 `toast.success("已同步 N 条黄疸记录到云端")`。

迁移幂等：标记 key `baby_care_jaundice_migrated === 'v1'` 时跳过。失败保留 localStorage 下次重试。

---

## 8. 趋势接口

### 8.1 GET /api/babies/:id/trends

获取宝宝生长趋势数据。

**对应小程序**：`TrendService.getTrendData(babyId)` / `getTrendDataForPeriod(babyId, period)`

**查询参数**：

```typescript
interface GetTrendsQuery {
  type: TrendType;                // 必填，'weight' | 'height' | 'headCircumference'
  period?: 'week' | 'month' | '3months' | '6months' | 'year' | 'all';  // 可选，默认 'month'
}
```

**成功响应** `200`：

```typescript
interface TrendResponse {
  trend: TrendData;
}
```

**业务规则**：
- 返回 WHO 参考范围（P3/P15/P50/P85/P97）
- 计算状态值（low/normal/high）和智能提示语由前端根据 TrendData 计算

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |

### 8.2 GET /api/babies/:id/trend/weekly

获取「上周 vs 本周」增强趋势（FR-B）。

**对应服务**：`trendService.getEnhancedWeeklyTrend(userId, babyId)`

**业务规则（v4.3.2 修订）**：

- **本周窗口**：本周一 00:00（本地时区） → 今天 23:59:59，受 `baby.birthDate` 限制（若 birthDate 落在本周内，起始时间向后裁剪到 birthDate 当日 00:00）。
- **上周窗口**：上周一 00:00 → 上周日 23:59:59（完整 7 天），同样受 `baby.birthDate` 限制；当 birthDate 在本周内或本周之后时，`lastWeekPeriod` 返回 `null`。
- 各维度日均 = 周内总量 / 实际天数（最少 1 天，避免除零）。
- 体温维度统计周内 ≥ 37.5°C 的次数（不参与日均计算）。

**成功响应** `200`：

```typescript
interface WeeklyTrendResponse {
  trend: WeeklyTrendData;  // 见 §11 数据结构
}
```

**WeeklyTrendData 结构**（节选）：

```typescript
interface WeeklyTrendData {
  feeding: WeeklyTrendDimension;
  sleep: WeeklyTrendDimension;
  diaper: WeeklyTrendDimension;
  temperature: WeeklyTrendDimension;
  /** 本周窗口（受 birthDate 限制的实际起止） */
  period: { start: string; end: string };
  /** 上周完整窗口；当 birthDate 落在本周或之后时为 null */
  lastWeekPeriod: { start: string; end: string } | null;
  ageMonths: number;
}

interface WeeklyTrendDimension {
  thisWeekAvg: number;        // 本周日均（体温维度为周内异常次数）
  lastWeekAvg: number;        // 上周日均
  range: { min, max, unit } | null;
  status: 'normal' | 'low' | 'high' | 'very_low' | 'very_high'
        | 'attention' | 'medical_attention' | 'no_data';
  tip: string;
  changePercent: number | null;  // 环比百分比；上周为 0 时为 null
}
```

**错误响应**：与 §8.1 相同（`UNAUTHORIZED` / `PERMISSION_DENIED` / `BABY_NOT_FOUND`）。

---

## 9. AI 接口

### 9.1 POST /api/ai/chat

AI 对话。

**对应小程序**：`AIService.generateText()` / `AIService.streamText()`

**请求体**：

```typescript
interface AIChatRequest {
  messages: ChatMessage[];  // 必填，对话历史
  babyId?: string;          // 可选，关联宝宝（用于获取上下文）
  /** 可选：以某个育儿角色的视角生成回复；默认中立顾问 */
  role?: 'mom' | 'dad' | 'grandma_m' | 'grandma_p'
       | 'grandpa_m' | 'grandpa_p' | 'nanny' | 'other';
}
```

**成功响应** `200`：

支持两种模式：

**非流式**（默认）：

```typescript
interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

**流式**（请求头 `Accept: text/event-stream`）：

```
Content-Type: text/event-stream

data: {"content": "你好", "done": false}
data: {"content": "，", "done": false}
data: {"content": "我是宝宝护理助手", "done": false}
data: {"content": "", "done": true, "usage": {"promptTokens": 120, "completionTokens": 45}}
```

**业务规则**：
- 每日配额 100 次（`AI_DAILY_QUOTA`，与小程序 QuotaService 对齐）
- 超出配额返回 `QUOTA_EXCEEDED`（HTTP 403 / SSE `error` 事件）
- 后端走 OpenAI 兼容接口：`${OPENAI_BASE_URL}/chat/completions`（默认 TokenHub：`https://tokenhub.tencentmaas.com/v1`）
- 默认模型：`hy3-preview`（通过 `OPENAI_MODEL` 覆盖）
- 鉴权：`Authorization: Bearer ${OPENAI_API_KEY}`；未配置时开发环境降级 mock，不扣配额
- 若提供 `babyId`，后端自动注入宝宝基本情况和近期记录作为上下文

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 429 | `RATE_LIMITED` | 超出每日配额 |
| 500 | `INTERNAL_ERROR` | AI 服务调用失败 |

---

### 9.2 POST /api/ai/daily-insight

每日 AI 洞察。

**对应小程序**：`AIService.generateFeedingAdvice()` / `generateSleepAdvice()` 的综合版本

**请求体**：

```typescript
interface DailyInsightRequest {
  babyId: string;  // 必填，宝宝 ID
  role?: 'mom' | 'dad' | 'grandma_m' | 'grandma_p'
       | 'grandpa_m' | 'grandpa_p' | 'nanny' | 'other';
  // 可选：以某个育儿角色的视角生成洞察；不同角色会产出不同语气 + 侧重；
  // 后端缓存 key 额外按 role 区分（`daily_insight:${babyId}:${date}:${role}`）
}
```

> 实际项目中 `GET /api/ai/insight/daily?babyId=xxx&role=xxx` 是更常用的入口（同语义）。

**成功响应** `200`：

```typescript
interface DailyInsightResponse {
  insight: DailyInsight;
  date: string;  // 洞察日期（ISO 8601）
}
```

**业务规则**：
- 每日每个宝宝仅生成一次，后续请求返回缓存结果
- 同一日配额消耗计入 AI 总配额

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 无权访问 |
| 429 | `RATE_LIMITED` | 超出每日配额 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |

---

### 9.3 GET /api/ai/quota

查询 AI 配额使用情况。

**对应小程序**：`QuotaService`（localStorage 存储）

**成功响应** `200`：

```typescript
interface AIQuotaResponse {
  quota: {
    dailyLimit: number;    // 每日配额上限
    used: number;          // 今日已使用
    remaining: number;     // 今日剩余
    resetAt: string;       // 配额重置时间（ISO 8601）
  };
}
```

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |

---

## 10. 导出接口

### 10.1 GET /api/export

数据导出。

**对应小程序**：`ShareCanvasService` + `ReportDataHelper`

**查询参数**：

```typescript
interface ExportQuery {
  babyId: string;           // 必填，宝宝 ID
  format: 'csv' | 'json';  // 必填，导出格式
  recordType?: RecordType;  // 可选，记录类型筛选（不传则导出全部）
  startDate?: string;       // 可选，开始日期
  endDate?: string;         // 可选，结束日期
}
```

**成功响应** `200`：

- `format=csv`：`Content-Type: text/csv; Content-Disposition: attachment; filename=export_{babyId}_{date}.csv`
- `format=json`：`Content-Type: application/json; Content-Disposition: attachment; filename=export_{babyId}_{date}.json`

**权限要求**：家庭成员均可导出

**限流**：5 次/小时/用户

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `PERMISSION_DENIED` | 非家庭成员 |
| 404 | `BABY_NOT_FOUND` | 宝宝不存在 |
| 422 | `VALIDATION_ERROR` | 参数校验失败 |
| 429 | `RATE_LIMITED` | 导出次数超限 |

---

## 11. 文件上传 / 下载接口（v7.2+，方案 B 服务端代理）

> **架构说明**：v7.2 起所有图片读写**全部经 Express 代理**，COS 桶设为「私有读私有写」，密钥仅在服务端持有。
> - 上传：客户端 multipart → Express → `cos.putObject`
> - 下载：客户端 `<img src="/api/uploads/{key}">` → Express `cos.getObjectStream` → 流式回包
> - **DB 字段存 key**（如 `avatars/u1/abc.jpg`），而非完整 URL

### 11.1 POST /api/uploads — 上传图片

接收 `multipart/form-data`，由服务端代理写入 COS。

**请求**（`multipart/form-data`）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | ✓ | 图片文件，mimetype 必须为 `image/jpeg` / `image/png` / `image/webp`；服务端兜底大小限制 `COS_MAX_UPLOAD_BYTES`（默认 2MB） |
| `kind` | string | ✓ | `avatar` / `baby-avatar` / `daily-checkin` |
| `ext` | string | ✓ | 文件扩展名（含或不含点都可），白名单：jpg/jpeg/png/webp |
| `babyId` | string | 见 ctx | baby-avatar / daily-checkin 必填 |
| `familyId` | string | 见 ctx | baby-avatar / daily-checkin 必填 |
| `date` | string | 见 ctx | daily-checkin 必填，YYYY-MM-DD |

**成功响应** `201`：

```typescript
interface UploadResult {
  /** 桶内对象 key，前端落库 + 拼接代理 URL 用 */
  key: string;
  /** 上传后的字节数 */
  size: number;
  /** 内容类型 */
  contentType: string;
}
```

**Key 拼接规则**：

| kind | key 模板 | 必填 ctx |
|------|---------|---------|
| `avatar` | `avatars/{userId}/{cuid}.{ext}` | — |
| `baby-avatar` | `babies/{familyId}/{babyId}/{cuid}.{ext}` | familyId, babyId |
| `daily-checkin` | `checkins/{familyId}/{babyId}/{date}-{cuid}.{ext}` | familyId, babyId, date |

`{cuid}` 为 32 字符随机十六进制串。所有 ctx 字符串字段拒绝包含 `/` `\` `..`（防 path traversal）。

**前端流程**：

```typescript
// 客户端：使用 services/upload.ts 一行调用
import { uploadService, buildImageUrl } from '@/services/upload'

const { key } = await uploadService.upload(file, 'avatar')  // 自动压缩 + EXIF 剥离 + multipart POST
await authService.updateProfile({ avatar: key })             // 落库 key（不是 URL！）

// 展示：拼成 /api/uploads/{key} 走代理下载
<img src={buildImageUrl(user.avatar)} />
```

**ext 白名单**：仅允许 `jpg` / `jpeg` / `png` / `webp`。`jpeg` 会被服务端归一化为 `jpg`。

**限流**：20 次 / 分钟 / 用户。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 400 | `UPLOAD_INVALID_EXT` | ext 或 mimetype 不在白名单 |
| 400 | `UPLOAD_MISSING_CONTEXT` | kind 对应的 ctx 字段缺失 |
| 400 | `UPLOAD_TOO_LARGE` | 文件超过 `COS_MAX_UPLOAD_BYTES` |
| 400 | `INVALID_PARAMS` | date 格式不合法 / 缺 file 字段 / ctx 含非法字符 |
| 422 | `VALIDATION_ERROR` | zod schema 校验失败 |
| 429 | `RATE_LIMITED` | 上传次数超限 |
| 503 | `UPLOAD_NOT_CONFIGURED` | 后端缺 `COS_SECRET_ID/SECRET_KEY/BUCKET/REGION` 任一字段 |

---

### 11.2 GET /api/uploads/:key — 下载图片（流式代理）

通过 Express 流式代理 COS `getObjectStream`，密钥不暴露给客户端。

**请求**：

```
GET /api/uploads/avatars/u1/abc123def456...jpg
Authorization: Bearer <jwt>
```

> 注意：path 中的 `/` 是 key 的一部分，URL 不需要 encode。

**成功响应** `200`：
- `Content-Type`: 与 COS 对象一致（`image/jpeg` 等）
- `Content-Length`: 字节数
- `Cache-Control: public, max-age={COS_DOWNLOAD_CACHE_MAX_AGE}, immutable`（默认 1 天）
- Body: 图片二进制流

由于 key 32 字符 hex 不会复用（用户换头像 / 重新打卡都会生成新 key），`immutable` 缓存策略安全。

**错误响应**：

| 状态码 | 错误码 | 触发条件 |
|-------|--------|---------|
| 401 | `UNAUTHORIZED` | 未认证 |
| 400 | `INVALID_PARAMS` | key 非法（不以 avatars/ / babies/ / checkins/ 开头 / 含 `..` `\` / 控制字符 / 长度 > 256） |
| 404 | `NOT_FOUND` | 对象不存在 |
| 503 | `UPLOAD_NOT_CONFIGURED` | 后端缺 COS 配置 |

**`<img>` 标签使用注意**：浏览器 `<img>` 不会自动带 Authorization 头，**只会带 cookie**。当前 v7.2 通过同源 + JWT cookie 维持鉴权（前端 axios 已配置 `withCredentials`），如有跨域 / 公开访问需求请走「带签名的临时 GET URL」方案（未来版本扩展）。

---

### 11.3 配套 DB 字段语义说明

v7.2 起以下字段**统一存桶内 key**，不再存完整 URL：

| 字段 | 旧（v7.1）| 新（v7.2）|
|------|----------|----------|
| `User.avatar` | URL 或 null | key（如 `avatars/u1/abc.jpg`）或 null |
| `Baby.avatar` | URL 或 null | key（如 `babies/f1/b1/abc.jpg`）或 null |
| `DailyCheckin.photoUrl`（Sprint 2 F11）| — | key（如 `checkins/f1/b1/2026-05-11-abc.jpg`） |

**展示**：前端用 `buildImageUrl(key)` 拼成 `/api/uploads/{key}`。
**写入**：上传 API 返回的 `key` 直接作为字段值落库。

---

## 11. 数据结构定义

以下 TypeScript 接口与 `shared/types/index.ts` 对齐，补充了 API 层特有的请求/响应类型。

### 11.1 基础类型

```typescript
// ============ 基础枚举 ============
type FamilyRole = 'admin' | 'editor' | 'viewer';
type Gender = 'male' | 'female';
type RecordType = 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth';
type FeedingType = 'breast' | 'formula' | 'solid';
type BreastSide = 'left' | 'right' | 'both';
type SleepType = 'night' | 'nap';
type DiaperType = 'pee' | 'poop' | 'both';
type Consistency = 'watery' | 'soft' | 'formed' | 'hard';
type DiaperColor = 'normal' | 'yellow' | 'green' | 'black' | 'red';
type TempMethod = 'oral' | 'axillary' | 'rectal' | 'ear';
type TrendType = 'weight' | 'height' | 'headCircumference';
```

### 11.2 用户相关

```typescript
// 用户基础信息
interface User {
  id: string;
  email: string | null;
  phone: string | null;
  nickname: string;
  avatar: string | null;
  familyId: string | null;
  createdAt: string;
  updatedAt: string;
}

// 含家庭角色的用户信息（API 响应中常用）
interface AuthUser extends User {
  familyRole?: FamilyRole;
}
```

### 11.3 家庭相关

```typescript
// 家庭基础信息
interface Family {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  inviteCodeExpiry: string;
  createdAt: string;
  updatedAt: string;
}

// 家庭成员
interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  relation: string | null;
  displayName: string | null;  // ★ 用户在该家庭的展示昵称（创建/加入时入参 nickname 持久化）
  joinedAt: string;
  user?: Pick<User, 'id' | 'nickname' | 'avatar'>;
}

// 家庭详情（含成员和宝宝列表）
interface FamilyDetail extends Family {
  members: FamilyMember[];
  babies: Baby[];
}
```

### 11.4 宝宝相关

```typescript
interface Baby {
  id: string;
  familyId: string;
  name: string;
  gender: Gender;
  birthDate: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 11.5 记录相关

```typescript
// 核心记录
interface Record {
  id: string;
  babyId: string;
  familyId: string;
  recordType: RecordType;
  startTime: string;
  endTime: string | null;
  note: string | null;
  createdBy: string;
  creator?: Pick<User, 'id' | 'nickname' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
  feedingData?: FeedingData;
  sleepData?: SleepData;
  diaperData?: DiaperData;
  temperatureData?: TemperatureData;
  growthData?: GrowthData;
}

// 喂养数据
interface FeedingData {
  feedingType: FeedingType;
  amount: number | null;        // ml
  duration: number | null;      // 秒
  breastSide: BreastSide | null;
}

// 睡眠数据
interface SleepData {
  sleepType: SleepType;
  duration: number;             // 秒，>=0 整数（进行中睡眠创建时 duration=0 占位，end 时再写真实秒数）
  location: string | null;
}

// 排便数据
interface DiaperData {
  diaperType: DiaperType;
  consistency: Consistency | null;
  color: DiaperColor | null;
}

// 体温数据
interface TemperatureData {
  temperature: number;          // °C
  method: TempMethod | null;
}

// 生长数据
interface GrowthData {
  height: number | null;           // cm
  weight: number | null;           // kg
  headCircumference: number | null; // cm
}
```

### 11.6 疫苗/里程碑相关

```typescript
interface VaccineRecord {
  id: string;
  babyId: string;
  familyId: string;
  name: string;
  dose: string;
  vaccinatedDate: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

interface MilestoneRecord {
  id: string;
  babyId: string;
  familyId: string;
  name: string;            // 标准里程碑名称；与 babyId 在 DB 上是复合 unique
  category: string;        // 类别 key：motor / fine_motor / language / social / cognitive
  achievedDate: string;    // 打卡时默认为 now，可通过 PATCH 修改
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;       // PATCH 时更新；POST 幂等 upsert 不会变更已有记录
}
```

### 11.7 趋势相关

```typescript
interface TrendDataPoint {
  date: string;
  value: number;
  whoP3?: number;
  whoP15?: number;
  whoP50?: number;
  whoP85?: number;
  whoP97?: number;
}

interface TrendData {
  type: TrendType;
  points: TrendDataPoint[];
}
```

### 11.8 AI 相关

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DailyInsight {
  summary: string;
  suggestions: string[];
  alerts: string[];
}
```

### 11.9 今日统计

```typescript
interface TodayStats {
  feeding: {
    count: number;
    totalAmount: number;
    lastTime: string | null;
  };
  sleep: {
    count: number;
    totalDuration: number;
    lastTime: string | null;
  };
  diaper: {
    count: number;
    peeCount: number;
    poopCount: number;
    lastTime: string | null;
  };
  temperature: {
    count: number;
    lastValue: number | null;
    lastTime: string | null;
  };
}
```

### 11.10 权限枚举

```typescript
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
```

---

## 附录 A：小程序服务到 Web API 映射表

| 小程序服务方法 | Web API | 主要差异 |
|--------------|---------|---------|
| `AuthService` 微信登录 | `POST /api/auth/login` | 邮箱/手机号+密码 替代 微信静默登录 |
| `AuthService` 新用户注册 | `POST /api/auth/register` | 新增注册流程 |
| `RecordService.createRecord(data)` | `POST /api/records` | 请求体结构化，data 不再嵌套 |
| `RecordService.getRecords(babyId, options)` | `GET /api/records?babyId=...` | skip/limit → page/pageSize |
| `RecordService.updateRecord(recordId, data)` | `PATCH /api/records/:id` | RESTful 风格 |
| `RecordService.deleteRecord(recordId)` | `DELETE /api/records/:id` | RESTful 风格 |
| `RecordService.getTodayStats(babyId)` | `GET /api/records/today-stats?babyId=...` | 独立端点 |
| `FamilyService.createFamily(options)` | `POST /api/families` | 结构一致 |
| `FamilyService.joinByInviteCode(code, info)` | `POST /api/families/join` | 结构一致 |
| `FamilyService.leaveFamily(familyId, userId)` | `POST /api/families/:id/leave` | 状态机响应结构保留 |
| `FamilyService.dissolveFamily(familyId, userId)` | `DELETE /api/families/:id` | RESTful 风格 |
| `FamilyService.refreshInviteCode(familyId, userId)` | `POST /api/families/:id/refresh-invite` | RESTful 风格 |
| `FamilyService.updateMemberRole(...)` | `PATCH /api/families/:id/members/:userId/role` | RESTful 风格 |
| `FamilyService.removeMember(...)` | `DELETE /api/families/:id/members/:userId` | RESTful 风格 |
| `FamilyService.transferAdmin(...)` | `POST /api/families/:id/transfer-admin` | RESTful 风格 |
| `BabyService.createBaby(...)` | `POST /api/babies` | 结构一致 |
| `BabyService.getBabiesByFamilyId(familyId)` | `GET /api/babies?familyId=...` | RESTful 风格 |
| `BabyService.getBabyById(babyId)` | `GET /api/babies/:id` | RESTful 风格 |
| `BabyService.updateBaby(babyId, data)` | `PATCH /api/babies/:id` | RESTful 风格 |
| `BabyService.deleteBaby(babyId, familyId)` | `DELETE /api/babies/:id` | 断点续传逻辑保留 |
| `BabyService.uploadAvatar(babyId, filePath)` | `POST /api/babies/:id/avatar` | multipart 上传 |
| `TodoService.getTodoStats(baby)` | `GET /api/babies/:id/vaccine-stats` + `GET /api/babies/:id/vaccines` | 拆分为疫苗和里程碑 |
| `TrendService.getTrendDataForPeriod(babyId, period)` | `GET /api/babies/:id/trends` | query 参数化 |
| `AIService.generateText/streamText(...)` | `POST /api/ai/chat` | SSE 流式支持 |
| `AIService.generateFeedingAdvice/generateSleepAdvice` | `POST /api/ai/daily-insight` | 合并为每日洞察 |
| `QuotaService` | `GET /api/ai/quota` | 服务端管理配额 |
| `ShareCanvasService` + `ReportDataHelper` | `GET /api/export` | 数据导出 |
| `SyncService` | — | Web 版使用 React Query + IndexedDB 自动同步 |
| `PermissionGuard` | 后端中间件 | 权限校验移至后端 |
| `FamilyContext` | React Context + Zustand | 前端状态管理 |

## 附录 C：成长报告聚合方案（v5.0.0+）

成长报告（`/report`）**不新增后端接口**，前端在 `client/src/hooks/use-report-data.ts` 中组合以下既有端点聚合出 `ReportData`：

| 数据 | 端点 | 备注 |
|------|------|------|
| 本期所有记录（聚合关键指标 / 每日节律 / 生长快照） | `GET /records?babyId&startDate&endDate&pageSize=500` | 周报最多 7 天、月报最多 31 天，500 条足够覆盖；若未来出现超限需求再加分页轮询 |
| 本期新达成的里程碑 | `GET /babies/:id/milestones?pageSize=200` | 后端无 `startDate` 参数，前端按 `achievedDate` 过滤 |
| 本期已接种的疫苗 | `GET /babies/:id/vaccines?pageSize=200` | 后端无 `startDate` 参数，前端按 `vaccinatedDate` 过滤 |
| 上周 vs 本周对比（仅周报） | `GET /babies/:id/trend/weekly` | 复用 §8.2；月报模式不请求 |
| AI 总结（可选，用户点按触发） | `POST /api/ai/chat`（消耗 AI 配额） | 前端用 `buildReportPrompt` 拼一段结构化的"本期数据 + 回答格式"提示；失败降级为 `autoPrompt` 跳 `/ai-assistant` |

时间窗（前端计算）：

| 周期 | 起始 | 终止 |
|------|------|------|
| `week` | 本周一 00:00（本地时区），向后裁剪至 `baby.birthDate` 当日 00:00 | 今天 23:59:59 |
| `month` | 本月 1 号 00:00，向后裁剪至 `baby.birthDate` 当日 00:00 | 今天 23:59:59 |

> **为什么不做后端聚合接口**：
> 1. 记录量可控（<500 条/月），前端聚合延迟 < 300ms；
> 2. 任何新增维度（如将来加辅食 / 用药）只要记录进 `records` 表就自动进入报告，无需同步改接口；
> 3. 避免"每加一种报告维度就加一个 `GET /api/reports/xxx` 端点"的长期维护负担。

---

## 附录 B：请求/响应示例

### B.1 注册示例

```http
POST /api/auth/register HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MyP@ss123",
  "nickname": "小明妈妈"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Set-Cookie: refreshToken=xxx; Path=/api/auth/refresh; HttpOnly; SameSite=Strict; Max-Age=604800

{
  "success": true,
  "data": {
    "user": {
      "id": "clx123abc",
      "email": "user@example.com",
      "phone": null,
      "nickname": "小明妈妈",
      "avatar": null,
      "familyId": null,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### B.2 创建喂养记录示例

```http
POST /api/records HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "babyId": "clxbaby001",
  "recordType": "feeding",
  "startTime": "2026-04-30T08:30:00.000Z",
  "note": "早餐奶",
  "feedingData": {
    "feedingType": "formula",
    "amount": 120,
    "duration": null,
    "breastSide": null
  }
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "record": {
      "id": "clxrec001",
      "babyId": "clxbaby001",
      "familyId": "clxfam001",
      "recordType": "feeding",
      "startTime": "2026-04-30T08:30:00.000Z",
      "endTime": null,
      "note": "早餐奶",
      "createdBy": "clx123abc",
      "creator": {
        "id": "clx123abc",
        "nickname": "小明妈妈",
        "avatar": null
      },
      "createdAt": "2026-04-30T08:35:00.000Z",
      "updatedAt": "2026-04-30T08:35:00.000Z",
      "feedingData": {
        "feedingType": "formula",
        "amount": 120,
        "duration": null,
        "breastSide": null
      }
    }
  }
}
```

### B.3 退出家庭状态机示例

```http
POST /api/families/clxfam001/leave HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**情况 A：普通成员退出**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "已退出家庭"
  }
}
```

**情况 B：唯一管理员需转让**

```json
{
  "success": true,
  "data": {
    "status": "need_transfer",
    "message": "您是唯一管理员，请先转让管理权限",
    "otherMembers": [
      { "id": "clxuser002", "nickname": "小明爸爸", "avatar": null },
      { "id": "clxuser003", "nickname": "奶奶", "avatar": null }
    ]
  }
}
```

**情况 C：退出后家庭自动解散**

```json
{
  "success": true,
  "data": {
    "status": "dissolved",
    "message": "家庭已解散"
  }
}
```

---

*文档维护：接口变更时同步更新此文档。*
