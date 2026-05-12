# Web 端 vs 小程序端 功能差异盘点

> 版本：v1.0 | 日期：2026-05-09  
> 目的：为「双端对齐」决策提供依据——逐项列出**小程序缺什么（Web 有）**和 **Web 缺什么（小程序有）**，由产品决定补哪边。  
> 约定：✅ 已有 / ⚠️ 部分实现 / ❌ 缺失 / — 不适用

---

## 0. 事实基线

| 维度 | 小程序端 (miniprogram/ + cloudfunctions/) | Web 端 (client/ + server/ + shared/) |
|------|---|---|
| 版本代号 | v4.3.2 **Milo**（稳定） | v5.0.0-alpha **Saplings**（alpha） |
| 前端 | 原生小程序（WXML/WXSS/JS） | React 19 + TS 6 + Vite + Tailwind 4 |
| 后端 | CloudBase 云函数 + NoSQL | Express + Prisma + MySQL/SQLite |
| 鉴权 | `wx.cloud` OPENID（服务端不可伪造） | JWT + bcrypt + httpOnly refresh cookie |
| 数据库连接 | 客户端直连 CloudBase NoSQL + 云函数网关 | HTTPS REST 到 Express |
| 数据是否互通 | ❌ **两端数据完全不互通**（不同库、不同用户体系） | |
| 代码关系 | 独立演进的双项目，**共享 specs/docs 但不共享运行时** | |

**关键结论**：两端不是"同一应用的前后端"，而是"同一产品的两个独立实现"。"移植"在这里 = "功能对齐"。

---

## 1. 页面层差异

### 1.1 小程序缺 / Web 独有页面

| 路由/页面 | Web 实现 | 小程序现状 | 建议补齐度 |
|---|---|---|---|
| `/jaundice` **黄疸记录** | `client/src/pages/jaundice/index.tsx` + `lib/jaundice.ts`（localStorage MVP，Kramer 分区 / TcB / TSB / 趋势图） | ❌ 无 | **中**：MVP 方案独立，易移植；小程序可用 `wx.setStorageSync` 落地 |
| `/report` **成长报告页** | `client/src/pages/report/index.tsx` + 6 子组件（封面/指标/节律/成长/成就/AI总结/周趋势）+ `use-report-data.ts` 聚合 hook | ⚠️ 有 `components/report-popup`（弹窗形态，内容更少） | **中**：小程序是"弹窗视图"，Web 是"独立页面+周/月切换+AI总结"。可升级为独立 Tab |
| `/settings` **设置页** | `client/src/pages/settings/index.tsx` | ⚠️ 有 `packageSocial/pages/settings`，但无「字体大小」「三态主题切换 UI」 | **低**：按需补 |

### 1.2 Web 缺 / 小程序独有页面

| 小程序页面 | 小程序路径 | Web 现状 | 建议补齐度 |
|---|---|---|---|
| **引导页** `/guide` | `pages/guide/` | ❌ 无（Web 仅登录页） | **低**：Web 通过 README/onboarding 引导 |
| **宝宝详情页** `/baby-detail` | `packageGrowth/pages/baby-detail` | ⚠️ Web 只有 baby 创建/编辑 | **低**：Web 的 `baby-card` 已展示核心信息 |
| **导出页** `/export` 独立页面 | `packageSocial/pages/export` | ⚠️ Web 有 `/api/export` 后端但无独立 UI 入口（仅 settings 里按钮） | **低** |

### 1.3 两端都有但实现差异大的页面

