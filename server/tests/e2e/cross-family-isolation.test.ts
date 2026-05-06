/**
 * 跨家庭数据隔离 E2E 测试（P3 安全场景 S25 强化版）
 *
 * 目标：穷尽所有"家庭 A 用户访问家庭 B 数据"的接口入口，确保零泄露。
 *
 * 覆盖接口：
 *   1. GET    /api/babies/:id                    宝宝详情
 *   2. PATCH  /api/babies/:id                    宝宝更新
 *   3. DELETE /api/babies/:id                    宝宝删除
 *   4. GET    /api/babies?familyId=B             家庭宝宝列表（用别人家 familyId 查询）
 *   5. GET    /api/families/:id                  家庭详情
 *   6. GET    /api/families/:id/members          家庭成员列表
 *   7. POST   /api/families/:id/refresh-invite   刷新邀请码
 *   8. POST   /api/families/:id/leave            退出别人家庭
 *   9. DELETE /api/families/:id                  解散别人家庭
 *  10. GET    /api/records?babyId=B              记录列表（按对方 babyId）
 *  11. GET    /api/records/:id                   记录详情
 *  12. PATCH  /api/records/:id                   修改对方记录
 *  13. DELETE /api/records/:id                   删除对方记录
 *  14. POST   /api/records (babyId=B)            为对方宝宝创建记录
 *  15. GET    /api/records/today-stats?babyId=B  今日统计
 *  16. GET    /api/babies/:id/vaccines           疫苗列表
 *  17. POST   /api/babies/:id/vaccines           创建疫苗
 *  18. GET    /api/babies/:id/milestones         里程碑列表
 *  19. POST   /api/babies/:id/milestones         创建里程碑
 *  20. GET    /api/babies/:id/trends             趋势数据
 *  21. GET    /api/babies/:id/trend/weekly       本周趋势（FR-B）
 *  22. GET    /api/export?babyId=B               数据导出
 *
 * 隔离原则：所有接口必须返回 403/404，**不得**泄露对方数据。
 *
 * 前置：
 *   - 后端 dev 服务已启动（http://localhost:3000）
 *   - seed-e2e 自动准备 FamilyA(U1+U2+U3) + FamilyB(U6)，babyB1 含完整记录/疫苗/里程碑
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { apiRequest, ensureServerUp, login, type AuthSession } from '../helpers/api-client';
import { runSeed, type SeedSummary } from '../helpers/seed';

let seed: SeedSummary;
const sessions: Partial<Record<'U1' | 'U2' | 'U3' | 'U6', AuthSession>> = {};
let babyB1RecordId = '';
let babyB1VaccineId = '';
let babyB1MilestoneId = '';

beforeAll(async () => {
  await ensureServerUp();
  seed = runSeed();
  sessions.U1 = await login(seed.accounts.U1.email, seed.password);
  sessions.U2 = await login(seed.accounts.U2.email, seed.password);
  sessions.U3 = await login(seed.accounts.U3.email, seed.password);
  sessions.U6 = await login(seed.accounts.U6.email, seed.password);

  // U6 拉取 babyB1 的真实 recordId / vaccineId / milestoneId（FamilyB 内部视角）
  // 这些 ID 后面会被 FamilyA 用户尝试访问/修改，期望被拒
  const recs = await apiRequest<{ items: Array<{ id: string }> }>('/api/records', {
    token: sessions.U6.token,
    query: { babyId: seed.babies.B1.id, pageSize: 50 },
  });
  babyB1RecordId = recs.data?.items?.[0]?.id ?? '';

  const vaccs = await apiRequest<{ items: Array<{ id: string }> }>(
    `/api/babies/${seed.babies.B1.id}/vaccines`,
    { token: sessions.U6.token, query: { pageSize: 50 } },
  );
  babyB1VaccineId = vaccs.data?.items?.[0]?.id ?? '';

  const miles = await apiRequest<{ items: Array<{ id: string }> }>(
    `/api/babies/${seed.babies.B1.id}/milestones`,
    { token: sessions.U6.token, query: { pageSize: 50 } },
  );
  babyB1MilestoneId = miles.data?.items?.[0]?.id ?? '';
}, 60_000);

/** 断言响应是隔离失败（403/404），且不含对方业务数据 */
function expectIsolated(r: Awaited<ReturnType<typeof apiRequest>>, hint: string) {
  // 必须不成功
  expect(r.ok, `${hint}: 期望被拒绝，但 ok=true`).toBe(false);
  // 状态码必须是 403/404
  expect([403, 404], `${hint}: 状态码应为 403/404，实际 ${r.status}`).toContain(r.status);
  // 错误码不应是 VALIDATION_ERROR（说明请求本身有效但被权限拒绝）
  expect(r.error?.code).toMatch(/PERMISSION|FORBIDDEN|NOT_FOUND/i);
}

