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
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

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

  async createMilestone(userId: string, babyId: string, data: {
    name: string;
    category: string;
    achievedDate: string;
    note?: string;
  }) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    const role = await getUserFamilyRole(userId);
    if (!role || !hasPermission(role, Permission.RECORD_CREATE)) {
      throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
    }

    const milestone = await prisma.milestoneRecord.create({
      data: {
        babyId,
        familyId: baby.familyId,
        name: data.name,
        category: data.category,
        achievedDate: new Date(data.achievedDate),
        note: data.note || null,
        createdBy: userId,
      },
    });

    return this.formatMilestone(milestone);
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
    };
  }
}

export const milestoneService = new MilestoneService();
