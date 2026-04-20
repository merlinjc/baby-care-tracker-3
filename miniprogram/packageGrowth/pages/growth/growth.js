/**
 * 生长发育追踪页
 * 生长曲线、记录数据、WHO标准对照
 */

const StorageUtil = require('../../../utils/storage');
const RecordService = require('../../../services/record');
const { formatDate, calculateAgeMonths } = require('../../../utils/date');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');
const FamilyContext = require('../../../utils/family-context');
const {
  WHO_WEIGHT_BOY, WHO_WEIGHT_GIRL,
  WHO_HEIGHT_BOY, WHO_HEIGHT_GIRL,
  WHO_HEAD_BOY, WHO_HEAD_GIRL,
  WHO_BMI_BOY, WHO_BMI_GIRL
} = require('../../config/who-standards');


// WHO 图表 X 轴固定月龄数组（0-24 月）
const CHART_MONTHS = Array.from({ length: 25 }, (_, i) => i);

// WHO 数据映射表（模块级常量，避免每次 getWhoData 重建）
const WHO_DATA_MAP = {
  'WEIGHT': { Boy: WHO_WEIGHT_BOY, Girl: WHO_WEIGHT_GIRL },
  'HEIGHT': { Boy: WHO_HEIGHT_BOY, Girl: WHO_HEIGHT_GIRL },
  'HEAD': { Boy: WHO_HEAD_BOY, Girl: WHO_HEAD_GIRL },
  'BMI': { Boy: WHO_BMI_BOY, Girl: WHO_BMI_GIRL }
};


