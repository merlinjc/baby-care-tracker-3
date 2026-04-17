/**
 * 数据导出页
 * 导出记录数据为CSV/JSON
 */

const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    baby: null,
    exportOptions: [
      { label: '喂养记录', value: 'feeding', checked: true },
      { label: '睡眠记录', value: 'sleep', checked: true },
      { label: '排便记录', value: 'diaper', checked: true },
      { label: '体温记录', value: 'temperature', checked: true },
      { label: '生长记录', value: 'growth', checked: false }
    ],
    dateRange: 'month', // week, month, all
    exportFormat: 'csv', // csv, json
    loading: false,
    totalRecords: 0
  },

  async onLoad() {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
    
    this.loadBabyInfo();
    this.calculateTotalRecords();
  },

  /**
   * 加载宝宝信息
   */
  loadBabyInfo() {
    const baby = StorageUtil.getCurrentBaby();
    this.setData({ baby });
  },

  /**
   * 计算总记录数
   */
  async calculateTotalRecords() {
    try {
      const db = wx.cloud.database();
      const baby = this.data.baby;
      
      if (!baby) return;

      // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
      const countRes = await db.collection('records')
        .where({
          babyId: baby._id,
          familyId: baby.familyId || ''
        })
        .count();

      this.setData({ totalRecords: countRes.total });
    } catch (error) {
      console.error('计算记录数失败:', error);
    }
  },

  /**
   * 切换导出选项
   */
  toggleOption(e) {
    const { value } = e.currentTarget.dataset;
    const options = this.data.exportOptions.map(opt => {
      if (opt.value === value) {
        return { ...opt, checked: !opt.checked };
      }
      return opt;
    });
    this.setData({ exportOptions: options });
  },

  /**
   * 切换日期范围
   */
  onDateRangeChange(e) {
    const { range } = e.currentTarget.dataset;
    this.setData({ dateRange: range });
  },

  /**
   * 切换导出格式
   */
  onFormatChange(e) {
    const { format } = e.currentTarget.dataset;
    this.setData({ exportFormat: format });
  },

  /**
   * 执行导出
   */
  async doExport() {
    const selectedTypes = this.data.exportOptions
      .filter(opt => opt.checked)
      .map(opt => opt.value);

    if (selectedTypes.length === 0) {
      wx.showToast({ title: '请选择导出类型', icon: 'none' });
      return;
    }

    // BUG-7: baby 空值检查
    const baby = this.data.baby;
    if (!baby) {
      wx.showToast({ title: '未找到宝宝信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在导出...' });
    this.setData({ loading: true });

    try {
      const db = wx.cloud.database();
      
      // 获取日期范围
      const dateFilter = this.getDateFilter();

      // BUG-3: 分页循环获取全量数据（小程序端 limit 最大20条）
      let allRecords = [];
      let batch;
      do {
        // ★ [v4.2 FR-10] 查询附加 familyId，匹配安全规则
        batch = await db.collection('records')
          .where({
            babyId: baby._id,
            familyId: baby.familyId || '',
            recordType: db.command.in(selectedTypes),
            startTime: dateFilter
          })
          .orderBy('startTime', 'desc')
          .skip(allRecords.length)
          .limit(20)
          .get();
        allRecords = allRecords.concat(batch.data);
      } while (batch.data.length === 20);

      // 生成导出文件
      const content = this.generateExportContent(allRecords);
      const fileName = `baby-records-${Date.now()}.${this.data.exportFormat}`;

      // 保存到本地
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'utf8',
        success: () => {
          wx.hideLoading();
          this.setData({ loading: false });
          
          wx.showModal({
            title: '导出成功',
            content: `共导出 ${allRecords.length} 条记录\n文件: ${fileName}`,
            confirmText: '分享',
            success: (res) => {
              if (res.confirm) {
                wx.shareFileMessage({
                  filePath,
                  success: () => {
                    wx.showToast({ title: '分享成功', icon: 'success' });
                  },
                  fail: () => {
                    wx.showToast({ title: '分享失败', icon: 'none' });
                  }
                });
              }
            }
          });
        },
        fail: (err) => {
          console.error('保存文件失败:', err);
          wx.hideLoading();
          this.setData({ loading: false });
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
    } catch (error) {
      console.error('导出失败:', error);
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  /**
   * 获取日期筛选条件
   */
  getDateFilter() {
    const db = wx.cloud.database();
    const now = new Date();
    
    switch (this.data.dateRange) {
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return db.command.gte(weekAgo);
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return db.command.gte(monthAgo);
      }
      default:
        return db.command.exists(true);
    }
  },

  /**
   * 生成导出内容
   */
  generateExportContent(records) {
    if (this.data.exportFormat === 'json') {
      return JSON.stringify(records, null, 2);
    }

    // BUG-8: CSV 格式，使用转义函数处理特殊字符
    const headers = ['日期', '时间', '类型', '详情', '备注'];
    const rows = records.map(r => [
      this.formatDate(r.startTime),
      this.formatTime(r.startTime),
      this.getTypeName(r.recordType),
      this.getRecordDetail(r),
      r.note || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => this.escapeCsv(String(cell))).join(','))
      .join('\n');
  },

  /**
   * BUG-8: CSV 字段转义
   * 含逗号、换行、双引号的字段用双引号包裹，内部双引号转义为两个双引号
   */
  escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
   * 获取记录详情
   */
  getRecordDetail(record) {
    const { recordType } = record;
    // BUG-9: data 可能为 undefined，使用默认空对象防御
    const data = record.data || {};
    
    switch (recordType) {
      case 'feeding':
        return `${data.feedingType || ''} ${data.amount ? data.amount + 'ml' : ''}`.trim();
      case 'sleep':
        return `${data.duration ? Math.floor(data.duration / 60) + '分钟' : ''}`;
      case 'diaper':
        return data.type || data.diaperType || '';
      case 'temperature':
        return data.temperature ? data.temperature + '℃' : '';
      case 'growth':
        return `${data.weight ? data.weight + 'kg' : ''} ${data.height ? data.height + 'cm' : ''}`.trim();
      default:
        return '';
    }
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
