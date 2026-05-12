/**
 * CalendarExportMenu - 月视图导出 Dropdown（v7.2 T-S2-F11-FE-05）
 *
 * 三个 action：
 *   1) 导出图片（PNG / JPG）→ <a download>
 *   2) 导出 PDF → pdf-lib 单页 PDF
 *   3) 系统分享（仅 navigator.share 支持时显示）
 *
 * 性能：
 * - calendar-canvas + pdf-lib 都通过 dynamic import，避免污染入口 chunk
 * - 渲染过程中显示进度 toast：'渲染中 i/total'
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileImage, FileText, Share2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import type { Baby, DailyCheckin } from '@/types'

export interface CalendarExportMenuProps {
  baby: Baby
  year: number
  month: number
  checkins: DailyCheckin[]
}

const supportsShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export function CalendarExportMenu({
  baby,
  year,
  month,
  checkins,
}: CalendarExportMenuProps) {
  const { t } = useTranslation('daily-checkin')
  const [isWorking, setIsWorking] = useState(false)

  const baseFilename = `${baby.name}_成长日历_${year}-${String(month).padStart(2, '0')}`

  const renderImage = useCallback(async (): Promise<Blob> => {
    const { renderCalendarImage } = await import('@/lib/calendar-canvas')
    return renderCalendarImage({
      baby,
      year,
      month,
      checkins,
      onProgress: (current, total) => {
        if (total > 0 && current < total) {
          // 不每张都 toast，性能太低；只更新一次轻提示
        }
      },
    })
  }, [baby, year, month, checkins])

  const handleExportImage = useCallback(async () => {
    if (isWorking) return
    setIsWorking(true)
    const tid = toast.info(t('calendar.rendering', { current: 0, total: checkins.length }))
    void tid
    try {
      const blob = await renderImage()
      const { downloadBlob } = await import('@/lib/pdf-export')
      downloadBlob(blob, `${baseFilename}.jpg`)
      toast.success(t('calendar.rendering_done'))
    } catch (err) {
      console.warn('[calendar export image] failed', err)
      toast.error('导出失败，请重试')
    } finally {
      setIsWorking(false)
    }
  }, [isWorking, renderImage, baseFilename, checkins.length, t])

  const handleExportPdf = useCallback(async () => {
    if (isWorking) return
    setIsWorking(true)
    toast.info(t('calendar.rendering', { current: 0, total: checkins.length }))
    try {
      const blob = await renderImage()
      const { renderPagesToPdf, downloadBlob } = await import('@/lib/pdf-export')
      const pdf = await renderPagesToPdf([blob], {
        title: `${baby.name} 的成长日历 ${year}-${String(month).padStart(2, '0')}`,
        author: 'Baby Care Tracker',
      })
      downloadBlob(pdf, `${baseFilename}.pdf`)
      toast.success(t('calendar.rendering_done'))
    } catch (err) {
      console.warn('[calendar export pdf] failed', err)
      toast.error('导出失败，请重试')
    } finally {
      setIsWorking(false)
    }
  }, [isWorking, renderImage, baseFilename, baby.name, year, month, checkins.length, t])

  const handleShare = useCallback(async () => {
    if (!supportsShare || isWorking) return
    setIsWorking(true)
    try {
      const blob = await renderImage()
      const file = new File([blob], `${baseFilename}.jpg`, { type: 'image/jpeg' })
      // 部分浏览器需要 canShare 检查
      if (
        navigator.canShare &&
        !navigator.canShare({ files: [file] })
      ) {
        // 退化为普通链接分享
        const url = URL.createObjectURL(blob)
        await navigator.share({ title: `${baby.name} 的成长日历`, url })
        URL.revokeObjectURL(url)
      } else {
        await navigator.share({
          title: `${baby.name} 的成长日历`,
          text: `${year} 年 ${month} 月的成长记录`,
          files: [file],
        })
      }
    } catch (err) {
      const e = err as Error
      // 用户主动取消静默
      if (!/abort|canceled/i.test(e.message)) {
        toast.error('分享失败')
      }
    } finally {
      setIsWorking(false)
    }
  }, [isWorking, renderImage, baseFilename, baby.name, year, month])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="plain"
          size="sm"
          disabled={isWorking}
          leftIcon={
            isWorking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )
          }
        >
          {t('calendar.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={handleExportImage}>
          <FileImage className="h-4 w-4 text-[var(--label-secondary)]" />
          <span>{t('calendar.export_png')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExportPdf}>
          <FileText className="h-4 w-4 text-[var(--label-secondary)]" />
          <span>{t('calendar.export_pdf')}</span>
        </DropdownMenuItem>
        {supportsShare && (
          <DropdownMenuItem onSelect={handleShare}>
            <Share2 className="h-4 w-4 text-[var(--label-secondary)]" />
            <span>{t('calendar.share')}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
