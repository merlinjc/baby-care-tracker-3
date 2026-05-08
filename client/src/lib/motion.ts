/**
 * motion.ts — v7.0 统一的 framer-motion 预设
 *
 * iOS Health 风动效系统。所有 spring / transition 参数集中在这里，
 * 避免在各组件里散落 stiffness/damping 魔数。
 */
import type { Transition, Variants } from 'framer-motion'

// ──────────────────────────────────────────────────────────
// 1. Spring 预设
// ──────────────────────────────────────────────────────────
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 }
export const springStiff: Transition = { type: 'spring', stiffness: 500, damping: 35 }
export const springSoft: Transition = { type: 'spring', stiffness: 180, damping: 22 }
export const springPop: Transition = { type: 'spring', stiffness: 420, damping: 28 }

// 与 globals.css 中的 --ease-ios 保持一致
export const easeIOS = [0.32, 0.72, 0, 1] as const
export const easeOutQuart = [0.25, 1, 0.5, 1] as const

// ──────────────────────────────────────────────────────────
// 2. 页面级
// ──────────────────────────────────────────────────────────
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeIOS },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: easeIOS },
  },
}

// ──────────────────────────────────────────────────────────
// 3. 列表 Stagger
// ──────────────────────────────────────────────────────────
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeIOS },
  },
}

// 更紧凑的 stagger（用于密集卡片）
export const staggerCompact: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.03, delayChildren: 0 },
  },
}

// ──────────────────────────────────────────────────────────
// 4. 卡片入场
// ──────────────────────────────────────────────────────────
export const cardEnter: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring,
  },
}

// ──────────────────────────────────────────────────────────
// 5. Dialog / Sheet（iOS 风）
// ──────────────────────────────────────────────────────────
export const sheetMobile: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: spring },
  exit: { y: '100%', transition: { duration: 0.25, ease: easeIOS } },
}

export const sheetDesktop: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springPop },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 4,
    transition: { duration: 0.15, ease: easeIOS },
  },
}

export const overlayFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: easeIOS } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: easeIOS } },
}

// ──────────────────────────────────────────────────────────
// 6. 按钮按压（iOS 典型 0.96 scale）
// ──────────────────────────────────────────────────────────
export const pressable = {
  whileTap: { scale: 0.96 },
  transition: { duration: 0.15, ease: easeIOS },
}

// 大卡按压（更细微）
export const pressableSubtle = {
  whileTap: { scale: 0.985 },
  transition: { duration: 0.12, ease: easeIOS },
}

// ──────────────────────────────────────────────────────────
// 7. 数字跳动（用于 TodaySummary / Metrics）
// ──────────────────────────────────────────────────────────
export const numberTransition: Transition = {
  duration: 0.4,
  ease: easeIOS,
}

// ──────────────────────────────────────────────────────────
// 8. SegmentedControl 的选中指示器（spring 滑动）
// ──────────────────────────────────────────────────────────
export const segmentIndicator: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
}

// ──────────────────────────────────────────────────────────
// 9. 折叠/展开
// ──────────────────────────────────────────────────────────
export const collapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: easeIOS },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.3, ease: easeIOS },
  },
}
