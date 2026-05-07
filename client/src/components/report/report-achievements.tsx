/**
 * ReportAchievements - 本期达成的里程碑 / 已接种的疫苗
 *
 * 两个 section 并列展示；无数据时温和空态（不渲染空 section）。
 */
import { Link } from 'react-router-dom'
import { Trophy, Syringe, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { MilestoneRecord, VaccineRecord } from '@/types'

interface ReportAchievementsProps {
  milestones: MilestoneRecord[]
  vaccines: VaccineRecord[]
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function ReportAchievements({ milestones, vaccines }: ReportAchievementsProps) {
  const hasMilestones = milestones.length > 0
  const hasVaccines = vaccines.length > 0

  if (!hasMilestones && !hasVaccines) {
    return (
      <Card padding="md" className="text-center">
        <p className="body-sm" style={{ color: 'var(--text-hint)' }}>
          本期还没有新的里程碑和疫苗接种
        </p>
      </Card>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {hasMilestones && (
        <AchievementCard
          Icon={Trophy}
          color="var(--diaper)"
          title={`达成里程碑 ${milestones.length} 项`}
          toUrl="/milestone"
          items={milestones.slice(0, 6).map((m) => ({
            id: m.id,
            title: m.name,
            subtitle: m.category,
            dateText: formatDateShort(m.achievedDate),
          }))}
          moreCount={milestones.length - 6}
        />
      )}
      {hasVaccines && (
        <AchievementCard
          Icon={Syringe}
          color="var(--feeding)"
          title={`接种疫苗 ${vaccines.length} 针`}
          toUrl="/vaccine"
          items={vaccines.slice(0, 6).map((v) => ({
            id: v.id,
            title: v.name,
            subtitle: v.dose,
            dateText: formatDateShort(v.vaccinatedDate),
          }))}
          moreCount={vaccines.length - 6}
        />
      )}
    </div>
  )
}

interface AchievementItem {
  id: string
  title: string
  subtitle: string
  dateText: string
}

function AchievementCard(props: {
  Icon: typeof Trophy
  color: string
  title: string
  toUrl: string
  items: AchievementItem[]
  moreCount: number
}) {
  const { Icon, color, title, toUrl, items, moreCount } = props
  return (
    <Card padding="sm" className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="icon-circle"
          style={{
            width: 28,
            height: 28,
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            color,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="body-md font-medium text-[var(--text-primary)] flex-1">
          {title}
        </span>
        <Link
          to={toUrl}
          className="inline-flex items-center gap-0.5 caption font-medium"
          style={{ color: 'var(--primary)' }}
        >
          详情 <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 py-0.5"
          >
            <span
              className="inline-block rounded-full shrink-0"
              style={{ width: 4, height: 4, backgroundColor: color }}
            />
            <span className="body-sm text-[var(--text-primary)] truncate flex-1">
              {it.title}
            </span>
            <span className="caption shrink-0" style={{ color: 'var(--text-hint)' }}>
              {it.subtitle} · {it.dateText}
            </span>
          </li>
        ))}
        {moreCount > 0 && (
          <li className="caption" style={{ color: 'var(--text-hint)' }}>
            还有 {moreCount} 条未展示
          </li>
        )}
      </ul>
    </Card>
  )
}
