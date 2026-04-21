/**
 * AI 服务
 * 使用 CloudBase AI Models 实现智能育儿助手
 */

let instance = null;

class AIService {
  constructor() {
    if (instance) return instance;
    this.ai = wx.cloud.extend.AI;
    // createModel 接收 provider 名；具体模型名（如 hunyuan-2.0-instruct-20251111）
    // 在 generateText / streamText 调用时通过 data.model 指定。
    this.model = this.ai.createModel('hunyuan');
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new AIService();
    return instance;
  }

  /**
   * 生成文本（非流式）
   * @param {string} prompt 用户输入
   * @param {string} context 系统提示词
   * @returns {Promise<string>} 生成的文本
   */
  async generateText(prompt, context) {
    try {
      const messages = context
        ? [
            { role: 'system', content: context },
            { role: 'user', content: prompt }
          ]
        : [{ role: 'user', content: prompt }];

      const res = await this.model.generateText({
        model: 'hunyuan-2.0-instruct-20251111',
        messages
      });

      return res.choices[0].message.content;
    } catch (error) {
      console.error('AI 生成文本失败:', error);
      throw error;
    }
  }

  /**
   * 流式生成文本
   * @param {string} prompt 用户输入
   * @param {string} context 系统提示词
   * @param {Object} callbacks 回调函数
   * @returns {Promise<void>}
   */
  async streamText(prompt, context, callbacks = {}) {
    try {
      const messages = context
        ? [
            { role: 'system', content: context },
            { role: 'user', content: prompt }
          ]
        : [{ role: 'user', content: prompt }];

      await this.model.streamText({
        data: {
          model: 'hunyuan-2.0-instruct-20251111',
          messages
        },
        onText: callbacks.onText,
        onEvent: callbacks.onEvent,
        onFinish: callbacks.onFinish
      });
    } catch (error) {
      console.error('AI 流式生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成喂养建议
   * @param {number} babyAge 宝宝月龄
   * @param {Array} feedingRecords 喂养记录
   * @param {Object} babyInfo 宝宝信息
   * @returns {Promise<string>} 建议内容
   */
  async generateFeedingAdvice(babyAge, feedingRecords, babyInfo) {
    const context = `你是一位专业的育儿顾问，请根据宝宝的喂养记录提供专业建议。
宝宝信息：
- 昵称：${babyInfo.name}
- 月龄：${babyAge}个月
- 性别：${babyInfo.gender === 'male' ? '男' : '女'}
`;

    const recordsSummary = this.summarizeFeedingRecords(feedingRecords);
    const prompt = `以下是宝宝近期的喂养记录：
${recordsSummary}

请分析宝宝的喂养情况，并提供：
1. 喂养频率是否合理
2. 喂养量是否充足
3. 喂养时间是否规律
4. 具体改进建议`;

    return await this.generateText(prompt, context);
  }

  /**
   * 生成睡眠建议
   * @param {number} babyAge 宝宝月龄
   * @param {Array} sleepRecords 睡眠记录
   * @param {Object} babyInfo 宝宝信息
   * @returns {Promise<string>} 建议内容
   */
  async generateSleepAdvice(babyAge, sleepRecords, babyInfo) {
    const context = `你是一位专业的育儿顾问，请根据宝宝的睡眠记录提供专业建议。
宝宝信息：
- 昵称：${babyInfo.name}
- 月龄：${babyAge}个月
- 性别：${babyInfo.gender === 'male' ? '男' : '女'}
`;

    const recordsSummary = this.summarizeSleepRecords(sleepRecords);
    const prompt = `以下是宝宝近期的睡眠记录：
${recordsSummary}

请分析宝宝的睡眠情况，并提供：
1. 睡眠时长是否充足
2. 睡眠时间是否规律
3. 日间/夜间睡眠比例
4. 具体改进建议`;

    return await this.generateText(prompt, context);
  }

  /**
   * 汇总喂养记录
   */
  summarizeFeedingRecords(records) {
    const summary = {};
    const typeNames = { breast: '母乳', formula: '配方奶', solid: '辅食' };
    
    records.forEach(record => {
      const type = record.data.feedingType;
      if (!summary[type]) {
        summary[type] = { count: 0, totalAmount: 0 };
      }
      summary[type].count++;
      // 只统计有 amount 的记录
      if (record.data.amount) {
        summary[type].totalAmount += record.data.amount;
      }
    });

    return Object.entries(summary)
      .map(([type, data]) => {
        const typeName = typeNames[type] || type;
        return `- ${typeName}: ${data.count}次${data.totalAmount ? `, 总量${data.totalAmount}ml` : ''}`;
      })
      .join('\n');
  }

  /**
   * 汇总睡眠记录
   */
  summarizeSleepRecords(records) {
    // duration 存储的是秒，转换为分钟
    const totalSeconds = records.reduce((sum, record) => sum + (record.data.duration || 0), 0);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const avgMinutes = records.length > 0 ? Math.floor(totalMinutes / records.length) : 0;

    const hours = Math.floor(totalMinutes / 60);
    const remainMinutes = totalMinutes % 60;

    return `- 总记录数：${records.length}次
- 总睡眠时长：${hours}小时${remainMinutes > 0 ? remainMinutes + '分钟' : ''}
- 平均睡眠时长：${avgMinutes}分钟`;
  }
}

module.exports = AIService;
