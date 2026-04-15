# 执行计划 - AI 屏蔽 & 分享用户认证加固（AI Shield & Share Auth Hardening）

> 版本：v2.0 | 日期：2026-04-15 | 状态：进行中

## 概览

基于 `tasks.md` v3.1 和 `design.md` v3.1，共 14 个 Task，预估 8-9h。
按功能模块和依赖关系编排为 **4 个 Session**，每个 Session 有明确的产出和验收节点。

**改动文件总计**：25 个
**新增方法**：ensureUserReady、checkFamilyStale、_clearFamilyData、_handleInviteCodeForExistingUser、_goToHome、_removeSelfFromFamily
**修改方法**：joinByInviteCode、dissolveFamily、updateMemberRole、_clearUserFamilyInfo、removeMember、tryAutoLogin、createFamily

---

## Session 1：AI 能力全面屏蔽（M1）

**预估工时**：1-1.5h
**目标**：移除所有 AI 功能入口，保留底层代码文件
**前置**：创建 feature 分支

### Step 1.0：创建 feature 分支

```bash
git checkout develop
git pull origin develop
git checkout -b feature/v4.1-ai-shield-and-share-auth
git push -u origin feature/v4.1-ai-shield-and-share-auth
```

**产出**：分支就绪

### Step 1.1：T-1.1 首页 AI 洞察屏蔽

**改动文件**：
- `miniprogram/pages/home/home.js` — 删除 `loadAiInsight()` 调用（约第 532-535 行的 3 行 if 块）；注释 `goToAiAssistant()` 方法
- `miniprogram/pages/home/home.wxml` — 移除 `insight-v4` 整个 view 区块（第 249-279 行）

**设计参考**：design.md § 3.1.1

**实现要点**：
```javascript
// home.js：删除这 3 行
// if (totalTodayCount > 0) {
//   this.loadAiInsight();
// }
```

**验收**：
- [ ] 首页无 AI 洞察区域
- [ ] 无 `wx.cloud.extend.AI` 网络请求
- [ ] 页面编译无报错

**提交**：`feat(home): 移除首页 AI 洞察功能 FR-1`

### Step 1.2：T-1.2 发现页 AI 入口移除

**改动文件**：
- `miniprogram/pages/discover/discover.js` — `toolItems` 数组移除 AI 助手项（第 40-46 行），从 4 项变 3 项

**设计参考**：design.md § 3.1.2

**实现要点**：
```javascript
// toolItems 从 4 项变为 3 项，移除最后一个 AI 助手
toolItems: [
  { /* 疫苗追踪 */ },
  { /* 生长曲线 */ },
  { /* 发育里程碑 */ }
  // AI 助手项移除
]
```

**验收**：
- [ ] 发现页工具网格不显示 AI 助手
- [ ] 3 项布局正常（检查 wxml/wxss 适配）

**提交**：`feat(discover): 移除 AI 助手入口 FR-1`

### Step 1.3：T-1.3 成长报告 AI 建议屏蔽

**改动文件**：
- `miniprogram/components/report-popup/report-popup.wxml` — 移除 AI 育儿建议卡片（第 201-208 行）
- `miniprogram/components/report-popup/report-popup.js` — `buildReport()` 中 `briefAIAdvice` 赋空字符串，不调用 `generateAIComment()`
- `miniprogram/services/share-canvas.js` — `_drawAllModules()` 跳过 `_drawAIAdvice()` 调用；高度计算排除 AI 区域

**设计参考**：design.md § 3.1.3

**实现要点**：
- report-popup.js：`generateAIComment()` 方法保留但不调用；`briefAIAdvice` 设为空字符串
- share-canvas.js：`_drawAIAdvice()` 方法保留但 `_drawAllModules()` 中跳过调用

**验收**：
- [ ] 成长报告弹窗无 AI 建议卡片
- [ ] 分享图无 AI 建议区域
- [ ] 弹窗和分享图布局正常

**提交**：`feat(components): 屏蔽成长报告 AI 建议 FR-1`

### Step 1.4：T-1.4 引导页 & AI 助手页处理

**改动文件**：
- `miniprogram/pages/guide/guide.js` — `guides` 数组移除 AI 助手对象（第 55-63 行）
- `miniprogram/packageSocial/pages/ai-assistant/ai-assistant.js` — `onLoad()` 增加功能关闭提示 + `navigateBack()`

