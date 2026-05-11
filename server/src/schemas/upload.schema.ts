/**
 * upload schemas - 文件上传相关请求体校验（v7.2 T-S1-INF-02）
 */
import { z } from 'zod';

/**
 * POST /api/uploads/presign 请求体。
 *
 * 严格校验：
 * - kind 三选一（白名单）
 * - ext 仅允许 jpg/jpeg/png/webp（service 层会再 normalize 一次）
 * - 上下文字段：service 按 kind 进一步校验必填（zod 这里只做格式校验）
 */
export const presignRequestSchema = z.object({
  kind: z.enum(['avatar', 'baby-avatar', 'daily-checkin']),
  ext: z
    .string()
    .min(2)
    .max(8)
    .regex(/^\.?[a-zA-Z0-9]+$/, '扩展名格式无效'),
  // 上下文（按 kind 不同字段必填，service 内会再校验）
  babyId: z.string().min(1).max(64).optional(),
  familyId: z.string().min(1).max(64).optional(),
  /** YYYY-MM-DD 日期；service 会再 regex 校验一次 */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date 必须为 YYYY-MM-DD 格式')
    .optional(),
});

export type PresignRequestBody = z.infer<typeof presignRequestSchema>;
