/**
 * 生长数据录入弹窗组件
 * 从 pages/growth/growth.js 提取的添加数据弹窗
 * 
 * FR-9: 首页生长快捷入口使用
 */

const StorageUtil = require('../../utils/storage');
const RecordService = require('../../services/record');
const { formatDate, calculateAgeMonths } = require('../../utils/date');
const {
  WHO_WEIGHT_BOY, WHO_WEIGHT_GIRL,
  WHO_HEIGHT_BOY, WHO_HEIGHT_GIRL,
  WHO_HEAD_BOY, WHO_HEAD_GIRL
} = require('../../config/who-standards');
const swipeClose = require('../../behaviors/swipe-close');

Component({
  behaviors: [swipeClose],
  /**
   * 组件属性
   */
  properties: {
    // 是否显示弹窗
    show: {
      type: Boolean,
      value: false
    },
    darkMode: {
      type: Boolean,
      value: false
    },
    // 宝宝 ID（可选，不传则使用当前宝宝）
    babyId: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件数据
   */
  data: {
    baby: null,
    formData: {
      date: '',
      weight: '',
      height: '',
      headCircumference: '',
      note: ''
    },
    weightRange: '',
    heightRange: '',
    headRange: '',
    saving: false
  },

  /**
   * 监听器
   */
  observers: {
    'show': function(show) {
      if (show) {
        this.initPopup();
      }
    }
  },

  lifetimes: {
    detached() {
      // 清理加载状态
      this.setData({ loading: false });
    }
  },

  /**
   * 组件方法
   */
  methods: {
    stopPropagation() {},
    /**
     * 初始化弹窗
     */
    initPopup() {
      // 获取宝宝信息
      let baby;
      if (this.properties.babyId) {
        // 通过 babyId 获取宝宝信息
        const familyInfo = StorageUtil.getFamilyInfo();
        baby = familyInfo?.babies?.find(b => b._id === this.properties.babyId);
      }
      if (!baby) {
        baby = StorageUtil.getCurrentBaby();
      }
      
      if (!baby) {
        wx.showToast({ title: '未找到宝宝信息', icon: 'none' });
        this.triggerEvent('close');
        return;
      }

      const today = formatDate(new Date());
      
      // 更新参考范围
      const ageMonths = calculateAgeMonths(baby.birthDate);
      const gender = baby.gender === 'male' ? 'Boy' : 'Girl';
      
      // BUG-18: WHO 数据覆盖 0-24 月
      const weightData = ageMonths <= 24 ? 
        (gender === 'Boy' ? WHO_WEIGHT_BOY[ageMonths] : WHO_WEIGHT_GIRL[ageMonths]) : null;
      const heightData = ageMonths <= 24 ?
        (gender === 'Boy' ? WHO_HEIGHT_BOY[ageMonths] : WHO_HEIGHT_GIRL[ageMonths]) : null;
      const headData = ageMonths <= 24 ?
        (gender === 'Boy' ? WHO_HEAD_BOY[ageMonths] : WHO_HEAD_GIRL[ageMonths]) : null;

      this.setData({
        baby,
        formData: {
          date: today,
          weight: '',
          height: '',
          headCircumference: '',
          note: ''
        },
        weightRange: weightData ? `P3: ${weightData.p3}kg - P97: ${weightData.p97}kg` : '参考范围超出',
        heightRange: heightData ? `P3: ${heightData.p3}cm - P97: ${heightData.p97}cm` : '参考范围超出',
        headRange: headData ? `P3: ${headData.p3}cm - P97: ${headData.p97}cm` : '参考范围超出',
        popupTranslateY: 0
      });
    },

    /**
     * 表单输入事件
     */
    onDateChange(e) {
      this.setData({ 'formData.date': e.detail.value });
    },

    onWeightInput(e) {
      this.setData({ 'formData.weight': e.detail.value });
    },

    onHeightInput(e) {
      this.setData({ 'formData.height': e.detail.value });
    },

    onHeadInput(e) {
      this.setData({ 'formData.headCircumference': e.detail.value });
    },

    onNoteInput(e) {
      this.setData({ 'formData.note': e.detail.value });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
    // behavior 会调用 this.close()，这里提供 close 方法
    close() {
      this.setData({ popupTranslateY: 0 });
      this.triggerEvent('close');
    },

    /**
     * 点击遮罩
     */
    onMaskTap() {
      this.close();
    },

    /**
     * 关闭弹窗（向后兼容旧引用）
     */
    onClose() {
      this.close();
    },

    /**
     * 保存数据
     */
    async onSave() {
      const { formData, baby, saving } = this.data;
      
      if (saving) return;
      
      if (!formData.weight && !formData.height && !formData.headCircumference) {
        wx.showToast({ title: '请至少填写一项数据', icon: 'none' });
        return;
      }
      
      this.setData({ saving: true });
      
      try {
        const date = new Date(formData.date);
        date.setHours(12, 0, 0, 0);
        
        const weight = formData.weight ? parseFloat(formData.weight) : null;
        const height = formData.height ? parseFloat(formData.height) : null;
        
        // 计算 BMI
        let bmi = null;
        if (weight && height && height > 0) {
          const heightInMeters = height / 100;
          bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
        }
        
        const recordService = RecordService.getInstance();
        await recordService.createRecord({
          babyId: baby._id,
          recordType: 'growth',
          startTime: date,
          endTime: date,
          data: {
            weight: weight,
            height: height,
            headCircumference: formData.headCircumference ? parseFloat(formData.headCircumference) : null,
            bmi: bmi,
            note: formData.note
          }
        });
        
        wx.showToast({ title: '保存成功', icon: 'success' });
        
        this.setData({ saving: false });
        this.triggerEvent('saved', { record: { recordType: 'growth' } });
        this.onClose();
        
      } catch (error) {
        console.error('保存生长数据失败:', error);
        wx.showToast({ title: '保存失败', icon: 'none' });
        this.setData({ saving: false });
      }
    }
  }
});
