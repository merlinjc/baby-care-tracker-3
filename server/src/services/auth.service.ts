import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { authConfig } from '../config/auth';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  ErrorCodes,
} from '../types/errors';

class AuthService {
  async register(data: {
    email?: string;
    phone?: string;
    password: string;
    nickname: string;
  }) {
    // Validate: at least one of email/phone
    if (!data.email && !data.phone) {
      throw new BadRequestError('邮箱和手机号至少提供一个', ErrorCodes.INVALID_PARAMS);
    }

    // Validate password strength
    if (!this.isPasswordStrong(data.password)) {
      throw new BadRequestError('密码需8-32位，包含字母和数字', ErrorCodes.WEAK_PASSWORD);
    }

    // Check uniqueness
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new ConflictError('邮箱已被注册', ErrorCodes.EMAIL_ALREADY_EXISTS);
      }
    }
    if (data.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing) {
        throw new ConflictError('手机号已被注册', ErrorCodes.PHONE_ALREADY_EXISTS);
      }
    }

    const passwordHash = await bcrypt.hash(data.password, authConfig.bcryptSaltRounds);

    const user = await prisma.user.create({
      data: {
        email: data.email || null,
        phone: data.phone || null,
        passwordHash,
        nickname: data.nickname,
      },
    });

    const { accessToken, refreshToken } = this.generateTokens(user.id);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(data: { email?: string; phone?: string; password: string }) {
    // Find user by email or phone
    let user;
    if (data.email) {
      user = await prisma.user.findUnique({ where: { email: data.email } });
    } else if (data.phone) {
      user = await prisma.user.findUnique({ where: { phone: data.phone } });
    }

    if (!user || !user.passwordHash) {
      throw new BadRequestError('邮箱/手机号或密码错误', ErrorCodes.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestError('邮箱/手机号或密码错误', ErrorCodes.INVALID_CREDENTIALS);
    }

    const { accessToken, refreshToken } = this.generateTokens(user.id);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    if (!token) {
      throw new UnauthorizedError('Refresh Token 缺失', ErrorCodes.INVALID_REFRESH_TOKEN);
    }

    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('无效的 Refresh Token', ErrorCodes.INVALID_REFRESH_TOKEN);
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw new UnauthorizedError('用户不存在', ErrorCodes.INVALID_REFRESH_TOKEN);
      }

      const accessToken = this.generateAccessToken(user.id);

      return { accessToken };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Refresh Token 无效或已过期', ErrorCodes.INVALID_REFRESH_TOKEN);
    }
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        familyMemberships: {
          where: { familyId: { not: '' } },
          select: { role: true, familyId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('用户不存在');
    }

    const familyRole = user.familyMemberships[0]?.role;

    return {
      ...this.sanitizeUser(user),
      familyRole,
    };
  }

  async updateProfile(userId: string, data: { nickname?: string; avatar?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.nickname && { nickname: data.nickname }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    });

    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestError('当前密码错误', ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!this.isPasswordStrong(newPassword)) {
      throw new BadRequestError('新密码需8-32位，包含字母和数字', ErrorCodes.WEAK_PASSWORD);
    }

    const passwordHash = await bcrypt.hash(newPassword, authConfig.bcryptSaltRounds);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: '密码修改成功' };
  }

  // ============ Helpers ============

  private generateTokens(userId: string) {
    const accessToken = this.generateAccessToken(userId);
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtRefreshExpiresIn } as jwt.SignOptions,
    );
    return { accessToken, refreshToken };
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtExpiresIn } as jwt.SignOptions,
    );
  }

  private isPasswordStrong(password: string): boolean {
    if (password.length < 8 || password.length > 32) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
  }

  private sanitizeUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
    passwordHash?: string | null;
    nickname: string;
    avatar: string | null;
    familyId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      familyId: user.familyId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
