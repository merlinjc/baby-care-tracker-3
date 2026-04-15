# 需求文档 - AI 屏蔽 & 分享用户认证加固（AI Shield & Share Auth Hardening）

> 版本：v3.1 | 更新日期：2026-04-15 | 状态：已确认

## 概述

本次迭代包含两个独立需求：
1. **AI 能力屏蔽**：因小程序个人主体不支持上线 AI 能力，需屏蔽所有 AI 相关入口和调用
2. **分享认证加固**：修复分享小程序后其他用户可看到分享者信息的安全问题，确保严格的用户身份验证和家庭数据隔离

---

## 页面结构总览

```
┌──────────────────────────────────────────────────┐
│  App.onLaunch → initUser()                       │
│     ├─ 获取/创建 userInfo（含 _openid）            │
│     └─ 存储到 globalData + localStorage           │
├──────────────────────────────────────────────────┤
│  每个页面 onLoad/init                             │
│     ├─ await app.globalData.initPromise           │
│     ├─ ★ 验证 userInfo 存在且有 nickname          │
│     │   └─ 无 → /pages/auth/auth（引导页）        │
│     ├─ ★ 验证 familyId 存在且用户仍是成员          │
│     │   └─ 无 → /pages/auth/auth（引导页）        │
│     ├─ ★ 验证 currentBaby 属于当前家庭             │
│     │   └─ 不匹配 → 重新选择                      │
│     └─ 加载数据（仅限已验证用户）                   │
├──────────────────────────────────────────────────┤
│  AI 功能（全部屏蔽）                               │
│     ├─ 首页 AI 洞察 → 隐藏                        │
│     ├─ 发现页 AI 入口 → 移除                      │
│     ├─ AI 助手页 → 路由保留但入口不可达             │
│     ├─ 成长报告 AI 建议 → 隐藏                     │
│     └─ 引导页 AI 介绍 → 移除                      │
└──────────────────────────────────────────────────┘
```

## 用户角色

| 角色 | 描述 |
|------|------|
| 分享者 | 已注册用户，通过微信分享小程序给他人 |
| 新用户 | 通过分享链接首次打开小程序的用户 |
| 家庭成员 | 已通过邀请码加入同一家庭的注册用户 |
| 非家庭成员 | 注册用户但不属于分享者家庭 |

---

## 功能需求

### FR-1：AI 能力全面屏蔽

**用户故事：** 作为开发者，我需要屏蔽所有 AI 功能入口和调用，以便小程序通过个人主体审核上线。

**验收标准：**
1. 首页不显示"宝宝洞察"AI 区域（`home.wxml` 的 insight-v4 区块）
2. 首页不调用 `loadAiInsight()` 方法
3. 发现页 2x2 网格中不显示"AI 助手"入口（从 `toolItems` 中移除）
4. 成长报告弹窗中不显示"AI 育儿建议"卡片
5. 成长报告 Canvas 分享图中不绘制 AI 建议模块
6. 引导页功能介绍中不显示"AI 助手"板块
7. AI 服务文件（`ai.js`、`quota.js`、`content-filter.js`）保留但不被任何页面引用调用
8. `app.json` 中保留 `ai-assistant` 页面路由（避免已分享的旧链接 404），但所有导航入口移除

> **技术说明**：采用"移除入口、保留代码"策略，不删除 AI 相关文件，便于未来企业主体迁移后快速恢复。使用全局开关 `AI_ENABLED = false` 控制。

---

### FR-2：新用户强制引导流程

**用户故事：** 作为通过分享链接打开小程序的新用户，我应该被引导完成注册流程，而不是看到分享者的数据。

**验收标准：**
1. 当 `userInfo` 不存在或 `userInfo.nickname` 为空时，**所有页面**（含 TabBar 和分包页面）必须跳转到 `/pages/auth/auth`
2. 当 `userInfo.familyId` 为空时，跳转到 `/pages/auth/auth`
3. 新用户完成引导流程后才能访问主功能页面
4. 引导流程包含：欢迎页 → 填写信息 → 创建/加入家庭 → 创建宝宝
5. 所有页面在调用 `StorageUtil` 前必须 `await app.globalData.initPromise`（当前 `discover.js`、`profile.js`、分包页面均缺失）
6. 校验不通过时统一使用 `wx.reLaunch('/pages/auth/auth')`（而非 `redirectTo`），确保清空页面栈避免残留

