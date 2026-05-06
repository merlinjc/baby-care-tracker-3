import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ErrorCodes } from '../types/errors';
import { getFamilyIdForUser } from '../utils/permission';
import { startOfDay, endOfDay } from '../utils/date';
import type {
  WeeklyTrendData,
  WeeklyTrendDimension,
  WeeklyTrendStatus,
  ReferenceRange,
} from '../types';

/**
 * FR-B（v4.3.2 修订）：本周/上周时间窗
 *
 * - 本周：本周一 00:00 → 今天 23:59:59（不足 7 天则按实际天数计算日均）
 * - 上周：上周一 00:00 → 上周日 23:59:59（完整 7 天）
 * - 起始时间不能早于宝宝出生日期；如果 birthDate 落在窗口内，会向后裁剪
 *   （日均 = 总量 / 实际有效天数；最少 1 天，避免除零）
 */
function computeWeekRanges(birthDate: Date, now: Date = new Date()): {
  thisWeekStart: Date;
  thisWeekEnd: Date;
  thisWeekDays: number;
  lastWeekStart: Date;
  lastWeekEnd: Date;
  lastWeekDays: number;
} {
  // 计算本周一 00:00（getDay: 0=Sun ... 6=Sat）
  const today = new Date(now);
  const day = today.getDay(); // 0..6
  const diffToMonday = (day + 6) % 7; // 周一为 0，周日为 6
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diffToMonday);

  // 上周一 = 本周一 - 7 天；上周日 23:59:59
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);
  const lastSunday = new Date(monday);
  lastSunday.setMilliseconds(-1); // = 本周一前一毫秒 = 上周日 23:59:59.999

  // 受 birthDate 限制
  const birthStart = startOfDay(birthDate);
  const thisWeekStart = monday.getTime() < birthStart.getTime() ? birthStart : monday;
  const lastWeekStart = lastMonday.getTime() < birthStart.getTime() ? birthStart : lastMonday;
  // 上周末同样不能早于 birthDate
  const lastWeekEnd = lastSunday.getTime() < birthStart.getTime() ? birthStart : lastSunday;

  // 本周结束 = "现在"（可能尚未到周日）
  const thisWeekEnd = endOfDay(today);

  // 实际天数（用于日均）：含起始日和结束日
  const dayMs = 24 * 60 * 60 * 1000;
  const thisWeekDays = Math.max(
    1,
    Math.ceil((endOfDay(today).getTime() - startOfDay(thisWeekStart).getTime() + 1) / dayMs)
  );
  const lastWeekDays = lastWeekEnd.getTime() <= lastWeekStart.getTime()
    ? 0
    : Math.max(
        1,
        Math.ceil((endOfDay(lastWeekEnd).getTime() - startOfDay(lastWeekStart).getTime() + 1) / dayMs)
      );

  return {
    thisWeekStart: startOfDay(thisWeekStart),
    thisWeekEnd,
    thisWeekDays,
    lastWeekStart: startOfDay(lastWeekStart),
    lastWeekEnd,
    lastWeekDays,
  };
}

/**
 * 月龄参考范围（FR-B2）
 * 数据来源：AAP/CDC（喂养）、NSF 2015/2025 + AASM 2016（睡眠）、
 * Baaleman 2023 系统综述 + AAFP POEMs 2024（排便）。详见 design.md §3.1。
 *
 * 月龄分档键值：表示「该月龄段及以下」匹配的最大月龄；查找时采用「向下取
 * 最近的键」策略（findMatchedKey）。
 */
const REFERENCE_RANGES: Record<string, Record<number, { min: number; max: number; unit: string }>> = {
  feeding: {
    1: { min: 8, max: 12, unit: '次/日' },
    3: { min: 6, max: 10, unit: '次/日' },
    6: { min: 5, max: 8, unit: '次/日' },
    12: { min: 4, max: 6, unit: '次/日' },
    24: { min: 3, max: 5, unit: '次/日' },
    999: { min: 3, max: 5, unit: '次/日' },
  },
  sleep: {
    1: { min: 14, max: 17, unit: '小时/日' },
    3: { min: 14, max: 17, unit: '小时/日' },
    6: { min: 12, max: 16, unit: '小时/日' },
    12: { min: 12, max: 15, unit: '小时/日' },
    24: { min: 11, max: 14, unit: '小时/日' },
    999: { min: 10, max: 13, unit: '小时/日' },
  },
  diaper: {
    1: { min: 3, max: 8, unit: '次/日' },
    3: { min: 2, max: 5, unit: '次/日' },
    6: { min: 1, max: 4, unit: '次/日' },
    12: { min: 1, max: 3, unit: '次/日' },
    999: { min: 1, max: 3, unit: '次/日' },
  },
};

