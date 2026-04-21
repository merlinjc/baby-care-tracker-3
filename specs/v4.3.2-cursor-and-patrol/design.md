# 设计文档 - v4.3.2 Cursor 云端续传 + Patrol 自修复 + 两轮 Review 修复

> 版本：v1.0 | 日期：2026-04-21 | 状态：🚧 规划中
>
> 对应需求：`specs/v4.3.2-cursor-and-patrol/requirements.md`（30 FR + 5 P2）

---

## 一、架构概览

### 1.1 整体修复策略

本次为 PATCH 级别发布，**不新增用户可感知功能、不改变架构分层**，但：

1. **引入 3 个新云函数 action**：`getFamilyDetail` / `updateRecord` / `deleteRecord`
2. **引入 1 个新 lib 工具**：`lib/family-dissolve.js`（deleteBaby + dissolveFamily 共享）
3. **收紧 1 条数据库安全规则**：`families.read`（`auth != null` → 成员判定）

修复按严重度分 5 类：

| 类别 | FR 映射 | 数量 |
|------|---------|------|
| 权限/安全规则重构 | FR-1 / FR-2 / FR-4 / FR-A10 / FR-A17 | 5 |
| 数据完整性 | FR-3 / FR-A5 ~ A8 / FR-A11 / FR-A18 | 7 |
| 单例与内存状态 | FR-A13 / FR-A14 | 2 |
| 同构组件漏修 | FR-A1 ~ A4 | 4 |
| 可观测性与工程质量 | FR-5 ~ 8 / FR-A9 / FR-A12 / FR-A15 / FR-A16 + P2×5 | 13 |

### 1.2 分阶段依赖关系

```
Phase 1（纯客户端，1-2 天）──────────────┐
   FR-A1 / A2 / A3 / A4                  │ 独立发布，优先灰度
                                          ┘
                ↓
Phase 2（客户端 + 云函数，2-3 天）────────┐
   FR-A5 / A6 / A7 / A8                  │ A8 依赖 logger 基础
                                          ┘
                ↓
Phase 3（破坏性安全规则，3-5 天）─────────┐
   FR-1 / FR-2 / FR-3                    │ T-7 → T0 → T+14 严格灰度
                                          ┘
                ↓
Phase 4（P1/P2 工程加固，5-7 天）─────────┐
   FR-4~8 / FR-A9~A18 / FR-P2-1~5        │ 按 FR 独立 PR
                                          ┘
```

### 1.3 部署风险矩阵

| 风险 | 描述 | 应对 | 涉及 FR |
|------|------|------|---------|
| 规则收紧 | 老客户端直连 `families.doc().get()` 返回 -502003 | T-7 部署 getFamilyDetail + T-3 灰度 → T0 收紧 | FR-1 |
| 灰度回滚 | 发现云函数 bug | 客户端保留 `directReadFallback` 15 天 | FR-1 |
| 跨归属判定 | 自我记录误判 | 白名单严格；判定失败退化云函数路径 | FR-2 |
| 自动解散家庭 | admin 删错最后 baby 不可逆 | UI 二次确认 + operation_logs 可溯源 | FR-3 |
| patrol 自修复误伤 | 反向漂移规则误把"刚离开"用户加回 | 单次上限 100 + dryRun + joinedAt < 7 天 | FR-A15 |
| 队列翻新并发 | updateRecordId 期间队列并发读 | 复用 syncInProgress 标志 | FR-A7 |
| FR-A3 Phase 跨越 | Phase 1 基于直连，Phase 3 切云函数 | FR-A3 只保证 familyInfo 完整，实现方式向后兼容 | FR-A3+FR-1 |

---

## 二、Phase 1：页面层漏修（Must-Have P0）

### 2.1 FR-A1：growth-popup 类方法误用

**根因**：`RecordService.getRecords()` 是原型方法，类上无同名静态方法 → `TypeError`。

```javascript
// components/growth-popup/growth-popup.js:89 （修复后）
async _loadLastGrowthData() {
  const { baby } = this.properties;
  if (!baby || !baby._id) return;

  try {
    const recordService = RecordService.getInstance();  // ★ 修复
    const records = await recordService.getRecords(baby._id, {
      recordType: 'growth', limit: 1, orderBy: 'startTime', order: 'desc'
    });
    if (records && records.length > 0) {
      const last = records[0];
      this.setData({
        lastGrowthData: {
          weight: last.data?.weight,
          height: last.data?.height,
          headCircumference: last.data?.headCircumference,
          measuredAt: last.startTimeTs
        }
      });
    }
  } catch (err) {
    console.warn('[growth-popup] 加载上次生长数据失败:', err);
  }
}
```

---

### 2.2 FR-A2：4 个弹窗组件接入 swipe-close behavior

严格复用 `baby-edit-popup` v4.3.1 修复模式：

```javascript
// components/feeding-popup/feeding-popup.js （修复后）
const swipeCloseBehavior = require('../../behaviors/swipe-close');

Component({
  behaviors: [swipeCloseBehavior],  // ★ 新增
  properties: { /* ... */ },
  data: {
    // ❌ 删除 popupTranslateY / touchStartY
  },
  methods: {
    // ❌ 删除 onTouchStart / onTouchMove / onTouchEnd
  }
});
```

**涉及 4 个组件**：feeding-popup / sleep-popup / diaper-popup / temperature-popup。WXML 无需改（`bindtouchstart` 等绑定与 behavior 方法名匹配）。

---

### 2.3 FR-A3：family-join 加入家庭后持久化完整 familyInfo

**根因**：`joinFamily` 仅返回 `{success, familyId, familyName}`，客户端把**残缺对象**整体写入 Storage → 后续 `familyInfo._id / memberDetails / members` 全 undefined → `getUserRole` 默认 viewer。

```javascript
// packageSocial/pages/family-join/family-join.js （修复后）
async handleJoin() {
  // ... 参数校验
  wx.showLoading({ title: '加入中...', mask: true });

  try {
    const familyService = FamilyService.getInstance();
    const joinResult = await familyService.joinFamily(inviteCode, userName, relation);

    if (!joinResult.success) {
      wx.hideLoading();
      this._handleJoinError(joinResult);
      return;
    }

    // ★ [FR-A3] 加入成功 → 拉完整 family 文档
    // Phase 1 基于直连；Phase 3 FR-1 生效后自动切云函数路径
    try {
      const family = await familyService.getFamilyDetail(joinResult.familyId);
      if (family && family._id) {
        StorageUtil.saveFamilyInfo(family);
      } else {
        // 兜底：保留最小信息 + toast
        StorageUtil.saveFamilyInfo({ _id: joinResult.familyId, name: joinResult.familyName });
        wx.showToast({ title: '加入成功，下拉可刷新', icon: 'none', duration: 2000 });
      }
    } catch (detailErr) {
      console.warn('[family-join] getFamilyDetail 失败:', detailErr);
      StorageUtil.saveFamilyInfo({ _id: joinResult.familyId, name: joinResult.familyName });
      wx.showToast({ title: '加入成功，部分信息需刷新', icon: 'none' });
    }

    FamilyContext.refresh();
    await AuthService.getInstance().refreshUserInfo();

    wx.hideLoading();
    wx.reLaunch({ url: '/pages/home/home' });
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: err.message || '加入失败', icon: 'none' });
  }
}
```

