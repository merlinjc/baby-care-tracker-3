# 版本更新日志（CHANGELOG）

> 格式遵循 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循[语义化版本](https://semver.org/)。
> MAJOR 版本赋予正式代号，MINOR/PATCH 沿用所属 MAJOR 代号。

---

## 代号注册表

| MAJOR 版本 | 代号 | 含义 |
|-----------|------|------|
| v1.x | **Sprout**（萌芽） | 项目破土而出，核心记录功能诞生 |
| v2.x | **Cradle**（摇篮） | 全面重构奠定架构基座，如摇篮承托成长 |
| v3.x | **Lullaby**（摇篮曲） | 家庭协作、彩蛋、夜间模式，陪伴宝宝入眠 |
| v4.x | **Milo**（米洛） | 美拉德暖色 UI 重设计，如营养麦芽饮品滋养成长 |

---

## [v4.1.0] Milo — 2026-04-15

### Added
- `app.js` 新增 `ensureUserReady()` 统一用户就绪检查（含 5 分钟缓存穿透机制）
- `app.js` 新增 `checkFamilyStale()` 轻量 onShow 校验（纯本地，不发网络请求）
- `app.js` 新增 `_clearFamilyData()` 家庭数据清理辅助方法
- `family.js` 新增 `joinByInviteCode` 旧家庭检查逻辑（防止幽灵成员）
- `family.js` `dissolveFamily` 新增批量清除所有成员 familyId/familyRole
- `family.js` `updateMemberRole` 新增乐观锁重试（最多 2 次）+ users.familyRole 同步
- `auth.js` 新增 `_handleInviteCodeForExistingUser()` 老用户邀请码处理流程
- 16 个页面统一增加 `ensureUserReady()` 登录守卫（4 TabBar + 3 主包 + 9 分包）

### Changed
- `record.js` `createRecord()` userId 从 `userInfo.openid` 统一为 `userInfo._id`
- `record.js` `createRecord()` familyMember 查找从 `members` 改为 `memberDetails`
- `family.js` `_clearUserFamilyInfo()` 从 `where({ _openid })` 改为 `doc(userId).update()`
- `family.js` `removeMember()` 清除用户信息也改为 `doc(targetUserId).update()`
- `family.js` 页面 `currentUserId` 和 `leaveFamily` 移除 openid fallback

### Removed
- 首页 AI 洞察区块（`home.wxml` insight-v4 整个 view + `home.js` loadAiInsight 调用）
- 发现页 AI 助手入口（`discover.js` toolItems 减为 3 项）
- 成长报告 AI 建议卡片（`report-popup.wxml` + `share-canvas.js` AI 绘制）
- 引导页 AI 介绍（`guide.js` 移除 AI 对象 + `ai-assistant.js` 功能关闭提示）

---

## [v4.0.1] Milo — 2026-04-13

### Changed
- 配方奶快捷用量从 `[30-240ml]` 调整为 `[10-210ml]`，新增 10ml 细粒度选项

---

## [v4.0.0] Milo — 2026-04-13

> **代号含义**：Milo 是一种营养麦芽饮品，寓意「滋养成长」——本版本全面重设计 UI，采用美拉德暖色系。

### Added
- 全新美拉德色系 UI 设计系统（8rpx 网格、三级圆角、三级阴影）
- 6 个新增 CSS 变量 + 4 个暗色覆盖变量
- 3 个新增动画（`cardStagger`、`shimmer`、`focusPulse`）
- focus-card 新组件（聚焦卡片）
- 常用奶量快捷填入（feeding-popup v4.0 增强）
- 弹窗统一底部弹出式布局 + swipe-close 手势关闭
- 页头统一清理（去重复标题栏，3 页）
- 弹窗关闭按钮统一添加（13 处）

### Changed
- 首页问候区精简（移除 baby-card，合并多宝切换）
- 状态胶囊改造
- 摘要进度条 + 快捷入口重设计
- 待办区域改为竖向布局
- AI 洞察改为一行式
- 时间线轴线视觉升级
- 记录页吸顶筛选栏
- 发现页网格重构
- 我的页布局重构
- packageGrowth / packageSocial / auth / baby-create 视觉统一升级
- 暗色模式 28 项 QA 验收通过

---

## [v3.2.0] Lullaby — 2026-04-10

> **里程碑**：首个 Git 管理版本，建立 Git Flow + 三阶段开发工作流规范。

### Added
- `specs/workflow/development-workflow.md` — 开发工作流三阶段规范
- `specs/workflow/git-flow.md` — Git Flow 分支模型、Commit 规范、Release 流程
- `specs/ai-coding-methodology.md` — Spec-Driven Development 方法论总结

### Changed
- 记录页顶部导航栏重设计（方案 B：吸顶标题 + 副标题统计）

---

## [v3.1.0] Lullaby — 2026-04-08

### Added
- 暖色夜间模式（light / dark / 跟随系统三种主题切换）
- `theme.json` 亮色/暗色主题变量配置
- ThemeManager 主题管理器工具类
- 成长报告分享图 V2（成绩单式设计）
- 本周趋势智能增强（周环比、参考范围、状态评估、智能提示语）
- 彩蛋系统（节日/纪念日/特殊时刻自动触发彩蛋互动）
- easter-egg-popup / easter-egg-toast 组件
- 彩蛋检测系统工具类

### Changed
- 全面性能优化（30s 节流、3s 去重、batchExecute 限流、分页 fetchAll）
- 分享图 Canvas 绘制优化（超时降级、防重复点击）
- 所有 Service 统一闭包单例模式

---

## [v3.0.0] Lullaby — 2026-04-03

> **代号含义**：Lullaby（摇篮曲）——家庭协作功能上线，多人共同守护宝宝。

### Added
- 首页完全重设计（问候区、状态横幅、今日概览、快捷记录、待办、AI 洞察、时间线）
- 家庭协作功能（邀请码加入、admin/editor/viewer 三级权限）
- family / family-create / family-join 三个社交页面
- FamilyService 家庭组服务（17KB）
- PermissionUtil 权限管理工具
- AI 每日洞察（基于腾讯混元大模型）
- 睡眠实时计时状态
- 成长报告分享图（初版 Canvas 绘制）
- report-popup / export-popup 组件

### Changed
- 分享图优化（图片加载超时降级、综合评分绘制）

---

## [v2.0.0] Cradle — 2026-03-27

> **代号含义**：Cradle（摇篮）——全面重构奠定五层架构基座。

### Added
- 五层架构体系（页面层→组件层→服务层→工具层→数据层）
- 11 个服务层模块（RecordService、AuthService、BabyService 等）
- 12 个工具类（StorageUtil、NetworkUtil、DateUtil 等）
- 洞察趋势增强（trendService、reportDataHelper）
- 离线同步服务（SyncService，队列/重试/网络监听）
- 分包策略（packageGrowth + packageSocial）

### Changed
- 从单文件架构重构为五层分离架构
- 数据库操作从页面内联改为服务层封装
- 记录页头重设计

---

## [v1.0.0] Sprout — 2026-03-25

> **代号含义**：Sprout（萌芽）——Baby Care Tracker 的第一个版本。

### Added
- 五类日常记录：喂养（母乳/配方奶/辅食）、睡眠、排便、体温、生长测量
- 4 个 TabBar 页面：首页、记录、发现、我的
- CloudBase 云开发集成（NoSQL 数据库 + 云函数）
- 6 个数据库集合（users、families、babies、records、vaccine_records、milestone_records）
- WHO 生长曲线、国家免疫规划疫苗计划
- 发育里程碑追踪
- 基础记录弹窗组件（feeding/sleep/diaper/temperature/growth）

---

*文档维护：每次版本发布后，在对应版本区块追加变更条目。*
