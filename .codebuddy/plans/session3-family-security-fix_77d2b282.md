---
name: session3-family-security-fix
overview: "Session 3: Family 成员增删改安全修复（M2.5），包含 T-2.6 joinByInviteCode 安全加固、T-2.7 dissolveFamily 成员清理、T-2.8 updateMemberRole 乐观锁 + _clearUserFamilyInfo/removeMember 修正，共 3 个任务全部针对 miniprogram/services/family.js 文件。"
todos:
  - id: t26-join-safety
    content: 修改 family.js joinByInviteCode() 增加旧家庭检查和自动移除逻辑，提交 T-2.6
    status: completed
  - id: t27-dissolve-cleanup
    content: 修改 family.js dissolveFamily() 增加成员 familyId 批量清理，提交 T-2.7
    status: completed
    dependencies:
      - t26-join-safety
  - id: t28-role-lock-fix
    content: 修改 family.js updateMemberRole 增加乐观锁重试和 users 同步，修正 _clearUserFamilyInfo 和 removeMember 的 doc() 调用，提交 T-2.8
    status: completed
    dependencies:
      - t27-dissolve-cleanup
  - id: update-tasks
    content: 更新 tasks.md 将 T-2.6 至 T-2.8 标记为已完成
    status: completed
    dependencies:
      - t28-role-lock-fix
---

## 用户需求

执行 v4.1 迭代的 Session 3（M2.5: Family 成员增删改安全修复），完成 3 个任务：

## 核心功能

1. **T-2.6 joinByInviteCode 安全加固**：在通过邀请码加入家庭前，检查用户是否已属于其他家庭，防止"幽灵成员"（用户加入新家庭后旧家庭 members 仍包含该用户）
2. **T-2.7 dissolveFamily 成员清理**：解散家庭时，批量清除所有成员的 users.familyId/familyRole，确保成员数据一致性
3. **T-2.8 updateMemberRole 乐观锁 + _clearUserFamilyInfo/removeMember 修正**：为权限变更增加并发冲突重试机制，并修正 _clearUserFamilyInfo 和 removeMember 中错误使用 `where(_openid)` 的问题改为 `doc(userId).update()`

每个任务独立 git commit（Conventional Commits 格式），完成后更新 tasks.md 状态

## 技术栈

- 微信小程序原生开发 + CloudBase NoSQL
- 主改动文件：`miniprogram/services/family.js`（单文件 627 行）
- 辅助参考：`miniprogram/utils/permission.js`（只读，不修改）

## 实现方案

本次修改集中在 `miniprogram/services/family.js` 的 4 个方法，均为服务层安全加固，不涉及 UI 变更。按 design.md § 7.1-7.4 的设计规格精确实施。

### T-2.6: joinByInviteCode 安全加固

**策略**：在 `joinByInviteCode()` 方法的"检查是否已经是成员"（第 107-109 行）之后、"添加成员"（第 111 行）之前，插入旧家庭检查逻辑。

**关键决策**：

- 先从旧家庭移除再加入新家庭（D-4 降级策略：如果后续加入失败，用户变成无家庭状态，下次打开时 ensureUserReady 会引导到 auth 页）
- 唯一管理员无法自动移除，必须抛出错误

**依赖的已有方法**（均已验证存在）：

- `this.getFamilyByUserId(userId)` — 第 160-173 行
- `PermissionUtil.isAdmin(userId, family)` — permission.js 第 114 行
- `PermissionUtil.hasOtherAdmin(family, excludeUserId)` — permission.js 第 168 行
- `this._removeSelfFromFamily(familyId, userId)` — 第 590-603 行

### T-2.7: dissolveFamily 成员清理

**策略**：在 `dissolveFamily()` 的 `this.familyCollection.doc(familyId).remove()` 之后（第 328 行），遍历 `family.members` 逐个清除成员的 familyId/familyRole。

**关键决策**：

- D-6：先删除家庭文档再清理成员，其他成员读取时立即得到"家庭不存在"，触发 ensureUserReady 降级处理
- 单个成员清理失败不阻断（try-catch + console.warn），因为成员下次打开时 ensureUserReady 会检测到家庭不存在并自动清理
- 使用 `this.db.command.remove()` 删除字段而非设为 null

### T-2.8: updateMemberRole 乐观锁 + _clearUserFamilyInfo/removeMember 修正

**涉及 3 个方法：**

1. **`updateMemberRole()`**（第 342-371 行）：

- 新增 `_retryCount = 0` 参数
- 检查 `result.stats.updated === 0` 时递归重试（最多 2 次）
- 写入异常时也递归重试
- 完成后用 `doc(targetUserId).update()` 同步 `users.familyRole`

2. **`_clearUserFamilyInfo()`**（第 609-623 行）：

- 从 `this.userCollection.where({ _openid: userId }).update()` 改为 `this.userCollection.doc(userId).update()`
- 原因：`_openid` 是云开发自动注入的创建者标识，不等于 `userId`（即文档 `_id`）

3. **`removeMember()`**（第 296-305 行）：

- 清除被移除用户信息：从 `where({ _openid: targetUserId })` 改为 `doc(targetUserId).update()`

## 实现备注

- **性能**：joinByInviteCode 新增一次 `getFamilyByUserId` 查询（按 members 数组查询），频率极低（用户加入家庭是低频操作），可接受
- **并发安全**：updateMemberRole 乐观锁重试最多 2 次，家庭管理操作频率极低（每周/每月），并发概率极小
- **向后兼容**：所有改动不改变方法签名（updateMemberRole 的 `_retryCount` 有默认值），调用方无需修改
- **错误处理**：dissolveFamily 成员清理和 updateMemberRole 的 users 同步均为 best-effort（失败不阻断主逻辑）

## 目录结构

```
miniprogram/services/
  └── family.js  # [MODIFY] FamilyService 类 — 修改 joinByInviteCode/dissolveFamily/updateMemberRole/_clearUserFamilyInfo/removeMember 共 5 个方法
specs/v4.1-ai-shield-and-share-auth/
  └── tasks.md   # [MODIFY] 将 T-2.6、T-2.7、T-2.8 标记为已完成
```