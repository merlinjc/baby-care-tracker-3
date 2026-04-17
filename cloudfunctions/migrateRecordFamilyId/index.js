/**
 * migrateRecordFamilyId 存量迁移云函数
 * 为所有 records 文档补充 familyId 字段
 * 
 * 逻辑：构建 babyId → familyId 映射 → 分批扫描 records → 写入 familyId
 * 幂等设计：已有 familyId 的文档自动跳过
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  // Step 1: 构建 babyId → familyId 映射
  const babies = await getAllDocs(db.collection('babies'), 100);
  const babyFamilyMap = new Map();
  babies.forEach(b => { if (b.familyId) babyFamilyMap.set(b._id, b.familyId); });

  // Step 2: 分批扫描 records
  let skip = event.startFrom || 0;
  const batchSize = 100;
  let stats = { scanned: 0, migrated: 0, skipped: 0, notFound: 0, failed: 0 };

  while (true) {
    const batch = await db.collection('records').skip(skip).limit(batchSize).get();
    if (batch.data.length === 0) break;

    for (const record of batch.data) {
      stats.scanned++;
      if (record.familyId) { stats.skipped++; continue; }
      if (record._familyIdMigratedAt) { stats.skipped++; continue; }

      const familyId = babyFamilyMap.get(record.babyId);
      if (!familyId) { stats.notFound++; continue; }

      try {
        await db.collection('records').doc(record._id).update({
          data: { familyId, _familyIdMigratedAt: new Date() }
        });
        stats.migrated++;
      } catch (e) { stats.failed++; }

      await sleep(50);
    }
    skip += batchSize;
  }

  return { success: true, stats };
};

async function getAllDocs(query, batchSize = 100) {
  let all = [], skip = 0;
  while (true) {
    const res = await query.skip(skip).limit(batchSize).get();
    if (res.data.length === 0) break;
    all = all.concat(res.data);
    skip += batchSize;
  }
  return all;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
