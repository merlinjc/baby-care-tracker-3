/**
 * 排便记录弹窗组件
 * 支持排泄类型、质地、颜色记录，异常预警
 */

const RecordService = require('../../services/record');
const StorageUtil = require('../../utils/storage');

Component({
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

  data: {
    popupTranslateY: 0, // 弹窗滑动偏移量
    touchStartY: 0, // 触摸起始Y坐标
    diaperType: '', // pee | poop | both
    types: [
      { value: 'pee', label: '小便', iconUrl: '/images/icons/popup/diaper-pee.png' },
      { value: 'poop', label: '大便', iconUrl: '/images/icons/popup/diaper-poop.png' },
      { value: 'both', label: '混合', iconUrl: '/images/icons/popup/diaper-both.png' }
    ],
    
    // 质地（仅大便）
    consistency: '', // watery | soft | formed | hard
    consistencies: [
      { value: 'watery', label: '水样', desc: '可能腹泻' },
      { value: 'soft', label: '软便', desc: '正常' },
      { value: 'formed', label: '成型', desc: '正常' },
      { value: 'hard', label: '硬便', desc: '可能便秘' }
    ],
    
    // 颜色（仅大便）
    color: '', // normal | yellow | green | black | red
    colors: [
      { value: 'normal', label: '正常', color: '#D4A574' },
      { value: 'yellow', label: '黄色', color: '#FFC53D' },
      { value: 'green', label: '绿色', color: '#52C41A' },
      { value: 'black', label: '黑色', color: '#262626' },
      { value: 'red', label: '红色', color: '#FF4D4F' }
    ],
    
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
     * 选择排便类型
     */
    selectType(e) {
      const type = e.currentTarget.dataset.type;
      
      // 如果是小便，同时清空质地和颜色（合并为一次 setData）
      if (type === 'pee') {
        this.setData({
          diaperType: type,
          consistency: '',
          color: '',
          warning: null
        });
      } else {
        this.setData({ diaperType: type });
      }
      
      this.checkWarning();
    },

    /**
     * 选择质地
     */
    selectConsistency(e) {
      const consistency = e.currentTarget.dataset.value;
      this.setData({ consistency });
      this.checkWarning();
    },

    /**
     * 选择颜色
     */
    selectColor(e) {
      const color = e.currentTarget.dataset.value;
      this.setData({ color });
      this.checkWarning();
    },

    /**
     * 检查预警
     */
    async checkWarning() {
      const { diaperType, consistency, color } = this.data;
      
      // 如果是小便，不需要预警
      if (diaperType === 'pee') {
        this.setData({ warning: null });
        return;
      }
      
      // 检查质地 - 水样便需要检测连续性
      if (consistency === 'watery') {
        // 检测连续水样便
        const consecutiveWatery = await this.checkConsecutiveWatery();
        
        if (consecutiveWatery >= 2) {
          // 加上当前这次已经是第3次
          this.setData({
            warning: {
              type: 'danger',
              message: `检测到连续${consecutiveWatery + 1}次水样便，可能存在腹泻，建议立即就医！`
            }
          });
          return;
        }
        
        this.setData({
          warning: {
            type: 'warning',
            message: '水样便可能表示腹泻，请注意观察宝宝状态，如有持续请就医'
          }
        });
        return;
      }
      
      if (consistency === 'hard') {
        this.setData({
          warning: {
            type: 'warning',
            message: '硬便可能表示便秘，建议增加水分摄入'
          }
        });
        return;
      }
      
      // 检查颜色
      if (color === 'green') {
        this.setData({
          warning: {
            type: 'info',
            message: '绿色大便可能是正常现象，也可能是消化问题，请结合宝宝状态判断'
          }
        });
        return;
      }
      
      if (color === 'black') {
        this.setData({
          warning: {
            type: 'error',
            message: '黑色大便可能表示消化道出血，请立即就医'
          }
        });
        return;
      }
      
      if (color === 'red') {
        this.setData({
          warning: {
            type: 'error',
            message: '红色大便可能表示肠道出血，请立即就医'
          }
        });
        return;
      }
      
      // 没有预警
      this.setData({ warning: null });
    },

    /**
     * 检测连续水样便次数（最近24小时内）
     * 使用 RecordService 替代直接 db 查询，利用缓存
     */
    async checkConsecutiveWatery() {
      try {
        const currentBaby = StorageUtil.getCurrentBaby();
        if (!currentBaby) return 0;
        
        const recordService = RecordService.getInstance();
        const now = Date.now();
        const yesterday = now - 24 * 60 * 60 * 1000;
        
        const records = await recordService.getRecords(currentBaby._id, {
          recordType: 'diaper',
          startDate: yesterday,
          endDate: now,
          limit: 10
        });
        
        // 计算连续水样便次数
        let consecutiveCount = 0;
        for (const record of records) {
          if (record.data && record.data.consistency === 'watery') {
            consecutiveCount++;
          } else {
            break;
          }
        }
        
        return consecutiveCount;
      } catch (error) {
        console.error('检测连续水样便失败:', error);
        return 0;
      }
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
      if (!this.data.diaperType) {
        wx.showToast({
          title: '请选择排便类型',
          icon: 'none'
        });
        return;
      }

      // 如果是大便或混合，检查质地和颜色
      if (this.data.diaperType !== 'pee') {
        if (!this.data.consistency) {
          wx.showToast({
            title: '请选择大便质地',
            icon: 'none'
          });
          return;
        }
        
        if (!this.data.color) {
          wx.showToast({
            title: '请选择大便颜色',
            icon: 'none'
          });
          return;
        }
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
        const recordService = RecordService.getInstance();

        const data = {
          diaperType: this.data.diaperType
        };

        // 如果是大便或混合，添加质地和颜色
        if (this.data.diaperType !== 'pee') {
          data.consistency = this.data.consistency;
          data.color = this.data.color;
        }

        const recordData = {
          babyId: currentBaby._id,
          recordType: 'diaper',
          startTime: new Date(), // 显式设置开始时间
          data,
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
        console.error('创建排便记录失败:', error);
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
        diaperType: '',
        consistency: '',
        color: '',
        warning: null,
        note: '',
        popupTranslateY: 0
      });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
  }
});
