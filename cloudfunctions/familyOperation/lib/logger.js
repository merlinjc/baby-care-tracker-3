/**
 * 补偿日志记录器（v4.3.0 FR-9）
 *
 * 用途：为 dissolveFamily / clearBabyData / removeMember 等多步操作
 * 记录中间步骤，便于失败定位和人工修复。
 *
 * 所有方法的写入失败都不影响主流程（内部 .catch(() => {})）。
 */

const COLLECTION = 'operation_logs';

class OperationLogger {
  /**
   * @param {Object} db 云数据库实例
   * @param {string} action action 名称（如 'dissolveFamily'）
   * @param {string} userId 当前用户 ID
   * @param {string} openid 当前用户 openid
   */
  constructor(db, action, userId = '', openid = '') {
    this.db = db;
    this.action = action;
    this.userId = userId;
    this.openid = openid;
    this.logId = null;
    this.steps = [];
  }

  /**
   * 开启一次操作记录
   * @param {Object} context 上下文参数
   * @returns {Promise<string|null>} logId
   */
  async start(context = {}) {
    try {
      const res = await this.db.collection(COLLECTION).add({
        data: {
          action: this.action,
          userId: this.userId,
          openid: this.openid,
          status: 'started',
          steps: [],
          context,
          startedAt: new Date(),
          startedAtTs: Date.now()
        }
      });
      this.logId = res._id;
      return this.logId;
    } catch (e) {
      // 日志写入失败不影响业务
      return null;
    }
  }

  /**
   * 记录一个步骤
   * @param {string} name 步骤名
   * @param {'ok'|'fail'|'skip'} status 步骤状态
   * @param {Object} extra 附加信息（如 count / entityId / error）
   */
  async step(name, status, extra = {}) {
    if (!this.logId) return;
    this.steps.push(Object.assign({ name, status, at: new Date() }, extra));
    try {
      await this.db.collection(COLLECTION).doc(this.logId).update({
        data: { steps: this.steps }
      });
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 成功完成
   * @param {Object} result 业务结果
   */
  async succeed(result = {}) {
    if (!this.logId) return;
    try {
      await this.db.collection(COLLECTION).doc(this.logId).update({
        data: {
          status: 'succeeded',
          result,
          finishedAt: new Date(),
          finishedAtTs: Date.now()
        }
      });
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 部分完成（有非致命失败）
   * @param {string} reason 原因
   */
  async partial(reason = '') {
    if (!this.logId) return;
    try {
      await this.db.collection(COLLECTION).doc(this.logId).update({
        data: {
          status: 'partial',
          reason,
          finishedAt: new Date(),
          finishedAtTs: Date.now()
        }
      });
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 彻底失败（全局异常捕获时调用）
   * @param {Error} error
   */
  async fail(error) {
    if (!this.logId) return;
    try {
      await this.db.collection(COLLECTION).doc(this.logId).update({
        data: {
          status: 'failed',
          error: {
            message: error && error.message,
            stack: error && error.stack
          },
          finishedAt: new Date(),
          finishedAtTs: Date.now()
        }
      });
    } catch (e) { /* 忽略 */ }
  }
}

module.exports = { OperationLogger };
