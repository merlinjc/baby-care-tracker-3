/**
 * E2E 安全测试 - 测试数据定义
 * 
 * 7 个测试用户 × 2 个家庭 × 2 个宝宝 × N 条记录
 * 所有 _id 使用 test_e2e_ 前缀，teardown 时按前缀批量清理
 */

const TEST_PREFIX = 'test_e2e_';

// ============================================================
// 测试用户（6 个写入 users 集合，Ghost 不写入）
// ============================================================
const USERS = {
  alice: {
    _id: `${TEST_PREFIX}alice`,
    _openid: `${TEST_PREFIX}openid_alice`,
    nickname: 'Alice_Test',
    avatar: '',
    role: 'parent',
    relation: 'mom',
    relationText: '妈妈',
    familyId: `${TEST_PREFIX}family_a`,
    familyRole: 'admin'
  },
  bob: {
    _id: `${TEST_PREFIX}bob`,
    _openid: `${TEST_PREFIX}openid_bob`,
    nickname: 'Bob_Test',
    avatar: '',
    role: 'parent',
    relation: 'dad',
    relationText: '爸爸',
    familyId: `${TEST_PREFIX}family_a`,
    familyRole: 'editor'
  },
  carol: {
    _id: `${TEST_PREFIX}carol`,
    _openid: `${TEST_PREFIX}openid_carol`,
    nickname: 'Carol_Test',
    avatar: '',
    role: 'family_member',
    relation: 'grandma_m',
    relationText: '外婆',
    familyId: `${TEST_PREFIX}family_a`,
    familyRole: 'viewer'
  },
  dave: {
    _id: `${TEST_PREFIX}dave`,
    _openid: `${TEST_PREFIX}openid_dave`,
    nickname: 'Dave_Test',
    avatar: '',
    role: 'parent',
    relation: 'dad',
    relationText: '爸爸',
    familyId: `${TEST_PREFIX}family_b`,
    familyRole: 'admin'
  },
  eve: {
    _id: `${TEST_PREFIX}eve`,
    _openid: `${TEST_PREFIX}openid_eve`,
    nickname: 'Eve_Test',
    avatar: '',
    role: 'parent',
    relation: 'mom',
    relationText: '妈妈',
    familyId: `${TEST_PREFIX}family_b`,
    familyRole: 'editor'
  },
  frank: {
    _id: `${TEST_PREFIX}frank`,
    _openid: `${TEST_PREFIX}openid_frank`,
    nickname: 'Frank_Test',
    avatar: '',
    role: 'parent',
    relation: 'dad',
    relationText: '爸爸'
    // 注意：无 familyId 和 familyRole（未加入任何家庭）
  }
  // ghost: 不写入 users 集合，用于测试未注册用户场景
};

const GHOST = {
  _id: `${TEST_PREFIX}ghost`,
  _openid: `${TEST_PREFIX}openid_ghost`
};

// ============================================================
// 测试家庭
// ============================================================
function buildFamilies() {
  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    family_a: {
      _id: `${TEST_PREFIX}family_a`,
      name: 'Test Family A',
      creatorId: USERS.alice._id,
      creatorName: USERS.alice.nickname,
      members: [USERS.alice._id, USERS.bob._id, USERS.carol._id],
      memberDetails: [
        { userId: USERS.alice._id, name: 'Alice_Test', role: 'admin', joinedAt: now },
        { userId: USERS.bob._id, name: 'Bob_Test', role: 'editor', joinedAt: now },
        { userId: USERS.carol._id, name: 'Carol_Test', role: 'viewer', joinedAt: now }
      ],
      memberOpenids: [USERS.alice._openid, USERS.bob._openid, USERS.carol._openid],
      babies: [`${TEST_PREFIX}baby_x`],
      inviteCode: 'TESTA1',
      inviteCodeExpiry: expiry,
      createdAt: now,
      updatedAt: now
    },
    family_b: {
      _id: `${TEST_PREFIX}family_b`,
      name: 'Test Family B',
      creatorId: USERS.dave._id,
      creatorName: USERS.dave.nickname,
      members: [USERS.dave._id, USERS.eve._id],
      memberDetails: [
        { userId: USERS.dave._id, name: 'Dave_Test', role: 'admin', joinedAt: now },
        { userId: USERS.eve._id, name: 'Eve_Test', role: 'editor', joinedAt: now }
      ],
      memberOpenids: [USERS.dave._openid, USERS.eve._openid],
      babies: [`${TEST_PREFIX}baby_y`],
      inviteCode: 'TESTB1',
      inviteCodeExpiry: expiry,
      createdAt: now,
      updatedAt: now
    }
  };
}

