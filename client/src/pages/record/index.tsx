import { useEffect, useState, useCallback, useRef } from 'react'
import { Baby, Moon, Droplets, Thermometer, Ruler, Plus, Trash2, Pencil, Calendar, Lock } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { usePermission } from '@/hooks/use-permission'
import { useDialog } from '@/hooks/use-dialog'
import { recordService } from '@/services/record'
import { getRecordSummary } from '@/lib/record'
import { FeedingDialog } from '@/components/feeding-dialog'
import { SleepDialog } from '@/components/sleep-dialog'
import { DiaperDialog } from '@/components/diaper-dialog'
import { TemperatureDialog } from '@/components/temperature-dialog'
import { GrowthDialog } from '@/components/growth-dialog'
import type { CareRecord, RecordType } from '@baby-care-tracker/shared'

const recordTypeConfig: { [K in RecordType]: { icon: typeof Baby; label: string; color: string } } = {
  feeding: { icon: Baby, label: '喂养', color: 'var(--feeding)' },
  sleep: { icon: Moon, label: '睡眠', color: 'var(--sleep)' },
  diaper: { icon: Droplets, label: '换尿布', color: 'var(--diaper)' },
  temperature: { icon: Thermometer, label: '体温', color: 'var(--temperature)' },
  growth: { icon: Ruler, label: '生长', color: 'var(--growth)' },
}

