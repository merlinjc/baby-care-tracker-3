/**
 * calendar-canvas - 把成长日历月视图渲染为 PNG Blob（v7.2 T-S2-F11-FE-05）
 *
 * 设计要点：
 * - 输出 A4 宽比（1240 × ~1754 px）便于直接嵌入 PDF
 * - 2 DPR（≤ 2）防止移动端 OOM；输出 image/jpeg quality 0.85，目标 ≤ 400KB
 * - 7×6 网格 + 周标签头 + 标题 + 日期格内圆角缩略图（用 createImageBitmap 缓存）
 * - 与 ui-design-system 同色板（暖色系，与 share-canvas 保持一致）
 * - 渲染时按 cell 顺序串行加载图片，便于 onProgress 回调
 *
 * 注：渲染函数本身不做 EXIF 处理（输入已是 buildImageUrl 拉的代理 URL，
 * 服务端从 COS 取的是上传时压缩过、剥离了 EXIF 的图片）。
 */
import type { Baby, DailyCheckin } from '@/types'
import { buildImageUrl } from '@/lib/image-url'
import { getMonthGrid } from '@/lib/daily-checkin-date'

const COLORS = {
  bg: '#F5F1EB',
  bgCard: '#FFFFFF',
  primary: '#D4B896',
  primaryInk: '#8B6F47',
  textPrimary: '#3D3D3D',
  textSecondary: '#666666',
  textHint: '#999999',
  cellBg: '#FAF6EF',
  cellBorder: '#E8E0D8',
  todayRing: '#D4B896',
}

const A4_WIDTH = 1240 // 96 DPI 下的 A4 宽度
const A4_HEIGHT = 1754
const PADDING = 64
const HEADER_HEIGHT = 200
const WEEKDAY_HEIGHT = 48
const COLS = 7
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export interface RenderCalendarImageOptions {
  baby: Baby
  year: number
  month: number // 1-12
  /** 当月 checkins（按 checkinDate 索引；GrowthCalendar 已加载过的可直接传） */
  checkins: DailyCheckin[]
  /** 渲染进度回调 (current, total)；用于 toast 进度提示 */
  onProgress?: (current: number, total: number) => void
}

