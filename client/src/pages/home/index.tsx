import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles, Clock, RefreshCw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { useDialog } from '@/hooks/use-dialog'
import { useActiveSleep } from '@/hooks/use-active-sleep'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { usePermission } from '@/hooks/use-permission'
import { recordService } from '@/services/record'
import { aiService } from '@/services/ai'
import { FeedingDialog } from '@/components/feeding-dialog'
import { SleepDialog } from '@/components/sleep-dialog'
import { DiaperDialog } from '@/components/diaper-dialog'
import { TemperatureDialog } from '@/components/temperature-dialog'
import { GrowthDialog } from '@/components/growth-dialog'
import { Timeline } from '@/components/timeline'
import { BabySwitcher } from '@/components/baby-switcher'
import { StatusCapsule } from '@/components/status-capsule'
import { TodaySummary } from '@/components/today-summary'
import { HomeSkeleton } from '@/components/home-skeleton'
import { EasterEggDisplay } from '@/components/easter-egg-display'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { buildFallbackInsight, isInsightEmpty } from '@/lib/insight-fallback'
import { detectAll, type EggResult } from '@/lib/easter-egg'
import { ApiError } from '@/lib/api-error'
import type { TodayStats, RecordType, CareRecord, DailyInsight } from '@/types'

const defaultStats: TodayStats = {
  feeding: { count: 0, totalAmount: 0, lastTime: null, lastTimeTs: null },
  sleep: { count: 0, totalDuration: 0, lastTime: null, lastTimeTs: null, lastEndTime: null, lastEndTimeTs: null },
  diaper: { count: 0, peeCount: 0, poopCount: 0, lastTime: null, lastTimeTs: null },
  temperature: { count: 0, latestValue: null, lastTime: null, lastTimeTs: null },
}

type DialogType = 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth'

