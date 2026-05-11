/**
 * image-url - 把 COS 对象 key 拼成前端可用的代理 URL（v7.2 T-S1-INF-02 方案 B）
 *
 * 抽离自 `services/upload` 以避免 Avatar 等公共组件在入口 chunk 引入
 * `browser-image-compression`（>800KB 原始 / ~50KB gzip）。
 *
 * 规则：
 * - 空值 → `undefined`
 * - 以 http:// / https:// 开头 → 原样返回（兼容 v7.1 之前直接存绝对 URL 的老数据 / 第三方 URL）
 * - 其他（桶内 key，如 `avatars/u1/abc.jpg`）→ 返回 `/api/uploads/{key}`，由 axios baseURL 与
 *   vite proxy / 部署 nginx 统一代理到服务端 GET /api/uploads/*
 *
 * 鉴权：
 * - GET /api/uploads/* 需要 JWT；`<img>` 标签会自动带同源 cookie，但不会带 Authorization 头
 * - 因此首版部署要求浏览器访问主域（Cookie 有效），不适合嵌入跨域 iframe 中
 */
export function buildImageUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined
  if (/^https?:\/\//.test(key)) return key
  return `/api/uploads/${key}`
}
