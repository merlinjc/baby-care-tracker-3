/**
 * upload.service - 文件上传基础设施（v7.2 T-S1-INF-02）
 *
 * 职责：
 * - 封装腾讯云 COS 预签名 PUT URL 生成
 * - 按上传 kind 决定 key 前缀与必填上下文
 * - 缺凭证 / 缺 bucket → 抛 503 ServiceUnavailableError(UPLOAD_NOT_CONFIGURED)，
 *   前端 ImageUploader 优雅降级为默认头像 / 提示用户联系管理员
 *
 * 安全 / 设计要点：
 * - cuid 在 key 中保证 URL 不可枚举（不在桶内做 ACL 时也能避免被遍历）
 * - 仅签 PUT，不签 GET（公网访问通过桶的 ACL 设置，由部署侧配置）
 * - ext 严格白名单（jpg/jpeg/png/webp），避免上传可执行文件
 * - 不在 service 层保留 file 引用，所有大文件直传 COS（前端 → COS），
 *   后端只承担鉴权 + 签名，零内存压力
 *
 * 使用方：
 * - F12 用户头像上传
 * - F12 宝宝头像上传
 * - Sprint 2 F11 每日打卡照片上传
 */
import COS from 'cos-nodejs-sdk-v5';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import {
  ServiceUnavailableError,
  BadRequestError,
  ErrorCodes,
} from '../types/errors';
import type { UploadKind, UploadContext, PresignResult } from '../types';

/** 允许的文件扩展名（小写无点） */
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** 各 kind 必填的上下文字段（service 层校验，避免无效 key） */
const REQUIRED_CONTEXT: Record<UploadKind, Array<keyof UploadContext>> = {
  avatar: [],
  'baby-avatar': ['familyId', 'babyId'],
  'daily-checkin': ['familyId', 'babyId', 'date'],
};

class UploadService {
  private cos: COS | null = null;

  /**
   * 检查 COS 是否完整配置。
   * 任一字段缺失 → 视为未配置（前端会拿到 503 优雅降级）。
   */
  private isConfigured(): boolean {
    return Boolean(
      env.COS_SECRET_ID &&
        env.COS_SECRET_KEY &&
        env.COS_BUCKET &&
        env.COS_REGION,
    );
  }

  /** 懒初始化 COS 实例（避免测试 / 开发期未配 COS 时也强制建实例） */
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
   * 校验并归一化 ext：
   * - 去除前导 `.`
   * - 转小写
   * - 不在白名单 → 抛 400 UPLOAD_INVALID_EXT
   * - jpg / jpeg 统一为 jpg（key 美观，且与压缩输出一致）
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
   * 路径策略：
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
    // randomUUID 36 字符（含 4 个 -），保证 URL 不可枚举；
    // 去掉 dash 让 key 更短，仍是 32 字符 hex，碰撞概率忽略不计
    const id = randomUUID().replace(/-/g, '');
    switch (kind) {
      case 'avatar':
        return `avatars/${userId}/${id}.${ext}`;
      case 'baby-avatar':
        return `babies/${ctx.familyId}/${ctx.babyId}/${id}.${ext}`;
      case 'daily-checkin':
        return `checkins/${ctx.familyId}/${ctx.babyId}/${ctx.date}-${id}.${ext}`;
      default:
        // 编译期已穷举所有 kind；运行期未知 kind 视为 400
        throw new BadRequestError(
          `未知上传类型：${kind}`,
          ErrorCodes.INVALID_PARAMS,
        );
    }
  }

  /** 校验 ctx 字段；缺失字段 → 400 UPLOAD_MISSING_CONTEXT */
  private validateContext(kind: UploadKind, ctx: UploadContext): void {
    const required = REQUIRED_CONTEXT[kind];
    const missing = required.filter((k) => !ctx[k]);
    if (missing.length > 0) {
      throw new BadRequestError(
        `上传类型 ${kind} 缺少必填字段：${missing.join(', ')}`,
        ErrorCodes.UPLOAD_MISSING_CONTEXT,
      );
    }

    // date 仅做粗粒度校验（YYYY-MM-DD），避免被 path traversal
    if (ctx.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(ctx.date)) {
      throw new BadRequestError(
        `date 格式必须为 YYYY-MM-DD，收到：${ctx.date}`,
        ErrorCodes.INVALID_PARAMS,
      );
    }
  }

  /**
   * 公开 URL 拼接：
   * - 优先使用 COS_PUBLIC_BASE_URL（CDN 加速场景）
   * - 否则用默认 COS 域名 https://{bucket}.cos.{region}.myqcloud.com
   */
  private buildPublicUrl(key: string): string {
    if (env.COS_PUBLIC_BASE_URL) {
      const base = env.COS_PUBLIC_BASE_URL.replace(/\/+$/, '');
      return `${base}/${key}`;
    }
    return `https://${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com/${key}`;
  }

  /**
   * 创建预签名 PUT URL，前端拿到后直传 COS。
   *
   * @returns uploadUrl 5 分钟内有效；publicUrl 用于落库；key 用于后续清理
   * @throws ServiceUnavailableError 503 当 COS 未配置
   * @throws BadRequestError 400 当 ext 不在白名单或 ctx 字段缺失
   */
  async createPresignedUpload(
    userId: string,
    kind: UploadKind,
    ext: string,
    ctx: UploadContext = {},
  ): Promise<PresignResult> {
    // 1. 配置检查（缺一不可）→ 503
    const cos = this.getCos();

    // 2. ext 白名单校验 + 归一化
    const normalizedExt = this.normalizeExt(ext);

    // 3. ctx 必填字段 + 格式校验
    this.validateContext(kind, ctx);

    // 4. 拼 key
    const key = this.buildKey(userId, kind, normalizedExt, ctx);

    // 5. 调 COS 生成签名 URL（callback 转 Promise）
    const expires = env.COS_PRESIGN_EXPIRES;
    const uploadUrl = await new Promise<string>((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: env.COS_BUCKET!,
          Region: env.COS_REGION!,
          Key: key,
          Method: 'PUT',
          Sign: true,
          Expires: expires,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data.Url);
        },
      );
    });

    return {
      uploadUrl,
      publicUrl: this.buildPublicUrl(key),
      key,
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
  }

  // ============ 仅供测试使用的 helpers（非 public API）============

  /** @internal */
  _isConfiguredForTest(): boolean {
    return this.isConfigured();
  }

  /** @internal */
  _normalizeExtForTest(ext: string): string {
    return this.normalizeExt(ext);
  }

  /** @internal */
  _buildKeyForTest(
    userId: string,
    kind: UploadKind,
    ext: string,
    ctx: UploadContext,
  ): string {
    return this.buildKey(userId, kind, ext, ctx);
  }

  /** @internal */
  _validateContextForTest(kind: UploadKind, ctx: UploadContext): void {
    this.validateContext(kind, ctx);
  }

  /** @internal */
  _buildPublicUrlForTest(key: string): string {
    return this.buildPublicUrl(key);
  }
}

export const uploadService = new UploadService();