**设计参考**：design.md § 3.1.4 + § 3.1.5

**实现要点**：
```javascript
// ai-assistant.js onLoad 新逻辑
onLoad() {
  wx.showModal({
    title: '功能暂未开放',
    content: 'AI 育儿助手功能正在升级中，敬请期待。',
    showCancel: false,
    success: () => { wx.navigateBack(); }
  });
}
```

**验收**：
- [ ] 引导页无 AI 功能介绍
- [ ] 直接访问 AI 助手页 → 弹窗"功能暂未开放" → 自动返回

**提交**：`feat(guide): 移除引导页 AI 介绍 & AI 助手页关闭提示 FR-1`

### Session 1 完成节点

- [ ] 更新 `tasks.md` 中 T-1.1~T-1.4 为 ✅
- [ ] 所有 AI 相关 UI 已移除
- [ ] 编译通过，无报错

---

## Session 2：分享认证加固 — 核心守卫（M2）

**预估工时**：3-3.5h
**目标**：实现 `ensureUserReady()` + 全 16 页面登录守卫 + 邀请码重构
**前置**：Session 1 完成（非严格依赖，但建议顺序执行）

### Step 2.1：T-2.1 app.js 统一用户校验函数

**改动文件**：
- `miniprogram/app.js` — 新增 `ensureUserReady()`、`checkFamilyStale()`、`_clearFamilyData()` 三个方法

**设计参考**：design.md § 3.2.1（完整代码）

**关键实现点**：
1. `ensureUserReady()`：完整流程见 design.md § 3.2.1
   - await initPromise → 检查 userInfo（含 _id 和 nickname）→ 检查 familyId
   - 5 分钟缓存穿透拉取 familyInfo（`_family_fetch_ts` 时间戳判断）
   - 验证 `familyInfo.members.includes(userInfo._id)`
   - 网络失败时降级使用缓存
   - 返回 `{ ready, userInfo, familyInfo, redirectUrl, reason }`
2. `checkFamilyStale()`：纯本地检查缓存时效（5 分钟），返回 boolean
3. `_clearFamilyData(userInfo)`：清理 localStorage + **同步 `this.globalData`**（D-3 修复）
4. FamilyService 使用 `getInstance()` 而非每次 new（D-1 修复）

**验收**：
- [ ] `ensureUserReady()` 正常返回 `{ ready, userInfo, familyInfo }` 或 `{ ready: false, redirectUrl, reason }`
- [ ] 网络断开时降级使用缓存
- [ ] `_clearFamilyData` 同步清理 globalData（this.globalData.userInfo/familyInfo/currentBaby）

**提交**：`feat(app): 新增 ensureUserReady 统一用户校验函数 FR-2 FR-8`

### Step 2.2：T-2.2 TabBar 页面 init() 重构（4 个页面）

**改动文件**：
- `miniprogram/pages/home/home.js` — init() 替换为 ensureUserReady() 调用；onShow() 增加 checkFamilyStale()
- `miniprogram/pages/record/record.js` — init() 增加 ensureUserReady()；onShow() 增加 checkFamilyStale()
- `miniprogram/pages/discover/discover.js` — init() 增加 ensureUserReady()（修复缺失的 await initPromise）
- `miniprogram/pages/profile/profile.js` — init()/onLoad() 增加 ensureUserReady()（修复缺失的 await initPromise）

**设计参考**：design.md § 3.2.2（页面清单 + 统一模式）+ § 3.2.1 onShow 校验模式

**关键实现点**：
1. 每个页面 init() 头部调用 `const check = await app.ensureUserReady()`
2. `check.ready === false` 时：
   - `reason === 'removed'` → showModal 提示后 `reLaunch`
   - 其他原因 → 直接 `reLaunch`
3. `home.js` / `record.js` 的 onShow() 增加：
   ```javascript
   if (app.checkFamilyStale()) { this.init(); return; }
   ```
4. `home.js` 原有的复杂校验逻辑（familyBabies 检查等）在 ensureUserReady 通过后保留
5. **Review R2-2**：统一使用 `wx.reLaunch` 而非 `redirectTo`

**验收**：
- [ ] 4 个 TabBar 页面直接打开时，无 userInfo → reLaunch 到 auth
- [ ] 无 familyId → reLaunch 到 auth
- [ ] Tab 切换 5 分钟后触发缓存刷新
- [ ] home/record onShow 的 30s 节流逻辑保持正常

