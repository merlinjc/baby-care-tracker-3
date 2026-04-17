/**
 * familyOperation 云函数网关
 * 统一处理所有跨用户数据库写操作
 * 
 * 支持的 action:
 * - createFamily: 创建家庭
 * - joinFamily: 通过邀请码加入家庭
 * - removeMember: 移除成员
 * - dissolveFamily: 解散家庭
 * - updateMemberRole: 修改成员权限
 * - transferAdmin: 转让管理员
 * - leaveFamily: 退出家庭
 * - refreshInviteCode: 刷新邀请码
 * - validateInviteCode: 验证邀请码
 * - getFamilyByUserId: 通过用户 ID 获取家庭
 * - createBaby: 创建宝宝
 * - deleteBaby: 删除宝宝
 * - clearBabyData: 清除宝宝所有数据
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// ============================================================
// 限流 Map（实例级别，重启清零）
// ============================================================
const rateLimitMap = new Map();

// ============================================================
// 入口函数
// ============================================================
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, params = {} } = event;

  try {
    // 1. 通过 OPENID 获取用户信息
    const userRes = await db.collection('users')
      .where({ _openid: OPENID })
      .limit(1)
      .get();

    if (userRes.data.length === 0) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
    }

    const user = userRes.data[0];
    const userId = user._id;

    // 2. 分发 action
    switch (action) {
      case 'createFamily':
        return await createFamily(db, _, userId, OPENID, user, params);
      case 'joinFamily':
        return await joinFamily(db, _, userId, OPENID, user, params);
      case 'removeMember':
        return await removeMember(db, _, userId, OPENID, params);
      case 'dissolveFamily':
        return await dissolveFamily(db, _, userId, OPENID, params);
      case 'updateMemberRole':
        return await updateMemberRole(db, _, userId, OPENID, params);
      case 'transferAdmin':
        return await transferAdmin(db, _, userId, OPENID, params);
      case 'leaveFamily':
        return await leaveFamily(db, _, userId, OPENID, params);
      case 'refreshInviteCode':
        return await refreshInviteCode(db, _, userId, OPENID, params);
      case 'validateInviteCode':
        return await validateInviteCode(db, _, userId, OPENID, params);
      case 'getFamilyByUserId':
        return await getFamilyByUserId(db, _, userId, OPENID);
      case 'createBaby':
        return await createBaby(db, _, userId, OPENID, params);
      case 'deleteBaby':
        return await deleteBaby(db, _, userId, OPENID, params);
      case 'clearBabyData':
        return await clearBabyData(db, _, userId, OPENID, params);
      default:
        return { success: false, error: { code: 'INVALID_ACTION', message: `未知操作: ${action}` } };
    }
  } catch (error) {
    console.error(`[familyOperation] action=${action} error:`, error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || '服务器内部错误' }
    };
  }
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取家庭文档
 * @param {Object} db 数据库实例
 * @param {string} familyId 家庭 ID
 * @returns {Object|null} 家庭文档或 null
 */
async function getFamily(db, familyId) {
  try {
    const res = await db.collection('families').doc(familyId).get();
    return res.data;
  } catch (e) {
    if (e.errMsg?.includes('cannot find document')) return null;
    throw e;
  }
}

/**
 * 检查用户是否为管理员
 * @param {string} userId 用户 ID
 * @param {Object} family 家庭文档
 * @returns {boolean}
 */
function isAdmin(userId, family) {
  const member = family.memberDetails?.find(m => m.userId === userId);
  if (member?.role === 'admin') return true;
  if (family.creatorId === userId) return true;
  return false;
}

/**
 * 清除用户的家庭关联信息
 * @param {Object} db 数据库实例
 * @param {Object} _ db.command
 * @param {string} userId 用户 ID
 */
async function clearUserFamily(db, _, userId) {
  await db.collection('users').doc(userId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: new Date().toISOString()
    }
  });
}

/**
 * 返回家庭不存在的标准错误
 */
function familyNotFound() {
  return { success: false, error: { code: 'FAMILY_NOT_FOUND', message: '家庭不存在' } };
}

