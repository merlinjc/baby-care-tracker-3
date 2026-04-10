/**
 * 数据库查询辅助工具
 * 解决微信小程序端 .get() 默认 limit=20 导致的数据截断问题
 * 
 * 应用点：
 * - vaccine.js: vaccine_records 分页查询（P0 数据截断修复）
 * - milestone.js: milestone_records 分页查询（P0 数据截断修复）
 * - todo.js: 查询优化
 */

/**
 * 分页获取全量数据（突破小程序端 20 条 limit 限制）
 * @param {Object} query - 已经 .where() 后的查询对象
 * @param {number} [pageSize=100] - 每页大小，最大 100（小程序端限制）
 * @returns {Promise<Array>} 全量数据
 */
async function fetchAll(query, pageSize = 100) {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await query.skip(offset).limit(pageSize).get();
    allData = allData.concat(data);
    offset += data.length;
    hasMore = data.length === pageSize;
  }

  return allData;
}

module.exports = { fetchAll };
