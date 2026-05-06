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

export const trendQuerySchema = z.object({
  type: z.enum(['weight', 'height', 'headCircumference'], { message: '趋势类型无效' }),
  period: z.enum(['week', 'month', '3months', '6months', 'year', 'all']).default('month'),
});

export const exportQuerySchema = z.object({
  babyId: z.string().min(1, '宝宝ID不能为空'),
  format: z.enum(['csv', 'json'], { message: '导出格式无效' }),
  recordType: z.enum(['feeding', 'sleep', 'diaper', 'temperature', 'growth']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
