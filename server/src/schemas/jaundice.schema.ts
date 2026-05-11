/**
 * jaundice.schema.ts - 黄疸记录请求 schema（v7.2 T-S1-F2-01）
 *
 * 原始客户端字段 → 服务端 prisma 字段映射约定（client lib/jaundice 与 server JaundiceRecord）：
 *   client.date         <-> recordDate  （ISO 字符串；服务端落 UTC Date）
 *   client.ageDays      <-> dayAge
 *   client.scleraYellow <-> scleralIcterus
 *   client.jaundiceType <-> category
 *   client.symptoms[]   <-> symptoms     （JSON 字符串）
 *   client.actions[]    <-> treatments   （JSON 字符串）
 *
 * 这里不做任何字段名转换，**坚持 server 一律使用 prisma 字段名**，
 * 客户端在 services/jaundice.ts 内部做 client→server / server→client 映射，
 * 与 vaccine / record 的 dual-format 约定保持一致。
 */
import { z } from 'zod';

const KRAMER_ZONE = z.number().int().min(1).max(5);
const CATEGORY = z.enum(['physiologic', 'pathologic', 'breast_milk']);

const isoDateSchema = z
  .string()
  .min(1, 'recordDate 不能为空')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), '日期格式无效');

/** 创建黄疸记录 body 校验 */
export const createJaundiceSchema = z.object({
  recordDate: isoDateSchema,
  dayAge: z.number().int().positive().max(3650).optional(),
  kramerZone: KRAMER_ZONE.nullable().optional(),
  scleralIcterus: z.boolean().optional(),
  tcb: z.number().min(0).max(50).optional(),
  tsb: z.number().min(0).max(50).optional(),
  category: CATEGORY.nullable().optional(),
  /** 伴随表现：每项最长 32 字符，最多 20 项 */
  symptoms: z.array(z.string().min(1).max(32)).max(20).optional(),
  /** 处置：每项最长 32 字符，最多 20 项 */
  treatments: z.array(z.string().min(1).max(32)).max(20).optional(),
  note: z.string().max(500).optional(),
});

/** 更新黄疸记录 body 校验：所有字段可选；至少一个字段（前端不会传空，这里也兜底） */
export const updateJaundiceSchema = z
  .object({
    recordDate: isoDateSchema.optional(),
    dayAge: z.number().int().positive().max(3650).nullable().optional(),
    kramerZone: KRAMER_ZONE.nullable().optional(),
    scleralIcterus: z.boolean().nullable().optional(),
    tcb: z.number().min(0).max(50).nullable().optional(),
    tsb: z.number().min(0).max(50).nullable().optional(),
    category: CATEGORY.nullable().optional(),
    symptoms: z.array(z.string().min(1).max(32)).max(20).optional(),
    treatments: z.array(z.string().min(1).max(32)).max(20).optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: '至少更新一个字段' });

/** GET 列表 query：可选 startDate / endDate（闭区间），按 recordDate 倒序，默认 100 条 */
export const listJaundiceQuerySchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    limit: z.coerce.number().int().positive().max(500).default(100),
  })
  .refine(
    (q) => {
      if (q.startDate && q.endDate) {
        return new Date(q.startDate).getTime() <= new Date(q.endDate).getTime();
      }
      return true;
    },
    { message: 'startDate 不能晚于 endDate' },
  );

export const jaundiceIdParamSchema = z.object({
  id: z.string().min(1, '宝宝ID不能为空'),
  recordId: z.string().min(1, '记录ID不能为空'),
});

export type CreateJaundiceInput = z.infer<typeof createJaundiceSchema>;
export type UpdateJaundiceInput = z.infer<typeof updateJaundiceSchema>;
export type ListJaundiceQuery = z.infer<typeof listJaundiceQuerySchema>;
