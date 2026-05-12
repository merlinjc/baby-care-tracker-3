/**
 * uploads.ts - 文件上传 / 下载代理路由（v7.2 T-S1-INF-02 方案 B 服务端代理）
 *
 * 端点：
 * - POST /api/uploads          上传图片（multipart/form-data）
 * - GET  /api/uploads/*        下载图片（流式代理 COS getObject）
 *
 * 鉴权与限流：
 * - 上传强制 authenticate + presignRateLimit（20 次/分钟/用户）
 * - 下载只校验 JWT 即可（业务层暂时不做按家庭隔离；32 字符 hex 不可枚举已是基础防护）
 *
 * 关键设计：
 * - 上传走 multer memoryStorage（单图 ≤ 2MB，全量进内存后调 putObject）
 *   超过此阈值时 multer 直接 413 LIMIT_FILE_SIZE，不会进 service 层
 * - 下载用 getObjectStream，pipe 到 res，零内存累积
 * - 缓存：Cache-Control: public, max-age={COS_DOWNLOAD_CACHE_MAX_AGE} —
 *   key 32 字符 hex 不会复用，可大胆开缓存
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { presignRateLimit } from '../middleware/rate-limit-persistent';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { uploadService } from '../services/upload.service';
import { uploadFieldsSchema } from '../schemas/upload.schema';
import { env } from '../config/env';
import {
  BadRequestError,
  ErrorCodes,
} from '../types/errors';

const router = Router();

// ─── multer 配置 ──────────────────────────────────────────────────────
// memoryStorage：文件写入 Buffer，避免 disk 临时文件（小文件场景，单图 ~1MB）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // 单文件最大字节数（与 service 层 COS_MAX_UPLOAD_BYTES 一致）
    fileSize: env.COS_MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // mimetype 白名单（防 multipart 提交可执行文件）
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(
        `不支持的 mimetype：${file.mimetype}`,
        ErrorCodes.UPLOAD_INVALID_EXT,
      ));
    }
  },
});

// 把 multer 的 LIMIT_FILE_SIZE 转换为我们的标准 BadRequestError
function multerErrorHandler(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError(
        `文件过大，超过 ${env.COS_MAX_UPLOAD_BYTES} 字节限制`,
        ErrorCodes.UPLOAD_TOO_LARGE,
      ));
    }
    return next(new BadRequestError(`上传失败：${err.message}`, ErrorCodes.INVALID_PARAMS));
  }
  return next(err);
}

// ─── POST /api/uploads ─ 上传图片 ──────────────────────────────────────
router.post(
  '/',
  authenticate,
  presignRateLimit,
  upload.single('file'),
  multerErrorHandler,
  // form fields 校验（从 req.body 读，multer 会把 fields 放到 body）
  validateBody(uploadFieldsSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new BadRequestError('未提供文件，字段名应为 file', ErrorCodes.INVALID_PARAMS);
    }

    const { kind, ext, babyId, familyId, date } = req.body as {
      kind: 'avatar' | 'baby-avatar' | 'daily-checkin';
      ext: string;
      babyId?: string;
      familyId?: string;
      date?: string;
    };

    const result = await uploadService.putObject(
      req.userId!,
      kind,
      ext,
      req.file.buffer,
      { babyId, familyId, date },
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

// ─── GET /api/uploads/* ─ 下载代理 ─────────────────────────────────────
// 用 /* 通配符接收完整 key（含 / 分隔符），如 /api/uploads/avatars/u1/abc.jpg
// Express 4：req.params[0] 即 * 匹配的剩余路径。
router.get(
  '/*',
  authenticate,
  asyncHandler(async (req, res) => {
    // Express 4 把通配符匹配的内容放在 req.params[0]
    const key = (req.params as Record<string, string>)[0];

    if (!key) {
      throw new BadRequestError('缺少对象 key', ErrorCodes.INVALID_PARAMS);
    }

    const { stream, contentType, contentLength } = await uploadService.getObjectStream(key);

    res.setHeader('Content-Type', contentType);
    if (contentLength !== undefined) {
      res.setHeader('Content-Length', String(contentLength));
    }

    // key 32 字符 hex 不会复用（用户换头像生成新 key），可开长缓存
    if (env.COS_DOWNLOAD_CACHE_MAX_AGE > 0) {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${env.COS_DOWNLOAD_CACHE_MAX_AGE}, immutable`,
      );
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    // 流式转发，stream 错误也要兜底
    stream.on('error', (err) => {
      // 已经发响应头时只能 destroy
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_ERROR', message: (err as Error).message ?? '下载失败' },
        });
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  }),
);

export default router;
