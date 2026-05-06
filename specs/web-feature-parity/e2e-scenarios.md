# Web 端 E2E 使用场景测试集（成员 / 家庭 / 宝宝 / 记录）

> 版本: v1.0 | 日期: 2026-05-06 | 作者: QA/开发共建
>
> 对标：[`specs/web-feature-parity/design.md`](./design.md) v1.6、[`docs/web-architecture.md`](../../docs/web-architecture.md)
>
> 目标：以"**真实家庭协作**"为视角，覆盖 30 个端到端（端 = 浏览器多账号，端到端 = UI → Express → Prisma → DB）关键场景。每个场景都能独立执行，并明确 **失败时定位到哪一层**。

---

## 0. 环境与账号准备

### 0.1 测试账号池（建议预置 6 个）

| 代号 | 昵称 | 角色定位 |
|------|------|---------|
| U1-妈妈 | momA | 创建者/admin |
| U2-爸爸 | dadA | editor（会被升 admin） |
| U3-奶奶 | grandma | viewer（只读验证） |
| U4-外婆 | grandmaM | 后加入 editor |
| U5-路人 | guest | 未加入家庭状态 |
| U6-另一家 | momB | 另一个家庭创建者（跨家庭隔离） |

### 0.2 环境检查清单

- 后端 `NODE_ENV=development`，`PATROL_ENABLED=false`（避免 patrol 干扰）
- 前端 `VITE_API_BASE_URL` 指向本地 `:3000`
- DB 使用 SQLite dev，`prisma migrate reset` 清空后执行
- 浏览器建议：Chrome + 隐身窗口 2 个 + 另一个浏览器（Firefox/Safari）模拟跨设备
- 时间校准：所有 "今日" 相关场景前确认服务器与客户端时区一致（Asia/Shanghai）

### 0.3 失败定位矩阵

| 症状 | 优先排查 |
|------|---------|
| 按钮点了没反应，无网络请求 | `usePermission` / 前端 hook |
| 请求发出但 403 | `requirePermission` 中间件 / service 层 `isAdmin` |
| 请求 200 但数据不对 | service 业务逻辑 / Prisma where 条件 |
| 刷新后丢失 | store persist / React Query staleTime |
| 跨设备不一致 | 云端拉取（如 active sleep） / 缓存未失效 |

---

## 1. 成员 / 家庭 生命周期（9 个场景）

### S01 创建家庭并获得 admin 角色

**前置**：U1 已注册登录，未加入任何家庭。

**步骤**：
1. 进入 `/family`，点击「创建家庭」
2. 输入家庭名称 `TangFamily`，昵称 `妈妈`
3. 提交

**预期**：
- toast 「家庭已创建」
- `useFamilyStore.family.id` 存在，`currentRole === 'admin'`
- DB: `families` 新增一条，`family_members` 一条 role=admin
- 顶部出现「管理员」徽章

**验证点**：
- ✅ 仅 1 个 FamilyMember 记录
- ✅ `family.babies=[]`
- ✅ 未调用 `inviteCode` 生成（按需调用）

---

### S02 展示并刷新邀请码

**前置**：S01 完成。

**步骤**：
1. 在 `/family` 页面 InviteSection 点击「刷新邀请码」
2. 等待接口返回

**预期**：
- 新邀请码 6 位，不含 `I/O/0/1`
- `inviteCodeExpiry` = now + 7 天
- 历史邀请码作废（再次用旧码加入返回 `INVITE_CODE_INVALID`）

**失败定位**：`families.service.ts#refreshInviteCode` + `invite-code.ts` 工具

---

### S03 新成员凭邀请码加入家庭（默认 editor）

**前置**：S02 拿到邀请码；U2 新账号登录、无家庭。

**步骤**：
1. U2 在 `/family` 点击「加入家庭」
2. 输入邀请码 + 昵称 `爸爸`

