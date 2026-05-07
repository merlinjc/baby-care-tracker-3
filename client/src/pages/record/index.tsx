import { useEffect, useState, useRef, useMemo } from 'react'
import { Baby, Moon, Droplets, Thermometer, Ruler, Trash2, Pencil, Calendar, Lock, ClipboardList, UserCircle2 } from 'lucide-react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useBabyStore } from '@/stores/baby-store'
import { usePermission } from '@/hooks/use-permission'
import { useDialog } from '@/hooks/use-dialog'
import { useWeeklyTrend } from '@/hooks/use-weekly-trend'
import { recordService } from '@/services/record'
import { getRecordSummary, getRecordDetails } from '@/lib/record'
import { parseNote } from '@/lib/note-tags'
import { buildTodaySummaryText } from '@/lib/today-summary'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { AddRecordMenu } from '@/components/add-record-menu'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import { FeedingDialog } from '@/components/feeding-dialog'
import { SleepDialog } from '@/components/sleep-dialog'
import { DiaperDialog } from '@/components/diaper-dialog'
import { TemperatureDialog } from '@/components/temperature-dialog'
import { GrowthDialog } from '@/components/growth-dialog'
import { InsightSection } from '@/components/insight-section'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { CareRecord, RecordType, PaginatedResponse } from '@baby-care-tracker/shared'

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
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState<RecordType | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const observerRef = useRef<HTMLDivElement>(null)

  // Date filter
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  const feedingDialog = useDialog<CareRecord>()
  const sleepDialog = useDialog<CareRecord>()
  const diaperDialog = useDialog<CareRecord>()
  const temperatureDialog = useDialog<CareRecord>()
  const growthDialog = useDialog<CareRecord>()

  const PAGE_SIZE = 20

  // FR-B：本周趋势（从首页迁入）
  const { data: weeklyTrend, isLoading: trendLoading } = useWeeklyTrend(currentBaby?.id)

  // Records: useInfiniteQuery（基于后端 hasMore，避免"正好一满页触发空请求"的临界问题）
  const recordsQueryKey = useMemo(
    () => ['records', currentBaby?.id, 'list', activeType, startDate || null, endDate || null] as const,
    [currentBaby?.id, activeType, startDate, endDate],
  )

  const {
    data: recordsData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchRecords,
  } = useInfiniteQuery<PaginatedResponse<CareRecord>, Error, InfiniteData<PaginatedResponse<CareRecord>>, typeof recordsQueryKey, number>({
    queryKey: recordsQueryKey,
    enabled: !!currentBaby,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!currentBaby) {
        return { items: [], total: 0, page: pageParam, pageSize: PAGE_SIZE, hasMore: false }
      }
      return recordService.getRecords({
        babyId: currentBaby.id,
        recordType: activeType === 'all' ? undefined : activeType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      })
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 30 * 1000,
  })

  const records: CareRecord[] = useMemo(
    () => recordsData?.pages.flatMap((p) => p.items ?? []) ?? [],
    [recordsData],
  )

  // IntersectionObserver 触发分页
  useEffect(() => {
    const target = observerRef.current
    if (!target || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage && !isLoading && hasNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage])

  const createRecord = async (
    recordType: RecordType,
    data: { [key: string]: unknown },
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
      } else {
        await recordService.createRecord({
          ...data,
          babyId: currentBaby.id,
          recordType,
          startTime: meta.recordTime,
          ...(meta.endTime !== undefined ? { endTime: meta.endTime } : {}),
        } as Parameters<typeof recordService.createRecord>[0])
      }
      // 创建/更新后重新拉取（保持分页首页对齐）
      refetchRecords()
    } catch (err) {
      console.error('Failed to create/update record:', err)
    }
  }

  const deleteRecord = async (id: string) => {
    const ok = await confirm({
      title: '删除这条记录？',
      description: '删除后不可恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    try {
      await recordService.deleteRecord(id)
      // 乐观更新：在所有分页数据里过滤掉该条
      queryClient.setQueryData<InfiniteData<PaginatedResponse<CareRecord>>>(
        recordsQueryKey,
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.filter((r) => r.id !== id),
              total: Math.max(0, p.total - 1),
            })),
          }
        },
      )
    } catch (err) {
      console.error('Failed to delete record:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const openDialogForType = (type: RecordType, record?: CareRecord) => {
    const dialogMap: { [K in RecordType]: { openDialog: (p?: CareRecord) => void } } = {
      feeding: feedingDialog,
      sleep: sleepDialog,
      diaper: diaperDialog,
      temperature: temperatureDialog,
      growth: growthDialog,
    }
    dialogMap[type].openDialog(record)
  }

  const handleEdit = (record: CareRecord) => {
    openDialogForType(record.recordType, record)
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

  // FR-D1.AC2：今日速览副标题（仅当筛选范围包含今日时显示动态文案）
  const pageSubtitle = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStartTs = today.getTime()
    const tomorrowStartTs = todayStartTs + 24 * 60 * 60 * 1000
    const startTs = startDate ? new Date(startDate).getTime() : 0
    const endTs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER
    const rangeIncludesToday = startTs <= tomorrowStartTs - 1 && endTs >= todayStartTs

    const todayRecords = records.filter((r) => {
      const ts = new Date(r.startTime).getTime()
      return ts >= todayStartTs && ts < tomorrowStartTs
    })
    const latestTemp = todayRecords
      .filter((r) => r.recordType === 'temperature' && r.temperatureData)
      .map((r) => r.temperatureData!.temperature)[0]

    return buildTodaySummaryText({
      rangeIncludesToday,
      todayRecords,
      latestTemperature: latestTemp ?? null,
    })
  }, [records, startDate, endDate])

  if (!currentBaby) {
    return (
      <div className="empty-state min-h-[50vh]">
        <Baby className="h-12 w-12 empty-state__icon" />
        <p className="empty-state__title">请先选择一个宝宝</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* FR-D1：page-header + 今日速览副标题 */}
      <PageHeader
        title="记录"
        variant="tab"
        icon={<ClipboardList className="h-6 w-6" />}
        accentColor="var(--primary)"
        subtitle={pageSubtitle}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Calendar className="h-3.5 w-3.5" />}
              active={showDateFilter}
              onClick={() => setShowDateFilter(!showDateFilter)}
            >
              筛选
            </Button>
            {canEdit && (
              <AddRecordMenu onPick={(type) => openDialogForType(type)} />
            )}
          </div>
        }
      />

      {/* FR-B：本周趋势（从首页迁入） */}
      <div>
        <div className="section-header">
          <span className="section-header__title">本周趋势</span>
        </div>
        <InsightSection trend={weeklyTrend ?? null} isLoading={trendLoading} />
      </div>

      {/* Date Filter */}
      {showDateFilter && (
        <Card padding="sm" className="space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="body-md font-medium text-[var(--text-secondary)]">日期范围</span>
            {(startDate || endDate) && (
              <button onClick={clearDateFilter} className="body-sm text-[var(--primary)] hover:underline font-medium">
                清除筛选
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="开始日期"
              wrapperClassName="flex-1"
            />
            <span className="body-sm text-[var(--text-hint)]">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="结束日期"
              wrapperClassName="flex-1"
            />
          </div>
        </Card>
      )}

      {/* Type Tabs - 使用 Button ghost+active 实现"类型色切换" */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant="ghost"
          size="sm"
          active={activeType === 'all'}
          onClick={() => setActiveType('all')}
          accentColor="var(--primary)"
          className="rounded-full"
        >
          全部
        </Button>
        {(Object.keys(recordTypeConfig) as RecordType[]).map((type) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            active={activeType === type}
            onClick={() => setActiveType(type)}
            accentColor={recordTypeConfig[type].color}
            className="rounded-full"
          >
            {recordTypeConfig[type].label}
          </Button>
        ))}
      </div>

      {/* Records List */}
      {isLoading ? (
        <ListSkeleton count={5} />
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
                <span className="caption font-semibold">
                  {group.label}
                </span>
                <Badge size="xs" variant="default">
                  {group.items.length}
                </Badge>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-light)' }} />
              </div>
              {group.items.map((record) => {
                const config = recordTypeConfig[record.recordType]
                const Icon = config.icon
                const details = getRecordDetails(record)
                const creatorLabel = record.creator?.nickname?.trim() || null
                return (
                  <Card
                    key={record.id}
                    padding="sm"
                    className="flex items-start gap-3"
                    style={{ borderLeft: `3px solid ${config.color}` }}
                  >
                    <div
                      className="icon-circle icon-circle--sm shrink-0 mt-0.5"
                      style={{ backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="body-md font-medium text-[var(--text-primary)]">
                          {config.label}
                        </span>
                        <span className="caption number-display shrink-0">
                          {new Date(record.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* 一行总览 */}
                      <p className="body-sm text-[var(--text-secondary)] mt-0.5 truncate">
                        {getRecordSummary(record)}
                      </p>

                      {/* 详细字段（key:value 标签组） */}
                      {details.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {details.map((d) => (
                            <span
                              key={d.key}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <span className="opacity-60">{d.key}</span>
                              <span className="number-display font-medium text-[var(--text-primary)]">
                                {d.value}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 备注：标签 + 自由文本分别渲染 */}
                      {record.note && (() => {
                        const parsed = parseNote(record.note)
                        if (parsed.tags.length === 0 && !parsed.freeText) return null
                        return (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {parsed.tags.map((tag) => (
                              <Badge key={tag} size="xs" accentColor={config.color}>
                                #{tag}
                              </Badge>
                            ))}
                            {parsed.freeText && (
                              <span
                                className="caption line-clamp-2"
                                title={parsed.freeText}
                                style={{ color: 'var(--text-hint)' }}
                              >
                                📝 {parsed.freeText}
                              </span>
                            )}
                          </div>
                        )
                      })()}

                      {/* 记录者昵称 */}
                      {creatorLabel && (
                        <div className="mt-1 flex items-center gap-1 caption" style={{ color: 'var(--text-hint)' }}>
                          <UserCircle2 className="h-3 w-3" />
                          <span className="truncate">由 {creatorLabel} 记录</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canEdit && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => handleEdit(record)}
                          aria-label="编辑"
                        />
                      )}
                      {canEdit && (
                        <IconButton
                          variant="danger-ghost"
                          size="sm"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => deleteRecord(record.id)}
                          disabled={deletingId === record.id}
                          aria-label="删除"
                        />
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          ))}
          {/* Infinite scroll trigger */}
          {hasNextPage ? (
            <div ref={observerRef} className="flex items-center justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-[var(--text-hint)]">
                  <div className="spinner spinner--sm" />
                  <span className="body-sm">加载更多...</span>
                </div>
              ) : (
                <span className="caption">下拉加载更多</span>
              )}
            </div>
          ) : records.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <span className="caption">— 没有更多了 —</span>
            </div>
          )}
        </div>
      )}

      {/* Viewer notice */}
      {isViewer && (
        <Alert variant="info" size="compact" icon={<Lock className="h-3.5 w-3.5" />}>
          您是查看者，无法添加或修改记录
        </Alert>
      )}

      {/* Dialogs */}
      <FeedingDialog
        open={feedingDialog.open}
        onClose={feedingDialog.closeDialog}
        editRecord={feedingDialog.payload}
        onSubmit={(data, meta) => createRecord('feeding', { feedingData: data }, meta)}
      />
      <SleepDialog
        open={sleepDialog.open}
        onClose={sleepDialog.closeDialog}
        editRecord={sleepDialog.payload}
        onSubmit={(data, meta) => createRecord('sleep', { sleepData: data }, meta)}
      />
      <DiaperDialog
        open={diaperDialog.open}
        onClose={diaperDialog.closeDialog}
        editRecord={diaperDialog.payload}
        onSubmit={(data, meta) => createRecord('diaper', { diaperData: data }, meta)}
      />
      <TemperatureDialog
        open={temperatureDialog.open}
        onClose={temperatureDialog.closeDialog}
        editRecord={temperatureDialog.payload}
        onSubmit={(data, meta) => createRecord('temperature', { temperatureData: data }, meta)}
      />
      <GrowthDialog
        open={growthDialog.open}
        onClose={growthDialog.closeDialog}
        editRecord={growthDialog.payload}
        onSubmit={(data, meta) => createRecord('growth', { growthData: data }, meta)}
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
