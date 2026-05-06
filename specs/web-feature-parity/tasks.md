# 实施计划 - Web 版功能对齐与未完成需求落地（web-feature-parity）

> 版本：v1.0 | 日期：2026-05-06 | 状态：进行中
>
> 配套文档：[`requirements.md`](./requirements.md) v1.5、[`design.md`](./design.md) v1.6

## 实施概览

预计总工时：约 64-86 小时（按 design §12 的 6 个 Phase 串行）

里程碑：

- **M1（Phase 1，工时 4-6h）**：基础设施（shared types、ui 组件、OperationLogger、themes.css）
- **M2（Phase 2，工时 12-18h）**：后端能力（trend 增强、ai.service、AIQuota、rate-limit、patrol、OperationLogger 接入）
- **M3（Phase 3，工时 18-24h）**：前端 P0（首页 + 趋势 + 家庭协作 4 组件）
- **M4（Phase 4，工时 12-16h）**：P1 增强（PageHeader、AI SSE、ThemeSelector、Timeline 分组）
- **M5（Phase 5，工时 10-14h）**：P2 增值（彩蛋 + 分享图 V1）
- **M6（Phase 6，工时 8-10h）**：测试与文档同步（单测 + Playwright + 6 份核心文档）

---

## 任务列表

### 阶段一：基础设施（M1）

- [x] **T-1.1** ✅ shared/types 扩展
- [x] **T-1.2** ✅ components/ui 补齐 shadcn 通用组件（skeleton + toast）
- [x] **T-1.3** ✅ themes.css 完整变量集（三态主题）
- [x] **T-1.4** ✅ 后端 OperationLogger 工具类
- [x] **T-1.5** ✅ 后端 AIQuota schema + 错误码

### 阶段二：后端能力（M2）

- [x] **T-2.1** ✅ record.service `getTodayStats` 双区间扫描 + lastTimeTs 字段
- [x] **T-2.2** ✅ record.service 进行中睡眠并发校验 + 路由层 endTimeIsNull 过滤
- [x] **T-2.3** ✅ trend.service 增强（getEnhancedWeeklyTrend）+ babies/:id/trend/weekly 路由
- [x] **T-2.4** ✅ ai.service 混元接入（含 mock 降级 + 配额回滚 + LRU 缓存）
- [x] **T-2.5** ✅ ai 路由 4 端点（/chat /chat/stream /insight/daily /quota）
- [x] **T-2.6** ✅ rate-limit-persistent 中间件（基于 RateLimit 表）
- [x] **T-2.7** ✅ patrol 巡检 + 分布式锁 + AIQuota TTL 清理（自启动）
- [x] **T-2.8** ✅ family.service 8 个写操作 + baby.service deleteBaby cursor 续传接入 OperationLogger

### 阶段三：前端 P0 组件（M3）

- [x] **T-3.1** ✅ family-store 升级为 FamilyDetail + LeaveFamilyResult 状态机
- [x] **T-3.2** ✅ 客户端 PermissionGuard + axios 错误映射（mapAxiosError → ApiError 子类）
- [x] **T-3.3** ✅ useActiveSleep hook + StatusCapsule 组件（4 种态 + 双层防护）
- [x] **T-3.4** ✅ BabySwitcher + TodaySummary + HomeSkeleton + computeDailyGoals
- [x] **T-3.5** ✅ AI 洞察折叠态 + buildFallbackInsight + use-local-storage-state
- [x] **T-3.6** ✅ InsightSection 趋势组件（4 卡片 + RangeBar + useWeeklyTrend）
- [x] **T-3.7** ✅ 家庭协作 5 个组件（RoleEditDialog / TransferAdminDialog / RemoveMemberConfirm / InviteSection / MembersSection）
- [x] **T-3.8** ✅ HomePage 与 FamilyPage 集成（含 leaveFamily 状态机分支）

### 阶段四：P1 增强（M4）

- [ ] **T-4.1** PageHeader + RecordPage 副标题
  - 新建 `client/src/components/page-header.tsx`（icon + title + subtitle + action 通用组件）
  - 新建 `client/src/lib/today-summary.ts`（buildTodaySummaryText 严格按 §2.4 FR-D1.AC2 格式）
  - RecordPage 集成：副标题动态联动
  - 验收：3 种边界（含今日有/无记录、不含今日）副标题正确
  - _涉及：FR-D1_

