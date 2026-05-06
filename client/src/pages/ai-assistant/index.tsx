import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Bot, Send, Sparkles, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBabyStore } from '@/stores/baby-store'
import { aiService } from '@/services/ai'
import { QuotaBar } from '@/components/quota-bar'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { ChatMessage, AIQuotaStatus } from '@/types'

const STORAGE_KEY = 'baby_care_chat_history'

/** 视图层消息：带前端本地时间戳，后端只消费 role/content */
interface ChatMessageVM extends ChatMessage {
  ts?: number
}

const SUGGESTED_QUESTIONS = [
  '宝宝几个月开始添加辅食？',
  '新生儿每天需要睡多久？',
  '宝宝发烧了怎么护理？',
  '什么时候该带宝宝看医生？',
  '如何帮助宝宝练习翻身？',
  '宝宝不吃奶怎么办？',
]

function loadHistory(): ChatMessageVM[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMessageVM[]) {
  try {
    const toSave = messages.slice(-50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {}
}

function formatBubbleTime(ts?: number): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

/** 统一气泡样式（圆角 18px，轻微方向尖角 4px） */
function bubbleStyle(role: 'user' | 'assistant'): React.CSSProperties {
  const isUser = role === 'user'
  return {
    backgroundColor: isUser
      ? 'color-mix(in srgb, var(--primary) 18%, var(--bg-card))'
      : 'color-mix(in srgb, var(--primary) 6%, var(--bg-card))',
    color: 'var(--text-primary)',
    border: isUser
      ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)'
      : '1px solid var(--border-light)',
    borderRadius: isUser
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.6,
  }
}

export function AiAssistantPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()
  const location = useLocation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessageVM[]>(() => {
    const history = loadHistory()
    return history.length > 0
      ? history
      : [{ role: 'assistant', content: '你好！我是宝宝护理助手，有什么可以帮你的吗？', ts: Date.now() }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [quota, setQuota] = useState<AIQuotaStatus | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** 防止 React StrictMode 双调用 / 路由 state 残留导致 autoPrompt 被重复发送 */
  const autoPromptHandledRef = useRef(false)

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

    const userMessage: ChatMessageVM = { role: 'user', content, ts: Date.now() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)
    setStreamingContent('')

    // 发送给后端时只保留 role/content（剥离前端字段）
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
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: fullContent, ts: Date.now() },
        ])
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
          { role: 'assistant', content: res.content || 'AI 服务暂未可用', ts: Date.now() },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '抱歉，请求失败了，请稍后重试。', ts: Date.now() },
        ])
        const e = err as { message?: string }
        if (e.message) toast.error(e.message)
      }
      setStreamingContent('')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, currentBaby, quota])

  const handleClearHistory = async () => {
    const ok = await confirm({
      title: '清除聊天记录？',
      description: '所有历史对话将被清空，此操作不可撤销。',
      confirmText: '清除',
      variant: 'danger',
    })
    if (!ok) return
    setMessages([{ role: 'assistant', content: '你好！我是宝宝护理助手，有什么可以帮你的吗？', ts: Date.now() }])
    localStorage.removeItem(STORAGE_KEY)
    setShowSuggestions(true)
  }

  /**
   * 监听路由 state.autoPrompt：发现页等其他页面可通过 navigate('/ai-assistant', { state: { autoPrompt } })
   * 把预填问题带进来；这里自动发送一次，并清掉 state，避免刷新重复触发。
   */
  useEffect(() => {
    const auto = (location.state as { autoPrompt?: string } | null)?.autoPrompt
    if (!auto || autoPromptHandledRef.current) return
    autoPromptHandledRef.current = true
    // 立即清除 history state，避免刷新或后退后再次触发
    navigate(location.pathname, { replace: true, state: null })
    // 异步触发 send，确保组件首屏渲染完成
    setTimeout(() => {
      handleSend(auto)
    }, 0)
  }, [location.state, location.pathname, navigate, handleSend])

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header（全屏对话页专用 sticky 顶栏，配额徽章嵌入右侧） */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/discover"
            aria-label="返回"
            className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div
            className="icon-circle icon-circle--sm shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--sleep) 15%, transparent)' }}
          >
            <Bot className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
          </div>
          <h1 className="heading-sm text-[var(--text-primary)] truncate">AI 护理助手</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QuotaBar quota={quota} variant="badge" />
          <button
            onClick={handleClearHistory}
            aria-label="清除聊天记录"
            title="清除聊天记录"
            className="icon-btn icon-btn--danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-primary)]">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const timeLabel = formatBubbleTime(msg.ts)
          return (
            <div
              key={i}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {!isUser && <AssistantAvatar />}
              <div className="max-w-[80%] flex flex-col gap-1">
                <div
                  className="px-4 py-2.5 whitespace-pre-wrap break-words"
                  style={bubbleStyle(isUser ? 'user' : 'assistant')}
                >
                  {msg.content}
                </div>
                {timeLabel && (
                  <span
                    className={`caption px-1 number-display ${isUser ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-hint)' }}
                  >
                    {timeLabel}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex gap-2 justify-start animate-fade-in">
            <AssistantAvatar />
            <div
              className="max-w-[80%] px-4 py-2.5 whitespace-pre-wrap break-words"
              style={bubbleStyle('assistant')}
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
            <div className="px-4 py-2" style={bubbleStyle('assistant')}>
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
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
