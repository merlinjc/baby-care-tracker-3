/**
 * 内容过滤服务
 * 检测问题是否与育儿相关
 * 
 * 设计原则：宽松判断，宁可放过也不误杀
 * 只有明确命中黑名单的内容才会被拦截
 */

let instance = null;

// 育儿相关关键词（扩展列表，用于正向匹配）—— 模块级常量，避免实例属性开销
const PARENTING_KEYWORDS = [
  // 喂养相关
  '喂', '喂养', '喂奶', '吃奶', '母乳', '配方奶', '奶粉', '辅食', '添加辅食',
  '断奶', '混合喂养', '溢奶', '吐奶', '打嗝', '拍嗝',
  '奶量', '毫升', '吃多少', '喂养次数', '喂养时间',
  
  // 睡眠相关
  '睡眠', '睡觉', '哄睡', '入睡', '夜醒', '作息', '小睡', '午睡',
  '睡眠时间', '睡多久', '睡眠质量', '睡姿',
  
  // 排泄相关
  '尿布', '纸尿裤', '拉臭臭', '大便', '小便', '排便', '换尿布',
  '腹泻', '便秘', '拉肚子', '绿色便便',
  
  // 健康相关
  '体温', '发烧', '发热', '感冒', '咳嗽', '流鼻涕', '鼻塞',
  '湿疹', '皮疹', '过敏', '红屁股', '尿布疹',
  '打疫苗', '疫苗', '接种', '预防针',
  '生病', '看医生', '用药', '吃药',
  
  // 发育相关
  '发育', '生长', '身高', '体重', '头围', '里程碑',
  '抬头', '翻身', '坐', '爬', '站', '走路', '说话',
  '大运动', '精细动作', '认知发育',
  
  // 护理相关
  '洗澡', '抚触', '按摩', '换衣服', '剪指甲', '清洁',
  '护肤', '保湿', '防晒',
  
  // 日常护理
  '哭', '安抚', '抱', '哄', '逗',
  '出门', '晒太阳', '户外', '散步',
  
  // 营养相关
  '营养', '维生素', 'dha', '钙', '铁', '锌',
  '缺钙', '缺铁', '贫血', '营养不良',
  
  // 早教相关
  '早教', '启蒙', '玩具', '游戏', '互动',
  '绘本', '阅读', '讲故事',
  
  // 安全相关
  '安全', '意外', '磕碰', '烫伤', '溺水', '窒息',
  '安全座椅', '防护',
  
  // 情绪行为
  '情绪', '脾气', '哭', '闹', '认生', '分离焦虑',
  
  // 成长阶段
  '新生儿', '婴儿', '幼儿', '宝宝', '孩子', '小孩',
  '月龄', '周岁', '年龄',
  
  // 其他育儿词汇
  '育儿', '带娃', '养娃', '宝妈', '宝爸', '家长', '父母',
  '幼儿园', '托班', '早教班',
  
  // 记录和分析相关（应用内操作）
  '记录', '分析', '建议', '情况', '数据', '统计', '报告',
  '今天', '今日', '昨天', '这周', '最近', '趋势',
  '帮我', '帮忙', '看看', '怎么样', '如何',
  
  // 常见称呼和昵称（宝宝名字可能包含）
  '小', '仔', '崽', '贝', '妞', '宝贝', '乖乖',
  
  // 问题咨询类
  '问题', '咨询', '请教', '求助', '想问', '想知道'
];

