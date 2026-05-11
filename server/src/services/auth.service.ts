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
import type { UserPreferences } from '../types';

/**
 * 把存在 `User.preferences`（JSON 字符串）反序列化为对象。
 * - 字段为 null / 空串 / 解析失败 → 返回 null（旧用户从未写过）
 * - 解析失败时记录 warning，不抛错（避免 1 个用户脏数据拖垮整库登录）
 */
function parsePreferences(raw: string | null | undefined): UserPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as UserPreferences;
    }
    return null;
  } catch (err) {
    console.warn('[auth.service] 解析 User.preferences 失败，按 null 处理', err);
    return null;
  }
}

/**
 * 顶层 key 级别的深合并（部分更新语义）：
 * - 客户端传哪个 key 就只更新哪个 key，未传的 key 保留原值
 * - 客户端传 `undefined` 视为"不更新该 key"
 * - 客户端传非 undefined（包括 null / false / 空数组）视为"显式赋值"
 * 不做嵌套 key 合并（v7.2 期间所有偏好都是扁平结构）。
 */
function mergePreferences(
  base: UserPreferences | null,
  patch: Record<string, unknown>,
): UserPreferences {
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = value;
  }
  return merged as UserPreferences;
}

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

  async updateProfile(
    userId: string,
    data: { nickname?: string; avatar?: string; preferences?: Record<string, unknown> },
  ) {
    // 显式判定 avatar 是否提供：允许传 null / 空串 清空头像
    const hasAvatar = Object.prototype.hasOwnProperty.call(data, 'avatar');

    // preferences 走深合并：先读旧值，再合并 patch，最后写回 JSON 字符串
    let preferencesUpdate: { preferences: string } | Record<string, never> = {};
    if (data.preferences !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      if (!current) {
        throw new UnauthorizedError('用户不存在');
      }
      const base = parsePreferences(current.preferences);
      const merged = mergePreferences(base, data.preferences);
      preferencesUpdate = { preferences: JSON.stringify(merged) };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.nickname && { nickname: data.nickname }),
        ...(hasAvatar && { avatar: data.avatar ?? null }),
        ...preferencesUpdate,
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
    preferences?: string | null;
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
      // v7.2+：反序列化为对象（旧用户没有该字段 → null）
      preferences: parsePreferences(user.preferences),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
