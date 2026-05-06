import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError, ErrorCodes } from '../types/errors';

// ============ Permission Enum & Matrix ============

export enum Permission {
  RECORD_CREATE = 'record:create',
  RECORD_UPDATE_OWN = 'record:update:own',
  RECORD_UPDATE_ANY = 'record:update:any',
  RECORD_DELETE_OWN = 'record:delete:own',
  RECORD_DELETE_ANY = 'record:delete:any',
  FAMILY_MANAGE = 'family:manage',
  FAMILY_DISSOLVE = 'family:dissolve',
  BABY_CREATE = 'baby:create',
  BABY_DELETE = 'baby:delete',
  MEMBER_MANAGE = 'member:manage',
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(Permission), // All permissions
  editor: [
    Permission.RECORD_CREATE,
    Permission.RECORD_UPDATE_OWN,
    Permission.RECORD_DELETE_OWN,
  ],
  viewer: [], // Read-only
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getUserRole(role: string): string {
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return 'viewer';
  }
  return role;
}

// ============ Permission Middleware ============

export function requirePermission(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        return next(new ForbiddenError('未认证', ErrorCodes.UNAUTHORIZED));
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { familyId: true },
      });

      if (!user?.familyId) {
        return next(new ForbiddenError('未加入家庭'));
      }

      const membership = await prisma.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: user.familyId,
            userId: req.userId,
          },
        },
        select: { role: true },
      });

      if (!membership) {
        return next(new ForbiddenError('不是家庭成员'));
      }

      if (!hasPermission(membership.role, permission)) {
        return next(new ForbiddenError('权限不足', ErrorCodes.PERMISSION_DENIED));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ============ Family Member Check Middleware ============

export function requireFamilyMember(req: Request, _res: Response, next: NextFunction): void {
  // This will be used as a base middleware for routes that need family context
  // The actual family membership check will be done in the service layer
  if (!req.userId) {
    return next(new ForbiddenError('未认证'));
  }
  next();
}

// ============ Helper Functions ============

export async function getUserFamilyRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user?.familyId) return null;

  const membership = await prisma.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId: user.familyId,
        userId,
      },
    },
    select: { role: true },
  });

  return membership?.role ?? null;
}

export async function isFamilyMember(userId: string, familyId: string): Promise<boolean> {
  const membership = await prisma.familyMember.findUnique({
    where: {
      familyId_userId: { familyId, userId },
    },
  });
  return !!membership;
}

export async function isAdmin(userId: string, familyId: string): Promise<boolean> {
  const membership = await prisma.familyMember.findUnique({
    where: {
      familyId_userId: { familyId, userId },
    },
    select: { role: true },
  });
  return membership?.role === 'admin';
}

export async function getFamilyIdForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });
  return user?.familyId ?? null;
}

export async function checkBabyAccess(userId: string, babyId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user?.familyId) return false;

  const baby = await prisma.baby.findUnique({
    where: { id: babyId },
    select: { familyId: true },
  });

  return baby?.familyId === user.familyId;
}
