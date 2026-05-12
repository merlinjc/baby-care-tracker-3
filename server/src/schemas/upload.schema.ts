/**
 * upload schemas - 文件上传相关请求体校验（v7.2 T-S1-INF-02 方案 B）
 *
 * 上传走 multipart/form-data，由 multer 处理 file，
 * 业务字段（kind/ext/babyId/familyId/date）以 form fields 形式传入。
 * 校验由 service 层负责（normalizeExt + validateContext），
 * route 层只做 multer 文件大小限制 + multer 文件类型 mime 白名单。
 */
import { z } from 'zod';

/**
 * POST /api/uploads 的 form fields 校验（不含 file，file 由 multer 处理）。
 *
 * 注意：multipart/form-data 中所有字段都是 string，所以这里全部用 z.string()。
 * service 层会进一步做语义校验。
 */
export const uploadFieldsSchema = z.object({
  kind: z.enum(['avatar', 'baby-avatar', 'daily-checkin']),
  ext: z
    .string()
    .min(2)
    .max(8)
    .regex(/^\.?[a-zA-Z0-9]+$/, '扩展名格式无效'),
  babyId: z.string().min(1).max(64).optional(),
  familyId: z.string().min(1).max(64).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date 必须为 YYYY-MM-DD 格式')
    .optional(),
});

export type UploadFields = z.infer<typeof uploadFieldsSchema>;
