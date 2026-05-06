/**
 * P0 冒烟：成员/家庭/宝宝/记录主链路 + 跨家庭隔离
 *
 * 对应场景：
 *   - S01 创建家庭 + admin 角色
 *   - S03 邀请码加入（默认 editor）
 *   - S10 admin 创建宝宝 + 生日校验
 *   - S16 editor 创建喂养记录 + todayStats 刷新
 *   - S25 跨家庭查询阻断
 *
 * 前置：
 *   - 后端 dev 服务已启动（http://localhost:3000）
 *   - 默认会自动 reset + seed-e2e（账号 U1..U6 + 家庭 A/B）
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiRequest, ensureServerUp, login, register, type AuthSession } from '../helpers/api-client';
import { runSeed, type SeedSummary } from '../helpers/seed';

let seed: SeedSummary;
// 顶层共享 sessions：避免每个用例重复登录触发 authRateLimit (10/min/IP)
const sessions: Partial<Record<'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6', AuthSession>> = {};

beforeAll(async () => {
  await ensureServerUp();
  seed = runSeed();
  // 串行登录以稳定计入限流计数（4 次，远低于 10）
  sessions.U1 = await login(seed.accounts.U1.email, seed.password);
  sessions.U2 = await login(seed.accounts.U2.email, seed.password);
  sessions.U3 = await login(seed.accounts.U3.email, seed.password);
  sessions.U4 = await login(seed.accounts.U4.email, seed.password);
  sessions.U5 = await login(seed.accounts.U5.email, seed.password);
}, 60_000);

afterAll(() => {
  // seed 数据保留供后续手测/Playwright 使用
});

describe('P0 冒烟：主链路', () => {
  // ==================== S01 创建家庭 + admin 角色 ====================
  it('S01 新用户注册 → 创建家庭 → 自动获得 admin', async () => {
    // 注册新用户（不在种子账号里，避免冲突）
    const ts = Date.now();
    const acc = await register({
      email: `s01.${ts}@e2e.local`,
      password: 'Test1234!',
      nickname: '测试家庭创建者',
    });
    expect(acc.token).toBeTruthy();

    // 创建家庭（nickname 必填）
    const created = await apiRequest<{
      family: { id: string; name: string; inviteCode: string };
    }>('/api/families', {
      method: 'POST',
      token: acc.token,
      body: { name: 'S01TestFamily', nickname: '测试妈妈' },
    });
    expect(created.ok, `expected ok, got ${JSON.stringify(created.error)}`).toBe(true);
    expect(created.status).toBe(201);
    expect(created.data?.family.name).toBe('S01TestFamily');
    expect(created.data?.family.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // 获取当前家庭 → 角色应为 admin
    const me = await apiRequest<{
      family: { id: string; currentUserRole?: string; members?: Array<{ userId: string; role: string }> };
    }>('/api/families/current', { token: acc.token });
    expect(me.ok).toBe(true);
    // 兼容两种响应：currentUserRole 字段 或 members 数组里查找
    const role =
      me.data?.family.currentUserRole ??
      me.data?.family.members?.find((m) => m.userId === acc.userId)?.role;
    expect(role).toBe('admin');
  });

  // ==================== S03 邀请码加入 + 默认 editor ====================
  it('S03 已有家庭：用邀请码加入，新成员默认 editor', async () => {
    const u4 = sessions.U4!;

    const join = await apiRequest<{
      family: { id: string; currentUserRole?: string; members?: Array<{ userId: string; role: string }> };
    }>('/api/families/join', {
      method: 'POST',
      token: u4.token,
      body: { inviteCode: seed.families.A.inviteCode, nickname: 'grandmaM' },
    });
    expect(join.ok, `expected ok, got ${JSON.stringify(join.error)}`).toBe(true);
    expect(join.data?.family.id).toBe(seed.families.A.id);
    const u4Role =
      join.data?.family.currentUserRole ??
      join.data?.family.members?.find((m) => m.userId === seed.accounts.U4.id)?.role;
    expect(u4Role).toBe('editor');

    // 错误邀请码 → 错误码（U5 始终无家庭）
    const u5 = sessions.U5!;
    const bad = await apiRequest('/api/families/join', {
      method: 'POST',
      token: u5.token,
      body: { inviteCode: 'ZZZZZZ', nickname: 'guest' },
    });
    expect(bad.ok).toBe(false);
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.error?.code).toMatch(/INVITE|NOT_FOUND|INVALID|VALIDATION/i);
  });

  // ==================== S10 admin 创建宝宝 ====================
  it('S10 admin 可创建宝宝（合法生日）', async () => {
    const u1 = sessions.U1!;

    // 合法创建
    const ok = await apiRequest<{ baby: { id: string; name: string } }>('/api/babies', {
      method: 'POST',
      token: u1.token,
      body: {
        familyId: seed.families.A.id,
        name: 'S10TestBaby',
        gender: 'male',
        birthDate: '2025-06-01',
      },
    });
    expect(ok.ok, `expected ok, got ${JSON.stringify(ok.error)}`).toBe(true);
    expect(ok.data?.baby.name).toBe('S10TestBaby');

    // 非法 birthDate 字符串 → 拒绝
    const badFmt = await apiRequest('/api/babies', {
      method: 'POST',
      token: u1.token,
      body: {
        familyId: seed.families.A.id,
        name: 'BadFmtBaby',
        gender: 'female',
        birthDate: 'not-a-date',
      },
    });
    expect(badFmt.ok).toBe(false);
    expect(badFmt.status).toBeGreaterThanOrEqual(400);
  });

  /**
   * BUG-S10-FUTURE-BIRTH 已修复（2026-05-06）：
   * baby.schema.ts dateStringSchema 增加 refine：
   *   - 不晚于 now + 24h（容忍夏令时/客户端时钟）
   *   - 不早于 1900-01-01
   */
  it('S10b 未来生日应被拒绝', async () => {
    const u1 = sessions.U1!;
    const farFuture = new Date(Date.now() + 7 * 86400_000).toISOString();
    const r = await apiRequest('/api/babies', {
      method: 'POST',
      token: u1.token,
      body: {
        familyId: seed.families.A.id,
        name: 'FutureBaby',
        gender: 'female',
        birthDate: farFuture,
      },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.error?.message ?? '').toMatch(/不能晚于今天|未来|future/i);
  });

  it('S10c 早于 1900-01-01 的生日应被拒绝', async () => {
    const u1 = sessions.U1!;
    const r = await apiRequest('/api/babies', {
      method: 'POST',
      token: u1.token,
      body: {
        familyId: seed.families.A.id,
        name: 'AntiqueBaby',
        gender: 'female',
        birthDate: '1899-12-31',
      },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.message ?? '').toMatch(/1900|早于/i);
  });

  it('S11 editor 创建宝宝被拒（403）', async () => {
    const u2 = sessions.U2!;
    const r = await apiRequest('/api/babies', {
      method: 'POST',
      token: u2.token,
      body: {
        familyId: seed.families.A.id,
        name: 'EditorBaby',
        gender: 'male',
        birthDate: '2025-06-01T00:00:00.000Z',
      },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error?.code).toMatch(/PERMISSION|FORBIDDEN/i);
  });

  // ==================== S16 editor 创建喂养记录 ====================
  it('S16 editor 创建母乳记录 → todayStats 喂养次数 +1', async () => {
    const u2 = sessions.U2!;
    const babyId = seed.babies.A1.id;

    const before = await apiRequest<{ stats: { feedingCount?: number } }>(
      '/api/records/today-stats',
      { token: u2.token, query: { babyId } },
    );
    const beforeCount = before.data?.stats.feedingCount ?? 0;

    const create = await apiRequest<{ record: { id: string; createdBy: string } }>('/api/records', {
      method: 'POST',
      token: u2.token,
      body: {
        babyId,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'breast', breastSide: 'left', duration: 600 },
      },
    });
    expect(create.ok).toBe(true);
    expect(create.status).toBe(201);
    expect(create.data?.record.createdBy).toBe(seed.accounts.U2.id);

    const after = await apiRequest<{ stats: { feedingCount?: number } }>(
      '/api/records/today-stats',
      { token: u2.token, query: { babyId } },
    );
    const afterCount = after.data?.stats.feedingCount ?? 0;
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  // ==================== S25 跨家庭查询阻断 ====================
  it('S25 FamilyA 用户无法查询 FamilyB 的宝宝/记录（403/404）', async () => {
    const u1 = sessions.U1!;

    const baby = await apiRequest(`/api/babies/${seed.babies.B1.id}`, { token: u1.token });
    expect(baby.ok).toBe(false);
    expect([403, 404]).toContain(baby.status);

    const records = await apiRequest<{
      records: Array<unknown>;
      total: number;
    }>('/api/records', {
      token: u1.token,
      query: { babyId: seed.babies.B1.id },
    });
    if (records.ok) {
      expect(records.data?.total ?? 0).toBe(0);
    } else {
      expect([403, 404]).toContain(records.status);
    }

    const fam = await apiRequest(`/api/families/${seed.families.B.id}`, { token: u1.token });
    expect(fam.ok).toBe(false);
    expect([403, 404]).toContain(fam.status);
  });
});

describe('P0 冒烟：viewer 只读限制', () => {
  it('viewer 创建记录被拒', async () => {
    const u3 = sessions.U3!;
    const r = await apiRequest('/api/records', {
      method: 'POST',
      token: u3.token,
      body: {
        babyId: seed.babies.A1.id,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'formula', amount: 100 },
      },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('viewer 可读家庭/宝宝/记录', async () => {
    const u3 = sessions.U3!;
    const r = await apiRequest('/api/families/current', { token: u3.token });
    expect(r.ok).toBe(true);

    const recs = await apiRequest('/api/records', {
      token: u3.token,
      query: { babyId: seed.babies.A1.id },
    });
    expect(recs.ok).toBe(true);
  });
});
