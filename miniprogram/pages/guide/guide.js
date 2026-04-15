/**
 * 使用指南页
 * 功能介绍、操作说明
 */

const ThemeManager = require('../../utils/theme');
const shareBehavior = require('../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    guides: [
      {
        title: '快速开始',
        iconType: 'functional',
        iconName: 'rocket',
        items: [
          { title: '创建宝宝档案', desc: '首次使用时，请先创建宝宝的基本信息档案' },
          { title: '选择身份关系', desc: '设置您与宝宝的关系，方便家庭成员协作' },
          { title: '邀请家人', desc: '通过邀请码邀请家人一起记录宝宝成长' }
        ]
      },
      {
        title: '日常记录',
        iconType: 'functional',
        iconName: 'clipboard',
        items: [
          { title: '喂养记录', desc: '记录母乳、配方奶或辅食喂养情况' },
          { title: '睡眠记录', desc: '记录宝宝的睡眠时间和质量' },
          { title: '排便记录', desc: '记录大小便情况，关注消化健康' },
          { title: '体温记录', desc: '记录体温变化，异常时自动提醒' }
        ]
      },
      {
        title: '健康追踪',
        iconType: 'functional',
        iconName: 'syringe',
        items: [
          { title: '疫苗接种', desc: '按计划追踪疫苗接种情况，及时提醒' },
          { title: '生长曲线', desc: '记录身高体重，对照WHO标准评估' },
          { title: '发育里程碑', desc: '记录宝宝第一次翻身、坐、爬等重要时刻' }
        ]
      },
      {
        title: '家庭协作',
        iconType: 'functional',
        iconName: 'users',
        items: [
          { title: '家庭管理', desc: '管理家庭成员，设置权限' },
          { title: '数据同步', desc: '所有记录实时同步，家人共同查看' },
          { title: '数据导出', desc: '支持导出CSV或JSON格式数据' }
        ]
      },
      // [v4.1] AI 助手引导已屏蔽，保留代码待后续恢复
      // {
      //   title: 'AI助手',
      //   iconType: 'functional',
      //   iconName: 'robot',
      //   items: [
      //     { title: '智能问答', desc: '向AI助手咨询育儿问题' },
      //     { title: '每日评估', desc: 'AI根据记录数据给出健康评估和建议' }
      //   ]
      // }
    ]
  },

  async onLoad() {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
    
    // [v4.1] 轻量校验：等待 initUser 完成
    const app = getApp();
    if (app.globalData.initPromise) {
      await app.globalData.initPromise;
    }
  },

  /**
   * 返回首页
   */
  goToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
