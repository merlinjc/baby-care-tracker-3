/**
 * migrateFamilyOpenids 存量迁移云函数
 * 为所有 families 文档补充 memberOpenids 字段
 * 
 * 逻辑：遍历 families → 查 members 对应的 users._openid → 写入 memberOpenids
 * 幂等设计：已有 memberOpenids 的文档自动跳过
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();

  let skip = event.startFrom || 0;
  const batchSize = 50;
  let stats = { scanned: 0, migrated: 0, skipped: 0, failed: 0, warnings: [] };

  while (true) {
    const batch = await db.collection('families').skip(skip).limit(batchSize).get();
    if (batch.data.length === 0) break;

    for (const family of batch.data) {
      stats.scanned++;
      if (family.memberOpenids && family.memberOpenids.length > 0) {
        stats.skipped++;
        continue;
      }

      const memberOpenids = [];
      for (const memberId of (family.members || [])) {
        try {
          const userDoc = await db.collection('users').doc(memberId).get();
          if (userDoc.data._openid) {
            memberOpenids.push(userDoc.data._openid);
          } else {
            stats.warnings.push(`User ${memberId} has no _openid`);
          }
        } catch (e) {
          stats.warnings.push(`User ${memberId} not found: ${e.message}`);
        }
      }

      try {
        await db.collection('families').doc(family._id).update({
          data: {
            memberOpenids,
            _openidsMigratedAt: new Date()
          }
        });
        stats.migrated++;
      } catch (e) {
        stats.failed++;
      }
    }
    skip += batchSize;
  }

  return { success: true, stats };
};
