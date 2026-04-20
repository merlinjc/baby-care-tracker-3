/**
 * 待办服务 (TodoService)
 * 从 discover.js 提取的待办统计逻辑
 * 实现 30s 内存缓存，首页与发现页共享
 * 
 * FR-7: 今日待办卡片数据源
 */

const { calculateAgeMonths } = require('../utils/date');
const { fetchAll } = require('../utils/db-helper');
const FamilyContext = require('../utils/family-context');

// 单例实例
let instance = null;

class TodoService {
  constructor() {
    if (instance) return instance;
    
    this.db = wx.cloud.database();
    // 内存缓存：{ babyId, ts, data }
    this._cache = null;
    // 缓存有效期：30秒
    this.CACHE_TTL = 30000;
    
    instance = this;
  }

  static getInstance() {
    if (!instance) {
      instance = new TodoService();
    }
    return instance;
  }

  /**
   * 获取待办统计（带 30s 缓存）
   * @param {Object} baby - 宝宝对象，需包含 _id 和 birthDate
   * @returns {Promise<Object>} 待办统计
   *   - total: 总待办数
   *   - vaccine: 疫苗待接种数
   *   - milestone: 里程碑待达成数
   *   - overdue: 逾期数
   *   - vaccineItems: 疫苗待办详情列表（FR-7 卡片展示用）
   *   - milestoneItems: 里程碑待办详情列表（FR-7 卡片展示用）
   */
  async getTodoStats(baby) {
    if (!baby || !baby._id) {
      return this._emptyStats();
    }

    const now = Date.now();
    
    // 检查缓存是否有效
    if (this._cache && 
        this._cache.babyId === baby._id && 
        now - this._cache.ts < this.CACHE_TTL) {
      return this._cache.data;
    }

    // 计算新数据
    const data = await this._compute(baby);
    
    // 更新缓存
    this._cache = {
      babyId: baby._id,
      ts: now,
      data
    };

    return data;
  }

  /**
   * 强制刷新（跳过缓存）
   * @param {Object} baby - 宝宝对象
   * @returns {Promise<Object>} 待办统计
   */
  async forceRefresh(baby) {
    this._cache = null;
    return this.getTodoStats(baby);
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache = null;
  }

  /**
   * 返回空统计对象
   * @private
   */
  _emptyStats() {
    return {
      total: 0,
      vaccine: 0,
      milestone: 0,
      overdue: 0,
      vaccineItems: [],
      milestoneItems: []
    };
  }

  /**
   * 计算待办统计（核心逻辑，从 discover.js 迁移）
   * @private
   */
  async _compute(baby) {
    try {
      // 计算月龄
      const ageMonths = calculateAgeMonths(baby.birthDate);
      
      // 并行获取疫苗和里程碑数据
      const [vaccineResult, milestoneResult] = await Promise.all([
        this._computeVaccineStats(baby, ageMonths),
        this._computeMilestoneStats(baby, ageMonths)
      ]);

      return {
        total: vaccineResult.count + milestoneResult.count + vaccineResult.overdue,
        vaccine: vaccineResult.count,
        milestone: milestoneResult.count,
        overdue: vaccineResult.overdue,
        vaccineItems: vaccineResult.items,
        milestoneItems: milestoneResult.items
      };
    } catch (error) {
      console.error('[TodoService] 计算待办统计失败:', error);
      return this._emptyStats();
    }
  }

