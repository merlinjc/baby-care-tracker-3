/**
 * upload.ts - 文件上传客户端 service（v7.2 T-S1-INF-02）
 *
 * 工作流：
 * 1. 客户端压缩 + EXIF GPS 剥离（browser-image-compression）
 * 2. POST /api/uploads/presign 拿到 { uploadUrl, publicUrl, key }
 * 3. fetch(uploadUrl, { method: 'PUT', body: blob }) 直传 COS
 * 4. 返回 publicUrl 给业务层落库
 *
 * 设计要点：
 * - 压缩参数因 kind 不同：avatar / baby-avatar 长边 512px，daily-checkin 长边 1080px
 * - JPEG quality 0.85，平衡画质与体积（单图通常 ≤ 500KB）
 * - 不带认证调 COS PUT（COS 用预签名 URL 鉴权，axios 实例会自动加 Bearer 反而会被 COS 拒绝）
 * - 上传失败 throw 给调用方（业务侧负责 toast / 重试 UI）
 */
import imageCompression from 'browser-image-compression'
import api from './api'
import type {
  ApiResponse,
  PresignRequest,
  PresignResult,
  UploadKind,
  UploadContext,
} from '@/types'

/** 不同 kind 的压缩长边（px） */
const MAX_DIMENSION_BY_KIND: Record<UploadKind, number> = {
  avatar: 512,
  'baby-avatar': 512,
  'daily-checkin': 1080,
}

/** 压缩输出 MIME 与对应扩展名 */
const COMPRESSED_MIME = 'image/jpeg'
const COMPRESSED_EXT = 'jpg'

interface UploadOptions {
  /** 自定义压缩长边（覆盖默认） */
  maxDimension?: number
  /** 上传进度（0-1）回调，便于业务展示进度条 */
  onProgress?: (progress: number) => void
  /** 取消信号；abort 时上传立即终止 */
  signal?: AbortSignal
}

export const uploadService = {
  /**
   * 完整上传链路：压缩 → presign → PUT COS → 返回公网 URL。
   *
   * @param file 用户选中的文件（File 实例）
   * @param kind 上传分类，决定 key 前缀与压缩长边
   * @param ctx 上下文（baby-avatar / daily-checkin 必填）
   * @returns 上传后的 publicUrl，可直接落库
   * @throws 503 UPLOAD_NOT_CONFIGURED 当后端未配置 COS（业务侧应优雅降级）
   * @throws 400 UPLOAD_INVALID_EXT / UPLOAD_MISSING_CONTEXT
   * @throws Error('UPLOAD_FAILED') 当 PUT COS 失败
   */
  async upload(
    file: File,
    kind: UploadKind,
    ctx: UploadContext = {},
    options: UploadOptions = {},
  ): Promise<{ publicUrl: string; key: string }> {
    // 1. 压缩 + EXIF 剥离
    const maxDimension = options.maxDimension ?? MAX_DIMENSION_BY_KIND[kind]
    const blob = await imageCompression(file, {
      maxWidthOrHeight: maxDimension,
      // browser-image-compression 默认会保留 EXIF，需要显式禁用
      preserveExif: false,
      useWebWorker: true,
      fileType: COMPRESSED_MIME,
      initialQuality: 0.85,
      // 单图最大 1MB（压缩后的目标），超过则继续降质
      maxSizeMB: 1,
    })

    // 2. 申请预签名 URL
    const presignBody: PresignRequest = {
      kind,
      ext: COMPRESSED_EXT,
      babyId: ctx.babyId,
      familyId: ctx.familyId,
      date: ctx.date,
    }
    const presignRes = await api.post<ApiResponse<PresignResult>>(
      '/uploads/presign',
      presignBody,
    )
    const presign = presignRes.data.data!

    // 3. 直传 COS（不带 axios 拦截器，避免 Authorization 头干扰 COS 签名校验）
    await putToCos(presign.uploadUrl, blob, {
      onProgress: options.onProgress,
      signal: options.signal,
    })

    return { publicUrl: presign.publicUrl, key: presign.key }
  },
}

/**
 * 用 XHR 直传 COS（取代 fetch，原因：fetch 不能监听上传进度）。
 *
 * 失败 throw Error，调用方决定是否 toast / 重试。
 */
function putToCos(
  uploadUrl: string,
  blob: Blob,
  options: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')

    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          options.onProgress!(e.loaded / e.total)
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(
          new Error(
            `UPLOAD_FAILED: COS 返回 ${xhr.status} ${xhr.statusText || ''}`.trim(),
          ),
        )
      }
    })

    xhr.addEventListener('error', () => reject(new Error('UPLOAD_FAILED: 网络错误')))
    xhr.addEventListener('abort', () => reject(new Error('UPLOAD_ABORTED')))

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort()
        reject(new Error('UPLOAD_ABORTED'))
        return
      }
      options.signal.addEventListener('abort', () => xhr.abort())
    }

    xhr.send(blob)
  })
}
