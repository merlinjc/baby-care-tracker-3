# 需求文档 - Web 版功能对齐与未完成需求落地

> 版本：v1.5 | 日期：2026-05-06 | 状态：✅ 已完成（2026-05-06，v5.0.0-alpha）
>
> 配套设计文档：[`design.md`](./design.md)（v1.6） | 实施计划：[`tasks.md`](./tasks.md)
>
> 范围：基于 21 份历史 specs（小程序 v1 → v4.3.2）的需求沉淀，结合 Web 版 monorepo（client + server + shared）的现状，把**仍未在 Web 端落地的需求**整理为一份统一的需求清单。本文档与 design.md 一一对应，每个 FR 域既给出 EARS 风格的验收标准，也保留对应的设计文档章节锚点。
>
> **版本历史**：
> - v1.0（初稿）：21 份 specs 需求覆盖矩阵 + FR-A~H 8 个 FR 域 + EARS 验收标准
> - v1.1（交叉迭代 C1）：FR-D1 副标题格式精确化（分项 2 个全角空格分隔，仅渲染非零分项）
> - v1.2（交叉迭代 C2）：FR-A1 增补多入口策略（AC9-AC11，区分计时与补录路径）
> - v1.3（交叉迭代 C3）：§5.1 端点路径表与 design 路由文件对齐（trend 挂在 babies.ts）
> - v1.4（交叉迭代 C4）：FR-E5 cursor 续传从 localStorage 改为云端 OperationLog 恢复（跨设备一致）
> - v1.5（交叉迭代 C5）：FR-C6 升级为双层防护（UI 层 + hook 层 PermissionGuard）

---

## 0. 全局摘要

### 0.1 历史 specs 需求覆盖矩阵

| 编号 | spec | 关键 FR 数 | 小程序状态 | Web 状态 | 本文档新 FR 域 |
|------|------|:--------:|:--------:|:--------:|:--------------|
| S1 | full-refactor（35 Bug + 10 FR） | 10 | ✅ | ✅（重构后无对应概念） | — |
| S2 | home-redesign（首页 v4.0） | 15 | ✅ | 🟡 仅 HomePage 骨架 | **FR-A** |
| S3 | family-collaboration（5 场景 13 FR） | 13 | ✅ | 🟡 后端就绪、前端缺 | **FR-C** |
| S4 | feeding-quick-amounts-update | 1 | ✅ | ❌ | **FR-A**（含 FeedingDialog 数组） |
| S5 | performance-optimization（50 FR） | 50 | ✅ | ⚠️ Web 体系无对应 | 不重复，遵循 React 最佳实践 |
| S6 | record-header-redesign | 3 | ✅ | ❌ | **FR-D** |
| S7 | share-image-optimization（6 FR） | 6 | ✅ | ❌ | **FR-G**（V1） |
| S8 | share-image-v2（10 模块成绩单） | 10 | ✅ | ❌ | **FR-G**（V2 P2） |
| S9 | ui-redesign-v4（14 FR） | 14 | ✅ | 🟡 基础完成 | **FR-A/D**（视觉细节） |
| S10 | v4.1-ai-shield-and-share-auth | 11 | ✅ | ⚠️ 不适用 | — |
| S11 | v4.1.1-data-fix-and-polish | 3 | ✅ | ⚠️ 不适用 | — |
| S12 | v4.2-cloud-function-gateway（15 FR） | 15 | ✅ | ⚠️ 重构为 Express service | — |
| S13 | v4.2-e2e-security-tests（126 用例） | — | ✅ | ❌ | **FR-H** |
| S14 | v4.2.2-docs-alignment-and-hotfix | 9 | ✅ | ⚠️ 部分对齐 | — |
| S15 | v4.3.0-stability-and-observability（15 FR） | 15 | ✅ | 🟡 schema 就绪、未启用 | **FR-E** |
| S16 | v4.3.1-review-fixes（22 FR） | 22 | ✅ | 🟡 默认 viewer / leaveFamily 已对齐 | **FR-C/E**（部分） |
| S17 | v4.3.2-cursor-and-patrol（30 FR） | 30 | ✅ | ❌ | **FR-A/E**（cursor、patrol） |
| S18 | easter-eggs（8 类） | 8 | ✅ | ❌ | **FR-G** |
| S19 | warm-night-mode（12 FR） | 12 | ✅ | 🟡 仅 theme-store 框架 | **FR-G** |
| S20 | insight-trend-enhancement（6 FR） | 6 | ✅ | ❌ | **FR-B** |
| S21 | v4.3 三层缓存 + PermissionGuard | — | ✅ | 🟡 usePermission 雏形 | **FR-C/E**（前端权限闸） |

> **图例**：✅ 完成 / 🟡 部分完成或后端先行 / ❌ 未开始 / ⚠️ Web 体系下不适用或语义已变。

### 0.2 Web 端代码现状速览

```
client/src/
├── app/        React Router + 双 Layout + main.tsx
├── components/ 7 个 Dialog（feeding/sleep/diaper/temperature/growth/baby-edit/loading-overlay）
│              + Timeline + BabyCard
├── components/ui/  仅 dialog + segmented-control（缺 toast/popover/sheet/skeleton/tabs）
├── pages/      13 个页面骨架
├── services/   api / auth / baby / record / family / ai / baby-extra
├── stores/     auth / baby / family / theme
├── hooks/      use-auth / use-dialog / use-permission / use-theme
└── lib/        date / record / utils / who-standards / vaccine-plans / milestone-defs

server/src/
├── routes/     auth / records / families / babies / vaccines / ai / export / index
├── services/   auth / baby / family / record / vaccine / milestone / trend / export
├── middleware/ auth(JWT) / cors / error-handler / rate-limit / validate
├── schemas/    Zod auth/baby/family/record/common
├── utils/      date / invite-code / permission / logger / async-handler
└── prisma/     SQLite (dev) + 完整 ER + OperationLog + RateLimit
```

### 0.3 已实现需求（不再讨论）

后端：JWT auth 全套；Family 完整 CRUD（含 `leaveFamily` 状态机 `ok | dissolved | need_transfer | family_not_found | not_member`）；Baby CRUD（含 cursor 分批 deleteBaby）；Record CRUD 与 5 种子表；Vaccine / Milestone / Trend / Export；Zod 校验、错误处理、`auth/family/ai/export` 速率限制；权限工具（`hasPermission` / `isAdmin` / `isFamilyMember`）。

前端：4 个 Zustand store；React Query 全局配置；React Router + 双 Layout；5 种记录的 Dialog；Timeline + BabyCard；axios 拦截器与 token 自动刷新。

### 0.4 本期目标分布

| FR 域 | 主题 | 依赖 spec | 优先级 |
|------|------|----------|------|
| **FR-A** 首页 v4.0 对齐 | 多宝切换、状态胶囊、进度条摘要、AI 折叠、骨架屏、配方奶 8 个粒度按钮 | S2 + S4 + S9 + S17 | P0 |
| **FR-B** 趋势洞察 | 范围条、智能状态、月龄参考、提示语、骨架屏 | S20 | P0 |
| **FR-C** 家庭协作 UI | 角色编辑、移除成员、转让管理员、退出家庭、客户端权限闸 | S3 + S10 + S16 + S21 | P0 |
| **FR-D** 记录页对齐 | page-header、今日速览副标题、筛选吸顶、日期分组、时间轴线 | S6 + S9 | P1 |
| **FR-E** 可观测性与稳定性 | OperationLog 接入、RateLimit 持久化、patrol 巡检（含分布式锁）、配额 TTL、cursor 续传 | S15 + S16 + S17 | P1 |
| **FR-F** AI 接入与配额 | 混元 HTTP 直调、SSE 流式、每日洞察、配额管理（含回滚）、降级 | S2.FR-14 + REFACTORING_PLAN §11 | P1 |
| **FR-G** 暖夜模式 + 彩蛋 + 分享图 | 三态主题切换、8 类彩蛋、报告分享 PNG（V1） | S18 + S19 + S7 | P2 |
| **FR-H** E2E 测试 | Playwright 跑通主链路 + 安全规则等价用例 | S13 | P2 |

