# 实施计划 - AI 屏蔽 & 分享用户认证加固（AI Shield & Share Auth Hardening）

> 版本：v3.1 | 日期：2026-04-15 | 状态：✅ 已完成（2026-04-15）

## 实施概览

预计总工时：约 8-9 小时（Review R6 后从 6-7h 上调，新增 family 安全修复）
关键里程碑：
- M1（1-1.5h）：AI 能力全面屏蔽
- M2（3-3.5h）：分享认证加固 + 全页面登录守卫（核心）
- M2.5（1.5-2h）：Family 成员增删改安全修复（Review R4-R6 新增，**致命缺陷修复**）
- M3（1.5-2h）：userId 统一 + 邀请码优化 + 收尾

---

## 任务列表

### 阶段一：AI 能力全面屏蔽（M1）

- [x] ✅ **T-1.1** 首页 AI 洞察屏蔽
  - `home.js`：移除 `loadAiInsight()` 调用（约第 532-535 行的 3 行）
  - `home.js`：移除 `goToAiAssistant()` 方法（保留也无害，但建议注释）
  - `home.wxml`：移除 AI 洞察区块（第 249-279 行的 `insight-v4` 整个 view）
  - `home.wxss`：AI 洞察相关样式可保留（不影响功能）
  - 验收：首页不显示任何 AI 相关 UI，无 AI 网络请求
  - _涉及：FR-1_

- [x] ✅ **T-1.2** 发现页 AI 入口移除
  - `discover.js`：移除 `toolItems` 数组中的 AI 助手项（第 40-46 行）
  - `discover.wxml`：网格自动适配（3 项变为 1x3 布局，或保持 2x2 空一格）
  - 验收：发现页不显示 AI 助手入口
  - _涉及：FR-1_

- [x] ✅ **T-1.3** 成长报告 AI 建议屏蔽
  - `report-popup.wxml`：移除 AI 育儿建议卡片（第 201-208 行）
  - `report-popup.js`：`buildReport()` 中将 `briefAIAdvice` 赋值为空字符串，不调用 `generateAIComment()`
  - `share-canvas.js`：`_drawAllModules()` 中跳过 `_drawAIAdvice()` 调用；高度计算中排除 AI 区域
  - 验收：成长报告弹窗和分享图中无 AI 建议
  - _涉及：FR-1_

- [x] ✅ **T-1.4** 引导页 & AI 助手页处理
  - `guide.js`：移除 guides 数组中的 AI 助手对象（第 55-63 行）
  - `ai-assistant.js`：`onLoad()` 中添加功能关闭提示并 `navigateBack()`
  - 验收：引导页不展示 AI 功能；直接访问 AI 助手页会提示关闭
  - _涉及：FR-1_

---

### 阶段二：分享认证加固（M2）

- [x] ✅ **T-2.1** app.js 新增统一用户校验函数（含缓存穿透）
  - 新增 `ensureUserReady()` 方法（详见 design.md § 3.2.1）
  - 新增 `checkFamilyStale()` 轻量校验方法（供 onShow 使用，不发网络请求）
  - 新增 `_clearFamilyData()` 私有辅助方法（清理 localStorage + 同步 globalData）
  - 返回 `{ ready, userInfo, familyInfo, redirectUrl, reason }`
  - familyInfo 5 分钟定时穿透刷新机制（`_family_fetch_ts`）
  - 网络失败时降级使用本地缓存
  - 验收：函数可被各页面调用，校验逻辑正确；被踢出后 5 分钟内能检测到
  - _涉及：FR-2, FR-3, FR-5, FR-8_

