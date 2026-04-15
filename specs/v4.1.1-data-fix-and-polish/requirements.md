# 需求文档 - v4.1.1 存量数据修复 & 体验优化（Data Fix & Polish）

> 版本：v2.0 | 日期：2026-04-15 | 状态：**开发完成，待验证**
> 来源：v4.1 实施后风险评估中的 3 项遗留问题
> 决策记录：FR-1 选择方案 A（云函数批量迁移）、FR-2 选择方案 A（云函数全量扫描）、FR-3 选择方案 C（占位引导卡片）

---

## 一、背景

v4.1（AI Shield & Share Auth Hardening）完成后，经实施后风险评估发现以下三个遗留问题：

| # | 遗留风险 | 严重程度 | 用户影响 |
|---|---------|---------|---------|
| 1 | 存量 records 的 `createdBy.userId` / `creatorId` 仍为 openid 格式，与统一后的 `_id` 不匹配 | **中** | editor 角色无法删除自己在 v4.1 前创建的旧记录 |
| 2 | 存量幽灵成员：用户残留在已退出家庭的 `members`/`memberDetails` 中 | **中** | 旧家庭成员数显示偏多，可能导致 `getFamilyByUserId` 返回错误家庭 |
| 3 | 发现页从 4 项减为 3 项后，2x2 网格右下角出现空位 | **低** | 视觉不美观，但不影响功能 |

**代码审查中额外发现的问题**：
| # | 新发现 | 严重程度 | 影响 |
|---|--------|---------|------|
| 4 | `family.js#transferAdmin()` 第 553-563 行仍使用 `where({ _openid })` 查询 users 集合，与 v4.1 统一使用 `doc(userId)` 的修正方向不一致 | **中** | 管理员转让时 `familyRole` 同步可能失败（_openid ≠ _id 时更新不到目标文档） |

---

## 二、需求列表

### FR-1：存量 records userId 迁移

**问题根因**：
- v4.1 之前，`record.js#createRecord()` 使用 `userInfo.openid` 写入 `createdBy.userId` 和 `creatorId`
- v4.1 统一为 `userInfo._id` 后，新记录正常，但存量记录仍为 openid
- `permission.js#canDeleteRecord()` 第 148 行做严格相等 `===` 比较，editor 角色的 `userId`（_id）≠ `recordCreatorId`（openid），导致无法删除自己的旧记录

**选定方案：A（云函数批量迁移）** ✅

> 选择理由：一劳永逸地修复数据根因，迁移完成后无运行时开销，代码保持干净无需背负兼容逻辑。虽然迁移期间有短暂数据不一致，但 editor 无法删除旧记录本身就是一个已存在的问题，短暂窗口期内该问题不会恶化。

<details>
<summary>备选方案（已否决）</summary>

| 方案 | 描述 | 否决原因 |
|------|------|---------|
| B. 前端兼容层 | `canDeleteRecord` 增加双重匹配 | 永远带着兼容代码，且 `userInfo.openid` 在 v4.1 后可能不再存储 |
| C. 惰性迁移 | 读取时自动更新 | 长尾问题无法收敛，读路径增加写操作 |
| D. A+B 组合 | 先 B 后 A | A 方案本身工时不长，无需额外引入 B 的兼容代码 |

</details>

**FR-1 具体需求**：

#### FR-1.1：云函数 `migrateRecordUserId`（一次性迁移脚本）

**功能描述**：编写云函数，构建 `openid → _id` 映射表，批量更新所有 records 的 `createdBy.userId` 和 `creatorId`。

**详细实现要求**：

1. **构建映射表**：
   - 查询 `users` 集合的所有文档，提取 `{ _id, _openid }` 字段
   - 构建 `Map<openid, _id>` 映射表
   - 注意：`_openid` 是云开发自动注入的字段，所有通过客户端 SDK 创建的 users 文档都有此字段
   - 边界处理：如果某个 user 文档缺少 `_openid`（理论上不会发生），记录警告日志并跳过

