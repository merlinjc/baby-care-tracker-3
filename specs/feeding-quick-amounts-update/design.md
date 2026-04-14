# 设计文档 - 配方奶快捷用量调整（Feeding Quick Amounts Update）

> 版本：v1.0 | 日期：2026-04-13 | 状态：已确认

## 一、架构概览

无架构变更，仅调整数据配置。

## 二、数据变更

### 2.1 `quickAmounts` 数组

**变更前：**
```javascript
quickAmounts: [30, 60, 90, 120, 150, 180, 210, 240]
```

**变更后：**
```javascript
quickAmounts: [10, 30, 60, 90, 120, 150, 180, 210]
```

### 2.2 布局影响

按钮数量不变（8 个），CSS `min-width: calc(25% - var(--spacing-sm))` 4 列布局不受影响。

## 三、文件变更清单

| 文件路径 | 改动类型 | 主要变更说明 |
|----------|----------|-------------|
| `miniprogram/components/feeding-popup/feeding-popup.js` | 小改 | 修改 quickAmounts 数组 |

## 四、关键设计决策

### 决策 1：移除 240ml 而非其他大值
- 方案A（选定）：移除 240ml，保留 210ml 作为最大快捷值
- 理由：240ml 使用频率低，且超过 210ml 的场景可通过累加实现；新增 10ml 满足少量补喂需求
