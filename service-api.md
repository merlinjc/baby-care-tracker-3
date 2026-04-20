# Baby Care Tracker 服务层 API 文档

> **版本**: v4.3.0 | **更新日期**: 2026-04-20

---

## 服务总览

所有服务均采用**单例模式**，通过 `XxxService.getInstance()` 获取实例（闭包单例，`new` 与 `getInstance()` 行为等价，规范约定使用 `getInstance()`）。

| 服务 | 文件大小 | 操作集合 | 缓存 | 走云函数 |
|------|---------|---------|------|---------|
| RecordService | 28KB | records | 15s 内存缓存 | N（直连，CRUD 受 `doc._openid` 规则保护） |
| FamilyService | 17KB | families, users | 无 | **Y（10/13 方法经 `familyOperation`）** |
| BabyService | 6KB | babies, families | 无 | **Y（createBaby / deleteBaby）** |
| AuthService | 2.5KB | users | 无 | N（`users` ACL=PRIVATE，注入 `_openid`） |
| SyncService | 9.4KB | records, families | 无 | N（仅同步离线队列） |
| TodoService | 10KB | vaccine_records, milestone_records | 30s 内存缓存 | N |
| TrendService | 21KB | 通过 RecordService | 30s 内存缓存 | N |
| AIService | 5KB | 无 | 无 | N（wx.cloud.extend.AI 调用混元） |
| QuotaService | 2.6KB | 无(localStorage) | 按日重置 | N |
| ReportDataHelper | 15KB | 无（纯计算） | 无 | N |
| ShareCanvasService | 44KB | 无（Canvas 绘制） | 图片缓存 | N |
| **PermissionGuard** (v4.3) | 3KB | 无 | 无 | N（纯校验器） |

**v4.3 新增工具**（非 Service，但跨模块复用）：

| 模块 | 文件 | 定位 | 关键 API |
|------|------|------|---------|
| FamilyContext | `utils/family-context.js` | familyId 单一来源（纯静态方法类） | `resolve()` / `resolveForBaby(baby)` / `getUserId()` / `getCurrentRole()` / `getCurrentBabyId()` / `getFamily()` / `getCurrentMemberDetail()` |
| PermissionGuard | `services/permission-guard.js` | 服务层权限前置预检 | `require(permission)` / `requireCanDelete(record)` / `check(permission)` / `checkCanDelete(record)`；抛出 `PermissionError`（code=`PERMISSION_DENIED`） |

**方法标签约定**：
- `[cloud]` — 走 `familyOperation` 云函数（跨用户写操作）
- `[direct]` — 客户端直连数据库（读操作 / 自有写操作）

---

## RecordService（核心）

### 关键方法

| 方法 | 返回 | 说明 |
|------|------|------|
| `createRecord(data)` | `Promise<Record>` | 云端优先创建，离线降级 |
| `getRecords(babyId, options)` | `Promise<Array>` | 云端优先查询，支持筛选/分页 |
| `updateRecord(recordId, data)` | `Promise<void>` | 更新记录 |
| `deleteRecord(recordId)` | `Promise<void>` | 删除记录 |
| `getTodayStats(babyId)` | `Promise<Object>` | 今日统计（15s 缓存） |
| `static normalizeCreatedBy(record)` | `Object` | 归一化创建者信息 |

### getRecords 查询选项

```javascript
{
  recordType?: string,        // 类型筛选
  startDate?: Date|number,    // 开始日期
  endDate?: Date|number,      // 结束日期
  dateRange?: { start, end }, // 时间戳范围（优先）
  limit?: number,             // 默认 20
  skip?: number,              // 默认 0
  orderBy?: string,           // 默认 'startTime'
  order?: string              // 默认 'desc'
}
```

---

## FamilyService

v4.2 起，跨用户写操作统一经 `familyOperation` 云函数。客户端方法签名保持不变（适配器模式），内部切换为 `callFunction`。

### 方法表

