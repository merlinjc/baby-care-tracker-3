/**
 * ReportShareDialog - 报告分享弹窗（v7.2 T-S2-F4-01 + F4-02）
 *
 * 三个 action：
 *   1) 保存图片（PNG/JPG）：直接下载 renderReportImage 产物
 *   2) 导出 PDF：第一页报告 + 后续 N 页日历（仅在勾选"附带日历"时含）
 *   3) 系统分享：navigator.share（不支持时隐藏）
 *
 * 依赖：
 *   - @/lib/share-canvas → renderReportImage（已有）
 *   - @/lib/calendar-canvas → renderCalendarImage（动态 import）
 *   - @/lib/pdf-export → renderReportWithCalendarPdf / downloadBlob（动态 import）
 *   - @/services/daily-checkin → list 拉取期间内打卡（按 startDate/endDate 月分组）
 *
 * 性能：所有 calendar / pdf 相关 import 都是动态的，避免污染 report 页 chunk
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Share2, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/components/ui/toast'
import { renderReportImage } from '@/lib/share-canvas'
import type { Baby, DailyCheckin } from '@/types'
import type { ReportData } from '@/hooks/use-report-data'
import { dailyCheckinService } from '@/services/daily-checkin'
import { cn } from '@/lib/utils'

const supportsShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** Date → YYYY-MM-DD（本地） */
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 把期间内 checkins 拆成 YYYY-MM 分组 */
function groupCheckinsByMonth(items: DailyCheckin[]): Map<string, DailyCheckin[]> {
  const map = new Map<string, DailyCheckin[]>()
  for (const c of items) {
    const key = c.checkinDate.slice(0, 7)
    const arr = map.get(key) ?? []
    arr.push(c)
    map.set(key, arr)
  }
  return map
}

export interface ReportShareDialogProps {
  open: boolean
  onClose: () => void
  baby: Baby
  data: ReportData
  /** filename 前缀（如 '小明_周报_2026-05-04'） */
  filenameStem: string
  shareTitle: string
}

