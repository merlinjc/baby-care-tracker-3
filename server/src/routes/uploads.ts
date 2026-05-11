/**
 * uploads.ts - 文件上传相关路由（v7.2 T-S1-INF-02）
 *
 * 端点：
 * - POST /api/uploads/presign  申请预签名 PUT URL（直传 COS）
 *
 * 鉴权：所有端点强制 authenticate；presign 限流 20 次/分钟/用户
 *
 * 流程（前端视角）：
 * 1. 选图 + 压缩（client/services/upload.ts）
 * 2. POST /api/uploads/presign → 拿到 { uploadUrl, publicUrl, key, expiresAt }
 * 3. fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } })
 * 4. 业务接口落库 publicUrl（PATCH /auth/profile { avatar } / 等）
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { presignRateLimit } from '../middleware/rate-limit-persistent';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { uploadService } from '../services/upload.service';
import { presignRequestSchema } from '../schemas/upload.schema';

const router = Router();

// POST /api/uploads/presign
router.post(
  '/presign',
  authenticate,
  presignRateLimit,
  validateBody(presignRequestSchema),
  asyncHandler(async (req, res) => {
    const { kind, ext, babyId, familyId, date } = req.body;
    const result = await uploadService.createPresignedUpload(
      req.userId!,
      kind,
      ext,
      { babyId, familyId, date },
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

export default router;
