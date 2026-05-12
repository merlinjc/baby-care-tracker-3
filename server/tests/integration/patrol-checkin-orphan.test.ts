/**
 * patrol.dailyCheckinOrphanCleanup 集成测试（v7.2 T-S2-F11-BE-04）
 *
 * 测试范围：
 * 1) 30 天阈值：< 30 天的对象不参与判定（即使无 DB 记录也保留）
 * 2) DB 反查：≥ 30 天 + 在 DB 中被引用 → 保留
 * 3) 真孤儿（≥ 30 天 + DB 无引用）：dryRun=true 仅统计；dryRun=false 实际删
 *
 * 通过 vi.spyOn 替换 uploadService.listObjectsByPrefix / deleteObjects，
 * 不真的调 COS。锁表 / OperationLog 走真实 prisma。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runDailyCheckinOrphanCleanup } from '../../src/utils/patrol';
import { uploadService } from '../../src/services/upload.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers, createBaby } from '../helpers/factories';

const NOW = new Date(2026, 4, 15, 4, 0, 0); // 周日 04:00 本地时间
const ONE_DAY = 24 * 60 * 60 * 1000;

let familyId: string;
let babyId: string;
let createdBy: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  const { family, admin } = await createFamilyWithMembers();
  familyId = family.id;
  createdBy = admin.id;
  const baby = await createBaby(family.id, '小满');
  babyId = baby.id;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.PATROL_DRY_RUN;
});

async function seedCheckin(photoKey: string, date: string) {
  return prisma.dailyCheckin.create({
    data: {
      babyId,
      familyId,
      checkinDate: date,
      photoKey,
      createdBy,
    },
  });
}

describe('runDailyCheckinOrphanCleanup', () => {
  it('< 30 天的对象不参与判定（即使 DB 无引用）', async () => {
    process.env.PATROL_DRY_RUN = 'false';
    const recentTs = new Date(NOW.getTime() - 5 * ONE_DAY).toISOString();
    vi.spyOn(uploadService, 'listObjectsByPrefix').mockResolvedValue({
      items: [
        { key: 'checkins/f/b/2026-05-10-x.jpg', size: 1024, lastModified: recentTs },
      ],
      isTruncated: false,
    });
    const deleteSpy = vi.spyOn(uploadService, 'deleteObjects');

    const stats = await runDailyCheckinOrphanCleanup();
    expect(stats.scanned).toBe(1);
    expect(stats.orphaned).toBe(0);
    expect(stats.deleted).toBe(0);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('≥ 30 天 + DB 中有引用 → 保留', async () => {
    process.env.PATROL_DRY_RUN = 'false';
    await seedCheckin('checkins/f/b/2026-04-10-keep.jpg', '2026-04-10');

    const oldTs = new Date(NOW.getTime() - 35 * ONE_DAY).toISOString();
    vi.spyOn(uploadService, 'listObjectsByPrefix').mockResolvedValue({
      items: [
        { key: 'checkins/f/b/2026-04-10-keep.jpg', size: 1024, lastModified: oldTs },
      ],
      isTruncated: false,
    });
    const deleteSpy = vi.spyOn(uploadService, 'deleteObjects').mockResolvedValue({
      deleted: [],
      failed: [],
    });

    const stats = await runDailyCheckinOrphanCleanup();
    expect(stats.scanned).toBe(1);
    expect(stats.orphaned).toBe(0);
    expect(stats.deleted).toBe(0);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('真孤儿 dryRun=true 仅统计不删', async () => {
    process.env.PATROL_DRY_RUN = 'true';
    const oldTs = new Date(NOW.getTime() - 40 * ONE_DAY).toISOString();
    vi.spyOn(uploadService, 'listObjectsByPrefix').mockResolvedValue({
      items: [
        { key: 'checkins/f/b/orphan.jpg', size: 1024, lastModified: oldTs },
      ],
      isTruncated: false,
    });
    const deleteSpy = vi.spyOn(uploadService, 'deleteObjects');

    const stats = await runDailyCheckinOrphanCleanup();
    expect(stats.scanned).toBe(1);
    expect(stats.orphaned).toBe(1);
    expect(stats.deleted).toBe(0);
    expect(stats.dryRun).toBe(true);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('真孤儿 dryRun=false 调用 deleteObjects 实际删', async () => {
    process.env.PATROL_DRY_RUN = 'false';
    const oldTs = new Date(NOW.getTime() - 40 * ONE_DAY).toISOString();
    vi.spyOn(uploadService, 'listObjectsByPrefix').mockResolvedValue({
      items: [
        { key: 'checkins/f/b/orphan-1.jpg', size: 1024, lastModified: oldTs },
        { key: 'checkins/f/b/orphan-2.jpg', size: 1024, lastModified: oldTs },
      ],
      isTruncated: false,
    });
    const deleteSpy = vi.spyOn(uploadService, 'deleteObjects').mockResolvedValue({
      deleted: ['checkins/f/b/orphan-1.jpg', 'checkins/f/b/orphan-2.jpg'],
      failed: [],
    });

    const stats = await runDailyCheckinOrphanCleanup();
    expect(stats.scanned).toBe(2);
    expect(stats.orphaned).toBe(2);
    expect(stats.deleted).toBe(2);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith([
      'checkins/f/b/orphan-1.jpg',
      'checkins/f/b/orphan-2.jpg',
    ]);
  });

  it('混合场景：保留有引用 + 删孤儿', async () => {
    process.env.PATROL_DRY_RUN = 'false';
    await seedCheckin('checkins/f/b/keep.jpg', '2026-04-10');

    const oldTs = new Date(NOW.getTime() - 40 * ONE_DAY).toISOString();
    const recentTs = new Date(NOW.getTime() - 5 * ONE_DAY).toISOString();
    vi.spyOn(uploadService, 'listObjectsByPrefix').mockResolvedValue({
      items: [
        { key: 'checkins/f/b/keep.jpg', size: 1024, lastModified: oldTs }, // 有引用
        { key: 'checkins/f/b/orphan.jpg', size: 1024, lastModified: oldTs }, // 真孤儿
        { key: 'checkins/f/b/recent.jpg', size: 1024, lastModified: recentTs }, // 不到 30 天
      ],
      isTruncated: false,
    });
    const deleteSpy = vi.spyOn(uploadService, 'deleteObjects').mockResolvedValue({
      deleted: ['checkins/f/b/orphan.jpg'],
      failed: [],
    });

    const stats = await runDailyCheckinOrphanCleanup();
    expect(stats.scanned).toBe(3);
    expect(stats.orphaned).toBe(1);
    expect(stats.deleted).toBe(1);
    expect(deleteSpy).toHaveBeenCalledWith(['checkins/f/b/orphan.jpg']);
  });

  it('分页：truncated=true 时持续翻页直到拉完', async () => {
    process.env.PATROL_DRY_RUN = 'false';
    const oldTs = new Date(NOW.getTime() - 40 * ONE_DAY).toISOString();
    const listSpy = vi
      .spyOn(uploadService, 'listObjectsByPrefix')
      .mockResolvedValueOnce({
        items: [{ key: 'checkins/p1.jpg', size: 1, lastModified: oldTs }],
        isTruncated: true,
        nextMarker: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [{ key: 'checkins/p2.jpg', size: 1, lastModified: oldTs }],
        isTruncated: false,
      });
    vi.spyOn(uploadService, 'deleteObjects').mockResolvedValue({
      deleted: ['checkins/p1.jpg', 'checkins/p2.jpg'],
      failed: [],
    });

    const stats = await runDailyCheckinOrphanCleanup();
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(stats.scanned).toBe(2);
    expect(stats.orphaned).toBe(2);
  });
});
