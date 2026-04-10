/**
 * 分享图 Canvas 绘制服务
 * 
 * 将分享图生成逻辑从 report-popup 组件中抽离，提供独立的绘制能力。
 * 
 * 主要改进：
 * - DPR 限制为 2，避免 3x 设备生成过大图片
 * - 动态计算 Canvas 高度，适应不同长度的 AI 评语
 * - 图片导出指定压缩参数，控制文件大小
 * - 统一配置常量，便于维护
 * 
 * @version 1.0.0
 * @date 2026-04-03
 */

// ============================================================
// 配置常量
// ============================================================

const ReportHelper = require('./reportDataHelper');

const CANVAS_CONFIG = {
  // 基础尺寸（逻辑像素）
  WIDTH: 750,
  MIN_HEIGHT: 1200,
  MAX_DPR: 2,

  // 导出配置
  EXPORT_QUALITY: 0.85,
  EXPORT_TYPE: 'jpg',

  // 颜色体系（美拉德色系 + V2 扩展）
  COLORS: {
    bgGradientTop: '#F5F0E8',
    bgGradientBottom: '#FFF8F0',
    headerBg: '#D4A574',
    cardBg: '#FFFFFF',
    footerBg: '#3D3427',
    textPrimary: '#3D3427',
    textSecondary: '#8B7355',
    textTertiary: '#5D4E37',
    accent: '#D4A574',
    white: '#FFFFFF',
    whiteTranslucent: 'rgba(255,255,255,0.6)',
    // V2: 评分等级色
    scoreExcellent: '#7BC950',    // 90-100
    scoreGood: '#5ABFB0',         // 80-89
    scoreFair: '#D4883D',         // 70-79
    scorePoor: '#E8745A',         // 60-69
    scoreCritical: '#E85454',     // <60
    // V2: 状态标签色
    statusNormal: '#7BC950',
    statusNormalBg: 'rgba(123,201,80,0.15)',
    statusWarning: '#D4883D',
    statusWarningBg: 'rgba(212,136,61,0.15)',
    statusDanger: '#E85454',
    statusDangerBg: 'rgba(232,84,84,0.15)',
    statusMuted: '#999999',
    statusMutedBg: 'rgba(153,153,153,0.15)',
    // V2: 范围条色
    rangeBarBg: 'rgba(212,165,116,0.12)',
    rangeBarNormal: 'rgba(123,201,80,0.3)',
    // V2: 密度条色
    densityEmpty: '#E8E0D8',
    densityLight: '#D4B896',
    densityMedium: '#C49A6C',
    densityDark: '#A0785A',
    densityDeep: '#8B6B4E',
    // V2: 成就色
    achievementBg: 'rgba(212,165,116,0.08)',
  },

  // 卡片颜色
  STAT_COLORS: {
    feeding: '#FF9F43',
    sleep: '#5F9FFF',
    diaper: '#7BC950',
    temperature: '#FF6B6B',
    summary: '#D4A574',
  },

  // 字体配置（含 V2 扩展）
  FONTS: {
    family: '"PingFang SC", "Microsoft YaHei", sans-serif',
    titleLarge: 'bold 36px',
    titleMedium: 'bold 32px',
    titleSmall: 'bold 24px',
    bodyLarge: '24px',
    bodyMedium: '22px',
    bodySmall: '20px',
    scoreLarge: 'bold 48px',
    statValue: 'bold 36px',
    // V2 新增
    statusTag: 'bold 18px',
    tipText: '20px',
    densityLabel: '16px',
    percentileTag: 'bold 16px',
    achievementText: '20px',
    sectionIcon: '22px',
  },

  // 布局配置
  LAYOUT: {
    padding: 30,
    cardGap: 20,
    headerHeight: 280,
    statCardHeight: 160,
    footerHeight: 100,
    borderRadius: 16,
    // AI 评语区域配置 (V1 保留)
    aiComment: {
      titleHeight: 50,
      paddingVertical: 40,
      lineHeight: 28,
      maxWidth: 650,
    }
  },

  // V2 布局规格
  LAYOUT_V2: {
    // 标题区
    titleSection: {
      height: 120,
      titleY: 50,
      subtitleY: 85,
    },
    // 宝宝信息卡
    babyInfoCard: {
      height: 160,
      avatarSize: 80,
      progressBarWidth: 200,
      progressBarHeight: 12,
      progressBarRadius: 6,
    },
    // 指标卡 (单张)
    indicatorCard: {
      height: 110,
      titleRowHeight: 36,
      rangeBarHeight: 8,
      rangeBarDotSize: 14,
      tipRowHeight: 24,
      innerPadding: 16,
    },
    // 密度条
    densityBar: {
      height: 70,
      blockSize: 28,
      blockGap: 12,
      blockRadius: 6,
    },
    // 生长数据
    growthSection: {
      height: 100,
      itemHeight: 30,
    },
    // 疫苗进度
    vaccineProgress: {
      height: 80,
      barHeight: 16,
      barRadius: 8,
    },
    // 里程碑
    milestoneSection: {
      height: 90,
      badgeHeight: 28,
    },
    // 本周成就
    achievementSection: {
      lineHeight: 28,
      maxItems: 3,
    },
    // AI 建议 (精简版)
    aiAdvice: {
      maxChars: 60,
      lineHeight: 26,
      titleHeight: 36,
      paddingVertical: 30,
    },
    // 模块间距
    sectionGap: 16,
    // 卡片内边距
    cardPadding: 20,
  }
};

