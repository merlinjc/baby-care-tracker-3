# Git Flow 工作流规范

> **版本**: v1.1 | **更新日期**: 2026-04-14 | **状态**: 生效中

---

## 1. 分支模型

### 1.1 核心分支（长期存在）

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `master` | 生产就绪代码，每次合并对应一个版本标签 | 禁止直接 push，仅接受 PR 合并 |
| `develop` | 集成开发分支，所有 feature 合入此处 | 禁止直接 push，仅接受 PR 合并 |

### 1.2 临时分支（用完即删）

| 分支类型 | 命名规范 | 从哪拉 | 合入哪 | 生命周期 |
|----------|----------|--------|--------|----------|
| Feature | `feature/<spec-name>` | `develop` | `develop` | 功能开发期间 |
| Release | `release/v<x.y.z>` | `develop` | `master` + `develop` | 发版准备期间 |
| Hotfix | `hotfix/<issue-desc>` | `master` | `master` + `develop` | 紧急修复期间 |

### 1.3 分支命名约定

```
feature/warm-night-mode          ✅ 与 specs/ 目录名一致
feature/insight-trend-enhancement ✅ 复合功能用 kebab-case
feature/FR-8-feeding-prediction  ✅ 单个 FR 可带编号
release/v3.3.0                   ✅ 语义化版本号
hotfix/sleep-timer-crash         ✅ 描述问题的 kebab-case
```

---

## 2. Feature 开发流程

### 2.1 开始开发

```bash
# 1. 确保 develop 是最新的
git checkout develop
git pull origin develop

# 2. 创建 feature 分支
git checkout -b feature/<spec-name>

# 3. 推送远程分支（便于协作和备份）
git push -u origin feature/<spec-name>
```

### 2.2 开发中的提交规范

