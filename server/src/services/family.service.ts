import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ErrorCodes,
} from '../types/errors';
import { isAdmin, getFamilyIdForUser, isFamilyMember } from '../utils/permission';
import { generateUniqueInviteCode, isValidInviteCodeFormat } from '../utils/invite-code';
import { OperationLogger } from '../utils/operation-logger';
import type { LeaveFamilyResult } from '../types';

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const;

class FamilyService {
  async createFamily(userId: string, data: {
    name: string;
    nickname: string;
    relation?: string;
    relationText?: string;
  }) {
    const logger = await new OperationLogger('createFamily', userId, { name: data.name }).start();
    try {
      // Check if user already has a family（同时校验 user.familyId 与 FamilyMember 是否一致）
      const existingFamilyId = await getFamilyIdForUser(userId);
      if (existingFamilyId) {
        await logger.fail('already_in_family');
        throw new ConflictError('已属于其他家庭', ErrorCodes.ALREADY_IN_FAMILY);
      }

      const inviteCode = await generateUniqueInviteCode();
      const inviteCodeExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const family = await prisma.$transaction(async (tx) => {
        // Create family
        const family = await tx.family.create({
          data: {
            name: data.name,
            creatorId: userId,
            inviteCode,
            inviteCodeExpiry,
          },
        });

        // Create admin membership
        await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId,
            role: 'admin',
            relation: data.relation || data.relationText || null,
            displayName: data.nickname, // 持久化 API spec 要求的 nickname
          },
        });

        // Update user's familyId
        await tx.user.update({
          where: { id: userId },
          data: { familyId: family.id },
        });

        return family;
      });

      logger.step('create_family_doc', 'ok', { familyId: family.id });
      logger.step('add_admin_member', 'ok', { userId });
      logger.step('update_user_familyId', 'ok', { userId });

      const detail = await this.getFamilyDetail(userId, family.id);
      await logger.succeed({ familyId: family.id });
      return detail;
    } catch (err) {
      if (!(err instanceof ConflictError)) {
        await logger.fail((err as Error).message ?? 'createFamily failed', err as Error);
      }
      throw err;
    }
  }

  async getFamilyByUserId(userId: string) {
    const familyId = await getFamilyIdForUser(userId);
    if (!familyId) return null;
    return this.getFamilyDetail(userId, familyId);
  }

  async getFamilyDetail(userId: string, familyId: string) {
    const member = await isFamilyMember(userId, familyId);
    if (!member) {
      throw new ForbiddenError('非家庭成员', ErrorCodes.PERMISSION_DENIED);
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatar: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        babies: true,
      },
    });

    if (!family) {
      throw new NotFoundError('家庭', ErrorCodes.FAMILY_NOT_FOUND);
    }

    return this.formatFamilyDetail(family);
  }

  async getFamilyMembers(userId: string, familyId: string) {
    const member = await isFamilyMember(userId, familyId);
    if (!member) {
      throw new ForbiddenError('非家庭成员', ErrorCodes.PERMISSION_DENIED);
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map(this.formatMember);
  }

  async joinByInviteCode(userId: string, data: {
    inviteCode: string;
    nickname: string;
    relation?: string;
    relationText?: string;
  }) {
    const logger = await new OperationLogger('joinFamily', userId, {
      inviteCode: data.inviteCode,
    }).start();
    try {
      // Check if user already has a family
      const existingFamilyId = await getFamilyIdForUser(userId);
      if (existingFamilyId) {
        // Check if the user is the sole admin of their current family
        const currentMembership = await prisma.familyMember.findUnique({
          where: { familyId_userId: { familyId: existingFamilyId, userId } },
        });
        if (currentMembership?.role === 'admin') {
          const adminCount = await prisma.familyMember.count({
            where: { familyId: existingFamilyId, role: 'admin' },
          });
          if (adminCount <= 1) {
            await logger.fail('sole_admin_in_old_family');
            throw new BadRequestError('您是唯一管理员，请先转让管理权限', ErrorCodes.SOLE_ADMIN);
          }
        }
        await logger.fail('already_in_family');
        throw new ConflictError('已属于其他家庭', ErrorCodes.ALREADY_IN_FAMILY);
      }

      // Validate invite code format（schema 已 transform 大小写，这里再兜底）
      if (!isValidInviteCodeFormat(data.inviteCode)) {
        await logger.fail('invalid_code_format');
        throw new BadRequestError('邀请码无效', ErrorCodes.INVALID_CODE);
      }

      // Find family by invite code
      const family = await prisma.family.findUnique({
        where: { inviteCode: data.inviteCode },
      });

      if (!family) {
        await logger.fail('code_not_found');
        throw new BadRequestError('邀请码无效', ErrorCodes.INVALID_CODE);
      }

      // Check if expired
      if (family.inviteCodeExpiry < new Date()) {
        await logger.fail('code_expired');
        throw new BadRequestError('邀请码已过期', ErrorCodes.CODE_EXPIRED);
      }

      // Check if already a member
      const existingMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: family.id, userId } },
      });
      if (existingMembership) {
        await logger.fail('already_member');
        throw new ConflictError('已是家庭成员', ErrorCodes.ALREADY_MEMBER);
      }

      // Join family
      await prisma.$transaction(async (tx) => {
        await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId,
            role: 'editor',
            relation: data.relation || data.relationText || null,
            displayName: data.nickname,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { familyId: family.id },
        });
      });

      logger.step('add_member', 'ok', { familyId: family.id, role: 'editor' });
      logger.step('update_user_familyId', 'ok', { userId });
      const detail = await this.getFamilyDetail(userId, family.id);
      await logger.succeed({ familyId: family.id, familyName: family.name });
      return detail;
    } catch (err) {
      throw err;
    }
  }

  async leaveFamily(userId: string, familyId: string): Promise<LeaveFamilyResult> {
    const logger = await new OperationLogger('leaveFamily', userId, { familyId }).start();

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });

    if (!family) {
      const result: LeaveFamilyResult = { status: 'family_not_found', message: '家庭不存在' };
      await logger.succeed(result);
      return result;
    }

    const membership = family.members.find((m) => m.userId === userId);

    if (!membership) {
      const result: LeaveFamilyResult = { status: 'not_member', message: '您本就不是家庭成员' };
      await logger.succeed(result);
      return result;
    }

    // 唯一管理员且家庭 ≥2 人：必须先转让
    if (membership.role === 'admin') {
      const adminCount = family.members.filter((m) => m.role === 'admin').length;
      if (adminCount <= 1 && family.members.length > 1) {
        const otherMembers = family.members.filter((m) => m.userId !== userId);

        const otherMemberDetails = await prisma.user.findMany({
          where: { id: { in: otherMembers.map((m) => m.userId) } },
          select: { id: true, nickname: true, avatar: true },
        });

        const result: LeaveFamilyResult = {
          status: 'need_transfer',
          message: '您是唯一管理员，请先转让管理权限',
          otherMembers: otherMemberDetails.map((u) => ({
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
          })),
        };
        logger.step('need_transfer', 'skip', { otherMembersCount: otherMemberDetails.length });
        await logger.succeed(result);
        return result;
      }
    }

    // 把 dissolve 判断 + 删除全部放进同一事务，避免事务外查询造成的并发竞态
    const willDissolve = family.members.length === 1; // 只剩自己一个

    const result = await prisma.$transaction(async (tx) => {
      // 幂等删除 membership：用 deleteMany 避免 P2025
      const removed = await tx.familyMember.deleteMany({
        where: { familyId, userId },
      });

      // 若并发已被踢出/删除，幂等返回 not_member
      if (removed.count === 0) {
        return { status: 'not_member' as const, message: '您本就不是家庭成员' };
      }

      await tx.user.update({
        where: { id: userId },
        data: { familyId: null },
      });

      if (willDissolve) {
        // 最后一人退出：级联删除整个家庭（schema 已配置 onDelete: Cascade）
        await this.cascadeDissolveFamily(tx, familyId);
        return { status: 'dissolved' as const, message: '家庭已解散' };
      }

      return { status: 'ok' as const, message: '已退出家庭' };
    });

    logger.step('remove_membership', 'ok', { userId });
    logger.step('clear_user_familyId', 'ok', { userId });
    if (result.status === 'dissolved') {
      logger.step('dissolve_family', 'ok', { familyId });
    }
    await logger.succeed(result);
    return result;
  }

  async dissolveFamily(userId: string, familyId: string) {
    const logger = await new OperationLogger('dissolveFamily', userId, { familyId }).start();
    try {
      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可解散家庭', ErrorCodes.PERMISSION_DENIED);
      }

      const family = await prisma.family.findUnique({
        where: { id: familyId },
        include: { members: true },
      });

      if (!family) {
        await logger.fail('family_not_found');
        throw new NotFoundError('家庭', ErrorCodes.FAMILY_NOT_FOUND);
      }

      const memberUserIds = family.members.map((m) => m.userId);

      await prisma.$transaction(async (tx) => {
        // 1) 清空所有成员的 familyId
        await tx.user.updateMany({
          where: { id: { in: memberUserIds } },
          data: { familyId: null },
        });

        // 2) 级联删除 family + members + babies + records + sub-records + vaccine + milestone
        await this.cascadeDissolveFamily(tx, familyId);
      });

      logger.step('clear_members_familyId', 'ok', { count: memberUserIds.length });
      logger.step('cascade_delete', 'ok', { familyId });
      await logger.succeed({ message: '家庭已解散' });
      return { message: '家庭已解散' };
    } catch (err) {
      if (!(err instanceof ForbiddenError) && !(err instanceof NotFoundError)) {
        await logger.fail((err as Error).message ?? 'dissolveFamily failed', err as Error);
      }
      throw err;
    }
  }

  async refreshInviteCode(userId: string, familyId: string) {
    const logger = await new OperationLogger('refreshInviteCode', userId, { familyId }).start();
    try {
      // 先校验家庭存在
      const family = await prisma.family.findUnique({ where: { id: familyId } });
      if (!family) {
        await logger.fail('family_not_found');
        throw new NotFoundError('家庭', ErrorCodes.FAMILY_NOT_FOUND);
      }

      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可刷新邀请码', ErrorCodes.PERMISSION_DENIED);
      }

      const newCode = await generateUniqueInviteCode();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updated = await prisma.family.update({
        where: { id: familyId },
        data: { inviteCode: newCode, inviteCodeExpiry: newExpiry },
      });

      const result = {
        inviteCode: updated.inviteCode,
        inviteCodeExpiry: updated.inviteCodeExpiry.toISOString(),
      };
      await logger.succeed(result);
      return result;
    } catch (err) {
      if (!(err instanceof ForbiddenError) && !(err instanceof NotFoundError)) {
        await logger.fail((err as Error).message ?? 'refreshInviteCode failed', err as Error);
      }
      throw err;
    }
  }

  async updateMemberRole(userId: string, familyId: string, targetUserId: string, newRole: string) {
    const logger = await new OperationLogger('updateMemberRole', userId, {
      familyId,
      targetUserId,
      newRole,
    }).start();
    try {
      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可修改成员角色', ErrorCodes.PERMISSION_DENIED);
      }

      // Validate role（白名单防 SQL/数据注入）
      if (!VALID_ROLES.includes(newRole as typeof VALID_ROLES[number])) {
        await logger.fail('invalid_role');
        throw new BadRequestError('无效的角色值', ErrorCodes.INVALID_ROLE);
      }

      // Cannot modify own role
      if (userId === targetUserId) {
        await logger.fail('cannot_modify_self');
        throw new BadRequestError('不能修改自己的角色', ErrorCodes.INVALID_PARAMS);
      }

      // 一次性查 target，避免重复 round trip
      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: targetUserId } },
      });

      if (!targetMembership) {
        await logger.fail('target_not_member');
        throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
      }

      // 等价角色：直接成功返回，避免无意义 update
      if (targetMembership.role === newRole) {
        const formatted = await prisma.familyMember.findUnique({
          where: { id: targetMembership.id },
          include: { user: { select: { id: true, nickname: true, avatar: true } } },
        });
        const result = this.formatMember(formatted!);
        await logger.succeed(result);
        return result;
      }

      // 关键防护：阻止"降级最后一个 admin"
      if (targetMembership.role === 'admin' && newRole !== 'admin') {
        const adminCount = await prisma.familyMember.count({
          where: { familyId, role: 'admin' },
        });
        if (adminCount <= 1) {
          await logger.fail('cannot_demote_last_admin');
          throw new BadRequestError(
            '不能降级最后一个管理员，请先转让或新增管理员',
            ErrorCodes.SOLE_ADMIN,
          );
        }
      }

      // 真正的乐观锁：基于 version 字段，最多 3 次重试
      const maxAttempts = 3;
      let attempts = 0;
      let currentVersion = targetMembership.version;

      while (attempts < maxAttempts) {
        try {
          const updated = await prisma.familyMember.update({
            where: { id: targetMembership.id, version: currentVersion },
            data: { role: newRole, version: { increment: 1 } },
            include: { user: { select: { id: true, nickname: true, avatar: true } } },
          });

          logger.step('update_role', 'ok', {
            targetUserId,
            newRole,
            attempts: attempts + 1,
            newVersion: updated.version,
          });
          const result = this.formatMember(updated);
          await logger.succeed(result);
          return result;
        } catch (err) {
          // P2025: Record not found → 版本不匹配，重读后重试
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            attempts++;
            const fresh = await prisma.familyMember.findUnique({
              where: { id: targetMembership.id },
            });
            if (!fresh) {
              await logger.fail('target_removed_during_update');
              throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
            }
            currentVersion = fresh.version;
            continue;
          }
          throw err;
        }
      }

      await logger.fail('optimistic_lock_exceeded');
      throw new ConflictError('并发冲突，请重试');
    } catch (err) {
      throw err;
    }
  }

  async removeMember(userId: string, familyId: string, targetUserId: string) {
    const logger = await new OperationLogger('removeMember', userId, {
      familyId,
      targetUserId,
    }).start();
    try {
      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可移除成员', ErrorCodes.PERMISSION_DENIED);
      }

      // Cannot remove self
      if (userId === targetUserId) {
        await logger.fail('cannot_remove_self');
        throw new BadRequestError('不能移除自己，请使用退出家庭功能', ErrorCodes.CANNOT_REMOVE_SELF);
      }

      // Check target membership
      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: targetUserId } },
      });

      if (!targetMembership) {
        await logger.fail('target_not_member');
        throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
      }

      // Cannot remove other admin
      if (targetMembership.role === 'admin') {
        await logger.fail('cannot_remove_admin');
        throw new BadRequestError('不能移除管理员', ErrorCodes.CANNOT_REMOVE_ADMIN);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 用 deleteMany 幂等：并发已删除时不会抛 P2025
        const removed = await tx.familyMember.deleteMany({
          where: { familyId, userId: targetUserId },
        });

        if (removed.count === 0) {
          // 并发场景，target 已自行 leave
          return { idempotent: true };
        }

        await tx.user.update({
          where: { id: targetUserId },
          data: { familyId: null },
        });

        return { idempotent: false };
      });

      logger.step('delete_membership', 'ok', { targetUserId, idempotent: result.idempotent });
      await logger.succeed({ removedUserId: targetUserId });
      return { message: '成员已移除' };
    } catch (err) {
      throw err;
    }
  }

  async transferAdmin(userId: string, familyId: string, newAdminId: string) {
    const logger = await new OperationLogger('transferAdmin', userId, {
      familyId,
      newAdminId,
    }).start();
    try {
      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可转让管理权限', ErrorCodes.PERMISSION_DENIED);
      }

      // 不能转让给自己
      if (userId === newAdminId) {
        await logger.fail('cannot_transfer_to_self');
        throw new BadRequestError('不能转让给自己', ErrorCodes.INVALID_PARAMS);
      }

      // 校验目标是家庭成员
      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: newAdminId } },
      });

      if (!targetMembership) {
        await logger.fail('target_not_member');
        throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
      }

      // 目标已经是 admin → 无需转让，避免把自己降级到 editor 引发"无 admin"
      if (targetMembership.role === 'admin') {
        await logger.fail('target_already_admin');
        throw new BadRequestError('目标已经是管理员', ErrorCodes.INVALID_PARAMS);
      }

      await prisma.$transaction(async (tx) => {
        // Current admin -> editor
        await tx.familyMember.update({
          where: { familyId_userId: { familyId, userId } },
          data: { role: 'editor', version: { increment: 1 } },
        });

        // Target -> admin
        await tx.familyMember.update({
          where: { familyId_userId: { familyId, userId: newAdminId } },
          data: { role: 'admin', version: { increment: 1 } },
        });
      });

      logger.step('demote_self', 'ok', { userId });
      logger.step('promote_target', 'ok', { newAdminId });
      await logger.succeed({ oldAdminId: userId, newAdminId });
      return { message: '管理员已转让', newAdminId };
    } catch (err) {
      throw err;
    }
  }

  // ============ Helpers ============

  /**
   * 在事务内级联删除整个家庭关联资源。
   * 删除顺序：子表 → 父表，避免外键约束（即使 schema 已配置 cascade，也显式控制以兼容老库）。
   */
  private async cascadeDissolveFamily(
    tx: Prisma.TransactionClient,
    familyId: string,
  ): Promise<void> {
    // 1) 找到 family 下所有 baby
    const babies = await tx.baby.findMany({
      where: { familyId },
      select: { id: true },
    });
    const babyIds = babies.map((b) => b.id);

    if (babyIds.length > 0) {
      // 2) 删 records（子表 sub-records 由 onDelete: Cascade 自动处理）
      await tx.record.deleteMany({ where: { babyId: { in: babyIds } } });
      // 3) 删 vaccine / milestone
      await tx.vaccineRecord.deleteMany({ where: { babyId: { in: babyIds } } });
      await tx.milestoneRecord.deleteMany({ where: { babyId: { in: babyIds } } });
      // 4) 删 babies
      await tx.baby.deleteMany({ where: { familyId } });
    }

    // 5) 删 family members
    await tx.familyMember.deleteMany({ where: { familyId } });

    // 6) 删 family 自身
    await tx.family.delete({ where: { id: familyId } });
  }

  private formatFamilyDetail(family: any) {
    return {
      id: family.id,
      name: family.name,
      creatorId: family.creatorId,
      inviteCode: family.inviteCode,
      inviteCodeExpiry: family.inviteCodeExpiry.toISOString(),
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
      members: family.members.map(this.formatMember),
      babies: family.babies.map((b: any) => ({
        id: b.id,
        familyId: b.familyId,
        name: b.name,
        gender: b.gender,
        birthDate: b.birthDate.toISOString(),
        avatar: b.avatar,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  }

  private formatMember(member: any) {
    return {
      id: member.id,
      familyId: member.familyId,
      userId: member.userId,
      role: member.role,
      relation: member.relation,
      displayName: member.displayName ?? null,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user
        ? { id: member.user.id, nickname: member.user.nickname, avatar: member.user.avatar }
        : undefined,
    };
  }
}

export const familyService = new FamilyService();
