import { Link } from 'react-router-dom'
import { ChevronLeft, Bot, Send, Sparkles, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBabyStore } from '@/stores/baby-store'
import { aiService } from '@/services/ai'
import { QuotaBar } from '@/components/quota-bar'
import { toast } from '@/components/ui/toast'
import type { ChatMessage, AIQuotaStatus } from '@/types'

const STORAGE_KEY = 'baby_care_chat_history'

const SUGGESTED_QUESTIONS = [
  '宝宝几个月开始添加辅食？',
  '新生儿每天需要睡多久？',
  '宝宝发烧了怎么护理？',
  '什么时候该带宝宝看医生？',
  '如何帮助宝宝练习翻身？',
  '宝宝不吃奶怎么办？',
]

function loadHistory(): ChatMessage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    const toSave = messages.slice(-100)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {}
}

/** AI assistant avatar circle (left side of AI bubbles) */
function AssistantAvatar() {
  return (
    <div
      className="icon-circle icon-circle--sm shrink-0 self-end mb-1"
      style={{ backgroundColor: 'color-mix(in srgb, var(--sleep) 18%, transparent)' }}
    >
      <Bot className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
    </div>
  )
}

/** Animated typing dots (3-dot wave) */
function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1.5 py-1.5">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}

export function AiAssistantPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const history = loadHistory()
    return history.length > 0
      ? history
      : [{ role: 'assistant', content: '你好！我是宝宝护理助手，有什么可以帮你的吗？' }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [quota, setQuota] = useState<AIQuotaStatus | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  useEffect(() => {
    aiService.getQuota().then(setQuota).catch(() => {})
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
  }, [input])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content || isLoading) return

    // FR-F3：配额耗尽时禁止发送
    if (quota && quota.remaining === 0) {
      toast.warning('今日 AI 配额已用尽，请明天再试')
      return
    }

    const userMessage: ChatMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)
    setStreamingContent('')

    const chatMessages: ChatMessage[] = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let fullContent = ''
    try {
      const response = await aiService.chatStream(chatMessages, currentBaby?.id)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      await aiService.consumeStream(response, {
        onChunk: (c) => {
          fullContent += c
          setStreamingContent(fullContent)
        },
        onError: (code, message) => {
          toast.error(message || 'AI 服务异常')
          // 让 finally 处理
          throw new Error(`${code}: ${message}`)
        },
      })

      if (fullContent) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }])
      }
      setStreamingContent('')

      // 刷新配额（异步，不阻塞）
      aiService.getQuota().then(setQuota).catch(() => {})
    } catch (err) {
      // SSE 失败 → 降级为同步接口
      try {
        const res = await aiService.chat(chatMessages, currentBaby?.id)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.content || 'AI 服务暂未可用' },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '抱歉，请求失败了，请稍后重试。' },
        ])
        const e = err as { message?: string }
        if (e.message) toast.error(e.message)
      }
      setStreamingContent('')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, currentBaby, quota])

  const handleClearHistory = () => {
    if (!confirm('确定清除聊天记录吗？')) return
    setMessages([{ role: 'assistant', content: '你好！我是宝宝护理助手，有什么可以帮你的吗？' }])
    localStorage.removeItem(STORAGE_KEY)
    setShowSuggestions(true)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div
            className="icon-circle icon-circle--sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--sleep) 15%, transparent)' }}
          >
            <Bot className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
          </div>
          <div>
            <h1 className="heading-sm text-[var(--text-primary)]">AI 护理助手</h1>
          </div>
        </div>
        <button
          onClick={handleClearHistory}
          className="p-2 rounded-lg text-[var(--text-hint)] hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,_var(--danger)_12%,_transparent)] transition-colors"
          title="清除聊天记录"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* FR-F3：配额条 */}
      <div className="px-4 py-2 bg-[var(--bg-secondary)]">
        <QuotaBar quota={quota} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-primary)]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            {msg.role === 'assistant' && <AssistantAvatar />}
            <div
              className="max-w-[80%] px-4 py-2.5 leading-relaxed whitespace-pre-wrap"
              style={{
                backgroundColor: msg.role === 'user'
                  ? 'color-mix(in srgb, var(--primary) 18%, var(--bg-card))'
                  : 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: msg.role === 'user'
                  ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)'
                  : '1px solid var(--border-light)',
                borderRadius: msg.role === 'user'
                  ? 'var(--radius-lg) var(--radius-sm) var(--radius-sm) var(--radius-lg)'
                  : 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex gap-2 justify-start animate-fade-in">
            <AssistantAvatar />
            <div
              className="max-w-[80%] px-4 py-2.5 leading-relaxed whitespace-pre-wrap"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {streamingContent}
              <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm bg-[var(--primary)] animate-pulse" />
            </div>
          </div>
        )}

        {/* Thinking indicator: 3-dot wave */}
        {isLoading && !streamingContent && (
          <div className="flex gap-2 justify-start animate-fade-in">
            <AssistantAvatar />
            <div
              className="px-4 py-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
              }}
            >
              <TypingDots />
            </div>
          </div>
        )}

        {/* Suggested Questions */}
        {showSuggestions && !isLoading && (
          <div className="space-y-2.5 pt-2 animate-fade-in">
            <div className="flex items-center gap-1.5 caption">
              <Sparkles className="h-3 w-3" style={{ color: 'var(--sleep)' }} />
              推荐问题
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="chip chip--inactive hover:border-[var(--sleep)] hover:text-[var(--sleep)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input - auto-resize textarea */}
      <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入消息... (Shift+Enter 换行)"
            rows={1}
            className="input-base flex-1 resize-none"
            style={{ minHeight: '40px', maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="btn-primary px-3 shrink-0"
            style={{ height: '40px' }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
