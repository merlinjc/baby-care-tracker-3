/**
 * 云函数：cleanGhostMembers
 * 
 * 一次性清理脚本（v4.1.1 FR-2.1）
 * 遍历所有 families，检查每个 member 的 users.familyId 是否指向该家庭，
 * 不匹配的从 members[] 和 memberDetails[] 中移除。
 * 
 * 执行方式：在微信开发者工具 → 云开发控制台 → 云函数 → 手动调用
 * 支持参数：
 *   - event.startFrom: 断点续传起始位置（默认 0）
 *   - event.dryRun: 设为 true 时仅扫描不清理（默认 false）
 * 
 * 超时设置：60s
 * 幂等性：可安全重复执行（已清理的成员不会再出现在 members 中）
 * 
 * 安全约束：
 *   - 不清理 admin 角色（仅记录警告）
 *   - 不清理只有 1 个成员的家庭
 *   - 不会将家庭清空为 0 成员
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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

  console.log(`[cleanGhostMembers] 开始执行，startFrom=${startFrom}, dryRun=${dryRun}`);

  const stats = {
    totalFamilies: 0,
    totalMembers: 0,
    ghostsFound: 0,
    ghostsCleaned: 0,
    cleanedDetails: [],
    warnings: [],
    errors: [],
    lastProcessedSkip: startFrom,
    dryRun
  };

  try {
    let skip = startFrom;
    const batchSize = 50;

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

      const batch = await db.collection('families').skip(skip).limit(batchSize).get();
      if (batch.data.length === 0) break;

      for (const family of batch.data) {
        stats.totalFamilies++;

        if (!family.members || family.members.length === 0) {
          continue;
        }

        // 只有 1 个成员的家庭不处理，避免清空
        if (family.members.length === 1) {
          continue;
        }

        const ghostIds = [];

        for (const memberId of family.members) {
          stats.totalMembers++;

          try {
            const userDoc = await db.collection('users').doc(memberId).get();
            const user = userDoc.data;

            // 判定幽灵成员：用户的 familyId 不存在或不指向当前家庭
            if (!user.familyId) {
              // familyId 不存在 — 可能是历史数据未绑定，视为幽灵
              const memberDetail = family.memberDetails?.find(m => m.userId === memberId);
              if (memberDetail?.role === 'admin') {
                stats.warnings.push(
                  `Admin "${memberId}" in family "${family._id}" (${family.name || '未命名'}) has no familyId — skipped`
                );
                continue;
              }
              ghostIds.push(memberId);
            } else if (user.familyId !== family._id) {
              // familyId 指向其他家庭 — 确定是幽灵成员
              const memberDetail = family.memberDetails?.find(m => m.userId === memberId);
              if (memberDetail?.role === 'admin') {
                stats.warnings.push(
                  `Admin "${memberId}" in family "${family._id}" (${family.name || '未命名'}) has mismatched familyId "${user.familyId}" — skipped`
                );
                continue;
              }
              ghostIds.push(memberId);
            }
            // else: familyId === family._id → 正常成员，不处理

          } catch (e) {
            // 用户文档不存在 — 视为幽灵成员
            if (e.errCode === -1 || (e.errMsg && e.errMsg.includes('not find'))) {
              ghostIds.push(memberId);
              console.warn(`[检查] 用户 "${memberId}" 文档不存在，标记为幽灵成员`);
            } else {
              stats.errors.push(`检查用户 "${memberId}" 失败: ${e.message || e.errMsg}`);
              console.error(`[检查] 用户 "${memberId}" 查询异常:`, e);
            }
          }
        }

        // 安全检查：不能将家庭清空
        if (ghostIds.length > 0 && ghostIds.length < family.members.length) {
          stats.ghostsFound += ghostIds.length;

          if (!dryRun) {
            // 逐个 pull 移除（原子操作）
            for (const ghostId of ghostIds) {
              try {
                await db.collection('families').doc(family._id).update({
                  data: {
                    members: _.pull(ghostId),
                    memberDetails: _.pull({ userId: ghostId }),
                    updatedAt: new Date().toISOString()
                  }
                });
                stats.ghostsCleaned++;
              } catch (updateErr) {
                stats.errors.push(
                  `清理 family "${family._id}" 的幽灵成员 "${ghostId}" 失败: ${updateErr.message}`
                );
              }
            }

            // 控流
            await sleep(100);
          } else {
            stats.ghostsCleaned += ghostIds.length;
          }

          stats.cleanedDetails.push({
            familyId: family._id,
            familyName: family.name || '未命名',
            membersBefore: family.members.length,
            removedMembers: ghostIds,
            membersAfter: family.members.length - ghostIds.length
          });

          console.log(
            `[清理] 家庭 "${family.name || family._id}": 移除 ${ghostIds.length} 个幽灵成员`,
            ghostIds
          );
        } else if (ghostIds.length > 0 && ghostIds.length >= family.members.length) {
          stats.warnings.push(
            `家庭 "${family._id}" (${family.name || '未命名'}) 所有 ${family.members.length} 个成员均为幽灵 — 跳过清理，避免清空家庭`
          );
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
    console.error('[cleanGhostMembers] 执行失败:', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
};
