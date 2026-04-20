/**
 * 记录数据服务
 * 实现云端优先的记录管理
 */

const StorageUtil = require('../utils/storage');
const NetworkUtil = require('../utils/network');
const DeduplicationUtil = require('../utils/deduplication');
const FamilyContext = require('../utils/family-context');
const { PermissionGuard } = require('./permission-guard');
const { parseTimestamp } = require('../utils/date');

// 单例模式
let instance = null;

class RecordService {
  constructor() {
    if (instance) return instance;
    
    this.db = wx.cloud.database();
    this.recordCollection = this.db.collection('records');
    // [v4.3.0 FR-2] 单例模式统一：改走 getInstance()
    this.networkUtil = NetworkUtil.getInstance();
    this.deduplicationUtil = DeduplicationUtil.getInstance();
    this._todayStatsCache = null; // getTodayStats 15s 缓存
    
    instance = this;
  }

  /**
   * 安全地解析时间戳（代理到 utils/date.parseTimestamp）
   */
  parseTimestamp(timestamp) {
    return parseTimestamp(timestamp);
  }

  /**
   * 处理云端返回的记录，转换时间格式
   * @param {Object} record 云端记录
   * @returns {Object} 处理后的记录
   */
  processCloudRecord(record) {
    const processed = { ...record };
    
    // 转换 startTime - 优先使用数值时间戳
    if (record.startTimeTs) {
      processed.startTime = new Date(record.startTimeTs);
    } else if (record.startTime) {
      const startTime = this.parseTimestamp(record.startTime);
      processed.startTime = startTime || new Date();
    } else {
      processed.startTime = new Date(); // 默认当前时间
    }
    
    // 转换 endTime
    if (record.endTimeTs) {
      processed.endTime = new Date(record.endTimeTs);
    } else if (record.endTime) {
      const endTime = this.parseTimestamp(record.endTime);
      processed.endTime = endTime;
    }
    
    // 转换 createdAt
    if (record.createdAtTs) {
      processed.createdAt = new Date(record.createdAtTs);
    } else if (record.createdAt) {
      const createdAt = this.parseTimestamp(record.createdAt);
      processed.createdAt = createdAt || new Date();
    } else {
      processed.createdAt = new Date();
    }
    
    // 转换 updatedAt
    if (record.updatedAtTs) {
      processed.updatedAt = new Date(record.updatedAtTs);
    } else if (record.updatedAt) {
      const updatedAt = this.parseTimestamp(record.updatedAt);
      processed.updatedAt = updatedAt || new Date();
    } else {
      processed.updatedAt = new Date();
    }
    
    return processed;
  }
  
  static getInstance() {
    if (!instance) {
      instance = new RecordService();
    }
    return instance;
  }

  /**
   * 统一 createdBy 格式
   * 兼容三种情况：
   * 1. 新格式：createdBy 为对象 { userId, nickName, avatar }
   * 2. 旧格式：扁平字段 creatorId/createdByName/createdByAvatar
   * 3. 无字段：返回默认值
   * 
   * @param {Object} record - 记录对象
   * @returns {{ userId: string, nickName: string, avatar: string }} 归一化的创建者信息
   */
  static normalizeCreatedBy(record) {
    if (!record) return { userId: '', nickName: '未知', avatar: '' };

    // 新格式：createdBy 为对象
    if (record.createdBy && typeof record.createdBy === 'object') {
      return {
        userId: record.createdBy.userId || '',
        nickName: record.createdBy.nickName || '家庭成员',
        avatar: record.createdBy.avatar || ''
      };
    }

    // 旧格式：扁平字段
    if (record.creatorId) {
      return {
        userId: record.creatorId,
        nickName: record.createdByName || '家庭成员',
        avatar: record.createdByAvatar || ''
      };
    }

    // 无字段
    return { userId: '', nickName: '未知', avatar: '' };
  }

