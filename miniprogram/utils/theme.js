/**
 * 主题管理器 - 单例模式
 * 
 * 职责：
 * 1. 管理主题状态（light / dark / system）
 * 2. 提供 JS 颜色查询接口
 * 3. 广播主题变更事件
 * 4. 持久化主题偏好
 */

const StorageUtil = require('./storage');

// ============ 主题常量 ============

const THEME_KEY = 'app_theme_mode';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_SYSTEM = 'system';

// ============ 颜色配置 ============

/** 亮色模式颜色（与 app.wxss page{} 中的 CSS 变量完全对应） */
const LIGHT_COLORS = {
  // 语义状态色（JS 中动态使用）
  scoreExcellent:    '#7BC950',
  scoreGood:         '#5ABFB0',
  scoreFair:         '#D4883D',
  scorePoor:         '#E8745A',
  scoreCritical:     '#E85454',
  
  statusNormal:      '#7BC950',
  statusWarning:     '#D4883D',
  statusDanger:      '#E85454',
  statusMuted:       '#999999',
  
  // 记录类型圆点色（timeline.js）
  dotFeeding:        '#A8D4A8',
  dotSleep:          '#B8A8D4',
  dotDiaper:         '#D4C8A8',
  dotTemperature:    '#D4A8A8',
  dotGrowth:         '#A8C8D4',
  dotMilestone:      '#D4B8A8',
  dotDefault:        '#B89678',
  
  // 百分位线色（growth.js）
  percentileP3:      '#C89898',
  percentileP15:     '#B8A888',
  percentileP50:     '#D4A574',
  percentileP85:     '#B8A888',
  percentileP97:     '#C89898',
  
  // 功能菜单 iconBg（discover.js）
  iconBgFeeding:     'linear-gradient(135deg, rgba(168,212,168,0.2) 0%, rgba(152,196,152,0.3) 100%)',
  iconBgSleep:       'linear-gradient(135deg, rgba(184,168,212,0.2) 0%, rgba(168,152,196,0.3) 100%)',
  iconBgDiaper:      'linear-gradient(135deg, rgba(212,200,168,0.2) 0%, rgba(196,184,152,0.3) 100%)',
  iconBgAi:          'linear-gradient(135deg, rgba(212,184,150,0.2) 0%, rgba(196,168,134,0.3) 100%)',
  
  // wx.showModal confirmColor
  confirmDanger:     '#E85454',
  confirmWarn:       '#D48B8B',
  confirmNeutral:    '#C77B6B',

  // 发热等级色（temperature-popup 内联样式用）
  feverLow:          '#5B8FF9',
  feverNormal:       '#07C160',
  feverLowFever:     '#FFC53D',
  feverModerate:     '#FF976A',
  feverHigh:         '#FF7875',
  feverUltraHigh:    '#FF4D4F',
};

/** 暗色模式颜色 */
const DARK_COLORS = {
  // 语义状态色 — 在暗色背景上需要稍微调亮或降饱和
  scoreExcellent:    '#6AB845',
  scoreGood:         '#4AAFA0',
  scoreFair:         '#C47830',
  scorePoor:         '#D86A50',
  scoreCritical:     '#D44848',
  
  statusNormal:      '#6AB845',
  statusWarning:     '#C47830',
  statusDanger:      '#D44848',
  statusMuted:       '#7A7068',
  
  // 记录类型圆点色 — 保持辨识度，微调亮度
  dotFeeding:        '#7CAF7C',
  dotSleep:          '#9488B4',
  dotDiaper:         '#B0A480',
  dotTemperature:    '#B48888',
  dotGrowth:         '#88A8B4',
  dotMilestone:      '#B4A088',
  dotDefault:        '#A08060',
  
  // 百分位线色 — 在深色背景上提亮
  percentileP3:      '#D4A8A8',
  percentileP15:     '#C8B898',
  percentileP50:     '#E0B584',
  percentileP85:     '#C8B898',
  percentileP97:     '#D4A8A8',
  
  // 功能菜单 iconBg — 提高不透明度
  iconBgFeeding:     'linear-gradient(135deg, rgba(124,175,124,0.25) 0%, rgba(108,159,108,0.35) 100%)',
  iconBgSleep:       'linear-gradient(135deg, rgba(148,136,180,0.25) 0%, rgba(132,120,164,0.35) 100%)',
  iconBgDiaper:      'linear-gradient(135deg, rgba(176,164,128,0.25) 0%, rgba(160,148,112,0.35) 100%)',
  iconBgAi:          'linear-gradient(135deg, rgba(180,152,118,0.25) 0%, rgba(164,136,102,0.35) 100%)',
  
  // wx.showModal confirmColor — 不变（系统弹窗背景不受控）
  confirmDanger:     '#E85454',
  confirmWarn:       '#D48B8B',
  confirmNeutral:    '#C77B6B',

  // 发热等级色 — 在暗底上足够清晰，不变
  feverLow:          '#5B8FF9',
  feverNormal:       '#07C160',
  feverLowFever:     '#FFC53D',
  feverModerate:     '#FF976A',
  feverHigh:         '#FF7875',
  feverUltraHigh:    '#FF4D4F',
};

// ============ 内部状态 ============

