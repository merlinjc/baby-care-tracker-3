/**
 * E2E 安全测试 - familyOperation 内部函数
 * 
 * 从 cloudfunctions/familyOperation/index.js 复制的 13 个 action 函数 + 7 个工具函数。
 * 移除了 exports.main 入口和 cloud.getWXContext() 依赖，
 * 改为接收 db, _, userId, openid, user/params 参数的独立函数。
 * 
 * 注意：rateLimitMap 在测试云函数中独立维护，不共享 familyOperation 的实例。
 */

// 限流 Map（实例级别）
const rateLimitMap = new Map();

// ============================================================
// 工具函数
// ============================================================

async function getFamily(db, familyId) {
  try {
    const res = await db.collection('families').doc(familyId).get();
    return res.data;
  } catch (e) {
    if (e.errMsg && (e.errMsg.includes('cannot find document') || e.errMsg.includes('does not exist'))) return null;
    throw e;
  }
}

function isAdmin(userId, family) {
  const member = family.memberDetails && family.memberDetails.find(m => m.userId === userId);
  if (member && member.role === 'admin') return true;
  if (family.creatorId === userId) return true;
  return false;
}

async function clearUserFamily(db, _, userId) {
  await db.collection('users').doc(userId).update({
    data: {
      familyId: _.remove(),
      familyRole: _.remove(),
      updatedAt: new Date().toISOString()
    }
  });
}

function familyNotFound() {
  return { success: false, error: { code: 'FAMILY_NOT_FOUND', message: '家庭不存在' } };
}

function permissionDenied(message) {
  return { success: false, error: { code: 'PERMISSION_DENIED', message } };
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getAllDocs(query, batchSize) {
  batchSize = batchSize || 100;
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
// Action: createFamily
// ============================================================
async function createFamily(db, _, userId, openid, user, params) {
  const { name } = params;
  const creatorName = (user && user.nickname) || '';

  const inviteCode = generateInviteCode();
  const now = new Date();
  const inviteExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const familyData = {
    name: name,
    creatorId: userId,
    creatorName: creatorName,
    members: [userId],
    memberDetails: [{
      userId: userId,
      name: creatorName,
      role: 'admin',
      joinedAt: now.toISOString()
    }],
    memberOpenids: [openid],
    inviteCode: inviteCode,
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
// Action: joinFamily
// ============================================================
async function joinFamily(db, _, userId, openid, user, params) {
  const { inviteCode, userName, relation } = params;

  // 限流：60s 内最多 5 次
  const limitKey = 'invite_' + openid;
  const now = Date.now();
  const attempts = rateLimitMap.get(limitKey) || [];
  const recentAttempts = attempts.filter(function(ts) { return now - ts < 60000; });
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

  // 4. 幽灵成员防护
  const existingFamilyRes = await db.collection('families')
    .where({ members: userId })
    .limit(1)
    .get();

  if (existingFamilyRes.data.length > 0) {
    const existingFamily = existingFamilyRes.data[0];
    if (existingFamily._id !== family._id) {
      const memberDetail = existingFamily.memberDetails && existingFamily.memberDetails.find(function(m) { return m.userId === userId; });
      const isAdminRole = memberDetail && memberDetail.role === 'admin';
      const hasOtherAdmin = existingFamily.memberDetails && existingFamily.memberDetails.some(function(m) {
        return m.role === 'admin' && m.userId !== userId;
      });

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
          memberDetails: _.pull({ userId: userId }),
          memberOpenids: _.pull(openid),
          updatedAt: new Date().toISOString()
        }
      });

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
    userId: userId,
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
// Action: removeMember
// ============================================================
async function removeMember(db, _, userId, openid, params) {
  const { familyId, targetUserId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

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

  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(targetUserId),
      memberDetails: _.pull({ userId: targetUserId }),
      memberOpenids: _.pull(targetOpenid),
      updatedAt: new Date().toISOString()
    }
  });

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
// Action: dissolveFamily
// ============================================================
async function dissolveFamily(db, _, userId, openid, params) {
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (family.creatorId !== userId) {
    return permissionDenied('只有创建者才能解散家庭');
  }

  await db.collection('families').doc(familyId).remove();

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
      }
    }
  }

  return {
    success: true,
    data: { dissolvedFamilyId: familyId, membersCleared, membersFailed }
  };
}

