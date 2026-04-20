# 实施计划 - v4.3.1 Review 修复

> 版本：v1.0 | 日期：2026-04-20 | 状态：进行中

## 实施概览

预计总工时：约 4~5 小时（纯修复，无新功能）

里程碑：
- **M1（1.5h）**：P0 云函数修复 + 部署验证（FR-1/2/3/5 侧重，阻塞面最大）
- **M2（1h）**：P0 客户端修复（FR-4/6/7，影响存量用户）
- **M3（1h）**：P1 全部（FR-8~FR-18）
- **M4（0.5h）**：P2 + E2E 扩展 + 回归
- **M5（1h）**：阶段三文档同步 + CHANGELOG + 版本号

---

## 任务列表

### 阶段一：开发前（已完成）

- [x] **T-0.1** 创建 `feature/v4.3.1-review-fixes` 分支
- [x] **T-0.2** 编写 requirements.md / design.md / tasks.md

---

### 阶段二：编码修复

#### M1：P0 云函数侧（~1.5h）

- [ ] **T-1.1** errors.js 新增 ALREADY_IN_FAMILY + INVALID_ROLE 错误码
  - 验收：require 后调用返回正确结构
  - _涉及：FR-8, FR-10_

- [ ] **T-1.2** createBaby.js 写入 _openid + 权限改 isAdmin（FR-1, FR-2）
  - 验收：admin 创建成功；viewer/editor 返回 PERMISSION_DENIED；新建文档 _openid 非空

- [ ] **T-1.3** deleteBaby.js 级联删除 records/vaccine/milestone（FR-2, FR-3）
  - 完整 phases state 实现 + cursor 续传
  - 验收：删除后 records/vaccine/milestone 集合中相关 babyId 文档清零

- [ ] **T-1.4** createFamily.js 防重复创建（FR-10）
  - 验收：user.familyId 指向有效 family 时返回 ALREADY_IN_FAMILY

- [ ] **T-1.5** removeMember.js 空 openid 兜底（FR-5）
  - 验收：targetOpenid 为空时不 pull（'')，operation_logs 有告警

- [ ] **T-1.6** updateMemberRole.js role 白名单 + sole admin 守卫（FR-8）
  - 验收：无效 role 返回 INVALID_ROLE；自降级唯一 admin 返回 SOLE_ADMIN

- [ ] **T-1.7** dissolveFamily.js 改 isAdmin（FR-9）
  - 验收：被转让后的新 admin 可解散家庭

- [ ] **T-1.8** clearBabyData.js 查询附 familyId（FR-11）
  - 验收：所有 phase 的 where 均含 familyId

- [ ] **T-1.9** 云函数部署（familyOperation），MCP invoke 冒烟 3 个 action

#### M2：P0 客户端（~1h）

- [ ] **T-2.1** permission.js getUserRole 默认 viewer（FR-6）
  - 验收：memberDetails 不含 userId 且非 creatorId 时返回 viewer

- [ ] **T-2.2** record.js updateRecord 补 updatedAtTs（FR-7）
  - 验收：云端写入文档含 updatedAtTs 数值字段

- [ ] **T-2.3** sync.js executeOperation(update) 补 updatedAtTs（FR-7）
  - 验收：离线队列同步时云端写入含 updatedAtTs

- [ ] **T-2.4** settings.js clearAllCloudData 循环处理 in_progress（FR-4）
  - 验收：mock 返回 in_progress → 循环 → succeeded 闭环

- [ ] **T-2.5** app.js initUser 改 getInstance（FR-16）
  - 验收：grep 全项目无 `new AuthService()`

#### M3：P1 全部（~1h）

- [ ] **T-3.1** auth.js _handleInviteCodeForExistingUser 迁 status 状态机（FR-15）
- [ ] **T-3.2** family.js transferAndLeave 检查返回值（FR-14）
- [ ] **T-3.3** vaccine.js add/update/delete 加 PermissionGuard + 补时间戳 + FamilyContext（FR-12）
- [ ] **T-3.4** milestone.js 同 T-3.3
- [ ] **T-3.5** record.js batchDelete 归属校验（FR-13）
- [ ] **T-3.6** patrolMemberOpenids 反向漂移巡检（FR-18）

#### M4：P2 + E2E 扩展（~0.5h）

- [ ] **T-4.1** record.js catch 分支 offlineRecord 补 createdBy 对象（FR-19）
- [ ] **T-4.2** 同步 v43-prod/ 目录（reflect v4.3.1 actions）
- [ ] **T-4.3** e2e m21-v431Fixes 新增用例（至少 5 条：FR-1/FR-2/FR-6/FR-10/FR-11）
- [ ] **T-4.4** 跑全量 E2E 回归
- [ ] **T-4.5** 手动冒烟（settings.clearAllCloudData 大数据场景）— 交给用户

---

### 阶段三：文档同步与发版（~1h）

- [ ] **T-5.1** data-model.md：operation_logs.status / rate_limits.windowStart 对齐代码
- [ ] **T-5.2** service-api.md：BabyService.deleteBaby 级联删说明 + clearAllCloudData 循环契约
- [ ] **T-5.3** coding-conventions.md：§9 权限体系补充"默认 viewer 原则"
- [ ] **T-5.4** architecture.md：§6.5 权限纵深防御补"客户端安全网"
- [ ] **T-5.5** CHANGELOG v4.3.1 区块（Added/Changed/Fixed/Security）
- [ ] **T-5.6** PATCH 版本号同步（#1, #3, #6, #7, #8）
- [ ] **T-5.7** tasks.md + spec 四件套状态标记 ✅ 已完成
- [ ] **T-5.8** 最终 commit + 等待 PR 创建（由用户手动推送）

---

## 任务依赖关系

```
T-0.1, T-0.2 ─┐
              │
              ▼
         M1 (T-1.1 ~ T-1.9)     ← 云函数须先部署并冒烟通过
              │
              ▼
         M2 (T-2.1 ~ T-2.5)     ← 客户端依赖云函数已部署
              │
              ▼
         M3 (T-3.1 ~ T-3.6)     ← 客户端/云函数并行
              │
              ▼
         M4 (T-4.1 ~ T-4.5)     ← E2E 跑通
              │
              ▼
         M5 (T-5.1 ~ T-5.8)     ← 文档 + 版本号 + 收尾
```

## 风险说明

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 存量无 `_openid` babies 创建者仍无法 updateBaby | 高 | 中 | 列入 backlog；短期通过云函数 admin 修复；长期发迁移脚本 |
| getUserRole 默认 viewer 误伤正常用户 | 中 | 高 | 通过 `ensureUserReady` 5 分钟刷新兜底；发布 changelog 告知 |
| deleteBaby 大数据量级联删失败 | 低 | 中 | 分批 + operation_logs 可回溯 + cursor 续传 |
| clearAllCloudData 循环中断电 | 低 | 低 | cursor 落 Storage；下次进入提示"发现未完成的清除任务，是否继续" |
| 多 admin 并发转让导致家庭无 admin | 低 | 高 | SOLE_ADMIN 守卫 + 安全规则兜底 |
