/**
 * ReportPage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader（带返回 + 右上分享按钮）
 * - Tabs pill → SegmentedControl（周/月切换）
 * - 各 section 用 SectionHeader variant="prominent"
 * - 分享 CTA：filled brand 按钮
 * - 保留 ReportCover / ReportMetricsGrid / ReportDailyRhythm 等子组件不动
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Share2 } from 'lucide-react';
import { motion } from 'framer-motion'
import { useBabyStore } from '@/stores/baby-store'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WeeklyTrendOverview } from '@/components/weekly-trend-overview'
import { ReportCover } from '@/components/report/report-cover'
import { ReportMetricsGrid } from '@/components/report/report-metrics-grid'
import { ReportDailyRhythm } from '@/components/report/report-daily-rhythm'
import { ReportGrowthSection } from '@/components/report/report-growth-section'
import { ReportAchievements } from '@/components/report/report-achievements'
import { ReportAiSummary } from '@/components/report/report-ai-summary'
import { ReportShareDialog } from '@/components/report/report-share-dialog'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { useReportData, type ReportPeriod } from '@/hooks/use-report-data'
import { staggerContainer, staggerItem } from '@/lib/motion'

export function ReportPage() {
  const { t } = useTranslation('report')
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [shareOpen, setShareOpen] = useState(false)

  const data = useReportData(currentBaby?.id, period, currentBaby?.birthDate)

  const handleShare = () => {
    if (!currentBaby || data.isLoading) return
    setShareOpen(true)
  }

  const filenameStem = currentBaby
    ? `${currentBaby.name}_${period === 'week' ? t('share.filename_week') : t('share.filename_month')}_${data.range.start.toISOString().slice(0, 10)}`
    : ''
  const shareTitle = currentBaby
    ? t('share.title_template', { name: currentBaby.name })
    : ''

  if (!currentBaby) {
    return (
      <motion.div
        className="space-y-5"
        data-page-stack
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <LargeTitleHeader title={t('title')} backTo="/discover" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <BookOpen
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              {t('no_baby.title')}
            </p>
            <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
              {t('no_baby.desc')}
            </p>
          </Card>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title={t('title')}
          backTo="/discover"
          rightAction={
            <Button
              variant="tinted"
              size="sm"
              leftIcon={<Share2 className="h-3.5 w-3.5" />}
              onClick={handleShare}
              disabled={data.isLoading}
            >
              {t('actions.share')}
            </Button>
          }
        />
      </motion.div>

      {/* 周 / 月切换 */}
      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={period}
          onChange={(v) => setPeriod(v as ReportPeriod)}
          options={[
            { value: 'week', label: t('period.week') },
            { value: 'month', label: t('period.month') },
          ]}
          size="md"
        />
      </motion.div>

      {/* 封面 */}
      <motion.div variants={staggerItem}>
        <ReportCover baby={currentBaby} period={period} range={data.range} />
      </motion.div>

      {data.isLoading ? (
        <ListSkeleton count={4} />
      ) : (
        <>
          <motion.section variants={staggerItem}>
            <SectionHeader title={t('section.metrics')} variant="prominent" />
            <ReportMetricsGrid metrics={data.metrics} days={data.range.days} />
          </motion.section>

          {period === 'week' && data.weeklyTrend && (
            <motion.section variants={staggerItem}>
              <SectionHeader title={t('section.weekly_compare')} variant="prominent" />
              <WeeklyTrendOverview
                trend={data.weeklyTrend}
                isLoading={false}
                detailUrl="/record"
                babyName={currentBaby.name}
              />
            </motion.section>
          )}

          <motion.section variants={staggerItem}>
            <SectionHeader title={t('section.daily_rhythm')} variant="prominent" />
            <ReportDailyRhythm daily={data.daily} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title={t('section.growth')} variant="prominent" />
            <ReportGrowthSection start={data.growth.start} end={data.growth.end} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title={t('section.achievements')} variant="prominent" />
            <ReportAchievements milestones={data.milestones} vaccines={data.vaccines} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title={t('section.ai_summary')} variant="prominent" />
            <ReportAiSummary baby={currentBaby} data={data} />
          </motion.section>

          <motion.div variants={staggerItem}>
            <Button
              type="button"
              variant="filled"
              size="lg"
              block
              onClick={handleShare}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              {t('actions.share_full_button')}
            </Button>
          </motion.div>
        </>
      )}

      {/* 分享 Dialog（v7.2 T-S2-F4） */}
      {currentBaby && shareOpen && (
        <ReportShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          baby={currentBaby}
          data={data}
          filenameStem={filenameStem}
          shareTitle={shareTitle}
        />
      )}
    </motion.div>
  )
}