export async function renderCalendarImage(
  opts: RenderCalendarImageOptions,
): Promise<Blob> {
  const { baby, year, month, checkins, onProgress } = opts

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = A4_WIDTH * dpr
  canvas.height = A4_HEIGHT * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 上下文不可用')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'top'

  // 背景
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)

  // ── Header ──
  ctx.fillStyle = COLORS.primaryInk
  ctx.font = 'bold 56px -apple-system, "PingFang SC", system-ui, sans-serif'
  ctx.fillText(`${baby.name} 的成长日历`, PADDING, PADDING)

  ctx.fillStyle = COLORS.textSecondary
  ctx.font = '28px -apple-system, "PingFang SC", system-ui, sans-serif'
  ctx.fillText(
    `${year} 年 ${month} 月 · 共 ${checkins.length} 天打卡`,
    PADDING,
    PADDING + 76,
  )

  // 装饰横线
  ctx.strokeStyle = COLORS.primary
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(PADDING, PADDING + HEADER_HEIGHT - 8)
  ctx.lineTo(A4_WIDTH - PADDING, PADDING + HEADER_HEIGHT - 8)
  ctx.stroke()

  // ── 周标签 ──
  const gridLeft = PADDING
  const gridTop = PADDING + HEADER_HEIGHT
  const gridWidth = A4_WIDTH - PADDING * 2
  const cellWidth = gridWidth / COLS
  const gap = 8
  const cellSize = cellWidth - gap

  ctx.fillStyle = COLORS.textSecondary
  ctx.font = 'bold 22px -apple-system, "PingFang SC", system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (let i = 0; i < COLS; i++) {
    ctx.fillText(
      WEEKDAY_LABELS[i],
      gridLeft + cellWidth * i + cellWidth / 2,
      gridTop + 12,
    )
  }
  ctx.textAlign = 'left'

  // ── 网格 ──
  const grid = getMonthGrid(year, month)
  const rows = grid.length / COLS
  // 按 ymd 索引
  const checkinMap = new Map(checkins.map((c) => [c.checkinDate, c]))

  const gridCellsTop = gridTop + WEEKDAY_HEIGHT
  const totalLoadable = checkins.length
  let loaded = 0
  onProgress?.(0, totalLoadable)

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i]
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const x = gridLeft + col * cellWidth + gap / 2
    const y = gridCellsTop + row * cellWidth + gap / 2
    const day = parseInt(cell.ymd.slice(8, 10), 10)
    const checkin = checkinMap.get(cell.ymd)

    // cell 背景
    ctx.fillStyle = COLORS.cellBg
    drawRoundedRect(ctx, x, y, cellSize, cellSize, 16)
    ctx.fill()

    if (checkin) {
      // 加载并绘制照片
      try {
        const bitmap = await loadImage(buildImageUrl(checkin.photoKey)!)
        // 圆角裁切
        ctx.save()
        drawRoundedRect(ctx, x, y, cellSize, cellSize, 16)
        ctx.clip()
        // cover 模式
        const ratio = bitmap.width / bitmap.height
        let dw = cellSize
        let dh = cellSize
        let dx = x
        let dy = y
        if (ratio > 1) {
          dh = cellSize
          dw = cellSize * ratio
          dx = x - (dw - cellSize) / 2
        } else {
          dw = cellSize
          dh = cellSize / ratio
          dy = y - (dh - cellSize) / 2
        }
        ctx.drawImage(bitmap, dx, dy, dw, dh)
        ctx.restore()

        // 数字角标
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        const badgeW = day < 10 ? 28 : 36
        drawRoundedRect(ctx, x + 8, y + 8, badgeW, 24, 12)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 16px -apple-system, "PingFang SC", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(day), x + 8 + badgeW / 2, y + 11)
        ctx.textAlign = 'left'

        // AI 小记首行
        if (checkin.aiSummary) {
          const summary = ellipsis(checkin.aiSummary, 14)
          // 渐变底
          const gradient = ctx.createLinearGradient(0, y + cellSize - 40, 0, y + cellSize)
          gradient.addColorStop(0, 'rgba(0,0,0,0)')
          gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
          ctx.save()
          drawRoundedRect(ctx, x, y, cellSize, cellSize, 16)
          ctx.clip()
          ctx.fillStyle = gradient
          ctx.fillRect(x, y + cellSize - 40, cellSize, 40)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = '13px -apple-system, "PingFang SC", system-ui, sans-serif'
          ctx.fillText(summary, x + 8, y + cellSize - 22)
          ctx.restore()
        }
      } catch {
        // 加载失败：仅画数字
        drawDayNumber(ctx, x + cellSize / 2, y + cellSize / 2 - 10, day, COLORS.textPrimary)
      } finally {
        loaded++
        onProgress?.(loaded, totalLoadable)
      }
    } else {
      // 未打卡数字
      const inMonth = cell.inCurrentMonth
      drawDayNumber(
        ctx,
        x + cellSize / 2,
        y + cellSize / 2 - 12,
        day,
        inMonth ? COLORS.textPrimary : COLORS.textHint,
      )
    }
  }

  // ── Footer ──
  ctx.fillStyle = COLORS.textHint
  ctx.font = '20px -apple-system, "PingFang SC", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(
    'Baby Care Tracker · 每一天都值得记录',
    A4_WIDTH / 2,
    gridCellsTop + rows * cellWidth + 32,
  )
  ctx.textAlign = 'left'

  // 输出 jpeg blob
  return await canvasToBlob(canvas, 'image/jpeg', 0.88)
}

// ============ Helpers ============

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawDayNumber(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  day: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.font = '500 28px -apple-system, "PingFang SC", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(day), cx, cy)
  ctx.textAlign = 'left'
}

function ellipsis(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

/**
 * 用 fetch + createImageBitmap 加载图片。
 * - 走 fetch 是因为 <img crossOrigin> 在 same-origin 代理下会更稳，
 *   且 createImageBitmap 的色彩管理结果一致
 * - 同源 cookie 会随 fetch 自动带上（GET /api/uploads/* 需要 JWT cookie）
 */
async function loadImage(url: string): Promise<ImageBitmap> {
  const resp = await fetch(url, { credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`fetch ${url} failed: ${resp.status}`)
  const blob = await resp.blob()
  return await createImageBitmap(blob)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('canvas.toBlob 失败'))
      },
      type,
      quality,
    )
  })
}