| 方法 | 路径 | 返回 | 说明 |
|------|-----|------|------|
| `createFamily(options)` | `[cloud]` | `Promise<Family>` | 云函数 `createFamily` action，自动生成 6 位邀请码 + 初始化 `memberOpenids` |
| `joinByInviteCode(code, memberInfo)` | `[cloud]` | `Promise<Object>` | 云函数 `joinFamily` action，含 60s 内最多 5 次限流 + 唯一管理员校验 |
| `joinFamily(code, userId)` | `[cloud]` | `Promise<Object>` | 兼容旧方法，内部转调 `joinByInviteCode` |
| `getFamilyByUserId(userId)` | `[cloud]` | `Promise<Family\|null>` | 云函数 `getFamilyByUserId`（openid 自动识别，userId 参数已忽略） |
| `getFamilyDetail(familyId)` | `[direct]` | `Promise<Family\|null>` | 客户端直连；不存在或权限拒绝时返回 `null`（不抛错） |
| `getFamilyMembers(familyId)` | `[direct]` | `Promise<Array>` | 内部调 `getFamilyDetail`，优先读 `memberDetails` |
| `checkMembership(userId, familyId)` | `[direct]` | `Promise<Object>` | 内部调 `getFamilyDetail` 判定成员身份 |
| `refreshInviteCode(familyId, userId)` | `[cloud]` | `Promise<string>` | 云函数 `refreshInviteCode` action，仅 admin 可调用 |
| `removeMember(familyId, userId, targetId)` | `[cloud]` | `Promise<void>` | 云函数 `removeMember` action |
| `leaveFamily(familyId, userId)` | `[cloud]` ⚠️ | `Promise<Object>` | **特殊契约**，详见下方 |
| `transferAdmin(familyId, currentId, newId)` | `[cloud]` | `Promise<Object>` | 云函数 `transferAdmin` action |
| `updateMemberRole(familyId, userId, targetId, role)` | `[cloud]` | `Promise<void>` | 云函数 `updateMemberRole` action（含乐观锁重试 2 次） |
| `dissolveFamily(familyId, userId)` | `[cloud]` | `Promise<void>` | 云函数 `dissolveFamily` action，批量清除所有成员 familyId |
| `validateInviteCode(inviteCode)` | `[cloud]` | `Promise<Object>` | 云函数 `validateInviteCode` action |

### `_callFamilyOperation` 私有适配器

所有 `[cloud]` 方法（除 `leaveFamily` 特殊契约外）经此方法封装：

```javascript
async _callFamilyOperation(action, params = {}) {
  const res = await wx.cloud.callFunction({
    name: 'familyOperation',
    data: { action, params }
  });
  const result = res.result;  // 云函数返回 { success, data?, error? }
  if (!result.success) {
    throw new Error(result.error?.message || `${action} 失败`);
  }
  return result.data;  // 成功时直接返回业务数据
}
```

**云函数返回值契约**：`{ success: boolean, data?: any, error?: { code: string, message: string } }`
- `success=true` 时 `data` 为业务数据
- `success=false` 时 `error.code` 为业务错误码（如 `USER_NOT_FOUND` / `FAMILY_NOT_FOUND` / `PERMISSION_DENIED` / `RATE_LIMITED` / `INVALID_CODE` / `CODE_EXPIRED` / `ALREADY_MEMBER` / `SOLE_ADMIN` / `INTERNAL_ERROR`），`error.message` 为中文提示

### ⚠️ `leaveFamily` 契约（v4.3 升级为状态机）

**v4.3 起**统一通过 `_callFamilyOperation` 适配器调用，返回值包含 `data.status` 状态机字段：

```javascript
// 云函数 action 返回：
{ success: true, data: { status: 'ok', message: '已退出家庭' } }
{ success: true, data: { status: 'dissolved', message: '家庭已解散' } }
{ success: true, data: { status: 'family_not_found', message: '家庭不存在' } }   // 幂等
{ success: true, data: { status: 'not_member', message: '您本就不是家庭成员' } }    // 幂等
{ success: true, data: { status: 'need_transfer', otherMembers: [...] } }     // ★ 唯一管理员需转让
```

客户端 `FamilyService.leaveFamily` 适配为：

