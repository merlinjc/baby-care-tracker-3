# 需求文档 - v4.2 端到端安全 & 权限自动化测试（E2E Security & Permission Test Suite）

> 版本：v1.0 | 更新日期：2026-04-17 | 状态：待确认

---

## 一、概述

基于 v4.2 云函数网关 & 安全规则治理的完整业务逻辑，构造端到端自动化测试用例，模拟不同用户（不同 openid/userId）在不同家庭角色（admin/editor/viewer）下对家庭、宝宝、各类记录的操作，验证安全规则和云函数权限校验是否符合设计。

**测试目标**：
- 验证 6 个集合的安全规则（PRIVATE/CUSTOM/get() 交叉校验）
- 验证 13 个云函数 action 的权限校验
- 验证同家庭成员的数据可见性
- 验证跨家庭的数据隔离
- 验证边界条件和异常处理

---

## 二、测试角色矩阵

| 角色 | 标识 | openid | userId | familyId | 说明 |
|------|------|--------|--------|----------|------|
| **Alice** | Family-A Admin | `openid_alice` | `uid_alice` | `fam_A` | 家庭 A 创建者/管理员 |
| **Bob** | Family-A Editor | `openid_bob` | `uid_bob` | `fam_A` | 家庭 A 编辑成员 |
| **Carol** | Family-A Viewer | `openid_carol` | `uid_carol` | `fam_A` | 家庭 A 只读成员 |
| **Dave** | Family-B Admin | `openid_dave` | `uid_dave` | `fam_B` | 家庭 B 创建者/管理员 |
| **Eve** | Family-B Editor | `openid_eve` | `uid_eve` | `fam_B` | 家庭 B 编辑成员 |
| **Frank** | 无家庭 | `openid_frank` | `uid_frank` | — | 已注册但未加入任何家庭 |
| **Ghost** | 未注册 | `openid_ghost` | — | — | 未在 users 集合中注册 |

**测试数据**：
- Family-A 拥有 Baby-X（`baby_x`，familyId=`fam_A`）
- Family-B 拥有 Baby-Y（`baby_y`，familyId=`fam_B`）
- Baby-X 有 records/vaccine_records/milestone_records（由 Alice 和 Bob 分别创建）
- Baby-Y 有 records（由 Dave 创建）

---

## 三、测试用例（共 126 条）

### 模块 1：`users` 集合安全规则（PRIVATE）— 8 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| U-01 | Alice 读取自己的 users 文档 | Alice | `db.collection('users').doc(uid_alice).get()` | ✅ 成功返回文档 |
| U-02 | Alice 更新自己的 nickname | Alice | `db.collection('users').doc(uid_alice).update({nickname:'新名'})` | ✅ 成功 |
| U-03 | Alice 读取 Bob 的 users 文档 | Alice | `db.collection('users').doc(uid_bob).get()` | ❌ PERMISSION_DENIED |
| U-04 | Alice 更新 Bob 的 users 文档 | Alice | `db.collection('users').doc(uid_bob).update({nickname:'恶意'})` | ❌ PERMISSION_DENIED |
| U-05 | Dave（Family-B）读取 Alice 的 users 文档 | Dave | `db.collection('users').doc(uid_alice).get()` | ❌ PERMISSION_DENIED |
| U-06 | Frank（无家庭）读取自己的 users 文档 | Frank | `db.collection('users').doc(uid_frank).get()` | ✅ 成功 |
| U-07 | Alice where 查询所有 users | Alice | `db.collection('users').where({}).get()` | ✅ 仅返回自己的文档 |
| U-08 | Alice where 查询 Bob 的 openid | Alice | `db.collection('users').where({_openid:'openid_bob'}).get()` | ✅ 返回空数组（非自己的） |

