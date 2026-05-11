/**
 * pdf-export - PDF 导出能力（v7.2 T-S2-F11-FE-05 / T-S2-F4-02）
 *
 * 用 pdf-lib 把多张图片 Blob 拼成多页 A4 PDF：
 * - renderPagesToPdf：通用版（每张 PNG/JPG → 一页）
 * - renderReportWithCalendarPdf：F4 报告 + 日历联动版
 *
 * 性能 / 内存：
 * - 仅在 /growth/calendar / /report 路由动态 import 加载，
 *   pdf-lib 走独立 vendor-pdf chunk（≤ 35KB gzip 目标）
 * - 大于 8MB 的总输入会触发 onWarning（调用方应回退为"分别下载"）
 */
import { PDFDocument, type PDFImage } from 'pdf-lib'

/** A4 in PDF points (1 pt = 1/72 inch；A4 = 210 × 297 mm) */
const A4_WIDTH_PT = 595
const A4_HEIGHT_PT = 842

const MAX_TOTAL_BYTES = 8 * 1024 * 1024

export interface RenderPdfMetadata {
  title?: string
  author?: string
  /** PDF Subject 字段，便于派生工具检索 */
  subject?: string
}

async function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

async function embedImage(pdf: PDFDocument, blob: Blob): Promise<PDFImage> {
  const bytes = await readBlobAsBytes(blob)
  // 通过 magic bytes 推断格式
  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (isJpeg) return pdf.embedJpg(bytes)
  return pdf.embedPng(bytes)
}

/** 将一张图按"contain"模式置中绘制到一页 A4 */
function drawImageContain(
  page: ReturnType<PDFDocument['addPage']>,
  img: PDFImage,
) {
  const ratio = img.width / img.height
  const pageRatio = A4_WIDTH_PT / A4_HEIGHT_PT
  let dw: number
  let dh: number
  if (ratio > pageRatio) {
    dw = A4_WIDTH_PT
    dh = A4_WIDTH_PT / ratio
  } else {
    dh = A4_HEIGHT_PT
    dw = A4_HEIGHT_PT * ratio
  }
  const dx = (A4_WIDTH_PT - dw) / 2
  const dy = (A4_HEIGHT_PT - dh) / 2
  page.drawImage(img, { x: dx, y: dy, width: dw, height: dh })
}

/**
 * 通用：多张图片 Blob → 多页 PDF（每张一页，A4 contain）
 *
 * @param pages 图片 Blob 列表（按页顺序）
 * @param metadata 可选：PDF 元数据
 */
export async function renderPagesToPdf(
  pages: Blob[],
  metadata?: RenderPdfMetadata,
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error('renderPagesToPdf: 至少需要一页')
  }
  const totalBytes = pages.reduce((s, p) => s + p.size, 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    console.warn(
      `[pdf-export] 总输入 ${(totalBytes / 1024 / 1024).toFixed(1)}MB 超过软上限 ${MAX_TOTAL_BYTES / 1024 / 1024}MB，建议改用分别下载`,
    )
  }

  const pdf = await PDFDocument.create()
  if (metadata?.title) pdf.setTitle(metadata.title)
  if (metadata?.author) pdf.setAuthor(metadata.author)
  if (metadata?.subject) pdf.setSubject(metadata.subject)
  pdf.setCreator('Baby Care Tracker · Web')
  pdf.setProducer('pdf-lib')

  for (const blob of pages) {
    const img = await embedImage(pdf, blob)
    const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    drawImageContain(page, img)
  }

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export interface RenderReportWithCalendarPdfOptions {
  /** F4 报告页面分享图（PNG/JPG） */
  reportImage: Blob
  /** F11 月视图列表（每月一张） */
  calendarImages: Blob[]
  metadata?: RenderPdfMetadata
}

/**
 * F4 场景：第一页报告 + 后续 N 页日历。
 *
 * 与 renderPagesToPdf 等价于 [reportImage, ...calendarImages]，但语义化命名便于
 * 在 ReportShareDialog 处一眼看出意图，且未来可在此处加 PDF 书签 / 目录。
 */
export async function renderReportWithCalendarPdf(
  opts: RenderReportWithCalendarPdfOptions,
): Promise<Blob> {
  return renderPagesToPdf(
    [opts.reportImage, ...opts.calendarImages],
    opts.metadata,
  )
}

/**
 * 触发浏览器下载（适用于 PDF / PNG / JPG 等 Blob）。
 * 在 calendar-export-menu / report-share-dialog 内统一调用。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 下次事件循环再 revoke，确保下载已开始
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