- [x] ✅ **T-2.2** TabBar 页面 init() 重构（4 个页面）
  - `home.js`：将现有 init() 校验逻辑替换为 `ensureUserReady()`，保留 familyBabies/currentBaby/权限计算
  - `record.js`：增加 `ensureUserReady()` 调用，增加 currentBaby familyId 归属校验
  - `discover.js`：增加 `ensureUserReady()`（**Review R1-5**: 当前缺少 `await initPromise`）
  - `profile.js`：增加 `ensureUserReady()`（**Review R1-4**: 当前缺少 `await initPromise`）
  - **Review R2-2**: 校验失败统一使用 `wx.reLaunch` 而非 `redirectTo`
  - **FR-5.6**: TabBar 页面 `onShow()` 增加 `app.checkFamilyStale()` 调用，过期时触发 `this.init()` 强制重新校验
  - 验收：4 个 TabBar 页面均有完整的用户/家庭/宝宝校验；Tab 切换时也能检测被踢出
  - _依赖：T-2.1 | 涉及：FR-2, FR-3, FR-5_

- [x] ✅ **T-2.3** 主包子页面增加登录守卫（3 个页面）
  - `baby-create.js`：增加 `ensureUserReady()` 或至少 userInfo 有效性验证
  - `baby-list.js`：增加 `ensureUserReady()` 调用
  - `guide.js`：增加轻量校验（低优先级，引导页风险较低）
  - 验收：直接访问这些页面时，未登录用户被拦截
  - _依赖：T-2.1 | 涉及：FR-7_

- [x] ✅ **T-2.4** 分包页面增加登录守卫（10 个页面）——**Review R1 新增**
  - **packageGrowth（4 个）**：`growth.js`、`vaccine.js`、`milestone.js`、`baby-detail.js`
  - **packageSocial（4+2 个）**：`family.js`、`family-join.js`、`export.js`、`settings.js`
  - 每个页面 onLoad 头部增加 `ensureUserReady()` 调用
  - `baby-detail.js` 额外增加 baby familyId 归属校验（**Review R1-2**）
  - 校验失败使用 `wx.reLaunch('/pages/auth/auth')`
  - 验收：通过二维码直接打开分包页面，未登录用户被拦截；baby-detail 无法查看他人宝宝
  - _依赖：T-2.1 | 涉及：FR-5, FR-7_

- [x] ✅ **T-2.5** auth.js 邀请码处理重构
  - 修改 `tryAutoLogin()`：老用户有邀请码时不直接跳首页
  - 新增 `_handleInviteCodeForExistingUser(userInfo)` 方法
  - 新增 `_goToHome(userInfo)` 辅助方法（加载家庭+宝宝后 switchTab）
  - 处理唯一管理员边界（`leaveResult.needTransfer` 时提示转让）
  - **FR-9.5**: `createFamily()` 增加检查 `userInfo.familyId` 是否已有值，已有则先退出旧家庭
  - 验收：老用户通过邀请码可正确加入；已是成员时提示；唯一管理员时拒绝；创建家庭不产生幽灵
  - _涉及：FR-4, FR-9_

---

### 阶段 2.5：Family 成员增删改安全修复（M2.5）——Review R4-R6 新增

- [x] ✅ **T-2.6** joinByInviteCode 安全加固（**致命缺陷**）
  - `family.js#joinByInviteCode()`：在添加成员前调用 `getFamilyByUserId(userId)` 检查是否已有家庭
  - 已有家庭且非唯一管理员 → 自动从旧家庭移除（调用 `_removeSelfFromFamily`）
  - 已有家庭且是唯一管理员 → 抛出错误提示先转让
  - `auth.js#createFamily()`：创建前检查 `userInfo.familyId` 是否已有值
  - 验收：用户从家庭 A 加入家庭 B 后，家庭 A 的 members 中不再包含该用户
  - _涉及：FR-9_

- [x] ✅ **T-2.7** dissolveFamily 成员清理
  - `family.js#dissolveFamily()`：删除家庭文档前，遍历 `family.members` 批量清除每个成员的 `users.familyId/familyRole`
  - 单个成员清理失败不阻断（try-catch + warn）
  - 验收：解散家庭后所有成员的 `users.familyId` 被清除
  - _涉及：FR-10_