let _currentTheme = null;   // 'light' | 'dark' | 'system'
let _resolvedDark = false;  // 实际是否为暗色
let _listeners = [];

/**
 * 解析当前是否应该使用暗色
 */
function _resolveDark(theme) {
  if (theme === THEME_DARK) return true;
  if (theme === THEME_LIGHT) return false;
  // system: 读取微信系统主题
  try {
    const appBaseInfo = wx.getAppBaseInfo();
    return appBaseInfo.theme === 'dark';
  } catch (e) {
    return false;
  }
}

/**
 * 通知所有监听者
 */
function _notifyListeners() {
  _listeners.forEach(fn => {
    try { fn(_resolvedDark); } catch (e) { console.warn('[ThemeManager] listener error:', e); }
  });
}

/**
 * 更新原生 TabBar 样式以匹配当前主题
 */
function _updateTabBarStyle() {
  try {
    if (_resolvedDark) {
      wx.setTabBarStyle({
        color: '#7A7068',
        selectedColor: '#D4B896',
        backgroundColor: '#1E1A16',
        borderStyle: 'black'
      });
    } else {
      wx.setTabBarStyle({
        color: '#8B7B6B',
        selectedColor: '#D4B896',
        backgroundColor: '#FFFFFF',
        borderStyle: 'white'
      });
    }
  } catch (e) { /* TabBar 页面外调用会失败，静默 */ }
}

/**
 * 更新导航栏样式以匹配当前主题
 */
function _updateNavigationBarStyle() {
  try {
    if (_resolvedDark) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2A2420',
        animation: { duration: 200, timingFunc: 'easeIn' }
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#D4B896',
        animation: { duration: 200, timingFunc: 'easeIn' }
      });
    }
  } catch (e) { /* 静默 */ }
}

// ============ ThemeManager 单例 ============

const ThemeManager = {
  THEME_LIGHT,
  THEME_DARK,
  THEME_SYSTEM,

  /**
   * 初始化（在 app.onLaunch 中调用）
   */
  init() {
    // 读取持久化的主题偏好
    _currentTheme = StorageUtil.get(THEME_KEY) || THEME_LIGHT;
    _resolvedDark = _resolveDark(_currentTheme);

    // 旧数据迁移：settings.darkMode → ThemeManager
    if (!StorageUtil.get(THEME_KEY)) {
      try {
        const settings = StorageUtil.get('settings');
        if (settings && settings.darkMode === true) {
          _currentTheme = THEME_DARK;
          _resolvedDark = true;
          StorageUtil.save(THEME_KEY, THEME_DARK);
        }
      } catch (e) { /* 静默 */ }
    }

    // 监听系统主题变化（仅 system 模式生效）
    if (wx.onThemeChange) {
      wx.onThemeChange(({ theme }) => {
        if (_currentTheme === THEME_SYSTEM) {
          const newDark = (theme === 'dark');
          if (_resolvedDark !== newDark) {
            _resolvedDark = newDark;
            _updateTabBarStyle();
            _updateNavigationBarStyle();
            _notifyListeners();
          }
        }
      });
    }

    // 初始化时同步 TabBar/导航栏样式
    _updateTabBarStyle();
  },

  /**
   * 获取当前主题设置值
   * @returns {'light'|'dark'|'system'}
   */
  getTheme() {
    return _currentTheme || THEME_LIGHT;
  },

  /**
   * 当前是否为暗色模式
   * @returns {boolean}
   */
  isDark() {
    return _resolvedDark;
  },

  /**
   * 设置主题
   * @param {'light'|'dark'|'system'} theme
   */
  setTheme(theme) {
    if (![THEME_LIGHT, THEME_DARK, THEME_SYSTEM].includes(theme)) return;
    _currentTheme = theme;
    _resolvedDark = _resolveDark(theme);
    StorageUtil.save(THEME_KEY, theme);
    _updateTabBarStyle();
    _updateNavigationBarStyle();
    _notifyListeners();
  },

  /**
   * 获取 JS 中需要使用的颜色值
   * @param {string} key - 颜色键名，如 'scoreExcellent'
   * @returns {string} 颜色值
   */
  getColor(key) {
    const palette = _resolvedDark ? DARK_COLORS : LIGHT_COLORS;
    return palette[key] || LIGHT_COLORS[key] || '';
  },

  /**
   * 获取确认弹窗颜色
   * @param {'danger'|'warn'|'neutral'} type
   * @returns {string} 颜色值
   */
  getConfirmColor(type) {
    const map = { danger: 'confirmDanger', warn: 'confirmWarn', neutral: 'confirmNeutral' };
    return this.getColor(map[type] || 'confirmNeutral');
  },

  /**
   * 获取页面/组件 setData 需要的 darkMode 布尔值
   * 用于 WXML class 绑定: class="{{darkMode ? 'dark-mode' : ''}}"
   * @returns {{darkMode: boolean}}
   */
  getDarkModeData() {
    return { darkMode: _resolvedDark };
  },

  /**
   * 注册主题变更监听
   * @param {Function} fn - 回调 (isDark: boolean) => void
   * @returns {Function} 取消注册函数
   */
  onThemeChange(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter(f => f !== fn);
    };
  },
};

module.exports = ThemeManager;