describe('跨家庭隔离：FamilyA admin (U1) 访问 FamilyB 数据', () => {
  // -------- baby --------
  it('GET /babies/:B1 → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}`, { token: sessions.U1!.token });
    expectIsolated(r, 'baby detail');
  });

  it('PATCH /babies/:B1 → 拒绝（不应改名）', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}`, {
      method: 'PATCH',
      token: sessions.U1!.token,
      body: { name: '被恶意改名' },
    });
    expectIsolated(r, 'baby patch');

    // 验证：FamilyB U6 视角看，名字仍是"小雪"
    const fromB = await apiRequest<{ baby: { name: string } }>(
      `/api/babies/${seed.babies.B1.id}`,
      { token: sessions.U6!.token },
    );
    expect(fromB.data?.baby.name).toBe('小雪');
  });

  it('DELETE /babies/:B1 → 拒绝（不应删宝宝）', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}`, {
      method: 'DELETE',
      token: sessions.U1!.token,
      body: { familyId: seed.families.B.id },
    });
    expectIsolated(r, 'baby delete');

    // 验证：FamilyB 视角宝宝仍存在
    const fromB = await apiRequest(`/api/babies/${seed.babies.B1.id}`, {
      token: sessions.U6!.token,
    });
    expect(fromB.ok).toBe(true);
  });

  it('GET /babies?familyId=B → 不能用对方 familyId 列出宝宝', async () => {
    const r = await apiRequest('/api/babies', {
      token: sessions.U1!.token,
      query: { familyId: seed.families.B.id },
    });
    // 服务实现允许 200 但应仅返回 [],或直接 403
    if (r.ok) {
      const babies = (r.data as { babies: unknown[] })?.babies ?? [];
      expect(babies.length, '应不返回任何 FamilyB 宝宝').toBe(0);
    } else {
      expectIsolated(r, 'babies list cross-family');
    }
  });

  // -------- family --------
  it('GET /families/:B → 拒绝', async () => {
    const r = await apiRequest(`/api/families/${seed.families.B.id}`, {
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'family detail');
    // 即便误返回，也不能含 FamilyB 名字
    if (r.data) {
      const txt = JSON.stringify(r.data);
      expect(txt).not.toContain('FamilyB-E2E');
    }
  });

  it('GET /families/:B/members → 拒绝（不能枚举对方成员）', async () => {
    const r = await apiRequest(`/api/families/${seed.families.B.id}/members`, {
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'family members');
    if (r.data) {
      const txt = JSON.stringify(r.data);
      expect(txt).not.toContain('momB');
    }
  });

  it('POST /families/:B/refresh-invite → 拒绝', async () => {
    const r = await apiRequest(`/api/families/${seed.families.B.id}/refresh-invite`, {
      method: 'POST',
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'refresh invite cross-family');
  });

  it('POST /families/:B/leave → 拒绝（不能"退出"自己不在的家庭）', async () => {
    const r = await apiRequest(`/api/families/${seed.families.B.id}/leave`, {
      method: 'POST',
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'leave others family');
  });

  it('DELETE /families/:B → 拒绝（不能解散对方家庭）', async () => {
    const r = await apiRequest(`/api/families/${seed.families.B.id}`, {
      method: 'DELETE',
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'dissolve others family');

    // 验证：FamilyB 还在
    const fromB = await apiRequest('/api/families/current', { token: sessions.U6!.token });
    expect(fromB.ok).toBe(true);
    expect((fromB.data as { family: { id: string } }).family.id).toBe(seed.families.B.id);
  });

  // -------- records --------
  it('GET /records?babyId=B1 → 拒绝或返回空', async () => {
    const r = await apiRequest<{ items: unknown[]; total: number }>('/api/records', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.B1.id, pageSize: 50 },
    });
    if (r.ok) {
      expect(r.data?.total ?? 0, '应不返回任何 FamilyB 记录').toBe(0);
      expect((r.data?.items ?? []).length).toBe(0);
    } else {
      expectIsolated(r, 'records list cross-family');
    }
  });

  it('GET /records/:B1Record → 拒绝', async () => {
    expect(babyB1RecordId, 'seed 应有 FamilyB 记录').toBeTruthy();
    const r = await apiRequest(`/api/records/${babyB1RecordId}`, { token: sessions.U1!.token });
    expectIsolated(r, 'record detail cross-family');
    // 即便意外有 data，也不能含"B 家庭独享"
    if (r.data) {
      expect(JSON.stringify(r.data)).not.toContain('B 家庭独享');
    }
  });

  it('PATCH /records/:B1Record → 拒绝（不能改对方记录）', async () => {
    const r = await apiRequest(`/api/records/${babyB1RecordId}`, {
      method: 'PATCH',
      token: sessions.U1!.token,
      body: { note: '恶意修改' },
    });
    expectIsolated(r, 'record patch cross-family');
  });

  it('DELETE /records/:B1Record → 拒绝（不能删对方记录）', async () => {
    const r = await apiRequest(`/api/records/${babyB1RecordId}`, {
      method: 'DELETE',
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'record delete cross-family');
    // 验证：FamilyB 视角记录还在
    const fromB = await apiRequest(`/api/records/${babyB1RecordId}`, {
      token: sessions.U6!.token,
    });
    expect(fromB.ok).toBe(true);
  });

  it('POST /records (babyId=B1) → 拒绝（不能给对方宝宝创建记录）', async () => {
    const r = await apiRequest('/api/records', {
      method: 'POST',
      token: sessions.U1!.token,
      body: {
        babyId: seed.babies.B1.id,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'breast', breastSide: 'left', duration: 60 },
      },
    });
    expectIsolated(r, 'record create cross-family');
  });

  it('GET /records/today-stats?babyId=B1 → 拒绝或全 0', async () => {
    const r = await apiRequest<{ stats: Record<string, unknown> }>('/api/records/today-stats', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.B1.id },
    });
    if (r.ok) {
      // 若实现允许返回零统计，须确认所有计数为 0
      const stats = r.data?.stats ?? {};
      const numericValues = Object.values(stats).filter((v) => typeof v === 'number') as number[];
      expect(numericValues.every((n) => n === 0), 'today-stats 应全为 0').toBe(true);
    } else {
      expectIsolated(r, 'today-stats cross-family');
    }
  });

  // -------- vaccines / milestones / trends / export --------
  it('GET /babies/:B1/vaccines → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/vaccines`, {
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'vaccines list cross-family');
    if (r.data) {
      expect(JSON.stringify(r.data)).not.toContain('B家庭专属疫苗');
    }
  });

  it('POST /babies/:B1/vaccines → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/vaccines`, {
      method: 'POST',
      token: sessions.U1!.token,
      body: {
        name: '恶意疫苗',
        dose: '第1剂',
        vaccinatedDate: '2025-06-01T00:00:00.000Z',
      },
    });
    expectIsolated(r, 'vaccine create cross-family');
  });

  it('GET /babies/:B1/milestones → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/milestones`, {
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'milestones list cross-family');
    if (r.data) {
      expect(JSON.stringify(r.data)).not.toContain('B家庭专属里程碑');
    }
  });

  it('POST /babies/:B1/milestones → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/milestones`, {
      method: 'POST',
      token: sessions.U1!.token,
      body: {
        name: '恶意里程碑',
        category: '运动',
        achievedDate: '2025-06-01T00:00:00.000Z',
      },
    });
    expectIsolated(r, 'milestone create cross-family');
  });

  it('GET /babies/:B1/trends → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/trends`, {
      token: sessions.U1!.token,
      query: { type: 'weight', period: 'week' },
    });
    expectIsolated(r, 'trends cross-family');
  });

  it('GET /babies/:B1/trend/weekly → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}/trend/weekly`, {
      token: sessions.U1!.token,
    });
    expectIsolated(r, 'trend/weekly cross-family');
  });

  it('GET /export?babyId=B1 → 拒绝（不能导出对方数据）', async () => {
    const r = await apiRequest('/api/export', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.B1.id, format: 'json' },
    });
    expectIsolated(r, 'export cross-family');
  });
});

