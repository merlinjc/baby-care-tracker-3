# Baby Care Tracker 开发规范

> **版本**: v4.3.1 | **更新日期**: 2026-04-20

---

## 1. 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 页面文件/目录 | kebab-case | `baby-create/`, `family-join/` |
| 组件文件/目录 | kebab-case | `feeding-popup/`, `easter-egg-toast/` |
| JS 类名 | PascalCase | `RecordService`, `DeduplicationUtil` |
| 方法名 | camelCase | `getTodayStats`, `computeGreeting` |
| 私有方法 | `_` 前缀 | `_computeVaccineStats`, `_clearUserFamilyInfo` |
| 缓存键 | snake_case | `records_{babyId}`, `ai_insight_{babyId}_{date}` |
| CSS 类名 | kebab-case | `.popup-mask`, `.stat-item`, `.action-btn` |
| CSS 变量 | `--` 前缀 kebab-case | `--primary-color`, `--feeding-color` |
| Bug 标记 | `BUG-{number}` | `// BUG-11: currentBaby 可能为 null` |
| Feature 标记 | `FR-{number}` | `// FR-8: 喂养预测` |

---

## 2. 架构模式

### 2.1 服务层单例模式

所有服务类统一使用闭包单例：

```javascript
let instance = null;

class XxxService {
  constructor() {
    if (instance) return instance;
    // ... 初始化
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new XxxService();
    return instance;
  }
}
```

### 2.2 页面初始化模式

所有页面需等待 `app.initUser()` 完成：

```javascript
async init() {
  const app = getApp();
  if (app.globalData.initPromise) {
    await app.globalData.initPromise;
  }
  // ... 后续逻辑
}
```

### 2.3 TabBar 页面 30s 节流

```javascript
onShow() {
  const now = Date.now();
  if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
  this._lastLoadTime = now;
  this.loadData();
}
```

### 2.4 弹窗组件模式

所有弹窗组件共享 `swipe-close` Behavior：
- 引入：`behaviors: [require('../../behaviors/swipe-close')]`
- WXML 绑定：`catchtouchstart="onTouchStart" catchtouchmove="onTouchMove" catchtouchend="onTouchEnd"`
- 组件需实现 `close()` 方法

弹窗统一结构：
1. 遮罩层（fixed, z-index: 1000+）
2. 下滑指示条 `.swipe-indicator`
3. 标题栏 `.popup-header`
4. 可滚动内容 `.popup-content`
5. 底部按钮 `.popup-footer`（含安全区适配）

### 2.5 乐观锁重试模式（v4.1 新增）

并发写入冲突时，通过 `stats.updated === 0` 检测并重试：

```javascript
async updateXxx(id, data, _retryCount = 0) {
  const result = await collection.doc(id).update({ data });
  if (result.stats && result.stats.updated === 0 && _retryCount < 2) {
    return this.updateXxx(id, data, _retryCount + 1);
  }
}
```

### 2.6 页面登录守卫模式（v4.1 新增）

所有页面 `onLoad` 头部统一调用 `ensureUserReady()`：

```javascript
async init() {
  const app = getApp();
  const check = await app.ensureUserReady();
  if (!check.ready) {
    wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
    return;
  }
  // ... 后续逻辑使用 check.userInfo / check.familyInfo
}
```

---

## 3. 数据处理约定

### 3.1 双时间戳写入

创建记录时必须同时写入 Date 和数值时间戳：

```javascript
const cloudRecord = {
  startTime: this.db.serverDate(),      // 服务器时间
  startTimeTs: Date.now(),              // 数值时间戳
  createdAt: this.db.serverDate(),
  createdAtTs: Date.now(),
};
```

### 3.2 创建者信息双格式

```javascript
// 新对象格式
createdBy: { userId, nickName, avatar },
// 旧扁平格式（兼容）
creatorId: userId,
createdByName: nickName,
createdByAvatar: avatar,
```

### 3.3 时间戳解析

统一使用 `utils/date.js#parseTimestamp()` 解析时间，支持 6 种格式：
1. Date 对象
2. `{ $date: milliseconds }`
3. `{ seconds, nanoseconds }`
4. `{ _seconds, _nanoseconds }`
5. 类 Date 对象（含 getTime 方法）
6. 字符串/数字时间戳

### 3.4 统计字段的子集关系（避免重复累加）

当一个统计对象同时暴露"总量"与"子集量"时，合计字段绝不能再把子集量加回去。典型如 `TodoService.getTodoStats` 的返回：

