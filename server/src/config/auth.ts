import { env } from './env';

export const authConfig = {
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  refreshTokenCookieName: 'refreshToken',
  refreshTokenCookieOptions: {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },
  bcryptSaltRounds: 10,
  passwordMinLength: 8,
  passwordMaxLength: 32,
};
