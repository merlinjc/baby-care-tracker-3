/**
 * 通用分批并发工具
 * 控制并发数量，避免大量 Promise.all 导致云数据库限流
 */

/**
 * 分批执行异步任务
 * @param {Array} items 待处理的数据数组
 * @param {Function} fn 处理函数，接收单个 item，返回 Promise
 * @param {number} concurrency 每批并发数，默认 10
 * @returns {Promise<Array>} 所有结果数组（顺序与 items 一致）
 */
async function batchExecute(items, fn, concurrency = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

module.exports = { batchExecute };
