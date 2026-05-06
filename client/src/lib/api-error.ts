/**
 * Web 版客户端 API 错误体系（FR-C6 双层防护 + axios 拦截器统一映射）
 *
 * 设计要点：
 * - PermissionError：前端 hook 层 / API 层共用的"权限不足"语义类
 * - ApiError：API 层抛出的标准错误（含 code / message / status）
 * - axios 响应拦截器在 services/api.ts 中将 403 + PERMISSION_DENIED 映射为 PermissionError
 *   保证前后端兜底统一处理路径
 */

export class ApiError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details?: unknown

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class PermissionError extends ApiError {
  constructor(message = '您没有此操作的权限') {
    super('PERMISSION_DENIED', message, 403)
    this.name = 'PermissionError'
  }
}

export class QuotaExceededError extends ApiError {
  constructor(message = '今日 AI 配额已用尽，请明天再试') {
    super('QUOTA_EXCEEDED', message, 403)
    this.name = 'QuotaExceededError'
  }
}

export class SleepActiveError extends ApiError {
  constructor(message = '已有进行中的睡眠记录，请先结束当前计时') {
    super('SLEEP_ALREADY_ACTIVE', message, 409)
    this.name = 'SleepActiveError'
  }
}

/**
 * 将 axios error 映射为应用层 ApiError 子类。
 * 调用方 catch 后可用 instanceof 判断分支处理。
 */
export function mapAxiosError(error: {
  response?: { status?: number; data?: { error?: { code?: string; message?: string } } }
  message?: string
}): ApiError {
  const status = error.response?.status ?? 500
  const code = error.response?.data?.error?.code ?? 'UNKNOWN_ERROR'
  const message = error.response?.data?.error?.message ?? error.message ?? '请求失败'

  if (code === 'PERMISSION_DENIED') return new PermissionError(message)
  if (code === 'QUOTA_EXCEEDED') return new QuotaExceededError(message)
  if (code === 'SLEEP_ALREADY_ACTIVE') return new SleepActiveError(message)
  return new ApiError(code, message, status)
}