export function HomePage() {
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

  // ========== React Query 数据加载 ==========
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

  // FR-A1：进行中睡眠 + 状态胶囊
  const { activeSleep, start: startSleep, end: endSleep, cancel: cancelSleep } = useActiveSleep(currentBaby?.id)
  const { canEdit } = usePermission()

  // FR-A4：AI 洞察折叠态（持久化）
  const [insightCollapsed, setInsightCollapsed] = useLocalStorageState('ai_insight_collapsed', false)
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  const fetchDailyInsight = useCallback(async () => {
    if (!currentBaby) return
    setInsightLoading(true)
    try {
      const result = await aiService.getDailyInsight(currentBaby.id)
      setDailyInsight(result.insight)
    } catch (err) {
      // 配额耗尽不降级
      const e = err as ApiError
      if (e.code === 'QUOTA_EXCEEDED') {
        toast.warning(e.message)
        setDailyInsight(null)
      } else {
        // 其他错误 → 前端规则引擎降级
        setDailyInsight(buildFallbackInsight(stats))
      }
    } finally {
      setInsightLoading(false)
    }
  }, [currentBaby, stats])

  // ========== 初始化 ==========
  useEffect(() => {
    if (user?.familyId) {
      loadFamily()
      loadBabies(user.familyId)
    }
  }, [user?.familyId, loadFamily, loadBabies])

  useEffect(() => {
    fetchDailyInsight()
  }, [fetchDailyInsight])

  // FR-G2：彩蛋检测
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
    // 延迟 500ms 触发，避开主渲染
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

  // ========== 操作 ==========
  const refreshAll = () => {
    if (!currentBaby) return
    queryClient.invalidateQueries({ queryKey: ['todayStats', currentBaby.id] })
    queryClient.invalidateQueries({ queryKey: ['records', currentBaby.id] })
    queryClient.invalidateQueries({ queryKey: ['activeSleep', currentBaby.id] })
  }

  const createRecord = async (recordType: RecordType, data: Record<string, unknown>, meta: { recordTime: string; editingId?: string; endTime?: string }) => {
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

  // FR-A1：状态胶囊「结束」按钮 → 对应 Dialog 内自动取 endTime
  const handleEndSleep = async () => {
    try {
      await endSleep()
      toast.success('睡眠记录已保存')
    } catch (err) {
      toast.error((err as ApiError).message ?? '结束失败')
    }
  }

  // 睡眠卡片「开始」按钮：在 endTime=null 模式下创建一条进行中睡眠
  const handleStartSleep = async () => {
    try {
      const created = await startSleep('nap')
      if (created) {
        toast.success('已开始睡眠计时')
        // 让首页同步刷新（含状态胶囊文案）
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

  // 早期渲染：骨架屏
  if (statsLoading && !currentBaby) {
    return <HomeSkeleton />
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 12) return '早上好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }

  const insightToShow = dailyInsight ?? buildFallbackInsight(stats)
  const isInsightFromAI = dailyInsight?.source === 'ai'

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in-up">
      {/* FR-G2：彩蛋（banner 在顶部，popup/toast 全局渲染） */}
      <EasterEggDisplay results={eggResults} onConsume={handleEggConsume} />

      {/* Greeting + 多宝切换 */}
      <div className="flex items-start justify-between gap-3 pt-2">
        <div className="flex-1 min-w-0">
          <h1 className="heading-xl text-[var(--text-primary)] truncate">
            {getGreeting()}，{user?.nickname || '用户'}
          </h1>
          <p className="body-md text-[var(--text-hint)] mt-1">
            {currentBaby ? `${currentBaby.name} · 今日记录` : '尚未添加宝宝'}
          </p>
        </div>
        <BabySwitcher />
      </div>

      {/* No family prompt */}
      {!family && (
        <div className="card text-center py-10">
          <div
            className="icon-circle icon-circle--lg mx-auto mb-4"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <Plus className="h-6 w-6" style={{ color: 'var(--primary)' }} />
          </div>
          <p className="body-md text-[var(--text-secondary)] mb-4">您还未加入家庭</p>
          <Link to="/family" className="btn-primary">
            创建或加入家庭
          </Link>
        </div>
      )}

      {/* FR-A1：状态胶囊 */}
      {currentBaby && (
        <StatusCapsule
          stats={stats}
          activeSleep={activeSleep}
          babyName={currentBaby.name}
          onEndSleep={handleEndSleep}
          onCancelAbnormal={handleCancelSleep}
        />
      )}

      {/* FR-A3：今日 4 列摘要 + 进度条 */}
      {currentBaby && (
        <TodaySummary
          stats={stats}
          birthDateIso={currentBaby.birthDate}
          onSelect={handleSelectStat}
          sleepActive={!!activeSleep}
          canControlSleep={canEdit}
          onStartSleep={handleStartSleep}
          onEndSleep={handleEndSleep}
        />
      )}

      {/* FR-A4：AI 洞察折叠态 */}
      {currentBaby && !isInsightEmpty(insightToShow) && (
        <div>
          <div className="section-header">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
              <span className="section-header__title">AI 每日洞察</span>
              {!isInsightFromAI && (
                <span className="caption text-[var(--text-hint)]">· 快速模式</span>
              )}
            </div>
            <button
              onClick={fetchDailyInsight}
              disabled={insightLoading}
              className="section-header__action"
              title="重新生成"
            >
              <RefreshCw className={`h-3 w-3 ${insightLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
          {insightCollapsed ? (
            <button
              onClick={() => setInsightCollapsed(false)}
              className="card-base w-full flex items-center gap-2 text-left transition-colors hover:border-[var(--sleep)]"
            >
              <Lightbulb className="h-4 w-4 shrink-0" style={{ color: 'var(--sleep)' }} />
              <span className="body-md flex-1 truncate text-[var(--text-secondary)]">
                {insightToShow.summary}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--text-hint)' }} />
            </button>
          ) : (
            <div className="card-base space-y-3" style={{ borderTop: '3px solid var(--sleep)' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="body-md text-[var(--text-primary)] flex-1">{insightToShow.summary}</p>
                <button
                  onClick={() => setInsightCollapsed(true)}
                  className="text-[var(--text-hint)] hover:text-[var(--text-primary)] shrink-0"
                  aria-label="折叠"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
              {insightToShow.suggestions.length > 0 && (
                <div>
                  <p className="body-sm font-medium text-[var(--text-secondary)] mb-1.5">建议</p>
                  <ul className="space-y-1.5">
                    {insightToShow.suggestions.map((s, i) => (
                      <li key={i} className="body-sm text-[var(--text-hint)] flex items-start gap-2">
                        <span
                          className="shrink-0 mt-0.5 w-1 h-1 rounded-full"
                          style={{ backgroundColor: 'var(--sleep)' }}
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {insightToShow.alerts.length > 0 && (
                <div>
                  <p className="body-sm font-medium text-[var(--danger)] mb-1.5">提醒</p>
                  <ul className="space-y-1.5">
                    {insightToShow.alerts.map((a, i) => (
                      <li key={i} className="body-sm text-[var(--danger)]/80 flex items-start gap-2">
                        <span
                          className="shrink-0 mt-0.5 w-1 h-1 rounded-full"
                          style={{ backgroundColor: 'var(--danger)' }}
                        />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Today Timeline */}
      {currentBaby && (
        <div>
          <div className="section-header">
            <span className="section-header__title">今日时间线</span>
            <Link to="/record" className="section-header__action">
              <Clock className="h-3 w-3" />
              查看全部
            </Link>
          </div>
          <div className="card">
            <Timeline records={todayRecords.slice(0, 5)} />
            {todayRecords.length > 5 && (
              <Link to="/record" className="section-header__action mt-3 justify-center w-full">
                查看全部 {todayRecords.length} 条今日记录 ›
              </Link>
            )}
          </div>
        </div>
      )}

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
    </div>
  )
}