**提交**：`feat(pages): TabBar 4页增加 ensureUserReady 登录守卫 FR-2 FR-5`

### Step 2.3：T-2.3 主包子页面登录守卫（3 个页面）

**改动文件**：
- `miniprogram/pages/baby-create/baby-create.js` — onLoad 增加 ensureUserReady 或 userInfo 有效性验证
- `miniprogram/pages/baby-list/baby-list.js` — onLoad 增加 ensureUserReady
- `miniprogram/pages/guide/guide.js` — 增加轻量校验（低优先级）

**设计参考**：design.md § 3.2.2 页面清单

**实现要点**：使用统一模式（design § 3.2.2），校验失败 `wx.reLaunch('/pages/auth/auth')`

**验收**：
- [ ] 直接访问 baby-create 时无用户身份 → 拦截
- [ ] baby-list 无用户身份 → 拦截

**提交**：`feat(pages): 主包子页面增加登录守卫 FR-7`

### Step 2.4：T-2.4 分包页面登录守卫（8+ 个页面）

**改动文件**：
- `miniprogram/packageGrowth/pages/growth/growth.js`
- `miniprogram/packageGrowth/pages/vaccine/vaccine.js`
- `miniprogram/packageGrowth/pages/milestone/milestone.js`
- `miniprogram/packageGrowth/pages/baby-detail/baby-detail.js`（额外 familyId 归属校验）
- `miniprogram/packageSocial/pages/family/family.js`
- `miniprogram/packageSocial/pages/family-join/family-join.js`
- `miniprogram/packageSocial/pages/export/export.js`
- `miniprogram/packageSocial/pages/settings/settings.js`

**设计参考**：design.md § 3.5（growth.js 示例 + baby-detail 归属校验）

**关键实现点**：
1. 每个页面使用 `_guardedInit()` 模式（design § 3.5 growth.js 示例）
2. `baby-detail.js`：额外校验 `baby.familyId !== userInfo.familyId` → showToast + navigateBack
3. 校验失败统一 `wx.reLaunch('/pages/auth/auth')`

**baby-detail 归属校验**（design § 3.5）：
```javascript
async loadBaby(babyId) {
  const baby = await babyService.getBabyById(babyId);
  const userInfo = StorageUtil.getUserInfo();
  if (baby.familyId !== userInfo?.familyId) {
    wx.showToast({ title: '无权限查看', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 1000);
    return;
  }
  // 原有逻辑...
}
```

**验收**：
- [ ] 通过二维码直接打开 growth 页 → 未登录用户被拦截
- [ ] baby-detail?id=其他家庭的 babyId → 显示"无权限查看"
- [ ] 所有 8 个分包页面编译通过

**提交**：`feat(packages): 分包页面增加登录守卫 FR-5 FR-7`

### Step 2.5：T-2.5 auth.js 邀请码处理重构

**改动文件**：
- `miniprogram/pages/auth/auth.js` — 重构 tryAutoLogin()；新增 `_handleInviteCodeForExistingUser()`、`_goToHome()`；createFamily() 检查已有家庭

**设计参考**：design.md § 3.3（tryAutoLogin 完整重设计 + _handleInviteCodeForExistingUser + _goToHome + createFamily 检查）

**关键实现点**：
1. **`tryAutoLogin()`** 重构（design § 3.3）：
   - 老用户 + 有邀请码 → 调用 `_handleInviteCodeForExistingUser()` 而非直接跳首页
   - 老用户 + 无邀请码 → loadFamilyInfo + loadCurrentBaby + switchTab（原逻辑）
2. **`_handleInviteCodeForExistingUser(userInfo)`** 新增（design § 3.3）：
   - validateInviteCode → 无效则 Toast + _goToHome
   - 已是该家庭成员 → Toast "已是成员" + _goToHome
   - 有效 → showModal 确认加入（含"离开当前家庭"提示）
   - 确认 + 已有家庭 → leaveFamily → 检查 needTransfer → joinFamily
   - 唯一管理员 → showModal 提示先转让
3. **`_goToHome(userInfo)`** 新增（design § 3.3 D-7）：
   - setData loading false → loadFamilyInfo → loadCurrentBaby → switchTab
