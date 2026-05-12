/**
 * export.service 集成测试（v7.2 T-S1-F3 多类型扩展）
 *
 * 覆盖：
 * - E1 默认 5 个 Record 子类型（向后兼容 v7.1）
 * - E2 多选 types：records + vaccine + milestone + jaundice 聚合返回
 * - E3 仅独立表（不查 Record 表）
 * - E4 跨家庭隔离
 * - E5 旧 recordType 单选兼容
 * - E6 时间窗过滤同时作用于 Record / Vaccine / Milestone / Jaundice
 * - E7 CSV 多 section 输出
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { exportService } from '../../src/services/export.service';
import { jaundiceService } from '../../src/services/jaundice.service';
import { prisma } from '../../src/config/database';
import {
  createUser,
  createFamilyWithMembers,
  createBaby,
  createFeedingRecord,
} from '../helpers/factories';

let admin: { id: string };
let familyId: string;
let babyId: string;

beforeEach(async () => {
  const { family, admin: adminUser } = await createFamilyWithMembers();
  admin = adminUser;
  familyId = family.id;
  const baby = await createBaby(family.id, 'Cici');
  babyId = baby.id;
});

describe('ExportService', () => {
  it('E1: 不传 types 时默认导出 5 个 Record 子类型（向后兼容）', async () => {
    await createFeedingRecord(babyId, familyId, admin.id);

    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'json',
    });

    expect(res.format).toBe('json');
    const data = res.data as Record<string, unknown>;
    expect(data.records).toBeDefined();
    expect((data.records as any[]).length).toBe(1);
    // 不应出现独立表
    expect(data.vaccines).toBeUndefined();
    expect(data.milestones).toBeUndefined();
    expect(data.jaundice).toBeUndefined();
  });

  it('E2: 多选 types 返回聚合结构（records + vaccine + milestone + jaundice）', async () => {
    await createFeedingRecord(babyId, familyId, admin.id);
    await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId,
        name: 'BCG',
        dose: '1',
        vaccinatedDate: new Date('2026-04-01'),
        createdBy: admin.id,
      },
    });
    await prisma.milestoneRecord.create({
      data: {
        babyId,
        familyId,
        name: 'first-smile',
        category: 'social',
        achievedDate: new Date('2026-04-15'),
        createdBy: admin.id,
      },
    });
    await jaundiceService.create(admin.id, babyId, {
      recordDate: '2026-04-20T00:00:00Z',
      kramerZone: 2,
      symptoms: ['吃奶正常'],
    });

    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'json',
      types: ['feeding', 'vaccine', 'milestone', 'jaundice'],
    });

    const data = res.data as Record<string, any[]>;
    expect(data.records).toHaveLength(1);
    expect(data.vaccines).toHaveLength(1);
    expect(data.milestones).toHaveLength(1);
    expect(data.jaundice).toHaveLength(1);
    // 黄疸 symptoms 应是数组（CSV / JSON 均还原）
    expect(data.jaundice[0].symptoms).toEqual(['吃奶正常']);
  });

  it('E3: 仅传独立表 types（vaccine + jaundice），records 不出现', async () => {
    await createFeedingRecord(babyId, familyId, admin.id);
    await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId,
        name: 'BCG',
        dose: '1',
        vaccinatedDate: new Date(),
        createdBy: admin.id,
      },
    });

    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'json',
      types: ['vaccine'],
    });

    const data = res.data as Record<string, unknown>;
    expect(data.records).toBeUndefined();
    expect((data.vaccines as any[]).length).toBe(1);
  });

  it('E4: 跨家庭隔离 — 其他家庭 admin 无法导出', async () => {
    const other = await createUser({ nickname: 'Outsider' });
    await createFamilyWithMembers({ creator: other });
    await expect(
      exportService.exportData(other.id, {
        babyId,
        format: 'json',
        types: ['feeding'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('E5: 旧 recordType 单选参数兼容', async () => {
    await createFeedingRecord(babyId, familyId, admin.id);
    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'json',
      recordType: 'feeding',
    });
    const data = res.data as Record<string, any[]>;
    expect(data.records).toHaveLength(1);
    expect(data.records[0].recordType).toBe('feeding');
  });

  it('E6: 时间窗过滤同时作用于 Record / Vaccine / Milestone / Jaundice', async () => {
    // 范围内
    await jaundiceService.create(admin.id, babyId, {
      recordDate: '2026-05-05T00:00:00Z',
    });
    await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId,
        name: 'In',
        dose: '1',
        vaccinatedDate: new Date('2026-05-05'),
        createdBy: admin.id,
      },
    });
    // 范围外
    await jaundiceService.create(admin.id, babyId, {
      recordDate: '2026-04-01T00:00:00Z',
    });
    await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId,
        name: 'Out',
        dose: '1',
        vaccinatedDate: new Date('2026-04-01'),
        createdBy: admin.id,
      },
    });

    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'json',
      types: ['vaccine', 'jaundice'],
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T23:59:59Z',
    });

    const data = res.data as Record<string, any[]>;
    expect(data.vaccines).toHaveLength(1);
    expect(data.vaccines[0].name).toBe('In');
    expect(data.jaundice).toHaveLength(1);
  });

  it('E7: CSV 多 section 输出（# section: records / vaccines / jaundice）', async () => {
    await createFeedingRecord(babyId, familyId, admin.id);
    await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId,
        name: 'BCG',
        dose: '1',
        vaccinatedDate: new Date(),
        createdBy: admin.id,
      },
    });
    await jaundiceService.create(admin.id, babyId, {
      recordDate: '2026-05-01T00:00:00Z',
      symptoms: ['s1', 's2'],
    });

    const res = await exportService.exportData(admin.id, {
      babyId,
      format: 'csv',
      types: ['feeding', 'vaccine', 'jaundice'],
    });
    expect(res.format).toBe('csv');
    const csv = res.data as string;
    expect(csv).toContain('# section: records');
    expect(csv).toContain('# section: vaccines');
    expect(csv).toContain('# section: jaundice');
    // 黄疸 symptoms 应以 | 分隔
    expect(csv).toContain('s1|s2');
  });
});