```javascript
{
  success: boolean,           // false 仅当 status='need_transfer'
  status: 'ok' | 'dissolved' | 'need_transfer' | 'family_not_found' | 'not_member',
  otherMembers: Array,        // need_transfer 时非空
  message: string,
  // 以下 legacy 字段供旧调用方过渡，新代码请使用 status 分支
  needTransfer: boolean,
  familyNotFound: boolean,
  notMember: boolean,
  familyDissolved: boolean
}
```

**推荐用法**：

```javascript
const result = await familyService.leaveFamily(familyId, userId);
switch (result.status) {
  case 'ok':
  case 'dissolved':
  case 'family_not_found':
  case 'not_member':
    // 清理本地，跳转首页
    break;
  case 'need_transfer':
    // 弹窗让用户选择 otherMembers 中的成员进行转让
    break;
}
```

---

## BabyService

v4.2 起，`createBaby` / `deleteBaby` 涉及 `families.babies` 数组的跨用户写操作，迁移到云函数。

### 方法表

| 方法 | 路径 | 返回 | 说明 |
|------|-----|------|------|
| `createBaby(familyId, name, gender, birthDate, avatar)` | `[cloud]` | `Promise<Baby>` | 云函数 `createBaby` action；校验操作者是家庭成员；admin SDK 写 `families.babies` |
| `deleteBaby(babyId, familyId)` | `[cloud]` | `Promise<Object>` | 云函数 `deleteBaby` action；admin SDK pull `families.babies` + 删除 babies 文档 |
| `getBabiesByFamilyId(familyId)` | `[direct]` | `Promise<Array>` | 直连，安全规则 `get()` 校验通过；双路径（where babyId + families.babies 批量 in） |
| `getBabyById(babyId)` | `[direct]` | `Promise<Baby>` | 直连；doc 级查询，安全规则对 families 交叉校验 |
| `updateBaby(babyId, data)` | `[direct]` | `Promise<void>` | 直连；受 `doc._openid == auth.openid` 保护（仅创建者可改） |
| `uploadAvatar(babyId, filePath)` | `[direct]` | `Promise<string>` | 上传云存储 + 调 `updateBaby` 更新 avatar 字段 |
| `calculateAgeInMonths(birthDate)` | `[direct]` | `number` | 纯计算 |
| `calculateAgeInDays(birthDate)` | `[direct]` | `number` | 纯计算 |
| `formatAge(birthDate)` | `[direct]` | `string` | 纯计算 |

---

## App 全局方法（v4.1 新增）

| 方法 | 返回 | 说明 |
|------|------|------|
| `ensureUserReady()` | `Promise<{ ready, userInfo, familyInfo, redirectUrl, reason }>` | 统一用户就绪检查（含 5 分钟缓存穿透） |
| `checkFamilyStale()` | `boolean` | 轻量 onShow 校验（纯本地时间戳比较，不发网络请求） |

**ensureUserReady 返回 reason 枚举**：
- `'family_dissolved'` — 家庭已被解散
- `'removed'` — 用户已被移出家庭
- `'network_error'` — 网络失败且无本地缓存

---

## TodoService

| 方法 | 返回 | 说明 |
|------|------|------|
| `getTodoStats(baby)` | `Promise<Object>` | 待办统计（30s 缓存） |
| `forceRefresh(baby)` | `Promise<Object>` | 强制刷新 |
| `clearCache()` | `void` | 清除缓存 |

**返回结构**:
```javascript
{
  total: number,          // 总待办数
  vaccine: number,        // 疫苗待接种
  milestone: number,      // 里程碑待达成
  overdue: number,        // 逾期数
  vaccineItems: Array,    // 疫苗详情列表
  milestoneItems: Array   // 里程碑详情列表
}
```

---

## TrendService