### 模块 2：`families` 集合安全规则（CUSTOM）— 10 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| F-01 | Alice 读取自己家庭详情 | Alice | `db.collection('families').doc(fam_A).get()` | ✅ 成功返回 |
| F-02 | Bob 读取同家庭详情 | Bob | `db.collection('families').doc(fam_A).get()` | ✅ 成功返回 |
| F-03 | Carol（viewer）读取同家庭详情 | Carol | `db.collection('families').doc(fam_A).get()` | ✅ 成功返回 |
| F-04 | Dave（Family-B）读取 Family-A 详情 | Dave | `db.collection('families').doc(fam_A).get()` | ❌ PERMISSION_DENIED |
| F-05 | Frank（无家庭）读取 Family-A 详情 | Frank | `db.collection('families').doc(fam_A).get()` | ❌ PERMISSION_DENIED |
| F-06 | Alice 客户端更新 families 文档 | Alice | `db.collection('families').doc(fam_A).update({name:'新名'})` | ❌ PERMISSION_DENIED（update: false） |
| F-07 | Alice 客户端删除 families 文档 | Alice | `db.collection('families').doc(fam_A).remove()` | ❌ PERMISSION_DENIED（delete: false） |
| F-08 | Frank 通过邀请码查询 families | Frank | `db.collection('families').where({inviteCode:'ABCDEF'}).get()` | ❌ PERMISSION_DENIED（非成员） |
| F-09 | 认证用户创建家庭（客户端 add） | Frank | `db.collection('families').add({data:{name:'test'}})` | ✅ 成功（create: auth != null） |
| F-10 | Alice where 查询 families | Alice | `db.collection('families').where({members:'uid_alice'}).get()` | ✅ 返回 Family-A（成员可读） |

### 模块 3：`babies` 集合安全规则（CUSTOM + get() 交叉校验）— 12 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| B-01 | Alice 读取 Baby-X（同家庭） | Alice | `db.collection('babies').where({familyId:'fam_A'}).get()` | ✅ 返回 Baby-X |
| B-02 | Bob 读取 Baby-X（同家庭 editor） | Bob | `db.collection('babies').where({familyId:'fam_A'}).get()` | ✅ 返回 Baby-X |
| B-03 | Carol 读取 Baby-X（同家庭 viewer） | Carol | `db.collection('babies').where({familyId:'fam_A'}).get()` | ✅ 返回 Baby-X |
| B-04 | Dave 读取 Baby-X（不同家庭） | Dave | `db.collection('babies').where({familyId:'fam_A'}).get()` | ❌ 空结果或 PERMISSION_DENIED |
| B-05 | Dave 通过 doc(baby_x) 直接读取 | Dave | `db.collection('babies').doc('baby_x').get()` | ❌ PERMISSION_DENIED |
| B-06 | Frank 读取 Baby-X（无家庭） | Frank | `db.collection('babies').where({familyId:'fam_A'}).get()` | ❌ 空结果或 PERMISSION_DENIED |
| B-07 | Alice（创建者）更新 Baby-X | Alice | `db.collection('babies').doc('baby_x').update({name:'新名'})` | ✅ 成功（`_openid == auth.openid`） |
| B-08 | Bob（非创建者）更新 Baby-X | Bob | `db.collection('babies').doc('baby_x').update({name:'恶意改名'})` | ❌ PERMISSION_DENIED |
| B-09 | Alice 客户端删除 Baby-X | Alice | `db.collection('babies').doc('baby_x').remove()` | ❌ PERMISSION_DENIED（delete: false） |
| B-10 | 不带 familyId 查询 babies | Alice | `db.collection('babies').where({name:'宝宝'}).get()` | ❌ PERMISSION_DENIED（缺少 get() 必需字段） |
| B-11 | 家庭被解散后读取 babies | Alice | 解散 fam_A 后 `db.collection('babies').where({familyId:'fam_A'}).get()` | ❌ PERMISSION_DENIED（get() 找不到 families 文档） |
| B-12 | 认证用户创建 babies 文档 | Frank | `db.collection('babies').add({data:{familyId:'fam_A',name:'test'}})` | ✅ 成功（create: auth != null） |

