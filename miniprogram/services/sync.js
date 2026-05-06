/**
 * 数据同步服务
 * 实现实时推送订阅、离线队列同步、网络状态监听
 */

const StorageUtil = require('../utils/storage');
const NetworkUtil = require('../utils/network');

// 单例模式
let instance = null;

class SyncService {
  constructor() {
    if (instance) return instance;
    
    this.db = wx.cloud.database();
    this.watchers = {}; // 订阅器集合
    this.syncInProgress = false; // 同步进行中标记
    // [v4.3.0 FR-2] 单例模式统一：改走 getInstance()
    this.networkUtil = NetworkUtil.getInstance();
    this.MAX_RETRY_COUNT = 3; // 最大重试次数
    
    // 监听网络状态变化
    this.initNetworkListener();
    
    instance = this;
  }
  
  static getInstance() {
    if (!instance) {
      instance = new SyncService();
    }
    return instance;
  }

  /** [v4.3.2 FR-A13] 重置单例（用于退出登录/家庭解散后清理） */
  static resetInstance() { instance = null; }

  /**
   * 初始化网络监听器
   */
  initNetworkListener() {
    this.networkUtil.addListener((isOnline) => {
      if (isOnline) {
        // 网络恢复，触发同步
        this.syncOfflineQueue();
      }
    });
  }

  /**
   * 订阅宝宝记录变化
   * @deprecated 全项目无调用方，保留供未来实时推送功能使用
   * @param {string} babyId 宝宝 ID
   * @param {Function} onChange 变化回调
   */
  subscribeRecords(babyId, onChange) {
    // 如果已存在订阅，先取消
    if (this.watchers[babyId]) {
      this.unsubscribeRecords(babyId);
    }

    // 创建订阅
    const watcher = this.db.collection('records')
      .where({
        babyId
      })
      .watch({
        onChange: (snapshot) => {
          // 处理不同类型的变化
          if (snapshot.type === 'init') {
            // 初始化数据
            onChange({
              type: 'init',
              data: snapshot.docs
            });
          } else if (snapshot.type === 'update') {
            // 更新数据
            onChange({
              type: 'update',
              changes: snapshot.docChanges
            });
          }
        },
        onError: (error) => {
          console.error('订阅错误:', error);
          
          // 如果是离线错误，不处理
          if (error.errMsg && error.errMsg.includes('network')) {
            return;
          }
          
          // 其他错误，通知用户
          onChange({
            type: 'error',
            error
          });
        }
      });

    this.watchers[babyId] = watcher;
    
    return watcher;
  }

  /**
   * 取消订阅宝宝记录
   * @deprecated 全项目无调用方
   * @param {string} babyId 宝宝 ID
   */
  unsubscribeRecords(babyId) {
    if (this.watchers[babyId]) {
      this.watchers[babyId].close();
      delete this.watchers[babyId];
    }
  }

  /**
   * 订阅家庭组变化
   * @deprecated 全项目无调用方，保留供未来实时推送功能使用
   * @param {string} familyId 家庭 ID
   * @param {Function} onChange 变化回调
   */
  subscribeFamily(familyId, onChange) {
    const watcherKey = `family_${familyId}`;
    
    // 如果已存在订阅，先取消
    if (this.watchers[watcherKey]) {
      this.unsubscribeFamily(familyId);
    }

    const watcher = this.db.collection('families')
      .doc(familyId)
      .watch({
        onChange: (snapshot) => {
          if (snapshot.type === 'init') {
            // 添加空值检查
            const data = snapshot.docs && snapshot.docs.length > 0 ? snapshot.docs[0] : null;
            onChange({
              type: 'init',
              data
            });
          } else if (snapshot.type === 'update') {
            // 添加空值检查
            const data = snapshot.docChanges && snapshot.docChanges.length > 0 ? snapshot.docChanges[0].doc : null;
            onChange({
              type: 'update',
              data
            });
          }
        },
        onError: (error) => {
          console.error('订阅家庭组错误:', error);
          onChange({
            type: 'error',
            error
          });
        }
      });

    this.watchers[watcherKey] = watcher;
    
    return watcher;
  }

  /**
   * 取消订阅家庭组
   * @deprecated 全项目无调用方
   * @param {string} familyId 家庭 ID
   */
  unsubscribeFamily(familyId) {
    const watcherKey = `family_${familyId}`;
    if (this.watchers[watcherKey]) {
      this.watchers[watcherKey].close();
      delete this.watchers[watcherKey];
    }
  }

