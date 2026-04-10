/**
 * 编辑宝宝信息弹窗组件
 * 支持修改头像、姓名、出生日期
 */

const BabyService = require('../../services/baby');
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
    baby: {
      type: Object,
      value: null
    }
  },

  observers: {
    'show, baby': function(show, baby) {
      if (show && baby) {
        // 弹窗打开时，初始化表单数据
        this.setData({
          name: baby.name || '',
          birthDate: this.formatBirthDate(baby.birthDate) || '',
          avatar: baby.avatar || ''
        });
      }
    }
  },

  data: {
    popupTranslateY: 0,
    touchStartY: 0,
    name: '',
    birthDate: '',
    currentDate: '',
    avatar: '',
    uploading: false,
    loading: false
  },

  lifetimes: {
    attached() {
      // 设置当前日期
      const today = new Date();
      const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      this.setData({ currentDate });
    },
    detached() {
      // 清理上传和加载状态
      this.setData({ uploading: false, loading: false });
    }
  },

  methods: {
    /**
     * 格式化出生日期
     */
    formatBirthDate(birthDate) {
      if (!birthDate) return '';
      
      let date;
      if (birthDate instanceof Date) {
        date = birthDate;
      } else if (typeof birthDate === 'string') {
        date = new Date(birthDate);
      } else if (typeof birthDate === 'object') {
        date = new Date(birthDate);
      } else {
        return '';
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
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
    stopPropagation() {},

    /**
     * 阻止滚动穿透
     */
    preventMove() {},

    /**
     * 选择并上传头像
     */
    async onChooseAvatar() {
      if (this.data.uploading) return;

      try {
        const res = await wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed']
        });

        const tempFilePath = res.tempFiles[0].tempFilePath;

        // 显示上传状态
        this.setData({ uploading: true });

        // 上传头像
        const babyService = new BabyService();
        const avatarUrl = await babyService.uploadAvatar(this.data.baby._id, tempFilePath);

        // 更新页面数据
        this.setData({
          avatar: avatarUrl,
          uploading: false
        });

        wx.vibrateShort({ type: 'light' });
      } catch (error) {
        console.error('上传头像失败:', error);
        this.setData({ uploading: false });

        // 用户取消不提示错误
        if (error.errMsg && error.errMsg.includes('cancel')) {
          return;
        }

        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        });
      }
    },

    /**
     * 输入姓名
     */
    onInputName(e) {
      this.setData({ name: e.detail.value });
    },

    /**
     * 选择出生日期
     */
    onDateChange(e) {
      this.setData({ birthDate: e.detail.value });
    },

    /**
     * 提交修改
     */
    async submit() {
      const { name, birthDate, avatar, baby } = this.data;

      // 验证表单
      if (!name.trim()) {
        wx.showToast({
          title: '请输入宝宝姓名',
          icon: 'none'
        });
        return;
      }

      if (!birthDate) {
        wx.showToast({
          title: '请选择出生日期',
          icon: 'none'
        });
        return;
      }

      this.setData({ loading: true });

      try {
        const babyService = new BabyService();
        
        // 准备更新数据
        const updateData = {
          name: name.trim(),
          birthDate: new Date(birthDate)
        };

        // 如果头像已更新，也更新头像
        if (avatar && avatar !== baby.avatar) {
          updateData.avatar = avatar;
        }

        // 更新数据库
        await babyService.updateBaby(baby._id, updateData);

        // 更新本地存储
        const currentBaby = StorageUtil.getCurrentBaby();
        if (currentBaby && currentBaby._id === baby._id) {
          const updatedBaby = {
            ...currentBaby,
            ...updateData
          };
          StorageUtil.saveCurrentBaby(updatedBaby);
        }

        // 震动反馈
        wx.vibrateShort({ type: 'heavy' });

        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });

        // 通知父组件
        this.triggerEvent('updated', { 
          name: name.trim(), 
          birthDate, 
          avatar 
        });

        // 关闭弹窗
        this.resetForm();
        this.triggerEvent('close');
      } catch (error) {
        console.error('更新宝宝信息失败:', error);
        wx.showToast({
          title: '修改失败',
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
        popupTranslateY: 0,
        uploading: false,
        loading: false
      });
    },

    // 触摸滑动关闭功能由 swipe-close behavior 提供
  }
});
