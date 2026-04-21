/**
 * 导出弹窗组件
 * 支持图片、Excel、PDF三种导出格式
 */

const RecordService = require('../../services/record');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    darkMode: {
      type: Boolean,
      value: false
    },
    babyId: {
      type: String,
      value: ''
    },
    selectedRecords: {
      type: Array,
      value: []
    }
  },

  data: {
    exportFormat: 'image',
    exportRange: 'week',
    exporting: false,
    exportProgress: '',
    exportLimitReached: false,
    exportCountToday: 0
  },

  lifetimes: {
    // checkExportLimit 由 observers['show'] 在弹窗打开时触发，无需 attached 重复调用
    detached() {
      // 清理导出状态
      this.setData({ exporting: false });
    }
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.checkExportLimit();
      }
    }
  },

  methods: {
    /**
     * 检查导出限制
     */
    checkExportLimit() {
      const today = new Date().toDateString();
      const lastExportDate = wx.getStorageSync('export_date');
      let exportCountToday = 0;
      
      if (lastExportDate === today) {
        exportCountToday = wx.getStorageSync('export_count') || 0;
      } else {
        wx.setStorageSync('export_date', today);
        wx.setStorageSync('export_count', 0);
      }
      
      this.setData({
        exportCountToday,
        exportLimitReached: exportCountToday >= 5
      });
    },

    /**
     * 选择导出格式
     */
    selectFormat(e) {
      const { format } = e.currentTarget.dataset;
      this.setData({ exportFormat: format });
    },

    /**
     * 选择时间范围
     */
    selectRange(e) {
      const { range } = e.currentTarget.dataset;
      this.setData({ exportRange: range });
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.triggerEvent('close');
    },

    /**
     * 开始导出
     */
    async startExport() {
      if (this.data.exportLimitReached) return;
      
      this.setData({ 
        exporting: true,
        exportProgress: '正在准备数据...'
      });
      
      try {
        const { exportFormat, exportRange, babyId, selectedRecords } = this.data;
        const records = await this.getRecordsForExport(exportRange, selectedRecords);
        
        if (records.length === 0) {
          this.setData({ exporting: false });
          wx.showToast({ title: '暂无数据可导出', icon: 'none' });
          return;
        }

        let result;
        
        switch (exportFormat) {
          case 'image':
            this.setData({ exportProgress: '正在生成图片...' });
            result = await this.exportAsImage(records);
            break;
            
          case 'excel':
            this.setData({ exportProgress: '正在生成Excel...' });
            result = await this.exportAsExcel(records);
            break;
            
          case 'pdf':
            this.setData({ exportProgress: '正在生成PDF报告...' });
            result = await this.exportAsPDF(records);
            break;
        }
        
        // 更新导出计数
        const newCount = this.data.exportCountToday + 1;
        wx.setStorageSync('export_count', newCount);
        this.setData({ 
          exportCountToday: newCount,
          exporting: false
        });
        
        // 显示分享选项
        this.showShareOptions(result);
        
      } catch (error) {
        console.error('导出失败:', error);
        this.setData({ exporting: false });
        wx.showToast({ title: '导出失败，请重试', icon: 'error' });
      }
    },

    /**
     * 获取导出记录
     */
    async getRecordsForExport(exportRange, selectedRecords) {
      // 如果有选中的记录，直接返回选中的
      if (selectedRecords && selectedRecords.length > 0) {
        const recordService = RecordService.getInstance();
        // 这里需要根据 selectedRecords IDs 获取完整记录
        // 简化处理：假设页面已经传入了完整的记录
        return this.properties.records || [];
      }
      
      const recordService = RecordService.getInstance();
      const babyId = this.data.babyId;
      
      let startDate, endDate;
      const now = new Date();
      
      switch (exportRange) {
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          endDate = now;
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          endDate = now;
          break;
        case 'all':
          startDate = null;
          endDate = null;
          break;
      }
      
      const options = {
        limit: 1000
      };
      
      if (startDate && endDate) {
        options.startDate = startDate.getTime();
        options.endDate = endDate.getTime();
      }
      
      return await recordService.getRecords(babyId, options);
    },

    /**
     * 导出为图片（使用Canvas生成）
     */
    async exportAsImage(records) {
      // 简化实现：生成一个简单的数据汇总图片
      // 实际项目中可以使用更复杂的Canvas绑定
      const stats = this.calculateStats(records);
      
      // 创建一个临时的文本内容用于分享
      const content = this.generateShareText(records, stats);
      
      // 使用微信小程序的截图功能或canvas
      // 这里返回一个临时文件路径
      const tempFilePath = `${wx.env.USER_DATA_PATH}/baby_records_${Date.now()}.txt`;
      const fs = wx.getFileSystemManager();
      fs.writeFileSync(tempFilePath, content, 'utf8');
      
      return tempFilePath;
    },

    /**
     * 导出为Excel（CSV格式）
     */
    async exportAsExcel(records) {
      const headers = ['日期', '时间', '类型', '详情', '记录者', '备注'];
      const rows = records.map(r => [
        this.formatDate(r.startTimeTs || r.startTime),
        this.formatTime(r.startTimeTs || r.startTime),
        this.getTypeName(r.recordType),
        this.getRecordSummary(r),
        r.createdByName || '历史记录',
        r.note || ''
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/baby_records_${Date.now()}.csv`;
      
      fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
      
      return filePath;
    },

    /**
     * 导出为PDF（需要云函数支持）
     */
    async exportAsPDF(records) {
      // PDF导出需要云函数支持，这里提供占位实现
      wx.showToast({ title: 'PDF导出功能开发中', icon: 'none' });
      throw new Error('PDF导出功能开发中');
    },

    /**
     * 计算统计数据
     */
    calculateStats(records) {
      const stats = {
        feedingCount: 0,
        feedingAmount: 0,
        sleepHours: 0,
        diaperCount: 0,
        temperatureCount: 0
      };
      
      records.forEach(r => {
        switch (r.recordType) {
          case 'feeding':
            stats.feedingCount++;
            stats.feedingAmount += r.data?.amount || 0;
            break;
          case 'sleep':
            stats.sleepHours += (r.data?.duration || 0) / 60;
            break;
          case 'diaper':
            stats.diaperCount++;
            break;
          case 'temperature':
            stats.temperatureCount++;
            break;
        }
      });
      
      return stats;
    },

    /**
     * 生成分享文本
     */
    generateShareText(records, stats) {
      return `宝宝成长记录
      
数据汇总：
- 喂养：${stats.feedingCount}次，共${Math.round(stats.feedingAmount)}ml
- 睡眠：${stats.sleepHours.toFixed(1)}小时
- 排便：${stats.diaperCount}次
- 体温：${stats.temperatureCount}次测量

共 ${records.length} 条记录
导出时间：${new Date().toLocaleString()}`;
    },

    /**
     * 格式化日期
     */
    formatDate(timestamp) {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    },

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    /**
     * 获取类型名称
     */
    getTypeName(type) {
      const names = {
        feeding: '喂养',
        sleep: '睡眠',
        diaper: '排便',
        temperature: '体温',
        growth: '生长'
      };
      return names[type] || type;
    },

    /**
     * 获取记录摘要
     */
    getRecordSummary(record) {
      const data = record.data || {};
      switch (record.recordType) {
        case 'feeding':
          return data.amount ? `${data.amount}ml` : '喂养';
        case 'sleep':
          return data.duration ? `${data.duration}分钟` : '睡眠';
        case 'diaper':
          return data.diaperType || '排便';
        case 'temperature':
          return data.temperature ? `${data.temperature}°C` : '体温';
        default:
          return '记录';
      }
    },

    /**
     * 显示分享选项
     */
    showShareOptions(filePath) {
      wx.showActionSheet({
        itemList: ['保存到手机', '分享给好友'],
        success: (res) => {
          switch (res.tapIndex) {
            case 0:
              this.saveToAlbum(filePath);
              break;
            case 1:
              this.shareToFriend(filePath);
              break;
          }
        }
      });
    },

    /**
     * 保存到相册
     */
    saveToAlbum(filePath) {
      wx.saveFile({
        tempFilePath: filePath,
        success: (res) => {
          wx.showToast({ title: '已保存', icon: 'success' });
        },
        fail: (err) => {
          console.error('保存失败:', err);
          wx.showToast({ title: '保存失败', icon: 'error' });
        }
      });
    },

    /**
     * 分享给好友
     */
    shareToFriend(filePath) {
      wx.shareFileMessage({
        filePath: filePath,
        success: () => {
          wx.showToast({ title: '分享成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('分享失败:', err);
          wx.showToast({ title: '分享失败', icon: 'error' });
        }
      });
    }
  }
});
