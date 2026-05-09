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

export const exportService = {
  exportData: async (params: { babyId: string; format?: 'json' | 'csv'; startDate?: string; endDate?: string; recordType?: string }): Promise<Blob> => {
    const res = await api.get('/export', { params, responseType: 'blob' })
    return res.data
  },
}
