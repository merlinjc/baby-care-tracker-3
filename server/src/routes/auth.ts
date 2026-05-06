import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { wechatAuthService } from '../services/wechat-auth.service';
import { authenticate } from '../middleware/auth';
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

// POST /api/auth/logout
// 服务端注销：清掉 refreshToken cookie，让浏览器无法再续期。无需校验 access token，
// 即使 token 过期也允许调用（前端会同步清 access token）。
router.post('/logout', asyncHandler(async (_req, res) => {
  res.clearCookie(authConfig.refreshTokenCookieName, {
    path: authConfig.refreshTokenCookieOptions.path,
  });
  res.json({
    success: true,
    data: { message: '已退出登录' },
  });
}));

// POST /api/auth/wechat
// 微信扫码登录回调：前端拿到 code 后调本接口换取我方 JWT。
const wechatLoginSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});
router.post(
  '/wechat',
  authRateLimit,
  validateBody(wechatLoginSchema),
  asyncHandler(async (req, res) => {
    const result = await wechatAuthService.loginByCode(req.body.code);

    res.cookie(
      authConfig.refreshTokenCookieName,
      result.refreshToken,
      authConfig.refreshTokenCookieOptions,
    );

    res.json({
      success: true,
      data: { user: result.user, accessToken: result.accessToken },
    });
  }),
);

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
