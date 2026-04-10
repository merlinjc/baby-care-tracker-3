# 实施计划 - 家庭协作功能增强

## Review 备注

### 需求文档修正
1. ~~`removeMember` 和 `updateMemberRole` 标记为"未实现"~~ → 服务层已有基础实现（family.js L256/L307），但前端页面未集成，需标注为"服务层已实现，前端未集成"
2. 家庭页面路径：`pages/family/family`（非 `pages/profile/family/family`）

### 设计文档修正
1. 移除 `inviteCodeMaxUses/inviteCodeUsedCount` 字段 — 邀请码已通过有效期控制，使用次数限制是过度设计
2. Editor 权限调整：Editor 可编辑他人记录 ✅、可删除自己的记录 ✅、不能删除他人记录 ❌（保持原设计）
3. `createdBy` 字段：现有 Record 中 `createdBy` 为 `string`（userId），增强为 `object` 时需做兼容处理

---

## 任务分解

按依赖关系排序，每个任务标注优先级和预估工作量。

### 阶段 1：基础设施（无 UI 依赖）

#### 任务 1.1：创建权限工具类 `utils/permission.js`
**优先级：** P0（所有权限相关功能的基础）
**预估：** 0.5h
**涉及文件：**
- [NEW] `miniprogram/utils/permission.js`

**实现要点：**
- `PermissionUtil.checkPermission(userId, family, permission)` — 基于角色检查权限
- `PermissionUtil.getUserRole(userId, family)` — 获取用户在家庭中的角色
- `PermissionUtil.isAdmin(userId, family)` — 是否是管理员
- `PermissionUtil.canEdit(userId, family)` — 是否可编辑（admin/editor）
- 角色缺失时默认为 `editor`（向后兼容）

**权限矩阵：**
```
| 操作                | admin | editor | viewer |
|---------------------|-------|--------|--------|
| record.view         | ✅     | ✅      | ✅      |
| record.create       | ✅     | ✅      | ❌      |
| record.edit.own     | ✅     | ✅      | ❌      |
| record.edit.other   | ✅     | ✅      | ❌      |
| record.delete.own   | ✅     | ✅      | ❌      |
| record.delete.other | ✅     | ❌      | ❌      |
| member.invite       | ✅     | ❌      | ❌      |
| member.manage       | ✅     | ❌      | ❌      |
| family.dissolve     | ✅     | ❌      | ❌      |
```

**验收标准：**
- 所有权限检查通过
- 角色缺失时默认 editor
- 无 UI 依赖，可独立测试

---

#### 任务 1.2：增强 `models/index.js` 数据类型定义
**优先级：** P0
**预估：** 0.3h
**涉及文件：**
- [MODIFY] `miniprogram/models/index.js`

**实现要点：**
- User typedef: `familyRole` 添加 `'viewer'` 选项
- Family typedef: 补充 `memberDetails` 子结构的完整定义
- Record typedef: `createdBy` 从 `string` 扩展为 `string | {userId, nickName, avatar?}`
- 新增 `generateInviteCode()` 去除易混淆字符（I/O/0/1）— 已在 family.js 页面中实现，统一到 models

---

#### 任务 1.3：增强 `services/family.js` 服务层
**优先级：** P0
**预估：** 1h
**涉及文件：**
- [MODIFY] `miniprogram/services/family.js`

**实现要点：**

1. **`updateMemberRole()` 增强（L307）：**
   - 当前：仅检查 `creatorId === userId`
   - 增强：改用权限检查 `PermissionUtil.isAdmin()`
   - 新增：检查"至少保留一个 admin"约束
   - 新增：同步更新 `users` 集合中的 `familyRole` 字段

2. **`removeMember()` 增强（L256）：**
   - 当前：仅检查 `creatorId === userId`
   - 增强：改用 `PermissionUtil.isAdmin()` 检查
   - 新增：不能移除自己（应使用 leaveFamily）
   - 新增：清除被移除用户的 `users.familyId` 和 `users.familyRole`

3. **`transferAdmin()` 新增：**
   - 将当前 admin 降为 editor，将指定成员升为 admin
   - 更新 `creatorId` 为新 admin
   - 同步更新双方的 `users.familyRole`

4. **`validateInviteCode()` 新增：**
   - 查询 families 集合匹配邀请码
   - 检查有效期
   - 返回家庭基本信息（名称、成员数）不暴露敏感数据

5. **`refreshInviteCode()` 增强（L223）：**
   - 当前：仅检查 `creatorId === userId`
   - 增强：改用 `PermissionUtil.isAdmin()` 检查（支持多 admin）

