import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('邮箱格式无效').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式无效').optional(),
  password: z.string()
    .min(8, '密码至少8位')
    .max(32, '密码最多32位')
    .regex(/[a-zA-Z]/, '密码需包含字母')
    .regex(/[0-9]/, '密码需包含数字'),
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符'),
}).refine((data) => data.email || data.phone, {
  message: '邮箱和手机号至少提供一个',
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式无效').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式无效').optional(),
  password: z.string().min(1, '密码不能为空'),
}).refine((data) => data.email || data.phone, {
  message: '邮箱和手机号至少提供一个',
});

/**
 * 用户偏好的部分更新 schema（v7.2+ T-S1-INF-01）。
 *
 * 服务端按"顶层 key 级别"的深合并语义处理这段对象：
 * - 客户端只需传想要修改的子集，未传的 key 保留原值；
 * - 已知键有严格类型校验；未知键透传（`.passthrough()`），便于前后端跨版本演进；
 * - 显式传 `null` 表示删除该键（service 层按未定义处理：保留原值）；
 *   如需"清空"，请用合理的默认值（如 `lang: 'zh-CN'`、`onboardingCompleted: false`）。
 */
export const userPreferencesPatchSchema = z
  .object({
    onboardingCompleted: z.boolean().optional(),
    onboardingSkippedSteps: z.array(z.string().max(64)).max(20).optional(),
    lang: z.string().min(2).max(16).optional(),
    langManuallySet: z.boolean().optional(),
    fontScale: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
    themeMode: z.enum(['light', 'warm-night', 'system']).optional(),
  })
  .passthrough();

export const updateProfileSchema = z.object({
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符').optional(),
  avatar: z.string().url('头像URL格式无效').optional(),
  /** v7.2+ 用户偏好部分更新（顶层 key 深合并语义，详见 userPreferencesPatchSchema） */
  preferences: userPreferencesPatchSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string()
    .min(8, '新密码至少8位')
    .max(32, '新密码最多32位')
    .regex(/[a-zA-Z]/, '新密码需包含字母')
    .regex(/[0-9]/, '新密码需包含数字'),
});
