import { prisma } from '../config/database';
import {
  ForbiddenError,
  NotFoundError,
  ErrorCodes,
} from '../types/errors';
import {
  isAdmin,
  isFamilyMember,
  getFamilyIdForUser,
  getUserFamilyRole,
} from '../utils/permission';
import { OperationLogger } from '../utils/operation-logger';

const BATCH_SIZE = 500; // FR-E5: 单批最多 500 条
const SOFT_TIMEOUT_MS = 10 * 1000; // 10s 软上限触发 in_progress 续传

class BabyService {
  async createBaby(userId: string, data: {
    familyId: string;
    name: string;
    gender: string;
    birthDate: string;
    avatar?: string;
  }) {
    // Verify user is member of the family
    const member = await isFamilyMember(userId, data.familyId);
    if (!member) {
      throw new ForbiddenError('不是该家庭成员', ErrorCodes.PERMISSION_DENIED);
    }

    // Only admin can create baby
    const adminCheck = await isAdmin(userId, data.familyId);
    if (!adminCheck) {
      throw new ForbiddenError('仅管理员可创建宝宝', ErrorCodes.PERMISSION_DENIED);
    }

    const baby = await prisma.baby.create({
      data: {
        familyId: data.familyId,
        name: data.name,
        gender: data.gender,
        birthDate: new Date(data.birthDate),
        avatar: data.avatar || null,
      },
    });

    return this.formatBaby(baby);
  }

  async getBabiesByFamilyId(userId: string, familyId: string) {
    const member = await isFamilyMember(userId, familyId);
    if (!member) {
      throw new ForbiddenError('不是该家庭成员', ErrorCodes.PERMISSION_DENIED);
    }

    const babies = await prisma.baby.findMany({
      where: { familyId },
      orderBy: { createdAt: 'asc' },
    });

    return babies.map(this.formatBaby);
  }