---

## 1. 用户角色

| 角色 | Web 上的体现 | 与本期需求的关系 |
|------|-------------|----------------|
| **主要照护者**（admin/editor） | 浏览器 / PWA 登录后的家长账号 | FR-A/B/C/D/F 的核心受众 |
| **协同照护者**（editor） | 加入家庭的家长 | FR-A/C/D 受众；权限矩阵下不能修改家庭设置 |
| **仅查看**（viewer） | 仅读权限的家庭成员 | FR-C 客户端权限闸的主要保护对象；FR-D 不显示「管理」按钮 |
| **多宝家庭用户** | 一个家庭含 2+ baby | FR-A1/A2 的关键场景；状态胶囊与 today summary 必须按 currentBaby 隔离 |
| **跨设备用户** | 手机 Web + 平板 + 桌面 | FR-A2 「进行中睡眠」必须跨设备一致（云端会话而非 localStorage） |
| **离线场景用户** | 网络抖动或弱网 | FR-A/F：写操作幂等、AI 调用失败降级、配额回滚 |
| **运维 / 开发者** | 通过 OperationLog 与 patrol 报告做白盒观测 | FR-E 的核心受众 |

---

## 2. 功能需求

### 2.1 FR-A：首页 v4.0 对齐

> 设计章节：design.md §2（FR-A1~A5）、§7.2（与 FR-F 联动）

承接 S2.FR-1/2/3/4/5/6/10/12/13/14/15、S4.FR-1、S9.FR-2/3、S17.FR-A1/FR-A8（睡眠落库语义）。

#### FR-A1：宝宝状态胶囊

**用户故事**：作为家长，我希望在首页一眼看到宝宝当前状态（睡眠中、上次喂养 X 时长前、异常计时），并能一键操作。

**验收标准**：

1. When 当前 baby 存在「未结束的睡眠记录」（`Record.recordType === 'sleep' && endTime === null`），the system shall 显示胶囊「正在睡觉 · {hh}h{mm}m」+ 录制指示灯（呼吸动画）+「结束」按钮。
2. When 上述条件不成立但今日有 feeding 记录，the system shall 显示「上次喂养 {hh}h{mm}m 前」（基于 `getTodayStats().feeding.lastTimeTs`）。
3. When 上述条件不成立但今日有任意记录，the system shall 显示「上次记录 {hh}h{mm}m 前」（取最新一条记录的 `startTimeTs`）。
4. When 今日无任何记录，the system shall 显示引导文案「今天还没有记录，点下方快捷按钮添加」。
5. When 进行中睡眠 `Date.now() - startTimeTs > 24h`，the system shall 切换为异常态：胶囊变红、文案「睡眠时间异常，超过 24 小时」、显示「取消计时」按钮。
6. When 用户点击「结束」按钮，the system shall 调用 `recordService.updateRecord(activeSleep.id, { endTime, sleepData.duration })`，成功后失效 `['todayStats', babyId]`、`['records', babyId]`、`['activeSleep', babyId]` 三个 React Query。
7. When 用户点击「取消计时」按钮，the system shall 弹出二次确认（shadcn Dialog），确认后调用 `recordService.deleteRecord(activeSleep.id)` 清除该未完成记录。
8. While 用户从手机 Web 开始计时、平板 Web 进入首页，the system shall 通过 `useActiveSleep(babyId)` 从云端拉到同一 `endTime: null` 记录，胶囊态保持一致（**跨设备一致性**，对应 design §2.3.1）。
9. When 用户从「快捷按钮区」点击「睡眠」按钮：
    - 若**没有**进行中睡眠 → the system shall 直接创建 `endTime: null` 的 sleep Record（即「开始计时」），与状态胶囊数据共享。
    - 若**已有**进行中睡眠 → the system shall 跳过创建、转而打开 `<SleepDialog>` 让用户**补录历史 sleep**（避免与计时态冲突）。
10. When 用户从 `<SleepDialog>` 提交一段历史睡眠（含 startTime + endTime），the system shall 走 `recordService.createRecord` 标准路径，**不影响**进行中睡眠（此路径不会创建 `endTime: null` 记录）。
11. When 用户在状态胶囊点「结束」与同时通过 `<SleepDialog>` 提交（极小概率多设备并发），the system shall 后端 `updateRecord` 与 `createRecord` 互不干扰（前者作用于已有 record id，后者创建新 record），数据一致。

#### FR-A2：多宝快速切换

**用户故事**：作为多宝家庭用户，我希望在首页直接切换当前关注的宝宝，避免进入「我的」页面多步操作。

**验收标准**：

1. When `babies.length >= 2`，the system shall 在问候栏右侧渲染最多 3 个其他宝宝头像（圆形 40px、互相重叠 -8px）+ 超出部分显示「+N」灰色圆。
2. When `babies.length === 1`，the system shall 不渲染头像组。
3. When 用户点击其他宝宝头像，the system shall 调用 `useBabyStore().setCurrentBaby(baby)`，并触发 React Query `invalidate(['todayStats', newBabyId])` + `invalidate(['records', newBabyId])` + `invalidate(['activeSleep', newBabyId])`。
4. While 切换数据加载中，the system shall 对 BabyCard 区域显示骨架屏（局部 loading），避免整页闪烁。

#### FR-A3：今日进度条摘要（4 列）

**用户故事**：作为家长，我希望今日概览以大字 + 进度条形式展示，3 秒内判断今日整体情况。

**验收标准**：

1. When HomePage 加载完成，the system shall 渲染 4 列网格：feeding（次数/目标 8）、sleep（时长/目标按月龄）、diaper（次数/目标 6）、temperature（最新值，无进度条）。
2. When 数值显示，the system shall 主数值使用 `text-3xl font-bold`（约 48rpx 等价）+ 4px 进度条（功能色）。
3. When 月龄 0-3 月，sleep 目标 = 14h；月龄 4-11 月 = 13h；月龄 ≥12 月 = 12h；进度条 fill 比例 = `min(1, totalDuration / goal)`。
4. When 今日 temperature 最新值 ≥ 37.5°C，the system shall 整列底色变橙；≥ 38.5°C 变红，并在卡片顶部 mount 一条警示横条「⚠️ 宝宝体温偏高，请注意观察」。
5. When 用户点击任一列，the system shall 直接打开对应 Dialog（不跳转记录页 —— 沿用 v4.0「一次点击」原则）。

#### FR-A4：AI 洞察折叠态

**用户故事**：作为家长，我希望 AI 洞察默认折叠为一行摘要，不占用首屏空间。

**验收标准**：

1. When 当日有 AI 洞察缓存或在线生成成功，the system shall 默认显示折叠态：emoji 灯泡 + 摘要前 30 字（截断 …）+ chevron 展开按钮。
2. When 用户点击展开，the system shall 渲染完整摘要 + suggestions 列表 + alerts 列表 + 「更多建议」link（跳转 AI 助手页）。
3. While 折叠态切换，the system shall 通过 `useLocalStorageState('ai_insight_collapsed', false)` 持久化用户偏好，下次进入首页恢复折叠态。
4. When AI 服务不可用（FR-F 降级），the system shall 由 `client/src/lib/insight-fallback.ts` 规则引擎产出 fallback 文案，并在折叠态右下角加灰色「快速模式」标签。
5. When 今日无任何记录，the system shall 不渲染 AI 洞察卡片（参考 S2.FR-14.AC5）。