2. **扫描 records 集合**：
   - 使用云函数 admin SDK（绕过安全规则）分批查询所有 records
   - 每批 100 条，通过 `skip` 分页遍历
   - 对每条 record 检查：
     - `createdBy.userId` 是否存在于映射表的 key（openid）中
     - `creatorId` 是否存在于映射表的 key（openid）中
   - 如果匹配到 openid，则更新为对应的 `_id`

3. **批量更新**：
   - 逐条使用 `doc(recordId).update()` 更新（云开发 NoSQL 不支持 bulkWrite）
   - 更新字段：`createdBy.userId`、`creatorId`，同时追加 `_migratedAt: new Date()` 标记已迁移
   - 每批更新间加入 `sleep(100ms)` 避免打满数据库连接

4. **日志与报告**：
   - 记录迁移统计：总扫描数、已是 `_id` 格式跳过数、成功迁移数、映射未命中数、失败数
   - 函数返回 JSON 格式的迁移报告

5. **幂等性保证**：
   - 通过 `_migratedAt` 字段或检查 `createdBy.userId` 是否已在映射表 value（_id）中，避免重复迁移
   - 可安全重复执行

**伪代码**：
```javascript
exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;
  
  // Step 1: 构建 openid → _id 映射表
  const users = await getAllDocs(db.collection('users'), ['_id', '_openid']);
  const openidToIdMap = new Map();
  users.forEach(u => {
    if (u._openid) openidToIdMap.set(u._openid, u._id);
  });
  
  // Step 2: 分批扫描 records
  let skip = 0, batchSize = 100;
  let stats = { scanned: 0, migrated: 0, skipped: 0, notFound: 0, failed: 0 };
  
  while (true) {
    const batch = await db.collection('records').skip(skip).limit(batchSize).get();
    if (batch.data.length === 0) break;
    
    for (const record of batch.data) {
      stats.scanned++;
      const oldCreatorId = record.createdBy?.userId || record.creatorId || '';
      
      // 已是 _id 格式（在映射表 value 中），跳过
      if ([...openidToIdMap.values()].includes(oldCreatorId)) { stats.skipped++; continue; }
      // 已迁移过，跳过
      if (record._migratedAt) { stats.skipped++; continue; }
      
      const newId = openidToIdMap.get(oldCreatorId);
      if (!newId) { stats.notFound++; continue; }
      
      // Step 3: 更新
      try {
        await db.collection('records').doc(record._id).update({
          data: {
            'createdBy.userId': newId,
            creatorId: newId,
            _migratedAt: new Date()
          }
        });
        stats.migrated++;
      } catch (e) { stats.failed++; }
      
      await sleep(50);
    }
    skip += batchSize;
  }
  
  return { success: true, stats };
};
```

**超时策略**：云函数默认超时 20s，此函数需设置为 **60s**。如果 records 数量超过 5000 条，考虑分段执行（通过 `event.startFrom` 参数支持断点续传）。

#### FR-1.2：修复 `transferAdmin` 中的 `_openid` 遗留 Bug

**问题描述**：代码审查发现 `family.js#transferAdmin()` 第 553-563 行仍在使用 `where({ _openid: currentAdminId })` 和 `where({ _openid: newAdminId })` 查询 users 集合来同步 `familyRole`。这与 v4.1 统一使用 `doc(userId)` 的修正方向不一致。

**当前代码**（`family.js` 第 551-563 行）：
```javascript
// 同步 users 集合
try {
  await this.userCollection.where({
    _openid: currentAdminId   // ❌ 错误：currentAdminId 是 _id，不是 _openid
  }).update({
    data: { familyRole: 'editor', updatedAt: new Date().toISOString() }
  });

  await this.userCollection.where({
    _openid: newAdminId       // ❌ 错误：newAdminId 是 _id，不是 _openid
  }).update({
    data: { familyRole: 'admin', updatedAt: new Date().toISOString() }
  });
} catch (userErr) {
  console.warn('同步用户角色失败（非致命）:', userErr);
}
```

