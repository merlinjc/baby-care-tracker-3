/**
 * 同家庭成员数据可见性 E2E 测试（隔离不误伤）
 *
 * 目标：FamilyA 内 admin(U1) / editor(U2) / viewer(U3) 三者**都能看到**
 *      所有成员的宝宝/记录/疫苗/里程碑，且修改归属规则符合权限矩阵：
 *
 *   - 创建：admin ✓ / editor ✓ / viewer ✗
 *   - 更新自己创建的记录：admin ✓ / editor ✓ / viewer ✗
 *   - 更新他人创建的记录：admin ✓ / editor ✗ / viewer ✗
 *   - 删除：同上
 *
 * 关键：种子里 U1 创建了 4 条记录、U2 创建了 3 条记录，让我们交叉验证 read & write。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { apiRequest, ensureServerUp, login, type AuthSession } from '../helpers/api-client';
import { runSeed, type SeedSummary } from '../helpers/seed';

let seed: SeedSummary;
const sessions: Partial<Record<'U1' | 'U2' | 'U3', AuthSession>> = {};

interface RecordItem {
  id: string;
  createdBy: string;
  recordType: string;
  note: string | null;
  creator?: { id: string; nickname: string };
}

let records: RecordItem[] = [];

beforeAll(async () => {
  await ensureServerUp();
  seed = runSeed();
  sessions.U1 = await login(seed.accounts.U1.email, seed.password);
  sessions.U2 = await login(seed.accounts.U2.email, seed.password);
  sessions.U3 = await login(seed.accounts.U3.email, seed.password);

  // U1 视角拉取所有记录（admin 全可见）
  const r = await apiRequest<{ items: RecordItem[]; total: number }>('/api/records', {
    token: sessions.U1.token,
    query: { babyId: seed.babies.A1.id, pageSize: 50 },
  });
  records = r.data?.items ?? [];
  expect(records.length, '种子记录应 ≥ 7 条').toBeGreaterThanOrEqual(7);
}, 60_000);

describe('可见性：admin/editor/viewer 都能看到所有成员的记录', () => {
  it('admin (U1) 应看到 U1+U2 创建的全部记录', async () => {
    const r = await apiRequest<{ items: RecordItem[]; total: number }>('/api/records', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.A1.id, pageSize: 50 },
    });
    expect(r.ok).toBe(true);
    const creators = new Set(r.data!.items.map((it) => it.createdBy));
    expect(creators.has(seed.accounts.U1.id), 'admin 应看到 U1 创建的记录').toBe(true);
    expect(creators.has(seed.accounts.U2.id), 'admin 应看到 U2 创建的记录').toBe(true);
  });

  it('editor (U2) 同样能看到所有创建者的记录', async () => {
    const r = await apiRequest<{ items: RecordItem[]; total: number }>('/api/records', {
      token: sessions.U2!.token,
      query: { babyId: seed.babies.A1.id, pageSize: 50 },
    });
    expect(r.ok).toBe(true);
    const creators = new Set(r.data!.items.map((it) => it.createdBy));
    expect(creators.has(seed.accounts.U1.id)).toBe(true);
    expect(creators.has(seed.accounts.U2.id)).toBe(true);
  });

  it('viewer (U3) 也能完整读到所有记录', async () => {
    const r = await apiRequest<{ items: RecordItem[]; total: number }>('/api/records', {
      token: sessions.U3!.token,
      query: { babyId: seed.babies.A1.id, pageSize: 50 },
    });
    expect(r.ok).toBe(true);
    expect(r.data!.total).toBe(records.length);
    const creators = new Set(r.data!.items.map((it) => it.createdBy));
    expect(creators.has(seed.accounts.U1.id)).toBe(true);
    expect(creators.has(seed.accounts.U2.id)).toBe(true);
  });

  it('记录响应包含 creator.nickname（前端展示用）', async () => {
    const r = await apiRequest<{ items: RecordItem[] }>('/api/records', {
      token: sessions.U2!.token,
      query: { babyId: seed.babies.A1.id, pageSize: 5 },
    });
    expect(r.ok).toBe(true);
    expect(r.data!.items[0].creator?.nickname).toBeTruthy();
  });

  it('U2(editor) 能读取 U1 创建的某条具体记录详情', async () => {
    const u1Record = records.find((it) => it.createdBy === seed.accounts.U1.id);
    expect(u1Record).toBeDefined();
    const r = await apiRequest(`/api/records/${u1Record!.id}`, { token: sessions.U2!.token });
    expect(r.ok).toBe(true);
  });

  it('U3(viewer) 能读取 U2 创建的某条具体记录详情', async () => {
    const u2Record = records.find((it) => it.createdBy === seed.accounts.U2.id);
    expect(u2Record).toBeDefined();
    const r = await apiRequest(`/api/records/${u2Record!.id}`, { token: sessions.U3!.token });
    expect(r.ok).toBe(true);
  });

  it('todayStats 不区分创建者：所有成员看到同样的统计', async () => {
    const u1 = await apiRequest<{ stats: Record<string, unknown> }>('/api/records/today-stats', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.A1.id },
    });
    const u2 = await apiRequest<{ stats: Record<string, unknown> }>('/api/records/today-stats', {
      token: sessions.U2!.token,
      query: { babyId: seed.babies.A1.id },
    });
    const u3 = await apiRequest<{ stats: Record<string, unknown> }>('/api/records/today-stats', {
      token: sessions.U3!.token,
      query: { babyId: seed.babies.A1.id },
    });
    expect(u1.ok && u2.ok && u3.ok).toBe(true);
    // 三人看到的 today-stats 应完全一致
    expect(u1.data?.stats).toEqual(u2.data?.stats);
    expect(u2.data?.stats).toEqual(u3.data?.stats);
  });

  it('vaccines / milestones 同家庭三角色都可读', async () => {
    for (const role of ['U1', 'U2', 'U3'] as const) {
      const v = await apiRequest(`/api/babies/${seed.babies.A1.id}/vaccines`, {
        token: sessions[role]!.token,
      });
      expect(v.ok, `${role} should read vaccines`).toBe(true);
      const m = await apiRequest(`/api/babies/${seed.babies.A1.id}/milestones`, {
        token: sessions[role]!.token,
      });
      expect(m.ok, `${role} should read milestones`).toBe(true);
    }
  });
});

describe('归属规则：editor 仅能改/删自己的记录，admin 可改/删任何人的', () => {
  let u2OwnRecord: RecordItem;
  let u1OwnRecord: RecordItem;

  beforeAll(() => {
    u2OwnRecord = records.find((it) => it.createdBy === seed.accounts.U2.id)!;
    u1OwnRecord = records.find((it) => it.createdBy === seed.accounts.U1.id)!;
    expect(u2OwnRecord, '种子需有 U2 创建的记录').toBeDefined();
    expect(u1OwnRecord, '种子需有 U1 创建的记录').toBeDefined();
  });

  it('editor (U2) 改自己的记录 → 成功', async () => {
    const r = await apiRequest(`/api/records/${u2OwnRecord.id}`, {
      method: 'PATCH',
      token: sessions.U2!.token,
      body: { note: 'U2 改自己 - ok' },
    });
    expect(r.ok, JSON.stringify(r.error)).toBe(true);
  });

  it('editor (U2) 改 U1 的记录 → 403', async () => {
    const r = await apiRequest(`/api/records/${u1OwnRecord.id}`, {
      method: 'PATCH',
      token: sessions.U2!.token,
      body: { note: '编辑别人 - 应被拒' },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error?.code).toMatch(/PERMISSION|FORBIDDEN/i);
  });

  it('viewer (U3) 改任何记录 → 403', async () => {
    const r = await apiRequest(`/api/records/${u1OwnRecord.id}`, {
      method: 'PATCH',
      token: sessions.U3!.token,
      body: { note: 'viewer 改 - 应被拒' },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('admin (U1) 可改 U2 的记录', async () => {
    const r = await apiRequest(`/api/records/${u2OwnRecord.id}`, {
      method: 'PATCH',
      token: sessions.U1!.token,
      body: { note: 'admin 改他人 - ok' },
    });
    expect(r.ok, JSON.stringify(r.error)).toBe(true);
    // 验证：U2 能查到改后的 note（可见性 + 写入）
    const after = await apiRequest<{ record: { note: string } }>(`/api/records/${u2OwnRecord.id}`, {
      token: sessions.U2!.token,
    });
    expect(after.data?.record.note).toBe('admin 改他人 - ok');
  });

  it('editor (U2) 删除 U1 的记录 → 403', async () => {
    const r = await apiRequest(`/api/records/${u1OwnRecord.id}`, {
      method: 'DELETE',
      token: sessions.U2!.token,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('viewer (U3) 删任何记录 → 403', async () => {
    const r = await apiRequest(`/api/records/${u2OwnRecord.id}`, {
      method: 'DELETE',
      token: sessions.U3!.token,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('editor (U2) 创建新记录 → admin 可删', async () => {
    // U2 新建一条
    const create = await apiRequest<{ record: { id: string } }>('/api/records', {
      method: 'POST',
      token: sessions.U2!.token,
      body: {
        babyId: seed.babies.A1.id,
        recordType: 'feeding',
        startTime: new Date().toISOString(),
        feedingData: { feedingType: 'formula', amount: 90 },
        note: 'U2 新建',
      },
    });
    expect(create.ok).toBe(true);
    const newId = create.data!.record.id;

    // U1 admin 删除
    const del = await apiRequest(`/api/records/${newId}`, {
      method: 'DELETE',
      token: sessions.U1!.token,
    });
    expect(del.ok, 'admin 应可删 editor 的记录').toBe(true);

    // 删后任何角色都查不到（404 而非 403）
    const after = await apiRequest(`/api/records/${newId}`, { token: sessions.U2!.token });
    expect(after.ok).toBe(false);
    expect(after.status).toBe(404);
  });
});

describe('权限矩阵：viewer 全面只读', () => {
  it('viewer 创建记录 → 403', async () => {
    const r = await apiRequest('/api/records', {
      method: 'POST',
      token: sessions.U3!.token,
      body: {
        babyId: seed.babies.A1.id,
        recordType: 'diaper',
        startTime: new Date().toISOString(),
        diaperData: { diaperType: 'pee' },
      },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('viewer 创建疫苗 → 403', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.A1.id}/vaccines`, {
      method: 'POST',
      token: sessions.U3!.token,
      body: { name: 'V', dose: '1', vaccinatedDate: '2025-06-01T00:00:00.000Z' },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('viewer 创建里程碑 → 403', async () => {
    const r = await apiRequest(`/api/babies/${seed.babies.A1.id}/milestones`, {
      method: 'POST',
      token: sessions.U3!.token,
      body: { name: 'M', category: '运动', achievedDate: '2025-06-01T00:00:00.000Z' },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('viewer 不能创建/更新/删除宝宝', async () => {
    const create = await apiRequest('/api/babies', {
      method: 'POST',
      token: sessions.U3!.token,
      body: {
        familyId: seed.families.A.id,
        name: 'V-baby',
        gender: 'female',
        birthDate: '2025-01-01',
      },
    });
    expect(create.status).toBe(403);

    const update = await apiRequest(`/api/babies/${seed.babies.A1.id}`, {
      method: 'PATCH',
      token: sessions.U3!.token,
      body: { name: 'viewer 改名' },
    });
    expect(update.status).toBe(403);

    const del = await apiRequest(`/api/babies/${seed.babies.A1.id}`, {
      method: 'DELETE',
      token: sessions.U3!.token,
      body: { familyId: seed.families.A.id },
    });
    expect(del.status).toBe(403);
  });

  it('viewer 不能管理家庭成员', async () => {
    const refresh = await apiRequest(`/api/families/${seed.families.A.id}/refresh-invite`, {
      method: 'POST',
      token: sessions.U3!.token,
    });
    expect(refresh.status).toBe(403);

    const update = await apiRequest(
      `/api/families/${seed.families.A.id}/members/${seed.accounts.U2.id}/role`,
      {
        method: 'PATCH',
        token: sessions.U3!.token,
        body: { role: 'viewer' },
      },
    );
    expect(update.status).toBe(403);
  });

  it('viewer 可导出（仅读）', async () => {
    const r = await apiRequest('/api/export', {
      token: sessions.U3!.token,
      query: { babyId: seed.babies.A1.id, format: 'json' },
    });
    // export 直接返回数组（attachment），不走 { success, data } 包装格式
    // 因此用 status 判断而非 r.ok
    expect(r.status, JSON.stringify(r.error)).toBe(200);
  });
});

describe('多宝宝隔离：FamilyA 内不同宝宝的记录不串', () => {
  it('查 babyA1 的记录不应返回 babyA2 的', async () => {
    const r = await apiRequest<{ items: Array<{ babyId: string }> }>('/api/records', {
      token: sessions.U1!.token,
      query: { babyId: seed.babies.A1.id, pageSize: 50 },
    });
    expect(r.ok).toBe(true);
    const allFromA1 = r.data!.items.every((it) => it.babyId === seed.babies.A1.id);
    expect(allFromA1, '应仅返回 babyA1 的记录').toBe(true);
  });

  it('用 babyA1 的 id 反向查 babyA2 records → 应不返回任何 babyA1 数据（pageSize=50）', async () => {
    const r = await apiRequest<{ items: Array<{ babyId: string }>; total: number }>(
      '/api/records',
      {
        token: sessions.U1!.token,
        query: { babyId: seed.babies.A2.id, pageSize: 50 },
      },
    );
    expect(r.ok).toBe(true);
    const allFromA2 = r.data!.items.every((it) => it.babyId === seed.babies.A2.id);
    expect(allFromA2).toBe(true);
  });
});
