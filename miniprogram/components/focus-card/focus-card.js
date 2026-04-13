/**
 * focus-card 聚焦卡片组件
 * 发现页顶部展示最紧急的待办事项
 */
Component({
  properties: {
    type: { type: String, value: 'vaccine' },       // 'vaccine' | 'milestone' | 'encouragement'
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    icon: { type: String, value: '' },
    urgency: { type: String, value: 'normal' },     // 'overdue' | 'upcoming' | 'normal'
    targetUrl: { type: String, value: '' },
    darkMode: { type: Boolean, value: false }
  },

  methods: {
    onTap() {
      if (this.data.targetUrl) {
        wx.navigateTo({ url: this.data.targetUrl });
      }
      this.triggerEvent('tap', { type: this.data.type });
    }
  }
});