**修复方案**：统一改为 `doc(userId).update()`，与 `removeMember`（第 312 行）、`_clearUserFamilyInfo`（第 670 行）保持一致。

**修复后代码**：
```javascript
// ★ [v4.1.1 FR-1.2] 修正：使用 doc(userId) 而非 where({ _openid })
try {
  await this.userCollection.doc(currentAdminId).update({
    data: { familyRole: 'editor', updatedAt: new Date().toISOString() }
  });
  await this.userCollection.doc(newAdminId).update({
    data: { familyRole: 'admin', updatedAt: new Date().toISOString() }
  });
} catch (userErr) {
  console.warn('同步用户角色失败（非致命）:', userErr);
}
```

---

### FR-2：存量幽灵成员清理

**问题根因**：
- v4.1 之前 `joinByInviteCode` 没有检查旧家庭，用户加入新家庭后旧家庭 `members[]` 中仍然残留该用户 ID
- v4.1 增加了增量防护（加入前检查+自动移除），但未修复存量数据
- `getFamilyByUserId()` 查询 `members` 数组包含 userId 的家庭，只返回第一条——幽灵残留可能导致返回错误的家庭

**选定方案：A（云函数全量扫描）** ✅

> 选择理由：一次性彻底清理所有幽灵成员。v4.1 已有的增量防护（joinByInviteCode 前检查+自动移除旧家庭）保证新的幽灵成员不会产生，因此无需额外加固 `getFamilyByUserId`。全量扫描清理完成后问题完全消除。

<details>
<summary>备选方案（已否决）</summary>

| 方案 | 描述 | 否决原因 |
|------|------|---------|
| B. getFamilyByUserId 加固 | 查询时优先匹配 familyId | 治标不治本，幽灵数据仍存在 |
| C. ensureUserReady 反向清理 | 用户登录时反向清理 | 增加启动延迟，且只覆盖活跃用户 |
| D. A+B 组合 | 扫描+查询加固 | v4.1 增量防护已足够，B 方案的查询加固属冗余 |

</details>

**FR-2 具体需求**：

#### FR-2.1：云函数 `cleanGhostMembers`（一次性清理脚本）

**功能描述**：遍历所有 families，逐个检查每个 member 的 `users.familyId` 是否指向该家庭，不匹配的从 `members`/`memberDetails` 中移除。

**详细实现要求**：

1. **分批扫描 families**：
   - 使用 admin SDK 分批查询所有 families（每批 50 条）
   - 对每个 family，遍历其 `members[]` 数组

2. **检验成员归属**：
   - 对每个 `memberId`，查询 `users` 集合 `doc(memberId)` 获取该用户的 `familyId`
   - 判定为幽灵成员的条件：
     - 用户文档不存在（已注销/删除）
     - 用户的 `familyId` 不存在（未绑定任何家庭）
     - 用户的 `familyId` ≠ 当前遍历的 `family._id`（属于其他家庭）

3. **清理幽灵成员**：
   - 收集该 family 中所有幽灵成员的 `userId` 列表
   - 使用原子操作 `db.command.pull()` 从 `members[]` 和 `memberDetails[]` 中移除
   - 一次性更新，避免多次写入

4. **安全约束**：
   - **不清理 admin 角色**：即使 admin 的 `familyId` 不匹配，也不自动清理（可能是数据不一致但不是幽灵成员），仅记录警告
   - **不清理只有 1 个成员的家庭**：避免清理后 family 变成空家庭
   - 如果清理后家庭变成 0 个成员，记录告警但不删除 family 文档

5. **日志与报告**：
   ```
   {
     totalFamilies: 150,          // 扫描的家庭总数
     totalMembers: 420,           // 检查的成员总数
     ghostsFound: 12,             // 发现的幽灵成员数
     ghostsCleaned: 12,           // 成功清理的幽灵成员数
     cleanedDetails: [            // 清理明细
       { familyId: "xxx", familyName: "xx家", removedMembers: ["userId1", "userId2"] }
     ],
     warnings: [],                // 警告信息（如 admin 不匹配）
     errors: []                   // 错误信息
   }
   ```