4. **`createFamily()`** 增加检查（design § 3.3 FR-9.5）：
   - `userInfo.familyId` 有值 → showModal 确认 → leaveFamily → _doCreateFamily
   - 原 createFamily 逻辑提取到 `_doCreateFamily()`

**验收**：
- [ ] 老用户通过邀请码链接打开 → 弹窗确认加入
- [ ] 已是该家庭成员 → Toast"已是成员" → 跳首页
- [ ] 唯一管理员尝试加入 → 提示"请先转让管理权限"
- [ ] 无效邀请码 → Toast → 跳首页
- [ ] createFamily 时已有家庭 → 确认后先退出再创建

**提交**：`feat(auth): 重构邀请码处理流程 FR-4 FR-9`

### Session 2 完成节点

- [ ] 更新 `tasks.md` 中 T-2.1~T-2.5 为 ✅
- [ ] 16 个页面全部有登录守卫
- [ ] auth.js 邀请码完整流程就绪
- [ ] 编译通过

---

## Session 3：Family 成员增删改安全修复（M2.5）

**预估工时**：1.5-2h
**目标**：修复 family 服务层的致命缺陷和一致性问题
**前置**：Session 2 Step 2.5 完成（auth.js 中依赖 family.js 的安全逻辑）

### Step 3.1：T-2.6 joinByInviteCode 安全加固

**改动文件**：
- `miniprogram/services/family.js` — `joinByInviteCode()` 增加旧家庭检查 + 唯一管理员判断 + `_removeSelfFromFamily` 调用

**设计参考**：design.md § 7.1

**关键实现点**（design § 7.1 完整代码）：
1. 添加成员前调用 `this.getFamilyByUserId(userId)` 检查是否已有家庭
2. 已有家庭 + 非唯一管理员 → `_removeSelfFromFamily(existingFamily._id, userId)`
3. 已有家庭 + 唯一管理员 → `throw new Error('...')`
4. `_removeSelfFromFamily` 需从 `leaveFamily` 提取自移除逻辑（或新建）
5. 需确认 `PermissionUtil.isAdmin()` 和 `hasOtherAdmin()` 方法是否存在，不存在则需新增

**验收**：
- [ ] 用户从家庭 A 加入家庭 B → A 的 members 不含该用户
- [ ] 唯一管理员加入其他家庭 → 被拒绝
- [ ] _removeSelfFromFamily 失败时不加入新家庭（回滚策略）

**提交**：`fix(services): joinByInviteCode 安全加固 — 防止幽灵成员 FR-9`

### Step 3.2：T-2.7 dissolveFamily 成员清理

**改动文件**：
- `miniprogram/services/family.js` — `dissolveFamily()` 先删文档再批量清理成员

**设计参考**：design.md § 7.2

**关键实现点**（design § 7.2 完整代码）：
1. 先 `this.familyCollection.doc(familyId).remove()` 删除家庭文档
2. 遍历 `family.members` 批量 `this.userCollection.doc(memberId).update()` 清除 familyId/familyRole
3. 使用 `this.db.command.remove()` 删除字段
4. 单个成员清理失败 try-catch + warn，不阻断

**验收**：
- [ ] 解散家庭后所有成员 users.familyId 被清除
- [ ] 其他成员下次打开小程序 → ensureUserReady 检测到家庭不存在 → 跳转 auth

**提交**：`fix(services): dissolveFamily 增加成员清理 FR-10`

### Step 3.3：T-2.8 updateMemberRole + _clearUserFamilyInfo 修正

**改动文件**：
- `miniprogram/services/family.js` — `updateMemberRole()` 增加乐观锁重试 + 同步 users.familyRole；`_clearUserFamilyInfo()` 从 `where(_openid)` 改为 `doc(userId).update()`；`removeMember()` 清除用户信息改用 `doc(targetUserId).update()`

**设计参考**：design.md § 7.3 + § 7.4

**关键实现点**：
1. **updateMemberRole**（design § 7.3）：
   - 添加 `_retryCount` 参数，`stats.updated === 0` 时最多重试 2 次
   - 完成后 `userCollection.doc(targetUserId).update({ familyRole })` 同步 users 集合
2. **_clearUserFamilyInfo**（design § 7.4）：
   - `doc(userId).update()` 替代 `where({ _openid: userId })`
   - 使用 `db.command.remove()` 删除 familyId/familyRole 字段
