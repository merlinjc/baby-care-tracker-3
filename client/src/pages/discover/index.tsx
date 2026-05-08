/**
 * DiscoverPage v7.1 - 视觉层次与间距重新梳理
 *
 * 信息层次（自上而下）：
 *   1) 概览顶部（overview）：LargeTitle "发现" + Focus 状态卡 —— 紧凑分组（16px）
 *   2) 功能入口（features）：分区标题 + 6 个彩色 tinted 卡 —— 与上方拉开（28px）
 *
 * 间距规范（globals.css 真·CSS 兜底，避开 Tailwind JIT 漏扫）：
 *   - data-discover-overview > * + *      → 16px
 *   - data-discover-page > section + section → 28px
 *   - data-discover-grid                    → mobile 12px / sm+ 16px
 *   - 卡内 icon→标题→描述                   → 14px / 4px
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, BookOpen, Bot, Clock, Sparkles, Sun, Syringe, TrendingUp, Trophy } from 'lucide-react';import { useBabyStore } from '@/stores/baby-store'
import { vaccineService, milestoneService } from '@/services/baby-extra'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { FocusCard } from '@/components/focus-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { staggerContainer, staggerItem, pressableSubtle } from '@/lib/motion'

interface VaccineStats {
  total: number
  completed: number
  overdue: number
  upcoming: number
}
interface MilestoneStats {
  total: number
  achieved: number
}

const features = [
  {
    icon: Syringe,
    title: '疫苗计划',
    desc: '记录与提醒',
    to: '/vaccine',
    bg: 'var(--feeding-bg)',
    fg: 'var(--feeding-fg)',
    accent: 'var(--feeding)',
  },
  {
    icon: Trophy,
    title: '成长里程碑',
    desc: '关键时刻',
    to: '/milestone',
    bg: 'var(--diaper-bg)',
    fg: 'var(--diaper-fg)',
    accent: 'var(--diaper)',
  },
  {
    icon: TrendingUp,
    title: '生长趋势',
    desc: '身高体重头围',
    to: '/growth',
    bg: 'var(--growth-bg)',
    fg: 'var(--growth-fg)',
    accent: 'var(--growth)',
  },
  {
    icon: BookOpen,
    title: '成长报告',
    desc: '周报 / 月报',
    to: '/report',
    bg: 'var(--brand-soft)',
    fg: 'var(--brand-ink)',
    accent: 'var(--brand)',
  },
  {
    icon: Sun,
    title: '黄疸记录',
    desc: '观察范围',
    to: '/jaundice',
    bg: 'var(--warning-bg)',
    fg: 'var(--warning-fg)',
    accent: 'var(--warning)',
  },
  {
    icon: Bot,
    title: 'AI 助手',
    desc: '智能护理咨询',
    to: '/ai-assistant',
    bg: 'var(--sleep-bg)',
    fg: 'var(--sleep-fg)',
    accent: 'var(--sleep)',
  },
]

export function DiscoverPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [vaccineStats, setVaccineStats] = useState<VaccineStats | null>(null)
  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats | null>(null)

  useEffect(() => {
    if (!currentBaby) return
    vaccineService
      .getStats(currentBaby.id)
      .then((s) => {
        setVaccineStats({
          total: s.total,
          overdue: s.overdue,
          upcoming: s.upcoming,
          completed: Math.max(0, s.total - s.overdue - s.upcoming),
        })
      })
      .catch(() => {})
    milestoneService
      .list(currentBaby.id)
      .then((res) => {
        setMilestoneStats({ total: res.total, achieved: res.items?.length || 0 })
      })
      .catch(() => {})
  }, [currentBaby])

  const focus = (() => {
    if (vaccineStats && vaccineStats.overdue > 0) {
      return {
        urgency: 'overdue' as const,
        title: '疫苗有逾期',
        description: `${vaccineStats.overdue} 项疫苗已逾期，请尽快安排接种`,
        icon: <AlertTriangle className="h-5 w-5" />,
        targetUrl: '/vaccine',
        badge: `${vaccineStats.overdue} 项逾期`,
      }
    }
    if (vaccineStats && vaccineStats.upcoming > 0) {
      return {
        urgency: 'upcoming' as const,
        title: '疫苗即将到期',
        description: `${vaccineStats.upcoming} 项疫苗即将到期，建议提前预约`,
        icon: <Clock className="h-5 w-5" />,
        targetUrl: '/vaccine',
        badge: `${vaccineStats.upcoming} 项待接种`,
      }
    }
    return {
      urgency: 'normal' as const,
      title: '一切顺利',
      description: currentBaby
        ? `${currentBaby.name} 的成长进展良好，继续保持`
        : '添加宝宝后可查看成长洞察',
      icon: <Sparkles className="h-5 w-5" />,
      targetUrl: '/milestone',
      badge: '状态良好',
    }
  })()

  return (
    <motion.div
      data-discover-page
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* 区块 1：标题 + 状态聚焦卡（同属"概览顶部"，紧凑分组） */}
      <motion.section variants={staggerItem} data-discover-overview>
        <LargeTitleHeader title="发现" subtitle="照护功能与智能工具" />
        {currentBaby && (
          <motion.div variants={staggerItem} data-discover-focus>
            <FocusCard
              urgency={focus.urgency}
              title={focus.title}
              description={focus.description}
              icon={focus.icon}
              targetUrl={focus.targetUrl}
              badge={focus.badge}
            />
          </motion.div>
        )}
      </motion.section>

      {/* 区块 2：功能入口（与上方拉开 28px，明确"换段落"） */}
      <motion.section variants={staggerItem} data-discover-features>
        <SectionHeader title="功能" variant="prominent" />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3"
          data-discover-grid
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {features.map((feature) => {
            let badge: string | null = null
            if (feature.to === '/vaccine' && vaccineStats && vaccineStats.total > 0) {
              badge = `${Math.round((vaccineStats.completed / vaccineStats.total) * 100)}%`
            } else if (feature.to === '/milestone' && milestoneStats && milestoneStats.total > 0) {
              badge = `${Math.round((milestoneStats.achieved / milestoneStats.total) * 100)}%`
            }
            return (
              <motion.div
                key={feature.title}
                variants={staggerItem}
                whileTap={pressableSubtle.whileTap}
                transition={pressableSubtle.transition}
              >
                <Link to={feature.to} className="block h-full">
                  <Card
                    as="article"
                    padding="sm"
                    className="h-full relative cursor-pointer"
                    style={{ backgroundColor: feature.bg }}
                    data-discover-card
                  >
                    {badge && (
                      <Badge
                        size="xs"
                        className="absolute top-3 right-3 font-semibold"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${feature.accent} 22%, transparent)`,
                          color: feature.fg,
                        }}
                      >
                        {badge}
                      </Badge>
                    )}
                    <div
                      className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${feature.accent} 22%, transparent)`,
                        color: feature.fg,
                      }}
                      data-discover-card-icon
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3
                      className="headline break-words"
                      style={{ color: feature.fg }}
                      data-discover-card-title
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="footnote break-words"
                      style={{ color: feature.fg, opacity: 0.78 }}
                      data-discover-card-desc
                    >
                      {feature.desc}
                    </p>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>
    </motion.div>
  )
}
