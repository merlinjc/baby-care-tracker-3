/**
 * OnboardingOverlay - 首次使用引导浮层（v7.2 T-S1-F1-01/03）
 *
 * 设计要点
 * --------
 * - 基于 Radix Dialog 提供 a11y 基础（焦点陷阱 / Esc / aria-modal / role=dialog）
 * - 三段式 UI：顶部步骤 indicator（4 圆点）/ 中部 illustration + 标题描述 /
 *   底部主次按钮组
 * - 目标元素高亮：当步骤定义了 `target` 选择器时，组件用 `getBoundingClientRect`
 *   计算位置，绘制带圆角的高亮裁切（`box-shadow: 0 0 0 9999px var(--mask)`），
 *   目标不在视口时自动 `scrollIntoView`
 * - 文案：全部走 `t()`（onboarding 命名空间，键 onboarding.steps.{id}.title 等）
 * - **不持久化**：完成 / 跳过的状态保存由调用方（App.tsx）负责，组件仅是受控 UI
 *
 * a11y
 * ----
 * - aria-labelledby / aria-describedby 由 Radix 自动注入
 * - Tab：在按钮组内循环（Radix 焦点陷阱）
 * - Esc：触发 onSkipAll（视为跳过全部，与点底部「稍后再看」一致）
 *
 * 用法
 * ----
 * ```tsx
 * <OnboardingOverlay
 *   open
 *   stepIndex={i}
 *   total={4}
 *   step={ONBOARDING_STEPS[i]}
 *   onNext={() => setI(i + 1)}     // 进入下一步
 *   onSkipStep={() => ...}         // 跳过本步
 *   onGo={(path) => ...}           // 点「去试试」：navigate(path) + 退出
 *   onSkipAll={() => ...}          // Esc / 「稍后再看」：跳过整个流程
 *   onComplete={() => ...}         // 最后一步「完成」
 * />
 * ```
 */
import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Baby as BabyIcon,
  MessageCircle,
  PlusCircle,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OnboardingStep, OnboardingStepId } from '@/lib/onboarding-steps'

/** 各步骤对应的 Lucide 图标（视觉锚点） */
const STEP_ICON: Record<OnboardingStepId, typeof BabyIcon> = {
  'create-baby': BabyIcon,
  'invite-family': Users,
  'first-record': PlusCircle,
  'try-ai': MessageCircle,
}

interface BoundingRect {
  top: number
  left: number
  width: number
  height: number
}

export interface OnboardingOverlayProps {
  /** 是否显示 Overlay */
  open: boolean
  /** 当前步骤在 ONBOARDING_STEPS 中的索引（0..total-1） */
  stepIndex: number
  /** 总步数（用于 indicator） */
  total: number
  /** 当前步骤定义 */
  step: OnboardingStep
  /** 进入下一步 */
  onNext: () => void
  /** 跳过本步（仅 step.skippable=true 时按钮可见） */
  onSkipStep: () => void
  /** 跳到目标页（router.navigate(step.targetPath) 后视为完成本步） */
  onGo: (path?: string) => void
  /** 跳过整个引导流程（Esc / 「稍后再看」） */
  onSkipAll: () => void
  /** 最后一步点「完成」时调用（与 onSkipAll 区分：表示流程正常结束） */
  onComplete: () => void
}

