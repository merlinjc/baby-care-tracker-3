# Baby Care Tracker 数据模型文档

> **版本**: v4.3.0 | **更新日期**: 2026-04-20

---

## 1. 数据库集合总览

项目使用 **CloudBase NoSQL** 数据库，共 **6 个集合**：

| 集合名 | 用途 | 主要操作服务 |
|--------|------|-------------|
| `users` | 用户信息 | AuthService |
| `families` | 家庭组 | FamilyService |
| `babies` | 宝宝档案 | BabyService |
| `records` | 核心记录（喂养/睡眠/排便/体温/生长）| RecordService |
| `vaccine_records` | 疫苗接种记录 | TodoService、vaccine.js |
| `milestone_records` | 发育里程碑记录 | TodoService、milestone.js |

---

## 2. 集合详细定义

### 2.1 `users` 用户集合

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `_openid` | string | 系统 | 微信自动添加 |
| `nickname` | string | 是 | 昵称 |
| `avatar` | string | 否 | 头像 URL |
| `role` | enum | 是 | `'parent'` \| `'family_member'` |
| `relation` | string | 是 | 身份关系标识（mom/dad/grandma_m 等）|
| `relationText` | string | 是 | 身份关系中文文本 |
| `familyId` | string | 否 | 关联家庭 ID |
| `familyRole` | enum | 否 | `'admin'` \| `'editor'` \| `'viewer'` |
| `createdAt` | serverDate | 是 | 创建时间 |
| `updatedAt` | serverDate | 是 | 更新时间 |

### 2.2 `families` 家庭组集合

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `name` | string | 是 | 家庭名称 |
| `creatorId` | string | 是 | 创建者 `users._id`（v4.1 后统一，历史数据经 `migrateRecordUserId` 迁移） |
| `creatorName` | string | 是 | 创建者名称 |
| `members` | string[] | 是 | 成员 `users._id` 数组（v4.1 后统一） |
| `memberDetails` | Object[] | 是 | 成员详情数组 |
| `memberDetails[].userId` | string | 是 | 成员 `users._id`（v4.1 后统一） |
| `memberDetails[].name` | string | 是 | 成员名称 |
| `memberDetails[].role` | enum | 是 | `'admin'`\|`'editor'`\|`'viewer'` |
| `memberDetails[].relation` | string | 否 | 与宝宝关系 |
| `memberDetails[].joinedAt` | string(ISO) | 是 | 加入时间 |
| `memberOpenids` | string[] | 是(v4.2+) | ★ 成员 openid 数组，安全规则 `auth.openid in doc.memberOpenids` 校验用 |
| `babies` | string[] | 是 | 宝宝 ID 数组 |
| `inviteCode` | string | 是 | 6位邀请码（去除 I/O/0/1） |
| `inviteCodeExpiry` | string(ISO) | 是 | 邀请码过期时间（7天有效） |
| `createdAt` | string(ISO) | 是 | 创建时间 |
| `updatedAt` | string(ISO) | 是 | 更新时间 |
| `_openidsMigratedAt` | Date | 否 | 迁移标记（由 `migrateFamilyOpenids` 云函数写入，存量迁移后补齐 memberOpenids 字段） |

### 2.3 `babies` 宝宝集合

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `familyId` | string | 是 | 所属家庭 ID |
| `name` | string | 是 | 姓名 |
| `gender` | enum | 是 | `'male'` \| `'female'` |
| `birthDate` | Date | 是 | 出生日期 |
| `avatar` | string | 否 | 头像（云存储 fileID） |
| `vaccinePlan` | string[] | 否 | 疫苗计划 ID 列表 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 2.4 `records` 核心记录集合

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `babyId` | string | 是 | 宝宝 ID |
| `familyId` | string | 是(v4.2+) | ★ 所属家庭 ID，安全规则 `get('database.families.' + doc.familyId).memberOpenids` 交叉校验用 |
| `recordType` | enum | 是 | `'feeding'`\|`'sleep'`\|`'diaper'`\|`'temperature'`\|`'growth'` |
| `startTime` | serverDate | 是 | 开始时间（服务器时间） |
| `startTimeTs` | number | 是 | 开始时间数值时间戳 |
| `endTime` | Date | 否 | 结束时间（睡眠等） |
| `endTimeTs` | number | 否 | 结束时间数值时间戳 |
| `data` | Object | 是 | **类型特定数据**（见下方） |
| `note` | string | 否 | 备注 |
| `createdBy` | Object | 是(新) | `{ userId, nickName, avatar }` |
| `creatorId` | string | 是(旧) | 创建者 `users._id`（v4.1 后统一，兼容旧数据格式） |
| `createdByName` | string | 否(旧) | 创建者名称（兼容） |
| `createdByAvatar` | string | 否(旧) | 创建者头像（兼容） |
| `createdAt` | serverDate | 是 | 创建时间 |
| `createdAtTs` | number | 是 | 创建时间数值时间戳 |
| `updatedAt` | serverDate | 是 | 更新时间 |
| `updatedAtTs` | number | 是 | 更新时间数值时间戳 |
| `_familyIdMigratedAt` | Date | 否 | 迁移标记（由 `migrateRecordFamilyId` 云函数写入，存量迁移后补齐 familyId） |
| `_migratedAt` | Date | 否 | 迁移标记（由 `migrateRecordUserId` 云函数写入，openid → _id 迁移） |

