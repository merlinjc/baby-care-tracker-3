/**
 * 数据迁移脚本：为 families 集合中缺少 role 的 memberDetails 补充默认值
 * 
 * 迁移逻辑：
 * 1. 遍历 families 集合中所有文档
 * 2. 检查 memberDetails 中是否有成员缺少 role 字段
 * 3. 如果 memberDetails[i].userId === family.creatorId，设置 role = 'admin'
 * 4. 其他成员设置 role = 'editor'
 * 5. 同步更新对应 users 集合中的 familyRole 字段
 * 
 * 运行方式：
 * 在微信开发者工具的云开发控制台中运行，
 * 或者作为云函数部署后执行。
 * 
 * 使用说明：
 * 1. 打开微信开发者工具的云开发控制台
 * 2. 进入「数据库」页面
 * 3. 在右上角点击「高级操作」或使用云函数方式执行
 * 
 * 注意：此脚本是幂等的，多次运行不会产生副作用
 */

// ====== 以下代码适用于云函数执行环境 ======

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const result = {
    totalFamilies: 0,
    migratedFamilies: 0,
    migratedMembers: 0,
    updatedUsers: 0,
    errors: [],
    skipped: 0
  };

  try {
    // 分批获取所有 families（每次最多 100 条）
    let allFamilies = [];
    let skip = 0;
    const batchSize = 100;

    while (true) {
      const { data } = await db.collection('families')
        .skip(skip)
        .limit(batchSize)
        .get();

      if (data.length === 0) break;
      allFamilies = allFamilies.concat(data);
      skip += batchSize;

      // 安全阀：最多处理 10000 个家庭
      if (allFamilies.length >= 10000) break;
    }

    result.totalFamilies = allFamilies.length;
    console.log(`[迁移] 共找到 ${allFamilies.length} 个家庭`);

    for (const family of allFamilies) {
      try {
        const { _id: familyId, creatorId, memberDetails } = family;

        // 跳过没有 memberDetails 的家庭
        if (!memberDetails || !Array.isArray(memberDetails) || memberDetails.length === 0) {
          result.skipped++;
          console.log(`[迁移] 跳过家庭 ${familyId}：无 memberDetails`);
          continue;
        }

        // 检查是否有成员缺少 role
        let needsMigration = false;
        const updatedDetails = memberDetails.map(member => {
          if (!member.role) {
            needsMigration = true;
            const role = (member.userId === creatorId) ? 'admin' : 'editor';
            result.migratedMembers++;
            return { ...member, role };
          }
          return member;
        });

        if (!needsMigration) {
          result.skipped++;
          continue;
        }

        // 更新 families 集合
        await db.collection('families').doc(familyId).update({
          data: {
            memberDetails: updatedDetails,
            _migratedRoles: true,  // 标记已迁移
            _migratedAt: db.serverDate()
          }
        });
        result.migratedFamilies++;
        console.log(`[迁移] 已更新家庭 ${familyId}，${updatedDetails.length} 个成员`);

        // 同步更新 users 集合中的 familyRole
        for (const member of updatedDetails) {
          try {
            // 只更新原本缺少 role 的成员
            const originalMember = memberDetails.find(m => m.userId === member.userId);
            if (originalMember && !originalMember.role) {
              await db.collection('users').doc(member.userId).update({
                data: {
                  familyRole: member.role
                }
              });
              result.updatedUsers++;
            }
          } catch (userError) {
            // users 更新失败不影响整体迁移
            console.warn(`[迁移] 更新用户 ${member.userId} 失败:`, userError.message);
            result.errors.push({
              type: 'user_update',
              userId: member.userId,
              familyId,
              error: userError.message
            });
          }
        }
      } catch (familyError) {
        console.error(`[迁移] 处理家庭 ${family._id} 失败:`, familyError.message);
        result.errors.push({
          type: 'family_update',
          familyId: family._id,
          error: familyError.message
        });
      }
    }

    console.log('[迁移] 完成！结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[迁移] 脚本执行失败:', error);
    result.errors.push({
      type: 'script',
      error: error.message
    });
    return result;
  }
};