// ============================================================
// ShareCanvasService 类
// ============================================================

class ShareCanvasService {
  constructor() {
    this.ctx = null;
    this.canvas = null;
    this.dpr = 1;
    this.totalHeight = CANVAS_CONFIG.MIN_HEIGHT;
    this.imageCache = {};
  }

  // ----------------------------------------------------------
  // 公共方法
  // ----------------------------------------------------------

  /**
   * 初始化 Canvas（DPR 限制为 2）
   * @param {Object} canvas - Canvas 对象
   * @param {number} totalHeight - Canvas 总高度
   * @returns {Object} { ctx, dpr, width, height }
   */
  initCanvas(canvas, totalHeight) {
    const systemInfo = wx.getSystemInfoSync();
    // 关键修复 B3: DPR 限制为 2
    this.dpr = Math.min(systemInfo.pixelRatio, CANVAS_CONFIG.MAX_DPR);
    this.totalHeight = totalHeight;
    this.canvas = canvas;

    const width = CANVAS_CONFIG.WIDTH;
    canvas.width = width * this.dpr;
    canvas.height = totalHeight * this.dpr;

    this.ctx = canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    return {
      ctx: this.ctx,
      dpr: this.dpr,
      width,
      height: totalHeight
    };
  }

  /**
   * V2 动态高度计算
   * 遍历所有模块，累加各模块高度
   * @param {Object} data - V2 数据包
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文（用于 measureText）
   * @returns {number} Canvas 总高度（逻辑像素）
   */
  calculateCanvasHeight(data, ctx) {
    let height = 0;
    const gap = CANVAS_CONFIG.LAYOUT_V2.sectionGap;

    // ① 标题区（含头部色块背景）
    height += 120;

    // ② 宝宝信息卡
    height += 160 + gap;

    // ③ 四维指标卡
    const dimensions = ['feeding', 'sleep', 'diaper', 'temperature'];
    dimensions.forEach(dim => {
      const hasRange = dim !== 'temperature';
      let cardH = 36 + 16; // 标题行 + padding
      if (hasRange) cardH += 30; // 范围条
      cardH += 24; // 提示行
      cardH += 16; // 底部 padding
      height += cardH + 10; // +卡片间距
    });
    height += gap;

    // ④ 密度条（仅周报）
    if (data.periodType === 'week') {
      height += 90 + gap;
    }

    // ⑤ 生长数据（有数据时）
    if (data.growthData) {
      const items = [];
      if (data.growthData.weight) items.push(1);
      if (data.growthData.height) items.push(1);
      if (items.length > 0) {
        height += 40 + items.length * 32 + 16 + gap;
      }
    }

    // ⑥ 疫苗进度（有出生日期且月龄≥1即显示）
    if (data.babyInfo?.birthDate) {
      const { calculateAgeMonths } = require('../utils/date');
      const ageMonths = calculateAgeMonths(data.babyInfo.birthDate);
      if (ageMonths >= 1) {
        height += 80 + gap;
      }
    }

    // ⑦ 里程碑
    if (data.milestoneData?.achieved?.length > 0) {
      const hasNext = !!data.milestoneData.nextPending;
      height += 40 + 30 + (hasNext ? 30 : 0) + 16 + gap;
    }

    // ⑧ 本周成就
    const calcDays = data.reportData.feeding.dailyRecords?.length || (data.periodType === 'week' ? 7 : 30);
    const calcCards = ReportHelper.buildIndicatorCards(
      data.reportData, data.trendData, data.babyInfo, calcDays
    );
    const achievements = ReportHelper.buildAchievements({
      reportData: data.reportData,
      trendData: data.trendData,
      vaccineData: data.vaccineData,
      indicatorCards: calcCards,
      days: calcDays,
    });
    height += 40 + achievements.length * 28 + 16 + gap;

    // ⑨ AI 建议
    if (data.aiComment) {
      const brief = ReportHelper.truncateAIAdvice(data.aiComment, 60);
      ctx.font = `20px ${CANVAS_CONFIG.FONTS.family}`;
      const lines = this._calculateTextLines(ctx, brief, 650);
      height += 36 + lines.length * 26 + 30 + gap;
    }

    // ⑩ 底部
    height += CANVAS_CONFIG.LAYOUT.footerHeight + 20;

    return Math.max(height, CANVAS_CONFIG.MIN_HEIGHT);
  }