**关键点**：`getFamilyDetail` 失败**不回滚**"加入成功"状态（云端已落库），仅降级写入最小信息 + toast。

---

### 2.4 FR-A4：record 单条删除加归属校验

```javascript
// pages/record/record.js  deleteRecord（单条入口）
async deleteRecord() {
  const { selectedRecord } = this.data;
  if (!selectedRecord) return;

  // ★ [FR-A4] 与 batchDelete 对齐
  if (!PermissionGuard.checkCanDelete(selectedRecord)) {
    wx.showToast({ title: '无权删除他人记录', icon: 'none' });
    return;
  }

  const res = await wx.showModal({ title: '确认删除', content: '确定删除这条记录吗？' });
  if (!res.confirm) return;

  wx.showLoading({ title: '删除中...', mask: true });
  try {
    await RecordService.getInstance().deleteRecord(selectedRecord._id);
    wx.hideLoading();
    wx.showToast({ title: '删除成功', icon: 'success' });
    this.loadData(true);
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: err.message || '删除失败', icon: 'none' });
  }
}
```

**admin 跨归属**：Phase 1 不开放（Phase 2 FR-2 通过云函数实现）；Phase 1 期间 admin 删他人记录与 editor 一致被 `checkCanDelete` 拦截。

---

## 三、Phase 2：服务层与云函数原子性（Must-Have P0）

### 3.1 FR-A5：createRecord 区分云端与本地错误边界

**根因**：外层 try 覆盖 `add()` + `saveToLocalCache()`；后者失败时外层 catch 误把已落云端的记录重复入队 → 双写。

```javascript
// services/record.js.createRecord  关键路径
try {
  if (this.networkUtil.checkOnline()) {
    // 1. 云端写入
    const res = await this.recordCollection.add({ data: cloudRecord });
    const createdRecord = { _id: res._id, ...localFields };

    // ★ [FR-A5] 云端成功后，本地缓存异常单独处理：不入队、不抛
    try {
      this.saveToLocalCache(createdRecord);
    } catch (cacheErr) {
      console.error('[record.create] 本地缓存失败，云端已成功:', cacheErr);
      this._reportCacheFailure('create', res._id, cacheErr);
    }
    return createdRecord;
  } else {
    // 离线分支（保持原逻辑）
  }
} catch (error) {
  console.error('创建记录失败:', error);
  // ★ 此 catch 现在只覆盖：
  //   1. 云端 add 失败（网络/权限）→ 降级离线队列
  //   2. 离线分支 saveToLocalCache/addToOfflineQueue 抛错
  const offlineRecord = { /* ... */ };
  this.saveToLocalCache(offlineRecord);
  StorageUtil.addToOfflineQueue({ type: 'create', /* ... */ });
  return offlineRecord;
}

_reportCacheFailure(action, recordId, err) {
  try {
    wx.reportAnalytics && wx.reportAnalytics('record_cache_failure', {
      action, recordId, errorCode: err?.errCode || 'UNKNOWN'
    });
  } catch (_) {}
}
```

---

### 3.2 FR-A6：updateRecord / deleteRecord 网络抖动去重

**根因**：`catch` 不区分"已送达但响应丢失"和"未送达"，一律入队 → 重复写入。

```javascript
// services/record.js.updateRecord  改动
async updateRecord(recordId, data) {
  // ... dedupe
  try {
    if (this.networkUtil.checkOnline() && !recordId.startsWith('temp_')) {
      const nowTs = Date.now();
      await this.recordCollection.doc(recordId).update({
        data: { ...data, updatedAt: this.db.serverDate(), updatedAtTs: nowTs }
      });
      this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });
    } else {
      // 离线分支
    }
  } catch (error) {
    console.error('更新记录失败:', error);

    // ★ [FR-A6] 判定是否真的需要入队
    const shouldRequeue = await this._shouldRequeueAfterFailure(
      recordId, 'update', data.updatedAtTs || Date.now(), error
    );
    const nowTs = Date.now();
    this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });

    if (shouldRequeue) {
      StorageUtil.addToOfflineQueue({
        type: 'update', collection: 'records', recordId,
        data: { ...data, updatedAtTs: nowTs }
      });
    }
  }
}

/**
 * [FR-A6] 判定失败是否需要入队
 *   false：云端已生效，跳过
 *   true ：云端未生效 or 无法判定（保底入队）
 */
async _shouldRequeueAfterFailure(recordId, op, expectedTs, error) {
  const UNSENT_CODES = ['REQUEST_FAIL', 'TIMEOUT', 'NETWORK_ERROR'];
  if (UNSENT_CODES.some(c => String(error?.errMsg || '').includes(c))) return true;

  try {
    const res = await this.recordCollection.doc(recordId).get();
    const doc = res.data;
    if (op === 'delete') return !!doc;  // 文档不存在 = 已删
    if (op === 'update') return !(doc && doc.updatedAtTs && doc.updatedAtTs >= expectedTs);
  } catch (probeErr) {
    if (probeErr?.errCode === -1 || /not exist/i.test(probeErr?.errMsg || '')) {
      return false;  // 文档不存在，不再入队
    }
    return true;  // 保底入队
  }
  return true;
}
```

**deleteRecord 对称实现**。测试场景：
- 抖动响应丢失 + 云端已写 → 不重复入队 ✓
- 真网络挂 + 未发送 → 入队 ✓
- 探测也失败 → 入队（保底一致性）✓

---

### 3.3 FR-A7：sync.updateRecordId 同步翻新队列残留操作

**根因**：离线 create → update → update → sync 时，`updateRecordId` 只改本地缓存，队列里的 `{type:'update', recordId:'temp_xxx'}` 仍用旧 tempId → 云端 `INVALID_DOC_ID` → 3 次重试后丢弃 → **编辑永久丢失**。

```javascript
// services/sync.js.updateRecordId  修复后
updateRecordId(tempId, realId) {
  // 1. 原逻辑：翻新本地 records 缓存
  const familyInfo = StorageUtil.getFamilyInfo();
  if (familyInfo && familyInfo.babies) {
    familyInfo.babies.forEach(babyId => {
      const key = `records_${babyId}`;
      const records = StorageUtil.get(key) || [];
      const index = records.findIndex(r => r._id === tempId);
      if (index >= 0) {
        records[index]._id = realId;
        records[index]._offline = false;
        StorageUtil.set(key, records);
      }
    });
  }

  // 2. ★ [FR-A7] 同步翻新离线队列中残留的 update/delete
  const queue = StorageUtil.getOfflineQueue();
  let mutated = false;
  const newQueue = queue.map(op => {
    if (op.recordId === tempId) {
      mutated = true;
      return { ...op, recordId: realId };
    }
    return op;
  });
  if (mutated) {
    StorageUtil.set('offline_queue', newQueue);
    console.log(`[sync] 翻新队列：tempId=${tempId} → realId=${realId}`);
  }
}
```

**并发安全**：
- `syncOfflineQueue` try/finally 持 `syncInProgress=true`，外部不并发
- 当前循环的 `queue` 是方法开头快照，翻新在 Storage 层写入，下次循环读最新

**边界处理**：
- 翻新过程中遇到 `tempId` 已不在 records 缓存（用户已切宝宝/家庭）：仍执行队列翻新（`StorageUtil.set('offline_queue', newQueue)`），但同步期间若该条目的 `executeOperation` 抛 `PERMISSION_DENIED`（用户已切换家庭），由 `syncOfflineQueue` 外层 catch 累加失败计数并按 MAX_RETRY_COUNT 丢弃，最终弹"同步失败"Modal 提示用户