---

#### 任务 1.4：增强记录服务 `services/record.js` 的 createdBy 处理
**优先级：** P1
**预估：** 0.5h
**涉及文件：**
- [MODIFY] `miniprogram/services/record.js`

**实现要点：**
- 创建记录时自动附加 `createdBy: { userId, nickName, avatar }` 信息
- 查询记录时兼容旧格式（`createdBy` 为 string 时包装为 object）
- 新增辅助方法 `normalizeCreatedBy(record)` 统一 createdBy 格式

---

### 阶段 2：家庭管理页面增强

#### 任务 2.1：家庭管理页 - 成员权限管理 UI
**优先级：** P0
**预估：** 1.5h
**涉及文件：**
- [MODIFY] `miniprogram/pages/family/family.js`
- [MODIFY] `miniprogram/pages/family/family.wxml`
- [MODIFY] `miniprogram/pages/family/family.wxss`

**实现要点：**

1. **成员列表增强：**
   - 显示角色标签：管理员/成员/仅查看（对应 admin/editor/viewer）
   - 当前用户标注"我"
   - 管理员可左滑成员卡片显示操作按钮

2. **权限编辑弹窗（admin 专属）：**
   - 点击成员卡片弹出权限选择菜单
   - 三个选项：管理员 / 成员 / 仅查看
   - 确认对话框说明变更影响
   - 调用 `FamilyService.updateMemberRole()`

3. **移除成员（admin 专属）：**
   - 左滑成员卡片显示"移除"按钮
   - 二次确认对话框
   - 调用 `FamilyService.removeMember()`

4. **邀请码区域增强：**
   - 显示有效期倒计时
   - 过期警告（<24小时变黄色）
   - 仅 admin 可见"重新生成"按钮

5. **权限控制：**
   - 非 admin 隐藏管理操作入口
   - admin 退出时提示先转让管理员或移除所有成员

**验收标准：**
- FR-3.1: 成员列表显示角色、加入时间
- FR-3.2: 权限编辑弹窗正常工作
- FR-3.3: 移除成员二次确认
- FR-1.1: 邀请码有效期显示

---

#### 任务 2.2：管理员退出家庭流程增强
**优先级：** P1
**预估：** 0.5h
**涉及文件：**
- [MODIFY] `miniprogram/pages/family/family.js`

**实现要点：**
- 管理员退出时：
  - 如果是唯一成员 → 提示"退出将解散家庭"
  - 如果还有其他成员 → 提示"请先指定新管理员"
  - 显示成员列表让管理员选择新 admin
  - 调用 `FamilyService.transferAdmin()` 后再退出

**验收标准：**
- FR-5.2: 管理员退出前必须处理管理权限

---

### 阶段 3：记录页面权限控制

#### 任务 3.1：首页记录显示创建者标识
**优先级：** P1
**预估：** 0.8h
**涉及文件：**
- [MODIFY] `miniprogram/pages/home/home.js`
- [MODIFY] `miniprogram/pages/home/home.wxml`
- [MODIFY] `miniprogram/pages/home/home.wxss`

**实现要点：**
- 时间线记录显示创建者信息（头像 + 昵称）
- 当前用户显示"我"
- 已退出成员显示灰色"已退出成员"
- 兼容旧数据（createdBy 为 string 或不存在时）

**验收标准：**
- FR-4.1: 记录创建者标识正确显示

---

#### 任务 3.2：记录页面基于角色的操作权限
**优先级：** P1
**预估：** 1h
**涉及文件：**
- [MODIFY] `miniprogram/pages/record/record.js`
- [MODIFY] `miniprogram/pages/record/record.wxml`

**实现要点：**
- Viewer 角色隐藏"添加记录"FAB 按钮
- Viewer 角色禁用编辑/删除操作，显示"仅查看权限"提示
- Editor 删除他人记录时显示确认对话框
- Admin 可删除任何记录
- 首页快捷入口也需根据角色控制

**验收标准：**
- FR-4.2: Viewer 不可添加/编辑/删除
- FR-4.2: Editor 可操作自己的记录
- FR-4.2: Admin 可操作任何记录

---

#### 任务 3.3：首页基于角色的操作权限
**优先级：** P1
**预估：** 0.5h
**涉及文件：**
- [MODIFY] `miniprogram/pages/home/home.js`
- [MODIFY] `miniprogram/pages/home/home.wxml`

**实现要点：**
- 加载家庭信息时获取当前用户角色
- Viewer 角色隐藏快捷添加记录按钮
- Viewer 角色隐藏时间线编辑/删除滑动操作

