import api from './api'
import type { ChatMessage, DailyInsight, ApiResponse, AIQuotaStatus, ChatStreamEvent, CareRole } from '@/types'
import { useAuthStore } from '@/stores/auth-store'

export const aiService = {
  /** FR-F1：同步对话（可选 role 注入"视角" prompt） */
  async chat(
    messages: ChatMessage[],
    babyId?: string,
    role?: CareRole,
  ): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const res = await api.post<
      ApiResponse<{ content: string; usage?: { promptTokens: number; completionTokens: number } }>
    >('/ai/chat', {
      messages,
      babyId,
      role,
    })
    return res.data.data!
  },

  /** FR-F4：流式对话（SSE）—— 返回原始 Response，由调用方读取 ReadableStream */
  async chatStream(messages: ChatMessage[], babyId?: string, role?: CareRole): Promise<Response> {
    const token = useAuthStore.getState().token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    return fetch(`${baseUrl}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, babyId, role }),
      credentials: 'include',
    })
  },

  /**
   * FR-F4：消费 SSE 流，逐 chunk 回调 onChunk
   * 解析 `data: {json}\n\n` 格式，调用对应回调
   */
  async consumeStream(
    response: Response,
    handlers: {
      onChunk?: (content: string) => void
      onDone?: () => void
      onError?: (code: string, message: string) => void
    },
  ): Promise<void> {
    if (!response.body) {
      handlers.onError?.('NO_BODY', '响应无内容')
      return
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按 SSE 分隔符（\n\n）切割完整事件
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          const line = event.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue
          try {
            const evt = JSON.parse(json) as ChatStreamEvent
            if (evt.type === 'chunk') handlers.onChunk?.(evt.content)
            else if (evt.type === 'done') handlers.onDone?.()
            else if (evt.type === 'error') handlers.onError?.(evt.code, evt.message)
          } catch {
            // 忽略解析失败的 chunk
          }
        }
      }
      handlers.onDone?.()
    } catch (err) {
      handlers.onError?.('STREAM_ERROR', (err as Error).message ?? '流读取失败')
    } finally {
      try {
        reader.releaseLock()
      } catch {
        /* ignore */
      }
    }
  },

  /** FR-F2：每日洞察（带后端缓存；可选 role 注入"视角"） */
  async getDailyInsight(babyId: string, role?: CareRole): Promise<{ insight: DailyInsight; date: string }> {
    const res = await api.get<ApiResponse<{ insight: DailyInsight; date: string }>>(
      '/ai/insight/daily',
      { params: { babyId, role } },
    )
    return res.data.data!
  },

  /** FR-F3：配额查询 */
  async getQuota(): Promise<AIQuotaStatus> {
    const res = await api.get<ApiResponse<{ quota: AIQuotaStatus }>>('/ai/quota')
    return res.data.data!.quota
  },
}