  /**
   * 创建记录（云端优先）
   * @param {Object} recordData 记录数据
   * @returns {Promise<Object>} 创建的记录
   */
  async createRecord(recordData) {
    // [v4.3.0 FR-14] 前置权限预检：Viewer 直接抛 PermissionError，不发起网络请求
    PermissionGuard.require('record.create');

    // 去重检查 - 使用稳定的键，不包含时间戳
    const dedupeKey = `create_${recordData.babyId}_${recordData.recordType}`;
    if (!this.deduplicationUtil.check(dedupeKey, 3000)) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    // 使用当前时间作为开始时间
    const now = new Date();
    const nowTs = now.getTime(); // 数值时间戳，用于可靠的读取

    // 获取创建者信息
    const userInfo = StorageUtil.getUserInfo();
    const familyInfo = StorageUtil.getFamilyInfo();
    // ★ [v4.1 FR-6] 使用 memberDetails（Object[]）而非 members（string[]），userId 统一用 _id
    const familyMember = familyInfo?.memberDetails?.find(m => m.userId === userInfo?._id);

    try {
      // 检查网络状态
      if (this.networkUtil.checkOnline()) {
        // 在线：直接写入云端
        const cloudRecord = {
          babyId: recordData.babyId,
          familyId: FamilyContext.resolve(),  // ★ [v4.2 FR-10] 安全规则需要 familyId
          recordType: recordData.recordType,
          startTime: this.db.serverDate(), // 使用服务器时间
          startTimeTs: nowTs, // 同时保存数值时间戳，用于可靠读取
          data: recordData.data,
          note: recordData.note || '',
          // 创建者信息（新对象格式）
          createdBy: {
            userId: userInfo?._id || '',
            nickName: familyMember?.nickName || familyMember?.name || userInfo?.nickName || '',
            avatar: familyMember?.avatarUrl || userInfo?.avatarUrl || ''
          },
          // 创建者信息（保留旧扁平格式，兼容）
          creatorId: userInfo?._id || null,
          createdByName: familyMember?.nickName || userInfo?.nickName || null,
          createdByAvatar: familyMember?.avatarUrl || userInfo?.avatarUrl || null,
          createdAt: this.db.serverDate(),
          createdAtTs: nowTs,
          updatedAt: this.db.serverDate(),
          updatedAtTs: nowTs
        };

        // 如果有结束时间，使用传入的实际结束时间
        if (recordData.endTime) {
          const endDate = new Date(recordData.endTime);
          cloudRecord.endTime = endDate;
          cloudRecord.endTimeTs = recordData.endTimeTs || endDate.getTime();
        }

        const res = await this.recordCollection.add({
          data: cloudRecord
        });

        // 创建本地缓存版本（使用本地时间，因为服务器时间无法立即获取）
        const createdRecord = {
          _id: res._id,
          babyId: recordData.babyId,
          recordType: recordData.recordType,
          startTime: now, // 本地时间，用于立即显示
          startTimeTs: nowTs,
          data: recordData.data,
          note: recordData.note || '',
          // 创建者信息（新对象格式）
          createdBy: {
            userId: userInfo?._id || '',
            nickName: familyMember?.nickName || familyMember?.name || userInfo?.nickName || '',
            avatar: familyMember?.avatarUrl || userInfo?.avatarUrl || ''
          },
          // 创建者信息（保留旧扁平格式，兼容）
          creatorId: userInfo?._id || null,
          createdByName: familyMember?.nickName || userInfo?.nickName || null,
          createdByAvatar: familyMember?.avatarUrl || userInfo?.avatarUrl || null,
          createdAt: now,
          createdAtTs: nowTs,
          updatedAt: now,
          updatedAtTs: nowTs
        };

        // 同步到本地缓存
        this.saveToLocalCache(createdRecord);

        return createdRecord;
      } else {
        // 离线：写入本地并加入离线队列
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const offlineRecord = {
          _id: tempId,
          babyId: recordData.babyId,
          familyId: FamilyContext.resolve(),  // ★ [v4.2 FR-10] 安全规则需要 familyId
          recordType: recordData.recordType,
          startTime: now,
          startTimeTs: nowTs,
          data: recordData.data,
          note: recordData.note || '',
          // 创建者信息（新对象格式）
          createdBy: {
            userId: userInfo?._id || '',
            nickName: familyMember?.nickName || familyMember?.name || userInfo?.nickName || '',
            avatar: familyMember?.avatarUrl || userInfo?.avatarUrl || ''
          },
          // 创建者信息（保留旧扁平格式，兼容）
          creatorId: userInfo?._id || null,
          createdByName: familyMember?.nickName || userInfo?.nickName || null,
          createdByAvatar: familyMember?.avatarUrl || userInfo?.avatarUrl || null,
          createdAt: now,
          createdAtTs: nowTs,
          updatedAt: now,
          updatedAtTs: nowTs,
          _offline: true
        };

        // 保存到本地
        this.saveToLocalCache(offlineRecord);

        // 添加到离线队列
        StorageUtil.addToOfflineQueue({
          type: 'create',
          collection: 'records',
          data: {
            babyId: recordData.babyId,
            familyId: FamilyContext.resolve(),  // ★ [v4.2 FR-10] 安全规则需要 familyId
            recordType: recordData.recordType,
            startTime: now,
            startTimeTs: nowTs,
            data: recordData.data,
            note: recordData.note || '',
            // [v4.3.0 FR-4] 创建者信息（新对象格式，补齐避免同步后头像昵称丢失）
            createdBy: {
              userId: userInfo?._id || '',
              nickName: familyMember?.nickName || familyMember?.name || userInfo?.nickName || '',
              avatar: familyMember?.avatarUrl || userInfo?.avatarUrl || ''
            },
            // 创建者信息（旧扁平格式保留兼容）
            creatorId: userInfo?._id || null,
            createdByName: familyMember?.nickName || userInfo?.nickName || null,
            createdByAvatar: familyMember?.avatarUrl || userInfo?.avatarUrl || null,
            // [v4.3.0 FR-4] 时间戳（离线 data 也带上，供 sync 时规整使用）
            createdAtTs: nowTs,
            updatedAtTs: nowTs
          },
          tempId
        });

        return offlineRecord;
      }
    } catch (error) {
      console.error('创建记录失败:', error);
      
      // BUG-33: 避免与外层 userInfo/familyInfo 变量遮蔽，重命名为 cachedUserInfo/cachedFamilyInfo
      const cachedUserInfo = StorageUtil.getUserInfo();
      const cachedFamilyInfo = StorageUtil.getFamilyInfo();
      // ★ [v4.1 FR-6] memberDetails + _id
      const cachedFamilyMember = cachedFamilyInfo?.memberDetails?.find(m => m.userId === cachedUserInfo?._id);
      
      // 如果云端失败，降级到本地
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const offlineRecord = {
        _id: tempId,
        babyId: recordData.babyId,
        familyId: FamilyContext.resolve(),  // ★ [v4.2 FR-10] 安全规则需要 familyId
        recordType: recordData.recordType,
        startTime: now,
        startTimeTs: nowTs,
        data: recordData.data,
        note: recordData.note || '',
        // 创建者信息
        creatorId: cachedUserInfo?._id || null,
        createdByName: cachedFamilyMember?.nickName || cachedUserInfo?.nickName || null,
        createdByAvatar: cachedFamilyMember?.avatarUrl || cachedUserInfo?.avatarUrl || null,
        createdAt: now,
        createdAtTs: nowTs,
        updatedAt: now,
        updatedAtTs: nowTs,
        _offline: true
      };

      this.saveToLocalCache(offlineRecord);
      StorageUtil.addToOfflineQueue({
        type: 'create',
        collection: 'records',
        data: {
          babyId: recordData.babyId,
          familyId: FamilyContext.resolve(),  // ★ [v4.2 FR-10] 安全规则需要 familyId
          recordType: recordData.recordType,
          startTime: now,
          startTimeTs: nowTs,
          data: recordData.data,
          note: recordData.note || '',
          // [v4.3.0 FR-4] 创建者信息（新对象格式，补齐避免同步后头像昵称丢失）
          createdBy: {
            userId: cachedUserInfo?._id || '',
            nickName: cachedFamilyMember?.nickName || cachedFamilyMember?.name || cachedUserInfo?.nickName || '',
            avatar: cachedFamilyMember?.avatarUrl || cachedUserInfo?.avatarUrl || ''
          },
          // 创建者信息（旧扁平格式保留兼容）
          creatorId: cachedUserInfo?._id || null,
          createdByName: cachedFamilyMember?.nickName || cachedUserInfo?.nickName || null,
          createdByAvatar: cachedFamilyMember?.avatarUrl || cachedUserInfo?.avatarUrl || null,
          // [v4.3.0 FR-4] 时间戳
          createdAtTs: nowTs,
          updatedAtTs: nowTs
        },
        tempId
      });

      return offlineRecord;
    }
  }