### 模块 4：`records` 集合安全规则（CUSTOM + get() 交叉校验）— 16 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| R-01 | Alice 读取 Baby-X 记录（同家庭 admin） | Alice | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ✅ 返回所有记录（含 Bob 创建的） |
| R-02 | Bob 读取 Baby-X 记录（同家庭 editor） | Bob | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ✅ 返回所有记录（含 Alice 创建的） |
| R-03 | Carol 读取 Baby-X 记录（同家庭 viewer） | Carol | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ✅ 返回所有记录 |
| R-04 | Dave 读取 Baby-X 记录（不同家庭） | Dave | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ❌ 空结果或 PERMISSION_DENIED |
| R-05 | Frank 读取 Baby-X 记录（无家庭） | Frank | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ❌ 空结果或 PERMISSION_DENIED |
| R-06 | Alice 创建记录（带 familyId） | Alice | `records.add({data:{babyId:'baby_x',familyId:'fam_A',recordType:'feeding'}})` | ✅ 成功 |
| R-07 | Dave 创建记录（带错误 familyId） | Dave | `records.add({data:{babyId:'baby_x',familyId:'fam_A',recordType:'feeding'}})` | ✅ 成功（create: auth != null，但读不回来） |
| R-08 | Alice 更新自己创建的记录 | Alice | `records.doc(alice_record_id).update({note:'修改'})` | ✅ 成功 |
| R-09 | Bob 更新 Alice 创建的记录 | Bob | `records.doc(alice_record_id).update({note:'恶意修改'})` | ❌ PERMISSION_DENIED |
| R-10 | Alice 删除自己创建的记录 | Alice | `records.doc(alice_record_id).remove()` | ✅ 成功 |
| R-11 | Bob 删除 Alice 创建的记录 | Bob | `records.doc(alice_record_id).remove()` | ❌ PERMISSION_DENIED |
| R-12 | 不带 familyId 查询 records | Alice | `records.where({babyId:'baby_x'}).get()` | ❌ PERMISSION_DENIED（安全规则要求 familyId） |
| R-13 | 带错误 familyId 查询 records | Alice | `records.where({babyId:'baby_x',familyId:'fam_B'}).get()` | ❌ 空结果（fam_B 的 memberOpenids 不含 Alice） |
| R-14 | 缺少 familyId 的孤儿记录不可读 | Alice | 查询 familyId 为空的 records | ❌ get() 校验失败 |
| R-15 | Carol(viewer) 创建记录 | Carol | `records.add({data:{babyId:'baby_x',familyId:'fam_A',recordType:'feeding'}})` | ✅ 成功（安全规则层面允许，业务层 UI 控制） |
| R-16 | 被移除成员读取记录 | Bob被移除后 | `records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ❌ PERMISSION_DENIED（Bob 的 openid 已从 memberOpenids 移除） |

### 模块 5：`vaccine_records` / `milestone_records` 安全规则 — 8 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| V-01 | Alice 读取 Baby-X 疫苗记录 | Alice | `vaccine_records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ✅ 成功 |
| V-02 | Dave 读取 Baby-X 疫苗记录 | Dave | `vaccine_records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ❌ PERMISSION_DENIED |
| V-03 | Bob 更新 Alice 创建的疫苗记录 | Bob | `vaccine_records.doc(alice_vac_id).update({note:'改'})` | ❌ PERMISSION_DENIED |
| V-04 | Alice 删除自己创建的疫苗记录 | Alice | `vaccine_records.doc(alice_vac_id).remove()` | ✅ 成功 |
| M-01 | Alice 读取 Baby-X 里程碑记录 | Alice | `milestone_records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ✅ 成功 |
| M-02 | Dave 读取 Baby-X 里程碑记录 | Dave | `milestone_records.where({babyId:'baby_x',familyId:'fam_A'}).get()` | ❌ PERMISSION_DENIED |
| M-03 | 不带 familyId 查询疫苗记录 | Alice | `vaccine_records.where({babyId:'baby_x'}).get()` | ❌ PERMISSION_DENIED |
| M-04 | 不带 familyId 查询里程碑记录 | Alice | `milestone_records.where({babyId:'baby_x'}).get()` | ❌ PERMISSION_DENIED |

### 模块 6：云函数 `createFamily` — 5 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| CF-01 | 正常创建家庭 | Frank | `{name:'Frank家庭'}` | ✅ success=true, 返回 familyId + memberOpenids 含 Frank 的 openid |
| CF-02 | 未注册用户创建家庭 | Ghost | `{name:'test'}` | ❌ USER_NOT_FOUND |
| CF-03 | 不传 name 创建家庭 | Frank | `{}` | ❌ 或创建成功但 name 为空（取决于校验逻辑） |
| CF-04 | 创建家庭后 inviteCode 格式验证 | Frank | `{name:'test'}` | ✅ inviteCode 为 6 位大写字母+数字（排除 I/O/0/1） |
| CF-05 | 创建家庭后 inviteCodeExpiry 验证 | Frank | `{name:'test'}` | ✅ expiry 为 7 天后 |