/**
 * 返回权限不足的标准错误
 * @param {string} message 错误信息
 */
function permissionDenied(message) {
  return { success: false, error: { code: 'PERMISSION_DENIED', message } };
}

/**
 * 生成 6 位邀请码（排除易混淆字符 I/O/0/1）
 * @returns {string} 邀请码
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 分页获取所有文档
 * @param {Object} query 查询对象
 * @param {number} batchSize 每批数量
 * @returns {Array} 所有文档
 */
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

// ============================================================
// Action: createFamily (FR-11)
// ============================================================
async function createFamily(db, _, userId, openid, user, params) {
  const { name } = params;
  const creatorName = user.nickname || '';

  const inviteCode = generateInviteCode();
  const now = new Date();
  const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const familyData = {
    name,
    creatorId: userId,
    creatorName,
    members: [userId],
    memberDetails: [{
      userId,
      name: creatorName,
      role: 'admin',
      joinedAt: now.toISOString()
    }],
    memberOpenids: [openid],  // ★ FR-11: 初始化 memberOpenids
    inviteCode,
    inviteCodeExpiry: inviteExpiry.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const res = await db.collection('families').add({ data: familyData });

  return {
    success: true,
    data: { _id: res._id, ...familyData }
  };
}

// ============================================================
// Action: joinFamily (FR-2, FR-11)
// ============================================================
async function joinFamily(db, _, userId, openid, user, params) {
  const { inviteCode, userName, relation } = params;

  // 限流：60s 内最多 5 次
  const limitKey = `invite_${openid}`;
  const now = Date.now();
  const attempts = rateLimitMap.get(limitKey) || [];
  const recentAttempts = attempts.filter(ts => now - ts < 60000);
  if (recentAttempts.length >= 5) {
    return { success: false, error: { code: 'RATE_LIMITED', message: '验证次数过多，请1分钟后再试' } };
  }
  recentAttempts.push(now);
  rateLimitMap.set(limitKey, recentAttempts);

  // 1. 查询家庭
  const familyRes = await db.collection('families')
    .where({ inviteCode: inviteCode.toUpperCase() })
    .get();

  if (familyRes.data.length === 0) {
    return { success: false, error: { code: 'INVALID_CODE', message: '邀请码无效' } };
  }

  const family = familyRes.data[0];

  // 2. 检查过期
  if (family.inviteCodeExpiry && new Date(family.inviteCodeExpiry) < new Date()) {
    return { success: false, error: { code: 'CODE_EXPIRED', message: '邀请码已过期' } };
  }

  // 3. 检查是否已是成员
  if (family.members && family.members.includes(userId)) {
    return { success: false, error: { code: 'ALREADY_MEMBER', message: '已经是家庭成员' } };
  }

  // 4. [v4.1 FR-9] 幽灵成员防护
  const existingFamilyRes = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();

  if (existingFamilyRes.data.length > 0) {
    const existingFamily = existingFamilyRes.data[0];
    if (existingFamily._id !== family._id) {
      // 检查是否唯一管理员
      const memberDetail = existingFamily.memberDetails?.find(m => m.userId === userId);
      const isAdminRole = memberDetail?.role === 'admin';
      const hasOtherAdmin = existingFamily.memberDetails?.some(
        m => m.role === 'admin' && m.userId !== userId
      );

      if (isAdminRole && !hasOtherAdmin) {
        return {
          success: false,
          error: { code: 'SOLE_ADMIN', message: '您是当前家庭的唯一管理员，请先转让管理权限或解散旧家庭再加入新家庭' }
        };
      }

      // 从旧家庭移除
      await db.collection('families').doc(existingFamily._id).update({
        data: {
          members: _.pull(userId),
          memberDetails: _.pull({ userId }),
          memberOpenids: _.pull(openid),
          updatedAt: new Date().toISOString()
        }
      });

      // 清除用户的旧家庭信息
      await db.collection('users').doc(userId).update({
        data: {
          familyId: _.remove(),
          familyRole: _.remove(),
          updatedAt: new Date().toISOString()
        }
      });
    }
  }

  // 5. 加入新家庭
  const nowStr = new Date().toISOString();
  const newMemberDetail = {
    userId,
    name: userName,
    relation: relation || '家人',
    role: 'editor',
    joinedAt: nowStr
  };

  await db.collection('families').doc(family._id).update({
    data: {
      members: _.push(userId),
      memberDetails: _.push(newMemberDetail),
      memberOpenids: _.push(openid),
      updatedAt: nowStr
    }
  });

  // 6. 更新用户 familyId
  await db.collection('users').doc(userId).update({
    data: {
      familyId: family._id,
      familyRole: 'editor',
      updatedAt: nowStr
    }
  });

  return {
    success: true,
    data: { familyId: family._id, familyName: family.name }
  };
}

// ============================================================
// Action: removeMember (FR-3, FR-11)
// ============================================================
async function removeMember(db, _, userId, openid, params) {
  const { familyId, targetUserId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  // 权限校验
  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能移除成员');
  }
  if (userId === targetUserId) {
    return { success: false, error: { code: 'CANNOT_REMOVE_SELF', message: '不能移除自己，请使用退出家庭功能' } };
  }
  if (isAdmin(targetUserId, family)) {
    return { success: false, error: { code: 'CANNOT_REMOVE_ADMIN', message: '不能移除管理员，请先修改其权限' } };
  }

  // 获取被移除用户的 openid
  const targetUser = await db.collection('users').doc(targetUserId).get();
  const targetOpenid = targetUser.data._openid;

  // pull 成员 + memberOpenids
  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(targetUserId),
      memberDetails: _.pull({ userId: targetUserId }),
      memberOpenids: _.pull(targetOpenid),
      updatedAt: new Date().toISOString()
    }
  });

  // 清除被移除用户的家庭信息（admin SDK，可靠执行）
  await db.collection('users').doc(targetUserId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true, data: { removedUserId: targetUserId } };
}