#### FR-A5：骨架屏

**用户故事**：作为家长，我希望首页加载时看到内容轮廓而非全屏转圈，减少等待焦虑。

**验收标准**：

1. When `currentBaby === null` 或 `stats === defaultStats`，the system shall 渲染骨架占位（包含问候栏、BabyCard、TodaySummary、Timeline、InsightSection 五个区块）。
2. When 数据加载完成，the system shall 骨架以 `opacity: 0` + 300ms transition 消失，真实内容 `opacity: 0 → 1` 渐显。
3. While 骨架显示，the system shall 使用 shadcn `Skeleton` 组件 + Tailwind `animate-pulse`，不引入 JS 定时器。
4. When 数据加载失败（React Query `error`），the system shall 骨架直接切换为 `<ErrorState>`（已存在），不显示过渡动画。

#### FR-A6：配方奶快捷用量

**用户故事**：作为家长，我希望配方奶喂养弹窗的快捷按钮支持小量喂养（10ml）。

**验收标准**：

1. When `<FeedingDialog>` 渲染配方奶模式的快捷按钮，the system shall 数组为 `[10, 30, 60, 90, 120, 150, 180, 210]`（对齐 S4.FR-1）。
2. When 用户多次点击快捷按钮，the system shall 累加用量（沿用现有累加逻辑）。
3. When 用户点击「清空」按钮，the system shall 重置用量为 0。

---

### 2.2 FR-B：趋势洞察

> 设计章节：design.md §3（FR-B1~B3）

承接 S20 全部 6 个 FR。

#### FR-B1：智能状态标签

**用户故事**：作为新手父母，我希望看到「正常 / 偏少 / 偏多 / 明显偏少 / 明显偏多」语义化标签，而不是百分比。

**验收标准**：

1. When 当前周日均值在月龄参考范围内（含边界），the system shall 显示绿色标签「正常」。
2. When 偏离参考范围 ≤ 30%，the system shall 显示橙色「偏少 / 偏多」（按方向判断）。
3. When 偏离 > 30%，the system shall 显示红色「明显偏少 / 明显偏多」。
4. When 维度为 temperature（无范围概念），the system shall 按异常次数判定：0 次 → 绿色「正常」；1-2 次 → 橙色「需关注」；≥3 次 → 红色「需就医」。
5. When 本周与上周均无数据，the system shall 显示灰色「无数据」标签。
6. While 卡片渲染，the system shall 状态标签（`text-sm font-medium` + 圆角胶囊）作为视觉焦点；环比百分比（`text-xs` + 灰色）退到第三行。

#### FR-B2：月龄参考范围

**用户故事**：作为新手父母，我希望看到当前月龄对应的「参考 X-Y 次/h」，作为衡量标尺。

**验收标准**：

1. When `currentBaby.birthDate` 存在，the system shall 根据月龄匹配参考范围（数据来源同 S20，详见 design §3.1 `REFERENCE_RANGES`）。
2. When `birthDate` 缺失，the system shall 不显示参考范围行，状态标签退化为「按周环比 ≥20% 才标记需关注」。
3. When 月龄 > 36 个月，the system shall 使用最末档（24 月+）参考范围，不报错。
4. While 参考范围显示，the system shall 文案使用 `text-xs text-muted-foreground`，不抢占日均值视觉。

#### FR-B3：迷你范围条 + 提示语 + 信息架构

**用户故事**：作为照护者，我希望通过水平进度条直觉感知偏离程度，且每张卡片有一句温和指导。

**验收标准**：

1. When 月龄参考范围数据存在，the system shall 卡片第二行渲染水平范围条（高度 8px、圆角 4px、宽度 100%）：中间 60% 绿色（正常区）+ 当前值定位点（圆点 12px，颜色与状态标签一致）。
2. When 当前值低于范围，定位点位于左侧橙色 / 红色区段；高于则位于右侧。
3. When 卡片排列，the system shall 按以下垂直顺序：第一行 图标+名称+状态标签；第二行 范围条；第三行 日均+参考+环比；第四行 智能提示。
4. When 状态为「正常」，the system shall 提示语为正面肯定（如「喂养规律，保持即可 👍」）；偏离则温和关注；明显偏离则建议行动（详见 S20 FR-4 表）。
5. While 提示语生成，the system shall 由前端 `client/src/lib/trend-tips.ts` 规则引擎产出，不调用 AI，耗时 < 1ms。
6. While 数据加载中，the system shall 4 张卡片各显示 4 行 shimmer 骨架。

---

### 2.3 FR-C：家庭协作 UI

> 设计章节：design.md §4（FR-C1~C5）

承接 S3 全部 13 FR、S10.FR-9（幽灵成员防护）、S16.FR-6（默认 viewer）、S21（PermissionGuard 客户端闸）。

#### FR-C1：成员列表与权限展示

**用户故事**：作为家长，我希望进入家庭管理页一眼看到所有成员、各自角色、加入时间。

**验收标准**：

1. When 用户进入 `/family` 页面，the system shall 调用 `useFamilyStore().loadFamily()`，store 持有完整 `FamilyDetail`（含 members + babies）。
2. When 渲染成员列表，the system shall 显示头像、昵称、中文角色标签（管理员/成员/仅查看）、加入时间（按 `joinedAt desc` 排序）。
3. When 当前用户是 admin，the system shall 自己卡片右上角标注「我 · 创建者」；其他成员卡片显示三点菜单（编辑/移除/转让）。
4. When 当前用户非 admin，the system shall 隐藏所有管理操作（菜单仅显示「我」标识）。

#### FR-C2：邀请码生成与刷新

**用户故事**：作为 admin，我希望生成邀请码并分享给家人。

**验收标准**：

1. When admin 进入家庭页，the system shall 在「邀请家人」区域显示当前邀请码 + 7 天倒计时。
2. When 倒计时 < 24h，the system shall 文字变橙、显示「即将过期」。
3. When 用户点击「重新生成」，the system shall 调用 `familyService.refreshInviteCode(familyId)` 生成新 6 位码，旧码立即失效（后端 5 次/分钟限流由 FR-E2 承担）。
4. When 用户点击「复制」，the system shall 通过 `navigator.clipboard.writeText` 复制邀请码 + 提示文案，并 toast 「已复制」。
5. When 用户点击「分享」（移动端 Web），the system shall 调用 `navigator.share({ text: '...邀请码...' })`；不支持时降级为复制并提示。

#### FR-C3：成员权限修改

**用户故事**：作为 admin，我希望修改成员权限，控制访问级别。

**验收标准**：

1. When admin 点击成员卡片三点菜单的「修改权限」，the system shall 打开 `<RoleEditDialog>`（shadcn Dialog + RadioGroup，三选一）。
2. When 用户提交，the system shall 调用 `familyService.updateMemberRole(familyId, userId, role)`，成功后 store 局部更新（`members.map`）+ toast「权限已更新」。
3. When 尝试将「最后一个 admin」降级为非 admin，the system shall 后端返回 `SOLE_ADMIN`，前端拦截显示「家庭至少需要一位管理员」。
4. When `role` 不在 `['admin', 'editor', 'viewer']`，the system shall 后端返回 `INVALID_ROLE`，前端显示「不支持的角色」。
5. When 修改后台返回 `data.status` 为非 ok，the system shall 不更新 store（保持原状），toast 错误。

