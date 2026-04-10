# 需求文档 - 成长报告分享图优化

## 概述

成长报告分享图功能是 Baby Care Tracker 小程序的核心分享功能，允许用户将宝宝的周报/月报以精美图片形式分享给家人好友。当前实现存在 Canvas 绘制缺陷、用户体验不完整、性能隐患等问题。本次优化旨在修复现有 Bug、完善功能闭环、提升图片质量和分享体验。

## 三轮深度 Review 发现

### 🔴 第一轮 Review —— 功能缺陷与 Bug

| # | 严重度 | 问题 | 位置 | 说明 |
|---|--------|------|------|------|
| B1 | 🔴 高 | `drawShareFooter` 已定义但未调用 | `report-popup.js:463-469` steps 数组缺少 footer 步骤 | 分享图底部完全空白，缺少品牌标识和引导文案 |
| B2 | 🔴 高 | AI 评语区高度固定 140px，内容溢出 | `report-popup.js:796` | AI 评语通常 2-4 段，总文字量远超 140px 容纳范围，文字溢出白色卡片背景造成视觉破损 |
| B3 | 🔴 高 | Canvas DPR 未限制，3x 设备生成巨大图片 | `report-popup.js:530-534` | 3x DPR 设备 canvas 实际为 2250×4020px，导出图片 4-8MB，低端机容易 OOM |
| B4 | 🟡 中 | `exportCanvas` 未指定 `destWidth/destHeight/quality` | `report-popup.js:544-552` | 默认导出全尺寸无压缩 PNG，文件过大影响分享速度 |
| B5 | 🟡 中 | 无体温数据时右下角卡片区域空白 | `report-popup.js:709-717` | 布局不协调，视觉上缺少一角 |
| B6 | 🟡 中 | emoji `💡` 在 Android Canvas 中渲染不稳定 | `report-popup.js:803` | 部分 Android 设备显示为方块或空白 |
| B7 | 🟡 中 | 分享路径固定 `/pages/home/home`，无参数 | `record.js:827` | 接收者无法直接查看报告 |
| B8 | 🟡 中 | 生成失败后 `lastReportHash` 可能缓存脏数据 | `report-popup.js:506-510` | catch 块未清除哈希，下次点击可能跳过重新生成 |

### 🟡 第二轮 Review —— 功能缺失与 PRD 差距

| # | 严重度 | 问题 | 说明 |
|---|--------|------|------|
| F1 | 🔴 高 | PRD 要求"保存到相册"按钮，但 WXML 中无此按钮 | `saveToAlbum()` 方法存在于 JS 中，但 WXML 未绑定任何按钮 |
| F2 | 🔴 高 | PRD 要求"分享给微信好友"，但组件中无分享按钮 | 注释写"已改用 button open-type=share"，但实际 WXML 无此 button |
| F3 | 🟡 中 | `shareToFriend()` 方法孤立，无任何调用入口 | `report-popup.js:874-887`，方法完整但从未被调用 |
| F4 | 🟡 中 | 底部操作区只有一个"生成分享图"按钮 | 生成后用户无明确的后续操作引导（保存/分享） |
| F5 | 🟢 低 | 分享图预览放在 scroll-view 底部，容易被忽略 | `report-popup.wxml:163-166` |
| F6 | 🟢 低 | Canvas 使用 visibility:hidden 仍占据页面空间 | `report-popup.wxss:409-417`，应使用离屏方案 |

### 🔵 第三轮 Review —— 代码质量与可维护性

| # | 类型 | 问题 | 说明 |
|---|------|------|------|
| C1 | 复杂度 | `report-popup.js` 达 929 行，Canvas 绘制占 ~400 行 | 绘制逻辑与组件业务逻辑耦合，难以维护和复用 |
| C2 | 硬编码 | 颜色、字号、坐标全部硬编码 | `#D4A574`、`#3D3427`、`750`、`1340` 等散布在方法中，设计稿调整成本高 |
| C3 | 缓存Hash | `hashReportData()` 取 `aiComment` 但从 `this.data.reportData` 读取 | `aiComment` 实际存在于 `this.data` 顶层，非 `reportData` 内部，哈希计算可能不准确 |
| C4 | 重复Loading | 分步骤反复调用 `wx.showLoading`，体验闪烁 | 每步都 show/hide，用户看到 loading 文字快速闪烁 |
| C5 | 字体回退 | 部分绘制使用 `PingFang SC`，部分使用完整 fallback 链 | 不统一，可能导致不同区域文字风格不一致 |
| C6 | 时间计算 | `wrapText` 按字符 split，对英文单词和标点处理不友好 | `text.split('')` 逐字拆分，可能在英文单词中间换行 |

## 用户角色

- **宝宝照护者（主用户）**：记录宝宝日常数据，生成报告并分享给家人
- **分享接收者**：通过微信收到分享卡片，可打开小程序查看详情
- **家庭成员**：同一家庭组内的其他照护者，查看共享报告

## 功能需求

### FR-1: 修复 Canvas 绘制缺陷（高优先级）

**用户故事：** 作为宝宝照护者，我想要生成完整且美观的分享图，以便在朋友圈/家庭群中分享

