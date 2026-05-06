// ============ Custom Error Classes ============

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未认证', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token 已过期') {
    super(401, 'TOKEN_EXPIRED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '权限不足', code = 'PERMISSION_DENIED') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, code = 'NOT_FOUND') {
    super(404, code, `${resource}不存在`);
  }
}

export class ValidationError extends AppError {
  constructor(message = '请求参数无效') {
    super(422, 'VALIDATION_ERROR', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁') {
    super(429, 'RATE_LIMITED', message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'INVALID_PARAMS') {
    super(400, code, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE') {
    super(503, code, message);
  }
}

// ============ Error code mapping for specific business errors ============

export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  WECHAT_NOT_CONFIGURED: 'WECHAT_NOT_CONFIGURED',
  WECHAT_AUTH_FAILED: 'WECHAT_AUTH_FAILED',

  // Family
  FAMILY_NOT_FOUND: 'FAMILY_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CODE: 'INVALID_CODE',
  CODE_EXPIRED: 'CODE_EXPIRED',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  ALREADY_IN_FAMILY: 'ALREADY_IN_FAMILY',
  SOLE_ADMIN: 'SOLE_ADMIN',
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
  CANNOT_REMOVE_ADMIN: 'CANNOT_REMOVE_ADMIN',
  NOT_MEMBER: 'NOT_MEMBER',
  INVALID_ROLE: 'INVALID_ROLE',

  // Records / Babies
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  BABY_NOT_FOUND: 'BABY_NOT_FOUND',
  SLEEP_ALREADY_ACTIVE: 'SLEEP_ALREADY_ACTIVE',

  // AI
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',

  // General
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMS: 'INVALID_PARAMS',
} as const;