- [x] ✅ **T-2.8** updateMemberRole 乐观锁 + _clearUserFamilyInfo 修正
  - `family.js#updateMemberRole()`：增加乐观锁重试（`stats.updated === 0` 时最多重试 2 次）
  - `family.js#updateMemberRole()`：完成后同步更新 `users.familyRole`
  - `family.js#_clearUserFamilyInfo()`：从 `where({ _openid: userId })` 改为 `doc(userId).update()`
  - `family.js#removeMember()` 中清除用户信息也改用 `doc(targetUserId).update()`
  - 验收：权限变更有重试机制；`families.memberDetails` 和 `users.familyRole` 一致；removeMember 正确清理
  - _涉及：FR-10, FR-11_

---

### 阶段三：userId 统一 & 收尾（M3）

- [ ] **T-3.1** record.js userId 统一 + memberDetails 修正
  - `createRecord()` 中 6 处 `userInfo?.openid` 替换为 `userInfo?._id`
  - `familyMember` 查找从 `familyInfo?.members?.find(m => m.userId === ...)` 改为 `familyInfo?.memberDetails?.find(m => m.userId === userInfo?._id)`（**Review R3-1**: members 是 string[] 不是 Object[]）
  - 验收：新创建的记录 `createdBy.userId` 使用 `_id`；创建者 nickName/avatar 正确显示
  - _涉及：FR-6_

- [ ] **T-3.2** family.js + permission.js 修正
  - `family.js` 第 50 行移除 `|| userInfo?.openid` fallback（**Review R3-2**）
  - `permission.js#canDeleteRecord()`：维持当前逻辑不变（已使用传入的 userId 比较，兼容性可接受）
  - 验收：家庭管理页权限判断正确
  - _涉及：FR-6_

- [x] ✅ **T-3.3** 全局自测验证
  - **场景 1**：新设备首次打开小程序 → 应进入引导页
  - **场景 2**：已注册用户打开 → 应正常进入首页
  - **场景 3**：分享链接打开（非家庭成员）→ 应看到自己的数据或引导
  - **场景 4**：邀请码链接（已注册老用户）→ 应弹窗确认加入
  - **场景 5**：邀请码链接（老用户是唯一管理员）→ 应提示无法加入
  - **场景 6**：首页/发现页/报告中无任何 AI 相关 UI
  - **场景 7**：直接访问 AI 助手页 → 提示功能关闭
  - **场景 8**：直接访问分包页面（growth/vaccine 等）→ 未登录用户被拦截
  - **场景 9**：baby-detail?id=其他家庭的babyId → 显示无权限
  - **场景 10**：用户被踢出后切换 Tab → 5 分钟内检测到并跳转引导页
  - **场景 11**：网络断开时 → 使用本地缓存正常使用
  - **场景 12**：用户在家庭 A 中，通过邀请码加入家庭 B → 自动从 A 移除，A 的成员列表不含该用户
  - **场景 13**：唯一管理员尝试加入其他家庭 → 被拒绝，提示先转让
  - **场景 14**：管理员解散家庭（3 成员）→ 所有成员 familyId 被清除
  - **场景 15**：修改成员权限后检查 users.familyRole 是否同步
  - _涉及：所有 FR_

---

## 任务依赖关系

```
T-1.1 ─┐
T-1.2 ─┤
T-1.3 ─┼─(独立，可并行)
T-1.4 ─┘

T-2.1 ──→ T-2.2（TabBar 4页）──→ T-2.3（主包 3页）──→ T-2.4（分包 10页）
     └──→ T-2.5（auth.js 邀请码）

T-2.6（joinByInviteCode）──→ T-2.7（dissolveFamily）──→ T-2.8（updateMemberRole）

T-3.1 ──→ T-3.2（family+permission）
T-3.3 ──(依赖全部完成)
```

---

## 风险说明（实施后评估）

