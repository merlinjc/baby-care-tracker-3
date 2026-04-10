/**
 * 发现页
 * 疫苗、生长、里程碑、AI 助手入口
 */

const { ICONS } = require('../../utils/icon-config');
const StorageUtil = require('../../utils/storage');
const todoService = require('../../services/todo');
const ThemeManager = require('../../utils/theme');
const shareBehavior = require('../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    currentBaby: null,
    menuItems: [
      {
        icon: ICONS.discover.vaccine,
        iconBg: ThemeManager.getColor('iconBgFeeding'),
        title: '疫苗追踪',
        subtitle: '接种记录、逾期提醒',
        url: '/packageGrowth/pages/vaccine/vaccine',
        badge: 0
      },
      {
        icon: ICONS.discover.growth,
        iconBg: ThemeManager.getColor('iconBgSleep'),
        title: '生长曲线',
        subtitle: 'WHO标准、百分位评估',
        url: '/packageGrowth/pages/growth/growth',
        badge: 0
      },
      {
        icon: ICONS.discover.milestone,
        iconBg: ThemeManager.getColor('iconBgDiaper'),
        title: '发育里程碑',
        subtitle: 'WHO/CDC标准对照',
        url: '/packageGrowth/pages/milestone/milestone',
        badge: 0
      },
      {
        icon: ICONS.discover.ai,
        iconBg: ThemeManager.getColor('iconBgAi'),
        title: 'AI育儿助手',
        subtitle: '智能问答、专业建议',
        url: '/packageSocial/pages/ai-assistant/ai-assistant',
        badge: 0
      }
    ],
    todoStats: {
      total: 0,
      vaccine: 0,
      milestone: 0,
      overdue: 0
    },
    showInfoPopup: false,
    infoPopupData: {
      title: '',
      source: '',
      scope: '',
      usage: '',
      note: ''
    }
  },

  onLoad() {
    this._lastLoadTime = 0;
    this.init();
  },

  onShow() {
    this._applyTheme();
    // NFR-1: 30秒节流，避免 Tab 切换频繁查询
    const now = Date.now();
    if (this._lastLoadTime && now - this._lastLoadTime < 30000) return;
    this._lastLoadTime = now;
    this.loadTodoStats();
  },

  /**
   * 初始化
   */
  init() {
    const currentBaby = StorageUtil.getCurrentBaby();
    if (!currentBaby) {
      // BUG-22: 先提示用户再跳转
      wx.showToast({ title: '请先添加宝宝信息', icon: 'none' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/baby-create/baby-create' });
      }, 1500);
      return;
    }
    this.setData({ currentBaby });
  },

  /**
   * 加载待办统计（使用 TodoService）
   */
  async loadTodoStats() {
    try {
      const baby = this.data.currentBaby;
      if (!baby) return;
      
      // 使用 TodoService 获取待办统计（内置 30s 缓存）
      const todoStats = await todoService.getTodoStats(baby);
      
      // 更新菜单徽章
      const menuItems = this.data.menuItems.map(item => {
        if (item.url === '/packageGrowth/pages/vaccine/vaccine') {
          return { ...item, badge: todoStats.vaccine };
        }
        if (item.url === '/packageGrowth/pages/milestone/milestone') {
          return { ...item, badge: todoStats.milestone };
        }
        return item;
      });
      
      this.setData({ todoStats, menuItems });
    } catch (error) {
      console.error('加载待办统计失败:', error);
    }
  },

  /**
   * 跳转到功能页面
   */
  goToPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },

  /**
   * 快捷跳转
   */
  goToVaccine() {
    wx.navigateTo({ url: '/packageGrowth/pages/vaccine/vaccine' });
  },

  goToMilestone() {
    wx.navigateTo({ url: '/packageGrowth/pages/milestone/milestone' });
  },

  /**
   * 显示专业参考信息
   */
  showWhoInfo() {
    this.setData({
      showInfoPopup: true,
      infoPopupData: {
        title: 'WHO 儿童生长标准',
        source: '世界卫生组织（WHO）2006年发布的儿童生长标准，基于多中心生长参考研究（MGRS）',
        scope: '适用于0-5岁儿童，涵盖体重、身高/身长、头围、BMI等指标',
        usage: '用于评估儿童生长发育状况，判断是否处于正常范围（P3-P97）',
        note: '该标准基于母乳喂养婴儿制定，更符合婴儿自然生长规律。百分位参考线：P3（偏低）、P15、P50（中位）、P85、P97（偏高）'
      }
    });
  },

  showCdcInfo() {
    this.setData({
      showInfoPopup: true,
      infoPopupData: {
        title: 'CDC 发育里程碑',
        source: '美国疾病控制与预防中心（CDC）儿童发育指南',
        scope: '涵盖0-5岁儿童大运动、精细动作、语言、社交、认知五大发育领域',
        usage: '用于追踪儿童发育里程碑达成情况，及早发现发育迟缓迹象',
        note: '里程碑达成时间存在个体差异，时间窗口内的达成均属正常。如逾期未达成，建议咨询儿科医生'
      }
    });
  },

  showChinaInfo() {
    this.setData({
      showInfoPopup: true,
      infoPopupData: {
        title: '国家免疫规划',
        source: '中国疾病预防控制中心《国家免疫规划疫苗儿童免疫程序（2025年版）》',
        scope: '涵盖0-6岁儿童国家免疫规划疫苗，包括卡介苗、乙肝疫苗、脊灰疫苗等',
        usage: '指导家长按时带宝宝接种疫苗，建立免疫保护',
        note: '接种时间可适当调整，但应尽量按时完成。如有感冒、发烧等症状，应推迟接种'
      }
    });
  },

  hideInfoPopup() {
    this.setData({ showInfoPopup: false });
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
