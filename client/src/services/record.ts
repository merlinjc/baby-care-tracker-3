import api from './api';
import type { CareRecord, RecordType, RecordQueryParams, TodayStats, PaginatedResponse } from '@baby-care-tracker/shared';

export interface ExtendedRecordQueryParams extends RecordQueryParams {
  /** FR-A1：'true' 仅查 endTime=null（进行中睡眠），'false' 仅查已结束 */
  endTimeIsNull?: 'true' | 'false';
}

export const recordApi = {
  getRecords: async (params: ExtendedRecordQueryParams): Promise<PaginatedResponse<CareRecord>> => {
    const res = await api.get('/records', { params });
    return res.data.data;
  },

  getRecord: async (id: string): Promise<CareRecord> => {
    const res = await api.get(`/records/${id}`);
    return res.data.data.record;
  },

  createRecord: async (data: {
    babyId: string;
    recordType: RecordType;
    startTime: string;
    endTime?: string | null;
    note?: string;
    feedingData?: Record<string, unknown>;
    sleepData?: Record<string, unknown>;
    diaperData?: Record<string, unknown>;
    temperatureData?: Record<string, unknown>;
    growthData?: Record<string, unknown>;
  }): Promise<CareRecord> => {
    const res = await api.post('/records', data);
    return res.data.data.record;
  },

  updateRecord: async (id: string, data: Partial<CareRecord>): Promise<CareRecord> => {
    const res = await api.patch(`/records/${id}`, data);
    return res.data.data.record;
  },

  deleteRecord: async (id: string): Promise<void> => {
    await api.delete(`/records/${id}`);
  },

  getTodayStats: async (babyId: string): Promise<TodayStats> => {
    const res = await api.get('/records/today-stats', { params: { babyId } });
    return res.data.data.stats;
  },

  /** FR-A1：查询当前 baby 的进行中睡眠（最多 1 条） */
  getActiveSleep: async (babyId: string): Promise<CareRecord | null> => {
    const res = await api.get('/records', {
      params: {
        babyId,
        recordType: 'sleep',
        endTimeIsNull: 'true',
        page: 1,
        pageSize: 1,
      },
    });
    return res.data.data.items[0] ?? null;
  },
};

// Alias for compatibility with stores
export const recordService = recordApi;
