import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../types/errors';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 60 * 60 * 1000) {
      store.delete(key);
    }
  }
}, 60 * 1000);

export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, keyGenerator } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= max) {
      return next(new RateLimitError('请求过于频繁，请稍后再试'));
    }

    entry.count++;
    next();
  };
}

// Preset rate limiters
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => `auth:${req.ip}`,
});

export const familyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `family:${req.userId || req.ip}`,
});

export const aiRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req) => `ai:${req.userId}`,
});

export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => `export:${req.userId}`,
});

export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => `general:${req.userId || req.ip}`,
});