// ============================================================
// Action: updateMemberRole
// ============================================================
async function updateMemberRole(db, _, userId, openid, params, retryCount) {
  retryCount = retryCount || 0;
  const { familyId, targetUserId, role } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (family.creatorId !== userId) {
    return permissionDenied('只有创建者才能修改成员权限');
  }

  if (!family.memberDetails) {
    return { success: false, error: { code: 'NO_MEMBER_DATA', message: '家庭成员数据不存在' } };
  }

  const memberDetails = family.memberDetails.map(function(m) {
    if (m.userId === targetUserId) return Object.assign({}, m, { role: role });
    return m;
  });

  const result = await db.collection('families').doc(familyId).update({
    data: { memberDetails: memberDetails, updatedAt: new Date().toISOString() }
  });

  if (result.stats && result.stats.updated === 0 && retryCount < 2) {
    return updateMemberRole(db, _, userId, openid, params, retryCount + 1);
  }

  await db.collection('users').doc(targetUserId).update({
    data: { familyRole: role, updatedAt: new Date().toISOString() }
  });

  return { success: true, data: { targetUserId: targetUserId, newRole: role } };
}

// ============================================================
// Action: transferAdmin
// ============================================================
async function transferAdmin(db, _, userId, openid, params) {
  const { familyId, newAdminId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能转让管理员权限');
  }

  const newAdmin = family.memberDetails && family.memberDetails.find(function(m) { return m.userId === newAdminId; });
  if (!newAdmin) {
    return { success: false, error: { code: 'NOT_MEMBER', message: '目标用户不是家庭成员' } };
  }

  const memberDetails = family.memberDetails.map(function(m) {
    if (m.userId === userId) return Object.assign({}, m, { role: 'editor' });
    if (m.userId === newAdminId) return Object.assign({}, m, { role: 'admin' });
    return m;
  });

  await db.collection('families').doc(familyId).update({
    data: { memberDetails: memberDetails, creatorId: newAdminId, updatedAt: new Date().toISOString() }
  });

  await db.collection('users').doc(userId).update({
    data: { familyRole: 'editor', updatedAt: new Date().toISOString() }
  });
  await db.collection('users').doc(newAdminId).update({
    data: { familyRole: 'admin', updatedAt: new Date().toISOString() }
  });

  return { success: true, data: { oldAdminId: userId, newAdminId: newAdminId } };
}

// ============================================================
// Action: leaveFamily
// ============================================================
async function leaveFamily(db, _, userId, openid, params) {
  const { familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return { success: true, data: { familyNotFound: true, message: '家庭已不存在' } };

  if (!family.members || !family.members.includes(userId)) {
    return { success: true, data: { notMember: true, message: '您不是该家庭成员' } };
  }

  const adminRole = isAdmin(userId, family);
  const hasOther = family.memberDetails && family.memberDetails.some(function(m) { return m.role === 'admin' && m.userId !== userId; });

  if (adminRole) {
    const otherMembers = family.members.filter(function(id) { return id !== userId; });
    if (otherMembers.length > 0 && !hasOther) {
      return {
        success: false,
        data: {
          needTransfer: true,
          otherMembers: (family.memberDetails || []).filter(function(m) { return m.userId !== userId; }),
          message: '您是唯一管理员，退出前请先转让管理员权限或解散家庭'
        }
      };
    }
    if (otherMembers.length === 0) {
      await db.collection('families').doc(familyId).remove();
      await clearUserFamily(db, _, userId);
      return { success: true, data: { familyDissolved: true, message: '家庭已解散' } };
    }
  }

  await db.collection('families').doc(familyId).update({
    data: {
      members: _.pull(userId),
      memberDetails: _.pull({ userId: userId }),
      memberOpenids: _.pull(openid),
      updatedAt: new Date().toISOString()
    }
  });
  await clearUserFamily(db, _, userId);

  return { success: true, data: { message: '已退出家庭' } };
}

// ============================================================
// Action: refreshInviteCode
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
      inviteCode: inviteCode,
      inviteCodeExpiry: inviteExpiry.toISOString(),
      updatedAt: now.toISOString()
    }
  });

  return { success: true, data: { inviteCode: inviteCode } };
}