**预期**：
- U2 `currentRole === 'editor'`
- `family_members` +1 条；`families.babies` 仍旧
- U1 端回到 `/family`（或手动刷新），成员列表能看到 `爸爸`

**验证点**：
- ✅ 邀请码未过期
- ✅ 输入小写字母自动转大写，空格被去除

---

### S04 邀请码过期 / 错误码校验

**步骤**（3 子用例）：
1. U2 用 S02 过期前的旧码（已被 S02 刷新）→ 预期 `INVITE_CODE_INVALID`
2. U2 手动修改 inviteCodeExpiry 为昨天 → 用当前码 → `INVITE_CODE_EXPIRED`
3. U2 用明显乱码 `ABC12` (5 位) → 前端表单拦截或后端 `INVALID_INVITE_FORMAT`

**验证点**：
- ✅ toast 文案贴合 `web-ui-spec.md` 文案规范
- ✅ 重试计数受 `rate-limit-persistent.ts` 控制（同 openid/userId 每分钟上限）

---

### S05 加入家庭触发限流

**前置**：U5 登录。

**步骤**：连续用错误邀请码尝试加入 N+1 次（N 取 `joinFamilyRateLimit.max`）。

**预期**：
- 第 N+1 次返回 `RATE_LIMITED`，`Retry-After` 头存在
- DB `rate_limits` 表存在 `invite_<userId>` 对应记录，`count >= N+1`
- 等待窗口过期后可再次尝试

**失败定位**：`middlewares/rate-limit-persistent.ts` + `utils/rate-limiter.ts`

---

### S06 admin 将 editor 升为 admin（双 admin 共存）

**前置**：S03 后，U1(admin) + U2(editor)。

**步骤**：
1. U1 在成员列表点 U2 的「修改角色」→ 选 `admin`
2. 确认弹窗

**预期**：
- U2 `currentRole` 在下次拉取后变为 admin
- `family_members` U2 role=admin
- OperationLog 新增 `updateMemberRole` 记录 status=succeeded

**验证点**：
- ✅ U2 现在能看到「家庭管理」区（解散按钮等）
- ✅ U1 仍为 admin

---

### S07 admin 降级另一个 admin 到 editor（防止零 admin 校验）

**前置**：S06 完成，双 admin。

**步骤**：
1. U1 将 U2 降为 editor
2. U1 再尝试将自己降为 editor

**预期**：
- 步骤 1 成功
- 步骤 2 被拒绝：`LAST_ADMIN_FORBIDDEN`（至少保留一个 admin）

**失败定位**：`family.service.ts#updateMemberRole` 的 last-admin guard

---

### S08 admin 移除成员（editor）

**前置**：U1(admin), U2(editor), U3(viewer)。

**步骤**：
1. U1 在 U3 的操作菜单点击「移除」
2. 二次确认「移除奶奶」

**预期**：
- U3 端下次请求 `/me` 返回 `familyId=null`，路由跳到 `/family` 欢迎页
- `family_members` 不存在 U3；U3 本地 `users.familyId=null`, `familyRole=null`
- U3 过去创建的 records **保留**（不做级联删除），`createdBy` 仍保留

**验证点**：
- ✅ U3 若在线，下一次 React Query 轮询/focus 触发后被踢出
- ✅ OperationLog `removeMember`

---

### S09 成员主动退出家庭（3 种状态机）

**对照 FR-C5**，3 个子场景：

**S09-a 普通 editor 退出** → `status: 'ok'`，回首页
**S09-b 唯一 admin 退出（仍有其他成员）** → `status: 'need_transfer'`，弹 `TransferAdminDialog` 选继承人 → 完成后真正退出
**S09-c 唯一成员退出** → `status: 'dissolved'`，家庭整体解散，babies/records/... 级联清理

**验证点**：
- ✅ S09-c 后 `families` / `babies` / `records` / `vaccine_records` / `milestone_records` / `family_members` 均无该 familyId 数据
- ✅ OperationLog `dissolveFamily`（源头 trigger=auto）

