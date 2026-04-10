---
name: fix-formula-amount-calculation
overview: 修复配方奶总量统计异常的 Bug：由于微信小程序 dataset 将数字转为字符串，导致配方奶量在累加和统计时发生字符串拼接而非数字加法，显示为 390120ml 这样的异常值。
todos:
  - id: fix-feeding-popup
    content: 修复 feeding-popup.js 中 selectQuickAmount 方法的类型转换问题
    status: completed
  - id: fix-report-popup
    content: 修复 report-popup.js 中配方奶总量统计的类型转换问题
    status: completed
---

## 用户需求

修复成长报告中配方奶总量显示异常的 Bug（显示 390120ml 而非正常值）

## 产品概述

宝宝护理追踪小程序的成长报告功能，需要正确统计配方奶的摄入总量

## 核心问题

1. 配方奶录入时，快捷用量按钮点击后数值被错误拼接为字符串
2. 报告统计时，字符串类型的奶量被继续拼接而非数值累加

## 修复目标

- 录入时确保奶量为数字类型
- 统计时确保累加操作为数值运算

## 技术栈

- 微信小程序原生开发
- JavaScript

## 实现方案

### 问题根因

微信小程序的 `dataset` 属性在从 WXML 传递到 JS 时，会将数字类型转换为字符串。导致：

```javascript
// 问题代码
const amount = e.currentTarget.dataset.amount;  // "120" (字符串)
const newAmount = this.data.amount + amount;     // 0 + "120" = "0120" (字符串拼接)
```

### 修复方案

**方案选择**：使用 `Number()` 进行类型转换

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| `parseInt()` | 经典方法 | 需要指定基数，小数会被截断 |
| `Number()` | 简洁，保留小数 | 非数字返回 NaN |
| `+` 运算符 | 最简洁 | 可读性差 |


选择 `Number()` 的原因：

1. 奶量可能有小数（如 120.5ml）
2. 代码可读性好
3. 配合 `|| 0` 可处理异常值

### 修复点

**修复点 1：feeding-popup.js 第 137 行**

```javascript
// 修复前
const amount = e.currentTarget.dataset.amount;

// 修复后
const amount = Number(e.currentTarget.dataset.amount) || 0;
```

**修复点 2：report-popup.js 第 251 行**

```javascript
// 修复前
data.feeding.totalAmount += recordData.amount;

// 修复后
data.feeding.totalAmount += Number(recordData.amount) || 0;
```

## 实现注意事项

1. **防御性编程**：使用 `|| 0` 确保 NaN 情况下回退为 0
2. **向后兼容**：修复后的代码能正确处理历史存储的字符串数据
3. **不影响正常数字**：`Number(120)` 仍返回 `120`

## 目录结构

```
miniprogram/components/
├── feeding-popup/
│   └── feeding-popup.js  # [MODIFY] 第 137 行，dataset 获取时转数字
└── report-popup/
    └── report-popup.js   # [MODIFY] 第 251 行，统计累加时转数字
```