---

### 3.4 FR-A8：joinFamily 幽灵成员切换顺序反转

**根因**：现顺序"先 pull 旧家 + 清 users.familyId" → "再 push 新家 + 写 users.familyId"；第二步失败 → 用户孤儿。

**方案**：反转为"先 push 新家" → "再 pull 旧家"。中途失败至少保留旧家，patrol 可补偿。

```javascript
// cloudfunctions/familyOperation/actions/joinFamily.js  关键改动
module.exports = async (ctx, params) => {
  const { db, _, userId, openid, rateLimiter, logger } = ctx;
  const { inviteCode, userName, relation } = params;

  await logger.start('joinFamily', { inviteCode, userId });  // ★ FR-A12

  // ... rateLimit / 查家庭 / 过期校验（不变）
  if (family.members?.includes(userId)) {
    await logger.succeed('joinFamily', { status: 'already_member' });
    return errors.ALREADY_MEMBER();
  }

  // 幽灵成员判定（暂不执行）
  const existingFamilyRes = await db.collection('families')
    .where({ members: userId }).limit(1).get();
  const existingFamily = existingFamilyRes.data[0];
  const needsMigration = existingFamily && existingFamily._id !== family._id;

  if (needsMigration) {
    const md = existingFamily.memberDetails?.find(m => m.userId === userId);
    const isAdminRole = md?.role === 'admin';
    const hasOtherAdmin = existingFamily.memberDetails?.some(
      m => m.role === 'admin' && m.userId !== userId
    );
    if (isAdminRole && !hasOtherAdmin) {
      await logger.fail('joinFamily', { reason: 'SOLE_ADMIN' });
      return errors.SOLE_ADMIN();
    }
  }

  // ★★ [FR-A8] 顺序反转 ★★
  const now = new Date();
  const nowTs = Date.now();
  const newMemberDetail = {
    userId, name: userName, relation: relation || '家人',
    role: 'editor', joinedAt: now
  };

  // 5. 先加入新家庭
  try {
    await db.collection('families').doc(family._id).update({
      data: {
        members: _.push(userId),
        memberDetails: _.push(newMemberDetail),
        memberOpenids: _.push(openid),
        updatedAt: now, updatedAtTs: nowTs
      }
    });
    await logger.step('join_new_family', 'ok', { familyId: family._id });
  } catch (err) {
    // 新家 push 失败 → 用户仍在旧家，整体回滚（无副作用）
    await logger.fail('joinFamily', { phase: 'join_new_family', err: err.message });
    return errors.INTERNAL_ERROR('加入新家庭失败，请重试');
  }

  // 6. 更新 users.familyId
  try {
    await db.collection('users').doc(userId).update({
      data: { familyId: family._id, familyRole: 'editor', updatedAt: now, updatedAtTs: nowTs }
    });
    await logger.step('update_user_familyId', 'ok');
  } catch (err) {
    // 用户已在新家 members 中但 users.familyId 未切换；patrol 规则 A 可补偿
    await logger.partial('joinFamily', { warning: 'USER_FAMILYID_UPDATE_FAILED', err: err.message });
    return errors.ok({
      familyId: family._id, familyName: family.name,
      warning: 'STALE_USER_POINTER'
    });
  }

  // 7. 最后才从旧家移除（失败不致命）
  if (needsMigration) {
    try {
      await db.collection('families').doc(existingFamily._id).update({
        data: {
          members: _.pull(userId),
          memberDetails: _.pull({ userId }),
          memberOpenids: _.pull(openid),
          updatedAt: now, updatedAtTs: nowTs
        }
      });
      await logger.step('leave_old_family', 'ok', { oldFamilyId: existingFamily._id });
    } catch (err) {
      // 旧家残留成员记录；patrol 反向漂移可补偿
      await logger.partial('joinFamily', {
        warning: 'STALE_OLD_FAMILY_MEMBERSHIP',
        oldFamilyId: existingFamily._id, err: err.message
      });
      return errors.ok({
        familyId: family._id, familyName: family.name,
        warning: 'STALE_OLD_FAMILY_MEMBERSHIP'
      });
    }
  }

  await logger.succeed('joinFamily', { familyId: family._id });
  return errors.ok({ familyId: family._id, familyName: family.name });
};
```

**与 FR-A15 patrol 协作**：
- 规则 A：`family.members` 含 userId 但 `users.familyId !== family._id` → 修复 users.familyId
- 规则 B/C：处理旧家残留成员的孤儿引用

---

## 四、Phase 3：安全规则重构 + 读写路径云函数化（Must-Have P0）

### 4.1 FR-1：families.read 收紧 + getFamilyDetail 云函数化

**当前规则** `auth != null` 是 v4.2 前遗留，收紧后：

```json
// database/security-rules/families.json
{
  "read": "auth.openid in resource.memberOpenids || auth.openid == resource.creatorOpenid",
  "write": false
}
```

**新 action**：

```javascript
// cloudfunctions/familyOperation/actions/getFamilyDetail.js
const errors = require('../errors');
const { isMember } = require('../lib/auth');

module.exports = async (ctx, params) => {
  const { db, userId, logger } = ctx;
  const { familyId } = params;

  if (!familyId) return errors.INVALID_PARAMS('familyId required');

  try {
    const res = await db.collection('families').doc(familyId).get();
    const family = res.data;
    if (!family) return errors.FAMILY_NOT_FOUND();

    if (!isMember(userId, family) && family.creatorId !== userId) {
      return errors.PERMISSION_DENIED('无权访问该家庭');
    }

    // 过滤敏感系统字段
    const { _openid, ...safe } = family;
    return errors.ok(safe);
  } catch (err) {
    if (err?.errCode === -1 || /not found/i.test(err?.errMsg || '')) {
      return errors.FAMILY_NOT_FOUND();
    }
    await logger.fail('getFamilyDetail', { err: err.message });
    return errors.INTERNAL_ERROR('查询失败');
  }
};
```

**客户端改造**：

```javascript
// services/family.js.getFamilyDetail
async getFamilyDetail(familyId) {
  if (!familyId) return null;

  try {
    const res = await wx.cloud.callFunction({
      name: 'familyOperation',
      data: { action: 'getFamilyDetail', params: { familyId } }
    });
    if (res.result?.success) return res.result.data;
    const code = res.result?.error?.code;
    if (code === 'FAMILY_NOT_FOUND') return null;
    if (code === 'PERMISSION_DENIED') {
      console.warn('[family.getFamilyDetail] PERMISSION_DENIED，可能已被踢出');
      return null;
    }
    throw new Error(res.result?.error?.message || '查询失败');
  } catch (err) {
    console.error('[family.getFamilyDetail] 云函数失败:', err);
    // ★ 灰度期 fallback（稳定后移除）
    if (this._allowDirectReadFallback()) {
      try {
        const doc = await this.db.collection('families').doc(familyId).get();
        return doc.data || null;
      } catch (_) { return null; }
    }
    return null;
  }
}

_allowDirectReadFallback() {
  return getApp().globalData?.featureFlags?.directReadFamilyFallback !== false;
}
```

**灰度时间线**（严格）：

