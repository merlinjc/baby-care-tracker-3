/**
 * daily-checkin.schema.ts - 每日打卡请求 schema（v7.2 T-S2-F11-BE-02）
 *
 * 字段约定（与 shared/types#DailyCheckin 对齐）：
 * - checkinDate：YYYY-MM-DD（本地时区），后端不做时区换算，按字符串落库
 * - photoKey：COS 对象 key，必须以 `checkins/` 开头（与 INF-02 upload service 对齐）
 * - caption：≤ 200 字
 * - aiSummary：编辑路径上前端可传，后端会同时把 aiSummaryAt 置 null（路由层处理）
 *
 * 注意：date 是否在 [today-7d, today] 区间由 service 层校验（依赖业务时钟），
 * 这里只做格式 / 长度校验。
 */
import { z } from 'zod';

const YMD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkinDate 必须是 YYYY-MM-DD 格式')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, 'checkinDate 不是合法日期');

/** photoKey 必须落在 checkins/ 前缀下，与 upload service 的 key 规则对齐 */
const PHOTO_KEY = z
  .string()
  .min(1, 'photoKey 不能为空')
  .max(256, 'photoKey 过长')
  .regex(/^checkins\//, 'photoKey 必须以 checkins/ 开头')
  .refine((s) => !s.includes('..') && !s.includes('\\'), 'photoKey 包含非法字符');

const CAPTION = z.string().max(200, 'caption 不能超过 200 字');

export const createCheckinSchema = z.object({
  checkinDate: YMD,
  photoKey: PHOTO_KEY,
  photoWidth: z.number().int().positive().max(20000).optional(),
  photoHeight: z.number().int().positive().max(20000).optional(),
  caption: CAPTION.optional(),
});

export const updateCheckinSchema = z
  .object({
    photoKey: PHOTO_KEY.optional(),
    photoWidth: z.number().int().positive().max(20000).optional(),
    photoHeight: z.number().int().positive().max(20000).optional(),
    caption: CAPTION.nullable().optional(),
    aiSummary: z.string().max(4000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: '至少更新一个字段' });

export const listCheckinQuerySchema = z
  .object({
    startDate: YMD.optional(),
    endDate: YMD.optional(),
  })
  .refine(
    (q) => !(q.startDate && q.endDate) || q.startDate <= q.endDate,
    { message: 'startDate 不能晚于 endDate' },
  );

export const checkinDateParamSchema = z.object({
  id: z.string().min(1, '宝宝ID不能为空'),
  date: YMD,
});

const ROLE_VALUES = [
  'mom',
  'dad',
  'grandma_m',
  'grandma_p',
  'grandpa_m',
  'grandpa_p',
  'nanny',
  'other',
] as const;

/** AI 小记生成 body：仅传可选 role；prompt 上下文由 service 自取 */
export const aiSummaryBodySchema = z
  .object({
    role: z.enum(ROLE_VALUES).optional(),
  })
  .strict();

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;
export type UpdateCheckinInput = z.infer<typeof updateCheckinSchema>;
export type ListCheckinQuery = z.infer<typeof listCheckinQuerySchema>;
export type AiSummaryBody = z.infer<typeof aiSummaryBodySchema>;
