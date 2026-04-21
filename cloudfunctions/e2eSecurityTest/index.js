/**
 * E2E 安全测试云函数 - 入口
 * 
 * 支持 3 个 action：
 * - setup:    构造测试数据（7 用户 + 2 家庭 + 2 宝宝 + N 记录）
 * - run:      执行全部/指定模块的测试用例
 * - teardown: 清理所有测试数据
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const { TEST_PREFIX, USERS, buildTestData } = require('./lib/test-data');
const { TestRunner } = require('./lib/test-runner');

exports.main = async (event) => {
  const { action = 'run', module: targetModule } = event;

  switch (action) {
    case 'setup':    return await setup(db, _);
    case 'run':      return await run(db, _, targetModule);
    case 'teardown': return await teardown(db, _);
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
};

// ============================================================
// Setup: 构造测试数据
// ============================================================
async function setup(db, _) {
  // 先清理（幂等）
  await teardown(db, _);

  const { FAMILIES, BABIES, RECORDS, VACCINE_RECORDS, MILESTONE_RECORDS } = buildTestData();

  // 插入测试用户（6 个，ghost 不插入）
  for (const user of Object.values(USERS)) {
    await db.collection('users').add({ data: { ...user } });
  }

  // 插入家庭
  for (const family of Object.values(FAMILIES)) {
    await db.collection('families').add({ data: { ...family } });
  }

  // 插入宝宝
  for (const baby of Object.values(BABIES)) {
    await db.collection('babies').add({ data: { ...baby } });
  }

  // 插入记录
  for (const rec of RECORDS) {
    await db.collection('records').add({ data: { ...rec } });
  }
  for (const vac of VACCINE_RECORDS) {
    await db.collection('vaccine_records').add({ data: { ...vac } });
  }
  for (const mile of MILESTONE_RECORDS) {
    await db.collection('milestone_records').add({ data: { ...mile } });
  }

  return {
    success: true,
    message: 'Setup complete',
    counts: {
      users: Object.keys(USERS).length,
      families: Object.keys(FAMILIES).length,
      babies: Object.keys(BABIES).length,
      records: RECORDS.length,
      vaccine_records: VACCINE_RECORDS.length,
      milestone_records: MILESTONE_RECORDS.length
    }
  };
}

// ============================================================
// Run: 执行测试用例
// ============================================================
async function run(db, _, targetModule) {
  const runner = new TestRunner(db);

  // 按模块顺序执行
  const modules = [
    { id: 'm06', name: 'createFamily', fn: require('./modules/m06-createFamily') },
    { id: 'm07', name: 'joinFamily', fn: require('./modules/m07-joinFamily') },
    { id: 'm08', name: 'removeMember', fn: require('./modules/m08-removeMember') },
    { id: 'm09', name: 'dissolveFamily', fn: require('./modules/m09-dissolveFamily') },
    { id: 'm10', name: 'updateMemberRole', fn: require('./modules/m10-updateMemberRole') },
    { id: 'm11', name: 'transferAdmin', fn: require('./modules/m11-transferAdmin') },
    { id: 'm12', name: 'leaveFamily', fn: require('./modules/m12-leaveFamily') },
    { id: 'm13', name: 'refreshInviteCode', fn: require('./modules/m13-refreshInviteCode') },
    { id: 'm14', name: 'validateInviteCode', fn: require('./modules/m14-validateInviteCode') },
    { id: 'm15', name: 'babyOperations', fn: require('./modules/m15-babyOperations') },
    { id: 'm16', name: 'clearBabyData', fn: require('./modules/m16-clearBabyData') },
    { id: 'm17', name: 'errorHandling', fn: require('./modules/m17-errorHandling') },
    { id: 'm01_05', name: 'securityRules', fn: require('./modules/m01-05-securityRules') },
    { id: 'm18', name: 'crossFamily', fn: require('./modules/m18-crossFamily') },
    { id: 'm19', name: 'stateChange', fn: require('./modules/m19-stateChange') },
    // v4.3.0 专项：直接测试生产 actions/*.js（v43-prod/ 目录）
    { id: 'm20', name: 'v43Features', fn: require('./modules/m20-v43Features') },
  ];

  for (const mod of modules) {
    if (targetModule && mod.id !== targetModule) continue;
    runner.setModule(mod.name);
    await mod.fn(runner, db, _);
  }

  const report = runner.getReport();

  // 保存报告到数据库
  try {
    await db.collection('test_results').add({
      data: {
        _id: `${TEST_PREFIX}report_${Date.now()}`,
        ...report,
        createdAt: new Date().toISOString()
      }
    });
  } catch (e) {
    // test_results 集合可能不存在，忽略
  }

  return { success: true, report };
}

// ============================================================
// Teardown: 清理测试数据
// ============================================================
async function teardown(db, _) {
  const collections = ['users', 'families', 'babies', 'records', 'vaccine_records', 'milestone_records', 'test_results'];
  const stats = {};
  const prefixRegex = db.RegExp({ regexp: '^' + TEST_PREFIX, options: 'i' });

  for (const col of collections) {
    let deleted = 0;
    try {
      while (true) {
        const batch = await db.collection(col)
          .where({ _id: prefixRegex })
          .limit(100)
          .get();
        if (batch.data.length === 0) break;
        for (const doc of batch.data) {
          await db.collection(col).doc(doc._id).remove();
          deleted++;
        }
      }
    } catch (e) {
      // 集合不存在时忽略
    }
    stats[col] = deleted;
  }

  return { success: true, message: 'Teardown complete', stats };
}