**Commit Message 格式**（遵循 [Conventional Commits](https://www.conventionalcommits.org/)）：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Type 枚举：**

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(home): 添加骨架屏加载动画 FR-15` |
| `fix` | Bug 修复 | `fix(record): 修复睡眠计时跨日异常 BUG-23` |
| `refactor` | 重构（不改变行为） | `refactor(services): 提取 TodoService 单例` |
| `style` | 样式调整（不影响逻辑） | `style(home): 调整问候语间距和字号` |
| `perf` | 性能优化 | `perf(record): getTodayStats 增加内存缓存` |
| `docs` | 文档更新 | `docs: 更新 architecture.md 分包策略` |
| `chore` | 构建/工具/配置 | `chore: 更新 .gitignore 排除 zip 文件` |
| `test` | 测试相关 | `test(date): 补充 formatDuration 边界用例` |

**Scope 约定：**

| Scope | 对应目录 |
|-------|----------|
| `home` / `record` / `discover` / `profile` | `miniprogram/pages/<scope>/` |
| `services` | `miniprogram/services/` |
| `utils` | `miniprogram/utils/` |
| `components` | `miniprogram/components/` |
| `cloud` | `cloudfunctions/` |
| `specs` | `specs/` |
| 省略 scope | 跨多模块或项目级变更 |

**提交粒度原则：**

1. **一个 Task 至少一个 commit** — 对应 `tasks.md` 中的 `T-x.x` 编号
2. **逻辑完整** — 每个 commit 可独立编译运行，不引入中间破坏状态
3. **关联 FR/BUG** — commit message 尾部标注 `FR-x` 或 `BUG-x`

```bash
# ✅ 好的提交
git commit -m "feat(services): 新建 TodoService 提取待办统计逻辑 FR-7"
git commit -m "feat(home): 实现骨架屏 shimmer 动画 FR-15"
git commit -m "fix(home): 修复多宝切换后 AI 洞察未刷新 BUG-15"

# ❌ 避免的提交
git commit -m "update"
git commit -m "fix bug"
git commit -m "WIP"
```

### 2.3 合并回 develop

```bash
# 1. 先同步 develop 最新代码
git checkout develop
git pull origin develop

# 2. 回到 feature 分支，rebase（保持线性历史）
git checkout feature/<spec-name>
git rebase develop

# 3. 解决冲突（如有），然后推送
git push origin feature/<spec-name> --force-with-lease

# 4. 在 GitHub 上创建 Pull Request
#    - 标题：feat: <spec 中文名> (v<version>)
#    - 描述：引用 specs/<spec-name>/requirements.md 的核心功能列表
#    - Labels: feature

# 5. PR 合并后清理分支
git checkout develop
git pull origin develop
git branch -d feature/<spec-name>
git push origin --delete feature/<spec-name>
```

---

## 3. Release 发版流程

### 3.1 创建 Release 分支

```bash
# 从 develop 拉 release 分支
git checkout develop
git pull origin develop
git checkout -b release/v3.3.0
```

### 3.2 Release 分支上的操作

仅允许以下类型的 commit：

- `fix`: 修复在集成测试中发现的 bug
- `docs`: 更新版本号、CHANGELOG、README
- `chore`: 调整配置

**必做清单：**

- [ ] 更新 `CHANGELOG.md`（新增版本区块，MAJOR 版本分配新代号）
- [ ] 更新 `README.md` 版本历史表（追加新行，含代号）
- [ ] 更新 `README.md` § 1 产品版本号
- [ ] 更新 `architecture.md` 版本号
- [ ] 更新 `coding-conventions.md` 版本号
- [ ] 更新 `miniprogram/pages/profile/profile.wxml` 版本信息
- [ ] 更新 `miniprogram/app.js` `globalData.version`
- [ ] 确认所有 spec 的 `tasks.md` 状态为 ✅ 已完成
- [ ] 同步更新受影响的文档（详见「开发工作流」文档 § 3.3.4）

### 3.3 合并与打标签

```bash
# 1. 合并到 master
git checkout master
git pull origin master
git merge --no-ff release/v3.3.0 -m "release: v3.3.0"

# 2. 打标签
git tag -a v3.3.0 -m "Release v3.3.0 - <主要功能简述>"

# 3. 合并回 develop（将 release 中的修复带回）
git checkout develop
git merge --no-ff release/v3.3.0 -m "merge: release/v3.3.0 back to develop"

# 4. 推送
git push origin master develop --tags

# 5. 清理
git branch -d release/v3.3.0
git push origin --delete release/v3.3.0
```

---

## 4. Hotfix 紧急修复流程

```bash
# 1. 从 master 拉 hotfix 分支
git checkout master
git pull origin master
git checkout -b hotfix/sleep-timer-crash

# 2. 修复并提交
git commit -m "fix(home): 修复睡眠计时器崩溃 BUG-25"

# 3. 合并到 master 并打 patch 标签
git checkout master
git merge --no-ff hotfix/sleep-timer-crash -m "hotfix: v3.2.1"
git tag -a v3.2.1 -m "Hotfix v3.2.1 - 修复睡眠计时器崩溃"

# 4. 合并回 develop
git checkout develop
git merge --no-ff hotfix/sleep-timer-crash -m "merge: hotfix/sleep-timer-crash to develop"

# 5. 推送和清理
git push origin master develop --tags
git branch -d hotfix/sleep-timer-crash
git push origin --delete hotfix/sleep-timer-crash
```

---

## 5. 版本号规范（语义化版本）

格式：`v<MAJOR>.<MINOR>.<PATCH>`

| 级别 | 触发条件 | 示例 |
|------|----------|------|
| MAJOR | 架构级重构、不兼容的数据模型变更 | v2.0 → v3.0（全面重构） |
| MINOR | 新增功能模块（对应一个或多个 spec） | v3.2 → v3.3（暖色夜间模式） |
| PATCH | Bug 修复、性能微调、文档更新 | v3.2.0 → v3.2.1（hotfix） |

**当前版本线：**

| 版本 | 代号 | 日期 | 标签 | 主要内容 |
|------|------|------|------|----------|
| v1.0 | Sprout | 2026-03-25 | — | 初始版本，核心记录功能 |
| v2.0 | Cradle | 2026-03-27 | — | 全面重构、洞察趋势增强 |
| v3.0 | Lullaby | 2026-04-03 | — | 首页重设计、家庭协作、彩蛋系统 |
| v3.1 | Lullaby | 2026-04-08 | — | 暖色夜间模式、分享图 v2、性能优化 |
| v3.2.0 | Lullaby | 2026-04-10 | `v3.2.0` | 完整功能版本（首个 Git 管理版本） |
| v4.0.0 | Milo | 2026-04-13 | `v4.0.0` | 美拉德 UI 重设计、暗色模式 28 项 QA |
| v4.0.1 | Milo | 2026-04-13 | — | 配方奶快捷用量调整 [10-210ml] |
| v4.1.0 | Milo | 2026-04-15 | `v4.1.0` | AI 屏蔽 + 分享认证加固 + Family 安全修复 |
| v4.1.1 | Milo | 2026-04-15 | `v4.1.1` | 存量数据修复（records userId 迁移 + 幽灵成员清理）+ 发现页占位卡片 |
| v4.2.0 | Milo | 2026-04-17 | `v4.2.0` | 云函数网关 & 安全规则治理（13 action 服务端鉴权 + familyId 数据迁移） |
| v4.2.1 | Milo | 2026-04-17 | `v4.2.1` | E2E 安全测试套件（163 条用例，15 模块，100% 通过） |
| v4.2.2 | Milo | 2026-04-20 | `v4.2.2` | 文档对齐 v4.2 实际架构 + 4 项低风险代码热修复 + v4.2 spec 状态回溯 |
| v4.3.0 | Milo | 2026-04-20 | `v4.3.0` | 稳定性加固（FamilyContext/PermissionGuard/离线队列完整性）+ 云函数模块化（actions/+lib/）+ 可观测性（operation_logs/rate_limits/每日巡检） |
| v4.3.1 | Milo | 2026-04-20 | `v4.3.1` | v4.3.0 全量 review 修复（22 项 FR）：createBaby 写 _openid 修生产 blocker、权限收紧 isAdmin 修绕过、deleteBaby 级联删、updatedAtTs 双时间戳补齐 |

---

## 6. 分支生命周期图

```
master:    ●───────────────────●──────────●──── ...
           │                   ↑          ↑
           │           merge release   merge hotfix
           │                   │          │
release:   │              ●────●          │
           │              ↑               │
           │         from develop         │
           │                              │
hotfix:    │                         ●────●
           │                         ↑
           │                    from master
           │
develop:   ●───●───●───●───●───●────●───●──── ...
               ↑       ↑       ↑
          feat/A   feat/B  feat/C
               │       │       │
feature:  ●────●  ●────●  ●────●
```

---

## 7. PR 模板

在 GitHub 上创建 PR 时，使用以下模板：

```markdown
## 变更概述
<!-- 一句话描述此 PR 的目的 -->

## 关联 Spec
- specs/<spec-name>/requirements.md
- specs/<spec-name>/tasks.md

## 变更内容
### 新增
- 

### 修改
- 

### 删除
- 

## 受影响的文档
<!-- 列出需要同步更新的文档 -->
- [ ] architecture.md
- [ ] data-model.md
- [ ] coding-conventions.md
- [ ] ui-design-system.md
- [ ] component-library.md
- [ ] service-api.md

## 测试验证
<!-- 描述如何验证此变更 -->
- [ ] 微信开发者工具编译通过
- [ ] 核心功能手动测试通过
- [ ] 暗色模式兼容测试
- [ ] 多宝切换场景测试

## 截图（如有 UI 变更）
<!-- 贴上前后对比截图 -->
```

---

*文档维护：版本发布后同步更新版本线表格。*