> **技术说明**：在 `app.js` 层面提供统一的用户校验函数 `ensureUserReady()`，各页面 `init()` 调用。需覆盖的页面共 **16 个**（4 TabBar + 4 主包 + 4 packageGrowth + 4 packageSocial，auth 页除外）。

---

### FR-3：分享链接用户路由分发

**用户故事：** 作为通过分享链接打开小程序的用户，系统应根据我的身份正确路由。

**验收标准：**
1. **新用户**（无 userInfo.nickname）→ 跳转引导页 `/pages/auth/auth`
2. **已注册但无家庭**（无 familyId）→ 跳转引导页步骤 3（家庭选择）
3. **同一家庭成员**（familyId 匹配且在 members 列表中）→ 正常进入首页并加载家庭数据
4. **不同家庭成员**（familyId 不匹配）→ 进入自己家庭的首页，不显示分享者数据
5. 默认分享路径 `/pages/home/home` 不携带任何 babyId 或 familyId 参数

> **技术说明**：分享路径统一为 `/pages/home/home`，不传递敏感参数。用户进入后通过自身 openid 关联的 familyId 加载数据。

---

### FR-4：邀请码分享链接处理优化

**用户故事：** 作为已注册的老用户，通过邀请码分享链接打开小程序时，应能正确处理邀请码。

**验收标准：**
1. 老用户（已有 nickname 且有 familyId）通过邀请码链接打开时，弹出确认弹窗询问是否加入新家庭
2. 老用户如果已经是该家庭成员，提示"您已是该家庭成员"并正常进入首页
3. 新用户通过邀请码链接打开时，正常走引导流程，引导完成后自动处理邀请码加入
4. 邀请码参数仅在 `/pages/auth/auth?inviteCode=xxx` 路径中传递

> **技术说明**：修改 `auth.js` 的 `tryAutoLogin()` 逻辑，老用户不再直接跳转首页，先处理邀请码。

---

### FR-9：加入家庭安全校验（Review R4 新增 — **致命缺陷修复**）

**用户故事：** 作为已有家庭的用户，加入新家庭时系统应确保旧家庭数据被正确清理，避免产生幽灵成员。

**验收标准：**
1. `joinByInviteCode()` 在添加成员前，**必须检查用户是否已属于其他家庭**
2. 如果用户已属于其他家庭，必须**先从旧家庭的 `members[]` 和 `memberDetails[]` 中移除**，再加入新家庭
3. 唯一管理员不允许直接加入新家庭（需先转让管理权限或解散旧家庭）
4. `auth.js` 的 `joinFamily()` 中，加入成功后更新 `users.familyId` 不能产生幽灵成员
5. `createFamily()` 创建家庭前检查用户是否已有家庭，如有则提示

> **技术说明**：当前 `joinByInviteCode` 只检查 `family.members.includes(userId)`（是否已在**目标**家庭），完全不检查用户是否在**其他**家庭。加入后 `auth.js` 直接覆盖 `users.familyId`，旧家庭的 `members` 数组遗留用户 ID 成为"幽灵成员"。

---

### FR-10：解散家庭成员清理（Review R5 新增）

**用户故事：** 作为管理员，解散家庭时系统应清理所有成员的关联数据。

**验收标准：**
1. `dissolveFamily()` 在删除家庭文档前，批量清除所有成员的 `users.familyId` 和 `users.familyRole`
2. 清理失败的成员记录日志但不阻断解散流程
3. `updateMemberRole()` 变更权限后同步更新 `users.familyRole`（与 `transferAdmin` 保持一致）

> **技术说明**：当前 `dissolveFamily()` 只删除 families 文档，不清理成员 users 记录。其他成员下次打开会遇到"家庭不存在"错误，虽然 `home.js` 有降级处理，但不够可靠。

---

### FR-11：memberDetails 原子操作改造（Review R5 新增）

**用户故事：** 作为管理员，修改成员权限时不应丢失其他正在加入的成员数据。

**验收标准：**
1. `updateMemberRole()` 不再使用整体数组覆盖 `memberDetails`，改用针对特定成员的更新方式
2. `transferAdmin()` 同理，避免整体覆盖导致并发丢失
3. `updateMemberRole()` 完成后同步更新 `users.familyRole`

> **技术说明**：当前 `updateMemberRole` 和 `transferAdmin` 都是读-改-写模式（先 get 整个 memberDetails 数组 → 内存中修改 → 整体覆盖写回）。如果同时有用户通过邀请码 push 到 memberDetails，覆盖写入会丢失新成员。CloudBase NoSQL 不支持数组元素级更新，可行方案：(a) 使用云函数做服务端原子操作；(b) 使用乐观锁（updatedAt 版本检查）；(c) 接受当前风险但添加重试逻辑。**考虑到并发频率极低（家庭场景），本次采用方案 c + 日志告警。**