// 明显无关的话题关键词（黑名单）—— 模块级常量
const BLACKLIST_KEYWORDS = [
  // 娱乐八卦
  '明星八卦', '绯闻', '娱乐圈', '追星',
  
  // 游戏相关（排除儿童教育游戏）
  '游戏攻略', '通关攻略', '游戏皮肤', '抽卡', '王者荣耀', '原神', '吃鸡',
  '英雄联盟', 'DOTA', 'LOL',
  
  // 政治敏感
  '政治', '政府政策', '国际关系', '外交政策',
  
  // 投资理财
  '炒股', '股票分析', '基金推荐', '虚拟币', '比特币', '炒币',
  
  // 明显的闲聊（排除可能与孩子相关的）
  '讲笑话', '说相声', '讲段子', '陪我聊天',
  '写首诗', '写代码', '编程',
  
  // 成人话题
  '约会技巧', '相亲经验', '离婚',
  
  // 工作相关（非育儿工作）
  '面试技巧', '求职简历', '职场竞争', '跳槽',
  
  // 其他明显无关
  '旅游攻略', '健身计划', '减肥方法', '化妆教程'
];

class ContentFilterService {
  constructor() {
    if (instance) return instance;
    // 关键词引用模块级常量（兼容已有代码中 this.parentingKeywords 的引用）
    this.parentingKeywords = PARENTING_KEYWORDS;
    this.blacklistKeywords = BLACKLIST_KEYWORDS;
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new ContentFilterService();
    return instance;
  }

  /**
   * 检测问题是否与育儿相关
   * 
   * 判断策略：宽松判断，只在明确命中黑名单时拦截
   * 设计理念：宁可放过不相关的问题，也不要误杀育儿相关问题
   * 
   * @param {string} question 用户问题
   * @returns {Object} { isRelevant: boolean, reason: string }
   */
  checkRelevance(question) {
    const q = question.toLowerCase().trim();
    
    // 空问题直接通过
    if (!q || q.length === 0) {
      return { isRelevant: true, reason: '' };
    }
    
    // 1. 首先检查是否包含育儿相关关键词（正向匹配优先，.some() 短路）
    if (this.parentingKeywords.some(keyword => q.includes(keyword))) {
      // 包含育儿关键词，直接通过
      return { isRelevant: true, reason: '' };
    }
    
    // 2. 检查黑名单关键词（只有完全匹配黑名单词汇才拦截）
    const blacklistedWord = this.blacklistKeywords.find(keyword => q.includes(keyword));
    if (blacklistedWord) {
      return {
        isRelevant: false,
        reason: `您的问题涉及"${blacklistedWord}"，这与育儿无关。AI助手专注于提供专业的育儿建议。`
      };
    }
    
    // 3. 对于不在黑名单中的问题，采用宽松策略
    // 以下情况都默认认为是相关的：
    
    // 3.1 包含疑问词的问题（用户有明确的咨询意图）
    const questionWords = [
      '?', '？', '吗', '呢', '啊', '么',
      '怎么办', '怎么', '如何', '为什么', '什么', 
      '多少', '多久', '正常吗', '好吗', '可以吗',
      '应该', '需要', '能不能', '是不是', '有没有',
      '请问', '请教', '想问', '想知道'
    ];
    const hasQuestionWord = questionWords.some(word => q.includes(word));
    if (hasQuestionWord) {
      return { isRelevant: true, reason: '' };
    }
    
    // 3.2 中等长度的问题（完整的句子，可能是咨询）
    if (q.length >= 5 && q.length <= 100) {
      return { isRelevant: true, reason: '' };
    }
    
    // 3.3 简短问题（可能是追问或简单咨询）
    if (q.length < 5) {
      return { isRelevant: true, reason: '' };
    }
    
    // 4. 超长文本（可能是粘贴的无关内容），但仍然给予通过
    // 因为用户可能粘贴了大段的症状描述等
    return { isRelevant: true, reason: '' };
  }

  /**
   * 使用AI判断问题相关性（可选，作为备用方案）
   * @param {string} question 用户问题
   * @returns {Promise<Object>}
   */
  async checkRelevanceByAI(question) {
    // 这里可以使用轻量级的模型来判断
    // 暂时使用关键词匹配
    return this.checkRelevance(question);
  }
}

module.exports = ContentFilterService;
