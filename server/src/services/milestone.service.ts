import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser, getUserFamilyRole, hasPermission } from '../utils/permission';
import { Permission } from '../utils/permission';

class MilestoneService {
  async getMilestones(userId: string, babyId: string, query: {
    category?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const baby = await this.assertBabyAccess(userId, babyId);

    const { page = 1, pageSize = 20 } = query;

    const where: any = {
      babyId,
      familyId: baby.familyId,
      ...(query.category && { category: query.category }),
    };

    const [items, total] = await Promise.all([
      prisma.milestoneRecord.findMany({
        where,
        orderBy: { achievedDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.milestoneRecord.count({ where }),
    ]);

    return {
      items: items.map(this.formatMilestone),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /**
   * 打卡式：按 (babyId, name) upsert。
   * - 已存在则直接返回（幂等，不覆盖 achievedDate / note，避免重复打卡丢失原始时间）
   * - 不存在则新建（achievedDate 默认 now）
   */
  async createMilestone(userId: string, babyId: string, data: {
    name: string;
    category: string;
    achievedDate: string;
    note?: string;
  }) {
    const baby = await this.assertBabyAccess(userId, babyId);

    const role = await getUserFamilyRole(userId);
    if (!role || !hasPermission(role, Permission.RECORD_CREATE)) {
      throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
    }

    const milestone = await prisma.milestoneRecord.upsert({
      where: { babyId_name: { babyId, name: data.name } },
      create: {
        babyId,
        familyId: baby.familyId,
        name: data.name,
        category: data.category,
        achievedDate: new Date(data.achievedDate),
        note: data.note || null,
        createdBy: userId,
      },
      update: {}, // 幂等：已打卡则不变更
    });

    return this.formatMilestone(milestone);
  }

  /**
   * 编辑里程碑（仅允许编辑 achievedDate / note；name / category 受标准定义约束，不开放修改）
   */
  async updateMilestone(userId: string, babyId: string, milestoneId: string, data: {
    achievedDate?: string;
    note?: string | null;
  }) {
    await this.assertBabyAccess(userId, babyId);

    const milestone = await prisma.milestoneRecord.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.babyId !== babyId) {
      throw new NotFoundError('里程碑记录');
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();
    const isOwn = milestone.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_UPDATE_OWN)
      : hasPermission(role, Permission.RECORD_UPDATE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权修改此里程碑', ErrorCodes.PERMISSION_DENIED);
    }

    const updated = await prisma.milestoneRecord.update({
      where: { id: milestoneId },
      data: {
        ...(data.achievedDate !== undefined && { achievedDate: new Date(data.achievedDate) }),
        ...(data.note !== undefined && { note: data.note || null }),
      },
    });

    return this.formatMilestone(updated);
  }

  /**
   * 取消打卡（按 id 删除）
   */
  async deleteMilestone(userId: string, babyId: string, milestoneId: string) {
    await this.assertBabyAccess(userId, babyId);

    const milestone = await prisma.milestoneRecord.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.babyId !== babyId) {
      throw new NotFoundError('里程碑记录');
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();
    const isOwn = milestone.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_DELETE_OWN)
      : hasPermission(role, Permission.RECORD_DELETE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权取消此里程碑', ErrorCodes.PERMISSION_DENIED);
    }

    await prisma.milestoneRecord.delete({ where: { id: milestoneId } });

    return { message: '已取消打卡' };
  }

  private async assertBabyAccess(userId: string, babyId: string) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }
    return baby;
  }

  private formatMilestone(m: any) {
    return {
      id: m.id,
      babyId: m.babyId,
      familyId: m.familyId,
      name: m.name,
      category: m.category,
      achievedDate: m.achievedDate.toISOString(),
      note: m.note,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt ? m.updatedAt.toISOString() : m.createdAt.toISOString(),
    };
  }
}

export const milestoneService = new MilestoneService();
