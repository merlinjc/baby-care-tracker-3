/**
 * 全局分享 Behavior
 * 为所有页面统一注入 onShareAppMessage 和 onShareTimeline
 * 
 * 使用方式：
 * 1. 在页面 JS 中引入: const shareBehavior = require('../../behaviors/share-behavior')
 * 2. 在 Page 之前混入: Page({ ...shareBehavior, ... })
 * 
 * 注意：
 * - 页面如有自定义分享逻辑（如 auth、record），直接在页面中重写即可覆盖
 * - 默认分享路径为首页 /pages/home/home
 */

const DEFAULT_SHARE_TITLE = '宝宝护理记录 - 科学育儿好帮手 by neo';
const DEFAULT_SHARE_PATH = '/pages/home/home';
const DEFAULT_SHARE_IMAGE = '/images/share-default.png';

module.exports = {
  onShareAppMessage() {
    return {
      title: DEFAULT_SHARE_TITLE,
      path: DEFAULT_SHARE_PATH,
      imageUrl: DEFAULT_SHARE_IMAGE
    };
  },

  onShareTimeline() {
    return {
      title: DEFAULT_SHARE_TITLE,
      imageUrl: DEFAULT_SHARE_IMAGE
    };
  }
};