  async getBabyById(userId: string, babyId: string) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    // Verify access
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    return this.formatBaby(baby);
  }

  async updateBaby(userId: string, babyId: string, data: {
    name?: string;
    gender?: string;
    birthDate?: string;
    avatar?: string;
  }) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    // Verify access and role
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    const role = await getUserFamilyRole(userId);
    if (!role || role === 'viewer') {
      throw new ForbiddenError('viewer 无修改权限', ErrorCodes.PERMISSION_DENIED);
    }

    const updated = await prisma.baby.update({
      where: { id: babyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.gender && { gender: data.gender }),
        ...(data.birthDate && { birthDate: new Date(data.birthDate) }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    });

    return this.formatBaby(updated);
  }

  /**
   * FR-E5：删除 baby（cursor 续传 + OperationLog 云端恢复）
   *
   * 调用模式：
   * - 首次：DELETE /babies/:id（不带 cursor）
   * - 续传：DELETE /babies/:id?cursor=<上次返回的 cursor>
   * - 数据量大时返回 { status: 'in_progress', cursor, deleted, total }
   * - 全部完成返回 { status: 'succeeded', deletedBabyId, records, vaccine, milestone }
   *
   * cursor 恢复：客户端中断后再次进入，service 层会通过 OperationLogger.findOngoing
   * 找到同 babyId 的未完成日志，从已累计的 chunk steps 中恢复进度。
   */
  async deleteBaby(userId: string, babyId: string, familyId: string, cursor?: string) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const adminCheck = await isAdmin(userId, familyId);
    if (!adminCheck) {
      throw new ForbiddenError('仅管理员可删除宝宝', ErrorCodes.PERMISSION_DENIED);
    }

    if (baby.familyId !== familyId) {
      throw new ForbiddenError('宝宝不属于该家庭', ErrorCodes.PERMISSION_DENIED);
    }

    // 优先复用云端 OperationLog（FR-E5 跨设备续传）
    let logger = await OperationLogger.findOngoing('deleteBaby', babyId);
    if (!logger) {
      logger = await new OperationLogger('deleteBaby', userId, { babyId, familyId }).start();
    }

    // 已累计删除量（从 logger.steps 中恢复）
    let recordsDeleted = logger.reduceStepData('chunk_record', 'deleted', 0);
    let chunkIdx = logger.currentSteps.filter((s) => s.step.startsWith('chunk_record')).length;

    // 计算总量（首次或客户端未传 cursor 时刷新）
    const total = await prisma.record.count({ where: { babyId } });

    const startTs = Date.now();
    let recordCursor = cursor ? parseInt(cursor, 10) : 0;

    while (Date.now() - startTs < SOFT_TIMEOUT_MS) {
      const recordsBatch = await prisma.record.findMany({
        where: { babyId },
        select: { id: true },
        skip: recordCursor,
        take: BATCH_SIZE,
      });

      if (recordsBatch.length === 0) break;

      const recordIds = recordsBatch.map((r) => r.id);

      await prisma.$transaction([
        prisma.feedingRecord.deleteMany({ where: { recordId: { in: recordIds } } }),
        prisma.sleepRecord.deleteMany({ where: { recordId: { in: recordIds } } }),
        prisma.diaperRecord.deleteMany({ where: { recordId: { in: recordIds } } }),
        prisma.temperatureRecord.deleteMany({ where: { recordId: { in: recordIds } } }),
        prisma.growthRecord.deleteMany({ where: { recordId: { in: recordIds } } }),
        prisma.record.deleteMany({ where: { id: { in: recordIds } } }),
      ]);

      recordsDeleted += recordIds.length;
      // 注意：deleteMany 把 recordCursor 处的 BATCH_SIZE 条记录都删了，下一批起点仍是 0
      // 但保留 recordCursor 计数用于客户端 cursor 透传判断（>0 表示续传中）
      recordCursor = recordsDeleted;
      logger.step(`chunk_record_${chunkIdx++}`, 'ok', { deleted: recordIds.length, cursor: String(recordCursor) });

      if (recordsBatch.length < BATCH_SIZE) break;
    }

    // 仍有剩余 → 返回 in_progress 让客户端循环续传
    const remaining = await prisma.record.count({ where: { babyId } });
    if (remaining > 0) {
      await logger.flushSteps();
      return {
        status: 'in_progress' as const,
        cursor: String(recordCursor),
        deleted: recordsDeleted,
        total,
      };
    }

    // 全部 records 删完 → 删 vaccine / milestone / baby 自身
    const vaccineResult = await prisma.vaccineRecord.deleteMany({ where: { babyId } });
    const milestoneResult = await prisma.milestoneRecord.deleteMany({ where: { babyId } });
    await prisma.baby.delete({ where: { id: babyId } });

    logger.step('delete_vaccine_records', 'ok', { count: vaccineResult.count });
    logger.step('delete_milestone_records', 'ok', { count: milestoneResult.count });
    logger.step('delete_baby', 'ok', { babyId });

    await logger.succeed({
      deletedBabyId: babyId,
      records: recordsDeleted,
      vaccine: vaccineResult.count,
      milestone: milestoneResult.count,
    });

    return {
      status: 'succeeded' as const,
      deletedBabyId: babyId,
      records: recordsDeleted,
      vaccine: vaccineResult.count,
      milestone: milestoneResult.count,
    };
  }

  private formatBaby(baby: { id: string; familyId: string; name: string; gender: string; birthDate: Date; avatar: string | null; createdAt: Date; updatedAt: Date }) {
    return {
      id: baby.id,
      familyId: baby.familyId,
      name: baby.name,
      gender: baby.gender,
      birthDate: baby.birthDate.toISOString(),
      avatar: baby.avatar,
      createdAt: baby.createdAt.toISOString(),
      updatedAt: baby.updatedAt.toISOString(),
    };
  }
}

export const babyService = new BabyService();