---

## 2. 宝宝档案（6 个场景）

### S10 admin 创建宝宝（含生日合法性）

**步骤**：
1. U1 在 `/baby` 点 `+`
2. 输入 `小橘`，女，生日 `2025-10-01`
3. 保存

**预期**：
- `babies` +1，`families.babies` 追加 ID
- 自动切换 `currentBabyId` 到新宝宝（若是第一个）
- 首页 `todayStats` 接口返回空统计（无 records）

**边界子用例**：
- 生日 > 今天 → 表单校验拒绝
- 生日 < 1970-01-01 → 拒绝（`INVALID_BIRTHDATE`）
- 名字含特殊字符 emoji → 允许但长度 ≤ 20

---

### S11 editor 创建宝宝被拒绝（UI 层 + Service 层双闸）

**前置**：U2(editor) 登录。

**步骤**：
1. U2 进入 `/baby`，观察是否有 `+` 按钮
2. 若 UI 层隐藏，绕过：DevTools 直接调用 `api.post('/babies', ...)`

**预期**：
- UI 层：按钮不显示（`usePermission().isAdmin === false`）
- Service 层：直接调用返回 403 `PERMISSION_DENIED`（`BABY_CREATE` 权限）

**验证点**：
- ✅ 双层闸都生效（符合 `architecture.md` §2.7）

---

### S12 切换当前宝宝影响所有页面（全链路一致性）

**前置**：家庭有 2 个宝宝 `小橘` / `小桃`。

**步骤**：
1. `/baby` 选择 `小桃`
2. 返回首页 → 打开 `/record` / `/growth` / `/vaccine` / `/milestone` / `/ai-assistant`

**预期**：每个页面展示的数据 `babyId === 小桃.id`，没有一处还在请求 `小橘`。

**验证点**：
- ✅ React Query key 正确包含 babyId，未出现缓存串台
- ✅ `useBabyStore.currentBabyId` 持久化至 localStorage

---

### S13 更新宝宝信息（含头像）

**步骤**：
1. U1 点 `小橘` 编辑，改生日为 `2025-10-02`，上传头像
2. 保存

**预期**：
- `babies.updatedAt` 刷新
- 头像上传走后端（非直传 OSS），Content-Type 正确，最终返回 URL
- 首页 / 家庭页头像同步刷新（React Query 失效 + store 更新）

---

### S14 删除宝宝触发 cursor 续传（大量记录）

**前置**：为 `小橘` 灌入 5000 条 records（种子脚本）。

**步骤**：
1. U1 `/baby` 删除 `小橘`，二次确认
2. 观察网络面板

**预期**：
- 首次 `DELETE /babies/:id` 返回 `{ status: 'in_progress', cursor: '500' }`
- 客户端循环：每次带 `?cursor=` 继续
- 最终返回 `{ status: 'succeeded', deletedBabyId, records: 5000, ... }`
- `operation_logs` 中 `deleteBaby` 日志 steps 含多个 `chunk_record_*`，最终 status=succeeded

**恢复场景子用例 S14-b**：
- 中途刷新页面或断网重连
- 前端应检测 `OperationLogger.findOngoing('deleteBaby', babyId)`，从断点继续
- 最终 succeeded，总删除数等于 5000

**失败定位**：`server/src/services/baby.service.ts#deleteBaby` + `utils/operation-logger.ts`

---

### S15 editor 无法删除宝宝（UI 隐藏 + Service 403）

与 S11 对称。重点校验：**DevTools 绕 UI 直接发 DELETE 仍然 403**。

---

## 3. 记录核心（feeding/sleep/diaper/temperature/growth）（9 个场景）

### S16 editor 快速记录母乳喂养（原子写 + 统计刷新）

**前置**：U2(editor)，已切到 `小橘`。

**步骤**：
1. 首页点「母乳」快捷卡
2. 选择左侧 10 分钟

