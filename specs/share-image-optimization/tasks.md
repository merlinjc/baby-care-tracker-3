# 实施计划 - 成长报告分享图优化

> 状态：✅ 已完成（2026-04-03）

## 概述

本文档基于需求文档和设计文档，制定详细的分阶段实施计划。整个优化预计 **4 个阶段，约 2-3 天工作量**。

> **v1.1 更新说明**：基于二次 review 补充了以下遗漏项：
> - 阶段一新增 `_loadImage` 图片加载超时方法
> - 阶段二新增头像绘制超时降级、综合评分绘制（分享图中的评分圆环）
> - 阶段三新增 Canvas style 动态高度、防重复点击、`onPeriodChange` 清除旧图
> - 阶段四新增 `onReady` 中处理分享参数、`showReportPopup` 数据恢复
> - 补充了每个任务的具体代码参考和现有代码行号
> - 补充了需求文档/设计文档的交叉追踪矩阵

---

## 需求追踪矩阵

确保每个 Bug/Feature 都有对应的任务覆盖：

| 需求 ID | 描述 | 覆盖任务 | 状态 |
|---------|------|---------|------|
| **B1** | `drawShareFooter` 未调用 | 2.6, 2.7 | ✅ |
| **B2** | AI 评语高度固定 140px 溢出 | 1.4, 1.5, 2.5 | ✅ |
| **B3** | Canvas DPR 未限制 | 1.3 | ✅ |
| **B4** | `exportCanvas` 未指定压缩参数 | 1.8 | ✅ |
| **B5** | 无体温数据右下角空白 | 2.4 | ✅ |
| **B6** | emoji 在 Android 渲染不稳定 | 2.5 | ✅ |
| **B7** | 分享路径无参数 | 4.1 | ✅ |
| **B8** | 生成失败缓存脏数据 | 3.2 | ✅ |
| **F1** | 无"保存到相册"按钮 | 3.7 | ✅ |
| **F2** | 无分享按钮 | 3.8 | ✅ |
| **F3** | `shareToFriend()` 孤立 | 4.5 | ✅ |
| **F4** | 底部只有一个按钮 | 3.6 | ✅ |
| **F5** | 分享图预览不显眼 | 4.4 | ✅ |
| **F6** | Canvas visibility:hidden 占空间 | 3.14 | ✅ **新增** |
| **C1** | 929 行文件过大 | 2.7, 3.1 | ✅ |
| **C2** | 颜色字号硬编码 | 1.2, 4.6 | ✅ |
| **C3** | hashReportData 路径错误 | 3.4 | ✅ |
| **C4** | 分步 loading 闪烁 | 3.3 | ✅ |
| **C5** | 字体回退不统一 | 1.2 | ✅ |
| **C6** | wrapText 按字符 split | 1.5 | ✅ |
| **FR-2.AC3** | 保存相册权限引导 | 3.12 | ✅ |
| **FR-3.AC2** | 接收者自动打开报告 | 4.2, 4.3 | ✅ |
| **FR-5** | Canvas 高度自适应 | 1.4, 3.14 | ✅ |
| **FR-6.AC2** | 头像加载超时降级 | 1.9 | ✅ **新增** |
| **FR-6.AC3** | 切换周期清除旧图 | 3.5 | ✅ |
| — | 防重复点击生成 | 3.13 | ✅ **新增** |
| — | 综合评分在分享图中绘制 | 2.2 | ✅ **新增** |

---

## 阶段规划

### 📌 阶段一：基础架构搭建
**目标**：创建 Canvas 绘制服务，确保核心绘制能力可用  
**预计耗时**：0.5-1 天  
**优先级**：P0（阻塞后续阶段）