  /**
   * 导出 Canvas 为压缩图片
   * @param {Object} canvas - Canvas 对象
   * @param {number} totalHeight - Canvas 总高度
   * @returns {Promise<string>} 临时文件路径
   */
  exportImage(canvas, totalHeight) {
    return new Promise((resolve, reject) => {
      // 关键修复 B4: 指定压缩参数
      wx.canvasToTempFilePath({
        canvas,
        destWidth: CANVAS_CONFIG.WIDTH,
        destHeight: totalHeight,
        quality: CANVAS_CONFIG.EXPORT_QUALITY,
        fileType: CANVAS_CONFIG.EXPORT_TYPE,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err)
      });
    });
  }

  /**
   * V2 主绘制方法 - 统一入口
   * 10 个模块顺序绘制，自上而下累加 Y 坐标
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {Object} data - V2 绘制数据包
   */
  async draw(ctx, data) {
    this.ctx = ctx;
    this.imageCache = data.imageCache || {};

    // 1. 背景
    this._drawBackground(ctx, this.totalHeight);

    // 2. 标题区 (模块①)
    let currentY = this._drawTitleSection(ctx, data, 0);

    // 3. 宝宝信息卡 (模块②)
    currentY = await this._drawBabyInfoCard(ctx, data, currentY);

    // 4. 四维指标卡 (模块③)
    currentY = this._drawIndicatorCards(ctx, data, currentY);

    // 5. 密度条 (模块④，仅周报)
    currentY = this._drawDensityBar(ctx, data, currentY);

    // 6. 生长发育 (模块⑤)
    currentY = await this._drawGrowthSection(ctx, data, currentY);

    // 7. 疫苗进度 (模块⑥)
    currentY = await this._drawVaccineProgress(ctx, data, currentY);

    // 8. 里程碑 (模块⑦)
    currentY = await this._drawMilestoneSection(ctx, data, currentY);

    // 9. 本周成就 (模块⑧)
    currentY = await this._drawAchievementSection(ctx, data, currentY);

    // 10. AI 建议 (模块⑨)
    currentY = await this._drawAIAdvice(ctx, data, currentY);

    // 11. 底部品牌区 (模块⑩)
    this._drawFooter(ctx, this.totalHeight);
  }

  // ----------------------------------------------------------
  // V2 私有绘制方法（10 个模块）
  // ----------------------------------------------------------

  /**
   * 绘制背景（与 V1 相同）
   */
  _drawBackground(ctx, totalHeight) {
    const { COLORS } = CANVAS_CONFIG;

    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
    gradient.addColorStop(0, COLORS.bgGradientTop);
    gradient.addColorStop(1, COLORS.bgGradientBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_CONFIG.WIDTH, totalHeight);

    // 顶部装饰色块（覆盖标题区+宝宝信息卡 = 280px）
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, 0, CANVAS_CONFIG.WIDTH, CANVAS_CONFIG.LAYOUT.headerHeight);
  }

  /**
   * 模块① 绘制标题区 - 温情化 (FR-1)
   * @returns {number} 区域结束 Y 坐标
   */
  _drawTitleSection(ctx, data, startY) {
    const { COLORS, FONTS } = CANVAS_CONFIG;
    const { babyInfo, reportPeriod, currentPeriod, periodType } = data;

    // 标题：根据具体周期动态显示
    const periodTextMap = {
      'thisWeek': '本周',
      'lastWeek': '上周',
      'thisMonth': '本月',
      'lastMonth': '上月',
    };
    const periodText = periodTextMap[currentPeriod] || (periodType === 'week' ? '一周' : '月度');
    let babyName = babyInfo?.name || '宝宝';
    if (babyName.length > 4) babyName = babyName.substring(0, 4) + '…';
    const title = `${babyName}的${periodText}成绩单`;

    ctx.fillStyle = COLORS.white;
    ctx.font = `${FONTS.titleLarge} ${FONTS.family}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, 375, startY + 50);

    // 副标题：日期范围
    ctx.font = `${FONTS.bodyLarge} ${FONTS.family}`;
    ctx.fillStyle = COLORS.whiteTranslucent;
    ctx.fillText(reportPeriod || '', 375, startY + 82);

    // 出生第N天标记
    if (babyInfo?.birthDate) {
      const { calculateAgeInDays } = require('../utils/date');
      const daysSinceBirth = calculateAgeInDays(babyInfo.birthDate);
      ctx.font = `${FONTS.bodySmall} ${FONTS.family}`;
      ctx.fillText(`出生第 ${daysSinceBirth} 天`, 375, startY + 108);
    }

    return startY + 120;
  }

  /**
   * 模块② 绘制宝宝信息卡 + 综合评分线性进度条 (FR-2)
   * @returns {number} 区域结束 Y 坐标
   */
  async _drawBabyInfoCard(ctx, data, startY) {
    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const { babyInfo, overallScore } = data;
    const cardY = startY;
    const cardHeight = 160;

    // 白色卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, 30, cardY, 690, cardHeight, LAYOUT.borderRadius);
    ctx.fill();

    // 头像（左侧）
    await this._drawAvatar(ctx, babyInfo, 50, cardY + 20, 80);

    // 名字 + 月龄
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `${FONTS.titleMedium} ${FONTS.family}`;
    ctx.textAlign = 'left';
    ctx.fillText(babyInfo?.name || '宝宝', 150, cardY + 50);

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `${FONTS.bodyLarge} ${FONTS.family}`;
    ctx.fillText(babyInfo?.ageText || '', 150, cardY + 80);

    // 右侧：综合评分 + 进度条
    const scoreX = 500;

    // 评分数字
    const scoreColor = ReportHelper.getScoreColor(overallScore);
    ctx.fillStyle = scoreColor;
    ctx.font = `${FONTS.scoreLarge} ${FONTS.family}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(overallScore || 0), scoreX + 70, cardY + 55);

    // 评分等级文字
    const scoreLabel = ReportHelper.getScoreLabel(overallScore);
    ctx.font = `bold 18px ${FONTS.family}`;
    ctx.fillText(scoreLabel, scoreX + 70, cardY + 80);

    // 线性进度条
    const barX = scoreX;
    const barY = cardY + 100;
    const barWidth = 160;
    const barHeight = 12;

    // 进度条背景
    ctx.fillStyle = 'rgba(212,165,116,0.15)';
    this._roundRect(ctx, barX, barY, barWidth, barHeight, 6);
    ctx.fill();

    // 进度条填充
    const fillWidth = Math.max(barHeight, barWidth * (overallScore / 100));
    ctx.fillStyle = scoreColor;
    this._roundRect(ctx, barX, barY, fillWidth, barHeight, 6);
    ctx.fill();

    return cardY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块③ 绘制四维指标卡（喂养/睡眠/排便/体温）(FR-3)
   * 使用 ReportHelper.buildIndicatorCards 进行数据计算
   * @returns {number} 区域结束 Y 坐标
   */
  _drawIndicatorCards(ctx, data, startY) {
    const days = data.reportData.feeding.dailyRecords?.length || (data.periodType === 'week' ? 7 : 30);
    const cards = ReportHelper.buildIndicatorCards(
      data.reportData, data.trendData, data.babyInfo, days
    );

    let currentY = startY;

    for (const card of cards) {
      currentY = this._drawSingleIndicatorCard(ctx, currentY, {
        title: card.title,
        color: card.color,
        value: card.value,
        unit: card.unit,
        status: card.status,
        range: card.range,
        rangePosition: card.rangePosition,
        rangeZone: card.rangeZone,
        tip: card.tip,
        change: card.key !== 'temperature' ? data.trendData?.[card.key] : null,
        isTemperature: card.key === 'temperature',
      });
    }

    // 将各维度状态保存到 data 上，供 _calculateAchievements 引用
    data._feedingStatus = cards[0]?.status;
    data._sleepStatus = cards[1]?.status;
    data._diaperStatus = cards[2]?.status;
    data._tempStatus = cards[3]?.status;

    return currentY + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 绘制单个指标卡
   * 布局: [色条] 标题 [状态标签]  数值+单位  环比 / 范围条 / 提示行
   * @returns {number} 下一个模块的起始 Y
   */
  _drawSingleIndicatorCard(ctx, startY, cardData) {
    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;
    const cardPadding = 20;
    const cardInnerX = cardX + cardPadding;

    // 计算卡片高度 (标题行 + 范围条行(可选) + 提示行)
    let cardHeight = 36 + 16; // 标题行 + 上下间距
    if (cardData.range) cardHeight += 30; // 范围条行
    cardHeight += 24; // 提示行
    cardHeight += 16; // 底部间距

    // 卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 左侧色条 (6px 宽)
    ctx.fillStyle = cardData.color;
    this._roundRect(ctx, cardX, startY, 6, cardHeight, 3);
    ctx.fill();

    let currentY = startY + 12;

    // === 标题行 ===
    // 标题文字
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'left';
    ctx.fillText(cardData.title, cardInnerX + 12, currentY + 20);

    // 状态标签
    if (cardData.status && cardData.status !== 'noData') {
      const { text, color, bgColor } = ReportHelper.getStatusColors(cardData.status);
      if (text) {
        // 使用标题字体测量宽度来定位标签
        ctx.font = `bold 22px ${FONTS.family}`;
        const realTitleWidth = ctx.measureText(cardData.title).width;
        const tagX = cardInnerX + 12 + realTitleWidth + 12;

        // 标签背景
        ctx.font = `bold 16px ${FONTS.family}`;
        const tagWidth = ctx.measureText(text).width + 16;
        ctx.fillStyle = bgColor;
        this._roundRect(ctx, tagX, currentY + 5, tagWidth, 22, 11);
        ctx.fill();

        // 标签文字
        ctx.fillStyle = color;
        ctx.fillText(text, tagX + 8, currentY + 20);
      }
    }

    // 单位 (右对齐，先绘制单位以便测量宽度)
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `20px ${FONTS.family}`;
    const unitRightX = cardX + cardWidth - cardPadding - 10;
    ctx.fillText(cardData.unit, unitRightX, currentY + 22);
    const unitWidth = ctx.measureText(cardData.unit).width;

    // 数值 (在单位左侧)
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 28px ${FONTS.family}`;
    const valueStr = String(cardData.value);
    const valueRightX = unitRightX - unitWidth - 4;
    ctx.fillText(valueStr, valueRightX, currentY + 22);
    const valueWidth = ctx.measureText(valueStr).width;

    // 环比变化 (在数值左侧，避免重叠)
    if (cardData.change && cardData.change.changePercent > 0 && cardData.change.changeValue !== 0) {
      const arrow = cardData.change.isUp ? '↑' : '↓';
      const changeText = `${arrow}${cardData.change.changePercent}%`;
      ctx.fillStyle = cardData.change.isUp ? '#7BC950' : '#D4883D';
      ctx.font = `16px ${FONTS.family}`;
      const changeRightX = valueRightX - valueWidth - 8;
      ctx.fillText(changeText, changeRightX, currentY + 18);
    }

    currentY += 36;
    ctx.textAlign = 'left';

    // === 范围条行 (仅喂养/睡眠/排便) ===
    if (cardData.range) {
      const barX = cardInnerX + 12;
      const barWidth = 380;
      const barY = currentY + 4;
      const barHeight = 8;

      // 范围条背景（全条）
      ctx.fillStyle = COLORS.rangeBarBg;
      this._roundRect(ctx, barX, barY, barWidth, barHeight, 4);
      ctx.fill();

      // 正常范围区域（绿色半透明，20%-80%）
      ctx.fillStyle = COLORS.rangeBarNormal;
      const normalX = barX + barWidth * 0.2;
      const normalWidth = barWidth * 0.6;
      ctx.fillRect(normalX, barY, normalWidth, barHeight);

      // 定位点（使用预计算的位置）
      const dotX = barX + barWidth * (cardData.rangePosition / 100);
      const dotRadius = 7;
      const dotColor = ReportHelper.getZoneDotColor(cardData.rangeZone);

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, barY + barHeight / 2, dotRadius, 0, 2 * Math.PI);
      ctx.fill();

      // 白色描边
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 参考范围文字
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `18px ${FONTS.family}`;
      const refUnit = cardData.title === '睡眠' ? 'h' : '次';
      const refText = `参考 ${cardData.range.min}-${cardData.range.max}${refUnit}`;
      ctx.fillText(refText, barX + barWidth + 16, barY + 10);

      currentY += 30;
    }

    // === 提示行 ===
    if (cardData.tip) {
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `18px ${FONTS.family}`;
      ctx.textAlign = 'left';
      ctx.fillText(cardData.tip, cardInnerX + 12, currentY + 16);
      currentY += 24;
    }

    return startY + cardHeight + 10; // 10px 卡片间距
  }

  /**
   * 模块④ 绘制每日记录密度条（仅周报）(FR-9)
   * @returns {number} 区域结束 Y 坐标，月报时返回 startY（跳过）
   */
  _drawDensityBar(ctx, data, startY) {
    if (data.periodType !== 'week') return startY;

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;
    const cardHeight = 90;

    // 卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题
    const densityTitle = data.currentPeriod === 'thisWeek' ? '本周记录' : '上周记录';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `bold 18px ${FONTS.family}`;
    ctx.textAlign = 'left';
    ctx.fillText(densityTitle, cardX + 20, startY + 22);

    // 计算每天的记录数
    const days = data.reportData.feeding.dailyRecords?.length || 7;
    const dailyCounts = ReportHelper.calculateDailyCounts(data.reportData, days);
    const maxCount = Math.max(...dailyCounts, 1);
    
    // 根据起始日期动态生成星期标签
    const allDayLabels = ['日', '一', '二', '三', '四', '五', '六'];
    const dayLabels = [];
    if (data.reportStartDate) {
      const d = new Date(data.reportStartDate);
      for (let i = 0; i < days; i++) {
        dayLabels.push(allDayLabels[d.getDay()]);
        d.setDate(d.getDate() + 1);
      }
    } else {
      // 降级：默认周一到周日
      for (let i = 0; i < days; i++) {
        dayLabels.push(['一', '二', '三', '四', '五', '六', '日'][i] || '');
      }
    }

    const blockSize = 28;
    const blockGap = 14;
    const totalBlockWidth = blockSize * days + blockGap * (days - 1);
    const startBlockX = cardX + (cardWidth - totalBlockWidth) / 2;

    for (let i = 0; i < days; i++) {
      const bx = startBlockX + i * (blockSize + blockGap);
      const by = startY + 32;
      const count = dailyCounts[i];

      // 色块（根据记录数量确定深浅）
      if (count === 0) {
        ctx.fillStyle = COLORS.densityEmpty;
        ctx.strokeStyle = '#D4C8B8';
        ctx.lineWidth = 1;
        this._roundRect(ctx, bx, by, blockSize, blockSize, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        const intensity = Math.min(count / maxCount, 1);
        ctx.fillStyle = ReportHelper.getDensityColor(intensity);
        this._roundRect(ctx, bx, by, blockSize, blockSize, 6);
        ctx.fill();
      }

      // 日期标签
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `14px ${FONTS.family}`;
      ctx.textAlign = 'center';
      ctx.fillText(dayLabels[i], bx + blockSize / 2, by + blockSize + 14);
    }

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑤ 绘制生长发育模块（身高/体重 + WHO百分位）(FR-4)
   * @returns {number} 区域结束 Y 坐标，无数据时返回 startY
   */
  async _drawGrowthSection(ctx, data, startY) {
    const { growthData } = data;
    if (!growthData) return startY;

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;

    // 计算有几行数据
    const items = [];
    if (growthData.weight) {
      items.push({
        label: '体重',
        value: `${growthData.weight}kg`,
        percentile: growthData.weightPercentile
      });
    }
    if (growthData.height) {
      items.push({
        label: '身高',
        value: `${growthData.height}cm`,
        percentile: growthData.heightPercentile
      });
    }
    if (items.length === 0) return startY;

    const cardHeight = 40 + items.length * 32 + 16;

    // 卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题（带图标）
    const heightIcon = await this._loadImage('/images/icons/height.png');
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'left';
    if (heightIcon) {
      ctx.drawImage(heightIcon, cardX + 20, startY + 10, 22, 22);
      ctx.fillText('生长发育', cardX + 48, startY + 28);
    } else {
      ctx.fillText('生长发育', cardX + 20, startY + 28);
    }

    // 数据时效性标注
    if (growthData.daysSinceRecord > 30) {
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `16px ${FONTS.family}`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `(${growthData.daysSinceRecord}天前测量)`,
        cardX + cardWidth - 20, startY + 28
      );
    }

    // 数据行
    let itemY = startY + 48;
    ctx.textAlign = 'left';

    for (const item of items) {
      // 标签
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `20px ${FONTS.family}`;
      ctx.fillText(item.label, cardX + 20, itemY + 16);

      // 数值
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `bold 24px ${FONTS.family}`;
      ctx.fillText(item.value, cardX + 100, itemY + 16);

      // WHO 百分位标签
      if (item.percentile) {
        const { text, color, bgColor } = ReportHelper.getPercentileDisplay(item.percentile);
        const tagX = cardX + 220;
        ctx.font = `bold 16px ${FONTS.family}`;
        const tagWidth = ctx.measureText(text).width + 16;

        ctx.fillStyle = bgColor;
        this._roundRect(ctx, tagX, itemY + 2, tagWidth, 22, 11);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fillText(text, tagX + 8, itemY + 17);
      }

      itemY += 32;
    }

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑥ 绘制疫苗接种进度 (FR-5)
   * @returns {number} 区域结束 Y 坐标
   */
  async _drawVaccineProgress(ctx, data, startY) {
    const { vaccineData, babyInfo } = data;

    // 无出生日期则无法计算疫苗计划
    if (!babyInfo?.birthDate) return startY;

    // 月龄 < 1 个月不显示
    const { calculateAgeMonths } = require('../utils/date');
    const ageMonths = calculateAgeMonths(babyInfo.birthDate);
    if (ageMonths < 1) return startY;

    // 即使 vaccineData 为 null（从未接种），也使用默认值显示 0/X
    const { done, total, overdue } = vaccineData || { done: 0, total: 0, overdue: 0 };

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;
    const cardHeight = 80;

    // 卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题 + 进度文字（带图标）
    const syringeIcon = await this._loadImage('/images/icons/syringe.png');
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'left';
    if (syringeIcon) {
      ctx.drawImage(syringeIcon, cardX + 20, startY + 10, 22, 22);
      ctx.fillText('疫苗接种', cardX + 48, startY + 28);
    } else {
      ctx.fillText('疫苗接种', cardX + 20, startY + 28);
    }

    // 右侧: 进度数字
    ctx.textAlign = 'right';
    ctx.fillStyle = done === total && total > 0 ? '#7BC950' : COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.fillText(`${done}/${total}`, cardX + cardWidth - 20, startY + 28);

    // 进度条
    const barX = cardX + 20;
    const barY = startY + 44;
    const barWidth = cardWidth - 40;
    const barHeight = 14;

    ctx.fillStyle = COLORS.rangeBarBg;
    this._roundRect(ctx, barX, barY, barWidth, barHeight, 7);
    ctx.fill();

    if (total > 0) {
      const fillWidth = Math.max(barHeight, barWidth * (done / total));
      ctx.fillStyle = done === total ? '#7BC950' : '#5ABFB0';
      this._roundRect(ctx, barX, barY, fillWidth, barHeight, 7);
      ctx.fill();
    }

    // 逾期提示
    if (overdue > 0) {
      ctx.fillStyle = '#E85454';
      ctx.font = `bold 16px ${FONTS.family}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${overdue}剂逾期`, barX, barY + barHeight + 16);
    } else if (done === total && total > 0) {
      ctx.fillStyle = '#7BC950';
      ctx.font = `16px ${FONTS.family}`;
      ctx.textAlign = 'left';
      ctx.fillText('全部完成', barX, barY + barHeight + 16);
    }

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑦ 绘制里程碑达成 (FR-6)
   * @returns {number} 区域结束 Y 坐标
   */
  async _drawMilestoneSection(ctx, data, startY) {
    const { milestoneData } = data;
    if (!milestoneData || milestoneData.achieved.length === 0) return startY;

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;

    // 计算高度
    const hasNext = !!milestoneData.nextPending;
    const cardHeight = 40 + 30 + (hasNext ? 30 : 0) + 16;

    // 卡片背景
    ctx.fillStyle = COLORS.cardBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题（带图标）
    const milestoneIcon = await this._loadImage('/images/icons/milestone-color.png');
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'left';
    if (milestoneIcon) {
      ctx.drawImage(milestoneIcon, cardX + 20, startY + 10, 22, 22);
      ctx.fillText('成长里程碑', cardX + 48, startY + 28);
    } else {
      ctx.fillText('成长里程碑', cardX + 20, startY + 28);
    }

    // 已达成（最近 3 个）
    const achieved = milestoneData.achieved.slice(-3);
    let achievedX = cardX + 20;
    const achievedY = startY + 50;

    // 预加载 check 图标
    const checkIcon = await this._loadImage('/images/icons/check.png');

    achieved.forEach((name, idx) => {
      if (idx > 0) {
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = `18px ${FONTS.family}`;
        ctx.textAlign = 'left';
        ctx.fillText(' · ', achievedX, achievedY + 14);
        achievedX += ctx.measureText(' · ').width;
      }

      // 对勾图标
      if (checkIcon) {
        ctx.drawImage(checkIcon, achievedX, achievedY + 2, 16, 16);
        achievedX += 20;
      } else {
        ctx.fillStyle = '#7BC950';
        ctx.font = `18px ${FONTS.family}`;
        ctx.textAlign = 'left';
        ctx.fillText('√', achievedX, achievedY + 14);
        achievedX += 18;
      }

      // 名称
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `20px ${FONTS.family}`;
      ctx.fillText(name, achievedX, achievedY + 14);
      achievedX += ctx.measureText(name).width + 8;
    });

    // 下一个待解锁
    if (hasNext) {
      const nextY = achievedY + 30;
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = `18px ${FONTS.family}`;
      ctx.textAlign = 'left';
      ctx.fillText('下一个：', cardX + 20, nextY + 14);

      ctx.font = `20px ${FONTS.family}`;
      const nextX = cardX + 20 + ctx.measureText('下一个：').width;
      // 虚线框效果
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.textSecondary;
      ctx.lineWidth = 1;
      const nameWidth = ctx.measureText(milestoneData.nextPending).width + 16;
      this._roundRect(ctx, nextX - 4, nextY, nameWidth, 24, 12);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText(milestoneData.nextPending, nextX + 4, nextY + 16);
    }

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑧ 绘制本周成就（最多 3 个）(FR-7)
   * @returns {number} 区域结束 Y 坐标
   */
  async _drawAchievementSection(ctx, data, startY) {
    const days = data.reportData.feeding.dailyRecords?.length || (data.periodType === 'week' ? 7 : 30);
    const indicatorCards = ReportHelper.buildIndicatorCards(
      data.reportData, data.trendData, data.babyInfo, days
    );
    const achievementItems = ReportHelper.buildAchievements({
      reportData: data.reportData,
      trendData: data.trendData,
      vaccineData: data.vaccineData,
      indicatorCards,
      days,
    });

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;
    const lineHeight = 28;
    const cardHeight = 40 + achievementItems.length * lineHeight + 16;

    // 卡片背景（淡色）
    ctx.fillStyle = COLORS.achievementBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题（带图标）- 根据周期动态显示
    const rocketIcon = await this._loadImage('/images/icons/rocket.png');
    const achievementTitle = data.highlightTitle || '亮点';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'left';
    if (rocketIcon) {
      ctx.drawImage(rocketIcon, cardX + 20, startY + 10, 22, 22);
      ctx.fillText(achievementTitle, cardX + 48, startY + 28);
    } else {
      ctx.fillText(achievementTitle, cardX + 20, startY + 28);
    }

    // 成就列表（图标+文字）
    let itemY = startY + 48;
    ctx.font = `20px ${FONTS.family}`;

    for (const item of achievementItems) {
      // 尝试加载图标
      const icon = item.iconPath ? await this._loadImage(item.iconPath) : null;
      if (icon) {
        ctx.drawImage(icon, cardX + 20, itemY + 2, 18, 18);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(item.text, cardX + 44, itemY + 14);
      } else {
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(item.text, cardX + 20, itemY + 14);
      }
      itemY += lineHeight;
    }

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑨ 绘制 AI 建议（精简版，≤2句）(FR-8)
   * @returns {number} 区域结束 Y 坐标
   */
  async _drawAIAdvice(ctx, data, startY) {
    const { aiComment } = data;
    if (!aiComment) return startY;

    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const padding = LAYOUT.padding;
    const cardX = padding;
    const cardWidth = 750 - padding * 2;

    // 精简 AI 建议：取最重要的 1-2 句
    const briefAdvice = ReportHelper.truncateAIAdvice(aiComment, 60);

    // 计算文字行数
    ctx.font = `20px ${FONTS.family}`;
    const lines = this._calculateTextLines(ctx, briefAdvice, cardWidth - 40);
    const cardHeight = 36 + lines.length * 26 + 30;

    // 卡片背景（淡色）
    ctx.fillStyle = COLORS.achievementBg;
    this._roundRect(ctx, cardX, startY, cardWidth, cardHeight, 12);
    ctx.fill();

    // 标题（带图标）
    const aiIcon = await this._loadImage('/images/icons/ai-assistant.png');
    ctx.fillStyle = COLORS.accent;
    ctx.font = `bold 20px ${FONTS.family}`;
    ctx.textAlign = 'left';
    if (aiIcon) {
      ctx.drawImage(aiIcon, cardX + 20, startY + 10, 20, 20);
      ctx.fillText('AI 育儿建议', cardX + 46, startY + 26);
    } else {
      ctx.fillText('AI 育儿建议', cardX + 20, startY + 26);
    }

    // 内容
    ctx.fillStyle = COLORS.textTertiary;
    ctx.font = `20px ${FONTS.family}`;
    this._drawWrappedText(ctx, briefAdvice, cardX + 20, startY + 50, cardWidth - 40, 26);

    return startY + cardHeight + CANVAS_CONFIG.LAYOUT_V2.sectionGap;
  }

  /**
   * 模块⑩ 绘制底部品牌区 (FR-10)
   */
  _drawFooter(ctx, totalHeight) {
    const { COLORS, FONTS, LAYOUT } = CANVAS_CONFIG;
    const footerHeight = LAYOUT.footerHeight;
    const footerY = totalHeight - footerHeight;

    // 底部深色背景
    ctx.fillStyle = COLORS.footerBg;
    ctx.fillRect(0, footerY, 750, footerHeight);

    // 品牌名
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold 22px ${FONTS.family}`;
    ctx.textAlign = 'center';
    ctx.fillText('Baby Care Tracker', 375, footerY + 38);

    // 副标题（FR-10 优化）
    ctx.fillStyle = COLORS.whiteTranslucent;
    ctx.font = `18px ${FONTS.family}`;
    ctx.fillText('designed by neo', 375, footerY + 68);
  }

  // ----------------------------------------------------------
  // 头像绘制（复用 V1）
  // ----------------------------------------------------------

  /**
   * 绘制头像（支持超时降级）
   */
  async _drawAvatar(ctx, babyInfo, x, y, size) {
    const { COLORS, FONTS } = CANVAS_CONFIG;
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // 绘制圆形剪切区域
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, 2 * Math.PI);
    ctx.clip();

    let avatarLoaded = false;
    const avatarUrl = babyInfo?.avatar;

    if (avatarUrl) {
      try {
        const avatarPath = await this._loadImage(avatarUrl);
        if (avatarPath) {
          ctx.drawImage(avatarPath, x, y, size, size);
          avatarLoaded = true;
        }
      } catch (err) {
        console.warn('头像加载失败:', avatarUrl, err);
      }
    }

    // 加载失败或无头像时，绘制带名字首字的占位符
    if (!avatarLoaded) {
      ctx.fillStyle = COLORS.headerBg;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, 2 * Math.PI);
      ctx.fill();

      const firstName = (babyInfo?.name || '宝').charAt(0);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold 32px ${FONTS.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(firstName, centerX, centerY);
    }

    ctx.restore();

    // 绘制头像边框
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, 2 * Math.PI);
    ctx.strokeStyle = COLORS.headerBg;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 恢复默认 textBaseline
    ctx.textBaseline = 'alphabetic';
  }

  // ----------------------------------------------------------
  // V2 工具方法（10 个新增）
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // V2 工具方法已迁移到 services/reportDataHelper.js
  // 共用: getScoreColor, getScoreLabel, getStatusColors, getZoneDotColor,
  //       getPercentileDisplay, getDensityColor, truncateAIAdvice,
  //       calculateDailyCounts, countRecordDays, buildAchievements
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // 通用工具方法（Canvas 特有，不可共用）
  // ----------------------------------------------------------

  /**
   * 计算文字行数（支持 \n 换行符和自动换行）
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {string} text - 文本内容
   * @param {number} maxWidth - 最大宽度
   * @returns {Array<string>} 分行后的文字数组
   */
  _calculateTextLines(ctx, text, maxWidth) {
    if (!text) return [];

    const lines = [];
    // 关键修复 C6: 先按段落分割（支持 \n）
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push(''); // 保留空行
        continue;
      }

      let line = '';
      for (const char of paragraph) {
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        // 预留 10px 安全边距
        if (metrics.width > (maxWidth - 10) && line) {
          lines.push(line);
          line = char;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);
    }

    return lines;
  }

  /**
   * 绘制多行文字（支持段落间距）
   * @returns {number} 最终 Y 坐标
   */
  _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = this._calculateTextLines(ctx, text, maxWidth);
    let currentY = y;

    for (const line of lines) {
      if (line === '') {
        // 空行使用半倍行高
        currentY += lineHeight * 0.5;
      } else {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
      }
    }

    return currentY;
  }

  /**
   * 绘制圆角矩形
   */
  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 将 cloud:// 文件ID转换为临时HTTP URL
   * @param {string} cloudFileID - 云存储文件ID
   * @returns {Promise<string|null>} 临时HTTP URL
   */
  _cloudFileToTempURL(cloudFileID) {
    return new Promise((resolve) => {
      wx.cloud.getTempFileURL({
        fileList: [cloudFileID],
        success: (res) => {
          const fileInfo = res.fileList && res.fileList[0];
          if (fileInfo && fileInfo.tempFileURL) {
            resolve(fileInfo.tempFileURL);
          } else {
            console.warn('云文件转换失败:', cloudFileID, res);
            resolve(null);
          }
        },
        fail: (err) => {
          console.warn('getTempFileURL 失败:', cloudFileID, err);
          resolve(null);
        }
      });
    });
  }

  /**
   * 使用 canvas.createImage() 加载图片为 Image 对象
   * @param {string} url - 图片URL或本地路径（非 cloud:// 开头）
   * @returns {Promise<Image|null>} Canvas Image 对象
   */
  _createCanvasImage(url) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('图片加载超时:', url);
        resolve(null);
      }, 3000);

      if (this.canvas && this.canvas.createImage) {
        const img = this.canvas.createImage();
        img.onload = () => {
          clearTimeout(timeoutId);
          resolve(img);
        };
        img.onerror = (err) => {
          clearTimeout(timeoutId);
          console.warn('图片加载失败(createImage):', url, err);
          resolve(null);
        };
        img.src = url;
      } else {
        // 降级：使用 wx.getImageInfo 获取本地路径
        wx.getImageInfo({
          src: url,
          success: (res) => {
            clearTimeout(timeoutId);
            resolve(res.path);
          },
          fail: (err) => {
            clearTimeout(timeoutId);
            console.warn('图片加载失败:', url, err);
            resolve(null);
          }
        });
      }
    });
  }

  /**
   * 加载图片为 Canvas Image 对象（带缓存、支持 cloud:// 和普通路径）
   * @param {string} src - 图片路径（支持本地路径、网络URL、cloud:// 云存储ID）
   * @returns {Promise<Image|null>} Canvas Image 对象，失败返回 null
   */
  async _loadImage(src) {
    if (!src) return null;

    // 如果已有缓存，检查缓存值类型：必须是 Image 对象（非字符串路径）
    const cached = this.imageCache[src];
    if (cached && typeof cached !== 'string') {
      return cached;
    }

    // 如果缓存的是字符串路径（旧版预加载的），需要删除并重新加载
    if (cached && typeof cached === 'string') {
      delete this.imageCache[src];
    }

    let loadUrl = src;

    // cloud:// 开头的云文件ID需要先转换为临时HTTP URL
    if (src.startsWith('cloud://')) {
      loadUrl = await this._cloudFileToTempURL(src);
      if (!loadUrl) return null;
    }

    const img = await this._createCanvasImage(loadUrl);
    if (img) {
      this.imageCache[src] = img;
    }
    return img;
  }
}

// 导出配置常量，供组件引用
ShareCanvasService.CANVAS_CONFIG = CANVAS_CONFIG;

module.exports = ShareCanvasService;