```
T-7：部署 getFamilyDetail 云函数 + 客户端双路径（directReadFallback=true）
    监控：operation_logs.getFamilyDetail 调用量、错误率 < 0.5%

T-3：灰度 10% 用户走云函数（按 openid 模运算）
    监控：getFamilyDetail_latency P99 < 800ms

T0 ：CloudBase 控制台收紧 families.read 规则（秒级生效）
    fallback 会被规则拒，静默返回 null；预期已无客户端走 fallback

T+7：观察 24h 无异常 → 通过 version-config 关闭 directReadFallback

T+14：下一迭代移除 fallback 代码
```

**回滚预案**：
- 规则问题：控制台恢复 `auth != null`（秒级）
- 云函数问题：rollback 云函数版本，客户端 fallback 接管

---

### 4.2 FR-2：records.update/remove 云函数化（admin 跨归属）

**当前问题**：安全规则仅允许 `doc._openid == auth.openid` 写入；admin 删/改他人记录被规则拒但客户端缓存已改 → 数据不一致。

**方案**：客户端智能判定，自我记录直连（99% 场景），跨归属走云函数。

```javascript
// services/record.js  新增判定辅助
_shouldUseCloudFn(record) {
  const userInfo = StorageUtil.getUserInfo();
  const myOpenid = userInfo?._openid;
  const recOpenid = record?._openid;
  if (myOpenid && recOpenid && myOpenid === recOpenid) return false;
  return true;  // 跨归属或无法判定 → 云函数
}

async updateRecord(recordId, data) {
  // dedupe...
  const record = this._getRecordFromCache(recordId);
  if (record && this._shouldUseCloudFn(record)) {
    return this._updateRecordViaCloudFn(recordId, record, data);
  }
  // 原有直连路径
}

async _updateRecordViaCloudFn(recordId, record, data) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'familyOperation',
      data: { action: 'updateRecord', params: {
        recordId,
        familyId: record.familyId || FamilyContext.resolve(),
        data
      }}
    });
    if (!res.result?.success) throw new Error(res.result?.error?.message || '更新失败');
    const nowTs = Date.now();
    this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });
    return res.result.data;
  } catch (err) {
    throw err;  // 交给 FR-A6 抖动去重
  }
}
```

**云函数 updateRecord.js**：

```javascript
const errors = require('../errors');
const { getFamily, isMember } = require('../lib/auth');
const { getUserRole } = require('../lib/permission');

const ALLOWED_FIELDS = ['data', 'startTime', 'endTime', 'startTimeTs', 'endTimeTs', 'note', 'recordType'];

module.exports = async (ctx, params) => {
  const { db, userId, logger } = ctx;
  const { recordId, familyId, data: patch } = params;

  if (!recordId || !familyId || !patch) return errors.INVALID_PARAMS();
  await logger.start('updateRecord', { recordId, familyId });

  // 1. 记录归属校验
  const rec = await db.collection('records').doc(recordId).get().catch(() => null);
  if (!rec?.data) {
    await logger.fail('updateRecord', { reason: 'RECORD_NOT_FOUND' });
    return errors.RECORD_NOT_FOUND();
  }
  if (rec.data.familyId !== familyId) {
    await logger.fail('updateRecord', { reason: 'CROSS_FAMILY' });
    return errors.PERMISSION_DENIED('跨家庭操作');
  }

  // 2. 家庭成员校验
  const family = await getFamily(db, familyId);
  if (!family || !isMember(userId, family)) return errors.PERMISSION_DENIED();

  // 3. 角色权限判定
  const role = getUserRole(userId, family);
  const isOwnRecord = rec.data.createdBy?.userId === userId || rec.data.creatorId === userId;
  if (role === 'viewer' || (role === 'editor' && !isOwnRecord)) {
    return errors.PERMISSION_DENIED('无权编辑他人记录');
  }

  // 4. 白名单过滤
  const safePatch = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in patch) safePatch[k] = patch[k];
  }
  safePatch.updatedAt = new Date();
  safePatch.updatedAtTs = Date.now();

  // 5. 执行
  try {
    await db.collection('records').doc(recordId).update({ data: safePatch });
    await logger.succeed('updateRecord', { recordId });
    return errors.ok({ recordId, updatedAtTs: safePatch.updatedAtTs });
  } catch (err) {
    await logger.fail('updateRecord', { err: err.message });
    return errors.INTERNAL_ERROR('更新失败');
  }
};
```

`deleteRecord.js` 对称实现（查 record → 校验 family → 校验 `isOwnRecord || role === 'admin'` → `remove()`）。

**sync.js 同样智能判定**：离线队列同步时对每条操作走相同 `_shouldUseCloudFn` 路径。

**幂等性保证**（FR-2 边界处理）：
- `updateRecord` 云函数：同一 `{recordId, updatedAtTs}` 重复调用时，由客户端 `_shouldRequeueAfterFailure`（FR-A6）先探测后判定，天然幂等
- `deleteRecord` 云函数：目标文档不存在时，云函数侧返回 `RECORD_NOT_FOUND` 视为幂等成功（客户端收到此 code 时走"本地已删"分支，不再入队）
- 客户端 catch 中的 dedupe key（`update_${recordId}` / `delete_${recordId}` 3 秒窗口）防止用户连点导致的并发

---

### 4.3 FR-3：deleteBaby 删完最后一个 baby 自动解散家庭

**抽象公共 lib**：

```javascript
// cloudfunctions/familyOperation/lib/family-dissolve.js
async function dissolveFamilyCore(ctx, family, logger) {
  const { db, _ } = ctx;
  const familyId = family._id;
  await logger.step('dissolve_start', 'ok', { familyId });

  // 1. 清所有成员的 users.familyId
  for (const uid of (family.members || [])) {
    try {
      await db.collection('users').doc(uid).update({
        data: {
          familyId: _.remove(), familyRole: _.remove(),
          updatedAt: new Date(), updatedAtTs: Date.now()
        }
      });
    } catch (err) {
      await logger.step('clear_user_failed', 'warn', { uid, err: err.message });
    }
  }
  // 2. 删除 family
  await db.collection('families').doc(familyId).remove();
  await logger.step('dissolve_done', 'ok', { familyId, memberCount: (family.members || []).length });
  return { dissolved: true, familyId };
}

module.exports = { dissolveFamilyCore };
```

**deleteBaby phase 4 新增自动解散**：

```javascript
// actions/deleteBaby.js  末尾
if (state.phase === 'finalize') {
  const refreshed = await db.collection('families').doc(familyId).get();
  const f = refreshed.data;

  let autoDissolved = false;
  if (f && (f.babies || []).length === 0 && (f.members || []).length === 1) {
    const { dissolveFamilyCore } = require('../lib/family-dissolve');
    await dissolveFamilyCore(ctx, f, logger);
    autoDissolved = true;
  }

  await logger.succeed('deleteBaby', { status: 'succeeded', autoDissolved, ...state.totalCleared });
  return errors.ok({ status: 'succeeded', deletedBabyId: babyId, autoDissolved, ...state.totalCleared });
}
```

**客户端对齐**：
```javascript
if (result.autoDissolved) {
  wx.showModal({
    title: '已删除最后一个宝宝', content: '家庭已自动解散，将返回登录页。',
    showCancel: false
  });
  StorageUtil.clear();
  getApp().resetAllServices();  // FR-A13 联动
  wx.reLaunch({ url: '/pages/auth/auth' });
} else {
  wx.showToast({ title: '已删除', icon: 'success' });
}
```

