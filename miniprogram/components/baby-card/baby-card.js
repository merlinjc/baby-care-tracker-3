/**
 * 宝宝卡片组件
 * 显示宝宝基本信息和年龄
 */

Component({
  properties: {
    baby: {
      type: Object,
      value: null
    }
  },

  data: {
    ageDisplay: ''
  },

  observers: {
    'baby': function(baby) {
      if (baby && (baby.birthDate || baby.birthDate === 0)) {
        this.setData({
          ageDisplay: this.calculateAge(baby.birthDate)
        });
      } else {
        this.setData({ ageDisplay: '' });
      }
    }
  },

  methods: {
    /**
     * 计算年龄
     * @param {string|Date} birthDate 出生日期
     * @returns {string} 年龄显示
     */
    calculateAge(birthDate) {
      let birth;
      if (!birthDate) return '';
      // 兼容云数据库 ServerDate 对象 {$date: number}
      if (birthDate && typeof birthDate === 'object' && birthDate.$date) {
        birth = new Date(birthDate.$date);
      } else {
        birth = new Date(birthDate);
      }
      if (isNaN(birth.getTime())) return '';
      const now = new Date();
      
      const diffMs = now - birth;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 30) {
        // 小于 30 天，显示天数
        return `${diffDays}天`;
      } else if (diffDays < 365) {
        // 小于 1 岁，显示月龄
        const months = Math.floor(diffDays / 30);
        const days = diffDays % 30;
        return days > 0 ? `${months}个月${days}天` : `${months}个月`;
      } else {
        // 大于 1 岁，显示岁数
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        return months > 0 ? `${years}岁${months}个月` : `${years}岁`;
      }
    },

    /**
     * 点击卡片
     */
    onTap() {
      this.triggerEvent('tap');
    }
  }
});
