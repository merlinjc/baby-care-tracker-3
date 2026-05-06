/**
 * Share Canvas V1 - 4 卡片简版分享图（FR-G3）
 *
 * Web 版差异：
 * - 用 <canvas> + canvas.toBlob() 替代 wx.canvasToTempFilePath
 * - 用 <a download> 触发下载替代 wx.saveImageToPhotosAlbum
 * - 用 navigator.share() 替代 wx.shareAppMessage
 *
 * 设计要点：
 * - DPR 限制为 2（避免 3x 设备产生 6MB 巨图）
 * - 输出 jpeg quality=0.85，目标文件 ≤ 500KB
 * - 4 卡片：基本信息 + 喂养 / 睡眠 / 排便 + Footer 品牌标识
 * - AI 评语区动态高度（与小程序版 V2 区分，简版没有评语）
 */
import type { TodayStats, Baby } from '@/types'

const COLORS = {
  bg: '#F5F1EB',
  bgCard: '#FFFFFF',
  primary: '#D4B896',
  textPrimary: '#3D3D3D',
  textSecondary: '#666666',
  textHint: '#999999',
  feeding: '#A8D4A8',
  sleep: '#B8A8D4',
  diaper: '#D4C8A8',
  temperature: '#D4A8A8',
  border: '#E8E0D8',
}

interface RenderShareImageOptions {
  baby: Baby
  stats: TodayStats
  date?: Date
  /** 显示的副标题（如「今日小结」/「本周小结」） */
  subtitle?: string
}

const CANVAS_WIDTH = 750
const CARD_HEIGHT = 220
const CANVAS_HEIGHT = 1280

/**
 * 渲染分享图到 canvas，返回 Promise<Blob>（jpeg）
 */
export async function renderShareImage(opts: RenderShareImageOptions): Promise<Blob> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH * dpr
  canvas.height = CANVAS_HEIGHT * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'top'

  // 背景
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  let y = 40

  // 顶部品牌标题
  ctx.fillStyle = COLORS.primary
  ctx.font = 'bold 38px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText('Baby Care Tracker', 40, y)
  y += 50

  // 宝宝名 + 副标题
  ctx.fillStyle = COLORS.textPrimary
  ctx.font = 'bold 48px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText(opts.baby.name, 40, y)
  y += 60

  ctx.fillStyle = COLORS.textHint
  ctx.font = '24px -apple-system, "PingFang SC", sans-serif'
  const dateStr = formatDate(opts.date ?? new Date())
  ctx.fillText(`${opts.subtitle ?? '今日小结'} · ${dateStr}`, 40, y)
  y += 60

  // 4 张数据卡片（2x2 网格）
  const cardW = (CANVAS_WIDTH - 40 * 3) / 2
  const cards: Array<{ label: string; value: string; detail: string; color: string }> = [
    {
      label: '喂养',
      value: String(opts.stats.feeding.count),
      detail: opts.stats.feeding.totalAmount > 0 ? `共 ${opts.stats.feeding.totalAmount}ml` : '',
      color: COLORS.feeding,
    },
    {
      label: '睡眠',
      value: formatSleep(opts.stats.sleep.totalDuration),
      detail: `共 ${opts.stats.sleep.count} 次`,
      color: COLORS.sleep,
    },
    {
      label: '换尿布',
      value: String(opts.stats.diaper.count),
      detail: `尿 ${opts.stats.diaper.peeCount} / 便 ${opts.stats.diaper.poopCount}`,
      color: COLORS.diaper,
    },
    {
      label: '体温',
      value: opts.stats.temperature.latestValue != null ? `${opts.stats.temperature.latestValue}°C` : '--',
      detail: opts.stats.temperature.latestValue != null ? '最新值' : '尚未测量',
      color: COLORS.temperature,
    },
  ]

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 40 + col * (cardW + 40)
    const cardY = y + row * (CARD_HEIGHT + 20)

    drawCard(ctx, x, cardY, cardW, CARD_HEIGHT, card)
  }
  y += CARD_HEIGHT * 2 + 20 + 60

  // Footer 品牌标识
  ctx.fillStyle = COLORS.textHint
  ctx.font = '22px -apple-system, "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('记录每一刻，陪伴宝贝成长', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80)
  ctx.font = '20px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText('Baby Care Tracker', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50)
  ctx.textAlign = 'left'

  // 输出 jpeg
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas 导出失败'))
      },
      'image/jpeg',
      0.85,
    )
  })
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  card: { label: string; value: string; detail: string; color: string },
) {
  // 卡片背景
  ctx.fillStyle = COLORS.bgCard
  drawRoundedRect(ctx, x, y, w, h, 24)
  ctx.fill()

  // 顶部色条
  ctx.fillStyle = card.color
  drawRoundedRect(ctx, x, y, w, 6, 24)
  ctx.fill()

  // Label
  ctx.fillStyle = COLORS.textSecondary
  ctx.font = '24px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText(card.label, x + 30, y + 30)

  // Value
  ctx.fillStyle = card.color
  ctx.font = 'bold 60px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText(card.value, x + 30, y + 75)

  // Detail
  ctx.fillStyle = COLORS.textHint
  ctx.font = '22px -apple-system, "PingFang SC", sans-serif'
  ctx.fillText(card.detail, x + 30, y + h - 50)
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function formatSleep(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 触发下载分享图（PC 与移动端兼容）
 */
export async function downloadShareImage(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 使用 navigator.share 分享图片（移动端）；不支持时降级为下载
 */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/jpeg' })
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ title, files: [file] })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared'
      // fall through to download
    }
  }
  await downloadShareImage(blob, filename)
  return 'downloaded'
}