**边界**：
- `members > 1`：不自动解散（保护其他成员）
- `members === 1 && babies > 0`：不自动解散（还有 baby）
- `members === 0`：不应出现；出现也解散（脏数据清理）

---

## 五、Phase 4：P1/P2 工程质量加固

> 以下改动各自独立，可拆成独立 PR 滚动发布。

### 5.1 FR-4：PermissionGuard.checkCanDelete 防御检查

```javascript
// services/permission-guard.js
checkCanDelete(record) {
  if (!record) return false;

  // ★ [FR-4] record._openid 或 createdBy.userId 必须存在
  const hasAuthor = !!(record._openid || record.createdBy?.userId || record.creatorId);
  if (!hasAuthor) {
    console.warn('[PermissionGuard] record 缺归属字段，拒绝删除:', record._id);
    return false;
  }

  const role = FamilyContext.getCurrentRole();
  if (role === 'admin') return true;
  if (role === 'editor') {
    const myUid = StorageUtil.getUserInfo()?._id;
    const recUid = record.createdBy?.userId || record.creatorId;
    return myUid && recUid === myUid;
  }
  return false;
}
```

### 5.2 FR-5：createFamily 去冗余入参

```javascript
// 客户端：只传 familyName
async createFamily(familyName) {
  return wx.cloud.callFunction({
    name: 'familyOperation',
    data: { action: 'createFamily', params: { familyName } }
  });
}

// 云函数：忽略 creatorId/creatorName/creatorOpenid（silent drop），全部从 ctx 构造
module.exports = async (ctx, params) => {
  const { db, user, userId, openid } = ctx;
  const creatorId = userId;
  const creatorName = user?.nickName || '家长';
  const creatorOpenid = openid;
  // ... 继续原逻辑
};
```

### 5.3 FR-6：限流扩面

```javascript
// lib/rate-limiter.js 扩展配置
const RATE_LIMITS = {
  invite: { maxPerMinute: 5 },
  refresh_invite: { maxPerMinute: 3 },
  transfer_admin: { maxPerMinute: 5 },
  dissolve_family: { maxPerMinute: 3 },
  remove_member: { maxPerMinute: 10 },
  update_role: { maxPerMinute: 10 }
};
```

各 action 入口：
```javascript
const limit = await rateLimiter.check('refresh_invite', openid);
if (!limit.allowed) return errors.RATE_LIMITED(limit.retryAfter);
```

### 5.4 FR-7：updateUserInfo 补 updatedAtTs

```javascript
await this.db.collection('users').doc(this.userId).update({
  data: {
    ...patch,
    updatedAt: this.db.serverDate(),
    updatedAtTs: Date.now()  // ★ FR-7
  }
});
```

### 5.5 FR-8：文档同步清单

| 文档 | 章节 | 改动 |
|------|------|------|
| architecture.md | §6.3 安全规则矩阵 | families.read 表达式；FR-1/2 云函数化路径 |
| data-model.md | families.inviteCodeExpiry | 类型 `string(ISO)` → `Date` |
| data-model.md | operation_logs.meta | 新增 `cursor?: string`（FR-A18）|
| service-api.md | FamilyService | 新增 getFamilyDetail/updateRecord/deleteRecord |
| coding-conventions.md | 单例规范 | 强制 `getInstance()`，禁 `new XxxService()` |
| coding-conventions.md | logout checklist | 新增清内存缓存 |
| component-library.md | swipe-close 覆盖清单 | 6 个弹窗组件 |
| CHANGELOG.md | v4.3.2 | 按 Phase 分小节 |

### 5.6 FR-A9：updateMemberRole 乐观锁重试返回 BUSY

```javascript
async function updateMemberRole(ctx, params, retryCount = 0) {
  // ... 原逻辑
  const updateRes = await db.collection('families').doc(familyId).update({ /* ... */ });

  if (updateRes.stats.updated === 0) {
    if (retryCount < 2) {
      // 重试前重拉最新 family（否则重试的还是陈旧数据）
      return updateMemberRole(ctx, params, retryCount + 1);
    }
    await logger.partial('updateMemberRole', { retried: retryCount, updated: 0 });
    return errors.BUSY('UPDATE_ROLE_BUSY');  // ★ 新错误码
  }
}
```

### 5.7 FR-A10：transferAdmin isMember 交叉校验

```javascript
const { isMember } = require('../lib/auth');
if (!isMember(newAdminId, family)) {
  return errors.NOT_MEMBER('新管理员不在家庭中');
}
```

### 5.8 FR-A11：refreshInviteCode 冲突检测 + 限流 + logger

```javascript
// actions/refreshInviteCode.js
module.exports = async (ctx, params) => {
  const { db, userId, openid, rateLimiter, logger } = ctx;
  const { familyId } = params;

  const limit = await rateLimiter.check('refresh_invite', openid);
  if (!limit.allowed) return errors.RATE_LIMITED(limit.retryAfter);

  await logger.start('refreshInviteCode', { familyId });

  const family = await getFamily(db, familyId);
  if (!family) return errors.FAMILY_NOT_FOUND();
  if (!isAdmin(userId, family)) return errors.PERMISSION_DENIED();

  // 冲突检测（最多重试 5 次）
  const oldCode = family.inviteCode;
  let newCode = null;
  for (let i = 0; i < 5; i++) {
    const c = generateInviteCode();
    const ex = await db.collection('families').where({ inviteCode: c }).count();
    if (ex.total === 0) { newCode = c; break; }
  }
  if (!newCode) {
    await logger.fail('refreshInviteCode', { reason: 'CODE_GEN_CONFLICT' });
    return errors.INTERNAL_ERROR('邀请码生成冲突');
  }

  // 乐观锁：并发刷新检测
  const updateRes = await db.collection('families')
    .where({ _id: familyId, inviteCode: oldCode })
    .update({
      data: {
        inviteCode: newCode,
        inviteCodeExpiry: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        updatedAt: new Date(), updatedAtTs: Date.now()
      }
    });
  if (updateRes.stats.updated === 0) {
    await logger.partial('refreshInviteCode', { reason: 'CONCURRENT_REFRESH' });
    return errors.BUSY('REFRESH_CONFLICT');
  }

  await logger.succeed('refreshInviteCode', { familyId, newCode });
  return errors.ok({ inviteCode: newCode });
};
```

### 5.9 FR-A12：5 个 action 接入 logger.start

| action | 入口 | 备注 |
|--------|------|------|
| createFamily | `logger.start('createFamily', {userId})` | 成功 succeed / 失败 fail |
| joinFamily | 见 FR-A8 | 含 partial 分支 |
| leaveFamily | `logger.start('leaveFamily', {familyId})` | 各 status 分支都 succeed |
| transferAdmin | `logger.start('transferAdmin', {oldAdmin,newAdmin})` | — |
| refreshInviteCode | 见 FR-A11 | — |

**统一模式**（写入 coding-conventions.md）：
```javascript
module.exports = async (ctx, params) => {
  const { logger } = ctx;
  await logger.start('<actionName>', { /* key params */ });
  try {
    // ... 业务
    await logger.succeed('<actionName>', { /* summary */ });
    return errors.ok(result);
  } catch (err) {
    await logger.fail('<actionName>', { err: err.message });
    throw err;
  }
};
```