**`data` 子结构按 `recordType` 区分：**

| recordType | data 字段 |
|-----------|----------|
| feeding | `feedingType: 'breast'\|'formula'\|'solid'`, `amount?: number(ml)`, `duration?: number(秒)`, `breastSide?: 'left'\|'right'\|'both'` |
| sleep | `sleepType: 'night'\|'nap'`, `duration: number(秒)`, `location?: string` |
| diaper | `diaperType: 'pee'\|'poop'\|'both'`, `consistency?: 'watery'\|'soft'\|'formed'\|'hard'`, `color?: 'normal'\|'yellow'\|'green'\|'black'\|'red'` |
| temperature | `temperature: number(°C)`, `method?: 'oral'\|'axillary'\|'rectal'\|'ear'` |
| growth | `height?: number(cm)`, `weight?: number(kg)`, `headCircumference?: number(cm)` |

### 2.5 `vaccine_records` 疫苗接种记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `babyId` | string | 是 | 宝宝 ID |
| `familyId` | string | 是(v4.2+) | ★ 所属家庭 ID（安全规则交叉校验用） |
| `name` | string | 是 | 疫苗名称 |
| `dose` | string | 是 | 剂次（如 "第1剂"） |
| `vaccinatedDate` | Date | 是 | 接种日期 |
| `note` | string | 否 | 备注 |
| `_familyIdMigratedAt` | Date | 否 | 迁移标记（由 `migrateRecordFamilyId` 写入） |

### 2.6 `milestone_records` 里程碑达成记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `babyId` | string | 是 | 宝宝 ID |
| `familyId` | string | 是(v4.2+) | ★ 所属家庭 ID（安全规则交叉校验用） |
| `name` | string | 是 | 里程碑名称 |
| `category` | string | 是 | 分类（大运动/精细动作/语言/社交） |
| `achievedDate` | Date | 是 | 达成日期 |
| `note` | string | 否 | 备注 |
| `_familyIdMigratedAt` | Date | 否 | 迁移标记（由 `migrateRecordFamilyId` 写入） |

### 2.7 `operation_logs` 云函数操作日志（v4.3+）

`familyOperation` 与 `patrolMemberOpenids` 写操作的补偿日志与审计记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `action` | string | 是 | action 名称（如 `dissolveFamily` / `clearBabyData` / `patrolMemberOpenids`） |
| `userId` | string | 否 | 操作者 `users._id`（巡检等系统调用可为空） |
| `openid` | string | 否 | 操作者 openid |
| `params` | Object | 否 | 原始入参（不含敏感信息） |
| `status` | enum | 是 | `'running'` \| `'ok'` \| `'failed'` \| `'partial'` |
| `startedAt` | Date | 是 | 开始时间 |
| `startedAtTs` | number | 是 | 开始时间数值时间戳 |
| `finishedAt` | Date | 否 | 结束时间 |
| `finishedAtTs` | number | 否 | 结束时间数值时间戳 |
| `durationMs` | number | 否 | 耗时（毫秒） |
| `cursor` | Object | 否 | 断点续传状态（`clearBabyData` 等分批任务使用） |
| `stats` | Object | 否 | 统计数据（如删除条数） |
| `error` | Object | 否 | `{ code, message, stack }` 失败时记录 |

**索引**：
- `action_startedAt_idx`（复合，`action:1, startedAt:-1`）—— 按 action 类型查近期日志
- `status_idx`（`status:1`）—— 查失败任务用于补偿

**ACL**：`PRIVATE`（客户端不可读写，仅云函数 admin SDK 访问）。

### 2.8 `rate_limits` 限流计数器（v4.3+）

