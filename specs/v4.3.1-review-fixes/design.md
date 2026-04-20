# 设计文档 - v4.3.1 Review 修复

> 版本：v1.0 | 日期：2026-04-20 | 状态：进行中

## 一、架构概览

### 1.1 整体修复策略

本次为 PATCH 级别，**不新增模块、不改变架构分层**，仅对既有实现做针对性修补。修复分三类：

1. **权限校验错位**（FR-2 / FR-6 / FR-8 / FR-9 / FR-12 / FR-13）—— 云函数 action 或客户端 guard 的判定条件与权限矩阵对齐
2. **数据完整性**（FR-1 / FR-3 / FR-5 / FR-7 / FR-11）—— 关键字段补齐、级联清理、避免脏数据
3. **状态机 / 契约对齐**（FR-4 / FR-10 / FR-14 / FR-15）—— 调用方按新契约处理返回值

### 1.2 部署风险

| 风险类别 | 具体风险 | 应对策略 |
|---------|---------|---------|
| 云函数先行 | 客户端旧版本调用新 action（如 createBaby 的 _openid 字段要求） | 新增字段向后兼容，旧客户端仍可调 |
| 权限收紧 | viewer 之前能创建宝宝，收紧后突然 403 | 版本发布前 changelog 告知 + 云端同步 |
| 默认 viewer | 老数据无 memberDetails 用户短暂无法写 | 登录时通过 `ensureUserReady` 自动刷新修复 |
| 存量无 _openid babies | 创建者无法更新 | 保留兜底：通过云函数 admin 侧做 updateBaby 修复（backlog） |

---

## 二、核心改动详细设计

### 2.1 FR-1：createBaby 写入 _openid

```javascript
// cloudfunctions/familyOperation/actions/createBaby.js

module.exports = async (ctx, params) => {
  const { db, _, userId, openid } = ctx;  // 新增：解构 openid
  // ... 权限校验（改 isAdmin）

  const babyData = {
    _openid: openid,  // ★ FR-1 新增
    familyId,
    // ... 其他字段不变
  };

  const res = await db.collection('babies').add({ data: babyData });
  // ... families.babies push 不变
};
```

### 2.2 FR-2：权限收紧

```javascript
// createBaby.js / deleteBaby.js 入口统一
const { isAdmin } = require('../lib/auth');

if (!isAdmin(userId, family)) {
  return errors.PERMISSION_DENIED('只有管理员才能管理宝宝档案');
}
```

### 2.3 FR-3：deleteBaby 级联删除

**方案 A（选定）**：`deleteBaby` 复用 `clearBabyData` 的删记录逻辑，但**不**执行 clearBabyData 的"家庭解散"收尾。

```javascript
// deleteBaby.js
const { chunkedDelete } = require('../lib/db-helper');

const CHUNK_SIZE = 500;
const TIME_BUDGET_MS = 15000;
const CONCURRENCY = 10;

module.exports = async (ctx, params) => {
  const { db, _, userId, logger } = ctx;
  const { babyId, familyId, cursor } = params;

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();
  if (!isAdmin(userId, family)) return errors.PERMISSION_DENIED('...');

  const startedAt = Date.now();
  const budget = () => Date.now() - startedAt < TIME_BUDGET_MS;

  let state;
  if (!cursor) {
    await logger.start({ babyId, familyId });
    state = { phase: 'records', totalCleared: { records: 0, vaccine: 0, milestone: 0 } };
  } else {
    state = JSON.parse(cursor);
  }

  // Phase 1-3：clearRecordsByBabyId（records / vaccine / milestone）
  // 完全复刻 clearBabyData 逻辑
  // ...

  // Phase 4：finalize — 只 remove baby + pull families.babies，不删 family
  if (state.phase === 'finalize') {
    await db.collection('babies').doc(babyId).remove();
    await db.collection('families').doc(familyId).update({
      data: { babies: _.pull(babyId), updatedAt: now, updatedAtTs: nowTs }
    });
    await logger.succeed({ status: 'succeeded', ...state.totalCleared });
    return errors.ok({ status: 'succeeded', deletedBabyId: babyId, ...state.totalCleared });
  }
};
```