export function RecordPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const { canEdit, isViewer } = usePermission()
  const [records, setRecords] = useState<CareRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeType, setActiveType] = useState<RecordType | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  // Date filter
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  const feedingDialog = useDialog()
  const sleepDialog = useDialog()
  const diaperDialog = useDialog()
  const temperatureDialog = useDialog()
  const growthDialog = useDialog()

  const PAGE_SIZE = 20

  const loadRecords = useCallback(async (pageNum: number, append = false) => {
    if (!currentBaby) return
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    try {
      const result = await recordService.getRecords({
        babyId: currentBaby.id,
        recordType: activeType === 'all' ? undefined : activeType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
      })
      const items = result.items || []
      if (append) {
        setRecords((prev) => [...prev, ...items])
      } else {
        setRecords(items)
      }
      setHasMore(items.length >= PAGE_SIZE)
      setPage(pageNum)
    } catch {
      if (!append) setRecords([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [currentBaby, activeType, startDate, endDate])

  useEffect(() => {
    loadRecords(1, false)
  }, [loadRecords])

  useEffect(() => {
    if (!observerRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isLoading && hasMore) {
          loadRecords(page + 1, true)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, isLoading, page, loadRecords])

  const createRecord = async (recordType: RecordType, data: { [key: string]: unknown }) => {
    if (!currentBaby) return
    try {
      await recordService.createRecord({
        ...data,
        babyId: currentBaby.id,
        recordType,
        startTime: new Date().toISOString(),
      } as Parameters<typeof recordService.createRecord>[0])
      loadRecords(1, false)
    } catch (err) {
      console.error('Failed to create record:', err)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('确定删除这条记录吗？')) return
    setDeletingId(id)
    try {
      await recordService.deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Failed to delete record:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const openDialogForType = (type: RecordType) => {
    const dialogMap: { [K in RecordType]: { openDialog: () => void } } = {
      feeding: feedingDialog,
      sleep: sleepDialog,
      diaper: diaperDialog,
      temperature: temperatureDialog,
      growth: growthDialog,
    }
    dialogMap[type].openDialog()
  }

  const handleEdit = (record: CareRecord) => {
    openDialogForType(record.recordType)
  }

  const clearDateFilter = () => {
    setStartDate('')
    setEndDate('')
  }

  // Group records by date label (今天/昨天/更早或 yyyy-mm-dd)
  const groupedRecords = (() => {
    const groups: { label: string; items: CareRecord[] }[] = []
    const todayKey = new Date().toDateString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = yesterday.toDateString()

    let currentLabel = ''
    for (const record of records) {
      const d = new Date(record.startTime)
      const key = d.toDateString()
      let label: string
      if (key === todayKey) label = '今天'
      else if (key === yesterdayKey) label = '昨天'
      else label = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

      if (label !== currentLabel) {
        groups.push({ label, items: [] })
        currentLabel = label
      }
      groups[groups.length - 1].items.push(record)
    }
    return groups
  })()

  if (!currentBaby) {
    return (
      <div className="empty-state min-h-[50vh]">
        <Baby className="h-12 w-12 empty-state__icon" />
        <p className="empty-state__title">请先选择一个宝宝</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="heading-lg text-[var(--text-primary)]">记录</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`chip ${showDateFilter ? 'chip--active' : 'chip--inactive'}`}
            style={showDateFilter ? { backgroundColor: 'var(--primary)' } : undefined}
          >
            <Calendar className="h-3.5 w-3.5" />
            筛选
          </button>
          {canEdit && (
            <button
              onClick={() => openDialogForType(activeType === 'all' ? 'feeding' : activeType)}
              className="btn-primary text-[var(--text-xs)] px-3 py-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </button>
          )}
        </div>
      </div>

      {/* Date Filter */}
      {showDateFilter && (
        <div className="card-base space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="body-md font-medium text-[var(--text-secondary)]">日期范围</span>
            {(startDate || endDate) && (
              <button onClick={clearDateFilter} className="body-sm text-[var(--primary)] hover:underline font-medium">
                清除筛选
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-base flex-1"
              placeholder="开始日期"
            />
            <span className="body-sm text-[var(--text-hint)]">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-base flex-1"
              placeholder="结束日期"
            />
          </div>
        </div>
      )}

      {/* Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveType('all')}
          className={`chip ${activeType === 'all' ? 'chip--active' : 'chip--inactive'}`}
          style={activeType === 'all' ? { backgroundColor: 'var(--primary)' } : undefined}
        >
          全部
        </button>
        {(Object.keys(recordTypeConfig) as RecordType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`chip ${activeType === type ? 'chip--active' : 'chip--inactive'}`}
            style={activeType === type ? { backgroundColor: recordTypeConfig[type].color } : undefined}
          >
            {recordTypeConfig[type].label}
          </button>
        ))}
      </div>

      {/* Records List */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-hint)]">
          <div className="spinner" />
          <span className="body-md">加载中...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <ClipboardIcon className="h-12 w-12 empty-state__icon" />
          <p className="empty-state__title">暂无记录</p>
          <p className="empty-state__desc">点击添加按钮创建第一条记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedRecords.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="caption font-semibold" style={{ letterSpacing: 'var(--tracking-wide)' }}>
                  {group.label}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-hint)' }}
                >
                  {group.items.length}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-light)' }} />
              </div>
              {group.items.map((record) => {
                const config = recordTypeConfig[record.recordType]
                const Icon = config.icon
                return (
                  <div
                    key={record.id}
                    className="card-base flex items-center gap-3"
                    style={{ borderLeft: `3px solid ${config.color}` }}
                  >
                    <div
                      className="icon-circle icon-circle--sm"
                      style={{ backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="body-md font-medium text-[var(--text-primary)]">
                          {config.label}
                        </span>
                        <span className="caption number-display">
                          {new Date(record.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="body-sm text-[var(--text-secondary)] mt-0.5 truncate">
                        {getRecordSummary(record)}
                      </p>
                      {record.note && (
                        <p className="caption mt-0.5 truncate">{record.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--primary)] hover:bg-[color-mix(in_srgb,_var(--primary)_12%,_transparent)] transition-colors"
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => deleteRecord(record.id)}
                          disabled={deletingId === record.id}
                          className="p-1.5 rounded-lg text-[var(--text-hint)] hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,_var(--danger)_12%,_transparent)] transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={observerRef} className="flex items-center justify-center py-4">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-[var(--text-hint)]">
                  <div className="spinner spinner--sm" />
                  <span className="body-sm">加载更多...</span>
                </div>
              ) : (
                <span className="caption">下拉加载更多</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Viewer notice */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl caption bg-[var(--bg-elevated)]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          您是查看者，无法添加或修改记录
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

/** Simple clipboard icon component for empty state */
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  )
}
