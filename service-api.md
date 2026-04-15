# Baby Care Tracker 服务层 API 文档

> **版本**: v4.1 | **更新日期**: 2026-04-15

---

## 服务总览

所有服务均采用**单例模式**，通过 `XxxService.getInstance()` 或 `new XxxService()` 获取实例。

| 服务 | 文件大小 | 操作集合 | 缓存 |
|------|---------|---------|------|
| RecordService | 28KB | records | 15s 内存缓存 |
| FamilyService | 17KB | families, users | 无 |
| BabyService | 6KB | babies, families | 无 |
| AuthService | 2.5KB | users | 无 |
| SyncService | 9.4KB | records, families | 无 |
| TodoService | 10KB | vaccine_records, milestone_records | 30s 内存缓存 |
| TrendService | 21KB | 通过 RecordService | 30s 内存缓存 |
| AIService | 5KB | 无 | 无 |
| QuotaService | 2.6KB | 无(localStorage) | 按日重置 |
| ReportDataHelper | 15KB | 无（纯计算） | 无 |
| ShareCanvasService | 44KB | 无（Canvas 绘制） | 图片缓存 |

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

| 方法 | 返回 | 说明 |
|------|------|------|
| `createFamily(options)` | `Promise<Family>` | 创建家庭（自动生成邀请码） |
| `joinByInviteCode(code, memberInfo)` | `Promise<Object>` | 通过邀请码加入 |
| `getFamilyByUserId(userId)` | `Promise<Family\|null>` | 通过成员查找家庭 |
| `getFamilyDetail(familyId)` | `Promise<Family\|null>` | 获取家庭详情（不存在返回 null） |
| `refreshInviteCode(familyId, userId)` | `Promise<string>` | 刷新邀请码（仅 admin） |
| `removeMember(familyId, userId, targetId)` | `Promise<void>` | 移除成员（仅 admin） |
| `leaveFamily(familyId, userId)` | `Promise<Object>` | 退出家庭（含管理员转让逻辑） |
| `transferAdmin(familyId, currentId, newId)` | `Promise<Object>` | 转让管理员 |
| `updateMemberRole(...)` | `Promise<void>` | 更新成员权限（v4.1: 乐观锁重试 + users.familyRole 同步） |
| `dissolveFamily(familyId, userId)` | `Promise<void>` | 解散家庭（v4.1: 批量清除所有成员 familyId/familyRole） |

> **v4.1 FamilyService 变更说明**：
> - `joinByInviteCode` 加入前检查旧家庭，唯一管理员抛错，非唯一管理员自动移除
> - `dissolveFamily` 删除文档后逐个清除成员 `users.familyId/familyRole`（失败不阻断）
> - `updateMemberRole` 增加乐观锁重试（`stats.updated === 0` 时最多重试 2 次），完成后同步 `users.familyRole`
> - `_clearUserFamilyInfo` / `removeMember` 修正为 `doc(userId).update()`

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