#### FR-C4：移除成员

**用户故事**：作为 admin，我希望移除不再参与的家庭成员，保护数据安全。

**验收标准**：

1. When admin 点击「移除成员」，the system shall 弹出二次确认 Dialog，要求用户在输入框打字「确认移除」才能点击红色「移除」按钮。
2. When 确认移除，the system shall 调用 `familyService.removeMember(familyId, userId)`，成功后 store 中 members 去除该用户。
3. When 尝试移除自己，the system shall 后端返回 `CANNOT_REMOVE_SELF`；尝试移除其他 admin 时返回 `CANNOT_REMOVE_ADMIN`。
4. When 移除成功，the system shall **保留**该成员创建的历史记录（数据库不级联删除），UI 渲染时若 `createdBy.userId` 不在 `members` 中，显示为「已退出成员」灰色占位。
5. When 后端 OperationLog 记录 `removeMember` 操作日志（FR-E1），含 `targetUserId / familyId / actor`。

#### FR-C5：退出家庭与转让管理员

**用户故事**：作为家庭成员（含 admin），我希望主动退出家庭；admin 退出时妥善处理管理权限。

**验收标准**：

1. When 任一成员点击「退出家庭」，the system shall 弹出确认 Dialog，提交后调用 `familyService.leaveFamily(familyId)`，根据 `result.status` 分支：
    - `'ok'` / `'dissolved'` → 清空 store + `navigate('/auth/login')`
    - `'need_transfer'` → 打开 `<TransferAdminDialog>`，列出 `result.otherMembers` 候选
    - `'family_not_found'` / `'not_member'` → toast「家庭已不存在」+ `navigate('/')`
2. When admin 是唯一成员且确认退出，the system shall 后端自动解散家庭（返回 `'dissolved'`），并清除自己的 `familyId`。
3. When admin 是唯一管理员且家庭还有其他成员，the system shall 后端返回 `'need_transfer'` + `otherMembers`，前端要求先转让。
4. When 用户在 TransferAdminDialog 选择新管理员，the system shall 调用 `familyService.transferAdmin(familyId, newAdminId)`，成功后 admin 角色互换 + 自动调用 `leaveFamily` 完成退出。
5. When 任意 admin（不限创建者）解散家庭，the system shall 后端使用 `isAdmin` 判定（对齐 S16.FR-9）。

#### FR-C6：客户端权限闸（双层防护）

**用户故事**：作为前端开发者，我希望 viewer 角色用户既无法点击写操作按钮（UI 层），也无法通过 hook / service 直接绕过（API 层），不依赖服务端 403 兜底。

**验收标准**：

1. When 渲染任何写操作按钮（添加记录、编辑、删除、修改宝宝、邀请家人、修改权限、移除成员），the system shall 通过 `usePermission()` hook 返回的能力布尔值判定显示 / 禁用。
2. When viewer 用户尝试通过 URL 直接访问需要 admin 的路由（如 `/family` 的管理菜单），the system shall 不渲染管理 UI（仅展示成员列表）。
3. When `usePermission()` 返回 viewer 但用户实际是 admin（缓存未更新），the system shall 在每次 React Query refetch `family` 时同步 `useAuthStore` 中 `currentRole`，5 分钟缓存周期内可接受短暂不一致。
4. When `currentRole` 缺失或异常，the system shall 默认返回 `'viewer'`（最小权限原则，对齐 S16.FR-6）。
5. When 任何写操作 hook（`useActiveSleep().start/end/cancel`、`useCreateRecord`、`useUpdateRecord`、`useDeleteRecord`、`familyStore.updateMemberRole/removeMember/transferAdmin/refreshInviteCode`）执行写动作前，the system shall 调用 `permissionGuard.require(permission)` 校验当前用户角色；不通过时抛 `PermissionError`（含 `code: 'PERMISSION_DENIED'` + 友好 `message`），上层 UI 捕获后 toast 提示「您没有此操作的权限」。
6. When 视图层已隐藏按钮但 hook 仍被错误调用（如灰度期角色变更、缓存不一致），the system shall 由 hook 层 PermissionGuard 拦截，避免无意义的 API 请求。
7. When 后端兜底返回 `403 PERMISSION_DENIED`，the system shall axios 拦截器统一映射为 `PermissionError`，与前端 hook 层抛出的错误使用同一处理路径（toast + 错误日志）。

---

### 2.4 FR-D：记录页对齐

> 设计章节：design.md §5（FR-D1~D3）

承接 S6 全部 3 FR、S9.FR-6（吸顶 + 时间轴线）、S9.FR-11（页头图标清理）。

#### FR-D1：page-header 与今日速览副标题

**用户故事**：作为家长，我希望进入记录页一眼看到「今日 N 条 · 喂养 X · 睡眠 Y · …」副标题。

**验收标准**：

1. When 渲染记录页头部，the system shall 使用统一的 `<PageHeader>` 组件：80px 渐变图标 + 标题「记录」 + 右侧「管理」/「取消」按钮。
2. When 当前筛选日期范围**包含今日**且今日有记录，the system shall 副标题格式为 `今日 {总数} 条 · {分项序列}`，其中：
    - 分项序列由「喂养 {n}」「睡眠 {hh}h{mm}m」「排便 {p}」「体温 {最新值}°C」按固定顺序拼接，**仅渲染 count > 0**（或体温 latestValue 非空）的分项。
    - 分项之间使用**两个全角空格**分隔（视觉分组），与「今日 N 条」之间使用「 · 」（前后各一空格）分隔。
    - 示例：`今日 5 条 · 喂养 3  睡眠 4h20m  排便 2`（无体温记录时不显示体温分项）。
3. When 当前筛选范围包含今日但今日无记录，the system shall 副标题为「尚未添加今日记录」。
4. When 当前筛选范围**不含今日**（用户筛选了历史日期），the system shall 副标题为静态文案「宝宝的日常养护记录」。
5. While `useRecords()` 数据 refetch、切换 baby、切换管理模式时，the system shall 副标题联动刷新（无独立请求，纯前端计算）。
6. When 用户点击「管理」，the system shall 进入批量选择模式：副标题切换为「已选 {n} 条 / 共 {总数} 条」。
7. When viewer 角色，the system shall 不显示「管理」按钮。

#### FR-D2：筛选栏吸顶

**用户故事**：作为家长，向下滚动记录列表时，希望筛选标签固定在顶部，可随时切换。

**验收标准**：

1. When 用户在记录页向下滚动，the system shall 筛选栏 `position: sticky; top: 56px;`（与主导航高度对齐）。
2. When 筛选栏吸顶，the system shall 背景为 `bg-background` + `border-b`，无视觉穿透。
3. When 选中某筛选 Tab，the system shall 底部显示 4px 品牌色指示条。

#### FR-D3：日期分组头与时间轴线

**用户故事**：作为家长，我希望记录列表按日期分组、左侧有连续时间轴线，提升阅读连贯感。

**验收标准**：

1. When `<Timeline>` 渲染记录列表，the system shall 按 `format(startTime, 'yyyy-MM-dd')` 分组；每组前显示渐变分隔线（左淡右淡）+ 居中日期文案。
2. When 日期为今天，the system shall 文案显示「今天」；昨天显示「昨天」；前天及之前显示「M月D日 周X」。
3. When 渲染单条记录条目，the system shall 左侧 56px 处显示 2px 竖线 + 功能色圆点节点（10px）。
4. When 记录数 > 100，the system shall 启用 `@tanstack/virtual` 虚拟化（可选）；记录数 ≤ 100 时正常渲染。
5. When 记录数为 0，the system shall 显示空状态插图 + 文案「暂无记录」。

