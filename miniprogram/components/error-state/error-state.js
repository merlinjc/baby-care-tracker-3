/**
 * 错误状态组件
 * 显示加载失败的错误信息和重试按钮
 */

Component({
  properties: {
    // 错误信息
    message: {
      type: String,
      value: '加载失败，请重试'
    },
    // 错误图标
    icon: {
      type: String,
      value: 'error'
    },
    // 是否显示重试按钮
    showRetry: {
      type: Boolean,
      value: true
    },
    // 重试按钮文字
    retryText: {
      type: String,
      value: '重新加载'
    }
  },

  data: {
    retrying: false
  },

  methods: {
    /**
     * 点击重试
     */
    onRetry() {
      if (this.data.retrying) return;
      
      this.setData({ retrying: true });
      
      // 触发重试事件
      this.triggerEvent('retry');
      
      // 延迟重置状态（让父组件控制）
      setTimeout(() => {
        this.setData({ retrying: false });
      }, 1000);
    }
  }
});