export function ReportShareDialog({
  open,
  onClose,
  baby,
  data,
  filenameStem,
  shareTitle,
}: ReportShareDialogProps) {
  const { t } = useTranslation('report')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [reportBlob, setReportBlob] = useState<Blob | null>(null)
  const [includeCalendar, setIncludeCalendar] = useState(true)
  const [isWorking, setWorking] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [calendarCount, setCalendarCount] = useState<number | null>(null)

  // 打开时渲染预览
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPreviewUrl(null)
    setReportBlob(null)

    ;(async () => {
      try {
        const blob = await renderReportImage({ baby, data })
        if (cancelled) return
        setReportBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      } catch (err) {
        if (!cancelled) {
          console.warn('[ReportShareDialog] preview render failed', err)
        }
      }
    })()

    // 拉本期 checkins 数量（用于"附带日历"勾选项可见性 + 文案）
    ;(async () => {
      try {
        const startYmd = ymd(data.range.start)
        const endYmd = ymd(data.range.end)
        const r = await dailyCheckinService.list(baby.id, {
          startDate: startYmd,
          endDate: endYmd,
        })
        if (!cancelled) setCalendarCount(r.items.length)
      } catch {
        if (!cancelled) setCalendarCount(0)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, baby, data])

  /** 卸载时回收预览 url */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSavePng = useCallback(async () => {
    if (!reportBlob) return
    const { downloadBlob } = await import('@/lib/pdf-export')
    downloadBlob(reportBlob, `${filenameStem}.jpg`)
    toast.success(t('share.toast_downloaded'))
  }, [reportBlob, filenameStem, t])

  const handleExportPdf = useCallback(async () => {
    if (!reportBlob || isWorking) return
    setWorking(true)
    try {
      // 拉日历照片（如勾选）
      const calendarPages: Blob[] = []
      if (includeCalendar && calendarCount && calendarCount > 0) {
        setProgress(t('share_dialog.rendering_calendar', { current: 0, total: 1 }))
        const list = await dailyCheckinService.list(baby.id, {
          startDate: ymd(data.range.start),
          endDate: ymd(data.range.end),
        })
        const byMonth = groupCheckinsByMonth(list.items)
        const months = Array.from(byMonth.keys()).sort()
        const { renderCalendarImage } = await import('@/lib/calendar-canvas')

        let i = 0
        for (const monthKey of months) {
          i++
          setProgress(
            t('share_dialog.rendering_calendar', {
              current: i,
              total: months.length,
            }),
          )
          const [y, m] = monthKey.split('-').map(Number)
          const monthBlob = await renderCalendarImage({
            baby,
            year: y,
            month: m,
            checkins: byMonth.get(monthKey)!,
          })
          calendarPages.push(monthBlob)
        }
      }

      setProgress(t('share_dialog.rendering_pdf'))
      const { renderReportWithCalendarPdf, downloadBlob } = await import('@/lib/pdf-export')
      const pdf = await renderReportWithCalendarPdf({
        reportImage: reportBlob,
        calendarImages: calendarPages,
        metadata: {
          title: shareTitle,
          author: 'Baby Care Tracker',
          subject: '成长报告',
        },
      })
      downloadBlob(pdf, `${filenameStem}.pdf`)
      setProgress('')
      toast.success(t('share_dialog.done'))
    } catch (err) {
      console.warn('[ReportShareDialog] export pdf failed', err)
      toast.error(t('share.toast_failed'))
    } finally {
      setWorking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBlob, isWorking, includeCalendar, calendarCount, baby, data, filenameStem, shareTitle, t])

  const handleNativeShare = useCallback(async () => {
    if (!reportBlob || !supportsShare) return
    const file = new File([reportBlob], `${filenameStem}.jpg`, { type: 'image/jpeg' })
    try {
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        await navigator.share({ title: shareTitle })
      } else {
        await navigator.share({ title: shareTitle, files: [file] })
      }
    } catch (err) {
      const msg = (err as Error).message
      if (!/abort|canceled/i.test(msg)) {
        toast.error(t('share.toast_failed'))
      }
    }
  }, [reportBlob, filenameStem, shareTitle, t])

  const calendarOptionLabel = useMemo(() => {
    if (calendarCount === null) return ''
    if (calendarCount === 0) return t('share_dialog.include_calendar_empty')
    return t('share_dialog.include_calendar', { count: calendarCount })
  }, [calendarCount, t])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('share_dialog.title')}
      size="md"
    >
      <div className="space-y-3">
        {/* 预览 */}
        <div
          className={cn(
            'relative w-full rounded-[var(--radius-lg)] overflow-hidden',
            'bg-[var(--surface-2)]',
            'aspect-[3/5]',
          )}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t('share_dialog.preview_label')}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--label-tertiary)] text-[14px] gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('share_dialog.rendering_cover')}
            </div>
          )}
        </div>

        {/* 附带日历选项 */}
        {calendarCount !== null && (
          <label
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 cursor-pointer',
              calendarCount === 0 && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Checkbox
              checked={includeCalendar && calendarCount > 0}
              disabled={calendarCount === 0}
              onCheckedChange={(c) => setIncludeCalendar(c === true)}
              className={cn(
                'h-4 w-4 rounded border border-[var(--separator-opaque)]',
                'data-[state=checked]:bg-[var(--brand)] data-[state=checked]:border-[var(--brand)]',
              )}
            />
            <span className="text-[13px] text-[var(--label-secondary)]">
              {calendarOptionLabel}
            </span>
          </label>
        )}

        {/* 进度提示 */}
        {progress && (
          <div className="text-[12px] text-[var(--label-tertiary)] flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress}
          </div>
        )}

        {/* 操作 */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="plain"
            size="md"
            onClick={handleSavePng}
            disabled={!reportBlob || isWorking}
            leftIcon={<Download className="h-4 w-4" />}
          >
            {t('share_dialog.save_png')}
          </Button>
          <Button
            variant="filled"
            size="md"
            onClick={handleExportPdf}
            disabled={!reportBlob || isWorking}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            {t('share_dialog.export_pdf')}
          </Button>
          {supportsShare && (
            <Button
              variant="plain"
              size="md"
              onClick={handleNativeShare}
              disabled={!reportBlob || isWorking}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              {t('share_dialog.native_share')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