**预期**：
- `records` 新增 `recordType=feeding, data={ feedingType:'breast', breastSide:'left', duration: 600 }`
- `createdBy = { userId, nickname, avatar }` 为 U2
- 首页 `todayStats` 15 秒内（或 store invalidate 后立刻）刷新喂养次数 +1

**验证点**：
- ✅ 弹窗关闭逻辑走 `swipe-close` 手势（桌面不触发）
- ✅ 请求 payload 经 Zod 校验

---

### S17 编辑他人记录被拒（editor only own）

**前置**：S16 后，U1(admin) 登录。

**步骤**：
1. U1 `/record` 列表找到 U2 创建的记录
2. U1 编辑 → 成功（admin 可改任意）
3. 切到 U3(viewer)：编辑按钮不显示；强行 PATCH → 403

**新增 S17-b**：U2(editor) 尝试编辑 U3 以前留下的记录（假设 U3 降级过） → 403 `CAN_MODIFY_OWN_ONLY`

**失败定位**：`permission-guard.ts#requireCanUpdate` + service 层归属字段判定

---

### S18 进行中睡眠的云端会话（跨设备一致）

**前置**：U1 在浏览器 A 登录；U1 在浏览器 B 同账号登录。

**步骤**：
1. 浏览器 A：首页「开始睡眠」→ 选择夜睡
2. 浏览器 B：进入首页，观察是否显示「睡眠中 00:xx:xx」计时卡

**预期**：
- `records` 有一条 `recordType=sleep, endTime=null`
- 浏览器 B 通过 `useActiveSleep(babyId)` 云端拉取到该会话（不依赖 A 的 localStorage）
- A 和 B 计时显示在同一秒（允许 ±1s）

**S18-b 并发冲突**：浏览器 B 也点「开始睡眠」→ 返回 `SLEEP_ALREADY_ACTIVE`，UI toast 「当前宝宝已有进行中睡眠」

**S18-c 结束**：浏览器 A 点「结束睡眠」→ PATCH 写 endTime + duration；B 下次轮询后计时卡消失

**S18-d 取消**：再起一次 → 浏览器 A「取消计时」→ DELETE /records/:id；DB 无残留

**失败定位**：`useActiveSleep` 的云端拉取逻辑、`record.service.ts#createSleep` 的并发校验

---

### S19 跨午夜睡眠的今日统计

**步骤**：
1. U1 在 23:50 开始夜睡
2. 次日 07:00 结束夜睡
3. 观察 "今日" 与 "昨日" 首页统计

**预期**（FR-A）：
- 昨日统计：`sleepCount=1, sleepDuration ≈ 10min`（22:50–00:00 段）
- 今日统计：`sleepCount=1, sleepDuration ≈ 7h`（00:00–07:00 段）或按产品定义：该睡眠在"今日 endTime 命中"规则下 `lastEndTime` 存在
- `lastTime / lastTimeTs / lastEndTime / lastEndTimeTs` 字段均返回

**失败定位**：`record.service.ts#getTodayStats` 的 OR 查询

---

### S20 排便记录含性状与颜色

**步骤**：
1. U2 在首页点「排便」
2. 选择 `both`（尿+便），性状 `soft`，颜色 `green`，备注「吃了西兰花」

**预期**：
- `records.data = { diaperType:'both', consistency:'soft', color:'green' }`
- 列表展示颜色徽章（符合 `web-ui-spec.md` 调色板）
- AI 日看板提及异常颜色（若 consistency/color 异常触发 insight）

---

### S21 体温记录触发阈值提示

**步骤**：
1. U2 点「体温」→ 输入 38.5°C，方法 `ear`
2. 保存

**预期**：
- 记录入库
- 首页 / AI 洞察面板出现「发烧提示」（根据 `insight-fallback.ts` 的阈值规则）
- 不阻断记录（即便无 AI 也有 fallback 文案）

---

### S22 生长记录（身高/体重/头围）联动曲线

