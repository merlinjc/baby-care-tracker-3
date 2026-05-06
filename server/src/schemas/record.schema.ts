import { z } from 'zod';

const feedingDataSchema = z.object({
  feedingType: z.enum(['breast', 'formula', 'solid']),
  amount: z.number().positive().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  breastSide: z.enum(['left', 'right', 'both']).nullable().optional(),
});

const sleepDataSchema = z.object({
  sleepType: z.enum(['night', 'nap']),
  duration: z.number().int().positive(),
  location: z.string().max(50).nullable().optional(),
});

const diaperDataSchema = z.object({
  diaperType: z.enum(['pee', 'poop', 'both']),
  consistency: z.enum(['watery', 'soft', 'formed', 'hard']).nullable().optional(),
  color: z.enum(['normal', 'yellow', 'green', 'black', 'red']).nullable().optional(),
});

const temperatureDataSchema = z.object({
  temperature: z.number().positive(),
  method: z.enum(['oral', 'axillary', 'rectal', 'ear']).nullable().optional(),
});

const growthDataSchema = z.object({
  height: z.number().positive().nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  headCircumference: z.number().positive().nullable().optional(),
});

export const createRecordSchema = z.object({
  babyId: z.string().min(1, '宝宝ID不能为空'),
  recordType: z.enum(['feeding', 'sleep', 'diaper', 'temperature', 'growth']),
  startTime: z.string().datetime('开始时间格式无效'),
  endTime: z.string().datetime('结束时间格式无效').nullable().optional(),
  note: z.string().max(500, '备注最多500字符').nullable().optional(),
  feedingData: feedingDataSchema.optional(),
  sleepData: sleepDataSchema.optional(),
  diaperData: diaperDataSchema.optional(),
  temperatureData: temperatureDataSchema.optional(),
  growthData: growthDataSchema.optional(),
}).refine((data) => {
  // Validate that the correct data is provided for the record type
  switch (data.recordType) {
    case 'feeding': return !!data.feedingData;
    case 'sleep': return !!data.sleepData;
    case 'diaper': return !!data.diaperData;
    case 'temperature': return !!data.temperatureData;
    case 'growth': return !!data.growthData;
  }
}, {
  message: '请提供与记录类型对应的数据',
});

export const updateRecordSchema = z.object({
  startTime: z.string().datetime('开始时间格式无效').optional(),
  endTime: z.string().datetime('结束时间格式无效').nullable().optional(),
  note: z.string().max(500, '备注最多500字符').nullable().optional(),
  feedingData: feedingDataSchema.optional(),
  sleepData: sleepDataSchema.optional(),
  diaperData: diaperDataSchema.optional(),
  temperatureData: temperatureDataSchema.optional(),
  growthData: growthDataSchema.optional(),
});

export const getRecordsQuerySchema = z
  .object({
    babyId: z.string().min(1, '宝宝ID不能为空'),
    recordType: z.enum(['feeding', 'sleep', 'diaper', 'temperature', 'growth']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    orderBy: z.enum(['startTime', 'endTime', 'createdAt', 'updatedAt']).default('startTime'),
    order: z.enum(['asc', 'desc']).default('desc'),
    /** FR-A1：'true' 仅返回进行中（endTime=null）记录，与 startDate/endDate 互斥 */
    endTimeIsNull: z.enum(['true', 'false']).optional(),
  })
  .refine(
    (data) =>
      !data.endTimeIsNull || (data.startDate === undefined && data.endDate === undefined),
    {
      message: 'endTimeIsNull 与日期范围不可同时使用',
      path: ['endTimeIsNull'],
    }
  );

export const todayStatsQuerySchema = z.object({
  babyId: z.string().min(1, '宝宝ID不能为空'),
});
