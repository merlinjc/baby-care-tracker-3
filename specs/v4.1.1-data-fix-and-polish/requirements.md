# 需求文档 - v4.1.1 存量数据修复 & 体验优化（Data Fix & Polish）

> 版本：v1.0 | 日期：2026-04-15 | 状态：方案评审中
> 来源：v4.1 实施后风险评估中的 3 项遗留问题

---

## 一、背景

v4.1（AI Shield & Share Auth Hardening）完成后，经实施后风险评估发现以下三个遗留问题：

| # | 遗留风险 | 严重程度 | 用户影响 |
|---|---------|---------|---------|
| 1 | 存量 records 的 `createdBy.userId` / `creatorId` 仍为 openid 格式，与统一后的 `_id` 不匹配 | **中** | editor 角色无法删除自己在 v4.1 前创建的旧记录 |
| 2 | 存量幽灵成员：用户残留在已退出家庭的 `members`/`memberDetails` 中 | **中** | 旧家庭成员数显示偏多，可能导致 `getFamilyByUserId` 返回错误家庭 |
| 3 | 发现页从 4 项减为 3 项后，2x2 网格右下角出现空位 | **低** | 视觉不美观，但不影响功能 |

---

## 二、需求列表

### FR-1：存量 records userId 迁移

**问题根因**：
- v4.1 之前，`record.js#createRecord()` 使用 `userInfo.openid` 写入 `createdBy.userId` 和 `creatorId`
- v4.1 统一为 `userInfo._id` 后，新记录正常，但存量记录仍为 openid
- `permission.js#canDeleteRecord()` 第 148 行做严格相等 `===` 比较，editor 角色的 `userId`（_id）≠ `recordCreatorId`（openid），导致无法删除自己的旧记录

**头脑风暴方案**：

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. 云函数批量迁移** | 编写一次性云函数，遍历所有 records，通过 users 集合的 `_openid → _id` 映射表，将 `createdBy.userId` 和 `creatorId` 从 openid 更新为 `_id` | 一劳永逸；数据干净；无运行时开销 | 需要构建 openid→_id 映射；需处理 users 集合中可能没有 _openid 字段的情况；执行期间有短暂数据不一致 | ⭐⭐⭐⭐ |
| **B. 前端兼容层** | 在 `canDeleteRecord` 中增加双重匹配：先比较 `_id`，不匹配时再查 `userInfo.openid` 比较 | 零迁移成本；立即生效 | 永远带着兼容逻辑；每次删除判断多一次比较；`userInfo.openid` 在 v4.1 之后可能不再存储 | ⭐⭐⭐ |
| **C. 惰性迁移** | 用户查看记录列表时，检测到 `createdBy.userId` 与当前 `_id` 不同但 `_openid` 匹配时，自动更新该条记录 | 无需集中迁移；逐步收敛 | 长尾问题——不常访问的记录永远不会迁移；需要在读取路径增加写操作；增加读取延迟 | ⭐⭐ |
| **D. A+B 组合** | 先上线 B（前端兼容层）立即修复用户体验，后台异步执行 A（云函数迁移），迁移完成后移除 B 的兼容代码 | 用户体验立即修复 + 数据最终一致 | 两步操作，稍复杂 | ⭐⭐⭐⭐⭐ |

**推荐方案：D（A+B 组合）**

理由：
1. B 方案可以在 v4.1.1 中立即上线，修复 editor 无法删除旧记录的问题
2. A 方案可以作为后台任务异步执行，最终清理完所有存量数据
3. 迁移完成后在 v4.2 中移除 B 的兼容代码，保持代码干净

**FR-1 具体需求**：
- **FR-1.1**（前端兼容 - 立即修复）：`canDeleteRecord()` 增加 fallback 匹配——若 `recordCreatorId !== userId`，额外检查 `userInfo._openid || userInfo.openid` 是否与 `recordCreatorId` 匹配
- **FR-1.2**（云函数迁移 - 后台执行）：编写云函数 `migrateRecordUserId`，构建 `users._openid → users._id` 映射表，批量更新所有 records 的 `createdBy.userId` 和 `creatorId`
- **FR-1.3**（收尾清理 - v4.2 执行）：迁移完成并验证后，移除 `canDeleteRecord` 中的 openid fallback 兼容代码

---

### FR-2：存量幽灵成员清理

