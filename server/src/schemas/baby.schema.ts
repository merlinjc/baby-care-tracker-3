import { z } from 'zod';
import { avatarRefSchema } from './common.schema';

// 接受 date-only (2024-06-15) 或 datetime (2024-06-15T00:00:00Z) 两种格式
// 同时校验：可解析、不晚于当前日期（同一日合法）、不早于 1900-01-01（防误录与历史数据异常）
const MIN_BIRTH_DATE_MS = Date.UTC(1900, 0, 1); // 1900-01-01 UTC

const dateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
    '出生日期格式无效',
  )
  .refine((s) => !Number.isNaN(new Date(s).getTime()), {
    message: '出生日期无法解析',
  })
  .refine(
    (s) => {
      // 仅取日期部分比较（忽略时区差异）：与"今天 23:59:59 本地"比，避免跨时区误伤
      const ms = new Date(s).getTime();
      // 容忍未来 24h（夏令时 / 客户端时钟偏移），超过则拒绝
      return ms <= Date.now() + 24 * 60 * 60 * 1000;
    },
    { message: '出生日期不能晚于今天' },
  )
  .refine((s) => new Date(s).getTime() >= MIN_BIRTH_DATE_MS, {
    message: '出生日期不能早于 1900-01-01',
  });

export const createBabySchema = z.object({
  familyId: z.string().min(1, '家庭ID不能为空'),
  name: z.string().min(1, '姓名不能为空').max(20, '姓名最多20字符'),
  gender: z.enum(['male', 'female'], { message: '性别无效' }),
  birthDate: dateStringSchema,
  /** v7.2 INF-02 方案 B：接受 COS 对象 key（babies/...）或历史 http(s) URL */
  avatar: avatarRefSchema.optional(),
});

export const updateBabySchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(20, '姓名最多20字符').optional(),
  gender: z.enum(['male', 'female'], { message: '性别无效' }).optional(),
  birthDate: dateStringSchema.optional(),
  /** v7.2 INF-02 方案 B：接受 COS 对象 key（babies/...）或历史 http(s) URL */
  avatar: avatarRefSchema.optional(),
});

export const deleteBabySchema = z.object({
  familyId: z.string().min(1, '家庭ID不能为空'),
});

export const babyIdParamSchema = z.object({
  id: z.string().min(1, '宝宝ID不能为空'),
});

export const babiesQuerySchema = z.object({
  familyId: z.string().min(1, '家庭ID不能为空'),
});
