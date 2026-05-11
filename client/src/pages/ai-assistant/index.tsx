/**
 * AiAssistantPage v7 - iOS iMessage × 美拉德暖色
 *
 * 重构：
 * - 顶部 sticky nav header（自定义实现，全屏对话布局保留）
 * - 用户气泡：brand 实底（暖棕）右下角小直角；AI 气泡：surface-2 + 左下角小直角
 * - 推荐问题：tinted Card 卡片（sleep 紫底）
 * - 输入区：iOS 风圆角 textarea + 发送圆按钮（filled brand）
 * - 移除玻璃态、渐变 border-image
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ChevronLeft, Send, Sparkles, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBabyStore } from '@/stores/baby-store'
import { aiService } from '@/services/ai'
import { QuotaBar } from '@/components/quota-bar'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Textarea } from '@/components/ui/textarea'
import { spring, springSoft } from '@/lib/motion'
import type { ChatMessage, AIQuotaStatus } from '@/types'

const STORAGE_KEY = 'baby_care_chat_history'

interface ChatMessageVM extends ChatMessage {
  ts?: number
}

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
  } catch {
    // localStorage 不可用（隐私模式 / 容量超限）时静默失败，不影响主流程
  }
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

function AssistantAvatar() {
  return (
    <div
      className="shrink-0 self-end mb-1 w-8 h-8 rounded-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--sleep-bg)', color: 'var(--sleep-fg)' }}
    >
      <Bot className="h-4 w-4" />
    </div>
  )
}

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1.5 py-1">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}

export function AiAssistantPage() {
  const { t } = useTranslation('ai')
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const confirm = useConfirm()
  const location = useLocation()
  const navigate = useNavigate()
  const suggestedQuestions = (t('suggestions.list', { returnObjects: true }) ?? []) as string[]
  const [messages, setMessages] = useState<ChatMessageVM[]>(() => {
    const history = loadHistory()
    return history.length > 0
      ? history
      : [{ role: 'assistant', content: t('greeting'), ts: Date.now() }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [quota, setQuota] = useState<AIQuotaStatus | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
  }, [input])

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text || input).trim()
      if (!content || isLoading) return

      if (quota && quota.remaining === 0) {
        toast.warning(t('errors.quota_exhausted'))
        return
      }

      const userMessage: ChatMessageVM = { role: 'user', content, ts: Date.now() }
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await aiService.consumeStream(response, {
          onChunk: (c) => {
            fullContent += c
            setStreamingContent(fullContent)
          },
          onError: (code, message) => {
            toast.error(message || t('errors.service_error'))
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
        aiService.getQuota().then(setQuota).catch(() => {})
      } catch (err) {
        try {
          const res = await aiService.chat(chatMessages, currentBaby?.id)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: res.content || t('errors.service_unavailable'), ts: Date.now() },
          ])
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: t('errors.request_failed'), ts: Date.now() },
          ])
          const e = err as { message?: string }
          if (e.message) toast.error(e.message)
        }
        setStreamingContent('')
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, currentBaby, quota],
  )

  const handleClearHistory = async () => {
    const ok = await confirm({
      title: t('clear.confirm_title'),
      description: t('clear.confirm_desc'),
      confirmText: t('clear.confirm_action'),
      variant: 'danger',
    })
    if (!ok) return
    setMessages([
      { role: 'assistant', content: t('greeting'), ts: Date.now() },
    ])
    localStorage.removeItem(STORAGE_KEY)
    setShowSuggestions(true)
  }

  useEffect(() => {
    const auto = (location.state as { autoPrompt?: string } | null)?.autoPrompt
    if (!auto || autoPromptHandledRef.current) return
    autoPromptHandledRef.current = true
    navigate(location.pathname, { replace: true, state: null })
    setTimeout(() => {
      handleSend(auto)
    }, 0)
  }, [location.state, location.pathname, navigate, handleSend])

  return (
    // 全屏对话布局：抵消 MainLayout 的 px/py
    <div
      className="flex flex-col h-[calc(100vh-4rem)] md:h-screen -mx-5 -my-7 sm:-mx-6 lg:-my-8"
      data-ai-page
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      {/* Header（iOS nav 风：sticky + hairline） */}
      <header
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{
          backgroundColor: 'var(--surface-1)',
          borderBottom: '0.5px solid var(--separator)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/discover"
            aria-label={t('back_aria')}
            className="flex items-center gap-0.5 transition-colors"
            style={{ color: 'var(--brand-ink)' }}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="callout font-medium hidden sm:inline">{t('back')}</span>
          </Link>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--sleep-bg)', color: 'var(--sleep-fg)' }}
          >
            <Bot className="h-4 w-4" />
          </div>
          <h1 className="headline truncate" style={{ color: 'var(--label)' }}>
            {t('title')}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QuotaBar quota={quota} variant="badge" />
          <IconButton
            variant="danger-ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={handleClearHistory}
            aria-label={t('clear.icon_aria')}
            title={t('clear.icon_aria')}
          />
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const timeLabel = formatBubbleTime(msg.ts)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springSoft}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && <AssistantAvatar />}
                <div className="max-w-[80%] flex flex-col gap-1">
                  <div
                    className="px-4 py-2.5 whitespace-pre-wrap break-words callout"
                    style={
                      isUser
                        ? {
                            backgroundColor: 'var(--brand)',
                            color: 'var(--surface-1)',
                            borderRadius: '18px 18px 4px 18px',
                            boxShadow: 'var(--shadow-xs)',
                            lineHeight: 1.5,
                          }
                        : {
                            backgroundColor: 'var(--surface-1)',
                            color: 'var(--label)',
                            borderRadius: '18px 18px 18px 4px',
                            border: '0.5px solid var(--separator)',
                            boxShadow: 'var(--shadow-xs)',
                            lineHeight: 1.5,
                          }
                    }
                  >
                    {msg.content}
                  </div>
                  {timeLabel && (
                    <span
                      className={`caption-1 px-1 number-display ${isUser ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--label-tertiary)' }}
                    >
                      {timeLabel}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* 流式内容 */}
        {streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="flex gap-2 justify-start"
          >
            <AssistantAvatar />
            <div
              className="max-w-[80%] px-4 py-2.5 whitespace-pre-wrap break-words callout"
              style={{
                backgroundColor: 'var(--surface-1)',
                color: 'var(--label)',
                borderRadius: '18px 18px 18px 4px',
                border: '0.5px solid var(--separator)',
                lineHeight: 1.5,
              }}
            >
              {streamingContent}
              <span
                className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse"
                style={{ backgroundColor: 'var(--brand)' }}
              />
            </div>
          </motion.div>
        )}

        {/* 思考中 */}
        {isLoading && !streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="flex gap-2 justify-start"
          >
            <AssistantAvatar />
            <div
              className="px-4 py-2.5"
              style={{
                backgroundColor: 'var(--surface-1)',
                borderRadius: '18px 18px 18px 4px',
                border: '0.5px solid var(--separator)',
              }}
            >
              <TypingDots />
            </div>
          </motion.div>
        )}

        {/* 推荐问题 */}
        {showSuggestions && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...springSoft }}
            className="space-y-2.5 pt-2"
          >
            <div
              className="flex items-center gap-1.5 caption-1"
              style={{ color: 'var(--label-tertiary)' }}
            >
              <Sparkles className="h-3 w-3" style={{ color: 'var(--sleep)' }} />
              {t('suggestions.title')}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <motion.button
                  key={q}
                  whileTap={{ scale: 0.96 }}
                  transition={spring}
                  onClick={() => handleSend(q)}
                  className="px-3.5 py-2 rounded-full footnote font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--sleep-bg)',
                    color: 'var(--sleep-fg)',
                    border: '0.5px solid var(--separator)',
                  }}
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-3 py-3"
        style={{
          backgroundColor: 'var(--surface-1)',
          borderTop: '0.5px solid var(--separator)',
        }}
      >
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={t('input.placeholder')}
            rows={1}
            className="flex-1"
            style={{ minHeight: '40px', maxHeight: '120px', overflowY: 'auto' }}
          />
          <Button
            variant="filled"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label={t('input.send_aria')}
            className="shrink-0 !rounded-full !w-10 !h-10 !p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