### 模块 7：云函数 `joinFamily` — 14 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| JF-01 | 正常加入家庭 | Frank | `{inviteCode:family_A_code,userName:'Frank',relation:'爸爸'}` | ✅ success, role=editor |
| JF-02 | 无效邀请码 | Frank | `{inviteCode:'XXXXXX'}` | ❌ INVALID_CODE |
| JF-03 | 过期邀请码 | Frank | 使用已过期的邀请码 | ❌ CODE_EXPIRED |
| JF-04 | 已是成员再加入 | Alice | 使用 Family-A 邀请码 | ❌ ALREADY_MEMBER |
| JF-05 | 小写邀请码自动转大写 | Frank | `{inviteCode:'abcdef'}` | ✅ 或 ❌ 取决于是否匹配 |
| JF-06 | 限流：60s 内第 6 次 | Frank | 连续 6 次调用 | ❌ RATE_LIMITED |
| JF-07 | 限流：60s 后重置 | Frank | 等待 61s 后再调用 | ✅ 正常响应 |
| JF-08 | 幽灵成员防护：editor 跨家庭加入 | Eve(Family-B editor) | 使用 Family-A 邀请码 | ✅ 自动从 Family-B 移除后加入 Family-A |
| JF-09 | 幽灵成员防护：唯一 admin 被阻止 | Dave(Family-B 唯一 admin) | 使用 Family-A 邀请码 | ❌ SOLE_ADMIN |
| JF-10 | 幽灵成员防护：有其他 admin 时允许 | Dave(Family-B 有其他 admin) | 使用 Family-A 邀请码 | ✅ 自动从 B 移除后加入 A |
| JF-11 | 加入后 memberOpenids 包含新成员 | Frank 加入 Family-A | 查询 families 文档 | ✅ memberOpenids 包含 openid_frank |
| JF-12 | 加入后 users.familyId 更新 | Frank 加入 Family-A | 查询 Frank 的 users 文档 | ✅ familyId=fam_A, familyRole=editor |
| JF-13 | 未注册用户加入家庭 | Ghost | `{inviteCode:valid_code}` | ❌ USER_NOT_FOUND |
| JF-14 | 从旧家庭移除后 memberOpenids 不含旧成员 | Eve 跨家庭加入 | 查询 Family-B 文档 | ✅ memberOpenids 不含 openid_eve |

### 模块 8：云函数 `removeMember` — 8 条

| TC# | 测试标题 | 操作者 | 目标 | 预期结果 |
|-----|---------|--------|------|----------|
| RM-01 | Admin 移除 editor | Alice | Bob | ✅ success, Bob 的 familyId 被清除 |
| RM-02 | Admin 移除 viewer | Alice | Carol | ✅ success |
| RM-03 | Editor 移除他人 | Bob | Carol | ❌ PERMISSION_DENIED |
| RM-04 | Viewer 移除他人 | Carol | Bob | ❌ PERMISSION_DENIED |
| RM-05 | Admin 移除自己 | Alice | Alice | ❌ CANNOT_REMOVE_SELF |
| RM-06 | Admin 移除其他 admin | Alice 有双 admin | 另一个 admin | ❌ CANNOT_REMOVE_ADMIN |
| RM-07 | 跨家庭 admin 移除他人 | Dave | Bob(fam_A) | ❌ PERMISSION_DENIED（不在同家庭） |
| RM-08 | 移除后被移除成员读数据 | Bob 被移除后 | Bob 读 records | ❌ PERMISSION_DENIED（openid 已从 memberOpenids 移除） |

### 模块 9：云函数 `dissolveFamily` — 6 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| DF-01 | 创建者解散家庭 | Alice | `{familyId:'fam_A'}` | ✅ success, 所有成员 familyId 被清除 |
| DF-02 | 非创建者 admin 解散家庭 | 转让后的 admin Bob | `{familyId:'fam_A'}` | ❌ PERMISSION_DENIED（仅 creatorId 可解散） |
| DF-03 | Editor 解散家庭 | Bob | `{familyId:'fam_A'}` | ❌ PERMISSION_DENIED |
| DF-04 | Viewer 解散家庭 | Carol | `{familyId:'fam_A'}` | ❌ PERMISSION_DENIED |
| DF-05 | 跨家庭 admin 解散 | Dave | `{familyId:'fam_A'}` | ❌ PERMISSION_DENIED |
| DF-06 | 解散不存在的家庭 | Alice | `{familyId:'nonexistent'}` | ❌ FAMILY_NOT_FOUND |

### 模块 10：云函数 `updateMemberRole` — 8 条

