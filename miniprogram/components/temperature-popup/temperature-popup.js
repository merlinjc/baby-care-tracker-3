/**
 * 体温记录弹窗组件
 * 支持体温测量记录，发烧分级预警
 *
 * [v4.3.2 FR-A2] 接入 swipe-close behavior
 * WXML 已绑定 bindtouchstart/move/end 但 JS 未实现 → 触发微信
 * "Component method not found" warning，下滑关闭手势失效。
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
        // 弹窗打开时的初始化
      }
    }
  },

  data: {
    // [v4.3.2 FR-A2] popupTranslateY 由 swipe-close behavior 提供；touchStartY 改为实例属性 _touchStartY
    temperature: '', // 体温值
    method: '', // armpit | ear | forehead | rectal
    methods: [
      { value: 'armpit', label: '腋下', iconUrl: '/images/icons/popup/temperature-thermometer.png' },
      { value: 'ear', label: '耳温', iconUrl: '/images/icons/popup/temperature-ear.png' },
      { value: 'forehead', label: '额温', iconUrl: '/images/icons/popup/temperature-forehead.png' },
      { value: 'rectal', label: '肛温', iconUrl: '/images/icons/popup/temperature-thermometer.png' }
    ],
    
    // 发热等级
    feverLevel: null,
    
    // 预警信息
    warning: null,
    
    note: '',
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
     * 体温输入
     */
    onTemperatureInput(e) {
      const temp = parseFloat(e.detail.value);
      
      if (!isNaN(temp)) {
        // 内联发热检查，合并为一次 setData
        const feverResult = this.getFeverResult(temp);
        this.setData({ 
          temperature: e.detail.value,
          feverLevel: feverResult.feverLevel,
          warning: feverResult.warning
        });
      } else {
        this.setData({ 
          temperature: e.detail.value,
          feverLevel: null,
          warning: null
        });
      }
    },

    /**
     * 选择测量方式
     */
    selectMethod(e) {
      const method = e.currentTarget.dataset.value;
      this.setData({ method });
    },

    /**
     * 计算发热等级（纯计算函数，不 setData）
     */
    getFeverResult(temp) {
      const baseTemp = this.data.method === 'armpit' ? temp : temp;
      
      let feverLevel = null;
      let warning = null;

      if (baseTemp < 36.0) {
        feverLevel = 'low';
        warning = {
          type: 'warning',
          message: '体温偏低，请注意保暖，如持续偏低请就医'
        };
      } else if (baseTemp >= 36.0 && baseTemp < 37.3) {
        feverLevel = 'normal';
        warning = null;
      } else if (baseTemp >= 37.3 && baseTemp < 38.0) {
        feverLevel = 'low-fever';
        warning = {
          type: 'info',
          message: '低热，建议多喝水、物理降温，密切观察'
        };
      } else if (baseTemp >= 38.0 && baseTemp < 39.0) {
        feverLevel = 'moderate-fever';
        warning = {
          type: 'warning',
          message: '中度发热，建议物理降温，必要时服用退烧药'
        };
      } else if (baseTemp >= 39.0 && baseTemp < 40.0) {
        feverLevel = 'high-fever';
        warning = {
          type: 'warning',
          message: '高热，建议立即服用退烧药，并观察宝宝状态'
        };
      } else if (baseTemp >= 40.0) {
        feverLevel = 'ultra-high-fever';
        warning = {
          type: 'error',
          message: '超高热，请立即就医！'
        };
      }

      return { feverLevel, warning };
    },

    /**
     * 检查发热等级（向后兼容，内部调用 getFeverResult）
     */
    checkFever(temp) {
      const { feverLevel, warning } = this.getFeverResult(temp);
      this.setData({ feverLevel, warning });
    },

    /**
     * 输入备注
     */
    onNoteInput(e) {
      this.setData({ note: e.detail.value });
    },

    /**
     * 提交记录
     */
    async submit() {
      // 验证数据
      if (!this.data.temperature) {
        wx.showToast({
          title: '请输入体温',
          icon: 'none'
        });
        return;
      }

      const temp = parseFloat(this.data.temperature);
      if (isNaN(temp) || temp < 35.0 || temp > 42.0) {
        wx.showToast({
          title: '请输入有效体温（35-42°C）',
          icon: 'none'
        });
        return;
      }

      if (!this.data.method) {
        wx.showToast({
          title: '请选择测量方式',
          icon: 'none'
        });
        return;
      }

      // 如果有严重预警，提示用户
      if (this.data.warning && this.data.warning.type === 'error') {
        const res = await new Promise((resolve) => {
          wx.showModal({
            title: '健康预警',
            content: this.data.warning.message,
            confirmText: '仍要记录',
            cancelText: '取消',
            success: (res) => {
              resolve(res.confirm);
            }
          });
        });
        
        if (!res) return;
      }

      this.setData({ loading: true });

      try {
        const currentBaby = StorageUtil.getCurrentBaby();
        const recordService = new RecordService();

        const recordData = {
          babyId: currentBaby._id,
          recordType: 'temperature',
          startTime: new Date(), // 显式设置开始时间
          data: {
            temperature: temp,
            method: this.data.method
          },
          note: this.data.note
        };

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

        // 重置 loading 并关闭弹窗
        this.setData({ loading: false });
        this.resetForm();
        this.triggerEvent('close');
      } catch (error) {
        console.error('创建体温记录失败:', error);
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
        temperature: '',
        method: '',
        feverLevel: null,
        warning: null,
        note: '',
        popupTranslateY: 0
      });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
  }
});