### 5.10 FR-A13：logout 清理 service 单例内存缓存

```javascript
// app.js 全局钩子
resetAllServices() {
  try {
    RecordService.getInstance()._todayStatsCache = null;
    RecordService.getInstance()._offlineQueue = [];
    TodoService.getInstance().clearCache?.();
    TrendService.getInstance()._cache = null;
    TrendService.getInstance()._periodCache = null;
    FamilyContext.reset();
  } catch (err) {
    console.error('[app.resetAllServices] 清理失败:', err);
  }
}
```

**调用点**：`profile.js.logout` / `dissolveFamily` 成功回调 / `leaveFamily` 成功回调 / 被踢出场景。

```javascript
async logout() {
  StorageUtil.clear();
  getApp().resetAllServices();   // ★
  wx.reLaunch({ url: '/pages/auth/auth' });
}
```

### 5.11 FR-A14：全量替换 new XxxService() 为 getInstance()

**排查命令**：
```bash
grep -rn "new \(RecordService\|FamilyService\|BabyService\|AuthService\|TodoService\|TrendService\|SyncService\|AIService\)(" miniprogram/
```

**已知位点**：
- `pages/home/home.js:376, 498`
- 4 个 popup 组件提交分支
- `packageGrowth/pages/baby-detail/baby-detail.js`

**改动**：`const recordService = new RecordService()` → `const recordService = RecordService.getInstance()`。

### 5.12 FR-A15：patrol 反向漂移自动修复

```javascript
// patrolMemberOpenids/index.js  阶段 2
const DRY_RUN = process.env.PATROL_DRY_RUN === 'true';
const MAX_REPAIR_PER_RUN = 100;

const stats = { reverseDriftFound: 0, reverseDriftFixed: 0, reverseDriftSkipped: 0, warnings: [] };

for (const user of batch.data) {
  const family = await db.collection('families').doc(user.familyId).get().catch(() => null);

  if (!family?.data) {
    // 规则 B：family 不存在 → 清 user.familyId
    stats.reverseDriftFound++;
    if (!DRY_RUN && stats.reverseDriftFixed < MAX_REPAIR_PER_RUN) {
      await db.collection('users').doc(user._id).update({
        data: { familyId: _.remove(), familyRole: _.remove() }
      });
      stats.reverseDriftFixed++;
      await logger.step('repair_orphan_user', 'ok', { uid: user._id });
    }
    continue;
  }

  const f = family.data;
  if (!(f.members || []).includes(user._id)) {
    const joinedAt = f.memberDetails?.find(m => m.userId === user._id)?.joinedAt;
    const joinedTs = joinedAt ? new Date(joinedAt).getTime() : 0;
    const withinWeek = joinedTs && (Date.now() - joinedTs < 7 * 86400 * 1000);

    stats.reverseDriftFound++;

    if (withinWeek && !DRY_RUN && stats.reverseDriftFixed < MAX_REPAIR_PER_RUN) {
      // 规则 A：joinedAt < 7 天 → 补 family.members
      await db.collection('families').doc(f._id).update({
        data: {
          members: _.push(user._id),
          memberOpenids: _.push(user._openid || '')
        }
      });
      stats.reverseDriftFixed++;
      await logger.step('repair_ghost_member', 'ok', { uid: user._id, fid: f._id });
    } else {
      // 规则 C：超期 → 人工干预
      stats.reverseDriftSkipped++;
      stats.warnings.push(`user=${user._id} joined=${joinedAt} 超期未确认`);
    }
  }
}

return { phase1: phase1Stats, phase2: stats, dryRun: DRY_RUN };
```

### 5.13 FR-A16：patrol Set 去重比较

```javascript
// 阶段 1
const expectedSet = new Set(expectedOpenids);
const currentSet = new Set(current);
const consistent = expectedSet.size === currentSet.size
  && [...expectedSet].every(o => currentSet.has(o));
```

### 5.14 FR-A17：E2E rule-simulator 对齐真实规则

```javascript
// cloudfunctions/e2eSecurityTest/utils/rule-simulator.js
const RULES = {
  families: {
    read: (ctx, doc) =>
      (ctx.openid && doc.memberOpenids?.includes(ctx.openid))
      || ctx.openid === doc.creatorOpenid,
    write: () => false
  },
  // ... 其他集合
};
```

**CI 校验**（m22 模块）：
```javascript
it('families.read 模拟器表达式与线上一致', async () => {
  const simulatorExpr = ruleSimulator.expressionOf('families.read');
  const liveExpr = await fetchLiveRule('families.read');
  assert.strictEqual(normalize(simulatorExpr), normalize(liveExpr));
});
```

### 5.15 FR-A18：clearBabyData cursor 云端续传

```javascript
// actions/clearBabyData.js  关键段
async function clearBabyData(ctx, params) {
  const { logger } = ctx;
  const { babyId, familyId, cursor: inputCursor } = params;

  let state, logDocId;

  if (inputCursor) {
    state = JSON.parse(inputCursor);
    logDocId = state._logDocId;
  } else {
    // 检查历史未完成任务
    const existing = await db.collection('operation_logs')
      .where({ action: 'clearBabyData', 'meta.babyId': babyId, status: 'started' })
      .orderBy('createdAt', 'desc').limit(1).get();
    if (existing.data.length > 0) {
      const log = existing.data[0];
      if (log.meta?.cursor) {
        state = JSON.parse(log.meta.cursor);
        logDocId = log._id;
        await logger.step('resume_from_cloud_cursor', 'ok', { logDocId });
      }
    }
    if (!state) {
      logDocId = await logger.start('clearBabyData', { babyId, familyId });
      state = { phase: 'records', totalCleared: { records: 0, vaccine: 0, milestone: 0 } };
    }
  }
  state._logDocId = logDocId;

  // ... 正常 phase 执行

  // 时间预算不足：把 cursor 写入云端 log
  if (!budget() && state.phase !== 'finalize') {
    const cursorStr = JSON.stringify(state);
    await db.collection('operation_logs').doc(logDocId).update({
      data: { 'meta.cursor': cursorStr, 'meta.updatedAt': new Date() }
    });
    return errors.ok({ status: 'in_progress', cursor: cursorStr, progress: state.totalCleared });
  }

  // 完成：关闭 log
  await db.collection('operation_logs').doc(logDocId).update({
    data: { 'meta.cursor': _.remove() }
  });
  await logger.succeed('clearBabyData', {});
}
```

**客户端 settings.js.clearAllCloudData**：循环上限放宽到 20（云端已断点保护）。

**边界处理**（FR-A18）：
- 续传遇到 `babyId` 已被其他人（或其他设备）删除：云函数首次进入 phase 执行时会 `db.collection('babies').doc(babyId).get()` 验证，不存在时返回 `BABY_NOT_FOUND` 并把 operation_log `status` 标为 `failed`，写 `meta.reason='BABY_ALREADY_DELETED'`，客户端收到后清空本地 cursor，toast "数据已被其他设备删除" + `wx.reLaunch` 回首页；避免无限续传
- 续传遇到 `familyId` 不匹配（用户已离开旧家）：云函数在 phase 开头校验 `user.familyId === familyId`，不匹配返回 `PERMISSION_DENIED`，客户端 toast "无权限" + 清 cursor

### 5.16 P2 改进项实现摘要