// ============================================================
// Action: validateInviteCode
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
      memberCount: (family.members && family.members.length) || 0,
      creatorName: family.creatorName || ''
    }
  };
}

// ============================================================
// Action: getFamilyByUserId
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
// Action: createBaby
// ============================================================
async function createBaby(db, _, userId, openid, params) {
  const { familyId, name, gender, birthDate, avatar } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!family.members || !family.members.includes(userId)) {
    return permissionDenied('不是家庭成员');
  }

  const now = new Date();
  const babyData = {
    familyId: familyId,
    name: name,
    gender: gender || 'male',
    birthDate: birthDate ? new Date(birthDate) : now,
    avatar: avatar || '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const res = await db.collection('babies').add({ data: babyData });
  const babyId = res._id;

  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.push(babyId),
      updatedAt: now.toISOString()
    }
  });

  return { success: true, data: { _id: babyId, ...babyData } };
}

// ============================================================
// Action: deleteBaby
// ============================================================
async function deleteBaby(db, _, userId, openid, params) {
  const { babyId, familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!family.members || !family.members.includes(userId)) {
    return permissionDenied('不是家庭成员');
  }

  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.pull(babyId),
      updatedAt: new Date().toISOString()
    }
  });

  await db.collection('babies').doc(babyId).remove();

  return { success: true, data: { deletedBabyId: babyId } };
}

// ============================================================
// Action: clearBabyData
// ============================================================
async function clearBabyData(db, _, userId, openid, params) {
  const { babyId, familyId } = params;

  const family = await getFamily(db, familyId);
  if (!family) return familyNotFound();

  if (!isAdmin(userId, family)) {
    return permissionDenied('只有管理员才能清除数据');
  }

  const stats = { records: 0, vaccine: 0, milestone: 0 };

  const recordsDocs = await getAllDocs(db.collection('records').where({ babyId: babyId }), 100);
  for (const doc of recordsDocs) {
    await db.collection('records').doc(doc._id).remove();
    stats.records++;
  }

  const vaccineDocs = await getAllDocs(db.collection('vaccine_records').where({ babyId: babyId }), 100);
  for (const doc of vaccineDocs) {
    await db.collection('vaccine_records').doc(doc._id).remove();
    stats.vaccine++;
  }

  const milestoneDocs = await getAllDocs(db.collection('milestone_records').where({ babyId: babyId }), 100);
  for (const doc of milestoneDocs) {
    await db.collection('milestone_records').doc(doc._id).remove();
    stats.milestone++;
  }

  await db.collection('babies').doc(babyId).remove();

  await db.collection('families').doc(familyId).update({
    data: {
      babies: _.pull(babyId),
      updatedAt: new Date().toISOString()
    }
  });

  const remainingBabies = await db.collection('babies').where({ familyId: familyId }).get();
  let familyDeleted = false;

  if (remainingBabies.data.length === 0) {
    await db.collection('families').doc(familyId).remove();
    familyDeleted = true;

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
        // ignore
      }
    }
  }

  return { success: true, data: { ...stats, familyDeleted: familyDeleted } };
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  // 工具函数
  getFamily,
  isAdmin,
  clearUserFamily,
  familyNotFound,
  permissionDenied,
  generateInviteCode,
  getAllDocs,
  // 限流 Map（测试中可能需要直接操作）
  rateLimitMap,
  // 13 个 action 函数
  createFamily,
  joinFamily,
  removeMember,
  dissolveFamily,
  updateMemberRole,
  transferAdmin,
  leaveFamily,
  refreshInviteCode,
  validateInviteCode,
  getFamilyByUserId,
  createBaby,
  deleteBaby,
  clearBabyData
};
