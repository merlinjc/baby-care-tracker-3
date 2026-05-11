/**
 * 持久化限流中间件（FR-E2）
 *
 * 替代 in-memory `rate-limit.ts` 中针对 auth/family/ai/export 的实现，
 * 使用现有 Prisma RateLimit 表存储计数，确保多实例部署下计数共享。
 *
 * 不引入 rate-limiter-flexible（避免新增依赖），自实现：
 * - 原子 upsert：同 key 不存在 → 创建；已存在 → count++
 * - 窗口过期（windowStart + windowMs < now）→ 重置 count=1
 * - 命中限流：返回 429 + RateLimitError
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { RateLimitError } from '../types/errors';

export function persistentRateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator: (req: Request) => string;
  /** 用于错误信息标识（如 'invite_join'） */
  scope?: string;
}) {
  const { windowMs, max, keyGenerator, scope = 'general' } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = `${scope}:${keyGenerator(req)}`;
    const now = new Date();
    const expireAt = new Date(now.getTime() + windowMs);

    try {
      const existing = await prisma.rateLimit.findUnique({ where: { key } });

      if (!existing) {
        // 创建新窗口
        await prisma.rateLimit.create({
          data: { key, count: 1, windowStart: now, expireAt },
        });
        return next();
      }

      // 窗口已过期 → 重置
      if (existing.expireAt.getTime() < now.getTime()) {
        await prisma.rateLimit.update({
          where: { key },
          data: { count: 1, windowStart: now, expireAt },
        });
        return next();
      }

      // 命中限流
      if (existing.count >= max) {
        const retryAfterMs = existing.expireAt.getTime() - now.getTime();
        return next(
          new RateLimitError(
            `请求过于频繁，请 ${Math.ceil(retryAfterMs / 1000)} 秒后再试`,
          ),
        );
      }

      // 计数 + 1
      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      return next();
    } catch (err) {
      // DB 异常不阻断主流程（降级为放行）
      console.warn('[persistentRateLimit] db error, fail-open', err);
      return next();
    }
  };
}

// 预设限流器
export const inviteJoinRateLimit = persistentRateLimit({
  windowMs: 60 * 1000,
  max: 5,
  scope: 'invite_join',
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
});

export const persistentAuthRateLimit = persistentRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  scope: 'auth',
  keyGenerator: (req) => req.ip || 'unknown',
});

export const persistentAIRateLimit = persistentRateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  scope: 'ai',
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
});

/**
 * 上传预签名限流（v7.2 T-S1-INF-02）：
 * - 单用户 1 分钟内最多 20 次 presign（够覆盖头像选图反复试 / 单次拖入多张照片）
 * - 同时防止恶意刷 COS 签名 URL
 * - 命中后 429 RateLimitError，前端 toast 友好提示
 */
export const presignRateLimit = persistentRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  scope: 'upload_presign',
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
});
