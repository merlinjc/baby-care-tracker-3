import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ConflictError, ErrorCodes } from '../types/errors';
import { hasPermission, getFamilyIdForUser, getUserFamilyRole } from '../utils/permission';
import { startOfDay, endOfDay } from '../utils/date';
import { Permission } from '../utils/permission';

class RecordService {
  async createRecord(userId: string, data: {
    babyId: string;
    recordType: string;
    startTime: string;
    endTime?: string | null;
    note?: string | null;
    feedingData?: { feedingType: string; amount?: number | null; duration?: number | null; breastSide?: string | null };
    sleepData?: { sleepType: string; duration: number; location?: string | null };
    diaperData?: { diaperType: string; consistency?: string | null; color?: string | null };
    temperatureData?: { temperature: number; method?: string | null };
    growthData?: { height?: number | null; weight?: number | null; headCircumference?: number | null };
  }) {
    // Get baby and verify access
    const baby = await prisma.baby.findUnique({ where: { id: data.babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问该宝宝数据', ErrorCodes.PERMISSION_DENIED);
    }

    // Check permission
    const role = await getUserFamilyRole(userId);
    if (!role || !hasPermission(role, Permission.RECORD_CREATE)) {
      throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
    }

    // FR-A1：进行中睡眠并发校验（同一 baby 不能同时存在两条 endTime=null 的 sleep）
    if (data.recordType === 'sleep' && !data.endTime) {
      const ongoing = await prisma.record.findFirst({
        where: {
          babyId: data.babyId,
          recordType: 'sleep',
          endTime: null,
        },
      });
      if (ongoing) {
        throw new ConflictError(
          '已有进行中的睡眠记录，请先结束当前计时',
          ErrorCodes.SLEEP_ALREADY_ACTIVE
        );
      }
    }

    // Create record with sub-table data in transaction
    const record = await prisma.record.create({
      data: {
        babyId: data.babyId,
        familyId: baby.familyId,
        recordType: data.recordType,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        note: data.note || null,
        createdBy: userId,
        ...(data.recordType === 'feeding' && data.feedingData && {
          feedingData: { create: data.feedingData },
        }),
        ...(data.recordType === 'sleep' && data.sleepData && {
          sleepData: { create: data.sleepData },
        }),
        ...(data.recordType === 'diaper' && data.diaperData && {
          diaperData: { create: data.diaperData },
        }),
        ...(data.recordType === 'temperature' && data.temperatureData && {
          temperatureData: { create: data.temperatureData },
        }),
        ...(data.recordType === 'growth' && data.growthData && {
          growthData: { create: data.growthData },
        }),
      },
      include: this.getSubDataInclude(),
    });

    return this.formatRecord(record);
  }

  async getRecords(userId: string, query: {
    babyId: string;
    recordType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    orderBy?: string;
    order?: string;
    /** FR-A1：'true' 仅查 endTime=null 的记录（进行中），'false' 仅查 endTime!=null（已结束） */
    endTimeIsNull?: 'true' | 'false';
  }) {
    const {
      babyId,
      recordType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      orderBy = 'startTime',
      order = 'desc',
      endTimeIsNull,
    } = query;

    // Verify access
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问该宝宝数据', ErrorCodes.PERMISSION_DENIED);
    }

    // Build where clause
    // FR-A1：endTimeIsNull 与日期范围互斥（仅"进行中"语义）
    const where: Prisma.RecordWhereInput = {
      babyId,
      familyId: baby.familyId,
      ...(recordType && { recordType }),
      ...(endTimeIsNull === 'true' && { endTime: null }),
      ...(endTimeIsNull === 'false' && { endTime: { not: null } }),
      ...(!endTimeIsNull && startDate && { startTime: { gte: new Date(startDate) } }),
      ...(!endTimeIsNull && endDate && { startTime: { lte: new Date(endDate) } }),
    };

    // Validate orderBy field (whitelist)
    const allowedOrderBy = ['startTime', 'endTime', 'createdAt', 'updatedAt'];
    const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'startTime';
    const safeOrder = order === 'asc' ? 'asc' : 'desc';

    const [records, total] = await Promise.all([
      prisma.record.findMany({
        where,
        include: this.getSubDataInclude(),
        orderBy: { [safeOrderBy]: safeOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.record.count({ where }),
    ]);

    return {
      items: records.map(this.formatRecord),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getRecordById(userId: string, recordId: string) {
    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: this.getSubDataInclude(),
    });

    if (!record) {
      throw new NotFoundError('记录', ErrorCodes.RECORD_NOT_FOUND);
    }

    // Verify access
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || record.familyId !== familyId) {
      throw new ForbiddenError('无权访问该记录', ErrorCodes.PERMISSION_DENIED);
    }

    return this.formatRecord(record);
  }

  async updateRecord(userId: string, recordId: string, data: {
    startTime?: string;
    endTime?: string | null;
    note?: string | null;
    feedingData?: { feedingType: string; amount?: number | null; duration?: number | null; breastSide?: string | null };
    sleepData?: { sleepType: string; duration: number; location?: string | null };
    diaperData?: { diaperType: string; consistency?: string | null; color?: string | null };
    temperatureData?: { temperature: number; method?: string | null };
    growthData?: { height?: number | null; weight?: number | null; headCircumference?: number | null };
  }) {
    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: this.getSubDataInclude(),
    });

    if (!record) {
      throw new NotFoundError('记录', ErrorCodes.RECORD_NOT_FOUND);
    }

    // Verify access
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || record.familyId !== familyId) {
      throw new ForbiddenError('无权访问该记录', ErrorCodes.PERMISSION_DENIED);
    }

    // Check permission: own or any
    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();

    if (record.createdBy === userId) {
      if (!hasPermission(role, Permission.RECORD_UPDATE_OWN)) {
        throw new ForbiddenError('无权修改此记录', ErrorCodes.PERMISSION_DENIED);
      }
    } else {
      if (!hasPermission(role, Permission.RECORD_UPDATE_ANY)) {
        throw new ForbiddenError('无权修改他人记录', ErrorCodes.PERMISSION_DENIED);
      }
    }

    // Update record and sub-data in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update main record
      const updatedRecord = await tx.record.update({
        where: { id: recordId },
        data: {
          ...(data.startTime && { startTime: new Date(data.startTime) }),
          ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
          ...(data.note !== undefined && { note: data.note }),
        },
      });

      // Update sub-table data based on recordType
      if (record.recordType === 'feeding' && data.feedingData) {
        await tx.feedingRecord.update({
          where: { recordId },
          data: data.feedingData,
        });
      } else if (record.recordType === 'sleep' && data.sleepData) {
        await tx.sleepRecord.update({
          where: { recordId },
          data: data.sleepData,
        });
      } else if (record.recordType === 'diaper' && data.diaperData) {
        await tx.diaperRecord.update({
          where: { recordId },
          data: data.diaperData,
        });
      } else if (record.recordType === 'temperature' && data.temperatureData) {
        await tx.temperatureRecord.update({
          where: { recordId },
          data: data.temperatureData,
        });
      } else if (record.recordType === 'growth' && data.growthData) {
        await tx.growthRecord.update({
          where: { recordId },
          data: data.growthData,
        });
      }

      return tx.record.findUnique({
        where: { id: recordId },
        include: this.getSubDataInclude(),
      });
    });

    return this.formatRecord(updated!);
  }

  async deleteRecord(userId: string, recordId: string) {
    const record = await prisma.record.findUnique({ where: { id: recordId } });

    if (!record) {
      throw new NotFoundError('记录', ErrorCodes.RECORD_NOT_FOUND);
    }

    // Verify access
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || record.familyId !== familyId) {
      throw new ForbiddenError('无权访问该记录', ErrorCodes.PERMISSION_DENIED);
    }

    // Check permission
    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();

    if (record.createdBy === userId) {
      if (!hasPermission(role, Permission.RECORD_DELETE_OWN)) {
        throw new ForbiddenError('无权删除此记录', ErrorCodes.PERMISSION_DENIED);
      }
    } else {
      if (!hasPermission(role, Permission.RECORD_DELETE_ANY)) {
        throw new ForbiddenError('无权删除他人记录', ErrorCodes.PERMISSION_DENIED);
      }
    }

    // Cascade delete sub-table + main record
    await prisma.$transaction([
      prisma.feedingRecord.deleteMany({ where: { recordId } }),
      prisma.sleepRecord.deleteMany({ where: { recordId } }),
      prisma.diaperRecord.deleteMany({ where: { recordId } }),
      prisma.temperatureRecord.deleteMany({ where: { recordId } }),
      prisma.growthRecord.deleteMany({ where: { recordId } }),
      prisma.record.delete({ where: { id: recordId } }),
    ]);

    return { message: '记录已删除' };
  }

  async getTodayStats(userId: string, babyId: string) {
    // Verify access
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问该宝宝数据', ErrorCodes.PERMISSION_DENIED);
    }

    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    const whereBase = {
      babyId,
      familyId: baby.familyId,
      startTime: { gte: dayStart, lte: dayEnd },
    };

    // Feeding stats
    const feedingRecords = await prisma.record.findMany({
      where: { ...whereBase, recordType: 'feeding' },
      include: { feedingData: true },
      orderBy: { startTime: 'desc' },
    });

    // Sleep stats —— FR-A1 跨午夜：扩展为 startTime OR endTime 落在今日
    // 这样昨晚 23:00 开始、今晨 06:30 结束的睡眠也会被统计
    const sleepRecords = await prisma.record.findMany({
      where: {
        babyId,
        familyId: baby.familyId,
        recordType: 'sleep',
        OR: [
          { startTime: { gte: dayStart, lte: dayEnd } },
          { endTime: { gte: dayStart, lte: dayEnd } },
        ],
      },
      include: { sleepData: true },
      orderBy: { startTime: 'desc' },
    });

    // Diaper stats
    const diaperRecords = await prisma.record.findMany({
      where: { ...whereBase, recordType: 'diaper' },
      include: { diaperData: true },
      orderBy: { startTime: 'desc' },
    });

    // Temperature stats
    const tempRecords = await prisma.record.findMany({
      where: { ...whereBase, recordType: 'temperature' },
      include: { temperatureData: true },
      orderBy: { startTime: 'desc' },
    });

    const lastFeeding = feedingRecords[0];
    const lastSleepStart = sleepRecords[0];
    const lastSleepEnd = sleepRecords
      .filter((r) => r.endTime)
      .reduce<Date | null>((max, r) => {
        const t = r.endTime!;
        return !max || t.getTime() > max.getTime() ? t : max;
      }, null);
    const lastDiaper = diaperRecords[0];
    const lastTemp = tempRecords[0];

    return {
      feeding: {
        count: feedingRecords.length,
        totalAmount: feedingRecords.reduce((sum, r) => sum + (r.feedingData?.amount ?? 0), 0),
        lastTime: lastFeeding?.startTime?.toISOString() ?? null,
        lastTimeTs: lastFeeding?.startTime?.getTime() ?? null,
      },
      sleep: {
        count: sleepRecords.length,
        totalDuration: sleepRecords.reduce((sum, r) => sum + (r.sleepData?.duration ?? 0), 0),
        lastTime: lastSleepStart?.startTime?.toISOString() ?? null,
        lastTimeTs: lastSleepStart?.startTime?.getTime() ?? null,
        lastEndTime: lastSleepEnd?.toISOString() ?? null,
        lastEndTimeTs: lastSleepEnd?.getTime() ?? null,
      },
      diaper: {
        count: diaperRecords.length,
        peeCount: diaperRecords.filter((r) =>
          r.diaperData?.diaperType === 'pee' || r.diaperData?.diaperType === 'both'
        ).length,
        poopCount: diaperRecords.filter((r) =>
          r.diaperData?.diaperType === 'poop' || r.diaperData?.diaperType === 'both'
        ).length,
        lastTime: lastDiaper?.startTime?.toISOString() ?? null,
        lastTimeTs: lastDiaper?.startTime?.getTime() ?? null,
      },
      temperature: {
        count: tempRecords.length,
        // BREAKING（v4.4）：原 lastValue 重命名为 latestValue（详见 spec FR-A）
        latestValue: lastTemp?.temperatureData?.temperature ?? null,
        lastTime: lastTemp?.startTime?.toISOString() ?? null,
        lastTimeTs: lastTemp?.startTime?.getTime() ?? null,
      },
    };
  }

  // ============ Helpers ============

  private getSubDataInclude() {
    return {
      feedingData: true,
      sleepData: true,
      diaperData: true,
      temperatureData: true,
      growthData: true,
      creator: {
        select: { id: true, nickname: true, avatar: true },
      },
    };
  }

  private formatRecord(record: any) {
    const base = {
      id: record.id,
      babyId: record.babyId,
      familyId: record.familyId,
      recordType: record.recordType,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime?.toISOString() ?? null,
      note: record.note,
      createdBy: record.createdBy,
      creator: record.creator ? {
        id: record.creator.id,
        nickname: record.creator.nickname,
        avatar: record.creator.avatar,
      } : undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    if (record.feedingData) {
      return { ...base, feedingData: record.feedingData };
    }
    if (record.sleepData) {
      return { ...base, sleepData: record.sleepData };
    }
    if (record.diaperData) {
      return { ...base, diaperData: record.diaperData };
    }
    if (record.temperatureData) {
      return { ...base, temperatureData: record.temperatureData };
    }
    if (record.growthData) {
      return { ...base, growthData: record.growthData };
    }

    return base;
  }
}

export const recordService = new RecordService();
