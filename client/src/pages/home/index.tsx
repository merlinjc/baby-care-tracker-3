import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Baby, Moon, Droplets, Thermometer, Plus, Sparkles, Clock, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { useDialog } from '@/hooks/use-dialog'
import { recordService } from '@/services/record'
import { aiService } from '@/services/ai'
import { FeedingDialog } from '@/components/feeding-dialog'
import { SleepDialog } from '@/components/sleep-dialog'
import { DiaperDialog } from '@/components/diaper-dialog'
import { TemperatureDialog } from '@/components/temperature-dialog'
import { GrowthDialog } from '@/components/growth-dialog'
import { Timeline } from '@/components/timeline'
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
  const [stats, setStats] = useState<TodayStats>(defaultStats)
  const [todayRecords, setTodayRecords] = useState<CareRecord[]>([])
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const openRecordDialog = (type: DialogType) => {
    dialogMap[type].openDialog()
  }

  const refreshStats = useCallback(() => {
    if (currentBaby) {
      recordService.getTodayStats(currentBaby.id).then(setStats).catch(() => {})
    }
  }, [currentBaby])

  const fetchTodayRecords = useCallback(async () => {
    if (!currentBaby) return
    try {
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
      setTodayRecords(result.items || [])
    } catch {
      setTodayRecords([])
    }
  }, [currentBaby])

  const fetchDailyInsight = useCallback(async () => {
    if (!currentBaby) return
    setInsightLoading(true)
    try {
      const result = await aiService.getDailyInsight(currentBaby.id)
      setDailyInsight(result.insight)
    } catch {
      setDailyInsight(null)
    } finally {
      setInsightLoading(false)
    }
  }, [currentBaby])

  useEffect(() => {
    if (user?.familyId) {
      loadFamily()
      loadBabies(user.familyId)
    }
  }, [user?.familyId, loadFamily, loadBabies])

  useEffect(() => {
    refreshStats()
    fetchTodayRecords()
  }, [refreshStats, fetchTodayRecords])

  useEffect(() => {
    fetchDailyInsight()
  }, [fetchDailyInsight])

  const createRecord = async (recordType: RecordType, data: Record<string, unknown>) => {
    if (!currentBaby) return
    setIsSubmitting(true)
    try {
      await recordService.createRecord({
        babyId: currentBaby.id,
        recordType,
        startTime: new Date().toISOString(),
        ...data,
      })
      refreshStats()
      fetchTodayRecords()
    } catch (err) {
      console.error('Failed to create record:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const quickActions: { type: DialogType; icon: typeof Baby; label: string; color: string; bgColor: string }[] = [
    { type: 'feeding', icon: Baby, label: '喂养', color: 'var(--feeding)', bgColor: 'var(--feeding)' },
    { type: 'sleep', icon: Moon, label: '睡眠', color: 'var(--sleep)', bgColor: 'var(--sleep)' },
    { type: 'diaper', icon: Droplets, label: '换尿布', color: 'var(--diaper)', bgColor: 'var(--diaper)' },
    { type: 'temperature', icon: Thermometer, label: '体温', color: 'var(--temperature)', bgColor: 'var(--temperature)' },
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 12) return '早上好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="heading-xl text-[var(--text-primary)]">
          {getGreeting()}，{user?.nickname || '用户'}
        </h1>
        <p className="body-md text-[var(--text-hint)] mt-1">
          {currentBaby ? `${currentBaby.name} · 今日记录` : '尚未添加宝宝'}
        </p>
      </div>

      {/* No family prompt */}
      {!family && (
        <div className="card text-center py-10">
          <div className="icon-circle icon-circle--lg mx-auto mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
            <Plus className="h-6 w-6" style={{ color: 'var(--primary)' }} />
          </div>
          <p className="body-md text-[var(--text-secondary)] mb-4">您还未加入家庭</p>
          <Link
            to="/family"
            className="btn-primary"
          >
            创建或加入家庭
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      {currentBaby && (
        <div className="grid grid-cols-2 gap-3 stagger-children">
          {[
            { label: '喂养', count: stats.feeding.count, detail: stats.feeding.totalAmount > 0 ? `${stats.feeding.totalAmount}ml` : '暂无记录', color: 'var(--feeding)', icon: Baby },
            { label: '睡眠', count: stats.sleep.count, detail: stats.sleep.totalDuration > 0 ? `${Math.round(stats.sleep.totalDuration / 60)}分钟` : '暂无记录', color: 'var(--sleep)', icon: Moon },
            { label: '换尿布', count: stats.diaper.count, detail: `尿 ${stats.diaper.peeCount} / 便 ${stats.diaper.poopCount}`, color: 'var(--diaper)', icon: Droplets },
            { label: '体温', count: null, detail: stats.temperature.latestValue ? '°C' : '暂无记录', color: 'var(--temperature)', icon: Thermometer, value: stats.temperature.latestValue },
          ].map((item) => (
            <div
              key={item.label}
              className="card-base relative overflow-hidden"
              style={{ borderTop: `3px solid ${item.color}` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption">{item.label}</p>
                  <p className="heading-xl mt-1 number-display" style={{ color: item.color }}>
                    {item.value ?? item.count ?? '--'}
                  </p>
                  <p className="caption mt-1">{item.detail}</p>
                </div>
                <div
                  className="icon-circle icon-circle--sm"
                  style={{ backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)` }}
                >
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {currentBaby && (
        <div>
          <div className="section-header">
            <span className="section-header__title">快捷记录</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => openRecordDialog(action.type)}
                disabled={isSubmitting}
                className="card-interactive flex flex-col items-center gap-2.5 py-4"
              >
                <div
                  className="icon-circle icon-circle--md"
                  style={{ backgroundColor: `color-mix(in srgb, ${action.bgColor} 12%, transparent)` }}
                >
                  <action.icon className="h-5 w-5" style={{ color: action.color }} />
                </div>
                <span className="body-sm text-[var(--text-secondary)] font-medium">{action.label}</span>
              </button>
            ))}
          </div>
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
            <Timeline records={todayRecords} />
          </div>
        </div>
      )}

      {/* AI Daily Insight */}
      {currentBaby && (
        <div>
          <div className="section-header">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--sleep)' }} />
              <span className="section-header__title">AI 每日洞察</span>
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
          <div className="card-base" style={{ borderTop: '3px solid var(--sleep)' }}>
            {insightLoading ? (
              <div className="flex items-center gap-2 text-[var(--text-hint)] body-md">
                <div className="spinner spinner--sm" style={{ borderTopColor: 'var(--sleep)' }} />
                生成洞察中...
              </div>
            ) : dailyInsight ? (
              <div className="space-y-3">
                <p className="body-md text-[var(--text-primary)]">{dailyInsight.summary}</p>
                {dailyInsight.suggestions.length > 0 && (
                  <div>
                    <p className="body-sm font-medium text-[var(--text-secondary)] mb-1.5">建议</p>
                    <ul className="space-y-1.5">
                      {dailyInsight.suggestions.map((s, i) => (
                        <li key={i} className="body-sm text-[var(--text-hint)] flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--sleep)' }} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {dailyInsight.alerts.length > 0 && (
                  <div>
                    <p className="body-sm font-medium text-[var(--danger)] mb-1.5">提醒</p>
                    <ul className="space-y-1.5">
                      {dailyInsight.alerts.map((a, i) => (
                        <li key={i} className="body-sm text-[var(--danger)]/80 flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 w-1 h-1 rounded-full bg-[var(--danger)]" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="body-md text-[var(--text-hint)]">暂无洞察数据，记录更多数据后可生成</p>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <FeedingDialog
        open={feedingDialog.open}
        onClose={feedingDialog.closeDialog}
        onSubmit={(data) => createRecord('feeding', { feedingData: data })}
      />
      <SleepDialog
        open={sleepDialog.open}
        onClose={sleepDialog.closeDialog}
        onSubmit={(data) => createRecord('sleep', { sleepData: data })}
      />
      <DiaperDialog
        open={diaperDialog.open}
        onClose={diaperDialog.closeDialog}
        onSubmit={(data) => createRecord('diaper', { diaperData: data })}
      />
      <TemperatureDialog
        open={temperatureDialog.open}
        onClose={temperatureDialog.closeDialog}
        onSubmit={(data) => createRecord('temperature', { temperatureData: data })}
      />
      <GrowthDialog
        open={growthDialog.open}
        onClose={growthDialog.closeDialog}
        onSubmit={(data) => createRecord('growth', { growthData: data })}
      />
    </div>
  )
}