---

### 阶段 4：数据加入流程增强

#### 任务 4.1：邀请码加入流程增强
**优先级：** P2
**预估：** 0.8h
**涉及文件：**
- [MODIFY] 加入家庭相关页面（auth 页面中的加入流程）

**实现要点：**
- 输入邀请码后调用 `FamilyService.validateInviteCode()` 预览家庭信息
- 显示家庭名称和成员数量，确认后加入
- 错误提示友好化（无效/过期/已是成员）
- 加入成功后自动加载家庭数据

**验收标准：**
- FR-2.1: 邀请码验证和预览
- FR-2.2: 加入后数据同步

---

#### 任务 4.2：被移除成员检测
**优先级：** P2
**预估：** 0.5h
**涉及文件：**
- [MODIFY] `miniprogram/pages/home/home.js`
- [MODIFY] `miniprogram/app.js`

**实现要点：**
- 首页初始化时验证当前用户是否仍是家庭成员
- 如果 `getFamilyDetail()` 返回的 members 不包含当前用户
  → 显示"您已不在该家庭中"
  → 清理本地家庭数据
  → 引导重新加入或创建家庭

**验收标准：**
- FR-5.3: 被移除成员检测和引导

---

### 阶段 5：数据迁移和收尾

#### 任务 5.1：数据迁移脚本
**优先级：** P2
**预估：** 0.5h
**涉及文件：**
- [NEW] `scripts/migrate-family-roles.js`

**实现要点：**
- 为所有 family 文档中缺少 `role` 的 memberDetails 补充默认值
- creatorId 对应的成员设为 `admin`，其余设为 `editor`
- 可选：为所有 record 文档添加 `createdBy` 对象格式

---

#### 任务 5.2：小程序分享卡片邀请（可选增强）
**优先级：** P3（可选）
**预估：** 0.5h
**涉及文件：**
- [MODIFY] `miniprogram/pages/family/family.js`

**实现要点：**
- FR-1.2：通过 `onShareAppMessage` 生成带邀请码参数的分享卡片
- 被邀请人点击卡片后自动填充邀请码

---

## 实施顺序和依赖图

```
阶段1（基础设施）
  ├── 1.1 permission.js ──┐
  ├── 1.2 models 增强 ────┤
  ├── 1.3 family.js 增强 ─┤
  └── 1.4 record.js 增强 ─┤
                           │
阶段2（家庭页面）←──────────┘
  ├── 2.1 成员权限管理 UI
  └── 2.2 管理员退出增强

阶段3（记录权限）←──────────
  ├── 3.1 首页创建者标识
  ├── 3.2 记录页权限控制
  └── 3.3 首页权限控制

阶段4（加入流程）
  ├── 4.1 邀请码加入增强
  └── 4.2 被移除成员检测

阶段5（收尾）
  ├── 5.1 数据迁移脚本
  └── 5.2 分享卡片邀请（可选）
```

## 工作量估算

| 阶段 | 任务数 | 预估工时 | 优先级 |
|------|--------|---------|--------|
| 阶段 1: 基础设施 | 4 | 2.3h | P0 |
| 阶段 2: 家庭页面 | 2 | 2.0h | P0-P1 |
| 阶段 3: 记录权限 | 3 | 2.3h | P1 |
| 阶段 4: 加入流程 | 2 | 1.3h | P2 |
| 阶段 5: 收尾 | 2 | 1.0h | P2-P3 |
| **合计** | **13** | **~9h** | |

## 涉及文件总览

| 文件 | 操作 | 阶段 |
|------|------|------|
| `utils/permission.js` | NEW | 1.1 |
| `models/index.js` | MODIFY | 1.2 |
| `services/family.js` | MODIFY | 1.3 |
| `services/record.js` | MODIFY | 1.4 |
| `pages/family/family.js` | MODIFY | 2.1, 2.2 |
| `pages/family/family.wxml` | MODIFY | 2.1 |
| `pages/family/family.wxss` | MODIFY | 2.1 |
| `pages/home/home.js` | MODIFY | 3.1, 3.3, 4.2 |
| `pages/home/home.wxml` | MODIFY | 3.1, 3.3 |
| `pages/home/home.wxss` | MODIFY | 3.1 |
| `pages/record/record.js` | MODIFY | 3.2 |
| `pages/record/record.wxml` | MODIFY | 3.2 |
| `app.js` | MODIFY | 4.2 |
| `scripts/migrate-family-roles.js` | NEW | 5.1 |