**问题根因**：
- v4.1 之前 `joinByInviteCode` 没有检查旧家庭，用户加入新家庭后旧家庭 `members[]` 中仍然残留该用户 ID
- v4.1 增加了增量防护（加入前检查+自动移除），但未修复存量数据
- `getFamilyByUserId()` 查询 `members` 数组包含 userId 的家庭，只返回第一条——幽灵残留可能导致返回错误的家庭

**头脑风暴方案**：

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. 云函数全量扫描** | 遍历所有 families，逐个检查每个 member 的 `users.familyId` 是否指向该家庭，不匹配的从 `members`/`memberDetails` 中移除 | 彻底清理；一次性执行 | 需要 N×M 次查询（N 个家庭 × M 个成员）；大家庭可能超时；需要合理分批 | ⭐⭐⭐⭐ |
| **B. getFamilyByUserId 加固** | 查询时如果返回多条结果，优先匹配 `users.familyId` 对应的家庭；非匹配的标记为幽灵并异步清理 | 无需集中迁移；自修复 | 只能修复活跃用户的问题；清理逻辑分散在查询路径中 | ⭐⭐⭐ |
| **C. ensureUserReady 反向清理** | 在 `ensureUserReady` 步骤 5 中，如果用户在当前家庭成员列表中，额外查询是否在其他家庭中也存在，存在则异步移除 | 主动发现+修复；用户无感 | 增加 ensureUserReady 延迟（额外一次数据库查询）；只覆盖活跃用户 | ⭐⭐ |
| **D. A+B 组合** | 先执行 A（云函数扫描清理存量），同时增强 B（`getFamilyByUserId` 优先匹配 familyId）防止新的幽灵残留 | 存量彻底清理 + 增量防护加固 | 两步操作 | ⭐⭐⭐⭐⭐ |

**推荐方案：D（A+B 组合）**

理由：
1. 云函数全量扫描可以一次性清理所有幽灵成员
2. `getFamilyByUserId` 增加优先匹配 `familyId` 的逻辑，即使未来有边缘情况也不会返回错误家庭
3. v4.1 已有的增量防护（joinByInviteCode 前检查）+ B 方案的查询加固 = 双重保险

**FR-2 具体需求**：
- **FR-2.1**（getFamilyByUserId 加固 - 立即修复）：查询返回多条时，优先返回 `_id` 与用户 `familyId` 匹配的家庭；仅返回一条时维持现有逻辑
- **FR-2.2**（云函数清理 - 后台执行）：编写云函数 `cleanGhostMembers`，遍历所有 families，逐个检查 member 的 `users.familyId`，不匹配的从 `members` 和 `memberDetails` 中移除，记录清理日志
- **FR-2.3**（可选优化）：云函数执行后，在管理端（或日志中）输出清理报告——共扫描 X 个家庭，清理 Y 个幽灵成员

---

### FR-3：发现页布局优化

**问题根因**：
- v4.1 移除 AI 助手入口后，`toolItems` 从 4 项变为 3 项
- CSS Grid `grid-template-columns: repeat(2, 1fr)` 固定两列，3 项时右下角出现空位

**头脑风暴方案**：

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. 补充新功能入口** | 添加第 4 个功能入口（如"育儿百科""数据导出""家庭管理"快捷入口），恢复 2x2 满格 | 布局完美；增加功能曝光 | 需要设计新图标和入口逻辑 | ⭐⭐⭐⭐ |
| **B. 改为 1x3 横向布局** | `grid-template-columns: repeat(3, 1fr)`，三列等宽 | 无空位；简洁 | 每个卡片变窄，图标和文字可能拥挤；不如 2x2 大气 | ⭐⭐⭐ |
| **C. 保持 2x2，最后一格放引导** | 右下角放一个"更多功能，敬请期待"的占位卡片 | 简单实现；暗示未来功能 | 占位卡片价值不高；可能给用户"未完成"的感觉 | ⭐⭐ |
| **D. 自适应布局** | JS 根据 `toolItems.length` 动态设置列数：3 项 → 3 列，4 项 → 2 列 | 灵活适配；未来增减入口无需改布局 | 3 项时卡片偏窄；实现稍复杂 | ⭐⭐⭐ |
| **E. 补充"数据导出"快捷入口** | 将 packageSocial 中已有的"数据导出"功能提升到发现页入口，复用现有页面 | 零新开发；功能已存在；填满 2x2 | 数据导出使用频率较低 | ⭐⭐⭐⭐⭐ |