// ============================================================
// 测试宝宝
// ============================================================
function buildBabies(FAMILIES) {
  return {
    baby_x: {
      _id: `${TEST_PREFIX}baby_x`,
      _openid: USERS.alice._openid,
      familyId: FAMILIES.family_a._id,
      name: 'Baby X',
      gender: 'female',
      birthDate: new Date('2025-06-15'),
      avatar: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    baby_y: {
      _id: `${TEST_PREFIX}baby_y`,
      _openid: USERS.dave._openid,
      familyId: FAMILIES.family_b._id,
      name: 'Baby Y',
      gender: 'male',
      birthDate: new Date('2025-09-01'),
      avatar: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

// ============================================================
// 测试记录
// ============================================================
function buildRecords(FAMILIES, BABIES) {
  const now = new Date();
  const nowTs = Date.now();

  return [
    // Alice 创建的 2 条记录 (Family A, Baby X)
    {
      _id: `${TEST_PREFIX}rec_alice_1`,
      _openid: USERS.alice._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      recordType: 'feeding',
      startTime: now,
      startTimeTs: nowTs,
      data: { feedingType: 'breast', duration: 600, breastSide: 'left' },
      note: 'Alice record 1',
      createdBy: { userId: USERS.alice._id, nickName: 'Alice_Test', avatar: '' },
      creatorId: USERS.alice._id
    },
    {
      _id: `${TEST_PREFIX}rec_alice_2`,
      _openid: USERS.alice._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      recordType: 'sleep',
      startTime: now,
      startTimeTs: nowTs,
      data: { sleepType: 'nap', duration: 3600 },
      note: 'Alice record 2',
      createdBy: { userId: USERS.alice._id, nickName: 'Alice_Test', avatar: '' },
      creatorId: USERS.alice._id
    },
    // Bob 创建的 1 条记录 (Family A, Baby X)
    {
      _id: `${TEST_PREFIX}rec_bob_1`,
      _openid: USERS.bob._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      recordType: 'diaper',
      startTime: now,
      startTimeTs: nowTs,
      data: { diaperType: 'pee' },
      note: 'Bob record 1',
      createdBy: { userId: USERS.bob._id, nickName: 'Bob_Test', avatar: '' },
      creatorId: USERS.bob._id
    },
    // Dave 创建的 2 条记录 (Family B, Baby Y)
    {
      _id: `${TEST_PREFIX}rec_dave_1`,
      _openid: USERS.dave._openid,
      babyId: BABIES.baby_y._id,
      familyId: FAMILIES.family_b._id,
      recordType: 'feeding',
      startTime: now,
      startTimeTs: nowTs,
      data: { feedingType: 'formula', amount: 120 },
      note: 'Dave record 1',
      createdBy: { userId: USERS.dave._id, nickName: 'Dave_Test', avatar: '' },
      creatorId: USERS.dave._id
    },
    {
      _id: `${TEST_PREFIX}rec_dave_2`,
      _openid: USERS.dave._openid,
      babyId: BABIES.baby_y._id,
      familyId: FAMILIES.family_b._id,
      recordType: 'temperature',
      startTime: now,
      startTimeTs: nowTs,
      data: { temperature: 36.8, method: 'ear' },
      note: 'Dave record 2',
      createdBy: { userId: USERS.dave._id, nickName: 'Dave_Test', avatar: '' },
      creatorId: USERS.dave._id
    }
  ];
}

function buildVaccineRecords(FAMILIES, BABIES) {
  return [
    {
      _id: `${TEST_PREFIX}vac_alice_1`,
      _openid: USERS.alice._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      name: '卡介苗',
      dose: '第1剂',
      vaccinatedDate: new Date('2025-06-16'),
      creatorId: USERS.alice._id
    },
    {
      _id: `${TEST_PREFIX}vac_alice_2`,
      _openid: USERS.alice._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      name: '乙肝疫苗',
      dose: '第1剂',
      vaccinatedDate: new Date('2025-06-16'),
      creatorId: USERS.alice._id
    }
  ];
}

function buildMilestoneRecords(FAMILIES, BABIES) {
  return [
    {
      _id: `${TEST_PREFIX}mile_alice_1`,
      _openid: USERS.alice._openid,
      babyId: BABIES.baby_x._id,
      familyId: FAMILIES.family_a._id,
      name: '会抬头',
      category: '大运动',
      achievedDate: new Date('2025-09-01'),
      creatorId: USERS.alice._id
    }
  ];
}

// ============================================================
// 构建完整测试数据（每次调用生成新时间戳）
// ============================================================
function buildTestData() {
  const FAMILIES = buildFamilies();
  const BABIES = buildBabies(FAMILIES);
  const RECORDS = buildRecords(FAMILIES, BABIES);
  const VACCINE_RECORDS = buildVaccineRecords(FAMILIES, BABIES);
  const MILESTONE_RECORDS = buildMilestoneRecords(FAMILIES, BABIES);
  return { FAMILIES, BABIES, RECORDS, VACCINE_RECORDS, MILESTONE_RECORDS };
}

module.exports = {
  TEST_PREFIX,
  USERS,
  GHOST,
  buildTestData,
  buildFamilies,
  buildBabies,
  buildRecords,
  buildVaccineRecords,
  buildMilestoneRecords
};
