import { z } from 'zod';

// Accepts both date-only (2024-06-15) and datetime (2024-06-15T00:00:00Z) formats
const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
  '出生日期格式无效',
);

export const createBabySchema = z.object({
  familyId: z.string().min(1, '家庭ID不能为空'),
  name: z.string().min(1, '姓名不能为空').max(20, '姓名最多20字符'),
  gender: z.enum(['male', 'female'], { message: '性别无效' }),
  birthDate: dateStringSchema,
  avatar: z.string().url('头像URL格式无效').optional(),
});

export const updateBabySchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(20, '姓名最多20字符').optional(),
  gender: z.enum(['male', 'female'], { message: '性别无效' }).optional(),
  birthDate: dateStringSchema.optional(),
  avatar: z.string().url('头像URL格式无效').optional(),
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
