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
  // 腾讯云 COS 对象存储（v7.2 T-S1-INF-02）：用于头像 / 每日打卡照片上传。
  // 任一字段缺失时 /api/uploads/presign 返回 503 UPLOAD_NOT_CONFIGURED，
  // 前端 ImageUploader 优雅降级（默认头像 / 提示用户联系管理员），不阻塞主流程。
  COS_SECRET_ID: z.string().optional(),
  COS_SECRET_KEY: z.string().optional(),
  COS_BUCKET: z.string().optional(),
  COS_REGION: z.string().optional(),
  /**
   * 公开访问基础 URL（可选）。
   * - 不填 → 自动用 https://{bucket}.cos.{region}.myqcloud.com（默认 COS 域名）
   * - 配 CDN 加速时填 https://your-cdn.example.com，落库 publicUrl 自动用 CDN 域名
   */
  COS_PUBLIC_BASE_URL: z.string().url().optional(),
  /** presign 有效期（秒），默认 300（5 分钟），范围 60-3600 */
  COS_PRESIGN_EXPIRES: z.coerce.number().int().min(60).max(3600).default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
