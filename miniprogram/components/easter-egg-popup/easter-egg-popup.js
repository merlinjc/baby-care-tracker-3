const RecordService = require('../../services/record');
const EasterEgg = require('../../utils/easter-egg');

Component({
  properties: {
    // 是否显示
    show: { type: Boolean, value: false },
    darkMode: {
      type: Boolean,
      value: false
    },
    // 彩蛋类型：'30day' | '100day' | '365day' | 'streak_30'
    type: { type: String, value: '' },
    darkMode: {
      type: Boolean,
      value: false
    },
    // 彩蛋数据（从检测引擎传入）
    eggData: { type: Object, value: {} },
    // Storage 标记 key
    storageKey: { type: String, value: '' },
    // 宝宝 ID（用于查询数据回顾）
    babyId: { type: String, value: '' }
  },

  data: {
    // 动画状态
    animState: 'idle',    // 'idle' | 'entering' | 'visible' | 'leaving'
    // 数据回顾（懒加载）
    retrospect: null,
    retrospectLoading: false
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.onOpen();
      }
    }
  },

  methods: {
    async onOpen() {
      this.setData({ animState: 'entering' });

      // 200ms 后切到 visible 状态（等待入场动画）
      setTimeout(() => {
        this.setData({ animState: 'visible' });
      }, 200);

      // 懒加载数据回顾
      if (this.properties.eggData.dataQueryType) {
        this.loadRetrospect();
      }
    },

    async loadRetrospect() {
      this.setData({ retrospectLoading: true });

      try {
        const recordService = new RecordService();
        const babyId = this.properties.babyId;
        const type = this.properties.eggData.dataQueryType;
        const showGrowthComparison = this.properties.eggData.showGrowthComparison;

        let days = 30;
        if (type === '100day') days = 100;
        if (type === '365day') days = 365;

        const endTs = Date.now();
        const startTs = endTs - days * 86400000;

        const records = await recordService.getRecords(babyId, {
          dateRange: { start: startTs, end: endTs },
          limit: 1000
        });

        // 聚合统计
        let feedingCount = 0, sleepTotalSeconds = 0, diaperCount = 0, totalCount = records.length;
        records.forEach(r => {
          switch (r.recordType) {
            case 'feeding': feedingCount++; break;
            case 'sleep': sleepTotalSeconds += (r.data && r.data.duration || 0); break;
            case 'diaper': diaperCount++; break;
          }
        });

        const sleepHours = Math.round(sleepTotalSeconds / 3600);

        // EE-2 百日特殊逻辑：查询生长数据对比
        let growthComparison = null;
        if (showGrowthComparison) {
          const growthRecords = records.filter(r => r.recordType === 'growth');
          if (growthRecords.length > 0) {
            growthRecords.sort((a, b) => (a.startTimeTs || 0) - (b.startTimeTs || 0));
            const earliest = growthRecords[0];
            const latest = growthRecords[growthRecords.length - 1];
            growthComparison = {
              birthWeight: earliest.data && earliest.data.weight || null,
              latestWeight: latest.data && latest.data.weight || null,
              birthHeight: earliest.data && earliest.data.height || null,
              latestHeight: latest.data && latest.data.height || null
            };
          }
        }

        this.setData({
          retrospect: {
            feedingCount,
            sleepHours,
            diaperCount,
            totalCount,
            days,
            growthComparison
          },
          retrospectLoading: false
        });
      } catch (err) {
        console.error('[EasterEggPopup] 数据回顾加载失败:', err);
        this.setData({ retrospectLoading: false });
      }
    },

    close() {
      this.setData({ animState: 'leaving' });

      // 标记已展示
      if (this.properties.storageKey) {
        EasterEgg.markShown(this.properties.storageKey);
      }

      // 300ms 后通知父组件（等待退场动画）
      setTimeout(() => {
        this.setData({ animState: 'idle' });
        this.triggerEvent('close');
      }, 300);
    },

    onMaskTap() {
      this.close();
    },

    stopPropagation() {
      // 阻止事件冒泡到 mask
    }
  }
});