/**
 * 提示语规则引擎（FR-B4，与小程序 S20 §FR-4 表对齐）
 */
const TIP_MESSAGES: Record<string, Record<WeeklyTrendStatus, string>> = {
  feeding: {
    normal: '喂养规律，保持即可 👍',
    low: '日均喂养略少，注意宝宝饥饿信号',
    high: '喂养频率偏高，可观察是否吃饱',
    very_low: '喂养次数明显偏少，建议关注',
    very_high: '频繁喂养，建议咨询是否需调整',
    no_data: '开始记录喂养，获取趋势分析',
    attention: '',
    medical_attention: '',
  },
  sleep: {
    normal: '睡眠充足，继续保持作息规律',
    low: '日均睡眠略低，关注夜间作息',
    high: '睡眠偏多，注意观察精神状态',
    very_low: '睡眠明显不足，建议改善睡眠环境',
    very_high: '嗜睡需关注，如持续请咨询医生',
    no_data: '开始记录睡眠，了解作息规律',
    attention: '',
    medical_attention: '',
  },
  diaper: {
    normal: '排便正常，消化良好',
    low: '排便次数略少，多注意饮食',
    high: '排便次数偏多，注意大便性状',
    very_low: '排便明显减少，如持续请咨询医生',
    very_high: '腹泻风险，注意补水和就医',
    no_data: '开始记录排便，跟踪消化情况',
    attention: '',
    medical_attention: '',
  },
  temperature: {
    normal: '体温正常，宝宝很健康',
    attention: '有体温偏高记录，注意观察',
    medical_attention: '多次发热，建议及时就医',
    no_data: '定期测量体温，关注健康状况',
    low: '',
    high: '',
    very_low: '',
    very_high: '',
  },
};

const DEVIATION_THRESHOLD = 0.3; // 30% 触发严重偏离

class TrendService {
  async getTrendData(userId: string, babyId: string, query: { type: string; period?: string }) {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    const now = new Date();
    let startDate: Date;
    const period = query.period || 'month';

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = baby.birthDate;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const typeMap: Record<string, string> = {
      weight: 'weight',
      height: 'height',
      headCircumference: 'headCircumference',
    };

    const fieldName = typeMap[query.type];
    if (!fieldName) {
      throw new NotFoundError('趋势类型');
    }

    const growthRecords = await prisma.record.findMany({
      where: {
        babyId,
        recordType: 'growth',
        startTime: { gte: startDate, lte: now },
      },
      include: { growthData: true },
      orderBy: { startTime: 'asc' },
    });

    const points = growthRecords
      .filter((r) => r.growthData && r.growthData[fieldName as keyof typeof r.growthData] !== null)
      .map((r) => ({
        date: r.startTime.toISOString(),
        value: r.growthData![fieldName as keyof typeof r.growthData] as number,
      }));

    return {
      type: query.type,
      points,
    };
  }

  /**
   * FR-B：本周趋势增强
   * 返回 4 维度（feeding/sleep/diaper/temperature）的智能状态 + 月龄参考 + 提示语 + 环比
   */
  async getEnhancedWeeklyTrend(userId: string, babyId: string): Promise<WeeklyTrendData> {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) {
      throw new NotFoundError('宝宝', ErrorCodes.BABY_NOT_FOUND);
    }

    const familyId = await getFamilyIdForUser(userId);
    if (!familyId || baby.familyId !== familyId) {
      throw new ForbiddenError('无权访问', ErrorCodes.PERMISSION_DENIED);
    }

    const ageMonths = computeAgeMonths(baby.birthDate);

    const now = new Date();
    const ranges = computeWeekRanges(baby.birthDate, now);

    const [thisWeek, lastWeek] = await Promise.all([
      this.aggregateWeek(babyId, baby.familyId, ranges.thisWeekStart, ranges.thisWeekEnd, ranges.thisWeekDays),
      ranges.lastWeekDays === 0
        ? Promise.resolve({ feedingAvg: 0, sleepHoursAvg: 0, diaperAvg: 0, tempAbnormal: 0, hasData: false })
        : this.aggregateWeek(babyId, baby.familyId, ranges.lastWeekStart, ranges.lastWeekEnd, ranges.lastWeekDays),
    ]);

    const enhance = (
      dim: 'feeding' | 'sleep' | 'diaper',
      thisAvg: number,
      lastAvg: number
    ): WeeklyTrendDimension => {
      const range = ageMonths >= 0 ? matchRange(REFERENCE_RANGES[dim], ageMonths) : null;
      const status = calculateStatus(thisAvg, range);
      return {
        thisWeekAvg: round(thisAvg),
        lastWeekAvg: round(lastAvg),
        range,
        status,
        tip: TIP_MESSAGES[dim][status] || '',
        changePercent: pctChange(thisAvg, lastAvg),
      };
    };

