import { Link } from 'react-router-dom'
import { TrendingUp, Syringe, Trophy, Bot, Compass, AlertTriangle, Sparkles, Clock } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { vaccineService, milestoneService } from '@/services/baby-extra'
import { PageHeader } from '@/components/page-header'
import { FocusCard } from '@/components/focus-card'
import { WeeklyTrendOverview } from '@/components/weekly-trend-overview'
import { useWeeklyTrend } from '@/hooks/use-weekly-trend'
import { useState, useEffect } from 'react'

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
    color: 'var(--feeding)',
  },
  {
    icon: Trophy,
    title: '成长里程碑',
    desc: '关键时刻',
    to: '/milestone',
    color: 'var(--diaper)',
  },
  {
    icon: TrendingUp,
    title: '生长趋势',
    desc: '身高体重头围曲线',
    to: '/growth',
    color: 'var(--growth)',
  },
  {
    icon: Bot,
    title: 'AI 助手',
    desc: '智能护理咨询',
    to: '/ai-assistant',
    color: 'var(--sleep)',
  },
]

export function DiscoverPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [vaccineStats, setVaccineStats] = useState<VaccineStats | null>(null)
  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats | null>(null)
  const { data: weeklyTrend, isLoading: trendLoading } = useWeeklyTrend(currentBaby?.id)

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

  /** 选择最紧急的 Focus：优先 overdue，其次 upcoming，否则展示鼓励卡 */
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in-up">
      <PageHeader
        title="发现"
        variant="tab"
        icon={<Compass className="h-5 w-5" />}
        accentColor="var(--primary)"
      />

      {/* Focus Card：最紧急事项 */}
      {currentBaby && (
        <FocusCard
          urgency={focus.urgency}
          title={focus.title}
          description={focus.description}
          icon={focus.icon}
          targetUrl={focus.targetUrl}
          badge={focus.badge}
        />
      )}

      {/* 4 入口 Grid（移动 2 列 / 桌面 4 列），带进度 badge */}
      <div>
        <div className="section-header">
          <span className="section-header__title">功能</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          {features.map((feature) => {
            let badge: string | null = null
            if (feature.to === '/vaccine' && vaccineStats && vaccineStats.total > 0) {
              badge = `${Math.round((vaccineStats.completed / vaccineStats.total) * 100)}%`
            } else if (feature.to === '/milestone' && milestoneStats && milestoneStats.total > 0) {
              badge = `${Math.round((milestoneStats.achieved / milestoneStats.total) * 100)}%`
            }
            return (
              <Link
                key={feature.title}
                to={feature.to}
                className="card-interactive flex flex-col items-center text-center gap-2 py-5 relative"
              >
                {badge && (
                  <span
                    className="badge-mini absolute top-2 right-2 font-semibold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)`,
                      color: feature.color,
                    }}
                  >
                    {badge}
                  </span>
                )}
                <div
                  className="icon-circle icon-circle--lg"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${feature.color} 12%, transparent)`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
                </div>
                <div>
                  <h3 className="body-md font-medium text-[var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="caption mt-0.5">{feature.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 上周 vs 本周 趋势对比（与记录页精细卡差异化） */}
      {currentBaby && (
        <div>
          <div className="section-header">
            <span className="section-header__title">趋势对比</span>
          </div>
          <WeeklyTrendOverview
            trend={weeklyTrend ?? null}
            isLoading={trendLoading}
            detailUrl="/record"
            babyName={currentBaby.name}
          />
        </div>
      )}
    </div>
  )
}
