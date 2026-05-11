/**
 * upload.service - 文件上传基础设施（v7.2 T-S1-INF-02，方案 B 服务端代理）
 *
 * 架构：
 * - 上传：Browser → POST /api/uploads (multipart) → Express → COS putObject
 * - 下载：Browser <img src="/api/uploads/{key}"> → Express getObjectStream → COS
 * - 桶设为「私有读私有写」，密钥仅在服务端持有，客户端永远拿不到 COS URL
 *
 * 数据库语义：
 * - User.avatar / Baby.avatar / DailyCheckin.photoUrl 等字段存「key」（如 avatars/u1/abc.jpg）
 * - 前端展示时拼成 `/api/uploads/{key}` 作为 src
 *
 * 安全 / 设计要点：
 * - randomUUID 32 字符 hex 防 key 枚举
 * - ext 严格白名单（jpg/jpeg/png/webp）
 * - 服务端 putObject 前再校验文件大小（兜底；multer 已先校验一遍）
 * - getObjectStream 走 Stream，不在内存中累积大文件
 * - 缺凭证时 throw 503，前端 ImageUploader 优雅降级
 */
import COS from 'cos-nodejs-sdk-v5';
import { randomUUID } from 'node:crypto';
import type { Stream } from 'node:stream';
import { env } from '../config/env';
import {
  ServiceUnavailableError,
  BadRequestError,
  NotFoundError,
  ErrorCodes,
} from '../types/errors';
import type { UploadKind, UploadContext } from '../types';

/** 允许的文件扩展名（小写无点） */
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** ext → Content-Type 映射 */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** 各 kind 必填的上下文字段 */
const REQUIRED_CONTEXT: Record<UploadKind, Array<keyof UploadContext>> = {
  avatar: [],
  'baby-avatar': ['familyId', 'babyId'],
  'daily-checkin': ['familyId', 'babyId', 'date'],
};

/**
 * 上传成功后返回给客户端的结果。
 * 注意：不再返回 publicUrl 或 uploadUrl —— 客户端只需 key，
 * 展示时由前端拼 `/api/uploads/{key}` 走我方代理。
 */
export interface UploadResult {
  /** 桶内对象 key，前端落库 + 展示时拼接代理 URL 用 */
  key: string;
  /** 字节数（兜底信息，前端可能展示） */
  size: number;
  /** 内容类型 */
  contentType: string;
}

class UploadService {
  private cos: COS | null = null;

  private isConfigured(): boolean {
    return Boolean(
      env.COS_SECRET_ID &&
        env.COS_SECRET_KEY &&
        env.COS_BUCKET &&
        env.COS_REGION,
    );
  }

