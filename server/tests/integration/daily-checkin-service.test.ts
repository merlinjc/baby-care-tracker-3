/**
 * daily-checkin.service 集成测试（v7.2 T-S2-F11-BE-02）
 *
 * 覆盖：
 * - C1: admin 创建 + 字段完整入库
 * - C2: 跨家庭隔离 — 其他家庭 admin 无法访问 baby
 * - C3: viewer 不能创建
 * - C4: 7d 窗口 — 今/昨/7 天前 OK；8 天前 / 未来拒绝
 * - C5: 出生日校验 — checkinDate 早于 birthDate 拒绝
 * - C6: 唯一约束 — 同一日重复 POST 抛 409 CHECKIN_DUPLICATE
 * - C7: editor 仅能改自己；改别人 → 403
 * - C8: editor 仅能删自己；删别人 → 403
 * - C9: admin 可以删任意人
 * - C10: list 区间过滤 + desc 排序 + range 出参
 * - C11: list 默认本月（不传区间）
 * - C12: getByDate 不存在 → 404
 * - C13: update 含 aiSummary 时 aiSummaryAt 自动置 null（"已人工修改"）
 * - C14: caption trim + 空串落 null
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { dailyCheckinService } from '../../src/services/daily-checkin.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers, createBaby } from '../helpers/factories';

let admin: { id: string };
let editor: { id: string };
let viewer: { id: string };
let familyId: string;
let babyId: string;

// 固定"今天"= 2026-05-15，便于断言 7d 窗口
const NOW = new Date(2026, 4, 15, 10, 30, 0);

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

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
  // 出生于 2024-01-01，避免与 2026-05 区间冲突
  const baby = await createBaby(family.id, 'Cici');
  babyId = baby.id;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DailyCheckinService', () => {
  describe('create', () => {
    it('C1: admin 创建 + 字段完整入库', async () => {
      const result = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/2026-05-15-abc.jpg',
        photoWidth: 1080,
        photoHeight: 1440,
        caption: '今天好天气',
      });

      expect(result.id).toBeDefined();
      expect(result.babyId).toBe(babyId);
      expect(result.familyId).toBe(familyId);
      expect(result.checkinDate).toBe('2026-05-15');
      expect(result.photoKey).toBe('checkins/f/b/2026-05-15-abc.jpg');
      expect(result.photoWidth).toBe(1080);
      expect(result.photoHeight).toBe(1440);
      expect(result.caption).toBe('今天好天气');
      expect(result.aiSummary).toBeNull();
      expect(result.aiSummaryAt).toBeNull();
      expect(result.createdBy).toBe(admin.id);
    });

    it('C2: 跨家庭隔离 — 其他家庭 admin 无法 create', async () => {
      const otherUser = await createUser({ nickname: 'Outsider' });
      await createFamilyWithMembers({ creator: otherUser });

      await expect(
        dailyCheckinService.create(otherUser.id, babyId, {
          checkinDate: '2026-05-15',
          photoKey: 'checkins/f/b/x.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('C3: viewer 不能创建', async () => {
      await expect(
        dailyCheckinService.create(viewer.id, babyId, {
          checkinDate: '2026-05-15',
          photoKey: 'checkins/f/b/x.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'PERMISSION_DENIED' });
    });

    it('C4a: 今天 OK', async () => {
      const r = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/x.jpg',
      });
      expect(r.checkinDate).toBe('2026-05-15');
    });

    it('C4b: 7 天前 OK（窗口边界）', async () => {
      const r = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-08',
        photoKey: 'checkins/f/b/x.jpg',
      });
      expect(r.checkinDate).toBe('2026-05-08');
    });

    it('C4c: 8 天前拒绝（CHECKIN_WINDOW_EXPIRED）', async () => {
      await expect(
        dailyCheckinService.create(admin.id, babyId, {
          checkinDate: '2026-05-07',
          photoKey: 'checkins/f/b/x.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'CHECKIN_WINDOW_EXPIRED' });
    });

    it('C4d: 未来日期拒绝', async () => {
      await expect(
        dailyCheckinService.create(admin.id, babyId, {
          checkinDate: '2026-05-16',
          photoKey: 'checkins/f/b/x.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'CHECKIN_WINDOW_EXPIRED' });
    });

    it('C5: 早于宝宝出生日拒绝', async () => {
      // baby.birthDate = 2024-01-01，先把"今天"设为 2024-01-03 才能落入 7d 窗口
      vi.setSystemTime(new Date(2024, 0, 3, 12, 0));

      // 7d 窗口允许 2023-12-27，但早于 birthDate（2024-01-01）→ 拒绝
      await expect(
        dailyCheckinService.create(admin.id, babyId, {
          checkinDate: '2023-12-27',
          photoKey: 'checkins/f/b/x.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'CHECKIN_DATE_INVALID' });

      vi.setSystemTime(NOW);
    });

    it('C6: 同一 (babyId, date) 重复创建 → 409 CHECKIN_DUPLICATE', async () => {
      await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/2026-05-15-1.jpg',
      });

      await expect(
        dailyCheckinService.create(admin.id, babyId, {
          checkinDate: '2026-05-15',
          photoKey: 'checkins/f/b/2026-05-15-2.jpg',
        }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CHECKIN_DUPLICATE' });
    });

    it('C14: caption trim + 空串落 null', async () => {
      const r = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/x.jpg',
        caption: '   ',
      });
      expect(r.caption).toBeNull();
    });
  });

  describe('update / delete 权限矩阵', () => {
    it('C7: editor 仅能改自己；改别人 → 403', async () => {
      const adminCheckin = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-14',
        photoKey: 'checkins/f/b/2026-05-14-a.jpg',
      });
      const editorCheckin = await dailyCheckinService.create(editor.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/2026-05-15-e.jpg',
      });

      // editor 改自己 → ok
      const updated = await dailyCheckinService.update(
        editor.id,
        babyId,
        editorCheckin.checkinDate,
        { caption: '我的小记' },
      );
      expect(updated.caption).toBe('我的小记');

      // editor 改 admin 的 → 403
      await expect(
        dailyCheckinService.update(editor.id, babyId, adminCheckin.checkinDate, {
          caption: '不允许',
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('C8: editor 仅能删自己；删别人 → 403', async () => {
      const adminCheckin = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-14',
        photoKey: 'checkins/f/b/2026-05-14-a.jpg',
      });
      const editorCheckin = await dailyCheckinService.create(editor.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/2026-05-15-e.jpg',
      });

      await dailyCheckinService.remove(editor.id, babyId, editorCheckin.checkinDate);
      await expect(
        dailyCheckinService.remove(editor.id, babyId, adminCheckin.checkinDate),
      ).rejects.toMatchObject({ statusCode: 403 });

      const left = await prisma.dailyCheckin.findMany({ where: { babyId } });
      expect(left).toHaveLength(1);
      expect(left[0].id).toBe(adminCheckin.id);
    });

    it('C9: admin 可以删任意人的打卡', async () => {
      const editorCheckin = await dailyCheckinService.create(editor.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/2026-05-15-e.jpg',
      });
      await dailyCheckinService.remove(admin.id, babyId, editorCheckin.checkinDate);
      const left = await prisma.dailyCheckin.findMany({ where: { babyId } });
      expect(left).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('C10: 区间过滤 + desc + range 出参', async () => {
      await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-13',
        photoKey: 'checkins/f/b/13.jpg',
      });
      const r2 = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-14',
        photoKey: 'checkins/f/b/14.jpg',
      });
      const r3 = await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/15.jpg',
      });

      const res = await dailyCheckinService.list(admin.id, babyId, {
        startDate: '2026-05-14',
        endDate: '2026-05-15',
      });

      expect(res.items).toHaveLength(2);
      expect(res.items[0].id).toBe(r3.id); // desc
      expect(res.items[1].id).toBe(r2.id);
      expect(res.range).toEqual({ startDate: '2026-05-14', endDate: '2026-05-15' });
    });

    it('C11: 不传区间默认本月', async () => {
      await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: '2026-05-15',
        photoKey: 'checkins/f/b/x.jpg',
      });
      const res = await dailyCheckinService.list(admin.id, babyId, {});
      expect(res.range.startDate).toBe('2026-05-01');
      expect(res.range.endDate).toBe('2026-05-31');
      expect(res.items).toHaveLength(1);
    });
  });

  describe('getByDate', () => {
    it('C12: 不存在 → 404 CHECKIN_NOT_FOUND', async () => {
      await expect(
        dailyCheckinService.getByDate(admin.id, babyId, '2026-05-15'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CHECKIN_NOT_FOUND' });
    });
  });

  describe('update aiSummary 语义', () => {
    it('C13: 入参带 aiSummary 时 aiSummaryAt 自动置 null', async () => {
      // 先建一条带 aiSummary + aiSummaryAt 的记录（直接走 prisma 模拟 AI 已生成）
      const baseDate = '2026-05-15';
      await dailyCheckinService.create(admin.id, babyId, {
        checkinDate: baseDate,
        photoKey: 'checkins/f/b/x.jpg',
      });
      await prisma.dailyCheckin.update({
        where: { babyId_checkinDate: { babyId, checkinDate: baseDate } },
        data: { aiSummary: 'AI 写的', aiSummaryAt: new Date() },
      });

      const updated = await dailyCheckinService.update(admin.id, babyId, baseDate, {
        aiSummary: '我手动修改的',
      });

      expect(updated.aiSummary).toBe('我手动修改的');
      expect(updated.aiSummaryAt).toBeNull();
    });
  });
});
