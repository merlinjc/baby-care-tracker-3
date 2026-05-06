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

  create: async (babyId: string, data: { name: string; category: string; achievedDate: string; note?: string }): Promise<MilestoneRecord> => {
    const res = await api.post(`/babies/${babyId}/milestones`, data)
    return res.data.data.milestone
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
