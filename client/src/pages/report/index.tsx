/**
 * ReportPage - 成长报告（/report）
 *
 * 组合：封面 → 关键指标 → 上周vs本周（仅周报）→ 每日节律 → 生长 → 成就 → AI 总结 → 分享
 */
import { useState } from 'react'
import { BookOpen, Share2 } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WeeklyTrendOverview } from '@/components/weekly-trend-overview'
import { ReportCover } from '@/components/report/report-cover'
import { ReportMetricsGrid } from '@/components/report/report-metrics-grid'
import { ReportDailyRhythm } from '@/components/report/report-daily-rhythm'
import { ReportGrowthSection } from '@/components/report/report-growth-section'
import { ReportAchievements } from '@/components/report/report-achievements'
import { ReportAiSummary } from '@/components/report/report-ai-summary'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { toast } from '@/components/ui/toast'
import { useReportData, type ReportPeriod } from '@/hooks/use-report-data'
import { renderReportImage, shareImage } from '@/lib/share-canvas'

export function ReportPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [isSharing, setIsSharing] = useState(false)

  const data = useReportData(currentBaby?.id, period, currentBaby?.birthDate)

  const handleShare = async () => {
    if (!currentBaby || isSharing) return
    setIsSharing(true)
    try {
      const blob = await renderReportImage({ baby: currentBaby, data })
      const filename = `${currentBaby.name}_${period === 'week' ? '周报' : '月报'}_${data.range.start.toISOString().slice(0, 10)}.jpg`
      const result = await shareImage(
        blob,
        filename,
        `${currentBaby.name} 成长报告`,
      )
      toast.success(result === 'shared' ? '已分享' : '报告图片已下载')
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? '分享失败')
    } finally {
      setIsSharing(false)
    }
  }

  if (!currentBaby) {
    return (
      <div className="space-y-5 animate-fade-in-up">
        <PageHeader
          title="成长报告"
          backTo="/discover"
          icon={<BookOpen className="h-5 w-5" />}
        />
        <Card padding="lg" className="text-center">
          <BookOpen
            className="h-6 w-6 mx-auto mb-3"
            style={{ color: 'var(--text-hint)' }}
          />
          <p className="body-sm" style={{ color: 'var(--text-hint)' }}>
            请先添加宝宝后再查看成长报告
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="成长报告"
        backTo="/discover"
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Share2 className="h-3.5 w-3.5" />}
            onClick={handleShare}
            disabled={isSharing || data.isLoading}
          >
            {isSharing ? '生成中' : '分享'}
          </Button>
        }
      />

      {/* 周 / 月 切换 */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
        <TabsList variant="pill" aria-label="报告周期">
          <TabsTrigger variant="pill" value="week">
            本周报告
          </TabsTrigger>
          <TabsTrigger variant="pill" value="month">
            本月报告
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 封面 */}
      <ReportCover baby={currentBaby} period={period} range={data.range} />

      {data.isLoading ? (
        <ListSkeleton count={4} />
      ) : (
        <>
          {/* 关键指标 */}
          <section>
            <div className="section-header">
              <span className="section-header__title">本期关键指标</span>
            </div>
            <ReportMetricsGrid metrics={data.metrics} days={data.range.days} />
          </section>

          {/* 上周 vs 本周：仅周报 */}
          {period === 'week' && data.weeklyTrend && (
            <section>
              <div className="section-header">
                <span className="section-header__title">上周 vs 本周</span>
              </div>
              <WeeklyTrendOverview
                trend={data.weeklyTrend}
                isLoading={false}
                detailUrl="/record"
                babyName={currentBaby.name}
              />
            </section>
          )}

          {/* 每日节律 */}
          <section>
            <div className="section-header">
              <span className="section-header__title">每日节律</span>
            </div>
            <ReportDailyRhythm daily={data.daily} />
          </section>

          {/* 生长变化 */}
          <section>
            <div className="section-header">
              <span className="section-header__title">生长情况</span>
            </div>
            <ReportGrowthSection start={data.growth.start} end={data.growth.end} />
          </section>

          {/* 里程碑 & 疫苗 */}
          <section>
            <div className="section-header">
              <span className="section-header__title">里程碑 & 疫苗</span>
            </div>
            <ReportAchievements
              milestones={data.milestones}
              vaccines={data.vaccines}
            />
          </section>

          {/* AI 总结 */}
          <section>
            <div className="section-header">
              <span className="section-header__title">AI 总结</span>
            </div>
            <ReportAiSummary baby={currentBaby} data={data} />
          </section>

          {/* 底部分享 CTA */}
          <Button
            type="button"
            variant="primary"
            size="md"
            block
            onClick={handleShare}
            disabled={isSharing}
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            {isSharing ? '正在生成分享图…' : '分享这份报告'}
          </Button>
        </>
      )}
    </div>
  )
}