---

### 2.5 FR-E：可观测性与稳定性

> 设计章节：design.md §6（FR-E1~E3）+ §2.3.2（cursor 续传）

承接 S15 全部 15 FR、S16.FR-7（updatedAtTs）、S17.FR-A15（patrol 自修复）、S17.FR-A18（cursor 持久化）。

#### FR-E1：OperationLog 写操作接入

**用户故事**：作为开发者 / 运维，我希望关键写操作产生可追溯日志，定位故障时快速回放。

**验收标准**：

1. When 后端 service 执行以下写操作（`createFamily / joinFamily / leaveFamily / dissolveFamily / transferAdmin / updateMemberRole / removeMember / refreshInviteCode / deleteBaby`），the system shall 通过 `OperationLogger` 写入 OperationLog（schema 已就绪，仅需接入）。
2. When 操作开始，the system shall `OperationLogger.start()` 写入 `status: 'started' / startedAt / context`。
3. When 操作过程中各子步骤完成，the system shall `logger.step(name, status, data)` 累积到 `steps[]`。
4. When 操作成功完成，the system shall `logger.succeed(result)` 更新 `status: 'succeeded' / finishedAt / steps / result`。
5. When 操作中途失败，the system shall `logger.fail(reason, error)` 更新 `status: 'failed'`，并保留已执行的 `steps`。
6. When 操作部分成功（如 dissolveFamily 清理 5 个成员中 1 个失败），the system shall `logger.partial(reason, result)` 更新 `status: 'partial'`。
7. While `deleteBaby` 使用 cursor 续传时，the system shall 每批写入 `step('chunk_{i}', 'ok', { cursor, deleted })`（对齐 S17.FR-A18）。

#### FR-E2：RateLimit 持久化

**用户故事**：作为安全保障人员，我希望关键操作的限流在多实例部署下仍然有效。

**验收标准**：

1. When 后端启动 `auth/login`、`auth/register`、`family/joinByInviteCode`、`ai/chat`、`export/download` 5 类高敏感路由，the system shall 通过 `rate-limiter-flexible` + Prisma `RateLimit` 表存储限流计数（替换现有 `express-rate-limit` 内存存储）。
2. When `joinByInviteCode` 限流策略 = 5 次/60s/userId，the system shall 超限返回 `429` + `error.code: 'RATE_LIMITED'` + `retryAfter` 字段。
3. When 限流键过期（windowStart + duration < now），the system shall 自动清理（依赖 RateLimit 表 TTL 索引或定时任务）。
4. When 多实例部署时，the system shall 所有实例共享同一计数（通过原子 `INCR` 等价语义保证并发安全）。
5. When 限流命中时，the system shall toast 提示「操作过于频繁，请稍后再试」。

#### FR-E3：patrol 巡检任务

**用户故事**：作为运维，我希望每日自动巡检 `users.familyId` 与 `family_members` 一致性，发现幽灵成员时记录或修复。

**验收标准**：

1. When server 启动后，the system shall 通过 `node-cron` 注册「每天 00:00 执行」的 patrol 任务（仅在 `NODE_ENV !== 'test' && PATROL_ENABLED !== 'false'` 时启用）。
2. When patrol 启动前，the system shall 通过 `acquirePatrolLock('familyConsistency')` 申请基于 RateLimit 表的分布式锁；获取失败时跳过本次执行（多实例并发保护）。
3. When 巡检遍历所有 `familyId !== null` 的 user，the system shall 对每个 user 检查 `family_members` 是否存在对应 `(familyId, userId)` 记录。
4. When 发现 user 的 familyId 指向已不存在的 family（规则 B），the system shall 在 `PATROL_DRY_RUN === 'false'` 时执行 `update familyId: null`（无副作用清理）；否则仅告警。
5. When 发现 family 存在但 user 不在 members 中（规则 C），the system shall 仅记录 warning，不自动修复（需人工确认）。
6. When 巡检结束，the system shall 通过 `OperationLogger.succeed({ scanned, drift, autoRepaired, warnings })` 写入操作日志。
7. When patrol 发生异常，the system shall `OperationLogger.fail(error.message, error)` 写入日志 + `releasePatrolLock` 释放锁。

#### FR-E4：AIQuota 数据增长治理

**用户故事**：作为运维，我希望 `AIQuota` 表不会无限增长。

**验收标准**：

1. When 用户每天首次调用 AI，the system shall `prisma.aIQuota.upsert` 创建 `(userId, today, count: 1)`；后续调用 `count.increment(1)`（原子）。
2. When `aIQuota.date` 早于今日 60 天，the system shall 通过 `node-cron` 「每周日 03:00」执行 `deleteMany({ date: { lt: cutoff } })` 清理。
3. When AIQuota 表存在 `@@index([date])`，the system shall 清理任务高效执行（不需要全表扫描）。

#### FR-E5：deleteBaby cursor 续传

**用户故事**：作为 admin，我希望删除一个有 3000+ 条记录的 baby 时，操作不会因超时中断；中断后再次进入设置页能从云端 OperationLog 自动续传，而不依赖本地 localStorage（跨设备一致性）。

**验收标准**：

1. When 用户调用 `DELETE /babies/:id`（首次或带 cursor），the system shall 后端 service 单次最多处理 `CHUNK_SIZE=500` 条记录 + 受限时间（10s）内，到达任一阈值返回 `{ status: 'in_progress', cursor: <下一批起点>, deleted, total }`。
2. When 客户端收到 `status === 'in_progress'`，the system shall 自动循环调用 `DELETE /babies/:id?cursor=<上次>` 直到 `status === 'succeeded'`。
3. While 执行中，the system shall 通过 `<LoadingOverlay>` 显示「清除中... 已清除 {deleted}/{total} 条」并不断更新计数。
4. When 累计循环超过 **20 次**仍未完成，the system shall 提示「数据量较大，请稍后重试」，**不**依赖 localStorage 持久化 cursor（参见 AC5 跨设备方案）。
5. When 用户重新进入设置页执行「清除数据」，the system shall **优先查询云端 OperationLog**：若存在 `action='deleteBaby' AND status='started' AND context.babyId===<目标>` 的未完成日志，从其 `steps[*].data.cursor` 字段恢复最新 cursor 值，**自动续传**（云端 cursor 优于客户端记忆，跨设备一致）。
6. When 后端每批清理完成（包含成功 / 部分成功 / 全部完成），the system shall 通过 `OperationLogger.step('chunk_${i}', 'ok' | 'partial', { cursor, deleted, total })` 写入 OperationLog，确保 cursor 落库（FR-E1 联动）。
7. When OperationLog 写入失败（极端情况），the system shall 不阻断主清理流程；失败时降级为单实例模式（不支持续传），并打印 console.warn。
8. When deleteBaby 操作完成（`status: 'succeeded'`），the system shall `OperationLogger.succeed({ totalDeleted, totalChunks })` 关闭日志，下次不再续传。

---

### 2.6 FR-F：AI 接入与配额

> 设计章节：design.md §7（FR-F1~F3）

承接 S2.FR-14（首页 AI 洞察）、REFACTORING_PLAN.md §11（混元接入）、S15.FR-12（巡检）、S17.FR-A11（限流接入）。

#### FR-F1：混元 API 接入

**用户故事**：作为家长，我希望 AI 助手能基于宝宝档案与今日数据给出对话回复。

**验收标准**：

