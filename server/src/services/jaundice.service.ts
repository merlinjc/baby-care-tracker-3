/**
 * jaundice.service.ts - 黄疸记录服务（v7.2 T-S1-F2-01）
 *
 * 设计要点：
 * - CRUD 全套：list / getById / create / update / delete
 * - 跨家庭隔离：assertBabyAccess 通过 familyId 校验，与 vaccine / milestone 一致
 * - 权限矩阵：
 *     create  → RECORD_CREATE      （admin / editor）
 *     update  → RECORD_UPDATE_OWN | RECORD_UPDATE_ANY（按是否本人）
 *     delete  → RECORD_DELETE_OWN | RECORD_DELETE_ANY（按是否本人）
 * - symptoms / treatments：库内 JSON 字符串；返回时 JSON.parse 给前端
 * - 时间字段：recordDate / createdAt / updatedAt 全部 ISO 字符串出参
 *
 * 与客户端字段映射约定见 schemas/jaundice.schema.ts 顶部注释。
 */
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser, getUserFamilyRole, hasPermission } from '../utils/permission';
import { Permission } from '../utils/permission';
import type {
  CreateJaundiceInput,
  UpdateJaundiceInput,
  ListJaundiceQuery,
} from '../schemas/jaundice.schema';

class JaundiceService {
  async list(userId: string, babyId: string, query: ListJaundiceQuery) {
    const baby = await this.assertBabyAccess(userId, babyId);

    const where: any = {
      babyId,
      familyId: baby.familyId,
    };
    if (query.startDate || query.endDate) {
      where.recordDate = {};
      if (query.startDate) where.recordDate.gte = new Date(query.startDate);
      if (query.endDate) where.recordDate.lte = new Date(query.endDate);
    }

    const items = await prisma.jaundiceRecord.findMany({
      where,
      orderBy: { recordDate: 'desc' },
      take: query.limit ?? 100,
    });

    return {
      items: items.map(this.format),
      total: items.length,
    };
  }

  async getById(userId: string, babyId: string, recordId: string) {
    await this.assertBabyAccess(userId, babyId);
    const record = await prisma.jaundiceRecord.findUnique({ where: { id: recordId } });
    if (!record || record.babyId !== babyId) {
      throw new NotFoundError('黄疸记录');
    }
    return this.format(record);
  }

  async create(userId: string, babyId: string, data: CreateJaundiceInput) {
    const baby = await this.assertBabyAccess(userId, babyId);

    const role = await getUserFamilyRole(userId);
    if (!role || !hasPermission(role, Permission.RECORD_CREATE)) {
      throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
    }

    const record = await prisma.jaundiceRecord.create({
      data: {
        babyId,
        familyId: baby.familyId,
        recordDate: new Date(data.recordDate),
        dayAge: data.dayAge ?? null,
        kramerZone: data.kramerZone ?? null,
        scleralIcterus: data.scleralIcterus ?? null,
        tcb: data.tcb ?? null,
        tsb: data.tsb ?? null,
        category: data.category ?? null,
        symptoms: data.symptoms ? JSON.stringify(data.symptoms) : null,
        treatments: data.treatments ? JSON.stringify(data.treatments) : null,
        note: data.note || null,
        createdBy: userId,
      },
    });

    return this.format(record);
  }

  async update(
    userId: string,
    babyId: string,
    recordId: string,
    data: UpdateJaundiceInput,
  ) {
    await this.assertBabyAccess(userId, babyId);

    const record = await prisma.jaundiceRecord.findUnique({ where: { id: recordId } });
    if (!record || record.babyId !== babyId) {
      throw new NotFoundError('黄疸记录');
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();
    const isOwn = record.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_UPDATE_OWN)
      : hasPermission(role, Permission.RECORD_UPDATE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权修改此记录', ErrorCodes.PERMISSION_DENIED);
    }

    const updated = await prisma.jaundiceRecord.update({
      where: { id: recordId },
      data: {
        ...(data.recordDate !== undefined && { recordDate: new Date(data.recordDate) }),
        ...(data.dayAge !== undefined && { dayAge: data.dayAge }),
        ...(data.kramerZone !== undefined && { kramerZone: data.kramerZone }),
        ...(data.scleralIcterus !== undefined && {
          scleralIcterus: data.scleralIcterus,
        }),
        ...(data.tcb !== undefined && { tcb: data.tcb }),
        ...(data.tsb !== undefined && { tsb: data.tsb }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.symptoms !== undefined && {
          symptoms: data.symptoms ? JSON.stringify(data.symptoms) : null,
        }),
        ...(data.treatments !== undefined && {
          treatments: data.treatments ? JSON.stringify(data.treatments) : null,
        }),
        ...(data.note !== undefined && { note: data.note || null }),
      },
    });

    return this.format(updated);
  }

  async delete(userId: string, babyId: string, recordId: string) {
    await this.assertBabyAccess(userId, babyId);

    const record = await prisma.jaundiceRecord.findUnique({ where: { id: recordId } });
    if (!record || record.babyId !== babyId) {
      throw new NotFoundError('黄疸记录');
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError();
    const isOwn = record.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_DELETE_OWN)
      : hasPermission(role, Permission.RECORD_DELETE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权删除此记录', ErrorCodes.PERMISSION_DENIED);
    }

    await prisma.jaundiceRecord.delete({ where: { id: recordId } });
    return { message: '已删除' };
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

  /**
   * Prisma row → API response 格式化
   *
   * - DateTime → ISO 字符串
   * - symptoms / treatments：从 JSON 字符串还原为数组（异常字符串静默回退为 []）
   * - 缺失值统一返回 null（避免前端 undefined / null 二态判断）
   */
  private format = (r: any) => {
    return {
      id: r.id,
      babyId: r.babyId,
      familyId: r.familyId,
      recordDate: r.recordDate instanceof Date ? r.recordDate.toISOString() : r.recordDate,
      dayAge: r.dayAge,
      kramerZone: r.kramerZone,
      scleralIcterus: r.scleralIcterus,
      tcb: r.tcb,
      tsb: r.tsb,
      category: r.category,
      symptoms: parseJsonArray(r.symptoms),
      treatments: parseJsonArray(r.treatments),
      note: r.note,
      createdBy: r.createdBy,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    };
  };
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const jaundiceService = new JaundiceService();