- [ ] **T-4.2** RecordPage 筛选吸顶 + 日期分组 + 时间轴线
  - 筛选栏 `position: sticky; top: 56px`
  - Timeline 组件分组渲染：渐变分隔线 + 居中日期文案（今天/昨天/M月D日 周X）
  - 时间轴左侧 56px 处 2px 竖线 + 功能色圆点
  - 大于 100 条记录可选启用 `@tanstack/react-virtual`
  - 验收：滚动列表筛选栏始终吸顶；分组头清晰
  - _涉及：FR-D2 / FR-D3_

- [ ] **T-4.3** AI 助手页 SSE + 配额条
  - 新建 `client/src/components/quota-bar.tsx`
  - `client/src/services/ai.ts` 新增 streamChat（基于 fetch ReadableStream）
  - AIAssistantPage 改造：发送消息走 SSE；配额条置顶；剩余 = 0 时禁用发送
  - 验收：流式打字机效果；配额耗尽时 UI 反馈
  - _依赖：T-2.5 | 涉及：FR-F1 / FR-F3 / FR-F4_

- [ ] **T-4.4** ThemeSelector + Settings 改造
  - 新建 `client/src/components/theme-selector.tsx`（三态 RadioGroup）
  - SettingsPage 增加主题选择区
  - useThemeStore 改造：'light' | 'warm-night' | 'system' 三态
  - 验收：切换三种模式整站颜色立即变化；跟随系统模式响应 `prefers-color-scheme` 变化
  - _依赖：T-1.3 | 涉及：FR-G1_

- [ ] **T-4.5** 配方奶 8 按钮 + sleep popup 多入口策略
  - `client/src/components/feeding-dialog.tsx` quickAmounts 数组对齐 [10, 30, 60, 90, 120, 150, 180, 210]
  - HomePage SleepQuickButton：未计时态调 `useActiveSleep().start`；计时态打开 SleepDialog 用于补录
  - 验收：FR-A1.AC9-AC11 三种场景行为正确
  - _依赖：T-3.3 | 涉及：FR-A6 / FR-A1_

### 阶段五：P2 增值（M5）

- [ ] **T-5.1** 彩蛋检测引擎
  - 新建 `client/src/lib/easter-egg.ts`：`detectAll(ctx) → [{type, priority, payload}]`
  - 实现 8 类彩蛋检测逻辑（30/100/365/first_record/month/streak/holiday/insight）
  - localStorage key 命名与小程序一致
  - 验收：单元测试 8 类触发条件 + 优先级裁决
  - _涉及：FR-G2_

- [ ] **T-5.2** 彩蛋 3 个组件
  - 新建 `client/src/components/easter-egg-popup.tsx`（半屏 Dialog，支持 30/100/365 三种 type）
  - 新建 `client/src/components/easter-egg-toast.tsx`（轻量 Toast，2s 自动消失）
  - 新建 `client/src/components/easter-egg-banner.tsx`（月龄/节日提示条）
  - HomePage useEffect 500ms 延迟触发 detectAll → 路由分发
  - 验收：满 30/100 天触发对应弹窗；首次记录触发 Toast
  - _依赖：T-5.1 | 涉及：FR-G2_

- [ ] **T-5.3** 分享图 V1（4 卡片）
  - 新建 `client/src/lib/share-canvas.ts`（离屏 Canvas 绘制，限制 DPR=2）
  - 新建 `client/src/components/share-report-dialog.tsx`（生成预览 / 保存 / 分享）
  - 集成到记录页或 BabyPage 的「生成报告」入口
  - 验收：生成 750x 动态高度 jpeg ≤ 500KB；移动端 navigator.share 调起；桌面端 a download 下载
  - _涉及：FR-G3_

### 阶段六：测试与文档同步（M6）

- [ ] **T-6.1** 后端单元测试
  - 测试覆盖：record.service 跨午夜统计、ai.service 配额回滚、trend.service 范围匹配、family.service leaveFamily 4 种状态、OperationLogger 4 种状态流转
  - 验收：≥ 70% 关键路径覆盖率
  - _涉及：FR-A / FR-B / FR-C / FR-E / FR-F_