**步骤**：
1. U1 `/growth` 添加：身高 65cm, 体重 7.2kg, 头围 42cm, 日期今天
2. 再补录一条 1 个月前：身高 62cm, 体重 6.5kg, 头围 41cm

**预期**：
- 曲线图按时间升序渲染 2 个点
- 月增长卡：身高 +3cm / 体重 +0.7kg
- 数据点击弹出详情卡（来自 `web-component-library.md` 的 detail-card）

---

### S23 记录列表无限滚动与分页

**前置**：records 数量 ≥ 120。

**步骤**：
1. `/record` 滚动至列表底部
2. 观察"加载更多"触发

**预期**：
- 每页 20 条，滚动触发下一页
- React Query infinite query 正常合并
- 顶部「回到顶部」按钮在滚动超过 1 屏后显示

---

### S24 记录删除归属校验

**前置**：U2 创建了记录 R1；U3(viewer)。

**步骤**：
1. U3 列表 → 尝试长按 / 右键调出删除 → UI 应隐藏或禁用
2. U3 绕过 UI 发 DELETE → 403
3. U2 自己删除 R1 → 200
4. U1(admin) 删 R1 → 若 R1 已被删则 404；新建 R2 后 U1 删 → 200（admin 可删任意）

**失败定位**：`permission-guard.ts#requireCanDelete` + service 层归属判定

---

## 4. 跨家庭隔离 / 安全规则（3 个场景）

### S25 跨家庭查询阻断

**前置**：U1 在 FamilyA；U6 在 FamilyB。FamilyB 有宝宝 `小雪`，记录若干。

**步骤**：
1. U1 手工拼请求 `GET /records?babyId=<小雪.id>&familyId=<FamilyB.id>`

**预期**：
- 后端 `isFamilyMember(U1, FamilyB.id) === false` → 403
- 即便 U1 猜测到 `familyId` 也无法查询
- DB 层面：即使去掉 familyId 条件，service 强制附加 `familyId = user.familyId`

**验证点**：对应小程序侧的 CloudBase 安全规则 `auth.openid in memberOpenids`。

---

### S26 邀请码 / familyId 猜测攻击

**步骤**：
1. U5 循环请求 `POST /families/join { inviteCode: 'AAAAAA' }` 逐位枚举
2. 观察速率限制

**预期**：
- 超过阈值即 `RATE_LIMITED`
- 每次失败 toast 不泄露 familyId / members 信息
- OperationLog 无记录（加入失败不落日志）或落 `status=failed`

---

### S27 被移除成员的 JWT 失效策略

**前置**：U3 登录态有效 JWT；S08 刚被移除。

**步骤**：
1. U3 使用旧 JWT 发 `GET /babies`（仍带 Bearer）

**预期**：
- 200 但返回空列表 or `FAMILY_NOT_JOINED`（取决于实现）
- `GET /me` 显示 `familyId=null, familyRole=null`
- 任何涉及家庭数据的写请求 403 `FAMILY_NOT_JOINED`

**建议**：若未做主动 JWT 吊销，前端需在 401/403 统一拦截处理 → 重定向。

---

## 5. 疫苗 / 里程碑 / AI（4 个场景）

### S28 疫苗接种记录 + 下次提醒

**步骤**：
1. U1 `/vaccine` 勾选「乙肝第 2 剂」为已接种，日期今天
2. 观察疫苗计划列表

**预期**：
- `vaccine_records` +1
- 计划列表下一条变为「乙肝第 3 剂 · 下次建议日期」
- 首页「待办」减 1

---

### S29 里程碑达成动画

**步骤**：
1. U2 `/milestone` 勾选「翻身」为已达成
2. 观察弹出祝贺弹窗

**预期**：
- `milestone_records` +1，`achievedDate=today`
- 彩带/动画播放一次（不重复）
- 分享图按钮可用（`share-canvas`）

---

### S30 AI 日看板配额与降级

**前置**：`ai_quotas` 当日剩余 = 1。