| 页面 | Web | 小程序 | 差异点 |
|------|-----|--------|--------|
| 首页 | `TodaySummary`（4 列大数字）+ `StatusCapsule`（4 态：none/sleeping/feeding_ago/sleep_abnormal）+ `BabySwitcher`（多宝头像组） | 已有今日概览 + 多宝切换，但 **StatusCapsule 4 态判定逻辑在 Web 更完整** | 小程序 `status-capsule` 仅 wxml 类名，**4 态业务判定未对齐** |
| 记录页 | `InsightSection`（4 卡片 + `RangeBar` 60% 正常区 + 定位点 + 异常高亮+ AI咨询按钮） | 有 insight-section 但 **RangeBar 可视化组件缺失** | 小程序缺「参考范围条可视化」 |
| 里程碑 | **打卡模式**：28 项标准列表 + 圆形 toggle，`POST /milestones` 幂等 upsert + `(babyId, name)` 唯一索引 | **自由添加模式**：允许重复创建 | **数据模型语义不同**，需决定统一走哪边 |
| 成长页 | `pages/growth/` + 趋势 | `packageGrowth/pages/growth` | 功能基本对齐 |
| 疫苗页 | `pages/vaccine/` | `packageGrowth/pages/vaccine` | 功能对齐 |
| 家庭页 | `InviteSection`（倒计时 + 复制 + 分享 + 刷新）+ `MembersSection`（三点菜单）+ 3 个编辑 Dialog | 已有完整家庭页 | 基本对齐 |
| AI 助手 | 流式输出 + `autoPrompt` 协议（路由 state 预填问题）+ `QuotaBar` | 有 ai-assistant 页 + streamText | **小程序缺 `autoPrompt` 跨页预填协议** |

---

## 2. 组件层差异

### 2.1 小程序缺 / Web 独有组件

| Web 组件 | 作用 | 小程序是否需要 |
|---|---|---|
| `components/ui/*` (31 个 shadcn 风格组件) | Button/Card/Dialog/Input/Skeleton/Toast/LargeTitleHeader/SectionHeader/SegmentedControl 等基础组件库 | — 小程序用原生控件，不必 1:1 移植，但可**整理一套统一样式类** |
| `jaundice-dialog.tsx` | 黄疸记录弹窗 | ❌ 同 §1.1 jaundice 页，需要 |
| `font-scale-selector.tsx` | **字体大小 4 档切换**（sm/md/lg/xl） | ❌ 小程序完全没有字体缩放能力 |
| `theme-selector.tsx` | **三态主题切换**（亮色/暖夜/跟随系统）UI | ⚠️ 小程序的 ThemeManager 支持暗色但 **UI 选择器缺失**（目前切换埋在设置里） |
| `care-role-selector.tsx` | **CareRole 身份选择器**（8 种：mom/dad/grandma_m/_p/grandpa_m/_p/nanny/other） | ❌ 完全无此概念 |
| `quota-bar.tsx` | AI 配额进度条 | ⚠️ 有 `services/quota.js` 但无专属 UI 组件 |
| `number-roll.tsx` | 数字滚动动画 | ❌ 无 |
| `weekly-trend-overview.tsx` | 发现页上下周对比总览 | ❌ 小程序 trendService 有数据但无此总览 UI |
| `report/*` (6 个报告子组件) | 封面/指标网格/每日节律/成长/成就/AI总结 | ⚠️ 小程序 report-popup 只有 Canvas 绘制，未拆分为组件 |

### 2.2 Web 缺 / 小程序独有组件

| 小程序组件 | 作用 | Web 是否需要 |
|---|---|---|
| `components/baby-edit-popup` | 宝宝编辑弹窗（含 swipe-close 手势） | Web 已有表单页，不需要 |
| `components/export-popup` | 导出弹窗 | Web 可复用 `/settings` 的导出按钮 |
| `components/easter-egg-popup` / `easter-egg-toast` | 彩蛋弹窗 + Toast | ✅ Web 已有 `easter-egg-display.tsx`，功能对齐 |
| `swipe-close` Behavior | 弹窗下滑关闭手势 | — Web 用 Radix Dialog，不需要 |
| `behaviors/share-behavior` | `onShareAppMessage` + `onShareTimeline` | — Web 不支持微信分享卡片（只能分享图+链接） |

---

## 3. Service / 后端逻辑差异

### 3.1 小程序缺 / Web 独有的业务能力

