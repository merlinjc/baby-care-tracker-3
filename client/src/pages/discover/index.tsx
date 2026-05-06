import { Link } from 'react-router-dom'
import { TrendingUp, Syringe, Trophy, Bot, Users, Download } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { vaccineService } from '@/services/baby-extra'
import { milestoneService } from '@/services/baby-extra'
import { useState, useEffect } from 'react'

const features = [
  {
    icon: TrendingUp,
    title: '生长趋势',
    desc: '身高体重头围曲线',
    to: '/growth',
    color: 'var(--growth)',
  },
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
    icon: Bot,
    title: 'AI 助手',
    desc: '智能护理咨询',
    to: '/ai-assistant',
    color: 'var(--sleep)',
  },
  {
    icon: Users,
    title: '家庭管理',
    desc: '成员与角色',
    to: '/family',
    color: 'var(--primary)',
  },
  {
    icon: Download,
    title: '数据导出',
    desc: 'JSON / CSV',
    to: '/settings',
    color: 'var(--temperature)',
  },
]

export function DiscoverPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [vaccineStats, setVaccineStats] = useState<{ total: number; completed: number } | null>(null)
  const [milestoneStats, setMilestoneStats] = useState<{ total: number; achieved: number } | null>(null)

  useEffect(() => {
    if (!currentBaby) return
    vaccineService.getStats(currentBaby.id).then((s) => {
      setVaccineStats({ total: s.total, completed: s.total - s.overdue - s.upcoming })
    }).catch(() => {})
    milestoneService.list(currentBaby.id).then((res) => {
      setMilestoneStats({ total: res.total, achieved: res.items?.length || 0 })
    }).catch(() => {})
  }, [currentBaby])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <h1 className="heading-lg text-[var(--text-primary)]">发现</h1>

      {/* Quick Stats with percentage badges */}
      {currentBaby && (vaccineStats || milestoneStats) && (
        <div className="grid grid-cols-2 gap-3">
          {vaccineStats && (
            <Link to="/vaccine" className="card-interactive flex items-center gap-3 relative">
              {vaccineStats.total > 0 && (
                <span
                  className="absolute top-3 right-3 text-[10px] number-display font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--feeding) 15%, transparent)',
                    color: 'var(--feeding)',
                  }}
                >
                  {Math.round((vaccineStats.completed / vaccineStats.total) * 100)}%
                </span>
              )}
              <div
                className="icon-circle icon-circle--md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--feeding) 12%, transparent)' }}
              >
                <Syringe className="h-5 w-5" style={{ color: 'var(--feeding)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="body-md font-medium text-[var(--text-primary)]">疫苗进度</p>
                <div className="mt-1.5">
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{ width: vaccineStats.total > 0 ? `${(vaccineStats.completed / vaccineStats.total) * 100}%` : '0%', background: 'var(--feeding)' }}
                    />
                  </div>
                  <p className="caption mt-1">
                    {vaccineStats.completed}/{vaccineStats.total} 已接种
                  </p>
                </div>
              </div>
            </Link>
          )}
          {milestoneStats && (
            <Link to="/milestone" className="card-interactive flex items-center gap-3 relative">
              {milestoneStats.total > 0 && (
                <span
                  className="absolute top-3 right-3 text-[10px] number-display font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--diaper) 15%, transparent)',
                    color: 'var(--diaper)',
                  }}
                >
                  {Math.round((milestoneStats.achieved / milestoneStats.total) * 100)}%
                </span>
              )}
              <div
                className="icon-circle icon-circle--md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--diaper) 12%, transparent)' }}
              >
                <Trophy className="h-5 w-5" style={{ color: 'var(--diaper)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="body-md font-medium text-[var(--text-primary)]">里程碑</p>
                <div className="mt-1.5">
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{ width: milestoneStats.total > 0 ? `${(milestoneStats.achieved / milestoneStats.total) * 100}%` : '0%', background: 'var(--diaper)' }}
                    />
                  </div>
                  <p className="caption mt-1">
                    {milestoneStats.achieved}/{milestoneStats.total} 已达成
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Feature 2x3 Grid (launcher style) */}
      <div>
        <div className="section-header">
          <span className="section-header__title">功能</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger-children">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.to}
              className="card-interactive flex flex-col items-center text-center gap-2 py-5"
            >
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
                <h3 className="body-md font-medium text-[var(--text-primary)]">{feature.title}</h3>
                <p className="caption mt-0.5">{feature.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