// ============================================================
// Action: dissolveFamily (FR-4)
// ============================================================
async function dissolveFamily(db, _, userId, openid, params) {
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (family.creatorId !== userId) {
    return permissionDenied('只有创建者才能解散家庭');
  }

  // 先删除家庭文档（其他成员读取时立即得到"不存在"）
  await db.collection('families').doc(familyId).remove();

  // 批量清除成员的 familyId/familyRole
  let membersCleared = 0, membersFailed = 0;
  if (family.members && family.members.length > 0) {
    for (const memberId of family.members) {
      try {
        await db.collection('users').doc(memberId).update({
          data: {
            familyId: _.remove(),
            familyRole: _.remove(),
            updatedAt: new Date().toISOString()
          }
        });
        membersCleared++;
      } catch (err) {
        membersFailed++;
        console.warn(`清除成员 ${memberId} 家庭信息失败:`, err);
      }
    }
  }

  return {
    success: true,
    data: { dissolvedFamilyId: familyId, membersCleared, membersFailed }
  };
}

// ============================================================
// Action: updateMemberRole (FR-5)
// ============================================================
async function updateMemberRole(db, _, userId, openid, params, retryCount = 0) {
  const { familyId, targetUserId, role } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (family.creatorId !== userId) {
    return permissionDenied('只有创建者才能修改成员权限');
  }

  if (!family.memberDetails) {
    return { success: false, error: { code: 'NO_MEMBER_DATA', message: '家庭成员数据不存在' } };
  }

  // 构建新 memberDetails
  const memberDetails = family.memberDetails.map(m => {
    if (m.userId === targetUserId) return { ...m, role };
    return m;
  });

  // 乐观锁写入
  const result = await db.collection('families').doc(familyId).update({
    data: { memberDetails, updatedAt: new Date().toISOString() }
  });

  if (result.stats && result.stats.updated === 0 && retryCount < 2) {
    return updateMemberRole(db, _, userId, openid, params, retryCount + 1);
  }

  // 同步 users.familyRole
  await db.collection('users').doc(targetUserId).update({
    data: { familyRole: role, updatedAt: new Date().toISOString() }
  });

  return { success: true, data: { targetUserId, newRole: role } };
}

