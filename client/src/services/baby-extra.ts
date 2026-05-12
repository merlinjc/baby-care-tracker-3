import api from './api'
import type { VaccineRecord, MilestoneRecord, TrendType, TrendData, PaginatedResponse } from '@baby-care-tracker/shared'

export const vaccineService = {
  list: async (babyId: string, params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<VaccineRecord>> => {
    const res = await api.get(`/babies/${babyId}/vaccines`, { params })
    return res.data.data
  },

  create: async (babyId: string, data: { name: string; dose: string; vaccinatedDate: string; note?: string }): Promise<VaccineRecord> => {
    const res = await api.post(`/babies/${babyId}/vaccines`, data)
    return res.data.data.vaccine
  },

  getStats: async (babyId: string): Promise<{ total: number; overdue: number; upcoming: number }> => {
    const res = await api.get(`/babies/${babyId}/vaccine-stats`)
    return res.data.data
  },
}

export const milestoneService = {
  list: async (babyId: string, params?: { page?: number; pageSize?: number; category?: string; status?: string }): Promise<PaginatedResponse<MilestoneRecord>> => {
    const res = await api.get(`/babies/${babyId}/milestones`, { params })
    return res.data.data
  },

  /**
   * 打卡里程碑（按 babyId+name upsert，幂等）
   */
  create: async (babyId: string, data: { name: string; category: string; achievedDate: string; note?: string }): Promise<MilestoneRecord> => {
    const res = await api.post(`/babies/${babyId}/milestones`, data)
    return res.data.data.milestone
  },

  /**
   * 编辑达成日期 / 备注（不允许改 name / category）
   */
  update: async (babyId: string, milestoneId: string, data: { achievedDate?: string; note?: string | null }): Promise<MilestoneRecord> => {
    const res = await api.patch(`/babies/${babyId}/milestones/${milestoneId}`, data)
    return res.data.data.milestone
  },

  /**
   * 取消打卡
   */
  remove: async (babyId: string, milestoneId: string): Promise<void> => {
    await api.delete(`/babies/${babyId}/milestones/${milestoneId}`)
  },
}

export const trendService = {
  get: async (babyId: string, type: TrendType, startDate?: string, endDate?: string): Promise<TrendData> => {
    const res = await api.get(`/babies/${babyId}/trends`, { params: { type, startDate, endDate } })
    return res.data.data.trend
  },
}

export const EXPORT_DATA_TYPES = [
  'feeding',
  'sleep',
  'diaper',
  'temperature',
  'growth',
  'vaccine',
  'milestone',
  'jaundice',
] as const

export type ExportDataType = (typeof EXPORT_DATA_TYPES)[number]

export interface ExportParams {
  babyId: string
  format?: 'json' | 'csv'
  /** ISO 字符串闭区间起 */
  startDate?: string
  /** ISO 字符串闭区间止 */
  endDate?: string
  /** v7.2+ 多选数据类型 */
  types?: ExportDataType[]
  /** @deprecated v7.2+ 改用 types；保留以兼容旧调用 */
  recordType?: string
}

/**
 * 进度回调（可选）：value 为 0..1。
 * 仅在响应包含 Content-Length 时可用；流式或 chunked 响应时回调可能始终为 0。
 */
export type ExportProgressCallback = (value: number) => void

export const exportService = {
  /**
   * 导出数据，返回 Blob。
   *
   * v7.2 T-S1-F3：types 多选 + onProgress 进度。
   *
   * **types 取值**：feeding / sleep / diaper / temperature / growth / vaccine / milestone / jaundice。
   * 后端会按多选情况返回聚合 JSON `{ records, vaccines, milestones, jaundice }` 或多 section CSV。
   * 不传 types（向后兼容）时后端默认导 5 个 Record 子类型。
   */
  exportData: async (
    params: ExportParams,
    onProgress?: ExportProgressCallback,
  ): Promise<Blob> => {
    const requestParams: Record<string, string> = {
      babyId: params.babyId,
      format: params.format ?? 'csv',
    }
    if (params.startDate) requestParams.startDate = params.startDate
    if (params.endDate) requestParams.endDate = params.endDate
    if (params.types && params.types.length > 0) {
      requestParams.types = params.types.join(',')
    } else if (params.recordType) {
      requestParams.recordType = params.recordType
    }

    const res = await api.get('/export', {
      params: requestParams,
      responseType: 'blob',
      onDownloadProgress: onProgress
        ? (e) => {
            if (e.total && e.total > 0) {
              onProgress(Math.min(1, e.loaded / e.total))
            }
          }
        : undefined,
    })
    return res.data
  },
}
