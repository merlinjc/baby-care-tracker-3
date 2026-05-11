import { z } from 'zod';

export const vaccineSchema = z.object({
  name: z.string().min(1, '疫苗名称不能为空'),
  dose: z.string().min(1, '剂次不能为空'),
  vaccinatedDate: z.string().datetime('接种日期格式无效'),
  note: z.string().max(500).optional(),
});

export const milestoneSchema = z.object({
  name: z.string().min(1, '里程碑名称不能为空'),
  category: z.string().min(1, '分类不能为空'),
  achievedDate: z.string().datetime('达成日期格式无效'),
  note: z.string().max(500).optional(),
});

export const updateMilestoneSchema = z.object({
  achievedDate: z.string().datetime('达成日期格式无效').optional(),
  note: z.string().max(500).nullable().optional(),
}).refine((d) => d.achievedDate !== undefined || d.note !== undefined, {
  message: '至少更新一个字段',
});

export const trendQuerySchema = z.object({
  type: z.enum(['weight', 'height', 'headCircumference'], { message: '趋势类型无效' }),
  period: z.enum(['week', 'month', '3months', '6months', 'year', 'all']).default('month'),
});

/**
 * 导出可选数据类型枚举（v7.2 T-S1-F3 扩充）
 *
 * - feeding / sleep / diaper / temperature / growth：Record 表 5 个子类型
 * - vaccine / milestone：独立表
 * - jaundice：v7.2 T-S1-F2 引入的独立表
 *
 * 不支持的值由 zod 拒绝（400 INVALID_PARAMS）。
 */
export const EXPORT_DATA_TYPES = [
  'feeding',
  'sleep',
  'diaper',
  'temperature',
  'growth',
  'vaccine',
  'milestone',
  'jaundice',
] as const;

export type ExportDataType = (typeof EXPORT_DATA_TYPES)[number];

export const exportQuerySchema = z.object({
  babyId: z.string().min(1, '宝宝ID不能为空'),
  format: z.enum(['csv', 'json'], { message: '导出格式无效' }),
  /**
   * v7.2+ 多选数据类型（逗号分隔字符串）。
   *
   * 例如：`types=feeding,sleep,vaccine`。
   * 留空 / 不传 → 默认导出 5 个 Record 子类型（保持 v7.1 行为）。
   *
   * 与历史 `recordType` 单选参数互斥：若同时传，优先 types，recordType 被忽略。
   */
  types: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })
    .pipe(
      z
        .array(z.enum(EXPORT_DATA_TYPES))
        .min(1, '至少选择一种数据类型')
        .max(EXPORT_DATA_TYPES.length, '数据类型超出范围')
        .optional(),
    ),
  /** @deprecated v7.2+ 改用 types；保留以兼容旧前端 */
  recordType: z
    .enum(['feeding', 'sleep', 'diaper', 'temperature', 'growth'])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * v7.2 T-S1-INF-02 方案 B：DB 中的 avatar 字段语义从"绝对 URL"改为"桶内 key"。
 *
 * - 新数据：以 `avatars/` / `babies/` 开头的 COS 对象 key（如 `avatars/u1/abc.jpg`）
 * - 历史数据：完整 http(s):// URL（兼容存量、便于回滚）
 * - 接口允许传 null / 空串，表示"清除头像"（业务侧自行处理空值落库）
 *
 * 校验策略：长度 ≤ 512 + 必须满足以下任一形态：
 *   1) 以 avatars/ / babies/ / checkins/ 开头的 key（与 server/src/services/upload.service.ts#isValidKey 对齐）
 *   2) http(s):// URL
 *
 * 用 `superRefine` 而不是 `union([z.string().url(), z.string().regex(...)])`，
 * 可以一次给出明确错误信息且 zod 输出更稳定。
 */
const KEY_PREFIX_REGEX = /^(avatars|babies|checkins)\//;
const HTTP_URL_REGEX = /^https?:\/\//i;

export const avatarRefSchema = z
  .string()
  .max(512, '头像引用过长')
  .superRefine((val, ctx) => {
    if (val.length === 0) return; // 允许空串=清除
    if (val.includes('..') || val.includes('\\')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '头像引用包含非法字符' });
      return;
    }
    if (KEY_PREFIX_REGEX.test(val)) return;
    if (HTTP_URL_REGEX.test(val)) {
      // 进一步用原生 URL 验证防止 `http://` 这种半成品
      try {
        new URL(val);
        return;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '头像 URL 格式无效' });
        return;
      }
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '头像引用必须为 COS 对象 key 或 http(s) URL',
    });
  });
