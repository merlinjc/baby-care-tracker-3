/**
 * 云函数：migrateRecordUserId
 * 
 * 一次性迁移脚本（v4.1.1 FR-1.1）
 * 将存量 records 中的 openid 格式 createdBy.userId / creatorId 更新为 users._id
 * 
 * 执行方式：在微信开发者工具 → 云开发控制台 → 云函数 → 手动调用
 * 支持参数：
 *   - event.startFrom: 断点续传起始位置（默认 0）
 *   - event.dryRun: 设为 true 时仅扫描不更新（默认 false）
 * 
 * 超时设置：60s
 * 幂等性：可安全重复执行（通过 _migratedAt 标记跳过已迁移记录）
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 分批获取集合中所有文档
 * @param {object} collection - 数据库集合引用
 * @param {string[]} fields - 需要的字段列表（云开发 NoSQL 暂不支持 field 投影，获取全部）
 * @param {number} batchSize - 每批数量
 * @returns {Promise<object[]>} 所有文档
 */
async function getAllDocs(collection, batchSize = 100) {
  const docs = [];
  let skip = 0;

  while (true) {
    const res = await collection.skip(skip).limit(batchSize).get();
    if (res.data.length === 0) break;
    docs.push(...res.data);
    skip += batchSize;
  }

  return docs;
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.main = async (event, context) => {
  const startFrom = event.startFrom || 0;
  const dryRun = event.dryRun || false;
  const startTime = Date.now();

  console.log(`[migrateRecordUserId] 开始执行，startFrom=${startFrom}, dryRun=${dryRun}`);

  const stats = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    alreadyCorrect: 0,
    notFound: 0,
    failed: 0,
    lastProcessedSkip: startFrom,
    dryRun
  };

  try {
    // ========== Step 1: 构建 openid → _id 映射表 ==========
    console.log('[Step 1] 构建 openid → _id 映射表...');
    const users = await getAllDocs(db.collection('users'));
    console.log(`[Step 1] 获取到 ${users.length} 个用户文档`);

    const openidToIdMap = new Map();
    const idSet = new Set();  // 用于快速判断某个值是否已是 _id 格式

    for (const user of users) {
      idSet.add(user._id);
      if (user._openid) {
        openidToIdMap.set(user._openid, user._id);
      } else {
        console.warn(`[Step 1] 用户 ${user._id} 缺少 _openid 字段，跳过`);
      }
    }
    console.log(`[Step 1] 映射表构建完成，共 ${openidToIdMap.size} 条映射`);

    // ========== Step 2: 分批扫描 records ==========
    console.log('[Step 2] 开始扫描 records...');
    let skip = startFrom;
    const batchSize = 100;

    while (true) {
      // 超时保护：预留 5s 用于返回结果
      if (Date.now() - startTime > 55000) {
        console.warn(`[超时保护] 已运行 ${Math.round((Date.now() - startTime) / 1000)}s，保存进度退出`);
        stats.lastProcessedSkip = skip;
        return {
          success: true,
          completed: false,
          message: '超时保护触发，请使用 startFrom 参数继续执行',
          nextStartFrom: skip,
          stats
        };
      }

      const batch = await db.collection('records').skip(skip).limit(batchSize).get();
      if (batch.data.length === 0) break;

      for (const record of batch.data) {
        stats.scanned++;

        // 获取记录中的创建者 ID
        const createdByUserId = record.createdBy?.userId || '';
        const creatorId = record.creatorId || '';
        const oldCreatorId = createdByUserId || creatorId;

        if (!oldCreatorId) {
          stats.skipped++;
          continue;
        }

        // 已迁移过，跳过
        if (record._migratedAt) {
          stats.skipped++;
          continue;
        }

        // 已是 _id 格式，跳过
        if (idSet.has(oldCreatorId)) {
          stats.alreadyCorrect++;
          continue;
        }

        // 尝试从映射表找到对应的 _id
        const newId = openidToIdMap.get(oldCreatorId);
        if (!newId) {
          stats.notFound++;
          console.warn(`[Step 2] record ${record._id} 的 creatorId "${oldCreatorId}" 在映射表中未找到`);
          continue;
        }

        // ========== Step 3: 更新 ==========
        if (!dryRun) {
          try {
            const updateData = {
              _migratedAt: new Date()
            };

            // 更新 createdBy.userId（如果存在 createdBy 对象）
            if (record.createdBy && typeof record.createdBy === 'object') {
              updateData['createdBy.userId'] = newId;
            }

            // 更新 creatorId（如果存在）
            if (record.creatorId) {
              updateData.creatorId = newId;
            }

            await db.collection('records').doc(record._id).update({
              data: updateData
            });

            stats.migrated++;
          } catch (e) {
            stats.failed++;
            console.error(`[Step 3] 更新 record ${record._id} 失败:`, e.message);
          }

          // 控流：每条更新间隔 50ms
          await sleep(50);
        } else {
          stats.migrated++;  // dryRun 模式下计为"将要迁移"
          console.log(`[DryRun] record ${record._id}: "${oldCreatorId}" → "${newId}"`);
        }
      }

      skip += batchSize;
      stats.lastProcessedSkip = skip;
    }

    // ========== 完成 ==========
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[完成] 耗时 ${elapsed}s`, JSON.stringify(stats));

    return {
      success: true,
      completed: true,
      elapsed: `${elapsed}s`,
      stats
    };

  } catch (error) {
    console.error('[migrateRecordUserId] 执行失败:', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
};
