/**
 * HomePage v7 — iOS Health 风首页
 *
 * 信息架构（自上而下）：
 *   1. LargeTitleHeader - 问候语 + 宝宝状态 + 右上角 BabySwitcher
 *   2. StatusCapsule (Hero) - 仅在有 activeSleep / 异常 / 刚喂养时显示
 *   3. TodaySummary (2x2) - 今日四大指标 tinted 色卡（点击可直接打开对应记录弹窗）
 *   4. AI 洞察（去折叠，单卡 chip 风）
 *   5. Today Timeline - ListRow 风时间线
 *
 * 注：原 QuickRecordBar（5 个彩色圆按钮快捷记录）已移除，
 *     其功能与 TodaySummary 点击入口重复，统一由今日概览承接快捷记录。
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { AlertCircle, Clock, Lightbulb, PlusCircle, RefreshCw, Sparkles } from 'lucide-react';import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { useDialog } from '@/hooks/use-dialog'
import { useActiveSleep } from '@/hooks/use-active-sleep'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { usePermission } from '@/hooks/use-permission'
import { recordService } from '@/services/record'
import { aiService } from '@/services/ai'

// Dialogs
import { FeedingDialog } from '@/components/feeding-dialog'
import { SleepDialog } from '@/components/sleep-dialog'
import { DiaperDialog } from '@/components/diaper-dialog'
import { TemperatureDialog } from '@/components/temperature-dialog'
import { GrowthDialog } from '@/components/growth-dialog'

// Components
import { Timeline } from '@/components/timeline'
import { BabySwitcher } from '@/components/baby-switcher'
import { StatusCapsule } from '@/components/status-capsule'
import { TodaySummary } from '@/components/today-summary'
import { HomeSkeleton } from '@/components/home-skeleton'
import { EasterEggDisplay } from '@/components/easter-egg-display'

// UI
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'

// Lib
import { buildFallbackInsight, isInsightEmpty } from '@/lib/insight-fallback'
import { detectAll, type EggResult } from '@/lib/easter-egg'
import { ApiError } from '@/lib/api-error'
import { relationToCareRole } from '@/lib/care-role'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { TodayStats, RecordType, CareRecord, DailyInsight, CareRole } from '@/types'

const defaultStats: TodayStats = {
  feeding: { count: 0, totalAmount: 0, lastTime: null, lastTimeTs: null },
  sleep: { count: 0, totalDuration: 0, lastTime: null, lastTimeTs: null, lastEndTime: null, lastEndTimeTs: null },
  diaper: { count: 0, peeCount: 0, poopCount: 0, lastTime: null, lastTimeTs: null },
  temperature: { count: 0, latestValue: null, lastTime: null, lastTimeTs: null },
}

type DialogType = 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth'

export function HomePage() {
  const { t } = useTranslation('home')
  const user = useAuthStore((s) => s.user)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const family = useFamilyStore((s) => s.family)
  const loadFamily = useFamilyStore((s) => s.loadFamily)
  const loadBabies = useBabyStore((s) => s.loadBabies)
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const feedingDialog = useDialog()
  const sleepDialog = useDialog()
  const diaperDialog = useDialog()
  const temperatureDialog = useDialog()
  const growthDialog = useDialog()

  const dialogMap: Record<DialogType, { openDialog: () => void }> = {
    feeding: feedingDialog,
    sleep: sleepDialog,
    diaper: diaperDialog,
    temperature: temperatureDialog,
    growth: growthDialog,
  }

  // ── 数据加载 ──
  const { data: stats = defaultStats, isLoading: statsLoading } = useQuery({
    queryKey: ['todayStats', currentBaby?.id],
    queryFn: () => (currentBaby ? recordService.getTodayStats(currentBaby.id) : Promise.resolve(defaultStats)),
    enabled: !!currentBaby,
    staleTime: 30 * 1000,
  })

  const { data: todayRecords = [] } = useQuery<CareRecord[]>({
    queryKey: ['records', currentBaby?.id, 'today'],
    queryFn: async () => {
      if (!currentBaby) return []
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
      const result = await recordService.getRecords({
        babyId: currentBaby.id,
        startDate: startOfDay,
        endDate: endOfDay,
        page: 1,
        pageSize: 50,
      })
      return result.items ?? []
    },
    enabled: !!currentBaby,
    staleTime: 15 * 1000,
  })

  const { activeSleep, start: startSleep, end: endSleep, cancel: cancelSleep } = useActiveSleep(currentBaby?.id)
  const { canEdit } = usePermission()

  // ── AI Insight ──
  const [insightCollapsed, setInsightCollapsed] = useLocalStorageState('ai_insight_collapsed', false)
  // 保留 setter 以兼容 Lint；当前 iOS 风不再提供折叠 UI，但预留能力
  void insightCollapsed
  void setInsightCollapsed

  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  const careRole: CareRole = useMemo(() => {
    const currentUserId = user?.id
    const me = family?.members?.find((m) => m.userId === currentUserId)
    return relationToCareRole(me?.relation ?? null) ?? 'other'
  }, [family, user?.id])

  const fetchDailyInsight = useCallback(async () => {
    if (!currentBaby) return
    setInsightLoading(true)
    try {
      const result = await aiService.getDailyInsight(currentBaby.id, careRole)
      setDailyInsight(result.insight)
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'QUOTA_EXCEEDED') {
        toast.warning(e.message)
        setDailyInsight(null)
      } else {
        setDailyInsight(buildFallbackInsight(stats))
      }
    } finally {
      setInsightLoading(false)
    }
  }, [currentBaby, stats, careRole])

  useEffect(() => {
    if (user?.familyId) {
      loadFamily()
      loadBabies(user.familyId)
    }
  }, [user?.familyId, loadFamily, loadBabies])

  useEffect(() => {
    fetchDailyInsight()
  }, [fetchDailyInsight])

  // ── 彩蛋 ──
  const [eggResults, setEggResults] = useState<EggResult[]>([])
  const birthDayCount = useMemo(() => {
    if (!currentBaby?.birthDate) return 0
    const birth = new Date(currentBaby.birthDate)
    birth.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000)) + 1
  }, [currentBaby?.birthDate])

  useEffect(() => {
    if (!currentBaby || birthDayCount === 0) return
    const t = setTimeout(() => {
      const detected = detectAll({
        babyId: currentBaby.id,
        babyName: currentBaby.name,
        birthDayCount,
        todayStats: stats,
        recentRecords: todayRecords,
      })
      setEggResults(detected)
    }, 500)
    return () => clearTimeout(t)
  }, [currentBaby, birthDayCount, stats, todayRecords])

  const handleEggConsume = (storageKey: string) => {
    setEggResults((prev) => prev.filter((e) => e.storageKey !== storageKey))
  }

  // ── 操作 ──
  const refreshAll = () => {
    if (!currentBaby) return
    queryClient.invalidateQueries({ queryKey: ['todayStats', currentBaby.id] })
    queryClient.invalidateQueries({ queryKey: ['records', currentBaby.id] })
    queryClient.invalidateQueries({ queryKey: ['activeSleep', currentBaby.id] })
  }

  const createRecord = async (
    recordType: RecordType,
    data: Record<string, unknown>,
    meta: { recordTime: string; editingId?: string; endTime?: string },
  ) => {
    if (!currentBaby) return
    try {
      if (meta.editingId) {
        await recordService.updateRecord(meta.editingId, {
          startTime: meta.recordTime,
          ...(meta.endTime !== undefined ? { endTime: meta.endTime } : {}),
          ...(data as Partial<CareRecord>),
        })
        refreshAll()
        toast.success('已更新')
      } else {
        await recordService.createRecord({
          babyId: currentBaby.id,
          recordType,
          startTime: meta.recordTime,
          ...(meta.endTime !== undefined ? { endTime: meta.endTime } : {}),
          ...data,
        })
        refreshAll()
        toast.success('记录已添加')
      }
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'PERMISSION_DENIED') {
        toast.error('您没有创建记录的权限')
      } else if (e.code === 'SLEEP_ALREADY_ACTIVE') {
        toast.warning(e.message)
        refreshAll()
      } else {
        toast.error(e.message ?? (meta.editingId ? '更新失败' : '添加失败'))
      }
    }
  }

  const handleEndSleep = async () => {
    try {
      await endSleep()
      toast.success('睡眠记录已保存')
    } catch (err) {
      toast.error((err as ApiError).message ?? '结束失败')
    }
  }

  const handleStartSleep = async () => {
    try {
      const created = await startSleep('nap')
      if (created) {
        toast.success('已开始睡眠计时')
        queryClient.invalidateQueries({ queryKey: ['todayStats', currentBaby?.id] })
      }
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'PERMISSION_DENIED') {
        toast.error('您没有创建记录的权限')
      } else {
        toast.error(e.message ?? '开始计时失败')
      }
    }
  }

  const handleCancelSleep = async () => {
    const ok = await confirm({
      title: '取消进行中的睡眠计时？',
      description: '取消计时将删除当前进行中的睡眠记录，此操作不可撤销。',
      confirmText: '取消计时',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await cancelSleep()
      toast.info('已取消计时')
    } catch (err) {
      toast.error((err as ApiError).message ?? '取消失败')
    }
  }

  const openRecordDialog = (type: DialogType) => {
    dialogMap[type].openDialog()
  }

  const handleSelectStat = (key: 'feeding' | 'sleep' | 'diaper' | 'temperature') => {
    openRecordDialog(key)
  }

  if (statsLoading && !currentBaby) {
    return <HomeSkeleton />
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return t('greeting.late_night')
    if (hour < 12) return t('greeting.morning')
    if (hour < 14) return t('greeting.noon')
    if (hour < 18) return t('greeting.afternoon')
    return t('greeting.evening')
  }

  const insightToShow = dailyInsight ?? buildFallbackInsight(stats)
  const isInsightFromAI = dailyInsight?.source === 'ai'
  const showInsight = currentBaby && !isInsightEmpty(insightToShow)

  const babySubtitle = currentBaby
    ? t('header.today_records', { name: currentBaby.name })
    : t('header.no_baby')

  return (
    <motion.div
      className="space-y-5"
      data-home-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* 彩蛋横幅 */}
      <EasterEggDisplay results={eggResults} onConsume={handleEggConsume} />

      {/* Large Title Header */}
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title={`${getGreeting()}，${user?.nickname || '你好'}`}
          subtitle={babySubtitle}
          rightAction={<BabySwitcher size="md" />}
        />
      </motion.div>

      {/* No family 引导 */}
      {!family && (
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg">
            <div
              className="icon-circle icon-circle--lg mx-auto mb-4"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 14%, transparent)' }}
            >
              <PlusCircle className="h-6 w-6" style={{ color: 'var(--brand-ink)' }} />
            </div>
            <p className="text-[15px] text-[var(--label-secondary)] mb-4">
              您还未加入家庭
            </p>
            <Link to="/family" className="inline-block">
              <Button variant="filled">创建或加入家庭</Button>
            </Link>
          </Card>
        </motion.div>
      )}

      {/* Status Capsule (Hero) */}
      {currentBaby && (
        <motion.div variants={staggerItem}>
          <StatusCapsule
            stats={stats}
            activeSleep={activeSleep}
            babyName={currentBaby.name}
            onEndSleep={handleEndSleep}
            onCancelAbnormal={handleCancelSleep}
          />
        </motion.div>
      )}

      {/* Today Summary (2x2 Health cards) */}
      {currentBaby && (
        <motion.div variants={staggerItem}>
          <SectionHeader title="今日概览" variant="default" />
          <TodaySummary
            stats={stats}
            birthDateIso={currentBaby.birthDate}
            onSelect={handleSelectStat}
            sleepActive={!!activeSleep}
            canControlSleep={canEdit}
            onStartSleep={handleStartSleep}
            onEndSleep={handleEndSleep}
          />
        </motion.div>
      )}

      {/* AI Insight（单卡 chip 风，去折叠） */}
      {showInsight && (
        <motion.div variants={staggerItem}>
          <SectionHeader
            title="AI 每日洞察"
            variant="default"
            subtitle={!isInsightFromAI ? '· 快速模式' : undefined}
            action={
              <button
                type="button"
                onClick={fetchDailyInsight}
                disabled={insightLoading}
                className="flex items-center gap-1 text-[13px] font-medium text-[var(--brand-ink)] hover:opacity-70 transition-opacity disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${insightLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            }
          />
          <Card variant="plain" padding="md" className="space-y-3">
            {/* Summary */}
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--sleep-bg)' }}
              >
                <Sparkles className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--label)] flex-1 pt-0.5">
                {insightToShow.summary}
              </p>
            </div>

            {/* Suggestions */}
            {insightToShow.suggestions.length > 0 && (
              <div className="pl-[38px] space-y-1.5">
                {insightToShow.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-[var(--label-secondary)]">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--sleep)' }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Alerts */}
            {insightToShow.alerts.length > 0 && (
              <div className="pl-[38px] space-y-1.5">
                {insightToShow.alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-[var(--danger)] font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Today Timeline */}
      {currentBaby && (
        <motion.div variants={staggerItem}>
          <SectionHeader
            title={t('sections.today_timeline')}
            variant="default"
            action={
              <Link
                to="/record"
                className="flex items-center gap-1 text-[13px] font-medium text-[var(--brand-ink)] hover:opacity-70 transition-opacity"
              >
                <Clock className="h-3.5 w-3.5" />
                {t('actions.view_all')}
              </Link>
            }
          />
          <Card variant="plain" padding="none">
            {todayRecords.length === 0 ? (
              <div className="py-10 px-5 text-center">
                <p className="text-[14px] text-[var(--label-tertiary)] mb-2">
                  {t('timeline.empty_title')}
                </p>
                <p className="text-[12px] text-[var(--label-quaternary)]">
                  {t('timeline.empty_desc')}
                </p>
              </div>
            ) : (
              <>
                <Timeline records={todayRecords.slice(0, 5)} compact />
                {todayRecords.length > 5 && (
                  <Link
                    to="/record"
                    className={`
                      block text-center py-3 text-[13px] font-medium
                      text-[var(--brand-ink)] hover:bg-[var(--surface-hover)]
                      transition-colors border-t border-[var(--separator)]
                    `}
                  >
                    {t('actions.view_all_today', { count: todayRecords.length })}
                  </Link>
                )}
              </>
            )}
          </Card>
        </motion.div>
      )}

      {/* Quick Record Bar 已移除：功能与 TodaySummary 点击入口重复 */}

      {/* Dialogs */}
      <FeedingDialog
        open={feedingDialog.open}
        onClose={feedingDialog.closeDialog}
        onSubmit={(data, meta) => createRecord('feeding', { feedingData: data }, meta)}
      />
      <SleepDialog
        open={sleepDialog.open}
        onClose={sleepDialog.closeDialog}
        onSubmit={(data, meta) => createRecord('sleep', { sleepData: data }, meta)}
      />
      <DiaperDialog
        open={diaperDialog.open}
        onClose={diaperDialog.closeDialog}
        onSubmit={(data, meta) => createRecord('diaper', { diaperData: data }, meta)}
      />
      <TemperatureDialog
        open={temperatureDialog.open}
        onClose={temperatureDialog.closeDialog}
        onSubmit={(data, meta) => createRecord('temperature', { temperatureData: data }, meta)}
      />
      <GrowthDialog
        open={growthDialog.open}
        onClose={growthDialog.closeDialog}
        onSubmit={(data, meta) => createRecord('growth', { growthData: data }, meta)}
      />
    </motion.div>
  )
}
