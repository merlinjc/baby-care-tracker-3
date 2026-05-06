import api from './api'
import type { ChatMessage, DailyInsight, ApiResponse } from '@/types'
import { useAuthStore } from '@/stores/auth-store'

export const aiService = {
  async chat(messages: ChatMessage[], babyId?: string): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const res = await api.post<ApiResponse<{ content: string; usage?: { promptTokens: number; completionTokens: number } }>>('/ai/chat', {
      messages,
      babyId,
    })
    return res.data.data!
  },

  async chatStream(messages: ChatMessage[], babyId?: string): Promise<Response> {
    const token = useAuthStore.getState().token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    return fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, babyId }),
      credentials: 'include',
    })
  },

  async getDailyInsight(babyId: string): Promise<{ insight: DailyInsight; date: string }> {
    const res = await api.post<ApiResponse<{ insight: DailyInsight; date: string }>>('/ai/daily-insight', { babyId })
    return res.data.data!
  },

  async getQuota(): Promise<{ dailyLimit: number; used: number; remaining: number; resetAt: string }> {
    const res = await api.get<ApiResponse<{ quota: { dailyLimit: number; used: number; remaining: number; resetAt: string } }>>('/ai/quota')
    return res.data.data!.quota
  },
}