**决策理由**：不直接在 clearBabyData 中加"保留 family"分支，因为 clearBabyData 语义上是"清空宝宝所有数据+收尾"。deleteBaby 语义更清晰的独立 action 更适合级联删。代码量少量重复，但清晰度高。

**简化方案（备选）**：抽取 `lib/clear-baby-records.js` 工具函数，被两处复用。实施时视复杂度决定。

### 2.4 FR-4：clearAllCloudData 循环 in_progress

```javascript
// settings.js.clearAllCloudData
async clearAllCloudData() {
  // ... 确认弹窗

  wx.showLoading({ title: '清除中...', mask: true });

  try {
    let cursor = null;
    let totalCleared = { records: 0, vaccine: 0, milestone: 0 };
    let familyDeleted = false;
    const maxIterations = 10;  // 安全上限

    for (let i = 0; i < maxIterations; i++) {
      const callRes = await wx.cloud.callFunction({
        name: 'familyOperation',
        data: { action: 'clearBabyData', params: { babyId, familyId, cursor } }
      });
      const result = callRes.result;
      if (!result.success) throw new Error(result.error?.message || '删除失败');

      const data = result.data;

      // 累加统计
      if (data.status === 'succeeded') {
        totalCleared.records = data.records || 0;
        totalCleared.vaccine = data.vaccine || 0;
        totalCleared.milestone = data.milestone || 0;
        familyDeleted = data.familyDeleted;
        break;
      } else if (data.status === 'in_progress') {
        cursor = data.cursor;
        totalCleared = data.progress || totalCleared;
        wx.showLoading({
          title: `清除中...${totalCleared.records}`,
          mask: true
        });
      } else {
        throw new Error('未知状态: ' + data.status);
      }
    }

    if (!familyDeleted && cursor) {
      // 超过上限仍未完成 → 保留 cursor，提示用户
      wx.setStorageSync('_clear_baby_cursor', { babyId, familyId, cursor });
      wx.hideLoading();
      wx.showModal({
        title: '数据较多',
        content: `已清除 ${totalCleared.records} 条记录，剩余部分可稍后继续。`
      });
      return;
    }

    wx.clearStorageSync();
    wx.hideLoading();
    wx.showToast({ title: '删除成功', icon: 'success' });
    // ... reLaunch
  } catch (err) { /* ... */ }
}
```

### 2.5 FR-5：removeMember openid 兜底

```javascript
// removeMember.js
const targetUser = await db.collection('users').doc(targetUserId).get().catch(() => null);
const targetOpenid = targetUser && targetUser.data && targetUser.data._openid;

const updateData = {
  members: _.pull(targetUserId),
  memberDetails: _.pull({ userId: targetUserId }),
  updatedAt: now,
  updatedAtTs: nowTs
};

if (targetOpenid) {
  updateData.memberOpenids = _.pull(targetOpenid);
} else {
  // 记录告警，由 patrolMemberOpenids 后续修复
  await ctx.logger.start({ familyId, targetUserId });
  await ctx.logger.step('missing_target_openid', 'skip', { targetUserId });
}

await db.collection('families').doc(familyId).update({ data: updateData });
```

### 2.6 FR-6：默认角色 viewer

```javascript
// utils/permission.js
static getUserRole(userId, family) {
  if (!userId || !family) return 'viewer';  // 改：不再 editor

  if (family.memberDetails && Array.isArray(family.memberDetails)) {
    const member = family.memberDetails.find(m => m.userId === userId);
    if (member && member.role) return member.role;
  }

  // fallback: 创建者默认 admin（兼容旧数据）
  if (family.creatorId === userId) return 'admin';

  // 历史无 memberDetails 且非创建者 → viewer（最小权限）
  return 'viewer';  // 改：不再 editor
}
```

### 2.7 FR-7：updatedAtTs 补齐

```javascript
// services/record.js updateRecord
await this.recordCollection.doc(recordId).update({
  data: {
    ...data,
    updatedAt: this.db.serverDate(),
    updatedAtTs: Date.now()  // ★ 新增
  }
});

// services/sync.js executeOperation(update)
await this.db.collection(collection).doc(recordId).update({
  data: {
    ...data,
    updatedAt: this.db.serverDate(),
    updatedAtTs: Date.now()  // ★ 新增
  }
});
```