**推荐方案：E（补充"数据导出"快捷入口）**

理由：
1. `packageSocial/pages/export/export` 页面已存在，零新功能开发
2. 数据导出本身是有价值的功能，放在发现页提高曝光
3. 恢复 2x2 满格布局，视觉完美
4. 只需在 `discover.js` 的 `toolItems` 数组中新增一项 + 准备一个图标

**FR-3 具体需求**：
- **FR-3.1**：在 `discover.js` 的 `toolItems` 数组末尾新增"数据导出"入口，链接到 `/packageSocial/pages/export/export`
- **FR-3.2**：为数据导出入口准备合适的图标（优先从现有 icons 中复用，无合适的则新增）
- **FR-3.3**：调整渐变背景色，与其他 3 项协调（建议使用美拉德色系中未使用的色调）

---

## 三、优先级排序

| 优先级 | 需求 | 理由 | 预计工时 |
|--------|------|------|---------|
| **P0** | FR-1.1 前端兼容层 | 直接影响用户操作（editor 无法删除旧记录） | 0.5h |
| **P0** | FR-2.1 getFamilyByUserId 加固 | 防止查询返回错误家庭 | 0.5h |
| **P1** | FR-3 发现页布局优化 | 视觉体验问题 | 0.5h |
| **P2** | FR-1.2 云函数迁移 records | 数据最终一致，但有前端兼容兜底 | 1.5h |
| **P2** | FR-2.2 云函数清理幽灵成员 | 数据干净，但有查询加固兜底 | 1.5h |
| **P3** | FR-1.3 移除兼容代码 | 留到 v4.2 做，依赖迁移完成 | 0.5h |

**v4.1.1 总预计工时：1.5h（P0） + 0.5h（P1） + 3h（P2） = 5h**

---

## 四、实施阶段规划

### Phase 1：前端热修复（v4.1.1 发布）
- FR-1.1：`canDeleteRecord` 增加 openid fallback
- FR-2.1：`getFamilyByUserId` 优先匹配 familyId
- FR-3：发现页补充"数据导出"入口

### Phase 2：后台数据修复（v4.1.1 发布后异步执行）
- FR-1.2：云函数 `migrateRecordUserId`
- FR-2.2：云函数 `cleanGhostMembers`

### Phase 3：代码清理（v4.2）
- FR-1.3：移除 `canDeleteRecord` 中的 openid fallback

---

## 五、验收标准

| 场景 | 预期结果 |
|------|---------|
| editor 角色尝试删除 v4.1 前创建的自己的记录 | 可以正常删除（FR-1.1 兼容层生效） |
| 用户残留在已退出家庭的 members 中，查询 `getFamilyByUserId` | 返回用户当前 `familyId` 对应的正确家庭（FR-2.1） |
| 云函数 `migrateRecordUserId` 执行后 | 所有 records 的 `createdBy.userId` 和 `creatorId` 均为 `_id` 格式 |
| 云函数 `cleanGhostMembers` 执行后 | 所有 families 的 `members` 中不含非本家庭成员 |
| 发现页打开 | 显示 4 个功能入口（疫苗/生长曲线/里程碑/数据导出），2x2 布局无空位 |
| 点击"数据导出"入口 | 正确跳转到 `/packageSocial/pages/export/export` 页面 |

---

## 六、影响范围

### 代码变更
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `miniprogram/utils/permission.js` | 修改 | `canDeleteRecord` 增加 openid fallback（FR-1.1） |
| `miniprogram/services/family.js` | 修改 | `getFamilyByUserId` 多结果优先匹配（FR-2.1） |
| `miniprogram/pages/discover/discover.js` | 修改 | `toolItems` 新增数据导出入口（FR-3.1） |
| `cloudfunctions/migrateRecordUserId/` | 新增 | 存量 records userId 迁移云函数（FR-1.2） |
| `cloudfunctions/cleanGhostMembers/` | 新增 | 存量幽灵成员清理云函数（FR-2.2） |

### 数据变更
| 集合 | 字段 | 变更 |
|------|------|------|
| `records` | `createdBy.userId`, `creatorId` | openid → _id（FR-1.2） |
| `families` | `members[]`, `memberDetails[]` | 移除幽灵成员（FR-2.2） |
