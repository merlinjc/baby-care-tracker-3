/**
 * 弹窗下滑关闭公共 Behavior
 * Phase 2.4 基础设施，供 6 个弹窗组件复用
 * 
 * 功能：
 * - 触摸下滑手势关闭弹窗
 * - touchStartY 作为实例属性（避免 setData 开销）
 * - onTouchMove 中 16ms 节流 setData（约 60fps 上限）
 * - 阻力效果 resistance=0.5，最大滑动 maxSlide=300
 * - 滑动阈值 100px 触发关闭
 * 
 * 使用方式：
 * 1. 引入 behavior: behaviors: [require('../../behaviors/swipe-close')]
 * 2. WXML 中绑定: catchtouchstart="onTouchStart" catchtouchmove="onTouchMove" catchtouchend="onTouchEnd"
 * 3. 组件需实现 close() 方法（behavior 不定义 close 以避免覆盖组件自身逻辑）
 * 4. 组件 data 中可删除 touchStartY 和 popupTranslateY（由 behavior 管理）
 * 5. 组件 resetForm 中仍需包含 popupTranslateY: 0
 */

const { throttle } = require('../utils/debounce');

module.exports = Behavior({
  data: {
    popupTranslateY: 0
  },

  lifetimes: {
    attached() {
      // touchStartY 作为实例属性，避免 setData 传输到视图层
      this._touchStartY = 0;

      // 创建节流版 setData（16ms ≈ 60fps）
      this._throttledSetTranslateY = throttle(function (translateY) {
        this.setData({ popupTranslateY: translateY });
      }, 16);
    },

    detached() {
      // 清理节流定时器
      if (this._throttledSetTranslateY && this._throttledSetTranslateY.cancel) {
        this._throttledSetTranslateY.cancel();
      }
    }
  },

  methods: {
    /**
     * 触摸开始 - 记录起始 Y 坐标（实例属性，无 setData）
     */
    onTouchStart(e) {
      this._touchStartY = e.touches[0].clientY;
    },

    /**
     * 触摸移动 - 带阻力的下滑跟手，16ms 节流
     */
    onTouchMove(e) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - this._touchStartY;

      // 只允许向下滑动
      if (deltaY > 0) {
        const resistance = 0.5;
        const translateY = Math.min(deltaY * resistance, 300);
        this._throttledSetTranslateY.call(this, translateY);
      }
    },

    /**
     * 触摸结束 - 判断是关闭还是回弹
     */
    onTouchEnd() {
      const { popupTranslateY } = this.data;

      // 取消可能的待执行节流回调
      if (this._throttledSetTranslateY && this._throttledSetTranslateY.cancel) {
        this._throttledSetTranslateY.cancel();
      }

      if (popupTranslateY > 100) {
        // 超过阈值，关闭弹窗（调用组件自身的 close 方法）
        this.close();
      } else {
        // 回弹
        this.setData({ popupTranslateY: 0 });
      }
    }
  }
});