| # | 任务 | 文件 | 详细说明 | 验收标准 | 关联需求 |
|---|------|------|----------|----------|---------|
| 1.1 | 创建 share-canvas.js 文件 | `services/share-canvas.js` | 新建服务文件，导出 `ShareCanvasService` 类。需添加 `module.exports` 以支持 `require()` 导入 | 文件可正常 `require`，无语法错误 | C1 |
| 1.2 | 实现 CANVAS_CONFIG 常量 | `services/share-canvas.js` | 按设计文档定义全部配置常量：**颜色**（COLORS + STAT_COLORS）、**字体**（FONTS 含 family 回退链 `"PingFang SC", "Microsoft YaHei", sans-serif`）、**布局**（LAYOUT）、**导出**（EXPORT_QUALITY: 0.85, EXPORT_TYPE: 'jpg'）。所有现有硬编码值需从 `report-popup.js` 中提取：`#D4A574`、`#3D3427`、`#8B7355`、`#5D4E37`、`#F5F0E8`、`#FFF8F0`、`#FF9F43`、`#5F9FFF`、`#7BC950`、`#FF6B6B`、`rgba(255,255,255,0.6)` | 常量对象完整，包含所有设计 Token；所有颜色值与现有代码一致 | C2, C5 |
| 1.3 | 实现 initCanvas 方法 | `services/share-canvas.js` | DPR 限制为 `Math.min(pixelRatio, 2)`。现有代码（`report-popup.js:530-534`）无限制，直接使用 `dpr = pixelRatio`。新代码接收 `canvas` 对象和 `totalHeight` 参数，设置 `canvas.width = 750 * dpr, canvas.height = totalHeight * dpr`，然后 `ctx.scale(dpr, dpr)` | 3x DPR 设备 canvas 实际为 2x；返回 `{ ctx, dpr, width, height }` | B3 |
| 1.4 | 实现 calculateCanvasHeight 方法 | `services/share-canvas.js` | 动态计算：headerHeight(280) + statCards(160×2+20) + cardGap(20) + aiComment(动态) + footer(100) + cardGap(20)。AI 评语区需要调用 `_calculateTextLines` 获取实际行数，乘以 lineHeight(28) 再加 titleHeight(50) 和 paddingVertical(40)。返回值不低于 `MIN_HEIGHT: 1200`。**注意**：现有代码固定 1340px，新代码需动态计算 | 传入空 aiComment 返回 MIN_HEIGHT；传入 6 段文字返回 > 1400 | B2, FR-5 |
| 1.5 | 实现 _calculateTextLines 方法 | `services/share-canvas.js` | 改进现有 `wrapText`（`report-popup.js:814-831`）。关键改进：① 先按 `\n` 分段（现有代码用 `comments.join('\n\n')` 生成评语）；② 空行保留为 `''`；③ 逐字符 measureText 换行。现有代码 `text.split('')` 不支持 `\n` | 输入含 `\n\n` 的多段文本，正确返回分行数组；空行被保留 | C6 |
| 1.6 | 实现 _drawWrappedText 方法 | `services/share-canvas.js` | 绘制多行文字，空行使用 `lineHeight * 0.5` 间距。返回最终 Y 坐标，供后续绘制使用 | 多段文字正确绘制；返回值可用于定位下一区域 | C6 |
| 1.7 | 实现 _roundRect 方法 | `services/share-canvas.js` | 从 `report-popup.js:856-868` 原样迁移，无需修改。使用 `quadraticCurveTo` 绘制圆角 | 圆角矩形正确绘制 | C1 |
| 1.8 | 实现 exportImage 方法 | `services/share-canvas.js` | 现有代码（`report-popup.js:544-551`）无压缩参数。新代码指定 `destWidth: 750, destHeight: totalHeight, quality: 0.85, fileType: 'jpg'`。返回 Promise\<string\> | 导出图片 < 500KB；格式为 JPG | B4 |
| 1.9 | 实现 _loadImage 方法 (**新增**) | `services/share-canvas.js` | 封装 `wx.getImageInfo` 为 Promise，加入 3 秒超时机制。超时返回 null 而非抛异常。现有头像加载（`report-popup.js:610-618`）无超时处理，网络慢时会卡住 | 正常图片 < 3s 返回 path；超时返回 null；不影响整体流程 | FR-6.AC2 |

**阶段一依赖**：无  
**阶段一风险**：
- Canvas `measureText` 在微信小程序中精度问题 → 预留 10px 安全边距
- `wx.getImageInfo` 对 https 图片的兼容性 → 超时降级方案已覆盖

---

### 📌 阶段二：Canvas 绘制迁移
**目标**：将绘制逻辑完整迁移到新服务  
**预计耗时**：0.5-1 天  
**优先级**：P0