```javascript
{
  vaccine,    // 疫苗总待办（已包含 overdue）
  milestone,  // 里程碑总待办
  overdue,    // vaccine 的逾期子集，仅供展示
  total       // = vaccine + milestone ✅  （不要再 + overdue ❌）
}
```

历史教训：`total` 曾错误地写成 `vaccine + milestone + overdue`，导致首页"查看全部 N 项"把逾期疫苗计数两次（实际 2 项显示为 4 项）。新增类似统计对象时，请在注释中明确写出每个字段是否与其他字段存在子集关系。

---

## 4. 错误处理约定

### 4.1 服务层错误处理

```javascript
// 模式1: 向上抛出（由调用方处理）
async createBaby() {
  try { /* ... */ }
  catch (error) { console.error('xxx失败:', error); throw error; }
}

// 模式2: 静默降级（返回空值）
async getBabiesByFamilyId() {
  try { /* ... */ }
  catch (error) { console.error('xxx失败:', error); return []; }
}

// 模式3: 离线降级（record.js 核心模式）
async createRecord() {
  try {
    if (online) { /* 云端 */ }
    else { /* 离线队列 */ }
  } catch (error) { /* 降级到本地 + 离线队列 */ }
}
```

### 4.2 非致命错误

```javascript
try {
  await this.userCollection.where({...}).update({...});
} catch (userErr) {
  console.warn('xxx失败（非致命）:', userErr);
}
```

---

## 5. 性能规范

| 规范 | 要求 |
|------|------|
| TabBar onShow | 必须 30s 节流 |
| 弹窗触摸 | 必须 16ms 节流 |
| CRUD 操作 | 必须 3s 去重检查 |
| 批量操作 | 必须 `batchExecute` 限流（默认 10 并发） |
| 分页查询 | 使用 `fetchAll()` 突破 20 条限制 |
| setData | 合并多个结果为一次调用 |
| 本地缓存 | 每宝宝最多 200 条记录 |
| 大数据集 | 使用 Set 索引替代 O(n*m) 遍历 |

---

## 6. UI 规范

### 6.1 CSS 变量引用

所有颜色、间距、圆角、阴影必须引用 `app.wxss` 中定义的 CSS 变量，禁止硬编码。

### 6.2 功能色语义

| 功能域 | 变量 | 色值 |
|--------|------|------|
| 喂养 | `--feeding-color` | `#A8D4A8` |
| 睡眠 | `--sleep-color` | `#B8A8D4` |
| 排便 | `--diaper-color` | `#D4C8A8` |
| 体温 | `--temperature-color` | `#D4A8A8` |

### 6.3 间距系统

使用 8rpx 基础网格：`--spacing-xs(8)` / `--spacing-sm(16)` / `--spacing-md(24)` / `--spacing-lg(32)` / `--spacing-xl(48)` / `--spacing-xxl(64)`

### 6.4 图标使用

- 禁止使用 emoji 作为 UI 图标
- 所有图标路径通过 `utils/icon-config.js` 管理
- 使用 `<image>` 标签 + `mode="aspectFit"` + `lazy-load`

### 6.5 主题适配规范

**页面接入模式**（所有新增页面必须遵循）：
1. WXML 根 `<view>` 添加 `class="xxx {{darkMode ? 'dark-mode' : ''}}"`
2. JS 引入 `ThemeManager`，`data` 中声明 `darkMode: false`
3. 在 `onShow` 中调用 `this._applyTheme()`
4. 在 `onUnload` 中调用 `if (this._themeOff) this._themeOff()`
5. 新增 `_applyTheme()` 方法（模板见 `service-api.md`）

**弹窗组件接入模式**：
1. `properties` 中声明 `darkMode: { type: Boolean, value: false }`
2. WXML 根元素添加 `{{darkMode ? 'dark-mode' : ''}}`
3. 宿主页面传入 `dark-mode="{{darkMode}}"`

**颜色使用规范**：
- WXSS 中**禁止硬编码** `#hex` 或 `rgba()`，必须使用 `var(--xxx)` 或 `var(--xxx, fallback)`
- JS 中需要颜色值时，通过 `ThemeManager.getColor(key)` 获取
- `wx.showModal` 的 `confirmColor` 使用 `ThemeManager.getConfirmColor(type)`

---

## 7. 权限体系

三级权限矩阵（`PermissionUtil`）：

| 操作 | Admin | Editor | Viewer |
|------|-------|--------|--------|
| 查看记录 | Yes | Yes | Yes |
| 添加/编辑记录 | Yes | Yes | No |
| 删除自己的记录 | Yes | Yes | No |
| 删除他人记录 | Yes | No | No |
| 邀请码/成员管理 | Yes | No | No |
| 解散家庭 | Yes | No | No |

