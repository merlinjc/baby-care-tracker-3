import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser } from '../utils/permission';

class ExportService {
  async exportData(userId: string, query: {
    babyId: string;
    format: 'csv' | 'json';
    recordType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const baby = await prisma.baby.findUnique({ where: { id: query.babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    const where: any = {
      babyId: query.babyId,
      familyId: baby.familyId,
      ...(query.recordType && { recordType: query.recordType }),
      ...(query.startDate && { startTime: { gte: new Date(query.startDate) } }),
      ...(query.endDate && { startTime: { lte: new Date(query.endDate) } }),
    };

    const records = await prisma.record.findMany({
      where,
      include: {
        feedingData: true,
        sleepData: true,
        diaperData: true,
        temperatureData: true,
        growthData: true,
        creator: { select: { id: true, nickname: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const formattedRecords = records.map((r) => ({
      id: r.id,
      recordType: r.recordType,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime?.toISOString() ?? null,
      note: r.note,
      createdBy: r.creator?.nickname ?? 'unknown',
      feedingData: r.feedingData,
      sleepData: r.sleepData,
      diaperData: r.diaperData,
      temperatureData: r.temperatureData,
      growthData: r.growthData,
    }));

    if (query.format === 'csv') {
      const csv = this.toCSV(formattedRecords);
      return { data: csv, format: 'csv' as const };
    }

    return { data: formattedRecords, format: 'json' as const };
  }

  private toCSV(records: any[]): string {
    if (records.length === 0) return '';

    const headers = [
      'id', 'recordType', 'startTime', 'endTime', 'note', 'createdBy',
      'feedingType', 'amount', 'duration', 'breastSide',
      'sleepType', 'sleepDuration', 'location',
      'diaperType', 'consistency', 'color',
      'temperature', 'method',
      'height', 'weight', 'headCircumference',
    ];

    const rows = records.map((r) => {
      const base = [
        r.id, r.recordType, r.startTime, r.endTime ?? '', r.note ?? '', r.createdBy,
      ];
      const feeding = r.feedingData
        ? [r.feedingData.feedingType, r.feedingData.amount ?? '', r.feedingData.duration ?? '', r.feedingData.breastSide ?? '']
        : ['', '', '', ''];
      const sleep = r.sleepData
        ? [r.sleepData.sleepType, r.sleepData.duration, r.sleepData.location ?? '']
        : ['', '', ''];
      const diaper = r.diaperData
        ? [r.diaperData.diaperType, r.diaperData.consistency ?? '', r.diaperData.color ?? '']
        : ['', '', ''];
      const temp = r.temperatureData
        ? [r.temperatureData.temperature, r.temperatureData.method ?? '']
        : ['', ''];
      const growth = r.growthData
        ? [r.growthData.height ?? '', r.growthData.weight ?? '', r.growthData.headCircumference ?? '']
        : ['', '', ''];

      return [...base, ...feeding, ...sleep, ...diaper, ...temp, ...growth]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const exportService = new ExportService();