| FR | 实现要点 |
|----|---------|
| FR-P2-1 deleteBaby logger | Phase 4 最后按 records/vaccine/milestone stats 区分 succeed/partial |
| FR-P2-2 storage 10MB 保护 | `_checkStorageQuota()` 在 setStorageSync 前调用；8MB 清最旧 records_*；10MB toast |
| FR-P2-3 fetchAll 上限 | 默认 `MAX_PAGES=50`，可传 `{maxPages: 200}`；超限 warn |
| FR-P2-4 弹窗 null 守卫 behavior | 抽 `behaviors/safe-popup-observer.js`，按需引入 |
| FR-P2-5 清理 deprecated | 删 `subscribeRecords/unsubscribeRecords/subscribeFamily/unsubscribeFamily`（120 行） |

---

## 六、错误码新增

```javascript
// cloudfunctions/familyOperation/errors.js

// [FR-A9/A11] 通用 BUSY
module.exports.BUSY = (code = 'BUSY') => ({
  success: false,
  error: { code, message: '系统繁忙，请稍后再试' }
});

// [FR-A10] NOT_MEMBER（v4.3.1 若未定义）
module.exports.NOT_MEMBER = (msg = '该用户不在家庭中') => ({
  success: false,
  error: { code: 'NOT_MEMBER', message: msg }
});

// [FR-2] RECORD_NOT_FOUND
module.exports.RECORD_NOT_FOUND = () => ({
  success: false,
  error: { code: 'RECORD_NOT_FOUND', message: '记录不存在' }
});

// [FR-A8] 非错误码，通过 errors.ok({ warning: 'STALE_OLD_FAMILY_MEMBERSHIP' }) 表达
```

---

## 七、云函数 lib 新增/改动

| 文件 | 功能 | 被调用方 |
|------|------|---------|
| `lib/family-dissolve.js`（新） | `dissolveFamilyCore(ctx, family, logger)` | deleteBaby（FR-3）/ dissolveFamily（重构复用） |
| `lib/permission.js`（已有） | `getUserRole(userId, family)` | updateRecord / deleteRecord（FR-2） |
| `lib/auth.js`（已有） | `isMember` / `isAdmin` | FR-A10 / FR-2 |
| `lib/rate-limiter.js`（扩展） | 新增多 action 配置 | FR-6 / FR-A11 |

---

## 八、文件变更清单

| # | 文件路径 | 改动类型 | 涉及 FR |
|---|----------|---------|---------|
| **云函数 — 新建** | | | |
| 1 | `cloudfunctions/familyOperation/actions/getFamilyDetail.js` | 新建 | FR-1 |
| 2 | `cloudfunctions/familyOperation/actions/updateRecord.js` | 新建 | FR-2 |
| 3 | `cloudfunctions/familyOperation/actions/deleteRecord.js` | 新建 | FR-2 |
| 4 | `cloudfunctions/familyOperation/lib/family-dissolve.js` | 新建 | FR-3 |
| **云函数 — 修改** | | | |
| 5 | `cloudfunctions/familyOperation/index.js` | 小改（action 路由） | FR-1/2/3 |
| 6 | `cloudfunctions/familyOperation/errors.js` | 增量（3 个错误码） | FR-A9/A10/2 |
| 7 | `cloudfunctions/familyOperation/lib/rate-limiter.js` | 扩展配置 | FR-6 |
| 8 | `cloudfunctions/familyOperation/actions/joinFamily.js` | 大改（顺序反转） | FR-A8/A12 |
| 9 | `cloudfunctions/familyOperation/actions/deleteBaby.js` | 中改（自动解散） | FR-3/P2-1 |
| 10 | `cloudfunctions/familyOperation/actions/createFamily.js` | 小改 | FR-5/A12 |
| 11 | `cloudfunctions/familyOperation/actions/leaveFamily.js` | 小改（logger） | FR-A12 |
| 12 | `cloudfunctions/familyOperation/actions/transferAdmin.js` | 小改 | FR-A10/A12/6 |
| 13 | `cloudfunctions/familyOperation/actions/refreshInviteCode.js` | 大改 | FR-A11/6/A12 |
| 14 | `cloudfunctions/familyOperation/actions/updateMemberRole.js` | 小改 | FR-A9/6 |
| 15 | `cloudfunctions/familyOperation/actions/dissolveFamily.js` | 小改（复用 lib） | FR-3/6 |
| 16 | `cloudfunctions/familyOperation/actions/removeMember.js` | 小改（限流） | FR-6 |
| 17 | `cloudfunctions/familyOperation/actions/clearBabyData.js` | 中改（cursor 云端） | FR-A18 |
| 18 | `cloudfunctions/patrolMemberOpenids/index.js` | 大改（自修复+去重） | FR-A15/A16 |
| **客户端 — 修改** | | | |
| 19 | `miniprogram/app.js` | 小改（resetAllServices） | FR-A13 |
| 20 | `miniprogram/services/record.js` | 中改 | FR-A4/A5/A6/2 |
| 21 | `miniprogram/services/sync.js` | 中改 | FR-A7/2/P2-5 |
| 22 | `miniprogram/services/family.js` | 小改 | FR-1/5 |
| 23 | `miniprogram/services/auth.js` | 小改 | FR-7 |
| 24 | `miniprogram/services/permission-guard.js` | 小改 | FR-4 |
| 25 | `miniprogram/utils/storage.js` | 小改（quota） | FR-P2-2 |
| 26 | `miniprogram/utils/db-helper.js` | 小改（MAX_PAGES） | FR-P2-3 |
| 27 | `miniprogram/pages/home/home.js` | 小改（单例） | FR-A14 |
| 28 | `miniprogram/pages/record/record.js` | 小改 | FR-A4 |
| 29 | `miniprogram/pages/profile/profile.js` | 小改（logout 清缓存） | FR-A13 |
| 30 | `miniprogram/packageSocial/pages/family-join/family-join.js` | 中改 | FR-A3 |
| 31 | `miniprogram/packageSocial/pages/settings/settings.js` | 中改（cursor 续传） | FR-A18 |
| 32 | `miniprogram/packageGrowth/pages/baby-detail/baby-detail.js` | 小改（单例） | FR-A14 |
| 33 | `miniprogram/components/growth-popup/growth-popup.js` | 小改 | FR-A1 |
| 34 | `miniprogram/components/feeding-popup/feeding-popup.js` | 小改 | FR-A2/A14 |
| 35 | `miniprogram/components/sleep-popup/sleep-popup.js` | 小改 | FR-A2/A14 |
| 36 | `miniprogram/components/diaper-popup/diaper-popup.js` | 小改 | FR-A2/A14 |
| 37 | `miniprogram/components/temperature-popup/temperature-popup.js` | 小改 | FR-A2/A14 |
| 38 | `miniprogram/behaviors/safe-popup-observer.js`（可选） | 新建 | FR-P2-4 |
| **E2E 测试** | | | |
| 39 | `cloudfunctions/e2eSecurityTest/modules/m22-v432Fixes.js` | 新建 | NFR-2 |
| 40 | `cloudfunctions/e2eSecurityTest/utils/rule-simulator.js` | 小改 | FR-A17 |
| 41 | `cloudfunctions/e2eSecurityTest/v43-prod/*` | 同步 | — |
| **数据库规则** | | | |
| 42 | CloudBase 控制台 → families 集合安全规则 | 收紧 | FR-1 |
| **文档** | | | |
| 43 | `architecture.md` | 中改 | FR-8 |
| 44 | `data-model.md` | 小改 | FR-8/A18 |
| 45 | `service-api.md` | 中改 | FR-8 |
| 46 | `coding-conventions.md` | 小改 | FR-8/A14 |
| 47 | `component-library.md` | 小改 | FR-8/A2 |
| 48 | `CHANGELOG.md` | 增量 | — |

