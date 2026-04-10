/**
 * AI育儿助手页
 * AI问答、每日评估、智能建议
 */

const StorageUtil = require('../../../utils/storage');
const AIService = require('../../../services/ai');
const BabyService = require('../../../services/baby');
const QuotaService = require('../../../services/quota');
const ContentFilterService = require('../../services/content-filter');
const RecordService = require('../../../services/record');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    baby: null,
    messages: [],
    inputText: '',
    aiScore: 85,
    aiAnalysis: [],
    loading: false,
    isThinking: false, // AI思考中状态
    quotaInfo: {
      used: 0,
      remaining: 100,
      date: ''
    }
  },

  onLoad(options) {
    this._lastShowTime = 0;
    this.quotaService = new QuotaService();
    this.contentFilter = new ContentFilterService();
    
    // FR-14: 记录是否需要生成预置消息
    if (options.presetMsg === 'true') {
      this._generatePresetMsg = true;
    }
    
    this.loadBabyInfo();
    this.loadQuotaInfo();
  },

  onShow() {
    this._applyTheme();
    // 30s 节流：避免频繁切换重复加载
    const now = Date.now();
    if (this._lastShowTime && now - this._lastShowTime < 30000) return;
    this._lastShowTime = now;

    this.loadBabyInfo();
    this.loadQuotaInfo();
  },

  /**
   * 加载配额信息
   */
  loadQuotaInfo() {
    const quotaInfo = this.quotaService.getQuotaInfo();
    this.setData({ quotaInfo });
  },

  /**
   * 加载宝宝信息
   */
  async loadBabyInfo() {
    try {
      // 先尝试从本地存储获取
      let baby = StorageUtil.getCurrentBaby();
      
      // 检查本地存储的宝宝信息是否完整
      const isBabyInfoValid = baby && baby._id && baby.name && baby.birthDate && baby.gender;
      
      if (!isBabyInfoValid) {
        // 尝试从数据库加载
        const familyInfo = StorageUtil.getFamilyInfo();
        
        if (familyInfo && familyInfo._id) {
          const babyService = new BabyService();
          const babies = await babyService.getBabiesByFamilyId(familyInfo._id);
          
          if (babies.length > 0) {
            baby = babies[0];
            StorageUtil.saveCurrentBaby(baby);
          }
        }
      }
      
      this.setData({ baby });
      
      // 加载每日评估（在获取到宝宝信息后）
      if (baby && baby._id) {
        this.loadDailyAssessment();
        
        // FR-14: 如果需要生成预置消息
        if (this._generatePresetMsg) {
          this._generatePresetMsg = false;
          this.generatePresetMessage(baby);
        }
      }
    } catch (error) {
      console.error('[AI助手] 加载宝宝信息失败:', error);
    }
  },

  /**
   * 加载每日评估（使用 RecordService.getTodayStats 替代直接 DB 查询）
   */
  async loadDailyAssessment() {
    try {
      const baby = this.data.baby;
      if (!baby) return;

      // 复用 RecordService 的 getTodayStats（15s 缓存 + 离线降级 + 时间戳处理）
      const recordService = RecordService.getInstance();
      const stats = await recordService.getTodayStats(baby._id);

      // 转换为评估所需的格式
      const dailyStats = {
        feedingCount: stats.feeding.count,
        sleepHours: stats.sleep.totalDuration / 3600,
        diaperCount: stats.diaper.count
      };

      const analysis = this.generateAnalysis(dailyStats);
      const score = this.calculateScore(dailyStats);

      this.setData({ 
        aiScore: score,
        aiAnalysis: analysis
      });
    } catch (error) {
      console.error('[AI助手] 加载评估失败:', error);
    }
  },

  /**
   * 生成分析建议
   */
  generateAnalysis(stats) {
    const analysis = [];
    
    if (stats.feedingCount >= 6 && stats.feedingCount <= 8) {
      analysis.push('喂养频率正常');
    } else if (stats.feedingCount < 6) {
      analysis.push('建议增加喂养次数');
    } else {
      analysis.push('喂养次数偏多，注意观察');
    }

    // sleepHours 已经是小时
    if (stats.sleepHours >= 12 && stats.sleepHours <= 16) {
      analysis.push('睡眠时间充足');
    } else if (stats.sleepHours < 12) {
      analysis.push(`睡眠可延长${Math.ceil((12 - stats.sleepHours) * 60)}分钟`);
    }

    analysis.push('建议保持规律作息');

    return analysis;
  },

  /**
   * 计算评分
   */
  calculateScore(stats) {
    let score = 100;
    
    if (stats.feedingCount < 6) score -= 10;
    if (stats.feedingCount > 10) score -= 5;
    
    // sleepHours 已经是小时
    if (stats.sleepHours < 12) score -= Math.ceil(12 - stats.sleepHours) * 5;
    if (stats.sleepHours > 16) score -= 5;

    return Math.max(60, Math.min(100, score));
  },

  /**
   * 输入框变化
   */
  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  /**
   * 发送消息
   */
  async onSend() {
    const question = this.data.inputText.trim();
    if (!question || this.data.isThinking) return;

    // 1. 检查配额
    if (!this.quotaService.hasQuota()) {
      wx.showModal({
        title: '配额已用完',
        content: '您今天的AI助手使用次数已达上限（100次），请明天再来继续使用。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 2. 检查问题相关性
    const relevanceCheck = this.contentFilter.checkRelevance(question);
    if (!relevanceCheck.isRelevant) {
      wx.showModal({
        title: '问题与育儿无关',
        content: relevanceCheck.reason,
        showCancel: false,
        confirmText: '我知道了'
      });
      
      // 显示引导提示
      this.setData({
        inputText: '',
        showRelevanceTip: true
      });
      
      // 3秒后隐藏提示
      this._relevanceTipTimer = setTimeout(() => {
        this.setData({ showRelevanceTip: false });
      }, 3000);
      
      return;
    }

    // 添加用户消息
    const userMessage = { role: 'user', content: question };
    const messages = [...this.data.messages, userMessage];
    
    this.setData({
      messages,
      inputText: '',
      isThinking: true
    });

    // 滚动到底部
    this.scrollToBottom();

    try {
      // 创建AI服务实例
      const aiService = new AIService();
      
      // 构建系统提示词
      const context = this.buildSystemContext();
      
      // 先调用 AI，成功后再扣配额（避免 AI 失败时浪费配额）
      const reply = await aiService.generateText(question, context);
      
      // AI 调用成功，扣除配额
      this.quotaService.useQuota();
      this.loadQuotaInfo();
      
      // 添加AI回复消息
      const aiMessage = { role: 'assistant', content: reply };
      
      this.setData({
        messages: [...this.data.messages, aiMessage],
        isThinking: false
      });
      
      // 滚动到底部
      this.scrollToBottom();
      
    } catch (error) {
      console.error('AI回复失败:', error);
      
      // 降级处理：使用本地回复（不扣配额，路径更新语法）
      const fallbackReply = this.getFallbackReply(question);
      const aiMessage = { role: 'assistant', content: fallbackReply };
      const fallbackIdx = this.data.messages.length;
      
      this.setData({
        [`messages[${fallbackIdx}]`]: aiMessage,
        isThinking: false
      });
      
      // 滚动到底部
      this.scrollToBottom();
      
      wx.showToast({ title: '已切换到离线模式', icon: 'none', duration: 1500 });
    }
  },

  /**
   * 构建系统上下文
   */
  buildSystemContext() {
    const baby = this.data.baby;
    
    if (!baby) {
      return `你是一位专业的育儿顾问，请用简洁友好的语气回答家长的问题。

注意：当前未能获取到宝宝的基本信息（昵称、月龄、性别等），这可能是因为：
1. 用户还未添加宝宝信息
2. 数据加载出现问题

建议在回答时：
- 如果用户询问与月龄相关的建议，提示用户先确认宝宝月龄
- 提供通用的育儿建议时，说明不同月龄可能有差异
- 引导用户完善宝宝信息以获得更精准的建议

回复要简洁实用，避免过长。`;
    }
    
    const monthAge = this.calculateMonthAge(baby.birthDate);
    
    // 获取今日统计信息
    const todayStats = this.data.aiAnalysis || [];
    const statsText = todayStats.length > 0 ? `\n\n今日评估：\n- ${todayStats.join('\n- ')}` : '';
    
    return `你是一位专业的育儿顾问，请用简洁友好的语气回答家长的问题。

宝宝信息：
- 昵称：${baby.nickName || baby.name || '宝宝'}
- 月龄：${monthAge}个月
- 性别：${baby.gender === 'male' ? '男' : '女'}${statsText}

请根据宝宝的具体情况提供个性化的建议。回复要简洁实用，避免过长。`;
  },

  /**
   * 计算月龄
   */
  calculateMonthAge(birthDate) {
    if (!birthDate) return 0;
    
    const birth = new Date(birthDate);
    const now = new Date();
    
    if (isNaN(birth.getTime())) return 0;
    
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    return Math.max(0, months);
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    // 消息元素 ID 为 msg-0 到 msg-{length-1}
    // isThinking 时 "思考中" 元素 ID 为 msg-{length}
    const lastIndex = this.data.isThinking 
      ? this.data.messages.length     // 指向 thinking 元素
      : this.data.messages.length - 1; // 指向最后一条消息
    if (lastIndex < 0) return;
    this.setData({
      scrollToView: `msg-${lastIndex}`
    });
  },

  /**
   * 降级回复（离线模式）
   */
  getFallbackReply(question) {
    const q = question.toLowerCase();
    
    if (q.includes('喂养') || q.includes('吃奶') || q.includes('喂奶')) {
      return '根据宝宝当前月龄，建议每天喂养6-8次。如果是母乳喂养，按需喂养即可；如果是配方奶，每次约120-180ml。记得记录每次喂养情况哦！';
    }
    
    if (q.includes('睡眠') || q.includes('睡觉')) {
      return '宝宝这个月龄建议每天睡眠12-16小时，包括夜间睡眠和白天小睡。建立规律的作息时间有助于宝宝健康成长。';
    }
    
    if (q.includes('体温') || q.includes('发烧')) {
      return '宝宝正常体温范围是36.5-37.5℃。如果体温超过38℃，建议及时就医。平时可以定期测量体温并记录。';
    }
    
    if (q.includes('疫苗')) {
      return '疫苗接种是保护宝宝健康的重要措施。请按照疫苗接种计划按时接种，接种后注意观察宝宝反应。可以在"疫苗追踪"功能中查看接种计划。';
    }
    
    if (q.includes('发育') || q.includes('里程碑')) {
      return '每个宝宝的发育节奏不同。可以关注宝宝的抬头、翻身、独坐、爬行、站立等大运动发育。如有疑虑，建议咨询儿科医生。';
    }
    
    return '抱歉，AI服务暂时不可用。我可以用基础功能回答关于喂养、睡眠、体温、疫苗等问题，或者您可以稍后再试。';
  },

  /**
   * 快捷问题
   */
  onQuickQuestion(e) {
    const { question } = e.currentTarget.dataset;
    this.setData({ inputText: question }, () => {
      this.onSend();
    });
  },

  onUnload() {
    if (this._themeOff) this._themeOff();
    // 清理定时器
    if (this._relevanceTipTimer) {
      clearTimeout(this._relevanceTipTimer);
      this._relevanceTipTimer = null;
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadDailyAssessment();
    wx.stopPullDownRefresh();
  },

  /**
   * FR-14: 生成预置消息（从首页 AI 洞察跳转过来）
   */
  generatePresetMessage(baby) {
    const babyName = baby.nickName || baby.name || '宝宝';
    const presetQuestion = `请帮我分析一下${babyName}今天的各项记录情况，给我一些专业的建议。`;
    
    // 设置预置问题并自动发送
    this.setData({ inputText: presetQuestion }, () => {
      // 延迟发送，确保页面渲染完成
      setTimeout(() => {
        this.onSend();
      }, 500);
    });
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
});
