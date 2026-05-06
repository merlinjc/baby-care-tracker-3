import { Link } from 'react-router-dom'
import { ChevronLeft, Bot, Send, Sparkles, Trash2, Zap } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBabyStore } from '@/stores/baby-store'
import { aiService } from '@/services/ai'
import type { ChatMessage } from '@/types'

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
  const [quota, setQuota] = useState<{ dailyLimit: number; used: number; remaining: number } | null>(null)
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

    const userMessage: ChatMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)
    setStreamingContent('')

    try {
      const chatMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }))

      try {
        const response = await aiService.chat(chatMessages, currentBaby?.id, true)
        if (response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let fullContent = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.content) {
                    fullContent += parsed.content
                    setStreamingContent(fullContent)
                  }
                } catch {
                  fullContent += data
                  setStreamingContent(fullContent)
                }
              }
            }
          }

          setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }])
          setStreamingContent('')
        } else {
          throw new Error('No body')
        }
      } catch {
        const res = await aiService.chat(chatMessages, currentBaby?.id, false)
        const data = res as unknown as { content: string }
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content || 'AI 功能暂未接入，敬请期待。' }])
        setStreamingContent('')
      }

      aiService.getQuota().then(setQuota).catch(() => {})
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '抱歉，请求失败了，请稍后重试。' }])
      setStreamingContent('')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, currentBaby])

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
            {quota && (
              <div className="flex items-center gap-1 caption">
                <Zap className="h-2.5 w-2.5" />
                剩余 {quota.remaining}/{quota.dailyLimit}
              </div>
            )}
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
