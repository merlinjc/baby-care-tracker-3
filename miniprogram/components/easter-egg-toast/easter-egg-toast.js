const EasterEgg = require('../../utils/easter-egg');

Component({
  properties: {
    // 是否显示
    show: { type: Boolean, value: false },
    darkMode: {
      type: Boolean,
      value: false
    },
    // Toast 文案
    text: { type: String, value: '' },
    darkMode: {
      type: Boolean,
      value: false
    },
    // 图标路径
    icon: { type: String, value: '' },
    // Storage 标记 key
    storageKey: { type: String, value: '' },
    // 自动关闭时间（ms）
    duration: { type: Number, value: 2500 }
  },

  data: {
    animState: 'idle'   // 'idle' | 'entering' | 'visible' | 'leaving'
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.showToast();
      }
    }
  },

  methods: {
    showToast() {
      this.setData({ animState: 'entering' });

      // 入场动画完成后标记 visible
      setTimeout(() => {
        this.setData({ animState: 'visible' });
      }, 300);

      // 自动关闭
      this._autoCloseTimer = setTimeout(() => {
        this.dismiss();
      }, this.properties.duration);
    },

    dismiss() {
      if (this._autoCloseTimer) {
        clearTimeout(this._autoCloseTimer);
        this._autoCloseTimer = null;
      }

      this.setData({ animState: 'leaving' });

      // 标记已展示
      if (this.properties.storageKey) {
        EasterEgg.markShown(this.properties.storageKey);
      }

      setTimeout(() => {
        this.setData({ animState: 'idle' });
        this.triggerEvent('close');
      }, 300);
    }
  }
});
