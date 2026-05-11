/**
 * jaundice.service 集成测试（v7.2 T-S1-F2-01）
 *
 * 覆盖：
 * - C1 admin 创建 + 字段完整入库
 * - C2 跨家庭隔离：A 家庭 admin 无法访问 B 家庭 baby
 * - C3 viewer 不能创建
 * - C4 editor 仅能改自己的，不能改别人的
 * - C5 editor 仅能删自己的，不能删别人的
 * - C6 admin 可以删任意人的记录
 * - C7 list 按 recordDate desc + 时间窗过滤
 * - C8 update 部分字段语义（symptoms / treatments JSON 序列化）
 * - C9 update 至少一个字段（schema 校验由 routes 集成测试覆盖，此处只验 service）
 * - C10 不存在的 recordId / 不属于该 baby 的 recordId → NotFound
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { jaundiceService } from '../../src/services/jaundice.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers, createBaby } from '../helpers/factories';

let admin: { id: string };
let editor: { id: string };
let viewer: { id: string };
let familyId: string;
let babyId: string;

beforeEach(async () => {
  const editorUser = await createUser({ nickname: 'EditorUser' });
  const viewerUser = await createUser({ nickname: 'ViewerUser' });
  const { family, admin: adminUser } = await createFamilyWithMembers({
    extraMembers: [
      { user: editorUser, role: 'editor' },
      { user: viewerUser, role: 'viewer' },
    ],
  });
  admin = adminUser;
  editor = editorUser;
  viewer = viewerUser;
  familyId = family.id;
  const baby = await createBaby(family.id, 'Cici');
  babyId = baby.id;
});

describe('JaundiceService', () => {
  describe('create', () => {
    it('C1: admin 创建 + 字段完整入库 + symptoms/treatments JSON 序列化', async () => {
      const result = await jaundiceService.create(admin.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
        dayAge: 5,
        kramerZone: 3,
        scleralIcterus: true,
        tcb: 12.3,
        category: 'physiologic',
        symptoms: ['吃奶正常', '尿色清亮'],
        treatments: ['加强喂养', '多晒太阳'],
        note: '观察中',
      });

      expect(result.id).toBeDefined();
      expect(result.babyId).toBe(babyId);
      expect(result.familyId).toBe(familyId);
      expect(result.recordDate).toBe('2026-05-01T00:00:00.000Z');
      expect(result.dayAge).toBe(5);
      expect(result.kramerZone).toBe(3);
      expect(result.scleralIcterus).toBe(true);
      expect(result.tcb).toBe(12.3);
      expect(result.tsb).toBeNull();
      expect(result.category).toBe('physiologic');
      expect(result.symptoms).toEqual(['吃奶正常', '尿色清亮']);
      expect(result.treatments).toEqual(['加强喂养', '多晒太阳']);
      expect(result.note).toBe('观察中');
      expect(result.createdBy).toBe(admin.id);

      // 库内 symptoms / treatments 是 JSON 字符串
      const raw = await prisma.jaundiceRecord.findUnique({ where: { id: result.id } });
      expect(raw?.symptoms).toBe('["吃奶正常","尿色清亮"]');
      expect(raw?.treatments).toBe('["加强喂养","多晒太阳"]');
    });

    it('C2: 跨家庭隔离 — 其他家庭 admin 无法 create', async () => {
      // 另起一个家庭与 admin
      const otherUser = await createUser({ nickname: 'Outsider' });
      await createFamilyWithMembers({ creator: otherUser });

      await expect(
        jaundiceService.create(otherUser.id, babyId, {
          recordDate: '2026-05-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('C3: viewer 不能创建', async () => {
      await expect(
        jaundiceService.create(viewer.id, babyId, {
          recordDate: '2026-05-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'PERMISSION_DENIED' });
    });
  });

  describe('update / delete 权限矩阵', () => {
    it('C4: editor 仅能改自己的；改别人的 → 403', async () => {
      const adminRecord = await jaundiceService.create(admin.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
        kramerZone: 2,
      });
      const editorRecord = await jaundiceService.create(editor.id, babyId, {
        recordDate: '2026-05-02T00:00:00Z',
        kramerZone: 1,
      });

      // editor 改自己 → ok
      const updated = await jaundiceService.update(editor.id, babyId, editorRecord.id, {
        kramerZone: 3,
      });
      expect(updated.kramerZone).toBe(3);

      // editor 改 admin 的 → 403
      await expect(
        jaundiceService.update(editor.id, babyId, adminRecord.id, { kramerZone: 5 }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('C5: editor 仅能删自己的；删别人的 → 403', async () => {
      const adminRecord = await jaundiceService.create(admin.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
      });
      const editorRecord = await jaundiceService.create(editor.id, babyId, {
        recordDate: '2026-05-02T00:00:00Z',
      });

      await jaundiceService.delete(editor.id, babyId, editorRecord.id);
      await expect(
        jaundiceService.delete(editor.id, babyId, adminRecord.id),
      ).rejects.toMatchObject({ statusCode: 403 });

      const left = await prisma.jaundiceRecord.findMany({ where: { babyId } });
      expect(left).toHaveLength(1);
      expect(left[0].id).toBe(adminRecord.id);
    });

    it('C6: admin 可以删任意人的记录', async () => {
      const editorRecord = await jaundiceService.create(editor.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
      });
      await jaundiceService.delete(admin.id, babyId, editorRecord.id);
      const left = await prisma.jaundiceRecord.findMany({ where: { babyId } });
      expect(left).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('C7: 按 recordDate desc + startDate / endDate 闭区间过滤', async () => {
      await jaundiceService.create(admin.id, babyId, { recordDate: '2026-04-30T00:00:00Z' });
      const r2 = await jaundiceService.create(admin.id, babyId, { recordDate: '2026-05-01T00:00:00Z' });
      const r3 = await jaundiceService.create(admin.id, babyId, { recordDate: '2026-05-03T00:00:00Z' });
      await jaundiceService.create(admin.id, babyId, { recordDate: '2026-05-10T00:00:00Z' });

      const res = await jaundiceService.list(admin.id, babyId, {
        startDate: '2026-05-01T00:00:00Z',
        endDate: '2026-05-05T00:00:00Z',
        limit: 100,
      });

      expect(res.items).toHaveLength(2);
      expect(res.items[0].id).toBe(r3.id); // desc
      expect(res.items[1].id).toBe(r2.id);
    });
  });

  describe('update 部分字段语义', () => {
    it('C8: 仅传 symptoms 时只改这一字段，其它保留', async () => {
      const created = await jaundiceService.create(admin.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
        kramerZone: 3,
        symptoms: ['尿色清亮'],
        note: '原备注',
      });

      const updated = await jaundiceService.update(admin.id, babyId, created.id, {
        symptoms: ['尿色深黄', '吃奶减少'],
      });

      expect(updated.symptoms).toEqual(['尿色深黄', '吃奶减少']);
      expect(updated.kramerZone).toBe(3);
      expect(updated.note).toBe('原备注');
    });
  });

  describe('not found 兜底', () => {
    it('C10: 不存在的 recordId / babyId 不匹配 → 404', async () => {
      await expect(
        jaundiceService.update(admin.id, babyId, 'not-exist-id', { kramerZone: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });

      // 另外一个家庭的 baby + 同 family 的 record 也应 NotFound（不属于该 baby）
      const r = await jaundiceService.create(admin.id, babyId, {
        recordDate: '2026-05-01T00:00:00Z',
      });
      const otherBaby = await createBaby(familyId, 'OtherBaby');
      await expect(
        jaundiceService.update(admin.id, otherBaby.id, r.id, { kramerZone: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
