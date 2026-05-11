/**
 * upload.ts - 文件上传客户端 service（v7.2 T-S1-INF-02 方案 B 服务端代理）
 *
 * 工作流：
 * 1. 客户端压缩 + EXIF GPS 剥离（browser-image-compression），目标 ≤1MB
 * 2. FormData 提交到 POST /api/uploads（multipart/form-data）
 * 3. 服务端 putObject 到 COS，返回 { key, size, contentType }
 * 4. 业务层把 key 落库；展示时拼 `/api/uploads/{key}` 作为 src
 *
 * 设计要点：
 * - 不同 kind 压缩长边不同：avatar/baby-avatar 512px，daily-checkin 1080px
 * - 服务端代理后，密钥不暴露给客户端；DB 不再存 COS URL
 * - 用 axios 提交 FormData（自动 multipart）+ onUploadProgress（无需自己写 XHR）
 */
import imageCompression from 'browser-image-compression'
import api from './api'
import type {
  ApiResponse,
  UploadResult,
  UploadKind,
  UploadContext,
} from '@/types'

// buildImageUrl 抽到 lib/image-url，避免消费方（Avatar 等）把本文件
// （含 browser-image-compression 大包）一起打入入口 chunk。
export { buildImageUrl } from '@/lib/image-url'

/** 不同 kind 的压缩长边（px） */
const MAX_DIMENSION_BY_KIND: Record<UploadKind, number> = {
  avatar: 512,
  'baby-avatar': 512,
  'daily-checkin': 1080,
}

/** 客户端目标体积（MB），略小于服务端 COS_MAX_UPLOAD_BYTES（默认 2MB） */
const TARGET_MAX_SIZE_MB = 1

const COMPRESSED_MIME = 'image/jpeg'
const COMPRESSED_EXT = 'jpg'

interface UploadOptions {
  /** 自定义压缩长边（覆盖默认） */
  maxDimension?: number
  /** 上传进度（0-1）回调 */
  onProgress?: (progress: number) => void
  /** 取消信号；abort 时上传立即终止 */
  signal?: AbortSignal
}

export const uploadService = {
  /**
   * 完整上传链路：压缩 → POST 服务端代理 → 返回 key。
   *
   * @param file 用户选中的文件
   * @param kind 上传分类，决定 key 前缀与压缩长边
   * @param ctx 上下文（baby-avatar / daily-checkin 必填）
   * @returns { key, size, contentType }；业务侧把 key 落库
   * @throws 503 UPLOAD_NOT_CONFIGURED 当后端未配置 COS（业务侧应优雅降级）
   * @throws 400 UPLOAD_INVALID_EXT / UPLOAD_MISSING_CONTEXT / UPLOAD_TOO_LARGE
   */
  async upload(
    file: File,
    kind: UploadKind,
    ctx: UploadContext = {},
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // 1. 压缩 + EXIF 剥离
    const maxDimension = options.maxDimension ?? MAX_DIMENSION_BY_KIND[kind]
    const blob = await imageCompression(file, {
      maxWidthOrHeight: maxDimension,
      // 显式禁用，避免 GPS 等元数据泄露
      preserveExif: false,
      useWebWorker: true,
      fileType: COMPRESSED_MIME,
      initialQuality: 0.85,
      // 客户端目标 1MB（服务端兜底 2MB），超过则继续降质
      maxSizeMB: TARGET_MAX_SIZE_MB,
    })

    // 2. 组装 FormData → POST /api/uploads
    const form = new FormData()
    // 给上传文件一个稳定的文件名，便于后端日志可读（COS key 由服务端生成，与文件名无关）
    form.append('file', blob, `upload.${COMPRESSED_EXT}`)
    form.append('kind', kind)
    form.append('ext', COMPRESSED_EXT)
    if (ctx.babyId) form.append('babyId', ctx.babyId)
    if (ctx.familyId) form.append('familyId', ctx.familyId)
    if (ctx.date) form.append('date', ctx.date)

    const res = await api.post<ApiResponse<UploadResult>>('/uploads', form, {
      // 让 axios / 浏览器自己计算 boundary
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options.signal,
      onUploadProgress: (e) => {
        if (options.onProgress && e.total) {
          options.onProgress(e.loaded / e.total)
        }
      },
    })

    return res.data.data!
  },
}