---

## 8. 数据库操作约束（v4.2+）

v4.2 起引入云函数网关 + 安全规则交叉校验双层防护，客户端与数据库交互需严格遵循以下约定。

### 8.1 三条铁律

| 操作类别 | 实现方式 | 规则原因 |
|---------|---------|---------|
| **读操作** | 服务层直连 `wx.cloud.database()`，**`where` 必须附加 `familyId`** | 安全规则通过 `get('database.families.' + doc.familyId).memberOpenids` 执行交叉校验 |
| **跨用户写** | 必须通过 `familyOperation` 云函数 | families / 他人 babies / 他人 records 的写操作，客户端安全规则全部关闭 |
| **自有写** | 可直连 | `users` 自己的文档（PRIVATE 匹配 `_openid`）、`records` 自己创建的记录（`doc._openid == auth.openid`）受规则保护 |

### 8.2 查询必须附加 familyId

```javascript
// ✅ 正确
const userInfo = StorageUtil.getUserInfo();
db.collection('records').where({
  babyId,
  familyId: userInfo.familyId,  // 必须
  recordType: 'feeding'
}).get();

// ❌ 错误 — 安全规则无法执行 get() 校验，查询被拒绝
db.collection('records').where({ babyId }).get();
```

**涉及需要附 `familyId` 的集合**：`records` / `vaccine_records` / `milestone_records` / `babies`。

### 8.3 调用 familyOperation 云函数

`FamilyService` / `BabyService` 内部统一使用 `_callFamilyOperation` 适配器：

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
  return result.data;
}
```

**可用 action**（共 13 个）：`createFamily` / `joinFamily` / `removeMember` / `dissolveFamily` / `updateMemberRole` / `transferAdmin` / `leaveFamily` / `refreshInviteCode` / `validateInviteCode` / `getFamilyByUserId` / `createBaby` / `deleteBaby` / `clearBabyData`。

**例外**：`leaveFamily` 返回值包含 `data.status` 状态机（`ok` / `dissolved` / `need_transfer` / `family_not_found` / `not_member`），调用方应基于 `status` 分支而非 `success` 判断业务流程。详见 `service-api.md` FamilyService 章节。

### 8.4 云函数结构规范（v4.3+）

`familyOperation` 已完成模块化改造，新增 action 时必须遵循目录结构：

```
cloudfunctions/familyOperation/
├── index.js             # dispatch 入口（禁止写业务逻辑，控制在 < 80 行）
├── errors.js            # 统一错误码注册表（所有错误码集中在此）
├── lib/                 # 公共工具（跨 action 复用）
│   ├── auth.js          # getUserFromOpenid / isAdmin / isMember
│   ├── family.js        # getFamily / clearUserFamily
│   ├── db-helper.js     # getAllDocs / chunkedDelete
│   ├── logger.js        # OperationLogger
│   ├── rate-limit.js    # RateLimiter
│   └── invite-code.js   # 邀请码生成
└── actions/             # 每个 action 一个独立文件
    ├── createFamily.js
    ├── joinFamily.js
    └── ...（共 13 个）
