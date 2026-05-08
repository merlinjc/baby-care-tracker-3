/**
 * InviteSection - 邀请码区（FR-C2）
 *
 * 显示当前邀请码 + 7 天倒计时；admin 可复制 / 分享 / 重新生成
 * 倒计时 < 24h 时变橙提示「即将过期」
 */
import { useEffect, useState } from 'react'
import { Clock, Copy, RefreshCw, Share2 } from 'lucide-react';import { useFamilyStore } from '@/stores/family-store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface InviteSectionProps {
  inviteCode: string
  inviteCodeExpiry: string
  /** 是否为管理员（决定是否显示「重新生成」） */
  canRefresh: boolean
}

function formatRemainingTime(expiryIso: string): { text: string; warning: boolean; expired: boolean } {
  const expiry = new Date(expiryIso).getTime()
  const now = Date.now()
  const remaining = expiry - now
  if (remaining <= 0) return { text: '已过期', warning: true, expired: true }
  const hours = Math.floor(remaining / (60 * 60 * 1000))
  if (hours < 1) {
    const mins = Math.floor(remaining / (60 * 1000))
    return { text: `${mins} 分钟后过期`, warning: true, expired: false }
  }
  if (hours < 24) {
    return { text: `${hours} 小时后过期`, warning: true, expired: false }
  }
  const days = Math.floor(hours / 24)
  return { text: `${days} 天后过期`, warning: false, expired: false }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fallback below
    }
  }
  // Fallback: textarea + execCommand
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let success = false
  try {
    success = document.execCommand('copy')
  } catch {
    success = false
  }
  document.body.removeChild(ta)
  return success
}

export function InviteSection({ inviteCode, inviteCodeExpiry, canRefresh }: InviteSectionProps) {
  const refreshInviteCode = useFamilyStore((s) => s.refreshInviteCode)
  const [time, setTime] = useState(() => formatRemainingTime(inviteCodeExpiry))
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setTime(formatRemainingTime(inviteCodeExpiry))
    const t = setInterval(() => setTime(formatRemainingTime(inviteCodeExpiry)), 60 * 1000)
    return () => clearInterval(t)
  }, [inviteCodeExpiry])

  const handleCopy = async () => {
    const ok = await copyToClipboard(`邀请你加入我的家庭，邀请码：${inviteCode}（7 天内有效）`)
    if (ok) toast.success('已复制邀请文案')
    else toast.error('复制失败，请手动复制邀请码')
  }

  const handleShare = async () => {
    const text = `邀请你加入我的家庭，邀请码：${inviteCode}（7 天内有效）`
    if (navigator.share) {
      try {
        await navigator.share({ title: '宝宝护理记录邀请', text })
      } catch (err) {
        const e = err as Error
        if (e.name !== 'AbortError') {
          // 系统不支持时降级为复制
          const ok = await copyToClipboard(text)
          if (ok) toast.info('已复制邀请文案，可粘贴到任意应用')
        }
      }
    } else {
      const ok = await copyToClipboard(text)
      if (ok) toast.info('已复制邀请文案，可粘贴到任意应用')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshInviteCode()
      toast.success('邀请码已更新')
    } catch {
      toast.error('刷新失败，请稍后重试')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="caption">邀请码</span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: time.warning ? 'var(--warning)' : 'var(--text-hint)' }}
        >
          <Clock className="h-3 w-3" />
          {time.text}
        </span>
      </div>
      <div
        className="number-display text-2xl font-bold tracking-widest text-center py-3 rounded-xl"
        style={{
          color: time.expired ? 'var(--text-hint)' : 'var(--primary)',
          backgroundColor: 'var(--bg-elevated)',
          textDecoration: time.expired ? 'line-through' : 'none',
        }}
      >
        {inviteCode}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={handleCopy} block leftIcon={<Copy className="h-4 w-4" />}>
          复制
        </Button>
        <Button variant="secondary" onClick={handleShare} block leftIcon={<Share2 className="h-4 w-4" />}>
          分享
        </Button>
        {canRefresh && (
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            block
            leftIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            刷新
          </Button>
        )}
      </div>
    </Card>
  )
}