---

### 多家庭需求架构决策

> **重要说明**：用户提出"邀请进入到多个 family，可以显示所有 family 的 baby"。
> 
> 经分析，当前数据模型（`users.familyId: string` 单值）**不支持多家庭**。实现多家庭需要：
> - 将 `users.familyId` 改为 `users.familyIds: string[]`
> - 将 `users.familyRole` 改为 `users.familyRoles: { [familyId]: role }`
> - 所有页面和服务层的 familyId 单值引用全部改为数组遍历
> - 首页增加"家庭切换器"或"跨家庭宝宝列表"
> 
> **本次迭代决策**：改动量远超本次范围（估计 15-20h），作为 **v4.2 独立 spec** 规划。
> 本次 v4.1 聚焦**修复加入家庭的安全问题**（确保单家庭模型下的数据一致性），为 v4.2 奠定基础。

---

### FR-5：数据访问家庭归属校验

**用户故事：** 作为用户，我只能看到自己家庭中宝宝的数据，无法看到其他家庭的数据。

**验收标准：**
1. `currentBaby` 必须属于当前用户所在的家庭（`baby.familyId === userInfo.familyId`）
2. 如果 localStorage 中缓存的 `currentBaby` 不属于当前家庭，自动清除并重新选择
3. **所有 TabBar 页面** `init()` 需增加家庭归属校验（`home.js`、`record.js`、`discover.js`、`profile.js`）
4. **所有分包功能页面**需增加归属校验：`growth.js`、`vaccine.js`、`milestone.js`、`export.js`、`baby-detail.js`
5. **`baby-detail.js` 的 `options.id` 参数校验**：加载 baby 后必须验证 `baby.familyId === userInfo.familyId`，不匹配则拒绝显示并返回
6. **TabBar 页面的 `onShow()` 也需做轻量校验**：`home.js`/`record.js` 的 onShow 直接从 localStorage 读 currentBaby 使用，需验证其归属（防止用户在其他 Tab 被踢出家庭后 Tab 切换回来仍显示旧数据）
7. `baby-create.js` 需验证 userInfo 存在且有效后才允许创建宝宝

> **技术说明**：通过 `ensureUserReady()` 统一处理大部分校验。分包页面由于通过 navigateTo 进入，校验失败需 `wx.reLaunch` 而非 `redirectTo`。对于成员验证需**从云端拉取最新 familyInfo**（不能仅依赖缓存，缓存可能是被踢出前的旧数据）。

---

### FR-6：userId 标识统一

**用户故事：** 作为开发者，需要统一全项目的用户标识字段，避免 `_id` 和 `openid` 混用导致的权限判断失效。

**验收标准：**
1. `families.members[]` 中存储的是 `userInfo._id`（数据库文档 ID）
2. `families.memberDetails[].userId` 中存储的是 `userInfo._id`
3. `records.createdBy.userId` 统一使用 `userInfo._id`
4. `PermissionUtil` 的所有比较使用 `userInfo._id`
5. `record.js` 中 `familyMember` 查找逻辑修正：从 `familyInfo.members.find(m => m.userId === openid)`（**错误**：members 是 string[] 不是 Object[]）改为 `familyInfo.memberDetails.find(m => m.userId === _id)`
6. `family.js` 第 50 行 `currentUserId` 统一使用 `userInfo._id`，移除 `|| userInfo?.openid` fallback
7. `PermissionUtil.canDeleteRecord()` 需**兼容比较**：同时匹配 `record.createdBy.userId === userId` 和旧格式数据，避免 editor 无法删除自己的历史记录

> **技术说明**：经代码审查确认：`families.members[]` 已统一使用 `userInfo._id`（在 `createFamily` 和 `joinByInviteCode` 中），但 `record.js` 中 `createdBy.userId` 使用的是 `userInfo.openid`。同时发现 `familyInfo.members` 是 `string[]`（不是 Object[]），原代码中 `.find(m => m.userId === ...)` 永远返回 undefined——这意味着创建者信息的 nickName/avatar 获取一直是失败的，需要修正为从 `memberDetails` 查找。

---

### FR-7：分包页面登录守卫（Review R1 新增）