6. **幂等性保证**：重复执行安全——已清理的幽灵成员不会再出现在 `members[]` 中。

**伪代码**：
```javascript
exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;
  let stats = { totalFamilies: 0, totalMembers: 0, ghostsFound: 0, ghostsCleaned: 0, cleanedDetails: [], warnings: [], errors: [] };
  
  // 分批扫描所有 families
  let skip = 0, batchSize = 50;
  while (true) {
    const batch = await db.collection('families').skip(skip).limit(batchSize).get();
    if (batch.data.length === 0) break;
    
    for (const family of batch.data) {
      stats.totalFamilies++;
      if (!family.members || family.members.length === 0) continue;
      
      const ghostIds = [];
      for (const memberId of family.members) {
        stats.totalMembers++;
        try {
          const userDoc = await db.collection('users').doc(memberId).get();
          const user = userDoc.data;
          
          if (user.familyId && user.familyId !== family._id) {
            // 检查是否是 admin
            const memberDetail = family.memberDetails?.find(m => m.userId === memberId);
            if (memberDetail?.role === 'admin') {
              stats.warnings.push(`Admin ${memberId} in family ${family._id} has mismatched familyId`);
              continue;
            }
            ghostIds.push(memberId);
          }
        } catch (e) {
          // 用户文档不存在
          if (e.errMsg?.includes('cannot find document')) {
            ghostIds.push(memberId);
          } else {
            stats.errors.push(`Error checking user ${memberId}: ${e.message}`);
          }
        }
      }
      
      if (ghostIds.length > 0 && ghostIds.length < family.members.length) {
        // 批量移除幽灵成员
        for (const ghostId of ghostIds) {
          await db.collection('families').doc(family._id).update({
            data: {
              members: _.pull(ghostId),
              memberDetails: _.pull({ userId: ghostId }),
              updatedAt: new Date().toISOString()
            }
          });
        }
        stats.ghostsFound += ghostIds.length;
        stats.ghostsCleaned += ghostIds.length;
        stats.cleanedDetails.push({
          familyId: family._id,
          familyName: family.name,
          removedMembers: ghostIds
        });
      }
    }
    skip += batchSize;
  }
  
  return { success: true, stats };
};
```

**超时策略**：设置为 **60s**。如果 families 数量超过 500 个，支持断点续传（`event.startFrom` 参数）。

---

### FR-3：发现页布局优化

**问题根因**：
- v4.1 移除 AI 助手入口后，`toolItems` 从 4 项变为 3 项
- CSS Grid `grid-template-columns: repeat(2, 1fr)` 固定两列，3 项时右下角出现空位

**选定方案：C（保持 2x2，最后一格放引导占位卡片）** ✅

> 选择理由：实现最简单，不需要新增功能页面或复杂布局逻辑。占位卡片既能填补空位又能暗示产品后续规划，为未来功能留好入口位置。后续 v4.2 计划引入新功能时可以直接替换此占位卡片。

<details>
<summary>备选方案（已否决）</summary>

| 方案 | 描述 | 否决原因 |
|------|------|---------|
| A. 补充新功能入口 | 添加第 4 个功能入口 | 需要额外设计+开发新功能，v4.1.1 定位是修复版本 |
| B. 1x3 横向布局 | 三列等宽 | 卡片变窄不美观，不如 2x2 大气 |
| D. 自适应布局 | JS 动态设置列数 | 过度工程化，3 项时卡片偏窄 |
| E. 补充数据导出入口 | 复用现有导出页面 | 数据导出使用频率低，放在发现页首屏不合适 |

</details>

**FR-3 具体需求**：

#### FR-3.1：在 `toolItems` 末尾新增占位引导卡片

**变更文件**：`miniprogram/pages/discover/discover.js`

在 `toolItems` 数组末尾新增第 4 项：