| Web 能力 | 代码位置 | 小程序现状 | 建议补齐度 |
|---|---|---|---|
| **AI 角色差异化 (CareRole)** | `server/services/ai.service.ts` `buildRoleSystemPrompt(role, ctx)`；缓存 key 扩展 `daily_insight:${babyId}:${today}:${role}` | ❌ 小程序 `services/ai.js` 无 role 参数 | **高**：小程序端 AI 人设千篇一律 |
| **AI 配额 AIQuota** | `server/services/ai.service.ts` `consumeQuota` 原子自增 + `refundQuota` + `AI_FETCH_TIMEOUT_MS` 超时降级 → `buildFallbackInsight` | ⚠️ 小程序有 `services/quota.js` 但**缺失失败回滚和 fallback 降级链** | **中** |
| **进行中睡眠云端会话** | `POST /records` 校验 `SLEEP_ALREADY_ACTIVE`；`GET /records?endTimeIsNull=true`；`PATCH /records/:id` 结束 | ⚠️ 小程序用 `_todayStatsCache` 推断，**未在服务端强校验并发** | **高**：多端场景下小程序存在双会话风险 |
| **跨午夜睡眠 today 统计** | `getTodayStats` 用 `OR: [{startTime}, {endTime}]` 同时落在当日的睡眠都算 | ⚠️ 小程序实现逻辑接近但 `lastTimeTs / lastEndTimeTs` 双字段未暴露 | **中** |
| **增强周趋势 `REFERENCE_RANGES`** | `server/services/trend.service.ts` 按月龄档位引用 AAP/NSF/CDC 参考范围 | ❌ 小程序 `trendService.js` 有趋势但**无参考范围判定** | **中** |
| **deleteBaby cursor 续传** | 单批 500 + 10s 软超时 + `OperationLogger.findOngoing` 跨设备恢复 | ✅ 小程序 v4.3.1 已有 cursor 续传（`deleteBaby` action） | 对齐 |
| **OperationLogger 落库** | 8 个 family 写 + deleteBaby 同步落 `operation_logs` | ✅ 小程序已有 `operation_logs` 集合 + logger | 对齐 |
| **持久化限流 RateLimit** | Prisma `RateLimit` 表，多实例共享 | ✅ 小程序已有 `rate_limits` 集合 | 对齐 |
| **Patrol 巡检任务** | `familyConsistency`（每天）+ `aiQuotaCleanup`（每周），`setInterval` + 启动校时 + 分布式锁 | ✅ 小程序有 `patrolMemberOpenids`，但 `aiQuotaCleanup` 缺失 | **低**：补 aiQuotaCleanup |
| **双层权限闸（Web 客户端）** | `usePermission()` hook + `permission-guard.ts`（防缓存漂移 + URL 直跳 + 灰度） | ✅ 小程序有 `services/permission-guard.js`（v4.3.0） | 对齐 |
| **刷 token / 记住用户名** | httpOnly refresh cookie + `baby_care_last_login_identifier` | — 小程序用 OPENID，无密码登录概念 | 不适用 |

### 3.2 Web 缺 / 小程序独有的业务能力

| 小程序能力 | 代码位置 | Web 现状 | 建议补齐度 |
|---|---|---|---|
| **离线优先 + 离线队列同步** | `services/sync.js`（队列 + 重试 3 次 + 网络监听 + tempId→realId 替换） | ❌ Web 端**无离线支持**，断网即报错 | **中**：Web 端可引入 IndexedDB + SW，成本较高 |
| **三层缓存体系** | `globalData` + `wx.setStorageSync` + Service 内存缓存（15-30s TTL） | ⚠️ Web 有 React Query 缓存但**无持久化层** | **低**：React Query 已解决 80% 场景 |
| **双时间戳设计** | 所有写入同时写 `serverDate()` + 数值时间戳 `Ts` | ✅ Web 用 `Date` + 数值已对齐 | 对齐 |
| **云函数网关 `familyOperation`** 13 action | `cloudfunctions/familyOperation` | — Web 走 Express service 层，设计决策为**不引入网关**（`web-architecture.md §2.1`） | 对齐，不同架构决策 |
| **安全规则交叉校验（NoSQL ACL）** | 6 集合 CUSTOM 规则，`get('database.families.' + doc.familyId).memberOpenids` | — Web 走 Prisma + service 层 `isFamilyMember` 校验 | 对齐，不同架构决策 |
| **E2E 安全测试 `e2eSecurityTest`** | 163 用例 / 15 模块 / RuleSimulator 模拟安全规则判定 | ❌ Web 只有 66 E2E API 用例，**无安全规则模拟层** | **低**：两端架构不同，不可直接迁移 |
| **`traceUser` / `getOpenId` 云函数** | `cloudfunctions/getOpenId` | — | 不适用 |
| **微信分享卡片 / 朋友圈** | `behaviors/share-behavior.js`（`onShareAppMessage` + `onShareTimeline`） | ❌ Web 只能 `navigator.share` + 下载图 | **低**：平台能力限制，无解 |

