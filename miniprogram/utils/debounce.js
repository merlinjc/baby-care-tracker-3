/**
 * 防抖/节流工具函数
 * Phase 1 基础设施，供后续全项目使用
 * 
 * 应用点：
 * - record.js#onSearch: debounce(300ms)
 * - growth/ai-assistant/baby-list/family onShow: throttle(30000ms)
 * - 6 个弹窗 onTouchMove: throttle(16ms)
 */

/**
 * 防抖函数
 * @param {Function} fn - 目标函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Function} 包装后的函数（附带 .cancel() 方法）
 */
function debounce(fn, ms) {
  let timer = null;
  const wrapped = function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  };
  wrapped.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

/**
 * 节流函数（leading edge）
 * 首次触发立即执行，后续在间隔内忽略（trailing 补偿执行）
 * @param {Function} fn - 目标函数
 * @param {number} ms - 节流间隔毫秒数
 * @returns {Function} 包装后的函数（附带 .cancel() / .force() 方法）
 */
function throttle(fn, ms) {
  let lastTime = 0;
  let timer = null;
  const wrapped = function (...args) {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, ms - (now - lastTime));
    }
  };
  wrapped.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  wrapped.force = function (...args) {
    wrapped.cancel();
    lastTime = Date.now();
    fn.apply(this, args);
  };
  return wrapped;
}

module.exports = { debounce, throttle };
