/**
 * 持久化限流器（v4.3.0 FR-11）
 *
 * 存储：rate_limits 集合（PRIVATE ACL）
 *   { _id: hashKey, key, count, windowStart, expireAt }
 *
 * 限流策略（默认）：60 秒内最多 5 次
 * TTL：30 分钟（由 CloudBase TTL 索引清理，兜底）
 *
 * 失败降级：
 * - 读/写异常时放行（best-effort，不让限流阻断业务）
 * - 限流本质是"防滥用"，不是强一致安全屏障
 */

const crypto = require('crypto');

const COLLECTION = 'rate_limits';
const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_COUNT = 5;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function hashKey(key) {
  return 'rl_' + crypto.createHash('md5').update(String(key)).digest('hex').slice(0, 16);
}

class RateLimiter {
  /**
   * @param {Object} db 云数据库实例
   * @param {Object} options { windowMs, maxCount, ttlMs }
   */
  constructor(db, options = {}) {
    this.db = db;
    this.windowMs = options.windowMs || DEFAULT_WINDOW_MS;
    this.maxCount = options.maxCount || DEFAULT_MAX_COUNT;
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  }

  /**
   * 检查并计数
   * @param {string} key 限流键，如 "invite_<openid>"
   * @returns {Promise<{ allowed: boolean, count: number }>}
   */
  async check(key) {
    const _ = this.db.command;
    const now = Date.now();
    const docId = hashKey(key);
    const coll = this.db.collection(COLLECTION);

    try {
      const doc = await coll.doc(docId).get().catch((e) => {
        const msg = e && e.errMsg || '';
        if (msg.includes('cannot find document') || msg.includes('does not exist')) {
          return null;
        }
        throw e;
      });

      if (!doc || !doc.data) {
        // 首次，创建
        try {
          await coll.add({
            data: {
              _id: docId,
              key,
              count: 1,
              windowStart: now,
              expireAt: new Date(now + this.ttlMs)
            }
          });
        } catch (e) {
          // 并发冲突（另一实例已插入），退化为 update +1
          await coll.doc(docId).update({
            data: { count: _.inc(1), expireAt: new Date(now + this.ttlMs) }
          }).catch(() => {});
        }
        return { allowed: true, count: 1 };
      }

      const rec = doc.data;
      // 窗口过期 → 重置计数
      if (now - (rec.windowStart || 0) > this.windowMs) {
        await coll.doc(docId).update({
          data: {
            count: 1,
            windowStart: now,
            expireAt: new Date(now + this.ttlMs)
          }
        });
        return { allowed: true, count: 1 };
      }

      // 窗口内
      if ((rec.count || 0) >= this.maxCount) {
        return { allowed: false, count: rec.count };
      }

      // 原子 +1
      await coll.doc(docId).update({
        data: {
          count: _.inc(1),
          expireAt: new Date(now + this.ttlMs)
        }
      });
      return { allowed: true, count: (rec.count || 0) + 1 };
    } catch (e) {
      // best-effort：异常时放行
      console.error('[RateLimiter] check 异常，降级放行:', e && e.message);
      return { allowed: true, count: 0 };
    }
  }
}

module.exports = { RateLimiter, hashKey };
