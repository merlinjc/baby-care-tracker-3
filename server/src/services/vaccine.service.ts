import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser, getUserFamilyRole, hasPermission } from '../utils/permission';
import { Permission } from '../utils/permission';

class VaccineService {
  async getVaccines(userId: string, babyId: string, query: {
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

    const where: any = { babyId, familyId: baby.familyId };

    const [items, total] = await Promise.all([
      prisma.vaccineRecord.findMany({
        where,
        orderBy: { vaccinatedDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vaccineRecord.count({ where }),
    ]);

    return {
      items: items.map(this.formatVaccine),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async createVaccine(userId: string, babyId: string, data: {
    name: string;
    dose: string;
    vaccinatedDate: string;
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

    const vaccine = await prisma.vaccineRecord.create({
      data: {
        babyId,
        familyId: baby.familyId,
        name: data.name,
        dose: data.dose,
        vaccinatedDate: new Date(data.vaccinatedDate),
        note: data.note || null,
        createdBy: userId,
      },
    });

    return this.formatVaccine(vaccine);
  }

  private formatVaccine(v: any) {
    return {
      id: v.id,
      babyId: v.babyId,
      familyId: v.familyId,
      name: v.name,
      dose: v.dose,
      vaccinatedDate: v.vaccinatedDate.toISOString(),
      note: v.note,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
    };
  }
}

export const vaccineService = new VaccineService();
