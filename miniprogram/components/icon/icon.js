/**
 * 通用图标组件
 * 统一管理项目中所有图标的使用
 */
const { IconConfig, getStatusIcon, getMilestoneIcon } = require('../../utils/icon-config.js');

Component({
  /**
   * 组件属性
   */
  properties: {
    // 图标类型：functional | milestone | status | navigation
    type: {
      type: String,
      value: 'functional'
    },
    
    // 图标名称
    name: {
      type: String,
      value: ''
    },
    
    // 图标尺寸：small | medium | large | xlarge
    size: {
      type: String,
      value: 'medium'
    },
    
    // 颜色主题：primary | secondary | accent | success | warning | error | info
    color: {
      type: String,
      value: ''
    },
    
    // 自定义类名
    customClass: {
      type: String,
      value: ''
    },
    
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件数据
   */
  data: {
    iconSrc: '',
    loading: true,
    error: false
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    // updateIconSrc 由 observers['type, name'] 在属性初始化时自动触发，无需 attached 重复调用
    detached() {
      // 清理状态
    }
  },

  /**
   * 属性监听器
   */
  observers: {
    'type, name': function(type, name) {
      this.updateIconSrc();
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 更新图标路径
     */
    updateIconSrc() {
      const { type, name } = this.data;
      
      if (!name) {
        return;
      }
      
      let iconSrc = '';
      
      // 根据类型和名称获取图标路径
      switch (type) {
        case 'functional':
          iconSrc = IconConfig.functional[name] || '';
          break;
        case 'milestone':
          iconSrc = IconConfig.milestone[name] || '';
          break;
        case 'status':
          iconSrc = IconConfig.status[name] || '';
          break;
        case 'navigation':
          iconSrc = IconConfig.navigation[name] || '';
          break;
        default:
          console.warn(`[icon] 未知的图标类型: ${type}`);
          return;
      }
      
      if (!iconSrc) {
        console.warn(`[icon] 未找到图标: type=${type}, name=${name}`);
        this.setData({ error: true });
        return;
      }
      
      // 直接使用基础图标路径（48x48px），不再尝试@2x/@3x
      // 微信小程序image组件会自动处理图片缩放
      this.setData({ 
        iconSrc: iconSrc,
        loading: true,
        error: false
      });
    },
    
    /**
     * 图标加载成功
     */
    handleLoad() {
      this.setData({ loading: false });
    },
    
    /**
     * 图标加载失败
     * 添加错误回退机制
     */
    handleError(e) {
      console.error('[icon] 图标加载失败', e.detail);
      
      const { iconSrc } = this.data;
      
      // 如果是@2x/@3x加载失败，回退到基础版本
      if (iconSrc.includes('@2x') || iconSrc.includes('@3x')) {
        const baseSrc = iconSrc.replace(/@[23]x/, '');
        this.setData({ iconSrc: baseSrc });
        return;
      }
      
      // 基础版本也失败，标记错误
      this.setData({ 
        loading: false, 
        error: true 
      });
      
      // 触发错误事件
      this.triggerEvent('error', {
        type: this.data.type,
        name: this.data.name,
        src: this.data.iconSrc
      });
    },
    
    /**
     * 点击图标
     */
    handleTap(e) {
      if (this.data.disabled) {
        return;
      }
      
      this.triggerEvent('tap', {
        type: this.data.type,
        name: this.data.name
      });
    }
  }
});