1. When 用户在 AI 助手页发送消息，the system shall 调用 `POST /api/ai/chat`，后端通过 `tencentcloud-sdk-nodejs/hunyuan` 调用 `ChatCompletions`。
2. When 请求构造，the system shall 使用模型 `hunyuan-2.0-instruct-20251111`，温度 0.7，system prompt 包含宝宝昵称 + 月龄 + 今日数据摘要。
3. When 后端环境变量缺失 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`，the system shall 启动时报错（fail-fast）。
4. When 接口响应成功，the system shall 返回 `{ content: string }` 给前端，前端追加到 messages 数组。
5. When 网络 / 超时 / 5xx 错误，the system shall 后端捕获并返回 `503` + `error.code: 'AI_SERVICE_UNAVAILABLE'`，前端 toast「AI 服务暂不可用，请稍后重试」+ 切换到「快速模式」（本地规则）。

#### FR-F2：每日洞察与降级

**用户故事**：作为家长，我希望首页每天有一条 AI 摘要，AI 服务异常时自动降级为本地规则。

**验收标准**：

1. When 当日有任何记录且 AI 缓存命中（`daily_insight:{babyId}:{YYYY-MM-DD}`），the system shall 直接返回缓存。
2. When 缓存未命中，the system shall 后端先 `consumeQuota`，再调用混元（8s 超时）；成功后 `parseInsight` → `setCache(24h)` → 返回。
3. When 调用失败或超时，the system shall **不缓存** + `refundQuota`（不计入用户配额）+ 返回 `buildFallbackInsight(stats)` 规则引擎结果。
4. When 配额耗尽，the system shall `consumeQuota` 抛 `ForbiddenError(QUOTA_EXCEEDED)`，前端不降级，提示「今日 AI 配额已用尽，请明天再试」。
5. When 用户手动下拉刷新首页，the system shall 删除当日缓存 + 重新请求（耗 1 次配额）。
6. When 当日无任何记录，the system shall 跳过 AI 请求（首页不渲染洞察卡片）。

#### FR-F3：配额管理

**用户故事**：作为运维，我希望每日 AI 配额可控制，避免成本失控。

**验收标准**：

1. When 用户调用 AI 前，the system shall `prisma.aIQuota.upsert` 原子自增；超出 `process.env.AI_DAILY_QUOTA ?? 20` 时回滚自增并抛 `QUOTA_EXCEEDED`。
2. When 用户查询 `GET /api/ai/quota`，the system shall 返回 `{ dailyLimit, used, remaining, resetAt }`。
3. When 前端 AI 助手页加载，the system shall 顶部显示 `<QuotaBar used={used} limit={20} />`，剩余 < 5 时变橙、剩余 0 时禁用「发送」按钮。
4. When 调用流式响应（SSE），the system shall 在第一个 chunk 到达前扣配额；中途连接断开不返还（成本已发生）。
5. When 网络抖动 / 超时 / 5xx 触发降级（FR-F2 AC3），the system shall 立即 `refundQuota`（不计入用户配额）。

#### FR-F4：SSE 流式响应

**用户故事**：作为家长，我希望 AI 回复以打字机效果逐字呈现。

**验收标准**：

1. When 前端调用 `POST /api/ai/chat/stream`，the system shall 后端返回 `Content-Type: text/event-stream`，每个 chunk 以 `data: {json}\n\n` 格式输出。
2. When 前端使用 `EventSource` 或 `fetch` ReadableStream 消费，the system shall 实时追加内容到当前消息气泡。
3. When 连接断开（网络异常、超时），the system shall 前端 toast「连接中断，请重试」，并保留已收到的部分内容。
4. While 用户连续点击「发送」（< 1.5s 间隔），the system shall 前端节流，避免重复扣费（参考小程序 `debounce.js`）。

---

### 2.7 FR-G：暖夜模式 + 彩蛋 + 分享图

> 设计章节：design.md §8（FR-G1~G3）

承接 S18 全部 8 类彩蛋、S19 全部 12 FR（适配 Web 体系）、S7 V1 6 FR。

#### FR-G1：暖夜模式（三态主题切换）

**用户故事**：作为家长，深夜照顾宝宝时希望使用暖夜模式减少屏幕刺激；白天希望恢复亮色。

**验收标准**：

1. When 用户进入设置页，the system shall 提供 `<ThemeSelector>`：三选一（亮色 / 暖夜 / 跟随系统）。
2. When 用户选择某主题，the system shall 通过 `useThemeStore().setMode(mode)` 写入 `localStorage` + 立即设置 `document.documentElement.dataset.theme`。
3. When `mode === 'system'`，the system shall 监听 `prefers-color-scheme` 媒体查询，跟随系统切换。
4. When 暖夜模式启用，the system shall 通过 `client/src/styles/themes.css` 的 `[data-theme="warm-night"]` 选择器覆盖完整 CSS 变量（详见 design §8.1）。
5. While 暖夜模式生效，the system shall 保持 `--primary` = `#D4B896` 品牌主色不变；功能四色降饱和（喂养 #7CAF7C、睡眠 #9488B4 等）。
6. When 切换主题时，the system shall 文字与背景对比度 ≥ 4.5:1（WCAG AA），通过 `<ThemeQA>` 测试组件自动检查。
7. When 切换动画播放期间，the system shall 不出现纯白 / 纯亮中间帧（白屏闪烁）。
8. When 分享图（FR-G3）渲染，the system shall 始终使用亮色配色方案（不跟随主题）。

#### FR-G2：8 类彩蛋

**用户故事**：作为家长，我希望在宝宝成长的关键节点收到温暖的庆祝弹窗 / 提示，增强情感连接。

**验收标准**：

1. When `birthDayCount` 在 30-33 天内且 `localStorage['egg_30day_${babyId}']` 不存在，the system shall 在首页 `useEffect(500ms)` 后弹出「满月快乐」半屏 Dialog（含 30 天数据回顾 3 张迷你卡片）。
2. When 100-103 天，the system shall 触发「百日快乐」彩蛋（含数字翻转动画 + 出生 → 当前生长变化卡片）。
3. When 365-368 天，the system shall 触发「周岁快乐」全屏粒子动画 Dialog + 年度数据回顾。
4. When 用户成功创建第一条记录（`recentRecords.length === 1`），the system shall 弹窗关闭后 300ms 显示 Toast「第一次记录完成！育儿之旅正式开始 🚀」。
5. When `birthDayCount % 30 === 0` 且不在独立彩蛋天数（30/100/365），the system shall 在问候栏下方显示月龄提示条「{宝宝}今天 N 个月啦 🎈」。
6. When 连续 7 天每天 ≥ 1 条记录，the system shall 显示 Toast「连续打卡 7 天！」；连续 30 天显示半屏 Dialog 升级版。
7. When 当前日期匹配预置节日（儿童节 / 母亲节 / 父亲节 / 春节 / 中秋节硬编码近 3 年），the system shall 显示节日提示条。
8. When 数据洞察条件满足（喂养冠军 / 睡神降临 / 完美一天），the system shall 显示 Toast；多个同时满足时按优先级（完美一天 > 喂养冠军 > 睡神降临）只显示一个。
9. When 任一彩蛋触发后用户关闭弹窗，the system shall 写入 `localStorage` 标记（key 命名与小程序一致：`egg_${type}_${babyId}` 或含 year/date 维度），下次不再触发。
10. When 多宝家庭，the system shall 每个 babyId 独立维护彩蛋状态，互不影响。
11. When 彩蛋检测执行，the system shall 在 `loadData` 完成后异步触发（500ms 延迟），不阻塞首页主渲染。

#### FR-G3：分享报告（V1）

**用户故事**：作为家长，我希望生成一张图片分享给家人 / 朋友圈，记录宝宝成长。