- [ ] **T-6.2** 前端单元测试
  - 测试覆盖：easter-egg.detectAll 8 类、insight-fallback、today-summary、age-goals、capsule-state
  - 用 vitest + @testing-library/react
  - _涉及：FR-A / FR-D / FR-G_

- [ ] **T-6.3** Playwright E2E（主链路）
  - 主链路场景：注册 → 创建家庭 → 添加宝宝 → 创建 5 种记录 → 退出登录 → 重新登录
  - 邀请加入 + 角色变更 + 移除 + 转让
  - viewer 写操作被拒（前后端双层）
  - AI 配额耗尽 + 暖夜模式 axe-core 对比度
  - _涉及：FR-H_

- [ ] **T-6.4** 文档同步（6 份核心文档）
  - 更新 `architecture.md`：补 client/server/shared 三模块结构；新增 OperationLog/RateLimit/AIQuota patrol/分布式锁
  - 更新 `data-model.md`：新增 AIQuota model；TodayStats 字段升级
  - 更新 `coding-conventions.md`：补「Web 双时间戳约定」「PermissionGuard 双层防护」「OperationLogger 接入清单」
  - 更新 `ui-design-system.md`：补完整美拉德色系 light/warm-night 双色板
  - 更新 `component-library.md`：补 12+ 个新组件清单
  - 更新 `service-api.md`：补 AI 4 端点 + trend/weekly + records?endTimeIsNull + babies cursor 续传
  - 更新 `CHANGELOG.md`：新增 v4.4.0（建议代号 Lullaby）区块
  - 更新 `README.md` 版本历史
  - _涉及：所有 FR_

- [ ] **T-6.5** patrol 切换为生产模式
  - 验证 dry-run 模式下报告正确
  - 设置 `PATROL_DRY_RUN=false`，规则 B 自动修复生效
  - _涉及：FR-E3_

---

## 任务依赖关系

```
T-1.1 (shared types) ─┬─→ T-2.1 ─→ T-2.2 ─┐
                      ├─→ T-2.3 ──────────┤
                      └─→ T-3.1 ──────────┤
T-1.2 (ui 组件) ──────┬─→ T-3.4 ──────────┤
                      ├─→ T-3.6 ──────────┤
                      └─→ T-3.7 ──────────┤
T-1.3 (themes.css) ───→ T-4.4              │
T-1.4 (OperationLogger) ─┬─→ T-2.7         │
                          └─→ T-2.8         │
T-1.5 (AIQuota) ─→ T-2.4 ─→ T-2.5 ─→ T-4.3 │
T-2.6 (rate-limit) ────────────────────────┤
T-3.2 (PermissionGuard) ─→ T-3.3 ──────────┤
                                            ▼
                                          T-3.8 (HomePage 集成)
                                            │
                                            ▼
                                          T-4.x P1 → T-5.x P2 → T-6.x 测试与文档
```

---

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 混元 SDK 凭证未配置导致 AI 链路无法测试 | 高 | 中 | T-2.4 实现 mock 降级，缺凭证时返回固定 fallback；CHANGELOG 标注「需在生产环境补 SECRET」 |
| 不引入 node-cron / rate-limiter-flexible 依赖，自建实现可能存在边界 bug | 中 | 中 | T-2.6/T-2.7 配套单元测试；patrol 默认 dry-run 兜底 |
| SQLite 在 dev 不支持某些 Prisma 特性（如 partial index） | 中 | 低 | AIQuota `@@index([date])` 是普通索引可用；上生产 MySQL 时统一切换 |
| 前端 SSE 在某些浏览器（旧 Edge）支持不全 | 低 | 低 | T-4.3 用 fetch ReadableStream 替代 EventSource，兼容性更好 |
| Canvas 跨 DPR 在 Safari 输出与 Chrome 不一致 | 中 | 低 | T-5.3 强制 DPR=2，单元测试在 Chromium 通过即可 |
| Phase 3 工时超出预期（前端组件密集） | 高 | 中 | 严格按 T-3.x 顺序提交，每个组件独立 commit |

---

*文档维护：每完成一个 Task，将 `- [ ]` 改为 `- [x] ✅`，并 commit。所有 Task 完成后，状态从「进行中」改为「✅ 已完成（YYYY-MM-DD）」。*
