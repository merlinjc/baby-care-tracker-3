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
 * [v4.3.2 P2] fetchAll 最大页数保护
 * 防止数据量异常（如离线积累数万条）导致 fetchAll 无限循环
 * 默认最多 100 页 × 100 条/页 = 10000 条记录
 */
const MAX_PAGES = 100;

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
  let pageCount = 0;

  while (hasMore && pageCount < MAX_PAGES) {
    const { data } = await query.skip(offset).limit(pageSize).get();
    allData = allData.concat(data);
    offset += data.length;
    pageCount++;
    hasMore = data.length === pageSize;
  }

  if (pageCount >= MAX_PAGES && hasMore) {
    console.warn(`[fetchAll] 达到 MAX_PAGES=${MAX_PAGES} 上限，数据可能截断。offset=${offset}`);
  }

  return allData;
}

module.exports = { fetchAll };