`familyOperation` 的 `joinFamily` 等 action 使用的持久化限流表，取代 v4.2 内存 Map。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 系统 | 系统自动生成 |
| `key` | string | 是 | 限流键（如 `joinFamily:<openid>`） |
| `count` | number | 是 | 当前窗口累计次数 |
| `windowStart` | Date | 是 | 窗口起始时间 |
| `windowStartTs` | number | 是 | 窗口起始数值时间戳 |
| `expireAt` | Date | 是 | 窗口过期时间（用于后续 TTL 索引扩展） |

**索引**：
- `key_idx`（`key:1`，**唯一**）—— upsert 并发安全
- `windowStart_idx`（`windowStart:1`）—— 清理过期窗口

**ACL**：`PRIVATE`（客户端不可读写）。

---

## 3. 缓存策略

| 数据类型 | 缓存键 | 存储位置 | TTL |
|---------|--------|---------|-----|
| 用户信息 | `user_info` | wx.localStorage | 长期 |
| 当前宝宝 | `current_baby` | wx.localStorage | 长期 |
| 家庭信息 | `family_info` | wx.localStorage | 长期 |
| 记录缓存 | `records_{babyId}` | wx.localStorage | 实时同步，最多 200 条 |
| 离线队列 | `offline_queue` | wx.localStorage | 持久 |
| AI 配额 | `ai_quota` | wx.localStorage | 每日重置 `{ date, used }` |
| AI 洞察 | `ai_insight_{babyId}_{date}` | wx.localStorage | 当日有效，7天自动清理 |
| 活动睡眠 | `active_sleep_{babyId}` | wx.localStorage | 手动清理 |
| 今日统计 | `_todayStatsCache` | 内存(RecordService) | **15 秒** |
| 待办统计 | `_cache` | 内存(TodoService) | **30 秒** |
| 趋势数据 | `_cache` / `_periodCache` | 内存(TrendService) | **30 秒** |
| 主题偏好 | `app_theme_mode` | wx.localStorage | 长期（`'light'`/`'dark'`/`'system'`） |
| 去重操作 | `pendingOperations` | 内存(DeduplicationUtil) | **30 秒** 自动清理 |

---

## 4. 原子操作使用约定

| 操作 | 云数据库 Command | 应用场景 |
|------|----------------|---------|
| 向数组追加 | `db.command.push()` | 添加家庭成员、宝宝 |
| 从数组移除 | `db.command.pull()` | 移除成员、宝宝 |
| 批量查询 | `db.command.in()` | 批量获取宝宝信息 |
| 删除字段 | `db.command.remove()` | 清除 familyId + familyRole（解散家庭/退出家庭/被移除时） |
| 范围查询 | `db.command.gte()/lte()/and()` | 时间范围筛选 |

---

## 5. 安全规则配置（v4.2+）

6 个业务集合 + 2 个系统集合（v4.3+）配置 CloudBase 安全规则实现租户隔离：

| 集合 | aclTag | 规则（JSON 简写） |
|------|--------|------------------|
| `users` | `PRIVATE` | — （仅匹配自己 `_openid`） |
| `families` | `CUSTOM` | `read: auth.openid in doc.memberOpenids; create: auth != null; update: false; delete: false` |
| `babies` | `CUSTOM` | `read: auth.openid in get('database.families.' + doc.familyId).memberOpenids; create: auth != null; update: doc._openid == auth.openid; delete: false` |
| `records` | `CUSTOM` | `read` 同 `babies`；`update/delete: doc._openid == auth.openid`（创建者可改删） |
| `vaccine_records` | `CUSTOM` | 同 `records` |
| `milestone_records` | `CUSTOM` | 同 `records` |
| `operation_logs` (v4.3) | `PRIVATE` | — （客户端不可读写，仅云函数 admin SDK 访问） |
| `rate_limits` (v4.3) | `PRIVATE` | — （客户端不可读写，仅云函数 admin SDK 访问） |

### 5.1 跨用户写操作

- **families / babies 的跨用户写**：`update/delete` 规则关闭，必须通过 `familyOperation` 云函数（admin SDK 绕过规则）
- **records / vaccine_records / milestone_records 的他人记录改删**：受 `doc._openid == auth.openid` 约束，admin 角色如需清除其他成员记录，必须通过 `familyOperation.clearBabyData` action

### 5.2 客户端查询约束

所有查询必须在 `where` 条件中附加 `familyId` 字段：

```javascript
// ✅ 正确
db.collection('records').where({ babyId, familyId }).get()

// ❌ 错误 — 安全规则无法执行 get() 校验，查询被拒绝
db.collection('records').where({ babyId }).get()
```

详见 `coding-conventions.md` §8 数据库操作约束。

---

*文档维护：新增集合或字段时同步更新此文档；修改安全规则时同步更新 §5。*