**验收标准**：

1. When 用户在报告页点击「生成分享图」，the system shall 通过 `<canvas>` 离屏绘制 4 张卡片（基本信息 + 喂养 + 睡眠 + 排便）+ AI 评语 + Footer 品牌标识。
2. When Canvas DPR 超过 2，the system shall 限制为 2，避免生成超大文件。
3. When 导出图片，the system shall `canvas.toBlob('image/jpeg', 0.85)`，目标文件 ≤ 500KB。
4. When AI 评语文字溢出，the system shall 动态计算 Canvas 高度（确保 footer 始终在内容下方）。
5. When 用户点击「保存到本地」，the system shall 创建 `<a download>` 触发下载（文件名 `{babyName}_报告_{date}.jpg`）。
6. When 用户点击「分享」（移动端 Web 支持），the system shall 调用 `navigator.share({ files: [file], title, text })`；不支持时降级为复制链接 + toast。
7. When 用户切换报告周期（周 / 月），the system shall 清除已生成的分享图 URL，避免展示旧预览。
8. When 生成失败，the system shall 清除内部缓存哈希 + 提示重试，不影响下次生成。

V2 的 10 模块成绩单（S8）作为 P2 远期需求保留，本期不实现。

---

### 2.8 FR-H：E2E 测试

> 设计章节：design.md §11.2（Playwright）

承接 S13（126 用例的 Web 等价版本）。

#### FR-H1：主链路通畅性

**用户故事**：作为开发者，我希望每次合并 PR 前 E2E 自动验证主链路。

**验收标准**：

1. When CI 启动 Playwright，the system shall 在隔离 dev 环境执行：注册 → 创建家庭 → 添加宝宝 → 创建 5 种记录 → 退出登录 → 重新登录 → 数据可见。
2. When 邀请码 E2E，the system shall 验证：admin 生成邀请码 → 第二个用户注册并加入 → 双方在家庭页可见。
3. When 角色变更 E2E，the system shall 验证：admin 将 editor 改为 viewer → viewer 用户重新登录后无法看到「添加记录」按钮。
4. When 移除成员 E2E，the system shall 验证：admin 移除 editor → editor 用户重新登录后跳转到引导页。
5. When 转让管理员 E2E，the system shall 验证：唯一 admin 退出 → 弹出 TransferAdminDialog → 选择新 admin → 角色互换 + 退出成功。

#### FR-H2：权限矩阵

**用户故事**：作为安全保障人员，我希望验证客户端 + 服务端双层权限校验生效。

**验收标准**：

1. When viewer 通过浏览器开发者工具直接调用 `POST /api/records`，the system shall 返回 `403` + `error.code: 'PERMISSION_DENIED'`。
2. When editor 尝试 `PATCH /api/records/{他人记录id}`，the system shall 返回 `403` + `error.code: 'PERMISSION_DENIED'`。
3. When 非家庭成员尝试 `GET /api/babies/{他人baby}`，the system shall 返回 `403`。
4. When admin 删除任意成员的记录，the system shall 返回 `200` + 操作日志 `removeMember` 状态 succeeded。

#### FR-H3：降级路径

**验收标准**：

1. When mock AI 服务返回 503，the system shall 前端正确降级为本地规则文案，配额不被扣除。
2. When mock AI 配额耗尽（Stub `count = 20`），the system shall 弹出限制提示「今日 AI 配额已用尽」。
3. When mock 网络断开，the system shall React Query `error` 触发 `<ErrorState>` 渲染。

#### FR-H4：暖夜模式可访问性

**验收标准**：

1. When Playwright 切换 `data-theme="warm-night"`，the system shall 通过 axe-core 验证整页对比度 ≥ WCAG AA。

---

## 3. 非功能需求

### NFR-1：性能

- 首页核心数据（`todayStats` + 最近 5 条 records）在 4G 网络下加载 ≤ 2s。
- 骨架屏（FR-A5）在 JS bundle 执行完毕 100ms 内渲染。
- AI 调用（FR-F）8s 超时；超时后降级文案立即返回。
- 单页 React Query staleTime ≥ 15s（已配置）。
- 骨架屏使用纯 CSS animation，不引入 JS 定时器。

### NFR-2：兼容性

- 桌面 Chrome / Edge / Safari 最近 2 个版本；移动 Safari iOS 14+；Chrome Android 10+。
- 屏幕宽度 320px ~ 1920px 全适配。
- `navigator.share` 不支持时降级为复制 + toast；`navigator.clipboard` 不支持时降级为 `document.execCommand('copy')`。
- 暖夜模式在不支持 CSS variable 的旧浏览器降级为亮色（不阻塞功能）。

### NFR-3：数据一致性

- 进行中睡眠（FR-A1）作为 `endTime: null` 的 Record 落库，跨设备一致。
- AI 洞察缓存（FR-F2）按 `babyId + YYYY-MM-DD` 分隔，多宝天然隔离。
- OperationLog（FR-E1）所有写操作可追溯，patrol（FR-E3）每日核对一致性。
- 双时间戳约定：所有 `*Time` 字段配套 `*TimeTs`（毫秒），前端优先使用 Ts 做差值计算。

### NFR-4：安全

- 所有写操作通过 JWT auth middleware，且服务端在 service 层显式 `isFamilyMember` / `isAdmin` 校验。
- 邀请码 `joinByInviteCode` 限流 5 次/60s/userId（FR-E2）。
- AI 调用扣配额（FR-F3）防止恶意请求耗尽成本。
- patrol 在非生产环境默认 `PATROL_DRY_RUN=true`（仅告警，不修改）。
- AI Prompt（FR-F1/F2）不包含宝宝姓名全称，仅使用昵称。

### NFR-5：可观测性

- 所有关键写操作（FR-E1）写入 OperationLog，可通过 Prisma Studio 或自定义后台查看。
- patrol（FR-E3）每次执行的 stats（scanned / drift / autoRepaired / warnings）落库。
- AIQuota 每日清理任务（FR-E4）记录删除条数到日志。
- Sentry / 同等错误监控可后续接入（本期不强制）。

### NFR-6：用户体验

- 所有切换动画（主题、状态胶囊、骨架屏退场）≤ 300ms。
- 写操作（创建记录、修改成员）UI 立即响应（乐观更新或 loading 态），失败时回滚 + toast。
- viewer 角色 UI 全场禁用 / 隐藏写操作按钮，不依赖 toast 解释。
- 多宝切换响应时间 ≤ 200ms（store 更新即时响应，云端数据 React Query 异步）。

---

## 4. 边界条件与异常处理