**验收标准：**
1. When 用户点击"生成分享图", the system shall 在所有步骤中包含底部 Footer 的绘制（品牌名 + 引导文案）
2. When AI 评语包含多段内容（2-4 段）, the system shall 动态计算评语区域高度，确保文字完整显示在白色卡片内部
3. When 在 3x DPR 设备上生成分享图, the system shall 限制 Canvas DPR 为 2，避免生成超大尺寸图片
4. When 导出 Canvas 图片, the system shall 指定 `destWidth: 750, destHeight: 动态高度, quality: 0.85, fileType: 'jpg'`，确保输出文件 300-500KB
5. When 宝宝无体温数据, the system shall 在右下角绘制替代内容（如"总记录数"汇总卡片），而非留白
6. When 绘制 AI 评语标题, the system shall 使用文字 "AI 育儿建议"（无 emoji），避免 Android 设备渲染异常

### FR-2: 完善底部操作区（高优先级）

**用户故事：** 作为宝宝照护者，我想要在生成分享图后直接看到保存和分享选项，以便快速操作

**验收标准：**
1. When 分享图尚未生成, the system shall 在底部显示一个"生成分享图"按钮
2. When 分享图已生成, the system shall 将底部操作区变为三个按钮：
   - "保存到相册"按钮，绑定 `saveToAlbum()` 方法
   - "分享给好友"按钮，使用 `<button open-type="share">` 原生分享
   - "重新生成"按钮，重新触发 `generateShareImage()`
3. When 用户点击"保存到相册", the system shall 调用 `wx.saveImageToPhotosAlbum`，成功后提示"保存成功"
4. If 保存相册权限被拒, then the system shall 弹出提示并引导用户前往设置页开启权限

### FR-3: 优化分享路径参数（中优先级）

**用户故事：** 作为分享接收者，我想要点开分享卡片后直接看到对应的报告，以便快速了解宝宝状况

**验收标准：**
1. When 生成微信分享卡片, the system shall 携带 `babyId` 和 `period` 参数，路径为 `/pages/record/record?showReport=1&period=week`
2. When 接收者打开带 `showReport=1` 参数的页面, the system shall 自动打开成长报告弹窗

### FR-4: 优化分享图预览体验（中优先级）

**用户故事：** 作为宝宝照护者，我想要在生成分享图后清晰地看到预览效果，以便确认分享内容

**验收标准：**
1. When 分享图生成成功, the system shall 自动滚动到预览区域，确保用户可以看到生成结果
2. While 预览图片展示中, the system shall 支持长按保存功能（`show-menu-by-longpress`，已实现）
3. When 生成过程中, the system shall 显示一个统一的 loading 状态（mask: true），而非多次闪烁的分步提示

### FR-5: Canvas 画布高度自适应（高优先级）

**用户故事：** 作为宝宝照护者，我想要分享图完整展示所有内容，不因内容多少而出现截断或空白

**验收标准：**
1. When AI 评语内容较多（3-4 段）, the system shall 自动增加 Canvas 高度，确保 Footer 始终在内容下方
2. When AI 评语内容较少（1 段）, the system shall 适当缩小 Canvas 高度，避免底部大片空白
3. When Canvas 高度动态变化, the system shall 同步更新 `exportCanvas` 中的 `destHeight` 参数

### FR-6: 错误处理与缓存安全（中优先级）

**用户故事：** 作为宝宝照护者，我想要在生成失败后可以正常重试，以便最终成功获取分享图

**验收标准：**
1. If 分享图生成过程中任意步骤失败, then the system shall 清除 `lastReportHash`，避免缓存半成品图片路径
2. If 头像加载超时（>3s）, then the system shall 使用占位符继续绘制，而非中断整个流程
3. When 用户在报告弹窗中切换周报/月报, the system shall 清除之前的分享图路径，避免展示旧的预览图

## 非功能需求

### NFR-1: 性能要求
- 分享图生成时间：< 3 秒（中端机型如 iPhone SE 2）
- 导出图片文件大小：< 500KB（JPEG 格式, quality: 0.85）
- Canvas 内存占用：不超过 50MB（限制 DPR 为 2，canvas 尺寸不超过 1500×3000px）

### NFR-2: 兼容性要求
- 支持 iOS 12+ 和 Android 7.0+ 设备
- Canvas 文字渲染避免使用 emoji，确保所有设备一致
- 字体回退链统一使用 `"PingFang SC", "Microsoft YaHei", sans-serif`

### NFR-3: 代码质量要求
- Canvas 绘制逻辑抽离为独立服务模块 `services/share-canvas.js`
- 绘制配置（颜色、字号、坐标）集中管理为常量对象
- 移除未使用的孤立代码（`shareToFriend` 方法或将其正确绑定）

## 边界条件和异常处理

| 场景 | 处理方式 |
|------|---------|
| 宝宝无任何记录 | 显示"暂无数据"提示，禁用生成按钮 |
| 宝宝头像 URL 失效 | 使用名字首字母占位符（已实现） |
| 图标图片加载失败 | 使用纯色圆形占位符（已实现） |
| Canvas 初始化失败 | Toast 提示"生成失败"，允许重试 |
| 用户在生成过程中切换报告周期 | 取消当前生成任务，以新周期重新生成 |
| 用户在生成过程中关闭弹窗 | 中断生成流程，释放 Canvas 资源 |
| `canvasToTempFilePath` 失败 | 清除缓存哈希，提示重试 |
| 保存相册权限拒绝 | 弹窗引导前往设置页开启（已实现） |
| 分享图 tempFilePath 在微信缓存清理后失效 | 重新生成（哈希匹配但文件不存在时重新生成） |

---

*文档版本：v1.0*  
*创建日期：2026-04-03*  
*基于：三轮代码深度 Review*
