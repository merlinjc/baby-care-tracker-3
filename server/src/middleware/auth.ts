import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { prisma } from '../config/database';
import { UnauthorizedError, TokenExpiredError } from '../types/errors';

export interface AuthPayload {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('未提供认证令牌'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as AuthPayload;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new TokenExpiredError());
    }
    return next(new UnauthorizedError('无效的认证令牌'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as AuthPayload;
    req.userId = decoded.userId;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next();
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as AuthPayload & { type: string };
    if (decoded.type !== 'refresh') return null;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return null;

    return { userId: user.id };
  } catch {
    return null;
  }
}
