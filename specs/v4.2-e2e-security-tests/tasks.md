# 实施计划 - v4.2 端到端安全 & 权限自动化测试

> 版本：v1.0 | 日期：2026-04-17 | 状态：✅ 已完成（2026-04-17）

---

## 实施概览

| 指标 | 值 |
|------|-----|
| 预计总工时 | ~6h |
| 测试用例数 | 126 条（122 自动化 + 4 手动） |
| 产出文件 | 1 个云函数目录（含 20 个文件） |
| 关键里程碑 | M1 基础框架 → M2 云函数测试模块 → M3 安全规则测试模块 → M4 部署执行 |

---

## 任务列表

### 1. 测试基础设施搭建

- [x] **T-1.1** 创建云函数目录结构与配置文件
  - 创建 `cloudfunctions/e2eSecurityTest/` 目录
  - 创建 `package.json`（`wx-server-sdk: ~2.6.3`）
  - 创建 `config.json`（`timeout: 60`）
  - 创建 `index.js` 入口（setup/run/teardown 三个 action 分发）
  - _需求：全局基础设施_

- [x] **T-1.2** 实现测试数据定义 `lib/test-data.js`
  - 定义 6 个测试用户（Alice/Bob/Carol/Dave/Eve/Frank）+ Ghost 标识
  - 定义 2 个家庭（Family-A 含 3 成员，Family-B 含 2 成员）
  - 定义 2 个宝宝（Baby-X/Baby-Y）
  - 定义 5 条 records（Alice 2 条 + Bob 1 条 + Dave 2 条）
  - 定义 2 条 vaccine_records + 1 条 milestone_records
  - 所有 _id 使用 `test_e2e_` 前缀
  - _需求：测试数据准备清单_

- [x] **T-1.3** 实现测试执行引擎 `lib/test-runner.js`
  - `TestRunner` 类：`setModule()`、`test(id, title, fn)`、`getReport()`
  - 每条用例捕获 pass/fail/error + 执行时长
  - 按模块分组统计 + 生成 summary
  - _需求：报告输出规范_

- [x] **T-1.4** 实现 `index.js` 的 setup/teardown 逻辑
  - `setup()`：按 test-data 定义插入全部测试数据到 6 个集合
  - `teardown()`：按 `test_e2e_` 前缀批量扫描删除全部测试数据
  - 幂等：setup 前先调 teardown 清理
  - `run(db, _, targetModule)`：加载全部模块并顺序执行，结果写入 `test_results` 集合
  - _需求：NFR-1 测试环境要求_

### 2. 核心库实现

- [x] **T-2.1** 复制 familyOperation 内部函数到 `lib/family-operations.js`
  - 从 `cloudfunctions/familyOperation/index.js` 提取 13 个 action 函数 + 7 个工具函数
  - 移除 `exports.main` 入口和 `cloud.getWXContext()` 依赖
  - 改为接收 `db, _, userId, openid, user/params` 参数的独立函数
  - 全部 `module.exports` 导出
  - _需求：设计文档 §2.2 模拟用户身份方案_

- [x] **T-2.2** 实现安全规则模拟器 `lib/rule-simulator.js`
  - `RuleSimulator` 类，内置 6 个集合的安全规则定义
  - `evaluate(collection, operation, auth, doc)` → `{allowed, reason}`
  - 支持 5 种规则表达式：`true/false`、`doc._openid == auth.openid`、`auth.openid in doc.memberOpenids`、`auth != null`、`get('database.families.'+doc.familyId).memberOpenids`
  - `get()` 表达式通过实际 `db.doc().get()` 读取真实 families 文档
  - _需求：设计文档 §6.3 Rule Simulator_

### 3. 云函数权限测试模块（模块 6-17，70 条）

- [x] **T-3.1** 实现 `modules/m06-createFamily.js` — 5 条
  - CF-01~CF-05：正常创建、Ghost 用户、缺参数、邀请码格式、过期时间
  - 每条 reset 后调用 `createFamily()`，验证返回值和数据库状态
  - _需求：模块 6 全部 5 条_