**步骤**：
1. U1 `/ai-assistant` 触发"今日洞察" → 成功返回 AI 内容（剩余 0）
2. 再触发一次 → `QUOTA_EXCEEDED`，前端降级 `buildFallbackInsight`
3. 人为关闭 `HUNYUAN_SECRET_ID` 环境变量，配额 > 0 再调 → mock 内容 + refundQuota

**验证点**：
- ✅ 超时（> 8s）走 `AbortController` → fallback
- ✅ 三种失败路径（超限 / 无凭据 / 调用失败）在 `web-api-spec.md` 有明确 code

---

### S31 家庭解散级联清理（综合用例）

**前置**：U1(admin) 的 FamilyA 有 2 个 baby，共 100+ records / 20 vaccine / 10 milestone。

**步骤**：
1. U1 点「解散家庭」，二次确认
2. 等待返回

**预期**：
- 响应 `{ status: 'dissolved' }`
- `families / babies / records / vaccine_records / milestone_records / family_members` 均清空该 familyId
- U1/U2/U3 的 `users.familyId=null, familyRole=null`
- OperationLog `dissolveFamily` status=succeeded，steps 含 `delete_family_members / delete_records / delete_babies / delete_family`
- 所有在线用户下次路由守卫后被踢到 `/family` 欢迎页

**S31-b 中断恢复**：在删 records 中途 kill server，重启后 patrol `findOngoing('dissolveFamily')` 续跑至 succeeded。

---

## 6. 非功能 & 稳定性（补充场景，可选）

### S32 离线写入回退提示

前端断网 → 尝试写 feeding → 期望 toast「网络异常，请稍后重试」，不清空表单（不同于小程序的离线队列）。

### S33 主题切换不丢失数据

U1 切到 `warm-night` / `system` → 刷新 → 主题 + 数据均保持；验证 `globals.css` 与 `themes.css` 的变量映射。

### S34 退出登录清空本地态

U1 profile 页退出登录 → `useAuthStore / useFamilyStore / useBabyStore` 全部 reset；localStorage 中 `user_info / family_info / current_baby` 清空；重进登录页。

### S35 并发双开同一记录编辑（乐观锁或后写覆盖）

浏览器 A / B 同时编辑同一条 growth 记录 → 明确后写覆盖的交互（当前策略），或若引入 `updatedAt` 乐观锁则返回 `CONFLICT`。

---

## 7. 执行清单（推荐顺序）

| 阶段 | 场景 | 目的 |
|------|------|------|
| P0 冒烟 | S01, S03, S10, S16, S18-a/c | 主链路打通 |
| P1 权限 | S06, S07, S08, S09, S11, S15, S17, S24 | 双层闸验证 |
| P2 复杂场景 | S14, S18-b/d, S19, S31 | 事务/续传/跨午夜 |
| P3 安全 | S04, S05, S25, S26, S27 | 越权 + 限流 |
| P4 业务完整 | S20–S23, S28–S30 | 业务功能覆盖 |
| P5 非功能 | S32–S35 | 体验兜底 |

> 执行建议：同一批次内不同账号用不同浏览器 profile，避免 Cookie/LocalStorage 串扰；每个场景跑完截图 + 录屏，失败按"失败定位矩阵"贴前后端日志。

---

## 8. 追踪看板（模板）

```markdown
| ID  | 场景                         | 负责人 | 状态    | 缺陷编号 | 备注          |
|-----|------------------------------|--------|---------|----------|---------------|
| S01 | 创建家庭 + admin 角色        | -      | 未开始  |          |               |
| S02 | 邀请码刷新                   | -      | 未开始  |          |               |
| ... | ...                          | ...    | ...     | ...      | ...           |
| S35 | 并发双开编辑                 | -      | 未开始  |          |               |
```

- 状态枚举：未开始 / 进行中 / 通过 / 失败 / 阻塞
- 建议每条用例执行时间：5–15 分钟；S14、S18、S31 预留 30 分钟