```

**Action 签名约定**：

```javascript
// actions/xxx.js
module.exports = async function (ctx, params) {
  // ctx = { db, _, user, userId, openid, logger, rateLimiter }
  // 写操作必须：1) logger.start(...) 2) 校验权限/参数 3) 执行 4) logger.finish(...) 或 logger.fail(...)
  // 返回约定：{ success, data, error? }（直接 return，index.js 不二次包装）
};
```

**接入检查清单**：
- [ ] 新增 action 是否在 `actions/` 目录独立文件中？
- [ ] 是否在 `index.js` 的 `ACTION_MAP` 中注册？
- [ ] 错误码是否在 `errors.js` 中预先定义？（严禁硬编码字符串）
- [ ] 写操作是否接入 `OperationLogger`？
- [ ] 高频/可被恶意调用的 action 是否使用 `ctx.rateLimiter`？
- [ ] 涉及批量删除的 action 是否使用 `chunkedDelete` + cursor 断点续传？

### 8.5 违规检查清单（Code Review 用）

- [ ] 新增页面/服务对 `records` / `vaccine_records` / `milestone_records` / `babies` 的查询，`where` 是否附加了 `familyId`？
- [ ] 对 `families` / 他人 `babies` / 他人 `records` 的写操作是否经 `familyOperation` 云函数？
- [ ] 新增服务是否使用闭包单例模式？是否 `module.exports = XxxService`（导出类而非实例）？
- [ ] `sync.js` 离线队列 `create` 的 `data` 字段是否包含 `familyId` 与 `createdBy` 对象？
- [ ] 错误处理是否遵循三模式之一（向上抛出 / 静默降级 / 离线降级）？
- [ ] **v4.3**：获取 `familyId` 是否使用 `FamilyContext.resolve()` / `resolveForBaby()`？是否有 `baby.familyId || ''` 或 `userInfo.familyId || ''` 残留？
- [ ] **v4.3**：服务层写方法第一行是否调用 `PermissionGuard.require(...)`？

---

## 9. 权限体系

三级权限矩阵（`PermissionUtil`）已在 §7 中定义。v4.3 新增双重校验机制：

### 9.1 客户端（PermissionGuard）

- **前置预检**：`RecordService.createRecord/updateRecord/deleteRecord` 第一行调用 `PermissionGuard.require(permission)`；Viewer 直接抛 `PermissionError`（code=`PERMISSION_DENIED`），**不发起网络请求**。
- **UI 显隐**：按钮可见性通过 `PermissionGuard.check(permission)` / `checkCanDelete(record)` 非抛错版本控制。
- **归属检查**：删除他人记录的场景使用 `PermissionGuard.requireCanDelete(record)`，内部委托 `PermissionUtil.canDeleteRecord(record, role, userId)`。

### 9.2 服务端（纵深防御）

- **云函数 action 内校验**：`familyOperation` 每个写 action 进入时调用 `isAdmin` / `isMember` 再次校验，不信任客户端。
- **安全规则**：作为最后一道闸，保证即使绕过客户端和云函数（理论上不可能），数据库仍然拒绝非法访问。

### 9.3 检查清单

- [ ] 服务层写方法第一行是否 `PermissionGuard.require(...)`？
- [ ] UI 按钮显隐是否使用 `PermissionGuard.check()` 非抛错版本？
- [ ] 云函数 action 是否再次校验权限（不信任客户端）？
- [ ] 删他人记录的场景是否使用 `PermissionGuard.requireCanDelete(record)`？
- [ ] **v4.3.1**：自定义页面 CRUD（疫苗/里程碑等非 RecordService 路径）是否接入 PermissionGuard？
- [ ] **v4.3.1**：批量删除场景是否按 `checkCanDelete(record)` 预分桶，避免云端失败后缓存闪烁？

### 9.4 默认角色与最小权限原则（v4.3.1+）

`PermissionUtil.getUserRole(userId, family)` 在以下情况返回 `'viewer'`（而非此前的 `'editor'`）：

1. `userId` 或 `family` 为空
2. `family.memberDetails` 中找不到该 `userId` 且 `family.creatorId !== userId`

**为什么默认 viewer 而不是 editor**：

- 用户被踢出家庭后，本地缓存 `familyInfo` 可能在未同步期间仍被读取（5 分钟刷新窗口）；默认 editor 会放行写操作，产生脏写
- viewer 是最小权限，就算 UI 按钮未隐藏，服务层 `PermissionGuard.require('record.create')` 也会抛 `PermissionError`，请求不会发送到云端
- v4.2 数据迁移已补齐全部 `memberDetails`，正常态下这个 fallback 分支不会触发；触发即意味着异常态

**调用方约定**：

- 服务层：依赖 `PermissionGuard.require(...)` 兜底，不要自己判断 role 是否等于 editor
- 页面层：显示"需更多权限"提示时，可根据 `getCurrentRole() === 'viewer'` 给出差异化文案

### 9.5 `family.creatorId` vs `isAdmin` 的选择（v4.3.1+）

云函数 action 中判定"是否可执行管理员操作"，**一律使用 `isAdmin(userId, family)` 工具**（内部兼容 `memberDetails[].role === 'admin'` 与 `creatorId === userId`）：

```javascript
const { isAdmin } = require('../lib/auth');

// ✅ 正确（兼容 transferAdmin 后的新 admin）
if (!isAdmin(userId, family)) {
  return errors.PERMISSION_DENIED('...');
}

// ❌ 错误（transferAdmin 后 creatorId 虽已同步更新，
//       但若未来允许多 admin，此判定会漏放行其他 admin）
if (family.creatorId !== userId) {
  return errors.PERMISSION_DENIED('...');
}
```

---

*文档维护：新增代码模式或规范变更时同步更新此文档。*