  /**
   * 获取宝宝记录列表（云端优先）
   * @param {string} babyId 宝宝 ID
   * @param {Object} options 查询选项
   * @param {string} [options.recordType] - 记录类型筛选
   * @param {Date} [options.startDate] - 开始日期（传统方式）
   * @param {Date} [options.endDate] - 结束日期（传统方式）
   * @param {Object} [options.dateRange] - 时间戳范围查询（FR-8 喂养预测用）
   * @param {number} [options.dateRange.start] - 起始时间戳
   * @param {number} [options.dateRange.end] - 结束时间戳
   * @param {number} [options.limit=20] - 返回数量限制
   * @param {number} [options.skip=0] - 跳过数量
   * @param {string} [options.orderBy='startTime'] - 排序字段
   * @param {string} [options.order='desc'] - 排序方向
   */
  async getRecords(babyId, options = {}) {
    const {
      recordType,
      startDate: rawStartDate,
      endDate: rawEndDate,
      dateRange,
      limit = 20,
      skip = 0,
      orderBy = 'startTime',
      order = 'desc'
    } = options;

    // BUG-FIX: 统一 startDate/endDate 为 Date 对象
    // 调用方可能传入数值时间戳（getTime()）或 Date 对象，
    // 微信云数据库 where 比较要求 Date 对象才能正确匹配 serverDate() 字段
    const startDate = rawStartDate != null ? new Date(rawStartDate) : null;
    const endDate = rawEndDate != null ? new Date(rawEndDate) : null;

    try {
      // 先从本地缓存读取
      const localRecords = this.getFromLocalCache(babyId, options);

      // 如果离线，直接返回本地数据
      if (!this.networkUtil.checkOnline()) {
        return localRecords;
      }

      // [v4.3.0 FR-15] 查询附加 familyId，匹配安全规则；统一通过 FamilyContext 获取
      const familyId = FamilyContext.resolve();

      // 在线：从云端获取
      let query = this.recordCollection
        .where({
          babyId,
          familyId,
          ...(recordType && { recordType })
        });

      // 时间范围查询 - 支持两种方式
      // 方式1: 使用 dateRange（基于 startTimeTs 时间戳，更精确）
      if (dateRange && dateRange.start && dateRange.end) {
        query = query.where({
          startTimeTs: this.db.command.gte(dateRange.start).and(
            this.db.command.lte(dateRange.end)
          )
        });
      }
      // 方式2: 使用传统的 startDate/endDate（基于 startTime Date对象）
      else if (startDate && endDate) {
        query = query.where({
          startTime: this.db.command.and([
            this.db.command.gte(startDate),
            this.db.command.lte(endDate)
          ])
        });
      }

      // 支持自定义排序字段
      const sortField = orderBy === 'startTimeTs' ? 'startTimeTs' : 'startTime';
      const res = await query
        .orderBy(sortField, order)
        .skip(skip)
        .limit(limit)
        .get();

      // 后处理云端记录：转换时间戳格式
      const processedRecords = res.data.map(record => this.processCloudRecord(record));

      // 合并云端和本地数据（去重）
      const mergedRecords = this.mergeRecords(processedRecords, localRecords);

      // 更新本地缓存
      this.updateLocalCache(babyId, mergedRecords);

      return mergedRecords;
    } catch (error) {
      console.error('获取记录列表失败:', error);
      // 降级到本地缓存
      return this.getFromLocalCache(babyId, options);
    }
  }