| TC# | 测试标题 | 操作者 | 目标/新角色 | 预期结果 |
|-----|---------|--------|------------|----------|
| UR-01 | 创建者将 editor 改为 viewer | Alice | Bob → viewer | ✅ success, users.familyRole 同步更新 |
| UR-02 | 创建者将 viewer 改为 editor | Alice | Carol → editor | ✅ success |
| UR-03 | 创建者将 editor 改为 admin | Alice | Bob → admin | ✅ success |
| UR-04 | 非创建者 admin 修改角色 | 被授权 admin Bob | Carol → viewer | ❌ PERMISSION_DENIED（仅 creatorId 可修改） |
| UR-05 | Editor 修改角色 | Bob | Carol → admin | ❌ PERMISSION_DENIED |
| UR-06 | 跨家庭 admin 修改角色 | Dave | Bob(fam_A) → viewer | ❌ PERMISSION_DENIED |
| UR-07 | 修改不存在家庭的角色 | Alice | `familyId:'nonexistent'` | ❌ FAMILY_NOT_FOUND |
| UR-08 | 乐观锁并发测试 | Alice 同时修改 | 两个并发请求 | ✅ 至少一个成功，最多重试 2 次 |

### 模块 11：云函数 `transferAdmin` — 7 条

| TC# | 测试标题 | 操作者 | 新 admin | 预期结果 |
|-----|---------|--------|----------|----------|
| TA-01 | Admin 转让给 editor | Alice | Bob | ✅ Alice→editor, Bob→admin, creatorId 更新 |
| TA-02 | Admin 转让给 viewer | Alice | Carol | ✅ success |
| TA-03 | Editor 尝试转让 | Bob | Carol | ❌ PERMISSION_DENIED |
| TA-04 | 转让给非成员 | Alice | Dave(fam_B) | ❌ NOT_MEMBER |
| TA-05 | 跨家庭 admin 尝试转让 | Dave | Bob | ❌ PERMISSION_DENIED |
| TA-06 | 转让后双方 users.familyRole 一致性 | Alice→Bob | 查询双方 users 文档 | ✅ Alice.familyRole=editor, Bob.familyRole=admin |
| TA-07 | 转让后新 admin 可执行管理操作 | Bob（新 admin） | refreshInviteCode | ✅ 成功（但 dissolveFamily 需 creatorId=Bob） |

### 模块 12：云函数 `leaveFamily` — 9 条

| TC# | 测试标题 | 操作者 | 场景 | 预期结果 |
|-----|---------|--------|------|----------|
| LF-01 | Editor 正常退出 | Bob | 3 人家庭 | ✅ success, memberOpenids 不含 Bob |
| LF-02 | Viewer 正常退出 | Carol | 3 人家庭 | ✅ success |
| LF-03 | 唯一 admin 退出（还有其他成员） | Alice | 3 人家庭 | ❌ needTransfer=true |
| LF-04 | 唯一 admin 退出（无其他成员） | Alice | 1 人家庭 | ✅ familyDissolved=true, 家庭文档被删 |
| LF-05 | 有其他 admin 的 admin 退出 | Alice | Alice+Bob 都是 admin | ✅ success |
| LF-06 | 家庭已不存在时退出 | Alice | fam_A 已删除 | ✅ familyNotFound=true |
| LF-07 | 非成员退出 | Dave | 尝试退出 fam_A | ✅ notMember=true |
| LF-08 | 退出后 users.familyId 被清除 | Bob 退出后 | 查询 Bob 的 users | ✅ familyId 已删除 |
| LF-09 | 退出后无法读取原家庭数据 | Bob 退出后 | 读取 fam_A 的 records | ❌ PERMISSION_DENIED |

### 模块 13：云函数 `refreshInviteCode` — 5 条

| TC# | 测试标题 | 操作者 | 预期结果 |
|-----|---------|--------|----------|
| RI-01 | Admin 刷新邀请码 | Alice | ✅ 返回新 inviteCode，与旧码不同 |
| RI-02 | Editor 刷新邀请码 | Bob | ❌ PERMISSION_DENIED |
| RI-03 | Viewer 刷新邀请码 | Carol | ❌ PERMISSION_DENIED |
| RI-04 | 跨家庭 admin 刷新 | Dave | ❌ PERMISSION_DENIED（不在 fam_A） |
| RI-05 | 刷新后旧邀请码失效 | Frank | 使用旧码加入 → ❌ INVALID_CODE |