export function OnboardingOverlay({
  open,
  stepIndex,
  total,
  step,
  onNext,
  onSkipStep,
  onGo,
  onSkipAll,
  onComplete,
}: OnboardingOverlayProps) {
  const { t } = useTranslation('onboarding')
  const Icon = STEP_ICON[step.id] ?? Sparkles
  const isLast = stepIndex >= total - 1

  // —— 高亮目标元素的 boundingRect —— //
  const [targetRect, setTargetRect] = useState<BoundingRect | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setTargetRect(null)
      return
    }
    if (!step.target) {
      setTargetRect(null)
      return
    }

    /**
     * 目标元素可能在挂载时尚未渲染（如懒加载页面），用 rAF 轮询 + 兜底超时；
     * MutationObserver 监听后续 DOM 变化（路由切换 / 页面渲染完成）。
     */
    const findAndMeasure = () => {
      const el = document.querySelector<HTMLElement>(step.target!)
      if (!el) return false
      const rect = el.getBoundingClientRect()
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
      // 视口外自动滚入
      if (
        rect.top < 0 ||
        rect.left < 0 ||
        rect.bottom > window.innerHeight ||
        rect.right > window.innerWidth
      ) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      }
      return true
    }

    if (findAndMeasure()) {
      // 已找到，仍然监听后续位置变化
    }

    const observer = new MutationObserver(() => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        findAndMeasure()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const onResize = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        findAndMeasure()
      })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)

    // 兜底：3s 内仍找不到则放弃锚点（降级为居中卡）
    const fallbackTimer = window.setTimeout(() => {
      observer.disconnect()
    }, 3000)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearTimeout(fallbackTimer)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // step.target 在切换 step 时变更，重新启动监听
  }, [open, step.target])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkipAll()
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* 高亮蒙层（裁切目标区域） */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 pointer-events-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                aria-hidden="true"
              >
                {targetRect ? (
                  <SpotlightCutout rect={targetRect} />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: 'var(--mask-dark, rgba(0,0,0,0.55))' }}
                  />
                )}
              </motion.div>
            </DialogPrimitive.Overlay>

            {/* 卡片内容 */}
            <div
              className={cn(
                'fixed inset-0 z-50 flex justify-center pointer-events-none',
                targetRect ? 'items-end pb-6' : 'items-end sm:items-center pb-4',
              )}
            >
              <DialogPrimitive.Content
                asChild
                forceMount
                onEscapeKeyDown={(e) => {
                  e.preventDefault()
                  onSkipAll()
                }}
                onPointerDownOutside={(e) => {
                  // 蒙层点击不关闭，避免误触；用户必须显式点按钮
                  e.preventDefault()
                }}
              >
                <motion.div
                  className={cn(
                    'pointer-events-auto w-full max-w-sm mx-4',
                    'rounded-[20px] shadow-xl',
                  )}
                  style={{ backgroundColor: 'var(--bg-card)' }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  role="dialog"
                  aria-labelledby="onboarding-title"
                  aria-describedby="onboarding-desc"
                >
                  <div className="relative px-6 pt-6 pb-5 space-y-4">
                    {/* 关闭按钮（= 跳过全部） */}
                    <button
                      type="button"
                      onClick={onSkipAll}
                      aria-label={t('actions.skip_all')}
                      className={cn(
                        'absolute top-3 right-3',
                        'inline-flex items-center justify-center',
                        'h-8 w-8 rounded-full',
                        'text-[var(--label-tertiary)]',
                        'transition-colors hover:bg-[var(--surface-hover)]',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {/* Indicator */}
                    <StepIndicator current={stepIndex} total={total} />

                    {/* Illustration */}
                    <div className="flex flex-col items-center text-center gap-3 pt-2">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--brand-soft)' }}
                      >
                        <Icon
                          className="h-7 w-7"
                          style={{ color: 'var(--brand)' }}
                          strokeWidth={2}
                        />
                      </div>
                      <DialogPrimitive.Title asChild>
                        <h2
                          id="onboarding-title"
                          className="title-3"
                          style={{ color: 'var(--label)' }}
                        >
                          {t(`steps.${step.id}.title`)}
                        </h2>
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description asChild>
                        <p
                          id="onboarding-desc"
                          className="footnote px-2"
                          style={{ color: 'var(--label-secondary)' }}
                        >
                          {t(`steps.${step.id}.description`)}
                        </p>
                      </DialogPrimitive.Description>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-2 pt-1">
                      <Button
                        variant="filled"
                        block
                        onClick={() => onGo(step.targetPath)}
                      >
                        {t('actions.go')}
                      </Button>
                      <div className="flex items-center justify-between gap-2">
                        {step.skippable ? (
                          <button
                            type="button"
                            onClick={onSkipStep}
                            className="footnote px-3 py-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                            style={{ color: 'var(--label-tertiary)' }}
                          >
                            {t('actions.skip')}
                          </button>
                        ) : (
                          <span aria-hidden />
                        )}
                        {isLast ? (
                          <button
                            type="button"
                            onClick={onComplete}
                            className="footnote px-3 py-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                            style={{ color: 'var(--brand-ink)' }}
                          >
                            {t('actions.done')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onNext}
                            className="footnote px-3 py-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                            style={{ color: 'var(--brand-ink)' }}
                          >
                            {t('actions.next')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

/** 步骤进度指示器（4 个圆点，当前步高亮 + 数字 sr-only） */
function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation('onboarding')
  return (
    <div className="flex items-center justify-center gap-1.5" role="status">
      <span className="sr-only">
        {t('indicator', { current: current + 1, total })}
      </span>
      {Array.from({ length: total }, (_, i) => {
        const active = i === current
        const done = i < current
        return (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block rounded-full transition-all"
            style={{
              width: active ? 18 : 6,
              height: 6,
              backgroundColor: active
                ? 'var(--brand)'
                : done
                  ? 'color-mix(in srgb, var(--brand) 50%, transparent)'
                  : 'var(--separator)',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * 用 box-shadow 模拟"洞穿"目标区域的蒙层。
 *
 * 思路：一个矩形 div 占据目标位置，本体透明 + `box-shadow: 0 0 0 9999px <mask>`
 * 让蒙层从矩形外侧无限扩散到屏幕边缘，矩形内部就是透明的高亮窗口。
 * 这种实现 0 SVG / 0 mask-image，兼容性最好。
 */
function SpotlightCutout({ rect }: { rect: BoundingRect }) {
  const padding = 8
  const radius = 16
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: radius,
        boxShadow: '0 0 0 9999px var(--mask-dark, rgba(0,0,0,0.55))',
        // 高亮一圈 brand 描边，强化"看这里"
        outline: '2px solid color-mix(in srgb, var(--brand) 70%, transparent)',
        outlineOffset: 0,
      }}
    />
  )
}