```javascript
{
  icon: ICONS.discover.more,      // 需新增 icon 配置
  bgColor: 'linear-gradient(135deg, rgba(180, 180, 180, 0.12), rgba(160, 160, 160, 0.18))',
  title: '更多功能',
  url: '',                         // 空 URL，表示不可跳转
  badge: 0,
  isPlaceholder: true              // 标记为占位卡片
}
```

#### FR-3.2：修改 `goToPage` 跳转逻辑

**变更文件**：`miniprogram/pages/discover/discover.js`

```javascript
goToPage(e) {
  const { url } = e.currentTarget.dataset;
  // FR-3: 占位卡片不跳转
  if (!url) return;
  wx.navigateTo({ url });
},
```

#### FR-3.3：占位卡片 UI 样式（区分于正常卡片）

**变更文件**：`miniprogram/pages/discover/discover.wxml`、`miniprogram/pages/discover/discover.wxss`

- WXML：占位卡片添加 `placeholder` class，内部增加副标题文字"敬请期待"
- WXSS：占位卡片使用 **虚线边框 + 降低透明度（opacity: 0.55）** 的视觉风格，与正常功能卡片区分
  - 图标使用灰色调的省略号/加号图标
  - 标题颜色使用 `var(--text-hint)` 而非 `var(--text-primary)`
  - 添加小号副标题文字"敬请期待"，颜色 `var(--text-hint)`，字号 22rpx

**WXML 模板变更**：
```html
<view 
  class="tool-item {{item.isPlaceholder ? 'tool-item--placeholder' : ''}}"
  wx:for="{{toolItems}}"
  wx:key="title"
  data-url="{{item.url}}"
  bindtap="goToPage"
>
  <view class="tool-icon-wrapper" style="background: {{item.bgColor}};">
    <image class="tool-icon" src="{{item.icon}}" mode="aspectFit" lazy-load></image>
  </view>
  <text class="tool-title">{{item.title}}</text>
  <text class="tool-subtitle" wx:if="{{item.isPlaceholder}}">敬请期待</text>
  <view class="tool-badge" wx:if="{{item.badge > 0}}">{{item.badge}}</view>
</view>
```

**WXSS 新增样式**：
```css
/* FR-3: 占位引导卡片 */
.tool-item--placeholder {
  opacity: 0.55;
  border: 2rpx dashed var(--border-color);
  box-shadow: none;
  background: transparent;
}

.tool-item--placeholder:active {
  transform: none;  /* 禁用按压动效 */
}

.tool-subtitle {
  font-size: 22rpx;
  color: var(--text-hint);
  margin-top: 4rpx;
}
```

#### FR-3.4：准备占位卡片图标

**变更文件**：`miniprogram/utils/icon-config.js`、`miniprogram/images/icons/`

- 新增图标文件 `more-dots.png`（灰色省略号/三点图标），尺寸 44×44@2x
- 在 `icon-config.js` 的 `ICONS.discover` 中新增 `more: '/images/icons/more-dots.png'`

---

## 三、优先级排序

| 优先级 | 需求 | 理由 | 预计工时 |
|--------|------|------|---------|
| **P0** | FR-1.1 云函数 `migrateRecordUserId` | 直接影响用户操作（editor 无法删除旧记录），需要一次性彻底修复 | 1.5h |
| **P0** | FR-1.2 修复 `transferAdmin` 的 `_openid` Bug | 管理员转让功能可能静默失败 | 0.25h |
| **P0** | FR-2.1 云函数 `cleanGhostMembers` | 幽灵成员可能导致 `getFamilyByUserId` 返回错误家庭 | 1.5h |
| **P1** | FR-3 发现页布局优化（占位卡片） | 视觉体验问题 | 0.5h |

**v4.1.1 总预计工时：3.25h（P0） + 0.5h（P1） = 3.75h**

---

## 四、实施阶段规划

### Phase 1：代码修复（v4.1.1 发布）
- FR-1.2：修复 `transferAdmin` 中 `where({ _openid })` → `doc(userId)`
- FR-3：发现页占位引导卡片（WXML + WXSS + JS + 图标）

