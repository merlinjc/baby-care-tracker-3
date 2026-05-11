/**
 * daily-checkin.service.ts - 每日打卡服务（v7.2 T-S2-F11-BE-02）
 *
 * 设计要点：
 * - CRUD by date：路由用 `:date`（YYYY-MM-DD）寻址，service 内部按 (babyId, checkinDate) 唯一约束查询
 * - 跨家庭隔离：assertBabyAccess（与 jaundice / vaccine 一致）
 * - 权限矩阵：
 *     create  → RECORD_CREATE          （admin / editor）
 *     update  → RECORD_UPDATE_OWN | ANY （editor 仅自己 / admin 全部）
 *     remove  → RECORD_DELETE_OWN | ANY
 * - 7d 补打卡窗口：create 时校验 checkinDate ∈ [today-7d, today]，且不早于 baby.birthDate
 * - 唯一约束：DB 层 @@unique([babyId, checkinDate])，捕获 P2002 转 409 CHECKIN_DUPLICATE
 * - 用户编辑 aiSummary：update 入参里有 aiSummary 时，自动把 aiSummaryAt 置 null（业务约定）
 *
 * AI 小记生成（generateAiSummary）放在 BE-03 task。
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser, getUserFamilyRole, hasPermission, Permission } from './../utils/permission';
import {
  isWithinCheckinWindow,
  isValidYmd,
} from '../utils/checkin-date';
import type {
  CreateCheckinInput,
  UpdateCheckinInput,
  ListCheckinQuery,
} from '../schemas/daily-checkin.schema';

class DailyCheckinService {
  /** 列表：按区间过滤；默认本月。按 checkinDate desc 排序。 */
  async list(userId: string, babyId: string, query: ListCheckinQuery) {
    const baby = await this.assertBabyAccess(userId, babyId);

    // 默认本月范围（按服务器本地时区，前端应当显式传 startDate/endDate 避免歧义）
    const today = toYmd(new Date());
    const [yyyy, mm] = today.split('-');
    const monthStart = `${yyyy}-${mm}-01`;
    const last = new Date(Number(yyyy), Number(mm), 0).getDate();
    const monthEnd = `${yyyy}-${mm}-${String(last).padStart(2, '0')}`;
    const startDate = query.startDate ?? monthStart;
    const endDate = query.endDate ?? monthEnd;

    const items = await prisma.dailyCheckin.findMany({
      where: {
        babyId,
        familyId: baby.familyId,
        checkinDate: { gte: startDate, lte: endDate },
      },
      orderBy: { checkinDate: 'desc' },
      include: {
        creator: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    return {
      items: items.map(this.format),
      total: items.length,
      range: { startDate, endDate },
    };
  }

  /** 按日期取单条；不存在抛 404 CHECKIN_NOT_FOUND */
  async getByDate(userId: string, babyId: string, date: string) {
    const baby = await this.assertBabyAccess(userId, babyId);
    if (!isValidYmd(date)) {
      throw new BadRequestError('日期格式无效', ErrorCodes.CHECKIN_DATE_INVALID);
    }
    const record = await prisma.dailyCheckin.findUnique({
      where: { babyId_checkinDate: { babyId, checkinDate: date } },
      include: { creator: { select: { id: true, nickname: true, avatar: true } } },
    });
    if (!record || record.familyId !== baby.familyId) {
      throw new NotFoundError('打卡记录', ErrorCodes.CHECKIN_NOT_FOUND);
    }
    return this.format(record);
  }

  /**
   * 创建打卡。
   *
   * 前置校验：
   * - checkinDate 在 [today-7d, today] 窗口内（产品规则）
   * - checkinDate 不早于 baby.birthDate
   * - 同 (babyId, checkinDate) 唯一（DB 兜底 + 这里软查友好提示）
   */
  async create(userId: string, babyId: string, data: CreateCheckinInput) {
    const baby = await this.assertBabyAccess(userId, babyId);

    const role = await getUserFamilyRole(userId);
    if (!role || !hasPermission(role, Permission.RECORD_CREATE)) {
      throw new ForbiddenError('无创建权限', ErrorCodes.PERMISSION_DENIED);
    }

    // 7d 窗口
    if (!isWithinCheckinWindow(data.checkinDate)) {
      throw new BadRequestError(
        '打卡日期超出 7 天补录窗口，仅可为今天或过去 7 天内',
        ErrorCodes.CHECKIN_WINDOW_EXPIRED,
      );
    }

    // 不早于宝宝出生日
    const birthYmd = toYmd(baby.birthDate);
    if (data.checkinDate < birthYmd) {
      throw new BadRequestError(
        '打卡日期不能早于宝宝出生日',
        ErrorCodes.CHECKIN_DATE_INVALID,
      );
    }

    try {
      const record = await prisma.dailyCheckin.create({
        data: {
          babyId,
          familyId: baby.familyId,
          checkinDate: data.checkinDate,
          photoKey: data.photoKey,
          photoWidth: data.photoWidth ?? null,
          photoHeight: data.photoHeight ?? null,
          caption: data.caption?.trim() || null,
          createdBy: userId,
        },
        include: { creator: { select: { id: true, nickname: true, avatar: true } } },
      });
      return this.format(record);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(
          '该日期已存在打卡记录，请使用更新或删除',
          ErrorCodes.CHECKIN_DUPLICATE,
        );
      }
      throw err;
    }
  }

  /**
   * 按日期更新打卡。
   *
   * - editor 仅可改自己创建的
   * - admin 全部可改
   * - 入参带 aiSummary 视为用户编辑：aiSummaryAt 自动置 null（"已人工修改"语义）
   */
  async update(userId: string, babyId: string, date: string, patch: UpdateCheckinInput) {
    const baby = await this.assertBabyAccess(userId, babyId);
    if (!isValidYmd(date)) {
      throw new BadRequestError('日期格式无效', ErrorCodes.CHECKIN_DATE_INVALID);
    }

    const existing = await prisma.dailyCheckin.findUnique({
      where: { babyId_checkinDate: { babyId, checkinDate: date } },
    });
    if (!existing || existing.familyId !== baby.familyId) {
      throw new NotFoundError('打卡记录', ErrorCodes.CHECKIN_NOT_FOUND);
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError('未加入家庭', ErrorCodes.PERMISSION_DENIED);
    const isOwn = existing.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_UPDATE_OWN)
      : hasPermission(role, Permission.RECORD_UPDATE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权修改此打卡', ErrorCodes.PERMISSION_DENIED);
    }

    const data: Prisma.DailyCheckinUpdateInput = {};
    if (patch.photoKey !== undefined) data.photoKey = patch.photoKey;
    if (patch.photoWidth !== undefined) data.photoWidth = patch.photoWidth;
    if (patch.photoHeight !== undefined) data.photoHeight = patch.photoHeight;
    if (patch.caption !== undefined) {
      data.caption = patch.caption ? patch.caption.trim() || null : null;
    }
    if (patch.aiSummary !== undefined) {
      // 用户编辑：清空 aiSummaryAt，标识"已人工修改"
      data.aiSummary = patch.aiSummary;
      data.aiSummaryAt = null;
    }

    const updated = await prisma.dailyCheckin.update({
      where: { babyId_checkinDate: { babyId, checkinDate: date } },
      data,
      include: { creator: { select: { id: true, nickname: true, avatar: true } } },
    });
    return this.format(updated);
  }

  async remove(userId: string, babyId: string, date: string) {
    const baby = await this.assertBabyAccess(userId, babyId);
    if (!isValidYmd(date)) {
      throw new BadRequestError('日期格式无效', ErrorCodes.CHECKIN_DATE_INVALID);
    }

    const existing = await prisma.dailyCheckin.findUnique({
      where: { babyId_checkinDate: { babyId, checkinDate: date } },
    });
    if (!existing || existing.familyId !== baby.familyId) {
      throw new NotFoundError('打卡记录', ErrorCodes.CHECKIN_NOT_FOUND);
    }

    const role = await getUserFamilyRole(userId);
    if (!role) throw new ForbiddenError('未加入家庭', ErrorCodes.PERMISSION_DENIED);
    const isOwn = existing.createdBy === userId;
    const allowed = isOwn
      ? hasPermission(role, Permission.RECORD_DELETE_OWN)
      : hasPermission(role, Permission.RECORD_DELETE_ANY);
    if (!allowed) {
      throw new ForbiddenError('无权删除此打卡', ErrorCodes.PERMISSION_DENIED);
    }

    await prisma.dailyCheckin.delete({
      where: { babyId_checkinDate: { babyId, checkinDate: date } },
    });
    // COS 对象由 patrol（dailyCheckinOrphanCleanup, T-S2-F11-BE-04）异步清理，避免误删
    return { message: '已删除' };
  }

  // ============ Helpers ============

  private async assertBabyAccess(userId: string, babyId: string) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }
    return baby;
  }

  /** Prisma row → API response */
  private format = (r: any) => ({
    id: r.id,
    babyId: r.babyId,
    familyId: r.familyId,
    checkinDate: r.checkinDate,
    photoKey: r.photoKey,
    photoWidth: r.photoWidth,
    photoHeight: r.photoHeight,
    caption: r.caption,
    aiSummary: r.aiSummary,
    aiSummaryAt:
      r.aiSummaryAt instanceof Date ? r.aiSummaryAt.toISOString() : r.aiSummaryAt,
    createdBy: r.createdBy,
    creator: r.creator
      ? { id: r.creator.id, nickname: r.creator.nickname, avatar: r.creator.avatar }
      : undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  });
}

function toYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

export const dailyCheckinService = new DailyCheckinService();