  /**
   * 同步离线队列
   */
  async syncOfflineQueue() {
    // 防止重复同步
    if (this.syncInProgress) {
      return { total: 0, success: 0, failed: 0, message: '同步进行中' };
    }

    let queue = StorageUtil.getOfflineQueue();
    
    if (queue.length === 0) {
      return { total: 0, success: 0, failed: 0, message: '队列为空' };
    }

    this.syncInProgress = true;

    try {
      const successCount = { value: 0 };
      const failedQueue = [];

      // 为每个操作打上唯一标记，用于后续精确移除
      const processedTimestamps = new Set();
      // 需要保留在队列中的失败操作（含更新后的 retryCount）
      const retryOperations = new Map();

      for (let i = 0; i < queue.length; i++) {
        const operation = queue[i];
        const opKey = operation.timestamp; // 使用 addToOfflineQueue 时写入的 timestamp 作为标识
        
        // 初始化重试计数
        if (operation.retryCount === undefined) {
          operation.retryCount = 0;
        }
        
        try {
          await this.executeOperation(operation);
          successCount.value++;
          // 标记此操作需要移除
          processedTimestamps.add(opKey);
        } catch (error) {
          // 增加重试计数
          operation.retryCount++;
          
          if (operation.retryCount >= this.MAX_RETRY_COUNT) {
            // 超过最大重试次数，标记为移除
            processedTimestamps.add(opKey);
            failedQueue.push({
              index: i,
              operation,
              error: error.message || '同步失败'
            });
          } else {
            // 未超过重试上限，保留但需更新 retryCount
            retryOperations.set(opKey, operation.retryCount);
          }
        }
      }

      // 重新读取最新队列（可能在同步期间有新操作加入）
      const latestQueue = StorageUtil.getOfflineQueue();
      const remainingQueue = latestQueue.filter(op => {
        if (processedTimestamps.has(op.timestamp)) {
          return false; // 已成功或已超出重试上限，移除
        }
        // 更新仍需重试的操作的 retryCount
        if (retryOperations.has(op.timestamp)) {
          op.retryCount = retryOperations.get(op.timestamp);
        }
        return true;
      });
      StorageUtil.set('offline_queue', remainingQueue);

      // 返回同步结果
      const result = {
        total: queue.length,
        success: successCount.value,
        failed: failedQueue.length,
        pending: remainingQueue.length,
        failedQueue
      };

      // 如果有失败的记录，提示用户
      if (failedQueue.length > 0) {
        wx.showModal({
          title: '同步失败',
          content: `${failedQueue.length} 条记录同步失败，已超过最大重试次数。请检查网络后手动重试。`,
          showCancel: false,
          confirmText: '知道了'
        });
      }

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 执行单个操作
   * @param {Object} operation 操作对象
   */
  async executeOperation(operation) {
    const { type, collection, recordId, data, tempId } = operation;

    switch (type) {
      case 'create':
        // [v4.3.0 FR-4] 时间戳规整：离线队列 data 在 JSON 序列化/反序列化后，
        // Date 字段会变成 ISO 字符串。同步前规整回 Date 对象，并用 serverDate 覆盖
        // startTime/createdAt/updatedAt 以获得权威的服务器时间。
        const normalizedData = this._normalizeTimestamps(data);

        // 创建记录
        const res = await this.db.collection(collection).add({
          data: normalizedData
        });
        
        // 更新本地缓存中的临时 ID 为真实 ID
        this.updateRecordId(tempId, res._id);
        break;
        
      case 'update':
        // 更新记录
        // [v4.3.1 FR-7] 补 updatedAtTs 双时间戳，与 RecordService.updateRecord 对齐，
        // 修复 mergeRecords 按 updatedAtTs 比较失效（云端永远是旧值）
        // [v4.3.2 FR-2] 通过云函数路径执行，无论是否跨归属：
        //   - 保证 admin 离线期间编辑他人记录的 update 在同步时被允许
        //   - 云函数内有字段白名单与权限再校验，安全性更强
        //   - 同步频率低（通常仅在离线→在线切换时），额外 RTT 可接受
        if (collection === 'records') {
          await this._callRecordCloudFn('updateRecord', {
            recordId,
            data: { ...data, updatedAtTs: Date.now() }
          });
        } else {
          await this.db.collection(collection).doc(recordId).update({
            data: {
              ...data,
              updatedAt: this.db.serverDate(),
              updatedAtTs: Date.now()
            }
          });
        }
        break;
        
      case 'delete':
        // 删除记录
        // [v4.3.2 FR-2] 同上，通过云函数路径执行
        if (collection === 'records') {
          await this._callRecordCloudFn('deleteRecord', { recordId });
        } else {
          await this.db.collection(collection).doc(recordId).remove();
        }
        break;
        
      default:
        throw new Error(`未知操作类型: ${type}`);
    }
  }

  /**
   * [v4.3.2 FR-2] 通过云函数执行记录写操作（离线队列同步路径）
   *
   * 幂等处理：deleteRecord 返回 RECORD_NOT_FOUND 视为成功（目标已删）
   * 错误传播：其他失败抛 Error，供调用方（syncOfflineQueue）按 MAX_RETRY_COUNT 重试/丢弃
   *
   * @private
   * @param {'updateRecord'|'deleteRecord'} action
   * @param {Object} params
   */
  async _callRecordCloudFn(action, params) {
    const familyId = require('../utils/family-context').resolve();
    const res = await wx.cloud.callFunction({
      name: 'familyOperation',
      data: { action, params: { ...params, familyId } }
    });
    const result = res && res.result;
    if (result && result.success) return result.data;
    const code = result && result.error && result.error.code;
    // deleteRecord 幂等：目标已不存在视为成功
    if (action === 'deleteRecord' && code === 'RECORD_NOT_FOUND') {
      return { alreadyDeleted: true };
    }
    const err = new Error((result && result.error && result.error.message) || `${action} 失败`);
    if (code) err.code = code;
    throw err;
  }

  /**
   * [v4.3.0 FR-4] 规整离线队列 data 的时间戳字段
   * - startTime/endTime/createdAt/updatedAt 若为字符串（ISO）→ new Date()
   * - createdAt/updatedAt 用 serverDate 覆盖，保证云端写入为权威时间
   * - 保留 Ts 数值时间戳（客户端可靠读取）
   * @private
   * @param {Object} data 原始队列数据
   * @returns {Object} 规整后的数据
   */
  _normalizeTimestamps(data) {
    const out = { ...data };
    const toDate = (v) => {
      if (!v) return v;
      if (v instanceof Date) return v;
      if (typeof v === 'string' || typeof v === 'number') return new Date(v);
      return v;
    };

    if (out.startTime) out.startTime = toDate(out.startTime);
    if (out.endTime) out.endTime = toDate(out.endTime);
    // createdAt/updatedAt 使用 serverDate 获得权威时间（同步时刻而非离线创建时刻，
    // 这符合"云端首次落地"语义；离线时刻已通过 createdAtTs 保留）
    out.createdAt = this.db.serverDate();
    out.updatedAt = this.db.serverDate();
    return out;
  }

  /**
   * 更新记录 ID（离线记录同步后）
   *
   * [v4.3.2 FR-A7] 同步翻新离线队列中残留的 update/delete 操作
   * 根因：离线 create → update → update → online sync 场景下：
   *   1. syncCreate 成功后 tempId 翻新为 realId（仅本地缓存）
   *   2. 队列里还有 { type:'update'|'delete', recordId: 'temp_xxx' } 残留
   *   3. 后续 executeOperation 用旧 tempId 调 doc('temp_xxx').update()
   *      → 云端 INVALID_DOC_ID → 重试 3 次后丢弃
   *   4. 用户离线期间做的所有编辑/删除永久丢失
   * 修复：翻新本地缓存的同时，同步翻新队列里所有同 tempId 的操作。
   *
   * 并发安全：syncOfflineQueue 持 syncInProgress=true 防重入；当前循环的
   * queue 是方法开头快照，翻新在 Storage 层写入，下次循环自然读到最新。
   *
   * @param {string} tempId 临时 ID
   * @param {string} realId 真实 ID
   */
  updateRecordId(tempId, realId) {
    // 1. 原逻辑：翻新本地 records 缓存
    const familyInfo = StorageUtil.getFamilyInfo();
    
    if (familyInfo && familyInfo.babies) {
      familyInfo.babies.forEach(babyId => {
        const key = `records_${babyId}`;
        const records = StorageUtil.get(key) || [];
        const index = records.findIndex(r => r._id === tempId);
        
        if (index >= 0) {
          records[index]._id = realId;
          records[index]._offline = false;
          StorageUtil.set(key, records);
        }
      });
    }

    // 2. [v4.3.2 FR-A7] 同步翻新离线队列中残留的 update/delete 操作
    try {
      const queue = StorageUtil.getOfflineQueue();
      let mutated = false;
      const newQueue = queue.map(op => {
        if (op && op.recordId === tempId) {
          mutated = true;
          return Object.assign({}, op, { recordId: realId });
        }
        return op;
      });
      if (mutated) {
        StorageUtil.set('offline_queue', newQueue);
        console.log(`[sync] 翻新队列：tempId=${tempId} → realId=${realId}`);
      }
    } catch (e) {
      // 翻新失败不影响主流程（本地缓存已翻新，队列残留项会因 INVALID_DOC_ID
      // 最终被 MAX_RETRY_COUNT 丢弃；只是丢用户编辑，与原行为一致）
      console.warn('[sync.updateRecordId] 翻新队列失败:', e);
    }
  }

  /**
   * 清理所有订阅
   */
  clearAllWatchers() {
    Object.keys(this.watchers).forEach(key => {
      this.watchers[key].close();
    });
    this.watchers = {};
  }

  /**
   * 获取同步状态
   * @returns {Object} 同步状态
   */
  getSyncStatus() {
    const queue = StorageUtil.getOfflineQueue();
    
    return {
      hasPendingSync: queue.length > 0,
      pendingCount: queue.length,
      syncInProgress: this.syncInProgress,
      isOnline: this.networkUtil.checkOnline()
    };
  }
}

module.exports = SyncService;
