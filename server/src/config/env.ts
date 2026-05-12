import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(8).default('dev-secret-key-not-for-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // OpenAI 兼容端点（默认走 TokenHub · hy3-preview）
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://tokenhub.tencentmaas.com/v1'),
  OPENAI_MODEL: z.string().default('hy3-preview'),
  AI_DAILY_QUOTA: z.coerce.number().int().positive().default(100),
  AI_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  // 微信开放平台「网站应用」OAuth2 配置；缺失时 /api/auth/wechat 直接返回 WECHAT_NOT_CONFIGURED
  WECHAT_WEB_APP_ID: z.string().optional(),
  WECHAT_WEB_APP_SECRET: z.string().optional(),
  // 腾讯云 COS 对象存储（v7.2 T-S1-INF-02，方案 B 服务端代理模式）：
  // 用于头像 / 每日打卡照片等图片上传与下载；任一字段缺失时
  // /api/uploads 返回 503 UPLOAD_NOT_CONFIGURED，前端 ImageUploader 优雅降级。
  // 桶强制设为「私有读私有写」：所有读写经 Express 代理，密钥不暴露给客户端。
  COS_SECRET_ID: z.string().optional(),
  COS_SECRET_KEY: z.string().optional(),
  COS_BUCKET: z.string().optional(),
  COS_REGION: z.string().optional(),
  /**
   * 服务端 putObject 时校验单个文件最大字节数（额外的服务端兜底，
   * 客户端会先压缩到 ~1MB；超过此阈值 → 413 PAYLOAD_TOO_LARGE）。
   * 默认 2MB（给客户端压缩留 2x 余量）。
   */
  COS_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  /**
   * 下载代理响应的 Cache-Control max-age（秒），默认 86400（1 天）。
   * 由于 key 32 字符不可枚举，可大胆开启浏览器/CDN 缓存。
   * 设为 0 禁用缓存。
   */
  COS_DOWNLOAD_CACHE_MAX_AGE: z.coerce.number().int().min(0).default(86400),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