**用户故事：** 作为用户，即使通过二维码/旧链接直接打开分包页面，系统也应验证我的身份。

**验收标准：**
1. `packageGrowth` 下的 `growth.js`、`vaccine.js`、`milestone.js`、`baby-detail.js` 在 onLoad 中增加 `ensureUserReady()` 校验
2. `packageSocial` 下的 `family.js`、`family-join.js`、`export.js`、`settings.js` 在 onLoad 中增加 `ensureUserReady()` 校验
3. 校验不通过时使用 `wx.reLaunch('/pages/auth/auth')` 清空页面栈
4. `baby-create.js` 在创建宝宝前验证 userInfo 和 familyId 均存在

> **技术说明**：当前 **10 个分包/子页面** 完全没有用户验证，是最大的安全缺口。新用户通过二维码扫码直接进入这些页面时，getCurrentBaby() 返回 null 导致页面异常但不会跳转引导页。

---

### FR-8：ensureUserReady 缓存穿透机制（Review R2 新增）

**用户故事：** 作为被踢出家庭的用户，打开小程序时应立即检测到身份变更，而不是看到旧缓存数据。

**验收标准：**
1. `ensureUserReady()` 在验证成员归属时，必须**从云端拉取最新的 familyInfo**（不能仅依赖本地缓存）
2. 拉取频率控制：距上次成功拉取不足 5 分钟时可使用缓存，超过 5 分钟强制刷新
3. 网络断开时降级使用本地缓存（不阻断使用）
4. 拉取失败（非网络原因）时按"已被踢出"处理

> **技术说明**：原 design 中 `ensureUserReady()` 仅在 `familyInfo._id !== userInfo.familyId` 时才重新拉取，但被踢出场景下 familyId 仍然匹配，只是 members 列表变了。需要定期刷新以确保成员列表准确。

---

## 非功能需求

### NFR-1：性能要求
- 用户身份校验**最小化额外网络请求**：优先使用本地缓存，仅在缓存超过 5 分钟时才向云端拉取 familyInfo（每次 onLoad 最多 1 次请求）
- AI 屏蔽采用代码移除入口方式，不引入运行时判断开销

### NFR-2：兼容性要求
- 已分享出去的旧链接（`/packageSocial/pages/ai-assistant/ai-assistant`）不能 404
- 已有用户的 localStorage 数据格式不变，不需要迁移

### NFR-3：数据一致性
- 现有数据库中 `families.members[]` 已使用 `_id` 存储（通过 `auth.js` 的 `createFamily` 路径），无需迁移
- `records.createdBy.userId` 已有数据可能是 openid 格式，新记录统一使用 `_id`

### NFR-4：用户体验
- 新用户通过分享链接进入后，引导流程友好清晰
- 不同家庭用户打开分享链接后看到自己家庭的数据，不产生困惑

---

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|----------|
| 用户未完成引导就关闭小程序 | 下次打开继续引导（nickname 为空即触发） |
| familyId 对应的家庭已被解散 | 清除本地缓存，跳转引导页 |
| 用户被踢出家庭后通过分享链接进入 | 从云端拉取最新 familyInfo，检测到不在 members 中，清除缓存，reLaunch 到引导页 |
| localStorage 被清除 | `initUser()` 重新查询数据库获取 userInfo |
| AI 助手页面被旧链接直接打开 | 页面保留，显示"功能暂未开放"提示 |
| 网络断开时的身份校验 | 使用本地缓存的 userInfo 和 familyInfo，不阻断使用 |
| 通过二维码直接打开分包页面（如 growth） | ensureUserReady() 校验，不通过则 reLaunch 到 auth |
| 老用户通过邀请码链接加入，但旧家庭是唯一管理员 | 弹窗提示"您是当前家庭唯一管理员，请先转让管理权限再加入新家庭" |
| home.js onShow 时用户已在其他设备被踢出 | onShow 做轻量校验（检查 familyInfo 缓存时间，超过 5 分钟则刷新） |
| baby-detail?id=xxx 中 id 不属于当前家庭 | 加载 baby 后校验 familyId，不匹配则显示"无权限查看"并返回 |
| record.js 分享路径 showReport=1 被非家庭成员打开 | 进入 record 页面后走 ensureUserReady，加载的是用户自己的数据 |
| editor 尝试删除 openid 格式 userId 的旧记录 | canDeleteRecord 兼容比较新旧两种 userId 格式 |
| 用户已属于家庭 A，通过邀请码加入家庭 B | joinByInviteCode 先从家庭 A 移除，再加入家庭 B；唯一管理员拒绝 |
| 用户已属于家庭 A 且是唯一管理员，尝试加入家庭 B | 拒绝加入，提示先转让管理权限或解散旧家庭 |
| 管理员解散家庭时有 3 个成员 | 批量清除 3 个成员的 users.familyId/familyRole |
| 修改成员权限的同时有新成员通过邀请码加入 | 添加重试逻辑，避免 memberDetails 覆盖丢失 |
| getFamilyByUserId 返回多条（幽灵成员残留） | 优先匹配 users.familyId 对应的家庭，忽略幽灵记录 |
| removeMember 中 _clearUserFamilyInfo 使用 _openid 匹配不到文档 | 修改为使用 doc(userId).update 直接按 _id 更新 |