### 2.8 FR-8：updateMemberRole 参数校验

```javascript
// updateMemberRole.js
const VALID_ROLES = ['admin', 'editor', 'viewer'];

async function updateMemberRole(ctx, params, retryCount = 0) {
  const { db, userId } = ctx;
  const { familyId, targetUserId, role } = params;

  if (!VALID_ROLES.includes(role)) {
    return errors.INVALID_ROLE(role);  // 新增错误码
  }

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();

  if (!isAdmin(userId, family)) {  // 改：从 creatorId 改为 isAdmin
    return errors.PERMISSION_DENIED('只有管理员才能修改成员权限');
  }

  // 新增：禁止把最后一个 admin 降级
  if (targetUserId === userId && role !== 'admin') {
    const hasOther = PermissionUtil.hasOtherAdmin(family, userId);  // 引入工具
    // 实际上云函数 lib 中无 PermissionUtil，手写逻辑：
    const hasOtherAdmin = (family.memberDetails || []).some(
      m => m.role === 'admin' && m.userId !== userId
    );
    if (!hasOtherAdmin) {
      return errors.SOLE_ADMIN();
    }
  }

  // 继续原逻辑...
}
```

### 2.9 FR-9：dissolveFamily 改 isAdmin

```javascript
// dissolveFamily.js
const { isAdmin } = require('../lib/auth');

if (!isAdmin(userId, family)) {
  return errors.PERMISSION_DENIED('只有管理员才能解散家庭');
}
```

### 2.10 FR-10：createFamily 防重复

```javascript
// createFamily.js
module.exports = async (ctx, params) => {
  const { db, user } = ctx;

  if (user && user.familyId) {
    // 检查 familyId 指向是否有效
    const existing = await getFamily(db, user.familyId);
    if (existing && (existing.members || []).includes(user._id)) {
      return errors.ALREADY_IN_FAMILY();  // 新增错误码
    }
    // 幽灵引用（指向的 family 已删除或已非成员）→ 允许创建
  }

  // 继续原逻辑...
};
```

### 2.11 FR-12：vaccine/milestone 页 CRUD 加权限

```javascript
// vaccine.js (add 示例)
const { PermissionGuard } = require('../../../services/permission-guard');
const FamilyContext = require('../../../utils/family-context');

async addVaccine(vaccine) {
  try {
    PermissionGuard.require('record.create');  // ★ 新增
    // ...
    await db.collection('vaccine_records').add({
      data: {
        babyId: baby._id,
        familyId: FamilyContext.resolveForBaby(baby),  // ★ FR-15 统一
        name: vaccine.name,
        dose: vaccine.dose,
        vaccinatedDate,
        note: '',
        createdAt: new Date(),
        createdAtTs: Date.now(),
        updatedAt: new Date(),
        updatedAtTs: Date.now()  // ★ 补齐双时间戳
      }
    });
  } catch (err) {
    if (err.code === 'PERMISSION_DENIED') {
      wx.showToast({ title: err.message, icon: 'none' });
      return;
    }
    throw err;
  }
}
```

### 2.12 FR-13：record.batchDelete 归属校验

```javascript
// record.js batchDelete
async batchDelete() {
  const { selectedRecords } = this.data;
  if (selectedRecords.length === 0) return;

  const { PermissionGuard } = require('../../services/permission-guard');
  const recordService = RecordService.getInstance();

  // 按 _id 取出当前列表中的 record 对象（需要 createdBy 信息）
  const allRecords = this.data.records || [];
  const recordMap = new Map(allRecords.map(r => [r._id, r]));

  const deletable = [];
  const skipped = [];
  selectedRecords.forEach(id => {
    const record = recordMap.get(id);
    if (!record) return;
    if (PermissionGuard.checkCanDelete(record)) {
      deletable.push(id);
    } else {
      skipped.push(id);
    }
  });

  if (deletable.length === 0) {
    wx.showToast({ title: '选中记录均无权限删除', icon: 'none' });
    return;
  }

  const res = await wx.showModal({
    title: '确认删除',
    content: skipped.length > 0
      ? `将删除 ${deletable.length} 条，其中 ${skipped.length} 条他人记录已跳过。`
      : `确定删除选中的 ${deletable.length} 条记录吗？`,
  });
  if (!res.confirm) return;

  wx.showLoading({ title: '删除中...', mask: true });
  await batchExecute(deletable, id => recordService.deleteRecord(id));
  wx.hideLoading();
  wx.showToast({
    title: skipped.length > 0
      ? `已删 ${deletable.length}，跳过 ${skipped.length}`
      : '删除成功',
    icon: 'success'
  });
  this.setData({ manageMode: false, selectedRecords: [] });
  this.loadData(true);
}
```