### 3.3 两端都有但实现差异

| 能力 | Web | 小程序 | 说明 |
|---|-----|--------|------|
| AI 流式响应 | `chatStream` SSE + `ReadableStream` + `QuotaBar` | `services/ai.js streamText` 回调式 | 协议不同但功能对齐 |
| 分享图生成 | `lib/share-canvas.ts` `renderShareImage` + `renderReportImage`（OffscreenCanvas + 2DPR + 动态高度） | `services/share-canvas.js` (44KB wx.canvas) | 两端各实现一套，结果一致 |
| 主题系统 | `[data-theme="warm-night"]` + `useThemeStore` + `<ThemeSelector>` 三态 UI | ThemeManager + app.wxss 暗色变量，**缺 UI 选择器** | 小程序缺前端可见入口 |
| 邀请码 | 后端 `invite-code.ts` + 客户端 `InviteSection` 倒计时 | `lib/invite-code.js` + family 页 | 功能对齐，UI 形态不同 |

---

## 4. 数据模型差异

| 集合/表 | 小程序 (NoSQL) | Web (Prisma) | 差异 |
|---|---|---|---|
| `users` | 平铺文档 + `familyId` / `familyRole` | `User` + `FamilyMember` 关系表 | Web 用关系表更规范 |
| `families` | `members[]` + `memberOpenids[]` + `memberDetails[]`（三副本） | `Family` + `FamilyMember` (独立表) | Web 更 normalized；小程序三副本是为安全规则服务 |
| `babies` | `_openid` + `familyId` + `creatorId` | `Baby.familyId` 外键 | 语义对齐 |
| `records` | 5 种 data 子结构（feeding/sleep/diaper/temperature/growth） | **分表**：`Record` + `FeedingDetail` / `SleepDetail` / `DiaperDetail` / `TemperatureDetail` / `GrowthRecord` | 大差异：Web 用 1:1 子表，小程序用 JSON 嵌入 |
| `vaccine_records` | 单集合 | `VaccineRecord` | 对齐 |
| `milestone_records` | 无 `(babyId, name)` 唯一约束 | **有 `@@unique([babyId, name])`** | **Web 强制打卡一致性，小程序允许重复** |
| `operation_logs` | v4.3 新增 | `OperationLog` | 对齐 |
| `rate_limits` | v4.3 新增 | `RateLimit` | 对齐 |
| `ai_quotas` | — 用本地 quota.js 服务 | `AIQuota` + `@@unique([userId, date])` | Web 持久化，小程序内存 |
| `jaundice_records` | ❌ | ❌（Web 用 localStorage） | 两端都未建表（MVP 策略） |
| `User.wechatUnionId` | — | ⚠️ 预留字段，未启用 | 微信扫码登录 backlog |

---

## 5. 建议的双向补齐清单（按价值/成本排序）

### 5.1 强烈建议补到小程序（Web 有，价值高）

| 优先级 | 功能 | 理由 | 预估成本 |
|---|---|---|---|
| **P0** | 里程碑改为**打卡模式** + `(babyId, name)` 唯一索引 | 消除"同一里程碑多条记录"数据污染；Web 已在生产 | 2d（需数据迁移脚本） |
| **P0** | 进行中睡眠**服务端并发校验**（`SLEEP_ALREADY_ACTIVE`） | 多设备同步场景下避免双计时污染 | 1d（familyOperation/createRecord 加校验） |
| **P1** | **AI 角色差异化** (`CareRole` 8 种 + `buildRoleSystemPrompt`) | AI 体验显著提升，妈妈/祖辈/月嫂口吻差异化 | 2d |
| **P1** | **周趋势参考范围 `RangeBar`** 可视化（60% 正常区 + 定位点 + 异常高亮） | 已有趋势数据，补一层可视化 | 1.5d |
| **P1** | **字体大小 4 档**（sm/md/lg/xl） | 老年人/低视力无障碍；小程序完全缺失 | 2d（需统一 wxss 变量） |
| **P2** | **黄疸记录** MVP（本地存储 + 趋势图 + 教育提示） | 新生儿期高频需求 | 2d |
| **P2** | **成长报告独立页**（周/月切换 + 6 分区 + AI 总结按需触发） | 当前是弹窗，信息层次不够 | 3d |
| **P2** | **三态主题 UI 选择器**（明色/暖夜/跟随系统） | 底层已支持，只需前端入口 | 0.5d |
| **P3** | **AI 配额失败回滚 + fallback 降级链** | 稳定性提升 | 1d |
| **P3** | **AI 助手 autoPrompt 协议** | 跨页带问题跳转，减少复制粘贴 | 1d |
| **P3** | **Patrol `aiQuotaCleanup`**（每周） | 清理过期配额行 | 0.5d |

