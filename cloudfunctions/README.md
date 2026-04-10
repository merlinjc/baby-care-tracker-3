# Baby Care Tracker — 云函数端

> 云函数后端服务，极简设计，仅包含 1 个云函数，用于安全获取微信用户身份标识。

---

## 1. 应用概述

| 属性 | 值 |
|------|-----|
| **应用类型** | CloudBase 云函数（Node.js） |
| **运行环境** | CloudBase 云开发环境 `neo3-7gtg0bdtc9fcc672` |
| **云函数数量** | 1 个 |
| **依赖** | `wx-server-sdk` (latest) |
| **部署方式** | 微信开发者工具上传部署 |

### 设计理念

本项目采用 **"前端直连数据库"** 的云开发模式：

- 小程序端通过 CloudBase SDK **直接操作 NoSQL 数据库**
- 数据安全通过 **CloudBase 安全规则**（基于 `_openid` 隔离）保障
- 云函数**仅用于获取 openid**（微信安全策略要求 openid 必须通过服务端获取）

这种架构极大简化了后端复杂度，无需维护复杂的 API 层。

---

## 2. 目录结构

```
cloudfunctions/
└── getOpenId/
    ├── index.js          # 云函数入口（13 行代码）
    └── package.json      # 依赖配置
```

---

## 3. 接口列表

### 3.1 getOpenId

获取当前微信用户的 openid、appid 和 unionid。

| 属性 | 值 |
|------|-----|
| **函数名** | `getOpenId` |
| **触发方式** | `wx.cloud.callFunction({ name: 'getOpenId' })` |
| **运行时** | Node.js |
| **超时时间** | 默认 3 秒 |
| **入参** | 无需额外参数 |

#### 请求方式

```javascript
// 小程序端调用
const res = await wx.cloud.callFunction({
  name: 'getOpenId'
});
```

#### 返回结构

```javascript
{
  openid: "oXXXXXXXXXXXXXXXXXXXXXXXXXXXX",   // 用户唯一标识
  appid: "wx1f1bc8e6ff2be61d",                  // 小程序 AppID
  unionid: "oYYYYYYYYYYYYYYYYYYYYYYYYYYYY"     // 开放平台 UnionID（可能为空）
}
```

#### 返回字段说明

| 字段 | 类型 | 必有 | 说明 |
|------|------|:----:|------|
| `openid` | string | ✅ | 用户在当前小程序的唯一标识 |
| `appid` | string | ✅ | 当前小程序的 AppID |
| `unionid` | string | ❌ | 用户在开放平台的统一标识（需绑定开放平台） |

#### 源码

```javascript
const cloud = require('wx-server-sdk');

cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};
```

---

## 4. 业务流程图

```
小程序端                                    云函数端
   │                                          │
   ├─► wx.cloud.callFunction({               │
   │     name: 'getOpenId'                    │
   │   })                                     │
   │          ───────────────────────►        │
   │                                          ├─► cloud.getWXContext()
   │                                          │   （微信框架注入用户上下文）
   │                                          │
   │                                          ├─► 提取 OPENID / APPID / UNIONID
   │                                          │
   │          ◄───────────────────────        ├─► 返回结果
   │                                          │
   ├─► 使用 openid 作为用户标识               │
   │   ├─ 查询/创建 users 集合记录            │
   │   └─ 作为数据安全隔离依据                │
   │                                          │
   └─► 后续所有数据操作直接操作数据库          │
       （通过 CloudBase 安全规则保障）          │
```

### 调用时机

本云函数被 `AuthService.getOpenId()` 调用，但在当前版本中，`AuthService.getUserInfo()` 使用的是更简洁的方案：

1. 直接查询 `users` 集合（安全规则会自动按 `_openid` 过滤）
2. 如果没有记录，直接创建（系统自动添加 `_openid` 字段）

因此 `getOpenId` 云函数主要作为**备用方案**和**兼容接口**保留，也供未来需要显式获取 openid 的场景使用。

---

## 5. 依赖关系

```
getOpenId (云函数)
    │
    ├─► wx-server-sdk (latest)
    │   └── 微信云开发服务端 SDK
    │       ├── cloud.init()         → 初始化云环境
    │       └── cloud.getWXContext() → 获取微信调用上下文
    │
    └─► 被小程序端调用
        └── AuthService.getOpenId()
```

### 外部依赖

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| `wx-server-sdk` | latest | 微信云开发服务端 SDK，提供 `getWXContext()` 等能力 |

---

## 6. 配置说明

### 6.1 package.json

```json
{
  "name": "getOpenId",
  "version": "1.0.0",
  "description": "获取用户openid的云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

### 6.2 部署配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 云函数根目录 | `cloudfunctions/` | 在 `project.config.json` 中配置 |
| 环境 ID | `neo3-7gtg0bdtc9fcc672` | CloudBase 环境 |
| 运行时 | Node.js | 默认运行时 |
| 超时时间 | 3 秒 | 默认超时 |
| 内存 | 256MB | 默认配置 |

### 6.3 部署步骤

1. 在微信开发者工具中，展开 `cloudfunctions/` 目录
2. 右键点击 `getOpenId` 文件夹
3. 选择"上传并部署：云端安装依赖"
4. 等待部署完成

> ⚠️ **注意**：选择"云端安装依赖"而非"所有文件"，避免上传本地 node_modules。

---

## 7. 安全说明

- 云函数通过微信框架的 `getWXContext()` 获取 openid，**无法伪造**
- openid 是用户在当前小程序的唯一标识，不同小程序获取到的 openid 不同
- 项目的数据安全主要依赖 **CloudBase 安全规则**，而非云函数鉴权
- 所有数据库集合均配置了基于 `_openid` 的安全规则，确保用户只能访问自己的数据

---

## 8. 扩展说明

当前仅有 1 个云函数，未来可能扩展的场景：

| 场景 | 说明 | 优先级 |
|------|------|--------|
| 定时清理过期数据 | 定时触发器清理过期的 AI 缓存、临时文件 | 低 |
| 推送通知 | 向家庭成员推送疫苗提醒、喂养提醒 | 中 |
| 数据导出 | 服务端生成 Excel/PDF 报告 | 中 |
| 数据迁移 | 批量数据格式升级脚本 | 按需 |