### 2.13 FR-14/15：leaveFamily 状态机迁移

```javascript
// family.js transferAndLeave
async transferAndLeave() {
  // ... transferAdmin
  const leaveResult = await this.familyService.leaveFamily(familyInfo._id, currentUserId);

  if (leaveResult.status !== 'ok' && leaveResult.status !== 'dissolved') {
    wx.hideLoading();
    wx.showToast({
      title: leaveResult.message || '退出失败，请重试',
      icon: 'none'
    });
    return;
  }

  StorageUtil.clear();
  wx.hideLoading();
  wx.reLaunch({ url: '/pages/auth/auth' });
}

// auth.js _handleInviteCodeForExistingUser
const leaveResult = await familyService.leaveFamily(userInfo.familyId, userInfo._id);
if (leaveResult.status === 'need_transfer') {  // 改：从 !success && needTransfer
  // ...
}
```

### 2.14 FR-18：patrolMemberOpenids 反向漂移

```javascript
// patrolMemberOpenids/index.js 新增阶段 2
// === 阶段 1：原有 families → users 核对 ===
// ...

// === 阶段 2：users → families 反向核对 ===
const userBatchSize = 50;
let userSkip = 0;
let hasMoreUsers = true;
while (budget() && hasMoreUsers) {
  const batch = await db.collection('users')
    .where({ familyId: _.exists(true) })
    .skip(userSkip).limit(userBatchSize).get();
  if (batch.data.length === 0) break;

  for (const user of batch.data) {
    if (!user.familyId) continue;
    try {
      const family = await db.collection('families').doc(user.familyId).get();
      const f = family.data;
      if (!f || !(f.members || []).includes(user._id)) {
        stats.reverseDrift = (stats.reverseDrift || 0) + 1;
        stats.warnings.push(
          `user=${user._id} familyId=${user.familyId} not in family.members`
        );
      }
    } catch (e) {
      // 家庭文档不存在 → 幽灵引用
      stats.reverseDrift = (stats.reverseDrift || 0) + 1;
      stats.warnings.push(`user=${user._id} familyId=${user.familyId} family not found`);
    }
  }

  userSkip += batch.data.length;
  if (batch.data.length < userBatchSize) hasMoreUsers = false;
}
```

---

## 三、错误码新增

```javascript
// cloudfunctions/familyOperation/errors.js
module.exports.ALREADY_IN_FAMILY = () => ({
  success: false,
  error: { code: 'ALREADY_IN_FAMILY', message: '您已属于某个家庭，请先退出当前家庭' }
});

module.exports.INVALID_ROLE = (role) => ({
  success: false,
  error: { code: 'INVALID_ROLE', message: `无效的角色：${role}` }
});
```

---

## 四、文档变更

| 文档 | 改动 | 涉及 FR |
|------|------|---------|
| `data-model.md` | operation_logs.status 枚举更新；rate_limits.windowStart 改 number 且移除 windowStartTs | FR-17 |
| `service-api.md` | BabyService.deleteBaby 说明级联删 + in_progress 契约 | FR-3 |
| `coding-conventions.md` | 默认角色 viewer 的安全原则 | FR-6 |
| `architecture.md` | 6.5 节 "权限纵深防御" 新增"客户端安全网"条目 | FR-6/FR-13 |
| `CHANGELOG.md` | v4.3.1 区块（Fixed/Changed/Security） | — |