    const enhanceTemp = (thisAbnormal: number, lastAbnormal: number): WeeklyTrendDimension => {
      const status: WeeklyTrendStatus =
        thisAbnormal === 0 ? (thisAvgZero(thisWeek) ? 'no_data' : 'normal')
          : thisAbnormal <= 2 ? 'attention'
            : 'medical_attention';
      return {
        thisWeekAvg: thisAbnormal,
        lastWeekAvg: lastAbnormal,
        range: null,
        status,
        tip: TIP_MESSAGES.temperature[status] || '',
        changePercent: pctChange(thisAbnormal, lastAbnormal),
      };
    };

    return {
      feeding: enhance('feeding', thisWeek.feedingAvg, lastWeek.feedingAvg),
      sleep: enhance('sleep', thisWeek.sleepHoursAvg, lastWeek.sleepHoursAvg),
      diaper: enhance('diaper', thisWeek.diaperAvg, lastWeek.diaperAvg),
      temperature: enhanceTemp(thisWeek.tempAbnormal, lastWeek.tempAbnormal),
      period: {
        start: ranges.thisWeekStart.toISOString(),
        end: ranges.thisWeekEnd.toISOString(),
      },
      lastWeekPeriod: ranges.lastWeekDays === 0
        ? null
        : {
            start: ranges.lastWeekStart.toISOString(),
            end: ranges.lastWeekEnd.toISOString(),
          },
      ageMonths,
    };
  }

  /**
   * 单周聚合：返回 4 维度日均值 + 体温异常次数
   *
   * @param days 实际天数（由调用方根据"窗口起止 + birthDate 裁剪"得出，调用方负责保证 ≥ 1）
   */
  private async aggregateWeek(
    babyId: string,
    familyId: string,
    start: Date,
    end: Date,
    days: number
  ): Promise<{
    feedingAvg: number;
    sleepHoursAvg: number;
    diaperAvg: number;
    tempAbnormal: number;
    hasData: boolean;
  }> {
    const safeDays = Math.max(1, days);
    const records = await prisma.record.findMany({
      where: {
        babyId,
        familyId,
        startTime: { gte: start, lte: end },
      },
      include: {
        feedingData: true,
        sleepData: true,
        diaperData: true,
        temperatureData: true,
      },
    });

    let feedingCount = 0;
    let sleepDurationSec = 0;
    let diaperCount = 0;
    let tempAbnormal = 0;

    for (const r of records) {
      switch (r.recordType) {
        case 'feeding':
          feedingCount++;
          break;
        case 'sleep':
          sleepDurationSec += r.sleepData?.duration ?? 0;
          break;
        case 'diaper':
          diaperCount++;
          break;
        case 'temperature':
          if ((r.temperatureData?.temperature ?? 0) >= 37.5) tempAbnormal++;
          break;
      }
    }

    return {
      feedingAvg: feedingCount / safeDays,
      sleepHoursAvg: sleepDurationSec / 3600 / safeDays,
      diaperAvg: diaperCount / safeDays,
      tempAbnormal,
      hasData: records.length > 0,
    };
  }
}

// ============ Helpers ============

function computeAgeMonths(birthDate: Date): number {
  const now = new Date();
  const start = startOfDay(birthDate);
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
}

function matchRange(
  table: Record<number, { min: number; max: number; unit: string }>,
  ageMonths: number
): ReferenceRange {
  const keys = Object.keys(table)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  for (const k of keys) {
    if (ageMonths <= k) {
      const r = table[k];
      return { min: r.min, max: r.max, unit: r.unit };
    }
  }
  // fallback: 最末档
  const last = table[keys[keys.length - 1]];
  return { min: last.min, max: last.max, unit: last.unit };
}

function calculateStatus(value: number, range: ReferenceRange | null): WeeklyTrendStatus {
  if (!range) return value === 0 ? 'no_data' : 'normal';
  if (value === 0) return 'no_data';
  if (value >= range.min && value <= range.max) return 'normal';
  if (value < range.min) {
    const dev = (range.min - value) / range.min;
    return dev > DEVIATION_THRESHOLD ? 'very_low' : 'low';
  }
  // value > range.max
  const dev = (value - range.max) / range.max;
  return dev > DEVIATION_THRESHOLD ? 'very_high' : 'high';
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function thisAvgZero(week: { feedingAvg: number; sleepHoursAvg: number; diaperAvg: number }): boolean {
  return week.feedingAvg === 0 && week.sleepHoursAvg === 0 && week.diaperAvg === 0;
}

export const trendService = new TrendService();
