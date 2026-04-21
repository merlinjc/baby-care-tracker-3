/**
 * 数据库辅助工具（v4.3.0 FR-7 / FR-10）
 */

/**
 * 分页获取所有文档
 * @param {Object} query 查询对象
 * @param {number} batchSize 每批数量
 * @returns {Promise<Array>} 所有文档
 */
async function getAllDocs(query, batchSize = 100) {
  let all = [];
  let skip = 0;
  while (true) {
    const res = await query.skip(skip).limit(batchSize).get();
    if (res.data.length === 0) break;
    all = all.concat(res.data);
    skip += batchSize;
    if (res.data.length < batchSize) break;
  }
  return all;
}

/**
 * 分批并发删除文档
 * @param {Object} db 云数据库实例
 * @param {string} collection 集合名
 * @param {string[]} ids 文档 ID 数组
 * @param {number} concurrency 并发数（默认 10）
 * @returns {Promise<number>} 成功删除的数量
 */
async function chunkedDelete(db, collection, ids, concurrency = 10) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(id =>
      db.collection(collection).doc(id).remove()
        .then(() => 1)
        .catch((err) => {
          console.warn(`[chunkedDelete] ${collection}/${id} 删除失败:`, err && err.errMsg);
          return 0;
        })
    ));
    deleted += results.reduce((s, n) => s + n, 0);
  }
  return deleted;
}

module.exports = {
  getAllDocs,
  chunkedDelete
};
