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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
