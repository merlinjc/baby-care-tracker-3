# 任务拆解 - v4.1.1 存量数据修复 & 体验优化

> 版本：v1.0 | 日期：2026-04-15 | 关联需求：requirements.md v2.0

---

## Phase 1：代码修复（v4.1.1 发布）

### T-1.1：修复 `transferAdmin` 的 `_openid` 遗留 Bug（FR-1.2）
- **文件**: `miniprogram/services/family.js`
- **变更**: 第 551-566 行，`where({ _openid })` → `doc(userId).update()`
- **状态**: ⬜ 待开发
- **工时**: 0.25h

### T-1.2：发现页占位引导卡片 - JS 数据 + 跳转逻辑（FR-3.1, FR-3.2）
- **文件**: `miniprogram/pages/discover/discover.js`
- **变更**: `toolItems` 新增第 4 项占位卡片 + `goToPage` 空 URL 保护
- **状态**: ⬜ 待开发
- **工时**: 0.1h

### T-1.3：发现页占位引导卡片 - WXML 模板（FR-3.3）
- **文件**: `miniprogram/pages/discover/discover.wxml`
- **变更**: tool-item 增加 `isPlaceholder` 条件 class + 副标题「敬请期待」
- **状态**: ⬜ 待开发
- **工时**: 0.1h

### T-1.4：发现页占位引导卡片 - WXSS 样式（FR-3.3）
- **文件**: `miniprogram/pages/discover/discover.wxss`
- **变更**: 新增 `.tool-item--placeholder` 虚线+半透明 + `.tool-subtitle` 样式
- **状态**: ⬜ 待开发
- **工时**: 0.1h

### T-1.5：发现页占位引导卡片 - 图标配置（FR-3.4）
- **文件**: `miniprogram/utils/icon-config.js`
- **变更**: `ICONS.discover` 新增 `more` 图标路径（复用 `plus.png`）
- **状态**: ⬜ 待开发
- **工时**: 0.05h

---

## Phase 2：数据修复脚本（v4.1.1 发布后手动执行）

### T-2.1：云函数 `migrateRecordUserId`（FR-1.1）
- **目录**: `cloudfunctions/migrateRecordUserId/`
- **文件**: `index.js` + `package.json`
- **功能**: 构建 openid→_id 映射表，分批扫描 records，批量迁移 createdBy.userId 和 creatorId
- **状态**: ✅ 已完成
- **工时**: 1.5h

### T-2.2：云函数 `cleanGhostMembers`（FR-2.1）
- **目录**: `cloudfunctions/cleanGhostMembers/`
- **文件**: `index.js` + `package.json`
- **功能**: 遍历 families，检查成员归属，清理幽灵成员，输出清理报告
- **状态**: ✅ 已完成
- **工时**: 1.5h

---

## 任务依赖图

```
T-1.1 (transferAdmin fix)  ──────────┐
T-1.2 (discover JS)  ───┐            │
T-1.3 (discover WXML) ──┤── T-1.5 ──┤── commit Phase 1
T-1.4 (discover WXSS) ──┘            │
                                     │
T-2.1 (migrateRecordUserId) ─────────┤── commit Phase 2
T-2.2 (cleanGhostMembers) ──────────┘
```

## 预计总工时：3.6h
