/**
 * 喂养记录弹窗组件
 * 支持母乳/配方奶/辅食记录，计时器功能
 *
 * [v4.3.2 FR-A2] 接入 swipe-close behavior
 * WXML 已绑定 bindtouchstart/move/end 但 JS 未实现 → 触发微信
 * "Component method not found" warning，下滑关闭手势失效。
 * 严格复用 baby-edit-popup 的 v4.3.1 修复模式。
 */

const RecordService = require('../../services/record');
const StorageUtil = require('../../utils/storage');
const swipeCloseBehavior = require('../../behaviors/swipe-close');

Component({
  behaviors: [swipeCloseBehavior],

  properties: {
    show: {
      type: Boolean,
      value: false
    },
    darkMode: {
      type: Boolean,
      value: false
    },
    babyId: {
      type: String,
      value: '',
      optionalTypes: [String, null]
    }
  },

  observers: {
    'show': function(show) {
      if (show) {
        this._loadRecentAmounts();
      }
    }
  },

  data: {
    // [v4.3.2 FR-A2] popupTranslateY 由 swipe-close behavior 提供；touchStartY 改为实例属性 _touchStartY
    recentAmounts: [], // v4.0: 常用量
    feedingType: 'breast', // breast | formula | solid
    feedingTypes: [
      { 
        value: 'breast', 
        label: '母乳', 
        iconUrl: '/images/icons/popup/feeding-bottle.png'
      },
      { 
        value: 'formula', 
        label: '配方奶', 
        iconUrl: '/images/icons/popup/feeding-bottle.png'
      },
      { 
        value: 'solid', 
        label: '辅食', 
        iconUrl: '/images/icons/popup/feeding-meal.png'
      }
    ],
    
    // 母乳相关
    breastSide: 'left', // left | right | both
    breastSides: [
      { value: 'left', label: '左侧' },
      { value: 'right', label: '右侧' },
      { value: 'both', label: '双侧' }
    ],
    
    // 配方奶相关
    quickAmounts: [10, 30, 60, 90, 120, 150, 180, 210], // 快捷用量选项（ml）
    amount: 0, // 累计喂养量 (ml)
    amountDisplay: '0ml', // 喂养量显示

    // 辅食相关
    solidAmount: '', // 辅食喂养量输入
    
    // 快捷时长选项（分钟）
    quickDurations: [5, 10, 15, 20, 30],

    // 累计时长（秒）
    duration: 0,
    durationDisplay: '0分钟',

    // 其他
    loading: false
  },

  lifetimes: {
    detached() {
      // 清理加载状态
      this.setData({ loading: false });
    }
  },

  methods: {
    /**
     * 打开弹窗
     */
    open() {
      this.setData({ show: true });
    },

    /**
     * 关闭弹窗
     */
    close() {
      this.resetForm();
      this.triggerEvent('close');
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 阻止事件冒泡
    },

    /**
     * 阻止滚动穿透
     */
    preventMove() {
      // 阻止滚动穿透
    },

    /**
     * 选择喂养类型
     */
    selectFeedingType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ 
        feedingType: type,
        amount: 0,
        amountDisplay: '0ml',
        solidAmount: '',
        duration: 0,
        durationDisplay: '0分钟',
        breastSide: 'left'
      });
    },

    /**
     * 选择母乳侧
     */
    selectBreastSide(e) {
      const side = e.currentTarget.dataset.side;
      this.setData({ breastSide: side });
    },

    /**
     * 选择快捷用量（累加模式）- 配方奶
     */
  // v4.0: 常用量快捷填入（直接设置而非累加）
  selectRecentAmount(e) {
    const amount = Number(e.currentTarget.dataset.amount) || 0;
    this.setData({
      amount,
      amountDisplay: `${amount}ml`
    });
  },

  // v4.0: 加载常用量
  _loadRecentAmounts() {
    if (!this.data.babyId) return;
    const key = `recent_formula_amounts_${this.data.babyId}`;
    const amounts = StorageUtil.get(key) || [];
    this.setData({ recentAmounts: [...new Set(amounts)].slice(0, 3) });
  },

  // v4.0: 保存常用量
  _saveRecentAmount(amount) {
    if (!amount || !this.data.babyId) return;
    const key = `recent_formula_amounts_${this.data.babyId}`;
    let amounts = StorageUtil.get(key) || [];
    amounts.unshift(amount);
    StorageUtil.set(key, [...new Set(amounts)].slice(0, 10));
  },

  selectQuickAmount(e) {
    const amount = Number(e.currentTarget.dataset.amount) || 0;
    const newAmount = this.data.amount + amount;

      this.setData({ 
        amount: newAmount,
        amountDisplay: `${newAmount}ml`
      });

      // 震动反馈
      wx.vibrateShort({ type: 'light' });
    },

    /**
     * 清零奶量
     */
    clearAmount() {
      this.setData({ 
        amount: 0,
        amountDisplay: '0ml'
      });
      wx.vibrateShort({ type: 'light' });
    },

    /**
     * 更新奶量显示
     */
    updateAmountDisplay() {
      const { amount } = this.data;
      this.setData({
        amountDisplay: `${amount}ml`
      });
    },

    /**
     * 输入喂养量 - 辅食
     */
    onAmountInput(e) {
      this.setData({ solidAmount: e.detail.value });
    },

    /**
     * 选择快捷时长（累加模式）
     */
    selectQuickDuration(e) {
      const minutes = e.currentTarget.dataset.minutes;
      const newDuration = this.data.duration + minutes * 60;

      // 内联计算显示文本，合并为一次 setData
      const totalMinutes = Math.floor(newDuration / 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const durationDisplay = h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;

      this.setData({ 
        duration: newDuration,
        durationDisplay
      });

      // 震动反馈
      wx.vibrateShort({ type: 'light' });
    },

    /**
     * 清零时长
     */
    clearDuration() {
      this.setData({ 
        duration: 0,
        durationDisplay: '0分钟'
      });
      wx.vibrateShort({ type: 'light' });
    },

    /**
     * 更新时长显示
     */
    updateDurationDisplay() {
      const { duration } = this.data;
      const totalMinutes = Math.floor(duration / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      let display = '';
      if (hours > 0) {
        display = `${hours}小时${minutes}分钟`;
      } else {
        display = `${minutes}分钟`;
      }

      this.setData({
        durationDisplay: display
      });
    },

    /**
     * 提交记录
     */
    async submit() {
      // 验证数据
      if (this.data.feedingType === 'formula') {
        if (!this.data.amount || this.data.amount <= 0) {
          wx.showToast({
            title: '请选择喂养量',
            icon: 'none'
          });
          return;
        }
      } else if (this.data.feedingType === 'solid') {
        if (!this.data.solidAmount || this.data.solidAmount <= 0) {
          wx.showToast({
            title: '请输入喂养量',
            icon: 'none'
          });
          return;
        }
      }

      this.setData({ loading: true });

      try {
        const currentBaby = StorageUtil.getCurrentBaby();
        const recordService = new RecordService();

        const recordData = {
          babyId: currentBaby._id,
          recordType: 'feeding',
          startTime: new Date(), // 显式设置开始时间
          data: {
            feedingType: this.data.feedingType
          }
        };

        // 根据喂养类型填充数据
        if (this.data.feedingType === 'breast') {
          recordData.data.breastSide = this.data.breastSide;
          if (this.data.duration > 0) {
            recordData.data.duration = this.data.duration;
          }
        } else if (this.data.feedingType === 'formula') {
          recordData.data.amount = this.data.amount;
          if (this.data.duration > 0) {
            recordData.data.duration = this.data.duration;
          }
        } else if (this.data.feedingType === 'solid') {
          recordData.data.amount = parseInt(this.data.solidAmount);
          if (this.data.duration > 0) {
            recordData.data.duration = this.data.duration;
          }
        }

        await recordService.createRecord(recordData);

        // 震动反馈
        wx.vibrateShort({
          type: 'heavy'
        });

        wx.showToast({
          title: '记录成功',
          icon: 'success'
        });

        // 通知父组件
        this.triggerEvent('created');

        // v4.0: 保存常用量
        if (this.data.feedingType === 'formula' && this.data.amount > 0) {
          this._saveRecentAmount(this.data.amount);
        }

        // 重置 loading 并关闭弹窗
        this.setData({ loading: false });
        this.resetForm();
        this.triggerEvent('close');
      } catch (error) {
        console.error('创建喂养记录失败:', error);
        wx.showToast({
          title: error.message || '记录失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    },

    /**
     * 重置表单
     */
    resetForm() {
      this.setData({
        feedingType: 'breast',
        breastSide: 'left',
        amount: 0,
        amountDisplay: '0ml',
        solidAmount: '',
        duration: 0,
        durationDisplay: '0分钟',
        popupTranslateY: 0
      });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
  }
});