Page({
  data: {
    darkMode: false,
    baby: null,
    babyAgeMonths: 0,
    whoReference: null, // WHO参考值
    dataType: 'weight',
    growthRecords: [],
    latestData: null,
    evaluation: { level: 'normal', iconType: 'status', iconName: 'chart', text: '发育评估: 正常范围' },
    loading: true,
    canvasWidth: 0,
    canvasHeight: 0,
    canvasReady: false, // canvas 是否已初始化
    showAddPopup: false,
    showWhoPopup: false,
    showDetailPopup: false,
    editingRecord: null,
    selectedRecord: null,
    formData: {
      date: '',
      weight: '',
      height: '',
      headCircumference: '',
      note: ''
    },
    weightRange: '',
    heightRange: '',
    headRange: '',
    bmiRange: 'WHO BMI-for-age 参考范围'
  },

  async onLoad() {
    this._lastShowTime = 0;
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    // 先加载宝宝信息，完成后再加载生长记录
    this.loadBabyInfo(() => {
      this.loadGrowthRecords();
    });
  },

  onShow() {
    this._applyTheme();
    // 30s 节流：避免频繁 tab 切换重复加载
    const now = Date.now();
    if (this._lastShowTime && now - this._lastShowTime < 30000) return;
    this._lastShowTime = now;

    if (this.data.baby) {
      this.loadGrowthRecords();
    } else {
      this.loadBabyInfo(() => {
        this.loadGrowthRecords();
      });
    }
  },

  onReady() {
    // Canvas 初始化会在数据加载完成后触发
    // 因为 Canvas 在 loading=false 时才渲染
  },

  /**
   * 延迟初始化 Canvas（等待 DOM 渲染）
   */
  initCanvasDelayed() {
    // 使用 setTimeout 确保 DOM 已渲染
    setTimeout(() => {
      this.initCanvas();
    }, 100);
  },

  loadBabyInfo(callback) {
    const baby = StorageUtil.getCurrentBaby();
    if (baby) {
      const babyAgeMonths = this.calculateAgeMonths(baby.birthDate);
      const whoReference = this.getWhoReference(baby.gender, babyAgeMonths);
      this.setData({ baby, babyAgeMonths, whoReference }, () => {
        this.updateReferenceRanges();
        if (callback) callback();
      });
    } else {
      // 没有宝宝信息，停止加载
      this.setData({ loading: false });
    }
  },

  /**
   * 获取WHO参考值
   */
  getWhoReference(gender, ageMonths) {
    // BUG-18: WHO 数据覆盖 0-24 月，扩展上限为 24
    if (ageMonths > 24) return null;
    
    const genderKey = gender === 'male' ? 'Boy' : 'Girl';
    const weightData = this.getWhoData('WEIGHT', genderKey, ageMonths);
    const heightData = this.getWhoData('HEIGHT', genderKey, ageMonths);
    const headData = this.getWhoData('HEAD', genderKey, ageMonths);
    const bmiData = this.getWhoData('BMI', genderKey, ageMonths);
    
    return {
      weight: weightData,
      height: heightData,
      head: headData,
      bmi: bmiData
    };
  },

  /**
   * 获取WHO数据（使用模块级常量 WHO_DATA_MAP）
   */
  getWhoData(type, gender, ageMonths) {
    return WHO_DATA_MAP[type][gender][ageMonths] || null;
  },

  updateReferenceRanges() {
    const { baby } = this.data;
    if (!baby) return;
    
    const ageMonths = this.calculateAgeMonths(baby.birthDate);
    const genderKey = baby.gender === 'male' ? 'Boy' : 'Girl';
    
    // 复用 getWhoData，避免重复的 gender 判断逻辑
    const weightData = this.getWhoData('WEIGHT', genderKey, ageMonths);
    const heightData = this.getWhoData('HEIGHT', genderKey, ageMonths);
    const headData = this.getWhoData('HEAD', genderKey, ageMonths);
    const bmiData = this.getWhoData('BMI', genderKey, ageMonths);
    
    this.setData({
      weightRange: weightData ? `P3: ${weightData.p3}kg - P97: ${weightData.p97}kg` : '参考范围超出',
      heightRange: heightData ? `P3: ${heightData.p3}cm - P97: ${heightData.p97}cm` : '参考范围超出',
      headRange: headData ? `P3: ${headData.p3}cm - P97: ${headData.p97}cm` : '参考范围超出',
      bmiRange: bmiData ? `P3: ${bmiData.p3} - P97: ${bmiData.p97} kg/m²` : '参考范围超出'
    });
  },

  async loadGrowthRecords() {
    try {
      const db = wx.cloud.database();
      const baby = this.data.baby;
      
      if (!baby) {
        this.setData({ loading: false });
        return;
      }

      // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
      const records = await db.collection('records')
        .where({
          babyId: baby._id,
          familyId: FamilyContext.resolveForBaby(baby),
          recordType: 'growth'
        })
        .orderBy('startTime', 'desc')
        .limit(30)
        .get();

      const growthRecords = records.data.map(r => {
        const record = {
          ...r,
          dateText: formatDate(r.startTime),
          percentile: this.calculatePercentile(r.data, r.startTime)
        };
        
        // 计算 BMI（如果有体重和身高数据）
        if (r.data.weight && r.data.height) {
          const bmi = this.calculateBMI(r.data.weight, r.data.height);
          record.bmi = bmi;
          const bmiEval = this.getBMIEvaluation(bmi, this.calculateRecordAgeMonths(r.startTime));
          record.bmiStatus = bmiEval.status;
          record.bmiLevel = bmiEval.level;
          record.bmiTip = bmiEval.tip;
        }
        
        return record;
      });

      const latestData = growthRecords.length > 0 ? growthRecords[0] : null;
      const evaluation = this.calculateEvaluation(latestData);

      this.setData({ 
        growthRecords, 
        latestData,
        evaluation,
        loading: false 
      }, () => {
        // 数据加载完成后初始化 Canvas（如果还未初始化）
        if (!this.data.canvasReady) {
          this.initCanvasDelayed();
        } else if (growthRecords.length > 0) {
          // Canvas 已初始化，直接绘制图表
          this.drawChart();
        }
      });
    } catch (error) {
      console.error('加载生长记录失败:', error);
      this.setData({ loading: false });
    }
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#growthChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) {
          console.warn('Canvas 元素未找到，可能 DOM 还未渲染完成');
          // 不设置 canvasReady，允许后续重试
          return;
        }
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        
        const width = res[0].width;
        const height = res[0].height;
        
        if (!width || !height) {
          console.error('Canvas 尺寸无效:', width, height);
          return;
        }
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        
        this.canvas = canvas;
        this.ctx = ctx;
        this.setData({
          canvasWidth: width,
          canvasHeight: height,
          canvasReady: true
        });
        
        // Canvas 初始化完成后，如果已有数据则绘制图表
        if (this.data.growthRecords.length > 0) {
          this.drawChart();
        }
      });
  },

  drawChart() {
    if (!this.ctx) {
      console.error('Canvas context 未初始化');
      return;
    }
    if (!this.data.growthRecords.length) {
      return;
    }
    
    const ctx = this.ctx;
    const { canvasWidth: width, canvasHeight: height, dataType, growthRecords, baby } = this.data;
    
    // 验证 canvas 尺寸
    if (!width || !height) {
      console.error('Canvas 尺寸无效:', width, height);
      return;
    }
    
    ctx.clearRect(0, 0, width, height);
    
    const padding = { top: 20, right: 36, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // 获取WHO标准数据
    let whoData, yMin, yMax, unit;
    const gender = baby ? (baby.gender === 'male' ? 'Boy' : 'Girl') : 'Boy';
    
    if (dataType === 'weight') {
      whoData = gender === 'Boy' ? WHO_WEIGHT_BOY : WHO_WEIGHT_GIRL;
      yMin = 2; yMax = 18; unit = 'kg';  // 扩展上限以覆盖24月龄
    } else if (dataType === 'height') {
      whoData = gender === 'Boy' ? WHO_HEIGHT_BOY : WHO_HEIGHT_GIRL;
      yMin = 45; yMax = 100; unit = 'cm';  // 扩展上限以覆盖24月龄
    } else if (dataType === 'head') {
      whoData = gender === 'Boy' ? WHO_HEAD_BOY : WHO_HEAD_GIRL;
      yMin = 31; yMax = 55; unit = 'cm';  // 扩展上限以覆盖24月龄
    } else if (dataType === 'bmi') {
      whoData = gender === 'Boy' ? WHO_BMI_BOY : WHO_BMI_GIRL;
      unit = 'kg/m²';
      // BMI Y轴根据 WHO 数据动态计算
      let allP3Min = Infinity, allP97Max = -Infinity;
      const bmiMonths = Object.keys(whoData).map(Number);
      bmiMonths.forEach(m => {
        const d = whoData[m];
        if (d.p3 < allP3Min) allP3Min = d.p3;
        if (d.p97 > allP97Max) allP97Max = d.p97;
      });
      yMin = Math.floor(allP3Min) - 1;  // 留出底部空间
      yMax = Math.ceil(allP97Max) + 1;   // 留出顶部空间
    }
    
    // BUG-FIX: WHO 数据覆盖 0-24 月，图表 X 轴扩展到 24 个月
    const maxMonth = 24;
    const months = CHART_MONTHS;

    // 确保宝宝数据点如果超出 Y 轴范围则自动扩展
    const reversedRecords = [...growthRecords].reverse();
    const validPoints = [];
    reversedRecords.forEach((record) => {
      const monthAge = this.calculateRecordAgeMonths(record.startTime);
      let value;
      
      if (dataType === 'weight') value = record.data.weight;
      else if (dataType === 'height') value = record.data.height;
      else if (dataType === 'head') value = record.data.headCircumference;
      else if (dataType === 'bmi') value = record.bmi;
      
      if (value !== null && value !== undefined && monthAge >= 0 && monthAge <= maxMonth) {
        validPoints.push({ monthAge, value });
        // 动态扩展 Y 轴以包含所有数据点
        if (value < yMin) yMin = Math.floor(value) - 1;
        if (value > yMax) yMax = Math.ceil(value) + 1;
      }
    });
    
    // 绘制背景网格
    ctx.strokeStyle = '#E8DCC8';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    for (let i = 0; i <= 6; i++) {
      const x = padding.left + (chartWidth / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }
    
    // 绘制百分位区间颜色填充带（所有数据类型统一风格）
    if (whoData) {
      const bandAlpha = 0.15;
      
      // 辅助函数：获取某个百分位在某月龄的 Y 坐标
      const getY = (month, percentile) => {
        const data = whoData[month];
        if (!data) return null;
        const value = data[percentile];
        return padding.top + (1 - (value - yMin) / (yMax - yMin)) * chartHeight;
      };
      
      // 辅助函数：绘制两条百分位线之间的填充区域
      const drawBand = (pLow, pHigh, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        let started = false;
        
        // 正向绘制上边界（pHigh）
        months.forEach(month => {
          const yHigh = getY(month, pHigh);
          if (yHigh === null) return;
          const x = padding.left + (month / maxMonth) * chartWidth;
          if (!started) { ctx.moveTo(x, yHigh); started = true; }
          else ctx.lineTo(x, yHigh);
        });
        
        // 逆向绘制下边界（pLow）
        const reversedMonths = [...months].reverse();
        reversedMonths.forEach(month => {
          const yLow = getY(month, pLow);
          if (yLow === null) return;
          const x = padding.left + (month / maxMonth) * chartWidth;
          ctx.lineTo(x, yLow);
        });
        
        ctx.closePath();
        ctx.fill();
      };
      
      // P3 以下区域（偏低）- 浅红色
      ctx.fillStyle = `rgba(232, 160, 160, ${bandAlpha * 0.7})`;
      ctx.beginPath();
      let startedLow = false;
      months.forEach(month => {
        const yP3 = getY(month, 'p3');
        if (yP3 === null) return;
        const x = padding.left + (month / maxMonth) * chartWidth;
        if (!startedLow) { ctx.moveTo(x, yP3); startedLow = true; }
        else ctx.lineTo(x, yP3);
      });
      ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
      ctx.lineTo(padding.left, padding.top + chartHeight);
      ctx.closePath();
      ctx.fill();
      
      // P3-P15 区域（偏低正常）- 浅黄色/琥珀色
      drawBand('p3', 'p15', `rgba(212, 184, 150, ${bandAlpha})`);
      
      // P15-P85 区域（正常范围）- 浅绿色
      drawBand('p15', 'p85', `rgba(184, 212, 184, ${bandAlpha})`);
      
      // P85-P97 区域（偏高正常）- 浅黄色/琥珀色
      drawBand('p85', 'p97', `rgba(212, 184, 150, ${bandAlpha})`);
      
      // P97 以上区域（偏高）- 浅红色
      ctx.fillStyle = `rgba(232, 160, 160, ${bandAlpha * 0.7})`;
      ctx.beginPath();
      let startedHigh = false;
      months.forEach(month => {
        const yP97 = getY(month, 'p97');
        if (yP97 === null) return;
        const x = padding.left + (month / maxMonth) * chartWidth;
        if (!startedHigh) { ctx.moveTo(x, yP97); startedHigh = true; }
        else ctx.lineTo(x, yP97);
      });
      ctx.lineTo(padding.left + chartWidth, padding.top);
      ctx.lineTo(padding.left, padding.top);
      ctx.closePath();
      ctx.fill();
    }
    
    // 绘制WHO百分位曲线（所有数据类型统一风格）
    if (whoData) {
      const drawPercentileLine = (percentile, color, lineWidth = 1, dash = []) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dash);
        ctx.beginPath();
        
        let firstPoint = true;
        months.forEach((month) => {
          const data = whoData[month];
          if (!data) return;
          
          const value = data[percentile];
          const x = padding.left + (month / maxMonth) * chartWidth;
          const y = padding.top + (1 - (value - yMin) / (yMax - yMin)) * chartHeight;
          
          if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
          else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
      };
      
      // P3/P97 用偏红色虚线（强调警戒线）
      drawPercentileLine('p3', '#D4A0A0', 1, [4, 3]);
      drawPercentileLine('p97', '#D4A0A0', 1, [4, 3]);
      // P15/P85 用琥珀色虚线（关注线）
      drawPercentileLine('p15', '#C8B896', 1, [3, 3]);
      drawPercentileLine('p85', '#C8B896', 1, [3, 3]);
      // P50 中位线用更醒目的样式
      drawPercentileLine('p50', '#D4A574', 2);
      
      // 在曲线右侧标注百分位标签
      const lastMonth = 24;
      const lastData = whoData[lastMonth];
      if (lastData) {
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        
        const labels = [
          { key: 'p3',  text: 'P3',  color: '#C89898' },
          { key: 'p15', text: 'P15', color: '#B8A888' },
          { key: 'p50', text: 'P50', color: '#D4A574' },
          { key: 'p85', text: 'P85', color: '#B8A888' },
          { key: 'p97', text: 'P97', color: '#C89898' }
        ];
        
        // 计算标签 Y 坐标并处理重叠
        const labelPositions = labels.map(l => {
          const val = lastData[l.key];
          return {
            ...l,
            y: padding.top + (1 - (val - yMin) / (yMax - yMin)) * chartHeight
          };
        });
        
        // 防止标签重叠：确保相邻标签至少间隔 10px
        const minGap = 10;
        for (let i = labelPositions.length - 2; i >= 0; i--) {
          if (labelPositions[i].y - labelPositions[i + 1].y < minGap) {
            labelPositions[i].y = labelPositions[i + 1].y + minGap;
          }
        }
        
        const labelX = padding.left + chartWidth + 3;
        labelPositions.forEach(l => {
          ctx.fillStyle = l.color;
          ctx.fillText(l.text, labelX, l.y + 3);
        });
      }
    }
    
    // 绘制宝宝数据
    if (validPoints.length === 0) {
      // 显示无数据提示
      ctx.fillStyle = '#8B7B6B';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无有效数据', width / 2, height / 2);
      return;
    }
    
    // 绘制连接线（带阴影效果）
    ctx.strokeStyle = '#D4A574';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    validPoints.forEach((point, index) => {
      const x = padding.left + (point.monthAge / maxMonth) * chartWidth;
      const y = padding.top + (1 - (point.value - yMin) / (yMax - yMin)) * chartHeight;
      
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 绘制数据点（带白色轮廓和填充色）
    validPoints.forEach((point) => {
      const x = padding.left + (point.monthAge / maxMonth) * chartWidth;
      const y = padding.top + (1 - (point.value - yMin) / (yMax - yMin)) * chartHeight;
      
      // 外圈发光效果
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212, 165, 116, 0.2)';
      ctx.fill();
      
      // 白色轮廓
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      
      // 实心填充
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#D4A574';
      ctx.fill();
    });
    
    // 绘制坐标轴标签
    ctx.fillStyle = '#8B7B6B';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // X 轴标签：0-24 月，每 4 个月一个标签
    for (let i = 0; i <= 6; i++) {
      const month = Math.round((maxMonth / 6) * i);
      const x = padding.left + (chartWidth / 6) * i;
      ctx.fillText(`${month}月`, x, height - padding.bottom + 20);
    }
    
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = yMin + ((yMax - yMin) / 5) * (5 - i);
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText(`${value.toFixed(dataType === 'bmi' ? 1 : 0)}`, padding.left - 8, y + 4);
    }
  },

  onDataTypeChange(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ dataType: type }, () => {
      this.drawChart();
    });
  },

  calculatePercentile(data, timestamp) {
    if (!data) return {};
    
    const { baby } = this.data;
    if (!baby) return {};
    
    const gender = baby.gender === 'male' ? 'Boy' : 'Girl';
    const ageMonths = this.calculateRecordAgeMonths(timestamp);
    
    // BUG-18: WHO 数据覆盖 0-24 月
    if (ageMonths > 24) return {};
    
    let weightP = null, heightP = null, headP = null, bmiP = null;
    let weightLevel = '', heightLevel = '', headLevel = '', bmiLevel = '';
    let weightTip = '', heightTip = '', headTip = '', bmiTip = '';
    
    const weightData = gender === 'Boy' ? WHO_WEIGHT_BOY[ageMonths] : WHO_WEIGHT_GIRL[ageMonths];
    const heightData = gender === 'Boy' ? WHO_HEIGHT_BOY[ageMonths] : WHO_HEIGHT_GIRL[ageMonths];
    const headData = gender === 'Boy' ? WHO_HEAD_BOY[ageMonths] : WHO_HEAD_GIRL[ageMonths];
    const bmiWhoData = gender === 'Boy' ? WHO_BMI_BOY[ageMonths] : WHO_BMI_GIRL[ageMonths];
    
    if (data.weight && weightData) {
      weightP = this.getPercentile(data.weight, weightData);
      const level = this.getLevel(weightP);
      weightLevel = level.level;
      weightTip = level.tip;
    }
    
    if (data.height && heightData) {
      heightP = this.getPercentile(data.height, heightData);
      const level = this.getLevel(heightP);
      heightLevel = level.level;
      heightTip = level.tip;
    }
    
    if (data.headCircumference && headData) {
      headP = this.getPercentile(data.headCircumference, headData);
      const level = this.getLevel(headP);
      headLevel = level.level;
      headTip = level.tip;
    }
    
    // BMI 百分位计算
    if (data.weight && data.height && bmiWhoData) {
      const bmi = this.calculateBMI(data.weight, data.height);
      if (bmi) {
        bmiP = this.getPercentile(bmi, bmiWhoData);
        const level = this.getLevel(bmiP);
        bmiLevel = level.level;
        bmiTip = level.tip;
      }
    }
    
    return { weightP, heightP, headP, bmiP, weightLevel, heightLevel, headLevel, bmiLevel, weightTip, heightTip, headTip, bmiTip };
  },

  getPercentile(value, whoData) {
    if (value <= whoData.p3) return 3;
    if (value <= whoData.p15) return 15;
    if (value <= whoData.p50) return 50;
    if (value <= whoData.p85) return 85;
    return 97;
  },

  getLevel(percentile) {
    if (percentile <= 3) return { level: 'low', tip: '偏低' };
    if (percentile <= 15) return { level: 'below-normal', tip: '偏低正常' };
    if (percentile <= 85) return { level: 'normal', tip: '正常' };
    return { level: 'high', tip: '偏高' };
  },

  calculateEvaluation(latestData) {
    if (!latestData || !latestData.percentile) {
      return { level: 'normal', iconType: 'status', iconName: 'info', text: '暂无数据，请添加生长记录' };
    }
    
    const p = latestData.percentile;
    const issues = [];
    
    if (p.weightLevel === 'low' || p.weightLevel === 'high') {
      issues.push('体重');
    }
    if (p.heightLevel === 'low' || p.heightLevel === 'high') {
      issues.push('身高');
    }
    if (p.headLevel === 'low' || p.headLevel === 'high') {
      issues.push('头围');
    }
    
    // 检查 BMI
    if (latestData.bmi) {
      if (latestData.bmiLevel === 'low' || latestData.bmiLevel === 'high') {
        issues.push('BMI');
      }
    }
    
    if (issues.length === 0) {
      return { level: 'normal', iconType: 'status', iconName: 'success', text: '发育评估: 各项指标均处于正常范围' };
    } else if (issues.length === 1) {
      return { level: 'attention', iconType: 'status', iconName: 'warning', text: `${issues[0]}数据需关注，建议持续监测` };
    } else {
      return { level: 'attention', iconType: 'status', iconName: 'warning', text: `多项指标需关注（${issues.join('、')}），建议咨询医生` };
    }
  },

  /**
   * 计算 BMI
   * @param {number} weight 体重(kg)
   * @param {number} height 身高(cm)
   * @returns {number} BMI值（数字，非字符串）
   */
  calculateBMI(weight, height) {
    if (!weight || !height || height <= 0) return null;
    // BMI = 体重(kg) / 身高(m)²
    const heightInMeters = height / 100;
    // BUG-17: toFixed 返回字符串，需要 parseFloat 转为数字
    return parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
  },

  /**
   * 获取 BMI 评估（基于 WHO BMI-for-age 标准）
   * @param {number} bmi BMI值
   * @param {number} ageMonths 月龄
   * @returns {object} BMI评估结果
   */
  getBMIEvaluation(bmi, ageMonths) {
    if (!bmi) return { status: '--', level: 'normal', tip: '暂无数据', percentile: null };
    
    const { baby } = this.data;
    const gender = baby ? (baby.gender === 'male' ? 'Boy' : 'Girl') : 'Boy';
    
    // 使用 WHO BMI-for-age 标准数据进行评估
    const bmiData = gender === 'Boy' ? WHO_BMI_BOY[ageMonths] : WHO_BMI_GIRL[ageMonths];
    
    if (!bmiData) {
      // 无对应月龄的 WHO 数据，返回无法评估
      return { status: '--', level: 'normal', tip: '超出评估范围', percentile: null };
    }
    
    // 复用已有的百分位和等级判定逻辑
    const percentile = this.getPercentile(bmi, bmiData);
    const levelInfo = this.getLevel(percentile);
    
    // 根据百分位生成更具体的 BMI 评估文案
    let status, tip;
    if (percentile <= 3) {
      status = '偏瘦';
      tip = 'BMI 偏低（<P3），建议增加营养摄入，关注喂养';
    } else if (percentile <= 15) {
      status = '正常偏瘦';
      tip = 'BMI 正常偏低（P3-P15），保持均衡营养';
    } else if (percentile <= 85) {
      status = '正常';
      tip = 'BMI 处于正常范围（P15-P85）';
    } else if (percentile <= 97) {
      status = '正常偏胖';
      tip = 'BMI 正常偏高（P85-P97），注意饮食均衡';
    } else {
      status = '偏胖';
      tip = 'BMI 偏高（>P97），建议咨询医生调整喂养方案';
    }
    
    return { status, level: levelInfo.level, tip, percentile };
  },

  calculateAgeMonths(birthDate) {
    // WHO 数据覆盖 0-24 月，上限与 getWhoReference 对齐
    return calculateAgeMonths(birthDate, 24);
  },

  calculateRecordAgeMonths(timestamp) {
    if (!this.data.baby || !this.data.baby.birthDate) {
      console.error('宝宝信息不存在');
      return 0;
    }
    const birth = new Date(this.data.baby.birthDate);
    const record = new Date(timestamp);
    const months = (record.getFullYear() - birth.getFullYear()) * 12 + 
                   (record.getMonth() - birth.getMonth());
    // BUG-FIX: 与 calculateAgeMonths 保持一致的上限
    return Math.max(0, Math.min(24, months));
  },

  showAddPopup() {
    const today = formatDate(new Date());
    this.setData({
      showAddPopup: true,
      editingRecord: null,
      formData: {
        date: today,
        weight: '',
        height: '',
        headCircumference: '',
        note: ''
      }
    });
  },

  hideAddPopup() {
    this.setData({ showAddPopup: false });
  },

  showWhoDetail() {
    this.setData({ showWhoPopup: true });
  },

  hideWhoPopup() {
    this.setData({ showWhoPopup: false });
  },

  showRecordDetail(e) {
    const { index } = e.currentTarget.dataset;
    const record = this.data.growthRecords[index];
    this.setData({
      showDetailPopup: true,
      selectedRecord: record
    });
  },

  hideDetailPopup() {
    this.setData({ showDetailPopup: false });
  },

  onDateChange(e) {
    this.setData({ 'formData.date': e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ 'formData.weight': e.detail.value });
  },

  onHeightInput(e) {
    this.setData({ 'formData.height': e.detail.value });
  },

  onHeadInput(e) {
    this.setData({ 'formData.headCircumference': e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ 'formData.note': e.detail.value });
  },

  async saveGrowthData() {
    const { formData, baby, editingRecord } = this.data;
    
    if (!formData.weight && !formData.height && !formData.headCircumference) {
      wx.showToast({ title: '请至少填写一项数据', icon: 'none' });
      return;
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const date = new Date(formData.date);
      date.setHours(12, 0, 0, 0);
      
      const weight = formData.weight ? parseFloat(formData.weight) : null;
      const height = formData.height ? parseFloat(formData.height) : null;
      
      // 计算 BMI
      let bmi = null;
      if (weight && height) {
        bmi = parseFloat(this.calculateBMI(weight, height));
      }
      
      const recordService = RecordService.getInstance();
      const growthData = {
        weight: weight,
        height: height,
        headCircumference: formData.headCircumference ? parseFloat(formData.headCircumference) : null,
        bmi: bmi,
        note: formData.note
      };
      
      if (editingRecord) {
        // 更新已有记录
        await recordService.updateRecord(editingRecord._id, {
          recordType: 'growth',
          startTime: date,
          startTimeTs: date.getTime(),
          data: growthData
        });
      } else {
        // 创建新记录
        await recordService.createRecord({
          babyId: baby._id,
          recordType: 'growth',
          startTime: date,
          endTime: date,
          data: growthData
        });
      }
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      // 先关闭弹窗，再刷新数据
      this.setData({ showAddPopup: false }, () => {
        this.loadGrowthRecords();
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存生长数据失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  editRecord() {
    const { selectedRecord } = this.data;
    this.setData({
      showDetailPopup: false,
      showAddPopup: true,
      editingRecord: selectedRecord,
      formData: {
        date: selectedRecord.dateText,
        weight: selectedRecord.data.weight ? String(selectedRecord.data.weight) : '',
        height: selectedRecord.data.height ? String(selectedRecord.data.height) : '',
        headCircumference: selectedRecord.data.headCircumference ? String(selectedRecord.data.headCircumference) : '',
        note: selectedRecord.data.note || ''
      }
    });
  },

  async deleteRecord() {
    const { selectedRecord } = this.data;
    
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这条生长记录吗？',
      confirmColor: ThemeManager.getConfirmColor('danger')
    });
    
    if (!res.confirm) return;
    
    try {
      wx.showLoading({ title: '删除中...' });
      
      const recordService = RecordService.getInstance();
      await recordService.deleteRecord(selectedRecord._id);
      
      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
      
      this.setData({ showDetailPopup: false });
      this.loadGrowthRecords();
      
    } catch (error) {
      wx.hideLoading();
      console.error('删除记录失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  async onPullDownRefresh() {
    await this.loadGrowthRecords();
    wx.stopPullDownRefresh();
  },

  /** 应用当前主题 */
  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
    }
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