| 场景 | 处理方式 | 关联 FR |
|------|---------|---------|
| 用户在手机 Web 开始睡眠计时、桌面 Web 进入首页 | 通过 `useActiveSleep(babyId)` 拉云端 `endTime: null` 记录，胶囊态一致 | FR-A1 |
| 进行中睡眠超过 24h 用户没操作 | 胶囊切换异常态 + 「取消计时」按钮，删除该记录 | FR-A1 |
| 用户手动并发开始两次睡眠（多设备） | 后端 `createRecord` 校验 `recordType=sleep && endTime=null` 唯一性，第二次返回 `SLEEP_ALREADY_ACTIVE` | FR-A1 |
| 跨午夜睡眠（昨晚 23:00 - 今晨 06:30）| `getTodayStats` 用 `OR: [{startTime in today}, {endTime in today}]` 扩展过滤 | FR-A |
| `currentBaby.birthDate` 缺失 | 不显示参考范围、范围条；状态标签退化为周环比模式 | FR-B2 |
| 月龄 > 36 月 | 使用最末档（24 月+）参考范围 | FR-B2 |
| 唯一 admin 退出且无其他成员 | 后端自动解散家庭，清除自己 familyId | FR-C5 |
| 唯一 admin 退出但有其他成员 | 返回 `need_transfer`，前端弹出 TransferAdminDialog | FR-C5 |
| viewer 通过 URL 直接访问写操作 | 前端 `usePermission` 隐藏 UI；后端 service 层抛 `PERMISSION_DENIED` 兜底 | FR-C6 |
| 家庭已被解散，用户本地缓存仍存在 | `ensureUserReady` 检测到 `family_not_found` → 清缓存 + 跳引导 | FR-C5 |
| 删除一个有 5000 条记录的 baby | 后端单次最多处理 500 条 + 10s 超时；超限返回 `in_progress + cursor` | FR-E5 |
| AI 服务 5xx | 后端捕获 → 配额回滚 → 返回降级文案 | FR-F2 |
| AI 配额耗尽 | 后端抛 `QUOTA_EXCEEDED` → 前端引导用户「明天再试」 | FR-F3 |
| 配方奶喂养累加超过 1000ml | 不限制（用户场景由用户自决），但记录页可显示警告色 | FR-A6 |
| 暖夜模式与系统模式冲突 | 用户手动选择「亮色 / 暖夜」时忽略 `prefers-color-scheme`；仅「跟随系统」响应 | FR-G1 |
| 彩蛋触发期间用户切换 baby | `babyId` 不同 → 重新检测，不影响已弹出的彩蛋 | FR-G2 |
| 分享图 Canvas 渲染失败 | toast 提示重试，不影响下次生成 | FR-G3 |
| 多实例同时跑 patrol | 通过基于 RateLimit 表的分布式锁互斥，仅一个实例执行 | FR-E3 |
| OperationLog 写入失败 | 不阻断主流程（业务操作仍执行），仅 console.warn | FR-E1 |
| RateLimit 表无可用记录（首次启动） | 自动创建，counter 从 1 开始 | FR-E2 |

---

## 5. 模块依赖与新增接口

### 5.1 后端新增接口

| 接口 | 类型 | 说明 |
|------|------|------|
| `GET /api/babies/:id/trend/weekly` | REST | 增强趋势数据（含 referenceRange + status + tip） |
| `POST /api/ai/chat` | REST | 同步对话 |
| `POST /api/ai/chat/stream` | SSE | 流式对话 |
| `GET /api/ai/quota` | REST | 配额查询 |
| `GET /api/ai/insight/daily` | REST | 每日洞察（带缓存） |
| `GET /api/records?endTimeIsNull=true` | REST 扩展 | 用于查询进行中睡眠 |
| `DELETE /api/babies/:id?cursor=<>` | REST 扩展 | cursor 续传 |

### 5.2 前端新增模块

| 类型 | 模块 | 用途 |
|------|------|------|
| Hook | `use-active-sleep.ts` | 进行中睡眠 React Query 包装 |
| Hook | `use-weekly-trend.ts` | 趋势 React Query 包装 |
| Hook | `use-local-storage-state.ts` | localStorage 持久化（AI 折叠态等） |
| Lib | `insight-fallback.ts` | AI 降级规则引擎 |
| Lib | `trend-tips.ts` | 趋势提示语规则引擎 |
| Lib | `easter-egg.ts` | 8 类彩蛋检测引擎 |
| Lib | `share-canvas.ts` | Canvas 离屏绘制（V1） |
| Lib | `today-summary.ts` | 今日速览文案构建 |
| Component | `<StatusCapsule>` | FR-A1 |
| Component | `<BabySwitcher>` | FR-A2 |
| Component | `<TodaySummary>` | FR-A3 |
| Component | `<InsightSection>` | FR-B 趋势洞察 |
| Component | `<PageHeader>` | FR-D1 通用页头 |
| Component | `<RoleEditDialog>` / `<TransferAdminDialog>` | FR-C |
| Component | `<EasterEggPopup>` / `<EasterEggToast>` / `<EasterEggBanner>` | FR-G2 |
| Component | `<QuotaBar>` | FR-F3 |
| Component | `<ThemeSelector>` | FR-G1 |
| Store 改造 | `family-store.ts` | 升级为 `FamilyDetail` + 4 方法 |
| Service | `ai.ts` | 对接 chat / dailyInsight / quota（含 SSE） |

### 5.3 后端新增模块

| 类型 | 模块 | 用途 |
|------|------|------|
| Service | `ai.service.ts` | 混元接入 + 配额 + 缓存 + 降级 |
| Util | `operation-logger.ts` | OperationLog 工具类 |
| Util | `patrol.ts` + `patrol-lock.ts` | 巡检任务 + 分布式锁 |
| Middleware | `rate-limit-persistent.ts` | RateLimit 持久化中间件 |
| Schema 扩展 | `record.schema.ts` | 增加 `endTimeIsNull` 字段 |
| Schema 扩展 | `prisma/schema.prisma` | 新增 `AIQuota` 模型 |

---

## 6. 优先级排序与里程碑

| 优先级 | FR 域 | 工时估算 | 说明 |
|-------|------|--------|------|
| **P0** | FR-A 首页 v4.0 | 12-16h | 核心用户体验 |
| **P0** | FR-B 趋势洞察 | 4-6h | 核心数据可读性 |
| **P0** | FR-C 家庭协作 UI | 8-10h | 后端就绪、前端 4 个 Dialog |
| **P1** | FR-D 记录页对齐 | 4-6h | 视觉对齐 |
| **P1** | FR-E 可观测性 | 8-12h | 含 OperationLog/RateLimit/patrol/cursor |
| **P1** | FR-F AI 接入 | 8-10h | 含 SSE + 配额 |
| **P2** | FR-G 暖夜模式 + 彩蛋 + 分享图（V1） | 12-16h | 增值体验 |
| **P2** | FR-H E2E 测试 | 8-10h | Playwright 主链路 |

**总工时估算**：约 64-86h（视团队并行情况）。

按 design.md §12 的 Phase 1~6 实施顺序：基础设施 → 后端能力 → P0 前端 → P1 增强 → P2 增值 → 测试上线。

---

## 7. 与既有文档的关系

| 文档 | 关系 | 在本期的作用 |
|------|------|-------------|
| `architecture.md` | Web 端架构总纲 | 本期所有 FR 不修改架构，仅在既有结构上扩展 |
| `data-model.md` | Web 端数据模型 | FR-F 新增 `AIQuota` 模型，需同步本文档 |
| `coding-conventions.md` | 代码规范 | FR-A1（睡眠会话云端落库）、FR-D（PageHeader）需追加约定 |
| `ui-design-system.md` | 设计系统 | FR-G1 需追加 `[data-theme="warm-night"]` 完整变量集 |
| `component-library.md` | 组件库 | FR-A/B/C/D/G 新增的 12+ 个组件全部要登记 |
| `service-api.md` | 服务层 API | FR-B/F/E 新增的 7 个端点需补完整签名 |
| `REFACTORING_PLAN.md` | Web 重构纲要 | 本期是 REFACTORING_PLAN §6/§7/§11 的具体落地 |
| `specs/web-feature-parity/design.md` | 配套设计文档 | 本文档每个 FR 域的章节锚点都对应 design.md 的具体实现细节 |

---

*文档维护：每完成一个 FR 域，在 §0.1 矩阵更新对应行的「Web 状态」列。所有 FR 的代码改动应保持向后兼容；breaking change 必须在 CHANGELOG 显式标注 BREAKING + 迁移步骤。*