- [x] **T-3.2** 实现 `modules/m07-joinFamily.js` — 14 条
  - JF-01~JF-14：正常加入、无效/过期码、已是成员、大小写、限流、幽灵成员防护（3 场景）、数据一致性验证（3 条）、Ghost 用户
  - 限流测试(JF-06)需在同一函数执行上下文中连续调用 6 次
  - JF-07 通过直接清理 rateLimitMap 模拟重置（而非等待 61s）
  - _需求：模块 7 全部 14 条_

- [x] **T-3.3** 实现 `modules/m08-removeMember.js` — 8 条
  - RM-01~RM-08：admin 移除 editor/viewer、editor/viewer 移除他人、自移除、admin 互移除、跨家庭、数据隔离验证
  - _需求：模块 8 全部 8 条_

- [x] **T-3.4** 实现 `modules/m09-dissolveFamily.js` — 6 条
  - DF-01~DF-06：创建者解散、非创建者 admin、editor、viewer、跨家庭、不存在家庭
  - DF-01 需验证所有成员 familyId 被清除
  - _需求：模块 9 全部 6 条_

- [x] **T-3.5** 实现 `modules/m10-updateMemberRole.js` — 8 条
  - UR-01~UR-08：creatorId 修改 3 种角色变更、非 creatorId admin、editor、跨家庭、不存在家庭、并发乐观锁
  - UR-01~03 需验证 users.familyRole 同步
  - _需求：模块 10 全部 8 条_

- [x] **T-3.6** 实现 `modules/m11-transferAdmin.js` — 7 条
  - TA-01~TA-07：admin→editor/viewer、editor 尝试、非成员、跨家庭、双方 familyRole 一致性、新 admin 可执行管理操作
  - _需求：模块 11 全部 7 条_

- [x] **T-3.7** 实现 `modules/m12-leaveFamily.js` — 9 条
  - LF-01~LF-09：editor/viewer 正常退出、唯一 admin（有/无其他成员）、双 admin、家庭已不存在、非成员、familyId 清除、退出后读数据
  - LF-09 使用 Rule Simulator 验证退出后 read denied
  - _需求：模块 12 全部 9 条_

- [x] **T-3.8** 实现 `modules/m13-refreshInviteCode.js` — 5 条
  - RI-01~RI-05：admin 刷新、editor/viewer 拒绝、跨家庭、旧码失效验证
  - _需求：模块 13 全部 5 条_

- [x] **T-3.9** 实现 `modules/m14-validateInviteCode.js` — 6 条
  - VI-01~VI-04 + GF-01~GF-02：有效/无效/过期码、Ghost 用户、有/无家庭用户
  - _需求：模块 14 全部 6 条_

- [x] **T-3.10** 实现 `modules/m15-babyOperations.js` — 8 条
  - CB-01~CB-05 + DB-01~DB-03：成员创建（admin/editor/viewer）、非成员、Ghost、成员删除、非成员删除、editor 删除
  - CB-01/DB-01 需验证 families.babies 数组变更
  - _需求：模块 15 全部 8 条_

- [x] **T-3.11** 实现 `modules/m16-clearBabyData.js` — 8 条
  - CD-01~CD-08：admin 清除、editor/viewer 拒绝、清除含他人记录、跨家庭、最后宝宝自动解散、非最后宝宝、不存在家庭
  - CD-04 需验证 Bob 创建的记录也被删除
  - CD-06 需验证 familyDeleted=true + 所有成员 familyId 清除
  - _需求：模块 16 全部 8 条_

- [x] **T-3.12** 实现 `modules/m17-errorHandling.js` — 5 条
  - GE-01~GE-05：未知 action、不传 action、不传 params、Ghost 用户、空字符串 action
  - 直接调用 `exports.main` 入口函数模拟（需构造简化版入口）
  - _需求：模块 17 全部 5 条_

### 4. 安全规则 & 隔离测试模块（模块 1-5, 18-19，56 条）