### Phase 2：数据修复脚本（v4.1.1 发布后手动执行）
- FR-1.1：云函数 `migrateRecordUserId`（编写 → 测试环境验证 → 生产执行）
- FR-2.1：云函数 `cleanGhostMembers`（编写 → 测试环境验证 → 生产执行）

> **执行顺序**：先执行 FR-1.1（records 迁移），后执行 FR-2.1（幽灵成员清理）。两者无依赖但建议串行执行，避免同时大量写入。

---

## 五、验收标准

| 场景 | 预期结果 |
|------|---------|
| 云函数 `migrateRecordUserId` 执行后，检查任意存量 record | `createdBy.userId` 和 `creatorId` 均为 `_id` 格式（非 openid），且有 `_migratedAt` 标记 |
| 迁移后 editor 角色尝试删除 v4.1 前创建的自己的记录 | 可以正常删除（`recordCreatorId === userId` 匹配成功） |
| 云函数 `cleanGhostMembers` 执行后 | 所有 families 的 `members[]` 中不含非本家庭成员；返回清理报告 |
| 清理后查询 `getFamilyByUserId` | 仅返回用户真正所属的家庭（无幽灵残留干扰） |
| 管理员转让操作 | `transferAdmin` 使用 `doc(userId)` 更新，双方 `familyRole` 正确同步 |
| 发现页打开 | 显示 4 个卡片（疫苗/生长曲线/里程碑/更多功能），2x2 布局无空位 |
| 第 4 个卡片外观 | 虚线边框、半透明、灰色图标、标题"更多功能"、副标题"敬请期待" |
| 点击第 4 个占位卡片 | 无跳转，无响应（不触发 navigateTo） |

---

## 六、影响范围

### 代码变更
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `miniprogram/services/family.js` | 修改 | `transferAdmin` 第 553-563 行：`where({ _openid })` → `doc(userId)`（FR-1.2） |
| `miniprogram/pages/discover/discover.js` | 修改 | `toolItems` 新增占位卡片 + `goToPage` 空 URL 保护（FR-3.1, FR-3.2） |
| `miniprogram/pages/discover/discover.wxml` | 修改 | 增加 `isPlaceholder` 条件样式 + 副标题文字（FR-3.3） |
| `miniprogram/pages/discover/discover.wxss` | 修改 | 新增 `.tool-item--placeholder` 和 `.tool-subtitle` 样式（FR-3.3） |
| `miniprogram/utils/icon-config.js` | 修改 | 新增 `ICONS.discover.more` 图标路径（FR-3.4） |
| `miniprogram/images/icons/more-dots.png` | 新增 | 灰色省略号图标（FR-3.4） |
| `cloudfunctions/migrateRecordUserId/` | 新增 | 存量 records userId 迁移云函数（FR-1.1） |
| `cloudfunctions/cleanGhostMembers/` | 新增 | 存量幽灵成员清理云函数（FR-2.1） |

### 数据变更
| 集合 | 字段 | 变更 |
|------|------|------|
| `records` | `createdBy.userId`, `creatorId` | openid → _id，新增 `_migratedAt` 标记（FR-1.1） |
| `families` | `members[]`, `memberDetails[]` | 移除幽灵成员（FR-2.1） |

### 风险评估
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 云函数迁移期间用户操作受影响 | 低 | 低 | 迁移期间 editor 删除旧记录的场景本身已是已知 bug，不会恶化 |
| 映射表中找不到 openid 对应的 _id | 低 | 低 | 记录 `notFound` 统计，不修改这些记录；后续人工排查 |
| 幽灵成员清理误删正常成员 | 极低 | 高 | 不清理 admin 角色；清理前验证 `user.familyId ≠ family._id`；输出清理明细日志 |
| `transferAdmin` 修复引入回归 | 极低 | 中 | 改动极小（`where({_openid})` → `doc(id)`），与项目中其他已修复的同类代码一致 |