---

## 五、文件变更清单

| # | 文件路径 | 改动类型 | FR |
|---|----------|----------|-----|
| 1 | cloudfunctions/familyOperation/errors.js | 增量 | 8,10 |
| 2 | cloudfunctions/familyOperation/actions/createBaby.js | 小改 | 1,2 |
| 3 | cloudfunctions/familyOperation/actions/deleteBaby.js | 大改 | 2,3 |
| 4 | cloudfunctions/familyOperation/actions/createFamily.js | 小改 | 10 |
| 5 | cloudfunctions/familyOperation/actions/removeMember.js | 小改 | 5 |
| 6 | cloudfunctions/familyOperation/actions/updateMemberRole.js | 小改 | 8 |
| 7 | cloudfunctions/familyOperation/actions/dissolveFamily.js | 小改 | 9 |
| 8 | cloudfunctions/familyOperation/actions/clearBabyData.js | 小改 | 11 |
| 9 | cloudfunctions/patrolMemberOpenids/index.js | 大改 | 18 |
| 10 | miniprogram/app.js | 小改 | 16 |
| 11 | miniprogram/utils/permission.js | 小改 | 6 |
| 12 | miniprogram/services/record.js | 小改 | 7,19 |
| 13 | miniprogram/services/sync.js | 小改 | 7 |
| 14 | miniprogram/pages/auth/auth.js | 小改 | 15,20 |
| 15 | miniprogram/pages/record/record.js | 小改 | 13 |
| 16 | miniprogram/packageSocial/pages/family/family.js | 小改 | 14 |
| 17 | miniprogram/packageSocial/pages/settings/settings.js | 大改 | 4 |
| 18 | miniprogram/packageGrowth/pages/vaccine/vaccine.js | 小改 | 12 |
| 19 | miniprogram/packageGrowth/pages/milestone/milestone.js | 小改 | 12 |
| 20 | cloudfunctions/e2eSecurityTest/modules/m21-v431Fixes.js | 新建 | NFR-2 |
| 21 | cloudfunctions/e2eSecurityTest/v43-prod/* | 同步 | — |
| 22 | data-model.md | 小改 | 17 |
| 23 | service-api.md | 小改 | 3 |
| 24 | coding-conventions.md | 小改 | 6 |
| 25 | architecture.md | 小改 | 6,13 |
| 26 | CHANGELOG.md | 增量 | 全部 |

---

## 六、关键设计决策

### 决策 1：deleteBaby 是否复用 clearBabyData

- 方案 A（选定）：独立实现 deleteBaby 的级联删除，复用 `chunkedDelete` 工具
- 方案 B（弃用）：clearBabyData 内加参数 `keepFamily: true`
- 理由：A 更清晰，清除数据 vs 删除宝宝是两个不同的业务意图；避免 clearBabyData 承担太多职责

### 决策 2：默认角色 viewer vs editor

- 方案 A（选定）：默认 viewer（最小权限）
- 方案 B（弃用）：继续 editor 兼容
- 理由：v4.2 迁移已补齐 memberDetails，此分支理论上不应触发；触发即意味着异常态（被踢缓存未同步/脏数据），此时给最小权限最安全

### 决策 3：rate_limits 文档对齐 vs 代码补字段

- 方案 A（选定）：文档改为对齐代码（windowStart: number，移除 windowStartTs）
- 方案 B（弃用）：代码补齐 Date 类型 + windowStartTs
- 理由：已有生产数据存的是 number，修改代码会造成增量数据格式不一致；文档是后写的，改动成本最低

### 决策 4：patrolMemberOpenids 反向漂移是否自动修复

- 方案 A（选定）：仅告警不自动修
- 方案 B（弃用）：自动清理 users.familyId 或反向加入 family.members
- 理由：自动修会误伤"刚注销但数据未删干净"等中间态；先告警观察，再决定后续自动修策略

---

*后续迭代 backlog：*
- *存量无 `_openid` 的 babies 批量修复云函数*
- *clearAllCloudData 断点续传 cursor 持久化到云端*
- *allow multi-admin 的完整语义（当前 updateMemberRole 仍可产生）*