---

## 模块依赖关系与新增接口

```
FR-1 (AI屏蔽) ──── 独立，无依赖
FR-2 (新用户引导) ─┐
FR-3 (路由分发)  ──┼──► FR-5 (数据校验) ◄── FR-8 (缓存穿透)
FR-4 (邀请码优化) ─┘         ▲
FR-6 (userId统一) ─────────┘
FR-7 (分包守卫) ──► 依赖 FR-2 的 ensureUserReady()
```

**新增/修改接口：**

| 接口 | 类型 | 说明 |
|------|------|------|
| `app.js#ensureUserReady()` | 新增 | 统一用户校验函数，含缓存穿透机制，返回 `{userInfo, familyInfo, ready, redirectUrl, reason}` |
| `auth.js#tryAutoLogin()` | 修改 | 增加邀请码处理逻辑，处理老用户唯一管理员边界 |
| `auth.js#_handleInviteCodeForExistingUser()` | 新增 | 老用户邀请码处理 |
| `record.js#createRecord()` | 修改 | `createdBy.userId` 改用 `_id`，`familyMember` 查找改用 `memberDetails` |
| `PermissionUtil#canDeleteRecord()` | 修改 | 兼容新旧 userId 格式 |

---

## 变更影响范围

| 文件 | 改动类型 | 涉及 FR |
|------|----------|---------|
| `miniprogram/app.js` | 增量 | FR-2, FR-8 |
| `miniprogram/pages/home/home.js` | 小改 | FR-1, FR-2, FR-5 |
| `miniprogram/pages/home/home.wxml` | 小改 | FR-1 |
| `miniprogram/pages/record/record.js` | 小改 | FR-2, FR-5 |
| `miniprogram/pages/discover/discover.js` | 小改 | FR-1, FR-2, FR-5 |
| `miniprogram/pages/profile/profile.js` | 小改 | FR-2, FR-5 |
| `miniprogram/pages/auth/auth.js` | 大改 | FR-3, FR-4 |
| `miniprogram/pages/guide/guide.js` | 小改 | FR-1 |
| `miniprogram/pages/baby-create/baby-create.js` | 小改 | FR-7 |
| `miniprogram/pages/baby-list/baby-list.js` | 小改 | FR-7 |
| `miniprogram/packageGrowth/pages/growth/growth.js` | 小改 | FR-7 |
| `miniprogram/packageGrowth/pages/vaccine/vaccine.js` | 小改 | FR-7 |
| `miniprogram/packageGrowth/pages/milestone/milestone.js` | 小改 | FR-7 |
| `miniprogram/packageGrowth/pages/baby-detail/baby-detail.js` | 小改 | FR-5, FR-7 |
| `miniprogram/packageSocial/pages/family/family.js` | 小改 | FR-6, FR-7 |
| `miniprogram/packageSocial/pages/family-join/family-join.js` | 小改 | FR-7 |
| `miniprogram/packageSocial/pages/export/export.js` | 小改 | FR-7 |
| `miniprogram/packageSocial/pages/settings/settings.js` | 小改 | FR-7 |
| `miniprogram/components/report-popup/report-popup.js` | 小改 | FR-1 |
| `miniprogram/components/report-popup/report-popup.wxml` | 小改 | FR-1 |
| `miniprogram/services/share-canvas.js` | 小改 | FR-1 |
| `miniprogram/services/record.js` | 小改 | FR-6 |
| `miniprogram/services/family.js` | 大改 | FR-9, FR-10, FR-11 |
| `miniprogram/utils/permission.js` | 小改 | FR-6 |
| `miniprogram/packageSocial/pages/ai-assistant/ai-assistant.js` | 小改 | FR-1 |