  /**
   * 计算疫苗待办
   * @private
   */
  async _computeVaccineStats(baby, ageMonths) {
    // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
    const vaccineRecords = await fetchAll(
      this.db.collection('vaccine_records').where({ babyId: baby._id, familyId: FamilyContext.resolveForBaby(baby) })
    );
    
    const vaccinePlans = this._getVaccinePlans(baby.birthDate);
    
    // Set 索引优化：避免 O(n*m) 遍历
    const doneSet = new Set(vaccineRecords.map(r => `${r.name}|${r.dose}`));
    
    let count = 0;
    let overdueCount = 0;
    const items = [];
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    vaccinePlans.forEach(plan => {
      // 只统计宝宝当前月龄已到达的疫苗
      if (plan.monthAge <= ageMonths) {
        plan.vaccines.forEach(v => {
          if (!doneSet.has(`${v.name}|${v.dose}`)) {
            count++;
            
            const plannedDate = new Date(v.plannedDate);
            const isOverdue = plannedDate < now;
            const isUpcoming = !isOverdue && plannedDate <= sevenDaysLater;
            
            if (isOverdue) {
              overdueCount++;
            }

            items.push({
              type: 'vaccine',
              name: v.name,
              dose: v.dose,
              plannedDate: v.plannedDate,
              isOverdue,
              isUpcoming,
              monthAge: plan.monthAge,
              ageLabel: plan.age
            });
          }
        });
      }
    });

    // 排序：逾期优先，然后按计划日期
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.plannedDate) - new Date(b.plannedDate);
    });

    return { count, overdue: overdueCount, items };
  }

  /**
   * 计算里程碑待办
   * @private
   */
  async _computeMilestoneStats(baby, ageMonths) {
    // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
    const milestoneRecords = await fetchAll(
      this.db.collection('milestone_records').where({ babyId: baby._id, familyId: FamilyContext.resolveForBaby(baby) })
    );
    
    const milestoneDefs = this._getMilestoneDefinitions();
    
    // Set 索引优化：避免 O(n*m) 遍历
    const doneSet = new Set(milestoneRecords.map(r => r.name));
    
    let count = 0;
    const items = [];

    milestoneDefs.forEach(def => {
      def.items.forEach(item => {
        // 只统计已到达警告月龄但未完成的里程碑
        if (!doneSet.has(item.name) && ageMonths >= item.warningMonths) {
          count++;
          items.push({
            type: 'milestone',
            name: item.name,
            category: def.category,
            warningMonths: item.warningMonths,
            // 超过警告月龄 2 个月视为逾期
            isOverdue: ageMonths >= item.warningMonths + 2
          });
        }
      });
    });

    // 排序：逾期优先，然后按警告月龄
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.warningMonths - b.warningMonths;
    });

    return { count, items };
  }

  /**
   * 获取疫苗计划（从 discover.js 迁移）
   * @private
   */
  _getVaccinePlans(birthDate) {
    const birth = new Date(birthDate);
    
    return [
      {
        age: '出生时',
        monthAge: 0,
        vaccines: [
          { name: '卡介苗', dose: '1剂', plannedDate: birth },
          { name: '乙肝疫苗', dose: '第1剂', plannedDate: birth }
        ]
      },
      {
        age: '1月龄',
        monthAge: 1,
        vaccines: [
          { name: '乙肝疫苗', dose: '第2剂', plannedDate: new Date(birth.getTime() + 30 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '2月龄',
        monthAge: 2,
        vaccines: [
          { name: '脊灰疫苗', dose: '第1剂', plannedDate: new Date(birth.getTime() + 60 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '3月龄',
        monthAge: 3,
        vaccines: [
          { name: '百白破疫苗', dose: '第1剂', plannedDate: new Date(birth.getTime() + 90 * 24 * 60 * 60 * 1000) },
          { name: '脊灰疫苗', dose: '第2剂', plannedDate: new Date(birth.getTime() + 90 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '4月龄',
        monthAge: 4,
        vaccines: [
          { name: '百白破疫苗', dose: '第2剂', plannedDate: new Date(birth.getTime() + 120 * 24 * 60 * 60 * 1000) },
          { name: '脊灰疫苗', dose: '第3剂', plannedDate: new Date(birth.getTime() + 120 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '5月龄',
        monthAge: 5,
        vaccines: [
          { name: '百白破疫苗', dose: '第3剂', plannedDate: new Date(birth.getTime() + 150 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '6月龄',
        monthAge: 6,
        vaccines: [
          { name: '乙肝疫苗', dose: '第3剂', plannedDate: new Date(birth.getTime() + 180 * 24 * 60 * 60 * 1000) },
          { name: '流脑A群', dose: '第1剂', plannedDate: new Date(birth.getTime() + 180 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '8月龄',
        monthAge: 8,
        vaccines: [
          { name: '麻腮风疫苗', dose: '第1剂', plannedDate: new Date(birth.getTime() + 240 * 24 * 60 * 60 * 1000) },
          { name: '乙脑减毒活疫苗', dose: '第1剂', plannedDate: new Date(birth.getTime() + 240 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '9月龄',
        monthAge: 9,
        vaccines: [
          { name: '流脑A群', dose: '第2剂', plannedDate: new Date(birth.getTime() + 270 * 24 * 60 * 60 * 1000) }
        ]
      },
      {
        age: '12月龄',
        monthAge: 12,
        vaccines: [
          { name: '乙脑减毒活疫苗', dose: '第2剂', plannedDate: new Date(birth.getTime() + 365 * 24 * 60 * 60 * 1000) }
        ]
      }
    ];
  }

  /**
   * 获取里程碑定义（从 discover.js 迁移）
   * @private
   */
  _getMilestoneDefinitions() {
    return [
      {
        category: '大运动',
        items: [
          { name: '抬头', warningMonths: 4 },
          { name: '翻身', warningMonths: 7 },
          { name: '独坐', warningMonths: 10 },
          { name: '爬行', warningMonths: 12 },
          { name: '扶站', warningMonths: 13 },
          { name: '独站', warningMonths: 18 },
          { name: '独走', warningMonths: 18 }
        ]
      },
      {
        category: '精细动作',
        items: [
          { name: '伸手抓物', warningMonths: 6 },
          { name: '传递物品', warningMonths: 8 },
          { name: '拇食指捏取', warningMonths: 12 },
          { name: '对敲积木', warningMonths: 14 }
        ]
      },
      {
        category: '语言',
        items: [
          { name: '发出咕咕声', warningMonths: 5 },
          { name: '咿呀学语', warningMonths: 8 },
          { name: '理解简单指令', warningMonths: 12 },
          { name: '有意识地叫人', warningMonths: 16 }
        ]
      },
      {
        category: '社交',
        items: [
          { name: '社会性微笑', warningMonths: 4 },
          { name: '认生', warningMonths: 10 },
          { name: '挥手再见', warningMonths: 14 },
          { name: '指物表达需求', warningMonths: 15 }
        ]
      }
    ];
  }
}

// 导出类（v4.3.0 FR-2：与其他服务单例模式统一）
// 调用方：TodoService.getInstance().xxx()
module.exports = TodoService;
