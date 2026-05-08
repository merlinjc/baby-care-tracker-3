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
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { toast } from '@/components/ui/toast'
import { useReportData, type ReportPeriod } from '@/hooks/use-report-data'
import { renderReportImage, shareImage } from '@/lib/share-canvas'
import { staggerContainer, staggerItem } from '@/lib/motion'

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
      const result = await shareImage(blob, filename, `${currentBaby.name} 成长报告`)
      toast.success(result === 'shared' ? '已分享' : '报告图片已下载')
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? '分享失败')
    } finally {
      setIsSharing(false)
    }
  }

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
          <LargeTitleHeader title="成长报告" backTo="/discover" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <BookOpen
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: 'var(--label-tertiary)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              请先添加宝宝
            </p>
            <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
              添加宝宝后再查看成长报告
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
          title="成长报告"
          backTo="/discover"
          rightAction={
            <Button
              variant="tinted"
              size="sm"
              leftIcon={<Share2 className="h-3.5 w-3.5" />}
              onClick={handleShare}
              disabled={isSharing || data.isLoading}
            >
              {isSharing ? '生成中' : '分享'}
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
            { value: 'week', label: '本周报告' },
            { value: 'month', label: '本月报告' },
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
            <SectionHeader title="本期关键指标" variant="prominent" />
            <ReportMetricsGrid metrics={data.metrics} days={data.range.days} />
          </motion.section>

          {period === 'week' && data.weeklyTrend && (
            <motion.section variants={staggerItem}>
              <SectionHeader title="上周 vs 本周" variant="prominent" />
              <WeeklyTrendOverview
                trend={data.weeklyTrend}
                isLoading={false}
                detailUrl="/record"
                babyName={currentBaby.name}
              />
            </motion.section>
          )}

          <motion.section variants={staggerItem}>
            <SectionHeader title="每日节律" variant="prominent" />
            <ReportDailyRhythm daily={data.daily} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title="生长情况" variant="prominent" />
            <ReportGrowthSection start={data.growth.start} end={data.growth.end} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title="里程碑 & 疫苗" variant="prominent" />
            <ReportAchievements milestones={data.milestones} vaccines={data.vaccines} />
          </motion.section>

          <motion.section variants={staggerItem}>
            <SectionHeader title="AI 总结" variant="prominent" />
            <ReportAiSummary baby={currentBaby} data={data} />
          </motion.section>

          <motion.div variants={staggerItem}>
            <Button
              type="button"
              variant="filled"
              size="lg"
              block
              onClick={handleShare}
              disabled={isSharing}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              {isSharing ? '正在生成分享图…' : '分享这份报告'}
            </Button>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