// ============================================================
// Action: transferAdmin (FR-6)
// ============================================================
async function transferAdmin(db, _, userId, openid, params) {
  const { familyId, newAdminId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能转让管理员权限');
  }

  const newAdmin = family.memberDetails?.find(m => m.userId === newAdminId);
  if (!newAdmin) {
    return { success: false, error: { code: 'NOT_MEMBER', message: '目标用户不是家庭成员' } };
  }

  const memberDetails = family.memberDetails.map(m => {
    if (m.userId === userId) return { ...m, role: 'editor' };
    if (m.userId === newAdminId) return { ...m, role: 'admin' };
    return m;
  });

  await db.collection('families').doc(familyId).update({
    data: { memberDetails, creatorId: newAdminId, updatedAt: new Date().toISOString() }
  });

  // 同步双方 familyRole
  await db.collection('users').doc(userId).update({
    data: { familyRole: 'editor', updatedAt: new Date().toISOString() }
  });
  await db.collection('users').doc(newAdminId).update({
    data: { familyRole: 'admin', updatedAt: new Date().toISOString() }
  });

  return { success: true, data: { oldAdminId: userId, newAdminId } };
}

// ============================================================
// Action: leaveFamily (FR-7, FR-11)
// ============================================================
async function leaveFamily(db, _, userId, openid, params) {
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return { success: true, data: { familyNotFound: true, message: '家庭已不存在' } };

  if (!family.members || !family.members.includes(userId)) {
    return { success: true, data: { notMember: true, message: '您不是该家庭成员' } };
  }

  const adminRole = isAdmin(userId, family);
  const hasOther = family.memberDetails?.some(m => m.role === 'admin' && m.userId !== userId);

  if (adminRole) {
    const otherMembers = family.members.filter(id => id !== userId);
    if (otherMembers.length > 0 && !hasOther) {
      return {
        success: false,
        data: {
          needTransfer: true,
          otherMembers: family.memberDetails?.filter(m => m.userId !== userId) || [],
          message: '您是唯一管理员，退出前请先转让管理员权限或解散家庭'
        }
      };
    }
    if (otherMembers.length === 0) {
      // 最后一个成员，解散家庭
      await db.collection('families').doc(familyId).remove();
      await clearUserFamily(db, _, userId);
      return { success: true, data: { familyDissolved: true, message: '家庭已解散' } };
    }
  }

  // 正常退出
  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(userId),
      memberDetails: _.pull({ userId }),
      memberOpenids: _.pull(openid),
      updatedAt: new Date().toISOString()
    }
  });
  await clearUserFamily(db, _, userId);

  return { success: true, data: { message: '已退出家庭' } };
}

// ============================================================
// Action: refreshInviteCode (FR-8 补充)
// ============================================================
async function refreshInviteCode(db, _, userId, openid, params) {
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能生成邀请码');
  }

  const inviteCode = generateInviteCode();
  const now = new Date();
  const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.collection('families').doc(familyId).update({
    data: {
      inviteCode,
      inviteCodeExpiry: inviteExpiry.toISOString(),
      updatedAt: now.toISOString()
    }
  });

  return { success: true, data: { inviteCode } };
}

// ============================================================
// Action: validateInviteCode (FR-12)
// ============================================================
async function validateInviteCode(db, _, userId, openid, params) {
  const { inviteCode } = params;

  const familyRes = await db.collection('families')
    .where({ inviteCode: inviteCode.toUpperCase() })
    .get();

  if (familyRes.data.length === 0) {
    return { success: true, data: { valid: false, reason: '邀请码无效' } };
  }

  const family = familyRes.data[0];
  if (family.inviteCodeExpiry && new Date(family.inviteCodeExpiry) < new Date()) {
    return { success: true, data: { valid: false, reason: '邀请码已过期' } };
  }

  return {
    success: true,
    data: {
      valid: true,
      familyId: family._id,
      familyName: family.name,
      memberCount: family.members?.length || 0,
      creatorName: family.creatorName || ''
    }
  };
}

