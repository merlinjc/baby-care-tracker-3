/**
 * RecordPage v7 - iOS Health × 美拉德暖色
 *
 * 重构：
 * - PageHeader → LargeTitleHeader（rightAction 放筛选 + 添加）
 * - 类型 Tabs → SegmentedControl
 * - 记录卡：每条用 ListRow 风（左色条 accentColor + 圆 icon + 标题 badge + 时间 + 详情/备注）
 * - 按日期分组用 SectionHeader variant="grouped"
 * - 业务逻辑（useInfiniteQuery / IntersectionObserver / 增删改）完全保留
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardList, Droplets, Lock, Moon, Pencil, Ruler, Thermometer, Trash2, User, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useBabyStore } from '@/stores/baby-store'
import { usePermission } from '@/hooks/use-permission'
import { useDialog } from '@/hooks/use-dialog'
import { useWeeklyTrend } from '@/hooks/use-weekly-trend'
import { recordService } from '@/services/record'
import { getRecordSummary, getRecordDetails } from '@/lib/record'
import { parseNote } from '@/lib/note-tags'
import { buildTodaySummaryText } from '@/lib/today-summary'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
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
import { staggerContainer, staggerItem } from '@/lib/motion'

const recordTypeConfig: {
  [K in RecordType]: { icon: React.FC<{ className?: string }>; label: string; color: string; bg: string; fg: string }
} = {
  feeding: {
    icon: User,
    label: '喂养',
    color: 'var(--feeding)',
    bg: 'var(--feeding-bg)',
    fg: 'var(--feeding-fg)',
  },
  sleep: {
    icon: Moon,
    label: '睡眠',
    color: 'var(--sleep)',
    bg: 'var(--sleep-bg)',
    fg: 'var(--sleep-fg)',
  },
  diaper: {
    icon: Droplets,
    label: '换尿布',
    color: 'var(--diaper)',
    bg: 'var(--diaper-bg)',
    fg: 'var(--diaper-fg)',
  },
  temperature: {
    icon: Thermometer,
    label: '体温',
    color: 'var(--temperature)',
    bg: 'var(--temperature-bg)',
    fg: 'var(--temperature-fg)',
  },
  growth: {
    icon: Ruler,
    label: '生长',
    color: 'var(--growth)',
    bg: 'var(--growth-bg)',
    fg: 'var(--growth-fg)',
  },
}

export function RecordPage() {
  const { t } = useTranslation('record')
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const { canEdit, isViewer } = usePermission()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState<RecordType | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const observerRef = useRef<HTMLDivElement>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  const feedingDialog = useDialog<CareRecord>()
  const sleepDialog = useDialog<CareRecord>()
  const diaperDialog = useDialog<CareRecord>()
  const temperatureDialog = useDialog<CareRecord>()
  const growthDialog = useDialog<CareRecord>()

  const PAGE_SIZE = 20

  const { data: weeklyTrend, isLoading: trendLoading } = useWeeklyTrend(currentBaby?.id)

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
  } = useInfiniteQuery<
    PaginatedResponse<CareRecord>,
    Error,
    InfiniteData<PaginatedResponse<CareRecord>>,
    typeof recordsQueryKey,
    number
  >({
    queryKey: recordsQueryKey,
    enabled: !!currentBaby,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!currentBaby) {
        return { items: [], total: 0, page: pageParam, pageSize: PAGE_SIZE, hasMore: false }
      }
      // 后端 getRecordsQuerySchema 使用 z.string().datetime()，只接受完整 ISO 8601；
      // <input type="date"> 得到的是 YYYY-MM-DD，需转换后再发。
      // start → 当日 00:00:00 本地时区；end → 当日 23:59:59.999 本地时区（包含当天）。
      const startIso = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined
      const endIso = endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined
      return recordService.getRecords({
        babyId: currentBaby.id,
        recordType: activeType === 'all' ? undefined : activeType,
        startDate: startIso,
        endDate: endIso,
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

  const handleEdit = (record: CareRecord) => openDialogForType(record.recordType, record)

  const clearDateFilter = () => {
    setStartDate('')
    setEndDate('')
  }

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
      if (key === todayKey) label = t('group.today')
      else if (key === yesterdayKey) label = t('group.yesterday')
      else label = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

      if (label !== currentLabel) {
        groups.push({ label, items: [] })
        currentLabel = label
      }
      groups[groups.length - 1].items.push(record)
    }
    return groups
  })()

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

  const typeOptions = [
    { value: 'all', label: '全部' },
    ...(Object.keys(recordTypeConfig) as RecordType[]).map((t) => ({
      value: t,
      label: recordTypeConfig[t].label,
    })),
  ]

  if (!currentBaby) {
    return (
      <div className="empty-state min-h-[50vh]">
        <User className="h-12 w-12 empty-state__icon" />
        <p className="empty-state__title">请先选择一个宝宝</p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title="记录"
          subtitle={pageSubtitle}
          rightAction={
            <div className="flex items-center gap-2">
              <Button
                variant="plain"
                size="sm"
                leftIcon={<Calendar className="h-3.5 w-3.5" />}
                active={showDateFilter}
                onClick={() => setShowDateFilter(!showDateFilter)}
              >
                筛选
              </Button>
              {canEdit && <AddRecordMenu onPick={(type) => openDialogForType(type)} />}
            </div>
          }
        />
      </motion.div>

      {/* 本周趋势 */}
      <motion.div variants={staggerItem} className="space-y-3">
        <SectionHeader title="本周趋势" variant="prominent" />
        <InsightSection trend={weeklyTrend ?? null} isLoading={trendLoading} />
      </motion.div>

      {/* 日期筛选 */}
      {showDateFilter && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
        >
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="footnote font-medium" style={{ color: 'var(--label-secondary)' }}>
                日期范围
              </span>
              {(startDate || endDate) && (
                <button
                  onClick={clearDateFilter}
                  className="footnote font-semibold hover:underline"
                  style={{ color: 'var(--brand-ink)' }}
                >
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
              <span
                className="footnote shrink-0"
                style={{ color: 'var(--label-tertiary)' }}
                aria-hidden
              >
                —
              </span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="结束日期"
                wrapperClassName="flex-1"
              />
            </div>
          </Card>
        </motion.div>
      )}

      {/* 类型筛选 - SegmentedControl */}
      <motion.div variants={staggerItem}>
        <SegmentedControl
          options={typeOptions}
          value={activeType}
          onChange={(v) => setActiveType(v as RecordType | 'all')}
          size="md"
        />
      </motion.div>

      {/* 记录列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : records.length === 0 ? (
        <Card variant="cta" padding="lg" className="text-center">
          <ClipboardList className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--label-tertiary)' }} />
          <p className="headline" style={{ color: 'var(--label)' }}>
            暂无记录
          </p>
          <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
            点击右上角「添加」创建第一条记录
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedRecords.map((group) => (
            <motion.div
              key={group.label}
              variants={staggerItem}
              className="space-y-2.5"
            >
              <SectionHeader
                title={group.label}
                variant="grouped"
                action={
                  <span
                    className="caption-1 number-display"
                    style={{ color: 'var(--label-tertiary)' }}
                  >
                    {group.items.length} 条
                  </span>
                }
              />
              <Card variant="elevated" padding="none">
                <div className="ios-list">
                  {group.items.map((record) => {
                    const config = recordTypeConfig[record.recordType]
                    const Icon = config.icon
                    const details = getRecordDetails(record)
                    const creatorLabel = record.creator?.nickname?.trim() || null
                    const parsed = record.note ? parseNote(record.note) : null

                    return (
                      <div
                        key={record.id}
                        data-record-row
                        className="relative flex items-start gap-3 px-5 py-3.5 min-w-0"
                      >
                        {/* 左色条 */}
                        <span
                          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                          style={{ backgroundColor: config.color }}
                          aria-hidden
                        />
                        {/* 圆 icon */}
                        <div
                          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: config.bg, color: config.fg }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* 主内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="callout font-semibold truncate" style={{ color: 'var(--label)' }}>
                              {config.label}
                            </span>
                            <span
                              className="caption-1 number-display shrink-0"
                              style={{ color: 'var(--label-tertiary)' }}
                            >
                              {new Date(record.startTime).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="footnote mt-0.5 truncate" style={{ color: 'var(--label-secondary)' }}>
                            {getRecordSummary(record)}
                          </p>

                          {details.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {details.map((d) => (
                                <span
                                  key={d.key}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                                  style={{
                                    backgroundColor: 'var(--surface-2)',
                                    color: 'var(--label-secondary)',
                                  }}
                                >
                                  <span style={{ opacity: 0.6 }}>{d.key}</span>
                                  <span
                                    className="number-display font-semibold"
                                    style={{ color: 'var(--label)' }}
                                  >
                                    {d.value}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}

                          {parsed && (parsed.tags.length > 0 || parsed.freeText) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {parsed.tags.map((tag) => (
                                <Badge key={tag} size="xs" accentColor={config.color}>
                                  #{tag}
                                </Badge>
                              ))}
                              {parsed.freeText && (
                                <span
                                  className="caption-1 line-clamp-2"
                                  title={parsed.freeText}
                                  style={{ color: 'var(--label-tertiary)' }}
                                >
                                  {parsed.freeText}
                                </span>
                              )}
                            </div>
                          )}

                          {creatorLabel && (
                            <div
                              className="mt-1 flex items-center gap-1 caption-1"
                              style={{ color: 'var(--label-tertiary)' }}
                            >
                              <UserCircle className="h-3 w-3" />
                              <span className="truncate">由 {creatorLabel} 记录</span>
                            </div>
                          )}
                        </div>

                        {/* 操作 */}
                        {canEdit && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <IconButton
                              variant="ghost"
                              size="sm"
                              icon={<Pencil className="h-3.5 w-3.5" />}
                              onClick={() => handleEdit(record)}
                              aria-label="编辑"
                            />
                            <IconButton
                              variant="danger-ghost"
                              size="sm"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => deleteRecord(record.id)}
                              disabled={deletingId === record.id}
                              aria-label="删除"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          ))}

          {/* 分页触发 */}
          {hasNextPage ? (
            <div ref={observerRef} className="flex items-center justify-center py-4">
              {isFetchingNextPage ? (
                <div
                  className="flex items-center gap-2"
                  style={{ color: 'var(--label-tertiary)' }}
                >
                  <div className="spinner spinner--sm" />
                  <span className="footnote">{t('infinite.loading_more')}</span>
                </div>
              ) : (
                <span className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
                  {t('infinite.pull_to_load')}
                </span>
              )}
            </div>
          ) : (
            records.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <span className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
                  {t('infinite.no_more')}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {isViewer && (
        <Alert variant="info" size="compact" icon={<Lock className="h-3.5 w-3.5" />}>
          {t('viewer_alert')}
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
    </motion.div>
  )
}