describe('跨家庭隔离：FamilyA editor (U2) 同样无权', () => {
  it('U2 GET /records?babyId=B1 → 同样隔离', async () => {
    const r = await apiRequest<{ items: unknown[]; total: number }>('/api/records', {
      token: sessions.U2!.token,
      query: { babyId: seed.babies.B1.id },
    });
    if (r.ok) {
      expect(r.data?.total ?? 0).toBe(0);
    } else {
      expectIsolated(r, 'U2 records cross-family');
    }
  });

  it('U2 POST /records babyId=B1 → 拒绝', async () => {
    const r = await apiRequest('/api/records', {
      method: 'POST',
      token: sessions.U2!.token,
      body: {
        babyId: seed.babies.B1.id,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'formula', amount: 60 },
      },
    });
    expectIsolated(r, 'U2 create record cross-family');
  });
});

describe('跨家庭隔离：FamilyA viewer (U3) 同样无权', () => {
  it('U3 GET /babies/:B1 → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.B1.id}`, { token: sessions.U3!.token });
    expectIsolated(r, 'U3 baby detail cross-family');
  });

  it('U3 GET /export?babyId=B1 → 拒绝', async () => {
    const r = await apiRequest('/api/export', {
      token: sessions.U3!.token,
      query: { babyId: seed.babies.B1.id, format: 'csv' },
    });
    expectIsolated(r, 'U3 export cross-family');
  });
});

