import { prisma } from '../config/database';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ErrorCodes,
} from '../types/errors';
import { isAdmin, getFamilyIdForUser, isFamilyMember } from '../utils/permission';
import { generateInviteCode, isValidInviteCodeFormat } from '../utils/invite-code';
import { OperationLogger } from '../utils/operation-logger';
import type { LeaveFamilyResult } from '../types';

class FamilyService {
  async createFamily(userId: string, data: {
    name: string;
    nickname: string;
    relation?: string;
    relationText?: string;
  }) {
    const logger = await new OperationLogger('createFamily', userId, { name: data.name }).start();
    try {
      // Check if user already has a family
      const existingFamilyId = await getFamilyIdForUser(userId);
      if (existingFamilyId) {
        await logger.fail('already_in_family');
        throw new ConflictError('已属于其他家庭', ErrorCodes.ALREADY_IN_FAMILY);
      }

      const inviteCode = generateInviteCode();
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

      // Validate invite code format
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

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });

    if (!membership) {
      const result: LeaveFamilyResult = { status: 'not_member', message: '您本就不是家庭成员' };
      await logger.succeed(result);
      return result;
    }

    // If user is admin, check if they're the only admin
    if (membership.role === 'admin') {
      const adminCount = family.members.filter((m) => m.role === 'admin').length;
      if (adminCount <= 1 && family.members.length > 1) {
        // Need to transfer admin first
        const otherMembers = family.members
          .filter((m) => m.userId !== userId)
          .map((m) => ({ id: m.userId }));

        const otherMemberDetails = await prisma.user.findMany({
          where: { id: { in: otherMembers.map((m) => m.id) } },
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

    await prisma.$transaction(async (tx) => {
      // Remove membership
      await tx.familyMember.delete({
        where: { familyId_userId: { familyId, userId } },
      });

      // Clear user's familyId
      await tx.user.update({
        where: { id: userId },
        data: { familyId: null },
      });

      // If this was the last member, dissolve the family
      const remainingMembers = family.members.filter((m) => m.userId !== userId);
      if (remainingMembers.length === 0) {
        await tx.family.delete({ where: { id: familyId } });
      }
    });

    logger.step('remove_membership', 'ok', { userId });
    logger.step('clear_user_familyId', 'ok', { userId });

    // Check if family was dissolved (was last member)
    const familyExists = await prisma.family.findUnique({ where: { id: familyId } });
    if (!familyExists) {
      const result: LeaveFamilyResult = { status: 'dissolved', message: '家庭已解散' };
      logger.step('dissolve_family', 'ok', { familyId });
      await logger.succeed(result);
      return result;
    }

    const result: LeaveFamilyResult = { status: 'ok', message: '已退出家庭' };
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

      await prisma.$transaction(async (tx) => {
        // Clear all members' familyId
        const memberUserIds = family.members.map((m) => m.userId);
        await tx.user.updateMany({
          where: { id: { in: memberUserIds } },
          data: { familyId: null },
        });

        // Delete all memberships
        await tx.familyMember.deleteMany({ where: { familyId } });

        // Delete the family
        await tx.family.delete({ where: { id: familyId } });
      });

      logger.step('clear_members_familyId', 'ok', { count: family.members.length });
      logger.step('delete_memberships', 'ok');
      logger.step('delete_family', 'ok', { familyId });
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
      const adminCheck = await isAdmin(userId, familyId);
      if (!adminCheck) {
        await logger.fail('not_admin');
        throw new ForbiddenError('仅管理员可刷新邀请码', ErrorCodes.PERMISSION_DENIED);
      }

      const newCode = generateInviteCode();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const family = await prisma.family.update({
        where: { id: familyId },
        data: { inviteCode: newCode, inviteCodeExpiry: newExpiry },
      });

      const result = {
        inviteCode: family.inviteCode,
        inviteCodeExpiry: family.inviteCodeExpiry.toISOString(),
      };
      await logger.succeed(result);
      return result;
    } catch (err) {
      if (!(err instanceof ForbiddenError)) {
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

      // Validate role
      const validRoles = ['admin', 'editor', 'viewer'];
      if (!validRoles.includes(newRole)) {
        await logger.fail('invalid_role');
        throw new BadRequestError('无效的角色值', ErrorCodes.INVALID_ROLE);
      }

      // Cannot modify own role
      if (userId === targetUserId) {
        await logger.fail('cannot_modify_self');
        throw new BadRequestError('不能修改自己的角色', ErrorCodes.INVALID_PARAMS);
      }

      // Check target is a member
      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: targetUserId } },
        include: { user: { select: { id: true, nickname: true, avatar: true } } },
      });

      if (!targetMembership) {
        await logger.fail('target_not_member');
        throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
      }

      // Optimistic lock retry (2 attempts, matching mini program)
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const updated = await prisma.familyMember.update({
            where: { id: targetMembership.id },
            data: { role: newRole },
            include: { user: { select: { id: true, nickname: true, avatar: true } } },
          });

          logger.step('update_role', 'ok', { targetUserId, newRole, attempts: attempts + 1 });
          const result = this.formatMember(updated);
          await logger.succeed(result);
          return result;
        } catch {
          attempts++;
          if (attempts >= maxAttempts) {
            await logger.fail('optimistic_lock_exceeded');
            throw new ConflictError('并发冲突，请重试');
          }
        }
      }

      await logger.fail('optimistic_lock_exceeded');
      throw new ConflictError('并发冲突，请重试');
    } catch (err) {
      // 已经在分支内 logger.fail 了，这里只重抛
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

      await prisma.$transaction(async (tx) => {
        await tx.familyMember.delete({
          where: { familyId_userId: { familyId, userId: targetUserId } },
        });

        await tx.user.update({
          where: { id: targetUserId },
          data: { familyId: null },
        });
      });

      logger.step('delete_membership', 'ok', { targetUserId });
      logger.step('clear_target_familyId', 'ok', { targetUserId });
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

      // Check target membership
      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: newAdminId } },
      });

      if (!targetMembership) {
        await logger.fail('target_not_member');
        throw new BadRequestError('目标用户不是家庭成员', ErrorCodes.NOT_MEMBER);
      }

      await prisma.$transaction(async (tx) => {
        // Current admin -> editor
        await tx.familyMember.update({
          where: { familyId_userId: { familyId, userId } },
          data: { role: 'editor' },
        });

        // Target -> admin
        await tx.familyMember.update({
          where: { familyId_userId: { familyId, userId: newAdminId } },
          data: { role: 'admin' },
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
      joinedAt: member.joinedAt.toISOString(),
      user: member.user
        ? { id: member.user.id, nickname: member.user.nickname, avatar: member.user.avatar }
        : undefined,
    };
  }
}

export const familyService = new FamilyService();