- [x] **T-4.1** 实现 `modules/m01-05-securityRules.js` — 40 条
  - 使用 Rule Simulator 覆盖模块 1-5 全部需求中的**自动化部分**：
    - M1 (users): U-01~U-08 共 8 条
    - M2 (families): F-01~F-10 共 10 条
    - M3 (babies): B-01~B-09, B-11~B-12 共 11 条（B-10 为 L4）
    - M4 (records): R-01~R-11, R-13~R-16 共 15 条（R-12 为 L4）
    - M5 (vaccine/milestone): V-01~V-04, M-01~M-02 共 6 条（M-03/M-04 为 L4）
  - 总计 50 条 SIM - 4 条 L4 = 46 条自动化；R-16 和 LF-09 等 OPS+SIM 已在其他模块覆盖，此处不重复 → 实际 ~40 条新增
  - _需求：模块 1-5 全部 54 条中的 50 条自动化部分_

- [x] **T-4.2** 实现 `modules/m18-crossFamily.js` — 10 条
  - ISO-01~ISO-05：Rule Simulator 验证 alice/dave 对对方家庭的 records/babies/vaccine/milestone 读取
  - ISO-06~ISO-09：直接调用 removeMember/dissolveFamily/clearBabyData/createBaby 跨家庭操作
  - ISO-10：双向 familyId 隔离验证
  - _需求：模块 18 全部 10 条_

- [x] **T-4.3** 实现 `modules/m19-stateChange.js` — 6 条
  - SV-01~SV-06：先执行状态变更操作（removeMember/leaveFamily/updateRole/joinFamily/dissolveFamily），再用 Rule Simulator 验证数据可见性变化
  - 每条需先 reset 数据，执行操作，再 evaluate
  - _需求：模块 19 全部 6 条_

### 5. 部署与执行

- [x] **T-5.1** 部署测试云函数
  - 使用 MCP `manageFunctions` 部署 `e2eSecurityTest` 到 CloudBase
  - 验证部署成功（查询函数列表）
  - _需求：执行流程第 1 步_

- [x] **T-5.2** 执行 setup → run → 查看报告
  - 调用 `action='setup'` 构造测试数据
  - 调用 `action='run'` 执行全部 126 条测试
  - 分析报告，记录 FAIL/ERROR 用例
  - _需求：执行流程第 2-4 步_

- [x] **T-5.3** 修复失败用例并回归
  - 根据报告中的 failures 分析原因
  - 修复测试代码或业务代码
  - 重新部署并执行
  - 目标：pass rate ≥ 95%
  - _需求：NFR-2 测试覆盖率_

- [x] **T-5.4** 执行 4 条手动补充验证
  - 在微信开发者工具中验证 B-10/R-12/M-03/M-04（不带 familyId 查询被安全规则拒绝）
  - 记录验证结果
  - _需求：L4 手动验证清单_

- [x] **T-5.5** 清理并归档
  - 调用 `action='teardown'` 清理测试数据
  - 将最终测试报告保存到 specs 目录
  - 更新 requirements.md 标记全部用例的实际结果
  - _需求：测试数据清理_

---

## 任务依赖关系

```
T-1.1 (目录结构)
  │
  ├── T-1.2 (测试数据) ─┐
  ├── T-1.3 (执行引擎) ─┤
  │                      ├── T-1.4 (入口函数)
  ├── T-2.1 (内部函数) ──┤
  └── T-2.2 (Rule Sim) ──┤
                          │
                          ├── T-3.1~T-3.12 (云函数测试模块) ──可并行──┐
                          └── T-4.1~T-4.3 (安全规则测试模块) ──可并行──┤
                                                                       │
                                                                       ▼
                                                              T-5.1 (部署)
                                                                       │
                                                              T-5.2 (执行)
                                                                       │
                                                              T-5.3 (修复回归)
                                                                       │
                                                              T-5.4 (手动验证)
                                                                       │
                                                              T-5.5 (清理归档)
```

---

## 工时估算

| 阶段 | 任务 | 估时 |
|------|------|------|
| 基础设施 | T-1.1~T-1.4 | 1h |
| 核心库 | T-2.1~T-2.2 | 1h |
| 云函数测试（12 个模块） | T-3.1~T-3.12 | 2h |
| 安全规则测试（3 个模块） | T-4.1~T-4.3 | 1h |
| 部署执行修复 | T-5.1~T-5.5 | 1h |
| **总计** | **20 个任务** | **~6h** |

---

*文档维护：执行过程中标记任务完成状态。*