---

## 九、关键设计决策

### 决策 1：FR-A3 family-join 是否等 Phase 3 一起改

- **方案 A（选定）**：Phase 1 先基于直连修，Phase 3 FR-1 部署后 getFamilyDetail 内部自动切云函数
- **方案 B（弃用）**：等 Phase 3 一起
- **理由**：FR-A3 是生产 P0（影响新用户创建记录），不能等 3-5 天；方案 A 让调用点与实现解耦

### 决策 2：FR-A8 joinFamily 顺序反转 vs 两阶段提交

- **方案 A（选定）**：反转"先加新家再退旧家" + warning + patrol 补偿
- **方案 B（弃用）**：引入 pending 状态字段 + 事务补偿
- **理由**：方案 B 需新 schema 字段 + 回滚机制；方案 A 充分利用现有 patrol，中途失败至少保证用户在旧家

### 决策 3：FR-2 admin 跨归属是智能判定还是强制云函数

- **方案 A（选定）**：客户端按 `record._openid === auth.openid` 判定，99% 直连
- **方案 B（弃用）**：所有 update/delete 走云函数
- **理由**：方案 B 使 95% 请求 +1 RTT；方案 A 仅 admin 跨归属走云函数（预估 < 5%），判定错误时降级云函数路径

### 决策 4：FR-3 deleteBaby 自动解散 vs 手动确认

- **方案 A（选定）**：`members===1 && babies===0` 自动解散
- **方案 B（弃用）**：弹窗让用户选
- **理由**：空家庭无业务意义；admin 单人家庭"只有自己在用"，自动解散符合直觉；非单人不自动（保护其他成员）

### 决策 5：FR-A15 patrol 自修复 vs 仅告警

- **方案 A（选定）**：默认自修复 + 环境变量 dryRun 开关
- **方案 B（弃用）**：只告警（v4.3.1 FR-18 延续）
- **理由**：v4.3.1 FR-18 运行 2 周观察漂移确实存在且规模有限；FR-A8 改造后会产生新 partial warning 必须有清理机制；阈值保护防误伤

### 决策 6：FR-1 families.read 灰度周期

- **方案 A（选定）**：T-7 → T-3 → T0 → T+7 → T+14（约 3 周）
- **方案 B（弃用）**：T-3 → T0 → T+3（1 周）
- **理由**：families.read 影响每次启动，一旦失败用户无法进入应用；3 周覆盖 CDN 缓存 + 强制升级周期

### 决策 7：错误码 BUSY 的语义

- **方案 A（选定）**：统一 BUSY + code 参数（`UPDATE_ROLE_BUSY` / `REFRESH_CONFLICT`）
- **方案 B（弃用）**：各 action 独立错误码
- **理由**：客户端对 BUSY 类错误统一处理（toast + 允许重试），细分 code 仅供日志

---

## 十、非功能性设计要点

### 10.1 性能

| 操作 | 期望 P99 | 测量 |
|------|---------|------|
| FR-1 getFamilyDetail | < 800ms | operation_logs.meta.latencyMs |
| FR-2 updateRecord 云函数路径 | < 1000ms | 同上 |
| FR-2 updateRecord 直连路径 | < 300ms（保持不变） | wx.reportAnalytics |
| FR-A13 logout resetAllServices | < 50ms | 同步操作 |

### 10.2 可观测性

- 所有新 action 入口 `logger.start`；退出时 `logger.succeed/partial/fail`
- `operation_logs.meta` 新增：
  - `cursor`（FR-A18 续传）
  - `latencyMs`（各 action 性能埋点）
  - `warning`（FR-A8 partial 场景）
- patrol 自修复统计：每日一条 operation_log

### 10.3 向后兼容

- FR-1 灰度期 `directReadFallback` 保留 15 天，老版本客户端不受影响
- FR-2 云函数字段白名单对旧客户端 silent drop，不抛错
- FR-A3 getFamilyDetail 失败也写最小对象，兼容旧行为

### 10.4 安全

- FR-1 收紧：非成员 `doc().get()` 返回 -502003
- FR-2 白名单：拒绝 `_openid/_id/createdBy/familyId` 篡改
- FR-4 `checkCanDelete` 防御：record 缺归属字段拒绝
- FR-5 createFamily 忽略调用方 creatorId/creatorName/creatorOpenid

---

## 十一、回归验证计划

### 11.1 E2E m22-v432Fixes 用例清单（至少 13 条）

| # | 用例 | 覆盖 FR |
|---|------|--------|
| 1 | growth-popup 打开不抛 TypeError | FR-A1 |
| 2 | 4 个弹窗下滑可关闭 | FR-A2 |
| 3 | 加入家庭后 familyInfo._id 非空 | FR-A3 |
| 4 | editor 单条删除他人记录被拒 | FR-A4 |
| 5 | createRecord add 成功 + saveToLocalCache 失败 → 云端只 1 条 | FR-A5 |
| 6 | updateRecord 响应丢失但云端已写 → 不重复入队 | FR-A6 |
| 7 | 离线 create → update × 2 → online sync → 云端 updatedAtTs 最新 | FR-A7 |
| 8 | joinFamily 新家 push 成功 + pull 旧家失败 → partial warning | FR-A8 |
| 9 | 非成员 doc('families/x').get() 返回 -502003 | FR-1 |
| 10 | admin 云函数删 editor 记录成功 | FR-2 |
| 11 | admin 单人家庭删最后 baby → autoDissolved=true | FR-3 |
| 12 | patrol 模拟 stale user pointer → 自动修复 | FR-A15 |
| 13 | rule-simulator families.read 与线上一致 | FR-A17 |

### 11.2 灰度监控指标

| 指标 | 阈值 | 来源 |
|------|------|------|
| getFamilyDetail 错误率 | < 0.5% | operation_logs |
| updateRecord 云函数路径占比 | < 10% | operation_logs + analytics |
| joinFamily partial 告警数 | < 5 次/天 | operation_logs.partial |
| patrol 自修复次数 | < 100 次/天 | operation_logs |
| record_cache_failure | < 10 次/天 | wx.reportAnalytics |

### 11.3 回滚触发条件

| Phase | 触发条件 | 回滚 |
|-------|---------|------|
| 1 | 弹窗无法关闭 / 首页生长加载错误率 > 1% | 移除 behavior 引用，发新版 |
| 2 | 离线记录云端丢失率 > 0.1% | `services/record.js` 回退 v4.3.1 |
| 3 | getFamilyDetail 错误率 > 5% or 启动失败率上升 | **控制台恢复 families.read = auth != null**（秒级） |
| 4 | 各 PR 独立回滚 | git revert 对应 commit |

---

## 十二、文档变更汇总

已在 §5.5 FR-8 清单中覆盖，不赘述。

---

*本设计稿 v1.0 产出于 2026-04-21；后续实现若发现未覆盖情况，补充 v1.1 增量章节而非重写。*