### 模块 14：云函数 `validateInviteCode` / `getFamilyByUserId` — 6 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| VI-01 | 验证有效邀请码 | Frank | Family-A 的有效码 | ✅ valid=true, familyName + memberCount |
| VI-02 | 验证无效邀请码 | Frank | `'XXXXXX'` | ✅ valid=false, reason='邀请码无效' |
| VI-03 | 验证过期邀请码 | Frank | 过期的码 | ✅ valid=false, reason='邀请码已过期' |
| VI-04 | 未注册用户验证邀请码 | Ghost | 有效码 | ❌ USER_NOT_FOUND |
| GF-01 | 获取有家庭的用户的家庭信息 | Alice | 无参数 | ✅ 返回 Family-A 信息 |
| GF-02 | 获取无家庭的用户的家庭信息 | Frank | 无参数 | ✅ 返回 null |

### 模块 15：云函数 `createBaby` / `deleteBaby` — 8 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| CB-01 | 家庭成员创建宝宝 | Alice | `{familyId:'fam_A',name:'测试宝宝',gender:'female'}` | ✅ success, families.babies 包含新 babyId |
| CB-02 | Editor 创建宝宝 | Bob | 同上 | ✅ success（成员即可创建） |
| CB-03 | Viewer 创建宝宝 | Carol | 同上 | ✅ success（云函数仅校验成员，不校验角色） |
| CB-04 | 非成员创建宝宝 | Dave | `{familyId:'fam_A',name:'恶意'}` | ❌ PERMISSION_DENIED |
| CB-05 | 未注册用户创建宝宝 | Ghost | 任意参数 | ❌ USER_NOT_FOUND |
| DB-01 | 家庭成员删除宝宝 | Alice | `{babyId:'baby_x',familyId:'fam_A'}` | ✅ success, families.babies 不含 baby_x |
| DB-02 | 非成员删除宝宝 | Dave | `{babyId:'baby_x',familyId:'fam_A'}` | ❌ PERMISSION_DENIED |
| DB-03 | Editor 删除宝宝 | Bob | 同 DB-01 | ✅ success（成员即可删除） |

### 模块 16：云函数 `clearBabyData` — 8 条

| TC# | 测试标题 | 操作者 | 参数 | 预期结果 |
|-----|---------|--------|------|----------|
| CD-01 | Admin 清除宝宝数据 | Alice | `{babyId:'baby_x',familyId:'fam_A'}` | ✅ 删除所有 records/vaccine/milestone + baby |
| CD-02 | Editor 清除宝宝数据 | Bob | 同上 | ❌ PERMISSION_DENIED（仅 admin） |
| CD-03 | Viewer 清除宝宝数据 | Carol | 同上 | ❌ PERMISSION_DENIED |
| CD-04 | Admin 清除包括他人创建的记录 | Alice | Baby-X 有 Bob 创建的记录 | ✅ 全部删除（admin SDK） |
| CD-05 | 跨家庭 admin 清除 | Dave | `{babyId:'baby_x',familyId:'fam_A'}` | ❌ PERMISSION_DENIED |
| CD-06 | 清除最后一个宝宝后自动解散 | Alice | Family-A 仅剩 1 个宝宝 | ✅ familyDeleted=true, 所有成员 familyId 被清除 |
| CD-07 | 清除非最后一个宝宝 | Alice | Family-A 有 2 个宝宝 | ✅ familyDeleted=false |
| CD-08 | 清除不存在家庭的宝宝 | Alice | `{familyId:'nonexistent'}` | ❌ FAMILY_NOT_FOUND |

### 模块 17：云函数通用错误处理 — 5 条

| TC# | 测试标题 | 操作 | 预期结果 |
|-----|---------|------|----------|
| GE-01 | 未知 action | `{action:'hackAction'}` | ❌ INVALID_ACTION |
| GE-02 | 不传 action | `{}` | ❌ INVALID_ACTION |
| GE-03 | 不传 params | `{action:'joinFamily'}` | ❌ 校验失败或适当错误 |
| GE-04 | 未注册用户调用任何 action | Ghost | ❌ USER_NOT_FOUND |
| GE-05 | action 参数为空字符串 | `{action:''}` | ❌ INVALID_ACTION |

### 模块 18：跨家庭数据隔离验证 — 10 条