### 5.2 强烈建议补到 Web（小程序有，价值高）

| 优先级 | 功能 | 理由 | 预估成本 |
|---|---|---|---|
| **P1** | **离线优先 + 离线队列**（断网可用） | Web 端断网即报错，移动端体验差 | 5d（引入 IndexedDB + SW + 队列） |
| **P2** | **Patrol 反向漂移检查（阶段 2）** | Web patrol 只做 family 一致性，缺反向 | 1d |
| **P2** | **宝宝列表/详情独立页** | 目前散落在首页和创建表单 | 1.5d |
| **P3** | 发现页**引导页 / onboarding** | 首次体验优化 | 1d |

### 5.3 不建议迁移（架构决策/平台限制）

| 功能 | 原因 |
|---|------|
| 小程序 → Web：云函数网关 `familyOperation` | Web 明确决策不引入（`web-architecture.md §2.1`），Express service 层已足够 |
| 小程序 → Web：`e2eSecurityTest`（163 用例 + RuleSimulator） | 模拟的是 CloudBase 安全规则，Web 没有对应层 |
| 小程序 → Web：微信分享卡片 / 朋友圈 | Web 平台无此能力，无法对齐 |
| 小程序 → Web：`wx.cloud` OPENID 鉴权 | Web 没有 OPENID 概念，JWT 已是最优解 |
| Web → 小程序：JWT + refresh token + 记住用户名 | 小程序用 OPENID，本身就是长效身份 |
| Web → 小程序：httpOnly cookie 机制 | 小程序无浏览器 cookie 概念 |
| Web → 小程序：微信扫码登录 `/auth/wechat/callback` | 这是给 Web 用户"反向登录到微信"的；小程序本身就是微信内 |

---

## 6. 数据互通问题（独立议题）

**现状**：两端数据完全不互通。Web 用户创建的记录，小程序看不到；反之亦然。

**若未来需要打通**：

1. **短期方案**：Web 端改造为"CloudBase 直连模式"（放弃 server/Express，前端用 `@cloudbase/js-sdk`）→ 和小程序共享同一个 NoSQL 数据库。代价：丢失 Web 已完成的 server/ 代码（约 44 个 .ts 文件、10 个 service）。
2. **长期方案**：保留两端后端，通过**定向同步服务**打通（`CloudBase → MySQL` 双向 CDC）。代价高，不建议。
3. **统一用户体系**：需要在 `User` 表加 `wechatUnionId`（Web `prisma schema` 已预留注释，未启用）+ 小程序 `users` 集合也加 `wechatUnionId`。前提是用户走过一次"微信开放平台"关联。

**建议**：如果近期不打算合并数据，维持双端独立，**只对齐功能和 UI 体验**；这份盘点表就是"对齐 roadmap"。

---

## 7. 下一步决策点

请就以下问题决策，我再出具体实施计划：

1. **里程碑打卡模式**（P0）：是否接受"小程序的历史重复数据需要去重迁移"的成本？
2. **字体大小 4 档**（P1）：小程序端无此需求（目标用户以年轻父母为主），还是也要对齐？
3. **黄疸记录**（P2）：小程序端是否列入排期？
4. **Web 离线能力**（P1，仅 Web）：是否愿意投入 5d 做 IndexedDB + SW？
5. **数据互通**（§6）：近期是否有合并双端用户/数据的需求？

---

*文档维护：双端功能发生显著变动时，更新对应条目并升版本号。*