// ============================================================
// Action: getFamilyByUserId (FR-12)
// ============================================================
async function getFamilyByUserId(db, _, userId, openid) {
  const res = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();

  return {
    success: true,
    data: res.data.length > 0 ? res.data[0] : null
  };
}

// ============================================================
// Action: createBaby (FR-13)
// ============================================================
async function createBaby(db, _, userId, openid, params) {
  const { familyId, name, gender, birthDate, avatar } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  // 校验操作者是家庭成员
  if (!family.members || !family.members.includes(userId)) {
    return permissionDenied('不是家庭成员');
  }

  const now = new Date();
  const babyData = {
    familyId,
    name,
    gender: gender || 'male',
    birthDate: birthDate ? new Date(birthDate) : now,
    avatar: avatar || '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const res = await db.collection('babies').add({ data: babyData });
  const babyId = res._id;

  // 更新 families.babies 数组（admin SDK 绕过安全规则）
  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.push(babyId),
      updatedAt: now.toISOString()
    }
  });

  return { success: true, data: { _id: babyId, ...babyData } };
}

// ============================================================
// Action: deleteBaby (FR-13)
// ============================================================
async function deleteBaby(db, _, userId, openid, params) {
  const { babyId, familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  // 校验操作者是家庭成员
  if (!family.members || !family.members.includes(userId)) {
    return permissionDenied('不是家庭成员');
  }

  // 从 families.babies 数组 pull
  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.pull(babyId),
      updatedAt: new Date().toISOString()
    }
  });

  // 删除 babies 文档
  await db.collection('babies').doc(babyId).remove();

  return { success: true, data: { deletedBabyId: babyId } };
}

// ============================================================
// Action: clearBabyData (FR-14)
// ============================================================
async function clearBabyData(db, _, userId, openid, params) {
  const { babyId, familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  // 校验操作者是 admin
  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能清除数据');
  }

  const stats = { records: 0, vaccine: 0, milestone: 0 };

  // 1. 批量删除 records（包括其他成员创建的）
  const recordsDocs = await getAllDocs(db.collection('records').where({ babyId }), 100);
  for (const doc of recordsDocs) {
    await db.collection('records').doc(doc._id).remove();
    stats.records++;
  }

  // 2. 批量删除 vaccine_records
  const vaccineDocs = await getAllDocs(db.collection('vaccine_records').where({ babyId }), 100);
  for (const doc of vaccineDocs) {
    await db.collection('vaccine_records').doc(doc._id).remove();
    stats.vaccine++;
  }

  // 3. 批量删除 milestone_records
  const milestoneDocs = await getAllDocs(db.collection('milestone_records').where({ babyId }), 100);
  for (const doc of milestoneDocs) {
    await db.collection('milestone_records').doc(doc._id).remove();
    stats.milestone++;
  }

  // 4. 删除 babies 文档
  await db.collection('babies').doc(babyId).remove();

  // 5. 从 families.babies pull
  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.pull(babyId),
      updatedAt: new Date().toISOString()
    }
  });

  // 6. 检查家庭是否还有宝宝
  const remainingBabies = await db.collection('babies').where({ familyId }).get();
  let familyDeleted = false;

  if (remainingBabies.data.length === 0) {
    // 无宝宝，解散家庭
    await db.collection('families').doc(familyId).remove();
    familyDeleted = true;

    // 清除所有成员的 familyId
    for (const memberId of (family.members || [])) {
      try {
        await db.collection('users').doc(memberId).update({
          data: {
            familyId: _.remove(),
            familyRole: _.remove(),
            updatedAt: new Date().toISOString()
          }
        });
      } catch (e) {
        console.warn(`清除成员 ${memberId} familyId 失败:`, e);
      }
    }
  }

  return { success: true, data: { ...stats, familyDeleted } };
}