| TC# | 测试标题 | 操作者 | 操作 | 预期结果 |
|-----|---------|--------|------|----------|
| ISO-01 | Family-A 成员读 Family-B 的 records | Alice | `records.where({familyId:'fam_B',babyId:'baby_y'}).get()` | ❌ 空/DENIED |
| ISO-02 | Family-A 成员读 Family-B 的 babies | Alice | `babies.where({familyId:'fam_B'}).get()` | ❌ 空/DENIED |
| ISO-03 | Family-A 成员读 Family-B 的 vaccine_records | Alice | `vaccine_records.where({familyId:'fam_B',babyId:'baby_y'}).get()` | ❌ 空/DENIED |
| ISO-04 | Family-A 成员读 Family-B 的 milestone_records | Alice | `milestone_records.where({familyId:'fam_B',babyId:'baby_y'}).get()` | ❌ 空/DENIED |
| ISO-05 | Family-B 成员读 Family-A 的 records | Dave | `records.where({familyId:'fam_A',babyId:'baby_x'}).get()` | ❌ 空/DENIED |
| ISO-06 | Family-A admin 对 Family-B 执行 removeMember | Alice | removeMember on fam_B | ❌ PERMISSION_DENIED |
| ISO-07 | Family-A admin 对 Family-B 执行 dissolveFamily | Alice | dissolveFamily on fam_B | ❌ PERMISSION_DENIED |
| ISO-08 | Family-A admin 对 Family-B 执行 clearBabyData | Alice | clearBabyData on baby_y | ❌ PERMISSION_DENIED |
| ISO-09 | Family-A admin 对 Family-B 执行 createBaby | Alice | createBaby on fam_B | ❌ PERMISSION_DENIED |
| ISO-10 | 同一 babyId 不同 familyId 查询隔离 | Alice/Dave | 各自 familyId 查询 | ✅ 各自仅返回自己家庭的数据 |

### 模块 19：成员状态变更后的数据可见性 — 6 条

| TC# | 测试标题 | 场景 | 操作 | 预期结果 |
|-----|---------|------|------|----------|
| SV-01 | 成员被移除后立即读数据 | Alice removeMember(Bob) | Bob 读 records | ❌ PERMISSION_DENIED |
| SV-02 | 成员退出后立即读数据 | Bob leaveFamily | Bob 读 families doc | ❌ PERMISSION_DENIED |
| SV-03 | 成员角色从 editor 降为 viewer 后读数据 | Alice updateRole(Bob,viewer) | Bob 读 records | ✅ 仍可读（viewer 可读） |
| SV-04 | 成员角色从 viewer 升为 editor 后写数据 | Alice updateRole(Carol,editor) | Carol 创建 record | ✅ 成功 |
| SV-05 | 新加入成员立即读数据 | Frank joinFamily(fam_A) | Frank 读 records | ✅ 成功（openid 已加入 memberOpenids） |
| SV-06 | 家庭解散后所有成员读数据 | Alice dissolveFamily | Alice+Bob+Carol 读 records | ❌ 全部 PERMISSION_DENIED |

---

## 四、非功能需求

### NFR-1：测试环境要求
- 使用独立的 CloudBase 测试环境或在现有环境中使用测试前缀数据
- 每个测试用例执行前确保数据状态干净（setup/teardown）

### NFR-2：测试覆盖率
- 6 个集合 × 4 种操作（CRUD）= 24 种组合全覆盖
- 3 种角色 × 13 个 action = 39 种权限组合覆盖
- 跨家庭隔离至少覆盖所有集合

### NFR-3：执行方式
- 测试用例以 Node.js 脚本形式编写
- 使用 `wx-server-sdk` 的 admin SDK 模拟不同用户身份
- 通过云函数内部调用或直接数据库操作验证安全规则

---

## 五、测试数据准备清单

1. 创建 7 个测试用户（Alice~Ghost）
2. 创建 2 个家庭（Family-A/B），配置成员和角色
3. 创建 2 个宝宝（Baby-X/Y）
4. 为 Baby-X 创建：3 条 records（Alice 创建 2 条，Bob 创建 1 条），2 条 vaccine_records，1 条 milestone_records
5. 为 Baby-Y 创建：2 条 records（Dave 创建）
6. 确保所有 records 文档有 familyId 字段
7. 确保所有 families 文档有 memberOpenids 字段

---

*文档维护：测试执行后根据实际结果更新预期。*