| 方法 | 返回 | 说明 |
|------|------|------|
| `getTrendData(babyId)` | `Promise<Object>` | 本周趋势（30s 缓存） |
| `getTrendDataForPeriod(babyId, period)` | `Promise<Object>` | 按周期趋势 |
| `static getReferenceRange(dimension, ageMonths)` | `Object\|null` | 月龄参考范围 |
| `static calculateStatus(value, range, dimension, extra)` | `string` | 计算趋势状态 |
| `static calculateRangeBarPosition(value, range)` | `Object` | 范围条定位 |
| `static generateTip(dimension, status)` | `string` | 智能提示语 |

---

## AIService

| 方法 | 返回 | 说明 |
|------|------|------|
| `generateText(prompt, context)` | `Promise<string>` | 非流式文本生成 |
| `streamText(prompt, context, callbacks)` | `Promise<void>` | 流式文本生成 |
| `generateFeedingAdvice(age, records, baby)` | `Promise<string>` | 喂养建议 |
| `generateSleepAdvice(age, records, baby)` | `Promise<string>` | 睡眠建议 |

**模型**: `hunyuan-2.0-instruct-20251111`（通过 `wx.cloud.extend.AI`）

---

## 工具类 API

### StorageUtil（静态方法）

`set(key, data)` / `get(key)` / `remove(key)` / `clear()`
`saveUserInfo()` / `getUserInfo()` / `saveCurrentBaby()` / `getCurrentBaby()`
`saveFamilyInfo()` / `getFamilyInfo()`
`addToOfflineQueue(operation)` / `getOfflineQueue()` / `clearOfflineQueue()`

### PermissionUtil（静态方法）

`checkPermission(userId, family, permission)` / `getUserRole(userId, family)`
`isAdmin(userId, family)` / `canEdit(userId, family)` / `canDeleteRecord(userId, family, record)`
`hasOtherAdmin(family, excludeUserId)`

### date.js（纯函数）

`parseDate()` / `formatDate()` / `calculateAgeInDays()` / `calculateAgeMonths()`
`formatAge()` / `formatDuration()` / `formatDurationChinese()` / `parseTimestamp()`

### debounce.js

`debounce(fn, ms)` — 返回带 `.cancel()` 的防抖函数
`throttle(fn, ms)` — 返回带 `.cancel()` 和 `.force()` 的节流函数

### batch.js

`batchExecute(items, fn, concurrency=10)` — 分批并发执行

### db-helper.js

`fetchAll(query, pageSize=100)` — 分页获取全量数据

---

*文档维护：新增服务方法或修改接口时同步更新此文档。*

---

## ThemeManager（主题管理器）

**文件**: `utils/theme.js` | **模式**: 单例模块

管理暗色/亮色主题切换，提供 CSS 变量覆盖 + JS 颜色查询的双通道方案。

### 常量

| 常量 | 值 | 说明 |
|------|---|------|
| `THEME_LIGHT` | `'light'` | 亮色模式 |
| `THEME_DARK` | `'dark'` | 暖夜模式 |
| `THEME_SYSTEM` | `'system'` | 跟随系统 |

### API

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `init()` | - | `void` | 在 `app.onLaunch` 中调用，读取持久化偏好 |
| `getTheme()` | - | `'light'\|'dark'\|'system'` | 获取当前主题设置值 |
| `isDark()` | - | `boolean` | 当前是否为暗色模式 |
| `setTheme(theme)` | `'light'\|'dark'\|'system'` | `void` | 设置主题并广播 |
| `getColor(key)` | `string` | `string` | 获取 JS 颜色值 |
| `getConfirmColor(type)` | `'danger'\|'warn'\|'neutral'` | `string` | 获取 wx.showModal 确认按钮颜色 |
| `getDarkModeData()` | - | `{darkMode: boolean}` | 获取页面 setData 用的暗色布尔值 |
| `onThemeChange(fn)` | `(isDark) => void` | `() => void` | 注册监听，返回取消函数 |

### 页面接入模式

```javascript
const ThemeManager = require('../../utils/theme');
Page({
  data: { darkMode: false },
  onShow() { this._applyTheme(); },
  onUnload() { if (this._themeOff) this._themeOff(); },
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
});
```

### 存储

- Key: `app_theme_mode`
- 值: `'light'` | `'dark'` | `'system'`
