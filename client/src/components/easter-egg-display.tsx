/**
 * EasterEggDisplay - 彩蛋统一渲染（FR-G2）
 *
 * 把 design.md 提到的 EasterEggPopup / EasterEggToast / EasterEggBanner 三种形态
 * 合并到一个组件，根据 EggResult.variant 决定渲染方式：
 * - popup：半屏 Dialog（满月 / 百日 / 周岁 / 30 天打卡）
 * - toast：调用 toast 组件（首次记录 / 7 天打卡 / 数据洞察）
 * - banner：在首页问候栏下方渲染一行可关闭的横条（月龄 / 节日）
 *
 * HomePage 持有 detected[]：popup 类一次只展示最高优先级；toast 类排队；banner 类常驻直至关闭
 */
import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import type { EggResult } from '@/lib/easter-egg'
import { markEggShown } from '@/lib/easter-egg'

interface EasterEggDisplayProps {
  results: EggResult[]
  /** 当某个 egg 被消费（关闭/隐藏）时，由父组件移除 */
  onConsume: (storageKey: string) => void
}

export function EasterEggDisplay({ results, onConsume }: EasterEggDisplayProps) {
  // 拆分类别：popup（一次一个，按优先级），toast（队列），banner（堆叠常驻）
  const popupEggs = results.filter((r) => r.variant === 'popup')
  const toastEggs = results.filter((r) => r.variant === 'toast')
  const bannerEggs = results.filter((r) => r.variant === 'banner')

  // 当前显示的 popup
  const currentPopup = popupEggs[0] ?? null
  const [popupOpen, setPopupOpen] = useState(false)

  useEffect(() => {
    if (currentPopup) setPopupOpen(true)
  }, [currentPopup?.storageKey])

  // toast 排队消费（每次切换时显示一个 + 标记 + 移除）
  useEffect(() => {
    if (toastEggs.length === 0) return
    const egg = toastEggs[0]
    toast.success(`${egg.title}${egg.title ? ' · ' : ''}${egg.message}`, 4000)
    markEggShown(egg.storageKey)
    onConsume(egg.storageKey)
  }, [toastEggs[0]?.storageKey])

  const handleClosePopup = () => {
    if (!currentPopup) return
    markEggShown(currentPopup.storageKey)
    setPopupOpen(false)
    setTimeout(() => onConsume(currentPopup.storageKey), 200)
  }

  const handleCloseBanner = (key: string) => {
    markEggShown(key)
    onConsume(key)
  }

  return (
    <>
      {/* Banner 区（首页顶部，可堆叠 1-2 条） */}
      {bannerEggs.slice(0, 2).map((egg) => (
        <div
          key={egg.storageKey}
          className="rounded-xl px-3 py-2 flex items-center gap-2 animate-fade-in-up"
          style={{
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
          }}
        >
          <span aria-hidden>{egg.emoji ?? '✨'}</span>
          <span className="body-md flex-1 text-[var(--text-primary)]">{egg.message}</span>
          <button
            onClick={() => handleCloseBanner(egg.storageKey)}
            aria-label="关闭"
            className="text-[var(--text-hint)] hover:text-[var(--text-primary)] p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Popup 区（一次一个） */}
      {currentPopup && (
        <Dialog
          open={popupOpen}
          onClose={handleClosePopup}
          title={currentPopup.title}
          icon={<Sparkles className="h-5 w-5" />}
          accentColor="var(--primary)"
        >
          <div className="space-y-4 py-2">
            <div className="text-center">
              <div className="text-6xl mb-3" aria-hidden>
                {currentPopup.emoji ?? '🎉'}
              </div>
              {currentPopup.subtitle && (
                <p className="body-md text-[var(--text-secondary)] leading-relaxed">
                  {currentPopup.subtitle}
                </p>
              )}
            </div>
            <Button onClick={handleClosePopup} block>
              我知道了
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