3. **removeMember** 中的清除也改为 `doc(targetUserId).update()`

**验收**：
- [ ] 修改成员权限后 `users.familyRole` 与 `families.memberDetails` 一致
- [ ] removeMember 正确清理被移除用户的 familyId/familyRole
- [ ] _clearUserFamilyInfo 使用 doc() 而非 where()
- [ ] 并发冲突时能自动重试

**提交**：`fix(services): updateMemberRole 乐观锁 + _clearUserFamilyInfo 修正 FR-10 FR-11`

### Session 3 完成节点

- [ ] 更新 `tasks.md` 中 T-2.6~T-2.8 为 ✅
- [ ] family.js 所有致命缺陷已修复
- [ ] 编译通过

---

## Session 4：userId 统一 & 收尾（M3）

**预估工时**：1.5-2h
**目标**：统一 userId 标识 + 全局自测 + 文档同步
**前置**：Session 2 + Session 3 完成

### Step 4.1：T-3.1 record.js userId 统一

**改动文件**：
- `miniprogram/services/record.js` — `createRecord()` 中 6 处 `userInfo?.openid` → `userInfo?._id`；`familyMember` 查找改用 `memberDetails`

**设计参考**：design.md § 3.4（record.js 修改关键点）

**实现要点**（design § 3.4）：
```javascript
// 修正前（双重错误）：
// const familyMember = familyInfo?.members?.find(m => m.userId === userInfo?.openid);
// 修正后：
const familyMember = familyInfo?.memberDetails?.find(m => m.userId === userInfo?._id);
// createdBy.userId 也从 openid 改为 _id
createdBy: { userId: userInfo?._id || '', ... }
creatorId: userInfo?._id || null,
```

**验收**：
- [ ] 新记录的 `createdBy.userId` 使用 `_id` 格式
- [ ] 创建者 nickName/avatar 正确显示（从 memberDetails 获取）

**提交**：`fix(services): record.js userId 统一为 _id FR-6`

### Step 4.2：T-3.2 family.js + permission.js 修正

**改动文件**：
- `miniprogram/packageSocial/pages/family/family.js` — 第 50 行 `currentUserId` 移除 `|| userInfo?.openid`
- `miniprogram/utils/permission.js` — `canDeleteRecord()` 确认兼容逻辑

**设计参考**：design.md § 3.4（family.js 修正 + canDeleteRecord 兼容）

**实现要点**：
```javascript
// family.js 修正
currentUserId: userInfo?._id || ''  // 移除 || userInfo?.openid

// permission.js canDeleteRecord 维持现有逻辑不变
// 旧记录 editor 无法删除是可接受的降级
```

**验收**：
- [ ] 家庭管理页权限判断正确
- [ ] canDeleteRecord 使用传入的 userId 比较

**提交**：`fix(pages): family.js currentUserId 统一 + permission.js 兼容 FR-6`

### Step 4.3：T-3.3 全局自测验证（15 个场景）

逐一验证以下场景（tasks.md T-3.3）：

| # | 场景 | 预期结果 |
|---|------|----------|
| 1 | 新设备首次打开 | 进入引导页 |
| 2 | 已注册用户打开 | 正常进入首页 |
| 3 | 分享链接（非成员） | 看到自己数据或引导 |
| 4 | 邀请码链接（老用户） | 弹窗确认加入 |
| 5 | 邀请码（唯一管理员） | 提示无法加入 |
| 6 | 首页/发现页/报告 | 无 AI 相关 UI |
| 7 | 直接访问 AI 助手 | 提示功能关闭 |
| 8 | 直接访问分包页面 | 未登录拦截 |
| 9 | baby-detail 他人 baby | 无权限 |
| 10 | 被踢出后切 Tab | 5 分钟内检测 |
| 11 | 网络断开 | 本地缓存正常 |
| 12 | 家庭 A 加入家庭 B | A 移除用户 |
| 13 | 唯一管理员加入他家 | 拒绝 |
| 14 | 解散家庭（3 成员） | 成员 familyId 清除 |
| 15 | 修改权限后检查 | familyRole 同步 |

### Step 4.4：文档同步更新

根据 `development-workflow.md` § 3.2 要求，检查并更新以下文档：

