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

更新当前用户信息。

**请求体**：

```typescript
interface UpdateProfileRequest {
  nickname?: string;   // 昵称，1-20 字符
  avatar?: string;     // 头像 URL
}
```

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
| 422 | `VALIDATION_ERROR` | 字段校验失败 |

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

### 7.1 GET /api/babies/:id/milestones

获取宝宝里程碑列表。

**对应小程序**：`TodoService.getTodoStats(baby)` 中的里程碑部分

**查询参数**：

```typescript
interface GetMilestonesQuery extends PaginationParams {
  category?: string;    // 可选，分类筛选（大运动/精细动作/语言/社交）
  status?: 'pending' | 'achieved';  // 可选，按状态筛选
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

记录里程碑达成。

**对应小程序**：TodoService 中里程碑记录创建

**请求体**：

```typescript
interface CreateMilestoneRequest {
  name: string;               // 必填，里程碑名称
  category: string;           // 必填，分类（大运动/精细动作/语言/社交）
  achievedDate: string;       // 必填，达成日期（ISO 8601）
  note?: string;              // 可选，备注
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
}
```

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
  name: string;
  category: string;
  achievedDate: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
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
