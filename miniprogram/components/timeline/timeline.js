// components/timeline/timeline.js
const { getRecordIcon, ICONS } = require('../../utils/icon-config');
const { parseTimestamp } = require('../../utils/date');
const ThemeManager = require('../../utils/theme');

Component({
  properties: {
    records: {
      type: Array,
      value: []
    },
    loading: {
      type: Boolean,
      value: false
    },
    manageMode: {
      type: Boolean,
      value: false
    },
    selectedRecords: {
      type: Array,
      value: []
    },
    // FR-11: 是否启用左滑编辑
    swipeEnabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    groupedRecords: [],
    // FR-11: 当前打开的滑动项 ID
    openedSwipeId: ''
  },

  observers: {
    'records': function(records) {
      if (!records || records.length === 0) {
        this.setData({ groupedRecords: [] });
        this._processedMap = null;
        return;
      }
      
      // 预计算 today/yesterday 字符串（每次 records 变化只算一次）
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      this._todayStr = todayStr;
      this._yesterdayStr = yesterdayStr;
      
      // 确保 selectedRecords 是数组
      const selected = Array.isArray(this.data.selectedRecords) ? this.data.selectedRecords : [];
      
      // 预处理记录，添加格式化字段、预计算 iconSrc 和选中状态
      const processedMap = {};
      const processedRecords = records.map(record => {
        // 优先使用数值时间戳，然后才是 startTime 字段
        let timestamp;
        if (record.startTimeTs) {
          timestamp = new Date(record.startTimeTs);
        } else if (record.startTime) {
          timestamp = this.parseTimestamp(record.startTime);
        } else if (record.timestamp) {
          timestamp = this.parseTimestamp(record.timestamp);
        }
        
        // 如果解析失败，使用当前时间作为后备
        if (!timestamp || isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
        
        // 兼容 recordType 和 type 字段
        const type = record.recordType || record.type;
        
        // 预计算图标路径（替代 WXML 中的长三元链）
        const iconSrc = this._getIconSrc(type);
        
        const processed = {
          ...record,
          type,
          timestamp,
          formattedTime: this.formatTime(timestamp),
          timeDisplay: this.formatTime(timestamp),
          typeDisplay: this.getTypeName(type),
          summary: this.getRecordDescription({ ...record, type }),
          iconSrc,
          isSelected: selected.includes(record._id)
        };
        processedMap[record._id] = processed;
        return processed;
      });
      this._processedMap = processedMap;
      this.groupRecordsByDate(processedRecords);
    },
    'selectedRecords': function(selectedRecords) {
      // 轻量更新：仅刷新选中状态，不重新处理所有记录
      const groupedRecords = this.data.groupedRecords;
      if (!groupedRecords || groupedRecords.length === 0) return;
      
      const selected = Array.isArray(selectedRecords) ? selectedRecords : [];
      let changed = false;
      
      groupedRecords.forEach(group => {
        group.records.forEach(record => {
          const newSelected = selected.includes(record._id);
          if (record.isSelected !== newSelected) {
            record.isSelected = newSelected;
            changed = true;
          }
        });
      });
      
      if (changed) {
        this.setData({ groupedRecords });
      }
    }
  },

  methods: {
    /**
     * 按日期分组记录
     */
    groupRecordsByDate(records) {
      const grouped = {};
      
      records.forEach(record => {
        const { sortKey, display } = this._formatDateWithKey(record.timestamp);
        if (!grouped[sortKey]) {
          grouped[sortKey] = {
            date: sortKey,
            dateDisplay: display,
            records: []
          };
        }
        grouped[sortKey].records.push(record);
      });
      
      // 转换为数组并排序（使用 YYYY-MM-DD sortKey，避免中文字符串排序 bug）
      const groupedArray = Object.values(grouped).map(group => ({
        ...group,
        records: group.records.sort((a, b) => b.timestamp - a.timestamp)
      })).sort((a, b) => {
        // 按日期字符串倒序（YYYY-MM-DD 格式天然支持字符串比较）
        return b.date > a.date ? 1 : b.date < a.date ? -1 : 0;
      });
      
      this.setData({ groupedRecords: groupedArray });
    },

    /**
     * 安全地解析时间戳（代理到 utils/date.parseTimestamp）
     */
    parseTimestamp(timestamp) {
      return parseTimestamp(timestamp);
    },

    /**
     * 格式化日期（保留用于外部兼容）
     */
    formatDate(timestamp) {
      const result = this._formatDateWithKey(timestamp);
      return result.display;
    },

    /**
     * 格式化日期，返回 { sortKey: 'YYYY-MM-DD', display: '今天'|'昨天'|'X月X日' }
     * 使用缓存的 today/yesterday 字符串避免重复计算
     */
    _formatDateWithKey(timestamp) {
      const date = this.parseTimestamp(timestamp);
      if (!date) return { sortKey: '0000-00-00', display: '未知日期' };
      
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      let display;
      if (dateStr === this._todayStr) {
        display = '今天';
      } else if (dateStr === this._yesterdayStr) {
        display = '昨天';
      } else {
        display = `${date.getMonth() + 1}月${date.getDate()}日`;
      }
      
      return { sortKey: dateStr, display };
    },

    /**
     * 获取记录类型对应的图标路径（预计算，替代 WXML 中的长三元链）
     */
    _getIconSrc(type) {
      const iconMap = {
        feeding: '/images/icons/feeding-white.png',
        sleep: '/images/icons/sleep-white.png',
        diaper: '/images/icons/diaper-white.png',
        temperature: '/images/icons/temperature.png',
        growth: '/images/icons/growth-white.png'
      };
      return iconMap[type] || '/images/icons/growth-white.png';
    },

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
      const date = this.parseTimestamp(timestamp);
      if (!date) return '--:--';
      
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    /**
     * 获取记录类型图标
     */
    getTypeIcon(type) {
      return getRecordIcon(type);
    },

    /**
     * 获取记录类型名称
     */
    getTypeName(type) {
      const names = {
        feeding: '喂养',
        sleep: '睡眠',
        diaper: '排便',
        temperature: '体温',
        growth: '生长',
        milestone: '里程碑'
      };
      return names[type] || '记录';
    },

    /**
     * 获取记录描述
     */
    getRecordDescription(record) {
      const type = record.type || record.recordType;
      // 获取记录数据对象（兼容 data 字段和直接字段）
      const data = record.data || record;
      
      switch (type) {
        case 'feeding':
          return this.getFeedingDescription(data);
        case 'sleep':
          return this.getSleepDescription(data);
        case 'diaper':
          return this.getDiaperDescription(data);
        case 'temperature':
          return this.getTemperatureDescription(data);
        case 'growth':
          return this.getGrowthDescription(data);
        case 'milestone':
          return data.title || '发育里程碑';
        default:
          return '记录';
      }
    },

    /**
     * 喂养描述
     */
    getFeedingDescription(data) {
      const feedingType = data.feedingType || 'breast';
      const types = {
        breast: '母乳喂养',
        formula: '配方奶',
        solid: '辅食'
      };
      
      let desc = types[feedingType];
      
      if (feedingType === 'breast') {
        if (data.duration) {
          // duration 存储的是秒，转换为分钟
          const durationMinutes = Math.floor(data.duration / 60);
          desc += ` ${durationMinutes}分钟`;
        }
        if (data.breastSide) {
          const sides = { left: '左侧', right: '右侧', both: '双侧' };
          desc += ` (${sides[data.breastSide] || ''})`;
        }
      } else if (feedingType === 'formula') {
        if (data.amount) {
          desc += ` ${data.amount}ml`;
        }
        if (data.duration) {
          const durationMinutes = Math.floor(data.duration / 60);
          desc += ` ${durationMinutes}分钟`;
        }
      } else if (feedingType === 'solid') {
        if (data.amount) {
          desc += ` ${data.amount}ml`;
        }
        if (data.duration) {
          const durationMinutes = Math.floor(data.duration / 60);
          desc += ` ${durationMinutes}分钟`;
        }
        if (data.foodName) {
          desc += ` - ${data.foodName}`;
        }
      }
      
      return desc;
    },

    /**
     * 睡眠描述
     */
    getSleepDescription(data) {
      // 支持 nap 和 day 两种表示日间睡眠的值
      let sleepType = data.sleepType;
      if (!sleepType || sleepType === 'nap' || sleepType === 'day') {
        sleepType = 'nap';
      }
      
      const types = {
        nap: '日间小睡',
        night: '夜间睡眠'
      };
      
      let desc = types[sleepType] || '睡眠';
      
      if (data.duration) {
        // duration 可能是秒或分钟，需要判断
        // 如果值大于 1440（24小时的分钟数），说明是秒
        let durationMinutes;
        if (data.duration > 1440) {
          durationMinutes = Math.floor(data.duration / 60); // 秒转分钟
        } else {
          durationMinutes = data.duration;
        }
        
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        if (hours > 0) {
          desc += ` ${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
        } else {
          desc += ` ${minutes}分钟`;
        }
      }
      
      if (data.location) {
        desc += ` (${data.location})`;
      }
      
      return desc;
    },

    /**
     * 排便描述
     */
    getDiaperDescription(data) {
      const diaperType = data.diaperType || 'both';
      const types = {
        pee: '小便',
        poop: '大便',
        both: '大小便'
      };
      
      let desc = types[diaperType];
      
      if (diaperType !== 'pee' && data.consistency) {
        const consistencies = {
          watery: '水样',
          soft: '软便',
          formed: '成型',
          hard: '硬便'
        };
        desc += ` - ${consistencies[data.consistency]}`;
      }
      
      if (diaperType !== 'pee' && data.color) {
        const colors = {
          yellow: '黄色',
          green: '绿色',
          brown: '棕色',
          black: '黑色',
          red: '红色',
          white: '白色'
        };
        desc += ` (${colors[data.color]})`;
      }
      
      return desc;
    },

    /**
     * 体温描述
     */
    getTemperatureDescription(data) {
      let desc = `${data.temperature}°C`;
      
      if (data.method) {
        const methods = {
          armpit: '腋下',
          ear: '耳温',
          forehead: '额温',
          rectal: '肛温'
        };
        desc += ` (${methods[data.method]})`;
      }
      
      // 发烧提示
      if (data.temperature >= 38.5) {
        desc += ' 发烧';
      } else if (data.temperature >= 38) {
        desc += ' 低烧';
      }
      
      return desc;
    },

    /**
     * 生长描述
     */
    getGrowthDescription(data) {
      const parts = [];
      
      if (data.height) {
        parts.push(`身高 ${data.height}cm`);
      }
      if (data.weight) {
        parts.push(`体重 ${data.weight}kg`);
      }
      if (data.headCircumference) {
        parts.push(`头围 ${data.headCircumference}cm`);
      }
      
      return parts.join(' | ');
    },

    /**
     * 获取记录颜色（美拉德色彩）
     */
    getRecordColor(type) {
      const colorMap = {
        feeding: 'dotFeeding',
        sleep: 'dotSleep',
        diaper: 'dotDiaper',
        temperature: 'dotTemperature',
        growth: 'dotGrowth',
        milestone: 'dotMilestone'
      };
      return ThemeManager.getColor(colorMap[type] || 'dotDefault');
    },

    /**
     * 点击记录
     */
    onRecordTap(e) {
      const recordId = e.currentTarget.dataset.recordId;
      const record = this._processedMap && this._processedMap[recordId];
      if (!record) return;
      
      // 批量模式下切换选择状态
      if (this.data.manageMode) {
        const isSelected = this.data.selectedRecords.includes(recordId);
        this.triggerEvent('recordSelect', { 
          recordId, 
          selected: !isSelected 
        });
      } else {
        this.triggerEvent('recordTap', { record });
      }
    },

    /**
     * 长按记录
     */
    onRecordLongPress(e) {
      const recordId = e.currentTarget.dataset.recordId;
      const record = this._processedMap && this._processedMap[recordId];
      if (!record) return;
      this.triggerEvent('recordLongPress', { record });
    },

    /**
     * 检查记录是否被选中
     */
    isRecordSelected(recordId) {
      return this.data.selectedRecords.includes(recordId);
    },

    // ========== FR-11: 左滑编辑相关方法 ==========
    
    /**
     * 触摸开始
     */
    onTouchStart(e) {
      if (!this.data.swipeEnabled || this.data.manageMode) return;
      
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
      this._touchMoved = false;
    },

    /**
     * 触摸移动
     */
    onTouchMove(e) {
      if (!this.data.swipeEnabled || this.data.manageMode) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - this._touchStartX;
      const deltaY = currentY - this._touchStartY;
      
      // 角度判断：只有接近水平方向才触发（< 30°）
      const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
      if (angle > 30 && angle < 150) {
        // 垂直方向滚动，不处理
        return;
      }
      
      this._touchMoved = true;
    },

    /**
     * 触摸结束
     */
    onTouchEnd(e) {
      if (!this.data.swipeEnabled || this.data.manageMode || !this._touchMoved) return;
      
      const endX = e.changedTouches[0].clientX;
      const deltaX = endX - this._touchStartX;
      const recordId = e.currentTarget.dataset.recordId;
      
      // 滑动距离 > 30px 才触发
      if (Math.abs(deltaX) > 30) {
        if (deltaX < 0) {
          // 左滑：打开操作按钮
          this.setData({ openedSwipeId: recordId });
        } else {
          // 右滑：关闭操作按钮
          this.setData({ openedSwipeId: '' });
        }
      }
      
      this._touchMoved = false;
    },

    /**
     * 关闭所有滑动项
     */
    closeSwipe() {
      this.setData({ openedSwipeId: '' });
    },

    /**
     * 编辑记录
     */
    onSwipeEdit(e) {
      const recordId = e.currentTarget.dataset.recordId;
      const record = this._processedMap && this._processedMap[recordId];
      this.setData({ openedSwipeId: '' });
      if (record) this.triggerEvent('swipeEdit', { record });
    },

    /**
     * 删除记录
     */
    onSwipeDelete(e) {
      const recordId = e.currentTarget.dataset.recordId;
      const record = this._processedMap && this._processedMap[recordId];
      this.setData({ openedSwipeId: '' });
      if (record) this.triggerEvent('swipeDelete', { record });
    }
  }
});
