import { Router } from 'express';
import { authService } from '../services/auth.service';
import { authenticate, verifyRefreshToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { authConfig } from '../config/auth';
import { asyncHandler } from '../utils/async-handler';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../schemas/auth.schema';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimit, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.cookie(
    authConfig.refreshTokenCookieName,
    result.refreshToken,
    authConfig.refreshTokenCookieOptions,
  );

  res.status(201).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
}));

// POST /api/auth/login
router.post('/login', authRateLimit, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.cookie(
    authConfig.refreshTokenCookieName,
    result.refreshToken,
    authConfig.refreshTokenCookieOptions,
  );

  res.json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.[authConfig.refreshTokenCookieName];

  const result = await authService.refreshToken(token);

  res.json({
    success: true,
    data: { accessToken: result.accessToken },
  });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.userId!);

  res.json({
    success: true,
    data: { user },
  });
}));

// PATCH /api/auth/profile
router.patch('/profile', authenticate, validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.userId!, req.body);

  res.json({
    success: true,
    data: { user },
  });
}));

// POST /api/auth/change-password
router.post('/change-password', authenticate, validateBody(changePasswordSchema), asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.userId!,
    req.body.currentPassword,
    req.body.newPassword,
  );

  res.clearCookie(authConfig.refreshTokenCookieName, {
    path: authConfig.refreshTokenCookieOptions.path,
  });

  res.json({
    success: true,
    data: result,
  });
}));

export default router;
