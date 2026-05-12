/**
 * export.service - 数据导出服务（v7.2 T-S1-F3 扩展为多类型）
 *
 * v7.1 之前：仅导出 Record 表（feeding/sleep/diaper/temperature/growth），单选 recordType。
 * v7.2+：支持多选 types（含 vaccine/milestone/jaundice），输出聚合结构。
 *
 * 输出形态：
 * - JSON：`{ records: [...], vaccines: [...], milestones: [...], jaundice: [...] }`
 *   只包含被选中的部分；types 未选的字段不出现，避免误用。
 * - CSV：5 个 Record 子类型仍走原矩阵列；独立表如 vaccine/milestone/jaundice
 *   各自一段 CSV，section 之间用空行 + `# section: <type>` 分隔。
 */
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser } from '../utils/permission';
import type { ExportDataType } from '../schemas/common.schema';

/** Record 子类型集合（用于决定是否查 Record 表） */
const RECORD_SUB_TYPES = new Set<ExportDataType>([
  'feeding',
  'sleep',
  'diaper',
  'temperature',
  'growth',
]);

class ExportService {
  async exportData(
    userId: string,
    query: {
      babyId: string;
      format: 'csv' | 'json';
      /** v7.2+ 多选；与 recordType 互斥（types 优先） */
      types?: ExportDataType[];
      /** @deprecated v7.2+ 改用 types */
      recordType?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const baby = await prisma.baby.findUnique({ where: { id: query.babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    // 决定要导哪些类型
    let selected: Set<ExportDataType>;
    if (query.types && query.types.length > 0) {
      selected = new Set(query.types);
    } else if (query.recordType) {
      // 兼容旧前端：仅导出该单一 Record 子类型
      selected = new Set<ExportDataType>([query.recordType as ExportDataType]);
    } else {
      // 默认 5 个 Record 子类型（保持 v7.1 行为）
      selected = new Set<ExportDataType>([
        'feeding',
        'sleep',
        'diaper',
        'temperature',
        'growth',
      ]);
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    // 1) Record 表：只要 selected 命中任一子类型就查
    const recordSubTypes = Array.from(selected).filter((t) =>
      RECORD_SUB_TYPES.has(t),
    );
    let records: any[] = [];
    if (recordSubTypes.length > 0) {
      const where: any = {
        babyId: query.babyId,
        familyId: baby.familyId,
        recordType: { in: recordSubTypes },
        ...((startDate || endDate) && {
          startTime: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      };
      const rows = await prisma.record.findMany({
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
      records = rows.map((r) => ({
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
    }

    // 2) Vaccine 表
    let vaccines: any[] = [];
    if (selected.has('vaccine')) {
      const vWhere: any = {
        babyId: query.babyId,
        familyId: baby.familyId,
        ...((startDate || endDate) && {
          vaccinatedDate: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      };
      const rows = await prisma.vaccineRecord.findMany({
        where: vWhere,
        orderBy: { vaccinatedDate: 'asc' },
      });
      vaccines = rows.map((r) => ({
        id: r.id,
        name: r.name,
        dose: r.dose,
        vaccinatedDate: r.vaccinatedDate.toISOString(),
        note: r.note,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      }));
    }

    // 3) Milestone 表
    let milestones: any[] = [];
    if (selected.has('milestone')) {
      const mWhere: any = {
        babyId: query.babyId,
        familyId: baby.familyId,
        ...((startDate || endDate) && {
          achievedDate: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      };
      const rows = await prisma.milestoneRecord.findMany({
        where: mWhere,
        orderBy: { achievedDate: 'asc' },
      });
      milestones = rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        achievedDate: r.achievedDate.toISOString(),
        note: r.note,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      }));
    }

    // 4) Jaundice 表（v7.2 F3-3）
    let jaundice: any[] = [];
    if (selected.has('jaundice')) {
      const jWhere: any = {
        babyId: query.babyId,
        familyId: baby.familyId,
        ...((startDate || endDate) && {
          recordDate: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      };
      const rows = await prisma.jaundiceRecord.findMany({
        where: jWhere,
        orderBy: { recordDate: 'asc' },
      });
      jaundice = rows.map((r) => ({
        id: r.id,
        recordDate: r.recordDate.toISOString(),
        dayAge: r.dayAge,
        kramerZone: r.kramerZone,
        scleralIcterus: r.scleralIcterus,
        tcb: r.tcb,
        tsb: r.tsb,
        category: r.category,
        // 库内是 JSON 字符串，CSV / JSON 出参都还原数组
        symptoms: parseJsonArray(r.symptoms),
        treatments: parseJsonArray(r.treatments),
        note: r.note,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      }));
    }

    // —— 组装出参 ——
    if (query.format === 'csv') {
      const sections: string[] = [];
      if (recordSubTypes.length > 0) {
        sections.push('# section: records');
        sections.push(this.recordsToCSV(records));
      }
      if (selected.has('vaccine')) {
        if (sections.length > 0) sections.push('');
        sections.push('# section: vaccines');
        sections.push(this.vaccinesToCSV(vaccines));
      }
      if (selected.has('milestone')) {
        if (sections.length > 0) sections.push('');
        sections.push('# section: milestones');
        sections.push(this.milestonesToCSV(milestones));
      }
      if (selected.has('jaundice')) {
        if (sections.length > 0) sections.push('');
        sections.push('# section: jaundice');
        sections.push(this.jaundiceToCSV(jaundice));
      }
      return { data: sections.join('\n'), format: 'csv' as const };
    }

    // JSON 形态：只挂出被选中的字段
    const data: Record<string, unknown> = {};
    if (recordSubTypes.length > 0) data.records = records;
    if (selected.has('vaccine')) data.vaccines = vaccines;
    if (selected.has('milestone')) data.milestones = milestones;
    if (selected.has('jaundice')) data.jaundice = jaundice;

    return { data, format: 'json' as const };
  }

  // ============ CSV 生成 ============

  private recordsToCSV(records: any[]): string {
    if (records.length === 0) return '';
    const headers = [
      'id',
      'recordType',
      'startTime',
      'endTime',
      'note',
      'createdBy',
      'feedingType',
      'amount',
      'duration',
      'breastSide',
      'sleepType',
      'sleepDuration',
      'location',
      'diaperType',
      'consistency',
      'color',
      'temperature',
      'method',
      'height',
      'weight',
      'headCircumference',
    ];
    const rows = records.map((r) => {
      const base = [
        r.id,
        r.recordType,
        r.startTime,
        r.endTime ?? '',
        r.note ?? '',
        r.createdBy,
      ];
      const feeding = r.feedingData
        ? [
            r.feedingData.feedingType,
            r.feedingData.amount ?? '',
            r.feedingData.duration ?? '',
            r.feedingData.breastSide ?? '',
          ]
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
        ? [
            r.growthData.height ?? '',
            r.growthData.weight ?? '',
            r.growthData.headCircumference ?? '',
          ]
        : ['', '', ''];
      return [...base, ...feeding, ...sleep, ...diaper, ...temp, ...growth]
        .map(csvCell)
        .join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  private vaccinesToCSV(rows: any[]): string {
    if (rows.length === 0) return '';
    const headers = ['id', 'name', 'dose', 'vaccinatedDate', 'note', 'createdBy', 'createdAt'];
    const body = rows.map((r) =>
      headers.map((h) => csvCell(r[h] ?? '')).join(','),
    );
    return [headers.join(','), ...body].join('\n');
  }

  private milestonesToCSV(rows: any[]): string {
    if (rows.length === 0) return '';
    const headers = [
      'id',
      'name',
      'category',
      'achievedDate',
      'note',
      'createdBy',
      'createdAt',
    ];
    const body = rows.map((r) =>
      headers.map((h) => csvCell(r[h] ?? '')).join(','),
    );
    return [headers.join(','), ...body].join('\n');
  }

  private jaundiceToCSV(rows: any[]): string {
    if (rows.length === 0) return '';
    const headers = [
      'id',
      'recordDate',
      'dayAge',
      'kramerZone',
      'scleralIcterus',
      'tcb',
      'tsb',
      'category',
      'symptoms',
      'treatments',
      'note',
      'createdBy',
      'createdAt',
    ];
    const body = rows.map((r) => {
      return headers
        .map((h) => {
          const v = (r as any)[h];
          if (Array.isArray(v)) return csvCell(v.join('|'));
          return csvCell(v ?? '');
        })
        .join(',');
    });
    return [headers.join(','), ...body].join('\n');
  }
}

/** 单个 CSV 单元格转义 */
function csvCell(v: unknown): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

/** 解析 JSON 字符串数组，失败返回 [] */
function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const exportService = new ExportService();