| # | 任务 | 文件 | 详细说明 | 验收标准 | 关联需求 |
|---|------|------|----------|----------|---------|
| 2.1 | 实现 _drawBackground 方法 | `services/share-canvas.js` | 从 `report-popup.js:557-568` 迁移。渐变从 `#F5F0E8` 到 `#FFF8F0`（改用 CANVAS_CONFIG.COLORS）。顶部装饰色块 `#D4A574`，高度 280px。**关键改动**：渐变终点 Y 值从固定 1340 改为动态 `totalHeight` | 背景渐变覆盖整个 Canvas；颜色值来自常量 | C2 |
| 2.2 | 实现 _drawHeader 方法 | `services/share-canvas.js` | 从 `report-popup.js:573-670` 迁移。包含：① 标题"宝宝成长报告"居中(Y:50)；② 日期范围(Y:85)；③ 白色信息卡片(110,110,690,140,r16)；④ 圆形头像(60,140,80×80)带裁剪和失败占位符；⑤ 宝宝名字+月龄(左侧)；⑥ **综合评分**(右侧, bold 48px, `#D4A574`)。使用 `_loadImage` 替代原始 `wx.getImageInfo`，支持超时降级。**注意**：现有代码评分显示在 X:650，需从 `data.overallScore` 读取 | 头像正常/降级均可绘制；评分正确显示；字体统一使用 FONTS.family | FR-6.AC2 |
| 2.3 | 实现 _drawStatCard 方法 | `services/share-canvas.js` | 从 `report-popup.js:723-781` 迁移。通用绘制方法：白色卡片(r16) + 左侧色条(8px宽, r4) + 标题(24px) + 图标(40×40, 使用 `_loadImage`+缓存) + 数值(bold 36px, 右对齐) + 详情(22px, 右对齐)。**关键改动**：icon 参数允许 `null`（用于替代卡片），null 时跳过图标绘制 | 单个卡片绘制完整；icon 为 null 时不报错 | B5 |
| 2.4 | 实现 _drawStatCards 方法 | `services/share-canvas.js` | 从 `report-popup.js:675-718` 迁移。布局：2×2 网格，左侧 X:30，右侧 X:375，宽度 345。第一行：喂养+睡眠；第二行：排便+体温/汇总。**关键改动**：无体温数据时(count===0)绘制"记录汇总"替代卡片，值为 feeding.totalCount + Math.round(sleep.totalMinutes/60) + diaper.totalCount，色值 `STAT_COLORS.summary`(#D4A574) | 有体温时 4 卡完整；无体温时右下角显示"记录汇总" | B5 |
| 2.5 | 实现 _drawAIComment 方法 | `services/share-canvas.js` | 从 `report-popup.js:786-808` 重写。**核心改动**：① 动态起始 Y（统计卡片结束后 + cardGap）；② 标题改为"AI 育儿建议"（去掉💡 emoji）；③ 白色卡片高度动态计算（调用 `_calculateTextLines` 获取行数 → titleHeight + lines×lineHeight + paddingVertical）；④ 调用 `_drawWrappedText` 绘制文字。现有代码固定高度 140px（`report-popup.js:796`）是 B2 的根因 | 多段文字完整显示在卡片内；无 emoji；卡片高度自适应 | B2, B6 |
| 2.6 | 实现 _drawFooter 方法 | `services/share-canvas.js` | 从 `report-popup.js:836-851` 迁移。**关键改动**：Y 坐标从固定 1240 改为 `totalHeight - footerHeight(100)`。深色背景 `#3D3427`，品牌名"Baby Care Tracker"(24px, 白色, 居中)，引导文案"扫码记录宝宝成长点滴"(20px, rgba白0.6)。此方法在现有 steps 数组中被**遗漏**，是 B1 的根因 | 底部正确绘制在 Canvas 最下方；品牌名+引导文案可见 | B1 |
| 2.7 | 实现 draw 主方法 | `services/share-canvas.js` | 新建统一入口 `async draw(ctx, data)`，按顺序调用：`_drawBackground(ctx, totalHeight)` → `_drawHeader(ctx, data)` → `_drawStatCards(ctx, data.reportData, startY)` → `_drawAIComment(ctx, data.aiComment, commentStartY)` → `_drawFooter(ctx, totalHeight)`。**注意**：需要精确传递各区域的起始 Y 坐标，形成"瀑布流"式布局 | 完整分享图生成无报错；所有区域按顺序无重叠 | B1, C1 |
| 2.8 | 集成测试：在 report-popup.js 中引入服务 | `report-popup.js` | 在文件顶部添加 `const ShareCanvasService = require('../../services/share-canvas');`。暂不修改 `generateShareImage`，仅验证 import 无报错 | `require` 成功，无运行时错误 | — |

**阶段二依赖**：阶段一完成  
**阶段二风险**：
- 绘制顺序和坐标计算错误 → 每完成一个绘制方法单独测试输出
- 图标缓存 `imageCache` 需从组件传入服务 → `draw(ctx, data)` 的 `data` 包含 `imageCache`

---

### 📌 阶段三：组件逻辑优化
**目标**：修复组件层面的 Bug，完善功能闭环  
**预计耗时**：0.5-1 天  
**优先级**：P0

| # | 任务 | 文件 | 详细说明 | 验收标准 | 关联需求 |
|---|------|------|----------|----------|---------|
| 3.1 | 重写 generateShareImage 方法 | `report-popup.js` | 替换现有 `report-popup.js:454-511` 的 steps 循环模式。新流程：① 检查缓存(hash+文件存在性)；② `wx.showLoading({ mask: true })` 一次；③ `new ShareCanvasService()`；④ 计算高度 → initCanvas → draw → exportImage；⑤ setData + triggerEvent；⑥ catch 中清除缓存。**新增**：缓存命中时用 `wx.getFileInfo` 验证 temp 文件是否存在（微信清理缓存后 path 失效） | 使用新服务生成完整分享图；单次 loading 无闪烁 | B8, C4 |
| 3.2 | 修复错误时清除缓存 | `report-popup.js` | 在 catch 块中 `setData({ lastReportHash: '', shareImagePath: '' })`。现有代码（`report-popup.js:506-510`）catch 中只 log 和 toast，**未清除** lastReportHash | 生成失败后再次点击不会命中缓存 | B8 |
| 3.3 | 移除分步 loading，改为统一 loading | `report-popup.js` | 删除 steps 循环中的多次 `wx.showLoading`。改为进入 `generateShareImage` 时显示一次 `wx.showLoading({ title: '生成分享图中...', mask: true })`，完成/失败时 `wx.hideLoading()` 一次 | 生成过程中 loading 文字不闪烁 | C4 |
| 3.4 | 修复 hashReportData 数据路径 | `report-popup.js` | 现有代码（`report-popup.js:126`）`const { feeding, sleep, diaper, temperature, aiComment } = this.data.reportData;` — 但 `aiComment` 存在于 `this.data.aiComment`（`report-popup.js:33`），不在 `reportData` 对象中！因此 `aiComment` 始终解构为 `undefined`。修复：改为 `const { aiComment } = this.data; const { feeding, sleep, diaper, temperature } = this.data.reportData;` | 哈希值包含真实的 aiComment 前 50 字符 | C3 |
| 3.5 | 切换周期时清除旧分享图 | `report-popup.js` | 在 `onPeriodChange`（`report-popup.js:143-147`）中添加 `this.setData({ shareImagePath: '', lastReportHash: '' })`。现有 `loadReport()`（`report-popup.js:192`）已有 `shareImagePath: ''`，但 **lastReportHash 未清除**，可能导致切换后旧缓存干扰 | 切换周报/月报后底部恢复为"生成分享图"按钮；旧哈希清除 | FR-6.AC3 |
| 3.6 | 修改底部操作区 WXML：状态切换 | `report-popup.wxml` | 替换现有 `report-popup.wxml:170-175` 的单按钮结构。使用 `wx:if="{{!shareImagePath}}"` 和 `wx:else` 控制两种状态。未生成时显示 1 个按钮；已生成时显示 3 个按钮并排 | 两种状态正确切换显示 | F1, F2, F4 |
| 3.7 | 添加"保存到相册"按钮 | `report-popup.wxml` | 在已生成状态中添加 `<view class="action-btn secondary" bindtap="saveToAlbum">`。图标路径 `/images/icons/download.png`（需确认存在，如不存在可使用其他替代图标）| 按钮显示，点击触发 saveToAlbum | F1 |
| 3.8 | 添加"分享给好友"按钮 | `report-popup.wxml` | 在已生成状态中添加 `<button class="action-btn tertiary share-button" open-type="share">`。**注意**：微信 button 有默认样式（边框、背景），需在 WXSS 中重置 | 按钮显示，点击触发微信原生分享 | F2 |
| 3.9 | 添加"重新生成"按钮 | `report-popup.wxml` | 在已生成状态中添加 `<view class="action-btn secondary" bindtap="regenerateShareImage">`。图标路径 `/images/icons/refresh.png`（需确认） | 按钮显示，点击触发重新生成 | F4 |
| 3.10 | 修改底部操作区样式 | `report-popup.wxss` | 现有 `.popup-footer` 已有 `display: flex; gap: 24rpx;`，可复用。需新增：① `.share-button` 重置 button 默认样式（`background: none; border: none; line-height: inherit; padding: 0; margin: 0; &::after { border: none; }`）；② 确保三按钮等宽排列（`.action-btn { flex: 1; }`，已有）| 三个按钮等宽并排；button 无默认边框 | F4 |
| 3.11 | 实现 regenerateShareImage 方法 | `report-popup.js` | 新增方法：`regenerateShareImage() { this.setData({ shareImagePath: '', lastReportHash: '' }); this.generateShareImage(); }` | 清除缓存后重新生成 | F4 |
| 3.12 | 优化 saveToAlbum 错误处理 | `report-popup.js` | 现有代码（`report-popup.js:892-918`）已有基本处理，但 `error.errMsg.includes('auth deny')` 可能不够完整。应同时检查 `auth denied` 和 `authorize no response`。另外，如果 `shareImagePath` 为空时应先生成，现有逻辑已覆盖 | 权限拒绝 → 引导设置；其他错误 → 提示失败 | FR-2.AC4 |
| 3.13 | 添加防重复点击 (**新增**) | `report-popup.js` | 在 `generateShareImage` 方法入口添加 `if (this._isGenerating) return; this._isGenerating = true;`，在 finally 块中 `this._isGenerating = false;`。现有代码无防重复机制 | 快速双击只触发一次生成 | 测试场景 T13 |
| 3.14 | Canvas style 动态高度 (**新增**) | `report-popup.wxml` + `report-popup.wxss` | 现有 WXML（`report-popup.wxml:182`）Canvas style 固定 `height: 1340px`，WXSS（`report-popup.wxss:414`）也固定 `height: 1340px`。改为在 `generateShareImage` 中计算高度后 `setData({ canvasHeight })` 动态设置。WXML 改为 `style="width: 750px; height: {{canvasHeight || 1340}}px;"`。**同时**将 Canvas 布局改为更好的离屏方案：从 `visibility: hidden; z-index: -1;` 改为 `position: fixed; left: -9999px; top: 0;` 以避免占用页面空间 | Canvas 高度随内容变化；不占用可视空间 | F6, FR-5 |

**阶段三依赖**：阶段二完成  
**阶段三风险**：
- `<button open-type="share">` 在组件中触发的是组件的事件，需确认是否冒泡到页面 `onShareAppMessage`
- Canvas 动态尺寸修改后需确保 `createSelectorQuery` 能正确获取新尺寸

**关键实现细节（3.1 generateShareImage）**：

```javascript
// 核心伪代码
async generateShareImage() {
  if (this._isGenerating) return;  // 3.13: 防重复
  this._isGenerating = true;

  try {
    // 缓存检查 + 文件存在性验证
    const currentHash = this.hashReportData();
    if (this.data.lastReportHash === currentHash && this.data.shareImagePath) {
      try {
        await promisify(wx.getFileInfo)({ filePath: this.data.shareImagePath });
        wx.showToast({ title: '分享图已生成', icon: 'success' });
        return;
      } catch (e) { /* 文件不存在，继续生成 */ }
    }

    wx.showLoading({ title: '生成分享图中...', mask: true });  // 3.3: 统一 loading

    const shareCanvas = new ShareCanvasService();
    const { canvas, ctx } = await this.initCanvas();

    const data = {
      reportData: this.data.reportData,
      babyInfo: this.data.babyInfo,
      reportPeriod: this.data.reportPeriod,
      overallScore: this.data.overallScore,
      aiComment: this.data.aiComment,       // 注意：从 this.data 顶层读取
      imageCache: this.imageCache
    };

    const totalHeight = shareCanvas.calculateCanvasHeight(data.reportData, data.aiComment, ctx);

    // 3.14: 动态更新 Canvas 高度
    this.setData({ canvasHeight: totalHeight });
    
    // 需要 nextTick 等 WXML 更新后重新获取 canvas
    await new Promise(r => setTimeout(r, 100));
    const { canvas: updatedCanvas, ctx: updatedCtx } = await this.initCanvas();
    shareCanvas.initCanvas(updatedCanvas, totalHeight);

    await shareCanvas.draw(updatedCtx, data);
    const imagePath = await shareCanvas.exportImage(updatedCanvas, totalHeight);

    this.setData({ shareImagePath: imagePath, lastReportHash: currentHash });
    this.triggerEvent('shareready', { imagePath, babyName: data.babyInfo?.name || '宝宝' });

    wx.hideLoading();
    wx.showToast({ title: '生成成功', icon: 'success' });

  } catch (error) {
    console.error('生成分享图失败:', error);
    wx.hideLoading();
    this.setData({ lastReportHash: '', shareImagePath: '' });  // 3.2: 清除缓存
    wx.showToast({ title: '生成失败，请重试', icon: 'error' });
  } finally {
    this._isGenerating = false;  // 3.13: 释放锁
  }
}
```

---

### 📌 阶段四：分享链路优化
**目标**：完善分享路径和接收体验  
**预计耗时**：0.5 天  
**优先级**：P1

| # | 任务 | 文件 | 详细说明 | 验收标准 | 关联需求 |
|---|------|------|----------|----------|---------|
| 4.1 | 修改 onShareAppMessage | `record.js` | 现有代码（`record.js:822-830`）路径固定为 `/pages/home/home`。修改为：`path: '/pages/record/record?showReport=1&period=${period}'`。获取 period：`const reportPopup = this.selectComponent('#reportPopup'); const period = reportPopup?.data?.currentPeriod || 'week';` | 分享卡片路径包含 showReport 和 period 参数 | B7 |
| 4.2 | 修改 onLoad 处理分享参数 | `record.js` | 在现有 `onLoad`（`record.js:75-84`）中添加分享参数处理：`if (options.showReport === '1') { this._showReportOnReady = true; this._reportPeriod = options.period || 'week'; }`。放在已有的 `TYPE_TO_FILTER_INDEX` 判断之前 | 从分享链接进入时参数被正确解析保存 | FR-3.AC2 |
| 4.3 | 添加自动打开报告弹窗 | `record.js` | 在 `init()` 或 `onReady` 中检查 `this._showReportOnReady`，延迟 500ms 后调用 `this.setData({ showReportPopup: true })`。**注意**：需在数据加载完成后再打开弹窗，否则弹窗内无数据。建议在 `loadData` 的回调末尾判断：`if (this._showReportOnReady) { this._showReportOnReady = false; setTimeout(() => this.setData({ showReportPopup: true }), 500); }` | 从分享链接打开后自动显示报告弹窗 | FR-3.AC2 |
| 4.4 | 优化分享图预览滚动 | `report-popup.js` + `report-popup.wxml` | 在 WXML 的 `scroll-view` 添加 `scroll-into-view="{{scrollTarget}}"`，在分享预览区域添加 `id="sharePreview"`。生成成功后 `setData({ scrollTarget: 'sharePreview' })` 触发滚动。**注意**：需要延迟设置，确保 image 已渲染 | 生成成功后自动滚动到预览区域 | F5 |
| 4.5 | 清理 shareToFriend 孤立代码 | `report-popup.js` | 删除 `report-popup.js:874-887` 的 `shareToFriend` 方法。其功能已被 `<button open-type="share">` + 页面 `onShareAppMessage` 替代。保留方法注释说明改动原因 | 无孤立未使用方法 | F3 |
| 4.6 | 整理残留颜色硬编码 | `report-popup.js` | 删除现有绘制方法后（已迁移到 service），确认组件中无残留硬编码颜色值。如有遗漏的非绘制场景使用，改为引用 `ShareCanvasService.CANVAS_CONFIG` 或提取为局部常量 | grep 文件无散落的 #D4A574 等十六进制颜色值 | C2 |
| 4.7 | 删除迁移后的旧绘制方法 (**新增**) | `report-popup.js` | 删除以下已迁移到 service 的方法：`drawShareBackground`(`557-568`)、`drawShareHeader`(`573-670`)、`drawShareStats`(`675-718`)、`drawStatCard`(`723-781`)、`drawShareAIComment`(`786-808`)、`wrapText`(`814-831`)、`drawShareFooter`(`836-851`)、`roundRect`(`856-868`)。保留 `initCanvas`（仍被组件使用）和 `exportCanvas`（可删除，已被 service 替代）| 组件文件行数降至 ~550 行；无重复绘制方法 | C1 |
| 4.8 | 确认图标资源存在 (**新增**) | 图标文件 | 确认以下图标文件存在：`/images/icons/download.png`（保存按钮）、`/images/icons/share.png`（分享按钮）、`/images/icons/refresh.png`（重新生成按钮）。如不存在需创建或替换为已有图标 | 所有底部按钮图标正确加载显示 | F1, F2 |

**阶段四依赖**：阶段三完成  
**阶段四风险**：
- 页面生命周期和组件生命周期协调 → `showReportOnReady` 需在 loadData 完成后触发
- 删除旧方法时误删仍在使用的代码 → 逐个删除，每删一个验证无报错

---

## 任务总览

### 按优先级分组

**P0 - 阻塞性（必须完成）— 33 个任务**
- 1.1 ~ 1.9：Canvas 服务基础架构（9 个）
- 2.1 ~ 2.8：Canvas 绘制迁移（8 个）
- 3.1 ~ 3.14：组件逻辑修复 + 底部操作区完善（14 个）

**P1 - 重要（应该完成）— 4 个任务**
- 4.1 ~ 4.3：分享路径带参（3 个）
- 4.4：预览滚动优化（1 个）

**P2 - 优化（可以延后）— 4 个任务**
- 4.5：清理孤立代码
- 4.6：整理硬编码
- 4.7：删除旧绘制方法
- 4.8：确认图标资源

### 按文件分组

| 文件 | 任务数 | 阶段 | 变更类型 |
|------|--------|------|----------|
| `services/share-canvas.js` | 17 | 一、二 | **新建** |
| `components/report-popup/report-popup.js` | 12 | 三、四 | 修改 |
| `components/report-popup/report-popup.wxml` | 5 | 三、四 | 修改 |
| `components/report-popup/report-popup.wxss` | 2 | 三 | 修改 |
| `pages/record/record.js` | 3 | 四 | 修改 |
| 图标资源文件 | 1 | 四 | 确认/新增 |

**总任务数**：41 个（较 v1.0 增加 7 个）

---

## 依赖关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                     阶段一：基础架构 (9 个任务)                     │
│  CANVAS_CONFIG → initCanvas → calculateCanvasHeight              │
│  → _calculateTextLines → _drawWrappedText → _roundRect           │
│  → exportImage → _loadImage (新增)                               │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     阶段二：绘制迁移 (8 个任务)                     │
│  Background → Header(含评分+头像降级) → StatCards(含替代卡片)     │
│  → AIComment(动态高度) → Footer → draw 主方法 → 集成测试          │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     阶段三：组件优化 (14 个任务)                    │
│  generateShareImage 重写 → 缓存修复 → 统一loading → hash修复     │
│  → 周期切换清除 → WXML状态切换(保存/分享/重生成) → 样式调整       │
│  → regenerate方法 → saveToAlbum优化 → 防重复点击 → Canvas动态高度  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     阶段四：分享链路 (10 个任务)                    │
│  onShareAppMessage路径 → onLoad参数 → 自动打开弹窗 → 预览滚动    │
│  → 清理孤立代码 → 整理硬编码 → 删除旧方法 → 确认图标资源          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 风险与应对

| # | 风险 | 可能性 | 影响 | 应对策略 |
|---|------|--------|------|----------|
| R1 | Canvas 在 3x DPR 设备上内存溢出 | 中 | 高 | 严格限制 DPR=2，测试 iPhone 13/14；Canvas 最大 1500×3000px |
| R2 | 文字换行计算不准确 | 中 | 中 | measureText 后预留 10px 安全边距；多设备测试 |
| R3 | 头像图片加载超时 | 中 | 中 | 3s 超时降级为名字首字母占位（任务 1.9） |
| R4 | 分享参数解析失败 | 低 | 低 | 添加参数合法性校验，默认 period='week' |
| R5 | 动态 Canvas 高度 setData 后 query 获取旧值 | 中 | 高 | setTimeout 100ms 等待 WXML 更新后再 query（任务 3.14 伪代码） |
| R6 | `<button open-type="share">` 在组件中不触发页面 onShareAppMessage | 低 | 高 | 实测确认；备选方案：组件 triggerEvent 通知页面 |
| R7 | 删除旧方法时误删仍在使用的代码 | 中 | 高 | 逐个删除，每删一个验证无报错（任务 4.7） |
| R8 | 保存/分享/重新生成按钮图标不存在 | 中 | 低 | 提前检查（任务 4.8），不存在时用 text 替代 |

---

## 测试清单

### 阶段一测试
- [ ] `share-canvas.js` 能被正常 `require`
- [ ] `CANVAS_CONFIG.COLORS.headerBg` 返回 `#D4A574`
- [ ] `initCanvas` 在 3x DPR 设备上返回 dpr=2
- [ ] `calculateCanvasHeight` 空评语返回 >= 1200
- [ ] `calculateCanvasHeight` 6 段评语返回 > 1400
- [ ] `_calculateTextLines` 正确处理 `\n\n` 分段
- [ ] `_loadImage` 3s 超时返回 null 不抛异常

### 阶段二测试
- [ ] 完整绘制流程无报错
- [ ] 导出图片大小 < 500KB（iPhone 3x DPR 设备）
- [ ] AI 评语 4 段时完整显示在白色卡片内
- [ ] 无体温数据时右下角显示"记录汇总"卡片
- [ ] Footer 正确显示品牌名和引导文案
- [ ] AI 评语标题无 emoji
- [ ] 头像 URL 失效时显示名字首字母占位符

### 阶段三测试
- [ ] 未生成时只显示"生成分享图"按钮
- [ ] 生成后显示"保存 / 分享 / 重新生成"三个按钮
- [ ] 保存相册功能正常，权限拒绝时引导设置
- [ ] 分享按钮触发微信原生分享
- [ ] 重新生成按钮清除缓存后重新生成
- [ ] 生成失败后缓存已清除，再次点击可正常生成
- [ ] 快速双击只触发一次生成
- [ ] 切换周报/月报后底部恢复为"生成分享图"
- [ ] Canvas 高度随内容动态变化
- [ ] Canvas 不可见区域不占用页面空间

### 阶段四测试
- [ ] 分享卡片路径带 `showReport=1&period=week` 参数
- [ ] 从分享链接打开自动显示报告弹窗
- [ ] 生成成功后自动滚动到预览区域
- [ ] 无孤立 `shareToFriend` 方法
- [ ] 组件文件无残留硬编码颜色值
- [ ] 旧绘制方法全部删除，文件行数 ~550
- [ ] 底部按钮图标全部正确显示

### 跨阶段回归测试
- [ ] 完整流程：打开弹窗 → 查看报告 → 生成分享图 → 保存 → 分享
- [ ] 弹窗关闭后再次打开，状态正确
- [ ] 不同宝宝切换后分享图重新生成
- [ ] 真机 iOS + Android 各测试一轮

---

## 实施建议

### 推荐的开发顺序

1. **阶段一、二连续开发**：Canvas 服务是一个完整的模块，建议一次写完
2. **阶段三逐任务验证**：每修改一处 WXML/JS 即在开发者工具预览
3. **阶段四可部分并行**：4.1-4.3（分享路径）和 4.5-4.7（代码清理）相互独立
4. **真机测试穿插进行**：阶段二完成后即做首轮真机测试

### 代码提交建议

```bash
# 阶段一+二提交（服务文件完整）
git add miniprogram/services/share-canvas.js
git commit -m "feat(share): 创建 Canvas 绘制服务，支持动态高度和图片压缩"

# 阶段三提交（组件修改）
git add miniprogram/components/report-popup/
git commit -m "feat(share): 完善底部操作区，修复缓存安全和防重复点击"

# 阶段四提交（分享链路+代码清理）
git add miniprogram/pages/record/record.js
git add miniprogram/components/report-popup/report-popup.js
git commit -m "feat(share): 分享路径带参，清理迁移后旧代码"
```

---

## 后续优化（可选）

以下优化可在主要功能稳定后进行：

1. **图片懒加载**：头像和图标延迟加载（当前已有 preloadImages）
2. **绘制进度显示**：长文本绘制时显示进度条（当前用 mask loading 足够）
3. **分享图模板选择**：提供多种风格模板（配色/布局可选）
4. **服务端生成**：云端 Canvas 生成分享图，减少客户端内存压力
5. **分享图缓存持久化**：将 tempFilePath 复制到用户文件系统，避免微信清缓存失效

---

*文档版本：v1.1*  
*创建日期：2026-04-03*  
*更新日期：2026-04-03*  
*关联文档：*
- `specs/share-image-optimization/requirements.md`
- `specs/share-image-optimization/design.md`
