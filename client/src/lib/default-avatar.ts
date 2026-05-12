/**
 * default-avatar - 基于昵称确定性生成 SVG dataURI 头像（v7.2 F12-01）
 *
 * 设计目标：
 * - 纯函数：相同 seed 输入 → 相同 SVG 输出（利于 React 重渲染对比 + CDN 缓存）
 * - 纯色 + 文本：不依赖外部资源，零网络开销
 * - 暖色调色板：与美拉德主题一致，避免生硬的 Material 色
 * - 适合未设置头像时的兜底展示；设置头像后用 `buildImageUrl(key)` 替换
 *
 * 与 F12-02/03 的配合：
 * - ImageUploader onChange(key) 得到 key 后，业务侧用 `buildImageUrl(key)` 拼 `/api/uploads/{key}`
 * - 未设置 key 时退回 getDefaultAvatarDataUri(seed) 渲染彩色首字头像
 * - 本模块不感知 key / URL，只消费 seed 字符串
 */

/**
 * 美拉德暖色调色板（与 ui-design-system.md 语义色对齐）。
 * 避免使用 CSS 变量：SVG dataURI 会在 Avatar image 内部被 <img> 加载，
 * 那时 CSS 变量作用域已丢失。
 */
const PALETTE = [
  '#c7703a', // 暖橙（feeding）
  '#a0674e', // 可可棕（brand）
  '#7b6252', // 摩卡（label-secondary）
  '#9c6d94', // 薰衣草紫（sleep）
  '#d8824f', // 柿子橙（growth）
  '#b88a5c', // 焦糖（accent）
  '#8b7355', // 亚麻棕
  '#a17a65', // 驼色
] as const

/**
 * 返回稳定的 32-bit 哈希。
 * 算法：FNV-1a 变种，纯 JS、无状态、可重入。
 */
function hashString(input: string): number {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // FNV prime 16777619 的位运算近似，避免 bigint
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

/**
 * 从 seed 挑选一个调色板颜色（确定性）。
 *
 * @example
 * pickColor('Alice') // 每次都返回同一个颜色
 */
export function pickAvatarColor(seed: string): string {
  if (!seed) return PALETTE[0]
  return PALETTE[hashString(seed) % PALETTE.length]
}

/**
 * 取昵称/名字的"首个有效字符"（含 emoji / 中文 / 英文首字母大写）。
 * 空字符串或纯空白 → "?"。
 */
export function firstGlyph(name: string | null | undefined): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // 用 Array.from 正确分词：处理 emoji + 中文 + 英文
  const first = Array.from(trimmed)[0] ?? '?'
  // 英文字母统一大写；其他字符原样返回
  return /^[a-z]$/i.test(first) ? first.toUpperCase() : first
}

interface DefaultAvatarOptions {
  /** 用户昵称 / 宝宝名，作为色彩哈希种子与文本来源 */
  seed: string
  /** 可选显式覆盖色（例如 BabyAvatar 要按性别分色） */
  color?: string
  /** SVG 逻辑尺寸（与 viewport 对齐）；默认 64，字体按比例缩放 */
  size?: number
}

/**
 * 生成确定性的 SVG dataURI 字符串，可直接作为 `<img src>` / `<AvatarImage src>`。
 *
 * - 相同 seed + color + size → 完全相同的 dataURI
 * - SVG 内不包含 alert/script，安全性 OK
 * - `encodeURIComponent` 确保 `#` `"` 等字符合法
 *
 * @example
 * <AvatarImage src={getDefaultAvatarDataUri({ seed: user.nickname })} />
 */
export function getDefaultAvatarDataUri(options: DefaultAvatarOptions): string {
  const { seed, color = pickAvatarColor(seed), size = 64 } = options
  const glyph = firstGlyph(seed)
  // 字体大小 = 直径的 45%，iOS 设计风惯例
  const fontSize = Math.round(size * 0.45)
  // 基线对齐：cy 略向下偏移，视觉上居中（字形上半部分通常较轻）
  const cy = size / 2 + fontSize * 0.05
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${color}"/>` +
    `<text x="50%" y="${cy}" font-family="-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(glyph)}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** 对 XML 特殊字符转义，防止昵称包含 `&` / `<` 等字符时破坏 SVG 结构。 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