| 文档 | 是否需要更新 | 更新内容 |
|------|-------------|---------|
| `architecture.md` | ✅ 是 | `app.js` 新增 ensureUserReady/checkFamilyStale/_clearFamilyData 方法 |
| `data-model.md` | ⚠️ 可能 | 确认 `_family_fetch_ts` 缓存 key 是否需要记录 |
| `coding-conventions.md` | ✅ 是 | 新增"页面登录守卫模式"代码模式；更新 userId 使用约定（_id 优先） |
| `ui-design-system.md` | ❌ 否 | 本次无 UI 变更 |
| `component-library.md` | ❌ 否 | 本次无新组件 |
| `service-api.md` | ✅ 是 | FamilyService 新增 `_removeSelfFromFamily` 方法；更新 `joinByInviteCode` 参数说明；更新 `dissolveFamily` 行为变更；更新 `updateMemberRole` 新增重试逻辑 |

**提交**：`docs: 同步更新文档 — v4.1 AI屏蔽&分享认证加固 迭代产出`

### Step 4.5：版本号同步

根据 `development-workflow.md` § 3.3，本次为 **MINOR 版本升级**（v4.0.1 → v4.1.0，沿用 Milo 代号）：

| # | 位置 | 文件 |
|---|------|------|
| 1 | CHANGELOG.md | 新增 v4.1.0 版本区块 |
| 2 | README.md § 1 | 产品版本改为 v4.1.0 |
| 3 | README.md § 12 | 追加版本历史行 |
| 4 | architecture.md 头部 | 版本改为 v4.1 |
| 5 | coding-conventions.md 头部 | 版本改为 v4.1 |
| 6 | git-flow.md § 5 版本线表 | 追加 v4.1.0 行 |
| 7 | profile.wxml | 版本改为 v4.1.0 |
| 8 | app.js globalData.version | 改为 '4.1.0' |

**提交**：`docs: v4.1.0 版本号同步`

### Step 4.6：更新 tasks.md 状态

```markdown
> 状态：进行中 → > 状态：✅ 已完成（2026-04-15）
```

所有 `- [ ]` 改为 `- [x] ✅`

**提交**：`docs: 更新 tasks.md 状态为已完成`

### Session 4 完成节点

- [ ] T-3.1~T-3.3 完成
- [ ] 15 个自测场景全部通过
- [ ] 6 份文档同步检查完成
- [ ] 版本号全量同步
- [ ] tasks.md 标记完成

---

## 执行摘要

| Session | 阶段 | Task 覆盖 | 预估工时 | 核心产出 |
|---------|------|-----------|----------|----------|
| 1 | M1 | T-1.1~T-1.4 | 1-1.5h | AI 功能全面屏蔽（7 处入口） |
| 2 | M2 | T-2.1~T-2.5 | 3-3.5h | ensureUserReady + 16 页面守卫 + auth.js 邀请码 |
| 3 | M2.5 | T-2.6~T-2.8 | 1.5-2h | family.js 安全修复（致命缺陷） |
| 4 | M3 | T-3.1~T-3.3 | 1.5-2h | userId 统一 + 自测 + 文档 + 版本号 |

---

## 提交序列预览

```
# Session 1
feat(home): 移除首页 AI 洞察功能 FR-1
feat(discover): 移除 AI 助手入口 FR-1
feat(components): 屏蔽成长报告 AI 建议 FR-1
feat(guide): 移除引导页 AI 介绍 & AI 助手页关闭提示 FR-1

# Session 2
feat(app): 新增 ensureUserReady 统一用户校验函数 FR-2 FR-8
feat(pages): TabBar 4页增加 ensureUserReady 登录守卫 FR-2 FR-5
feat(pages): 主包子页面增加登录守卫 FR-7
feat(packages): 分包页面增加登录守卫 FR-5 FR-7
feat(auth): 重构邀请码处理流程 FR-4 FR-9

# Session 3
fix(services): joinByInviteCode 安全加固 — 防止幽灵成员 FR-9
fix(services): dissolveFamily 增加成员清理 FR-10
fix(services): updateMemberRole 乐观锁 + _clearUserFamilyInfo 修正 FR-10 FR-11

# Session 4
fix(services): record.js userId 统一为 _id FR-6
fix(pages): family.js currentUserId 统一 + permission.js 兼容 FR-6
docs: 同步更新文档 — v4.1 AI屏蔽&分享认证加固 迭代产出
docs: v4.1.0 版本号同步
docs: 更新 tasks.md 状态为已完成
```