  /**
   * 更新记录
   * @param {string} recordId 记录 ID
   * @param {Object} data 更新数据
   */
  async updateRecord(recordId, data) {
    // 去重检查 - 使用稳定的键，不包含时间戳
    const dedupeKey = `update_${recordId}`;
    if (!this.deduplicationUtil.check(dedupeKey, 3000)) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    try {
      if (this.networkUtil.checkOnline() && !recordId.startsWith('temp_')) {
        // 在线且非离线记录：更新云端
        // [v4.3.1 FR-7] 补 updatedAtTs 双时间戳，修复 mergeRecords 按 updatedAtTs 比较失效
        const nowTs = Date.now();
        await this.recordCollection.doc(recordId).update({
          data: {
            ...data,
            updatedAt: this.db.serverDate(),
            updatedAtTs: nowTs
          }
        });

        // 更新本地缓存（同时写入 updatedAtTs，保持与云端一致）
        this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });
      } else {
        // 离线或离线记录：更新本地并加入队列
        // [v4.3.1 FR-7] 离线分支也补 updatedAtTs，同步时由 sync._normalizeTimestamps 校正 updatedAt
        const nowTs = Date.now();
        this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });

        StorageUtil.addToOfflineQueue({
          type: 'update',
          collection: 'records',
          recordId,
          data: { ...data, updatedAtTs: nowTs }
        });
      }
    } catch (error) {
      console.error('更新记录失败:', error);
      // 降级到本地
      const nowTs = Date.now();
      this.updateRecordInCache(recordId, { ...data, updatedAtTs: nowTs });
      StorageUtil.addToOfflineQueue({
        type: 'update',
        collection: 'records',
        recordId,
        data: { ...data, updatedAtTs: nowTs }
      });
    }
  }

  /**
   * 删除记录
   * @param {string} recordId 记录 ID
   */
  async deleteRecord(recordId) {
    // [v4.3.0 FR-14] 前置权限预检：Viewer 直接抛 PermissionError
    // 注：record.delete.own 为 editor+admin 允许；admin 可删他人由云端安全规则保证
    // 如需严格校验归属（editor 删他人应被拒），调用方可在调用前查出 record 再用 PermissionGuard.requireCanDelete(record)
    PermissionGuard.require('record.delete.own');

    // 去重检查 - 使用稳定的键，不包含时间戳
    const dedupeKey = `delete_${recordId}`;
    if (!this.deduplicationUtil.check(dedupeKey, 3000)) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    try {
      // 从本地缓存删除
      this.deleteRecordFromCache(recordId);

      if (recordId.startsWith('temp_')) {
        // 离线记录：仅移除队列中的创建操作，无需云端删除
        this.removeFromOfflineQueue('create', recordId);
      } else if (this.networkUtil.checkOnline()) {
        // 在线且非离线记录：删除云端，成功后无需加入离线队列
        await this.recordCollection.doc(recordId).remove();
      } else {
        // 离线状态且非临时记录：加入离线队列待后续同步
        StorageUtil.addToOfflineQueue({
          type: 'delete',
          collection: 'records',
          recordId
        });
      }
    } catch (error) {
      console.error('删除记录失败:', error);
      // 云端删除失败，降级加入离线队列
      if (!recordId.startsWith('temp_')) {
        StorageUtil.addToOfflineQueue({
          type: 'delete',
          collection: 'records',
          recordId
        });
      }
    }
  }

  /**
   * 获取今日记录统计（带 15s 内存缓存）
   * @param {string} babyId 宝宝 ID
   * @returns {Object} 统计数据，包含：
   *   - feeding: { count, totalAmount, lastTimeTs }  (FR-1/FR-4: lastTimeTs 为最新喂养时间戳)
   *   - sleep: { count, totalDuration, lastEndTimeTs }  (FR-1/FR-4: lastEndTimeTs 为最新睡眠结束时间戳)
   *   - diaper: { count, wet, dirty }
   *   - temperature: { count, values, latestValue, latestValueTs }  (FR-6: 最新体温值及时间戳)
   */
  async getTodayStats(babyId) {
    // 15s 内存缓存
    const now = Date.now();
    if (this._todayStatsCache &&
        this._todayStatsCache.babyId === babyId &&
        now - this._todayStatsCache.ts < 15000) {
      return this._todayStatsCache.data;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const records = await this.getRecords(babyId, {
        startDate: today,
        endDate: tomorrow
      });

      const stats = {
        // FR-1/FR-4: 新增 lastTimeTs - 最新喂养时间戳
        feeding: { count: 0, totalAmount: 0, lastTimeTs: null },
        // FR-1/FR-4: 新增 lastEndTimeTs - 最新睡眠结束时间戳
        sleep: { count: 0, totalDuration: 0, lastEndTimeTs: null },
        diaper: { count: 0, wet: 0, dirty: 0 },
        // FR-6: 新增 latestValue/latestValueTs - 最新体温值及时间戳
        temperature: { count: 0, values: [], latestValue: null, latestValueTs: null }
      };

      records.forEach(record => {
        // 获取记录的时间戳，优先使用 startTimeTs
        // BUG-FIX: startTime 可能是字符串（从本地缓存反序列化），不能直接调用 .getTime()
        let recordTs = record.startTimeTs || null;
        if (!recordTs && record.startTime) {
          const parsed = record.startTime instanceof Date ? record.startTime : this.parseTimestamp(record.startTime);
          recordTs = parsed ? parsed.getTime() : null;
        }
        
        switch (record.recordType) {
          case 'feeding':
            stats.feeding.count++;
            // 只统计配方奶的奶量（母乳没有 amount，辅食不算奶量）
            if (record.data.feedingType === 'formula' && record.data.amount) {
              stats.feeding.totalAmount += record.data.amount;
            }
            // FR-1/FR-4: 追踪最新喂养时间
            if (recordTs && (!stats.feeding.lastTimeTs || recordTs > stats.feeding.lastTimeTs)) {
              stats.feeding.lastTimeTs = recordTs;
            }
            break;
            
          case 'sleep':
            stats.sleep.count++;
            stats.sleep.totalDuration += record.data.duration || 0;
            // FR-1/FR-4: 追踪最新睡眠结束时间
            // BUG-FIX: endTime 可能是字符串（从本地缓存反序列化），不能直接调用 .getTime()
            let endTs = record.endTimeTs || null;
            if (!endTs && record.endTime) {
              const parsedEnd = record.endTime instanceof Date ? record.endTime : this.parseTimestamp(record.endTime);
              endTs = parsedEnd ? parsedEnd.getTime() : null;
            }
            if (endTs && (!stats.sleep.lastEndTimeTs || endTs > stats.sleep.lastEndTimeTs)) {
              stats.sleep.lastEndTimeTs = endTs;
            }
            break;
            
          case 'diaper':
            stats.diaper.count++;
            // 兼容两种字段名：diaperType（新）和 type（旧）
            const diaperType = record.data.diaperType || record.data.type;
            if (diaperType === 'pee' || diaperType === 'wet') stats.diaper.wet++;
            if (diaperType === 'poop' || diaperType === 'dirty') stats.diaper.dirty++;
            if (diaperType === 'both') {
              stats.diaper.wet++;
              stats.diaper.dirty++;
            }
            break;
            
          case 'temperature':
            stats.temperature.count++;
            stats.temperature.values.push(record.data.temperature);
            // FR-6: 追踪最新体温值
            if (recordTs && (!stats.temperature.latestValueTs || recordTs > stats.temperature.latestValueTs)) {
              stats.temperature.latestValue = record.data.temperature;
              stats.temperature.latestValueTs = recordTs;
            }
            break;
        }
      });

      // 更新 15s 缓存
      this._todayStatsCache = { babyId, ts: Date.now(), data: stats };

      return stats;
    } catch (error) {
      console.error('获取今日统计失败:', error);
      throw error;
    }
  }

  /**
   * ========== 本地缓存管理方法 ==========
   */

  /**
   * 获取本地缓存键
   * @param {string} babyId 宝宝 ID
   * @returns {string} 缓存键
   */
  getLocalCacheKey(babyId) {
    return `records_${babyId}`;
  }

  /**
   * 保存记录到本地缓存
   * @param {Object} record 记录数据
   */
  saveToLocalCache(record) {
    const key = this.getLocalCacheKey(record.babyId);
    const records = StorageUtil.get(key) || [];
    
    // 检查是否已存在
    const existIndex = records.findIndex(r => r._id === record._id);
    if (existIndex >= 0) {
      records[existIndex] = record;
    } else {
      records.unshift(record);
    }
    
    StorageUtil.set(key, records);

    // [v4.3.0 FR-6] 新增/更新记录后立即失效今日统计缓存
    this._todayStatsCache = null;
  }

  /**
   * 从本地缓存读取记录
   * @param {string} babyId 宝宝 ID
   * @param {Object} options 查询选项
   * @returns {Array} 记录列表
   */
  getFromLocalCache(babyId, options = {}) {
    const key = this.getLocalCacheKey(babyId);
    let records = StorageUtil.get(key) || [];

    const {
      recordType,
      startDate: rawStartDate,
      endDate: rawEndDate,
      limit = 20,
      skip = 0
    } = options;

    // BUG-FIX: 统一 startDate/endDate 为 Date 对象（与 getRecords 保持一致）
    const startDate = rawStartDate != null ? new Date(rawStartDate) : null;
    const endDate = rawEndDate != null ? new Date(rawEndDate) : null;

    // 过滤记录类型
    if (recordType) {
      records = records.filter(r => r.recordType === recordType);
    }

    // 过滤时间范围 - 优先使用数值时间戳
    if (startDate && endDate) {
      records = records.filter(r => {
        let recordTime;
        if (r.startTimeTs) {
          recordTime = new Date(r.startTimeTs);
        } else {
          recordTime = this.parseTimestamp(r.startTime);
        }
        return recordTime && recordTime >= startDate && recordTime <= endDate;
      });
    }

    // 排序、分页 - 优先使用数值时间戳
    records.sort((a, b) => {
      let timeA, timeB;
      if (a.startTimeTs) {
        timeA = new Date(a.startTimeTs);
      } else {
        timeA = this.parseTimestamp(a.startTime);
      }
      if (b.startTimeTs) {
        timeB = new Date(b.startTimeTs);
      } else {
        timeB = this.parseTimestamp(b.startTime);
      }
      return (timeB ? timeB.getTime() : 0) - (timeA ? timeA.getTime() : 0);
    });
    return records.slice(skip, skip + limit);
  }

  /**
   * 更新本地缓存（合并策略，不覆盖）
   * 将传入的记录合并到已有缓存中：存在则更新，不存在则添加。
   * 保留缓存中的离线记录（_offline: true 且不在传入列表中的）。
   * @param {string} babyId 宝宝 ID
   * @param {Array} records 需要合并的记录列表
   */
  updateLocalCache(babyId, records) {
    const key = this.getLocalCacheKey(babyId);
    const existingRecords = StorageUtil.get(key) || [];
    
    // 以 _id 为 key 建立索引，先放入已有缓存
    const recordMap = new Map();
    existingRecords.forEach(r => recordMap.set(r._id, r));
    
    // 用新记录覆盖/添加（云端数据优先）
    records.forEach(r => recordMap.set(r._id, r));
    
    // 转为数组，保持时间降序，限制最多 200 条防止缓存膨胀
    const merged = Array.from(recordMap.values());
    merged.sort((a, b) => {
      const tsA = a.startTimeTs || (a.startTime ? new Date(a.startTime).getTime() : 0);
      const tsB = b.startTimeTs || (b.startTime ? new Date(b.startTime).getTime() : 0);
      return tsB - tsA;
    });

    StorageUtil.set(key, merged.slice(0, 200));
  }

  /**
   * 更新缓存中的记录
   * @param {string} recordId 记录 ID
   * @param {Object} data 更新数据
   * @param {string} [babyId] 可选宝宝 ID，传入时直接定位缓存避免遍历
   */
  updateRecordInCache(recordId, data, babyId) {
    // 如果传入了 babyId，直接定位缓存
    if (babyId) {
      const key = this.getLocalCacheKey(babyId);
      const records = StorageUtil.get(key) || [];
      const index = records.findIndex(r => r._id === recordId);
      if (index >= 0) {
        records[index] = { ...records[index], ...data, updatedAt: new Date() };
        StorageUtil.set(key, records);
      }
      // 清除 todayStats 缓存
      this._todayStatsCache = null;
      return;
    }

    // 未传入 babyId 时遍历所有宝宝的缓存
    const familyInfo = StorageUtil.getFamilyInfo();
    
    if (!familyInfo || !familyInfo.babies) return;

    familyInfo.babies.forEach(bid => {
      const key = this.getLocalCacheKey(bid);
      const records = StorageUtil.get(key) || [];
      const index = records.findIndex(r => r._id === recordId);
      
      if (index >= 0) {
        records[index] = {
          ...records[index],
          ...data,
          updatedAt: new Date()
        };
        StorageUtil.set(key, records);
      }
    });
    // 清除 todayStats 缓存
    this._todayStatsCache = null;
  }

  /**
   * 从缓存中删除记录
   * @param {string} recordId 记录 ID
   */
  deleteRecordFromCache(recordId) {
    const familyInfo = StorageUtil.getFamilyInfo();
    
    if (!familyInfo || !familyInfo.babies) return;

    familyInfo.babies.forEach(babyId => {
      const key = this.getLocalCacheKey(babyId);
      const records = StorageUtil.get(key) || [];
      const filtered = records.filter(r => r._id !== recordId);
      StorageUtil.set(key, filtered);
    });

    // [v4.3.0 FR-6] 删除记录后立即失效今日统计缓存
    this._todayStatsCache = null;
  }

  /**
   * 合并云端和本地记录（去重 + 保留本地较新版本）
   *
   * [v4.3.0 FR-6] 合并策略修正：
   * - 云端不存在、本地独有（含 _offline=true）→ 保留本地
   * - _id 同时存在于云端和本地：按 updatedAtTs 比较
   *   * 本地较新（离线 update 未同步）→ 保留本地
   *   * 云端较新（他人修改）→ 用云端覆盖
   *   * 无法比较（缺字段）→ 云端优先（旧行为兜底）
   * - 本地 _offline=true 的强制保留本地（未同步到云端的离线修改）
   *
   * @param {Array} cloudRecords 云端记录
   * @param {Array} localRecords 本地记录
   * @returns {Array} 合并后的记录
   */
  mergeRecords(cloudRecords, localRecords) {
    const cloudMap = new Map();
    cloudRecords.forEach(r => cloudMap.set(r._id, r));

    const merged = [];
    const localMap = new Map();
    localRecords.forEach(r => localMap.set(r._id, r));

    // 遍历云端记录，与本地同 _id 比较
    cloudRecords.forEach(cloudRec => {
      const local = localMap.get(cloudRec._id);
      if (!local) {
        merged.push(cloudRec);
        return;
      }
      // 离线标记强制本地优先
      if (local._offline === true) {
        merged.push(local);
        return;
      }
      // 按 updatedAtTs 比较（缺失则退回云端优先）
      const cloudTs = cloudRec.updatedAtTs || 0;
      const localTs = local.updatedAtTs || 0;
      if (localTs > cloudTs) {
        merged.push(local);
      } else {
        merged.push(cloudRec);
      }
    });

    // 添加云端没有的本地记录（主要是 _offline 的 temp_ 记录）
    localRecords.forEach(localRec => {
      if (!cloudMap.has(localRec._id)) {
        merged.push(localRec);
      }
    });

    // 按时间降序（优先使用 startTimeTs）
    merged.sort((a, b) => {
      const tsA = a.startTimeTs || (a.startTime ? new Date(a.startTime).getTime() : 0);
      const tsB = b.startTimeTs || (b.startTime ? new Date(b.startTime).getTime() : 0);
      return tsB - tsA;
    });

    return merged;
  }

  /**
   * 从离线队列中移除操作
   * @param {string} type 操作类型
   * @param {string} tempId 临时 ID
   */
  removeFromOfflineQueue(type, tempId) {
    const queue = StorageUtil.getOfflineQueue();
    const filtered = queue.filter(op => !(op.type === type && op.tempId === tempId));
    StorageUtil.set('offline_queue', filtered);
  }
}

module.exports = RecordService;
