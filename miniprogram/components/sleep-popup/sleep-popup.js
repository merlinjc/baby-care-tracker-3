/**
 * 睡眠记录弹窗组件
 * 支持日间/夜间睡眠记录，智能判断睡眠类型
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
        // 初始化表单数据
        this.setData({ 
          sleepMode: 'record', // record | tracking
          duration: 0,
          durationDisplay: '0小时0分钟'
        });
      }
    }
  },

  data: {
    // [v4.3.2 FR-A2] popupTranslateY 由 swipe-close behavior 提供；touchStartY 改为实例属性 _touchStartY
    sleepMode: 'record', // record: 记录模式, tracking: 追踪模式（正在睡眠）
    sleepType: '', // night | nap - 留空表示自动判断
    sleepTypes: [
      { value: '', label: '自动判断', iconUrl: '/images/icons/popup/sleep-auto.png' },
      { value: 'night', label: '夜间睡眠', iconUrl: '/images/icons/popup/sleep-night.png' },
      { value: 'nap', label: '日间小睡', iconUrl: '/images/icons/popup/sleep-nap.png' }
    ],
    
    // 快捷时长选项（分钟）
    quickDurations: [15, 30, 60, 90, 120, 180],
    
    duration: 0, // 累计时长（秒）
    durationDisplay: '0小时0分钟',
    
    // 追踪模式相关
    trackingStartTime: null,
    trackingDisplay: '00:00:00',
    trackingInterval: null,
    
    location: '', // 睡眠地点
    locations: ['小床', '大床', '婴儿车', '摇篮', '其他'],
    
    note: '',
    loading: false
  },

  methods: {
    /**
     * 打开弹窗（通过父组件设置 show=true 触发）
     */
    open() {
      // 此方法保留用于向后兼容，但实际由 observer 处理
    },

    /**
     * 关闭弹窗
     */
    close() {
      // 如果正在追踪，提示用户
      if (this.data.trackingStartTime) {
        wx.showModal({
          title: '正在追踪睡眠',
          content: '是否要放弃本次追踪？',
          success: (res) => {
            if (res.confirm) {
              this.stopTracking();
              this.resetForm();
              this.triggerEvent('close');
            }
          }
        });
      } else {
        this.resetForm();
        this.triggerEvent('close');
      }
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
     * 选择睡眠类型
     */
    selectSleepType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ sleepType: type });
    },

    /**
     * 切换睡眠模式
     */
    switchMode(e) {
      const mode = e.currentTarget.dataset.mode;
      if (mode === 'tracking') {
        this.startTracking();
      }
      this.setData({ sleepMode: mode });
    },

    /**
     * 选择快捷时长（累加模式）
     */
    selectQuickDuration(e) {
      const minutes = e.currentTarget.dataset.minutes;
      const newDuration = this.data.duration + minutes * 60;
      
      // 内联计算显示文本，合并为一次 setData
      const h = Math.floor(newDuration / 3600);
      const m = Math.floor((newDuration % 3600) / 60);

      this.setData({ 
        duration: newDuration,
        durationDisplay: `${h}小时${m}分钟`
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
        durationDisplay: '0小时0分钟'
      });
      wx.vibrateShort({ type: 'light' });
    },

    /**
     * 更新时长显示
     */
    updateDurationDisplay() {
      const { duration } = this.data;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      this.setData({
        durationDisplay: `${hours}小时${minutes}分钟`
      });
    },

    /**
     * 开始追踪睡眠
     */
    startTracking() {
      const now = new Date();
      
      const interval = setInterval(() => {
        if (!this.data.trackingStartTime) return;
        const elapsed = Math.floor((Date.now() - this.data.trackingStartTime.getTime()) / 1000);
        this.setData({
          trackingDisplay: this.formatDurationHMS(elapsed)
        });
      }, 5000);

      this.setData({
        trackingStartTime: now,
        trackingDisplay: '00:00:00',
        trackingInterval: interval
      });
    },

    /**
     * 结束追踪并保存
     */
    async finishTracking() {
      if (!this.data.trackingStartTime) return;
      
      const now = new Date();
      const start = this.data.trackingStartTime;
      const duration = Math.floor((now.getTime() - start.getTime()) / 1000);
      
      // 内联计算显示文本，合并为一次 setData
      const h = Math.floor(duration / 3600);
      const m = Math.floor((duration % 3600) / 60);

      this.setData({
        duration,
        sleepMode: 'record',
        durationDisplay: `${h}小时${m}分钟`
      });
      
      this.stopTracking();
    },

    /**
     * 停止追踪
     */
    stopTracking() {
      if (this.data.trackingInterval) {
        clearInterval(this.data.trackingInterval);
      }
      this.setData({
        trackingInterval: null,
        trackingStartTime: null,
        trackingDisplay: '00:00:00'
      });
    },

    /**
     * 格式化时长（时:分:秒）
     */
    formatDurationHMS(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * 选择睡眠地点
     */
    selectLocation(e) {
      const location = e.currentTarget.dataset.location;
      this.setData({ location });
    },

    /**
     * 输入备注
     */
    onNoteInput(e) {
      this.setData({ note: e.detail.value });
    },

    /**
     * 智能判断睡眠类型
     */
    determineSleepType() {
      if (this.data.sleepType) return this.data.sleepType;

      const now = new Date();
      const startHour = now.getHours();

      // 判断是否为夜间睡眠
      // 规则：开始时间在 19:00-23:59 或 00:00-06:59，且时长超过 4 小时
      const isNightTime = (startHour >= 19 || startHour < 7);
      const isLongSleep = this.data.duration >= 4 * 3600;

      if (isNightTime && isLongSleep) {
        return 'night';
      }

      return 'nap';
    },

    /**
     * 提交记录
     */
    async submit() {
      // 验证数据
      if (this.data.duration <= 0) {
        wx.showToast({
          title: '请选择睡眠时长',
          icon: 'none'
        });
        return;
      }

      this.setData({ loading: true });

      try {
        const currentBaby = StorageUtil.getCurrentBaby();
        const recordService = new RecordService();

        // 基于累计时长计算开始和结束时间（结束时间为当前时间）
        const now = new Date();
        const startDateTime = new Date(now.getTime() - this.data.duration * 1000);

        const sleepType = this.determineSleepType();

        const recordData = {
          babyId: currentBaby._id,
          recordType: 'sleep',
          startTime: startDateTime,
          endTime: now,
          data: {
            sleepType,
            duration: this.data.duration,
            location: this.data.location
          }
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
        console.error('创建睡眠记录失败:', error);
        wx.showToast({
          title: error.message || '记录失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    },

    /**
     * 格式化日期
     */
    formatDate(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    /**
     * 格式化时间
     */
    formatTime(date) {
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      return `${hour}:${minute}`;
    },

    /**
     * 重置表单
     */
    resetForm() {
      this.stopTracking();
      this.setData({
        sleepType: '',
        sleepMode: 'record',
        duration: 0,
        durationDisplay: '0小时0分钟',
        location: '',
        popupTranslateY: 0
      });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
  },

  lifetimes: {
    detached() {
      // 清理追踪定时器
      if (this.data.trackingInterval) {
        clearInterval(this.data.trackingInterval);
      }
    }
  }
});