  private getCos(): COS {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableError(
        '对象存储未配置，请联系管理员设置 COS_* 环境变量',
        ErrorCodes.UPLOAD_NOT_CONFIGURED,
      );
    }
    if (!this.cos) {
      this.cos = new COS({
        SecretId: env.COS_SECRET_ID!,
        SecretKey: env.COS_SECRET_KEY!,
      });
    }
    return this.cos;
  }

  /**
   * 校验并归一化 ext：去前导点 / 转小写 / jpeg → jpg / 白名单校验。
   */
  private normalizeExt(ext: string): string {
    const lower = ext.replace(/^\./, '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(lower)) {
      throw new BadRequestError(
        `不支持的文件扩展名：${ext}。仅允许 ${Array.from(ALLOWED_EXTENSIONS).join(' / ')}`,
        ErrorCodes.UPLOAD_INVALID_EXT,
      );
    }
    return lower === 'jpeg' ? 'jpg' : lower;
  }

  /**
   * 按 kind + ctx 拼接桶内对象 key。
   *
   * - avatar:        avatars/{userId}/{cuid}.{ext}
   * - baby-avatar:   babies/{familyId}/{babyId}/{cuid}.{ext}
   * - daily-checkin: checkins/{familyId}/{babyId}/{date}-{cuid}.{ext}
   */
  private buildKey(
    userId: string,
    kind: UploadKind,
    ext: string,
    ctx: UploadContext,
  ): string {
    // randomUUID 32 字符 hex（去 dash），URL 不可枚举
    const id = randomUUID().replace(/-/g, '');
    switch (kind) {
      case 'avatar':
        return `avatars/${userId}/${id}.${ext}`;
      case 'baby-avatar':
        return `babies/${ctx.familyId}/${ctx.babyId}/${id}.${ext}`;
      case 'daily-checkin':
        return `checkins/${ctx.familyId}/${ctx.babyId}/${ctx.date}-${id}.${ext}`;
      default:
        throw new BadRequestError(
          `未知上传类型：${kind}`,
          ErrorCodes.INVALID_PARAMS,
        );
    }
  }

  /** 校验 ctx 字段；缺失字段或 date 格式错 → 400 */
  private validateContext(kind: UploadKind, ctx: UploadContext): void {
    const required = REQUIRED_CONTEXT[kind];
    const missing = required.filter((k) => !ctx[k]);
    if (missing.length > 0) {
      throw new BadRequestError(
        `上传类型 ${kind} 缺少必填字段：${missing.join(', ')}`,
        ErrorCodes.UPLOAD_MISSING_CONTEXT,
      );
    }
    if (ctx.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(ctx.date)) {
      throw new BadRequestError(
        `date 格式必须为 YYYY-MM-DD，收到：${ctx.date}`,
        ErrorCodes.INVALID_PARAMS,
      );
    }
    // 防 path traversal：所有 string 字段不允许出现 / 与 ..
    for (const k of ['familyId', 'babyId', 'date'] as const) {
      const v = ctx[k];
      if (v !== undefined && /[/\\.][/\\.]|[/\\]/.test(String(v))) {
        // 简化：只要包含 / \ 或连续两个点就拒绝
        if (/[/\\]|\.\./.test(String(v))) {
          throw new BadRequestError(
            `${k} 包含非法字符`,
            ErrorCodes.INVALID_PARAMS,
          );
        }
      }
    }
  }

  /**
   * 上传文件到 COS。
   *
   * @param userId 调用者 userId（用于 avatar key 前缀，且在路由层鉴权后才会到这里）
   * @param kind 上传分类
   * @param ext 文件扩展名（含/不含点都可）
   * @param buffer 文件二进制内容
   * @param ctx 上下文（按 kind 必填字段不同）
   * @returns { key, size, contentType }
   * @throws ServiceUnavailableError 503 当 COS 未配置
   * @throws BadRequestError 400 当 ext 不在白名单 / ctx 缺失 / 文件超大
   */
  async putObject(
    userId: string,
    kind: UploadKind,
    ext: string,
    buffer: Buffer,
    ctx: UploadContext = {},
  ): Promise<UploadResult> {
    const cos = this.getCos();
    const normalizedExt = this.normalizeExt(ext);
    this.validateContext(kind, ctx);

    // 服务端兜底大小校验（multer 已先校验一遍，此处防御内部调用）
    if (buffer.length > env.COS_MAX_UPLOAD_BYTES) {
      throw new BadRequestError(
        `文件过大：${buffer.length} 字节，超过限制 ${env.COS_MAX_UPLOAD_BYTES} 字节`,
        ErrorCodes.UPLOAD_TOO_LARGE,
      );
    }

    const key = this.buildKey(userId, kind, normalizedExt, ctx);
    const contentType = EXT_TO_MIME[normalizedExt] || 'application/octet-stream';

    await cos.putObject({
      Bucket: env.COS_BUCKET!,
      Region: env.COS_REGION!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // 防止浏览器 / CDN 沿用旧资源；下载代理层会再设 Cache-Control
      CacheControl: 'private, max-age=0',
    });

    return {
      key,
      size: buffer.length,
      contentType,
    };
  }

  /**
   * 从 COS 获取对象（流式）。
   *
   * 调用方（route 层）负责把 stream pipe 到 res，并设置 Content-Type / Cache-Control。
   *
   * 关键：使用 getObjectStream 而非 getObject，避免大文件在内存累积。
   * SDK 在 stream 模式下不接受 Output 参数，回调里的 Body 也不返回（直接走 stream）。
   *
   * @returns { stream, contentType, contentLength }
   * @throws NotFoundError 404 当 key 不存在
   * @throws ServiceUnavailableError 503 当 COS 未配置
   */
  async getObjectStream(
    key: string,
  ): Promise<{ stream: Stream; contentType: string; contentLength?: number }> {
    const cos = this.getCos();

    // 校验 key 路径合法性（防 path traversal）
    if (!isValidKey(key)) {
      throw new BadRequestError(
        '非法的对象 key',
        ErrorCodes.INVALID_PARAMS,
      );
    }

    return new Promise((resolve, reject) => {
      const stream = cos.getObjectStream(
        {
          Bucket: env.COS_BUCKET!,
          Region: env.COS_REGION!,
          Key: key,
        },
        (err, data) => {
          if (err) {
            // COS 404 / 403 → NotFound
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 404) {
              reject(new NotFoundError('对象'));
              return;
            }
            reject(err);
            return;
          }
          // headers 在 callback data 里
          const headers = (data as { headers?: Record<string, string> }).headers ?? {};
          const contentType = headers['content-type'] || 'application/octet-stream';
          const contentLengthRaw = headers['content-length'];
          const contentLength = contentLengthRaw ? Number(contentLengthRaw) : undefined;
          resolve({ stream, contentType, contentLength });
        },
      );
    });
  }

  // ============ 仅供测试使用（非 public API）============
  /** @internal */ _isConfiguredForTest(): boolean { return this.isConfigured(); }
  /** @internal */ _normalizeExtForTest(ext: string): string { return this.normalizeExt(ext); }
  /** @internal */ _buildKeyForTest(userId: string, kind: UploadKind, ext: string, ctx: UploadContext): string {
    return this.buildKey(userId, kind, ext, ctx);
  }
  /** @internal */ _validateContextForTest(kind: UploadKind, ctx: UploadContext): void {
    this.validateContext(kind, ctx);
  }
  /** @internal */ _isValidKeyForTest(key: string): boolean { return isValidKey(key); }
}

/**
 * 校验对象 key 是否合法：
 * - 必须以 avatars/ / babies/ / checkins/ 开头
 * - 不允许 .. / 反斜杠 / 控制字符
 * - 长度 ≤ 256（COS 实际上限 1024，给业务限制更紧）
 */
function isValidKey(key: string): boolean {
  if (!key || key.length > 256) return false;
  if (!/^(avatars|babies|checkins)\//.test(key)) return false;
  if (key.includes('..') || key.includes('\\')) return false;
  // 控制字符 / 不可见字符
  if (/[\x00-\x1f\x7f]/.test(key)) return false;
  return true;
}

export const uploadService = new UploadService();