describe('跨家庭隔离：未加入家庭用户（U5）', () => {
  it('U5 GET /families/current → family=null（不应返回任何家庭）', async () => {
    const u5 = await login(seed.accounts.U5.email, seed.password);
    const r = await apiRequest<{ family: unknown }>('/api/families/current', { token: u5.token });
    expect(r.ok).toBe(true);
    expect(r.data?.family, 'U5 未加入任何家庭，应返回 null').toBeNull();
  });

  it('U5 GET /babies/:A1 → 拒绝（自己无家庭却查 FamilyA 宝宝）', async () => {
    const u5 = sessions.U6 ? await login(seed.accounts.U5.email, seed.password) : null;
    if (!u5) return;
    const r = await apiRequest(`/api/babies/${seed.babies.A1.id}`, { token: u5.token });
    expectIsolated(r, 'U5 baby detail');
  });
});

describe('反向：FamilyB U6 也无法访问 FamilyA 数据（对称性）', () => {
  it('U6 GET /babies/:A1 → 拒绝', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.A1.id}`, { token: sessions.U6!.token });
    expectIsolated(r, 'U6 baby A1');
  });

  it('U6 GET /families/:A → 拒绝', async () => {
    const r = await apiRequest(`/api/families/${seed.families.A.id}`, {
      token: sessions.U6!.token,
    });
    expectIsolated(r, 'U6 family A');
  });

  it('U6 POST /records babyId=A1 → 拒绝', async () => {
    const r = await apiRequest('/api/records', {
      method: 'POST',
      token: sessions.U6!.token,
      body: {
        babyId: seed.babies.A1.id,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'breast', duration: 60, breastSide: 'left' },
      },
    });
    expectIsolated(r, 'U6 create record into A1');
  });
});

describe('反向：U6 对自家数据正常可见（确保隔离不误伤）', () => {
  it('U6 GET /records?babyId=B1 → 应返回 ≥3 条种子记录', async () => {
    const r = await apiRequest<{ items: unknown[]; total: number }>('/api/records', {
      token: sessions.U6!.token,
      query: { babyId: seed.babies.B1.id, pageSize: 50 },
    });
    expect(r.ok).toBe(true);
    expect(r.data?.total ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('U6 GET /babies/:B1/vaccines → 应返回 B家庭专属疫苗', async () => {
    const r = await apiRequest<{ items: Array<{ name: string }> }>(
      `/api/babies/${seed.babies.B1.id}/vaccines`,
      { token: sessions.U6!.token },
    );
    expect(r.ok).toBe(true);
    expect(r.data?.items.some((v) => v.name === 'B家庭专属疫苗')).toBe(true);
  });
});
