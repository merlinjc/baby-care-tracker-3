/**
 * dailyCheckinService - 每日打卡前端 service（v7.2 T-S2-F11-FE-01）
 *
 * 与黄疸 service 同模式：
 * - 客户端字段命名与服务端一致（DailyCheckin），无需双向映射
 * - 上传走 uploadService.upload(file, 'daily-checkin', { familyId, babyId, date })
 *   返回 key 后再 POST /api/babies/:id/checkins
 * - generateAiSummary 异步触发，失败 toast 但不阻塞主流程
 */
import api from './api'
import type {
  DailyCheckin,
  DailyCheckinListQuery,
  DailyCheckinCreateInput,
  DailyCheckinPatchInput,
  CareRole,
} from '@/types'

interface CheckinListResponse {
  items: DailyCheckin[]
  total: number
  range: { startDate: string; endDate: string }
}

export const dailyCheckinService = {
  async list(babyId: string, params?: DailyCheckinListQuery): Promise<CheckinListResponse> {
    const res = await api.get(`/babies/${babyId}/checkins`, { params })
    return res.data.data
  },

  async getByDate(babyId: string, date: string): Promise<DailyCheckin | null> {
    try {
      const res = await api.get(`/babies/${babyId}/checkins/${date}`)
      return res.data.data.checkin
    } catch (err) {
      // 404 → 当天未打卡，返回 null 而非抛错
      const e = err as { response?: { status?: number } }
      if (e.response?.status === 404) return null
      throw err
    }
  },

  async create(babyId: string, payload: DailyCheckinCreateInput): Promise<DailyCheckin> {
    const res = await api.post(`/babies/${babyId}/checkins`, payload)
    return res.data.data.checkin
  },

  async update(
    babyId: string,
    date: string,
    patch: DailyCheckinPatchInput,
  ): Promise<DailyCheckin> {
    const res = await api.patch(`/babies/${babyId}/checkins/${date}`, patch)
    return res.data.data.checkin
  },

  async remove(babyId: string, date: string): Promise<void> {
    await api.delete(`/babies/${babyId}/checkins/${date}`)
  },

  async generateAiSummary(
    babyId: string,
    date: string,
    role?: CareRole,
  ): Promise<DailyCheckin> {
    const res = await api.post(`/babies/${babyId}/checkins/${date}/ai-summary`, {
      role,
    })
    return res.data.data.checkin
  },
}

export type { CheckinListResponse }