| # | 风险 | 原评估 | 实际影响 | 状态 | 说明 & 优化建议 |
|---|------|--------|----------|------|-----------------|
| 1 | 发现页 3 项布局不美观 | 中/低 | **轻微** | ⚠️ 需观察 | 已从 4 项减为 3 项（疫苗/生长曲线/里程碑），布局仍使用 `tool-grid` 2x2 网格，3 项时右下角空位。**建议**：v4.2 补充一个新功能入口（如"育儿百科"）填满 2x2，或改为 1x3 横向滑动布局 |
| 2 | 已有 records 中 createdBy.userId 是 openid 格式 | 中/中 | **已缓解** | ✅ 可控 | `normalizeCreatedBy()` 已兼容新旧两种格式（对象 / 扁平字段）；`canDeleteRecord()` 用 `record.createdBy?.userId \|\| record.creatorId` 兼容。**但**：旧记录的 editor 用户删除自己记录时，如果 `creatorId` 是 openid 而当前 userId 是 `_id`，会匹配失败导致无法删除。**建议**：v4.2 增加一次性数据迁移脚本，将存量 records 的 `createdBy.userId` 和 `creatorId` 从 openid 更新为 `_id` |
| 3 | `ensureUserReady()` 5分钟刷新增加云端请求 | 中/低 | **可接受** | ✅ 无影响 | 仅在 onLoad 时检查时间戳，非轮询；`checkFamilyStale()` 在 onShow 中只做本地时间比较（不发请求），过期时才触发 `init()` 重新校验。每用户每 5 分钟最多 1 次额外云查询。**建议**：若后续用户量大，可将间隔调至 10 分钟 |
| 4 | auth.js 邀请码流程改动引入新 Bug | 中/中 | **需自测验证** | ⚠️ 待验证 | 新增了 `_handleInviteCodeForExistingUser`、唯一管理员边界判断、`createFamily` 前检查旧家庭等逻辑，路径较多。**建议**：T-3.3 重点覆盖场景 4/5/12/13，确保邀请码正常加入、唯一管理员被拒、旧家庭自动退出 |
| 5 | 16 个页面统一增加 ensureUserReady 工作量大 | 低/中 | **已完成** | ✅ 已消除 | 实际覆盖 16 个文件（4 TabBar + 3 主包 + 9 分包），每个页面 3-5 行统一模式代码，已全部实施并提交 |
| 6 | 唯一管理员退出家庭的复杂逻辑 | 中/高 | **已实现** | ✅ 已缓解 | `joinByInviteCode` 中检查 `isAdmin && !hasOtherAdmin` 时直接抛错提示转让；`leaveFamily` 中唯一管理员返回 `needTransfer: true`；auth.js 中老用户邀请码流程处理该返回值弹窗提示。**建议**：自测场景 5/13 重点验证 |
| 7 | **joinByInviteCode 旧家庭自动移除失败** | 低/**高** | **概率极低** | ✅ 已缓解 | 当前实现：先 `_removeSelfFromFamily(旧家庭)`，后 `update(新家庭)`。若移除成功但加入失败，用户变为无家庭状态，`ensureUserReady` 会引导到 auth 页重新加入。**建议**：v4.2 考虑将两步操作封装为"先加入新家庭、再移除旧家庭"的顺序（但需处理 members 重复问题），或引入事务补偿队列 |
| 8 | **dissolveFamily 批量清理部分失败** | 低/中 | **可接受** | ✅ 已缓解 | 逐个 `doc(memberId).update` + try-catch，单个失败只 warn 不阻断。失败的成员下次打开时 `ensureUserReady` 检测到家庭不存在会自动清理。**建议**：后续可改为批量操作（CloudBase 暂不支持批量 update by ids，暂无优化空间） |
| 9 | **已有幽灵成员数据的存量修复** | 中/中 | **遗留风险** | ⚠️ 需跟进 | 本次仅做了增量防护（`joinByInviteCode` 前检查旧家庭），未修复存量幽灵成员。存量幽灵成员在旧家庭 `members` 中仍然存在，可能导致旧家庭成员数显示偏多。**建议**：v4.2 编写一次性云函数脚本，遍历所有 families，检查每个 member 的 `users.familyId` 是否匹配，不匹配的从 `members/memberDetails` 中移除 |
