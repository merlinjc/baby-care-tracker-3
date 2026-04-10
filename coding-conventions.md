# Baby Care Tracker 开发规范

> **版本**: v3.1 | **更新日期**: 2026-04-08

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

*文档维护：新增代码模式或规范时同步更新此文档。*
